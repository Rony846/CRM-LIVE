import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  ScrollText, Loader2, Download, Search, Filter, CheckCircle2,
  AlertTriangle, XCircle, History, ExternalLink, RefreshCw, Users,
} from 'lucide-react';

const STATUS_META = {
  current:  { label: 'Current',  tone: 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/25', icon: CheckCircle2 },
  outdated: { label: 'Outdated', tone: 'bg-amber-400/15 text-amber-400 ring-1 ring-amber-400/25',       icon: AlertTriangle },
  never:    { label: 'Never',    tone: 'bg-rose-500/15 text-rose-400 ring-1 ring-rose-500/25',           icon: XCircle },
};

export default function AdminDealerTerms() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [logUser, setLogUser] = useState(null);   // user_id whose log to show
  const [logEntries, setLogEntries] = useState([]);
  const [logLoading, setLogLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const resp = await axios.get(`${API}/admin/dealer-terms/acceptance`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setData(resp.data);
    } catch (err) {
      console.error('Failed to load dealer T&C audit:', err);
      toast.error('Failed to load acceptance audit');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) fetchData();
  }, [token, fetchData]);

  const fetchLog = async (userId) => {
    try {
      setLogLoading(true);
      const resp = await axios.get(`${API}/admin/dealer-terms/log/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setLogEntries(resp.data.log || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load acceptance log');
    } finally {
      setLogLoading(false);
    }
  };

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.rows.filter(r => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (!q) return true;
      return [r.name, r.email, r.phone, r.dealer_code, r.business_name, r.gstin, r.city]
        .some(v => (v || '').toString().toLowerCase().includes(q));
    });
  }, [data, search, statusFilter]);

  const exportCsv = () => {
    if (!data) return;
    const rows = [
      ['Dealer Code', 'Name', 'Business', 'GSTIN', 'Email', 'Phone', 'City', 'State', 'Tier', 'Dealer Status', 'T&C Status', 'Version Accepted', 'Accepted At', 'Accepted IP'],
      ...filtered.map(r => [
        r.dealer_code || '',
        r.name || '',
        r.business_name || '',
        r.gstin || '',
        r.email || '',
        r.phone || '',
        r.city || '',
        r.state || '',
        r.tier || '',
        r.dealer_status || '',
        r.status,
        r.accepted_version || '',
        r.accepted_at || '',
        r.accepted_ip || '',
      ]),
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dealer-tnc-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <DashboardLayout title="Dealer T&C Audit">
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  const pctCurrent = data?.total ? Math.round((data.current / data.total) * 100) : 0;

  return (
    <DashboardLayout title="Dealer T&C Audit">
      <div className="space-y-4">
        {/* Header / KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Card className="mg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-primary/15 text-primary">
                  <ScrollText className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Current Version</div>
                  <div className="text-xl font-semibold text-foreground">v{data?.current_version}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Eff. {data?.effective_date}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="mg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-emerald-500/15 text-emerald-400">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Accepted Current</div>
                  <div className="text-xl font-semibold text-foreground">
                    {data?.current} <span className="text-xs text-muted-foreground">/ {data?.total}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{pctCurrent}% of dealers</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="mg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-amber-400/15 text-amber-400">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Outdated</div>
                  <div className="text-xl font-semibold text-foreground">{data?.outdated}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">On earlier version</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="mg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-rose-500/15 text-rose-400">
                  <XCircle className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Never Accepted</div>
                  <div className="text-xl font-semibold text-foreground">{data?.never}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Action required</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter bar */}
        <Card className="mg-card border-border">
          <CardContent className="p-4 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
            <div className="flex flex-col md:flex-row gap-3 flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search name, email, GSTIN, dealer code…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 bg-background border-border text-foreground"
                />
              </div>
              <div className="flex items-center gap-1">
                <Filter className="w-3.5 h-3.5 text-muted-foreground mr-1" />
                {['all', 'never', 'outdated', 'current'].map(s => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`px-3 py-1.5 text-xs rounded-md transition-colors font-mono uppercase tracking-wide
                      ${statusFilter === s
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/70'}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={fetchData} className="border-border">
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh
              </Button>
              <Button size="sm" variant="outline" onClick={exportCsv} className="border-border">
                <Download className="w-3.5 h-3.5 mr-1.5" /> CSV
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card className="mg-card border-border">
          <CardHeader className="border-b border-border bg-muted/30 py-3 px-5">
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              Dealer Acceptance Status ({filtered.length} of {data?.total})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b border-border">
                <tr>
                  <th className="text-left px-4 py-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Dealer</th>
                  <th className="text-left px-4 py-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Business / GSTIN</th>
                  <th className="text-left px-4 py-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Contact</th>
                  <th className="text-left px-4 py-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Version</th>
                  <th className="text-left px-4 py-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Accepted At · IP</th>
                  <th className="text-right px-4 py-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Audit</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">No dealers match the filter.</td></tr>
                )}
                {filtered.map((r) => {
                  const meta = STATUS_META[r.status] || STATUS_META.never;
                  const Icon = meta.icon;
                  return (
                    <tr key={r.user_id} className="border-b border-border/40 hover:bg-accent/40">
                      <td className="px-4 py-3">
                        <Badge className={`${meta.tone} font-mono uppercase tracking-wide text-[10px]`}>
                          <Icon className="w-3 h-3 mr-1" />
                          {meta.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{r.name || '—'}</div>
                        <div className="text-xs text-muted-foreground font-mono">{r.dealer_code || '—'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-foreground">{r.business_name || '—'}</div>
                        <div className="text-xs text-muted-foreground font-mono">{r.gstin || '—'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs text-foreground">{r.email || '—'}</div>
                        <div className="text-xs text-muted-foreground">{r.phone || '—'} · {r.city || '—'}</div>
                      </td>
                      <td className="px-4 py-3">
                        {r.accepted_version ? (
                          <Badge className="bg-muted text-foreground font-mono text-[10px]">
                            v{r.accepted_version}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {r.accepted_at ? (
                          <>
                            <div className="font-mono text-foreground">{r.accepted_at?.slice(0, 19).replace('T', ' ')}</div>
                            <div className="font-mono text-muted-foreground">{r.accepted_ip || '—'}</div>
                          </>
                        ) : (
                          <span className="text-muted-foreground">Not accepted</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => { setLogUser(r); fetchLog(r.user_id); }}
                          className="text-xs text-primary hover:text-primary/80 inline-flex items-center gap-1"
                        >
                          <History className="w-3.5 h-3.5" /> Log
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      {/* Per-dealer acceptance log modal */}
      <Dialog open={!!logUser} onOpenChange={(o) => !o && setLogUser(null)}>
        <DialogContent className="bg-popover border border-border max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <History className="w-4 h-4 text-primary" />
              Acceptance Log — {logUser?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="text-xs text-muted-foreground mb-2 font-mono">
            {logUser?.email} · {logUser?.dealer_code || 'no dealer code'}
          </div>
          {logLoading ? (
            <div className="py-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></div>
          ) : logEntries.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No acceptance events recorded yet.
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {logEntries.map((e) => (
                <div key={e.id} className="border border-border rounded-md p-3 bg-muted/20">
                  <div className="flex items-center justify-between">
                    <Badge className="bg-primary/15 text-primary ring-1 ring-primary/25 font-mono text-[10px]">
                      v{e.version}
                    </Badge>
                    <span className="text-xs font-mono text-foreground">
                      {e.accepted_at?.slice(0, 19).replace('T', ' ')} UTC
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <div className="text-muted-foreground">IP Address</div>
                      <div className="font-mono text-foreground">{e.ip_address || '—'}</div>
                    </div>
                    <div className="truncate">
                      <div className="text-muted-foreground">User Agent</div>
                      <div className="font-mono text-foreground truncate" title={e.user_agent}>{e.user_agent || '—'}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
