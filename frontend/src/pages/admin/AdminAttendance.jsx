import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  CalendarDays, Users, Clock, Timer, Loader2, AlertTriangle,
  CheckCircle, Coffee, TrendingUp, ArrowRight
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
      return <Badge className="bg-red-600">Absent</Badge>;
    }
    if (record.login_time && !record.logout_time) {
      return <Badge className="bg-yellow-600">Active</Badge>;
    }
    if (record.net_working_minutes < 240) { // Less than 4 hours
      return <Badge className="bg-orange-600">Short Day</Badge>;
    }
    return <Badge className="bg-green-600">Present</Badge>;
  };

  // Calculate summary stats
  const totalEmployees = data.user_summary?.length || 0;
  const totalDaysLogged = data.records?.filter(r => r.login_time).length || 0;
  const totalHours = data.records?.reduce((sum, r) => sum + (r.net_working_minutes || 0), 0) / 60;
  const missingLogouts = data.records?.filter(r => r.login_time && !r.logout_time).length || 0;

  if (loading) {
    return (
      <DashboardLayout title="Attendance">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Attendance">
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Employees Tracked</p>
                  <p className="text-2xl font-bold text-white">{totalEmployees}</p>
                </div>
                <Users className="w-8 h-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Total Days Logged</p>
                  <p className="text-2xl font-bold text-white">{totalDaysLogged}</p>
                </div>
                <CalendarDays className="w-8 h-8 text-cyan-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Total Hours</p>
                  <p className="text-2xl font-bold text-white">{totalHours.toFixed(1)}h</p>
                </div>
                <Timer className="w-8 h-8 text-green-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Missing Logouts</p>
                  <p className="text-2xl font-bold text-yellow-400">{missingLogouts}</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-yellow-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-end gap-4">
              <div className="w-40">
                <Label className="text-slate-300">Month</Label>
                <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
                  <SelectTrigger className="bg-slate-900 border-slate-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-700">
                    {MONTHS.map(m => (
                      <SelectItem key={m.value} value={m.value.toString()} className="text-white hover:bg-slate-800">
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="w-32">
                <Label className="text-slate-300">Year</Label>
                <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                  <SelectTrigger className="bg-slate-900 border-slate-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-700">
                    {[2024, 2025, 2026, 2027].map(y => (
                      <SelectItem key={y} value={y.toString()} className="text-white hover:bg-slate-800">
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="w-48">
                <Label className="text-slate-300">Employee</Label>
                <Select value={selectedUser} onValueChange={setSelectedUser}>
                  <SelectTrigger className="bg-slate-900 border-slate-700 text-white">
                    <SelectValue placeholder="All Employees" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-700 max-h-60">
                    <SelectItem value="all" className="text-white hover:bg-slate-800">All Employees</SelectItem>
                    {users.map(u => (
                      <SelectItem key={u.id} value={u.id} className="text-white hover:bg-slate-800">
                        {u.first_name} {u.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Employee Summary */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Employee Summary - {MONTHS.find(m => m.value === selectedMonth)?.label} {selectedYear}</CardTitle>
            <CardDescription className="text-slate-400">
              Overview of attendance by employee
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left p-3 text-slate-400 text-sm">Employee</th>
                    <th className="text-left p-3 text-slate-400 text-sm">Role</th>
                    <th className="text-center p-3 text-slate-400 text-sm">Days Present</th>
                    <th className="text-center p-3 text-slate-400 text-sm">Total Hours</th>
                    <th className="text-center p-3 text-slate-400 text-sm">Avg Hours/Day</th>
                    <th className="text-center p-3 text-slate-400 text-sm">Break Time</th>
                    <th className="text-center p-3 text-slate-400 text-sm">Missing Logouts</th>
                  </tr>
                </thead>
                <tbody>
                  {data.user_summary?.map((u) => (
                    <tr key={u.user_id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                      <td className="p-3">
                        <p className="text-white font-medium">{u.user_name}</p>
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className="border-slate-600 text-slate-300 capitalize">
                          {u.user_role?.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="p-3 text-center text-white">{u.days_present}</td>
                      <td className="p-3 text-center text-cyan-400">{u.total_hours?.toFixed(1)}h</td>
                      <td className="p-3 text-center text-slate-300">
                        {u.days_present > 0 ? (u.total_hours / u.days_present).toFixed(1) : 0}h
                      </td>
                      <td className="p-3 text-center text-slate-300">{formatHours(u.total_break_minutes)}</td>
                      <td className="p-3 text-center">
                        {u.missing_logouts > 0 ? (
                          <Badge className="bg-yellow-600">{u.missing_logouts}</Badge>
                        ) : (
                          <span className="text-green-400">0</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {data.user_summary?.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400">
                        No attendance data found for this period
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Daily Records */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Daily Attendance Log</CardTitle>
            <CardDescription className="text-slate-400">
              Detailed daily records with login/logout times
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left p-3 text-slate-400 text-sm">Date</th>
                    <th className="text-left p-3 text-slate-400 text-sm">Employee</th>
                    <th className="text-center p-3 text-slate-400 text-sm">Login</th>
                    <th className="text-center p-3 text-slate-400 text-sm">Logout</th>
                    <th className="text-center p-3 text-slate-400 text-sm">Breaks</th>
                    <th className="text-center p-3 text-slate-400 text-sm">Net Hours</th>
                    <th className="text-center p-3 text-slate-400 text-sm">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.records?.slice(0, 100).map((r) => (
                    <tr key={r.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                      <td className="p-3 text-white font-mono">{r.date}</td>
                      <td className="p-3">
                        <p className="text-white">{r.user_name}</p>
                        <p className="text-slate-400 text-xs capitalize">{r.user_role?.replace('_', ' ')}</p>
                      </td>
                      <td className="p-3 text-center text-green-400 font-mono">{formatTime(r.login_time)}</td>
                      <td className="p-3 text-center text-red-400 font-mono">{formatTime(r.logout_time)}</td>
                      <td className="p-3 text-center">
                        {r.breaks?.length > 0 ? (
                          <div className="flex items-center justify-center gap-1">
                            <Coffee className="w-3 h-3 text-yellow-400" />
                            <span className="text-slate-300 text-sm">{formatHours(r.total_break_minutes)}</span>
                          </div>
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </td>
                      <td className="p-3 text-center text-cyan-400 font-medium">
                        {formatHours(r.net_working_minutes)}
                      </td>
                      <td className="p-3 text-center">{getStatusBadge(r)}</td>
                    </tr>
                  ))}
                  {data.records?.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400">
                        No attendance records found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {data.records?.length > 100 && (
              <p className="text-center text-slate-400 mt-4">
                Showing first 100 records. Use filters to narrow down.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
