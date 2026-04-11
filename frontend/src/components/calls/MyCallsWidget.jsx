import { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Phone, PhoneIncoming, PhoneMissed, Clock, Play, RefreshCw, User, Headphones
} from 'lucide-react';
import { toast } from 'sonner';

export default function MyCallsWidget() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [selectedCall, setSelectedCall] = useState(null);
  const [recordingOpen, setRecordingOpen] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetchMyCalls();
  }, []);

  const fetchMyCalls = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/smartflo/my-calls?limit=20`, { headers });
      setData(res.data);
    } catch (err) {
      console.error('Error fetching my calls:', err);
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
      toast.info('No recording available');
    }
  };

  if (loading) {
    return (
      <Card className="bg-slate-800 border-slate-700">
        <CardContent className="p-6 flex items-center justify-center">
          <RefreshCw className="w-6 h-6 animate-spin text-cyan-400" />
        </CardContent>
      </Card>
    );
  }

  if (!data?.agent) {
    return (
      <Card className="bg-slate-800 border-slate-700">
        <CardContent className="p-6 text-center text-slate-400">
          <Headphones className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p>No Smartflo agent mapping found</p>
          <p className="text-xs">Contact admin to link your account</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Phone className="w-5 h-5 text-cyan-400" />
              My Calls
            </CardTitle>
            <Button onClick={fetchMyCalls} variant="ghost" size="sm">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-slate-700/50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-white">{data.stats?.total || 0}</p>
              <p className="text-xs text-slate-400">Total</p>
            </div>
            <div className="bg-green-900/30 rounded-lg p-3 text-center border border-green-700">
              <p className="text-2xl font-bold text-green-400">{data.stats?.answered || 0}</p>
              <p className="text-xs text-green-300">Answered</p>
            </div>
            <div className="bg-red-900/30 rounded-lg p-3 text-center border border-red-700">
              <p className="text-2xl font-bold text-red-400">{data.stats?.missed || 0}</p>
              <p className="text-xs text-red-300">Missed</p>
            </div>
          </div>

          {/* Recent Calls */}
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {(data.calls || []).slice(0, 10).map((call, idx) => {
              const status = getCallStatus(call);
              const duration = call.raw_data?.duration || call.duration;
              const hasRecording = call.raw_data?.recording_url || call.recording_url;
              
              return (
                <div 
                  key={call.id || idx}
                  className={`flex items-center justify-between p-2 rounded-lg ${
                    status === 'missed' ? 'bg-red-900/20 border border-red-800' : 'bg-slate-700/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {status === 'missed' ? (
                      <PhoneMissed className="w-4 h-4 text-red-400" />
                    ) : (
                      <PhoneIncoming className="w-4 h-4 text-green-400" />
                    )}
                    <div>
                      <p className="font-mono text-sm text-white">{call.caller_id_number || call.caller_phone}</p>
                      <p className="text-xs text-slate-400">{formatDate(call.received_at)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {duration > 0 && (
                      <span className="text-xs text-slate-400 font-mono">{formatDuration(duration)}</span>
                    )}
                    {hasRecording && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 text-cyan-400"
                        onClick={() => openRecording(call)}
                      >
                        <Play className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
            {data.calls?.length === 0 && (
              <p className="text-center text-slate-400 py-4">No calls yet</p>
            )}
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
    </>
  );
}
