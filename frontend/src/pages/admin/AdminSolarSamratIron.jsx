import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { toast } from 'sonner';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Crown, Loader2, Search, CheckCircle2, XCircle, Ban, ShieldCheck,
  Users, Clock, MessageSquare, Trophy, Plus, Award,
} from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell, badgeStyle } from '@/components/iron/IronKit';

const ROLE_LABEL = {
  dealer: 'Dealer', distributor: 'Distributor', epc: 'EPC / Installer',
  brand: 'Brand', customer: 'Customer',
};

// Samrat rank -> pill tone (matches the legacy colour intent).
const RANK_TONE = {
  Sipahi: 'slate', Sardar: 'warn', Raja: 'warn', Maharaja: 'violet', Samrat: 'warn',
};

const inputStyle = { border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '7px 10px', fontSize: 12.5, color: T.iron900, background: T.white, fontFamily: T.body, outline: 'none' };
const selectStyle = { ...inputStyle, cursor: 'pointer' };
const primaryBtn = { border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer' };
const outlineBtn = { border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer' };

function RankBadge({ rank }) {
  return <span style={badgeStyle(RANK_TONE[rank] || 'slate')}>{rank || 'Sipahi'}</span>;
}

function verifBadgeStyle(v) {
  if (v === 'verified') return { tone: 'ok', label: 'Verified' };
  if (v === 'rejected') return { tone: 'bad', label: 'Rejected' };
  return { tone: 'warn', label: 'Pending' };
}
const VerifBadge = ({ v }) => { const b = verifBadgeStyle(v); return <span style={badgeStyle(b.tone)}>{b.label}</span>; };

function Field({ label, value, mono: isMono }) {
  return (
    <div>
      <Caps size={8.5} style={{ display: 'block', marginBottom: 3 }}>{label}</Caps>
      <div style={{ fontSize: 12.5, color: T.iron900, ...(isMono ? mono : {}) }}>{value || '—'}</div>
    </div>
  );
}

export default function AdminSolarSamrat() {
  const { token } = useAuth();
  const headers = { Authorization: `Bearer ${token}` };

  const [tab, setTab] = useState('overview');
  const [overview, setOverview] = useState(null);
  const [loadingOv, setLoadingOv] = useState(true);

  // members
  const [members, setMembers] = useState([]);
  const [mTotal, setMTotal] = useState(0);
  const [loadingM, setLoadingM] = useState(false);
  const [fStatus, setFStatus] = useState('');
  const [fVerif, setFVerif] = useState('pending');
  const [fRole, setFRole] = useState('');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');

  // detail / action dialog
  const [detail, setDetail] = useState(null);
  const [actionNote, setActionNote] = useState('');
  const [crownDelta, setCrownDelta] = useState('');
  const [busy, setBusy] = useState(false);

  // leaderboard / leads / posts
  const [board, setBoard] = useState([]);
  const [leads, setLeads] = useState([]);
  const [posts, setPosts] = useState([]);

  const loadOverview = useCallback(async () => {
    setLoadingOv(true);
    try {
      const res = await axios.get(`${API}/samrat/admin/overview`, { headers });
      setOverview(res.data);
    } catch { toast.error('Failed to load Solar Samrat overview'); }
    finally { setLoadingOv(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadMembers = useCallback(async () => {
    setLoadingM(true);
    try {
      const params = {};
      if (fStatus) params.status = fStatus;
      if (fVerif) params.verification = fVerif;
      if (fRole) params.role = fRole;
      if (q) params.q = q;
      const res = await axios.get(`${API}/samrat/admin/members`, { headers, params });
      setMembers(res.data.members || []);
      setMTotal(res.data.total || 0);
    } catch { toast.error('Failed to load members'); }
    finally { setLoadingM(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fStatus, fVerif, fRole, q]);

  const loadBoard = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/samrat/admin/leaderboard`, { headers });
      setBoard(res.data.leaderboard || []);
    } catch { /* noop */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadLeads = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/samrat/admin/leads`, { headers });
      setLeads(res.data.leads || []);
    } catch { /* noop */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadPosts = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/samrat/admin/posts`, { headers });
      setPosts(res.data.posts || []);
    } catch { /* noop */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { loadOverview(); }, [loadOverview]);
  useEffect(() => { if (tab === 'members') loadMembers(); }, [tab, loadMembers]);
  useEffect(() => { if (tab === 'leaderboard') loadBoard(); }, [tab, loadBoard]);
  useEffect(() => { if (tab === 'leads') loadLeads(); }, [tab, loadLeads]);
  useEffect(() => { if (tab === 'posts') loadPosts(); }, [tab, loadPosts]);

  const openDetail = async (m) => {
    setActionNote(''); setCrownDelta('');
    try {
      const res = await axios.get(`${API}/samrat/admin/members/${m.id}`, { headers });
      setDetail(res.data);
    } catch { setDetail(m); }
  };

  const doVerify = async (action) => {
    if (!detail) return;
    setBusy(true);
    try {
      await axios.post(`${API}/samrat/admin/members/${detail.id}/verify`,
        { action, note: actionNote || null }, { headers });
      toast.success(action === 'approve' ? 'Member verified 👑' : 'Application rejected');
      setDetail(null); loadOverview(); loadMembers();
    } catch (e) { toast.error(e?.response?.data?.detail || 'Action failed'); }
    finally { setBusy(false); }
  };

  const doStatus = async (status) => {
    if (!detail) return;
    setBusy(true);
    try {
      await axios.post(`${API}/samrat/admin/members/${detail.id}/status`,
        { status, note: actionNote || null }, { headers });
      toast.success(status === 'suspended' ? 'Member suspended' : 'Member reactivated');
      setDetail(null); loadOverview(); loadMembers();
    } catch (e) { toast.error(e?.response?.data?.detail || 'Action failed'); }
    finally { setBusy(false); }
  };

  const doCrowns = async () => {
    if (!detail || !crownDelta) return;
    setBusy(true);
    try {
      const res = await axios.post(`${API}/samrat/admin/members/${detail.id}/crowns`,
        { delta: parseInt(crownDelta, 10), reason: actionNote || 'Admin adjustment' }, { headers });
      toast.success(`Crowns updated → ${res.data.crowns} (${res.data.rank})`);
      setDetail({ ...detail, crowns: res.data.crowns, rank: res.data.rank });
      setCrownDelta(''); loadMembers();
    } catch (e) { toast.error(e?.response?.data?.detail || 'Action failed'); }
    finally { setBusy(false); }
  };

  const moderatePost = async (postId, action) => {
    try {
      await axios.post(`${API}/samrat/admin/posts/${postId}/moderate`, { action }, { headers });
      toast.success(action === 'approve' ? 'Post approved' : 'Post removed');
      loadPosts(); loadOverview();
    } catch { toast.error('Action failed'); }
  };

  const refresh = () => {
    loadOverview();
    if (tab === 'members') loadMembers();
    if (tab === 'leaderboard') loadBoard();
    if (tab === 'leads') loadLeads();
    if (tab === 'posts') loadPosts();
  };

  const TABS = [
    { key: 'overview', label: 'Overview' },
    { key: 'members', label: 'Members', badge: overview?.pending_verification, badgeTone: 'warn' },
    { key: 'leaderboard', label: 'Leaderboard' },
    { key: 'leads', label: 'Leads' },
    { key: 'posts', label: 'Content', badge: overview?.posts_flagged, badgeTone: 'bad' },
  ];

  const statTiles = overview ? [
    { label: 'Members', value: overview.members_total, icon: Users, tone: T.blue },
    { label: 'Pending', value: overview.pending_verification, icon: Clock, tone: T.voltageText, sub: 'awaiting verification' },
    { label: 'Verified', value: overview.verified, icon: ShieldCheck, tone: T.green },
    { label: 'Suspended', value: overview.suspended, icon: Ban, tone: T.orangeDeep },
    { label: 'Open Leads', value: overview.leads_open, icon: MessageSquare, tone: T.blue, sub: `${overview.leads_total} total` },
    { label: 'Flagged Posts', value: overview.posts_flagged, icon: MessageSquare, tone: T.orangeDeep, sub: `${overview.posts_total} total` },
  ] : [];

  return (
    <IronShell title="Solar Samrat" subtitle="OPEN-INDUSTRY SOLAR COMMUNITY · WHERE EVERY DEALER RULES" onRefresh={refresh}>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {TABS.map((tb) => {
          const active = tab === tb.key;
          return (
            <button key={tb.key} onClick={() => setTab(tb.key)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${active ? T.orange : T.iron200}`, background: active ? T.orange : T.white, color: active ? '#fff' : T.iron700, borderRadius: 6, padding: '7px 14px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 12 }}>
              {tb.label}
              {tb.badge ? <span style={{ ...mono, fontSize: 10, fontWeight: 700, background: active ? 'rgba(255,255,255,.25)' : (tb.badgeTone === 'bad' ? '#FDEEE6' : T.voltageTint), color: active ? '#fff' : (tb.badgeTone === 'bad' ? T.orangeDeep : T.voltageText), borderRadius: 999, padding: '1px 7px' }}>{tb.badge}</span> : null}
            </button>
          );
        })}
      </div>

      {/* OVERVIEW */}
      {tab === 'overview' && (
        loadingOv || !overview ? (
          <div style={{ display: 'grid', placeItems: 'center', height: 300 }}><Loader2 className="animate-spin" size={28} color={T.iron400} /></div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, marginBottom: 16 }}>
              {statTiles.map((s) => {
                const Icon = s.icon;
                return (
                  <IronCard key={s.label} pad={14}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 38, height: 38, borderRadius: 8, display: 'grid', placeItems: 'center', background: T.iron50, border: `1px solid ${T.iron200}` }}>
                        <Icon size={18} color={s.tone} strokeWidth={1.9} />
                      </div>
                      <div>
                        <div style={{ ...mono, fontSize: 22, fontWeight: 700, color: T.iron900, lineHeight: 1 }}>{(s.value ?? 0).toLocaleString('en-IN')}</div>
                        <Caps size={9} color={T.iron400} style={{ display: 'block', marginTop: 4 }}>{s.label}</Caps>
                        {s.sub && <div style={{ ...mono, fontSize: 10, color: T.iron400, marginTop: 2 }}>{s.sub}</div>}
                      </div>
                    </div>
                  </IronCard>
                );
              })}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <IronCard pad={14}>
                <Caps size={9} style={{ display: 'block', marginBottom: 12 }}>Members by role</Caps>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {Object.entries(overview.by_role || {}).map(([role, n]) => (
                    <div key={role} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12.5 }}>
                      <span style={{ color: T.iron500 }}>{ROLE_LABEL[role] || role}</span>
                      <span style={{ ...mono, fontWeight: 700, color: T.iron900 }}>{n}</span>
                    </div>
                  ))}
                </div>
              </IronCard>
              <IronCard pad={14}>
                <Caps size={9} style={{ display: 'block', marginBottom: 12 }}>Top states</Caps>
                {(overview.by_state || []).length === 0 ? (
                  <div style={{ fontSize: 12, color: T.iron400 }}>No members yet.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {overview.by_state.map((s) => (
                      <div key={s.state} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12.5 }}>
                        <span style={{ color: T.iron500 }}>{s.state}</span>
                        <span style={{ ...mono, fontWeight: 700, color: T.iron900 }}>{s.count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </IronCard>
            </div>
          </>
        )
      )}

      {/* MEMBERS */}
      {tab === 'members' && (
        <>
          <IronCard pad={12} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
                <Search size={14} color={T.iron400} style={{ position: 'absolute', left: 9, top: 9 }} />
                <input value={search} onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') setQ(search); }}
                  placeholder="Search business, owner, GSTIN, city…"
                  style={{ ...inputStyle, paddingLeft: 30, width: '100%' }} />
              </div>
              <select value={fVerif} onChange={(e) => setFVerif(e.target.value)} style={selectStyle}>
                <option value="">All verification</option>
                <option value="pending">Pending</option>
                <option value="verified">Verified</option>
                <option value="rejected">Rejected</option>
              </select>
              <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} style={selectStyle}>
                <option value="">All status</option>
                <option value="pending">Pending</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
              </select>
              <select value={fRole} onChange={(e) => setFRole(e.target.value)} style={selectStyle}>
                <option value="">All roles</option>
                {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </IronCard>

          <IronCard pad={0} style={{ overflow: 'hidden' }}>
            {loadingM ? (
              <div style={{ display: 'grid', placeItems: 'center', height: 260 }}><Loader2 className="animate-spin" size={28} color={T.iron400} /></div>
            ) : members.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: T.iron400 }}>
                <Users size={40} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
                <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron700 }}>No members match these filters.</div>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                    {['BUSINESS', 'ROLE', 'LOCATION', 'GSTIN', 'RANK', 'VERIFICATION', ''].map((h, i) => (
                      <th key={i} style={{ ...thCell, textAlign: i === 6 ? 'right' : 'left' }}><Caps size={8.5}>{h}</Caps></th>
                    ))}
                  </tr></thead>
                  <tbody>{members.map((m) => (
                    <tr key={m.id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}`, cursor: 'pointer' }} onClick={() => openDetail(m)}>
                      <td style={tdCell}>
                        <div style={{ fontFamily: T.headline, fontWeight: 600, fontSize: 12.5, color: T.iron900 }}>{m.business_name}</div>
                        <div style={{ ...mono, fontSize: 10.5, color: T.iron500, marginTop: 2 }}>{m.owner_name} · {m.phone}</div>
                      </td>
                      <td style={{ ...tdCell, color: T.iron700 }}>{ROLE_LABEL[m.role] || m.role}</td>
                      <td style={{ ...tdCell, color: T.iron500 }}>{[m.city, m.state].filter(Boolean).join(', ') || '—'}</td>
                      <td style={{ ...tdCell, ...mono, fontSize: 11, color: T.iron500 }}>{m.gstin || '—'}</td>
                      <td style={tdCell}>
                        <RankBadge rank={m.rank} /> <span style={{ ...mono, fontSize: 10.5, color: T.iron400 }}>{m.crowns || 0}👑</span>
                      </td>
                      <td style={tdCell}>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          <VerifBadge v={m.verification} />
                          {m.status === 'suspended' && <span style={badgeStyle('bad')}>Suspended</span>}
                        </div>
                      </td>
                      <td style={{ ...tdCell, textAlign: 'right' }}>
                        <span style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 11, color: m.verification === 'pending' ? T.orangeDeep : T.iron400 }}>
                          {m.verification === 'pending' ? 'Review →' : 'View →'}
                        </span>
                      </td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </IronCard>
          <div style={{ marginTop: 8 }}><Caps size={9} color={T.iron400}>{mTotal} member(s)</Caps></div>
        </>
      )}

      {/* LEADERBOARD */}
      {tab === 'leaderboard' && (
        <IronCard pad={0} style={{ overflow: 'hidden' }}>
          {board.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: T.iron400 }}>
              <Trophy size={40} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
              <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron700 }}>No ranked members yet.</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                  {['#', 'BUSINESS', 'ROLE', 'LOCATION', 'RANK', 'CROWNS'].map((h, i) => (
                    <th key={i} style={{ ...thCell, textAlign: i === 5 ? 'right' : 'left', width: i === 0 ? 48 : undefined }}><Caps size={8.5}>{h}</Caps></th>
                  ))}
                </tr></thead>
                <tbody>{board.map((m, i) => (
                  <tr key={m.id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                    <td style={{ ...tdCell, ...mono, fontWeight: 700, color: T.orangeDeep }}>{i + 1}</td>
                    <td style={tdCell}>
                      <div style={{ fontFamily: T.headline, fontWeight: 600, fontSize: 12.5, color: T.iron900 }}>{m.business_name}</div>
                      <div style={{ ...mono, fontSize: 10.5, color: T.iron500, marginTop: 2 }}>{m.owner_name}</div>
                    </td>
                    <td style={{ ...tdCell, color: T.iron700 }}>{ROLE_LABEL[m.role] || m.role}</td>
                    <td style={{ ...tdCell, color: T.iron500 }}>{[m.city, m.state].filter(Boolean).join(', ') || '—'}</td>
                    <td style={tdCell}><RankBadge rank={m.rank} /></td>
                    <td style={{ ...tdCell, textAlign: 'right', ...mono, fontWeight: 700, color: T.iron900 }}>{m.crowns || 0} 👑</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </IronCard>
      )}

      {/* LEADS */}
      {tab === 'leads' && (
        <IronCard pad={0} style={{ overflow: 'hidden' }}>
          {leads.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: T.iron400 }}>
              <MessageSquare size={40} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
              <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron700 }}>No leads posted yet.</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                  {['TITLE', 'BY', 'CATEGORY', 'LOCATION', 'STATUS'].map((h, i) => (
                    <th key={i} style={thCell}><Caps size={8.5}>{h}</Caps></th>
                  ))}
                </tr></thead>
                <tbody>{leads.map((l) => (
                  <tr key={l.id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                    <td style={tdCell}><span style={{ fontFamily: T.headline, fontWeight: 600, fontSize: 12.5, color: T.iron900 }}>{l.title || l.description?.slice(0, 60) || '—'}</span></td>
                    <td style={{ ...tdCell, color: T.iron700 }}>{l.member_name || '—'}</td>
                    <td style={{ ...tdCell, color: T.iron500 }}>{l.category || '—'}</td>
                    <td style={{ ...tdCell, color: T.iron500 }}>{l.location || '—'}</td>
                    <td style={tdCell}><span style={badgeStyle('slate')}>{l.status}</span></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </IronCard>
      )}

      {/* POSTS / CONTENT */}
      {tab === 'posts' && (
        <IronCard pad={0} style={{ overflow: 'hidden' }}>
          {posts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: T.iron400 }}>
              <MessageSquare size={40} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
              <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron700 }}>No community posts yet.</div>
            </div>
          ) : (
            <div>
              {posts.map((p, idx) => (
                <div key={p.id} style={{ padding: 16, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, borderTop: idx === 0 ? 'none' : `1px solid ${T.iron200}` }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12.5, color: T.iron900 }}>{p.body}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                      <span style={{ ...mono, fontSize: 10.5, color: T.iron400 }}>{p.group || 'Feed'}</span>
                      <span style={badgeStyle(p.status === 'flagged' ? 'bad' : p.status === 'removed' ? 'slate' : 'ok')}>{p.status}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => moderatePost(p.id, 'approve')} title="Approve"
                      style={{ border: `1px solid ${T.green}`, background: T.white, color: T.green, borderRadius: 6, padding: '6px 8px', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
                      <CheckCircle2 size={15} />
                    </button>
                    <button onClick={() => moderatePost(p.id, 'remove')} title="Remove"
                      style={{ border: `1px solid ${T.orange}`, background: T.white, color: T.orangeDeep, borderRadius: 6, padding: '6px 8px', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
                      <XCircle size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </IronCard>
      )}

      {/* MEMBER DETAIL DIALOG */}
      <Dialog open={!!detail} onOpenChange={(o) => { if (!o) setDetail(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Crown className="w-5 h-5" style={{ color: T.orange }} />
                  {detail.business_name}
                  <RankBadge rank={detail.rank} />
                </DialogTitle>
              </DialogHeader>

              <div className="grid grid-cols-2 gap-3" style={{ marginTop: 4 }}>
                <Field label="Owner" value={detail.owner_name} />
                <Field label="Role" value={ROLE_LABEL[detail.role] || detail.role} />
                <Field label="Phone" value={detail.phone} mono />
                <Field label="Email" value={detail.email} />
                <Field label="GSTIN" value={detail.gstin} mono />
                <Field label="PAN" value={detail.pan} mono />
                <Field label="Location" value={[detail.city, detail.state, detail.pincode].filter(Boolean).join(', ')} />
                <Field label="Years in business" value={detail.years_in_business} />
                <Field label="Categories" value={(detail.categories || []).join(', ')} />
                <Field label="Crowns" value={`${detail.crowns || 0} 👑`} />
              </div>

              {(detail.logo_url || detail.proof_url) && (
                <div style={{ display: 'flex', gap: 14, marginTop: 10 }}>
                  {detail.proof_url && <a href={detail.proof_url} target="_blank" rel="noreferrer" style={{ color: T.blue, fontSize: 12.5, textDecoration: 'underline' }}>Business proof</a>}
                  {detail.logo_url && <a href={detail.logo_url} target="_blank" rel="noreferrer" style={{ color: T.blue, fontSize: 12.5, textDecoration: 'underline' }}>Logo</a>}
                </div>
              )}

              <div style={{ marginTop: 12 }}>
                <Caps size={8.5} style={{ display: 'block', marginBottom: 5 }}>Status</Caps>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <VerifBadge v={detail.verification} />
                  <span style={badgeStyle(detail.status === 'suspended' ? 'bad' : detail.status === 'active' ? 'ok' : 'warn')}>{detail.status}</span>
                </div>
                {detail.verification_note && <div style={{ ...mono, fontSize: 10.5, color: T.iron400, marginTop: 6 }}>Note: {detail.verification_note}</div>}
              </div>

              <Textarea
                value={actionNote} onChange={(e) => setActionNote(e.target.value)}
                placeholder="Optional note (sent to member on reject; recorded on actions)…"
                className="text-sm mt-3"
              />

              {/* Crown adjust */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
                <Award size={16} style={{ color: T.orange }} />
                <input type="number" value={crownDelta} onChange={(e) => setCrownDelta(e.target.value)}
                  placeholder="± Crowns" style={{ ...inputStyle, width: 120 }} />
                <button disabled={busy || !crownDelta} onClick={doCrowns}
                  style={{ ...outlineBtn, opacity: (busy || !crownDelta) ? 0.5 : 1, display: 'inline-flex', alignItems: 'center', gap: 5, color: T.orangeDeep, borderColor: T.orange }}>
                  <Plus size={14} /> Apply Crowns
                </button>
              </div>

              <DialogFooter className="flex-wrap gap-2" style={{ marginTop: 16 }}>
                {detail.verification !== 'verified' && (
                  <button disabled={busy} onClick={() => doVerify('approve')}
                    style={{ ...primaryBtn, background: T.green, opacity: busy ? 0.6 : 1, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <CheckCircle2 size={15} /> Approve &amp; Verify
                  </button>
                )}
                {detail.verification !== 'rejected' && (
                  <button disabled={busy} onClick={() => doVerify('reject')}
                    style={{ ...outlineBtn, color: T.orangeDeep, borderColor: T.orange, opacity: busy ? 0.6 : 1, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <XCircle size={15} /> Reject
                  </button>
                )}
                {detail.status === 'suspended' ? (
                  <button disabled={busy} onClick={() => doStatus('active')}
                    style={{ ...outlineBtn, color: T.green, borderColor: T.green, opacity: busy ? 0.6 : 1 }}>
                    Reactivate
                  </button>
                ) : (
                  <button disabled={busy} onClick={() => doStatus('suspended')}
                    style={{ ...outlineBtn, color: T.voltageText, borderColor: '#EDDFA6', opacity: busy ? 0.6 : 1, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <Ban size={15} /> Suspend
                  </button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </IronShell>
  );
}
