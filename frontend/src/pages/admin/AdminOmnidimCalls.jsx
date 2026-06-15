import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Phone, PhoneIncoming, PhoneOutgoing, RefreshCw, Search, AlertTriangle, Play, X,
} from 'lucide-react';

const sentimentColor = (s) => {
  const v = (s || '').toLowerCase();
  if (v.includes('negative') || v.includes('frustrat') || v.includes('angry')) return 'bg-red-500/20 text-red-300 border-red-500/40';
  if (v.includes('positive') || v.includes('happy')) return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
  return 'bg-slate-600/30 text-slate-300 border-slate-600/50';
};
const urgencyColor = (u) => {
  const v = (u || '').toLowerCase();
  if (v.includes('high') || v.includes('urgent') || v.includes('critical')) return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
  return 'bg-slate-600/30 text-slate-400 border-slate-600/50';
};
const fmt = (iso) => (iso ? new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

export default function AdminOmnidimCalls() {
  const { token } = useAuth();
  const headers = { Authorization: `Bearer ${token}` };
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [bySentiment, setBySentiment] = useState({});
  const [loading, setLoading] = useState(true);
  const [phone, setPhone] = useState('');
  const [needsHelp, setNeedsHelp] = useState(false);
  const [detail, setDetail] = useState(null);

  const fetchCalls = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API}/admin/omnidim-calls`, {
        headers, params: { limit: 150, phone: phone || undefined, needs_help: needsHelp || undefined },
      });
      setItems(data.items || []);
      setTotal(data.total || 0);
      setBySentiment(data.by_sentiment || {});
    } catch (e) {
      console.error('omnidim calls load failed', e);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone, needsHelp, token]);

  useEffect(() => { fetchCalls(); }, [needsHelp]); // eslint-disable-line react-hooks/exhaustive-deps

  const openDetail = async (id) => {
    try {
      const { data } = await axios.get(`${API}/admin/omnidim-calls/${id}`, { headers });
      setDetail(data);
    } catch (e) { console.error(e); }
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Phone className="w-6 h-6 text-amber-400" /> Omnidim Call Log
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Every voice-agent call — transcript, recording, and the issue raised. {total} total.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {Object.entries(bySentiment).filter(([k]) => k).map(([k, n]) => (
            <Badge key={k} variant="outline" className={sentimentColor(k)}>{k}: {n}</Badge>
          ))}
          <Button variant="outline" size="sm" onClick={fetchCalls} className="border-slate-700 text-slate-300">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-500" />
          <Input
            value={phone} onChange={(e) => setPhone(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchCalls()}
            placeholder="Search phone…" className="pl-8 w-56 bg-slate-800 border-slate-700 text-slate-200"
          />
        </div>
        <Button size="sm" variant={needsHelp ? 'default' : 'outline'}
          onClick={() => setNeedsHelp((v) => !v)}
          className={needsHelp ? 'bg-amber-500 text-black hover:bg-amber-400' : 'border-slate-700 text-slate-300'}>
          <AlertTriangle className="w-4 h-4 mr-1" /> Needs help only
        </Button>
      </div>

      <Card className="bg-slate-800/60 border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-900/60 text-slate-400 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">When</th>
                <th className="text-left px-4 py-3">Customer</th>
                <th className="text-left px-4 py-3">Product</th>
                <th className="text-left px-4 py-3">Issue</th>
                <th className="text-left px-4 py-3">Urgency</th>
                <th className="text-left px-4 py-3">Sentiment</th>
                <th className="text-left px-4 py-3">Rec.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/60">
              {items.map((c) => (
                <tr key={c.id} onClick={() => openDetail(c.id)}
                  className="hover:bg-slate-700/30 cursor-pointer transition-colors">
                  <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                    <span className="flex items-center gap-1.5">
                      {c.direction === 'outbound'
                        ? <PhoneOutgoing className="w-3.5 h-3.5 text-sky-400" />
                        : <PhoneIncoming className="w-3.5 h-3.5 text-emerald-400" />}
                      {fmt(c.received_at)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-slate-200">{c.customer_name || '—'}</div>
                    <div className="text-slate-500 text-xs">{c.phone || '—'}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-300">{c.product || '—'}</td>
                  <td className="px-4 py-3 text-slate-300 max-w-[260px] truncate" title={c.technical_issue || ''}>
                    {c.technical_issue || <span className="text-slate-600">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {c.urgency ? <Badge variant="outline" className={urgencyColor(c.urgency)}>{c.urgency}</Badge> : <span className="text-slate-600">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {c.sentiment ? <Badge variant="outline" className={sentimentColor(c.sentiment)}>{c.sentiment}</Badge> : <span className="text-slate-600">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {c.recording_url
                      ? <a href={c.recording_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
                          className="text-amber-400 hover:text-amber-300"><Play className="w-4 h-4" /></a>
                      : <span className="text-slate-600 text-xs">—</span>}
                  </td>
                </tr>
              ))}
              {!loading && items.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-500">No calls found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-200 max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-100">
              <Phone className="w-5 h-5 text-amber-400" />
              {detail?.customer_name || detail?.phone || 'Call'} — {detail?.phone}
            </DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {detail.urgency && <Badge variant="outline" className={urgencyColor(detail.urgency)}>Urgency: {detail.urgency}</Badge>}
                {detail.sentiment && <Badge variant="outline" className={sentimentColor(detail.sentiment)}>{detail.sentiment}</Badge>}
                {detail.direction && <Badge variant="outline" className="border-slate-600 text-slate-300">{detail.direction}</Badge>}
                {detail.duration && <Badge variant="outline" className="border-slate-600 text-slate-400">{detail.duration}s</Badge>}
              </div>
              {detail.product && <div><span className="text-slate-500 text-xs uppercase">Product</span><div className="text-slate-200">{detail.product}</div></div>}
              {detail.technical_issue && <div><span className="text-slate-500 text-xs uppercase">Issue</span><div className="text-slate-200">{detail.technical_issue}</div></div>}
              {detail.summary && <div><span className="text-slate-500 text-xs uppercase">Summary</span><div className="text-slate-300">{detail.summary}</div></div>}
              {detail.recording_url && (
                <a href={detail.recording_url} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-2 text-amber-400 hover:text-amber-300 text-sm">
                  <Play className="w-4 h-4" /> Play recording
                </a>
              )}
              {detail.transcript && (
                <div>
                  <span className="text-slate-500 text-xs uppercase">Transcript</span>
                  <pre className="mt-1 whitespace-pre-wrap text-slate-300 text-sm bg-slate-800/60 border border-slate-700 rounded p-3 max-h-72 overflow-y-auto font-sans">
                    {detail.transcript}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
