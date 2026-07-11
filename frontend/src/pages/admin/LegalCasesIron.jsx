import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { API, useAuth } from '@/App';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Search, FileText, MessageSquare, Gavel, Send, IndianRupee, Upload, Inbox, Trash2 } from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell, badgeStyle, LIGHT_VARS } from '@/components/iron/IronKit';

const STATUS_LABEL = {
  pending: 'Pending', draft_uploaded: 'Draft uploaded', notice_pending: 'Notice pending',
  notice_sent: 'Notice sent', notice_delivered: 'Notice delivered', pending_legal_case: 'Pending legal case',
  case_filed: 'Case filed', closed_recovered: 'Closed — recovered', closed_dropped: 'Closed — dropped',
};
// status -> Iron badge tone (mirrors the legacy colour intent)
const STATUS_TONE = {
  pending: 'slate', draft_uploaded: 'info', notice_pending: 'warn', notice_sent: 'violet',
  notice_delivered: 'info', pending_legal_case: 'bad', case_filed: 'violet',
  closed_recovered: 'ok', closed_dropped: 'slate',
};

const inputStyle = { border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '7px 10px', fontSize: 12.5, color: T.iron900, background: T.white, fontFamily: T.body, outline: 'none' };
const selectStyle = { ...inputStyle, cursor: 'pointer' };
const outlineBtn = { display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, borderRadius: 6, padding: '7px 12px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 600, fontSize: 12 };
const primaryBtn = { display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer' };

export default function LegalCases() {
  const { token } = useAuth();
  const auth = { headers: { Authorization: `Bearer ${token}` } };
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('all');
  const [firm, setFirm] = useState('all');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(null);
  const [comment, setComment] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (status !== 'all') params.status = status;
      if (firm !== 'all') params.firm = firm;
      const r = await axios.get(`${API}/admin/legal-cases`, { ...auth, params });
      setData(r.data);
    } catch (e) { toast.error('Failed to load legal cases'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [status, firm]);

  const cases = useMemo(() => {
    const c = data?.cases || [];
    const q = search.trim().toLowerCase();
    return q ? c.filter((x) => [x.party_name, x.order_id, x.customer_phone, x.serial, x.issue]
      .some((v) => (v || '').toLowerCase().includes(q))) : c;
  }, [data, search]);

  const statuses = data?.statuses || Object.keys(STATUS_LABEL);
  const s = data?.summary || {};

  const setCaseStatus = async (id, st) => {
    try {
      await axios.patch(`${API}/admin/legal-cases/${id}`, { status: st }, auth);
      setData((d) => ({ ...d, cases: d.cases.map((c) => c.id === id ? { ...c, status: st } : c) }));
      if (open?.id === id) setOpen((o) => ({ ...o, status: st }));
      toast.success('Status updated');
    } catch (e) { toast.error('Update failed'); }
  };

  const addComment = async () => {
    if (!comment.trim() || !open) return;
    try {
      const r = await axios.post(`${API}/admin/legal-cases/${open.id}/comment`, { text: comment }, auth);
      const updated = { ...open, comments: [...(open.comments || []), r.data.comment] };
      setOpen(updated);
      setData((d) => ({ ...d, cases: d.cases.map((c) => c.id === open.id ? updated : c) }));
      setComment('');
    } catch (e) { toast.error('Failed to add comment'); }
  };

  const [remDate, setRemDate] = useState('');
  const [remNote, setRemNote] = useState('');
  const syncCase = (updated) => { setOpen(updated); setData((d) => ({ ...d, cases: d.cases.map((c) => c.id === updated.id ? updated : c) })); };
  const addReminder = async () => {
    if (!remDate || !open) { toast.error('Pick a date'); return; }
    try {
      const r = await axios.post(`${API}/admin/legal-cases/${open.id}/reminder`, { date: remDate, note: remNote }, auth);
      syncCase({ ...open, reminders: [...(open.reminders || []), r.data.reminder] });
      setRemDate(''); setRemNote(''); toast.success('Reminder set — shows in the Legal Diary');
    } catch (e) { toast.error(e?.response?.data?.detail || 'Failed'); }
  };
  const delReminder = async (rid) => {
    try {
      await axios.delete(`${API}/admin/legal-cases/${open.id}/reminder/${rid}`, auth);
      syncCase({ ...open, reminders: (open.reminders || []).filter((r) => r.id !== rid) });
    } catch (e) { toast.error('Failed'); }
  };

  const openDoc = async (id) => {
    try {
      const r = await axios.get(`${API}/admin/legal-cases/${id}/document`, { ...auth, responseType: 'blob' });
      window.open(URL.createObjectURL(r.data), '_blank');
    } catch (e) { toast.error('Document unavailable'); }
  };

  const openLawyerDoc = async (caseId, docId) => {
    try {
      const r = await axios.get(`${API}/admin/legal-cases/${caseId}/lawyer-doc/${docId}`, { ...auth, responseType: 'blob' });
      window.open(URL.createObjectURL(r.data), '_blank');
    } catch (e) { toast.error('File unavailable'); }
  };

  const [notice, setNotice] = useState('');
  const genNotice = async (caseId) => {
    try {
      const r = await axios.get(`${API}/admin/legal-cases/${caseId}/draft-notice`, auth);
      setNotice(r.data.notice || '');
      toast.success('Draft generated — edit & copy below');
    } catch (e) { toast.error('Could not generate notice'); }
  };

  const [uploading, setUploading] = useState(false);
  const uploadDoc = async (caseId, file) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('doc_type', 'notice');
      const r = await axios.post(`${API}/admin/legal-cases/${caseId}/upload`, fd, auth);
      const doc = r.data.document;
      const apply = (c) => c.id === caseId
        ? { ...c, lawyer_documents: [...(c.lawyer_documents || []), doc], status: 'notice_sent' } : c;
      setData((d) => ({ ...d, cases: d.cases.map(apply) }));
      setOpen((o) => o && o.id === caseId ? apply(o) : o);
      toast.success('Uploaded');
    } catch (e) { toast.error(e.response?.data?.detail || 'Upload failed'); }
    finally { setUploading(false); }
  };

  const Stat = ({ label, value, sub }) => (
    <IronCard pad={14}>
      <Caps size={9} color={T.iron400}>{label}</Caps>
      <div style={{ ...mono, fontSize: 26, fontWeight: 800, color: T.iron900, marginTop: 6, fontFamily: T.display }}>{value}</div>
      {sub && <div style={{ fontSize: 10.5, color: T.iron400, marginTop: 2 }}>{sub}</div>}
    </IronCard>
  );

  // Inline status changer (native select — preserves onChange -> setCaseStatus behaviour)
  const StatusSelect = ({ c, w = 150 }) => (
    <select value={c.status || 'pending'} onChange={(e) => setCaseStatus(c.id, e.target.value)}
      style={{ ...selectStyle, width: w, padding: '5px 8px', fontSize: 11.5 }}>
      {statuses.map((st) => <option key={st} value={st}>{STATUS_LABEL[st] || st}</option>)}
    </select>
  );

  const headers = ['SERIAL', 'PARTY', 'ORDER ID', 'FIRM', 'ISSUE', 'STATUS', 'DOC', ''];

  return (
    <IronShell title="Legal Cases" subtitle="FALSE-REFUND / NON-RETURN CASES" onRefresh={load}>
      {/* KPI tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
        <Stat label="Total cases" value={s.count || 0} />
        <Stat label="Notice pending" value={(s.by_status || {}).notice_pending || 0} sub="awaiting legal notice" />
        <Stat label="Case filed" value={(s.by_status || {}).case_filed || 0} />
        <Stat label="With documents" value={s.with_docs || 0} sub="client PDFs attached" />
      </div>

      {/* Filters */}
      <IronCard pad={14} style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <Caps size={8.5} style={{ display: 'block', marginBottom: 5 }}>Search</Caps>
            <div style={{ position: 'relative' }}>
              <Search size={14} color={T.iron400} style={{ position: 'absolute', left: 9, top: 9 }} />
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Party / order / phone / serial / issue" style={{ ...inputStyle, paddingLeft: 30, width: '100%' }} />
            </div>
          </div>
          <div>
            <Caps size={8.5} style={{ display: 'block', marginBottom: 5 }}>Status</Caps>
            <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ ...selectStyle, width: 180 }}>
              <option value="all">All statuses</option>
              {statuses.map((st) => <option key={st} value={st}>{STATUS_LABEL[st] || st}</option>)}
            </select>
          </div>
          <div>
            <Caps size={8.5} style={{ display: 'block', marginBottom: 5 }}>Firm</Caps>
            <select value={firm} onChange={(e) => setFirm(e.target.value)} style={{ ...selectStyle, width: 210 }}>
              <option value="all">All firms</option>
              {(data?.firms || []).map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
        </div>
      </IronCard>

      {/* Table */}
      <IronCard pad={0} style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: T.iron400, fontSize: 13 }}>Loading…</div>
        ) : cases.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: T.iron400 }}>
            <Inbox size={44} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
            <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron700 }}>No cases.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                {headers.map((h, i) => <th key={i} style={thCell}><Caps size={8.5}>{h}</Caps></th>)}
              </tr></thead>
              <tbody>{cases.map((c) => (
                <tr key={c.id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                  <td style={tdCell}><span style={{ ...mono, fontWeight: 700, fontSize: 12, color: T.orangeDeep }}>{c.serial || '—'}</span></td>
                  <td style={tdCell}>
                    <div style={{ fontFamily: T.headline, fontWeight: 600, fontSize: 12.5, color: T.iron900 }}>{c.party_name}</div>
                    <div style={{ ...mono, fontSize: 10.5, color: T.iron500, marginTop: 2 }}>{c.customer_phone}</div>
                  </td>
                  <td style={tdCell}>
                    <div style={{ ...mono, fontSize: 11.5, color: T.iron700 }}>{c.order_id || '—'}</div>
                    {c.refund_loss && (
                      <Link to="/admin/refund-losses" title="Tracked as a refund loss"
                        style={{ marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, color: T.orangeDeep, textDecoration: 'none' }}>
                        <IndianRupee size={11} />{Number(c.refund_loss.amount || 0).toLocaleString('en-IN')} loss
                      </Link>
                    )}
                  </td>
                  <td style={{ ...tdCell, maxWidth: 140 }}>
                    <div title={c.firm_name} style={{ fontSize: 11.5, color: T.iron700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }}>{c.firm_name}</div>
                  </td>
                  <td style={{ ...tdCell, maxWidth: 220 }}>
                    <div title={c.issue} style={{ fontSize: 11.5, color: T.iron500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 210 }}>{c.issue || '—'}</div>
                  </td>
                  <td style={tdCell}><StatusSelect c={c} /></td>
                  <td style={tdCell}>{c.client_document
                    ? <button onClick={() => openDoc(c.id)} title="Open client document" style={{ border: 'none', background: 'transparent', color: T.blue, cursor: 'pointer', display: 'grid', placeItems: 'center', padding: 2 }}><FileText size={16} /></button>
                    : <span style={{ fontSize: 11, color: T.iron400 }}>—</span>}</td>
                  <td style={{ ...tdCell, textAlign: 'right' }}>
                    <button onClick={() => { setOpen(c); setComment(''); setNotice(''); }}
                      style={{ ...outlineBtn, padding: '5px 10px', fontSize: 11 }}>
                      <MessageSquare size={13} />{(c.comments || []).length || 'View'}
                    </button>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </IronCard>

      {/* Detail dialog (shadcn kept; content forced light) */}
      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="max-w-lg" style={{ ...LIGHT_VARS, fontFamily: T.body }}>
          {open && (<>
            <DialogHeader><DialogTitle style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: T.headline }}>
              <span style={{ ...mono, color: T.orangeDeep }}>{open.serial}</span>
              <span style={{ color: T.iron400 }}>·</span> {open.party_name}
            </DialogTitle></DialogHeader>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', fontSize: 11, color: T.iron500 }}>
                <span>📞 {open.customer_phone || '—'}</span><span>🧾 {open.order_id || '—'}</span><span>🏢 {open.firm_name}</span>
              </div>
              {open.refund_loss && (
                <Link to="/admin/refund-losses" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: T.orangeDeep, textDecoration: 'none' }}>
                  <IndianRupee size={13} />Tracked refund loss: ₹{Number(open.refund_loss.amount || 0).toLocaleString('en-IN')}
                  <span style={{ color: T.iron400 }}>· {open.refund_loss.confidence}</span>
                </Link>
              )}
              <div>
                <Caps size={8.5} style={{ display: 'block', marginBottom: 4 }}>Issue</Caps>
                <div style={{ background: T.iron50, border: `1px solid ${T.iron200}`, borderRadius: 6, padding: 8, fontSize: 12.5, color: T.iron700, whiteSpace: 'pre-wrap' }}>{open.issue || '—'}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Caps size={8.5}>Status</Caps><StatusSelect c={open} w={170} />
                <button style={{ ...outlineBtn, marginLeft: 'auto', padding: '6px 10px', fontSize: 11.5 }} onClick={() => genNotice(open.id)}><Gavel size={14} /> Draft notice</button>
                {open.client_document && <button style={{ ...outlineBtn, padding: '6px 10px', fontSize: 11.5 }} onClick={() => openDoc(open.id)}><FileText size={14} /> Client doc</button>}
              </div>

              {/* Reminders — assign a date to be reminded about this case (shows in the Legal Diary) */}
              <div>
                <Caps size={8.5} style={{ display: 'block', marginBottom: 4 }}>🔔 Reminders</Caps>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 6 }}>
                  {(open.reminders || []).filter((r) => !r.done).length === 0 && <div style={{ fontSize: 11, color: T.iron400 }}>No reminders. Add one below.</div>}
                  {(open.reminders || []).filter((r) => !r.done).map((r) => (
                    <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#FEF9C3', border: '1px solid #FDE68A', borderRadius: 6, padding: '5px 8px' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#854D0E', minWidth: 76 }}>{r.date}</span>
                      <span style={{ fontSize: 12, color: T.iron700, flex: 1 }}>{r.note || 'Reminder'}</span>
                      <button onClick={() => delReminder(r.id)} title="Delete" style={{ border: 'none', background: 'transparent', color: '#dc2626', cursor: 'pointer', padding: 2, display: 'inline-flex' }}><Trash2 size={14} /></button>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input type="date" value={remDate} onChange={(e) => setRemDate(e.target.value)}
                    style={{ border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '6px 8px', fontSize: 12, color: T.iron900, outline: 'none' }} />
                  <input value={remNote} onChange={(e) => setRemNote(e.target.value)} placeholder="Reminder note…" onKeyDown={(e) => e.key === 'Enter' && addReminder()}
                    style={{ flex: 1, border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '6px 8px', fontSize: 12, color: T.iron900, outline: 'none' }} />
                  <button onClick={addReminder} style={{ ...primaryBtn, padding: '6px 12px', fontSize: 11.5 }}>Set</button>
                </div>
              </div>
              {notice && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Caps size={8.5}>Draft demand notice (edit as needed)</Caps>
                    <button onClick={() => { navigator.clipboard?.writeText(notice); toast.success('Copied'); }}
                      style={{ border: 'none', background: 'transparent', color: T.blue, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>Copy</button>
                  </div>
                  <Textarea style={{ fontSize: 11, fontFamily: T.mono, minHeight: 180 }} value={notice} onChange={(e) => setNotice(e.target.value)} />
                </div>
              )}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Caps size={8.5}>My notices & documents</Caps>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: T.blue, cursor: 'pointer', fontWeight: 600 }}>
                    <Upload size={13} />{uploading ? 'Uploading…' : 'Upload'}
                    <input type="file" style={{ display: 'none' }} disabled={uploading}
                      onChange={(e) => { if (e.target.files[0]) uploadDoc(open.id, e.target.files[0]); e.target.value = ''; }} />
                  </label>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {(open.lawyer_documents || []).length === 0 && <div style={{ fontSize: 11, color: T.iron400 }}>No documents uploaded yet.</div>}
                  {(open.lawyer_documents || []).map((d) => (
                    <button key={d.id} onClick={() => openLawyerDoc(open.id, d.id)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: T.blue, cursor: 'pointer', border: 'none', background: 'transparent', textAlign: 'left', padding: 0 }}>
                      <FileText size={13} style={{ flexShrink: 0 }} /> {d.filename}
                      <span style={{ color: T.iron400 }}>· {d.type} · {(d.at || '').slice(0, 10)}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Caps size={8.5} style={{ display: 'block', marginBottom: 4 }}>Comments</Caps>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 192, overflowY: 'auto' }}>
                  {(open.comments || []).length === 0 && <div style={{ fontSize: 11, color: T.iron400 }}>No comments yet.</div>}
                  {(open.comments || []).map((cm) => (
                    <div key={cm.id} style={{ background: T.iron50, border: `1px solid ${T.iron200}`, borderRadius: 6, padding: 8 }}>
                      <div style={{ fontSize: 12, color: T.iron700 }}>{cm.text}</div>
                      <div style={{ fontSize: 10, color: T.iron400, marginTop: 3 }}>{cm.by} · {(cm.at || '').slice(0, 10)}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <Textarea style={{ fontSize: 12, minHeight: 38 }} placeholder="Add a comment…" value={comment} onChange={(e) => setComment(e.target.value)} />
                  <button style={{ ...primaryBtn, opacity: comment.trim() ? 1 : 0.5, cursor: comment.trim() ? 'pointer' : 'default' }} onClick={addComment} disabled={!comment.trim()}><Send size={15} /></button>
                </div>
              </div>
            </div>
          </>)}
        </DialogContent>
      </Dialog>
    </IronShell>
  );
}
