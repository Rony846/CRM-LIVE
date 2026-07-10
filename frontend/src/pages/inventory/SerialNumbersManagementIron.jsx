import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth, API } from '@/App';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Package, Search, AlertTriangle, ArrowLeftRight, Edit2,
  User, Link2, Trash2, AlertCircle, Loader2,
} from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell, badgeStyle } from '@/components/iron/IronKit';
import { CustomerName } from '@/components/Customer360';

const inputStyle = { border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '7px 10px', fontSize: 12.5, color: T.iron900, background: T.white, fontFamily: T.body, outline: 'none', width: '100%' };
const selectStyle = { ...inputStyle, cursor: 'pointer' };

// Serial status -> Iron pill.
const statusPill = (status) => {
  const map = {
    in_stock: ['In Stock', 'ok'],
    dispatched: ['Dispatched', 'info'],
    returned: ['Returned', 'bad'],
  };
  const [label, tone] = map[status] || [(status || 'Unknown'), 'slate'];
  return { label, style: badgeStyle(tone) };
};

export default function SerialNumbersManagement() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [serials, setSerials] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [summary, setSummary] = useState({ total: 0, in_stock: 0, dispatched: 0, returned: 0, alerts_count: 0, unmapped_count: 0 });

  // Filters
  const [selectedSku, setSelectedSku] = useState('');
  const [selectedFirm, setSelectedFirm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showUnmappedOnly, setShowUnmappedOnly] = useState(false);

  // Master data
  const [allSkus, setAllSkus] = useState([]);
  const [manufacturedSkus, setManufacturedSkus] = useState([]);
  const [firms, setFirms] = useState([]);

  // Dialogs
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [mapSkuDialogOpen, setMapSkuDialogOpen] = useState(false);
  const [swapDialogOpen, setSwapDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedSerial, setSelectedSerial] = useState(null);
  const [swapSerial1, setSwapSerial1] = useState(null);
  const [swapSerial2Id, setSwapSerial2Id] = useState('');
  const [dispatchesForSwap, setDispatchesForSwap] = useState([]);

  // Edit/Map form
  const [editForm, setEditForm] = useState({ status: '', notes: '', customer_name: '', phone: '', order_id: '', address: '' });
  const [mapSkuId, setMapSkuId] = useState('');
  const [bulkMapSerials, setBulkMapSerials] = useState([]);

  const headers = { Authorization: `Bearer ${token}` };

  // Fetch all SKUs (not just manufactured)
  const fetchAllSkus = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/master-skus`, { headers });
      const skus = Array.isArray(res.data) ? res.data : res.data.master_skus || [];
      setAllSkus(skus);
      setManufacturedSkus(skus.filter(s => s.product_type === 'manufactured'));
    } catch (err) {
      console.error('Failed to fetch SKUs:', err);
    }
  }, [token]);

  // Fetch firms
  const fetchFirms = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/firms`, { headers });
      setFirms(res.data || []);
    } catch (err) {
      console.error('Failed to fetch firms:', err);
    }
  }, [token]);

  // Fetch serial numbers - now with unmapped filter option
  const fetchSerials = useCallback(async () => {
    setLoading(true);
    try {
      const params = { include_dispatch_info: true };
      if (selectedSku) params.master_sku_id = selectedSku;
      if (selectedFirm) params.firm_id = selectedFirm;
      if (selectedStatus) params.status = selectedStatus;
      if (searchQuery) params.search = searchQuery;
      if (showUnmappedOnly) params.unmapped_only = true;

      const res = await axios.get(`${API}/serial-numbers/management`, { headers, params });
      setSerials(res.data.serials || []);
      setAlerts(res.data.alerts || []);
      setSummary(res.data.summary || { total: 0, in_stock: 0, dispatched: 0, returned: 0, alerts_count: 0, unmapped_count: 0 });
    } catch (err) {
      toast.error('Failed to fetch serial numbers');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [token, selectedSku, selectedFirm, selectedStatus, searchQuery, showUnmappedOnly]);

  useEffect(() => {
    fetchAllSkus();
    fetchFirms();
  }, [fetchAllSkus, fetchFirms]);

  useEffect(() => {
    const debounce = setTimeout(() => { fetchSerials(); }, 300);
    return () => clearTimeout(debounce);
  }, [fetchSerials]);

  // Open edit dialog
  const openEditDialog = (serial) => {
    setSelectedSerial(serial);
    setEditForm({
      status: serial.status || '',
      notes: serial.notes || '',
      customer_name: serial.dispatch_info?.customer_name || serial.customer_name || '',
      phone: serial.dispatch_info?.phone || serial.phone || '',
      order_id: serial.dispatch_info?.order_id || serial.order_id || '',
      address: serial.dispatch_info?.address || serial.address || ''
    });
    setEditDialogOpen(true);
  };

  // Open SKU mapping dialog
  const openMapSkuDialog = (serial) => {
    setSelectedSerial(serial);
    setMapSkuId(serial.master_sku_id || '');
    setMapSkuDialogOpen(true);
  };

  // Open bulk SKU mapping
  const openBulkMapDialog = () => {
    const unmapped = serials.filter(s => !s.master_sku_id);
    setBulkMapSerials(unmapped);
    setMapSkuId('');
    setMapSkuDialogOpen(true);
    setSelectedSerial(null);
  };

  // Open swap dialog
  const openSwapDialog = async (serial) => {
    setSwapSerial1(serial);
    setSwapSerial2Id('');
    try {
      const params = { status: 'dispatched', include_dispatch_info: true };
      if (serial.master_sku_id) params.master_sku_id = serial.master_sku_id;
      if (serial.firm_id) params.firm_id = serial.firm_id;
      const res = await axios.get(`${API}/serial-numbers/management`, { headers, params });
      setDispatchesForSwap((res.data.serials || []).filter(s => s.id !== serial.id));
    } catch (err) {
      toast.error('Failed to fetch serials for swap');
    }
    setSwapDialogOpen(true);
  };

  // Handle edit save
  const handleEditSave = async () => {
    if (!selectedSerial) return;
    try {
      const params = new URLSearchParams();
      if (editForm.status) params.append('status', editForm.status);
      if (editForm.notes !== (selectedSerial.notes || '')) params.append('notes', editForm.notes);
      if (editForm.customer_name !== (selectedSerial.dispatch_info?.customer_name || selectedSerial.customer_name || '')) {
        params.append('customer_name', editForm.customer_name);
      }
      if (editForm.phone !== (selectedSerial.dispatch_info?.phone || selectedSerial.phone || '')) {
        params.append('phone', editForm.phone);
      }
      if (editForm.order_id !== (selectedSerial.dispatch_info?.order_id || selectedSerial.order_id || '')) {
        params.append('order_id', editForm.order_id);
      }
      if (editForm.address !== (selectedSerial.dispatch_info?.address || selectedSerial.address || '')) {
        params.append('address', editForm.address);
      }
      await axios.put(`${API}/serial-numbers/${selectedSerial.id}/update?${params.toString()}`, {}, { headers });
      toast.success('Serial number updated');
      setEditDialogOpen(false);
      fetchSerials();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update');
    }
  };

  // Handle SKU mapping
  const handleMapSku = async () => {
    if (!mapSkuId) {
      toast.error('Please select a SKU');
      return;
    }
    try {
      if (selectedSerial) {
        // Single serial mapping
        await axios.put(`${API}/serial-numbers/${selectedSerial.id}/map-sku?master_sku_id=${mapSkuId}`, {}, { headers });
        toast.success('SKU mapped successfully');
      } else {
        // Bulk mapping
        const ids = bulkMapSerials.map(s => s.id);
        await axios.post(`${API}/serial-numbers/bulk-map-sku`, { serial_ids: ids, master_sku_id: mapSkuId }, { headers });
        toast.success(`${ids.length} serials mapped to SKU`);
      }
      setMapSkuDialogOpen(false);
      fetchSerials();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to map SKU');
    }
  };

  // Handle swap
  const handleSwap = async () => {
    if (!swapSerial1 || !swapSerial2Id) {
      toast.error('Please select a serial number to swap with');
      return;
    }
    try {
      await axios.post(`${API}/serial-numbers/swap?serial_id_1=${swapSerial1.id}&serial_id_2=${swapSerial2Id}`, {}, { headers });
      toast.success('Serial numbers swapped successfully');
      setSwapDialogOpen(false);
      fetchSerials();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to swap');
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!selectedSerial) return;
    try {
      await axios.delete(`${API}/serial-numbers/${selectedSerial.id}`, { headers });
      toast.success('Serial number deleted');
      setDeleteDialogOpen(false);
      fetchSerials();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const selectedSkuInfo = manufacturedSkus.find(s => s.id === selectedSku);
  const unmappedCount = serials.filter(s => !s.master_sku_id).length;

  const statCards = [
    { label: 'Total', value: summary.total, tone: T.iron900 },
    { label: 'In Stock', value: summary.in_stock, tone: T.green },
    { label: 'Dispatched', value: summary.dispatched, tone: T.blue },
    { label: 'Returned', value: summary.returned, tone: T.orange },
    { label: 'No SKU', value: summary.unmapped_count, tone: summary.unmapped_count > 0 ? T.orangeDeep : T.iron400 },
    { label: 'Alerts', value: summary.alerts_count, tone: summary.alerts_count > 0 ? T.voltageText : T.iron400 },
  ];

  const tableHeaders = ['#', 'SERIAL NUMBER', 'SKU', 'STATUS', 'CUSTOMER', 'PHONE', 'ORDER ID', 'DATE', ''];

  const rowActionStyle = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, border: `1px solid ${T.iron200}`, background: T.white, borderRadius: 6, cursor: 'pointer', color: T.iron700 };

  return (
    <IronShell
      title="Serial Numbers"
      subtitle={`${(summary.total || 0).toLocaleString('en-IN')} UNITS · MAP · EDIT · SWAP`}
      onRefresh={fetchSerials}
    >
      {/* Filters Row */}
      <IronCard style={{ marginBottom: 16 }} pad={14}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1.2fr 1fr 1.4fr auto', gap: 10, alignItems: 'end' }}>
          <div>
            <Caps size={8.5} style={{ display: 'block', marginBottom: 5 }}>Manufactured SKU</Caps>
            <select value={selectedSku} onChange={(e) => setSelectedSku(e.target.value)} style={selectStyle}>
              <option value="">All SKUs</option>
              {manufacturedSkus.map(sku => (
                <option key={sku.id} value={sku.id}>{sku.sku_code} - {sku.name}</option>
              ))}
            </select>
          </div>
          <div>
            <Caps size={8.5} style={{ display: 'block', marginBottom: 5 }}>Firm</Caps>
            <select value={selectedFirm} onChange={(e) => setSelectedFirm(e.target.value)} style={selectStyle}>
              <option value="">All Firms</option>
              {firms.map(firm => (<option key={firm.id} value={firm.id}>{firm.name}</option>))}
            </select>
          </div>
          <div>
            <Caps size={8.5} style={{ display: 'block', marginBottom: 5 }}>Status</Caps>
            <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)} style={selectStyle}>
              <option value="">All Status</option>
              <option value="in_stock">In Stock</option>
              <option value="dispatched">Dispatched</option>
              <option value="returned">Returned</option>
            </select>
          </div>
          <div>
            <Caps size={8.5} style={{ display: 'block', marginBottom: 5 }}>Search</Caps>
            <div style={{ position: 'relative' }}>
              <Search size={14} color={T.iron400} style={{ position: 'absolute', left: 9, top: 9 }} />
              <input placeholder="Serial, Customer…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                style={{ ...inputStyle, paddingLeft: 30 }} />
            </div>
          </div>
          <div>
            <button
              onClick={() => setShowUnmappedOnly(!showUnmappedOnly)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 6, padding: '8px 14px', cursor: 'pointer',
                fontFamily: T.headline, fontWeight: 700, fontSize: 12,
                border: `1px solid ${T.orange}`,
                background: showUnmappedOnly ? T.orange : T.white,
                color: showUnmappedOnly ? '#fff' : T.orangeDeep,
              }}
            >
              <AlertCircle size={14} /> Unmapped Only
            </button>
          </div>
        </div>
      </IronCard>

      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, marginBottom: 16 }}>
        {statCards.map((s) => (
          <IronCard key={s.label} pad={14}>
            <div style={{ ...mono, fontSize: 26, fontWeight: 700, color: s.tone, lineHeight: 1 }}>{(s.value || 0).toLocaleString('en-IN')}</div>
            <Caps size={9} color={T.iron400} style={{ display: 'block', marginTop: 6 }}>{s.label}</Caps>
          </IronCard>
        ))}
      </div>

      {/* Unmapped SKU Alert Banner */}
      {summary.unmapped_count > 0 && !showUnmappedOnly && (
        <div style={{ marginBottom: 16, padding: '12px 14px', background: '#FDEEE6', border: `1px solid #F6D8BA`, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={18} color={T.orangeDeep} />
            <span style={{ fontSize: 12.5, color: T.iron900 }}>
              <strong>{summary.unmapped_count} serial numbers</strong> are missing SKU mapping. They won't appear in inventory reports.
            </span>
          </div>
          <button onClick={() => setShowUnmappedOnly(true)}
            style={{ border: `1px solid ${T.orange}`, background: T.white, color: T.orangeDeep, borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 12 }}>
            View &amp; Fix
          </button>
        </div>
      )}

      {/* Bulk Map Button for Unmapped */}
      {showUnmappedOnly && unmappedCount > 0 && (
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={openBulkMapDialog}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '8px 14px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 12 }}>
            <Link2 size={14} /> Bulk Map {unmappedCount} Serials to SKU
          </button>
        </div>
      )}

      {/* Main Content */}
      <IronCard pad={0} style={{ overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 14px', borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
          <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron900 }}>
            {selectedSkuInfo ? `${selectedSkuInfo.name}` : 'All Serial Numbers'}
          </div>
          <span style={badgeStyle('info')}>{serials.length} records</span>
        </div>

        {loading ? (
          <div style={{ display: 'grid', placeItems: 'center', height: 260 }}><Loader2 className="animate-spin" size={28} color={T.iron400} /></div>
        ) : serials.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: T.iron400 }}>
            <Package size={44} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
            <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron700 }}>No serial numbers found</div>
            <div style={{ fontSize: 12, marginTop: 3 }}>Try adjusting your filters or search query.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto', maxHeight: '60vh', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                <tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                  {tableHeaders.map((h, i) => <th key={i} style={{ ...thCell, textAlign: i === tableHeaders.length - 1 ? 'right' : 'left' }}><Caps size={8.5}>{h}</Caps></th>)}
                </tr>
              </thead>
              <tbody>{serials.map((serial, idx) => {
                const sp = statusPill(serial.status);
                return (
                  <tr key={serial.id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}`, background: !serial.master_sku_id ? '#FEF6F1' : 'transparent' }}>
                    <td style={{ ...tdCell, ...mono, fontSize: 11, color: T.iron400 }}>{idx + 1}</td>
                    <td style={{ ...tdCell, ...mono, fontWeight: 700, fontSize: 12, color: T.iron900 }}>{serial.serial_number}</td>
                    <td style={tdCell}>
                      {serial.master_sku_id ? (
                        <span style={{ ...mono, fontSize: 12, color: T.green, fontWeight: 600 }}>{serial.sku_code || '-'}</span>
                      ) : (
                        <button onClick={() => openMapSkuDialog(serial)} style={{ ...badgeStyle('bad'), cursor: 'pointer', border: 'none' }}>
                          Map SKU
                        </button>
                      )}
                    </td>
                    <td style={tdCell}><span style={sp.style}>{sp.label}</span></td>
                    <td style={{ ...tdCell, maxWidth: 150 }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <User size={12} color={T.iron400} />
                        <span style={{ fontSize: 12, color: T.iron900, maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><CustomerName name={serial.dispatch_info?.customer_name || serial.customer_name} phone={serial.dispatch_info?.phone || serial.phone} /></span>
                      </div>
                    </td>
                    <td style={{ ...tdCell, ...mono, fontSize: 11.5, color: T.iron700 }}>
                      {serial.dispatch_info?.phone || serial.phone || '-'}
                    </td>
                    <td style={{ ...tdCell, ...mono, fontSize: 11, color: T.iron500, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {serial.dispatch_info?.order_id || serial.order_id || '-'}
                    </td>
                    <td style={{ ...tdCell, ...mono, fontSize: 11, color: T.iron500 }}>
                      {formatDate(serial.dispatch_info?.dispatch_date || serial.dispatch_date)}
                    </td>
                    <td style={{ ...tdCell, textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button onClick={() => openEditDialog(serial)} title="Edit" style={rowActionStyle}><Edit2 size={13} /></button>
                        {!serial.master_sku_id && (
                          <button onClick={() => openMapSkuDialog(serial)} title="Map SKU" style={rowActionStyle}><Link2 size={13} /></button>
                        )}
                        {serial.status === 'dispatched' && serial.master_sku_id && (
                          <button onClick={() => openSwapDialog(serial)} title="Swap" style={rowActionStyle}><ArrowLeftRight size={13} /></button>
                        )}
                        <button onClick={() => { setSelectedSerial(serial); setDeleteDialogOpen(true); }} title="Delete" style={{ ...rowActionStyle, color: T.orangeDeep }}><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        )}
      </IronCard>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="w-5 h-5 text-yellow-600" />
              Edit Serial Number
            </DialogTitle>
            <DialogDescription>
              Serial: <span className="font-mono font-bold">{selectedSerial?.serial_number}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            <div>
              <Label>Status *</Label>
              <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v })}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in_stock">In Stock</SelectItem>
                  <SelectItem value="dispatched">Dispatched</SelectItem>
                  <SelectItem value="returned">Returned</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="border-t pt-4">
              <p className="text-sm font-medium mb-3 flex items-center gap-2">
                <User className="w-4 h-4" />
                Customer Details
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Customer Name</Label>
                  <Input
                    value={editForm.customer_name}
                    onChange={(e) => setEditForm({ ...editForm, customer_name: e.target.value })}
                    placeholder="Customer name"
                    className="mt-1 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">Phone</Label>
                  <Input
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    placeholder="Phone number"
                    className="mt-1 text-sm"
                  />
                </div>
              </div>
            </div>

            <div>
              <Label className="text-xs">Order ID</Label>
              <Input
                value={editForm.order_id}
                onChange={(e) => setEditForm({ ...editForm, order_id: e.target.value })}
                placeholder="Order ID / Invoice number"
                className="mt-1 text-sm"
              />
            </div>

            <div>
              <Label className="text-xs">Address</Label>
              <Input
                value={editForm.address}
                onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                placeholder="Delivery address"
                className="mt-1 text-sm"
              />
            </div>

            <div className="border-t pt-4">
              <Label>Notes</Label>
              <Input value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                placeholder="Add notes (reason for changes, etc.)..." className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleEditSave}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Map SKU Dialog */}
      <Dialog open={mapSkuDialogOpen} onOpenChange={setMapSkuDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="w-5 h-5 text-purple-600" />
              {selectedSerial ? 'Map Serial to SKU' : `Bulk Map ${bulkMapSerials.length} Serials`}
            </DialogTitle>
            <DialogDescription>
              {selectedSerial ? (
                <>Serial: <span className="font-mono font-bold">{selectedSerial.serial_number}</span></>
              ) : (
                <>Map all {bulkMapSerials.length} unmapped serials to a Master SKU</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Select Master SKU *</Label>
              <Select value={mapSkuId} onValueChange={setMapSkuId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select a SKU" />
                </SelectTrigger>
                <SelectContent>
                  {allSkus.map(sku => (
                    <SelectItem key={sku.id} value={sku.id}>
                      {sku.sku_code} - {sku.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {!selectedSerial && bulkMapSerials.length > 0 && (
              <div className="max-h-40 overflow-y-auto p-2 bg-slate-50 rounded text-xs border">
                <p className="text-slate-500 mb-2">Serials to map:</p>
                {bulkMapSerials.slice(0, 10).map(s => (
                  <p key={s.id} className="font-mono">{s.serial_number}</p>
                ))}
                {bulkMapSerials.length > 10 && <p className="text-slate-400">...and {bulkMapSerials.length - 10} more</p>}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMapSkuDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleMapSku}>Map SKU</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Swap Dialog */}
      <Dialog open={swapDialogOpen} onOpenChange={setSwapDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowLeftRight className="w-5 h-5 text-blue-600" />
              Swap Serial Numbers
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg mb-4">
              <p className="text-xs text-blue-700 mb-1">Serial 1:</p>
              <p className="font-mono font-bold">{swapSerial1?.serial_number}</p>
              <p className="text-sm text-slate-600"><CustomerName name={swapSerial1?.dispatch_info?.customer_name || swapSerial1?.customer_name} phone={swapSerial1?.dispatch_info?.phone || swapSerial1?.phone} /></p>
            </div>
            <div className="text-center mb-4">
              <ArrowLeftRight className="w-6 h-6 text-blue-500 mx-auto" />
            </div>
            <div>
              <Label>Select Serial 2 to swap with:</Label>
              <Select value={swapSerial2Id} onValueChange={setSwapSerial2Id}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select a serial" />
                </SelectTrigger>
                <SelectContent>
                  {dispatchesForSwap.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.serial_number} → {s.dispatch_info?.customer_name || s.customer_name || 'Unknown'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSwapDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSwap} disabled={!swapSerial2Id}>Swap</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="w-5 h-5" />
              Delete Serial Number
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete serial <span className="font-mono font-bold">{selectedSerial?.serial_number}</span>?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </IronShell>
  );
}
