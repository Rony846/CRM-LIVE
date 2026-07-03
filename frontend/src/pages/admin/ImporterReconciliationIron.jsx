import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { Users, IndianRupee, Percent, Package, FileText } from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell, badgeStyle } from '@/components/iron/IronKit';

const fmt = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

const selectStyle = { border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '7px 10px', fontSize: 12.5, color: T.iron900, background: T.white, outline: 'none' };

function KpiTile({ label, value, icon: Icon, color }) {
  return (
    <IronCard pad={14} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div>
        <Caps size={9} color={T.iron400}>{label}</Caps>
        <div style={{ fontFamily: T.display, fontWeight: 800, fontSize: 28, lineHeight: 1.1, marginTop: 4, color: color || T.iron900, ...mono }}>{value}</div>
      </div>
      <Icon size={26} strokeWidth={1.6} color={color || T.iron400} />
    </IronCard>
  );
}

export default function ImporterReconciliation() {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const h = { headers: { Authorization: `Bearer ${token}` } };

  const fetchData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const r = await axios.get(`${API}/admin/importer-reconciliation`, h);
      setData(r.data);
    } catch (e) { /* */ } finally { setLoading(false); }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const byImp = data?.by_importer || {};
  const impNames = Object.keys(byImp);

  const rows = useMemo(() => {
    const all = data?.rows || [];
    return filter === 'all' ? all : all.filter(r => (r.importer_name || r.importer_id) === filter);
  }, [data, filter]);

  const totals = useMemo(() => rows.reduce((a, r) => ({
    landed: a.landed + (r.landed_cost || 0),
    commission: a.commission + (r.commission_amount || 0),
    billed: a.billed + (r.total_billed || 0),
  }), { landed: 0, commission: 0, billed: 0 }), [rows]);

  const allRows = data?.rows || [];

  return (
    <IronShell
      title="Importer Reconciliation"
      subtitle="LANDED · COMMISSION · BILLED TO MGIPL"
      onRefresh={fetchData}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 1400 }}>
        <p style={{ fontFamily: T.body, fontSize: 12.5, color: T.iron500, margin: 0, maxWidth: 900 }}>
          The you-vs-them view across all importers — landed cost they paid, their commission, and what they bill MGIPL.
          Each billed consignment posts an MGIPL payable automatically.
        </p>

        {/* Grand totals */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 12 }}>
          <KpiTile label="Importers" value={impNames.length} icon={Users} />
          <KpiTile label="Consignments" value={allRows.length} icon={Package} />
          <KpiTile label="Total Commission" value={fmt(allRows.reduce((s, r) => s + (r.commission_amount || 0), 0))} icon={Percent} color={T.voltageText} />
          <KpiTile label="Total Billed to MGIPL" value={fmt(data?.grand_total_billed)} icon={IndianRupee} color={T.green} />
        </div>

        {/* Per-importer breakdown */}
        <IronCard pad={0}>
          <div style={{ padding: '12px 14px', borderBottom: `1px solid ${T.iron200}` }}>
            <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron900 }}>By Importer</div>
            <div style={{ fontFamily: T.body, fontSize: 11.5, color: T.iron500, marginTop: 2 }}>Per-importer totals — what each partner has billed MGIPL.</div>
          </div>
          {loading ? (
            <div style={{ padding: 16, fontSize: 12.5, color: T.iron400 }}>Loading…</div>
          ) : impNames.length === 0 ? (
            <div style={{ padding: 16, fontSize: 12.5, color: T.iron400 }}>No consignments yet.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                  <th style={thCell}><Caps size={8.5}>Importer</Caps></th>
                  <th style={{ ...thCell, textAlign: 'right' }}><Caps size={8.5}>Consignments</Caps></th>
                  <th style={{ ...thCell, textAlign: 'right' }}><Caps size={8.5}>Landed ₹</Caps></th>
                  <th style={{ ...thCell, textAlign: 'right' }}><Caps size={8.5}>Commission ₹</Caps></th>
                  <th style={{ ...thCell, textAlign: 'right' }}><Caps size={8.5}>Billed to MGIPL ₹</Caps></th>
                </tr>
              </thead>
              <tbody>
                {impNames.map(name => (
                  <tr key={name} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                    <td style={{ ...tdCell, fontWeight: 600, color: T.iron900 }}>{name}</td>
                    <td style={{ ...tdCell, textAlign: 'right', ...mono }}>{byImp[name].consignments}</td>
                    <td style={{ ...tdCell, textAlign: 'right', ...mono }}>{fmt(byImp[name].landed)}</td>
                    <td style={{ ...tdCell, textAlign: 'right', ...mono, color: T.voltageText }}>{fmt(byImp[name].commission)}</td>
                    <td style={{ ...tdCell, textAlign: 'right', ...mono, fontWeight: 700, color: T.green }}>{fmt(byImp[name].billed)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </IronCard>

        {/* All consignments */}
        <IronCard pad={0}>
          <div style={{ padding: '12px 14px', borderBottom: `1px solid ${T.iron200}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron900 }}>All Consignments</div>
              <div style={{ fontFamily: T.body, fontSize: 11.5, color: T.iron500, marginTop: 2 }}>Line-by-line reconciliation across every importer.</div>
            </div>
            <select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ ...selectStyle, minWidth: 190 }}>
              <option value="all">All importers</option>
              {impNames.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          {loading ? (
            <div style={{ padding: 16, fontSize: 12.5, color: T.iron400 }}>Loading…</div>
          ) : rows.length === 0 ? (
            <div style={{ padding: 16, fontSize: 12.5, color: T.iron400 }}>No consignments.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                    <th style={thCell}><Caps size={8.5}>Consignment</Caps></th>
                    <th style={thCell}><Caps size={8.5}>Invoice</Caps></th>
                    <th style={thCell}><Caps size={8.5}>Importer</Caps></th>
                    <th style={thCell}><Caps size={8.5}>Date</Caps></th>
                    <th style={thCell}><Caps size={8.5}>Supplier</Caps></th>
                    <th style={{ ...thCell, textAlign: 'right' }}><Caps size={8.5}>Supplier ₹</Caps></th>
                    <th style={{ ...thCell, textAlign: 'right' }}><Caps size={8.5}>Customs ₹</Caps></th>
                    <th style={{ ...thCell, textAlign: 'right' }}><Caps size={8.5}>Shipping ₹</Caps></th>
                    <th style={{ ...thCell, textAlign: 'right' }}><Caps size={8.5}>Landed ₹</Caps></th>
                    <th style={{ ...thCell, textAlign: 'right' }}><Caps size={8.5}>Comm.</Caps></th>
                    <th style={{ ...thCell, textAlign: 'right' }}><Caps size={8.5}>Billed ₹</Caps></th>
                    <th style={thCell}><Caps size={8.5}>BoE</Caps></th>
                    <th style={thCell}><Caps size={8.5}>Status</Caps></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(c => (
                    <tr key={c.id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                      <td style={{ ...tdCell, ...mono, fontSize: 11 }}>{c.consignment_number}</td>
                      <td style={{ ...tdCell, fontWeight: 600 }}>{c.invoice_number || '—'}</td>
                      <td style={tdCell}>{c.importer_name || '—'}</td>
                      <td style={{ ...tdCell, ...mono }}>{c.date}</td>
                      <td style={tdCell}>{c.supplier_name || '—'}</td>
                      <td style={{ ...tdCell, textAlign: 'right', ...mono }}>{fmt(c.supplier_payment_inr)}</td>
                      <td style={{ ...tdCell, textAlign: 'right', ...mono }}>{fmt(c.customs_total)}</td>
                      <td style={{ ...tdCell, textAlign: 'right', ...mono }}>{fmt(c.shipping_charges)}</td>
                      <td style={{ ...tdCell, textAlign: 'right', ...mono }}>{fmt(c.landed_cost)}</td>
                      <td style={{ ...tdCell, textAlign: 'right', ...mono, color: T.voltageText }}>{c.commission_percent}% · {fmt(c.commission_amount)}</td>
                      <td style={{ ...tdCell, textAlign: 'right', ...mono, fontWeight: 700, color: T.green }}>{fmt(c.total_billed)}</td>
                      <td style={tdCell}>{(() => { const b = (c.attachments || []).find(a => a.kind === 'boe'); return b
                        ? <a href={b.url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: T.blue, textDecoration: 'none' }}><FileText size={13} />View</a>
                        : <span style={{ fontSize: 11.5, color: T.iron400 }}>—</span>; })()}</td>
                      <td style={tdCell}><span style={badgeStyle(c.status === 'draft' ? 'warn' : 'ok')}>{c.status}</span></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: `2px solid ${T.iron200}`, background: T.iron50, fontWeight: 700 }}>
                    <td style={{ ...tdCell, textAlign: 'right', color: T.iron900 }} colSpan={8}>Totals ({rows.length})</td>
                    <td style={{ ...tdCell, textAlign: 'right', ...mono, color: T.iron900 }}>{fmt(totals.landed)}</td>
                    <td style={{ ...tdCell, textAlign: 'right', ...mono, color: T.voltageText }}>{fmt(totals.commission)}</td>
                    <td style={{ ...tdCell, textAlign: 'right', ...mono, color: T.green }}>{fmt(totals.billed)}</td>
                    <td style={tdCell}></td>
                    <td style={tdCell}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </IronCard>
      </div>
    </IronShell>
  );
}
