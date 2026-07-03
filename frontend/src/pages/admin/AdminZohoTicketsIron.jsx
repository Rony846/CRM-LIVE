import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Loader2, RefreshCw, Search, ExternalLink, Inbox, ChevronLeft, ChevronRight,
} from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell, badgeStyle, fmtDateTime } from '@/components/iron/IronKit';

const PAGE_SIZE = 50;

// Map freeform Zoho Desk statuses -> Iron badge tone (mirrors the legacy STATUS_COLOR intent).
const statusTone = (s) => {
  const t = (s || '').toLowerCase();
  if (t.includes('closed')) return 'ok';
  if (t.includes('reverse pickup pending')) return 'bad';
  if (t.includes('reverse pickup done')) return 'ok';
  if (t.includes('repair in progress')) return 'warn';
  if (t.includes('pending dispatch')) return 'violet';
  if (t.includes('dispatch done')) return 'info';
  if (t.includes('open')) return 'info';
  return 'slate';
};
const statusPill = (s) => ({ ...badgeStyle(statusTone(s)), textTransform: 'none', letterSpacing: '.02em' });

const inputStyle = { border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '7px 10px', fontSize: 12.5, color: T.iron900, background: T.white, fontFamily: T.body, outline: 'none', width: '100%' };

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
  const range = () => {
    const r = []; let s = Math.max(1, page - 2); let e = Math.min(totalPages, s + 4);
    if (e - s < 4) s = Math.max(1, e - 4);
    for (let i = s; i <= e; i++) r.push(i);
    return r;
  };

  const H = ['TICKET #', 'SUBJECT', 'CONTACT', 'STATUS', 'PRIORITY', 'MODIFIED'];

  const syncBtn = (
    <button onClick={syncNow} disabled={syncing}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '8px 14px', cursor: syncing ? 'default' : 'pointer', opacity: syncing ? 0.7 : 1, fontFamily: T.headline, fontWeight: 700, fontSize: 12 }}>
      {syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Sync now
    </button>
  );

  return (
    <IronShell
      title="Zoho Desk"
      subtitle={`${(data.total || 0).toLocaleString('en-IN')} TICKETS · READ-ONLY MIRROR${data.last_synced ? ` · SYNCED ${fmtDateTime(data.last_synced)}` : ''}`}
      onRefresh={fetchData}
      headerRight={syncBtn}
    >
      {/* Filters */}
      <IronCard style={{ marginBottom: 16 }} pad={14}>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={14} color={T.iron400} style={{ position: 'absolute', left: 9, top: 9 }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { setPage(1); setQ(search); } }}
              placeholder="Search ticket #, subject, contact, email, phone…"
              style={{ ...inputStyle, paddingLeft: 30 }}
            />
          </div>
          <button onClick={() => { setPage(1); setQ(search); }}
            style={{ border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '8px 16px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 12 }}>Search</button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
          {['all', ...data.statuses].map((s) => {
            const active = status === s;
            return (
              <button key={s} onClick={() => { setPage(1); setStatus(s); }}
                style={{ padding: '5px 12px', borderRadius: 999, fontFamily: T.headline, fontWeight: 700, fontSize: 11, cursor: 'pointer',
                  border: `1px solid ${active ? T.orange : T.iron200}`, background: active ? T.orange : T.white, color: active ? '#fff' : T.iron700 }}>
                {s === 'all' ? 'All' : s}
              </button>
            );
          })}
        </div>
      </IronCard>

      {/* Table */}
      <IronCard pad={0} style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ display: 'grid', placeItems: 'center', height: 260 }}><Loader2 className="animate-spin" size={28} color={T.iron400} /></div>
        ) : data.tickets.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: T.iron400 }}>
            <Inbox size={44} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
            <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron700 }}>No tickets found</div>
            <div style={{ fontSize: 12, marginTop: 3 }}>Try adjusting your search or filters.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                {H.map((h, i) => <th key={i} style={thCell}><Caps size={8.5}>{h}</Caps></th>)}
              </tr></thead>
              <tbody>{data.tickets.map((t) => (
                <tr key={t.id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}`, cursor: 'pointer' }} onClick={() => setSelected(t)}>
                  <td style={tdCell}><span style={{ ...mono, fontWeight: 700, fontSize: 12, color: T.orangeDeep }}>{t.ticket_number}</span></td>
                  <td style={{ ...tdCell, maxWidth: 320 }}>
                    <div style={{ fontFamily: T.headline, fontWeight: 600, fontSize: 12.5, color: T.iron900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 300 }}>{t.subject || '—'}</div>
                  </td>
                  <td style={tdCell}><span style={{ fontSize: 12, color: T.iron700 }}>{t.contact_name || t.email || t.phone || '—'}</span></td>
                  <td style={tdCell}><span style={statusPill(t.status)}>{t.status}</span></td>
                  <td style={tdCell}><span style={{ fontSize: 12, color: T.iron700 }}>{t.priority || '—'}</span></td>
                  <td style={tdCell}><span style={{ ...mono, fontSize: 10.5, color: T.iron500 }}>{fmtDateTime(t.modified_time)}</span></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}

        {!loading && data.tickets.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 16px', borderTop: `1px solid ${T.iron200}`, background: T.iron50 }}>
            <Caps size={9} color={T.iron400}>Page {page} of {totalPages}</Caps>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <button onClick={() => page > 1 && setPage((p) => p - 1)} disabled={page <= 1} style={{ border: 'none', background: 'transparent', cursor: page <= 1 ? 'default' : 'pointer', opacity: page <= 1 ? 0.3 : 1, color: T.iron700, display: 'grid', placeItems: 'center', padding: 4 }}><ChevronLeft size={16} /></button>
              {range().map((n) => (
                <button key={n} onClick={() => setPage(n)} style={{ width: 30, height: 30, borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 12,
                  background: n === page ? T.iron900 : 'transparent', color: n === page ? '#fff' : T.iron500 }}>{n}</button>
              ))}
              <button onClick={() => page < totalPages && setPage((p) => p + 1)} disabled={page >= totalPages} style={{ border: 'none', background: 'transparent', cursor: page >= totalPages ? 'default' : 'pointer', opacity: page >= totalPages ? 0.3 : 1, color: T.iron700, display: 'grid', placeItems: 'center', padding: 4 }}><ChevronRight size={16} /></button>
            </div>
          </div>
        )}
      </IronCard>

      {/* Detail dialog (read-only) */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent style={{ background: T.white, border: `1px solid ${T.iron200}`, color: T.iron900, maxWidth: '42rem', maxHeight: '85vh', overflowY: 'auto' }}>
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ ...mono, fontWeight: 700, color: T.orangeDeep }}>{selected.ticket_number}</span>
                  <span style={statusPill(selected.status)}>{selected.status}</span>
                </DialogTitle>
              </DialogHeader>
              <p style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 16, color: T.iron900 }}>{selected.subject || '—'}</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 24, rowGap: 12, marginTop: 12 }}>
                {[
                  ['Contact', selected.contact_name],
                  ['Email', selected.email],
                  ['Phone', selected.phone],
                  ['Priority', selected.priority],
                  ['Channel', selected.channel],
                  ['Category', selected.category],
                  ['Created', fmtDateTime(selected.created_time)],
                  ['Modified', fmtDateTime(selected.modified_time)],
                  ['Due', fmtDateTime(selected.due_date)],
                  ['Closed', fmtDateTime(selected.closed_time)],
                ].map(([k, v]) => (
                  <div key={k}>
                    <Caps size={8.5} style={{ display: 'block', marginBottom: 3 }}>{k}</Caps>
                    <div style={{ fontSize: 12.5, color: T.iron700 }}>{v || '—'}</div>
                  </div>
                ))}
              </div>
              {selected.raw?.description ? (
                <div style={{ marginTop: 16 }}>
                  <Caps size={8.5} style={{ display: 'block', marginBottom: 5 }}>Description</Caps>
                  <div style={{ fontSize: 12.5, color: T.iron700, whiteSpace: 'pre-wrap', background: T.iron50, borderRadius: 8, padding: 12, border: `1px solid ${T.iron200}` }}>
                    {String(selected.raw.description).replace(/<[^>]+>/g, ' ').slice(0, 2000)}
                  </div>
                </div>
              ) : null}
              {selected.web_url ? (
                <a href={selected.web_url} target="_blank" rel="noreferrer"
                   style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: T.orangeDeep, fontFamily: T.headline, fontWeight: 700, fontSize: 12.5, marginTop: 16 }}>
                  Open in Zoho Desk <ExternalLink size={14} />
                </a>
              ) : null}
            </>
          )}
        </DialogContent>
      </Dialog>
    </IronShell>
  );
}
