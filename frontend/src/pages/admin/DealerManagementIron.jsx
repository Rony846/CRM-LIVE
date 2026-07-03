import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { toast } from 'sonner';
import {
  Users, Search, Plus, ChevronLeft, ChevronRight, FilterX,
  Loader2, Clock, ArrowRight, TrendingUp,
} from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell, badgeStyle } from '@/components/iron/IronKit';

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

const inputStyle = { border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '7px 10px', fontSize: 12.5, color: T.iron900, background: T.white, fontFamily: T.body, outline: 'none' };
const selectStyle = { ...inputStyle, cursor: 'pointer' };

function StatusPill({ status }) {
  if (status === 'approved' || status === 'active') {
    return <span style={badgeStyle('ok')}>Approved</span>;
  }
  if (status === 'pending') {
    return <span style={badgeStyle('warn')}>Pending</span>;
  }
  return <span style={badgeStyle('bad')}>{status || 'unknown'}</span>;
}

function StatTile({ label, value, accent, hint, hintColor }) {
  return (
    <IronCard pad={16} style={{ position: 'relative', overflow: 'hidden' }}>
      <Caps size={9.5} color={T.iron400}>{label}</Caps>
      <div style={{ marginTop: 10, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ ...mono, fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', color: accent ? T.orange : T.iron900 }}>{value}</span>
        {hint && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: hintColor || T.iron400 }}>{hint}</span>}
      </div>
    </IronCard>
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

  const fetchDealers = () => {
    setLoading(true);
    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([
      axios.get(`${API}/admin/dealers`, { headers }),
      axios.get(`${API}/admin/dealers/summary`, { headers }).catch(() => ({ data: null })),
    ]).then(([d, s]) => {
      setDealers(Array.isArray(d.data) ? d.data : []);
      setSummary(s.data);
    }).catch(() => toast.error('Failed to load dealers'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDealers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const hasFilters = search || statusFilter !== 'all' || regionFilter !== 'all';

  const headers = ['FIRM NAME', 'PRIMARY CONTACT', 'LOCATION', 'STATUS', 'LEDGER BALANCE', 'LAST ORDER', ''];

  return (
    <IronShell
      title="Dealers"
      subtitle={`${dealers.length.toLocaleString('en-IN')} PARTNERS · DISTRIBUTION NETWORK`}
      onRefresh={fetchDealers}
      headerRight={
        <button
          onClick={() => navigate('/admin/dealer-applications')}
          data-testid="add-new-dealer"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '8px 14px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 12 }}
        >
          <Plus size={14} /> Add New Dealer
        </button>
      }
    >
      <div data-testid="dealer-management-page">
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 15, color: T.iron900 }}>Dealer Management</div>
          <div style={{ fontSize: 12, color: T.iron500, marginTop: 2 }}>Overview of all authorized distribution partners and pending applications.</div>
        </div>

        {/* Stat tiles */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
          <StatTile
            label="TOTAL ACTIVE DEALERS"
            value={summary?.active_dealers ?? '—'}
            hint={<><TrendingUp size={12} color={T.green} /> active</>}
            hintColor={T.green}
          />
          <StatTile
            label="PENDING APPLICATIONS"
            value={summary?.pending_applications ?? '—'}
            hint={<><Clock size={12} color={T.voltageText} /> Requires review</>}
            hintColor={T.voltageText}
          />
          <StatTile
            label="GROSS DEALER REVENUE (MTD)"
            value={summary ? inr(summary.gross_revenue_mtd) : '—'}
            accent
            hint={<span>this month</span>}
          />
        </div>

        {/* Filters */}
        <IronCard pad={12} style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
            <div>
              <Caps size={8.5} style={{ display: 'block', marginBottom: 5 }}>Search</Caps>
              <div style={{ position: 'relative' }}>
                <Search size={14} color={T.iron400} style={{ position: 'absolute', left: 9, top: 9 }} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Dealers, contacts, code…"
                  style={{ ...inputStyle, paddingLeft: 30, width: 280 }}
                />
              </div>
            </div>
            <div>
              <Caps size={8.5} style={{ display: 'block', marginBottom: 5 }}>Region</Caps>
              <select value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)} style={{ ...selectStyle, width: 170 }}>
                <option value="all">All Regions</option>
                {regions.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <Caps size={8.5} style={{ display: 'block', marginBottom: 5 }}>Status</Caps>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ ...selectStyle, width: 150 }}>
                <option value="all">All Statuses</option>
                <option value="approved">Approved</option>
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            {hasFilters && (
              <button
                onClick={clearFilters}
                style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5, border: `1px solid ${T.iron200}`, background: T.white, borderRadius: 6, padding: '8px 12px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 600, fontSize: 11.5, color: T.iron500 }}
              >
                <FilterX size={14} /> Clear Filters
              </button>
            )}
          </div>
        </IronCard>

        {/* Table */}
        <IronCard pad={0} style={{ overflow: 'hidden' }}>
          {loading ? (
            <div style={{ display: 'grid', placeItems: 'center', height: 260 }}><Loader2 className="animate-spin" size={28} color={T.iron400} /></div>
          ) : pageRows.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: T.iron400 }}>
              <Users size={44} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
              <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron700 }}>No dealers found</div>
              <div style={{ fontSize: 12, marginTop: 3 }}>No dealers match these filters.</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                    {headers.map((h, i) => (
                      <th key={i} style={{ ...thCell, textAlign: i === 4 ? 'right' : 'left' }}><Caps size={8.5}>{h}</Caps></th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((d) => (
                    <tr
                      key={d.id}
                      className="iron-row"
                      style={{ borderBottom: `1px solid ${T.iron200}`, cursor: 'pointer' }}
                      onClick={() => navigate(`/admin/dealers/${d.id}`)}
                      data-testid={`dealer-row-${d.id}`}
                    >
                      <td style={tdCell}>
                        <div style={{ fontFamily: T.headline, fontWeight: 600, fontSize: 12.5, color: T.iron900 }}>{d.firm_name || '—'}</div>
                        {d.dealer_code && <div style={{ ...mono, fontSize: 10.5, color: T.iron400, marginTop: 2 }}>{d.dealer_code}</div>}
                      </td>
                      <td style={tdCell}>
                        <div style={{ fontSize: 12, color: T.iron900 }}>{d.contact_person || '—'}</div>
                        <div style={{ ...mono, fontSize: 10.5, color: T.iron500, marginTop: 2 }}>{d.phone || ''}</div>
                      </td>
                      <td style={{ ...tdCell, color: T.iron500 }}>
                        {[d.city, d.state].filter(Boolean).join(', ') || '—'}
                      </td>
                      <td style={tdCell}><StatusPill status={d.status} /></td>
                      <td style={{ ...tdCell, textAlign: 'right', ...mono, fontSize: 12, color: T.iron900 }}>{inr(d.ledger_balance)}</td>
                      <td style={{ ...tdCell, ...mono, fontSize: 11, color: T.iron500 }}>{fmtDate(d.last_order_date)}</td>
                      <td style={{ ...tdCell, textAlign: 'right' }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate(`/admin/dealers/${d.id}`); }}
                          aria-label="Open dealer"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: `1px solid ${T.orange}`, background: T.white, color: T.orangeDeep, borderRadius: 6, padding: '5px 11px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 11 }}
                        >
                          Open <ArrowRight size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!loading && filtered.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 16px', borderTop: `1px solid ${T.iron200}`, background: T.iron50 }}>
              <Caps size={9} color={T.iron400}>
                Showing {start + 1} to {Math.min(start + PAGE_SIZE, filtered.length)} of {filtered.length.toLocaleString('en-IN')} entries
              </Caps>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={() => setPage((p) => p - 1)}
                  disabled={page <= 1}
                  style={{ border: 'none', background: 'transparent', cursor: page <= 1 ? 'default' : 'pointer', opacity: page <= 1 ? 0.3 : 1, color: T.iron700, display: 'grid', placeItems: 'center', padding: 4 }}
                >
                  <ChevronLeft size={16} />
                </button>
                <Caps size={9} color={T.iron500}>Page {page} of {totalPages}</Caps>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= totalPages}
                  style={{ border: 'none', background: 'transparent', cursor: page >= totalPages ? 'default' : 'pointer', opacity: page >= totalPages ? 0.3 : 1, color: T.iron700, display: 'grid', placeItems: 'center', padding: 4 }}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </IronCard>
      </div>
    </IronShell>
  );
}
