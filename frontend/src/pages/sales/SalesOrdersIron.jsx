import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { API, useAuth } from '@/App';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Package, ShoppingCart, Wrench, Store, Search, Loader2,
  CheckCircle2, Clock, XCircle, Gavel,
} from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell, badgeStyle } from '@/components/iron/IronKit';

const inputStyle = { border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '7px 10px', fontSize: 12.5, color: T.iron900, background: T.white, fontFamily: T.body, outline: 'none' };
const selectStyle = { ...inputStyle, cursor: 'pointer' };

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount || 0);
};

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return dateStr;
  }
};

// Payment status -> Iron pill tone.
const paymentTone = (status, marketplaceStatus) => {
  if (marketplaceStatus === 'paid_via_marketplace') return ['Paid via Marketplace', 'ok'];
  switch (status) {
    case 'paid': return ['Paid', 'ok'];
    case 'unpaid': return ['Unpaid', 'bad'];
    case 'pending': return ['Pending', 'warn'];
    case 'partial': return ['Partial', 'bad'];
    default: return [status || 'Unknown', 'slate'];
  }
};

// Marketplace source -> Iron pill tone.
const sourceTone = (source) => {
  const map = {
    amazon: 'bad', flipkart: 'warn', website: 'info',
    walkin: 'violet', direct: 'slate', other: 'slate',
  };
  return [(source?.toUpperCase() || 'DIRECT'), map[source] || 'slate'];
};

// Dispatch status -> Iron pill tone.
const dispatchTone = (status) => {
  if (status === 'dispatched') return 'ok';
  if (status === 'ready_for_dispatch') return 'info';
  return 'slate';
};

export default function SalesOrders() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState(null);
  const [firms, setFirms] = useState([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [firmFilter, setFirmFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');

  const headers = { Authorization: `Bearer ${token}` };

  // Legal-flag marking
  const [legalFor, setLegalFor] = useState(null);
  const [legalReason, setLegalReason] = useState('');
  const [legalAmount, setLegalAmount] = useState('');
  const [legalNote, setLegalNote] = useState('');
  const [legalSaving, setLegalSaving] = useState(false);

  const openLegal = (order) => {
    setLegalFor(order);
    setLegalReason(order.legal_reason || '');
    setLegalAmount(order.legal_claim_amount ?? order.total_amount ?? '');
    setLegalNote(order.legal_note || '');
  };

  const submitLegal = async () => {
    if (!legalReason.trim()) { toast.error('Enter a reason'); return; }
    setLegalSaving(true);
    try {
      await axios.post(`${API}/sales-orders/${legalFor.id}/mark-legal`, {
        reason: legalReason.trim(),
        claim_amount: legalAmount === '' ? null : Number(legalAmount),
        note: legalNote.trim() || null,
      }, { headers });
      toast.success('Flagged for legal notice — visible in the Legal Portal');
      setLegalFor(null);
      fetchOrders();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to flag');
    } finally {
      setLegalSaving(false);
    }
  };

  const unmarkLegal = async (order) => {
    try {
      await axios.post(`${API}/sales-orders/${order.id}/unmark-legal`, {}, { headers });
      toast.success('Legal flag removed');
      fetchOrders();
    } catch (e) {
      toast.error('Failed to remove flag');
    }
  };

  const fetchOrders = useCallback(async () => {
    try {
      const params = { limit: 200 };

      // Apply category filter based on active tab
      if (activeTab !== 'all') {
        params.category = activeTab;
      }
      if (firmFilter && firmFilter !== 'all') {
        params.firm_id = firmFilter;
      }
      if (sourceFilter && sourceFilter !== 'all') {
        params.order_source = sourceFilter;
      }
      if (paymentFilter && paymentFilter !== 'all') {
        params.payment_status = paymentFilter;
      }
      if (searchQuery) {
        params.search = searchQuery;
      }

      const res = await axios.get(`${API}/sales-orders`, { headers, params });
      setOrders(res.data.orders || []);
    } catch (error) {
      toast.error('Failed to fetch orders');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, activeTab, firmFilter, sourceFilter, paymentFilter, searchQuery]);

  const fetchStats = async () => {
    try {
      const res = await axios.get(`${API}/sales-orders/stats`, { headers });
      setStats(res.data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const fetchFirms = async () => {
    try {
      const res = await axios.get(`${API}/firms`, { headers });
      setFirms(res.data || []);
    } catch (error) {
      console.error('Failed to fetch firms:', error);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchOrders(), fetchStats(), fetchFirms()]);
      setLoading(false);
    };
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchOrders]);

  useEffect(() => {
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, firmFilter, sourceFilter, paymentFilter]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchOrders();
  };

  const statCards = [
    { label: 'New Orders', value: stats?.by_category?.new_orders || 0, icon: ShoppingCart, tone: T.blue },
    { label: 'Repairs', value: stats?.by_category?.repairs || 0, icon: Wrench, tone: T.orange },
    { label: 'Walk-in', value: stats?.by_category?.walkins || 0, icon: Store, tone: '#6D4AB0' },
    { label: 'Paid', value: stats?.by_payment_status?.paid || 0, icon: CheckCircle2, tone: T.green },
    { label: 'Pending', value: stats?.by_payment_status?.pending || 0, icon: Clock, tone: T.voltageText },
    { label: 'Unpaid', value: stats?.by_payment_status?.unpaid || 0, icon: XCircle, tone: T.orangeDeep },
  ];

  const tabs = [
    { key: 'all', label: 'All Orders', icon: Package },
    { key: 'new_order', label: 'New Orders', icon: ShoppingCart },
    { key: 'repair', label: 'Repairs', icon: Wrench },
    { key: 'walkin', label: 'Walk-in', icon: Store },
  ];

  const sourceStats = [
    ['Amazon', stats?.by_source?.amazon || 0],
    ['Flipkart', stats?.by_source?.flipkart || 0],
    ['Website', stats?.by_source?.website || 0],
    ['Walk-in', stats?.by_source?.walkin || 0],
    ['Direct', stats?.by_source?.direct || 0],
  ];

  const tableHeaders = ['ORDER #', 'DISPATCH #', 'DATE', 'CUSTOMER', 'SOURCE', 'MARKETPLACE ID', 'SKU', 'FIRM', 'AMOUNT', 'PAYMENT', 'STATUS', 'LEGAL'];

  if (loading && orders.length === 0) {
    return (
      <IronShell title="Sales Orders" subtitle="ALL OUTBOUND DISPATCHES">
        <div style={{ display: 'grid', placeItems: 'center', height: 320 }}>
          <Loader2 className="animate-spin" size={30} color={T.iron400} />
        </div>
      </IronShell>
    );
  }

  return (
    <IronShell
      title="Sales Orders"
      subtitle="ALL OUTBOUND DISPATCHES TRACKED AS SALES ORDERS"
      onRefresh={() => { fetchOrders(); fetchStats(); }}
    >
      <div data-testid="sales-orders-page">
        {/* Stat cards */}
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, marginBottom: 16 }}>
            {statCards.map((s) => {
              const Icon = s.icon;
              return (
                <IronCard key={s.label} pad={14}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 8, display: 'grid', placeItems: 'center', background: T.iron50, border: `1px solid ${T.iron200}` }}>
                      <Icon size={18} color={s.tone} strokeWidth={1.9} />
                    </div>
                    <div>
                      <div style={{ ...mono, fontSize: 22, fontWeight: 700, color: T.iron900, lineHeight: 1 }}>{(s.value || 0).toLocaleString('en-IN')}</div>
                      <Caps size={9} color={T.iron400} style={{ display: 'block', marginTop: 4 }}>{s.label}</Caps>
                    </div>
                  </div>
                </IronCard>
              );
            })}
          </div>
        )}

        {/* Source stats */}
        {stats && (
          <IronCard pad={14} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
              <Caps size={9} color={T.iron500}>By Source</Caps>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {sourceStats.map(([label, count]) => {
                  const [, tone] = sourceTone(label.toLowerCase());
                  return (
                    <span key={label} style={badgeStyle(tone)}>{label}: {count}</span>
                  );
                })}
              </div>
            </div>
          </IronCard>
        )}

        {/* Tabs + filters */}
        <IronCard pad={0} style={{ overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 14px', borderBottom: `1px solid ${T.iron200}`, background: T.iron50, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {tabs.map((tb) => {
                const Icon = tb.icon;
                const active = activeTab === tb.key;
                return (
                  <button key={tb.key} data-testid={`${tb.key.replace('_', '-')}-tab`} onClick={() => setActiveTab(tb.key)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${active ? T.orange : T.iron200}`, background: active ? T.orange : T.white, color: active ? '#fff' : T.iron700, borderRadius: 6, padding: '7px 13px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 12 }}>
                    <Icon size={14} strokeWidth={2} />{tb.label}
                  </button>
                );
              })}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <form onSubmit={handleSearch} style={{ position: 'relative' }}>
                <Search size={14} color={T.iron400} style={{ position: 'absolute', left: 9, top: 9 }} />
                <input
                  placeholder="Search order, customer, phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  data-testid="search-input"
                  style={{ ...inputStyle, paddingLeft: 30, width: 230 }}
                />
              </form>
              <select value={firmFilter} onChange={(e) => setFirmFilter(e.target.value)} style={selectStyle}>
                <option value="all">All Firms</option>
                {firms.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
              <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} style={selectStyle}>
                <option value="all">All Sources</option>
                <option value="amazon">Amazon</option>
                <option value="flipkart">Flipkart</option>
                <option value="website">Website</option>
                <option value="walkin">Walk-in</option>
                <option value="direct">Direct</option>
              </select>
              <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)} style={selectStyle}>
                <option value="all">All Payments</option>
                <option value="paid">Paid</option>
                <option value="unpaid">Unpaid</option>
                <option value="pending">Pending</option>
              </select>
            </div>
          </div>

          {/* Orders table */}
          {orders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: T.iron400 }}>
              <Package size={44} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
              <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron700 }}>No orders found</div>
              <div style={{ fontSize: 12, marginTop: 3 }}>Orders are created when dispatches are made</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                  {tableHeaders.map((h, i) => (
                    <th key={i} style={{ ...thCell, textAlign: (h === 'AMOUNT' || h === 'LEGAL') ? 'right' : 'left' }}><Caps size={8.5}>{h}</Caps></th>
                  ))}
                </tr></thead>
                <tbody>{orders.map((order) => {
                  const [payLabel, payTone] = paymentTone(order.payment_status, order.marketplace_payment_status);
                  const [srcLabel, srcTone] = sourceTone(order.order_source);
                  return (
                    <tr key={order.id} data-testid={`order-row-${order.id}`} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                      <td style={{ ...tdCell, ...mono, fontWeight: 700, fontSize: 12, color: T.orangeDeep }}>{order.order_number}</td>
                      <td style={{ ...tdCell, ...mono, fontSize: 11, color: T.iron500 }}>{order.dispatch_number}</td>
                      <td style={{ ...tdCell, ...mono, fontSize: 11, color: T.iron500 }}>{formatDate(order.created_at)}</td>
                      <td style={tdCell}>
                        <div style={{ fontFamily: T.headline, fontWeight: 600, fontSize: 12.5, color: T.iron900 }}>{order.customer_name}</div>
                        <div style={{ ...mono, fontSize: 10.5, color: T.iron500, marginTop: 2 }}>{order.phone}</div>
                      </td>
                      <td style={tdCell}><span style={badgeStyle(srcTone)}>{srcLabel}</span></td>
                      <td style={{ ...tdCell, ...mono, fontSize: 10.5, color: T.iron500, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{order.marketplace_order_id || '-'}</td>
                      <td style={{ ...tdCell, fontSize: 12, color: T.iron900 }}>{order.sku || order.master_sku_name || '-'}</td>
                      <td style={{ ...tdCell, fontSize: 12, color: T.iron500 }}>{order.firm_name || '-'}</td>
                      <td style={{ ...tdCell, ...mono, textAlign: 'right', fontWeight: 700, fontSize: 12, color: T.iron900 }}>{formatCurrency(order.total_amount)}</td>
                      <td style={tdCell}><span style={badgeStyle(payTone)}>{payLabel}</span></td>
                      <td style={tdCell}><span style={badgeStyle(dispatchTone(order.dispatch_status))}>{order.dispatch_status?.replace('_', ' ') || 'pending'}</span></td>
                      <td style={{ ...tdCell, textAlign: 'right' }}>
                        {order.legal_flag ? (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                            <span style={badgeStyle('bad')}>Legal</span>
                            <button title="Remove legal flag" onClick={() => unmarkLegal(order)}
                              style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: T.iron400, display: 'grid', placeItems: 'center', padding: 2 }}>
                              <XCircle size={15} />
                            </button>
                          </div>
                        ) : (
                          <button title="Mark for legal notice" onClick={() => openLegal(order)}
                            style={{ border: `1px solid ${T.iron200}`, background: T.white, cursor: 'pointer', color: T.iron500, borderRadius: 6, padding: '5px 9px', display: 'inline-flex', alignItems: 'center' }}>
                            <Gavel size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
          )}
        </IronCard>
      </div>

      {/* Mark-for-legal dialog */}
      <Dialog open={!!legalFor} onOpenChange={(v) => !v && setLegalFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gavel className="w-5 h-5" /> Mark order for legal notice
            </DialogTitle>
          </DialogHeader>
          {legalFor && (
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                {legalFor.customer_name} · <span className="font-mono">{legalFor.order_number}</span> ·{' '}
                {formatCurrency(legalFor.total_amount)} · {legalFor.phone}
              </p>
              <div>
                <label className="text-xs text-muted-foreground">Reason for legal notice *</label>
                <Input value={legalReason} onChange={(e) => setLegalReason(e.target.value)}
                       placeholder="e.g. Non-payment of dues / Disputed / Goods not returned" />
                <div className="flex flex-wrap gap-1 mt-1">
                  {['Non-payment of dues', 'Disputed amount', 'Goods not returned', 'Cheque bounce', 'Fraud'].map((r) => (
                    <button key={r} type="button" onClick={() => setLegalReason(r)}
                            className="text-[11px] px-2 py-0.5 rounded border border-border text-muted-foreground hover:bg-muted">
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Claim amount (₹)</label>
                <Input type="number" value={legalAmount} onChange={(e) => setLegalAmount(e.target.value)}
                       placeholder="Amount being claimed" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Note for the lawyer (optional)</label>
                <Textarea value={legalNote} onChange={(e) => setLegalNote(e.target.value)} rows={3}
                          placeholder="Any context — history, prior reminders, agreement terms…" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setLegalFor(null)}>Cancel</Button>
            <Button onClick={submitLegal} disabled={legalSaving}>
              {legalSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Flag for legal'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </IronShell>
  );
}
