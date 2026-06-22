import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Scale, RefreshCw, Search, FileText, MessageSquare, Gavel, Send, IndianRupee, Upload } from 'lucide-react';

const STATUS_LABEL = {
  pending: 'Pending', draft_uploaded: 'Draft uploaded', notice_pending: 'Notice pending',
  notice_sent: 'Notice sent', notice_delivered: 'Notice delivered', pending_legal_case: 'Pending legal case',
  case_filed: 'Case filed', closed_recovered: 'Closed — recovered', closed_dropped: 'Closed — dropped',
};
const STATUS_TONE = {
  pending: 'text-muted-foreground', draft_uploaded: 'text-blue-400', notice_pending: 'text-amber-500',
  notice_sent: 'text-indigo-400', notice_delivered: 'text-cyan-400', pending_legal_case: 'text-orange-400',
  case_filed: 'text-purple-400', closed_recovered: 'text-emerald-500', closed_dropped: 'text-zinc-500',
};

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
    <Card><CardContent className="p-4">
      <div className="text-xs text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className="text-2xl font-bold mt-2 tabular-nums">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </CardContent></Card>
  );

  const StatusSelect = ({ c, w = 'w-[150px]' }) => (
    <Select value={c.status || 'pending'} onValueChange={(v) => setCaseStatus(c.id, v)}>
      <SelectTrigger className={`${w} h-8 text-xs ${STATUS_TONE[c.status] || ''}`}><SelectValue /></SelectTrigger>
      <SelectContent>{statuses.map((st) => <SelectItem key={st} value={st}>{STATUS_LABEL[st] || st}</SelectItem>)}</SelectContent>
    </Select>
  );

  return (
    <DashboardLayout title="Legal Cases">
      <div className="space-y-4">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2"><Gavel className="w-5 h-5 text-purple-400" /> Legal Cases</h1>
            <p className="text-sm text-muted-foreground mt-1">Cases against customers (false-refund / non-return) — imported from the legal panel.</p>
          </div>
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className="w-4 h-4 mr-1" />Refresh</Button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat label="Total cases" value={s.count || 0} />
          <Stat label="Notice pending" value={(s.by_status || {}).notice_pending || 0} sub="awaiting legal notice" />
          <Stat label="Case filed" value={(s.by_status || {}).case_filed || 0} />
          <Stat label="With documents" value={s.with_docs || 0} sub="client PDFs attached" />
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input className="pl-8" placeholder="Search party / order / phone / serial / issue" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[170px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {statuses.map((st) => <SelectItem key={st} value={st}>{STATUS_LABEL[st] || st}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={firm} onValueChange={setFirm}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Firm" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All firms</SelectItem>
              {(data?.firms || []).map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <Card><CardContent className="p-0 overflow-x-auto">
          <Table cards>
            <TableHeader><TableRow>
              <TableHead>Serial</TableHead><TableHead>Party</TableHead><TableHead>Order ID</TableHead>
              <TableHead>Firm</TableHead><TableHead>Issue</TableHead><TableHead>Status</TableHead><TableHead>Doc</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">Loading…</TableCell></TableRow>
              ) : cases.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">No cases.</TableCell></TableRow>
              ) : cases.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs font-semibold">{c.serial || '—'}</TableCell>
                  <TableCell><div className="font-medium">{c.party_name}</div><div className="text-xs text-muted-foreground font-mono">{c.customer_phone}</div></TableCell>
                  <TableCell className="font-mono text-xs">
                    {c.order_id || '—'}
                    {c.refund_loss && (
                      <Link to="/admin/refund-losses" title="Tracked as a refund loss"
                        className="mt-1 inline-flex items-center gap-1 text-[10px] text-red-400 hover:underline">
                        <IndianRupee className="w-3 h-3" />{Number(c.refund_loss.amount || 0).toLocaleString('en-IN')} loss
                      </Link>
                    )}
                  </TableCell>
                  <TableCell className="text-xs max-w-[140px] truncate" title={c.firm_name}>{c.firm_name}</TableCell>
                  <TableCell className="text-xs max-w-[220px] truncate" title={c.issue}>{c.issue || '—'}</TableCell>
                  <TableCell><StatusSelect c={c} /></TableCell>
                  <TableCell>{c.client_document
                    ? <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => openDoc(c.id)}><FileText className="w-4 h-4 text-blue-400" /></Button>
                    : <span className="text-muted-foreground text-xs">—</span>}</TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { setOpen(c); setComment(''); }}>
                      <MessageSquare className="w-3.5 h-3.5 mr-1" />{(c.comments || []).length || 'View'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      </div>

      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="max-w-lg">
          {open && (<>
            <DialogHeader><DialogTitle className="flex items-center gap-2">
              <span className="font-mono">{open.serial}</span> · {open.party_name}
            </DialogTitle></DialogHeader>
            <div className="space-y-3 text-sm">
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>📞 {open.customer_phone || '—'}</span><span>🧾 {open.order_id || '—'}</span><span>🏢 {open.firm_name}</span>
              </div>
              {open.refund_loss && (
                <Link to="/admin/refund-losses" className="flex items-center gap-1.5 text-xs text-red-400 hover:underline">
                  <IndianRupee className="w-3.5 h-3.5" />Tracked refund loss: ₹{Number(open.refund_loss.amount || 0).toLocaleString('en-IN')}
                  <span className="text-muted-foreground">· {open.refund_loss.confidence}</span>
                </Link>
              )}
              <div><div className="text-xs text-muted-foreground mb-1">Issue</div>
                <div className="bg-muted/40 rounded p-2 text-sm whitespace-pre-wrap">{open.issue || '—'}</div></div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Status:</span><StatusSelect c={open} w="w-[170px]" />
                {open.client_document && <Button variant="outline" size="sm" className="h-8 text-xs ml-auto" onClick={() => openDoc(open.id)}><FileText className="w-4 h-4 mr-1" />Client doc</Button>}
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">My notices & documents</span>
                  <label className="text-xs text-blue-400 hover:underline cursor-pointer inline-flex items-center gap-1">
                    <Upload className="w-3.5 h-3.5" />{uploading ? 'Uploading…' : 'Upload'}
                    <input type="file" className="hidden" disabled={uploading}
                      onChange={(e) => { if (e.target.files[0]) uploadDoc(open.id, e.target.files[0]); e.target.value = ''; }} />
                  </label>
                </div>
                <div className="space-y-1">
                  {(open.lawyer_documents || []).length === 0 && <div className="text-xs text-muted-foreground">No documents uploaded yet.</div>}
                  {(open.lawyer_documents || []).map((d) => (
                    <button key={d.id} onClick={() => openLawyerDoc(open.id, d.id)}
                      className="flex items-center gap-1.5 text-xs text-blue-400 hover:underline text-left">
                      <FileText className="w-3.5 h-3.5 shrink-0" /> {d.filename}
                      <span className="text-muted-foreground">· {d.type} · {(d.at || '').slice(0, 10)}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Comments</div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {(open.comments || []).length === 0 && <div className="text-xs text-muted-foreground">No comments yet.</div>}
                  {(open.comments || []).map((cm) => (
                    <div key={cm.id} className="bg-muted/40 rounded p-2">
                      <div className="text-xs">{cm.text}</div>
                      <div className="text-[10px] text-muted-foreground mt-1">{cm.by} · {(cm.at || '').slice(0, 10)}</div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-2">
                  <Textarea className="text-xs min-h-[38px]" placeholder="Add a comment…" value={comment} onChange={(e) => setComment(e.target.value)} />
                  <Button size="sm" onClick={addComment} disabled={!comment.trim()}><Send className="w-4 h-4" /></Button>
                </div>
              </div>
            </div>
          </>)}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
