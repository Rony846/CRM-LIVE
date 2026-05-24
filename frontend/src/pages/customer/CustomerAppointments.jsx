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

// Obsidian status chip map
const STATUS_TONES = {
  pending:   'bg-amber-400/15 text-amber-400 ring-amber-400/25',
  confirmed: 'bg-sky-400/15 text-sky-400 ring-sky-400/25',
  completed: 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/25',
  cancelled: 'bg-rose-500/15 text-rose-400 ring-rose-500/25',
  no_show:   'bg-muted text-muted-foreground ring-border',
};
const BADGE = 'px-2 py-0.5 text-[10px] font-mono font-semibold rounded uppercase tracking-wide ring-1';

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
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Book Appointment with Supervisor">
      <div className="space-y-6">
        {/* Hero header — dark glass banner */}
        <div className="mg-card rounded-lg border border-primary/25 bg-primary/10 p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded bg-primary/20">
              <Video className="w-7 h-7 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Schedule a Consultation</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Book a 30-minute video call with our supervisor for personalized support
              </p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="book" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6 bg-muted">
            <TabsTrigger value="book">
              <CalendarDays className="w-4 h-4 mr-2" />
              Book New
            </TabsTrigger>
            <TabsTrigger value="upcoming">
              <Clock className="w-4 h-4 mr-2" />
              Upcoming ({upcomingAppointments.length})
            </TabsTrigger>
            <TabsTrigger value="past">
              <CheckCircle className="w-4 h-4 mr-2" />
              Past
            </TabsTrigger>
          </TabsList>

          {/* Book New Appointment */}
          <TabsContent value="book">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Calendar */}
              <div className="mg-card rounded-lg border border-border bg-card">
                <div className="p-5 border-b border-border">
                  <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <div className="flex h-7 w-7 items-center justify-center rounded bg-primary/15">
                      <CalendarIcon className="w-4 h-4 text-primary" />
                    </div>
                    Select Date
                  </h2>
                </div>
                <div className="p-5 flex justify-center">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={handleDateSelect}
                    disabled={disabledDays}
                    className="rounded-md border border-border"
                  />
                </div>
              </div>

              {/* Time Slots */}
              <div className="mg-card rounded-lg border border-border bg-card">
                <div className="p-5 border-b border-border">
                  <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <div className="flex h-7 w-7 items-center justify-center rounded bg-primary/15">
                      <Clock className="w-4 h-4 text-primary" />
                    </div>
                    Available Time Slots
                    {supervisorName && (
                      <span className="font-normal text-muted-foreground text-xs ml-1">
                        with {supervisorName}
                      </span>
                    )}
                  </h2>
                </div>
                <div className="p-5">
                  {!selectedDate ? (
                    <div className="text-center py-12">
                      <CalendarDays className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-40" />
                      <p className="text-sm text-muted-foreground">Please select a date to see available slots</p>
                    </div>
                  ) : slotsLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                  ) : availableSlots.length === 0 ? (
                    <div className="text-center py-12">
                      <XCircle className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-40" />
                      <p className="text-sm text-muted-foreground">No slots available for this date</p>
                      <p className="text-xs text-muted-foreground/60 mt-1">Try selecting another date</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {availableSlots.map((slot) => (
                        <Button
                          key={slot}
                          variant="outline"
                          className={`h-11 font-mono text-xs font-semibold transition-all ${
                            selectedSlot === slot
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
                          }`}
                          onClick={() => handleSlotSelect(slot)}
                          data-testid={`slot-${slot}`}
                        >
                          {slot}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Upcoming Appointments */}
          <TabsContent value="upcoming">
            {upcomingAppointments.length === 0 ? (
              <div className="mg-card rounded-lg border border-border bg-card text-center py-16">
                <CalendarDays className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-40" />
                <p className="text-sm text-muted-foreground">No upcoming appointments</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Book your first consultation above!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingAppointments.map((apt) => (
                  <div key={apt.id} className="mg-card rounded-lg border border-border bg-card p-5">
                    <div className="flex justify-between items-start">
                      <div className="flex gap-4">
                        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded bg-primary/15">
                          <Video className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground">{formatDate(apt.date)}</h3>
                          <p className="font-mono text-sm text-primary mt-0.5">{apt.time_slot} – {apt.end_time}</p>
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <User className="w-3 h-3" />
                            with {apt.supervisor_name}
                          </p>
                          <p className="text-sm text-muted-foreground mt-2">{apt.reason}</p>
                        </div>
                      </div>
                      <div className="text-right flex flex-col items-end gap-2">
                        <span className={`${BADGE} ${STATUS_TONES[apt.status] || STATUS_TONES.no_show}`}>
                          {apt.status.charAt(0).toUpperCase() + apt.status.slice(1)}
                        </span>
                        {apt.status !== 'cancelled' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 text-xs"
                            onClick={() => handleCancelAppointment(apt.id)}
                          >
                            Cancel
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Past Appointments */}
          <TabsContent value="past">
            {pastAppointments.length === 0 ? (
              <div className="mg-card rounded-lg border border-border bg-card text-center py-16">
                <CheckCircle className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-40" />
                <p className="text-sm text-muted-foreground">No past appointments</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pastAppointments.map((apt) => (
                  <div key={apt.id} className="mg-card rounded-lg border border-border bg-card p-5 opacity-75">
                    <div className="flex justify-between items-start">
                      <div className="flex gap-4">
                        <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded ${
                          apt.status === 'completed' ? 'bg-emerald-500/15' : 'bg-muted'
                        }`}>
                          {apt.status === 'completed' ? (
                            <CheckCircle className="w-5 h-5 text-emerald-400" />
                          ) : (
                            <XCircle className="w-5 h-5 text-muted-foreground" />
                          )}
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground">{formatDate(apt.date)}</h3>
                          <p className="font-mono text-sm text-muted-foreground mt-0.5">{apt.time_slot} – {apt.end_time}</p>
                          <p className="text-xs text-muted-foreground mt-1">with {apt.supervisor_name}</p>
                        </div>
                      </div>
                      <span className={`${BADGE} ${STATUS_TONES[apt.status] || STATUS_TONES.no_show}`}>
                        {apt.status.charAt(0).toUpperCase() + apt.status.slice(1).replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Booking Confirmation Dialog */}
      <Dialog open={bookingOpen} onOpenChange={setBookingOpen}>
        <DialogContent className="max-w-md bg-popover border border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <div className="flex h-7 w-7 items-center justify-center rounded bg-primary/15">
                <Video className="w-4 h-4 text-primary" />
              </div>
              Confirm Your Appointment
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Summary tile */}
            <div className="rounded border border-primary/25 bg-primary/10 p-4 space-y-2.5">
              <div className="flex items-center gap-3">
                <CalendarIcon className="w-4 h-4 text-primary flex-shrink-0" />
                <span className="font-medium text-sm text-foreground">
                  {selectedDate && formatDate(selectedDate)}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="w-4 h-4 text-primary flex-shrink-0" />
                <span className="font-mono text-sm text-foreground">{selectedSlot} (30 minutes)</span>
              </div>
              <div className="flex items-center gap-3">
                <User className="w-4 h-4 text-primary flex-shrink-0" />
                <span className="text-sm text-muted-foreground">with {supervisorName}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Reason for Appointment *
              </Label>
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
              className="bg-primary text-primary-foreground hover:bg-primary/90"
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
