import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { API, useAuth } from '@/App';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, badgeStyle } from '@/components/iron/IronKit';
import {
  Inbox, Upload, Loader2, CheckCircle2, FileSpreadsheet, AlertTriangle, Plus,
} from 'lucide-react';
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

const btnPrimary = {
  border: 'none', background: T.orange, color: '#fff', borderRadius: 6,
  padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12,
  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
};
const btnOutline = {
  border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, borderRadius: 6,
  padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12,
  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
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

  const chip = (key, label, count) => {
    const active = filter === key;
    return (
      <button
        onClick={() => setFilter(key)}
        style={{
          border: `1px solid ${active ? T.orange : T.iron200}`,
          background: active ? T.orange : T.white,
          color: active ? '#fff' : T.iron700,
          borderRadius: 6, padding: '6px 12px', cursor: 'pointer',
          fontFamily: T.headline, fontWeight: 700, fontSize: 11.5,
          display: 'inline-flex', alignItems: 'center', gap: 6,
        }}
      >
        {label}
        <span style={{ ...mono, fontSize: 11, opacity: active ? 0.9 : 0.7 }}>{count || 0}</span>
      </button>
    );
  };

  const headerRight = (
    <button style={btnPrimary} onClick={() => setCreateOpen(true)}>
      <Plus size={14} strokeWidth={2.2} /> Add gap
    </button>
  );

  return (
    <IronShell
      title="Data Inbox"
      subtitle="FINANCE AGENT"
      onRefresh={fetchInbox}
      headerRight={headerRight}
    >
      <div style={{ maxWidth: 960, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Intro */}
        <IronCard pad={14}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Inbox size={16} color={T.orange} strokeWidth={1.9} />
            <span style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 15, color: T.iron900 }}>
              Finance Agent · Data Inbox
            </span>
          </div>
          <p style={{ fontSize: 12.5, color: T.iron500, marginTop: 8, lineHeight: 1.5 }}>
            Things the agent needs from you but can't scrape itself — bank statements, supplier
            invoices, anything else outside Amazon Seller Central. Upload the file; the agent
            parses it and books the journal entries on the next pulse.
          </p>
        </IronCard>

        {/* Filter chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {chip('open', 'Open', counts.open)}
          {chip('resolved', 'Resolved', counts.resolved)}
          <Link
            to="/agents/finance"
            style={{ fontSize: 11.5, color: T.iron500, textDecoration: 'underline', marginLeft: 6, fontFamily: T.mono }}
          >
            ← back to agent
          </Link>
        </div>

        {/* List */}
        <IronCard pad={0}>
          <div style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Inbox size={14} color={T.orange} strokeWidth={1.9} />
            <Caps size={9.5} color={T.iron700}>{filter === 'open' ? 'Open gaps' : 'Resolved gaps'}</Caps>
          </div>

          {loading ? (
            <div style={{ padding: 32, display: 'flex', justifyContent: 'center' }}>
              <Loader2 size={24} color={T.orange} className="animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center' }}>
              <CheckCircle2 size={40} color={T.green} style={{ margin: '0 auto 12px', opacity: 0.6 }} />
              <div style={{ fontSize: 13, fontWeight: 600, color: T.iron900 }}>
                {filter === 'open' ? 'No open gaps' : 'Nothing resolved yet'}
              </div>
              <p style={{ fontSize: 12, color: T.iron500, marginTop: 4, maxWidth: 420, margin: '4px auto 0', lineHeight: 1.5 }}>
                {filter === 'open'
                  ? "When the agent encounters data it can't scrape (e.g. a bank statement Amazon doesn't have), it'll post a request here."
                  : 'Resolved gaps will appear here once you upload satisfying files.'}
              </p>
            </div>
          ) : (
            <div>
              {items.map((g) => {
                const meta = KIND_META[g.kind] || KIND_META.other;
                const Icon = meta.icon;
                return (
                  <div
                    key={g.id}
                    className="iron-row"
                    style={{ padding: '16px', display: 'flex', alignItems: 'flex-start', gap: 14, borderBottom: `1px solid ${T.iron200}` }}
                  >
                    <div style={{ height: 40, width: 40, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: 6, background: '#FDEEE6', color: T.orangeDeep }}>
                      <Icon size={20} strokeWidth={1.8} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: T.iron900 }}>{meta.label}</div>
                        {g.period && (
                          <span style={{ ...badgeStyle('info'), ...mono, fontSize: 9.5 }}>{g.period}</span>
                        )}
                        {g.requested_by === 'manual' ? (
                          <span style={badgeStyle('slate')}>manual</span>
                        ) : (
                          <span style={{ ...badgeStyle('violet'), display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <Inbox size={11} /> agent request
                          </span>
                        )}
                        {g.status === 'resolved' && (
                          <span style={{ ...badgeStyle('ok'), display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <CheckCircle2 size={11} /> resolved
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: T.iron500, marginTop: 4 }}>{g.description}</div>
                      <div style={{ ...mono, fontSize: 10, color: T.iron400, marginTop: 6 }}>
                        opened {formatDate(g.created_at)}
                        {g.resolved_at && ` · resolved ${formatDate(g.resolved_at)}`}
                        {g.firm_id && ` · ${g.firm_id.slice(0, 8)}`}
                      </div>
                    </div>
                    {g.status === 'open' && (
                      <div style={{ flexShrink: 0 }}>
                        <input
                          ref={(el) => (fileInputRefs.current[g.id] = el)}
                          type="file"
                          accept={meta.accept}
                          style={{ display: 'none' }}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleUpload(g.id, f);
                            e.target.value = '';
                          }}
                        />
                        <button
                          style={{ ...btnPrimary, padding: '6px 12px', fontSize: 11.5, opacity: uploading === g.id ? 0.7 : 1 }}
                          onClick={() => fileInputRefs.current[g.id]?.click()}
                          disabled={uploading === g.id}
                        >
                          {uploading === g.id
                            ? <><Loader2 size={13} className="animate-spin" /> Uploading…</>
                            : <><Upload size={13} /> Upload</>}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </IronCard>

        {/* Phase-2 callout */}
        <IronCard pad={14} style={{ borderColor: '#F6D8BA', background: '#FDEEE6' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <AlertTriangle size={20} color={T.orangeDeep} strokeWidth={1.9} style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: T.iron900 }}>Phase 2: file parsers not yet wired</div>
              <p style={{ color: T.iron500, marginTop: 4, fontSize: 12, lineHeight: 1.5 }}>
                Uploaded files are stored and the gap is marked resolved, but the bank-statement →
                journal-entry parser is a separate job. Until then, treat uploads as evidence the
                accountant has the file; manual booking still required.
              </p>
            </div>
          </div>
        </IronCard>
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
            <button style={btnOutline} onClick={() => setCreateOpen(false)}>Cancel</button>
            <button style={btnPrimary} onClick={handleCreate}>Open gap</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </IronShell>
  );
}
