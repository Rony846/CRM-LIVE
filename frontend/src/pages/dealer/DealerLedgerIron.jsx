import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { toast } from 'sonner';
import IronShell from '@/components/iron/IronShell';
import {
  T, Caps, IronCard, mono, thCell, tdCell, badgeStyle,
} from '@/components/iron/IronKit';
import {
  Wallet, ArrowUpRight, ArrowDownRight, Loader2, Search,
  FileText, Building2, Shield, CheckCircle, Clock, AlertTriangle,
} from 'lucide-react';

/* Dealer Account Ledger — Iron Console redesign.
   Preserves the single GET /dealer/ledger call, summary cards, client-side search
   filter, ledger list, and the informational footer note. */

export default function DealerLedger() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (token) {
      fetchLedger();
    }
  }, [token]);

  const fetchLedger = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/dealer/ledger`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setData(response.data);
    } catch (error) {
      toast.error('Failed to load ledger');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount || 0);

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const filteredEntries = (data?.ledger_entries || []).filter((entry) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (entry.description || entry.narration || '').toLowerCase().includes(term) ||
      (entry.reference || entry.reference_type || '').toLowerCase().includes(term) ||
      (entry.type || entry.entry_type || '').toLowerCase().includes(term)
    );
  });

  const deposit = data?.security_deposit || {};
  const currentBalance = data?.current_balance || 0;

  const inputStyle = {
    border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '7px 10px 7px 32px',
    fontSize: 12.5, color: T.iron900, background: T.white, outline: 'none', width: '100%',
  };

  const depositTone = deposit.status === 'approved' ? 'ok'
    : deposit.status === 'pending_review' ? 'warn'
    : deposit.status === 'rejected' ? 'bad' : 'slate';
  const depositLabel = (deposit.status || 'Not Paid').replace(/_/g, ' ');

  const balanceColor = currentBalance > 0 ? T.rose : currentBalance < 0 ? T.green : T.iron900;
  const balanceTone = currentBalance > 0 ? 'bad' : currentBalance < 0 ? 'ok' : 'slate';
  const balanceLabel = currentBalance > 0 ? 'Outstanding' : currentBalance < 0 ? 'Credit' : 'Clear';

  if (loading) {
    return (
      <IronShell title="Ledger" subtitle="FINANCE · ACCOUNT">
        <div style={{ display: 'grid', placeItems: 'center', height: 260 }}>
          <Loader2 className="animate-spin" size={30} color={T.orange} />
        </div>
      </IronShell>
    );
  }

  const KpiCard = ({ label, value, sub, icon, iconBg, iconColor, valueColor, footer, borderColor }) => (
    <IronCard pad={16} style={borderColor ? { borderColor } : undefined}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <Caps size={9.5} color={T.iron400}>{label}</Caps>
          <div style={{ ...mono, fontSize: 24, fontWeight: 800, color: valueColor || T.iron900, marginTop: 6 }}>
            {value}
          </div>
          {sub && <div style={{ fontSize: 11, color: T.iron500, marginTop: 4 }}>{sub}</div>}
        </div>
        <div style={{ height: 38, width: 38, flexShrink: 0, borderRadius: 6, display: 'grid', placeItems: 'center', background: iconBg, color: iconColor }}>
          {icon}
        </div>
      </div>
      {footer && <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>{footer}</div>}
    </IronCard>
  );

  return (
    <IronShell title="Ledger" subtitle="FINANCE · ACCOUNT" onRefresh={fetchLedger}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* Page heading */}
        <div>
          <div style={{ fontFamily: T.headline, fontWeight: 800, fontSize: 22, letterSpacing: '-.01em', color: T.iron900 }}>
            Account Ledger
          </div>
          <div style={{ fontSize: 13, color: T.iron500, marginTop: 2 }}>
            View your payment history and outstanding balance
          </div>
        </div>

        {/* Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
          <KpiCard
            label="Current Balance"
            value={formatCurrency(Math.abs(currentBalance))}
            valueColor={balanceColor}
            sub={currentBalance > 0 ? 'Amount to be paid' : undefined}
            icon={<Wallet size={18} />}
            iconBg={currentBalance > 0 ? '#FDEEE6' : T.greenTint}
            iconColor={currentBalance > 0 ? T.rose : T.green}
            borderColor={currentBalance > 0 ? '#F6D8BA' : currentBalance < 0 ? '#CBE5D6' : undefined}
            footer={<span style={badgeStyle(balanceTone)}>{balanceLabel}</span>}
          />

          <KpiCard
            label="Security Deposit"
            value={formatCurrency(deposit.amount)}
            sub={deposit.paid_at ? `Paid ${formatDate(deposit.paid_at)}` : undefined}
            icon={<Shield size={18} />}
            iconBg={T.blueTint}
            iconColor={T.blue}
            footer={
              <>
                {deposit.status === 'approved' && <CheckCircle size={13} color={T.green} />}
                {deposit.status === 'pending_review' && <Clock size={13} color={T.voltageText} />}
                {deposit.status === 'rejected' && <AlertTriangle size={13} color={T.orangeDeep} />}
                <span style={badgeStyle(depositTone)}>{depositLabel}</span>
              </>
            }
          />

          <KpiCard
            label="Total Transactions"
            value={data?.ledger_entries?.length || 0}
            sub="In ledger history"
            icon={<FileText size={18} />}
            iconBg="#EEE9F7"
            iconColor="#6D4AB0"
          />
        </div>

        {/* Ledger Entries */}
        <IronCard pad={0}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 16px', borderBottom: `1px solid ${T.iron200}` }}>
            <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 13.5, color: T.iron900 }}>
              Ledger History
            </div>
            <div style={{ position: 'relative', width: 260, maxWidth: '100%' }}>
              <Search size={14} color={T.iron400} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
              <input
                placeholder="Search transactions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          {filteredEntries.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 16px' }}>
              <FileText size={44} color={T.iron200} style={{ margin: '0 auto 12px' }} />
              <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron900 }}>
                No transactions found
              </div>
              <div style={{ fontSize: 12.5, color: T.iron500, marginTop: 4 }}>
                Ledger entries will appear here once you have transactions
              </div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                    <th style={thCell}><Caps size={8.5}>Date</Caps></th>
                    <th style={thCell}><Caps size={8.5}>Description</Caps></th>
                    <th style={{ ...thCell, textAlign: 'right' }}><Caps size={8.5}>Amount</Caps></th>
                    <th style={{ ...thCell, textAlign: 'right' }}><Caps size={8.5}>Balance</Caps></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEntries.map((entry, idx) => {
                    const isDebit = entry.type === 'debit' || (entry.debit || 0) > 0;
                    const amount = entry.debit || entry.credit || entry.amount || 0;
                    return (
                      <tr key={entry.id || idx} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                        <td style={{ ...tdCell, ...mono, color: T.iron500, whiteSpace: 'nowrap' }}>
                          {formatDate(entry.date || entry.created_at)}
                        </td>
                        <td style={tdCell}>
                          <div style={{ fontSize: 12.5, color: T.iron900 }}>
                            {entry.description || entry.narration || entry.particulars || 'Transaction'}
                          </div>
                          {(entry.reference || entry.entry_number) && (
                            <div style={{ ...mono, fontSize: 10, color: T.iron400, marginTop: 2 }}>
                              Ref: {entry.reference || entry.entry_number}
                            </div>
                          )}
                        </td>
                        <td style={{ ...tdCell, textAlign: 'right' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                            {isDebit
                              ? <ArrowUpRight size={13} color={T.rose} />
                              : <ArrowDownRight size={13} color={T.green} />}
                            <span style={{ ...mono, fontSize: 13, fontWeight: 700, color: isDebit ? T.rose : T.green }}>
                              {isDebit ? '+' : '-'}{formatCurrency(amount)}
                            </span>
                          </span>
                        </td>
                        <td style={{ ...tdCell, ...mono, textAlign: 'right', fontSize: 13, fontWeight: 700, color: T.iron900 }}>
                          {formatCurrency(entry.balance || 0)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </IronCard>

        {/* Info Note */}
        <IronCard pad={16} style={{ background: '#FDF4EC', borderColor: '#F6D8BA' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <Building2 size={20} color={T.orange} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 13, color: T.iron900 }}>
                About Your Ledger
              </div>
              <div style={{ fontSize: 12.5, color: T.iron700, marginTop: 4, lineHeight: 1.55 }}>
                This ledger shows all your financial transactions with MuscleGrid including orders, payments,
                credit notes, and adjustments. For any discrepancies, please contact your account manager.
              </div>
            </div>
          </div>
        </IronCard>
      </div>
    </IronShell>
  );
}
