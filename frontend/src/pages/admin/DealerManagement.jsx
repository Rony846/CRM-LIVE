import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import {
  Users, FileText, Search, Plus, ChevronLeft, ChevronRight, FilterX,
  Loader2, CheckCircle2, Clock, MoreVertical, TrendingUp,
} from 'lucide-react';

const PAGE_SIZE = 12;

const inr = (n) => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 0,
}).format(Number(n) || 0);
const fmtDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—'
    : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

function StatusChip({ status }) {
  if (status === 'approved' || status === 'active') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#a4d64c]/15 px-2.5 py-0.5 text-[11px] font-medium text-[#a4d64c] ring-1 ring-[#a4d64c]/25">
        <CheckCircle2 className="h-3 w-3" /> Approved
      </span>
    );
  }
  if (status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/15 px-2.5 py-0.5 text-[11px] font-medium text-amber-400 ring-1 ring-amber-400/25">
        <Clock className="h-3 w-3" /> Pending
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-rose-400/15 px-2.5 py-0.5 text-[11px] font-medium text-rose-400 ring-1 ring-rose-400/25 capitalize">
      {status || 'unknown'}
    </span>
  );
}

function StatTile({ label, value, accent, chip }) {
  return (
    <div className="mg-card relative overflow-hidden rounded-lg border border-border bg-card p-5">
      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
      <div className="mt-3 flex items-end justify-between">
        <span className={`text-3xl font-bold tabular-nums tracking-tight ${accent ? 'text-primary' : 'text-foreground'}`}>{value}</span>
        {chip}
      </div>
    </div>
  );
}

export default function DealerManagement() {
  const { token } = useAuth();
  const navigate = useNavigate();

  const [dealers, setDealers] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [regionFilter, setRegionFilter] = useState('all');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([
      axios.get(`${API}/admin/dealers`, { headers }),
      axios.get(`${API}/admin/dealers/summary`, { headers }).catch(() => ({ data: null })),
    ]).then(([d, s]) => {
      setDealers(Array.isArray(d.data) ? d.data : []);
      setSummary(s.data);
    }).catch(() => toast.error('Failed to load dealers'))
      .finally(() => setLoading(false));
  }, [token]);

  const regions = useMemo(
    () => [...new Set(dealers.map((d) => d.state).filter(Boolean))].sort(),
    [dealers]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return dealers.filter((d) => {
      if (statusFilter !== 'all' && d.status !== statusFilter) return false;
      if (regionFilter !== 'all' && d.state !== regionFilter) return false;
      if (q) {
        const hay = `${d.firm_name || ''} ${d.contact_person || ''} ${d.phone || ''} ${d.dealer_code || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [dealers, search, statusFilter, regionFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const start = (page - 1) * PAGE_SIZE;
  const pageRows = filtered.slice(start, start + PAGE_SIZE);
  useEffect(() => { setPage(1); }, [search, statusFilter, regionFilter]);

  const clearFilters = () => { setSearch(''); setStatusFilter('all'); setRegionFilter('all'); };

  return (
    <DashboardLayout title="Dealer Management">
      <div className="p-6 space-y-6" data-testid="dealer-management-page">
        {/* Heading */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dealer Management</h1>
            <p className="text-muted-foreground mt-1">Overview of all authorized distribution partners and pending applications.</p>
          </div>
          <Button onClick={() => navigate('/admin/dealer-applications')} data-testid="add-new-dealer">
            <Plus className="h-4 w-4 mr-1" /> Add New Dealer
          </Button>
        </div>

        {/* Stat tiles */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatTile
            label="Total Active Dealers"
            value={summary?.active_dealers ?? '—'}
            chip={<span className="inline-flex items-center gap-1 text-[11px] text-[#a4d64c]"><TrendingUp className="h-3 w-3" /> active</span>}
          />
          <StatTile
            label="Pending Applications"
            value={summary?.pending_applications ?? '—'}
            chip={<span className="inline-flex items-center gap-1 text-[11px] text-amber-400"><Clock className="h-3 w-3" /> Requires review</span>}
          />
          <StatTile
            label="Gross Dealer Revenue (MTD)"
            value={summary ? inr(summary.gross_revenue_mtd) : '—'}
            accent
            chip={<span className="text-[11px] text-muted-foreground">this month</span>}
          />
        </div>

        {/* Filters + table card */}
        <div className="mg-card rounded-lg border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-2 flex-wrap border-b border-border px-4 py-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search dealers, contacts, code…" value={search}
                onChange={(e) => setSearch(e.target.value)} className="pl-9 w-72" />
            </div>
            <Select value={regionFilter} onValueChange={setRegionFilter}>
              <SelectTrigger className="w-40"><SelectValue placeholder="All Regions" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Regions</SelectItem>
                {regions.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36"><SelectValue placeholder="All Statuses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            {(search || statusFilter !== 'all' || regionFilter !== 'all') && (
              <button onClick={clearFilters} className="ml-auto inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground">
                <FilterX className="h-3.5 w-3.5" /> Clear Filters
              </button>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : pageRows.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No dealers match these filters.</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  {['Firm Name', 'Primary Contact', 'Location', 'Status', 'Ledger Balance', 'Last Order', ''].map((h, i) => (
                    <th key={i} className={`px-5 py-3 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground ${i === 4 ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((d, idx) => (
                  <motion.tr
                    key={d.id}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    transition={{ duration: 0.2, delay: Math.min(idx, 12) * 0.02 }}
                    className="border-b border-border/60 cursor-pointer transition-colors hover:bg-accent/60"
                    onClick={() => navigate(`/admin/dealers/${d.id}`)}
                    data-testid={`dealer-row-${d.id}`}
                  >
                    <td className="px-5 py-4">
                      <p className="font-semibold text-foreground">{d.firm_name || '—'}</p>
                      {d.dealer_code && <p className="font-mono text-[11px] text-muted-foreground">{d.dealer_code}</p>}
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm">{d.contact_person || '—'}</p>
                      <p className="text-xs text-muted-foreground">{d.phone || ''}</p>
                    </td>
                    <td className="px-5 py-4 text-sm text-muted-foreground">
                      {[d.city, d.state].filter(Boolean).join(', ') || '—'}
                    </td>
                    <td className="px-5 py-4"><StatusChip status={d.status} /></td>
                    <td className="px-5 py-4 text-right font-mono text-sm">{inr(d.ledger_balance)}</td>
                    <td className="px-5 py-4 text-sm text-muted-foreground">{fmtDate(d.last_order_date)}</td>
                    <td className="px-3 py-4 text-right">
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/admin/dealers/${d.id}`); }}
                        className="text-muted-foreground hover:text-foreground"
                        aria-label="Open dealer"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          )}

          {!loading && filtered.length > 0 && (
            <div className="flex items-center justify-between border-t border-border px-5 py-3">
              <p className="text-xs text-muted-foreground">
                Showing {start + 1} to {Math.min(start + PAGE_SIZE, filtered.length)} of {filtered.length} entries
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs text-muted-foreground">Page {page} of {totalPages}</span>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
