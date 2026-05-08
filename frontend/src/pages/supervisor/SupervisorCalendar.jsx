import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import StatusBadge from '@/components/ui/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter 
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { 
  CalendarDays, Clock, Loader2, CheckCircle, XCircle, 
  Phone, User, Settings, Video, Calendar as CalendarIcon
} from 'lucide-react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function SupervisorCalendar() {
  const { token, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState([]);
  const [stats, setStats] = useState({});
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [actionOpen, setActionOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [notes, setNotes] = useState('');
  const [newStatus, setNewStatus] = useState('');
  
  // Availability settings
  const [availabilityOpen, setAvailabilityOpen] = useState(false);
  const [availability, setAvailability] = useState([]);
  const [blockedDates, setBlockedDates] = useState([]);

  useEffect(() => {
    fetchAppointments();
    fetchAvailability();
  }, [token]);

  const fetchAppointments = async () => {
    try {
      const response = await axios.get(`${API}/supervisor/appointments`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAppointments(response.data.appointments || []);
      setStats(response.data.stats || {});
    } catch (error) {
      toast.error('Failed to load appointments');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailability = async () => {
    try {
      const response = await axios.get(`${API}/supervisor/availability`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAvailability(response.data.slots || []);
      setBlockedDates(response.data.blocked_dates || []);
    } catch (error) {
      console.error('Failed to load availability');
    }
  };

  const handleStatusUpdate = async () => {
    if (!selectedAppointment || !newStatus) return;
    
    setActionLoading(true);
    try {
      await axios.patch(
        `${API}/appointments/${selectedAppointment.id}/status`,
        null,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: { status: newStatus, notes: notes || undefined }
        }
      );
      toast.success(`Appointment marked as ${newStatus}`);
      setActionOpen(false);
      setNotes('');
      setNewStatus('');
      fetchAppointments();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveAvailability = async () => {
    setActionLoading(true);
    try {
      await axios.post(`${API}/supervisor/availability`, {
        slots: availability,
        blocked_dates: blockedDates
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Availability saved');
      setAvailabilityOpen(false);
    } catch (error) {
      toast.error('Failed to save availability');
    } finally {
      setActionLoading(false);
    }
  };

  const toggleDayAvailability = (dayIndex) => {
    setAvailability(prev => {
      const existing = prev.find(s => s.day_of_week === dayIndex);
      if (existing) {
        return prev.map(s => 
          s.day_of_week === dayIndex 
            ? {...s, is_available: !s.is_available}
            : s
        );
      } else {
        return [...prev, {
          day_of_week: dayIndex,
          start_time: '09:00',
          end_time: '19:00',
          is_available: true
        }];
      }
    });
  };

  const updateDayTime = (dayIndex, field, value) => {
    setAvailability(prev => prev.map(s => 
      s.day_of_week === dayIndex ? {...s, [field]: value} : s
    ));
  };

  const openActionDialog = (appointment) => {
    setSelectedAppointment(appointment);
    setNewStatus('');
    setNotes('');
    setActionOpen(true);
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      confirmed: 'bg-blue-100 text-blue-800 border-blue-300',
      completed: 'bg-green-100 text-green-800 border-green-300',
      cancelled: 'bg-red-100 text-red-800 border-red-300',
      no_show: 'bg-gray-100 text-gray-800 border-gray-300'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  // Filter appointments for selected date
  const dateStr = selectedDate.toISOString().split('T')[0];
  const todayAppointments = appointments.filter(a => a.date === dateStr);
  const pendingAppointments = appointments.filter(a => a.status === 'pending');

  if (loading) {
    return (
      <DashboardLayout title="Calendar">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Appointment Calendar">
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-5 gap-4">
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <p className="text-3xl font-bold text-white">{stats.total || 0}</p>
              <p className="text-sm text-slate-400">Total Appointments</p>
            </CardContent>
          </Card>
          <Card className="bg-yellow-900/30 border-yellow-700">
            <CardContent className="p-4">
              <p className="text-3xl font-bold text-yellow-400">{stats.pending || 0}</p>
              <p className="text-sm text-yellow-200">Pending</p>
            </CardContent>
          </Card>
          <Card className="bg-blue-900/30 border-blue-700">
            <CardContent className="p-4">
              <p className="text-3xl font-bold text-blue-400">{stats.confirmed || 0}</p>
              <p className="text-sm text-blue-200">Confirmed</p>
            </CardContent>
          </Card>
          <Card className="bg-green-900/30 border-green-700">
            <CardContent className="p-4">
              <p className="text-3xl font-bold text-green-400">{stats.completed || 0}</p>
              <p className="text-sm text-green-200">Completed</p>
            </CardContent>
          </Card>
          <Card className="bg-red-900/30 border-red-700">
            <CardContent className="p-4">
              <p className="text-3xl font-bold text-red-400">{stats.no_show || 0}</p>
              <p className="text-sm text-red-200">No Shows</p>
            </CardContent>
          </Card>
        </div>

        {/* Availability Settings Button */}
        <div className="flex justify-end">
          <Button 
            variant="outline" 
            onClick={() => setAvailabilityOpen(true)}
            className="text-slate-300 border-slate-600"
          >
            <Settings className="w-4 h-4 mr-2" />
            Manage Availability
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-blue-400" />
                Select Date
              </CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(d) => d && setSelectedDate(d)}
                className="rounded-md border border-slate-600"
              />
            </CardContent>
          </Card>

          {/* Day's Appointments */}
          <Card className="bg-slate-800 border-slate-700 lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-400" />
                Appointments for {formatDate(dateStr)}
                <span className="text-sm font-normal text-slate-400">
                  ({todayAppointments.length} scheduled)
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {todayAppointments.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <CalendarDays className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No appointments for this day</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {todayAppointments.sort((a, b) => a.time_slot.localeCompare(b.time_slot)).map((apt) => (
                    <div 
                      key={apt.id}
                      className={`p-4 rounded-lg border ${getStatusColor(apt.status)} flex justify-between items-center`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="text-center">
                          <p className="text-lg font-bold">{apt.time_slot}</p>
                          <p className="text-xs">to {apt.end_time}</p>
                        </div>
                        <div>
                          <p className="font-medium">{apt.customer_name}</p>
                          <p className="text-sm opacity-75">{apt.customer_phone}</p>
                          <p className="text-xs mt-1">{apt.reason}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-1 text-xs font-medium rounded capitalize">
                          {apt.status.replace('_', ' ')}
                        </span>
                        {['pending', 'confirmed'].includes(apt.status) && (
                          <Button size="sm" onClick={() => openActionDialog(apt)}>
                            Update
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Pending Appointments Queue */}
        {pendingAppointments.length > 0 && (
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-yellow-400" />
                Pending Confirmation ({pendingAppointments.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-slate-300">Date</TableHead>
                    <TableHead className="text-slate-300">Time</TableHead>
                    <TableHead className="text-slate-300">Customer</TableHead>
                    <TableHead className="text-slate-300">Contact</TableHead>
                    <TableHead className="text-slate-300">Reason</TableHead>
                    <TableHead className="text-slate-300">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingAppointments.map((apt) => (
                    <TableRow key={apt.id} className="border-slate-700">
                      <TableCell className="text-white">{formatDate(apt.date)}</TableCell>
                      <TableCell className="text-white">{apt.time_slot}</TableCell>
                      <TableCell className="text-white font-medium">{apt.customer_name}</TableCell>
                      <TableCell className="text-slate-300">{apt.customer_phone}</TableCell>
                      <TableCell className="text-slate-300 max-w-xs truncate">{apt.reason}</TableCell>
                      <TableCell>
                        <Button size="sm" onClick={() => openActionDialog(apt)}>
                          Manage
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Update Status Dialog */}
      <Dialog open={actionOpen} onOpenChange={setActionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Appointment</DialogTitle>
          </DialogHeader>
          {selectedAppointment && (
            <div className="space-y-4">
              <div className="bg-slate-100 p-4 rounded-lg">
                <p><strong>Customer:</strong> {selectedAppointment.customer_name}</p>
                <p><strong>Phone:</strong> {selectedAppointment.customer_phone}</p>
                <p><strong>Date:</strong> {formatDate(selectedAppointment.date)}</p>
                <p><strong>Time:</strong> {selectedAppointment.time_slot} - {selectedAppointment.end_time}</p>
                <p><strong>Reason:</strong> {selectedAppointment.reason}</p>
              </div>

              <div className="space-y-2">
                <Label>Update Status</Label>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="confirmed">✓ Confirm</SelectItem>
                    <SelectItem value="completed">✓ Mark Completed</SelectItem>
                    <SelectItem value="cancelled">✗ Cancel</SelectItem>
                    <SelectItem value="no_show">⚠ No Show</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Notes (Optional)</Label>
                <Textarea
                  placeholder="Add any notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionOpen(false)}>Cancel</Button>
            <Button onClick={handleStatusUpdate} disabled={actionLoading || !newStatus}>
              {actionLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Availability Settings Dialog */}
      <Dialog open={availabilityOpen} onOpenChange={setAvailabilityOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Manage Availability
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <p className="text-sm text-slate-500">
              Set your available hours for each day. Customers can book 30-minute slots within these hours.
            </p>
            
            {DAYS.map((day, index) => {
              const slot = availability.find(s => s.day_of_week === index) || {
                day_of_week: index,
                start_time: '09:00',
                end_time: '19:00',
                is_available: index < 6
              };
              
              return (
                <div key={day} className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg">
                  <Checkbox
                    checked={slot.is_available}
                    onCheckedChange={() => toggleDayAvailability(index)}
                  />
                  <span className="w-24 font-medium">{day}</span>
                  {slot.is_available ? (
                    <>
                      <Input
                        type="time"
                        value={slot.start_time}
                        onChange={(e) => updateDayTime(index, 'start_time', e.target.value)}
                        className="w-28"
                      />
                      <span>to</span>
                      <Input
                        type="time"
                        value={slot.end_time}
                        onChange={(e) => updateDayTime(index, 'end_time', e.target.value)}
                        className="w-28"
                      />
                    </>
                  ) : (
                    <span className="text-slate-400">Not Available</span>
                  )}
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAvailabilityOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveAvailability} disabled={actionLoading}>
              {actionLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Save Availability
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
