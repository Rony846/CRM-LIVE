import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { RefreshCw, AlertTriangle, CheckCircle2, ShoppingCart, Handshake, HelpCircle } from 'lucide-react';

// Admin audit of sales/dealership intent detected on customer WhatsApp: what auto-became a lead,
// and what needs a human look (possible interest, or a failed capture). Backed by /admin/missed-leads.

const Tile = ({ icon: Icon, label, value, tone = 'text-foreground' }) => (
  <div className="rounded-xl border border-border bg-card px-4 py-3">
    <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
      {Icon ? <Icon className="h-3.5 w-3.5" /> : null}{label}
    </div>
    <div className={`mt-1 text-2xl font-bold ${tone}`}>{value}</div>
  </div>
);

const INTENT = {
  sales: { label: 'Sales', icon: ShoppingCart, tone: 'text-emerald-400' },
  dealership: { label: 'Dealership', icon: Handshake, tone: 'text-violet-400' },
  possible: { label: 'Possible', icon: HelpCircle, tone: 'text-amber-400' },
};

function Row({ r }) {
  const meta = INTENT[r.intent] || INTENT.possible;
  const Icon = meta.icon;
  return (
    <tr className="border-b border-border/60 last:border-0 hover:bg-muted/20 align-top">
      <td className="px-3 py-2.5 whitespace-nowrap">
        <div className="font-medium text-foreground">{r.name || '—'}</div>
        <div className="font-mono text-xs text-muted-foreground">{r.phone}</div>
      </td>
      <td className="px-3 py-2.5">
        <span className={`inline-flex items-center gap-1 text-xs font-semibold ${meta.tone}`}>
          <Icon className="h-3.5 w-3.5" />{meta.label}
        </span>
      </td>
      <td className="px-3 py-2.5 text-sm text-foreground max-w-md">{r.text}</td>
      <td className="px-3 py-2.5 whitespace-nowrap text-center">
        {r.captured
          ? <span className="inline-flex items-center gap-1 text-xs text-emerald-400"><CheckCircle2 className="h-3.5 w-3.5" /> Lead created</span>
          : <span className="inline-flex items-center gap-1 text-xs text-amber-400"><AlertTriangle className="h-3.5 w-3.5" /> Needs review</span>}
      </td>
      <td className="px-3 py-2.5 whitespace-nowrap text-xs text-muted-foreground">
        {(r.created_at || '').slice(0, 16).replace('T', ' ')}
      </td>
    </tr>
  );
}

export default function MissedLeads() {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(14);
  const [tab, setTab] = useState('missed'); // missed | captured

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/admin/missed-leads`, {
        params: { days }, headers: { Authorization: `Bearer ${token}` },
      });
      setData(r.data);
    } catch { setData(null); }
    finally { setLoading(false); }
  }, [token, days]);

  useEffect(() => { load(); }, [load]);

  const s = data?.summary || {};
  const rows = (tab === 'missed' ? data?.missed : data?.captured) || [];

  return (
    <DashboardLayout title="WhatsApp Lead Audit">
      <div className="space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-xl font-bold text-foreground">WhatsApp Lead Audit</h2>
            <p className="text-sm text-muted-foreground">Sales &amp; dealership intent detected on customer WhatsApp — captured leads vs ones to review</p>
          </div>
          <div className="flex items-center gap-2">
            <select value={days} onChange={(e) => setDays(Number(e.target.value))}
              className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground">
              <option value={7}>Last 7 days</option>
              <option value={14}>Last 14 days</option>
              <option value={30}>Last 30 days</option>
            </select>
            <button onClick={load} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground">
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile icon={ShoppingCart} label="Intents detected" value={s.detected ?? '—'} />
          <Tile icon={CheckCircle2} label="Leads captured" value={s.captured ?? '—'} tone="text-emerald-400" />
          <Tile icon={AlertTriangle} label="Needs review" value={s.needs_review ?? '—'} tone={s.needs_review > 0 ? 'text-amber-400' : 'text-foreground'} />
          <Tile icon={Handshake} label="Dealership intents" value={s.by_intent?.dealership ?? 0} tone="text-violet-400" />
        </div>

        <div className="flex gap-2">
          {[['missed', `Needs review (${s.needs_review ?? 0})`], ['captured', `Captured (${s.captured ?? 0})`]].map(([k, lbl]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${tab === k ? 'bg-primary text-primary-foreground' : 'border border-border text-muted-foreground hover:text-foreground'}`}>
              {lbl}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 text-left font-medium">Customer</th>
                <th className="px-3 py-2 text-left font-medium">Intent</th>
                <th className="px-3 py-2 text-left font-medium">Message</th>
                <th className="px-3 py-2 text-center font-medium">Outcome</th>
                <th className="px-3 py-2 text-left font-medium">When</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={5} className="px-3 py-10 text-center text-muted-foreground">Loading…</td></tr>}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-10 text-center text-muted-foreground">
                  {tab === 'missed' ? 'Nothing needs review 🎉' : 'No captured leads in this window.'}
                </td></tr>
              )}
              {!loading && rows.map((r) => <Row key={r.id} r={r} />)}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}
