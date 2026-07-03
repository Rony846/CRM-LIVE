import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { toast } from 'sonner';
import {
  BarChart3, Loader2, Download, FileText,
  Clock, ArrowUpRight, ArrowDownRight, PieChart,
} from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell } from '@/components/iron/IronKit';

const inputStyle = { border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '7px 10px', fontSize: 12.5, color: T.iron900, background: T.white, fontFamily: T.body, outline: 'none' };
const inr = (v) => `₹${Number(v || 0).toLocaleString('en-IN')}`;

export default function AccountingReports() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [firms, setFirms] = useState([]);
  const [selectedFirm, setSelectedFirm] = useState('all');
  const [dateRange, setDateRange] = useState({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0],
  });

  const [receivablesData, setReceivablesData] = useState(null);
  const [payablesData, setPayablesData] = useState(null);
  const [profitData, setProfitData] = useState(null);
  const [activeTab, setActiveTab] = useState('receivables');

  useEffect(() => {
    fetchFirms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (activeTab === 'receivables') fetchReceivables();
    else if (activeTab === 'payables') fetchPayables();
    else if (activeTab === 'profit') fetchProfit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, selectedFirm, dateRange]);

  const fetchFirms = async () => {
    try {
      const res = await axios.get(`${API}/firms`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setFirms(res.data || []);
    } catch (error) {
      console.error('Failed to fetch firms');
    }
  };

  const fetchReceivables = async () => {
    setLoading(true);
    try {
      const params = {};
      if (selectedFirm !== 'all') params.firm_id = selectedFirm;
      if (dateRange.to) params.as_of_date = dateRange.to;

      const res = await axios.get(`${API}/reports/receivables`, {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });
      setReceivablesData(res.data);
    } catch (error) {
      toast.error('Failed to load receivables report');
    } finally {
      setLoading(false);
    }
  };

  const fetchPayables = async () => {
    setLoading(true);
    try {
      const params = {};
      if (selectedFirm !== 'all') params.firm_id = selectedFirm;
      if (dateRange.to) params.as_of_date = dateRange.to;

      const res = await axios.get(`${API}/reports/payables`, {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });
      setPayablesData(res.data);
    } catch (error) {
      toast.error('Failed to load payables report');
    } finally {
      setLoading(false);
    }
  };

  const fetchProfit = async () => {
    setLoading(true);
    try {
      const params = {};
      if (selectedFirm !== 'all') params.firm_id = selectedFirm;
      if (dateRange.from) params.from_date = dateRange.from;
      if (dateRange.to) params.to_date = dateRange.to;

      const res = await axios.get(`${API}/reports/profit-summary`, {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });
      setProfitData(res.data);
    } catch (error) {
      toast.error('Failed to load profit report');
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = (data, filename) => {
    if (!data) return;

    let csv = '';
    if (activeTab === 'receivables' && data.by_party) {
      csv = 'Party Name,Invoice Count,Outstanding Amount\n';
      csv += data.by_party.map(p =>
        `"${p.party_name}",${p.invoices.length},${p.total_outstanding}`
      ).join('\n');
    } else if (activeTab === 'payables' && data.by_supplier) {
      csv = 'Supplier Name,GSTIN,Purchase Count,Outstanding Amount\n';
      csv += data.by_supplier.map(s =>
        `"${s.supplier_name}","${s.supplier_gstin || ''}",${s.purchases.length},${s.total_outstanding}`
      ).join('\n');
    } else if (activeTab === 'profit' && data.monthly_breakdown) {
      csv = 'Month,Sales,Purchases,Credit Notes\n';
      csv += Object.entries(data.monthly_breakdown).map(([month, d]) =>
        `${month},${d.sales},${d.purchases},${d.credit_notes}`
      ).join('\n');
    }

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    toast.success('Report exported');
  };

  const refresh = () => {
    if (activeTab === 'receivables') fetchReceivables();
    else if (activeTab === 'payables') fetchPayables();
    else if (activeTab === 'profit') fetchProfit();
  };

  const tabs = [
    { key: 'receivables', label: 'Receivables', icon: ArrowUpRight },
    { key: 'payables', label: 'Payables', icon: ArrowDownRight },
    { key: 'profit', label: 'Profit Summary', icon: PieChart },
  ];

  // Small reusable KPI tile.
  const Kpi = ({ label, value, accent = T.iron900, sub }) => (
    <IronCard pad={14}>
      <Caps size={8.5} color={T.iron400}>{label}</Caps>
      <div style={{ ...mono, fontSize: 24, fontWeight: 700, color: accent, marginTop: 6, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ ...mono, fontSize: 10, color: T.iron400, marginTop: 4 }}>{sub}</div>}
    </IronCard>
  );

  const currentData =
    activeTab === 'receivables' ? receivablesData :
    activeTab === 'payables' ? payablesData : profitData;

  const ageColor = (bucket) =>
    bucket === '90+' ? T.orangeDeep :
    bucket === '61-90' ? T.orange :
    bucket === '31-60' ? T.voltageText : T.green;

  const headerRight = (
    <button
      onClick={() => exportCSV(currentData, activeTab)}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, borderRadius: 6, padding: '8px 14px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 12 }}
    >
      <Download size={14} /> Export CSV
    </button>
  );

  return (
    <IronShell
      title="Accounting Reports"
      subtitle="RECEIVABLES · PAYABLES · PROFIT"
      onRefresh={refresh}
      headerRight={headerRight}
    >
      {/* Filters */}
      <IronCard pad={14} style={{ marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          <div>
            <Caps size={9} color={T.iron400} style={{ display: 'block', marginBottom: 5 }}>Firm</Caps>
            <select value={selectedFirm} onChange={(e) => setSelectedFirm(e.target.value)} style={{ ...inputStyle, cursor: 'pointer', width: '100%' }}>
              <option value="all">All Firms</option>
              {firms.map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>
          <div>
            <Caps size={9} color={T.iron400} style={{ display: 'block', marginBottom: 5 }}>From Date</Caps>
            <input type="date" value={dateRange.from} onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })} style={{ ...inputStyle, width: '100%' }} />
          </div>
          <div>
            <Caps size={9} color={T.iron400} style={{ display: 'block', marginBottom: 5 }}>To Date</Caps>
            <input type="date" value={dateRange.to} onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })} style={{ ...inputStyle, width: '100%' }} />
          </div>
        </div>
      </IronCard>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {tabs.map((tb) => {
          const Icon = tb.icon;
          const on = activeTab === tb.key;
          return (
            <button key={tb.key} onClick={() => setActiveTab(tb.key)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, border: `1px solid ${on ? T.iron900 : T.iron200}`, background: on ? T.iron900 : T.white, color: on ? '#fff' : T.iron700, borderRadius: 999, padding: '7px 15px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 600, fontSize: 12 }}>
              <Icon size={14} />{tb.label}
            </button>
          );
        })}
      </div>

      {loading && (
        <div style={{ display: 'grid', placeItems: 'center', height: 300 }}>
          <Loader2 className="animate-spin" size={30} color={T.iron400} />
        </div>
      )}

      {/* Receivables Tab */}
      {activeTab === 'receivables' && receivablesData && !loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            <Kpi label="Total Receivable" value={inr(receivablesData.total_receivable)} accent={T.green} />
            <Kpi label="Invoice Count" value={Number(receivablesData.invoice_count || 0).toLocaleString('en-IN')} />
            <Kpi label="Parties with Due" value={Number(receivablesData.party_count || 0).toLocaleString('en-IN')} />
            <Kpi label="Overdue (90+ days)" value={inr(receivablesData.age_analysis?.['90+'] || 0)} accent={T.orangeDeep} />
          </div>

          {/* Age Analysis */}
          <IronCard pad={0}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '13px 16px', borderBottom: `1px solid ${T.iron200}` }}>
              <Clock size={15} color={T.iron500} /><Caps size={11} color={T.iron900} ls=".1em">Age Analysis</Caps>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, padding: 16 }}>
              {Object.entries(receivablesData.age_analysis || {}).map(([bucket, amount]) => (
                <div key={bucket} style={{ padding: 14, background: T.iron50, border: `1px solid ${T.iron200}`, borderRadius: 8, textAlign: 'center' }}>
                  <Caps size={9} color={T.iron400}>{bucket} days</Caps>
                  <div style={{ ...mono, fontSize: 18, fontWeight: 700, color: ageColor(bucket), marginTop: 6 }}>{inr(amount)}</div>
                </div>
              ))}
            </div>
          </IronCard>

          {/* Party-wise Table */}
          <IronCard pad={0}>
            <div style={{ padding: '13px 16px', borderBottom: `1px solid ${T.iron200}` }}>
              <Caps size={11} color={T.iron900} ls=".1em">Party-wise Outstanding</Caps>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                  <th style={thCell}><Caps size={8.5}>Party Name</Caps></th>
                  <th style={{ ...thCell, textAlign: 'center' }}><Caps size={8.5}>Invoices</Caps></th>
                  <th style={{ ...thCell, textAlign: 'right' }}><Caps size={8.5}>Outstanding</Caps></th>
                </tr></thead>
                <tbody>{receivablesData.by_party?.map((party) => (
                  <tr key={party.party_id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                    <td style={{ ...tdCell, fontFamily: T.headline, fontWeight: 600, fontSize: 12.5, color: T.iron900 }}>{party.party_name}</td>
                    <td style={{ ...tdCell, ...mono, color: T.iron500, textAlign: 'center' }}>{party.invoices.length}</td>
                    <td style={{ ...tdCell, ...mono, color: T.green, fontWeight: 700, textAlign: 'right' }}>{inr(party.total_outstanding)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </IronCard>
        </div>
      )}

      {/* Payables Tab */}
      {activeTab === 'payables' && payablesData && !loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            <Kpi label="Total Payable" value={inr(payablesData.total_payable)} accent={T.orange} />
            <Kpi label="Purchase Count" value={Number(payablesData.purchase_count || 0).toLocaleString('en-IN')} />
            <Kpi label="Suppliers" value={Number(payablesData.supplier_count || 0).toLocaleString('en-IN')} />
          </div>

          <IronCard pad={0}>
            <div style={{ padding: '13px 16px', borderBottom: `1px solid ${T.iron200}` }}>
              <Caps size={11} color={T.iron900} ls=".1em">Supplier-wise Outstanding</Caps>
            </div>
            {payablesData.by_supplier?.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: T.iron400, fontFamily: T.mono, fontSize: 12 }}>No outstanding payables</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                    <th style={thCell}><Caps size={8.5}>Supplier</Caps></th>
                    <th style={thCell}><Caps size={8.5}>GSTIN</Caps></th>
                    <th style={{ ...thCell, textAlign: 'center' }}><Caps size={8.5}>Purchases</Caps></th>
                    <th style={{ ...thCell, textAlign: 'right' }}><Caps size={8.5}>Outstanding</Caps></th>
                  </tr></thead>
                  <tbody>{payablesData.by_supplier?.map((supplier, idx) => (
                    <tr key={idx} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                      <td style={{ ...tdCell, fontFamily: T.headline, fontWeight: 600, fontSize: 12.5, color: T.iron900 }}>{supplier.supplier_name}</td>
                      <td style={{ ...tdCell, ...mono, color: T.iron500 }}>{supplier.supplier_gstin || '-'}</td>
                      <td style={{ ...tdCell, ...mono, color: T.iron500, textAlign: 'center' }}>{supplier.purchases.length}</td>
                      <td style={{ ...tdCell, ...mono, color: T.orange, fontWeight: 700, textAlign: 'right' }}>{inr(supplier.total_outstanding)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </IronCard>
        </div>
      )}

      {/* Profit Summary Tab */}
      {activeTab === 'profit' && profitData && !loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            <Kpi label="Net Sales" value={inr(profitData.summary?.net_sales)} accent={T.green}
              sub={`After ${inr(profitData.summary?.total_credit_notes)} credit notes`} />
            <Kpi label="Total Purchases" value={inr(profitData.summary?.total_purchases)} accent={T.orange} />
            <Kpi label="Gross Profit" value={inr(profitData.summary?.gross_profit)}
              accent={profitData.summary?.gross_profit >= 0 ? T.blue : T.orangeDeep}
              sub={`${profitData.summary?.gross_margin_percent}% margin`} />
            <Kpi label="GST Liability"
              value={`${inr(Math.abs(profitData.summary?.gst_liability || 0))} ${profitData.summary?.gst_liability >= 0 ? 'payable' : 'credit'}`}
              accent={profitData.summary?.gst_liability >= 0 ? '#6D4AB0' : T.green} />
          </div>

          {/* Counts */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {[
              { icon: FileText, tint: T.greenTint, ic: T.green, value: profitData.counts?.sales_invoices, label: 'Sales Invoices' },
              { icon: FileText, tint: '#FDEEE6', ic: T.orange, value: profitData.counts?.purchases, label: 'Purchases' },
              { icon: FileText, tint: '#FDEEE6', ic: T.orangeDeep, value: profitData.counts?.credit_notes, label: 'Credit Notes' },
            ].map((c, i) => {
              const Icon = c.icon;
              return (
                <IronCard key={i} pad={16} style={{ textAlign: 'center' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 8, display: 'grid', placeItems: 'center', background: c.tint, color: c.ic, margin: '0 auto 12px' }}>
                    <Icon size={18} />
                  </div>
                  <div style={{ ...mono, fontSize: 24, fontWeight: 700, color: T.iron900 }}>{c.value}</div>
                  <Caps size={9} color={T.iron400} style={{ display: 'block', marginTop: 4 }}>{c.label}</Caps>
                </IronCard>
              );
            })}
          </div>

          {/* Monthly Breakdown */}
          <IronCard pad={0}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '13px 16px', borderBottom: `1px solid ${T.iron200}` }}>
              <BarChart3 size={15} color={T.iron500} /><Caps size={11} color={T.iron900} ls=".1em">Monthly Breakdown</Caps>
            </div>
            {Object.keys(profitData.monthly_breakdown || {}).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: T.iron400, fontFamily: T.mono, fontSize: 12 }}>No data for selected period</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                    <th style={thCell}><Caps size={8.5}>Month</Caps></th>
                    <th style={{ ...thCell, textAlign: 'right' }}><Caps size={8.5}>Sales</Caps></th>
                    <th style={{ ...thCell, textAlign: 'right' }}><Caps size={8.5}>Purchases</Caps></th>
                    <th style={{ ...thCell, textAlign: 'right' }}><Caps size={8.5}>Credit Notes</Caps></th>
                    <th style={{ ...thCell, textAlign: 'right' }}><Caps size={8.5}>Net</Caps></th>
                  </tr></thead>
                  <tbody>{Object.entries(profitData.monthly_breakdown || {}).map(([month, data]) => {
                    const net = data.sales - data.credit_notes - data.purchases;
                    return (
                      <tr key={month} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                        <td style={{ ...tdCell, fontFamily: T.headline, fontWeight: 600, fontSize: 12.5, color: T.iron900 }}>{month}</td>
                        <td style={{ ...tdCell, ...mono, color: T.green, textAlign: 'right' }}>{inr(data.sales)}</td>
                        <td style={{ ...tdCell, ...mono, color: T.orange, textAlign: 'right' }}>{inr(data.purchases)}</td>
                        <td style={{ ...tdCell, ...mono, color: T.orangeDeep, textAlign: 'right' }}>{inr(data.credit_notes)}</td>
                        <td style={{ ...tdCell, ...mono, fontWeight: 700, textAlign: 'right', color: net >= 0 ? T.blue : T.orangeDeep }}>{inr(net)}</td>
                      </tr>
                    );
                  })}</tbody>
                </table>
              </div>
            )}
          </IronCard>
        </div>
      )}
    </IronShell>
  );
}
