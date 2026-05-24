import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  IndianRupee, Wallet, ArrowUpRight, ArrowDownRight, Loader2, Search,
  FileText, Calendar, Building2, Shield, CheckCircle, Clock, AlertTriangle
} from 'lucide-react';

// Obsidian badge tones
const BADGE_BASE = 'px-2 py-0.5 text-[10px] font-mono font-semibold rounded uppercase tracking-wide ring-1';

const DepositBadge = ({ status }) => {
  const tones = {
    approved:       'bg-emerald-500/15 text-emerald-400 ring-emerald-500/25',
    pending_review: 'bg-amber-400/15 text-amber-400 ring-amber-400/25',
    rejected:       'bg-rose-500/15 text-rose-400 ring-rose-500/25',
  };
  const tone = tones[status] || 'bg-muted text-muted-foreground ring-border';
  return <span className={`${BADGE_BASE} ${tone}`}>{(status || 'Not Paid').replace(/_/g, ' ')}</span>;
};

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
      (entry.description || entry.narration || '').toLowerCase().includes(term) ||
      (entry.reference || entry.reference_type || '').toLowerCase().includes(term) ||
      (entry.type || entry.entry_type || '').toLowerCase().includes(term)
    );
  });

  if (loading) {
    return (
      <DashboardLayout title="Dealer Ledger">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  const deposit = data?.security_deposit || {};
  const currentBalance = data?.current_balance || 0;

  return (
    <DashboardLayout title="Dealer Ledger">
      <div className="space-y-6">
        {/* Page header */}
        <div>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-1">
            Finance · Account
          </p>
          <h1 className="text-[26px] font-bold leading-tight tracking-tight text-foreground">Account Ledger</h1>
          <p className="mt-1 text-sm text-muted-foreground">View your payment history and outstanding balance</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Current Balance */}
          <div className={`mg-card rounded-lg border bg-card p-5 ${
            currentBalance > 0
              ? 'border-rose-500/30'
              : currentBalance < 0
                ? 'border-emerald-500/30'
                : 'border-border'
          }`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
                  Current Balance
                </p>
                <p className={`mt-1.5 font-mono text-2xl font-bold tabular-nums ${
                  currentBalance > 0 ? 'text-rose-400' : currentBalance < 0 ? 'text-emerald-500' : 'text-foreground'
                }`}>
                  {formatCurrency(Math.abs(currentBalance))}
                </p>
                {currentBalance > 0 && (
                  <p className="mt-1 text-[11px] text-rose-400/70">Amount to be paid</p>
                )}
              </div>
              <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded ${
                currentBalance > 0 ? 'bg-rose-500/15 text-rose-400' : 'bg-emerald-500/15 text-emerald-500'
              }`}>
                <Wallet className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3">
              <span className={`${BADGE_BASE} ${
                currentBalance > 0
                  ? 'bg-rose-500/15 text-rose-400 ring-rose-500/25'
                  : currentBalance < 0
                    ? 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/25'
                    : 'bg-muted text-muted-foreground ring-border'
              }`}>
                {currentBalance > 0 ? 'Outstanding' : currentBalance < 0 ? 'Credit' : 'Clear'}
              </span>
            </div>
          </div>

          {/* Security Deposit */}
          <div className="mg-card rounded-lg border border-border bg-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
                  Security Deposit
                </p>
                <p className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-foreground">
                  {formatCurrency(deposit.amount)}
                </p>
                {deposit.paid_at && (
                  <p className="mt-1 text-[11px] text-muted-foreground">Paid {formatDate(deposit.paid_at)}</p>
                )}
              </div>
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded bg-sky-400/15 text-sky-400">
                <Shield className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              {deposit.status === 'approved' && <CheckCircle className="w-3 h-3 text-emerald-400" />}
              {deposit.status === 'pending_review' && <Clock className="w-3 h-3 text-amber-400" />}
              {deposit.status === 'rejected' && <AlertTriangle className="w-3 h-3 text-rose-400" />}
              <DepositBadge status={deposit.status} />
            </div>
          </div>

          {/* Total Transactions */}
          <div className="mg-card rounded-lg border border-border bg-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
                  Total Transactions
                </p>
                <p className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-foreground">
                  {data?.ledger_entries?.length || 0}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">In ledger history</p>
              </div>
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded bg-violet-400/15 text-violet-400">
                <FileText className="h-5 w-5" />
              </div>
            </div>
          </div>
        </div>

        {/* Ledger Entries */}
        <div className="mg-card rounded-lg border border-border bg-card">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-5 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">Ledger History</h2>
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search transactions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <div className="p-5">
            {filteredEntries.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-foreground font-medium">No transactions found</p>
                <p className="text-muted-foreground text-sm mt-1">Ledger entries will appear here once you have transactions</p>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Header Row */}
                <div className="hidden md:grid grid-cols-5 gap-4 px-4 py-2.5 rounded-md bg-muted/50">
                  <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">Date</div>
                  <div className="col-span-2 font-mono text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">Description</div>
                  <div className="text-right font-mono text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">Amount</div>
                  <div className="text-right font-mono text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">Balance</div>
                </div>

                {filteredEntries.map((entry, idx) => {
                  const isDebit = entry.type === 'debit' || (entry.debit || 0) > 0;
                  const amount = entry.debit || entry.credit || entry.amount || 0;

                  return (
                    <div
                      key={entry.id || idx}
                      className="grid grid-cols-1 md:grid-cols-5 gap-2 md:gap-4 p-4 rounded-md bg-muted/30 hover:bg-muted/60 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-muted-foreground md:hidden" />
                        <span className="font-mono text-[12px] tabular-nums text-muted-foreground">
                          {formatDate(entry.date || entry.created_at)}
                        </span>
                      </div>
                      <div className="col-span-2">
                        <p className="text-sm text-foreground">
                          {entry.description || entry.narration || entry.particulars || 'Transaction'}
                        </p>
                        {(entry.reference || entry.entry_number) && (
                          <p className="font-mono text-[10px] text-muted-foreground mt-0.5">
                            Ref: {entry.reference || entry.entry_number}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center justify-end gap-1.5">
                        {isDebit ? (
                          <ArrowUpRight className="w-3.5 h-3.5 text-rose-400" />
                        ) : (
                          <ArrowDownRight className="w-3.5 h-3.5 text-emerald-500" />
                        )}
                        <span className={`font-mono text-[13px] font-semibold tabular-nums ${isDebit ? 'text-rose-400' : 'text-emerald-500'}`}>
                          {isDebit ? '+' : '-'}{formatCurrency(amount)}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-mono text-[13px] font-semibold tabular-nums text-foreground">
                          {formatCurrency(entry.balance || 0)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Info Note */}
        <div className="mg-card rounded-lg border border-primary/20 bg-primary/5 p-4">
          <div className="flex items-start gap-3">
            <Building2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-foreground">About Your Ledger</p>
              <p className="text-sm text-muted-foreground mt-1">
                This ledger shows all your financial transactions with MuscleGrid including orders, payments,
                credit notes, and adjustments. For any discrepancies, please contact your account manager.
              </p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
