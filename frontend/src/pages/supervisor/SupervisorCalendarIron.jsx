import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  CalendarDays, Clock, Loader2, Settings, Calendar as CalendarIcon, Phone
} from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell, badgeStyle } from '@/components/iron/IronKit';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Appointment status -> Iron pill tone.
const statusTone = (status) => {
  const map = {
    pending: 'warn', confirmed: 'info', completed: 'ok', cancelled: 'bad', no_show: 'slate',
  };
  return map[status] || 'slate';
};

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
            ? { ...s, is_available: !s.is_available }
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
      s.day_of_week === dayIndex ? { ...s, [field]: value } : s
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

  // Filter appointments for selected date
  const dateStr = selectedDate.toISOString().split('T')[0];
  const todayAppointments = appointments.filter(a => a.date === dateStr);
  const pendingAppointments = appointments.filter(a => a.status === 'pending');

  const inputStyle = { border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '7px 10px', fontSize: 12.5, color: T.iron900, background: T.white, fontFamily: T.body, outline: 'none' };

  const statCards = [
    { label: 'Total Appointments', value: stats.total || 0, tone: T.iron900 },
    { label: 'Pending', value: stats.pending || 0, tone: T.voltageText },
    { label: 'Confirmed', value: stats.confirmed || 0, tone: T.blue },
    { label: 'Completed', value: stats.completed || 0, tone: T.green },
    { label: 'No Shows', value: stats.no_show || 0, tone: T.orangeDeep },
  ];

  const headerRight = (
    <button
      onClick={() => setAvailabilityOpen(true)}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, borderRadius: 6, padding: '8px 14px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 12 }}
    >
      <Settings size={14} strokeWidth={2} /> Manage Availability
    </button>
  );

  return (
    <IronShell title="Appointment Calendar" subtitle="SUPERVISOR · SCHEDULING" onRefresh={fetchAppointments} headerRight={headerRight}>
      {loading ? (
        <div style={{ display: 'grid', placeItems: 'center', height: 320 }}>
          <Loader2 className="animate-spin" size={30} color={T.iron400} />
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 16 }}>
            {statCards.map((s) => (
              <IronCard key={s.label} pad="13px 14px">
                <div style={{ ...mono, fontSize: 26, fontWeight: 700, color: s.tone, lineHeight: 1.1 }}>{(s.value || 0).toLocaleString('en-IN')}</div>
                <Caps size={8.5} color={T.iron400} style={{ display: 'block', marginTop: 6 }}>{s.label}</Caps>
              </IronCard>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 16, alignItems: 'start' }}>
            {/* Calendar */}
            <IronCard pad={0}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '13px 16px', borderBottom: `1px solid ${T.iron200}` }}>
                <CalendarIcon size={15} color={T.orange} />
                <Caps size={11} color={T.iron900} ls=".1em">Select Date</Caps>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', padding: 12 }}>
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(d) => d && setSelectedDate(d)}
                  className="rounded-md border"
                  style={{ borderColor: T.iron200 }}
                />
              </div>
            </IronCard>

            {/* Day's Appointments */}
            <IronCard pad={0}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '13px 16px', borderBottom: `1px solid ${T.iron200}` }}>
                <Clock size={15} color={T.orange} />
                <Caps size={11} color={T.iron900} ls=".1em">Appointments for {formatDate(dateStr)}</Caps>
                <span style={{ ...mono, fontSize: 11, color: T.iron400 }}>({todayAppointments.length} scheduled)</span>
              </div>
              <div style={{ padding: 14 }}>
                {todayAppointments.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '48px 0', color: T.iron400 }}>
                    <CalendarDays size={44} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
                    <div style={{ fontSize: 13 }}>No appointments for this day</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {todayAppointments.slice().sort((a, b) => a.time_slot.localeCompare(b.time_slot)).map((apt) => (
                      <div
                        key={apt.id}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, border: `1px solid ${T.iron200}`, borderRadius: 8, padding: 14, background: T.iron50 }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                          <div style={{ textAlign: 'center', minWidth: 66 }}>
                            <div style={{ ...mono, fontSize: 17, fontWeight: 700, color: T.iron900, lineHeight: 1.1 }}>{apt.time_slot}</div>
                            <div style={{ ...mono, fontSize: 10.5, color: T.iron400, marginTop: 2 }}>to {apt.end_time}</div>
                          </div>
                          <div>
                            <div style={{ fontFamily: T.headline, fontWeight: 600, fontSize: 13, color: T.iron900 }}>{apt.customer_name}</div>
                            <div style={{ ...mono, fontSize: 10.5, color: T.iron500, marginTop: 2, display: 'inline-flex', alignItems: 'center', gap: 3 }}><Phone size={10} />{apt.customer_phone}</div>
                            {apt.reason && <div style={{ fontSize: 11, color: T.iron500, marginTop: 3 }}>{apt.reason}</div>}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={badgeStyle(statusTone(apt.status))}>{(apt.status || '').replace('_', ' ')}</span>
                          {['pending', 'confirmed'].includes(apt.status) && (
                            <button onClick={() => openActionDialog(apt)}
                              style={{ border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 11 }}>
                              Update
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </IronCard>
          </div>

          {/* Pending Appointments Queue */}
          {pendingAppointments.length > 0 && (
            <IronCard pad={0} style={{ marginTop: 16, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '13px 16px', borderBottom: `1px solid ${T.iron200}` }}>
                <Clock size={15} color={T.voltageText} />
                <Caps size={11} color={T.iron900} ls=".1em">Pending Confirmation ({pendingAppointments.length})</Caps>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                      {['DATE', 'TIME', 'CUSTOMER', 'CONTACT', 'REASON', 'ACTIONS'].map((h) => (
                        <th key={h} style={thCell}><Caps size={8.5}>{h}</Caps></th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pendingAppointments.map((apt) => (
                      <tr key={apt.id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                        <td style={{ ...tdCell, ...mono, color: T.iron700 }}>{formatDate(apt.date)}</td>
                        <td style={{ ...tdCell, ...mono, color: T.iron900, fontWeight: 700 }}>{apt.time_slot}</td>
                        <td style={{ ...tdCell }}><span style={{ fontFamily: T.headline, fontWeight: 600, fontSize: 12.5, color: T.iron900 }}>{apt.customer_name}</span></td>
                        <td style={{ ...tdCell, ...mono, color: T.iron500 }}>{apt.customer_phone}</td>
                        <td style={{ ...tdCell, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{apt.reason}</td>
                        <td style={tdCell}>
                          <button onClick={() => openActionDialog(apt)}
                            style={{ border: `1px solid ${T.orange}`, background: T.white, color: T.orangeDeep, borderRadius: 6, padding: '5px 11px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 11 }}>
                            Manage
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </IronCard>
          )}
        </>
      )}

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
    </IronShell>
  );
}
