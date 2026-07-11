import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { API, useAuth } from '@/App';
import IronShell from '@/components/iron/IronShell';
import { T, Caps } from '@/components/iron/IronKit';
import { ChevronLeft, ChevronRight, CalendarDays, AlarmClock, Gavel, Hourglass, CircleAlert, CalendarClock, X } from 'lucide-react';

// Event tones in the Iron (light) theme — [bg, text, border]
const TYPE_TONE = {
  limitation: ['#FEE2E2', '#991B1B', '#FCA5A5'],
  hearing: ['#EDE9FE', '#6D28D9', '#DDD6FE'],
  notice_deadline: ['#FEF3C7', '#92400E', '#FDE68A'],
  action: [T.blueTint, T.blue, '#BFDDF0'],
};
const iso = (d) => d.toISOString().slice(0, 10);
const monthName = (d) => d.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
const card = { background: T.white, border: '1px solid ' + T.iron200, borderRadius: 12, padding: 16 };
const navBtn = { border: '1px solid ' + T.iron200, background: T.white, borderRadius: 8, padding: '6px 9px', cursor: 'pointer', color: T.iron700, display: 'inline-flex', alignItems: 'center' };
const inputStyle = { width: '100%', border: '1px solid ' + T.iron200, borderRadius: 8, padding: '8px 10px', fontSize: 13, color: T.iron900, outline: 'none', boxSizing: 'border-box', marginTop: 3 };

function Bucket({ icon, title, color, items, render, onClick }) {
  if (!items?.length) return null;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5, color }}>
        {icon}{title} <span style={{ opacity: 0.6 }}>({items.length})</span>
      </div>
      <div style={{ marginTop: 5, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {items.slice(0, 8).map((x, i) => (
          <div key={i} onClick={() => onClick?.(x)}
            style={{ fontSize: 11.5, color: T.iron700, background: T.iron50, border: '1px solid ' + T.iron200, borderRadius: 6, padding: '4px 8px', cursor: 'pointer' }}>
            {render(x)}
          </div>
        ))}
        {items.length > 8 && <div style={{ fontSize: 11, color: T.iron400 }}>+{items.length - 8} more</div>}
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
  const [modal, setModal] = useState(null);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthRange, token]);

  useEffect(() => { load(); }, [load]);

  const eventsByDay = useMemo(() => {
    const m = {};
    for (const e of events) (m[e.date] = m[e.date] || []).push(e);
    return m;
  }, [events]);

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
    <IronShell title="Legal Diary" subtitle="Hearings · notice deadlines · limitation watch" onRefresh={load}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 320px', gap: 16, alignItems: 'start' }} className="legal-diary-grid">
        {/* Calendar */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h1 style={{ fontFamily: T.headline, fontSize: 17, fontWeight: 800, color: T.iron900, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <CalendarDays size={18} color={T.orange} /> {monthName(cursor)}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button style={navBtn} onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}><ChevronLeft size={15} /></button>
              <button style={navBtn} onClick={() => setCursor(new Date())}><span style={{ fontSize: 11.5, fontWeight: 700 }}>Today</span></button>
              <button style={navBtn} onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}><ChevronRight size={15} /></button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, fontSize: 10.5, color: T.iron400, marginBottom: 4 }}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d} style={{ textAlign: 'center', fontWeight: 700 }}>{d}</div>)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 }}>
            {grid.map((d, i) => {
              const di = iso(d); const inMonth = d.getMonth() === cursor.getMonth(); const evs = eventsByDay[di] || [];
              return (
                <div key={i} style={{ minHeight: 74, borderRadius: 6, padding: 3,
                  border: '1px solid ' + (di === todayIso ? T.orange : T.iron200),
                  background: inMonth ? T.white : T.iron50, opacity: inMonth ? 1 : 0.5,
                  boxShadow: di === todayIso ? `0 0 0 1px ${T.orange}` : 'none' }}>
                  <div style={{ fontSize: 10.5, color: T.iron400, fontWeight: 700 }}>{d.getDate()}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 2 }}>
                    {evs.slice(0, 3).map((e, j) => {
                      const [bg, tx, bd] = TYPE_TONE[e.type] || TYPE_TONE.action;
                      return (
                        <div key={j} onClick={() => openCase(e)} title={`${e.serial} ${e.party} — ${e.title}`}
                          style={{ fontSize: 9.5, lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            padding: '1px 4px', borderRadius: 4, cursor: 'pointer', background: bg, color: tx, border: '1px solid ' + bd }}>
                          {e.type === 'limitation' ? '⏳' : e.type === 'hearing' ? '⚖️' : e.type === 'notice_deadline' ? '⏰' : '•'} {e.serial} {e.party}
                        </div>
                      );
                    })}
                    {evs.length > 3 && <div style={{ fontSize: 9.5, color: T.iron400 }}>+{evs.length - 3}</div>}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 12, fontSize: 11, color: T.iron500, flexWrap: 'wrap' }}>
            <span>⏳ Limitation</span><span>⚖️ Hearing</span><span>⏰ Notice deadline</span><span>• Action</span>
          </div>
        </div>

        {/* My Day watchlist */}
        <div style={card}>
          <h2 style={{ fontFamily: T.headline, fontSize: 13.5, fontWeight: 800, color: T.iron900, margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 7 }}>
            <AlarmClock size={16} color={T.orange} /> My Day{myday?.date ? ` · ${myday.date}` : ''}
          </h2>
          {!myday ? <div style={{ fontSize: 12, color: T.iron400 }}>Loading…</div> : (
            <>
              <Bucket icon={<Hourglass size={13} />} title="Limitation (act now)" color="#991B1B" items={myday.limitation_watch}
                onClick={openCase} render={x => <span>{x.serial} <b>{x.party}</b> — {x.expired ? `EXPIRED ${-x.in_days}d ago` : `${x.in_days}d left`}</span>} />
              <Bucket icon={<CircleAlert size={13} />} title="Overdue" color="#991B1B" items={myday.overdue}
                onClick={openCase} render={x => <span>{x.serial} <b>{x.party}</b> — {x.action || 'action'} ({x.days_late}d late)</span>} />
              <Bucket icon={<CalendarClock size={13} />} title="Due today" color={T.blue} items={myday.due_today}
                onClick={openCase} render={x => <span>{x.serial} <b>{x.party}</b> — {x.action || 'action'}</span>} />
              <Bucket icon={<Gavel size={13} />} title="Hearings (7d)" color="#6D28D9" items={myday.hearings_7d}
                onClick={openCase} render={x => <span>{x.serial} <b>{x.party}</b> — in {x.in_days}d</span>} />
              <Bucket icon={<AlarmClock size={13} />} title="Notice reply lapsed" color="#92400E" items={myday.notice_deadline_lapsed}
                onClick={openCase} render={x => <span>{x.serial} <b>{x.party}</b> — {x.days_late}d late</span>} />
              {myday.dark_cases?.length > 0 &&
                <div style={{ marginTop: 8, fontSize: 11.5, color: T.iron600, background: T.iron50, border: '1px solid ' + T.iron200, borderRadius: 6, padding: '6px 9px' }}>
                  ⚫ <b>{myday.dark_cases.length}</b> open case(s) with no next action set. Schedule them so nothing slips.
                </div>}
              {!myday.limitation_watch?.length && !myday.overdue?.length && !myday.due_today?.length && !myday.hearings_7d?.length && !myday.notice_deadline_lapsed?.length &&
                <div style={{ fontSize: 12, color: T.green, fontWeight: 700 }}>✓ Nothing overdue today.</div>}
            </>
          )}
        </div>
      </div>

      {/* Schedule modal */}
      {modal && (
        <div onClick={() => setModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,15,15,.5)', zIndex: 120, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 50 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: T.white, border: '1px solid ' + T.iron200, borderRadius: 12, width: 'min(460px,94%)', padding: 18, boxShadow: '0 24px 70px rgba(0,0,0,.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontFamily: T.headline, fontSize: 15, fontWeight: 800, color: T.iron900 }}>Schedule — {modal.serial} <span style={{ color: T.iron500, fontWeight: 500 }}>{modal.party}</span></div>
              <button onClick={() => setModal(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: T.iron500 }}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label><Caps size={9}>Next action</Caps>
                <input style={inputStyle} value={modal.next_action} onChange={e => setModal({ ...modal, next_action: e.target.value })} placeholder="e.g. Send reminder notice" /></label>
              <label><Caps size={9}>Next action date</Caps>
                <input style={inputStyle} type="date" value={modal.next_action_date} onChange={e => setModal({ ...modal, next_action_date: e.target.value })} /></label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label><Caps size={9}>Hearing date</Caps>
                  <input style={inputStyle} type="date" value={modal.hearing_date} onChange={e => setModal({ ...modal, hearing_date: e.target.value })} /></label>
                <label><Caps size={9}>Notice reply deadline</Caps>
                  <input style={inputStyle} type="date" value={modal.notice_deadline} onChange={e => setModal({ ...modal, notice_deadline: e.target.value })} /></label>
              </div>
              <label><Caps size={9}>Cause-of-action date (sets 3-yr limitation)</Caps>
                <input style={inputStyle} type="date" value={modal.cause_of_action_date} onChange={e => setModal({ ...modal, cause_of_action_date: e.target.value })} /></label>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button onClick={() => setModal(null)} style={{ ...navBtn, padding: '8px 14px', fontSize: 12.5, fontWeight: 700 }}>Cancel</button>
              <button onClick={save} style={{ border: 'none', background: T.orange, color: '#fff', borderRadius: 8, padding: '8px 16px', fontSize: 12.5, fontWeight: 800, cursor: 'pointer' }}>Save to diary</button>
            </div>
          </div>
        </div>
      )}
    </IronShell>
  );
}
