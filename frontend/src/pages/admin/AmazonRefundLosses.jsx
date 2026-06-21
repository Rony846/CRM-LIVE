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
import { AlertTriangle, Scale, RefreshCw, Download, Search, IndianRupee, ShieldCheck, Gavel } from 'lucide-react';

const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
const STATUS_LABEL = {
  none: 'No action', review: 'Under review', notice_drafted: 'Notice drafted',
  notice_sent: 'Notice sent', case_filed: 'Case filed', recovered: 'Recovered', written_off: 'Written off',
};
const STATUS_TONE = {
  none: 'bg-muted text-muted-foreground', review: 'bg-amber-500/15 text-amber-500',
  notice_drafted: 'bg-blue-500/15 text-blue-400', notice_sent: 'bg-indigo-500/15 text-indigo-400',
  case_filed: 'bg-purple-500/15 text-purple-400', recovered: 'bg-emerald-500/15 text-emerald-400',
  written_off: 'bg-zinc-500/15 text-zinc-400',
};

export default function AmazonRefundLosses() {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [confidence, setConfidence] = useState('all');
  const [legalStatus, setLegalStatus] = useState('all');
  const [search, setSearch] = useState('');
  const auth = { headers: { Authorization: `Bearer ${token}` } };

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (confidence !== 'all') params.confidence = confidence;
      if (legalStatus !== 'all') params.legal_status = legalStatus;
      const r = await axios.get(`${API}/admin/amazon-refund-losses`, { ...auth, params });
      setData(r.data);
    } catch (e) { toast.error('Failed to load refund losses'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [confidence, legalStatus]);

  const orders = useMemo(() => {
    const o = data?.orders || [];
    const q = search.trim().toLowerCase();
    return q ? o.filter((x) =>
      (x.order_id || '').toLowerCase().includes(q) ||
      (x.customer || '').toLowerCase().includes(q) ||
      (x.phone || '').includes(q) ||
      (x.product || '').toLowerCase().includes(q)) : o;
  }, [data, search]);

  const s = data?.summary || {};
  const statuses = data?.legal_statuses || Object.keys(STATUS_LABEL);

  const update = async (order_id, patch) => {
    try {
      await axios.patch(`${API}/admin/amazon-refund-losses/${order_id}`, patch, auth);
      setData((d) => ({ ...d, orders: d.orders.map((o) => o.order_id === order_id ? { ...o, ...patch } : o) }));
      toast.success('Updated');
    } catch (e) { toast.error('Update failed'); }
  };

  const [creating, setCreating] = useState(false);
  const createCase = async (order_id) => {
    try {
      const r = await axios.post(`${API}/admin/amazon-refund-losses/${order_id}/create-legal-case`, {}, auth);
      const c = r.data.case;
      setData((d) => ({ ...d, orders: d.orders.map((o) => o.order_id === order_id
        ? { ...o, legal_case: { serial: c.serial, status: c.status || 'notice_pending', id: c.id } } : o) }));
      toast.success(r.data.created ? `Legal case ${c.serial} created` : `Case ${c.serial || ''} already existed`);
      return true;
    } catch (e) { toast.error('Failed to create legal case'); return false; }
  };
  const createAllMissing = async () => {
    const missing = orders.filter((o) => !o.legal_case);
    if (!missing.length) { toast.info('All shown orders already have a legal case'); return; }
    if (!window.confirm(`Create a legal case for all ${missing.length} shown orders that don't have one?`)) return;
    setCreating(true);
    let made = 0;
    for (const o of missing) { if (await createCase(o.order_id)) made += 1; }
    setCreating(false);
    toast.success(`Done — ${made} legal cases ready`);
  };

  const exportCsv = () => {
    const cols = ['order_id', 'firm_name', 'customer', 'phone', 'ship_state', 'product', 'refund_amount',
      'channel', 'loss_confidence', 'delivery_proof', 'delivered_date', 'awb', 'legal_status', 'legal_notes'];
    const lines = [cols.join(',')].concat(orders.map((o) =>
      cols.map((c) => `"${String(o[c] ?? '').replace(/"/g, '""')}"`).join(',')));
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'amazon_refund_losses.csv'; a.click();
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
    <DashboardLayout title="Amazon Refund Losses">
      <div className="space-y-4">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" /> Refund Losses — Legal Recovery
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Orders Amazon refunded where the parcel was <b>delivered and never returned</b> to us — recover via A-Z contest / legal notice.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="default" size="sm" onClick={createAllMissing} disabled={creating}>
              <Gavel className="w-4 h-4 mr-1" />{creating ? 'Creating…' : 'Create cases for all shown'}
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv}><Download className="w-4 h-4 mr-1" />Export</Button>
            <Button variant="outline" size="sm" onClick={load}><RefreshCw className="w-4 h-4 mr-1" />Refresh</Button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat label="Total real loss" value={inr(s.total_loss)} sub={`${s.count || 0} orders`} icon={IndianRupee} tone="text-red-500" />
          <Stat label="High confidence" value={inr(s.high_loss)} sub={`${s.high_count || 0} Amazon-confirmed`} icon={AlertTriangle} tone="text-red-400" />
          <Stat label="Medium confidence" value={`${s.medium_count || 0}`} sub="self-ship, our data" icon={Scale} tone="text-amber-500" />
          <Stat label="Recovered" value={inr(s.recovered_loss)} sub="marked recovered" icon={ShieldCheck} tone="text-emerald-500" />
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input className="pl-8" placeholder="Search order / customer / phone / product"
              value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={confidence} onValueChange={setConfidence}>
            <SelectTrigger className="w-[170px]"><SelectValue placeholder="Confidence" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All confidence</SelectItem>
              <SelectItem value="High">High (Amazon-confirmed)</SelectItem>
              <SelectItem value="Medium">Medium (self-ship)</SelectItem>
            </SelectContent>
          </Select>
          <Select value={legalStatus} onValueChange={setLegalStatus}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Legal status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {statuses.map((st) => <SelectItem key={st} value={st}>{STATUS_LABEL[st] || st}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <Card><CardContent className="p-0 overflow-x-auto">
          <Table cards>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Refund</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead>Delivery proof</TableHead>
                <TableHead>Legal status</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={9} className="text-center py-10 text-muted-foreground">Loading…</TableCell></TableRow>
              ) : orders.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-10 text-muted-foreground">No loss orders.</TableCell></TableRow>
              ) : orders.map((o) => (
                <TableRow key={o.order_id}>
                  <TableCell className="font-mono text-xs">
                    {o.order_id}
                    {o.legal_case ? (
                      <Link to="/admin/legal-cases" title="Legal case exists for this order"
                        className="mt-1 inline-flex items-center gap-1 text-[10px] text-purple-400 hover:underline">
                        <Gavel className="w-3 h-3" /> Legal case{o.legal_case.serial ? ` ${o.legal_case.serial}` : ''}
                      </Link>
                    ) : (
                      <button onClick={() => createCase(o.order_id)}
                        className="mt-1 inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-purple-400 hover:underline">
                        <Gavel className="w-3 h-3" /> + Create legal case
                      </button>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{o.customer || '—'}</div>
                    <div className="text-xs text-muted-foreground font-mono">{o.phone}</div>
                  </TableCell>
                  <TableCell className="text-xs">{o.ship_state || '—'}</TableCell>
                  <TableCell className="text-xs max-w-[180px] truncate" title={o.product}>{o.product}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums font-semibold">{inr(o.refund_amount)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={o.loss_confidence?.startsWith('High') ? 'border-red-500/40 text-red-400' : 'border-amber-500/40 text-amber-500'}>
                      {o.loss_confidence?.startsWith('High') ? 'High' : 'Medium'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {o.delivery_proof}{o.delivered_date ? ` · ${o.delivered_date}` : ''}
                  </TableCell>
                  <TableCell>
                    <Select value={o.legal_status || 'none'} onValueChange={(v) => update(o.order_id, { legal_status: v })}>
                      <SelectTrigger className={`w-[140px] h-8 text-xs ${STATUS_TONE[o.legal_status] || ''}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {statuses.map((st) => <SelectItem key={st} value={st}>{STATUS_LABEL[st] || st}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input className="h-8 text-xs w-[150px]" placeholder="add note…" defaultValue={o.legal_notes || ''}
                      onBlur={(e) => { if ((e.target.value || '') !== (o.legal_notes || '')) update(o.order_id, { legal_notes: e.target.value }); }} />
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
