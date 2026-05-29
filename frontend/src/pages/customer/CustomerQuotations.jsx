import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import {
  FileText, Eye, IndianRupee, Calendar, Loader2, RefreshCw,
  CheckCircle, XCircle, Clock, AlertTriangle, ExternalLink
} from 'lucide-react';

// Obsidian Elite — opacity-tint status chips
const STATUS_TONES = {
  draft:     { badge: 'bg-muted text-muted-foreground ring-border',               label: 'Draft',             icon: FileText },
  sent:      { badge: 'bg-sky-400/15 text-sky-400 ring-sky-400/25',               label: 'Pending Review',    icon: Clock },
  viewed:    { badge: 'bg-violet-400/15 text-violet-400 ring-violet-400/25',      label: 'Awaiting Response', icon: Eye },
  approved:  { badge: 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/25',   label: 'Approved',          icon: CheckCircle },
  rejected:  { badge: 'bg-rose-500/15 text-rose-400 ring-rose-500/25',            label: 'Rejected',          icon: XCircle },
  converted: { badge: 'bg-primary/15 text-primary ring-primary/25',               label: 'Order Placed',      icon: CheckCircle },
  expired:   { badge: 'bg-orange-400/15 text-orange-400 ring-orange-400/25',      label: 'Expired',           icon: AlertTriangle },
  cancelled: { badge: 'bg-muted text-muted-foreground ring-border',               label: 'Cancelled',         icon: XCircle },
};

const badgeCls = 'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wide ring-1 whitespace-nowrap';

const STAT_TONES = {
  slate:   'bg-muted/40 border-border',
  orange:  'bg-orange-500/10 border-orange-500/25',
  emerald: 'bg-emerald-500/10 border-emerald-500/25',
  sky:     'bg-sky-400/10 border-sky-400/25',
};

function SummaryTile({ label, value, tone = 'slate', labelColor = 'text-muted-foreground' }) {
  return (
    <div className={`mg-card rounded-lg border p-4 ${STAT_TONES[tone]}`}>
      <p className={`font-mono text-[10px] font-semibold uppercase tracking-wide ${labelColor}`}>{label}</p>
      <p className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

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
  const approvedCount = quotations.filter(q => q.status === 'approved' || q.status === 'converted').length;
  const totalValue = quotations.reduce((sum, q) => sum + (q.grand_total || 0), 0);

  if (loading) {
    return (
      <DashboardLayout title="My Quotations">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  const thCls = 'px-4 py-3 text-left font-mono text-[10px] font-semibold uppercase tracking-[0.05em] text-muted-foreground';

  return (
    <DashboardLayout title="My Quotations">
      <div className="space-y-5">

        {/* Page header */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="mb-1.5 flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded bg-primary/15">
                <FileText className="w-4 h-4 text-primary" />
              </div>
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Quotations
              </span>
              {pendingCount > 0 && (
                <span className={`${badgeCls} bg-orange-400/15 text-orange-400 ring-orange-400/25`}>
                  {pendingCount} need response
                </span>
              )}
            </div>
            <h2 className="text-[26px] font-bold leading-tight tracking-tight text-foreground">My Quotations</h2>
            <p className="mt-1 text-sm text-muted-foreground">View and respond to quotations from MuscleGrid</p>
          </div>
          <button
            onClick={fetchQuotations}
            className="inline-flex items-center gap-2 rounded border border-border bg-card px-3 py-2 text-[13px] font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-accent active:scale-[0.98]"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {/* Summary tiles */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SummaryTile label="Total Quotations" value={quotations.length} tone="slate" />
          <SummaryTile
            label="Pending Response"
            value={pendingCount}
            tone="orange"
            labelColor="text-orange-400/80"
          />
          <SummaryTile
            label="Approved"
            value={approvedCount}
            tone="emerald"
            labelColor="text-emerald-400/80"
          />
          <SummaryTile
            label="Total Value"
            value={formatCurrency(totalValue)}
            tone="sky"
            labelColor="text-sky-400/80"
          />
        </div>

        {/* Quotations table */}
        <div className="mg-card rounded-lg border border-border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="text-[15px] font-semibold tracking-tight text-foreground">All Quotations</h3>
          </div>

          {quotations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                <FileText className="w-7 h-7 text-muted-foreground" />
              </div>
              <p className="text-base font-semibold text-foreground">No quotations yet</p>
              <p className="mt-1 text-sm text-muted-foreground">When you receive quotations from MuscleGrid, they will appear here</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px]">
                <thead>
                  <tr className="border-b border-border bg-muted/20">
                    <th className={thCls}>PI Number</th>
                    <th className={thCls}>Company</th>
                    <th className={thCls}>Date</th>
                    <th className={thCls}>Valid Till</th>
                    <th className={`${thCls} text-right`}>Amount</th>
                    <th className={thCls}>Status</th>
                    <th className={thCls}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {quotations.map((q) => {
                    const cfg = STATUS_TONES[q.status] || STATUS_TONES.draft;
                    const StatusIcon = cfg.icon;
                    const needsAction = ['sent', 'viewed'].includes(q.status);
                    const isExpired = q.validity_date && new Date(q.validity_date) < new Date();

                    return (
                      <tr
                        key={q.id}
                        className={`border-b border-border/50 transition-colors hover:bg-accent/40 ${
                          needsAction ? 'bg-orange-500/5' : ''
                        }`}
                      >
                        <td className="px-4 py-3">
                          <span className="font-mono text-[12px] font-semibold text-foreground">{q.quotation_number}</span>
                        </td>
                        <td className="px-4 py-3 text-[13px] text-muted-foreground">{q.firm_name}</td>
                        <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">{formatDate(q.created_at)}</td>
                        <td className="px-4 py-3 font-mono text-[11px]">
                          <span className={isExpired && needsAction ? 'text-rose-400' : 'text-muted-foreground'}>
                            {formatDate(q.validity_date)}
                            {isExpired && needsAction && (
                              <span className="ml-1 text-[10px] text-rose-400">(Expired)</span>
                            )}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-mono text-[13px] font-semibold text-foreground">{formatCurrency(q.grand_total)}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`${badgeCls} ${cfg.badge}`}>
                            <StatusIcon className="w-3 h-3" />
                            {cfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {q.access_token && (
                            <Link to={`/pi/${q.access_token}`}>
                              <Button
                                size="sm"
                                className={
                                  needsAction
                                    ? 'bg-primary text-primary-foreground hover:opacity-90'
                                    : 'bg-secondary text-secondary-foreground hover:bg-accent border border-border'
                                }
                              >
                                {needsAction ? (
                                  <>
                                    <Eye className="w-3.5 h-3.5 mr-1" />
                                    Review
                                  </>
                                ) : (
                                  <>
                                    <ExternalLink className="w-3.5 h-3.5 mr-1" />
                                    View
                                  </>
                                )}
                              </Button>
                            </Link>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* How it works */}
        <div className="mg-card rounded-lg border border-border bg-card/50 p-5">
          <h3 className="text-[13px] font-semibold text-foreground mb-3">How it works</h3>
          <ul className="space-y-1.5 font-mono text-[11px] text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary text-[9px] font-bold">1</span>
              When you receive a quotation, it will appear here with "Pending Review" status
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary text-[9px] font-bold">2</span>
              Click "Review" to view the full quotation details and pricing
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary text-[9px] font-bold">3</span>
              You can approve or reject the quotation from the detail page
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary text-[9px] font-bold">4</span>
              Once approved, our team will process your order
            </li>
          </ul>
        </div>

      </div>
    </DashboardLayout>
  );
}
