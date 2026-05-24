import { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Phone, PhoneIncoming, PhoneMissed, PhoneOutgoing, Clock, User, Building2,
  Play, RefreshCw, Search, Filter, TrendingUp, TrendingDown, Headphones, PhoneCall, Loader2, CheckCircle, XCircle,
  Brain, FileText, MessageSquare, AlertTriangle, UserX, ThumbsUp, ThumbsDown,
  Bell, ListTodo, UserPlus, Timer, AlertCircle, Link, History, Sparkles,
  ChevronLeft, ChevronRight, Download,
} from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { CountUp, Shimmer } from '@/components/ui/motion';
import ClickToCallButton from '@/components/calls/ClickToCallButton';
import { cn } from '@/lib/utils';

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

// ─── Design tokens ───────────────────────────────────────────────────────────
const BADGE_CLS = 'px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wide ring-1 whitespace-nowrap';

const STATUS_BADGE = {
  answered: 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/25',
  missed:   'bg-rose-500/15 text-rose-400 ring-rose-500/25',
  dialed:   'bg-amber-400/15 text-amber-400 ring-amber-400/25',
};

const PRIORITY_BADGE = {
  urgent: 'bg-rose-500/15 text-rose-400 ring-rose-500/25',
  high:   'bg-orange-400/15 text-orange-400 ring-orange-400/25',
  normal: 'bg-sky-400/15 text-sky-400 ring-sky-400/25',
  low:    'bg-muted text-muted-foreground ring-border',
};

const TASK_TYPE_BADGE = {
  callback:    'bg-sky-400/15 text-sky-400 ring-sky-400/25',
  sales_lead:  'bg-emerald-500/15 text-emerald-400 ring-emerald-500/25',
  tech_support:'bg-violet-400/15 text-violet-400 ring-violet-400/25',
  complaint:   'bg-rose-500/15 text-rose-400 ring-rose-500/25',
  general:     'bg-muted text-muted-foreground ring-border',
};

const thCls = 'px-4 py-3 text-left font-mono text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground';

// ─── KPI card — hero metric matching AdminDashboard ──────────────────────────
const KpiCard = ({ label, value, delta, deltaTone = 'neutral', sub, icon: Icon }) => {
  const accent = {
    up:      'text-emerald-500',
    down:    'text-rose-400',
    warn:    'text-amber-400',
    neutral: 'text-primary',
  }[deltaTone] || 'text-primary';
  return (
    <div className="mg-card group relative overflow-hidden rounded-lg border border-border bg-card p-5">
      <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-primary/[0.07] blur-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
      <div className="relative flex items-start justify-between">
        <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</span>
        {Icon && <Icon className={cn('h-[18px] w-[18px]', accent)} />}
      </div>
      <div className="relative mt-4 font-mono text-[32px] font-bold leading-none tracking-tight tabular-nums text-foreground">
        {value}
      </div>
      <div className="relative mt-3 flex items-center gap-2">
        {delta != null && delta !== '' && (
          <span className={cn('font-mono text-[11px] font-bold', accent)}>{delta}</span>
        )}
        {sub && (
          <span className="truncate font-mono text-[10px] uppercase tracking-[0.05em] text-muted-foreground/70">{sub}</span>
        )}
      </div>
    </div>
  );
};

// ─── Agent performance card ───────────────────────────────────────────────────
const AgentCard = ({ agent }) => {
  const initials = (agent.agent_name || agent.name || '?').split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
  const isOnline = !agent.status || agent.status === 'online';
  return (
    <div className="flex items-start gap-3 px-4 py-3 border-b border-border last:border-b-0 hover:bg-muted/40 transition-colors cursor-default">
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary font-mono font-bold text-sm select-none">
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-foreground truncate">{agent.agent_name || agent.name}</p>
          <span className={cn(BADGE_CLS, isOnline ? 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/25' : 'bg-muted text-muted-foreground ring-border')}>
            {isOnline ? 'Online' : 'Away'}
          </span>
        </div>
        <p className="font-mono text-[11px] text-muted-foreground truncate">{agent.department}</p>
        <div className="mt-2 flex gap-4">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/60">Answered</p>
            <p className="font-mono text-xs font-bold text-foreground tabular-nums">{agent.answered ?? 0}</p>
          </div>
          <div>
            <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/60">Missed</p>
            <p className="font-mono text-xs font-bold text-foreground tabular-nums">{agent.missed ?? 0}</p>
          </div>
          {agent.avg_quality_score != null && (
            <div>
              <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/60">Quality</p>
              <p className={cn('font-mono text-xs font-bold tabular-nums',
                agent.avg_quality_score >= 7 ? 'text-emerald-400' :
                agent.avg_quality_score >= 5 ? 'text-amber-400' : 'text-rose-400'
              )}>{agent.avg_quality_score}/10</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Dialog call info block ───────────────────────────────────────────────────
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
    setTaskCall({...call, id: callId});
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

  const openRecording = (call) => {
    const recordingUrl = call.raw_data?.recording_url || call.recording_url;
    if (recordingUrl) {
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
  const answeredVal   = dashboard?.summary?.answered || 0;
  const missedVal     = dashboard?.summary?.missed || 0;
  const avgDur        = dashboard?.summary?.avg_duration || 0;
  const answeredRate  = totalCallsVal > 0 ? ((answeredVal / totalCallsVal) * 100).toFixed(1) : '—';
  const avgDurSecs    = Math.round(Number(avgDur));
  const avgDurFmt     = avgDurSecs > 0
    ? `${Math.floor(avgDurSecs / 60)}m ${(avgDurSecs % 60).toString().padStart(2, '0')}s`
    : '—';

  // Active alerts (not dismissed)
  const visibleAlerts = alertsDismissed ? [] : alerts;
  const hasCritical   = visibleAlerts.some(a => a.severity === 'critical');

  // Agents list for left panel — prefer detailed agentPerformance, fall back to dashboard.agent_stats
  const agentList = (agentPerformance?.agents?.length ? agentPerformance.agents : dashboard?.agent_stats || []);

  if (loading && !dashboard) {
    return (
      <DashboardLayout title="Call Center">
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
            {Array.from({ length: 4 }).map((_, i) => <Shimmer key={i} className="h-28 rounded-lg" />)}
          </div>
          <Shimmer className="h-14 w-full rounded-lg" />
          <Shimmer className="h-64 w-full rounded-lg" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Call Center">
      <div className="space-y-5">

        {/* ── Page header ──────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="mb-1.5 flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Live · Smartflo IVR
              </span>
            </div>
            <h1 className="text-[26px] font-bold leading-tight tracking-tight text-foreground">
              {isCallSupport ? 'My Calls Dashboard' : 'Call Center Dashboard'}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isCallSupport ? 'Your call activity and performance' : 'Real-time call tracking across all agents'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Global search */}
            <div className="relative hidden md:flex items-center">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search interactions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-56 text-sm"
              />
            </div>
            {isCallSupport && (
              <Button
                onClick={() => setQuickDialOpen(true)}
                className="gap-2"
                data-testid="quick-dial-btn"
              >
                <PhoneCall className="w-4 h-4" />
                Quick Dial
              </Button>
            )}
            <Button
              onClick={() => { fetchDashboard(); fetchAlerts(); fetchTasks(); }}
              variant="outline"
              className="gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </Button>
          </div>
        </div>

        {/* ── KPI row ──────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Total Call Volume"
            value={totalCallsVal.toLocaleString('en-IN')}
            sub="all channels"
            icon={Phone}
          />
          <KpiCard
            label="Answered Rate"
            value={`${answeredRate}%`}
            delta={answeredVal > 0 ? `${answeredVal} answered` : null}
            deltaTone={Number(answeredRate) >= 80 ? 'up' : Number(answeredRate) >= 60 ? 'warn' : 'down'}
            sub="daily trend stable"
            icon={CheckCircle}
          />
          <KpiCard
            label="Missed Calls"
            value={<span className={missedVal > 0 ? 'text-rose-400' : ''}>{missedVal}</span>}
            delta={missedVal > 0 ? 'Requires Attention' : 'None'}
            deltaTone={missedVal > 0 ? 'down' : 'up'}
            sub={missedVal > 0 ? 'SLA review needed' : 'All calls answered'}
            icon={PhoneMissed}
          />
          <KpiCard
            label="Avg. Handle Time"
            value={<span className="font-mono">{avgDurFmt}</span>}
            sub="stable vs prev. period"
            icon={Clock}
          />
        </div>

        {/* ── Critical Alerts strip ─────────────────────────────────────────── */}
        {visibleAlerts.length > 0 && (
          <div className="mg-card rounded-lg border border-rose-500/25 bg-rose-500/[0.06] p-4">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-rose-500/15">
                  <AlertCircle className="w-5 h-5 text-rose-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-semibold text-rose-400">
                    {hasCritical ? 'Critical Alerts' : 'Action Required'} ({visibleAlerts.length})
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {hasCritical
                      ? 'SLA breach detected — immediate triage recommended'
                      : 'Some calls require follow-up action'}
                  </p>
                  <div className="mt-2 space-y-1.5 max-h-28 overflow-y-auto">
                    {visibleAlerts.slice(0, 5).map((alert, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs">
                        <span className={cn(BADGE_CLS,
                          alert.severity === 'critical' ? 'bg-rose-500/15 text-rose-400 ring-rose-500/25' :
                          alert.severity === 'high'     ? 'bg-orange-400/15 text-orange-400 ring-orange-400/25' :
                                                          'bg-amber-400/15 text-amber-400 ring-amber-400/25'
                        )}>
                          {alert.severity}
                        </span>
                        <span className="text-foreground/80">{alert.message}</span>
                        {alert.caller_phone && (
                          <span className="font-mono text-muted-foreground">({alert.caller_phone})</span>
                        )}
                        {alert.call_id && (
                          <button
                            className="ml-1 text-primary hover:underline font-semibold"
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
                      <p className="font-mono text-[10px] text-muted-foreground">+{visibleAlerts.length - 5} more alerts</p>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => setAlertsDismissed(true)}
                >
                  Dismiss All
                </Button>
                <Button
                  size="sm"
                  onClick={() => setActiveTab('tasks')}
                >
                  Launch Triage
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── Tabs: Calls / Tasks ──────────────────────────────────────────── */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="h-9 bg-muted/50 border border-border">
            <TabsTrigger value="calls" className="text-xs gap-1.5 data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <Phone className="w-3.5 h-3.5" />
              Calls
            </TabsTrigger>
            <TabsTrigger value="tasks" className="text-xs gap-1.5 data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <ListTodo className="w-3.5 h-3.5" />
              Tasks
              {tasks.filter(t => t.status === 'pending').length > 0 && (
                <span className={cn(BADGE_CLS, 'bg-orange-400/15 text-orange-400 ring-orange-400/25 ml-1')}>
                  {tasks.filter(t => t.status === 'pending').length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ═══ CALLS TAB ═══════════════════════════════════════════════════ */}
          <TabsContent value="calls" className="mt-5 space-y-5">

            {/* My improvement tips — agents only */}
            {isCallSupport && (
              <div className="mg-card rounded-lg border border-violet-500/20 bg-violet-500/[0.04] p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-400/15">
                    <Sparkles className="w-4 h-4 text-violet-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Tips for High Call Score</p>
                    <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Performance guidance</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                  {[
                    { icon: User,         color: 'sky',     title: 'Ask customer name',   body: 'Start every call by politely asking for the customer\'s name' },
                    { icon: Phone,        color: 'emerald', title: 'Greet professionally', body: '"MuscleGrid service, [Your Name] speaking. How may I help you?"' },
                    { icon: MessageSquare,color: 'amber',   title: 'Listen actively',      body: 'Let customer explain fully before responding' },
                    { icon: CheckCircle,  color: 'orange',  title: 'Summarize & confirm',  body: 'Repeat back the customer\'s issue to confirm understanding' },
                    { icon: Clock,        color: 'sky',     title: "Don't rush",           body: 'Speak clearly and don\'t rush through explanations' },
                    { icon: ThumbsUp,     color: 'emerald', title: 'End positively',       body: '"Is there anything else I can help you with today?"' },
                  ].map(({ icon: Ic, color, title, body }) => (
                    <div key={title} className="rounded-lg bg-muted/50 border border-border p-3">
                      <p className="text-sm font-semibold text-foreground flex items-center gap-2 mb-1">
                        <Ic className="w-4 h-4 text-muted-foreground" />
                        {title}
                      </p>
                      <p className="text-xs text-muted-foreground">{body}</p>
                    </div>
                  ))}
                </div>

                {myImprovementTips.length > 0 && (
                  <div className="border-t border-border pt-4 mt-4">
                    <p className="text-xs font-semibold text-violet-400 mb-3 flex items-center gap-2">
                      <Brain className="w-4 h-4" />
                      Personalised tips from your recent calls
                    </p>
                    <ul className="space-y-2">
                      {myImprovementTips.map((tip, idx) => (
                        <li key={idx} className="flex items-start gap-3 p-2 rounded-lg bg-muted/40">
                          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-violet-500/15 text-violet-400 flex items-center justify-center font-mono text-xs font-bold">
                            {idx + 1}
                          </span>
                          <div className="flex-1">
                            <p className="text-sm text-foreground">{tip.advice}</p>
                            {tip.quality_score && (
                              <p className="font-mono text-[10px] text-muted-foreground mt-1">
                                From call scored {tip.quality_score}/10
                              </p>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Two-column layout: agent panel + table */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">

              {/* ── Left: Active Performance ─────────────────────────────── */}
              {!isCallSupport && (
                <div className="mg-card rounded-lg border border-border bg-card flex flex-col lg:col-span-4">
                  <div className="flex items-center justify-between border-b border-border px-4 py-3 bg-muted/30">
                    <div>
                      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Active Performance</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Last 30 days</p>
                    </div>
                    <button
                      onClick={fetchAgentPerformance}
                      disabled={performanceLoading}
                      className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      title="Refresh"
                    >
                      {performanceLoading
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <RefreshCw className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  {/* Agent list */}
                  <div className="flex-1 overflow-y-auto max-h-[520px]">
                    {agentList.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                        <Headphones className="w-10 h-10 mb-3 opacity-30" />
                        <p className="text-sm">No agent data</p>
                      </div>
                    ) : (
                      agentList.map((agent, idx) => <AgentCard key={idx} agent={agent} />)
                    )}
                  </div>

                  {/* Department stats mini-table */}
                  {Object.entries(dashboard?.department_stats || {}).length > 0 && (
                    <div className="border-t border-border px-4 py-3 bg-muted/20">
                      <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-2">By Department</p>
                      <div className="space-y-1">
                        {Object.entries(dashboard?.department_stats || {}).map(([key, dept]) => (
                          <div key={key} className="flex items-center justify-between text-xs">
                            <span className="text-foreground font-medium truncate">{dept.name}</span>
                            <div className="flex gap-2 flex-shrink-0">
                              <span className="text-emerald-400 font-mono">{dept.answered}✓</span>
                              <span className="text-rose-400 font-mono">{dept.missed}✗</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── Right: filter bar + calls table ─────────────────────── */}
              <div className={cn('flex flex-col gap-4', isCallSupport ? 'lg:col-span-12' : 'lg:col-span-8')}>

                {/* Filter bar */}
                <div className="mg-card rounded-lg border border-border bg-card p-3 flex flex-wrap items-center gap-2">
                  {/* Mobile search */}
                  <div className="relative flex md:hidden items-center flex-1 min-w-[160px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 text-sm"
                    />
                  </div>

                  {!isCallSupport && (
                    <Select value={selectedDept} onValueChange={setSelectedDept}>
                      <SelectTrigger className="w-40 text-xs h-8">
                        <SelectValue placeholder="All Departments" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Departments</SelectItem>
                        <SelectItem value="Cx Exp">Customer Support</SelectItem>
                        <SelectItem value="Sales">Sales</SelectItem>
                      </SelectContent>
                    </Select>
                  )}

                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-border bg-muted/40 text-xs text-muted-foreground font-mono">
                    <Clock className="w-3.5 h-3.5" />
                    Last 30 days
                  </div>

                  <div className="ml-auto flex items-center gap-2">
                    <span className="font-mono text-[11px] text-muted-foreground tabular-nums hidden sm:inline">
                      {totalCalls.toLocaleString('en-IN')} records
                    </span>
                  </div>
                </div>

                {/* Calls table */}
                <div className="mg-card rounded-lg border border-border bg-card overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border bg-muted/30">
                          <th className={thCls}>Time</th>
                          <th className={thCls}>Caller</th>
                          {!isCallSupport && <th className={thCls}>Agent</th>}
                          {!isCallSupport && <th className={thCls}>Dept</th>}
                          <th className={thCls}>Status</th>
                          <th className={thCls}>Duration</th>
                          <th className={thCls}>Outcome</th>
                          {canAccessRecordings && <th className={thCls}>Recording</th>}
                          {canViewAIAnalysis && <th className={thCls}>AI</th>}
                          <th className={thCls}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedCalls.map((call, idx) => {
                          const status     = getCallStatus(call);
                          const duration   = call.raw_data?.duration || call.duration;
                          const hasRecording = call.raw_data?.recording_url || call.recording_url;
                          const callerPhone  = call.caller_id_number || call.caller_phone;

                          return (
                            <motion.tr
                              key={call.id || idx}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ duration: 0.2, delay: Math.min(idx, 15) * 0.02 }}
                              className="border-b border-border last:border-b-0 hover:bg-muted/40 transition-colors"
                            >
                              <td className="px-4 py-3 text-sm text-muted-foreground font-mono whitespace-nowrap">
                                {formatDate(call.received_at || call.date)}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 min-w-0">
                                    <p className="font-mono text-sm font-semibold text-foreground">{callerPhone}</p>
                                    {call.matched_customer_name ? (
                                      <p className="text-xs text-primary truncate">{call.matched_customer_name}</p>
                                    ) : call.ai_detected_customer_name ? (
                                      <p className="text-xs text-violet-400 flex items-center gap-1 truncate">
                                        <Sparkles className="w-3 h-3 flex-shrink-0" />
                                        {call.ai_detected_customer_name}
                                      </p>
                                    ) : null}
                                  </div>
                                  {!call.matched_customer_name && callerPhone && (
                                    <button
                                      className="flex-shrink-0 text-muted-foreground hover:text-primary transition-colors"
                                      onClick={() => openLinkCustomerDialog(call)}
                                      title="Link to Customer"
                                    >
                                      <Link className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              </td>
                              {!isCallSupport && (
                                <td className="px-4 py-3 text-sm font-medium text-foreground whitespace-nowrap">
                                  {call.agent_name || '-'}
                                </td>
                              )}
                              {!isCallSupport && (
                                <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                                  {call.dept_name || '-'}
                                </td>
                              )}
                              <td className="px-4 py-3">
                                <span className={cn(BADGE_CLS, STATUS_BADGE[status] || STATUS_BADGE.dialed)}>
                                  {status}
                                </span>
                              </td>
                              <td className="px-4 py-3 font-mono text-sm text-muted-foreground">
                                {formatDuration(duration)}
                              </td>
                              <td className="px-4 py-3">
                                {call.outcome ? (
                                  <button
                                    className={cn(BADGE_CLS, 'bg-muted text-muted-foreground ring-border cursor-pointer hover:bg-muted/80')}
                                    onClick={() => openOutcomeDialog(call)}
                                  >
                                    {CALL_OUTCOMES.find(o => o.value === call.outcome)?.label || call.outcome}
                                  </button>
                                ) : (
                                  <button
                                    className="font-mono text-[11px] text-primary hover:underline"
                                    onClick={() => openOutcomeDialog(call)}
                                  >
                                    + Add
                                  </button>
                                )}
                              </td>
                              {canAccessRecordings && (
                                <td className="px-4 py-3">
                                  {hasRecording ? (
                                    inlinePlayingId === (call.id || call.uuid) ? (
                                      <div className="flex items-center gap-1">
                                        <audio
                                          controls
                                          autoPlay
                                          preload="metadata"
                                          src={call.raw_data?.recording_url || call.recording_url}
                                          className="h-7 max-w-[180px]"
                                        />
                                        <button
                                          className="text-muted-foreground hover:text-foreground"
                                          onClick={() => setInlinePlayingId(null)}
                                          title="Hide player"
                                        >
                                          <XCircle className="w-4 h-4" />
                                        </button>
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-0.5">
                                        <button
                                          className="p-1 rounded text-primary hover:bg-primary/10 transition-colors"
                                          onClick={() => setInlinePlayingId(call.id || call.uuid)}
                                          title="Play inline"
                                        >
                                          <Play className="w-4 h-4" />
                                        </button>
                                        <button
                                          className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-muted/60 transition-colors"
                                          onClick={() => openRecording(call)}
                                          title="Open in dialog"
                                        >
                                          <FileText className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    )
                                  ) : (
                                    <span className="text-muted-foreground/40 text-xs">—</span>
                                  )}
                                </td>
                              )}
                              {canViewAIAnalysis && (
                                <td className="px-4 py-3">
                                  {hasRecording ? (
                                    call.ai_analysis ? (
                                      <button
                                        className="p-1 rounded text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                                        onClick={() => openAnalysisDialog(call)}
                                        title="View AI Analysis"
                                      >
                                        <FileText className="w-4 h-4" />
                                      </button>
                                    ) : canRunAIAnalysis ? (
                                      <button
                                        className="p-1 rounded text-violet-400 hover:bg-violet-500/10 transition-colors"
                                        onClick={() => openAnalysisDialog(call)}
                                        title="Run AI Analysis"
                                      >
                                        <Brain className="w-4 h-4" />
                                      </button>
                                    ) : (
                                      <span className="font-mono text-[10px] text-muted-foreground">Pending</span>
                                    )
                                  ) : (
                                    <span className="text-muted-foreground/40 text-xs">—</span>
                                  )}
                                </td>
                              )}
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1">
                                  {callerPhone && (
                                    <ClickToCallButton
                                      phone={callerPhone}
                                      customerName={call.matched_customer_name}
                                      showLabel={false}
                                      size="sm"
                                    />
                                  )}
                                  <button
                                    className="p-1 rounded text-amber-400 hover:bg-amber-400/10 transition-colors"
                                    onClick={() => openTaskDialog(call)}
                                    title="Assign Task"
                                  >
                                    <UserPlus className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </motion.tr>
                          );
                        })}
                        {paginatedCalls.length === 0 && (
                          <tr>
                            <td
                              colSpan={isCallSupport ? (canViewAIAnalysis ? 8 : 6) : (canAccessRecordings ? 10 : 8)}
                              className="px-4 py-12 text-center text-sm text-muted-foreground"
                            >
                              <Phone className="w-10 h-10 mx-auto mb-3 opacity-20" />
                              No calls found
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination footer */}
                  {totalCalls > 0 && (
                    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-muted/30 border-t border-border">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                          Showing {startIndex + 1}–{Math.min(endIndex, totalCalls)} of {totalCalls.toLocaleString('en-IN')}
                        </span>
                        <Select value={rowsPerPage.toString()} onValueChange={(v) => { setRowsPerPage(Number(v)); setCurrentPage(1); }}>
                          <SelectTrigger className="w-20 h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="10">10</SelectItem>
                            <SelectItem value="20">20</SelectItem>
                            <SelectItem value="50">50</SelectItem>
                          </SelectContent>
                        </Select>
                        <span className="font-mono text-[11px] text-muted-foreground hidden sm:inline">per page</span>
                      </div>
                      {totalPages > 1 && (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="p-1.5 rounded text-muted-foreground hover:bg-card disabled:opacity-30 transition-colors"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            let pageNum;
                            if (totalPages <= 5)             pageNum = i + 1;
                            else if (currentPage <= 3)       pageNum = i + 1;
                            else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                            else                             pageNum = currentPage - 2 + i;
                            return (
                              <button
                                key={pageNum}
                                onClick={() => setCurrentPage(pageNum)}
                                className={cn(
                                  'w-8 h-8 rounded text-xs font-semibold font-mono transition-colors',
                                  currentPage === pageNum
                                    ? 'bg-primary text-primary-foreground'
                                    : 'text-muted-foreground hover:bg-card'
                                )}
                              >
                                {pageNum}
                              </button>
                            );
                          })}
                          <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="p-1.5 rounded text-muted-foreground hover:bg-card disabled:opacity-30 transition-colors"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ═══ TASKS TAB ═══════════════════════════════════════════════════ */}
          <TabsContent value="tasks" className="mt-5">
            <div className="mg-card rounded-lg border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border px-5 py-3 bg-muted/30">
                <div>
                  <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
                    {isCallSupport ? 'My Tasks' : 'All Tasks'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">1-hour SLA target per task</p>
                </div>
                <button
                  onClick={fetchTasks}
                  disabled={tasksLoading}
                  className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  {tasksLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                </button>
              </div>

              <div className="p-5">
                {tasksLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : tasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 mb-3">
                      <CheckCircle className="w-6 h-6 text-emerald-400" />
                    </div>
                    <p className="text-sm font-semibold text-foreground">All clear</p>
                    <p className="text-xs mt-1">No tasks assigned</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {tasks.map((task) => (
                      <div
                        key={task.id}
                        className={cn(
                          'rounded-lg border p-4 transition-colors',
                          task.sla_breached
                            ? 'bg-rose-500/[0.05] border-rose-500/30'
                            : task.status === 'completed'
                              ? 'bg-emerald-500/[0.05] border-emerald-500/25'
                              : task.minutes_remaining < 15
                                ? 'bg-orange-400/[0.05] border-orange-400/25'
                                : 'bg-muted/30 border-border'
                        )}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-2">
                              <span className={cn(BADGE_CLS, PRIORITY_BADGE[task.priority] || PRIORITY_BADGE.low)}>
                                {task.priority}
                              </span>
                              <span className={cn(BADGE_CLS, TASK_TYPE_BADGE[task.task_type] || TASK_TYPE_BADGE.general)}>
                                {task.task_type?.replace('_', ' ')}
                              </span>
                              {task.sla_breached && (
                                <span className={cn(BADGE_CLS, 'bg-rose-500/15 text-rose-400 ring-rose-500/25')}>
                                  SLA Breached ({task.overdue_minutes}m overdue)
                                </span>
                              )}
                              {!task.sla_breached && task.status === 'pending' && (
                                <span className={cn('font-mono text-[10px]', task.minutes_remaining < 15 ? 'text-orange-400' : 'text-muted-foreground')}>
                                  <Timer className="w-3 h-3 inline mr-1" />
                                  {task.minutes_remaining}m remaining
                                </span>
                              )}
                            </div>

                            <p className="text-sm font-semibold text-foreground">{task.description}</p>

                            <div className="mt-2 space-y-0.5 font-mono text-[11px] text-muted-foreground">
                              <p>
                                <span className="uppercase tracking-wide opacity-60">Customer:</span>{' '}
                                <span className="text-foreground">{task.caller_phone}</span>
                                {task.customer_name && <span className="text-primary ml-2">({task.customer_name})</span>}
                              </p>
                              <p>
                                <span className="uppercase tracking-wide opacity-60">Assigned to:</span>{' '}
                                {task.assigned_to_name}
                                <span className="opacity-50 ml-2">by {task.assigned_by_name}</span>
                              </p>
                              <p>
                                <span className="uppercase tracking-wide opacity-60">Created:</span>{' '}
                                {new Date(task.created_at).toLocaleString()}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-col gap-2 flex-shrink-0">
                            {task.status === 'pending' && (
                              <>
                                <ClickToCallButton
                                  phone={task.caller_phone}
                                  customerName={task.customer_name}
                                  showLabel={true}
                                  size="sm"
                                />
                                <Button
                                  size="sm"
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                                  onClick={() => completeTask(task.id)}
                                >
                                  <CheckCircle className="w-3.5 h-3.5" />
                                  Complete
                                </Button>
                              </>
                            )}
                            {task.status === 'completed' && (
                              <span className={cn(BADGE_CLS, 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/25')}>
                                Completed
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* ═══════════════════════════════════════════════════════════════════
            DIALOGS
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
                  <audio
                    controls
                    className="w-full"
                    src={selectedCall?.raw_data?.recording_url || selectedCall?.recording_url}
                  >
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
                <Button
                  variant="ghost"
                  onClick={() => { setQuickDialOpen(false); setQuickDialNumber(''); }}
                  disabled={quickDialCalling}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleQuickDial}
                  disabled={quickDialCalling || quickDialNumber.length !== 10}
                  className="gap-2"
                  data-testid="quick-dial-call-btn"
                >
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
              <Button
                onClick={saveCallOutcome}
                disabled={outcomeLoading || !selectedOutcome}
              >
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
                    {/* Transcript */}
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

                    {/* Analysis sections */}
                    {analysisResult.analysis && (
                      <div className="space-y-3">
                        {/* Quality score */}
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
                                  analysisResult.analysis.customer_satisfaction_likely === 'high'   ? 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/25' :
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

                        {/* Tone grid */}
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

                        {/* Red flags */}
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

                        {/* What went wrong */}
                        {analysisResult.analysis.what_went_wrong?.length > 0 && (
                          <div className="rounded-lg bg-orange-400/[0.06] border border-orange-400/20 p-3">
                            <p className="font-mono text-[11px] uppercase tracking-wide text-orange-400 mb-2">What Went Wrong</p>
                            <ul className="list-disc list-inside text-sm text-foreground/80 space-y-1">
                              {analysisResult.analysis.what_went_wrong.map((item, i) => <li key={i}>{item}</li>)}
                            </ul>
                          </div>
                        )}

                        {/* What went well */}
                        {analysisResult.analysis.what_went_well?.length > 0 && (
                          <div className="rounded-lg bg-emerald-500/[0.06] border border-emerald-500/20 p-3">
                            <p className="font-mono text-[11px] uppercase tracking-wide text-emerald-400 mb-2">What Went Well</p>
                            <ul className="list-disc list-inside text-sm text-foreground/80 space-y-1">
                              {analysisResult.analysis.what_went_well.map((item, i) => <li key={i}>{item}</li>)}
                            </ul>
                          </div>
                        )}

                        {/* Improvement advice */}
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
                    <Button
                      onClick={runCallAnalysis}
                      disabled={analysisLoading}
                      variant="outline"
                      className="gap-2"
                    >
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
              <Button
                onClick={createTask}
                disabled={taskSubmitting || !taskAssignee || !taskDescription}
                data-testid="create-task-btn"
              >
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
              <Button
                onClick={linkCallToCustomer}
                disabled={linkingLoading || !newCustomerName.trim()}
                data-testid="link-customer-btn"
              >
                {linkingLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create & Link Customer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </DashboardLayout>
  );
}
