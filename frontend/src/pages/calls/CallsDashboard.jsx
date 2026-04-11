import { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Phone, PhoneIncoming, PhoneMissed, PhoneOutgoing, Clock, User, Building2, 
  Play, RefreshCw, Search, Filter, TrendingUp, TrendingDown, Headphones
} from 'lucide-react';
import { toast } from 'sonner';

export default function CallsDashboard() {
  const { token, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState(null);
  const [selectedDept, setSelectedDept] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCall, setSelectedCall] = useState(null);
  const [recordingOpen, setRecordingOpen] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

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
      const res = await axios.get(`${API}/smartflo/dashboard`, { headers, params });
      setDashboard(res.data);
    } catch (err) {
      console.error('Error fetching dashboard:', err);
      toast.error('Failed to load call dashboard');
    } finally {
      setLoading(false);
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
              Call Center Dashboard
            </h1>
            <p className="text-slate-400 text-sm mt-1">Smartflo IVR integration - Real-time call tracking</p>
          </div>
          <Button onClick={fetchDashboard} variant="outline" className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
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

        {/* Department & Agent Stats */}
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

        {/* Recent Calls */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Recent Calls</CardTitle>
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
                    <TableHead className="text-cyan-300">Agent</TableHead>
                    <TableHead className="text-cyan-300">Department</TableHead>
                    <TableHead className="text-cyan-300">Status</TableHead>
                    <TableHead className="text-cyan-300">Duration</TableHead>
                    <TableHead className="text-cyan-300">Recording</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCalls.map((call, idx) => {
                    const status = getCallStatus(call);
                    const duration = call.raw_data?.duration || call.duration;
                    const hasRecording = call.raw_data?.recording_url || call.recording_url;
                    
                    return (
                      <TableRow key={call.id || idx} className="border-slate-700 hover:bg-slate-700/50">
                        <TableCell className="text-slate-300 text-sm">
                          {formatDate(call.received_at || call.date)}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-mono text-white">{call.caller_id_number || call.caller_phone}</p>
                            {call.matched_customer_name && (
                              <p className="text-xs text-cyan-400">{call.matched_customer_name}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-white font-medium">
                          {call.agent_name || '-'}
                        </TableCell>
                        <TableCell className="text-slate-300">
                          {call.dept_name || '-'}
                        </TableCell>
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
                      </TableRow>
                    );
                  })}
                  {filteredCalls.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-slate-400">
                        No calls found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Recording Dialog */}
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
      </div>
    </DashboardLayout>
  );
}
