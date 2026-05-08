import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import StatCard from '@/components/dashboard/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter 
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { 
  Package, AlertTriangle, Plus, Loader2, Edit2, Archive, 
  TrendingUp, TrendingDown, Boxes
} from 'lucide-react';

const CATEGORIES = ['Inverter', 'Battery', 'Stabilizer', 'Spare Part', 'Accessory'];

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

  if (loading) {
    return (
      <DashboardLayout title="SKU Management">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="SKU / Inventory Management">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6" data-testid="sku-stats">
        <StatCard title="Total SKUs" value={totalSKUs} icon={Package} />
        <StatCard title="Active SKUs" value={activeSKUs} icon={Boxes} color="green" />
        <StatCard title="Low Stock Alert" value={lowStockSKUs} icon={AlertTriangle} color="red" />
        <StatCard title="Total Stock Units" value={totalStock} icon={TrendingUp} color="blue" />
      </div>

      {/* Add SKU Button */}
      <div className="flex justify-end mb-4">
        <Button 
          className="bg-blue-600 hover:bg-blue-700"
          onClick={() => setCreateOpen(true)}
          data-testid="add-sku-btn"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add New SKU
        </Button>
      </div>

      {/* SKU Table */}
      <Card>
        <CardHeader>
          <CardTitle className="font-['Barlow_Condensed'] flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-600" />
            Product Inventory
          </CardTitle>
        </CardHeader>
        <CardContent>
          {skus.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Package className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p>No SKUs found. Add your first product!</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU Code</TableHead>
                  <TableHead>Model Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-center">Stock</TableHead>
                  <TableHead className="text-center">Min Alert</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {skus.map((sku) => (
                  <TableRow 
                    key={sku.id} 
                    className={`data-row ${!sku.active ? 'opacity-50' : ''} ${
                      sku.active && sku.stock_quantity <= sku.min_stock_alert ? 'bg-red-50' : ''
                    }`}
                  >
                    <TableCell className="font-mono text-sm font-medium">{sku.sku_code}</TableCell>
                    <TableCell>{sku.model_name}</TableCell>
                    <TableCell>
                      <span className="px-2 py-1 bg-slate-100 rounded text-sm">{sku.category}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={`font-mono font-medium ${
                        sku.stock_quantity <= sku.min_stock_alert ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {sku.stock_quantity}
                      </span>
                    </TableCell>
                    <TableCell className="text-center text-slate-500">{sku.min_stock_alert}</TableCell>
                    <TableCell className="text-center">
                      {sku.active ? (
                        <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">Active</span>
                      ) : (
                        <span className="px-2 py-1 bg-slate-100 text-slate-500 rounded text-xs font-medium">Inactive</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => openAdjustDialog(sku)}
                          data-testid={`adjust-${sku.id}`}
                        >
                          <TrendingUp className="w-4 h-4 mr-1" />
                          Adjust
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => openEditDialog(sku)}
                          data-testid={`edit-${sku.id}`}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

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
                onChange={(e) => setNewSku({...newSku, sku_code: e.target.value.toUpperCase()})}
                data-testid="sku-code-input"
              />
            </div>
            <div className="space-y-2">
              <Label>Model Name *</Label>
              <Input 
                placeholder="e.g., MuscleGrid 6.2kW Hybrid Inverter"
                value={newSku.model_name}
                onChange={(e) => setNewSku({...newSku, model_name: e.target.value})}
                data-testid="model-name-input"
              />
            </div>
            <div className="space-y-2">
              <Label>Category *</Label>
              <Select value={newSku.category} onValueChange={(v) => setNewSku({...newSku, category: v})}>
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
                  onChange={(e) => setNewSku({...newSku, stock_quantity: parseInt(e.target.value) || 0})}
                  min={0}
                />
              </div>
              <div className="space-y-2">
                <Label>Min Stock Alert</Label>
                <Input 
                  type="number"
                  value={newSku.min_stock_alert}
                  onChange={(e) => setNewSku({...newSku, min_stock_alert: parseInt(e.target.value) || 5})}
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
                onChange={(e) => setEditData({...editData, model_name: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={editData.category} onValueChange={(v) => setEditData({...editData, category: v})}>
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
                onChange={(e) => setEditData({...editData, min_stock_alert: parseInt(e.target.value) || 5})}
                min={0}
              />
            </div>
            <div className="flex items-center gap-2">
              <input 
                type="checkbox"
                id="active"
                checked={editData.active}
                onChange={(e) => setEditData({...editData, active: e.target.checked})}
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
                  onClick={() => setAdjustData({...adjustData, adjustment: adjustData.adjustment - 1})}
                >
                  <TrendingDown className="w-4 h-4" />
                </Button>
                <Input 
                  type="number"
                  value={adjustData.adjustment}
                  onChange={(e) => setAdjustData({...adjustData, adjustment: parseInt(e.target.value) || 0})}
                  className="text-center font-mono text-lg"
                  data-testid="adjustment-input"
                />
                <Button 
                  type="button"
                  variant="outline"
                  onClick={() => setAdjustData({...adjustData, adjustment: adjustData.adjustment + 1})}
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
                onChange={(e) => setAdjustData({...adjustData, reason: e.target.value})}
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
    </DashboardLayout>
  );
}
