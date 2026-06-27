import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import {
  Users, RefreshCw, Phone, Target, Headphones, Clock, AlertTriangle,
  TrendingUp, CheckCircle2,
} from 'lucide-react';

// Live workload + performance for the supervisor's sales & support staff (role call_support).
// Self-contained: drop <SupervisorTeam /> anywhere inside the supervisor dashboard.

const Tile = ({ icon: Icon, label, value, tone = 'text-foreground' }) => (
  <div className="rounded-xl border border-border bg-card px-4 py-3">
    <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
      {Icon ? <Icon className="h-3.5 w-3.5" /> : null}{label}
    </div>
    <div className={`mt-1 text-2xl font-bold ${tone}`}>{value}</div>
  </div>
);

// number cell that turns amber/rose when it's a problem worth the supervisor's attention
const Num = ({ n, warn, bad }) => {
  const v = n || 0;
  const tone = v === 0 ? 'text-muted-foreground' : bad && v > 0 ? 'text-rose-400'
    : warn && v > 0 ? 'text-amber-400' : 'text-foreground';
  return <span className={`font-semibold ${tone}`}>{v}</span>;
};

export default function SupervisorTeam() {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/supervisor/team-overview`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setData(r.data);
    } catch (e) {
      // surfaced by the parent dashboard's error handling; keep this section quiet
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  const team = data?.team || [];
  const s = data?.summary || {};

  return (
    <section className="space-y-3" data-testid="supervisor-team">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-bold text-foreground">
            <Users className="h-5 w-5 text-violet-400" /> Sales &amp; Support Team
          </h3>
          <p className="text-xs text-muted-foreground">What each staffer is working on right now, and how they're performing</p>
        </div>
        <button onClick={load}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {/* team roll-up */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Tile icon={Target} label="Active leads" value={s.active_leads ?? '—'} />
        <Tile icon={Headphones} label="Open tickets" value={s.open_tickets ?? '—'} />
        <Tile icon={TrendingUp} label="Converted · 7d" value={s.converted_7d ?? '—'} tone="text-emerald-400" />
        <Tile icon={CheckCircle2} label="Resolved · 7d" value={s.resolved_7d ?? '—'} tone="text-emerald-400" />
        <Tile icon={AlertTriangle} label="SLA breaches" value={s.sla_breaches ?? '—'} tone={s.sla_breaches > 0 ? 'text-rose-400' : 'text-foreground'} />
        <Tile icon={Clock} label="Overdue follow-ups" value={s.followups_overdue ?? '—'} tone={s.followups_overdue > 0 ? 'text-amber-400' : 'text-foreground'} />
      </div>

      {/* per-staffer table */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30 text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2 text-left font-medium">Staff</th>
              <th className="px-2 py-2 text-center font-medium" colSpan={4}>⟶ Working now</th>
              <th className="px-2 py-2 text-center font-medium" colSpan={5}>⟶ Performance</th>
            </tr>
            <tr className="border-b border-border text-[11px] text-muted-foreground">
              <th className="px-3 py-1.5 text-left font-normal"></th>
              <th className="px-2 py-1.5 text-center font-normal" title="Active leads in pipeline">Leads</th>
              <th className="px-2 py-1.5 text-center font-normal" title="Open support tickets">Tickets</th>
              <th className="px-2 py-1.5 text-center font-normal" title="Follow-ups due today">Due</th>
              <th className="px-2 py-1.5 text-center font-normal" title="Follow-ups overdue">Overdue</th>
              <th className="px-2 py-1.5 text-center font-normal" title="Leads converted in last 7 / 30 days">Conv 7d/30d</th>
              <th className="px-2 py-1.5 text-center font-normal" title="Conversion rate">Conv %</th>
              <th className="px-2 py-1.5 text-center font-normal" title="Tickets resolved in last 7 days">Resolved 7d</th>
              <th className="px-2 py-1.5 text-center font-normal" title="Tickets past SLA, still open">SLA</th>
              <th className="px-2 py-1.5 text-center font-normal" title="Avg resolution time (hrs, last 30d) · outbound calls last 7d">Avg h · Calls</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={10} className="px-3 py-8 text-center text-muted-foreground">Loading team…</td></tr>
            )}
            {!loading && team.length === 0 && (
              <tr><td colSpan={10} className="px-3 py-8 text-center text-muted-foreground">No sales/support staff found.</td></tr>
            )}
            {team.map((m) => (
              <tr key={m.agent_id} className="border-b border-border/60 last:border-0 hover:bg-muted/20">
                <td className="px-3 py-2.5">
                  <div className="font-semibold text-foreground">{m.name}</div>
                  <div className="text-[11px] text-muted-foreground">{m.email}</div>
                </td>
                <td className="px-2 py-2.5 text-center"><Num n={m.sales.active_pipeline} /></td>
                <td className="px-2 py-2.5 text-center"><Num n={m.support.open_tickets} /></td>
                <td className="px-2 py-2.5 text-center"><Num n={m.sales.followups_due_today} warn /></td>
                <td className="px-2 py-2.5 text-center"><Num n={m.sales.followups_overdue} bad /></td>
                <td className="px-2 py-2.5 text-center">
                  <span className="font-semibold text-emerald-400">{m.sales.converted_7d}</span>
                  <span className="text-muted-foreground"> / {m.sales.converted_30d}</span>
                </td>
                <td className="px-2 py-2.5 text-center text-foreground">{m.sales.conversion_rate}%</td>
                <td className="px-2 py-2.5 text-center"><Num n={m.support.resolved_7d} /></td>
                <td className="px-2 py-2.5 text-center"><Num n={m.support.sla_breaches} bad /></td>
                <td className="px-2 py-2.5 text-center text-muted-foreground">
                  {m.support.avg_resolution_hours || 0}h
                  <span className="mx-1 text-border">·</span>
                  <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{m.calls.last_7d}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data?.as_of && (
        <p className="text-right text-[11px] text-muted-foreground">
          as of {new Date(data.as_of).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
        </p>
      )}
    </section>
  );
}
