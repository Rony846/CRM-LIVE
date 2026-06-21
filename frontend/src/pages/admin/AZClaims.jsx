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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ShieldAlert, RefreshCw, Search, IndianRupee, Gavel, Clock, XCircle, AlertTriangle } from 'lucide-react';

const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
const STATUS_LABEL = {
  under_review: 'Under review', granted: 'Granted (lost)', denied: 'Denied (won)', appealed: 'Appealed', closed: 'Closed',
};
const STATUS_TONE = {
  under_review: 'text-amber-500', granted: 'text-red-500', denied: 'text-emerald-500',
  appealed: 'text-blue-400', closed: 'text-zinc-500',
};

export default function AZClaims() {
  const { token } = useAuth();
  const auth = { headers: { Authorization: `Bearer ${token}` } };
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (status !== 'all') params.status = status;
      const r = await axios.get(`${API}/admin/az-claims`, { ...auth, params });
      setData(r.data);
    } catch (e) { toast.error('Failed to load A-Z claims'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [status]);

  const claims = useMemo(() => {
    const c = data?.claims || [];
    const q = search.trim().toLowerCase();
    return q ? c.filter((x) => [x.order_id, x.customer, x.phone, x.product].some((v) => (v || '').toLowerCase().includes(q))) : c;
  }, [data, search]);

  const s = data?.summary || {};
  const statuses = data?.statuses || Object.keys(STATUS_LABEL);

  const setClaimStatus = async (order_id, st) => {
    try {
      await axios.patch(`${API}/admin/az-claims/${order_id}`, { status: st }, auth);
      load();
      toast.success(`Marked ${STATUS_LABEL[st] || st}`);
    } catch (e) { toast.error('Update failed'); }
  };

  const Stat = ({ label, value, sub, icon: Icon, tone }) => (
    <Card><CardContent className="p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
        <Icon className={`w-4 h-4 ${tone || 'text-muted-foreground'}`} />
      </div>
      <div className="text-2xl font-bold mt-2 tabular-nums">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </CardContent></Card>
  );

  return (
    <DashboardLayout title="A-Z Claims">
      <div className="space-y-4">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2"><ShieldAlert className="w-5 h-5 text-amber-500" /> Amazon A-to-z Guarantee Claims</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Claims filed by buyers. <b>Granted</b> = Amazon sided with the buyer (our loss); <b>Denied</b> = we won. Seeded from claim emails + Returns Report; upload the A-to-z export for full outcomes.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className="w-4 h-4 mr-1" />Refresh</Button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat label="Total at risk" value={inr(s.total_at_risk)} sub={`${s.count || 0} claims`} icon={IndianRupee} tone="text-amber-500" />
          <Stat label="Pending" value={inr(s.pending_at_risk)} sub={`${s.pending_count || 0} under review/appeal`} icon={Clock} tone="text-amber-400" />
          <Stat label="Granted (lost)" value={inr(s.granted_loss)} sub={`${s.granted_count || 0} claims`} icon={AlertTriangle} tone="text-red-500" />
          <Stat label="Denied (won)" value={`${s.denied_count || 0}`} sub="we kept the money" icon={XCircle} tone="text-emerald-500" />
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input className="pl-8" placeholder="Search order / customer / phone / product" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[170px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {statuses.map((st) => <SelectItem key={st} value={st}>{STATUS_LABEL[st] || st}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <Card><CardContent className="p-0 overflow-x-auto">
          <Table cards>
            <TableHeader><TableRow>
              <TableHead>Order</TableHead><TableHead>Customer</TableHead><TableHead>Product</TableHead>
              <TableHead className="text-right">At risk</TableHead><TableHead>Filed</TableHead>
              <TableHead>Source</TableHead><TableHead>Status</TableHead><TableHead>Links</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">Loading…</TableCell></TableRow>
              ) : claims.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">No A-Z claims.</TableCell></TableRow>
              ) : claims.map((c) => (
                <TableRow key={c.order_id}>
                  <TableCell className="font-mono text-xs">{c.order_id}</TableCell>
                  <TableCell><div className="font-medium">{c.customer || '—'}</div><div className="text-xs text-muted-foreground font-mono">{c.phone}</div></TableCell>
                  <TableCell className="text-xs max-w-[180px] truncate" title={c.product}>{c.product || '—'}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums font-semibold">{inr(c.amount_at_risk)}</TableCell>
                  <TableCell className="text-xs">{c.claim_date}</TableCell>
                  <TableCell className="text-[10px] text-muted-foreground">{(c.sources || []).join(', ')}</TableCell>
                  <TableCell>
                    <Select value={c.status || 'under_review'} onValueChange={(v) => setClaimStatus(c.order_id, v)}>
                      <SelectTrigger className={`w-[140px] h-8 text-xs ${STATUS_TONE[c.status] || ''}`}><SelectValue /></SelectTrigger>
                      <SelectContent>{statuses.map((st) => <SelectItem key={st} value={st}>{STATUS_LABEL[st] || st}</SelectItem>)}</SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="space-y-0.5">
                    {c.refund_loss && !c.refund_loss.returned && (
                      <Link to="/admin/refund-losses" className="flex items-center gap-1 text-[10px] text-red-400 hover:underline"><IndianRupee className="w-3 h-3" />loss</Link>
                    )}
                    {c.legal_case && (
                      <Link to="/admin/legal-cases" className="flex items-center gap-1 text-[10px] text-purple-400 hover:underline"><Gavel className="w-3 h-3" />{c.legal_case.serial || 'case'}</Link>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      </div>
    </DashboardLayout>
  );
}
