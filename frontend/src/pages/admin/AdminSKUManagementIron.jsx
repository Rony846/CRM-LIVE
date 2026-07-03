import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Package, AlertTriangle, Plus, Loader2, Edit2,
  TrendingUp, TrendingDown, Boxes
} from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell, badgeStyle } from '@/components/iron/IronKit';

const CATEGORIES = ['Inverter', 'Battery', 'Stabilizer', 'Spare Part', 'Accessory'];

const inputStyle = { border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '7px 10px', fontSize: 12.5, color: T.iron900, background: T.white, fontFamily: T.body, outline: 'none' };
const primaryBtn = { border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };

export default function AdminSKUManagement() {
  const { token } = useAuth();
  const [skus, setSkus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [selectedSku, setSelectedSku] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Form states
  const [newSku, setNewSku] = useState({
    sku_code: '',
    model_name: '',
    category: '',
    stock_quantity: 0,
    min_stock_alert: 5
  });

  const [editData, setEditData] = useState({
    model_name: '',
    category: '',
    min_stock_alert: 5,
    active: true
  });

  const [adjustData, setAdjustData] = useState({
    adjustment: 0,
    reason: ''
  });

  useEffect(() => {
    fetchSKUs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const fetchSKUs = async () => {
    try {
      const response = await axios.get(`${API}/admin/skus`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSkus(response.data);
    } catch (error) {
      console.error('Failed to fetch SKUs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSKU = async () => {
    if (!newSku.sku_code || !newSku.model_name || !newSku.category) {
      toast.error('Please fill in all required fields');
      return;
    }

    setActionLoading(true);
    try {
      await axios.post(`${API}/admin/skus`, newSku, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('SKU created successfully');
      setCreateOpen(false);
      setNewSku({ sku_code: '', model_name: '', category: '', stock_quantity: 0, min_stock_alert: 5 });
      fetchSKUs();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create SKU');
    } finally {
      setActionLoading(false);
    }
  };

  const openEditDialog = (sku) => {
    setSelectedSku(sku);
    setEditData({
      model_name: sku.model_name,
      category: sku.category,
      min_stock_alert: sku.min_stock_alert,
      active: sku.active
    });
    setEditOpen(true);
  };

  const handleUpdateSKU = async () => {
    setActionLoading(true);
    try {
      await axios.patch(`${API}/admin/skus/${selectedSku.id}`, editData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('SKU updated successfully');
      setEditOpen(false);
      fetchSKUs();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update SKU');
    } finally {
      setActionLoading(false);
    }
  };

  const openAdjustDialog = (sku) => {
    setSelectedSku(sku);
    setAdjustData({ adjustment: 0, reason: '' });
    setAdjustOpen(true);
  };

  const handleAdjustStock = async () => {
    if (!adjustData.reason) {
      toast.error('Please enter a reason');
      return;
    }
    if (adjustData.adjustment === 0) {
      toast.error('Adjustment cannot be zero');
      return;
    }

    setActionLoading(true);
    try {
      await axios.post(
        `${API}/admin/skus/${selectedSku.id}/adjust-stock?adjustment=${adjustData.adjustment}&reason=${encodeURIComponent(adjustData.reason)}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Stock adjusted successfully');
      setAdjustOpen(false);
      fetchSKUs();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to adjust stock');
    } finally {
      setActionLoading(false);
    }
  };

  // Stats
  const totalSKUs = skus.length;
  const activeSKUs = skus.filter(s => s.active).length;
  const lowStockSKUs = skus.filter(s => s.active && s.stock_quantity <= s.min_stock_alert).length;
  const totalStock = skus.reduce((acc, s) => acc + s.stock_quantity, 0);

  const statCards = [
    { label: 'Total SKUs', value: totalSKUs, icon: Package, tone: T.blue },
    { label: 'Active SKUs', value: activeSKUs, icon: Boxes, tone: T.green },
    { label: 'Low Stock Alert', value: lowStockSKUs, icon: AlertTriangle, tone: T.orange },
    { label: 'Total Stock Units', value: totalStock, icon: TrendingUp, tone: T.blue },
  ];

  const headers = ['SKU CODE', 'MODEL NAME', 'CATEGORY', 'STOCK', 'MIN ALERT', 'STATUS', ''];

  const rowActionStyle = { display: 'inline-flex', alignItems: 'center', gap: 4, border: `1px solid ${T.orange}`, background: T.white, color: T.orangeDeep, borderRadius: 6, padding: '5px 9px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 11 };
  const rowGhostStyle = { display: 'inline-flex', alignItems: 'center', gap: 4, border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, borderRadius: 6, padding: '5px 9px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 11 };

  return (
    <IronShell
      title="SKU Management"
      subtitle={`${totalSKUs.toLocaleString('en-IN')} SKUS · INVENTORY`}
      onRefresh={fetchSKUs}
      headerRight={
        <button onClick={() => setCreateOpen(true)} data-testid="add-sku-btn" style={primaryBtn}>
          <Plus size={14} strokeWidth={2.2} /> Add New SKU
        </button>
      }
    >
      {loading ? (
        <div style={{ display: 'grid', placeItems: 'center', height: 320 }}><Loader2 className="animate-spin" size={30} color={T.iron400} /></div>
      ) : (
        <>
          {/* Stat cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }} data-testid="sku-stats">
            {statCards.map((s) => {
              const Icon = s.icon;
              return (
                <IronCard key={s.label} pad={14}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 8, display: 'grid', placeItems: 'center', background: T.iron50, border: `1px solid ${T.iron200}` }}>
                      <Icon size={18} color={s.tone} strokeWidth={1.9} />
                    </div>
                    <div>
                      <div style={{ ...mono, fontSize: 22, fontWeight: 700, color: T.iron900, lineHeight: 1 }}>{s.value.toLocaleString('en-IN')}</div>
                      <Caps size={9} color={T.iron400} style={{ display: 'block', marginTop: 4 }}>{s.label}</Caps>
                    </div>
                  </div>
                </IronCard>
              );
            })}
          </div>

          {/* SKU Table */}
          <IronCard pad={0} style={{ overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
              <Package size={16} color={T.orange} strokeWidth={2} />
              <span style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 13, color: T.iron900 }}>Product Inventory</span>
            </div>

            {skus.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: T.iron400 }}>
                <Package size={44} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
                <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron700 }}>No SKUs found</div>
                <div style={{ fontSize: 12, marginTop: 3 }}>Add your first product!</div>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                    {headers.map((h, i) => (
                      <th key={i} style={{ ...thCell, textAlign: i === headers.length - 1 ? 'right' : (i >= 3 && i <= 5 ? 'center' : 'left') }}><Caps size={8.5}>{h}</Caps></th>
                    ))}
                  </tr></thead>
                  <tbody>{skus.map((sku) => {
                    const low = sku.active && sku.stock_quantity <= sku.min_stock_alert;
                    return (
                      <tr key={sku.id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}`, opacity: sku.active ? 1 : 0.5, background: low ? '#FDF3EE' : undefined }}>
                        <td style={{ ...tdCell, ...mono, fontWeight: 700, fontSize: 12, color: T.orangeDeep }}>{sku.sku_code}</td>
                        <td style={{ ...tdCell, fontSize: 12.5, color: T.iron900 }}>{sku.model_name}</td>
                        <td style={tdCell}><span style={badgeStyle('slate')}>{sku.category}</span></td>
                        <td style={{ ...tdCell, ...mono, textAlign: 'center', fontWeight: 700, fontSize: 13, color: low ? T.orangeDeep : T.green }}>{sku.stock_quantity}</td>
                        <td style={{ ...tdCell, ...mono, textAlign: 'center', color: T.iron500 }}>{sku.min_stock_alert}</td>
                        <td style={{ ...tdCell, textAlign: 'center' }}>
                          <span style={badgeStyle(sku.active ? 'ok' : 'slate')}>{sku.active ? 'Active' : 'Inactive'}</span>
                        </td>
                        <td style={{ ...tdCell, textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: 6, justifyContent: 'flex-end' }}>
                            <button onClick={() => openAdjustDialog(sku)} data-testid={`adjust-${sku.id}`} style={rowActionStyle}>
                              <TrendingUp size={13} /> Adjust
                            </button>
                            <button onClick={() => openEditDialog(sku)} data-testid={`edit-${sku.id}`} title="Edit" style={rowGhostStyle}>
                              <Edit2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}</tbody>
                </table>
              </div>
            )}
          </IronCard>
        </>
      )}

      {/* Create SKU Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New SKU</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>SKU Code *</Label>
              <Input
                placeholder="e.g., MG-INV-6200"
                value={newSku.sku_code}
                onChange={(e) => setNewSku({ ...newSku, sku_code: e.target.value.toUpperCase() })}
                data-testid="sku-code-input"
              />
            </div>
            <div className="space-y-2">
              <Label>Model Name *</Label>
              <Input
                placeholder="e.g., MuscleGrid 6.2kW Hybrid Inverter"
                value={newSku.model_name}
                onChange={(e) => setNewSku({ ...newSku, model_name: e.target.value })}
                data-testid="model-name-input"
              />
            </div>
            <div className="space-y-2">
              <Label>Category *</Label>
              <Select value={newSku.category} onValueChange={(v) => setNewSku({ ...newSku, category: v })}>
                <SelectTrigger data-testid="category-select">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Initial Stock</Label>
                <Input
                  type="number"
                  value={newSku.stock_quantity}
                  onChange={(e) => setNewSku({ ...newSku, stock_quantity: parseInt(e.target.value) || 0 })}
                  min={0}
                />
              </div>
              <div className="space-y-2">
                <Label>Min Stock Alert</Label>
                <Input
                  type="number"
                  value={newSku.min_stock_alert}
                  onChange={(e) => setNewSku({ ...newSku, min_stock_alert: parseInt(e.target.value) || 5 })}
                  min={0}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              onClick={handleCreateSKU}
              disabled={actionLoading}
              data-testid="create-sku-btn"
            >
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              Create SKU
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit SKU Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit SKU - {selectedSku?.sku_code}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Model Name</Label>
              <Input
                value={editData.model_name}
                onChange={(e) => setEditData({ ...editData, model_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={editData.category} onValueChange={(v) => setEditData({ ...editData, category: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Min Stock Alert</Label>
              <Input
                type="number"
                value={editData.min_stock_alert}
                onChange={(e) => setEditData({ ...editData, min_stock_alert: parseInt(e.target.value) || 5 })}
                min={0}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="active"
                checked={editData.active}
                onChange={(e) => setEditData({ ...editData, active: e.target.checked })}
                className="w-4 h-4"
              />
              <Label htmlFor="active">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              onClick={handleUpdateSKU}
              disabled={actionLoading}
            >
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adjust Stock Dialog */}
      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Stock - {selectedSku?.sku_code}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-slate-50 p-4 rounded-lg">
              <p className="text-sm text-slate-500">Current Stock</p>
              <p className="text-3xl font-bold">{selectedSku?.stock_quantity}</p>
            </div>
            <div className="space-y-2">
              <Label>Adjustment (+/-)</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAdjustData({ ...adjustData, adjustment: adjustData.adjustment - 1 })}
                >
                  <TrendingDown className="w-4 h-4" />
                </Button>
                <Input
                  type="number"
                  value={adjustData.adjustment}
                  onChange={(e) => setAdjustData({ ...adjustData, adjustment: parseInt(e.target.value) || 0 })}
                  className="text-center font-mono text-lg"
                  data-testid="adjustment-input"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAdjustData({ ...adjustData, adjustment: adjustData.adjustment + 1 })}
                >
                  <TrendingUp className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-sm text-slate-500 text-center">
                New stock: {(selectedSku?.stock_quantity || 0) + adjustData.adjustment}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Reason *</Label>
              <Input
                placeholder="e.g., Received new shipment, Damaged unit"
                value={adjustData.reason}
                onChange={(e) => setAdjustData({ ...adjustData, reason: e.target.value })}
                data-testid="reason-input"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustOpen(false)}>Cancel</Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              onClick={handleAdjustStock}
              disabled={actionLoading || !adjustData.reason || adjustData.adjustment === 0}
              data-testid="confirm-adjust-btn"
            >
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Confirm Adjustment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </IronShell>
  );
}
