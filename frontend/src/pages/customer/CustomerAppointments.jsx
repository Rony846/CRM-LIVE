import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter 
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { 
  CalendarDays, Clock, Video, Loader2, CheckCircle, XCircle, 
  Phone, User, Calendar as CalendarIcon
} from 'lucide-react';

export default function CustomerAppointments() {
  const { token, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [myAppointments, setMyAppointments] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [reason, setReason] = useState('');
  const [supervisorName, setSupervisorName] = useState('');

  useEffect(() => {
    fetchAppointments();
  }, [token]);

  const fetchAppointments = async () => {
    try {
      const response = await axios.get(`${API}/appointments`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMyAppointments(response.data);
    } catch (error) {
      toast.error('Failed to load appointments');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableSlots = async (date) => {
    if (!date) return;
    
    const dateStr = date.toISOString().split('T')[0];
    setSlotsLoading(true);
    setAvailableSlots([]);
    
    try {
      const response = await axios.get(`${API}/appointments/available-slots`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { date: dateStr }
      });
      setAvailableSlots(response.data.slots || []);
      setSupervisorName(response.data.supervisor_name || 'Supervisor');
    } catch (error) {
      toast.error('Failed to load available slots');
    } finally {
      setSlotsLoading(false);
    }
  };

  const handleDateSelect = (date) => {
    setSelectedDate(date);
    setSelectedSlot(null);
    fetchAvailableSlots(date);
  };

  const handleSlotSelect = (slot) => {
    setSelectedSlot(slot);
    setBookingOpen(true);
  };

  const handleBookAppointment = async () => {
    if (!selectedDate || !selectedSlot || !reason.trim()) {
      toast.error('Please fill all required fields');
      return;
    }
    
    setBookingLoading(true);
    try {
      const dateStr = selectedDate.toISOString().split('T')[0];
      await axios.post(`${API}/appointments`, {
        date: dateStr,
        time_slot: selectedSlot,
        reason: reason
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Appointment booked successfully! You will receive a confirmation.');
      setBookingOpen(false);
      setSelectedSlot(null);
      setReason('');
      fetchAppointments();
      fetchAvailableSlots(selectedDate);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to book appointment');
    } finally {
      setBookingLoading(false);
    }
  };

  const handleCancelAppointment = async (appointmentId) => {
    if (!confirm('Are you sure you want to cancel this appointment?')) return;
    
    try {
      await axios.delete(`${API}/appointments/${appointmentId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Appointment cancelled');
      fetchAppointments();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to cancel');
    }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      confirmed: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
      no_show: 'bg-gray-100 text-gray-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const upcomingAppointments = myAppointments.filter(a => 
    ['pending', 'confirmed'].includes(a.status)
  );
  const pastAppointments = myAppointments.filter(a => 
    ['completed', 'cancelled', 'no_show'].includes(a.status)
  );

  // Disable past dates and Sundays
  const disabledDays = (date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today || date.getDay() === 0;
  };

  if (loading) {
    return (
      <DashboardLayout title="Book Appointment">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Book Appointment with Supervisor">
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-6 text-white">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-xl">
              <Video className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Schedule a Consultation</h1>
              <p className="text-blue-100">Book a 30-minute video call with our supervisor for personalized support</p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="book" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="book" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <CalendarDays className="w-4 h-4 mr-2" />
              Book New
            </TabsTrigger>
            <TabsTrigger value="upcoming" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <Clock className="w-4 h-4 mr-2" />
              Upcoming ({upcomingAppointments.length})
            </TabsTrigger>
            <TabsTrigger value="past" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <CheckCircle className="w-4 h-4 mr-2" />
              Past
            </TabsTrigger>
          </TabsList>

          {/* Book New Appointment */}
          <TabsContent value="book">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Calendar */}
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CalendarIcon className="w-5 h-5 text-blue-600" />
                    Select Date
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex justify-center">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={handleDateSelect}
                    disabled={disabledDays}
                    className="rounded-md border"
                  />
                </CardContent>
              </Card>

              {/* Time Slots */}
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-blue-600" />
                    Available Time Slots
                    {supervisorName && (
                      <span className="text-sm font-normal text-slate-500">
                        with {supervisorName}
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!selectedDate ? (
                    <div className="text-center py-12 text-slate-500">
                      <CalendarDays className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p>Please select a date to see available slots</p>
                    </div>
                  ) : slotsLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                    </div>
                  ) : availableSlots.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                      <XCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p>No slots available for this date</p>
                      <p className="text-sm">Try selecting another date</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {availableSlots.map((slot) => (
                        <Button
                          key={slot}
                          variant="outline"
                          className={`h-12 text-sm font-medium transition-all ${
                            selectedSlot === slot 
                              ? 'bg-blue-600 text-white border-blue-600' 
                              : 'hover:bg-blue-50 hover:border-blue-300'
                          }`}
                          onClick={() => handleSlotSelect(slot)}
                          data-testid={`slot-${slot}`}
                        >
                          {slot}
                        </Button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Upcoming Appointments */}
          <TabsContent value="upcoming">
            {upcomingAppointments.length === 0 ? (
              <Card className="shadow-lg">
                <CardContent className="text-center py-12 text-slate-500">
                  <CalendarDays className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No upcoming appointments</p>
                  <p className="text-sm mt-2">Book your first consultation above!</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {upcomingAppointments.map((apt) => (
                  <Card key={apt.id} className="shadow-lg hover:shadow-xl transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex justify-between items-start">
                        <div className="flex gap-4">
                          <div className="p-3 bg-blue-100 rounded-xl">
                            <Video className="w-6 h-6 text-blue-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-lg">{formatDate(apt.date)}</h3>
                            <p className="text-blue-600 font-medium">{apt.time_slot} - {apt.end_time}</p>
                            <p className="text-slate-500 text-sm mt-1">
                              <User className="w-3 h-3 inline mr-1" />
                              with {apt.supervisor_name}
                            </p>
                            <p className="text-slate-600 mt-2">{apt.reason}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(apt.status)}`}>
                            {apt.status.charAt(0).toUpperCase() + apt.status.slice(1)}
                          </span>
                          {apt.status !== 'cancelled' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="mt-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleCancelAppointment(apt.id)}
                            >
                              Cancel
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Past Appointments */}
          <TabsContent value="past">
            {pastAppointments.length === 0 ? (
              <Card className="shadow-lg">
                <CardContent className="text-center py-12 text-slate-500">
                  <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No past appointments</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {pastAppointments.map((apt) => (
                  <Card key={apt.id} className="shadow-lg opacity-80">
                    <CardContent className="p-6">
                      <div className="flex justify-between items-start">
                        <div className="flex gap-4">
                          <div className={`p-3 rounded-xl ${apt.status === 'completed' ? 'bg-green-100' : 'bg-gray-100'}`}>
                            {apt.status === 'completed' ? (
                              <CheckCircle className="w-6 h-6 text-green-600" />
                            ) : (
                              <XCircle className="w-6 h-6 text-gray-400" />
                            )}
                          </div>
                          <div>
                            <h3 className="font-semibold">{formatDate(apt.date)}</h3>
                            <p className="text-slate-600">{apt.time_slot} - {apt.end_time}</p>
                            <p className="text-slate-500 text-sm mt-1">with {apt.supervisor_name}</p>
                          </div>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(apt.status)}`}>
                          {apt.status.charAt(0).toUpperCase() + apt.status.slice(1).replace('_', ' ')}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Booking Confirmation Dialog */}
      <Dialog open={bookingOpen} onOpenChange={setBookingOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Video className="w-5 h-5 text-blue-600" />
              Confirm Your Appointment
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
              <div className="flex items-center gap-3 mb-2">
                <CalendarIcon className="w-5 h-5 text-blue-600" />
                <span className="font-medium">
                  {selectedDate && formatDate(selectedDate)}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-blue-600" />
                <span className="font-medium">{selectedSlot} (30 minutes)</span>
              </div>
              <div className="flex items-center gap-3 mt-2">
                <User className="w-5 h-5 text-blue-600" />
                <span>with {supervisorName}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Reason for Appointment *</Label>
              <Textarea
                placeholder="Briefly describe what you'd like to discuss..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                data-testid="appointment-reason"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBookingOpen(false)}>Cancel</Button>
            <Button 
              className="bg-blue-600 hover:bg-blue-700"
              onClick={handleBookAppointment}
              disabled={bookingLoading || !reason.trim()}
              data-testid="confirm-booking"
            >
              {bookingLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Confirm Booking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
