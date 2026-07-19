import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { toast } from 'sonner';
import { BookOpen, Loader2, Search, Download, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell, badgeStyle } from '@/components/iron/IronKit';

const inputStyle = { border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '7px 10px', fontSize: 12.5, color: T.iron900, background: T.white, fontFamily: T.body, outline: 'none' };
const btnPrimary = { border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer' };
const btnOutline = { border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };

// Entry type -> label + Iron pill tone (mirrors legacy ENTRY_TYPE_CONFIG semantics).
const ENTRY_TYPE_CONFIG = {
  opening_balance:  { label: 'Opening Balance',  tone: 'slate'  },
  sales_invoice:    { label: 'Sales Invoice',     tone: 'info'   },
  purchase_invoice: { label: 'Purchase',          tone: 'violet' },
  payment_received: { label: 'Payment Received',  tone: 'ok'     },
  payment_made:     { label: 'Payment Made',      tone: 'bad'    },
  credit_note:      { label: 'Credit Note',       tone: 'bad'    },
  debit_note:       { label: 'Debit Note',        tone: 'warn'   },
};

const EntryTypeBadge = ({ entryType }) => {
  const cfg = ENTRY_TYPE_CONFIG[entryType] || { label: entryType, tone: 'slate' };
  return <span style={badgeStyle(cfg.tone)}>{cfg.label}</span>;
};

const inr = (n) => Number(n || 0).toLocaleString('en-IN');

export default function PartyLedger() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [parties, setParties] = useState([]);
  const [selectedPartyId, setSelectedPartyId] = useState('');
  const [ledgerData, setLedgerData] = useState(null);
  const [tally, setTally] = useState(null);  // authoritative Tally balances for the selected party
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchParties();
    // Deep-link from the Tally reconciliation view: ?party=<id> pre-selects & loads that party.
    const pid = new URLSearchParams(window.location.search).get('party');
    if (pid) { setSelectedPartyId(pid); fetchLedger(pid); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const fetchParties = async () => {
    try {
      const res = await axios.get(`${API}/parties`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setParties(res.data || []);
    } catch (error) {
      toast.error('Failed to load parties');
    } finally {
      setLoading(false);
    }
  };

  const fetchLedger = async (partyId) => {
    if (!partyId) return;

    setLoading(true);
    try {
      const params = {};
      if (dateRange.from) params.from_date = dateRange.from;
      if (dateRange.to) params.to_date = dateRange.to;

      const res = await axios.get(`${API}/party-ledger/${partyId}`, {
        headers: { Authorization: `Bearer ${token}` },
        params
      });
      setLedgerData(res.data);
      // Authoritative Tally balance (from the read-only synced mirror) for this party.
      setTally(null);
      try {
        const t = await axios.get(`${API}/parties/${partyId}/tally`, { headers: { Authorization: `Bearer ${token}` } });
        setTally(t.data?.tally_balances || []);
      } catch { setTally([]); }
    } catch (error) {
      toast.error('Failed to load ledger');
    } finally {
      setLoading(false);
    }
  };

  const handlePartyChange = (e) => {
    const partyId = e.target.value;
    setSelectedPartyId(partyId);
    fetchLedger(partyId);
  };

  const handleDateFilter = () => {
    if (selectedPartyId) {
      fetchLedger(selectedPartyId);
    }
  };

  const filteredParties = parties.filter(p => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return p.name?.toLowerCase().includes(search) ||
           p.phone?.includes(search) ||
           p.gstin?.toLowerCase().includes(search);
  });

  // CRM vs Tally reconciliation. CRM balance: +DR (receivable) / -CR (payable). Tally net =
  // receivable - payable across matched firms. Flag when they disagree beyond a small tolerance.
  let recon = null;
  if (tally && tally.length && ledgerData) {
    const tallyNet = tally.reduce((s, t) => s + (t.receivable || 0) - (t.payable || 0), 0);
    const crmNet = ledgerData.current_balance || 0;
    const diff = crmNet - tallyNet;
    const tol = Math.max(1, 0.005 * Math.max(Math.abs(crmNet), Math.abs(tallyNet)));
    recon = { crmNet, tallyNet, diff, mismatch: Math.abs(diff) > tol };
  }

  const exportCSV = () => {
    if (!ledgerData?.entries?.length) {
      toast.error('No data to export');
      return;
    }

    const headerRow = ['Date', 'Entry Number', 'Type', 'Narration', 'Debit', 'Credit', 'Balance'];
    const rows = ledgerData.entries.map(e => [
      new Date(e.created_at).toLocaleDateString(),
      e.entry_number,
      ENTRY_TYPE_CONFIG[e.entry_type]?.label || e.entry_type,
      e.narration,
      e.debit || 0,
      e.credit || 0,
      e.running_balance
    ]);

    const csv = [headerRow, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ledger_${ledgerData.party.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    toast.success('Ledger exported successfully');
  };

  const balColor = (v) => (v > 0 ? T.green : v < 0 ? T.rose : T.iron500);

  const content = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {loading && !ledgerData ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 240 }}>
          <Loader2 className="animate-spin" size={30} color={T.orange} />
        </div>
      ) : (
        <>
          {/* Filters */}
          <IronCard pad={14}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, alignItems: 'end' }}>
              <div style={{ gridColumn: 'span 2', minWidth: 0 }}>
                <Caps size={9} color={T.iron400}>Select Party</Caps>
                <div style={{ position: 'relative', marginTop: 6, marginBottom: 8 }}>
                  <Search size={15} color={T.iron400} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    placeholder="Search parties..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ ...inputStyle, width: '100%', paddingLeft: 32 }}
                  />
                </div>
                <select value={selectedPartyId} onChange={handlePartyChange} style={{ ...inputStyle, width: '100%' }}>
                  <option value="">Select a party</option>
                  {filteredParties.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.gstin ? `(${p.gstin})` : p.phone ? `(${p.phone})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Caps size={9} color={T.iron400}>From Date</Caps>
                <input
                  type="date"
                  value={dateRange.from}
                  onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
                  style={{ ...inputStyle, width: '100%', marginTop: 6 }}
                />
              </div>
              <div>
                <Caps size={9} color={T.iron400}>To Date</Caps>
                <input
                  type="date"
                  value={dateRange.to}
                  onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
                  style={{ ...inputStyle, width: '100%', marginTop: 6 }}
                />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={handleDateFilter} style={btnPrimary}>Apply Filter</button>
                {ledgerData && (
                  <button onClick={exportCSV} style={btnOutline}>
                    <Download size={14} /> Export
                  </button>
                )}
              </div>
            </div>
          </IronCard>

          {/* Party Summary */}
          {ledgerData && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
              <IronCard pad={14}>
                <Caps size={9} color={T.iron400}>Party Name</Caps>
                <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 18, color: T.iron900, marginTop: 4 }}>{ledgerData.party.name}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                  {ledgerData.party.party_types?.map(type => (
                    <span key={type} style={badgeStyle('slate')}>{type}</span>
                  ))}
                </div>
              </IronCard>
              <IronCard pad={14}>
                <Caps size={9} color={T.iron400}>Total Debit</Caps>
                <div style={{ ...mono, fontSize: 24, fontWeight: 800, color: T.green, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <ArrowUpRight size={18} /> ₹{inr(ledgerData.total_debit)}
                </div>
              </IronCard>
              <IronCard pad={14}>
                <Caps size={9} color={T.iron400}>Total Credit</Caps>
                <div style={{ ...mono, fontSize: 24, fontWeight: 800, color: T.rose, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <ArrowDownRight size={18} /> ₹{inr(ledgerData.total_credit)}
                </div>
              </IronCard>
              <IronCard pad={14}>
                <Caps size={9} color={T.iron400}>Current Balance</Caps>
                <div style={{ ...mono, fontSize: 24, fontWeight: 800, color: balColor(ledgerData.current_balance), marginTop: 4 }}>
                  ₹{inr(Math.abs(ledgerData.current_balance || 0))}
                  <span style={{ fontSize: 14, marginLeft: 4, fontWeight: 400 }}>
                    {ledgerData.current_balance > 0 ? 'DR' : ledgerData.current_balance < 0 ? 'CR' : ''}
                  </span>
                </div>
                <div style={{ marginTop: 4 }}>
                  <Caps size={9} color={T.iron400}>
                    {ledgerData.current_balance > 0 ? 'Receivable' : ledgerData.current_balance < 0 ? 'Payable' : 'Settled'}
                  </Caps>
                </div>
              </IronCard>
            </div>
          )}

          {/* Authoritative Tally balance (read-only, from the synced books) */}
          {tally && tally.length > 0 && (
            <IronCard pad={14} style={{ marginBottom: 14, borderLeft: `3px solid ${T.blue}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                <Caps size={9} color={T.blue}>Tally — authoritative books</Caps>
                <span style={{ fontSize: 10, color: T.iron400 }}>
                  read-only · synced {tally[0].synced_at ? new Date(tally[0].synced_at).toLocaleDateString() : ''}
                </span>
                {recon && (recon.mismatch ? (
                  <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 800 }}>
                    ⚠ CRM ≠ Tally · Δ ₹{inr(Math.abs(recon.diff))}
                  </span>
                ) : (
                  <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5, background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d', borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 800 }}>
                    ✓ Matches CRM
                  </span>
                ))}
              </div>
              {recon && recon.mismatch && (
                <div style={{ marginBottom: 10, fontSize: 11.5, color: T.iron600 || T.iron500 }}>
                  CRM says <b style={{ ...mono }}>₹{inr(Math.abs(recon.crmNet))} {recon.crmNet >= 0 ? 'DR' : 'CR'}</b>, Tally says <b style={{ ...mono }}>₹{inr(Math.abs(recon.tallyNet))} {recon.tallyNet >= 0 ? 'DR' : 'CR'}</b> — difference <b style={{ color: '#b91c1c' }}>₹{inr(Math.abs(recon.diff))}</b>. Review this party's entries.
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(230px,1fr))', gap: 10 }}>
                {tally.map((t, i) => (
                  <div key={i} style={{ border: `1px solid ${T.iron200}`, borderRadius: 8, padding: '10px 12px' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: T.iron700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.company}</div>
                    <div style={{ ...mono, fontSize: 22, fontWeight: 800, marginTop: 4, color: t.payable > 0 ? T.rose : T.green }}>
                      ₹{inr(Math.abs(t.closing_balance || t.payable || t.receivable || 0))}
                    </div>
                    <Caps size={8.5} color={T.iron400}>
                      {t.payable > 0 ? 'Payable (we owe)' : t.receivable > 0 ? 'Receivable' : (t.group || '')}
                    </Caps>
                    <div style={{ fontSize: 10, color: T.iron400, marginTop: 3 }}>{t.group} · matched by {t.matched_by}</div>
                  </div>
                ))}
              </div>
            </IronCard>
          )}

          {/* Ledger Entries */}
          {ledgerData ? (
            <IronCard pad={0}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 16px', borderBottom: `1px solid ${T.iron200}` }}>
                <BookOpen size={15} color={T.iron500} />
                <Caps size={10} color={T.iron700}>Ledger Entries ({ledgerData.entries?.length || 0})</Caps>
              </div>
              {ledgerData.entries?.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 0', color: T.iron400 }}>
                  <BookOpen size={44} style={{ margin: '0 auto 14px', opacity: 0.3 }} />
                  <Caps size={10} color={T.iron400}>No ledger entries found</Caps>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                        <th style={thCell}><Caps size={8.5}>Date</Caps></th>
                        <th style={thCell}><Caps size={8.5}>Entry #</Caps></th>
                        <th style={thCell}><Caps size={8.5}>Type</Caps></th>
                        <th style={thCell}><Caps size={8.5}>Narration</Caps></th>
                        <th style={{ ...thCell, textAlign: 'right' }}><Caps size={8.5}>Debit</Caps></th>
                        <th style={{ ...thCell, textAlign: 'right' }}><Caps size={8.5}>Credit</Caps></th>
                        <th style={{ ...thCell, textAlign: 'right' }}><Caps size={8.5}>Balance</Caps></th>
                      </tr>
                    </thead>
                    <tbody>
                      {ledgerData.entries.map((entry) => (
                        <tr key={entry.id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                          <td style={{ ...tdCell, ...mono, color: T.iron500 }}>
                            {new Date(entry.created_at).toLocaleDateString()}
                          </td>
                          <td style={{ ...tdCell, ...mono, color: T.blue }}>
                            {entry.entry_number}
                          </td>
                          <td style={tdCell}>
                            <EntryTypeBadge entryType={entry.entry_type} />
                          </td>
                          <td style={{ ...tdCell, color: T.iron900, maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {entry.narration}
                          </td>
                          <td style={{ ...tdCell, ...mono, color: T.green, textAlign: 'right' }}>
                            {entry.debit > 0 ? `₹${inr(entry.debit)}` : '-'}
                          </td>
                          <td style={{ ...tdCell, ...mono, color: T.rose, textAlign: 'right' }}>
                            {entry.credit > 0 ? `₹${inr(entry.credit)}` : '-'}
                          </td>
                          <td style={{ ...tdCell, ...mono, textAlign: 'right', fontWeight: 700, background: T.iron50, color: balColor(entry.running_balance) }}>
                            ₹{inr(Math.abs(entry.running_balance))}
                            <span style={{ fontSize: 11, marginLeft: 4, fontWeight: 400 }}>
                              {entry.running_balance > 0 ? 'DR' : entry.running_balance < 0 ? 'CR' : ''}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </IronCard>
          ) : (
            <IronCard pad={14}>
              <div style={{ textAlign: 'center', padding: '56px 0' }}>
                <div style={{ display: 'flex', height: 64, width: 64, alignItems: 'center', justifyContent: 'center', borderRadius: 8, background: T.iron100, margin: '0 auto 14px' }}>
                  <BookOpen size={30} color={T.iron400} />
                </div>
                <Caps size={10} color={T.iron400}>Select a party to view their ledger</Caps>
              </div>
            </IronCard>
          )}
        </>
      )}
    </div>
  );

  return (
    <IronShell
      title="Party Ledger"
      subtitle="ACCOUNTS / LEDGER"
      onRefresh={() => (selectedPartyId ? fetchLedger(selectedPartyId) : fetchParties())}
    >
      {content}
    </IronShell>
  );
}
