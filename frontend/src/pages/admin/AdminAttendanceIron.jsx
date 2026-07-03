import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { toast } from 'sonner';
import { Users, CalendarDays, Timer, AlertTriangle, Coffee, Loader2 } from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell, badgeStyle } from '@/components/iron/IronKit';

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

const selectStyle = { border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '7px 10px', fontSize: 12.5, color: T.iron900, background: T.white, fontFamily: T.body, outline: 'none', cursor: 'pointer' };

const KpiTile = ({ label, value, accent, Icon, iconColor }) => (
  <IronCard pad="13px 14px">
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
      <div>
        <Caps size={8.5} color={T.iron400}>{label}</Caps>
        <div style={{ ...mono, fontWeight: 700, fontSize: 26, color: accent, marginTop: 6, lineHeight: 1.1 }}>{value}</div>
      </div>
      {Icon && <Icon size={20} strokeWidth={1.75} color={iconColor || T.iron400} style={{ flexShrink: 0 }} />}
    </div>
  </IronCard>
);

export default function AdminAttendance() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ records: [], user_summary: [] });
  const [firms, setFirms] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedFirm, setSelectedFirm] = useState('all');
  const [selectedUser, setSelectedUser] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    if (token) {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, selectedMonth, selectedYear, selectedFirm, selectedUser]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };

      const [firmsRes, usersRes, attendanceRes] = await Promise.all([
        axios.get(`${API}/firms`, { headers }),
        axios.get(`${API}/admin/users`, { headers }),
        axios.get(`${API}/admin/attendance`, {
          headers,
          params: {
            month: selectedMonth,
            year: selectedYear,
            firm_id: selectedFirm !== 'all' ? selectedFirm : undefined,
            user_id: selectedUser !== 'all' ? selectedUser : undefined
          }
        })
      ]);

      setFirms(firmsRes.data || []);
      setUsers(usersRes.data?.filter(u => u.role !== 'customer') || []);
      setData(attendanceRes.data || { records: [], user_summary: [] });
    } catch (error) {
      toast.error('Failed to load attendance data');
    } finally {
      setLoading(false);
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

  const getStatusBadge = (record) => {
    if (!record.login_time) {
      return <span style={badgeStyle('bad')}>Absent</span>;
    }
    if (record.login_time && !record.logout_time) {
      return <span style={badgeStyle('warn')}>Active</span>;
    }
    if (record.net_working_minutes < 240) { // Less than 4 hours
      return <span style={badgeStyle('bad')}>Short Day</span>;
    }
    return <span style={badgeStyle('ok')}>Present</span>;
  };

  // Calculate summary stats
  const totalEmployees = data.user_summary?.length || 0;
  const totalDaysLogged = data.records?.filter(r => r.login_time).length || 0;
  const totalHours = data.records?.reduce((sum, r) => sum + (r.net_working_minutes || 0), 0) / 60;
  const missingLogouts = data.records?.filter(r => r.login_time && !r.logout_time).length || 0;

  const monthLabel = MONTHS.find(m => m.value === selectedMonth)?.label;

  return (
    <IronShell
      title="Attendance"
      subtitle={`${(monthLabel || '').toUpperCase()} ${selectedYear} · ALL FIRMS`}
      onRefresh={fetchData}
    >
      {loading ? (
        <div style={{ display: 'grid', placeItems: 'center', height: 300 }}>
          <Loader2 className="animate-spin" size={30} color={T.iron400} />
        </div>
      ) : (
        <>
          {/* Summary tiles */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
            <KpiTile label="Employees Tracked" value={totalEmployees} accent={T.iron900} Icon={Users} iconColor={T.blue} />
            <KpiTile label="Total Days Logged" value={totalDaysLogged} accent={T.iron900} Icon={CalendarDays} iconColor={T.blue} />
            <KpiTile label="Total Hours" value={`${totalHours.toFixed(1)}h`} accent={T.green} Icon={Timer} iconColor={T.green} />
            <KpiTile label="Missing Logouts" value={missingLogouts} accent={T.voltageText} Icon={AlertTriangle} iconColor={T.voltageText} />
          </div>

          {/* Filters */}
          <IronCard style={{ marginBottom: 16 }} pad={14}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 14 }}>
              <div>
                <Caps size={8.5} style={{ display: 'block', marginBottom: 5 }}>Month</Caps>
                <select value={selectedMonth} onChange={(e) => setSelectedMonth(parseInt(e.target.value))} style={{ ...selectStyle, width: 160 }}>
                  {MONTHS.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <Caps size={8.5} style={{ display: 'block', marginBottom: 5 }}>Year</Caps>
                <select value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))} style={{ ...selectStyle, width: 120 }}>
                  {[2024, 2025, 2026, 2027].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              <div>
                <Caps size={8.5} style={{ display: 'block', marginBottom: 5 }}>Employee</Caps>
                <select value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)} style={{ ...selectStyle, width: 200 }}>
                  <option value="all">All Employees</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>
                  ))}
                </select>
              </div>
            </div>
          </IronCard>

          {/* Employee Summary */}
          <IronCard pad={0} style={{ marginBottom: 16, overflow: 'hidden' }}>
            <div style={{ padding: '13px 16px', borderBottom: `1px solid ${T.iron200}` }}>
              <Caps size={11} color={T.iron900} ls=".1em">Employee Summary · {monthLabel} {selectedYear}</Caps>
              <Caps size={8.5} color={T.iron400} style={{ display: 'block', marginTop: 3 }}>Overview of attendance by employee</Caps>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                    {['Employee', 'Role', 'Days Present', 'Total Hours', 'Avg Hours/Day', 'Break Time', 'Missing Logouts'].map((h, i) => (
                      <th key={i} style={{ ...thCell, textAlign: i >= 2 ? 'center' : 'left' }}><Caps size={8.5}>{h}</Caps></th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.user_summary?.map((u) => (
                    <tr key={u.user_id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                      <td style={tdCell}>
                        <span style={{ fontFamily: T.headline, fontWeight: 600, fontSize: 12.5, color: T.iron900 }}>{u.user_name}</span>
                      </td>
                      <td style={tdCell}>
                        <span style={{ ...badgeStyle('slate'), textTransform: 'capitalize' }}>{u.user_role?.replace('_', ' ')}</span>
                      </td>
                      <td style={{ ...tdCell, textAlign: 'center', ...mono, color: T.iron900 }}>{u.days_present}</td>
                      <td style={{ ...tdCell, textAlign: 'center', ...mono, color: T.blue, fontWeight: 700 }}>{u.total_hours?.toFixed(1)}h</td>
                      <td style={{ ...tdCell, textAlign: 'center', ...mono, color: T.iron700 }}>
                        {u.days_present > 0 ? (u.total_hours / u.days_present).toFixed(1) : 0}h
                      </td>
                      <td style={{ ...tdCell, textAlign: 'center', ...mono, color: T.iron700 }}>{formatHours(u.total_break_minutes)}</td>
                      <td style={{ ...tdCell, textAlign: 'center' }}>
                        {u.missing_logouts > 0 ? (
                          <span style={badgeStyle('warn')}>{u.missing_logouts}</span>
                        ) : (
                          <span style={{ ...mono, color: T.green }}>0</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {data.user_summary?.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ padding: '48px 0', textAlign: 'center', color: T.iron400, fontSize: 12.5 }}>
                        No attendance data found for this period
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </IronCard>

          {/* Daily Records */}
          <IronCard pad={0} style={{ overflow: 'hidden' }}>
            <div style={{ padding: '13px 16px', borderBottom: `1px solid ${T.iron200}` }}>
              <Caps size={11} color={T.iron900} ls=".1em">Daily Attendance Log</Caps>
              <Caps size={8.5} color={T.iron400} style={{ display: 'block', marginTop: 3 }}>Detailed daily records with login/logout times</Caps>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                    {['Date', 'Employee', 'Login', 'Logout', 'Breaks', 'Net Hours', 'Status'].map((h, i) => (
                      <th key={i} style={{ ...thCell, textAlign: i >= 2 ? 'center' : 'left' }}><Caps size={8.5}>{h}</Caps></th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.records?.slice(0, 100).map((r) => (
                    <tr key={r.id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                      <td style={{ ...tdCell, ...mono, color: T.iron900 }}>{r.date}</td>
                      <td style={tdCell}>
                        <div style={{ fontFamily: T.headline, fontWeight: 600, fontSize: 12, color: T.iron900 }}>{r.user_name}</div>
                        <div style={{ fontSize: 10.5, color: T.iron400, textTransform: 'capitalize', marginTop: 2 }}>{r.user_role?.replace('_', ' ')}</div>
                      </td>
                      <td style={{ ...tdCell, textAlign: 'center', ...mono, color: T.green }}>{formatTime(r.login_time)}</td>
                      <td style={{ ...tdCell, textAlign: 'center', ...mono, color: T.orangeDeep }}>{formatTime(r.logout_time)}</td>
                      <td style={{ ...tdCell, textAlign: 'center' }}>
                        {r.breaks?.length > 0 ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, ...mono, color: T.iron700 }}>
                            <Coffee size={12} color={T.voltageText} />
                            {formatHours(r.total_break_minutes)}
                          </span>
                        ) : (
                          <span style={{ color: T.iron400 }}>-</span>
                        )}
                      </td>
                      <td style={{ ...tdCell, textAlign: 'center', ...mono, color: T.blue, fontWeight: 700 }}>
                        {formatHours(r.net_working_minutes)}
                      </td>
                      <td style={{ ...tdCell, textAlign: 'center' }}>{getStatusBadge(r)}</td>
                    </tr>
                  ))}
                  {data.records?.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ padding: '48px 0', textAlign: 'center', color: T.iron400, fontSize: 12.5 }}>
                        No attendance records found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {data.records?.length > 100 && (
              <div style={{ padding: '10px 16px', borderTop: `1px solid ${T.iron200}`, background: T.iron50, textAlign: 'center' }}>
                <Caps size={9} color={T.iron400}>Showing first 100 records · use filters to narrow down</Caps>
              </div>
            )}
          </IronCard>
        </>
      )}
    </IronShell>
  );
}
