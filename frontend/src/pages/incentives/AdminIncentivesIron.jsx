import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  DollarSign, CheckCircle, Loader2, Users, Settings, Wallet, Award, Plus, Save, Pencil, Trash2, Undo2, IndianRupee, Clock
} from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell, badgeStyle } from '@/components/iron/IronKit';

const inputStyle = { border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '7px 10px', fontSize: 12.5, color: T.iron900, background: T.white, fontFamily: T.body, outline: 'none' };

// Incentive status -> label + Iron pill tone (mirrors legacy STATUS_CONFIG).
const STATUS_TONE = {
  pending: ['Pending', 'warn'],
  approved: ['Approved', 'info'],
  paid: ['Paid', 'ok'],
  cancelled: ['Cancelled', 'bad'],
};
const statusPill = (status) => {
  const [label, tone] = STATUS_TONE[status] || [status, 'slate'];
  return { label, style: badgeStyle(tone) };
};

export default function AdminIncentives() {
  const { token, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('summary');
  const [summary, setSummary] = useState(null);
  const [incentives, setIncentives] = useState([]);
  const [configs, setConfigs] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selectedAgent, setSelectedAgent] = useState('all');
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [manualIncentiveOpen, setManualIncentiveOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const [newConfig, setNewConfig] = useState({
    month: new Date().toISOString().slice(0, 7),
    incentive_type: 'fixed',
    fixed_amount: 500,
    percentage: 1,
    min_sale_value: 1000,
    max_incentive: 5000,
    notes: ''
  });

  const [manualIncentive, setManualIncentive] = useState({
    user_id: '',
    amount: '',
    reason: '',
    month: new Date().toISOString().slice(0, 7)
  });

  // Edit incentive state
  const [editIncentiveOpen, setEditIncentiveOpen] = useState(false);
  const [editingIncentive, setEditingIncentive] = useState(null);
  const [editForm, setEditForm] = useState({
    amount: '',
    reason: ''
  });

  useEffect(() => {
    if (token) {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, selectedMonth, selectedAgent]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };

      const [summaryRes, configsRes, usersRes] = await Promise.all([
        axios.get(`${API}/admin/incentives/summary`, { headers, params: { month: selectedMonth } }),
        axios.get(`${API}/admin/incentive-config`, { headers }),
        axios.get(`${API}/admin/users`, { headers }).catch(() => ({ data: [] }))
      ]);

      setSummary(summaryRes.data);
      setConfigs(configsRes.data || []);
      // Filter users who can receive incentives (supervisors, call support, technicians, etc.)
      const eligibleRoles = ['supervisor', 'call_support', 'technician', 'accountant', 'production'];
      setUsers((usersRes.data || []).filter(u => eligibleRoles.includes(u.role) || u.role));

      // Fetch detailed incentives if needed
      const params = { month: selectedMonth };
      if (selectedAgent !== 'all') params.agent_id = selectedAgent;

      const incentivesRes = await axios.get(`${API}/admin/incentives`, { headers, params });
      setIncentives(incentivesRes.data?.incentives || []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load incentives data');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    setActionLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      await axios.post(`${API}/admin/incentive-config`, newConfig, { headers });
      toast.success('Configuration saved');
      setConfigDialogOpen(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save configuration');
    } finally {
      setActionLoading(false);
    }
  };

  const handleBulkApprove = async (agentId = null) => {
    setActionLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const params = { month: selectedMonth };
      if (agentId) params.agent_id = agentId;

      await axios.post(`${API}/admin/incentives/bulk-approve`, null, { headers, params });
      toast.success('Incentives approved');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to approve');
    } finally {
      setActionLoading(false);
    }
  };

  const handleBulkPaid = async (agentId = null) => {
    setActionLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const params = { month: selectedMonth };
      if (agentId) params.agent_id = agentId;

      await axios.post(`${API}/admin/incentives/bulk-paid`, null, { headers, params });
      toast.success('Incentives marked as paid');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to mark as paid');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddManualIncentive = async () => {
    if (!manualIncentive.user_id || !manualIncentive.amount || !manualIncentive.reason) {
      toast.error('Please fill all required fields');
      return;
    }

    setActionLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      await axios.post(`${API}/admin/incentives/manual`, {
        user_id: manualIncentive.user_id,
        amount: parseFloat(manualIncentive.amount),
        reason: manualIncentive.reason,
        month: manualIncentive.month
      }, { headers });

      toast.success('Manual incentive added successfully');
      setManualIncentiveOpen(false);
      setManualIncentive({
        user_id: '',
        amount: '',
        reason: '',
        month: new Date().toISOString().slice(0, 7)
      });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add incentive');
    } finally {
      setActionLoading(false);
    }
  };

  // Edit Incentive Handler
  const openEditIncentive = (incentive) => {
    setEditingIncentive(incentive);
    setEditForm({
      amount: incentive.incentive_amount?.toString() || '',
      reason: incentive.reason || incentive.quotation_number || ''
    });
    setEditIncentiveOpen(true);
  };

  const handleUpdateIncentive = async () => {
    if (!editForm.amount) {
      toast.error('Please enter an amount');
      return;
    }

    setActionLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      await axios.put(`${API}/admin/incentives/${editingIncentive.id}`, {
        amount: parseFloat(editForm.amount),
        reason: editForm.reason
      }, { headers });

      toast.success('Incentive updated successfully');
      setEditIncentiveOpen(false);
      setEditingIncentive(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update incentive');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteIncentive = async (incentive) => {
    if (!window.confirm(`Delete this incentive of ${formatCurrency(incentive.incentive_amount)} for ${incentive.agent_name}?`)) {
      return;
    }

    setActionLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      await axios.delete(`${API}/admin/incentives/${incentive.id}`, { headers });

      toast.success('Incentive deleted successfully');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete incentive');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevertIncentive = async (incentive) => {
    if (!window.confirm(`Revert this PAID incentive of ${formatCurrency(incentive.incentive_amount)} for ${incentive.agent_name} back to PENDING?\n\nNote: This will allow you to edit or delete it.`)) {
      return;
    }

    setActionLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      await axios.put(`${API}/admin/incentives/${incentive.id}/revert`, {}, { headers });

      toast.success('Incentive reverted to pending. You can now edit or delete it.');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to revert incentive');
    } finally {
      setActionLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  // Generate month options
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

  const statCards = [
    { label: 'Total Incentives', value: formatCurrency(summary?.totals?.total_incentive || 0), sub: `${summary?.totals?.total_conversions || 0} conversions`, icon: IndianRupee, tone: T.blue },
    { label: 'Pending Approval', value: formatCurrency(summary?.totals?.pending_incentive || 0), sub: null, icon: Clock, tone: T.voltageText },
    { label: 'Paid Out', value: formatCurrency(summary?.totals?.paid_incentive || 0), sub: null, icon: Wallet, tone: T.green },
    { label: 'Active Agents', value: (summary?.agents?.length || 0).toLocaleString('en-IN'), sub: null, icon: Users, tone: '#6D4AB0' },
  ];

  const tabs = [
    { key: 'summary', label: 'Agent Summary', icon: Users },
    { key: 'details', label: 'All Transactions', icon: DollarSign },
    { key: 'config', label: 'Configuration', icon: Settings },
  ];

  const primaryBtn = { border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
  const outlineBtn = { border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
  const rowActionStyle = { display: 'inline-flex', alignItems: 'center', gap: 4, border: `1px solid ${T.orange}`, background: T.white, color: T.orangeDeep, borderRadius: 6, padding: '5px 9px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 11 };
  const smallBtn = (bg) => ({ border: 'none', background: bg, color: '#fff', borderRadius: 6, padding: '5px 11px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 11 });

  const headerRight = (
    <div style={{ display: 'flex', gap: 8 }}>
      <button onClick={() => setManualIncentiveOpen(true)} style={primaryBtn}>
        <Plus size={14} strokeWidth={2.2} /> Add Manual Incentive
      </button>
      <button onClick={() => setConfigDialogOpen(true)} style={outlineBtn}>
        <Settings size={14} strokeWidth={2} /> Configure
      </button>
    </div>
  );

  return (
    <IronShell title="Incentives" subtitle="SALARY & INCENTIVES · TEAM PAYOUTS" onRefresh={fetchData} headerRight={headerRight}>

      {loading ? (
        <div style={{ display: 'grid', placeItems: 'center', height: 320 }}><Loader2 className="animate-spin" size={30} color={T.iron400} /></div>
      ) : (
        <>
          {/* Stat cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
            {statCards.map((s) => {
              const Icon = s.icon;
              return (
                <IronCard key={s.label} pad={14}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 8, display: 'grid', placeItems: 'center', background: T.iron50, border: `1px solid ${T.iron200}` }}>
                      <Icon size={18} color={s.tone} strokeWidth={1.9} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ ...mono, fontSize: 19, fontWeight: 700, color: T.iron900, lineHeight: 1.1 }}>{s.value}</div>
                      <Caps size={9} color={T.iron400} style={{ display: 'block', marginTop: 4 }}>{s.label}</Caps>
                      {s.sub && <div style={{ ...mono, fontSize: 10.5, color: T.iron400, marginTop: 2 }}>{s.sub}</div>}
                    </div>
                  </div>
                </IronCard>
              );
            })}
          </div>

          {/* Filters + bulk actions */}
          <IronCard pad={14} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <Caps size={9}>Month</Caps>
                <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} style={{ ...inputStyle, cursor: 'pointer', minWidth: 180 }}>
                  {getMonthOptions().map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <Caps size={9}>Agent</Caps>
                <select value={selectedAgent} onChange={(e) => setSelectedAgent(e.target.value)} style={{ ...inputStyle, cursor: 'pointer', minWidth: 180 }}>
                  <option value="all">All Agents</option>
                  {summary?.agents?.map(agent => (
                    <option key={agent.agent_id} value={agent.agent_id}>{agent.agent_name}</option>
                  ))}
                </select>
              </div>

              <div style={{ flex: 1 }} />

              <button onClick={() => handleBulkApprove()} disabled={actionLoading} style={{ ...primaryBtn, background: T.blue, opacity: actionLoading ? 0.6 : 1 }}>
                <CheckCircle size={14} strokeWidth={2} /> Approve All Pending
              </button>
              <button onClick={() => handleBulkPaid()} disabled={actionLoading} style={{ ...primaryBtn, background: T.green, opacity: actionLoading ? 0.6 : 1 }}>
                <Wallet size={14} strokeWidth={2} /> Mark All Paid
              </button>
            </div>
          </IronCard>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            {tabs.map((tb) => {
              const Icon = tb.icon;
              const active = activeTab === tb.key;
              return (
                <button key={tb.key} onClick={() => setActiveTab(tb.key)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${active ? T.orange : T.iron200}`, background: active ? T.orange : T.white, color: active ? '#fff' : T.iron700, borderRadius: 6, padding: '7px 13px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 12 }}>
                  <Icon size={14} strokeWidth={2} />{tb.label}
                </button>
              );
            })}
          </div>

          {/* Agent Summary Tab */}
          {activeTab === 'summary' && (
            <IronCard pad={0} style={{ overflow: 'hidden' }}>
              <div style={{ padding: '12px 14px', borderBottom: `1px solid ${T.iron200}`, background: T.iron50, fontFamily: T.headline, fontWeight: 700, fontSize: 13, color: T.iron900 }}>
                Agent Performance — {summary?.month}
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                    {['Agent', 'Conversions', 'Total Sales', 'Total Incentive', 'Pending', 'Paid', 'Actions'].map((h, i) => (
                      <th key={i} style={{ ...thCell, textAlign: i >= 1 && i <= 5 ? 'right' : 'left' }}><Caps size={8.5}>{h}</Caps></th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {(summary?.agents?.length || 0) === 0 ? (
                      <tr><td colSpan={7} style={{ textAlign: 'center', padding: '48px 0', color: T.iron400, fontSize: 13 }}>No incentives for this month</td></tr>
                    ) : (
                      summary.agents.map((agent) => (
                        <tr key={agent.agent_id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                          <td style={tdCell}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ width: 28, height: 28, borderRadius: 999, background: T.orange, color: '#fff', display: 'grid', placeItems: 'center', fontFamily: T.headline, fontWeight: 700, fontSize: 12 }}>
                                {agent.agent_name?.charAt(0) || '?'}
                              </div>
                              <span style={{ fontFamily: T.headline, fontWeight: 600, fontSize: 12.5, color: T.iron900 }}>{agent.agent_name}</span>
                            </div>
                          </td>
                          <td style={{ ...tdCell, ...mono, textAlign: 'right', fontWeight: 700, color: T.iron900 }}>{agent.conversions}</td>
                          <td style={{ ...tdCell, ...mono, textAlign: 'right', color: T.iron900 }}>{formatCurrency(agent.total_sales)}</td>
                          <td style={{ ...tdCell, ...mono, textAlign: 'right', fontWeight: 700, color: T.blue }}>{formatCurrency(agent.total_incentive)}</td>
                          <td style={{ ...tdCell, ...mono, textAlign: 'right', color: T.voltageText }}>{formatCurrency(agent.pending_incentive)}</td>
                          <td style={{ ...tdCell, ...mono, textAlign: 'right', color: T.green }}>{formatCurrency(agent.paid_incentive)}</td>
                          <td style={tdCell}>
                            <div style={{ display: 'inline-flex', gap: 6 }}>
                              {agent.pending_incentive > 0 && (
                                <button onClick={() => handleBulkApprove(agent.agent_id)} disabled={actionLoading} style={{ ...smallBtn(T.blue), opacity: actionLoading ? 0.6 : 1 }}>Approve</button>
                              )}
                              {(agent.pending_incentive > 0 || agent.total_incentive - agent.paid_incentive > 0) && (
                                <button onClick={() => handleBulkPaid(agent.agent_id)} disabled={actionLoading} style={{ ...smallBtn(T.green), opacity: actionLoading ? 0.6 : 1 }}>Pay</button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </IronCard>
          )}

          {/* Details Tab */}
          {activeTab === 'details' && (
            <IronCard pad={0} style={{ overflow: 'hidden' }}>
              <div style={{ padding: '12px 14px', borderBottom: `1px solid ${T.iron200}`, background: T.iron50, fontFamily: T.headline, fontWeight: 700, fontSize: 13, color: T.iron900 }}>
                All Incentive Transactions
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                    {['Date', 'Agent', 'Source / PI', 'Reason / Customer', 'Sale Value', 'Incentive', 'Status', 'Actions'].map((h, i) => (
                      <th key={i} style={{ ...thCell, textAlign: i === 4 || i === 5 ? 'right' : 'left' }}><Caps size={8.5}>{h}</Caps></th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {incentives.length === 0 ? (
                      <tr><td colSpan={8} style={{ textAlign: 'center', padding: '48px 0', color: T.iron400, fontSize: 13 }}>No transactions found</td></tr>
                    ) : (
                      incentives.map((inc) => {
                        const sp = statusPill(inc.status);
                        return (
                          <tr key={inc.id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                            <td style={{ ...tdCell, ...mono, fontSize: 11, color: T.iron500 }}>{formatDate(inc.created_at)}</td>
                            <td style={{ ...tdCell, fontFamily: T.headline, fontWeight: 600, fontSize: 12.5, color: T.iron900 }}>{inc.agent_name}</td>
                            <td style={tdCell}>
                              {inc.source === 'manual' ? (
                                <span style={badgeStyle('violet')}>Manual</span>
                              ) : (
                                <span style={{ ...mono, fontSize: 11.5, color: T.iron700 }}>{inc.quotation_number || '-'}</span>
                              )}
                            </td>
                            <td style={{ ...tdCell, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: T.iron700 }}>
                              {inc.reason || inc.customer_name || '-'}
                            </td>
                            <td style={{ ...tdCell, ...mono, textAlign: 'right', color: T.iron900 }}>{inc.sale_value ? formatCurrency(inc.sale_value) : '-'}</td>
                            <td style={{ ...tdCell, ...mono, textAlign: 'right', fontWeight: 700, color: T.green }}>+{formatCurrency(inc.incentive_amount)}</td>
                            <td style={tdCell}><span style={sp.style}>{sp.label}</span></td>
                            <td style={tdCell}>
                              {inc.status !== 'paid' ? (
                                <div style={{ display: 'inline-flex', gap: 6 }}>
                                  <button onClick={() => openEditIncentive(inc)} disabled={actionLoading} title="Edit" style={rowActionStyle}><Pencil size={13} /></button>
                                  <button onClick={() => handleDeleteIncentive(inc)} disabled={actionLoading} title="Delete" style={{ ...rowActionStyle, border: `1px solid ${T.iron200}` }}><Trash2 size={13} /></button>
                                </div>
                              ) : (
                                <button onClick={() => handleRevertIncentive(inc)} disabled={actionLoading} title="Revert to Pending" style={{ ...rowActionStyle, border: `1px solid ${T.iron200}` }}>
                                  <Undo2 size={13} /><span style={{ fontSize: 11 }}>Revert</span>
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </IronCard>
          )}

          {/* Config Tab */}
          {activeTab === 'config' && (
            <IronCard pad={0} style={{ overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                <span style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 13, color: T.iron900 }}>Incentive Configuration</span>
                <button onClick={() => setConfigDialogOpen(true)} style={primaryBtn}><Plus size={14} strokeWidth={2.2} /> Add Configuration</button>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                    {['Month', 'Type', 'Fixed Amount', 'Percentage', 'Min Sale Value', 'Max Incentive', 'Status'].map((h, i) => (
                      <th key={i} style={{ ...thCell, textAlign: i >= 2 && i <= 5 ? 'right' : 'left' }}><Caps size={8.5}>{h}</Caps></th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {configs.length === 0 ? (
                      <tr><td colSpan={7} style={{ textAlign: 'center', padding: '48px 0', color: T.iron400 }}>
                        <Settings size={40} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
                        <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron700 }}>No configuration found</div>
                        <div style={{ fontSize: 12, marginTop: 3 }}>Add a configuration to enable incentives</div>
                      </td></tr>
                    ) : (
                      configs.map((config) => (
                        <tr key={config.id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                          <td style={{ ...tdCell, fontFamily: T.headline, fontWeight: 600, fontSize: 12.5, color: T.iron900 }}>
                            {config.month === 'default' ? 'Default' :
                              new Date(config.month + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                          </td>
                          <td style={tdCell}>
                            <span style={badgeStyle(config.incentive_type === 'fixed' ? 'info' : 'violet')}>
                              {config.incentive_type === 'fixed' ? 'Fixed' : 'Percentage'}
                            </span>
                          </td>
                          <td style={{ ...tdCell, ...mono, textAlign: 'right', color: T.iron900 }}>{config.incentive_type === 'fixed' ? formatCurrency(config.fixed_amount) : '-'}</td>
                          <td style={{ ...tdCell, ...mono, textAlign: 'right', color: T.iron900 }}>{config.incentive_type === 'percentage' ? `${config.percentage}%` : '-'}</td>
                          <td style={{ ...tdCell, ...mono, textAlign: 'right', color: T.iron700 }}>{formatCurrency(config.min_sale_value)}</td>
                          <td style={{ ...tdCell, ...mono, textAlign: 'right', color: T.iron700 }}>{config.max_incentive ? formatCurrency(config.max_incentive) : '-'}</td>
                          <td style={tdCell}>
                            <span style={badgeStyle(config.is_active ? 'ok' : 'slate')}>{config.is_active ? 'Active' : 'Inactive'}</span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </IronCard>
          )}
        </>
      )}

      {/* Configuration Dialog */}
      <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
        <DialogContent className="max-w-md" aria-describedby="config-dialog-description">
          <DialogHeader>
            <DialogTitle>Incentive Configuration</DialogTitle>
          </DialogHeader>
          <p id="config-dialog-description" className="sr-only">Configure incentive settings for the selected month</p>

          <div className="space-y-4">
            <div>
              <Label>Month</Label>
              <Select value={newConfig.month} onValueChange={(v) => setNewConfig({ ...newConfig, month: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default (All Months)</SelectItem>
                  {getMonthOptions().map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Incentive Type</Label>
              <Select value={newConfig.incentive_type} onValueChange={(v) => setNewConfig({ ...newConfig, incentive_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">Fixed Amount per Conversion</SelectItem>
                  <SelectItem value="percentage">Percentage of Sale Value</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {newConfig.incentive_type === 'fixed' && (
              <div>
                <Label>Fixed Amount (Rs.)</Label>
                <Input
                  type="number"
                  value={newConfig.fixed_amount}
                  onChange={(e) => setNewConfig({ ...newConfig, fixed_amount: parseFloat(e.target.value) || 0 })}
                />
              </div>
            )}

            {newConfig.incentive_type === 'percentage' && (
              <>
                <div>
                  <Label>Percentage (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={newConfig.percentage}
                    onChange={(e) => setNewConfig({ ...newConfig, percentage: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label>Maximum Incentive Cap (Rs.)</Label>
                  <Input
                    type="number"
                    value={newConfig.max_incentive || ''}
                    onChange={(e) => setNewConfig({ ...newConfig, max_incentive: parseFloat(e.target.value) || null })}
                    placeholder="No cap"
                  />
                </div>
              </>
            )}

            <div>
              <Label>Minimum Sale Value (Rs.)</Label>
              <Input
                type="number"
                value={newConfig.min_sale_value}
                onChange={(e) => setNewConfig({ ...newConfig, min_sale_value: parseFloat(e.target.value) || 0 })}
              />
              <p className="text-slate-500 text-xs mt-1">Only conversions above this value will earn incentives</p>
            </div>

            <div>
              <Label>Notes</Label>
              <Input
                value={newConfig.notes}
                onChange={(e) => setNewConfig({ ...newConfig, notes: e.target.value })}
                placeholder="Optional notes..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveConfig} disabled={actionLoading}>
              {actionLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save Configuration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual Incentive Dialog */}
      <Dialog open={manualIncentiveOpen} onOpenChange={setManualIncentiveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Award className="w-5 h-5 text-green-600" />
              Add Manual Incentive
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Select Employee *</Label>
              <Select value={manualIncentive.user_id} onValueChange={(v) => setManualIncentive({ ...manualIncentive, user_id: v })}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent className="max-h-60">
                  {users.map(u => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.first_name} {u.last_name} ({u.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Incentive Amount (₹) *</Label>
              <Input
                type="number"
                value={manualIncentive.amount}
                onChange={(e) => setManualIncentive({ ...manualIncentive, amount: e.target.value })}
                placeholder="Enter amount"
                className="mt-1"
                min={0}
              />
            </div>

            <div>
              <Label>Month *</Label>
              <Select value={manualIncentive.month} onValueChange={(v) => setManualIncentive({ ...manualIncentive, month: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {getMonthOptions().map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Reason / Notes *</Label>
              <Input
                value={manualIncentive.reason}
                onChange={(e) => setManualIncentive({ ...manualIncentive, reason: e.target.value })}
                placeholder="e.g., Performance bonus, Special achievement, etc."
                className="mt-1"
              />
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <p className="text-slate-500 text-sm">
                <strong className="text-slate-900">Note:</strong> Manual incentives are added on top of auto-calculated incentives. They will appear in the employee's incentive summary and can be approved/paid like regular incentives.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setManualIncentiveOpen(false)}>Cancel</Button>
            <Button
              onClick={handleAddManualIncentive}
              disabled={actionLoading || !manualIncentive.user_id || !manualIncentive.amount || !manualIncentive.reason}
            >
              {actionLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Add Incentive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Incentive Dialog */}
      <Dialog open={editIncentiveOpen} onOpenChange={setEditIncentiveOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Incentive</DialogTitle>
            <DialogDescription>
              Update incentive for {editingIncentive?.agent_name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {editingIncentive && (
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <p className="text-slate-500 text-sm">Current Amount</p>
                <p className="text-green-600 text-lg font-bold">{formatCurrency(editingIncentive.incentive_amount)}</p>
                {editingIncentive.source === 'manual' && (
                  <span style={{ ...badgeStyle('violet'), marginTop: 8 }}>Manual Incentive</span>
                )}
              </div>
            )}

            <div>
              <Label>New Amount (₹) *</Label>
              <Input
                type="number"
                value={editForm.amount}
                onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                placeholder="Enter new amount"
                className="mt-1"
                min={0}
              />
            </div>

            <div>
              <Label>Reason / Notes</Label>
              <Input
                value={editForm.reason}
                onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })}
                placeholder="Reason for incentive"
                className="mt-1"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditIncentiveOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdateIncentive} disabled={actionLoading || !editForm.amount}>
              {actionLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </IronShell>
  );
}
