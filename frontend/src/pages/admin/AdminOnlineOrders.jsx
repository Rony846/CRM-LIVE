import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, ShoppingCart, IndianRupee, Truck, Package, ChevronDown, RefreshCw } from 'lucide-react';

const STATUSES = ['confirmed', 'packed', 'shipped', 'delivered', 'cancelled'];
const fmt = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
const when = (s) => (s ? new Date(s).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

export default function AdminOnlineOrders() {
  const { token } = useAuth();
  const [data, setData] = useState({ orders: [], summary: {} });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [open, setOpen] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/admin/online-orders${filter ? `?status=${filter}` : ''}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setData(res.data);
    } catch (e) {
      toast.error('Failed to load online orders');
    } finally {
      setLoading(false);
    }
  }, [token, filter]);

  useEffect(() => { load(); }, [load]);

  const setStatus = async (oid, status) => {
    try {
      await axios.patch(`${API}/admin/online-orders/${oid}`, { status }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success(`Marked ${status}`);
      load();
    } catch (e) {
      toast.error('Update failed');
    }
  };

  const markCodCollected = async (oid) => {
    try {
      await axios.patch(`${API}/admin/online-orders/${oid}`, { payment_status: 'paid' }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('COD marked collected');
      load();
    } catch (e) { toast.error('Update failed'); }
  };

  const s = data.summary || {};
  const payBadge = (o) => {
    if (o.payment_status === 'paid') return <Badge className="bg-green-600">Paid · online</Badge>;
    if (o.payment_status === 'cod_pending') return <Badge className="bg-amber-600">COD pending</Badge>;
    return <Badge className="bg-slate-600">{o.payment_status}</Badge>;
  };

  return (
    <DashboardLayout title="Online Orders">
      <div className="mb-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-white">Online Orders</h2>
          <p className="text-sm text-slate-400">Orders placed on the storefront (musclegrid.in)</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 text-cyan-400 border border-cyan-700 rounded px-3 py-1.5 text-sm hover:bg-cyan-600/20">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Orders', val: s.count || 0, icon: ShoppingCart, c: 'text-cyan-400' },
          { label: 'To fulfil', val: s.to_fulfil || 0, icon: Package, c: 'text-amber-400' },
          { label: 'Paid revenue', val: fmt(s.revenue_paid), icon: IndianRupee, c: 'text-green-400' },
          { label: 'COD pending', val: fmt(s.cod_pending_value), icon: Truck, c: 'text-orange-400' },
        ].map((k) => (
          <Card key={k.label} className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-slate-400 text-xs"><k.icon className={`w-4 h-4 ${k.c}`} />{k.label}</div>
              <div className={`text-xl font-bold mt-1 ${k.c}`}>{k.val}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex gap-2 mb-3 flex-wrap">
        <button onClick={() => setFilter('')} className={`px-3 py-1 rounded text-sm ${!filter ? 'bg-cyan-600 text-white' : 'bg-slate-700 text-slate-300'}`}>All</button>
        {STATUSES.map((st) => (
          <button key={st} onClick={() => setFilter(st)} className={`px-3 py-1 rounded text-sm capitalize ${filter === st ? 'bg-cyan-600 text-white' : 'bg-slate-700 text-slate-300'}`}>{st}</button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-cyan-400" /></div>
      ) : data.orders.length === 0 ? (
        <Card className="bg-slate-800 border-slate-700"><CardContent className="p-12 text-center text-slate-400">No online orders yet.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {data.orders.map((o) => (
            <Card key={o.id} className="bg-slate-800 border-slate-700">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 flex-wrap cursor-pointer" onClick={() => setOpen(open === o.id ? null : o.id)}>
                  <ChevronDown className={`w-4 h-4 text-slate-500 transition ${open === o.id ? 'rotate-180' : ''}`} />
                  <span className="font-mono font-bold text-white">{o.order_number}</span>
                  <span className="text-slate-400 text-sm">{when(o.created_at)}</span>
                  <span className="text-white">{o.customer_name}</span>
                  <span className="text-slate-400 text-sm">{o.customer_phone}</span>
                  <span className="text-slate-400 text-sm">· {(o.items || []).length} item(s)</span>
                  <span className="flex-1" />
                  {payBadge(o)}
                  <Badge className="bg-slate-700 capitalize">{o.status}</Badge>
                  <span className="font-bold text-green-400">{fmt(o.total)}</span>
                </div>

                {open === o.id && (
                  <div className="mt-4 pt-4 border-t border-slate-700 grid md:grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-slate-500 mb-1">ITEMS</div>
                      {(o.items || []).map((it, i) => (
                        <div key={i} className="text-sm text-slate-300 flex justify-between py-0.5">
                          <span>{it.quantity}× {it.title}</span><span>{fmt(it.line_total)}</span>
                        </div>
                      ))}
                      <div className="text-xs text-slate-500 mt-3 mb-1">SHIP TO</div>
                      <div className="text-sm text-slate-300">
                        {o.shipping?.name} · {o.shipping?.phone}<br />
                        {o.shipping?.address}, {o.shipping?.city} {o.shipping?.pincode}
                      </div>
                      {o.customer_email && <div className="text-sm text-slate-400 mt-1">{o.customer_email}</div>}
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 mb-2">UPDATE STATUS</div>
                      <div className="flex flex-wrap gap-2">
                        {STATUSES.map((st) => (
                          <button key={st} onClick={() => setStatus(o.id, st)}
                            className={`px-3 py-1.5 rounded text-sm capitalize ${o.status === st ? 'bg-cyan-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>{st}</button>
                        ))}
                      </div>
                      {o.payment_status === 'cod_pending' && (
                        <button onClick={() => markCodCollected(o.id)} className="mt-3 px-3 py-1.5 rounded text-sm bg-green-700 text-white hover:bg-green-600">Mark COD collected</button>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
