import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { API, useAuth } from '@/App';
import {
  Bot, Loader2, PlayCircle, CheckCircle2, AlertTriangle, AlertCircle,
  IndianRupee, Receipt, Scale, History, Building2, Sparkles,
  ShieldCheck, BookOpen, FileWarning, Activity, TrendingUp, XCircle,
  ChevronDown, ChevronRight, Info, Globe, MonitorPlay,
} from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, badgeStyle } from '@/components/iron/IronKit';

/* Finance Agent — Iron Console restyle. Behavior-identical drop-in for the legacy
   FinanceAgent page: same three endpoints, same run/summary/history logic. */

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

const inputStyle = { border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '7px 10px', fontSize: 12.5, color: T.iron900, background: T.white, fontFamily: T.body, outline: 'none' };
const btnPrimary = { border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 };

// Severity -> Iron pill tone.
const SEV_TONE = { high: 'bad', warn: 'warn', ok: 'ok', info: 'info' };
const SEV_ICON = { high: XCircle, warn: AlertTriangle, ok: CheckCircle2, info: Info };

const SevPill = ({ severity = 'info', children }) => {
  const Icon = SEV_ICON[severity] || Info;
  return (
    <span style={{ ...badgeStyle(SEV_TONE[severity] || 'slate'), display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: T.mono, fontSize: 9.5 }}>
      <Icon size={11} />
      {children || severity}
    </span>
  );
};

const TONE_COLOR = { blue: T.blue, green: T.green, orange: T.voltageText, red: T.orangeDeep };
const TONE_TINT = { blue: T.blueTint, green: T.greenTint, orange: T.voltageTint, red: '#FDEEE6' };

const StatTile = ({ icon: Icon, label, value, tone = 'blue', sub }) => (
  <IronCard pad="12px 14px">
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
      <div style={{ minWidth: 0 }}>
        <Caps size={8.5} color={T.iron400}>{label}</Caps>
        <div style={{ ...mono, fontWeight: 700, fontSize: 22, color: T.iron900, marginTop: 6, lineHeight: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
        {sub && <div style={{ ...mono, fontSize: 9.5, color: T.iron500, marginTop: 6, textTransform: 'uppercase', letterSpacing: '.04em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>}
      </div>
      <div style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 6, display: 'grid', placeItems: 'center', background: TONE_TINT[tone] || T.iron100, color: TONE_COLOR[tone] || T.blue }}>
        <Icon size={15} />
      </div>
    </div>
  </IronCard>
);

const FindingRow = ({ severity, title, value, note }) => (
  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 0', borderBottom: `1px solid ${T.iron200}` }}>
    <SevPill severity={severity} />
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 12.5, color: T.iron900, fontWeight: 600 }}>{title}</div>
      {note && <div style={{ fontSize: 11, color: T.iron500, marginTop: 2 }}>{note}</div>}
    </div>
    {value !== undefined && (
      <div style={{ ...mono, fontSize: 12.5, color: T.iron900, flexShrink: 0 }}>{value}</div>
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

// Browser-agent / Seller Central scrape status. Surfaced on the run card
// because a session-expired state needs admin action (re-login) before the
// next scheduled run will pull reimbursements.
const BrowserSessionPanel = ({ scrape }) => {
  if (!scrape) return null;
  const status = scrape.status;
  const palette = status === 'ok'
    ? { bg: T.greenTint, bd: '#CBE5D6', fg: T.green }
    : status === 'session_expired'
      ? { bg: T.voltageTint, bd: '#EDDFA6', fg: T.voltageText }
      : status === 'page_changed'
        ? { bg: '#FDEEE6', bd: '#F6D8BA', fg: T.orangeDeep }
        : { bg: T.iron100, bd: T.iron200, fg: T.iron700 };
  const Icon = status === 'ok' ? CheckCircle2
    : status === 'session_expired' ? AlertTriangle
    : status === 'page_changed' ? XCircle
    : Info;
  return (
    <div style={{ background: palette.bg, border: `1px solid ${palette.bd}`, borderRadius: 6, padding: '11px 14px', display: 'flex', alignItems: 'flex-start', gap: 10, color: palette.fg }}>
      <Icon size={16} style={{ flexShrink: 0, marginTop: 2 }} />
      <div style={{ flex: 1, minWidth: 0, fontSize: 12.5 }}>
        <div style={{ fontFamily: T.headline, fontWeight: 700 }}>
          Browser agent · Seller Central scrape
          {scrape.firm_name && <span style={{ fontWeight: 400, opacity: 0.8, marginLeft: 6 }}>({scrape.firm_name})</span>}
        </div>
        <div style={{ fontSize: 11.5, marginTop: 2, opacity: 0.9 }}>
          {status === 'ok' && (
            <>Pulled {scrape.scraped} reimbursement rows; {scrape.new_rows} new, {scrape.booked} booked.</>
          )}
          {status === 'session_expired' && (
            <>Browser is not logged in. Open the screen-pop console, sign into Seller Central once,
            and the next agent run will pick up reimbursements.</>
          )}
          {status === 'page_changed' && (
            <>Reimbursement report page didn't return a recognized table. Amazon may have shipped a layout
            change; scraper selectors need an update. {scrape.error}</>
          )}
          {status === 'error' && (<>Scrape failed: {scrape.error || 'unknown error'}</>)}
        </div>
        {(status === 'session_expired' || status === 'page_changed') && (
          <Link
            to="/admin/browser-agent"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, marginTop: 8, textDecoration: 'underline', color: palette.fg, opacity: 0.9 }}
          >
            <MonitorPlay size={12} /> Open browser-agent console
          </Link>
        )}
      </div>
    </div>
  );
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
  const statusTone = run.status === 'completed' ? 'ok' : run.status === 'failed' ? 'bad' : 'warn';
  return (
    <div style={{ borderBottom: `1px solid ${T.iron200}` }}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="iron-row"
        style={{ width: '100%', padding: '12px 18px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
      >
        <div style={{ ...mono, fontSize: 11, color: T.iron500, width: 176, flexShrink: 0 }}>
          {formatDateTime(run.started_at)}
        </div>
        <span style={{ ...badgeStyle('slate'), fontFamily: T.mono, fontSize: 9.5 }}>
          {run.trigger || 'scheduled'}
        </span>
        <span style={badgeStyle(statusTone)}>{run.status}</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
          {totals.fees_total_amount > 0 && (
            <span style={badgeStyle('info')}>{formatINR(totals.fees_total_amount)} fees</span>
          )}
          {totals.refunds_posted > 0 && (
            <span style={badgeStyle('ok')}>{totals.refunds_posted} refunds</span>
          )}
          {totals.a_to_z_booked > 0 && (
            <span style={badgeStyle('ok')}>{totals.a_to_z_booked} A-Z</span>
          )}
          {totals.reimbursements_booked > 0 && (
            <span style={badgeStyle('ok')}>{formatINR(totals.reimbursements_total_amount)} FBA reimb</span>
          )}
          {run.reimbursement_scrape?.status === 'session_expired' && (
            <span style={{ ...badgeStyle('warn'), display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <AlertTriangle size={11} /> browser session expired
            </span>
          )}
          {run.reimbursement_scrape?.status === 'page_changed' && (
            <span style={{ ...badgeStyle('bad'), display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <XCircle size={11} /> reimb page changed
            </span>
          )}
          {counts.high > 0 && <SevPill severity="high">{counts.high} critical</SevPill>}
          {counts.warn > 0 && <SevPill severity="warn">{counts.warn} review</SevPill>}
          {!counts.high && !counts.warn && findings.length === 0 && totals.errors === 0 && (
            <SevPill severity="ok">all clean</SevPill>
          )}
        </div>
        <div style={{ marginLeft: 'auto', color: T.iron400 }}>
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </div>
      </button>
      {open && (
        <div style={{ padding: '0 18px 16px', background: T.iron50 }}>
          {run.reimbursement_scrape && run.reimbursement_scrape.status !== 'skipped' && (
            <div style={{ paddingTop: 8 }}><BrowserSessionPanel scrape={run.reimbursement_scrape} /></div>
          )}
          {findings.length === 0 ? (
            <div style={{ fontSize: 12.5, color: T.iron500, padding: '16px 0', textAlign: 'center' }}>
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

const CardHead = ({ icon: Icon, iconColor = T.orange, title, right }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '12px 18px', borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {Icon && <Icon size={15} color={iconColor} />}
      <span style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 13, color: T.iron900 }}>{title}</span>
      {right}
    </div>
  </div>
);

const DoesItem = ({ icon: Icon, color, bold, children }) => (
  <li style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8, fontSize: 12.5, color: T.iron500 }}>
    <Icon size={15} color={color} style={{ marginTop: 1, flexShrink: 0 }} />
    <span><span style={{ color: T.iron900, fontWeight: 600 }}>{bold}</span> {children}</span>
  </li>
);

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
      if (t.reimbursements_booked > 0) bits.push(`${formatINR(t.reimbursements_total_amount)} FBA reimb`);
      if (t.reimbursement_status === 'session_expired') bits.push('browser expired');
      if (t.reimbursement_status === 'page_changed')    bits.push('reimb page changed');
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

  const activeBadge = (
    <span style={{ ...badgeStyle('ok'), display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, padding: '4px 10px' }}>
      <CheckCircle2 size={13} /> Active · 08:00 IST daily
    </span>
  );

  return (
    <IronShell title="Finance Agent" subtitle="AUDIT-GRADE RECONCILIATION" onRefresh={fetchHistory} headerRight={activeBadge}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1200 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Bot size={20} color={T.orange} />
              <span style={{ fontFamily: T.headline, fontWeight: 800, fontSize: 20, color: T.iron900 }}>Finance Agent</span>
              <span style={{ ...badgeStyle('violet'), fontFamily: T.mono, fontSize: 9.5 }}>Audit grade</span>
            </div>
            <p style={{ fontSize: 12.5, color: T.iron500, marginTop: 6, maxWidth: 720 }}>
              Daily reconciliation across Amazon settlements, the general ledger, GST registers and receivables.
              Books what's bookable; surfaces what needs human review without auto-resolving it.
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr)', gap: 16 }}>
          {/* What it does */}
          <IronCard pad={0}>
            <CardHead icon={Sparkles} title="What this agent does" />
            <div style={{ padding: 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 16 }}>
              <div>
                <Caps size={9} color={T.iron400} style={{ display: 'block', marginBottom: 8 }}>Actions (books your ledger)</Caps>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                  <DoesItem icon={Receipt} color={T.orange} bold="Books settlement fees">as journal entries (Dr Expense / Cr Marketplace Clearing).</DoesItem>
                  <DoesItem icon={IndianRupee} color={T.green} bold="Books refunds">as credit notes from every Refund-type settlement row.</DoesItem>
                  <DoesItem icon={ShieldCheck} color="#6D4AB0" bold="Books A-Z claim outcomes">— granted claims get a credit note; pending and denied are counted.</DoesItem>
                  <DoesItem icon={Globe} color={T.blue} bold="Pulls FBA reimbursements">from Seller Central via the browser agent (SP-API doesn't ship these for IN sellers) and books each as Dr Receivable / Cr Reimbursement Income.</DoesItem>
                </ul>
              </div>
              <div>
                <Caps size={9} color={T.iron400} style={{ display: 'block', marginBottom: 8 }}>Checks (audit-grade controls)</Caps>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                  <DoesItem icon={Scale} color={T.voltageText} bold="Three-way settlement match">— sales − fees − refunds = payout, flag drift &gt; ₹100.</DoesItem>
                  <DoesItem icon={BookOpen} color={T.orangeDeep} bold="Trial balance integrity">— 30-day debits must equal credits, no exceptions.</DoesItem>
                  <DoesItem icon={Building2} color={T.blue} bold="Marketplace clearing balance">— should trend to zero; aged drift flagged.</DoesItem>
                  <DoesItem icon={FileWarning} color={T.voltageText} bold="GST output reconciliation">— invoice register vs books, current month.</DoesItem>
                  <DoesItem icon={AlertCircle} color={T.orangeDeep} bold="Duplicate detection">— invoice numbers + payment references, 30-day window.</DoesItem>
                  <DoesItem icon={Activity} color="#6D4AB0" bold="Anomaly detection">— today vs 30-day baseline, flag &gt; 3× spike.</DoesItem>
                  <DoesItem icon={TrendingUp} color={T.blue} bold="Receivables aging">— bucketed; 90+ over ₹1L flagged for write-off review.</DoesItem>
                  <DoesItem icon={AlertTriangle} color={T.voltageText} bold="Stuck reimbursements">— refunded items where the product never came back &gt; 30 days.</DoesItem>
                </ul>
              </div>
              <div style={{ gridColumn: '1 / -1', fontSize: 11.5, color: T.iron500, borderTop: `1px solid ${T.iron200}`, paddingTop: 12 }}>
                <span style={{ color: T.iron900, fontWeight: 600 }}>Coming next:</span> long-term storage fees and
                lost/damaged inventory adjustments — both need additional browser-agent scrapers. Per-firm
                Seller Central support is also pending; today the browser pulls from one logged-in account.
              </div>
            </div>
          </IronCard>

          {/* Run now panel */}
          <IronCard pad={0}>
            <CardHead icon={PlayCircle} title="Run now" />
            <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <Caps size={9} color={T.iron400} style={{ display: 'block', marginBottom: 5 }}>Firm</Caps>
                <select
                  value={selectedFirm}
                  onChange={(e) => setSelectedFirm(e.target.value)}
                  style={{ ...inputStyle, width: '100%' }}
                >
                  <option value="all">All firms with Amazon credentials</option>
                  {firms.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleRun}
                disabled={running}
                data-testid="run-finance-agent-now-btn"
                style={{ ...btnPrimary, width: '100%', opacity: running ? 0.7 : 1, cursor: running ? 'default' : 'pointer' }}
              >
                {running
                  ? <><Loader2 size={15} className="animate-spin" /> Running…</>
                  : <><PlayCircle size={15} /> Run Finance Agent</>}
              </button>
              <p style={{ fontSize: 11, color: T.iron500, margin: 0 }}>
                Same code path as the scheduled 08:00 IST run. Safe to re-run mid-day — every step is idempotent
                and every run is persisted to the audit trail.
              </p>
            </div>
          </IronCard>
        </div>

        {/* Last manual run summary */}
        {lastRun && (
          <IronCard pad={0}>
            <CardHead icon={CheckCircle2} iconColor={T.green}
              title={`Last manual run · ${formatDateTime(lastRun.ran_at)} · ${lastRun.firms_run} firm${lastRun.firms_run === 1 ? '' : 's'}`}
              right={lastRun.priority === 'high' ? <SevPill severity="high">needs review</SevPill> : null}
            />
            <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* Browser-agent status row — only shown when the scrape was
                  attempted (skipped means no Amazon firm configured). */}
              {lastRun.reimbursement_scrape && lastRun.reimbursement_scrape.status !== 'skipped' && (
                <BrowserSessionPanel scrape={lastRun.reimbursement_scrape} />
              )}

              {/* Actions taken */}
              <div>
                <Caps size={9} color={T.iron400} style={{ display: 'block', marginBottom: 8 }}>Actions booked</Caps>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12 }}>
                  <StatTile icon={Receipt} label="Fees" value={formatINR(lastTotals.fees_total_amount)} sub={`${lastTotals.fees_journal_entries || 0} JEs`} tone="blue" />
                  <StatTile icon={IndianRupee} label="Refunds" value={lastTotals.refunds_posted || 0} sub={`${lastTotals.refunds_skipped || 0} skipped`} tone="green" />
                  <StatTile icon={ShieldCheck} label="A-Z booked" value={lastTotals.a_to_z_booked || 0} sub={`${lastTotals.a_to_z_pending || 0} pending`} tone="green" />
                  <StatTile icon={Globe} label="FBA reimb" value={formatINR(lastTotals.reimbursements_total_amount)} sub={`${lastTotals.reimbursements_booked || 0} booked / ${lastTotals.reimbursements_new || 0} new`} tone="green" />
                  <StatTile icon={Building2} label="Firms" value={lastRun.firms_run || 0} tone="blue" />
                </div>
              </div>

              {/* Findings tallied */}
              <div>
                <Caps size={9} color={T.iron400} style={{ display: 'block', marginBottom: 8 }}>Findings tallied</Caps>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12 }}>
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
                  <Caps size={9} color={T.iron400} style={{ display: 'block', marginBottom: 8 }}>
                    Issues to triage ({lastFindings.length})
                  </Caps>
                  <div style={{ border: `1px solid ${T.iron200}`, borderRadius: 8 }}>
                    {lastFindings.slice(0, 30).map((f, i) => (
                      <div key={i} style={{ padding: '0 14px' }}>
                        <FindingRow severity={f.severity} title={f.title} value={f.value} note={f.note} />
                      </div>
                    ))}
                    {lastFindings.length > 30 && (
                      <div style={{ fontSize: 11.5, color: T.iron500, textAlign: 'center', padding: '8px 0', borderTop: `1px solid ${T.iron200}` }}>
                        + {lastFindings.length - 30} more
                      </div>
                    )}
                  </div>
                </div>
              )}

              {lastFindings.length === 0 && (lastTotals.errors || 0) === 0 && (
                <div style={{ fontSize: 12.5, color: T.green, display: 'flex', alignItems: 'center', gap: 8, background: T.greenTint, border: '1px solid #CBE5D6', borderRadius: 8, padding: 12 }}>
                  <CheckCircle2 size={16} />
                  All checks passed. No drift, no duplicates, no anomalies. Books are clean.
                </div>
              )}
            </div>
          </IronCard>
        )}

        {/* Run history (from scheduled_job_runs audit log) */}
        <IronCard pad={0}>
          <CardHead icon={History} title="Run history"
            right={<span style={{ fontSize: 11, color: T.iron400, marginLeft: 4 }}>from audit trail</span>}
          />
          {historyLoading ? (
            <div style={{ padding: 32, display: 'flex', justifyContent: 'center' }}>
              <Loader2 size={24} className="animate-spin" color={T.orange} />
            </div>
          ) : history.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', fontSize: 12.5, color: T.iron500 }}>
              No runs yet. Click "Run Finance Agent" above or wait for the 08:00 IST scheduled run.
            </div>
          ) : (
            <div>
              {history.map((r, i) => (
                <RunCard key={r.id} run={r} defaultOpen={i === 0} />
              ))}
            </div>
          )}
        </IronCard>
      </div>
    </IronShell>
  );
}
