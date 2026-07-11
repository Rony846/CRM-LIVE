import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { API, useAuth } from '@/App';
import IronShell from '@/components/iron/IronShell';
import { T, Caps } from '@/components/iron/IronKit';
import { ChevronLeft, ChevronRight, CalendarDays, AlarmClock, Gavel, Hourglass, CircleAlert, CalendarClock, X, Bell, Plus, Trash2, Check } from 'lucide-react';

// Event tones in the Iron (light) theme — [bg, text, border]
const TYPE_TONE = {
  limitation: ['#FEE2E2', '#991B1B', '#FCA5A5'],
  hearing: ['#EDE9FE', '#6D28D9', '#DDD6FE'],
  notice_deadline: ['#FEF3C7', '#92400E', '#FDE68A'],
  reminder: ['#FEF9C3', '#854D0E', '#FDE68A'],
  action: [T.blueTint, T.blue, '#BFDDF0'],
};
const EMOJI = { limitation: '⏳', hearing: '⚖️', notice_deadline: '⏰', reminder: '🔔', action: '•' };
const iso = (d) => d.toISOString().slice(0, 10);
const monthName = (d) => d.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
const card = { background: T.white, border: '1px solid ' + T.iron200, borderRadius: 12, padding: 16 };
const navBtn = { border: '1px solid ' + T.iron200, background: T.white, borderRadius: 8, padding: '6px 9px', cursor: 'pointer', color: T.iron700, display: 'inline-flex', alignItems: 'center' };
const inputStyle = { width: '100%', border: '1px solid ' + T.iron200, borderRadius: 8, padding: '8px 10px', fontSize: 13, color: T.iron900, outline: 'none', boxSizing: 'border-box', marginTop: 3 };
const primaryBtn = { border: 'none', background: T.orange, color: '#fff', borderRadius: 8, padding: '8px 16px', fontSize: 12.5, fontWeight: 800, cursor: 'pointer' };

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
  const [cases, setCases] = useState([]);
  const [modal, setModal] = useState(null);       // schedule/edit modal for a case
  const [dayAdd, setDayAdd] = useState(null);      // { date, case_id, note } — quick reminder for a clicked day

  const monthRange = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const last = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    return { from: iso(first), to: iso(last) };
  }, [cursor]);

  const loadCases = useCallback(() => {
    axios.get(`${API}/admin/legal-cases`, auth).then(r => setCases(r.data.cases || [])).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const load = useCallback(async () => {
    try {
      const [cal, md] = await Promise.all([
        axios.get(`${API}/admin/legal-cases/calendar`, { ...auth, params: monthRange }),
        axios.get(`${API}/admin/legal-cases/my-day`, auth),
      ]);
      setEvents(cal.data.events || []);
      setMyday(md.data);
    } catch { toast.error('Failed to load legal diary'); }
    loadCases();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthRange, token]);

  useEffect(() => { load(); }, [load]);

  const caseById = useMemo(() => { const m = {}; cases.forEach(c => { m[c.id] = c; }); return m; }, [cases]);
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

  // open the schedule/edit modal PRE-FILLED from the case (so existing entries are editable)
  const openCase = (x) => {
    const c = caseById[x.case_id] || {};
    setModal({
      case_id: x.case_id, serial: x.serial || c.serial, party: x.party || c.party_name,
      next_action: c.next_action || '', next_action_date: (c.next_action_date || '').slice(0, 10),
      hearing_date: (c.hearing_date || '').slice(0, 10), notice_deadline: (c.notice_deadline || '').slice(0, 10),
      cause_of_action_date: (c.cause_of_action_date || '').slice(0, 10),
      reminders: c.reminders || [], newRemDate: '', newRemNote: '',
    });
  };

  const saveSchedule = async () => {
    try {
      const body = { clear: false };
      // send every field (empty string clears it) so edits stick
      ['next_action', 'next_action_date', 'hearing_date', 'notice_deadline', 'cause_of_action_date'].forEach(k => { body[k] = modal[k] || ''; });
      await axios.post(`${API}/admin/legal-cases/${modal.case_id}/schedule`, body, auth);
      toast.success('Saved'); load();
      // refresh the modal's case data
      const { data } = await axios.get(`${API}/admin/legal-cases`, auth);
      const c = (data.cases || []).find(x => x.id === modal.case_id) || {};
      setModal(m => ({ ...m, reminders: c.reminders || [] }));
    } catch (e) { toast.error(e?.response?.data?.detail || 'Save failed'); }
  };

  const addReminderToModal = async () => {
    if (!modal.newRemDate) { toast.error('Pick a date'); return; }
    try {
      const { data } = await axios.post(`${API}/admin/legal-cases/${modal.case_id}/reminder`, { date: modal.newRemDate, note: modal.newRemNote }, auth);
      setModal(m => ({ ...m, reminders: [...(m.reminders || []), data.reminder], newRemDate: '', newRemNote: '' }));
      toast.success('Reminder added'); load();
    } catch (e) { toast.error(e?.response?.data?.detail || 'Failed'); }
  };
  const delReminder = async (rid) => {
    try {
      await axios.delete(`${API}/admin/legal-cases/${modal.case_id}/reminder/${rid}`, auth);
      setModal(m => ({ ...m, reminders: (m.reminders || []).filter(r => r.id !== rid) }));
      load();
    } catch { toast.error('Failed'); }
  };
  const doneReminder = async (rid) => {
    try {
      await axios.patch(`${API}/admin/legal-cases/${modal.case_id}/reminder/${rid}`, { done: true }, auth);
      setModal(m => ({ ...m, reminders: (m.reminders || []).map(r => r.id === rid ? { ...r, done: true } : r) }));
      load();
    } catch { toast.error('Failed'); }
  };

  const saveDayReminder = async () => {
    if (!dayAdd.case_id) { toast.error('Pick a case or General'); return; }
    try {
      if (dayAdd.case_id === '__general__') {
        await axios.post(`${API}/admin/legal-reminders`, { date: dayAdd.date, note: dayAdd.note }, auth);
      } else {
        await axios.post(`${API}/admin/legal-cases/${dayAdd.case_id}/reminder`, { date: dayAdd.date, note: dayAdd.note }, auth);
      }
      toast.success('Reminder set'); setDayAdd(null); load();
    } catch (e) { toast.error(e?.response?.data?.detail || 'Failed'); }
  };

  // general (standalone) reminder edit modal
  const [genModal, setGenModal] = useState(null);
  const clickEvent = (e) => { if (e.general_id || e.case_id === null) setGenModal({ id: e.general_id, date: e.date, note: e.note || e.title || '' }); else openCase(e); };
  const saveGen = async () => {
    try {
      await axios.patch(`${API}/admin/legal-reminders/${genModal.id}`, { date: genModal.date, note: genModal.note }, auth);
      toast.success('Saved'); setGenModal(null); load();
    } catch (e) { toast.error(e?.response?.data?.detail || 'Failed'); }
  };
  const genDone = async () => { try { await axios.patch(`${API}/admin/legal-reminders/${genModal.id}`, { done: true }, auth); setGenModal(null); load(); } catch { toast.error('Failed'); } };
  const genDelete = async () => { try { await axios.delete(`${API}/admin/legal-reminders/${genModal.id}`, auth); setGenModal(null); load(); } catch { toast.error('Failed'); } };

  return (
    <IronShell title="Legal Diary" subtitle="Hearings · notice deadlines · limitation · reminders" onRefresh={load}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 320px', gap: 16, alignItems: 'start' }}>
        {/* Calendar */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h1 style={{ fontFamily: T.headline, fontSize: 17, fontWeight: 800, color: T.iron900, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <CalendarDays size={18} color={T.orange} /> {monthName(cursor)}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button style={{ ...navBtn, gap: 4, fontSize: 11.5, fontWeight: 700, color: '#854D0E' }}
                onClick={() => setDayAdd({ date: iso(new Date()), case_id: '__general__', note: '' })}><Bell size={13} /> Reminder</button>
              <button style={navBtn} onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}><ChevronLeft size={15} /></button>
              <button style={navBtn} onClick={() => setCursor(new Date())}><span style={{ fontSize: 11.5, fontWeight: 700 }}>Today</span></button>
              <button style={navBtn} onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}><ChevronRight size={15} /></button>
            </div>
          </div>
          <div style={{ fontSize: 11, color: T.iron400, marginBottom: 8 }}>Tip: click any day to add a reminder · click an entry to edit the case schedule.</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, fontSize: 10.5, color: T.iron400, marginBottom: 4 }}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d} style={{ textAlign: 'center', fontWeight: 700 }}>{d}</div>)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 }}>
            {grid.map((d, i) => {
              const di = iso(d); const inMonth = d.getMonth() === cursor.getMonth(); const evs = eventsByDay[di] || [];
              return (
                <div key={i} onClick={() => setDayAdd({ date: di, case_id: '__general__', note: '' })}
                  style={{ minHeight: 74, borderRadius: 6, padding: 3, cursor: 'pointer',
                    border: '1px solid ' + (di === todayIso ? T.orange : T.iron200),
                    background: inMonth ? T.white : T.iron50, opacity: inMonth ? 1 : 0.5,
                    boxShadow: di === todayIso ? `0 0 0 1px ${T.orange}` : 'none' }}>
                  <div style={{ fontSize: 10.5, color: T.iron400, fontWeight: 700 }}>{d.getDate()}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 2 }}>
                    {evs.slice(0, 3).map((e, j) => {
                      const [bg, tx, bd] = TYPE_TONE[e.type] || TYPE_TONE.action;
                      return (
                        <div key={j} onClick={(ev) => { ev.stopPropagation(); clickEvent(e); }} title={`${e.serial} ${e.party} — ${e.title}`}
                          style={{ fontSize: 9.5, lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            padding: '1px 4px', borderRadius: 4, cursor: 'pointer', background: bg, color: tx, border: '1px solid ' + bd }}>
                          {EMOJI[e.type] || '•'} {e.serial} {e.party}
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
            <span>⏳ Limitation</span><span>⚖️ Hearing</span><span>⏰ Notice deadline</span><span>🔔 Reminder</span><span>• Action</span>
          </div>
        </div>

        {/* My Day watchlist */}
        <div style={card}>
          <h2 style={{ fontFamily: T.headline, fontSize: 13.5, fontWeight: 800, color: T.iron900, margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 7 }}>
            <AlarmClock size={16} color={T.orange} /> My Day{myday?.date ? ` · ${myday.date}` : ''}
          </h2>
          {!myday ? <div style={{ fontSize: 12, color: T.iron400 }}>Loading…</div> : (
            <>
              <Bucket icon={<Bell size={13} />} title="Reminders due" color="#854D0E" items={myday.reminders_due}
                onClick={clickEvent} render={x => <span>{x.serial} <b>{x.party}</b> — {x.note || 'reminder'}{x.due_today ? '' : ` (${x.days_late}d late)`}</span>} />
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
              {!myday.reminders_due?.length && !myday.limitation_watch?.length && !myday.overdue?.length && !myday.due_today?.length && !myday.hearings_7d?.length && !myday.notice_deadline_lapsed?.length &&
                <div style={{ fontSize: 12, color: T.green, fontWeight: 700 }}>✓ Nothing due today.</div>}
            </>
          )}
        </div>
      </div>

      {/* Schedule / edit modal (pre-filled = editable) */}
      {modal && (
        <div onClick={() => setModal(null)} style={overlay}>
          <div onClick={e => e.stopPropagation()} style={{ ...modalBox, maxWidth: 480 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontFamily: T.headline, fontSize: 15, fontWeight: 800, color: T.iron900 }}>{modal.serial} <span style={{ color: T.iron500, fontWeight: 500 }}>{modal.party}</span></div>
              <button onClick={() => setModal(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: T.iron500 }}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label><Caps size={9}>Next action</Caps>
                <input style={inputStyle} value={modal.next_action} onChange={e => setModal({ ...modal, next_action: e.target.value })} placeholder="e.g. Send reminder notice" /></label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label><Caps size={9}>Next action date</Caps>
                  <input style={inputStyle} type="date" value={modal.next_action_date} onChange={e => setModal({ ...modal, next_action_date: e.target.value })} /></label>
                <label><Caps size={9}>Hearing date</Caps>
                  <input style={inputStyle} type="date" value={modal.hearing_date} onChange={e => setModal({ ...modal, hearing_date: e.target.value })} /></label>
                <label><Caps size={9}>Notice reply deadline</Caps>
                  <input style={inputStyle} type="date" value={modal.notice_deadline} onChange={e => setModal({ ...modal, notice_deadline: e.target.value })} /></label>
                <label><Caps size={9}>Cause-of-action (→3yr limitation)</Caps>
                  <input style={inputStyle} type="date" value={modal.cause_of_action_date} onChange={e => setModal({ ...modal, cause_of_action_date: e.target.value })} /></label>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button onClick={saveSchedule} style={primaryBtn}>Save dates</button>
              </div>

              {/* Reminders */}
              <div style={{ borderTop: '1px solid ' + T.iron200, paddingTop: 12, marginTop: 2 }}>
                <div style={{ fontSize: 11.5, fontWeight: 800, color: '#854D0E', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}><Bell size={13} /> Reminders</div>
                {(modal.reminders || []).filter(r => !r.done).length === 0 && <div style={{ fontSize: 11.5, color: T.iron400, marginBottom: 8 }}>No reminders yet.</div>}
                {(modal.reminders || []).filter(r => !r.done).map(r => (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#FEF9C3', border: '1px solid #FDE68A', borderRadius: 6, padding: '5px 8px', marginBottom: 5 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#854D0E', minWidth: 78 }}>{r.date}</span>
                    <span style={{ fontSize: 11.5, color: T.iron800, flex: 1 }}>{r.note || 'Reminder'}</span>
                    <button onClick={() => doneReminder(r.id)} title="Mark done" style={iconBtn(T.green)}><Check size={13} /></button>
                    <button onClick={() => delReminder(r.id)} title="Delete" style={iconBtn('#dc2626')}><Trash2 size={13} /></button>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'flex-end' }}>
                  <input style={{ ...inputStyle, width: 140, marginTop: 0 }} type="date" value={modal.newRemDate} onChange={e => setModal({ ...modal, newRemDate: e.target.value })} />
                  <input style={{ ...inputStyle, marginTop: 0 }} value={modal.newRemNote} onChange={e => setModal({ ...modal, newRemNote: e.target.value })} placeholder="Reminder note…" onKeyDown={e => e.key === 'Enter' && addReminderToModal()} />
                  <button onClick={addReminderToModal} style={{ ...primaryBtn, padding: '8px 12px', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Plus size={14} /> Add</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick add reminder for a clicked day */}
      {dayAdd && (
        <div onClick={() => setDayAdd(null)} style={overlay}>
          <div onClick={e => e.stopPropagation()} style={{ ...modalBox, maxWidth: 400 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontFamily: T.headline, fontSize: 15, fontWeight: 800, color: T.iron900, display: 'flex', alignItems: 'center', gap: 6 }}><Bell size={15} color="#854D0E" /> Reminder · {dayAdd.date}</div>
              <button onClick={() => setDayAdd(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: T.iron500 }}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label><Caps size={9}>Case</Caps>
                <select style={inputStyle} value={dayAdd.case_id} onChange={e => setDayAdd({ ...dayAdd, case_id: e.target.value })}>
                  <option value="__general__">🔔 General (no case)</option>
                  {cases.map(c => <option key={c.id} value={c.id}>{c.serial} — {c.party_name}</option>)}
                </select></label>
              <label><Caps size={9}>Note</Caps>
                <input style={inputStyle} value={dayAdd.note} onChange={e => setDayAdd({ ...dayAdd, note: e.target.value })} placeholder="What to remember…" onKeyDown={e => e.key === 'Enter' && saveDayReminder()} /></label>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button onClick={() => setDayAdd(null)} style={{ ...navBtn, padding: '8px 14px', fontSize: 12.5, fontWeight: 700 }}>Cancel</button>
              <button onClick={saveDayReminder} style={primaryBtn}>Set reminder</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit a standalone (general) reminder */}
      {genModal && (
        <div onClick={() => setGenModal(null)} style={overlay}>
          <div onClick={e => e.stopPropagation()} style={{ ...modalBox, maxWidth: 400 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontFamily: T.headline, fontSize: 15, fontWeight: 800, color: T.iron900, display: 'flex', alignItems: 'center', gap: 6 }}><Bell size={15} color="#854D0E" /> General reminder</div>
              <button onClick={() => setGenModal(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: T.iron500 }}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label><Caps size={9}>Date</Caps>
                <input style={inputStyle} type="date" value={genModal.date} onChange={e => setGenModal({ ...genModal, date: e.target.value })} /></label>
              <label><Caps size={9}>Note</Caps>
                <input style={inputStyle} value={genModal.note} onChange={e => setGenModal({ ...genModal, note: e.target.value })} onKeyDown={e => e.key === 'Enter' && saveGen()} /></label>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 16 }}>
              <button onClick={genDelete} style={{ ...navBtn, padding: '8px 12px', fontSize: 12, color: '#dc2626', display: 'inline-flex', gap: 5 }}><Trash2 size={13} /> Delete</button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={genDone} style={{ ...navBtn, padding: '8px 12px', fontSize: 12, color: T.green, fontWeight: 700, display: 'inline-flex', gap: 5 }}><Check size={13} /> Done</button>
                <button onClick={saveGen} style={primaryBtn}>Save</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </IronShell>
  );
}

const overlay = { position: 'fixed', inset: 0, background: 'rgba(15,15,15,.5)', zIndex: 120, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 44 };
const modalBox = { background: T.white, border: '1px solid ' + T.iron200, borderRadius: 12, width: '94%', padding: 18, boxShadow: '0 24px 70px rgba(0,0,0,.3)', maxHeight: '88vh', overflowY: 'auto' };
const iconBtn = (c) => ({ border: 'none', background: 'transparent', color: c, cursor: 'pointer', padding: 2, display: 'inline-flex' });
