import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { toast } from 'sonner';
import { FileText, Eye, Loader2, ExternalLink } from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell, badgeStyle } from '@/components/iron/IronKit';

// Status -> Iron badge tone + label (mirrors the legacy STATUS_TONES map exactly).
const STATUS_TONES = {
  draft:     { tone: 'slate',  label: 'Draft' },
  sent:      { tone: 'info',   label: 'Pending Review' },
  viewed:    { tone: 'violet', label: 'Awaiting Response' },
  approved:  { tone: 'ok',     label: 'Approved' },
  rejected:  { tone: 'bad',    label: 'Rejected' },
  converted: { tone: 'ok',     label: 'Order Placed' },
  expired:   { tone: 'warn',   label: 'Expired' },
  cancelled: { tone: 'slate',  label: 'Cancelled' },
};

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

function Tile({ label, value, accent = T.iron900 }) {
  return (
    <IronCard pad={14} style={{ minWidth: 0 }}>
      <Caps size={9} color={T.iron400}>{label}</Caps>
      <div style={{ ...mono, marginTop: 8, fontSize: 24, fontWeight: 700, color: accent, fontFamily: T.display }}>{value}</div>
    </IronCard>
  );
}

export default function CustomerQuotations() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [quotations, setQuotations] = useState([]);

  useEffect(() => {
    fetchQuotations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const fetchQuotations = async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.get(`${API}/customer/quotations`, { headers });
      setQuotations(res.data || []);
    } catch (error) {
      console.error('Failed to fetch quotations:', error);
      toast.error('Failed to load quotations');
    } finally {
      setLoading(false);
    }
  };

  const pendingCount = quotations.filter((q) => ['sent', 'viewed'].includes(q.status)).length;
  const approvedCount = quotations.filter((q) => q.status === 'approved' || q.status === 'converted').length;
  const totalValue = quotations.reduce((sum, q) => sum + (q.grand_total || 0), 0);

  const headers = ['PI NUMBER', 'COMPANY', 'DATE', 'VALID TILL', 'AMOUNT', 'STATUS', 'ACTION'];

  const btnBase = {
    display: 'inline-flex', alignItems: 'center', gap: 5, borderRadius: 6,
    padding: '6px 12px', fontFamily: T.headline, fontWeight: 700, fontSize: 11.5, cursor: 'pointer',
  };

  return (
    <IronShell
      title="My Quotations"
      subtitle={`${quotations.length} TOTAL · ${pendingCount} NEED RESPONSE`}
      onRefresh={fetchQuotations}
    >
      {loading ? (
        <div style={{ display: 'grid', placeItems: 'center', height: 240 }}>
          <Loader2 className="animate-spin" size={30} color={T.orange} />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Summary tiles */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
            <Tile label="Total Quotations" value={quotations.length} />
            <Tile label="Pending Response" value={pendingCount} accent={pendingCount > 0 ? T.orange : T.iron900} />
            <Tile label="Approved" value={approvedCount} accent={approvedCount > 0 ? T.green : T.iron900} />
            <Tile label="Total Value" value={formatCurrency(totalValue)} accent={T.blue} />
          </div>

          {/* Quotations table */}
          <IronCard pad={0}>
            <div style={{ padding: '13px 16px', borderBottom: `1px solid ${T.iron200}` }}>
              <span style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron900 }}>All Quotations</span>
            </div>

            {quotations.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '56px 20px', textAlign: 'center' }}>
                <div style={{ display: 'grid', placeItems: 'center', height: 56, width: 56, borderRadius: '50%', background: T.iron100, marginBottom: 14 }}>
                  <FileText size={26} color={T.iron400} />
                </div>
                <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 15, color: T.iron900 }}>No quotations yet</div>
                <div style={{ marginTop: 4, fontSize: 13, color: T.iron500 }}>When you receive quotations from MuscleGrid, they will appear here</div>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 620 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                      {headers.map((h, i) => (
                        <th key={h} style={{ ...thCell, textAlign: i === 4 ? 'right' : 'left' }}>
                          <Caps size={8.5}>{h}</Caps>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {quotations.map((q) => {
                      const cfg = STATUS_TONES[q.status] || STATUS_TONES.draft;
                      const needsAction = ['sent', 'viewed'].includes(q.status);
                      const isExpired = q.validity_date && new Date(q.validity_date) < new Date();
                      return (
                        <tr
                          key={q.id}
                          className="iron-row"
                          style={{ borderBottom: `1px solid ${T.iron200}`, background: needsAction ? '#FEF7F0' : undefined }}
                        >
                          <td style={tdCell}>
                            <span style={{ ...mono, fontSize: 12, fontWeight: 700, color: T.iron900 }}>{q.quotation_number}</span>
                          </td>
                          <td style={{ ...tdCell, color: T.iron700 }}>{q.firm_name}</td>
                          <td style={{ ...tdCell, ...mono, fontSize: 11.5, color: T.iron500 }}>{formatDate(q.created_at)}</td>
                          <td style={{ ...tdCell, ...mono, fontSize: 11.5 }}>
                            <span style={{ color: isExpired && needsAction ? T.orangeDeep : T.iron500 }}>
                              {formatDate(q.validity_date)}
                              {isExpired && needsAction && (
                                <span style={{ marginLeft: 4, fontSize: 10, color: T.orangeDeep }}>(Expired)</span>
                              )}
                            </span>
                          </td>
                          <td style={{ ...tdCell, textAlign: 'right' }}>
                            <span style={{ ...mono, fontSize: 13, fontWeight: 700, color: T.iron900 }}>{formatCurrency(q.grand_total)}</span>
                          </td>
                          <td style={tdCell}>
                            <span style={badgeStyle(cfg.tone)}>{cfg.label}</span>
                          </td>
                          <td style={tdCell}>
                            {q.access_token && (
                              <Link to={`/pi/${q.access_token}`} style={{ textDecoration: 'none' }}>
                                <span
                                  style={needsAction
                                    ? { ...btnBase, border: 'none', background: T.orange, color: '#fff' }
                                    : { ...btnBase, border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700 }}
                                >
                                  {needsAction ? <><Eye size={14} /> Review</> : <><ExternalLink size={14} /> View</>}
                                </span>
                              </Link>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </IronCard>

          {/* How it works */}
          <IronCard pad={16}>
            <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 13, color: T.iron900, marginBottom: 12 }}>How it works</div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                'When you receive a quotation, it will appear here with "Pending Review" status',
                'Click "Review" to view the full quotation details and pricing',
                'You can approve or reject the quotation from the detail page',
                'Once approved, our team will process your order',
              ].map((txt, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <span style={{ marginTop: 1, display: 'grid', placeItems: 'center', height: 16, width: 16, flexShrink: 0, borderRadius: '50%', background: '#FEF0E4', color: T.orangeDeep, fontFamily: T.headline, fontWeight: 700, fontSize: 9 }}>{i + 1}</span>
                  <span style={{ ...mono, fontSize: 11.5, color: T.iron500 }}>{txt}</span>
                </li>
              ))}
            </ul>
          </IronCard>

        </div>
      )}
    </IronShell>
  );
}
