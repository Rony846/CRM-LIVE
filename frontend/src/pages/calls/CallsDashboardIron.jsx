import { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Phone, PhoneMissed, Clock, User, Play, RefreshCw, Search, Headphones, PhoneCall,
  Loader2, CheckCircle, XCircle, Brain, FileText, MessageSquare, ListTodo, UserPlus,
  Timer, AlertCircle, Link, History, Sparkles, ChevronLeft, ChevronRight, ThumbsUp,
} from 'lucide-react';
import { toast } from 'sonner';
import ClickToCallButton from '@/components/calls/ClickToCallButton';
import { cn } from '@/lib/utils';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell, badgeStyle } from '@/components/iron/IronKit';

// Call outcomes
const CALL_OUTCOMES = [
  { value: 'sale_completed', label: 'Sale Completed' },
  { value: 'quote_sent', label: 'Quote Sent' },
  { value: 'callback_scheduled', label: 'Callback Scheduled' },
  { value: 'not_interested', label: 'Not Interested' },
  { value: 'issue_resolved', label: 'Issue Resolved' },
  { value: 'ticket_created', label: 'Ticket Created' },
  { value: 'escalated', label: 'Escalated' },
  { value: 'information_provided', label: 'Information Provided' },
  { value: 'wrong_number', label: 'Wrong Number' },
  { value: 'no_answer', label: 'No Answer' },
  { value: 'voicemail', label: 'Left Voicemail' },
  { value: 'follow_up_required', label: 'Follow Up Required' },
];

// Legacy Tailwind badge (used only inside the dark shadcn dialogs, kept verbatim)
const BADGE_CLS = 'px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wide ring-1 whitespace-nowrap';

// ─── Iron style helpers ──────────────────────────────────────────────────────
const inputStyle = { border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '7px 10px', fontSize: 12.5, color: T.iron900, background: T.white, fontFamily: T.body, outline: 'none' };
const btnPrimary = { border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
const btnOutline = { border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
const iconBtn = { border: 'none', background: 'transparent', cursor: 'pointer', padding: 4, borderRadius: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' };

const statusTone = (s) => ({ answered: 'ok', missed: 'bad', dialed: 'warn' }[s] || 'warn');
const priorityTone = (p) => ({ urgent: 'bad', high: 'warn', normal: 'info', low: 'slate' }[p] || 'slate');
const taskTypeTone = (t) => ({ callback: 'info', sales_lead: 'ok', tech_support: 'violet', complaint: 'bad', general: 'slate' }[t] || 'slate');
const severityTone = (s) => ({ critical: 'bad', high: 'warn', medium: 'warn' }[s] || 'warn');

// ─── Dialog call info block (dark shadcn dialog context) ─────────────────────
const CallInfoBlock = ({ call, formatDate, formatDuration }) => (
  <div className="rounded-lg bg-muted/50 border border-border p-3 space-y-1 text-sm">
    <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground mb-2">Call Details</p>
    <p><span className="text-muted-foreground">Caller:</span> <span className="font-mono font-semibold text-foreground">{call.caller_id_number || call.caller_phone}</span></p>
    {call.agent_name && <p><span className="text-muted-foreground">Agent:</span> {call.agent_name}</p>}
    <p><span className="text-muted-foreground">Time:</span> {formatDate(call.received_at || call.date)}</p>
    {(call.raw_data?.duration || call.duration) && (
      <p><span className="text-muted-foreground">Duration:</span> <span className="font-mono">{formatDuration(call.raw_data?.duration || call.duration)}</span></p>
    )}
    {call.matched_customer_name && <p><span className="text-muted-foreground">Customer:</span> {call.matched_customer_name}</p>}
  </div>
);

// ─── Iron KPI tile ───────────────────────────────────────────────────────────
const KpiCard = ({ label, value, sub, icon: Icon, tone = T.orange, valueColor }) => (
  <IronCard pad={14}>
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
      <Caps size={9} color={T.iron400}>{label}</Caps>
      {Icon && <Icon size={16} color={tone} strokeWidth={1.9} />}
    </div>
    <div style={{ ...mono, fontSize: 28, fontWeight: 700, color: valueColor || T.iron900, lineHeight: 1, marginTop: 10 }}>{value}</div>
    {sub && <div style={{ ...mono, fontSize: 10, color: T.iron400, marginTop: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>{sub}</div>}
  </IronCard>
);

// ─── Iron agent performance row ──────────────────────────────────────────────
const AgentRow = ({ agent }) => {
  const initials = (agent.agent_name || agent.name || '?').split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
  const isOnline = !agent.status || agent.status === 'online';
  const qScore = agent.avg_quality_score;
  const qColor = qScore >= 7 ? T.green : qScore >= 5 ? T.voltageText : T.orangeDeep;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px', borderBottom: `1px solid ${T.iron200}` }}>
      <div style={{ width: 38, height: 38, flexShrink: 0, borderRadius: 8, display: 'grid', placeItems: 'center', background: T.iron50, border: `1px solid ${T.iron200}`, ...mono, fontWeight: 700, fontSize: 13, color: T.orangeDeep }}>{initials}</div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 12.5, color: T.iron900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{agent.agent_name || agent.name}</span>
          <span style={badgeStyle(isOnline ? 'ok' : 'slate')}>{isOnline ? 'Online' : 'Away'}</span>
        </div>
        <div style={{ ...mono, fontSize: 10.5, color: T.iron400, marginTop: 2 }}>{agent.department}</div>
        <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
          <div>
            <Caps size={8} color={T.iron400}>Answered</Caps>
            <div style={{ ...mono, fontSize: 12, fontWeight: 700, color: T.iron900 }}>{agent.answered ?? 0}</div>
          </div>
          <div>
            <Caps size={8} color={T.iron400}>Missed</Caps>
            <div style={{ ...mono, fontSize: 12, fontWeight: 700, color: T.iron900 }}>{agent.missed ?? 0}</div>
          </div>
          {qScore != null && (
            <div>
              <Caps size={8} color={T.iron400}>Quality</Caps>
              <div style={{ ...mono, fontSize: 12, fontWeight: 700, color: qColor }}>{qScore}/10</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default function CallsDashboard() {
  const { token, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState(null);
  const [selectedDept, setSelectedDept] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCall, setSelectedCall] = useState(null);
  const [recordingOpen, setRecordingOpen] = useState(false);
  const [inlinePlayingId, setInlinePlayingId] = useState(null);

  // Quick dial state for call support agents
  const [quickDialOpen, setQuickDialOpen] = useState(false);
  const [quickDialNumber, setQuickDialNumber] = useState('');
  const [quickDialCalling, setQuickDialCalling] = useState(false);
  const [quickDialStatus, setQuickDialStatus] = useState(null);

  // Outcome dialog state
  const [outcomeDialogOpen, setOutcomeDialogOpen] = useState(false);
  const [outcomeCall, setOutcomeCall] = useState(null);
  const [selectedOutcome, setSelectedOutcome] = useState('');
  const [outcomeNotes, setOutcomeNotes] = useState('');
  const [outcomeLoading, setOutcomeLoading] = useState(false);

  // Analysis dialog state
  const [analysisDialogOpen, setAnalysisDialogOpen] = useState(false);
  const [analysisCall, setAnalysisCall] = useState(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);

  // Agent performance state (admin only)
  const [agentPerformance, setAgentPerformance] = useState(null);
  const [performanceLoading, setPerformanceLoading] = useState(false);

  // Tasks state
  const [tasks, setTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [taskCall, setTaskCall] = useState(null);
  const [taskDescription, setTaskDescription] = useState('');
  const [taskAssignee, setTaskAssignee] = useState('');
  const [taskPriority, setTaskPriority] = useState('normal');
  const [taskType, setTaskType] = useState('callback');
  const [assignableAgents, setAssignableAgents] = useState([]);
  const [taskSubmitting, setTaskSubmitting] = useState(false);

  // My improvement tips state (for agents)
  const [myImprovementTips, setMyImprovementTips] = useState([]);

  // Alerts state
  const [alerts, setAlerts] = useState([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [alertsDismissed, setAlertsDismissed] = useState(false);

  // Customer linking state
  const [linkCustomerDialogOpen, setLinkCustomerDialogOpen] = useState(false);
  const [linkingCall, setLinkingCall] = useState(null);
  const [aiDetectedName, setAiDetectedName] = useState(null);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [linkingLoading, setLinkingLoading] = useState(false);
  const [callHistory, setCallHistory] = useState(null);

  // Active tab
  const [activeTab, setActiveTab] = useState('calls');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(20);

  const headers = { Authorization: `Bearer ${token}` };

  // Check if user is call_support role - they only see their own data
  const isCallSupport = user?.role === 'call_support';
  // Only admin and supervisor can access recordings
  const canAccessRecordings = ['admin', 'supervisor'].includes(user?.role);
  // AI analysis can be viewed by all call support staff (for learning), but only admin/supervisor can run new analysis
  const canViewAIAnalysis = ['admin', 'supervisor', 'call_support', 'support_agent'].includes(user?.role);
  const canRunAIAnalysis = ['admin', 'supervisor'].includes(user?.role);

  useEffect(() => {
    fetchDashboard();
    fetchAlerts();
    fetchTasks();
    fetchAssignableAgents();
    if (canAccessRecordings) {
      fetchAgentPerformance();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDept]);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const params = {};
      if (selectedDept && selectedDept !== 'all') {
        params.department = selectedDept;
      }

      if (isCallSupport) {
        const res = await axios.get(`${API}/smartflo/my-calls?limit=500`, { headers });
        const calls = res.data.calls || [];

        setDashboard({
          summary: {
            total_calls: res.data.stats?.total || 0,
            answered: res.data.stats?.answered || 0,
            missed: res.data.stats?.missed || 0,
            avg_duration: res.data.stats?.avg_duration || 0
          },
          recent_calls: calls,
          agent_stats: res.data.agent ? [{
            name: res.data.agent.name,
            department: res.data.agent.department,
            answered: res.data.stats?.answered || 0,
            missed: res.data.stats?.missed || 0
          }] : [],
          department_stats: {}
        });

        const tips = [];
        const seenTips = new Set();
        calls.forEach(call => {
          const analysis = call.ai_analysis?.analysis;
          if (analysis?.improvement_advice) {
            analysis.improvement_advice.forEach(advice => {
              if (!seenTips.has(advice)) {
                seenTips.add(advice);
                tips.push({
                  advice,
                  callId: call.id,
                  date: call.received_at,
                  quality_score: analysis.call_quality_score
                });
              }
            });
          }
        });
        setMyImprovementTips(tips.slice(0, 5));
      } else {
        const res = await axios.get(`${API}/smartflo/dashboard`, { headers, params });
        setDashboard(res.data);
      }
    } catch (err) {
      console.error('Error fetching dashboard:', err);
      toast.error('Failed to load call dashboard');
    } finally {
      setLoading(false);
    }
  };

  const fetchAgentPerformance = async () => {
    setPerformanceLoading(true);
    try {
      const res = await axios.get(`${API}/smartflo/agent-performance?days=30`, { headers });
      setAgentPerformance(res.data);
    } catch (err) {
      console.error('Error fetching agent performance:', err);
    } finally {
      setPerformanceLoading(false);
    }
  };

  const fetchAlerts = async () => {
    setAlertsLoading(true);
    try {
      const res = await axios.get(`${API}/smartflo/alerts`, { headers });
      setAlerts(res.data.alerts || []);
    } catch (err) {
      console.error('Error fetching alerts:', err);
    } finally {
      setAlertsLoading(false);
    }
  };

  const dismissAlert = async (alertKey) => {
    try {
      await axios.post(`${API}/smartflo/alerts/dismiss`, { alert_key: alertKey }, { headers });
      setAlerts(prev => prev.filter(a => a.alert_key !== alertKey));
      toast.success('Alert dismissed');
    } catch (e) {
      toast.error('Failed to dismiss alert');
    }
  };

  const fetchTasks = async () => {
    setTasksLoading(true);
    try {
      const res = await axios.get(`${API}/smartflo/tasks`, { headers });
      setTasks(res.data.tasks || []);
    } catch (err) {
      console.error('Error fetching tasks:', err);
    } finally {
      setTasksLoading(false);
    }
  };

  const fetchAssignableAgents = async () => {
    try {
      const res = await axios.get(`${API}/smartflo/agents/list-for-assignment`, { headers });
      setAssignableAgents(res.data.agents || []);
    } catch (err) {
      console.error('Error fetching agents:', err);
    }
  };

  const openTaskDialog = (call) => {
    const callId = call.id || call.uuid || call._id;
    if (!callId) {
      toast.error('Cannot create task: Call has no ID');
      return;
    }
    setTaskCall({ ...call, id: callId });
    setTaskDescription('');
    setTaskAssignee('');
    setTaskPriority('normal');
    setTaskType('callback');
    setTaskDialogOpen(true);
  };

  const createTask = async () => {
    if (!taskAssignee || !taskDescription) {
      toast.error('Please select assignee and enter description');
      return;
    }

    setTaskSubmitting(true);
    try {
      await axios.post(`${API}/smartflo/tasks`, {
        call_id: taskCall.id || taskCall.uuid,
        assigned_to: taskAssignee,
        description: taskDescription,
        priority: taskPriority,
        task_type: taskType
      }, { headers });

      toast.success('Task created successfully');
      setTaskDialogOpen(false);
      fetchTasks();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create task');
    } finally {
      setTaskSubmitting(false);
    }
  };

  const completeTask = async (taskId, notes = '') => {
    try {
      await axios.put(`${API}/smartflo/tasks/${taskId}/complete`, null, {
        headers,
        params: { notes }
      });
      toast.success('Task completed');
      fetchTasks();
      fetchAlerts();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to complete task');
    }
  };

  const openLinkCustomerDialog = async (call) => {
    setLinkingCall(call);
    setAiDetectedName(null);
    setNewCustomerName('');
    setCallHistory(null);
    setLinkCustomerDialogOpen(true);

    const callerPhone = call.caller_id_number || call.caller_phone;

    try {
      const res = await axios.get(`${API}/smartflo/calls/${call.id}/customer-suggestion`, { headers });
      if (res.data.detected_name) {
        setAiDetectedName(res.data.detected_name);
        setNewCustomerName(res.data.detected_name);
      }
    } catch (err) {
      console.error('Error fetching customer suggestion:', err);
    }

    if (callerPhone) {
      try {
        const histRes = await axios.get(`${API}/smartflo/customer-call-history/${encodeURIComponent(callerPhone)}`, { headers });
        setCallHistory(histRes.data);
      } catch (err) {
        console.error('Error fetching call history:', err);
      }
    }
  };

  const linkCallToCustomer = async () => {
    if (!newCustomerName.trim()) {
      toast.error('Please enter customer name');
      return;
    }

    setLinkingLoading(true);
    try {
      await axios.post(`${API}/smartflo/calls/${linkingCall.id}/link-customer`, null, {
        headers,
        params: {
          customer_name: newCustomerName,
          create_new: true
        }
      });

      toast.success(`Customer "${newCustomerName}" created and linked`);
      setLinkCustomerDialogOpen(false);
      fetchDashboard();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to link customer');
    } finally {
      setLinkingLoading(false);
    }
  };

  const handleQuickDial = async () => {
    const cleanNumber = quickDialNumber.replace(/\D/g, '');
    if (cleanNumber.length !== 10) {
      toast.error('Please enter a valid 10-digit phone number');
      return;
    }

    setQuickDialCalling(true);
    setQuickDialStatus(null);

    try {
      await axios.post(`${API}/smartflo/click-to-call`, null, {
        headers,
        params: { customer_phone: cleanNumber }
      });

      setQuickDialStatus('success');
      toast.success(`Call initiated to ${cleanNumber}`);

      setTimeout(() => {
        setQuickDialOpen(false);
        setQuickDialStatus(null);
        setQuickDialNumber('');
      }, 3000);

    } catch (err) {
      console.error('Quick dial error:', err);
      setQuickDialStatus('error');
      toast.error(err.response?.data?.detail || 'Failed to initiate call');
    } finally {
      setQuickDialCalling(false);
    }
  };

  const openOutcomeDialog = (call) => {
    setOutcomeCall(call);
    setSelectedOutcome(call.outcome || '');
    setOutcomeNotes(call.outcome_notes || '');
    setOutcomeDialogOpen(true);
  };

  const saveCallOutcome = async () => {
    if (!selectedOutcome) {
      toast.error('Please select an outcome');
      return;
    }

    setOutcomeLoading(true);
    try {
      const callId = outcomeCall.id || outcomeCall.uuid;
      await axios.put(`${API}/smartflo/calls/${callId}/outcome`, null, {
        headers,
        params: { outcome: selectedOutcome, notes: outcomeNotes || undefined }
      });

      toast.success('Call outcome saved');
      setOutcomeDialogOpen(false);
      fetchDashboard();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save outcome');
    } finally {
      setOutcomeLoading(false);
    }
  };

  const openAnalysisDialog = (call) => {
    setAnalysisCall(call);
    setAnalysisResult(call.ai_analysis || null);
    setAnalysisDialogOpen(true);
  };

  const runCallAnalysis = async () => {
    setAnalysisLoading(true);
    try {
      const callId = analysisCall.id || analysisCall.uuid;
      const res = await axios.post(`${API}/smartflo/calls/${callId}/analyze`, {}, { headers });

      setAnalysisResult(res.data.analysis);
      toast.success('Call analyzed successfully');
      fetchDashboard();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to analyze call');
    } finally {
      setAnalysisLoading(false);
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds || isNaN(seconds)) return '-';
    const totalSecs = Math.round(Number(seconds));
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
    });
  };

  const getCallStatus = (call) => {
    const eventType = call.raw_data?.event_type;
    const duration = call.raw_data?.duration || call.duration;
    if (eventType === 'missed' || (eventType !== 'answered' && !duration)) return 'missed';
    if (eventType === 'answered' || duration > 0) return 'answered';
    return 'dialed';
  };

  // Prefer our archived copy (survives TATA's purge); fall back to the live Smartflo URL.
  const recUrlOf = (call) => call?.archived_recording_url || call?.raw_data?.recording_url || call?.recording_url;

  const openRecording = (call) => {
    if (call.recording_empty && !call.archived_recording_url) {
      toast.info('Recording was empty — not captured by Smartflo for this call');
      return;
    }
    if (recUrlOf(call)) {
      setSelectedCall(call);
      setRecordingOpen(true);
    } else {
      toast.info('No recording available for this call');
    }
  };

  const filteredCalls = dashboard?.recent_calls?.filter(call => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      call.caller_phone?.toLowerCase().includes(query) ||
      call.caller_id_number?.toLowerCase().includes(query) ||
      call.agent_name?.toLowerCase().includes(query) ||
      call.matched_customer_name?.toLowerCase().includes(query)
    );
  }) || [];

  // Pagination calculations
  const totalCalls = filteredCalls.length;
  const totalPages = Math.ceil(totalCalls / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const paginatedCalls = filteredCalls.slice(startIndex, endIndex);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedDept]);

  // ─── Derived KPI values ───────────────────────────────────────────────────
  const totalCallsVal = dashboard?.summary?.total_calls || 0;
  const answeredVal = dashboard?.summary?.answered || 0;
  const missedVal = dashboard?.summary?.missed || 0;
  const avgDur = dashboard?.summary?.avg_duration || 0;
  const answeredRate = totalCallsVal > 0 ? ((answeredVal / totalCallsVal) * 100).toFixed(1) : '—';
  const avgDurSecs = Math.round(Number(avgDur));
  const avgDurFmt = avgDurSecs > 0
    ? `${Math.floor(avgDurSecs / 60)}m ${(avgDurSecs % 60).toString().padStart(2, '0')}s`
    : '—';

  // Active alerts (not dismissed)
  const visibleAlerts = alertsDismissed ? [] : alerts;
  const hasCritical = visibleAlerts.some(a => a.severity === 'critical');

  // Agents list for left panel — prefer detailed agentPerformance, fall back to dashboard.agent_stats
  const agentList = (agentPerformance?.agents?.length ? agentPerformance.agents : dashboard?.agent_stats || []);

  const pendingTaskCount = tasks.filter(t => t.status === 'pending').length;

  const tipsSeed = [
    { icon: User, title: 'Ask customer name', body: "Start every call by politely asking for the customer's name" },
    { icon: Phone, title: 'Greet professionally', body: '"MuscleGrid service, [Your Name] speaking. How may I help you?"' },
    { icon: MessageSquare, title: 'Listen actively', body: 'Let customer explain fully before responding' },
    { icon: CheckCircle, title: 'Summarize & confirm', body: "Repeat back the customer's issue to confirm understanding" },
    { icon: Clock, title: "Don't rush", body: "Speak clearly and don't rush through explanations" },
    { icon: ThumbsUp, title: 'End positively', body: '"Is there anything else I can help you with today?"' },
  ];

  const subtitle = `LIVE · SMARTFLO IVR · ${isCallSupport ? 'MY CALLS' : 'ALL AGENTS'}`;

  // ─── Header actions ────────────────────────────────────────────────────────
  const headerRight = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ position: 'relative' }}>
        <Search size={14} color={T.iron400} style={{ position: 'absolute', left: 9, top: 9 }} />
        <input
          placeholder="Search interactions…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ ...inputStyle, paddingLeft: 30, width: 210 }}
        />
      </div>
      {isCallSupport && (
        <button data-testid="quick-dial-btn" onClick={() => setQuickDialOpen(true)} style={btnPrimary}>
          <PhoneCall size={14} /> Quick Dial
        </button>
      )}
    </div>
  );

  if (loading && !dashboard) {
    return (
      <IronShell title="Call Center" subtitle={subtitle}>
        <div style={{ display: 'grid', placeItems: 'center', height: 320 }}>
          <Loader2 className="animate-spin" size={30} color={T.iron400} />
        </div>
      </IronShell>
    );
  }

  const H = ['Time', 'Caller', ...(!isCallSupport ? ['Agent', 'Dept'] : []), 'Status', 'Duration', 'Outcome',
    ...(canAccessRecordings ? ['Recording'] : []), ...(canViewAIAnalysis ? ['AI'] : []), 'Actions'];

  return (
    <IronShell
      title="Call Center"
      subtitle={subtitle}
      onRefresh={() => { fetchDashboard(); fetchAlerts(); fetchTasks(); }}
      headerRight={headerRight}
    >
      {/* ── KPI row ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
        <KpiCard label="Total Call Volume" value={totalCallsVal.toLocaleString('en-IN')} sub="all channels" icon={Phone} tone={T.blue} />
        <KpiCard label="Answered Rate" value={`${answeredRate}%`} sub={answeredVal > 0 ? `${answeredVal} answered` : 'daily trend'} icon={CheckCircle} tone={T.green} />
        <KpiCard label="Missed Calls" value={missedVal} valueColor={missedVal > 0 ? T.orangeDeep : T.iron900} sub={missedVal > 0 ? 'requires attention' : 'all answered'} icon={PhoneMissed} tone={T.orangeDeep} />
        <KpiCard label="Avg Handle Time" value={avgDurFmt} sub="vs prev. period" icon={Clock} tone={T.orange} />
      </div>

      {/* ── Critical Alerts strip ─────────────────────────────────────────── */}
      {visibleAlerts.length > 0 && (
        <IronCard pad={14} style={{ marginBottom: 16, borderColor: '#F6D8BA', background: '#FDF4EC' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, minWidth: 0 }}>
              <div style={{ width: 34, height: 34, flexShrink: 0, borderRadius: 8, display: 'grid', placeItems: 'center', background: '#FBE3D2' }}>
                <AlertCircle size={18} color={T.orangeDeep} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 13, color: T.orangeDeep }}>
                  {hasCritical ? 'Critical Alerts' : 'Action Required'} ({visibleAlerts.length})
                </div>
                <div style={{ fontSize: 11.5, color: T.iron500, marginTop: 2 }}>
                  {hasCritical ? 'SLA breach detected — immediate triage recommended' : 'Some calls require follow-up action'}
                </div>
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 120, overflowY: 'auto' }}>
                  {visibleAlerts.slice(0, 5).map((alert, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                      <span style={badgeStyle(severityTone(alert.severity))}>{alert.severity}</span>
                      <span style={{ color: T.iron700 }}>{alert.message}</span>
                      {alert.caller_phone && <span style={{ ...mono, color: T.iron400 }}>({alert.caller_phone})</span>}
                      {alert.call_id && (
                        <button
                          style={{ ...iconBtn, color: T.orangeDeep, fontFamily: T.headline, fontWeight: 700, fontSize: 11 }}
                          onClick={() => {
                            const call = dashboard?.recent_calls?.find(c => c.id === alert.call_id);
                            if (call && alert.type === 'outcome_missing') openOutcomeDialog(call);
                            else if (call && alert.type === 'missed_no_callback') openTaskDialog(call);
                          }}
                        >
                          {alert.type === 'outcome_missing' ? 'Add Outcome' : 'Create Task'}
                        </button>
                      )}
                    </div>
                  ))}
                  {visibleAlerts.length > 5 && (
                    <span style={{ ...mono, fontSize: 10, color: T.iron400 }}>+{visibleAlerts.length - 5} more alerts</span>
                  )}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button style={btnOutline} onClick={() => setAlertsDismissed(true)}>Dismiss All</button>
              <button style={btnPrimary} onClick={() => setActiveTab('tasks')}>Launch Triage</button>
            </div>
          </div>
        </IronCard>
      )}

      {/* ── Tab switch: Calls / Tasks ─────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {[
          { key: 'calls', label: 'Calls', icon: Phone, count: null },
          { key: 'tasks', label: 'Tasks', icon: ListTodo, count: pendingTaskCount },
        ].map((tb) => {
          const Icon = tb.icon;
          const active = activeTab === tb.key;
          return (
            <button key={tb.key} onClick={() => setActiveTab(tb.key)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${active ? T.orange : T.iron200}`, background: active ? T.orange : T.white, color: active ? '#fff' : T.iron700, borderRadius: 6, padding: '7px 13px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 12 }}>
              <Icon size={14} strokeWidth={2} />{tb.label}
              {tb.count > 0 && <span style={{ ...mono, fontSize: 11, opacity: 0.9 }}>({tb.count})</span>}
            </button>
          );
        })}
      </div>

      {/* ═══ CALLS TAB ═══════════════════════════════════════════════════ */}
      {activeTab === 'calls' && (
        <>
          {/* My improvement tips — agents only */}
          {isCallSupport && (
            <IronCard pad={16} style={{ marginBottom: 16, borderColor: '#DDD3EF', background: '#F7F4FC' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, display: 'grid', placeItems: 'center', background: '#EEE9F7' }}>
                  <Sparkles size={16} color="#6D4AB0" />
                </div>
                <div>
                  <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 13, color: T.iron900 }}>Tips for High Call Score</div>
                  <Caps size={9} color={T.iron400}>Performance guidance</Caps>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 4 }}>
                {tipsSeed.map(({ icon: Ic, title, body }) => (
                  <div key={title} style={{ borderRadius: 8, background: T.white, border: `1px solid ${T.iron200}`, padding: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, fontFamily: T.headline, fontWeight: 700, fontSize: 12.5, color: T.iron900 }}>
                      <Ic size={15} color={T.iron500} />{title}
                    </div>
                    <div style={{ fontSize: 11.5, color: T.iron500 }}>{body}</div>
                  </div>
                ))}
              </div>

              {myImprovementTips.length > 0 && (
                <div style={{ borderTop: `1px solid ${T.iron200}`, paddingTop: 14, marginTop: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: T.headline, fontWeight: 700, fontSize: 12, color: '#6D4AB0', marginBottom: 10 }}>
                    <Brain size={15} /> Personalised tips from your recent calls
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {myImprovementTips.map((tip, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: 8, borderRadius: 8, background: T.white, border: `1px solid ${T.iron200}` }}>
                        <span style={{ flexShrink: 0, width: 20, height: 20, borderRadius: 999, background: '#EEE9F7', color: '#6D4AB0', display: 'grid', placeItems: 'center', ...mono, fontSize: 11, fontWeight: 700 }}>{idx + 1}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12.5, color: T.iron900 }}>{tip.advice}</div>
                          {tip.quality_score && <div style={{ ...mono, fontSize: 10, color: T.iron400, marginTop: 2 }}>From call scored {tip.quality_score}/10</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </IronCard>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: isCallSupport ? '1fr' : '340px 1fr', gap: 16, alignItems: 'start' }}>

            {/* ── Left: Active Performance ─────────────────────────────── */}
            {!isCallSupport && (
              <IronCard pad={0} style={{ overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                  <div>
                    <Caps size={9.5} color={T.iron500}>Active Performance</Caps>
                    <div style={{ fontSize: 11, color: T.iron400, marginTop: 2 }}>Last 30 days</div>
                  </div>
                  <button onClick={fetchAgentPerformance} disabled={performanceLoading} title="Refresh" style={{ ...iconBtn, color: T.iron500 }}>
                    {performanceLoading ? <Loader2 className="animate-spin" size={14} /> : <RefreshCw size={14} />}
                  </button>
                </div>
                <div style={{ maxHeight: 520, overflowY: 'auto' }}>
                  {agentList.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 0', color: T.iron400 }}>
                      <Headphones size={38} style={{ opacity: 0.4, marginBottom: 10 }} />
                      <div style={{ fontSize: 12.5 }}>No agent data</div>
                    </div>
                  ) : (
                    agentList.map((agent, idx) => <AgentRow key={idx} agent={agent} />)
                  )}
                </div>
                {Object.entries(dashboard?.department_stats || {}).length > 0 && (
                  <div style={{ borderTop: `1px solid ${T.iron200}`, padding: '12px 14px', background: T.iron50 }}>
                    <Caps size={9} color={T.iron400} style={{ display: 'block', marginBottom: 8 }}>By Department</Caps>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      {Object.entries(dashboard?.department_stats || {}).map(([key, dept]) => (
                        <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
                          <span style={{ color: T.iron900, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dept.name}</span>
                          <div style={{ display: 'flex', gap: 8, flexShrink: 0, ...mono }}>
                            <span style={{ color: T.green }}>{dept.answered}✓</span>
                            <span style={{ color: T.orangeDeep }}>{dept.missed}✗</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </IronCard>
            )}

            {/* ── Right: filter bar + calls table ─────────────────────── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>

              {/* Filter bar */}
              <IronCard pad={12}>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
                  {!isCallSupport && (
                    <select value={selectedDept} onChange={(e) => setSelectedDept(e.target.value)} style={{ ...inputStyle, cursor: 'pointer', width: 180 }}>
                      <option value="all">All Departments</option>
                      <option value="Cx Exp">Customer Support</option>
                      <option value="Sales">Sales</option>
                    </select>
                  )}
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 6, border: `1px solid ${T.iron200}`, background: T.iron50, ...mono, fontSize: 11, color: T.iron500 }}>
                    <Clock size={13} /> Last 30 days
                  </div>
                  <div style={{ marginLeft: 'auto', ...mono, fontSize: 11, color: T.iron400 }}>
                    {totalCalls.toLocaleString('en-IN')} records
                  </div>
                </div>
              </IronCard>

              {/* Calls table */}
              <IronCard pad={0} style={{ overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                        {H.map((h, i) => <th key={i} style={thCell}><Caps size={8.5}>{h}</Caps></th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedCalls.map((call, idx) => {
                        const status = getCallStatus(call);
                        const duration = call.raw_data?.duration || call.duration;
                        const recordingEmpty = call.recording_empty && !call.archived_recording_url;
                        const hasRecording = !recordingEmpty && (call.archived_recording_url || call.raw_data?.recording_url || call.recording_url);
                        const callerPhone = call.caller_id_number || call.caller_phone;
                        return (
                          <tr key={call.id || idx} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                            <td style={{ ...tdCell, ...mono, fontSize: 11, color: T.iron500, whiteSpace: 'nowrap' }}>
                              {formatDate(call.received_at || call.date)}
                            </td>
                            <td style={tdCell}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ ...mono, fontSize: 12.5, fontWeight: 700, color: T.iron900 }}>{callerPhone}</div>
                                  {call.matched_customer_name ? (
                                    <div style={{ fontSize: 11, color: T.orangeDeep, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{call.matched_customer_name}</div>
                                  ) : call.ai_detected_customer_name ? (
                                    <div style={{ fontSize: 11, color: '#6D4AB0', display: 'inline-flex', alignItems: 'center', gap: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      <Sparkles size={11} />{call.ai_detected_customer_name}
                                    </div>
                                  ) : null}
                                </div>
                                {!call.matched_customer_name && callerPhone && (
                                  <button style={{ ...iconBtn, color: T.iron400 }} onClick={() => openLinkCustomerDialog(call)} title="Link to Customer">
                                    <Link size={13} />
                                  </button>
                                )}
                              </div>
                            </td>
                            {!isCallSupport && (
                              <td style={{ ...tdCell, fontSize: 12, fontWeight: 600, color: T.iron900, whiteSpace: 'nowrap' }}>{call.agent_name || '-'}</td>
                            )}
                            {!isCallSupport && (
                              <td style={{ ...tdCell, fontSize: 12, color: T.iron500, whiteSpace: 'nowrap' }}>{call.dept_name || '-'}</td>
                            )}
                            <td style={tdCell}><span style={badgeStyle(statusTone(status))}>{status}</span></td>
                            <td style={{ ...tdCell, ...mono, fontSize: 12, color: T.iron500 }}>{formatDuration(duration)}</td>
                            <td style={tdCell}>
                              {call.outcome ? (
                                <button style={{ ...badgeStyle('slate'), cursor: 'pointer' }} onClick={() => openOutcomeDialog(call)}>
                                  {CALL_OUTCOMES.find(o => o.value === call.outcome)?.label || call.outcome}
                                </button>
                              ) : (
                                <button style={{ ...iconBtn, ...mono, fontSize: 11, color: T.orangeDeep }} onClick={() => openOutcomeDialog(call)}>+ Add</button>
                              )}
                            </td>
                            {canAccessRecordings && (
                              <td style={tdCell}>
                                {hasRecording ? (
                                  inlinePlayingId === (call.id || call.uuid) ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                      <audio controls autoPlay preload="metadata" src={recUrlOf(call)} style={{ height: 28, maxWidth: 180 }} />
                                      <button style={{ ...iconBtn, color: T.iron400 }} onClick={() => setInlinePlayingId(null)} title="Hide player"><XCircle size={15} /></button>
                                    </div>
                                  ) : (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                      <button style={{ ...iconBtn, color: T.orangeDeep }} onClick={() => setInlinePlayingId(call.id || call.uuid)} title="Play inline"><Play size={15} /></button>
                                      <button style={{ ...iconBtn, color: T.iron400 }} onClick={() => openRecording(call)} title="Open in dialog"><FileText size={14} /></button>
                                    </div>
                                  )
                                ) : recordingEmpty ? (
                                  <span style={{ color: T.iron400, fontSize: 10.5 }} title="Smartflo did not capture audio for this call">empty</span>
                                ) : (
                                  <span style={{ color: T.iron400, fontSize: 12 }}>—</span>
                                )}
                              </td>
                            )}
                            {canViewAIAnalysis && (
                              <td style={tdCell}>
                                {hasRecording ? (
                                  call.ai_analysis ? (
                                    <button style={{ ...iconBtn, color: T.green }} onClick={() => openAnalysisDialog(call)} title="View AI Analysis"><FileText size={15} /></button>
                                  ) : canRunAIAnalysis ? (
                                    <button style={{ ...iconBtn, color: '#6D4AB0' }} onClick={() => openAnalysisDialog(call)} title="Run AI Analysis"><Brain size={15} /></button>
                                  ) : (
                                    <span style={{ ...mono, fontSize: 10, color: T.iron400 }}>Pending</span>
                                  )
                                ) : (
                                  <span style={{ color: T.iron400, fontSize: 12 }}>—</span>
                                )}
                              </td>
                            )}
                            <td style={tdCell}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                {callerPhone && (
                                  <ClickToCallButton phone={callerPhone} customerName={call.matched_customer_name} showLabel={false} size="sm" />
                                )}
                                <button style={{ ...iconBtn, color: T.voltageText }} onClick={() => openTaskDialog(call)} title="Assign Task"><UserPlus size={15} /></button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {paginatedCalls.length === 0 && (
                        <tr>
                          <td colSpan={H.length} style={{ textAlign: 'center', padding: '48px 0', color: T.iron400 }}>
                            <Phone size={38} style={{ opacity: 0.25, margin: '0 auto 10px' }} />
                            <div style={{ fontSize: 12.5 }}>No calls found</div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination footer */}
                {totalCalls > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 14px', background: T.iron50, borderTop: `1px solid ${T.iron200}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <Caps size={9} color={T.iron400}>
                        Showing {startIndex + 1}–{Math.min(endIndex, totalCalls)} of {totalCalls.toLocaleString('en-IN')}
                      </Caps>
                      <select value={rowsPerPage} onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }} style={{ ...inputStyle, padding: '4px 8px', cursor: 'pointer', width: 66 }}>
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                      </select>
                      <span style={{ ...mono, fontSize: 11, color: T.iron400 }}>per page</span>
                    </div>
                    {totalPages > 1 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} style={{ ...iconBtn, color: T.iron500, opacity: currentPage === 1 ? 0.3 : 1 }}><ChevronLeft size={16} /></button>
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          let pageNum;
                          if (totalPages <= 5) pageNum = i + 1;
                          else if (currentPage <= 3) pageNum = i + 1;
                          else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                          else pageNum = currentPage - 2 + i;
                          const active = currentPage === pageNum;
                          return (
                            <button key={pageNum} onClick={() => setCurrentPage(pageNum)}
                              style={{ width: 30, height: 30, borderRadius: 6, border: `1px solid ${active ? T.orange : T.iron200}`, background: active ? T.orange : T.white, color: active ? '#fff' : T.iron700, ...mono, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                              {pageNum}
                            </button>
                          );
                        })}
                        <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} style={{ ...iconBtn, color: T.iron500, opacity: currentPage === totalPages ? 0.3 : 1 }}><ChevronRight size={16} /></button>
                      </div>
                    )}
                  </div>
                )}
              </IronCard>
            </div>
          </div>
        </>
      )}

      {/* ═══ TASKS TAB ═══════════════════════════════════════════════════ */}
      {activeTab === 'tasks' && (
        <IronCard pad={0} style={{ overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
            <div>
              <Caps size={9.5} color={T.iron500}>{isCallSupport ? 'My Tasks' : 'All Tasks'}</Caps>
              <div style={{ fontSize: 11, color: T.iron400, marginTop: 2 }}>1-hour SLA target per task</div>
            </div>
            <button onClick={fetchTasks} disabled={tasksLoading} style={{ ...iconBtn, color: T.iron500 }}>
              {tasksLoading ? <Loader2 className="animate-spin" size={15} /> : <RefreshCw size={15} />}
            </button>
          </div>

          <div style={{ padding: 16 }}>
            {tasksLoading ? (
              <div style={{ display: 'grid', placeItems: 'center', padding: '48px 0' }}><Loader2 className="animate-spin" size={28} color={T.orange} /></div>
            ) : tasks.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 0', color: T.iron400 }}>
                <div style={{ width: 48, height: 48, borderRadius: 999, background: T.greenTint, display: 'grid', placeItems: 'center', marginBottom: 10 }}>
                  <CheckCircle size={24} color={T.green} />
                </div>
                <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 13, color: T.iron900 }}>All clear</div>
                <div style={{ fontSize: 11.5, marginTop: 3 }}>No tasks assigned</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {tasks.map((task) => {
                  const bg = task.sla_breached ? '#FDF4EC' : task.status === 'completed' ? T.greenTint : T.white;
                  const bd = task.sla_breached ? '#F6D8BA' : task.status === 'completed' ? '#CBE5D6' : T.iron200;
                  return (
                    <div key={task.id} style={{ borderRadius: 8, border: `1px solid ${bd}`, background: bg, padding: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                            <span style={badgeStyle(priorityTone(task.priority))}>{task.priority}</span>
                            <span style={badgeStyle(taskTypeTone(task.task_type))}>{task.task_type?.replace('_', ' ')}</span>
                            {task.sla_breached && <span style={badgeStyle('bad')}>SLA Breached ({task.overdue_minutes}m overdue)</span>}
                            {!task.sla_breached && task.status === 'pending' && (
                              <span style={{ ...mono, fontSize: 10.5, color: task.minutes_remaining < 15 ? T.orangeDeep : T.iron400, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                <Timer size={12} />{task.minutes_remaining}m remaining
                              </span>
                            )}
                          </div>
                          <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 13, color: T.iron900 }}>{task.description}</div>
                          <div style={{ marginTop: 8, ...mono, fontSize: 11, color: T.iron500, lineHeight: 1.7 }}>
                            <div><Caps size={8} color={T.iron400}>Customer:</Caps> <span style={{ color: T.iron900 }}>{task.caller_phone}</span>{task.customer_name && <span style={{ color: T.orangeDeep, marginLeft: 6 }}>({task.customer_name})</span>}</div>
                            <div><Caps size={8} color={T.iron400}>Assigned to:</Caps> {task.assigned_to_name}<span style={{ opacity: 0.6, marginLeft: 6 }}>by {task.assigned_by_name}</span></div>
                            <div><Caps size={8} color={T.iron400}>Created:</Caps> {new Date(task.created_at).toLocaleString()}</div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
                          {task.status === 'pending' && (
                            <>
                              <ClickToCallButton phone={task.caller_phone} customerName={task.customer_name} showLabel={true} size="sm" />
                              <button style={{ ...btnPrimary, background: T.green }} onClick={() => completeTask(task.id)}>
                                <CheckCircle size={14} /> Complete
                              </button>
                            </>
                          )}
                          {task.status === 'completed' && <span style={badgeStyle('ok')}>Completed</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </IronCard>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          DIALOGS (shadcn — kept in dark app theme)
      ════════════════════════════════════════════════════════════════════ */}

      {/* Recording Dialog */}
      {canAccessRecordings && (
        <Dialog open={recordingOpen} onOpenChange={setRecordingOpen}>
          <DialogContent className="bg-popover border border-border rounded-lg max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-foreground">
                <Play className="w-4 h-4 text-primary" />
                Call Recording
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {selectedCall && (
                <CallInfoBlock call={selectedCall} formatDate={formatDate} formatDuration={formatDuration} />
              )}
              <div className="rounded-lg bg-muted/40 border border-border p-3">
                <audio controls className="w-full" src={recUrlOf(selectedCall)}>
                  Your browser does not support the audio element.
                </audio>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Quick Dial Dialog */}
      <Dialog open={quickDialOpen} onOpenChange={setQuickDialOpen}>
        <DialogContent className="bg-popover border border-border rounded-lg max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <PhoneCall className="w-4 h-4 text-emerald-400" />
              Quick Dial
            </DialogTitle>
          </DialogHeader>

          <div className="py-4">
            {quickDialStatus === 'success' ? (
              <div className="text-center py-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 mx-auto mb-3">
                  <CheckCircle className="w-8 h-8 text-emerald-400" />
                </div>
                <p className="text-base font-semibold text-emerald-400">Call Initiated!</p>
                <p className="text-sm text-muted-foreground mt-1">Your phone will ring first, then connect to the number</p>
              </div>
            ) : quickDialStatus === 'error' ? (
              <div className="text-center py-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-500/15 mx-auto mb-3">
                  <XCircle className="w-8 h-8 text-rose-400" />
                </div>
                <p className="text-base font-semibold text-rose-400">Call Failed</p>
                <p className="text-sm text-muted-foreground mt-1">Please try again or contact admin</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground block mb-2">
                    10-digit phone number
                  </label>
                  <Input
                    type="tel"
                    placeholder="9876543210"
                    value={quickDialNumber}
                    onChange={(e) => setQuickDialNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    className="text-2xl font-mono text-center tracking-widest h-14"
                    maxLength={10}
                    data-testid="quick-dial-input"
                  />
                </div>
                <div className="rounded-lg bg-muted/50 border border-border p-3 space-y-1 text-sm text-muted-foreground">
                  <p className="flex items-center gap-2">
                    <span className="font-mono font-bold text-primary text-xs">01</span>
                    Your phone will ring first
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="font-mono font-bold text-primary text-xs">02</span>
                    Pick up to connect to customer
                  </p>
                </div>
              </div>
            )}
          </div>

          {!quickDialStatus && (
            <DialogFooter>
              <Button variant="ghost" onClick={() => { setQuickDialOpen(false); setQuickDialNumber(''); }} disabled={quickDialCalling}>
                Cancel
              </Button>
              <Button onClick={handleQuickDial} disabled={quickDialCalling || quickDialNumber.length !== 10} className="gap-2" data-testid="quick-dial-call-btn">
                {quickDialCalling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Phone className="w-4 h-4" />}
                {quickDialCalling ? 'Calling…' : 'Call'}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Outcome Dialog */}
      <Dialog open={outcomeDialogOpen} onOpenChange={setOutcomeDialogOpen}>
        <DialogContent className="bg-popover border border-border rounded-lg max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <MessageSquare className="w-4 h-4 text-primary" />
              Call Outcome
            </DialogTitle>
          </DialogHeader>

          {outcomeCall && (
            <div className="space-y-4 py-2">
              <CallInfoBlock call={outcomeCall} formatDate={formatDate} formatDuration={formatDuration} />

              <div>
                <label className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground block mb-1.5">
                  Outcome *
                </label>
                <Select value={selectedOutcome} onValueChange={setSelectedOutcome}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select outcome…" />
                  </SelectTrigger>
                  <SelectContent>
                    {CALL_OUTCOMES.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground block mb-1.5">
                  Notes (Optional)
                </label>
                <Textarea
                  value={outcomeNotes}
                  onChange={(e) => setOutcomeNotes(e.target.value)}
                  placeholder="Add any notes about this call…"
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOutcomeDialogOpen(false)} disabled={outcomeLoading}>
              Cancel
            </Button>
            <Button onClick={saveCallOutcome} disabled={outcomeLoading || !selectedOutcome}>
              {outcomeLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Outcome
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Analysis Dialog */}
      <Dialog open={analysisDialogOpen} onOpenChange={setAnalysisDialogOpen}>
        <DialogContent className="bg-popover border border-border rounded-lg max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <Brain className="w-4 h-4 text-violet-400" />
              AI Call Analysis
            </DialogTitle>
          </DialogHeader>

          {analysisCall && (
            <div className="space-y-4 py-2">
              <CallInfoBlock call={analysisCall} formatDate={formatDate} formatDuration={formatDuration} />

              {analysisResult ? (
                <div className="space-y-4">
                  {analysisResult.transcript && (
                    <div className="rounded-lg bg-muted/50 border border-border p-4">
                      <h4 className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5" /> Transcript
                      </h4>
                      <p className="text-sm text-foreground whitespace-pre-wrap max-h-40 overflow-y-auto">
                        {analysisResult.transcript}
                      </p>
                    </div>
                  )}

                  {analysisResult.analysis && (
                    <div className="space-y-3">
                      {analysisResult.analysis.call_quality_score && (
                        <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/40 border border-border">
                          <div className="text-center flex-shrink-0">
                            <p className={cn('text-3xl font-bold font-mono tabular-nums',
                              analysisResult.analysis.call_quality_score >= 7 ? 'text-emerald-400' :
                              analysisResult.analysis.call_quality_score >= 5 ? 'text-amber-400' : 'text-rose-400'
                            )}>
                              {analysisResult.analysis.call_quality_score}/10
                            </p>
                            <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground mt-1">Quality</p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {analysisResult.analysis.customer_satisfaction_likely && (
                              <span className={cn(BADGE_CLS,
                                analysisResult.analysis.customer_satisfaction_likely === 'high' ? 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/25' :
                                analysisResult.analysis.customer_satisfaction_likely === 'medium' ? 'bg-amber-400/15 text-amber-400 ring-amber-400/25' :
                                'bg-rose-500/15 text-rose-400 ring-rose-500/25'
                              )}>
                                Satisfaction: {analysisResult.analysis.customer_satisfaction_likely}
                              </span>
                            )}
                            {analysisResult.analysis.issue_resolved !== undefined && (
                              <span className={cn(BADGE_CLS,
                                analysisResult.analysis.issue_resolved
                                  ? 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/25'
                                  : 'bg-rose-500/15 text-rose-400 ring-rose-500/25'
                              )}>
                                {analysisResult.analysis.issue_resolved ? 'Issue Resolved' : 'Unresolved'}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {analysisResult.analysis.summary && (
                        <div className="rounded-lg bg-muted/40 border border-border p-3">
                          <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">Summary</p>
                          <p className="text-sm text-foreground">{analysisResult.analysis.summary}</p>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-3">
                        {analysisResult.analysis.agent_tone_assessment && (
                          <div className="rounded-lg bg-violet-500/[0.06] border border-violet-500/20 p-3">
                            <p className="font-mono text-[11px] uppercase tracking-wide text-violet-400 mb-1.5">Agent Tone</p>
                            <p className="text-sm text-foreground">{analysisResult.analysis.agent_tone_assessment}</p>
                          </div>
                        )}
                        {analysisResult.analysis.customer_tone_assessment && (
                          <div className="rounded-lg bg-sky-400/[0.06] border border-sky-400/20 p-3">
                            <p className="font-mono text-[11px] uppercase tracking-wide text-sky-400 mb-1.5">Customer Tone</p>
                            <p className="text-sm text-foreground">{analysisResult.analysis.customer_tone_assessment}</p>
                          </div>
                        )}
                      </div>

                      {analysisResult.analysis.red_flags?.length > 0 && (
                        <div className="rounded-lg bg-rose-500/[0.06] border border-rose-500/25 p-3">
                          <p className="font-mono text-[11px] uppercase tracking-wide text-rose-400 mb-2 flex items-center gap-2">
                            <XCircle className="w-3.5 h-3.5" /> Red Flags — Needs Attention
                          </p>
                          <ul className="list-disc list-inside text-sm text-foreground/80 space-y-1">
                            {analysisResult.analysis.red_flags.map((flag, i) => <li key={i}>{flag}</li>)}
                          </ul>
                        </div>
                      )}

                      {analysisResult.analysis.what_went_wrong?.length > 0 && (
                        <div className="rounded-lg bg-orange-400/[0.06] border border-orange-400/20 p-3">
                          <p className="font-mono text-[11px] uppercase tracking-wide text-orange-400 mb-2">What Went Wrong</p>
                          <ul className="list-disc list-inside text-sm text-foreground/80 space-y-1">
                            {analysisResult.analysis.what_went_wrong.map((item, i) => <li key={i}>{item}</li>)}
                          </ul>
                        </div>
                      )}

                      {analysisResult.analysis.what_went_well?.length > 0 && (
                        <div className="rounded-lg bg-emerald-500/[0.06] border border-emerald-500/20 p-3">
                          <p className="font-mono text-[11px] uppercase tracking-wide text-emerald-400 mb-2">What Went Well</p>
                          <ul className="list-disc list-inside text-sm text-foreground/80 space-y-1">
                            {analysisResult.analysis.what_went_well.map((item, i) => <li key={i}>{item}</li>)}
                          </ul>
                        </div>
                      )}

                      {analysisResult.analysis.improvement_advice?.length > 0 && (
                        <div className="rounded-lg bg-sky-400/[0.06] border border-sky-400/20 p-3">
                          <p className="font-mono text-[11px] uppercase tracking-wide text-sky-400 mb-2">Improvement Advice for Agent</p>
                          <ul className="list-disc list-inside text-sm text-foreground/80 space-y-1">
                            {analysisResult.analysis.improvement_advice.map((advice, i) => <li key={i}>{advice}</li>)}
                          </ul>
                        </div>
                      )}

                      {analysisResult.analysis.customer_intent && (
                        <div className="rounded-lg bg-muted/40 border border-border p-3">
                          <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">Customer Intent</p>
                          <p className="text-sm text-foreground">{analysisResult.analysis.customer_intent}</p>
                        </div>
                      )}

                      {analysisResult.analysis.key_points?.length > 0 && (
                        <div className="rounded-lg bg-muted/40 border border-border p-3">
                          <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground mb-2">Key Points</p>
                          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                            {analysisResult.analysis.key_points.map((point, i) => <li key={i}>{point}</li>)}
                          </ul>
                        </div>
                      )}

                      {analysisResult.analysis.action_items?.length > 0 && (
                        <div className="rounded-lg bg-amber-400/[0.06] border border-amber-400/20 p-3">
                          <p className="font-mono text-[11px] uppercase tracking-wide text-amber-400 mb-2">Action Items</p>
                          <ul className="list-disc list-inside text-sm text-foreground/80 space-y-1">
                            {analysisResult.analysis.action_items.map((item, i) => <li key={i}>{item}</li>)}
                          </ul>
                        </div>
                      )}

                      {analysisResult.analysis.suggested_outcome && (
                        <div className="flex flex-wrap gap-2">
                          <span className={cn(BADGE_CLS, 'bg-violet-400/15 text-violet-400 ring-violet-400/25')}>
                            Suggested: {CALL_OUTCOMES.find(o => o.value === analysisResult.analysis.suggested_outcome)?.label || analysisResult.analysis.suggested_outcome}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  <p className="font-mono text-[10px] text-muted-foreground/60">
                    Analyzed at: {analysisResult.analyzed_at ? new Date(analysisResult.analyzed_at).toLocaleString() : 'N/A'}
                  </p>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-violet-500/15 mx-auto mb-4">
                    <Brain className="w-8 h-8 text-violet-400 opacity-70" />
                  </div>
                  <p className="text-foreground font-semibold mb-1">No analysis yet</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    AI will transcribe the Hindi call and provide a summary with key insights
                  </p>
                  <Button onClick={runCallAnalysis} disabled={analysisLoading} variant="outline" className="gap-2">
                    {analysisLoading ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing…</>
                    ) : (
                      <><Brain className="w-4 h-4" /> Run AI Analysis</>
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setAnalysisDialogOpen(false)}>
              Close
            </Button>
            {analysisResult && analysisResult.analysis?.suggested_outcome && !analysisCall?.outcome && (
              <Button
                onClick={() => {
                  setOutcomeCall(analysisCall);
                  setSelectedOutcome(analysisResult.analysis.suggested_outcome);
                  setOutcomeNotes('');
                  setAnalysisDialogOpen(false);
                  setOutcomeDialogOpen(true);
                }}
              >
                Apply Suggested Outcome
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Task Creation Dialog */}
      <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
        <DialogContent className="bg-popover border border-border rounded-lg max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <UserPlus className="w-4 h-4 text-amber-400" />
              Assign Task
            </DialogTitle>
          </DialogHeader>

          {taskCall && (
            <div className="space-y-4 py-2">
              <CallInfoBlock call={taskCall} formatDate={formatDate} formatDuration={formatDuration} />

              <div>
                <label className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground block mb-1.5">
                  Assign To *
                </label>
                <Select value={taskAssignee} onValueChange={setTaskAssignee}>
                  <SelectTrigger data-testid="task-assignee-select">
                    <SelectValue placeholder="Select agent…" />
                  </SelectTrigger>
                  <SelectContent>
                    {assignableAgents.map(agent => (
                      <SelectItem key={agent.user_id} value={agent.user_id}>
                        {agent.name} ({agent.department})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground block mb-1.5">
                  Task Type
                </label>
                <Select value={taskType} onValueChange={setTaskType}>
                  <SelectTrigger data-testid="task-type-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="callback">Callback</SelectItem>
                    <SelectItem value="sales_lead">Sales Lead</SelectItem>
                    <SelectItem value="tech_support">Tech Support</SelectItem>
                    <SelectItem value="complaint">Complaint</SelectItem>
                    <SelectItem value="general">General</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground block mb-1.5">
                  Priority
                </label>
                <Select value={taskPriority} onValueChange={setTaskPriority}>
                  <SelectTrigger data-testid="task-priority-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground block mb-1.5">
                  Description *
                </label>
                <Textarea
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  placeholder="Enter task details…"
                  rows={3}
                  data-testid="task-description-input"
                />
              </div>

              <div className="flex items-center gap-2 rounded-lg bg-orange-400/[0.06] border border-orange-400/20 px-3 py-2 text-xs text-orange-400">
                <Timer className="w-4 h-4 flex-shrink-0" />
                <span><strong>SLA:</strong> Task must be completed within 1 hour</span>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setTaskDialogOpen(false)} disabled={taskSubmitting}>
              Cancel
            </Button>
            <Button onClick={createTask} disabled={taskSubmitting || !taskAssignee || !taskDescription} data-testid="create-task-btn">
              {taskSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Customer Linking Dialog */}
      <Dialog open={linkCustomerDialogOpen} onOpenChange={setLinkCustomerDialogOpen}>
        <DialogContent className="bg-popover border border-border rounded-lg max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <Link className="w-4 h-4 text-primary" />
              Link Call to Customer
            </DialogTitle>
          </DialogHeader>

          {linkingCall && (
            <div className="space-y-4 py-2">
              <CallInfoBlock call={linkingCall} formatDate={formatDate} formatDuration={formatDuration} />

              {callHistory && callHistory.total_calls > 1 && (
                <div className="rounded-lg bg-sky-400/[0.06] border border-sky-400/20 p-3 text-sm">
                  <p className="text-sky-400 flex items-center gap-2 font-semibold">
                    <History className="w-4 h-4" />
                    {callHistory.total_calls} calls from this number
                  </p>
                  {callHistory.customer && (
                    <p className="text-primary mt-1 text-xs">
                      Already linked to: {callHistory.customer.name}
                    </p>
                  )}
                </div>
              )}

              {aiDetectedName && (
                <div className="rounded-lg bg-violet-500/[0.06] border border-violet-500/20 p-3 text-sm">
                  <p className="text-violet-400 flex items-center gap-2 font-semibold">
                    <Sparkles className="w-4 h-4" />
                    AI Detected: {aiDetectedName}
                  </p>
                  <p className="font-mono text-[10px] text-muted-foreground mt-1">
                    Extracted from call transcript
                  </p>
                </div>
              )}

              <div>
                <label className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground block mb-1.5">
                  Customer Name *
                </label>
                <Input
                  value={newCustomerName}
                  onChange={(e) => setNewCustomerName(e.target.value)}
                  placeholder="Enter customer name…"
                  data-testid="customer-name-input"
                />
                <p className="font-mono text-[10px] text-muted-foreground mt-1.5">
                  A new customer record will be created with this name and phone number
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setLinkCustomerDialogOpen(false)} disabled={linkingLoading}>
              Cancel
            </Button>
            <Button onClick={linkCallToCustomer} disabled={linkingLoading || !newCustomerName.trim()} data-testid="link-customer-btn">
              {linkingLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create & Link Customer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </IronShell>
  );
}
