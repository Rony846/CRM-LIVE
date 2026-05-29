import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import StatusBadge from '@/components/ui/StatusBadge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Link } from 'react-router-dom';
import { Shield, Eye, Plus, Loader2, Calendar, Package, Upload, Star, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

// Obsidian status chip helper
const BADGE = 'px-2 py-0.5 text-[10px] font-mono font-semibold rounded uppercase tracking-wide ring-1';
const extStatusTone = (status) => {
  if (status === 'approved') return 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/25';
  if (status === 'rejected') return 'bg-rose-500/15 text-rose-400 ring-rose-500/25';
  return 'bg-amber-400/15 text-amber-400 ring-amber-400/25';
};

export default function MyWarranties() {
  const { token } = useAuth();
  const [warranties, setWarranties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedWarranty, setSelectedWarranty] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [extensionOpen, setExtensionOpen] = useState(false);
  const [extensionFile, setExtensionFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchWarranties();
  }, [token]);

  const fetchWarranties = async () => {
    try {
      const response = await axios.get(`${API}/warranties`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setWarranties(response.data);
    } catch (error) {
      toast.error('Failed to load warranties');
    } finally {
      setLoading(false);
    }
  };

  const viewWarrantyDetails = (warranty) => {
    setSelectedWarranty(warranty);
    setDetailsOpen(true);
  };

  const openExtensionDialog = (warranty) => {
    setSelectedWarranty(warranty);
    setExtensionFile(null);
    setExtensionOpen(true);
  };

  const handleExtensionRequest = async () => {
    if (!extensionFile) {
      toast.error('Please upload your Amazon review screenshot');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('review_file', extensionFile);

      await axios.post(`${API}/warranties/${selectedWarranty.id}/request-extension`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      toast.success('Extension request submitted! Admin will review shortly.');
      setExtensionOpen(false);
      fetchWarranties();
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to submit extension request';
      toast.error(message);
    } finally {
      setUploading(false);
    }
  };

  const isWarrantyActive = (warranty) => {
    if (warranty.status !== 'approved' || !warranty.warranty_end_date) return false;
    return new Date(warranty.warranty_end_date) > new Date();
  };

  const canRequestExtension = (warranty) => {
    return warranty.status === 'approved' && !warranty.extension_requested;
  };

  if (loading) {
    return (
      <DashboardLayout title="My Warranties">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="My Warranties">
      {/* Page header row */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Warranties</h1>
          <p className="mt-1 text-sm text-muted-foreground">View all your registered product warranties</p>
        </div>
        <Link to="/customer/warranty/register">
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90" data-testid="new-warranty-btn">
            <Plus className="w-4 h-4 mr-2" />
            Register New
          </Button>
        </Link>
      </div>

      {/* Extension Promo Banner */}
      <div className="mg-card rounded-lg border border-amber-400/25 bg-amber-400/10 p-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded bg-amber-400/15">
            <Star className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h3 className="font-semibold text-amber-400 text-sm">Get +3 Months Free Warranty!</h3>
            <p className="text-xs text-amber-400/70 mt-0.5">Leave a review on Amazon and upload a screenshot to extend your warranty.</p>
          </div>
        </div>
      </div>

      {/* Warranties table card */}
      <div className="mg-card rounded-lg border border-border bg-card overflow-hidden">
        {warranties.length === 0 ? (
          <div className="text-center py-16">
            <div className="flex h-16 w-16 items-center justify-center rounded bg-muted mx-auto mb-4">
              <Shield className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-base font-semibold text-foreground mb-2">No warranties registered</h3>
            <p className="text-sm text-muted-foreground mb-5">Register your product warranty for protection</p>
            <Link to="/customer/warranty/register">
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Plus className="w-4 h-4 mr-2" />
                Register Warranty
              </Button>
            </Link>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Device Type</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Order ID</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Invoice Date</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Warranty Expires</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Status</TableHead>
                <TableHead className="text-right font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {warranties.map((warranty) => (
                <TableRow key={warranty.id} className="data-row" data-testid={`warranty-row-${warranty.id}`}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium text-foreground">{warranty.device_type}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm text-foreground">{warranty.order_id}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{new Date(warranty.invoice_date).toLocaleDateString()}</TableCell>
                  <TableCell>
                    {warranty.warranty_end_date ? (
                      <div className={`flex items-center gap-1 font-mono text-sm ${isWarrantyActive(warranty) ? 'text-emerald-400' : 'text-rose-400'}`}>
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(warranty.warranty_end_date).toLocaleDateString()}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">Pending approval</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1 items-start">
                      <StatusBadge status={warranty.status} />
                      {warranty.extension_requested && (
                        <span className={`${BADGE} ${extStatusTone(warranty.extension_status)}`}>
                          Ext: {warranty.extension_status || 'pending'}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() => viewWarrantyDetails(warranty)}
                        data-testid={`view-warranty-${warranty.id}`}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        View
                      </Button>
                      {canRequestExtension(warranty) && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-amber-400/25 text-amber-400 hover:bg-amber-400/10"
                          onClick={() => openExtensionDialog(warranty)}
                        >
                          <Star className="w-3.5 h-3.5 mr-1" />
                          +3 Months
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Warranty Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-lg bg-popover border border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <div className="flex h-7 w-7 items-center justify-center rounded bg-primary/15">
                <Shield className="w-4 h-4 text-primary" />
              </div>
              Warranty Details
            </DialogTitle>
          </DialogHeader>

          {selectedWarranty && (
            <div className="space-y-5">
              {/* Status Banner */}
              <div className={`p-4 rounded border ${
                selectedWarranty.status === 'approved' && isWarrantyActive(selectedWarranty)
                  ? 'border-emerald-500/25 bg-emerald-500/10'
                  : selectedWarranty.status === 'pending'
                  ? 'border-amber-400/25 bg-amber-400/10'
                  : 'border-border bg-muted/50'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Status</span>
                  <StatusBadge status={selectedWarranty.status} />
                </div>
                {selectedWarranty.status === 'approved' && selectedWarranty.warranty_end_date && (
                  <div className="mt-2 text-sm font-mono">
                    <span className="text-muted-foreground">Expires: </span>
                    <span className={isWarrantyActive(selectedWarranty) ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                      {new Date(selectedWarranty.warranty_end_date).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Device Type</p>
                  <p className="text-sm font-medium text-foreground">{selectedWarranty.device_type}</p>
                </div>
                <div>
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Order ID</p>
                  <p className="font-mono text-sm text-foreground">{selectedWarranty.order_id}</p>
                </div>
                <div>
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Invoice Date</p>
                  <p className="text-sm font-medium text-foreground">{new Date(selectedWarranty.invoice_date).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Invoice Amount</p>
                  <p className="text-sm font-medium text-foreground font-mono">₹{selectedWarranty.invoice_amount?.toLocaleString()}</p>
                </div>
                <div>
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Registered On</p>
                  <p className="text-sm font-medium text-foreground">{new Date(selectedWarranty.created_at).toLocaleDateString()}</p>
                </div>
              </div>

              {/* Admin Notes */}
              {selectedWarranty.admin_notes && (
                <div className="rounded border border-primary/25 bg-primary/10 p-4">
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-wide text-primary mb-1">Admin Notes</p>
                  <p className="text-sm text-foreground">{selectedWarranty.admin_notes}</p>
                </div>
              )}

              {/* Extension Status */}
              {selectedWarranty.extension_requested && (
                <div className={`p-4 rounded border ${
                  selectedWarranty.extension_status === 'approved'
                    ? 'border-emerald-500/25 bg-emerald-500/10'
                    : selectedWarranty.extension_status === 'rejected'
                    ? 'border-rose-500/25 bg-rose-500/10'
                    : 'border-amber-400/25 bg-amber-400/10'
                }`}>
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Warranty Extension</p>
                  <p className="text-sm text-foreground">
                    Status:{' '}
                    <span className={`font-semibold capitalize ${
                      selectedWarranty.extension_status === 'approved' ? 'text-emerald-400' :
                      selectedWarranty.extension_status === 'rejected' ? 'text-rose-400' :
                      'text-amber-400'
                    }`}>
                      {selectedWarranty.extension_status || 'pending'}
                    </span>
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Extension Request Dialog */}
      <Dialog open={extensionOpen} onOpenChange={setExtensionOpen}>
        <DialogContent className="max-w-md bg-popover border border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <div className="flex h-7 w-7 items-center justify-center rounded bg-amber-400/15">
                <Star className="w-4 h-4 text-amber-400" />
              </div>
              Get +3 Months Warranty
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded border border-amber-400/25 bg-amber-400/10 p-4">
              <h4 className="font-semibold text-amber-400 text-sm mb-2">How it works:</h4>
              <ol className="list-decimal ml-4 text-xs text-amber-400/80 space-y-1">
                <li>Leave a review for your MuscleGrid product on Amazon</li>
                <li>Take a screenshot of your review</li>
                <li>Upload the screenshot below</li>
                <li>Our team will verify and extend your warranty by 3 months!</li>
              </ol>
            </div>

            <div className="space-y-2">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Upload Review Screenshot</p>
              <div className="rounded border-2 border-dashed border-border hover:border-amber-400/40 transition-colors bg-muted/30 p-6 text-center">
                <input
                  id="review_file"
                  type="file"
                  accept=".jpg,.jpeg,.png"
                  onChange={(e) => setExtensionFile(e.target.files[0])}
                  className="hidden"
                />
                <label htmlFor="review_file" className="cursor-pointer">
                  {extensionFile ? (
                    <div className="flex items-center justify-center gap-2 text-emerald-400">
                      <CheckCircle className="w-5 h-5" />
                      <span className="font-medium text-sm">{extensionFile.name}</span>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-7 h-7 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Click to upload screenshot</p>
                      <p className="text-xs text-muted-foreground/60 mt-1">JPG, PNG (max 10MB)</p>
                    </>
                  )}
                </label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setExtensionOpen(false)}>Cancel</Button>
            <Button
              className="bg-amber-400 hover:bg-amber-400/90 text-black"
              onClick={handleExtensionRequest}
              disabled={uploading || !extensionFile}
            >
              {uploading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Star className="w-4 h-4 mr-2" />
              )}
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
