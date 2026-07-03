import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Search, Inbox, ChevronLeft, ChevronRight } from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell } from '@/components/iron/IronKit';

const PAGE_SIZE = 50;

const inputStyle = { border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '7px 10px', fontSize: 12.5, color: T.iron900, background: T.white, fontFamily: T.body, outline: 'none', width: '100%' };

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
  const runSearch = () => { setPage(1); setQ(search); };
  const cols = (data.columns || []).slice(0, 6);
  const totalPages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));

  return (
    <IronShell
      title="Zoho Forms"
      subtitle={`${total.toLocaleString('en-IN')} ENTRIES · ${forms.length} FORMS · READ-ONLY ARCHIVE`}
      onRefresh={fetchEntries}
    >
      {/* Form selector */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {forms.map((f) => {
          const on = active === f.form;
          return (
            <button
              key={f.form}
              onClick={() => selectForm(f.form)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                borderRadius: 6, padding: '7px 12px', fontFamily: T.headline, fontWeight: 700, fontSize: 12,
                border: `1px solid ${on ? T.orange : T.iron200}`,
                background: on ? T.orange : T.white,
                color: on ? '#fff' : T.iron700,
              }}
            >
              {f.form}
              <span style={{ ...mono, fontSize: 11, fontWeight: 500, opacity: on ? 0.85 : 0.7 }}>
                {f.count.toLocaleString('en-IN')}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <IronCard style={{ marginBottom: 16 }} pad={14}>
        <Caps size={8.5} style={{ display: 'block', marginBottom: 5 }}>Search Entries</Caps>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={14} color={T.iron400} style={{ position: 'absolute', left: 9, top: 9 }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') runSearch(); }}
              placeholder={`Search within ${active || 'form'}…`}
              style={{ ...inputStyle, paddingLeft: 30 }}
            />
          </div>
          <button
            onClick={runSearch}
            style={{ border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '8px 16px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap' }}
          >
            Search
          </button>
        </div>
      </IronCard>

      {/* Entries */}
      <IronCard pad={0} style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ display: 'grid', placeItems: 'center', height: 260 }}>
            <Loader2 className="animate-spin" size={28} color={T.iron400} />
          </div>
        ) : data.entries.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: T.iron400 }}>
            <Inbox size={44} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
            <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron700 }}>No entries</div>
            <div style={{ fontSize: 12, marginTop: 3 }}>Nothing matches this form or search.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                  {cols.map((c) => (
                    <th key={c} style={{ ...thCell, whiteSpace: 'nowrap' }}><Caps size={8.5}>{c}</Caps></th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.entries.map((e) => (
                  <tr
                    key={e.id}
                    className="iron-row"
                    style={{ borderBottom: `1px solid ${T.iron200}`, cursor: 'pointer' }}
                    onClick={() => setSelected(e)}
                  >
                    {cols.map((c) => (
                      <td key={c} style={{ ...tdCell, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {String(e.fields?.[c] ?? '') || '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && data.entries.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 16px', borderTop: `1px solid ${T.iron200}`, background: T.iron50 }}>
            <Caps size={9} color={T.iron400}>
              {data.total.toLocaleString('en-IN')} entries · page {page} of {totalPages}
            </Caps>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                onClick={() => setPage((p) => p - 1)}
                disabled={page <= 1}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: `1px solid ${T.iron200}`, background: T.white, borderRadius: 6, padding: '6px 11px', cursor: page <= 1 ? 'default' : 'pointer', opacity: page <= 1 ? 0.4 : 1, color: T.iron700, fontFamily: T.headline, fontWeight: 600, fontSize: 12 }}
              >
                <ChevronLeft size={14} /> Prev
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: `1px solid ${T.iron200}`, background: T.white, borderRadius: 6, padding: '6px 11px', cursor: page >= totalPages ? 'default' : 'pointer', opacity: page >= totalPages ? 0.4 : 1, color: T.iron700, fontFamily: T.headline, fontWeight: 600, fontSize: 12 }}
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </IronCard>

      {/* Detail */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" style={{ background: T.white, border: `1px solid ${T.iron200}`, color: T.iron900 }}>
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle style={{ fontFamily: T.headline, fontWeight: 700, color: T.orangeDeep }}>
                  {selected.form} — entry
                </DialogTitle>
              </DialogHeader>
              <div style={{ marginTop: 8 }}>
                {(selected.columns || Object.keys(selected.fields || {})).map((c) => (
                  <div key={c} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12, borderBottom: `1px solid ${T.iron100}`, padding: '8px 0' }}>
                    <Caps size={9} color={T.iron400} style={{ wordBreak: 'break-word' }}>{c}</Caps>
                    <div style={{ fontSize: 12.5, color: T.iron900, wordBreak: 'break-word' }}>
                      {String(selected.fields?.[c] ?? '') || '—'}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </IronShell>
  );
}
