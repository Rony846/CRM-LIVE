import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  IndianRupee, Wallet, ArrowUpRight, ArrowDownRight, Loader2, Search,
  FileText, Calendar, Building2, Shield, CheckCircle, Clock, AlertTriangle
} from 'lucide-react';

export default function DealerLedger() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (token) {
      fetchLedger();
    }
  }, [token]);

  const fetchLedger = async () => {
    try {
      const response = await axios.get(`${API}/dealer/ledger`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(response.data);
    } catch (error) {
      toast.error('Failed to load ledger');
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
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const filteredEntries = (data?.ledger_entries || []).filter(entry => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (entry.description || '').toLowerCase().includes(term) ||
      (entry.reference || '').toLowerCase().includes(term) ||
      (entry.type || '').toLowerCase().includes(term)
    );
  });

  if (loading) {
    return (
      <DashboardLayout title="Dealer Ledger">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
        </div>
      </DashboardLayout>
    );
  }

  const deposit = data?.security_deposit || {};
  const currentBalance = data?.current_balance || 0;

  return (
    <DashboardLayout title="Dealer Ledger">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white">Account Ledger</h1>
          <p className="text-slate-400">View your payment history and outstanding balance</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Current Balance */}
          <Card className={`border-2 ${currentBalance > 0 ? 'bg-red-900/20 border-red-600' : currentBalance < 0 ? 'bg-green-900/20 border-green-600' : 'bg-slate-800 border-slate-700'}`}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <Wallet className={`w-8 h-8 ${currentBalance > 0 ? 'text-red-400' : 'text-green-400'}`} />
                <Badge className={currentBalance > 0 ? 'bg-red-600' : 'bg-green-600'}>
                  {currentBalance > 0 ? 'Outstanding' : currentBalance < 0 ? 'Credit' : 'Clear'}
                </Badge>
              </div>
              <p className="text-slate-400 text-sm">Current Balance</p>
              <p className={`text-3xl font-bold ${currentBalance > 0 ? 'text-red-400' : 'text-green-400'}`}>
                {formatCurrency(Math.abs(currentBalance))}
              </p>
              {currentBalance > 0 && (
                <p className="text-red-300 text-sm mt-2">Amount to be paid</p>
              )}
            </CardContent>
          </Card>

          {/* Security Deposit */}
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <Shield className="w-8 h-8 text-cyan-400" />
                <Badge className={
                  deposit.status === 'approved' ? 'bg-green-600' :
                  deposit.status === 'pending_review' ? 'bg-yellow-600' :
                  deposit.status === 'rejected' ? 'bg-red-600' :
                  'bg-slate-600'
                }>
                  {deposit.status === 'approved' && <CheckCircle className="w-3 h-3 mr-1" />}
                  {deposit.status === 'pending_review' && <Clock className="w-3 h-3 mr-1" />}
                  {deposit.status === 'rejected' && <AlertTriangle className="w-3 h-3 mr-1" />}
                  {deposit.status || 'Not Paid'}
                </Badge>
              </div>
              <p className="text-slate-400 text-sm">Security Deposit</p>
              <p className="text-3xl font-bold text-white">{formatCurrency(deposit.amount)}</p>
              {deposit.paid_at && (
                <p className="text-slate-400 text-sm mt-2">Paid on {formatDate(deposit.paid_at)}</p>
              )}
            </CardContent>
          </Card>

          {/* Total Transactions */}
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <FileText className="w-8 h-8 text-purple-400" />
              </div>
              <p className="text-slate-400 text-sm">Total Transactions</p>
              <p className="text-3xl font-bold text-white">{data?.ledger_entries?.length || 0}</p>
              <p className="text-slate-400 text-sm mt-2">In ledger history</p>
            </CardContent>
          </Card>
        </div>

        {/* Ledger Entries */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <CardTitle className="text-white">Ledger History</CardTitle>
              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search transactions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 bg-slate-900 border-slate-700"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredEntries.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400">No transactions found</p>
                <p className="text-slate-500 text-sm">Ledger entries will appear here once you have transactions</p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Header Row */}
                <div className="hidden md:grid grid-cols-5 gap-4 px-4 py-2 bg-slate-900 rounded-lg text-slate-400 text-sm font-medium">
                  <div>Date</div>
                  <div className="col-span-2">Description</div>
                  <div className="text-right">Amount</div>
                  <div className="text-right">Balance</div>
                </div>
                
                {filteredEntries.map((entry, idx) => {
                  const isDebit = entry.type === 'debit' || entry.debit > 0;
                  const amount = entry.debit || entry.credit || entry.amount || 0;
                  
                  return (
                    <div 
                      key={entry.id || idx} 
                      className="grid grid-cols-1 md:grid-cols-5 gap-2 md:gap-4 p-4 bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-slate-500 md:hidden" />
                        <span className="text-slate-300">{formatDate(entry.date || entry.created_at)}</span>
                      </div>
                      <div className="col-span-2">
                        <p className="text-white">{entry.description || entry.particulars || 'Transaction'}</p>
                        {entry.reference && (
                          <p className="text-slate-500 text-sm">Ref: {entry.reference}</p>
                        )}
                      </div>
                      <div className="flex items-center justify-end gap-2">
                        {isDebit ? (
                          <ArrowUpRight className="w-4 h-4 text-red-400" />
                        ) : (
                          <ArrowDownRight className="w-4 h-4 text-green-400" />
                        )}
                        <span className={`font-medium ${isDebit ? 'text-red-400' : 'text-green-400'}`}>
                          {isDebit ? '+' : '-'}{formatCurrency(amount)}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-white font-medium">{formatCurrency(entry.balance || 0)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info Note */}
        <Card className="bg-blue-900/20 border-blue-600">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Building2 className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-blue-300 font-medium">About Your Ledger</p>
                <p className="text-blue-200 text-sm mt-1">
                  This ledger shows all your financial transactions with MuscleGrid including orders, payments, 
                  credit notes, and adjustments. For any discrepancies, please contact your account manager.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
