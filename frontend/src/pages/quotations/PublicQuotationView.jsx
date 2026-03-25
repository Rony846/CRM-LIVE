import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  FileText, Building2, User, CheckCircle, XCircle, Loader2,
  Phone, Mail, MapPin, Calendar, Clock, AlertTriangle,
  IndianRupee, Package
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL || '';

export default function PublicQuotationView() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [quotation, setQuotation] = useState(null);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    if (token) {
      fetchQuotation();
    }
  }, [token]);

  const fetchQuotation = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/api/pi/view/${token}`);
      setQuotation(response.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load quotation');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    setActionLoading(true);
    try {
      await axios.post(`${API}/api/pi/approve/${token}`);
      toast.success('Quotation Approved!');
      fetchQuotation();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to approve');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    setActionLoading(true);
    try {
      await axios.post(`${API}/api/pi/reject/${token}`, null, {
        params: { reason: rejectReason }
      });
      toast.success('Quotation Rejected');
      setRejectDialogOpen(false);
      fetchQuotation();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to reject');
    } finally {
      setActionLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <Card className="bg-slate-800 border-slate-700 max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Quotation Not Found</h2>
            <p className="text-slate-400">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isExpired = quotation.status === 'expired' || 
    (quotation.validity_date && new Date(quotation.validity_date) < new Date());
  const canAct = ['sent', 'viewed'].includes(quotation.status) && !isExpired;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-slate-800 px-4 py-2 rounded-full mb-4">
            <FileText className="w-5 h-5 text-cyan-400" />
            <span className="text-white font-semibold">Proforma Invoice</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">{quotation.quotation_number}</h1>
          
          {/* Status Badge */}
          <div className="mt-4">
            {quotation.status === 'approved' && (
              <Badge className="bg-green-600 text-white text-lg px-4 py-2">
                <CheckCircle className="w-5 h-5 mr-2" />
                Approved
              </Badge>
            )}
            {quotation.status === 'rejected' && (
              <Badge className="bg-red-600 text-white text-lg px-4 py-2">
                <XCircle className="w-5 h-5 mr-2" />
                Rejected
              </Badge>
            )}
            {quotation.status === 'expired' && (
              <Badge className="bg-orange-600 text-white text-lg px-4 py-2">
                <Clock className="w-5 h-5 mr-2" />
                Expired
              </Badge>
            )}
            {quotation.status === 'converted' && (
              <Badge className="bg-cyan-600 text-white text-lg px-4 py-2">
                <CheckCircle className="w-5 h-5 mr-2" />
                Order Confirmed
              </Badge>
            )}
            {isExpired && quotation.status !== 'expired' && (
              <Badge className="bg-orange-600 text-white text-lg px-4 py-2">
                <Clock className="w-5 h-5 mr-2" />
                Validity Expired
              </Badge>
            )}
          </div>
        </div>

        {/* Firm & Customer Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* From (Firm) */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-cyan-400" />
                From
              </CardTitle>
            </CardHeader>
            <CardContent className="text-slate-300">
              <p className="font-semibold text-white text-lg">{quotation.firm_name}</p>
              {quotation.firm_gstin && (
                <p className="text-sm font-mono mt-1">GSTIN: {quotation.firm_gstin}</p>
              )}
              {quotation.firm_address && <p className="mt-2">{quotation.firm_address}</p>}
            </CardContent>
          </Card>

          {/* To (Customer) */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <User className="w-5 h-5 text-cyan-400" />
                To
              </CardTitle>
            </CardHeader>
            <CardContent className="text-slate-300">
              <p className="font-semibold text-white text-lg">{quotation.customer_name}</p>
              {quotation.customer_phone && (
                <p className="flex items-center gap-2 mt-2">
                  <Phone className="w-4 h-4" />
                  {quotation.customer_phone}
                </p>
              )}
              {quotation.customer_email && (
                <p className="flex items-center gap-2 mt-1">
                  <Mail className="w-4 h-4" />
                  {quotation.customer_email}
                </p>
              )}
              {(quotation.customer_address || quotation.customer_city) && (
                <p className="flex items-start gap-2 mt-1">
                  <MapPin className="w-4 h-4 mt-1 flex-shrink-0" />
                  {[quotation.customer_address, quotation.customer_city, 
                    quotation.customer_state, quotation.customer_pincode]
                    .filter(Boolean).join(', ')}
                </p>
              )}
              {quotation.customer_gstin && (
                <p className="text-sm font-mono mt-2">GSTIN: {quotation.customer_gstin}</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Validity Info */}
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="py-4">
            <div className="flex flex-wrap justify-between items-center gap-4">
              <div className="flex items-center gap-2 text-slate-300">
                <Calendar className="w-5 h-5 text-cyan-400" />
                <span>Date: {formatDate(quotation.created_at)}</span>
              </div>
              <div className={`flex items-center gap-2 ${isExpired ? 'text-red-400' : 'text-slate-300'}`}>
                <Clock className="w-5 h-5" />
                <span>Valid Till: {formatDate(quotation.validity_date)}</span>
                {isExpired && <span className="text-red-400">(Expired)</span>}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Items */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Package className="w-5 h-5 text-cyan-400" />
              Items
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-700">
                    <TableHead className="text-slate-400">#</TableHead>
                    <TableHead className="text-slate-400">Item</TableHead>
                    <TableHead className="text-slate-400 text-right">Qty</TableHead>
                    <TableHead className="text-slate-400 text-right">Rate</TableHead>
                    <TableHead className="text-slate-400 text-right">GST</TableHead>
                    <TableHead className="text-slate-400 text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quotation.items?.map((item, idx) => (
                    <TableRow key={idx} className="border-slate-700">
                      <TableCell className="text-slate-400">{idx + 1}</TableCell>
                      <TableCell>
                        <p className="text-white">{item.name}</p>
                        {item.hsn_code && <p className="text-slate-500 text-xs">HSN: {item.hsn_code}</p>}
                      </TableCell>
                      <TableCell className="text-right text-white">{item.quantity}</TableCell>
                      <TableCell className="text-right text-white">{formatCurrency(item.rate)}</TableCell>
                      <TableCell className="text-right text-slate-300">{item.gst_rate}%</TableCell>
                      <TableCell className="text-right text-white font-semibold">{formatCurrency(item.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Totals */}
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="py-4">
            <div className="max-w-sm ml-auto space-y-2">
              <div className="flex justify-between text-slate-300">
                <span>Subtotal</span>
                <span>{formatCurrency(quotation.subtotal)}</span>
              </div>
              {quotation.total_discount > 0 && (
                <div className="flex justify-between text-green-400">
                  <span>Discount</span>
                  <span>-{formatCurrency(quotation.total_discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-300">
                <span>Taxable Value</span>
                <span>{formatCurrency(quotation.taxable_value)}</span>
              </div>
              {quotation.is_inter_state ? (
                <div className="flex justify-between text-slate-300">
                  <span>IGST</span>
                  <span>{formatCurrency(quotation.igst)}</span>
                </div>
              ) : (
                <>
                  <div className="flex justify-between text-slate-300">
                    <span>CGST</span>
                    <span>{formatCurrency(quotation.cgst)}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>SGST</span>
                    <span>{formatCurrency(quotation.sgst)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between text-2xl font-bold text-white pt-4 border-t border-slate-700">
                <span>Grand Total</span>
                <span className="text-cyan-400">{formatCurrency(quotation.grand_total)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Terms & Conditions */}
        {quotation.terms_and_conditions && (
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Terms & Conditions</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-slate-300 text-sm whitespace-pre-wrap font-sans">
                {quotation.terms_and_conditions}
              </pre>
            </CardContent>
          </Card>
        )}

        {/* Remarks */}
        {quotation.remarks && (
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Remarks</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-300">{quotation.remarks}</p>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        {canAct && (
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="py-6">
              <div className="text-center space-y-4">
                <p className="text-slate-300">Please review and respond to this quotation</p>
                <div className="flex flex-col sm:flex-row justify-center gap-4">
                  <Button
                    onClick={handleApprove}
                    disabled={actionLoading}
                    className="bg-green-600 hover:bg-green-700 text-lg px-8 py-6"
                    data-testid="approve-btn"
                  >
                    {actionLoading ? (
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle className="w-5 h-5 mr-2" />
                    )}
                    Approve Quotation
                  </Button>
                  <Button
                    onClick={() => setRejectDialogOpen(true)}
                    disabled={actionLoading}
                    variant="outline"
                    className="border-red-600 text-red-400 hover:bg-red-600/20 text-lg px-8 py-6"
                    data-testid="reject-btn"
                  >
                    <XCircle className="w-5 h-5 mr-2" />
                    Reject
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center text-slate-500 text-sm py-4">
          <p>This is a computer-generated quotation.</p>
          <p>For queries, please contact us.</p>
        </div>
      </div>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">Reject Quotation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-slate-300">Are you sure you want to reject this quotation?</p>
            <div>
              <Textarea
                placeholder="Reason for rejection (optional)"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setRejectDialogOpen(false)}
              className="border-slate-600 text-slate-300"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleReject}
              disabled={actionLoading}
              className="bg-red-600 hover:bg-red-700"
            >
              {actionLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <XCircle className="w-4 h-4 mr-2" />
              )}
              Confirm Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
