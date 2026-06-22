import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Loader2, Search, FileText, ChevronLeft, ChevronRight,
} from 'lucide-react';

const PAGE_SIZE = 50;

export default function AdminZohoForms() {
  const { token } = useAuth();
  const headers = { Authorization: `Bearer ${token}` };
  const [forms, setForms] = useState([]);
  const [total, setTotal] = useState(0);
  const [active, setActive] = useState(null);
  const [data, setData] = useState({ entries: [], total: 0, columns: [] });
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get(`${API}/admin/zoho-forms/summary`, { headers });
        setForms(res.data.forms); setTotal(res.data.total);
        if (res.data.forms.length) setActive(res.data.forms[0].form);
      } catch { toast.error('Failed to load forms'); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchEntries = useCallback(async () => {
    if (!active) return;
    setLoading(true);
    try {
      const res = await axios.get(`${API}/admin/zoho-forms/entries`, {
        headers, params: { form: active, q, page, limit: PAGE_SIZE },
      });
      setData(res.data);
    } catch { toast.error('Failed to load entries'); }
    finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, q, page]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const selectForm = (f) => { setActive(f); setPage(1); setQ(''); setSearch(''); };
  const cols = (data.columns || []).slice(0, 6);
  const totalPages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <FileText className="w-6 h-6 text-cyan-400" /> Zoho Forms Archive
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Read-only archive · {total.toLocaleString('en-IN')} entries across {forms.length} forms
        </p>
      </div>

      {/* Form selector */}
      <div className="flex flex-wrap gap-2">
        {forms.map((f) => (
          <button
            key={f.form}
            onClick={() => selectForm(f.form)}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition ${
              active === f.form ? 'bg-cyan-600 text-white border-cyan-500' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
          >
            {f.form} <span className="opacity-70">· {f.count.toLocaleString('en-IN')}</span>
          </button>
        ))}
      </div>

      {/* Search */}
      <Card className="bg-slate-800 border-slate-700 p-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { setPage(1); setQ(search); } }}
              placeholder={`Search within ${active || 'form'}…`}
              className="bg-slate-700 border-slate-600 text-white pl-9"
            />
          </div>
          <Button variant="secondary" onClick={() => { setPage(1); setQ(search); }}>Search</Button>
        </div>
      </Card>

      {/* Entries */}
      <Card className="bg-slate-800 border-slate-700 overflow-x-auto">
        {loading ? (
          <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-cyan-400" /></div>
        ) : data.entries.length === 0 ? (
          <div className="py-16 text-center text-slate-400">No entries.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-slate-700 hover:bg-transparent">
                {cols.map((c) => <TableHead key={c} className="text-slate-400 whitespace-nowrap">{c}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.entries.map((e) => (
                <TableRow key={e.id} className="border-slate-700 cursor-pointer hover:bg-slate-700/40" onClick={() => setSelected(e)}>
                  {cols.map((c) => (
                    <TableCell key={c} className="text-slate-200 max-w-[220px] truncate">
                      {String(e.fields?.[c] ?? '') || '—'}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <span className="text-slate-400 text-sm">{data.total.toLocaleString('en-IN')} entries · page {page} of {totalPages}</span>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft className="w-4 h-4" /> Prev
          </Button>
          <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Detail */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-2xl max-h-[85vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="text-cyan-400">{selected.form} — entry</DialogTitle>
              </DialogHeader>
              <div className="space-y-2 mt-2">
                {(selected.columns || Object.keys(selected.fields || {})).map((c) => (
                  <div key={c} className="grid grid-cols-3 gap-3 border-b border-slate-800 pb-2">
                    <div className="text-slate-400 text-xs uppercase tracking-wide col-span-1">{c}</div>
                    <div className="text-slate-200 text-sm col-span-2 break-words">{String(selected.fields?.[c] ?? '') || '—'}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
