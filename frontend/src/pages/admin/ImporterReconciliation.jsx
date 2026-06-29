import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, IndianRupee, Percent, Package, FileText } from 'lucide-react';

const fmt = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

export default function ImporterReconciliation() {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const h = { headers: { Authorization: `Bearer ${token}` } };

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const r = await axios.get(`${API}/admin/importer-reconciliation`, h);
        setData(r.data);
      } catch (e) { /* */ } finally { setLoading(false); }
    })();
  }, [token]);

  const byImp = data?.by_importer || {};
  const impNames = Object.keys(byImp);

  const rows = useMemo(() => {
    const all = data?.rows || [];
    return filter === 'all' ? all : all.filter(r => (r.importer_name || r.importer_id) === filter);
  }, [data, filter]);

  const totals = useMemo(() => rows.reduce((a, r) => ({
    landed: a.landed + (r.landed_cost || 0),
    commission: a.commission + (r.commission_amount || 0),
    billed: a.billed + (r.total_billed || 0),
  }), { landed: 0, commission: 0, billed: 0 }), [rows]);

  return (
    <DashboardLayout title="Importer Reconciliation">
      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">
          The you-vs-them view across all importers — landed cost they paid, their commission, and what they bill MGIPL.
          Each billed consignment posts an MGIPL payable automatically.
        </p>

        {/* Grand totals */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card><CardContent className="pt-6"><div className="flex items-center justify-between">
            <div><p className="text-xs text-muted-foreground uppercase">Importers</p>
            <p className="text-2xl font-bold">{impNames.length}</p></div><Users className="w-7 h-7 text-muted-foreground" /></div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="flex items-center justify-between">
            <div><p className="text-xs text-muted-foreground uppercase">Consignments</p>
            <p className="text-2xl font-bold">{(data?.rows || []).length}</p></div><Package className="w-7 h-7 text-muted-foreground" /></div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="flex items-center justify-between">
            <div><p className="text-xs text-muted-foreground uppercase">Total Commission</p>
            <p className="text-2xl font-bold text-amber-500">{fmt(data?.rows?.reduce((s, r) => s + (r.commission_amount || 0), 0))}</p></div><Percent className="w-7 h-7 text-amber-500" /></div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="flex items-center justify-between">
            <div><p className="text-xs text-muted-foreground uppercase">Total Billed to MGIPL</p>
            <p className="text-2xl font-bold text-emerald-500">{fmt(data?.grand_total_billed)}</p></div><IndianRupee className="w-7 h-7 text-emerald-500" /></div></CardContent></Card>
        </div>

        {/* Per-importer breakdown */}
        <Card>
          <CardHeader><CardTitle>By Importer</CardTitle>
            <CardDescription>Per-importer totals — what each partner has billed MGIPL.</CardDescription></CardHeader>
          <CardContent>
            {loading ? <p className="text-muted-foreground text-sm">Loading…</p> :
              impNames.length === 0 ? <p className="text-muted-foreground text-sm">No consignments yet.</p> : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Importer</TableHead>
                  <TableHead className="text-right">Consignments</TableHead>
                  <TableHead className="text-right">Landed ₹</TableHead>
                  <TableHead className="text-right">Commission ₹</TableHead>
                  <TableHead className="text-right">Billed to MGIPL ₹</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {impNames.map(name => (
                    <TableRow key={name}>
                      <TableCell className="font-medium">{name}</TableCell>
                      <TableCell className="text-right">{byImp[name].consignments}</TableCell>
                      <TableCell className="text-right">{fmt(byImp[name].landed)}</TableCell>
                      <TableCell className="text-right text-amber-500">{fmt(byImp[name].commission)}</TableCell>
                      <TableCell className="text-right font-semibold text-emerald-500">{fmt(byImp[name].billed)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* All consignments */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div><CardTitle>All Consignments</CardTitle>
              <CardDescription>Line-by-line reconciliation across every importer.</CardDescription></div>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All importers</SelectItem>
                {impNames.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            {loading ? <p className="text-muted-foreground text-sm">Loading…</p> :
              rows.length === 0 ? <p className="text-muted-foreground text-sm">No consignments.</p> : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Consignment</TableHead><TableHead>Importer</TableHead><TableHead>Date</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead className="text-right">Supplier ₹</TableHead><TableHead className="text-right">Customs ₹</TableHead>
                  <TableHead className="text-right">Shipping ₹</TableHead><TableHead className="text-right">Landed ₹</TableHead>
                  <TableHead className="text-right">Comm.</TableHead><TableHead className="text-right">Billed ₹</TableHead>
                  <TableHead>BoE</TableHead><TableHead>Status</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {rows.map(c => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-xs">{c.consignment_number}</TableCell>
                      <TableCell className="text-xs">{c.importer_name || '—'}</TableCell>
                      <TableCell className="text-xs">{c.date}</TableCell>
                      <TableCell className="text-xs">{c.supplier_name || '—'}</TableCell>
                      <TableCell className="text-right">{fmt(c.supplier_payment_inr)}</TableCell>
                      <TableCell className="text-right">{fmt(c.customs_total)}</TableCell>
                      <TableCell className="text-right">{fmt(c.shipping_charges)}</TableCell>
                      <TableCell className="text-right">{fmt(c.landed_cost)}</TableCell>
                      <TableCell className="text-right text-amber-500">{c.commission_percent}% · {fmt(c.commission_amount)}</TableCell>
                      <TableCell className="text-right font-semibold text-emerald-500">{fmt(c.total_billed)}</TableCell>
                      <TableCell>{(() => { const b = (c.attachments || []).find(a => a.kind === 'boe'); return b
                        ? <a href={b.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-sky-400 hover:underline"><FileText className="w-3.5 h-3.5" />View</a>
                        : <span className="text-xs text-muted-foreground">—</span>; })()}</TableCell>
                      <TableCell><Badge variant="outline" className={c.status === 'draft' ? 'text-amber-400 border-amber-500/30' : 'text-emerald-400 border-emerald-500/30'}>{c.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <tfoot>
                  <TableRow className="border-t-2 font-semibold">
                    <TableCell colSpan={7} className="text-right">Totals ({rows.length})</TableCell>
                    <TableCell className="text-right">{fmt(totals.landed)}</TableCell>
                    <TableCell className="text-right text-amber-500">{fmt(totals.commission)}</TableCell>
                    <TableCell className="text-right text-emerald-500">{fmt(totals.billed)}</TableCell>
                    <TableCell></TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </tfoot>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
