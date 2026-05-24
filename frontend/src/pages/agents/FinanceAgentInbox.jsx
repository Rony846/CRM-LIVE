import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import {
  Inbox, Upload, Loader2, CheckCircle2, FileSpreadsheet, AlertTriangle,
  Plus, Building2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const KIND_META = {
  bank_statement:        { label: 'Bank statement',         icon: FileSpreadsheet, accept: '.xlsx,.xls,.csv,.pdf' },
  credit_card_statement: { label: 'Credit card statement',  icon: FileSpreadsheet, accept: '.xlsx,.xls,.csv,.pdf' },
  supplier_invoice:      { label: 'Supplier invoice',       icon: FileSpreadsheet, accept: '.pdf,.jpg,.png,.xlsx' },
  other:                 { label: 'Other document',         icon: FileSpreadsheet, accept: '*' },
};

const formatDate = (iso) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
  } catch { return iso; }
};

export default function FinanceAgentInbox() {
  const { token } = useAuth();
  const headers = { Authorization: `Bearer ${token}` };
  const [items, setItems] = useState([]);
  const [counts, setCounts] = useState({ open: 0, resolved: 0 });
  const [filter, setFilter] = useState('open');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newKind, setNewKind] = useState('bank_statement');
  const [newPeriod, setNewPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [newDescription, setNewDescription] = useState('');
  const fileInputRefs = useRef({});

  const fetchInbox = useCallback(async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/finance/data-gaps?status=${filter}`, { headers });
      setItems(r.data?.items || []);
      setCounts(r.data?.counts || { open: 0, resolved: 0 });
    } catch (e) {
      toast.error('Failed to load inbox');
    } finally {
      setLoading(false);
    }
  }, [filter, token]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchInbox(); }, [fetchInbox]);

  const handleUpload = async (gapId, file) => {
    setUploading(gapId);
    try {
      const fd = new FormData();
      fd.append('file', file);
      await axios.post(`${API}/finance/data-gaps/${gapId}/upload`, fd, {
        headers: { ...headers, 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Uploaded — gap resolved');
      await fetchInbox();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Upload failed');
    } finally {
      setUploading(null);
    }
  };

  const handleCreate = async () => {
    if (!newKind || !newPeriod) {
      toast.error('Period is required');
      return;
    }
    try {
      await axios.post(`${API}/finance/data-gaps`, {
        kind: newKind,
        period: newPeriod,
        description: newDescription || `${KIND_META[newKind]?.label} for ${newPeriod}`,
      }, { headers });
      toast.success('Gap opened');
      setCreateOpen(false);
      setNewDescription('');
      await fetchInbox();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to create');
    }
  };

  return (
    <DashboardLayout title="Finance Agent · Data Inbox">
      <div className="space-y-4 max-w-5xl">
        {/* Header */}
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
              <Inbox className="w-5 h-5 text-primary" /> Finance Agent · Data Inbox
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Things the agent needs from you but can't scrape itself — bank statements, supplier
              invoices, anything else outside Amazon Seller Central. Upload the file; the agent
              parses it and books the journal entries on the next pulse.
            </p>
          </div>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" /> Add gap
          </Button>
        </div>

        {/* Filter chips */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={filter === 'open' ? 'default' : 'outline'}
            onClick={() => setFilter('open')}
          >
            Open · {counts.open || 0}
          </Button>
          <Button
            size="sm"
            variant={filter === 'resolved' ? 'default' : 'outline'}
            onClick={() => setFilter('resolved')}
          >
            Resolved · {counts.resolved || 0}
          </Button>
          <Link to="/agents/finance" className="text-xs underline text-muted-foreground hover:text-foreground ml-2">
            ← back to agent
          </Link>
        </div>

        <Card className="mg-card border-border">
          <CardHeader className="border-b border-border bg-muted/30 py-3 px-5">
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Inbox className="w-4 h-4 text-primary" />
              {filter === 'open' ? 'Open gaps' : 'Resolved gaps'}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 flex justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : items.length === 0 ? (
              <div className="p-12 text-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3 opacity-60" />
                <div className="text-sm font-medium text-foreground">
                  {filter === 'open' ? 'No open gaps' : 'Nothing resolved yet'}
                </div>
                <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                  {filter === 'open'
                    ? 'When the agent encounters data it can\'t scrape (e.g. a bank statement Amazon doesn\'t have), it\'ll post a request here.'
                    : 'Resolved gaps will appear here once you upload satisfying files.'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {items.map((g) => {
                  const meta = KIND_META[g.kind] || KIND_META.other;
                  const Icon = meta.icon;
                  return (
                    <div key={g.id} className="px-5 py-4 flex items-start gap-4">
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded bg-primary/15 text-primary">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-sm font-semibold text-foreground">{meta.label}</div>
                          {g.period && (
                            <Badge className="bg-primary/15 text-primary text-[10px] font-mono">{g.period}</Badge>
                          )}
                          {g.requested_by === 'manual' ? (
                            <Badge className="bg-muted text-muted-foreground text-[10px] uppercase font-mono">manual</Badge>
                          ) : (
                            <Badge className="bg-violet-400/15 text-violet-400 text-[10px] uppercase font-mono">
                              <Inbox className="w-3 h-3 mr-1" /> agent request
                            </Badge>
                          )}
                          {g.status === 'resolved' && (
                            <Badge className="bg-emerald-500/15 text-emerald-400 text-[10px] uppercase font-mono">
                              <CheckCircle2 className="w-3 h-3 mr-1" /> resolved
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">{g.description}</div>
                        <div className="text-[10px] font-mono text-muted-foreground mt-1.5">
                          opened {formatDate(g.created_at)}
                          {g.resolved_at && ` · resolved ${formatDate(g.resolved_at)}`}
                          {g.firm_id && ` · ${g.firm_id.slice(0, 8)}`}
                        </div>
                      </div>
                      {g.status === 'open' && (
                        <div className="flex-shrink-0">
                          <input
                            ref={(el) => (fileInputRefs.current[g.id] = el)}
                            type="file"
                            accept={meta.accept}
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleUpload(g.id, f);
                              e.target.value = '';
                            }}
                          />
                          <Button
                            size="sm"
                            onClick={() => fileInputRefs.current[g.id]?.click()}
                            disabled={uploading === g.id}
                          >
                            {uploading === g.id
                              ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Uploading…</>
                              : <><Upload className="w-3.5 h-3.5 mr-1.5" /> Upload</>}
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Phase-2 callout — parsing the uploaded files */}
        <Card className="mg-card border-border">
          <CardContent className="p-4 flex items-start gap-3 text-sm">
            <AlertTriangle className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-foreground">Phase 2: file parsers not yet wired</div>
              <p className="text-muted-foreground mt-1 text-xs">
                Uploaded files are stored and the gap is marked resolved, but the bank-statement →
                journal-entry parser is a separate job. Until then, treat uploads as evidence the
                accountant has the file; manual booking still required.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Create gap dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add data gap</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Kind</label>
              <Select value={newKind} onValueChange={setNewKind}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(KIND_META).map(([k, m]) => (
                    <SelectItem key={k} value={k}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Period</label>
              <Input
                type="month"
                value={newPeriod}
                onChange={(e) => setNewPeriod(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Description (optional)</label>
              <Textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                rows={2}
                placeholder="e.g. HDFC current account statement for May"
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate}>Open gap</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
