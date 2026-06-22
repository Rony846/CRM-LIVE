import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Loader2, RefreshCw, Search, ExternalLink, Ticket, ChevronLeft, ChevronRight,
} from 'lucide-react';

const STATUS_COLOR = (s) => {
  const t = (s || '').toLowerCase();
  if (t.includes('closed')) return 'bg-emerald-600/20 text-emerald-300 border-emerald-600/40';
  if (t.includes('open')) return 'bg-blue-600/20 text-blue-300 border-blue-600/40';
  if (t.includes('repair in progress')) return 'bg-amber-600/20 text-amber-300 border-amber-600/40';
  if (t.includes('reverse pickup pending')) return 'bg-orange-600/20 text-orange-300 border-orange-600/40';
  if (t.includes('reverse pickup done')) return 'bg-teal-600/20 text-teal-300 border-teal-600/40';
  if (t.includes('pending dispatch')) return 'bg-purple-600/20 text-purple-300 border-purple-600/40';
  if (t.includes('dispatch done')) return 'bg-cyan-600/20 text-cyan-300 border-cyan-600/40';
  return 'bg-slate-600/30 text-slate-300 border-slate-600/40';
};
const fmt = (d) => (d ? new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
const PAGE_SIZE = 50;

export default function AdminZohoTickets() {
  const { token } = useAuth();
  const headers = { Authorization: `Bearer ${token}` };
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ tickets: [], total: 0, statuses: [], last_synced: null });
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [syncing, setSyncing] = useState(false);
  const [selected, setSelected] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/admin/zoho-tickets`, {
        headers, params: { status, q, page, limit: PAGE_SIZE },
      });
      setData(res.data);
    } catch {
      toast.error('Failed to load Zoho tickets');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, q, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const syncNow = async () => {
    setSyncing(true);
    try {
      const res = await axios.post(`${API}/admin/zoho-tickets/sync`, {}, { headers });
      toast.success(`Synced ${res.data.synced} tickets from Zoho Desk`);
      setPage(1); fetchData();
    } catch {
      toast.error('Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Ticket className="w-6 h-6 text-cyan-400" /> Zoho Desk Tickets
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Read-only mirror · {data.total.toLocaleString('en-IN')} tickets
            {data.last_synced ? ` · last synced ${fmt(data.last_synced)}` : ''}
          </p>
        </div>
        <Button onClick={syncNow} disabled={syncing} className="bg-cyan-600 hover:bg-cyan-500">
          {syncing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
          Sync now
        </Button>
      </div>

      {/* Filters */}
      <Card className="bg-slate-800 border-slate-700 p-4 space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { setPage(1); setQ(search); } }}
              placeholder="Search ticket #, subject, contact, email, phone…"
              className="bg-slate-700 border-slate-600 text-white pl-9"
            />
          </div>
          <Button variant="secondary" onClick={() => { setPage(1); setQ(search); }}>Search</Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {['all', ...data.statuses].map((s) => (
            <button
              key={s}
              onClick={() => { setPage(1); setStatus(s); }}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition ${
                status === s ? 'bg-cyan-600 text-white border-cyan-500' : 'bg-slate-700/50 text-slate-300 border-slate-600 hover:bg-slate-700'
              }`}
            >
              {s === 'all' ? 'All' : s}
            </button>
          ))}
        </div>
      </Card>

      {/* Table */}
      <Card className="bg-slate-800 border-slate-700 overflow-hidden">
        {loading ? (
          <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-cyan-400" /></div>
        ) : data.tickets.length === 0 ? (
          <div className="py-16 text-center text-slate-400">No tickets found.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-slate-700 hover:bg-transparent">
                <TableHead className="text-slate-400">Ticket #</TableHead>
                <TableHead className="text-slate-400">Subject</TableHead>
                <TableHead className="text-slate-400">Contact</TableHead>
                <TableHead className="text-slate-400">Status</TableHead>
                <TableHead className="text-slate-400">Priority</TableHead>
                <TableHead className="text-slate-400">Modified</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.tickets.map((t) => (
                <TableRow
                  key={t.id}
                  className="border-slate-700 cursor-pointer hover:bg-slate-700/40"
                  onClick={() => setSelected(t)}
                >
                  <TableCell className="text-cyan-400 font-mono">{t.ticket_number}</TableCell>
                  <TableCell className="text-white max-w-xs truncate">{t.subject || '—'}</TableCell>
                  <TableCell className="text-slate-300">{t.contact_name || t.email || t.phone || '—'}</TableCell>
                  <TableCell><Badge className={`border ${STATUS_COLOR(t.status)}`}>{t.status}</Badge></TableCell>
                  <TableCell className="text-slate-300">{t.priority || '—'}</TableCell>
                  <TableCell className="text-slate-400 text-sm">{fmt(t.modified_time)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <span className="text-slate-400 text-sm">Page {page} of {totalPages}</span>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft className="w-4 h-4" /> Prev
          </Button>
          <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Detail dialog (read-only) */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-2xl max-h-[85vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span className="text-cyan-400 font-mono">{selected.ticket_number}</span>
                  <Badge className={`border ${STATUS_COLOR(selected.status)}`}>{selected.status}</Badge>
                </DialogTitle>
              </DialogHeader>
              <p className="text-lg font-semibold text-white">{selected.subject || '—'}</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 mt-3 text-sm">
                {[
                  ['Contact', selected.contact_name],
                  ['Email', selected.email],
                  ['Phone', selected.phone],
                  ['Priority', selected.priority],
                  ['Channel', selected.channel],
                  ['Category', selected.category],
                  ['Created', fmt(selected.created_time)],
                  ['Modified', fmt(selected.modified_time)],
                  ['Due', fmt(selected.due_date)],
                  ['Closed', fmt(selected.closed_time)],
                ].map(([k, v]) => (
                  <div key={k}>
                    <div className="text-slate-400 text-xs uppercase tracking-wide">{k}</div>
                    <div className="text-slate-200">{v || '—'}</div>
                  </div>
                ))}
              </div>
              {selected.raw?.description ? (
                <div className="mt-4">
                  <div className="text-slate-400 text-xs uppercase tracking-wide mb-1">Description</div>
                  <div className="text-slate-200 text-sm whitespace-pre-wrap bg-slate-800 rounded-lg p-3 border border-slate-700">
                    {String(selected.raw.description).replace(/<[^>]+>/g, ' ').slice(0, 2000)}
                  </div>
                </div>
              ) : null}
              {selected.web_url ? (
                <a href={selected.web_url} target="_blank" rel="noreferrer"
                   className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300 text-sm mt-4">
                  Open in Zoho Desk <ExternalLink className="w-3.5 h-3.5" />
                </a>
              ) : null}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
