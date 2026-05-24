import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import {
  Bot, Loader2, PlayCircle, Clock, CheckCircle2, AlertTriangle, AlertCircle,
  IndianRupee, Receipt, Scale, History, Building2, Sparkles,
  ShieldCheck, BookOpen, FileWarning, Activity, TrendingUp, XCircle,
  ChevronDown, ChevronRight, Info,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

const formatINR = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
    .format(Number(n) || 0);

const formatDateTime = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
  } catch { return iso; }
};

const SEV_BADGE = {
  high: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  warn: 'bg-orange-400/15 text-orange-400 border-orange-400/30',
  ok:   'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  info: 'bg-sky-400/15 text-sky-400 border-sky-400/30',
};

const SEV_ICON = { high: XCircle, warn: AlertTriangle, ok: CheckCircle2, info: Info };

const SevPill = ({ severity = 'info', children }) => {
  const Icon = SEV_ICON[severity] || Info;
  return (
    <Badge className={`${SEV_BADGE[severity]} border font-mono text-[10px] uppercase tracking-wider px-2 py-0.5`}>
      <Icon className="w-3 h-3 mr-1" />
      {children || severity}
    </Badge>
  );
};

const StatTile = ({ icon: Icon, label, value, tone = 'blue', sub }) => {
  const tones = {
    blue:   'bg-primary/15 text-primary',
    green:  'bg-emerald-500/15 text-emerald-400',
    orange: 'bg-orange-400/15 text-orange-400',
    red:    'bg-rose-500/15 text-rose-400',
  };
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
          <p className="mt-1.5 font-mono text-[22px] font-bold tabular-nums leading-none text-foreground truncate">{value}</p>
          {sub && <p className="mt-1.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground truncate">{sub}</p>}
        </div>
        <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded ${tones[tone]}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
};

const FindingRow = ({ severity, title, value, note }) => (
  <div className="flex items-start gap-3 py-2.5 border-b border-border last:border-0">
    <SevPill severity={severity} />
    <div className="flex-1 min-w-0">
      <div className="text-sm text-foreground font-medium">{title}</div>
      {note && <div className="text-xs text-muted-foreground mt-0.5">{note}</div>}
    </div>
    {value !== undefined && (
      <div className="font-mono text-sm text-foreground tabular-nums flex-shrink-0">{value}</div>
    )}
  </div>
);

// Aggregate severity-counts across per-firm payloads so the run header can
// summarize "5 high · 12 warn" without each firm shouting individually.
const collectFindings = (perFirm) => {
  const findings = [];
  for (const s of perFirm || []) {
    const firm = s.firm_name || s.firm_id || 'firm';
    const push = (severity, title, value, note) =>
      findings.push({ firm, severity, title, value, note });

    // Three-way drift
    for (const d of s.settlement_drift || []) {
      push(d.severity || 'warn', `Settlement drift — ${d.period_end || ''}`,
        formatINR(d.drift),
        `${firm} · declared ${formatINR(d.declared_payout)} vs computed ${formatINR(d.computed_payout)}`);
    }
    // Unmatched
    if ((s.unmatched_transactions || 0) > 0) {
      push('warn', 'Unmatched payout transactions', s.unmatched_transactions,
        `${firm} · review in E-commerce Recon`);
    }
    // Stuck reimbursements
    if ((s.stuck_reimbursements || []).length > 0) {
      const total = (s.stuck_reimbursements || []).reduce((a, r) => a + (r.amount || 0), 0);
      push('warn', 'Stuck reimbursements (refunded, not returned)',
        `${s.stuck_reimbursements.length} · ${formatINR(total)}`,
        `${firm} · candidate FBA reimbursement claims`);
    }
    // A-Z pending
    if ((s.a_to_z?.pending || 0) > 0) {
      push('info', 'A-Z claims pending Amazon decision', s.a_to_z.pending, firm);
    }
    // Trial balance
    if (s.trial_balance && !s.trial_balance.ok) {
      push('high', 'Trial balance is OUT of balance',
        formatINR(s.trial_balance.diff),
        `${firm} · Dr ${formatINR(s.trial_balance.debit)} vs Cr ${formatINR(s.trial_balance.credit)} (last 30 days) — GL is broken`);
    }
    // Clearing
    if (s.clearing && s.clearing.severity !== 'ok') {
      push(s.clearing.severity, 'Marketplace clearing account drift',
        formatINR(s.clearing.balance),
        `${firm} · aged ${s.clearing.age_days}d — deposits not matching fees`);
    }
    // GST
    if (s.gst && s.gst.severity !== 'ok') {
      push(s.gst.severity,
        s.gst.register_snapshot
          ? `GST output drift (${s.gst.period})`
          : `GST register not snapshot yet (${s.gst.period})`,
        s.gst.register_snapshot ? formatINR(s.gst.drift) : formatINR(s.gst.invoices_sum),
        `${firm} · invoices ${formatINR(s.gst.invoices_sum)} vs register ${formatINR(s.gst.register_value)}`);
    }
    // Duplicates
    const dupInv = (s.duplicates?.duplicate_invoices || []).length;
    const dupPay = (s.duplicates?.duplicate_payments || []).length;
    if (dupInv > 0) push('high', 'Duplicate invoice numbers', dupInv, `${firm} · last 30 days`);
    if (dupPay > 0) push('high', 'Duplicate payment references', dupPay, `${firm} · last 30 days`);
    // Anomalies
    for (const a of s.anomalies || []) {
      push(a.severity || 'warn',
        `Anomaly: ${a.metric} is ${a.multiple}× the 30-day baseline`,
        a.today,
        `${firm} · baseline ${a.baseline}`);
    }
    // Aging
    if (s.aging?.severity === 'warn') {
      push('warn', '90+ day receivables crossed threshold',
        formatINR(s.aging.buckets?.['90+']),
        `${firm} · total outstanding ${formatINR(s.aging.total_outstanding)}`);
    }
    // Errors
    for (const e of s.errors || []) {
      push('high', 'Agent error', '', `${firm} · ${e}`);
    }
  }
  // Severity sort: high → warn → info → ok
  const order = { high: 0, warn: 1, info: 2, ok: 3 };
  findings.sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9));
  return findings;
};

const RunCard = ({ run, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  const totals = run.totals || {};
  const perFirm = Object.values(run.per_firm || {});
  const findings = collectFindings(perFirm);
  const counts = findings.reduce((acc, f) => {
    acc[f.severity] = (acc[f.severity] || 0) + 1;
    return acc;
  }, {});
  return (
    <div className="border-b border-border last:border-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full px-5 py-3 flex flex-wrap items-center gap-3 hover:bg-muted/30 transition-colors text-left"
      >
        <div className="font-mono text-[11px] text-muted-foreground w-44 flex-shrink-0">
          {formatDateTime(run.started_at)}
        </div>
        <Badge className="bg-muted text-muted-foreground text-[10px] font-mono uppercase">
          {run.trigger || 'scheduled'}
        </Badge>
        <Badge className={`text-[10px] ${run.status === 'completed' ? 'bg-emerald-500/15 text-emerald-400' : run.status === 'failed' ? 'bg-rose-500/15 text-rose-400' : 'bg-orange-400/15 text-orange-400'}`}>
          {run.status}
        </Badge>
        <div className="flex flex-wrap items-center gap-1.5 font-mono text-xs">
          {totals.fees_total_amount > 0 && (
            <Badge className="bg-primary/15 text-primary text-[10px]">{formatINR(totals.fees_total_amount)} fees</Badge>
          )}
          {totals.refunds_posted > 0 && (
            <Badge className="bg-emerald-500/15 text-emerald-400 text-[10px]">{totals.refunds_posted} refunds</Badge>
          )}
          {totals.a_to_z_booked > 0 && (
            <Badge className="bg-emerald-500/15 text-emerald-400 text-[10px]">{totals.a_to_z_booked} A-Z</Badge>
          )}
          {counts.high > 0 && <SevPill severity="high">{counts.high} critical</SevPill>}
          {counts.warn > 0 && <SevPill severity="warn">{counts.warn} review</SevPill>}
          {!counts.high && !counts.warn && findings.length === 0 && totals.errors === 0 && (
            <SevPill severity="ok">all clean</SevPill>
          )}
        </div>
        <div className="ml-auto text-muted-foreground">
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </div>
      </button>
      {open && (
        <div className="px-5 pb-4 space-y-1 bg-muted/10">
          {findings.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4 text-center">
              No findings — books are in balance, drift within tolerance, no anomalies.
            </div>
          ) : (
            findings.map((f, i) => (
              <FindingRow
                key={i}
                severity={f.severity}
                title={f.title}
                value={f.value}
                note={f.note}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default function FinanceAgent() {
  const { token } = useAuth();
  const [firms, setFirms] = useState([]);
  const [selectedFirm, setSelectedFirm] = useState('all');
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const fetchFirms = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/firms`, { headers: { Authorization: `Bearer ${token}` } });
      setFirms(res.data || []);
    } catch { /* non-fatal */ }
  }, [token]);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await axios.get(`${API}/finance/agent-runs?limit=20`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setHistory(Array.isArray(res.data) ? res.data : []);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchFirms();
    fetchHistory();
  }, [fetchFirms, fetchHistory]);

  const handleRun = async () => {
    if (running) return;
    setRunning(true);
    try {
      const params = (selectedFirm && selectedFirm !== 'all') ? `?firm_id=${selectedFirm}` : '';
      const res = await axios.post(`${API}/finance/run-daily-agent${params}`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setLastRun({ ...res.data, ran_at: new Date().toISOString() });
      const t = res.data?.totals || {};
      const bits = [];
      if (t.fees_total_amount > 0) bits.push(`${formatINR(t.fees_total_amount)} fees`);
      if (t.refunds_posted > 0)    bits.push(`${t.refunds_posted} refunds`);
      if (t.a_to_z_booked > 0)     bits.push(`${t.a_to_z_booked} A-Z`);
      const findings = (t.unmatched_transactions || 0) + (t.stuck_reimbursements || 0)
        + (t.settlement_drifts || 0) + (t.trial_balance_failures || 0)
        + (t.duplicates_found || 0) + (t.anomalies || 0);
      if (findings > 0) bits.push(`${findings} findings`);
      const summary = bits.length ? bits.join(' · ') : 'all clean';
      const toastFn = res.data?.priority === 'high' ? toast.warning : toast.success;
      toastFn(`Finance agent: ${summary} (${res.data?.firms_run || 0} firm${res.data?.firms_run === 1 ? '' : 's'})`);
      fetchHistory();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Finance agent run failed.');
    } finally {
      setRunning(false);
    }
  };

  const lastTotals = lastRun?.totals || {};
  const lastFindings = collectFindings(lastRun?.per_firm || []);

  return (
    <DashboardLayout title="Finance Agent">
      <div className="space-y-4 max-w-7xl">
        {/* Header */}
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
              <Bot className="w-5 h-5 text-primary" /> Finance Agent
              <Badge className="bg-violet-400/15 text-violet-400 font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 ml-1">
                Audit grade
              </Badge>
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Daily reconciliation across Amazon settlements, the general ledger, GST registers and receivables.
              Books what's bookable; surfaces what needs human review without auto-resolving it.
            </p>
          </div>
          <Badge className="bg-emerald-500/15 text-emerald-400 font-mono text-[11px] uppercase tracking-wider px-3 py-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Active · 08:00 IST daily
          </Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* What it does */}
          <Card className="mg-card border-border lg:col-span-2">
            <CardHeader className="border-b border-border bg-muted/30 py-3 px-5">
              <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" /> What this agent does
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">Actions (books your ledger)</div>
                <ul className="space-y-2 text-muted-foreground">
                  <li className="flex items-start gap-2"><Receipt className="w-4 h-4 text-primary mt-0.5" /><span><span className="text-foreground font-medium">Books settlement fees</span> as journal entries (Dr Expense / Cr Marketplace Clearing).</span></li>
                  <li className="flex items-start gap-2"><IndianRupee className="w-4 h-4 text-emerald-400 mt-0.5" /><span><span className="text-foreground font-medium">Books refunds</span> as credit notes from every Refund-type settlement row.</span></li>
                  <li className="flex items-start gap-2"><ShieldCheck className="w-4 h-4 text-violet-400 mt-0.5" /><span><span className="text-foreground font-medium">Books A-Z claim outcomes</span> — granted claims get a credit note; pending and denied are counted.</span></li>
                </ul>
              </div>
              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">Checks (audit-grade controls)</div>
                <ul className="space-y-2 text-muted-foreground">
                  <li className="flex items-start gap-2"><Scale className="w-4 h-4 text-orange-400 mt-0.5" /><span><span className="text-foreground font-medium">Three-way settlement match</span> — sales − fees − refunds = payout, flag drift &gt; ₹100.</span></li>
                  <li className="flex items-start gap-2"><BookOpen className="w-4 h-4 text-rose-400 mt-0.5" /><span><span className="text-foreground font-medium">Trial balance integrity</span> — 30-day debits must equal credits, no exceptions.</span></li>
                  <li className="flex items-start gap-2"><Building2 className="w-4 h-4 text-sky-400 mt-0.5" /><span><span className="text-foreground font-medium">Marketplace clearing balance</span> — should trend to zero; aged drift flagged.</span></li>
                  <li className="flex items-start gap-2"><FileWarning className="w-4 h-4 text-orange-400 mt-0.5" /><span><span className="text-foreground font-medium">GST output reconciliation</span> — invoice register vs books, current month.</span></li>
                  <li className="flex items-start gap-2"><AlertCircle className="w-4 h-4 text-rose-400 mt-0.5" /><span><span className="text-foreground font-medium">Duplicate detection</span> — invoice numbers + payment references, 30-day window.</span></li>
                  <li className="flex items-start gap-2"><Activity className="w-4 h-4 text-violet-400 mt-0.5" /><span><span className="text-foreground font-medium">Anomaly detection</span> — today vs 30-day baseline, flag &gt; 3× spike.</span></li>
                  <li className="flex items-start gap-2"><TrendingUp className="w-4 h-4 text-sky-400 mt-0.5" /><span><span className="text-foreground font-medium">Receivables aging</span> — bucketed; 90+ over ₹1L flagged for write-off review.</span></li>
                  <li className="flex items-start gap-2"><AlertTriangle className="w-4 h-4 text-orange-400 mt-0.5" /><span><span className="text-foreground font-medium">Stuck reimbursements</span> — refunded items where the product never came back &gt; 30 days.</span></li>
                </ul>
              </div>
              <div className="md:col-span-2 text-xs text-muted-foreground border-t border-border pt-3 mt-1">
                <span className="text-foreground font-medium">Coming next (needs SP-API ingestion):</span> FBA reimbursements,
                long-term storage fees, lost/damaged inventory adjustments. Until then those gaps are surfaced as stuck
                reimbursements where applicable.
              </div>
            </CardContent>
          </Card>

          {/* Run now panel */}
          <Card className="mg-card border-border">
            <CardHeader className="border-b border-border bg-muted/30 py-3 px-5">
              <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                <PlayCircle className="w-4 h-4 text-primary" /> Run now
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-3">
              <div>
                <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Firm</label>
                <Select value={selectedFirm} onValueChange={setSelectedFirm}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="All firms" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All firms with Amazon credentials</SelectItem>
                    {firms.map((f) => (
                      <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleRun}
                disabled={running}
                className="w-full"
                data-testid="run-finance-agent-now-btn"
              >
                {running
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Running…</>
                  : <><PlayCircle className="w-4 h-4 mr-2" /> Run Finance Agent</>}
              </Button>
              <p className="text-[11px] text-muted-foreground">
                Same code path as the scheduled 08:00 IST run. Safe to re-run mid-day — every step is idempotent
                and every run is persisted to the audit trail.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Last manual run summary */}
        {lastRun && (
          <>
            <Card className="mg-card border-border">
              <CardHeader className="border-b border-border bg-muted/30 py-3 px-5">
                <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Last manual run · {formatDateTime(lastRun.ran_at)} · {lastRun.firms_run} firm{lastRun.firms_run === 1 ? '' : 's'}
                  {lastRun.priority === 'high' && <SevPill severity="high">needs review</SevPill>}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-5">
                {/* Actions taken */}
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">Actions booked</div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <StatTile icon={Receipt} label="Fees" value={formatINR(lastTotals.fees_total_amount)} sub={`${lastTotals.fees_journal_entries || 0} JEs`} tone="blue" />
                    <StatTile icon={IndianRupee} label="Refunds" value={lastTotals.refunds_posted || 0} sub={`${lastTotals.refunds_skipped || 0} skipped`} tone="green" />
                    <StatTile icon={ShieldCheck} label="A-Z booked" value={lastTotals.a_to_z_booked || 0} sub={`${lastTotals.a_to_z_pending || 0} pending`} tone="green" />
                    <StatTile icon={Building2} label="Firms" value={lastRun.firms_run || 0} tone="blue" />
                  </div>
                </div>

                {/* Findings tallied */}
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">Findings tallied</div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <StatTile icon={Scale} label="Unmatched" value={lastTotals.unmatched_transactions || 0} sub="payout rows" tone={lastTotals.unmatched_transactions > 0 ? 'orange' : 'blue'} />
                    <StatTile icon={AlertTriangle} label="Stuck reimb" value={lastTotals.stuck_reimbursements || 0} sub="refunded, not returned" tone={lastTotals.stuck_reimbursements > 0 ? 'orange' : 'blue'} />
                    <StatTile icon={BookOpen} label="TB breaks" value={lastTotals.trial_balance_failures || 0} sub="GL out of balance" tone={lastTotals.trial_balance_failures > 0 ? 'red' : 'green'} />
                    <StatTile icon={AlertCircle} label="Duplicates" value={lastTotals.duplicates_found || 0} sub="invoices + payments" tone={lastTotals.duplicates_found > 0 ? 'red' : 'green'} />
                    <StatTile icon={Activity} label="Anomalies" value={lastTotals.anomalies || 0} sub="vs 30-day baseline" tone={lastTotals.anomalies > 0 ? 'orange' : 'green'} />
                    <StatTile icon={Building2} label="Clearing drift" value={lastTotals.clearing_drifts || 0} sub="firms above threshold" tone={lastTotals.clearing_drifts > 0 ? 'orange' : 'green'} />
                    <StatTile icon={FileWarning} label="GST drift" value={lastTotals.gst_drifts || 0} sub="invoices vs register" tone={lastTotals.gst_drifts > 0 ? 'orange' : 'green'} />
                    <StatTile icon={TrendingUp} label="90+ aging" value={formatINR(lastTotals.aging_90plus_total)} sub="receivables" tone={lastTotals.aging_90plus_total > 100000 ? 'orange' : 'blue'} />
                  </div>
                </div>

                {/* Individual findings */}
                {lastFindings.length > 0 && (
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
                      Issues to triage ({lastFindings.length})
                    </div>
                    <div className="border border-border rounded">
                      {lastFindings.slice(0, 30).map((f, i) => (
                        <div key={i} className="px-4">
                          <FindingRow severity={f.severity} title={f.title} value={f.value} note={f.note} />
                        </div>
                      ))}
                      {lastFindings.length > 30 && (
                        <div className="text-xs text-muted-foreground text-center py-2 border-t border-border">
                          + {lastFindings.length - 30} more
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {lastFindings.length === 0 && (lastTotals.errors || 0) === 0 && (
                  <div className="text-sm text-emerald-400 flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded p-3">
                    <CheckCircle2 className="w-4 h-4" />
                    All checks passed. No drift, no duplicates, no anomalies. Books are clean.
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* Run history (from scheduled_job_runs audit log) */}
        <Card className="mg-card border-border">
          <CardHeader className="border-b border-border bg-muted/30 py-3 px-5">
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <History className="w-4 h-4 text-primary" /> Run history
              <span className="text-xs text-muted-foreground font-normal ml-2">from audit trail</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {historyLoading ? (
              <div className="p-8 flex justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : history.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No runs yet. Click "Run Finance Agent" above or wait for the 08:00 IST scheduled run.
              </div>
            ) : (
              <div>
                {history.map((r, i) => (
                  <RunCard key={r.id} run={r} defaultOpen={i === 0} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
