import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell, badgeStyle } from '@/components/iron/IronKit';
import { toast } from 'sonner';
import {
  CalendarDays, Clock, Timer, Loader2, Coffee,
  TrendingUp, CheckCircle, PlayCircle, PauseCircle
} from 'lucide-react';

const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' }
];

const inputStyle = { border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '7px 10px', fontSize: 12.5, color: T.iron900, background: T.white, outline: 'none' };

export default function MyAttendance() {
  const { token, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ records: [], summary: {} });
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (token) {
      fetchData();
      fetchTodayAttendance();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, selectedMonth, selectedYear]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/attendance/my`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { month: selectedMonth, year: selectedYear }
      });
      setData(response.data || { records: [], summary: {} });
    } catch (error) {
      toast.error('Failed to load attendance data');
    } finally {
      setLoading(false);
    }
  };

  const fetchTodayAttendance = async () => {
    try {
      const response = await axios.get(`${API}/attendance/today`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTodayAttendance(response.data);
    } catch (error) {
      // No attendance today yet
      setTodayAttendance(null);
    }
  };

  const handleAction = async (action) => {
    setActionLoading(true);
    try {
      await axios.post(`${API}/attendance/${action}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const messages = {
        login: 'Shift started! Have a productive day.',
        logout: 'Shift ended. Great work today!',
        'break-start': 'Break started. Enjoy!',
        'break-end': 'Welcome back! Break ended.'
      };
      toast.success(messages[action]);

      await fetchTodayAttendance();
      await fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || `Failed to ${action}`);
    } finally {
      setActionLoading(false);
    }
  };

  const formatTime = (isoString) => {
    if (!isoString) return '-';
    return new Date(isoString).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatHours = (minutes) => {
    if (!minutes) return '0h 0m';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const getStatusPill = (record) => {
    if (!record.login_time) {
      return <span style={badgeStyle('bad')}>Absent</span>;
    }
    if (record.login_time && !record.logout_time) {
      return <span style={badgeStyle('warn')}>Active</span>;
    }
    if (record.net_working_minutes < 240) {
      return <span style={badgeStyle('warn')}>Short Day</span>;
    }
    return <span style={badgeStyle('ok')}>Present</span>;
  };

  const isLoggedIn = todayAttendance?.login_time && !todayAttendance?.logout_time;
  const isOnBreak = todayAttendance?.is_on_break;

  const monthLabel = MONTHS.find(m => m.value === selectedMonth)?.label;

  const btnBase = { display: 'inline-flex', alignItems: 'center', gap: 7, border: 'none', borderRadius: 6, padding: '9px 16px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 12.5, color: '#fff' };

  const statTiles = [
    { label: 'Login Time', value: formatTime(todayAttendance?.login_time), accent: T.iron900, m: true },
    { label: 'Logout Time', value: formatTime(todayAttendance?.logout_time), accent: T.iron900, m: true },
    { label: 'Break Time', value: formatHours(todayAttendance?.total_break_minutes), accent: T.voltageText, m: false },
    { label: 'Net Working', value: formatHours(todayAttendance?.net_working_minutes), accent: T.green, m: false },
  ];

  const summaryCards = [
    { label: 'Days Present', value: data.summary?.total_days_present || 0, accent: T.iron900, Icon: CalendarDays, iconColor: T.orange },
    { label: 'Total Hours', value: `${data.summary?.total_hours_worked?.toFixed(1) || 0}h`, accent: T.iron900, Icon: Timer, iconColor: T.green },
    { label: 'Avg Hours/Day', value: `${data.summary?.average_hours_per_day?.toFixed(1) || 0}h`, accent: T.iron900, Icon: TrendingUp, iconColor: T.blue },
    { label: 'Break Time', value: formatHours(data.summary?.total_break_minutes), accent: T.voltageText, Icon: Coffee, iconColor: T.voltageText },
  ];

  const content = loading ? (
    <div style={{ display: 'grid', placeItems: 'center', height: 300 }}>
      <Loader2 className="animate-spin" size={30} color={T.iron400} />
    </div>
  ) : (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Today's Status */}
      <IronCard pad={0}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '13px 16px', borderBottom: `1px solid ${T.iron200}` }}>
          <Clock size={15} color={T.orange} />
          <Caps size={11} color={T.iron900} ls=".1em">Today's Status</Caps>
        </div>
        <div style={{ padding: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
            {statTiles.map((t) => (
              <div key={t.label} style={{ background: T.iron50, border: `1px solid ${T.iron200}`, borderRadius: 8, padding: '13px 14px' }}>
                <Caps size={8.5} color={T.iron400}>{t.label}</Caps>
                <div style={{ ...(t.m ? mono : {}), fontFamily: t.m ? T.mono : T.headline, fontWeight: 700, fontSize: 22, color: t.accent, marginTop: 6, lineHeight: 1.1 }}>{t.value}</div>
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
            {!isLoggedIn && !todayAttendance?.logout_time && (
              <button onClick={() => handleAction('login')} disabled={actionLoading} style={{ ...btnBase, background: T.green, opacity: actionLoading ? 0.6 : 1 }}>
                {actionLoading ? <Loader2 className="animate-spin" size={15} /> : <PlayCircle size={15} />}
                Start Shift
              </button>
            )}

            {isLoggedIn && !isOnBreak && (
              <>
                <button onClick={() => handleAction('break-start')} disabled={actionLoading} style={{ ...btnBase, background: T.voltageText, opacity: actionLoading ? 0.6 : 1 }}>
                  {actionLoading ? <Loader2 className="animate-spin" size={15} /> : <Coffee size={15} />}
                  Start Break
                </button>
                <button onClick={() => handleAction('logout')} disabled={actionLoading} style={{ ...btnBase, background: T.orangeDeep, opacity: actionLoading ? 0.6 : 1 }}>
                  {actionLoading ? <Loader2 className="animate-spin" size={15} /> : <PauseCircle size={15} />}
                  End Shift
                </button>
              </>
            )}

            {isLoggedIn && isOnBreak && (
              <button onClick={() => handleAction('break-end')} disabled={actionLoading} style={{ ...btnBase, background: T.blue, opacity: actionLoading ? 0.6 : 1 }}>
                {actionLoading ? <Loader2 className="animate-spin" size={15} /> : <PlayCircle size={15} />}
                End Break
              </button>
            )}

            {todayAttendance?.logout_time && (
              <span style={{ ...badgeStyle('ok'), display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, padding: '6px 12px' }}>
                <CheckCircle size={13} />
                Shift Completed
              </span>
            )}
          </div>
        </div>
      </IronCard>

      {/* Monthly Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {summaryCards.map(({ label, value, accent, Icon, iconColor }) => (
          <IronCard key={label} pad="13px 14px">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <Caps size={8.5} color={T.iron400}>{label}</Caps>
                <div style={{ ...mono, fontWeight: 700, fontSize: 24, color: accent, marginTop: 6, lineHeight: 1.1 }}>{value}</div>
              </div>
              <Icon size={26} color={iconColor} strokeWidth={1.75} />
            </div>
          </IronCard>
        ))}
      </div>

      {/* Filters */}
      <IronCard>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <Caps size={8.5} color={T.iron400}>Month</Caps>
            <select value={selectedMonth} onChange={(e) => setSelectedMonth(parseInt(e.target.value))} style={{ ...inputStyle, width: 160 }}>
              {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <Caps size={8.5} color={T.iron400}>Year</Caps>
            <select value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))} style={{ ...inputStyle, width: 130 }}>
              {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
      </IronCard>

      {/* Attendance Records */}
      <IronCard pad={0}>
        <div style={{ padding: '13px 16px', borderBottom: `1px solid ${T.iron200}` }}>
          <Caps size={11} color={T.iron900} ls=".1em">Attendance History · {monthLabel} {selectedYear}</Caps>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                <th style={thCell}><Caps size={8.5}>Date</Caps></th>
                <th style={thCell}><Caps size={8.5}>Login</Caps></th>
                <th style={thCell}><Caps size={8.5}>Logout</Caps></th>
                <th style={thCell}><Caps size={8.5}>Breaks</Caps></th>
                <th style={thCell}><Caps size={8.5}>Break Time</Caps></th>
                <th style={thCell}><Caps size={8.5}>Net Hours</Caps></th>
                <th style={thCell}><Caps size={8.5}>Status</Caps></th>
              </tr>
            </thead>
            <tbody>
              {data.records?.map((r) => (
                <tr key={r.id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                  <td style={tdCell}>
                    <div style={{ ...mono, fontWeight: 700, color: T.iron900 }}>{r.date}</div>
                    <div style={{ fontSize: 10.5, color: T.iron400 }}>
                      {new Date(r.date).toLocaleDateString('en-IN', { weekday: 'short' })}
                    </div>
                  </td>
                  <td style={{ ...tdCell, ...mono, color: T.green }}>{formatTime(r.login_time)}</td>
                  <td style={{ ...tdCell, ...mono, color: T.orangeDeep }}>{formatTime(r.logout_time)}</td>
                  <td style={{ ...tdCell, ...mono, color: T.iron700 }}>{r.breaks?.length || 0}</td>
                  <td style={{ ...tdCell, color: T.voltageText }}>{formatHours(r.total_break_minutes)}</td>
                  <td style={{ ...tdCell, color: T.blue, fontWeight: 600 }}>{formatHours(r.net_working_minutes)}</td>
                  <td style={tdCell}>{getStatusPill(r)}</td>
                </tr>
              ))}
              {data.records?.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: 40, textAlign: 'center', color: T.iron400, fontSize: 13 }}>
                    No attendance records for this month
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </IronCard>
    </div>
  );

  return (
    <IronShell
      title="My Attendance"
      subtitle={`${(monthLabel || '').toUpperCase()} ${selectedYear}`}
      onRefresh={() => { fetchData(); fetchTodayAttendance(); }}
    >
      {content}
    </IronShell>
  );
}
