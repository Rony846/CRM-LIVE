import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  CalendarDays, Clock, Video, Loader2, CheckCircle, XCircle,
  User, Calendar as CalendarIcon
} from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, badgeStyle } from '@/components/iron/IronKit';

// Appointment status -> Iron pill tone.
const statusPill = (status) => {
  const map = {
    pending: ['Pending', 'warn'], confirmed: ['Confirmed', 'info'],
    completed: ['Completed', 'ok'], cancelled: ['Cancelled', 'bad'],
    no_show: ['No Show', 'slate'],
  };
  const [label, tone] = map[status] || [(status || '-').replace(/_/g, ' '), 'slate'];
  return { label, style: badgeStyle(tone) };
};

const primaryBtn = { border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer' };
const outlineBtn = { border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer' };

export default function CustomerAppointments() {
  const { token } = useAuth();
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
  const [activeTab, setActiveTab] = useState('book');

  useEffect(() => {
    fetchAppointments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const tabs = [
    { key: 'book', label: 'Book New', icon: CalendarDays, count: null },
    { key: 'upcoming', label: 'Upcoming', icon: Clock, count: upcomingAppointments.length },
    { key: 'past', label: 'Past', icon: CheckCircle, count: pastAppointments.length },
  ];

  if (loading) {
    return (
      <IronShell title="Appointments" subtitle="BOOK CONSULTATION" onRefresh={fetchAppointments}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 260 }}>
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: T.orange }} />
        </div>
      </IronShell>
    );
  }

  return (
    <IronShell title="Appointments" subtitle="BOOK CONSULTATION" onRefresh={fetchAppointments}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Hero banner */}
        <IronCard pad={0} style={{ overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 20, background: 'linear-gradient(90deg, #FDEEE6, ' + T.white + ')', borderLeft: `3px solid ${T.orange}` }}>
            <div style={{ height: 52, width: 52, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: 8, background: '#FBDFC9' }}>
              <Video className="w-7 h-7" style={{ color: T.orangeDeep }} />
            </div>
            <div>
              <div style={{ fontFamily: T.headline, fontWeight: 800, fontSize: 18, color: T.iron900 }}>Schedule a Consultation</div>
              <div style={{ fontSize: 13, color: T.iron500, marginTop: 2 }}>
                Book a 30-minute video call with our supervisor for personalized support
              </div>
            </div>
          </div>
        </IronCard>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 6 }}>
          {tabs.map((tb) => {
            const Icon = tb.icon;
            const active = activeTab === tb.key;
            return (
              <button key={tb.key} data-testid={`${tb.key}-tab`} onClick={() => setActiveTab(tb.key)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${active ? T.orange : T.iron200}`, background: active ? T.orange : T.white, color: active ? '#fff' : T.iron700, borderRadius: 6, padding: '8px 14px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 12 }}>
                <Icon size={14} strokeWidth={2} />{tb.label}
                {tb.count !== null && <span style={{ ...mono, fontSize: 11, opacity: 0.85 }}>({tb.count})</span>}
              </button>
            );
          })}
        </div>

        {/* Book New */}
        {activeTab === 'book' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
            {/* Calendar */}
            <IronCard pad={0} style={{ overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                <CalendarIcon size={15} style={{ color: T.orange }} />
                <Caps size={10} color={T.iron700}>Select Date</Caps>
              </div>
              <div style={{ padding: 16, display: 'flex', justifyContent: 'center' }}>
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={handleDateSelect}
                  disabled={disabledDays}
                  className="rounded-md border"
                  style={{ borderColor: T.iron200 }}
                />
              </div>
            </IronCard>

            {/* Time Slots */}
            <IronCard pad={0} style={{ overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                <Clock size={15} style={{ color: T.orange }} />
                <Caps size={10} color={T.iron700}>Available Time Slots</Caps>
                {supervisorName && (
                  <span style={{ ...mono, fontSize: 11, color: T.iron400 }}>with {supervisorName}</span>
                )}
              </div>
              <div style={{ padding: 16 }}>
                {!selectedDate ? (
                  <div style={{ textAlign: 'center', padding: '44px 0', color: T.iron400 }}>
                    <CalendarDays size={40} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
                    <div style={{ fontSize: 13 }}>Please select a date to see available slots</div>
                  </div>
                ) : slotsLoading ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '44px 0' }}>
                    <Loader2 className="w-6 h-6 animate-spin" style={{ color: T.orange }} />
                  </div>
                ) : availableSlots.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '44px 0', color: T.iron400 }}>
                    <XCircle size={40} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
                    <div style={{ fontSize: 13 }}>No slots available for this date</div>
                    <div style={{ fontSize: 11.5, marginTop: 3, color: T.iron400 }}>Try selecting another date</div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                    {availableSlots.map((slot) => {
                      const active = selectedSlot === slot;
                      return (
                        <button
                          key={slot}
                          onClick={() => handleSlotSelect(slot)}
                          data-testid={`slot-${slot}`}
                          style={{ ...mono, height: 42, borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                            border: `1px solid ${active ? T.orange : T.iron200}`,
                            background: active ? T.orange : T.white,
                            color: active ? '#fff' : T.iron700 }}
                        >
                          {slot}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </IronCard>
          </div>
        )}

        {/* Upcoming */}
        {activeTab === 'upcoming' && (
          upcomingAppointments.length === 0 ? (
            <IronCard style={{ textAlign: 'center', padding: '56px 0', color: T.iron400 }}>
              <CalendarDays size={40} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
              <div style={{ fontSize: 13, color: T.iron700 }}>No upcoming appointments</div>
              <div style={{ fontSize: 11.5, marginTop: 3 }}>Book your first consultation above!</div>
            </IronCard>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {upcomingAppointments.map((apt) => {
                const sp = statusPill(apt.status);
                return (
                  <IronCard key={apt.id} pad={16}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{ display: 'flex', gap: 14 }}>
                        <div style={{ height: 44, width: 44, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: 8, background: '#FBDFC9' }}>
                          <Video className="w-5 h-5" style={{ color: T.orangeDeep }} />
                        </div>
                        <div>
                          <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron900 }}>{formatDate(apt.date)}</div>
                          <div style={{ ...mono, fontSize: 13, color: T.orangeDeep, marginTop: 2 }}>{apt.time_slot} – {apt.end_time}</div>
                          <div style={{ fontSize: 11.5, color: T.iron500, marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <User size={12} /> with {apt.supervisor_name}
                          </div>
                          <div style={{ fontSize: 13, color: T.iron700, marginTop: 6 }}>{apt.reason}</div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                        <span style={sp.style}>{sp.label}</span>
                        {apt.status !== 'cancelled' && (
                          <button
                            onClick={() => handleCancelAppointment(apt.id)}
                            style={{ border: 'none', background: 'transparent', color: T.rose, fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', padding: '2px 4px' }}
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  </IronCard>
                );
              })}
            </div>
          )
        )}

        {/* Past */}
        {activeTab === 'past' && (
          pastAppointments.length === 0 ? (
            <IronCard style={{ textAlign: 'center', padding: '56px 0', color: T.iron400 }}>
              <CheckCircle size={40} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
              <div style={{ fontSize: 13, color: T.iron700 }}>No past appointments</div>
            </IronCard>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {pastAppointments.map((apt) => {
                const sp = statusPill(apt.status);
                const done = apt.status === 'completed';
                return (
                  <IronCard key={apt.id} pad={16} style={{ opacity: 0.85 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{ display: 'flex', gap: 14 }}>
                        <div style={{ height: 44, width: 44, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: 8, background: done ? T.greenTint : T.iron100 }}>
                          {done ? (
                            <CheckCircle className="w-5 h-5" style={{ color: T.green }} />
                          ) : (
                            <XCircle className="w-5 h-5" style={{ color: T.iron400 }} />
                          )}
                        </div>
                        <div>
                          <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron900 }}>{formatDate(apt.date)}</div>
                          <div style={{ ...mono, fontSize: 13, color: T.iron500, marginTop: 2 }}>{apt.time_slot} – {apt.end_time}</div>
                          <div style={{ fontSize: 11.5, color: T.iron500, marginTop: 4 }}>with {apt.supervisor_name}</div>
                        </div>
                      </div>
                      <span style={sp.style}>{sp.label}</span>
                    </div>
                  </IronCard>
                );
              })}
            </div>
          )
        )}
      </div>

      {/* Booking Confirmation Dialog */}
      <Dialog open={bookingOpen} onOpenChange={setBookingOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Video className="w-4 h-4" style={{ color: T.orange }} />
              Confirm Your Appointment
            </DialogTitle>
          </DialogHeader>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '8px 0' }}>
            {/* Summary tile */}
            <div style={{ borderRadius: 8, border: `1px solid #F6D8BA`, background: '#FDEEE6', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <CalendarIcon className="w-4 h-4" style={{ color: T.orangeDeep, flexShrink: 0 }} />
                <span style={{ fontWeight: 600, fontSize: 13, color: T.iron900 }}>
                  {selectedDate && formatDate(selectedDate)}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Clock className="w-4 h-4" style={{ color: T.orangeDeep, flexShrink: 0 }} />
                <span style={{ ...mono, fontSize: 13, color: T.iron900 }}>{selectedSlot} (30 minutes)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <User className="w-4 h-4" style={{ color: T.orangeDeep, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: T.iron700 }}>with {supervisorName}</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Caps size={10} color={T.iron500}>Reason for Appointment *</Caps>
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
            <button style={outlineBtn} onClick={() => setBookingOpen(false)}>Cancel</button>
            <button
              style={{ ...primaryBtn, opacity: (bookingLoading || !reason.trim()) ? 0.6 : 1, display: 'inline-flex', alignItems: 'center', gap: 6 }}
              onClick={handleBookAppointment}
              disabled={bookingLoading || !reason.trim()}
              data-testid="confirm-booking"
            >
              {bookingLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              Confirm Booking
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </IronShell>
  );
}
