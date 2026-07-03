import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  ScrollText, Loader2, Download, Search, CheckCircle2,
  AlertTriangle, XCircle, History, Users,
} from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell, badgeStyle } from '@/components/iron/IronKit';

const STATUS_META = {
  current:  { label: 'Current',  tone: 'ok',   icon: CheckCircle2 },
  outdated: { label: 'Outdated', tone: 'warn', icon: AlertTriangle },
  never:    { label: 'Never',    tone: 'bad',  icon: XCircle },
};

const inputStyle = { border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '7px 10px 7px 32px', fontSize: 12.5, color: T.iron900, background: T.white, fontFamily: T.body, outline: 'none', width: '100%' };
const btnOutline = { border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };

const Kpi = ({ icon: Icon, iconTone, label, value, sub }) => (
  <IronCard pad={14}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 38, height: 38, borderRadius: 8, display: 'grid', placeItems: 'center', ...iconTone }}>
        <Icon size={18} strokeWidth={1.9} />
      </div>
      <div style={{ minWidth: 0 }}>
        <Caps size={9} color={T.iron400}>{label}</Caps>
        <div style={{ fontFamily: T.headline, fontWeight: 800, fontSize: 21, color: T.iron900, lineHeight: 1.1, marginTop: 2 }}>{value}</div>
        {sub != null && <div style={{ fontSize: 11, color: T.iron500, marginTop: 1 }}>{sub}</div>}
      </div>
    </div>
  </IronCard>
);

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

  const pctCurrent = data?.total ? Math.round((data.current / data.total) * 100) : 0;

  const headerRight = (
    <button onClick={exportCsv} style={btnOutline}>
      <Download size={14} /> CSV
    </button>
  );

  return (
    <IronShell title="Dealer T&C Audit" subtitle="TERMS ACCEPTANCE COMPLIANCE" onRefresh={fetchData} headerRight={headerRight}>
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 384 }}>
          <Loader2 className="animate-spin" size={30} color={T.orange} />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* KPI tiles */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <Kpi
              icon={ScrollText}
              iconTone={{ background: '#FDEEE6', color: T.orangeDeep }}
              label="Current Version"
              value={`v${data?.current_version}`}
              sub={`Eff. ${data?.effective_date}`}
            />
            <Kpi
              icon={CheckCircle2}
              iconTone={{ background: T.greenTint, color: T.green }}
              label="Accepted Current"
              value={<>{data?.current} <span style={{ fontSize: 12, color: T.iron400, fontWeight: 600 }}>/ {data?.total}</span></>}
              sub={`${pctCurrent}% of dealers`}
            />
            <Kpi
              icon={AlertTriangle}
              iconTone={{ background: T.voltageTint, color: T.voltageText }}
              label="Outdated"
              value={data?.outdated}
              sub="On earlier version"
            />
            <Kpi
              icon={XCircle}
              iconTone={{ background: '#FDEEE6', color: T.orangeDeep }}
              label="Never Accepted"
              value={data?.never}
              sub="Action required"
            />
          </div>

          {/* Filter bar */}
          <IronCard pad={14}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', flex: 1, minWidth: 240 }}>
                <div style={{ position: 'relative', flex: 1, maxWidth: 380, minWidth: 220 }}>
                  <Search size={15} color={T.iron400} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    placeholder="Search name, email, GSTIN, dealer code…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {['all', 'never', 'outdated', 'current'].map(s => {
                    const active = statusFilter === s;
                    return (
                      <button
                        key={s}
                        onClick={() => setStatusFilter(s)}
                        style={{
                          padding: '6px 12px', fontSize: 10.5, borderRadius: 6, cursor: 'pointer',
                          fontFamily: T.headline, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase',
                          border: `1px solid ${active ? T.orange : T.iron200}`,
                          background: active ? T.orange : T.white,
                          color: active ? '#fff' : T.iron500,
                        }}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </IronCard>

          {/* Table */}
          <IronCard pad={0}>
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${T.iron200}`, background: T.iron50, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Users size={15} color={T.orange} />
              <span style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 13, color: T.iron900 }}>
                Dealer Acceptance Status ({filtered.length} of {data?.total})
              </span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                    {['Status', 'Dealer', 'Business / GSTIN', 'Contact', 'Version', 'Accepted At · IP', 'Audit'].map((h, i) => (
                      <th key={h} style={{ ...thCell, textAlign: i === 6 ? 'right' : 'left' }}><Caps size={8.5}>{h}</Caps></th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: '48px 0', color: T.iron400, fontSize: 13 }}>No dealers match the filter.</td></tr>
                  )}
                  {filtered.map((r) => {
                    const meta = STATUS_META[r.status] || STATUS_META.never;
                    const Icon = meta.icon;
                    return (
                      <tr key={r.user_id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                        <td style={tdCell}>
                          <span style={{ ...badgeStyle(meta.tone), display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <Icon size={11} /> {meta.label}
                          </span>
                        </td>
                        <td style={tdCell}>
                          <div style={{ fontWeight: 600, color: T.iron900, fontSize: 12.5 }}>{r.name || '—'}</div>
                          <div style={{ ...mono, fontSize: 11, color: T.iron400 }}>{r.dealer_code || '—'}</div>
                        </td>
                        <td style={tdCell}>
                          <div style={{ color: T.iron700 }}>{r.business_name || '—'}</div>
                          <div style={{ ...mono, fontSize: 11, color: T.iron400 }}>{r.gstin || '—'}</div>
                        </td>
                        <td style={tdCell}>
                          <div style={{ fontSize: 11.5, color: T.iron700 }}>{r.email || '—'}</div>
                          <div style={{ fontSize: 11, color: T.iron400 }}>{r.phone || '—'} · {r.city || '—'}</div>
                        </td>
                        <td style={tdCell}>
                          {r.accepted_version ? (
                            <span style={{ ...badgeStyle('slate'), ...mono }}>v{r.accepted_version}</span>
                          ) : (
                            <span style={{ fontSize: 11, color: T.iron400 }}>—</span>
                          )}
                        </td>
                        <td style={tdCell}>
                          {r.accepted_at ? (
                            <>
                              <div style={{ ...mono, fontSize: 11.5, color: T.iron700 }}>{r.accepted_at?.slice(0, 19).replace('T', ' ')}</div>
                              <div style={{ ...mono, fontSize: 11, color: T.iron400 }}>{r.accepted_ip || '—'}</div>
                            </>
                          ) : (
                            <span style={{ fontSize: 11, color: T.iron400 }}>Not accepted</span>
                          )}
                        </td>
                        <td style={{ ...tdCell, textAlign: 'right' }}>
                          <button
                            onClick={() => { setLogUser(r); fetchLog(r.user_id); }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.orange, fontSize: 11.5, fontWeight: 700, fontFamily: T.headline, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          >
                            <History size={13} /> Log
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </IronCard>
        </div>
      )}

      {/* Per-dealer acceptance log modal */}
      <Dialog open={!!logUser} onOpenChange={(o) => !o && setLogUser(null)}>
        <DialogContent className="max-w-2xl" style={{ background: T.white, border: `1px solid ${T.iron200}`, color: T.iron900 }}>
          <DialogHeader>
            <DialogTitle style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.iron900, fontFamily: T.headline }}>
              <History size={16} color={T.orange} />
              Acceptance Log — {logUser?.name}
            </DialogTitle>
          </DialogHeader>
          <div style={{ ...mono, fontSize: 11.5, color: T.iron400, marginBottom: 8 }}>
            {logUser?.email} · {logUser?.dealer_code || 'no dealer code'}
          </div>
          {logLoading ? (
            <div style={{ padding: '32px 0', textAlign: 'center' }}><Loader2 className="animate-spin" size={24} color={T.orange} style={{ margin: '0 auto' }} /></div>
          ) : logEntries.length === 0 ? (
            <div style={{ padding: '24px 0', textAlign: 'center', fontSize: 13, color: T.iron400 }}>
              No acceptance events recorded yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 384, overflowY: 'auto' }}>
              {logEntries.map((e) => (
                <div key={e.id} style={{ border: `1px solid ${T.iron200}`, borderRadius: 8, padding: 12, background: T.iron50 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ ...badgeStyle('bad'), ...mono }}>v{e.version}</span>
                    <span style={{ ...mono, fontSize: 11.5, color: T.iron700 }}>
                      {e.accepted_at?.slice(0, 19).replace('T', ' ')} UTC
                    </span>
                  </div>
                  <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 11.5 }}>
                    <div>
                      <div style={{ color: T.iron400 }}>IP Address</div>
                      <div style={{ ...mono, color: T.iron700 }}>{e.ip_address || '—'}</div>
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ color: T.iron400 }}>User Agent</div>
                      <div style={{ ...mono, color: T.iron700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={e.user_agent}>{e.user_agent || '—'}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </IronShell>
  );
}
