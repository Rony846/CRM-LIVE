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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { 
  Phone, PhoneIncoming, PhoneMissed, PhoneOutgoing, Clock, User, Building2, 
  Play, RefreshCw, Search, Filter, TrendingUp, TrendingDown, Headphones, PhoneCall, Loader2, CheckCircle, XCircle,
  Brain, FileText, MessageSquare
} from 'lucide-react';
import { toast } from 'sonner';
import ClickToCallButton from '@/components/calls/ClickToCallButton';

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

export default function CallsDashboard() {
  const { token, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState(null);
  const [selectedDept, setSelectedDept] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCall, setSelectedCall] = useState(null);
  const [recordingOpen, setRecordingOpen] = useState(false);
  
  // Quick dial state for call support agents
  const [quickDialOpen, setQuickDialOpen] = useState(false);
  const [quickDialNumber, setQuickDialNumber] = useState('');
  const [quickDialCalling, setQuickDialCalling] = useState(false);
  const [quickDialStatus, setQuickDialStatus] = useState(null); // null, 'success', 'error'
  
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

  const headers = { Authorization: `Bearer ${token}` };
  
  // Check if user is call_support role - they only see their own data
  const isCallSupport = user?.role === 'call_support';
  // Only admin and supervisor can access recordings
  const canAccessRecordings = ['admin', 'supervisor'].includes(user?.role);

  useEffect(() => {
    fetchDashboard();
  }, [selectedDept]);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const params = {};
      if (selectedDept && selectedDept !== 'all') {
        params.department = selectedDept;
      }
      
      // Call support agents get their own calls via /my-calls endpoint
      if (isCallSupport) {
        const res = await axios.get(`${API}/smartflo/my-calls?limit=50`, { headers });
        // Transform my-calls response to dashboard format for consistency
        setDashboard({
          summary: {
            total_calls: res.data.stats?.total || 0,
            answered: res.data.stats?.answered || 0,
            missed: res.data.stats?.missed || 0,
            avg_duration: res.data.stats?.avg_duration || 0
          },
          recent_calls: res.data.calls || [],
          agent_stats: res.data.agent ? [{
            name: res.data.agent.name,
            department: res.data.agent.department,
            answered: res.data.stats?.answered || 0,
            missed: res.data.stats?.missed || 0
          }] : [],
          department_stats: {}
        });
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
  
  // Quick dial handler for call support agents
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
      
      // Auto close after 3 seconds
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
  
  // Open outcome dialog
  const openOutcomeDialog = (call) => {
    setOutcomeCall(call);
    setSelectedOutcome(call.outcome || '');
    setOutcomeNotes(call.outcome_notes || '');
    setOutcomeDialogOpen(true);
  };
  
  // Save call outcome
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
      fetchDashboard(); // Refresh to show updated outcome
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save outcome');
    } finally {
      setOutcomeLoading(false);
    }
  };
  
  // Open analysis dialog
  const openAnalysisDialog = (call) => {
    setAnalysisCall(call);
    setAnalysisResult(call.ai_analysis || null);
    setAnalysisDialogOpen(true);
  };
  
  // Run AI analysis on call
  const runCallAnalysis = async () => {
    setAnalysisLoading(true);
    try {
      const callId = analysisCall.id || analysisCall.uuid;
      const res = await axios.post(`${API}/smartflo/calls/${callId}/analyze`, {}, { headers });
      
      setAnalysisResult(res.data.analysis);
      toast.success('Call analyzed successfully');
      fetchDashboard(); // Refresh to show updated analysis
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to analyze call');
    } finally {
      setAnalysisLoading(false);
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '-';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
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

  if (loading && !dashboard) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin text-cyan-400" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Phone className="w-7 h-7 text-cyan-400" />
              {isCallSupport ? 'My Calls Dashboard' : 'Call Center Dashboard'}
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              {isCallSupport ? 'Your call activity and performance' : 'Smartflo IVR integration - Real-time call tracking'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Quick Dial Button for Call Support */}
            {isCallSupport && (
              <Button 
                onClick={() => setQuickDialOpen(true)} 
                className="bg-green-600 hover:bg-green-700 gap-2"
                data-testid="quick-dial-btn"
              >
                <PhoneCall className="w-4 h-4" />
                Quick Dial
              </Button>
            )}
            <Button onClick={fetchDashboard} variant="outline" className="gap-2">
              <RefreshCw className="w-4 h-4" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Total Calls</p>
                  <p className="text-3xl font-bold text-white">{dashboard?.summary?.total_calls || 0}</p>
                </div>
                <Phone className="w-10 h-10 text-cyan-400 opacity-50" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-green-900/50 to-slate-900 border-green-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-300 text-sm">Answered</p>
                  <p className="text-3xl font-bold text-green-400">{dashboard?.summary?.answered || 0}</p>
                </div>
                <PhoneIncoming className="w-10 h-10 text-green-400 opacity-50" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-red-900/50 to-slate-900 border-red-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-red-300 text-sm">Missed</p>
                  <p className="text-3xl font-bold text-red-400">{dashboard?.summary?.missed || 0}</p>
                </div>
                <PhoneMissed className="w-10 h-10 text-red-400 opacity-50" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-blue-900/50 to-slate-900 border-blue-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-300 text-sm">Avg Duration</p>
                  <p className="text-3xl font-bold text-blue-400">{formatDuration(dashboard?.summary?.avg_duration)}</p>
                </div>
                <Clock className="w-10 h-10 text-blue-400 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Department & Agent Stats - Hidden for call_support */}
        {!isCallSupport && (
        <div className="grid md:grid-cols-2 gap-6">
          {/* Department Stats */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="w-5 h-5 text-purple-400" />
                Department Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(dashboard?.department_stats || {}).map(([key, dept]) => (
                  <div key={key} className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                    <div>
                      <p className="font-medium text-white">{dept.name}</p>
                      <p className="text-sm text-slate-400">{dept.total} total calls</p>
                    </div>
                    <div className="flex gap-4 text-sm">
                      <span className="text-green-400">{dept.answered} answered</span>
                      <span className="text-red-400">{dept.missed} missed</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Agent Stats */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Headphones className="w-5 h-5 text-cyan-400" />
                Agent Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-[250px] overflow-y-auto">
                {(dashboard?.agent_stats || []).map((agent, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm">
                        {agent.name?.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium text-white">{agent.name}</p>
                        <p className="text-xs text-slate-400">{agent.department}</p>
                      </div>
                    </div>
                    <div className="flex gap-3 text-sm">
                      <Badge className="bg-green-600">{agent.answered} ✓</Badge>
                      <Badge className="bg-red-600">{agent.missed} ✗</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
        )}

        {/* Recent Calls */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">{isCallSupport ? 'My Recent Calls' : 'Recent Calls'}</CardTitle>
              <div className="flex gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Search calls..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 w-60 bg-slate-700 border-slate-600"
                  />
                </div>
                {/* Department filter only for admin/supervisor */}
                {!isCallSupport && (
                <Select value={selectedDept} onValueChange={setSelectedDept}>
                  <SelectTrigger className="w-40 bg-slate-700 border-slate-600">
                    <SelectValue placeholder="Department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    <SelectItem value="Cx Exp">Customer Support</SelectItem>
                    <SelectItem value="Sales">Sales</SelectItem>
                  </SelectContent>
                </Select>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-slate-700">
                  <TableRow>
                    <TableHead className="text-cyan-300">Time</TableHead>
                    <TableHead className="text-cyan-300">Caller</TableHead>
                    {!isCallSupport && <TableHead className="text-cyan-300">Agent</TableHead>}
                    {!isCallSupport && <TableHead className="text-cyan-300">Department</TableHead>}
                    <TableHead className="text-cyan-300">Status</TableHead>
                    <TableHead className="text-cyan-300">Duration</TableHead>
                    <TableHead className="text-cyan-300">Outcome</TableHead>
                    {canAccessRecordings && <TableHead className="text-cyan-300">Recording</TableHead>}
                    {canAccessRecordings && <TableHead className="text-cyan-300">AI</TableHead>}
                    <TableHead className="text-cyan-300">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCalls.map((call, idx) => {
                    const status = getCallStatus(call);
                    const duration = call.raw_data?.duration || call.duration;
                    const hasRecording = call.raw_data?.recording_url || call.recording_url;
                    const callerPhone = call.caller_id_number || call.caller_phone;
                    
                    return (
                      <TableRow key={call.id || idx} className="border-slate-700 hover:bg-slate-700/50">
                        <TableCell className="text-slate-300 text-sm">
                          {formatDate(call.received_at || call.date)}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-mono text-white">{callerPhone}</p>
                            {call.matched_customer_name && (
                              <p className="text-xs text-cyan-400">{call.matched_customer_name}</p>
                            )}
                          </div>
                        </TableCell>
                        {!isCallSupport && (
                        <TableCell className="text-white font-medium">
                          {call.agent_name || '-'}
                        </TableCell>
                        )}
                        {!isCallSupport && (
                        <TableCell className="text-slate-300">
                          {call.dept_name || '-'}
                        </TableCell>
                        )}
                        <TableCell>
                          {status === 'answered' ? (
                            <Badge className="bg-green-600">Answered</Badge>
                          ) : status === 'missed' ? (
                            <Badge className="bg-red-600">Missed</Badge>
                          ) : (
                            <Badge className="bg-yellow-600">Dialed</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-slate-300 font-mono">
                          {formatDuration(duration)}
                        </TableCell>
                        <TableCell>
                          {call.outcome ? (
                            <Badge 
                              className="bg-slate-600 cursor-pointer hover:bg-slate-500"
                              onClick={() => openOutcomeDialog(call)}
                            >
                              {CALL_OUTCOMES.find(o => o.value === call.outcome)?.label || call.outcome}
                            </Badge>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-slate-400 hover:text-white text-xs"
                              onClick={() => openOutcomeDialog(call)}
                            >
                              + Add
                            </Button>
                          )}
                        </TableCell>
                        {canAccessRecordings && (
                        <TableCell>
                          {hasRecording ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-cyan-400 hover:text-cyan-300"
                              onClick={() => openRecording(call)}
                            >
                              <Play className="w-4 h-4" />
                            </Button>
                          ) : (
                            <span className="text-slate-500">-</span>
                          )}
                        </TableCell>
                        )}
                        {canAccessRecordings && (
                        <TableCell>
                          {hasRecording ? (
                            call.ai_analysis ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-green-400 hover:text-green-300"
                                onClick={() => openAnalysisDialog(call)}
                                title="View AI Analysis"
                              >
                                <FileText className="w-4 h-4" />
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-purple-400 hover:text-purple-300"
                                onClick={() => openAnalysisDialog(call)}
                                title="Run AI Analysis"
                              >
                                <Brain className="w-4 h-4" />
                              </Button>
                            )
                          ) : (
                            <span className="text-slate-500">-</span>
                          )}
                        </TableCell>
                        )}
                        <TableCell>
                          {callerPhone && (
                            <ClickToCallButton 
                              phone={callerPhone}
                              customerName={call.matched_customer_name}
                              showLabel={false}
                              size="sm"
                            />
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredCalls.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={isCallSupport ? 6 : (canAccessRecordings ? 10 : 8)} className="text-center py-8 text-slate-400">
                        No calls found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Recording Dialog - Only for admin/supervisor */}
        {canAccessRecordings && (
        <Dialog open={recordingOpen} onOpenChange={setRecordingOpen}>
          <DialogContent className="bg-slate-800 border-slate-700 text-white">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Play className="w-5 h-5 text-cyan-400" />
                Call Recording
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="p-3 bg-slate-700 rounded-lg text-sm">
                <p><strong>Caller:</strong> {selectedCall?.caller_id_number}</p>
                <p><strong>Agent:</strong> {selectedCall?.agent_name}</p>
                <p><strong>Duration:</strong> {formatDuration(selectedCall?.raw_data?.duration || selectedCall?.duration)}</p>
              </div>
              <audio
                controls
                className="w-full"
                src={selectedCall?.raw_data?.recording_url || selectedCall?.recording_url}
              >
                Your browser does not support the audio element.
              </audio>
            </div>
          </DialogContent>
        </Dialog>
        )}
        
        {/* Quick Dial Dialog - For Call Support */}
        <Dialog open={quickDialOpen} onOpenChange={setQuickDialOpen}>
          <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <PhoneCall className="w-5 h-5 text-green-400" />
                Quick Dial
              </DialogTitle>
            </DialogHeader>
            
            <div className="py-4">
              {quickDialStatus === 'success' ? (
                <div className="text-center py-4">
                  <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
                  <p className="text-lg font-medium text-green-400">Call Initiated!</p>
                  <p className="text-sm text-slate-400 mt-1">Your phone will ring first, then we'll connect to the number</p>
                </div>
              ) : quickDialStatus === 'error' ? (
                <div className="text-center py-4">
                  <XCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
                  <p className="text-lg font-medium text-red-400">Call Failed</p>
                  <p className="text-sm text-slate-400 mt-1">Please try again or contact admin</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-slate-400 block mb-2">Enter 10-digit phone number</label>
                    <Input
                      type="tel"
                      placeholder="9876543210"
                      value={quickDialNumber}
                      onChange={(e) => setQuickDialNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      className="bg-slate-700 border-slate-600 text-white text-2xl font-mono text-center tracking-widest h-14"
                      maxLength={10}
                      data-testid="quick-dial-input"
                    />
                  </div>
                  <div className="bg-slate-700/50 rounded-lg p-3 text-sm text-slate-300">
                    <p className="flex items-center gap-2">
                      <span className="text-cyan-400">1.</span> Your phone will ring first
                    </p>
                    <p className="flex items-center gap-2">
                      <span className="text-cyan-400">2.</span> Pick up to connect to customer
                    </p>
                  </div>
                </div>
              )}
            </div>

            {!quickDialStatus && (
              <DialogFooter>
                <Button 
                  variant="ghost" 
                  onClick={() => {
                    setQuickDialOpen(false);
                    setQuickDialNumber('');
                  }}
                  disabled={quickDialCalling}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleQuickDial}
                  disabled={quickDialCalling || quickDialNumber.length !== 10}
                  className="bg-green-600 hover:bg-green-700 gap-2"
                  data-testid="quick-dial-call-btn"
                >
                  {quickDialCalling ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Phone className="w-4 h-4" />
                  )}
                  {quickDialCalling ? 'Calling...' : 'Call'}
                </Button>
              </DialogFooter>
            )}
          </DialogContent>
        </Dialog>
        
        {/* Outcome Dialog */}
        <Dialog open={outcomeDialogOpen} onOpenChange={setOutcomeDialogOpen}>
          <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-cyan-400" />
                Call Outcome
              </DialogTitle>
            </DialogHeader>
            
            {outcomeCall && (
              <div className="space-y-4 py-2">
                <div className="p-3 bg-slate-700 rounded-lg text-sm">
                  <p><strong>Caller:</strong> {outcomeCall.caller_id_number || outcomeCall.caller_phone}</p>
                  <p><strong>Time:</strong> {formatDate(outcomeCall.received_at || outcomeCall.date)}</p>
                  {outcomeCall.matched_customer_name && (
                    <p><strong>Customer:</strong> {outcomeCall.matched_customer_name}</p>
                  )}
                </div>
                
                <div>
                  <Label className="text-slate-300">Outcome *</Label>
                  <Select value={selectedOutcome} onValueChange={setSelectedOutcome}>
                    <SelectTrigger className="bg-slate-700 border-slate-600 mt-1">
                      <SelectValue placeholder="Select outcome..." />
                    </SelectTrigger>
                    <SelectContent>
                      {CALL_OUTCOMES.map(o => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label className="text-slate-300">Notes (Optional)</Label>
                  <Textarea
                    value={outcomeNotes}
                    onChange={(e) => setOutcomeNotes(e.target.value)}
                    placeholder="Add any notes about this call..."
                    className="bg-slate-700 border-slate-600 mt-1"
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
                className="bg-cyan-600 hover:bg-cyan-700"
              >
                {outcomeLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Outcome
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        {/* AI Analysis Dialog */}
        <Dialog open={analysisDialogOpen} onOpenChange={setAnalysisDialogOpen}>
          <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-purple-400" />
                AI Call Analysis
              </DialogTitle>
            </DialogHeader>
            
            {analysisCall && (
              <div className="space-y-4 py-2">
                <div className="p-3 bg-slate-700 rounded-lg text-sm">
                  <p><strong>Caller:</strong> {analysisCall.caller_id_number || analysisCall.caller_phone}</p>
                  <p><strong>Time:</strong> {formatDate(analysisCall.received_at || analysisCall.date)}</p>
                  <p><strong>Duration:</strong> {formatDuration(analysisCall.raw_data?.duration || analysisCall.duration)}</p>
                </div>
                
                {analysisResult ? (
                  <div className="space-y-4">
                    {/* Transcript */}
                    {analysisResult.transcript && (
                      <div className="p-4 bg-slate-900 rounded-lg">
                        <h4 className="text-sm font-medium text-cyan-400 mb-2 flex items-center gap-2">
                          <FileText className="w-4 h-4" />
                          Transcript (Hindi)
                        </h4>
                        <p className="text-sm text-slate-300 whitespace-pre-wrap max-h-40 overflow-y-auto">
                          {analysisResult.transcript}
                        </p>
                      </div>
                    )}
                    
                    {/* Analysis */}
                    {analysisResult.analysis && (
                      <div className="space-y-3">
                        {analysisResult.analysis.summary && (
                          <div className="p-3 bg-green-900/30 border border-green-700 rounded-lg">
                            <h4 className="text-sm font-medium text-green-400 mb-1">Summary</h4>
                            <p className="text-sm text-slate-300">{analysisResult.analysis.summary}</p>
                          </div>
                        )}
                        
                        {analysisResult.analysis.customer_intent && (
                          <div className="p-3 bg-blue-900/30 border border-blue-700 rounded-lg">
                            <h4 className="text-sm font-medium text-blue-400 mb-1">Customer Intent</h4>
                            <p className="text-sm text-slate-300">{analysisResult.analysis.customer_intent}</p>
                          </div>
                        )}
                        
                        {analysisResult.analysis.key_points?.length > 0 && (
                          <div className="p-3 bg-slate-700/50 rounded-lg">
                            <h4 className="text-sm font-medium text-slate-300 mb-2">Key Points</h4>
                            <ul className="list-disc list-inside text-sm text-slate-400 space-y-1">
                              {analysisResult.analysis.key_points.map((point, i) => (
                                <li key={i}>{point}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        
                        {analysisResult.analysis.action_items?.length > 0 && (
                          <div className="p-3 bg-yellow-900/30 border border-yellow-700 rounded-lg">
                            <h4 className="text-sm font-medium text-yellow-400 mb-2">Action Items</h4>
                            <ul className="list-disc list-inside text-sm text-slate-300 space-y-1">
                              {analysisResult.analysis.action_items.map((item, i) => (
                                <li key={i}>{item}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        
                        <div className="flex gap-4">
                          {analysisResult.analysis.sentiment && (
                            <Badge className={
                              analysisResult.analysis.sentiment === 'positive' ? 'bg-green-600' :
                              analysisResult.analysis.sentiment === 'negative' ? 'bg-red-600' : 'bg-slate-600'
                            }>
                              Sentiment: {analysisResult.analysis.sentiment}
                            </Badge>
                          )}
                          
                          {analysisResult.analysis.suggested_outcome && (
                            <Badge className="bg-purple-600">
                              Suggested: {CALL_OUTCOMES.find(o => o.value === analysisResult.analysis.suggested_outcome)?.label || analysisResult.analysis.suggested_outcome}
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                    
                    <p className="text-xs text-slate-500">
                      Analyzed at: {analysisResult.analyzed_at ? new Date(analysisResult.analyzed_at).toLocaleString() : 'N/A'}
                    </p>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Brain className="w-16 h-16 text-purple-400 mx-auto mb-4 opacity-50" />
                    <p className="text-slate-300 mb-2">No analysis yet</p>
                    <p className="text-sm text-slate-500 mb-4">
                      AI will transcribe the Hindi call and provide a summary with key insights
                    </p>
                    <Button
                      onClick={runCallAnalysis}
                      disabled={analysisLoading}
                      className="bg-purple-600 hover:bg-purple-700"
                    >
                      {analysisLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <Brain className="w-4 h-4 mr-2" />
                          Run AI Analysis
                        </>
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
                  className="bg-cyan-600 hover:bg-cyan-700"
                >
                  Apply Suggested Outcome
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
