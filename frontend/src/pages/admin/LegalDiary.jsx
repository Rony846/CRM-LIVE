import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, CalendarDays, AlarmClock, Gavel, Hourglass, CircleAlert, CalendarClock, X } from 'lucide-react';

const TYPE_TONE = {
  limitation: 'bg-red-500/20 text-red-300 border-red-500/40',
  hearing: 'bg-violet-500/20 text-violet-300 border-violet-500/40',
  notice_deadline: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  action: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
};
const iso = (d) => d.toISOString().slice(0, 10);
const monthName = (d) => d.toLocaleString('en-IN', { month: 'long', year: 'numeric' });

function Bucket({ icon, title, tone, items, render, onClick }) {
  if (!items?.length) return null;
  return (
    <div className="mb-3">
      <div className={`text-xs font-semibold flex items-center gap-1.5 ${tone}`}>{icon}{title} <span className="opacity-60">({items.length})</span></div>
      <div className="mt-1 space-y-1">
        {items.slice(0, 8).map((x, i) => (
          <div key={i} onClick={() => onClick?.(x)} className="text-xs text-zinc-300 bg-zinc-900/50 border border-zinc-800 rounded px-2 py-1 cursor-pointer hover:border-zinc-600">
            {render(x)}
          </div>
        ))}
        {items.length > 8 && <div className="text-[11px] text-zinc-600">+{items.length - 8} more</div>}
      </div>
    </div>
  );
}

export default function LegalDiary() {
  const { token } = useAuth();
  const auth = { headers: { Authorization: `Bearer ${token}` } };
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [events, setEvents] = useState([]);
  const [myday, setMyday] = useState(null);
  const [cases, setCases] = useState([]);
  const [modal, setModal] = useState(null); // {case_id, serial, party, next_action_date,...}

  const monthRange = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const last = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    return { from: iso(first), to: iso(last) };
  }, [cursor]);

  const load = useCallback(async () => {
    try {
      const [cal, md] = await Promise.all([
        axios.get(`${API}/admin/legal-cases/calendar`, { ...auth, params: monthRange }),
        axios.get(`${API}/admin/legal-cases/my-day`, auth),
      ]);
      setEvents(cal.data.events || []);
      setMyday(md.data);
    } catch { toast.error('Failed to load legal diary'); }
  }, [monthRange, token]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { axios.get(`${API}/admin/legal-cases`, auth).then(r => setCases(r.data.cases || [])).catch(() => {}); }, [token]);

  const eventsByDay = useMemo(() => {
    const m = {};
    for (const e of events) (m[e.date] = m[e.date] || []).push(e);
    return m;
  }, [events]);

  // build 6-week grid
  const grid = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = new Date(first); start.setDate(1 - first.getDay());
    return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  }, [cursor]);

  const todayIso = iso(new Date());
  const openCase = (x) => setModal({ case_id: x.case_id, serial: x.serial, party: x.party,
    next_action_date: '', next_action: '', hearing_date: '', notice_deadline: '', cause_of_action_date: '' });

  const save = async () => {
    try {
      const body = {};
      ['next_action_date', 'next_action', 'hearing_date', 'notice_deadline', 'cause_of_action_date'].forEach(k => { if (modal[k]) body[k] = modal[k]; });
      await axios.post(`${API}/admin/legal-cases/${modal.case_id}/schedule`, body, auth);
      toast.success('Saved to diary'); setModal(null); load();
    } catch (e) { toast.error(e?.response?.data?.detail || 'Save failed'); }
  };

  return (
    <DashboardLayout>
      <div className="p-4 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        {/* Calendar */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h1 className="text-lg font-semibold text-zinc-100 flex items-center gap-2"><CalendarDays size={18} className="text-sky-400" /> Legal Diary</h1>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}><ChevronLeft size={15} /></Button>
                <span className="text-sm text-zinc-300 w-32 text-center">{monthName(cursor)}</span>
                <Button size="sm" variant="outline" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}><ChevronRight size={15} /></Button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1 text-[11px] text-zinc-500 mb-1">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d} className="text-center">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {grid.map((d, i) => {
                const di = iso(d); const inMonth = d.getMonth() === cursor.getMonth(); const evs = eventsByDay[di] || [];
                return (
                  <div key={i} className={`min-h-[74px] rounded border p-1 ${inMonth ? 'border-zinc-800 bg-zinc-900/30' : 'border-zinc-900 bg-transparent opacity-40'} ${di === todayIso ? 'ring-1 ring-sky-500' : ''}`}>
                    <div className="text-[11px] text-zinc-500">{d.getDate()}</div>
                    <div className="space-y-0.5 mt-0.5">
                      {evs.slice(0, 3).map((e, j) => (
                        <div key={j} onClick={() => openCase(e)} title={`${e.serial} ${e.party} — ${e.title}`}
                          className={`text-[10px] leading-tight truncate px-1 rounded border cursor-pointer ${TYPE_TONE[e.type] || TYPE_TONE.action}`}>
                          {e.type === 'limitation' ? '⏳' : e.type === 'hearing' ? '⚖️' : e.type === 'notice_deadline' ? '⏰' : '•'} {e.serial} {e.party}
                        </div>
                      ))}
                      {evs.length > 3 && <div className="text-[10px] text-zinc-600">+{evs.length - 3}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-3 mt-3 text-[11px] text-zinc-500">
              <span className="text-red-300">⏳ Limitation</span><span className="text-violet-300">⚖️ Hearing</span>
              <span className="text-amber-300">⏰ Notice deadline</span><span className="text-sky-300">• Action</span>
            </div>
          </CardContent>
        </Card>

        {/* My Day watchlist */}
        <Card>
          <CardContent className="p-4">
            <h2 className="text-sm font-semibold text-zinc-200 mb-3 flex items-center gap-2"><AlarmClock size={16} className="text-amber-400" /> My Day{myday?.date ? ` — ${myday.date}` : ''}</h2>
            {!myday ? <div className="text-xs text-zinc-500">Loading…</div> : (
              <>
                <Bucket icon={<Hourglass size={13} />} title="Limitation (act now)" tone="text-red-400" items={myday.limitation_watch}
                  onClick={openCase} render={x => <span>{x.serial} <b>{x.party}</b> — {x.expired ? `EXPIRED ${-x.in_days}d ago` : `${x.in_days}d left`}</span>} />
                <Bucket icon={<CircleAlert size={13} />} title="Overdue" tone="text-red-400" items={myday.overdue}
                  onClick={openCase} render={x => <span>{x.serial} <b>{x.party}</b> — {x.action || 'action'} ({x.days_late}d late)</span>} />
                <Bucket icon={<CalendarClock size={13} />} title="Due today" tone="text-sky-400" items={myday.due_today}
                  onClick={openCase} render={x => <span>{x.serial} <b>{x.party}</b> — {x.action || 'action'}</span>} />
                <Bucket icon={<Gavel size={13} />} title="Hearings (7d)" tone="text-violet-400" items={myday.hearings_7d}
                  onClick={openCase} render={x => <span>{x.serial} <b>{x.party}</b> — in {x.in_days}d</span>} />
                <Bucket icon={<AlarmClock size={13} />} title="Notice reply lapsed" tone="text-amber-400" items={myday.notice_deadline_lapsed}
                  onClick={openCase} render={x => <span>{x.serial} <b>{x.party}</b> — {x.days_late}d late</span>} />
                {myday.dark_cases?.length > 0 &&
                  <div className="mt-2 text-xs text-zinc-400 bg-zinc-900/50 border border-zinc-800 rounded px-2 py-1.5">
                    ⚫ <b>{myday.dark_cases.length}</b> open case(s) with no next action set. Schedule them so nothing slips.
                  </div>}
                {!myday.limitation_watch?.length && !myday.overdue?.length && !myday.due_today?.length && !myday.hearings_7d?.length && !myday.notice_deadline_lapsed?.length &&
                  <div className="text-xs text-emerald-400">✓ Nothing overdue today.</div>}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Schedule modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setModal(null)}>
          <div className="bg-zinc-950 border border-zinc-800 rounded-lg w-full max-w-md p-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold text-zinc-100">Schedule — {modal.serial} <span className="text-zinc-400">{modal.party}</span></div>
              <button onClick={() => setModal(null)}><X size={16} className="text-zinc-500" /></button>
            </div>
            <div className="space-y-2.5 text-sm">
              <label className="block"><span className="text-xs text-zinc-400">Next action</span>
                <Input value={modal.next_action} onChange={e => setModal({ ...modal, next_action: e.target.value })} placeholder="e.g. Send reminder notice" /></label>
              <label className="block"><span className="text-xs text-zinc-400">Next action date</span>
                <Input type="date" value={modal.next_action_date} onChange={e => setModal({ ...modal, next_action_date: e.target.value })} /></label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block"><span className="text-xs text-zinc-400">Hearing date</span>
                  <Input type="date" value={modal.hearing_date} onChange={e => setModal({ ...modal, hearing_date: e.target.value })} /></label>
                <label className="block"><span className="text-xs text-zinc-400">Notice reply deadline</span>
                  <Input type="date" value={modal.notice_deadline} onChange={e => setModal({ ...modal, notice_deadline: e.target.value })} /></label>
              </div>
              <label className="block"><span className="text-xs text-zinc-400">Cause‑of‑action date <span className="opacity-60">(sets 3‑yr limitation)</span></span>
                <Input type="date" value={modal.cause_of_action_date} onChange={e => setModal({ ...modal, cause_of_action_date: e.target.value })} /></label>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" size="sm" onClick={() => setModal(null)}>Cancel</Button>
              <Button size="sm" onClick={save}>Save to diary</Button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
