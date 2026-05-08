import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import {
  FileText, Eye, IndianRupee, Calendar, Loader2, RefreshCw,
  CheckCircle, XCircle, Clock, AlertTriangle, ExternalLink
} from 'lucide-react';

const STATUS_CONFIG = {
  draft: { label: 'Draft', color: 'bg-slate-600', icon: FileText },
  sent: { label: 'Pending Review', color: 'bg-blue-600', icon: Clock },
  viewed: { label: 'Awaiting Response', color: 'bg-purple-600', icon: Eye },
  approved: { label: 'Approved', color: 'bg-green-600', icon: CheckCircle },
  rejected: { label: 'Rejected', color: 'bg-red-600', icon: XCircle },
  converted: { label: 'Order Placed', color: 'bg-cyan-600', icon: CheckCircle },
  expired: { label: 'Expired', color: 'bg-orange-600', icon: AlertTriangle },
  cancelled: { label: 'Cancelled', color: 'bg-gray-600', icon: XCircle }
};

export default function CustomerQuotations() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [quotations, setQuotations] = useState([]);

  useEffect(() => {
    fetchQuotations();
  }, [token]);

  const fetchQuotations = async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.get(`${API}/customer/quotations`, { headers });
      setQuotations(res.data || []);
    } catch (error) {
      console.error('Failed to fetch quotations:', error);
      toast.error('Failed to load quotations');
    } finally {
      setLoading(false);
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

  const pendingCount = quotations.filter(q => ['sent', 'viewed'].includes(q.status)).length;

  if (loading) {
    return (
      <DashboardLayout title="My Quotations">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="My Quotations">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <FileText className="w-7 h-7 text-cyan-400" />
              My Quotations
              {pendingCount > 0 && (
                <Badge className="bg-orange-500 text-white ml-2">{pendingCount} need response</Badge>
              )}
            </h1>
            <p className="text-slate-400">View and respond to quotations from MuscleGrid</p>
          </div>
          <Button 
            variant="outline" 
            onClick={fetchQuotations}
            className="border-slate-600 text-slate-300 hover:bg-slate-700"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <p className="text-slate-400 text-sm">Total Quotations</p>
              <p className="text-2xl font-bold text-white">{quotations.length}</p>
            </CardContent>
          </Card>
          <Card className="bg-orange-900/30 border-orange-700">
            <CardContent className="p-4">
              <p className="text-orange-300 text-sm">Pending Response</p>
              <p className="text-2xl font-bold text-white">{pendingCount}</p>
            </CardContent>
          </Card>
          <Card className="bg-green-900/30 border-green-700">
            <CardContent className="p-4">
              <p className="text-green-300 text-sm">Approved</p>
              <p className="text-2xl font-bold text-white">
                {quotations.filter(q => q.status === 'approved' || q.status === 'converted').length}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-cyan-900/30 border-cyan-700">
            <CardContent className="p-4">
              <p className="text-cyan-300 text-sm">Total Value</p>
              <p className="text-2xl font-bold text-white">
                {formatCurrency(quotations.reduce((sum, q) => sum + (q.grand_total || 0), 0))}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quotations List */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">All Quotations</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {quotations.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <FileText className="w-16 h-16 mx-auto mb-4 text-slate-600" />
                <p className="text-lg">No quotations yet</p>
                <p className="text-sm">When you receive quotations from MuscleGrid, they will appear here</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-700">
                    <TableHead className="text-slate-400">PI Number</TableHead>
                    <TableHead className="text-slate-400">Company</TableHead>
                    <TableHead className="text-slate-400">Date</TableHead>
                    <TableHead className="text-slate-400">Valid Till</TableHead>
                    <TableHead className="text-slate-400 text-right">Amount</TableHead>
                    <TableHead className="text-slate-400">Status</TableHead>
                    <TableHead className="text-slate-400">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quotations.map((q) => {
                    const statusConfig = STATUS_CONFIG[q.status] || {};
                    const StatusIcon = statusConfig.icon || FileText;
                    const needsAction = ['sent', 'viewed'].includes(q.status);
                    const isExpired = q.validity_date && new Date(q.validity_date) < new Date();
                    
                    return (
                      <TableRow 
                        key={q.id} 
                        className={`border-slate-700 ${needsAction ? 'bg-orange-900/10' : ''}`}
                      >
                        <TableCell>
                          <span className="font-mono text-white">{q.quotation_number}</span>
                        </TableCell>
                        <TableCell className="text-slate-300">{q.firm_name}</TableCell>
                        <TableCell className="text-slate-300">{formatDate(q.created_at)}</TableCell>
                        <TableCell>
                          <span className={isExpired && needsAction ? 'text-red-400' : 'text-slate-300'}>
                            {formatDate(q.validity_date)}
                            {isExpired && needsAction && (
                              <span className="ml-1 text-xs">(Expired)</span>
                            )}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-white font-semibold">{formatCurrency(q.grand_total)}</span>
                        </TableCell>
                        <TableCell>
                          <Badge className={`${statusConfig.color} text-white`}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {statusConfig.label || q.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {q.access_token && (
                            <Link to={`/pi/${q.access_token}`}>
                              <Button 
                                size="sm" 
                                className={needsAction ? 'bg-cyan-600 hover:bg-cyan-700' : 'bg-slate-600 hover:bg-slate-500'}
                              >
                                {needsAction ? (
                                  <>
                                    <Eye className="w-4 h-4 mr-1" />
                                    Review
                                  </>
                                ) : (
                                  <>
                                    <ExternalLink className="w-4 h-4 mr-1" />
                                    View
                                  </>
                                )}
                              </Button>
                            </Link>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Help Text */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4">
            <h3 className="text-white font-medium mb-2">How it works</h3>
            <ul className="text-slate-400 text-sm space-y-1">
              <li>When you receive a quotation, it will appear here with "Pending Review" status</li>
              <li>Click "Review" to view the full quotation details and pricing</li>
              <li>You can approve or reject the quotation from the detail page</li>
              <li>Once approved, our team will process your order</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
