import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { toast } from 'sonner';
import {
  Loader2, AlertTriangle, CheckCircle, IndianRupee,
  FileText, Package, Wallet, ChevronLeft, Scale,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono } from '@/components/iron/IronKit';

/* Iron Console conversion of the Accountant "Monthly Reconciliation" report.
   Behaviour-preserving: same two endpoints (GET /firms, GET /compliance/reconciliation),
   same month/firm filters, same four reconciliation cards + discrepancies table. */

const SEVERITY_TONE = {
  critical:  ['#FDE7E3', T.orangeDeep, '#F6C9BC'],
  important: ['#FDEEE6', T.orange, '#F6D8BA'],
  minor:     [T.voltageTint, T.voltageText, '#EDDFA6'],
};
const SeverityBadge = ({ severity }) => {
  const [bg, fg, bd] = SEVERITY_TONE[severity] || [T.iron100, T.iron700, T.iron200];
  return (
    <span style={{ background: bg, color: fg, border: `1px solid ${bd}`, padding: '2px 8px', borderRadius: 999,
      fontFamily: T.mono, fontWeight: 700, fontSize: 9.5, letterSpacing: '.05em', textTransform: 'uppercase', whiteSpace: 'nowrap', display: 'inline-block' }}>
      {severity}
    </span>
  );
};

const MatchBadge = ({ match }) => {
  const [bg, fg, bd] = match ? [T.greenTint, T.green, '#CBE5D6'] : ['#FDE7E3', T.orangeDeep, '#F6C9BC'];
  return (
    <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4, background: bg, color: fg, border: `1px solid ${bd}`,
      padding: '2px 8px', borderRadius: 999, fontFamily: T.headline, fontWeight: 700, fontSize: 9.5, letterSpacing: '.05em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
      {match ? <CheckCircle size={11} /> : <AlertTriangle size={11} />}
      {match ? 'Match' : 'Mismatch'}
    </span>
  );
};

const inputStyle = { border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '7px 10px', fontSize: 12.5, color: T.iron900, background: T.white, outline: 'none', width: '100%' };

// Card row helper — label left, value right (mono, tabular).
const Row = ({ label, value, labelColor, valueColor, valueWeight = 400, rowBg, indent = false }) => (
  <tr style={{ borderBottom: `1px solid ${T.iron200}`, background: rowBg || 'transparent' }}>
    <td style={{ padding: indent ? '9px 14px 9px 26px' : '9px 14px', fontSize: indent ? 11.5 : 12.5, color: labelColor || T.iron500 }}>{label}</td>
    <td style={{ padding: '9px 14px', textAlign: 'right', ...mono, fontSize: 12.5, color: valueColor || T.iron900, fontWeight: valueWeight }}>{value}</td>
  </tr>
);

const CardHead = ({ Icon, iconColor, title, children }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '13px 14px', borderBottom: `1px solid ${T.iron200}` }}>
    <Icon size={15} color={iconColor} />
    <Caps size={11} color={T.iron900} ls=".1em">{title}</Caps>
    {children}
  </div>
);

export default function ReconciliationReports() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [firms, setFirms] = useState([]);
  const [selectedFirm, setSelectedFirm] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  useEffect(() => {
    fetchFirms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (token) fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, selectedFirm, selectedMonth]);

  const fetchFirms = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.get(`${API}/firms`, { headers });
      setFirms(res.data || []);
    } catch (error) {
      console.error('Failed to fetch firms:', error);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const params = { month: selectedMonth };
      if (selectedFirm !== 'all') params.firm_id = selectedFirm;

      const res = await axios.get(`${API}/compliance/reconciliation`, { headers, params });
      setData(res.data);
    } catch (error) {
      console.error('Failed to fetch reconciliation data:', error);
      toast.error('Failed to load reconciliation report');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  // Generate month options (last 12 months)
  const getMonthOptions = () => {
    const options = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = date.toISOString().slice(0, 7);
      const label = date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
      options.push({ value, label });
    }
    return options;
  };

  const headerRight = (
    <button
      onClick={() => navigate(-1)}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700,
        borderRadius: 6, padding: '7px 12px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 600, fontSize: 12 }}
    >
      <ChevronLeft size={15} /> Back
    </button>
  );

  const pr = data?.purchase_reconciliation || {};
  const sr = data?.sales_reconciliation || {};
  const pay = data?.payment_reconciliation || {};
  const gst = data?.gst_reconciliation || {};

  return (
    <IronShell
      title="Monthly Reconciliation"
      subtitle="CROSS-VERIFY REGISTERS · LEDGERS · TRANSACTIONS"
      onRefresh={fetchData}
      headerRight={headerRight}
    >
      {loading ? (
        <div style={{ display: 'grid', placeItems: 'center', height: 300 }}>
          <Loader2 className="animate-spin" size={30} color={T.iron400} />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Title strip */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Scale size={22} color={T.orange} />
            <div>
              <div style={{ fontFamily: T.headline, fontWeight: 800, fontSize: 18, color: T.iron900 }}>Monthly Reconciliation Report</div>
              <Caps size={9} color={T.iron400} ls=".08em" style={{ display: 'block', marginTop: 2 }}>Cross-verify registers, ledgers, and transactions</Caps>
            </div>
          </div>

          {/* Filters */}
          <IronCard>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 16 }}>
              <div style={{ width: 200 }}>
                <Caps size={9} color={T.iron400} style={{ display: 'block', marginBottom: 5 }}>Month</Caps>
                <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} style={inputStyle}>
                  {getMonthOptions().map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div style={{ width: 240 }}>
                <Caps size={9} color={T.iron400} style={{ display: 'block', marginBottom: 5 }}>Firm</Caps>
                <select value={selectedFirm} onChange={(e) => setSelectedFirm(e.target.value)} style={inputStyle}>
                  <option value="all">All Firms</option>
                  {firms.map((firm) => (
                    <option key={firm.id} value={firm.id}>{firm.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ flex: 1 }} />

              <div style={{ textAlign: 'right' }}>
                <Caps size={9} color={T.iron400} style={{ display: 'block' }}>Generated at</Caps>
                <div style={{ ...mono, fontSize: 13, color: T.iron900, marginTop: 3 }}>
                  {data?.generated_at ? new Date(data.generated_at).toLocaleString('en-IN') : '-'}
                </div>
              </div>
            </div>
          </IronCard>

          {/* Discrepancies alert */}
          {data?.discrepancy_count > 0 && (
            <div style={{ background: '#FDE7E3', border: '1px solid #F6C9BC', borderLeft: `4px solid ${T.orangeDeep}`, borderRadius: 8, padding: '12px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <AlertTriangle size={20} color={T.orangeDeep} style={{ flexShrink: 0 }} />
                <div>
                  <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 13.5, color: T.orangeDeep }}>
                    {data.discrepancy_count} Discrepanc{data.discrepancy_count === 1 ? 'y' : 'ies'} Found
                  </div>
                  <Caps size={9} color={T.orangeDeep} ls=".04em" style={{ display: 'block', marginTop: 3, opacity: 0.8 }}>
                    Review the details below and take corrective action
                  </Caps>
                </div>
              </div>
            </div>
          )}

          {/* Reconciliation cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16 }}>
            {/* Purchase Reconciliation */}
            <IronCard pad={0}>
              <CardHead Icon={Package} iconColor={T.blue} title="Purchase vs Stock Inward">
                <MatchBadge match={pr.match} />
              </CardHead>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  <Row label="Purchase Register Entries" value={pr.purchase_register_count || 0} valueWeight={700} />
                  <Row label="Purchase Register Value" value={formatCurrency(pr.purchase_register_value)} />
                  <Row label="Stock Inward Entries" value={pr.stock_inward_count || 0} valueWeight={700} />
                </tbody>
              </table>
            </IronCard>

            {/* Sales Reconciliation */}
            <IronCard pad={0}>
              <CardHead Icon={FileText} iconColor={T.green} title="Sales vs Dispatch">
                <MatchBadge match={sr.match} />
              </CardHead>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  <Row label="Sales Register Entries" value={sr.sales_register_count || 0} valueWeight={700} />
                  <Row label="Sales Register Value" value={formatCurrency(sr.sales_register_value)} />
                  <Row label="Dispatches" value={sr.dispatch_count || 0} valueWeight={700} />
                  {sr.dispatches_without_invoice > 0 && (
                    <Row label="Dispatches Without Invoice" value={sr.dispatches_without_invoice} valueWeight={700}
                      labelColor={T.orangeDeep} valueColor={T.orangeDeep} rowBg="#FDE7E3" />
                  )}
                </tbody>
              </table>
            </IronCard>

            {/* Payment Reconciliation */}
            <IronCard pad={0}>
              <CardHead Icon={Wallet} iconColor="#6D4AB0" title="Payment Summary" />
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  <Row label="Payments Received" value={`+${formatCurrency(pay.payments_received_value)}`} valueColor={T.green} valueWeight={700} />
                  <Row indent label="Count" value={`${pay.payments_received_count || 0} transactions`} valueColor={T.iron400} />
                  <Row label="Payments Made" value={`-${formatCurrency(pay.payments_made_value)}`} valueColor={T.orangeDeep} valueWeight={700} />
                  <Row indent label="Count" value={`${pay.payments_made_count || 0} transactions`} valueColor={T.iron400} />
                  <Row label="Outstanding Receivable" value={formatCurrency(pay.outstanding_receivable)}
                    labelColor={T.voltageText} valueColor={T.voltageText} valueWeight={700} rowBg={T.voltageTint} />
                  <Row label="Outstanding Payable" value={formatCurrency(pay.outstanding_payable)}
                    labelColor={T.orangeDeep} valueColor={T.orangeDeep} valueWeight={700} rowBg="#FDE7E3" />
                </tbody>
              </table>
            </IronCard>

            {/* GST Reconciliation */}
            <IronCard pad={0}>
              <CardHead Icon={IndianRupee} iconColor={T.blue} title="GST Reconciliation" />
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  <Row label="Output GST (Sales)" value={formatCurrency(gst.sales_gst)} />
                  <Row label="Input Tax Credit (Purchases)" value={`-${formatCurrency(gst.purchase_gst_itc)}`} valueColor={T.green} />
                  <Row label="Net GST Liability" value={formatCurrency(gst.net_gst_liability)}
                    labelColor={T.blue} valueWeight={700} rowBg={T.iron50}
                    valueColor={(gst.net_gst_liability || 0) >= 0 ? T.orangeDeep : T.green} />
                </tbody>
              </table>
              {gst.note && (
                <div style={{ ...mono, fontSize: 10.5, color: T.iron400, fontStyle: 'italic', padding: '10px 14px 12px' }}>
                  {gst.note}
                </div>
              )}
            </IronCard>
          </div>

          {/* Discrepancies table */}
          {data?.discrepancies?.length > 0 && (
            <IronCard pad={0}>
              <CardHead Icon={AlertTriangle} iconColor={T.orangeDeep} title="Discrepancies Found" />
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                    {['Type', 'Description', 'Severity'].map((h) => (
                      <th key={h} style={{ textAlign: 'left', padding: '7px 14px' }}><Caps size={8.5}>{h}</Caps></th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.discrepancies.map((d, idx) => (
                    <tr key={idx} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                      <td style={{ padding: '10px 14px', ...mono, fontSize: 12, color: T.iron900 }}>
                        {d.type.replace(/_/g, ' ').toUpperCase()}
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: T.iron700 }}>{d.description}</td>
                      <td style={{ padding: '10px 14px' }}><SeverityBadge severity={d.severity} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </IronCard>
          )}

          {/* No discrepancies message */}
          {data?.discrepancy_count === 0 && (
            <div style={{ background: T.greenTint, border: '1px solid #CBE5D6', borderRadius: 8, padding: 28, textAlign: 'center' }}>
              <CheckCircle size={44} color={T.green} style={{ margin: '0 auto 12px' }} />
              <div style={{ fontFamily: T.headline, fontWeight: 800, fontSize: 18, color: T.green }}>All Clear!</div>
              <Caps size={9} color={T.green} ls=".08em" style={{ display: 'block', marginTop: 5, opacity: 0.8 }}>
                No discrepancies found for {selectedMonth}
              </Caps>
            </div>
          )}
        </div>
      )}
    </IronShell>
  );
}
