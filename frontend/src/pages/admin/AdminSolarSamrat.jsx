import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Crown, Loader2, Search, CheckCircle2, XCircle, Ban, ShieldCheck,
  Users, Clock, MessageSquare, Trophy, Plus, Award,
} from 'lucide-react';

const RANK_COLORS = {
  Sipahi: 'bg-slate-600',
  Sardar: 'bg-amber-700',
  Raja: 'bg-amber-500',
  Maharaja: 'bg-fuchsia-600',
  Samrat: 'bg-gradient-to-r from-amber-400 to-yellow-500 text-black',
};

const ROLE_LABEL = {
  dealer: 'Dealer', distributor: 'Distributor', epc: 'EPC / Installer',
  brand: 'Brand', customer: 'Customer',
};

function StatCard({ label, value, icon: Icon, color = 'text-cyan-400', sub }) {
  return (
    <Card className="bg-slate-800 border-slate-700 p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-slate-400 text-xs uppercase tracking-wide">{label}</div>
          <div className="text-2xl font-bold text-white mt-1">{value}</div>
          {sub && <div className="text-slate-500 text-xs mt-0.5">{sub}</div>}
        </div>
        {Icon && <Icon className={`w-7 h-7 ${color}`} />}
      </div>
    </Card>
  );
}

function RankBadge({ rank }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${RANK_COLORS[rank] || 'bg-slate-600'} text-white`}>
      {rank || 'Sipahi'}
    </span>
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

  const verifBadge = (v) => {
    if (v === 'verified') return <Badge className="bg-emerald-600">Verified</Badge>;
    if (v === 'rejected') return <Badge className="bg-red-600">Rejected</Badge>;
    return <Badge className="bg-amber-600">Pending</Badge>;
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Crown className="w-7 h-7 text-amber-400" /> Solar Samrat
            <span className="text-amber-400/70 text-sm font-normal">— where every dealer rules</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Open-industry solar community · approve members, moderate content, manage the leaderboard
          </p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-slate-800 border border-slate-700">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="members">
            Members
            {overview?.pending_verification ? (
              <span className="ml-1.5 bg-amber-500 text-black text-xs rounded-full px-1.5">{overview.pending_verification}</span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
          <TabsTrigger value="leads">Leads</TabsTrigger>
          <TabsTrigger value="posts">
            Content
            {overview?.posts_flagged ? (
              <span className="ml-1.5 bg-red-500 text-white text-xs rounded-full px-1.5">{overview.posts_flagged}</span>
            ) : null}
          </TabsTrigger>
        </TabsList>

        {/* OVERVIEW */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          {loadingOv || !overview ? (
            <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-amber-400" /></div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <StatCard label="Members" value={overview.members_total} icon={Users} />
                <StatCard label="Pending" value={overview.pending_verification} icon={Clock} color="text-amber-400" sub="awaiting verification" />
                <StatCard label="Verified" value={overview.verified} icon={ShieldCheck} color="text-emerald-400" />
                <StatCard label="Suspended" value={overview.suspended} icon={Ban} color="text-red-400" />
                <StatCard label="Open Leads" value={overview.leads_open} icon={MessageSquare} color="text-cyan-400" sub={`${overview.leads_total} total`} />
                <StatCard label="Flagged Posts" value={overview.posts_flagged} icon={MessageSquare} color="text-red-400" sub={`${overview.posts_total} total`} />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <Card className="bg-slate-800 border-slate-700 p-4">
                  <div className="text-slate-300 font-semibold mb-3">Members by role</div>
                  <div className="space-y-2">
                    {Object.entries(overview.by_role || {}).map(([role, n]) => (
                      <div key={role} className="flex items-center justify-between text-sm">
                        <span className="text-slate-400">{ROLE_LABEL[role] || role}</span>
                        <span className="text-white font-medium">{n}</span>
                      </div>
                    ))}
                  </div>
                </Card>
                <Card className="bg-slate-800 border-slate-700 p-4">
                  <div className="text-slate-300 font-semibold mb-3">Top states</div>
                  {(overview.by_state || []).length === 0 ? (
                    <div className="text-slate-500 text-sm">No members yet.</div>
                  ) : (
                    <div className="space-y-2">
                      {overview.by_state.map((s) => (
                        <div key={s.state} className="flex items-center justify-between text-sm">
                          <span className="text-slate-400">{s.state}</span>
                          <span className="text-white font-medium">{s.count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        {/* MEMBERS */}
        <TabsContent value="members" className="space-y-4 mt-4">
          <Card className="bg-slate-800 border-slate-700 p-3">
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  value={search} onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') setQ(search); }}
                  placeholder="Search business, owner, GSTIN, city…"
                  className="bg-slate-700 border-slate-600 text-white pl-9"
                />
              </div>
              <select value={fVerif} onChange={(e) => setFVerif(e.target.value)}
                className="bg-slate-700 border border-slate-600 text-white rounded-md px-2 py-2 text-sm">
                <option value="">All verification</option>
                <option value="pending">Pending</option>
                <option value="verified">Verified</option>
                <option value="rejected">Rejected</option>
              </select>
              <select value={fStatus} onChange={(e) => setFStatus(e.target.value)}
                className="bg-slate-700 border border-slate-600 text-white rounded-md px-2 py-2 text-sm">
                <option value="">All status</option>
                <option value="pending">Pending</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
              </select>
              <select value={fRole} onChange={(e) => setFRole(e.target.value)}
                className="bg-slate-700 border border-slate-600 text-white rounded-md px-2 py-2 text-sm">
                <option value="">All roles</option>
                {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </Card>

          <Card className="bg-slate-800 border-slate-700 overflow-x-auto">
            {loadingM ? (
              <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-amber-400" /></div>
            ) : members.length === 0 ? (
              <div className="py-16 text-center text-slate-400">No members match these filters.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-700 hover:bg-transparent">
                    <TableHead className="text-slate-400">Business</TableHead>
                    <TableHead className="text-slate-400">Role</TableHead>
                    <TableHead className="text-slate-400">Location</TableHead>
                    <TableHead className="text-slate-400">GSTIN</TableHead>
                    <TableHead className="text-slate-400">Rank</TableHead>
                    <TableHead className="text-slate-400">Verification</TableHead>
                    <TableHead className="text-slate-400 text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((m) => (
                    <TableRow key={m.id} className="border-slate-700 cursor-pointer" onClick={() => openDetail(m)}>
                      <TableCell className="text-white font-medium">
                        {m.business_name}
                        <div className="text-slate-500 text-xs">{m.owner_name} · {m.phone}</div>
                      </TableCell>
                      <TableCell className="text-slate-300">{ROLE_LABEL[m.role] || m.role}</TableCell>
                      <TableCell className="text-slate-400">{[m.city, m.state].filter(Boolean).join(', ') || '—'}</TableCell>
                      <TableCell className="text-slate-400 font-mono text-xs">{m.gstin || '—'}</TableCell>
                      <TableCell><RankBadge rank={m.rank} /> <span className="text-slate-500 text-xs">{m.crowns || 0}👑</span></TableCell>
                      <TableCell>{verifBadge(m.verification)}{m.status === 'suspended' && <Badge className="bg-red-700 ml-1">Suspended</Badge>}</TableCell>
                      <TableCell className="text-right">
                        {m.verification === 'pending' ? (
                          <span className="text-amber-400 text-xs font-medium">Review →</span>
                        ) : (
                          <span className="text-slate-500 text-xs">View →</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
          <div className="text-slate-500 text-xs">{mTotal} member(s)</div>
        </TabsContent>

        {/* LEADERBOARD */}
        <TabsContent value="leaderboard" className="mt-4">
          <Card className="bg-slate-800 border-slate-700 overflow-x-auto">
            {board.length === 0 ? (
              <div className="py-16 text-center text-slate-400 flex flex-col items-center gap-2">
                <Trophy className="w-8 h-8 text-amber-400/50" /> No ranked members yet.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-700 hover:bg-transparent">
                    <TableHead className="text-slate-400 w-12">#</TableHead>
                    <TableHead className="text-slate-400">Business</TableHead>
                    <TableHead className="text-slate-400">Role</TableHead>
                    <TableHead className="text-slate-400">Location</TableHead>
                    <TableHead className="text-slate-400">Rank</TableHead>
                    <TableHead className="text-slate-400 text-right">Crowns</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {board.map((m, i) => (
                    <TableRow key={m.id} className="border-slate-700">
                      <TableCell className="text-amber-400 font-bold">{i + 1}</TableCell>
                      <TableCell className="text-white font-medium">{m.business_name}
                        <div className="text-slate-500 text-xs">{m.owner_name}</div>
                      </TableCell>
                      <TableCell className="text-slate-300">{ROLE_LABEL[m.role] || m.role}</TableCell>
                      <TableCell className="text-slate-400">{[m.city, m.state].filter(Boolean).join(', ') || '—'}</TableCell>
                      <TableCell><RankBadge rank={m.rank} /></TableCell>
                      <TableCell className="text-right text-amber-300 font-semibold">{m.crowns || 0} 👑</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        {/* LEADS */}
        <TabsContent value="leads" className="mt-4">
          <Card className="bg-slate-800 border-slate-700 overflow-x-auto">
            {leads.length === 0 ? (
              <div className="py-16 text-center text-slate-400">No leads posted yet.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-700 hover:bg-transparent">
                    <TableHead className="text-slate-400">Title</TableHead>
                    <TableHead className="text-slate-400">By</TableHead>
                    <TableHead className="text-slate-400">Category</TableHead>
                    <TableHead className="text-slate-400">Location</TableHead>
                    <TableHead className="text-slate-400">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.map((l) => (
                    <TableRow key={l.id} className="border-slate-700">
                      <TableCell className="text-white font-medium">{l.title || l.description?.slice(0, 60) || '—'}</TableCell>
                      <TableCell className="text-slate-300">{l.member_name || '—'}</TableCell>
                      <TableCell className="text-slate-400">{l.category || '—'}</TableCell>
                      <TableCell className="text-slate-400">{l.location || '—'}</TableCell>
                      <TableCell><Badge className="bg-slate-600">{l.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        {/* POSTS / CONTENT */}
        <TabsContent value="posts" className="mt-4">
          <Card className="bg-slate-800 border-slate-700">
            {posts.length === 0 ? (
              <div className="py-16 text-center text-slate-400">No community posts yet.</div>
            ) : (
              <div className="divide-y divide-slate-700">
                {posts.map((p) => (
                  <div key={p.id} className="p-4 flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="text-white text-sm">{p.body}</div>
                      <div className="text-slate-500 text-xs mt-1">
                        {p.group || 'Feed'} · <Badge className={p.status === 'flagged' ? 'bg-red-600' : p.status === 'removed' ? 'bg-slate-600' : 'bg-emerald-700'}>{p.status}</Badge>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="border-emerald-600 text-emerald-400"
                        onClick={() => moderatePost(p.id, 'approve')}>
                        <CheckCircle2 className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="outline" className="border-red-600 text-red-400"
                        onClick={() => moderatePost(p.id, 'remove')}>
                        <XCircle className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* MEMBER DETAIL DIALOG */}
      <Dialog open={!!detail} onOpenChange={(o) => { if (!o) setDetail(null); }}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Crown className="w-5 h-5 text-amber-400" />
                  {detail.business_name}
                  <RankBadge rank={detail.rank} />
                </DialogTitle>
              </DialogHeader>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <Field label="Owner" value={detail.owner_name} />
                <Field label="Role" value={ROLE_LABEL[detail.role] || detail.role} />
                <Field label="Phone" value={detail.phone} />
                <Field label="Email" value={detail.email} />
                <Field label="GSTIN" value={detail.gstin} mono />
                <Field label="PAN" value={detail.pan} mono />
                <Field label="Location" value={[detail.city, detail.state, detail.pincode].filter(Boolean).join(', ')} />
                <Field label="Years in business" value={detail.years_in_business} />
                <Field label="Categories" value={(detail.categories || []).join(', ')} />
                <Field label="Crowns" value={`${detail.crowns || 0} 👑`} />
              </div>

              {(detail.logo_url || detail.proof_url) && (
                <div className="flex gap-3 mt-2">
                  {detail.proof_url && <a href={detail.proof_url} target="_blank" rel="noreferrer" className="text-cyan-400 text-sm underline">Business proof</a>}
                  {detail.logo_url && <a href={detail.logo_url} target="_blank" rel="noreferrer" className="text-cyan-400 text-sm underline">Logo</a>}
                </div>
              )}

              <div className="mt-1">
                <div className="text-slate-400 text-xs mb-1">Status</div>
                <div className="flex gap-2">{verifBadge(detail.verification)}
                  <Badge className={detail.status === 'suspended' ? 'bg-red-700' : detail.status === 'active' ? 'bg-emerald-700' : 'bg-amber-700'}>{detail.status}</Badge>
                </div>
                {detail.verification_note && <div className="text-slate-500 text-xs mt-1">Note: {detail.verification_note}</div>}
              </div>

              <Textarea
                value={actionNote} onChange={(e) => setActionNote(e.target.value)}
                placeholder="Optional note (sent to member on reject; recorded on actions)…"
                className="bg-slate-800 border-slate-600 text-white text-sm mt-2"
              />

              {/* Crown adjust */}
              <div className="flex items-center gap-2 mt-1">
                <Award className="w-4 h-4 text-amber-400" />
                <Input type="number" value={crownDelta} onChange={(e) => setCrownDelta(e.target.value)}
                  placeholder="± Crowns" className="bg-slate-800 border-slate-600 text-white w-28 h-9" />
                <Button size="sm" variant="outline" className="border-amber-600 text-amber-400"
                  disabled={busy || !crownDelta} onClick={doCrowns}>
                  <Plus className="w-4 h-4 mr-1" /> Apply Crowns
                </Button>
              </div>

              <DialogFooter className="flex-wrap gap-2 mt-3">
                {detail.verification !== 'verified' && (
                  <Button disabled={busy} className="bg-emerald-600 hover:bg-emerald-700" onClick={() => doVerify('approve')}>
                    <CheckCircle2 className="w-4 h-4 mr-1" /> Approve & Verify
                  </Button>
                )}
                {detail.verification !== 'rejected' && (
                  <Button disabled={busy} variant="outline" className="border-red-600 text-red-400" onClick={() => doVerify('reject')}>
                    <XCircle className="w-4 h-4 mr-1" /> Reject
                  </Button>
                )}
                {detail.status === 'suspended' ? (
                  <Button disabled={busy} variant="outline" className="border-emerald-600 text-emerald-400" onClick={() => doStatus('active')}>
                    Reactivate
                  </Button>
                ) : (
                  <Button disabled={busy} variant="outline" className="border-amber-600 text-amber-400" onClick={() => doStatus('suspended')}>
                    <Ban className="w-4 h-4 mr-1" /> Suspend
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, value, mono }) {
  return (
    <div>
      <div className="text-slate-400 text-xs">{label}</div>
      <div className={`text-white ${mono ? 'font-mono text-xs' : ''}`}>{value || '—'}</div>
    </div>
  );
}
