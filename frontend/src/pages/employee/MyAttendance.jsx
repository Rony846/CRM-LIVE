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

  const getStatusBadge = (record) => {
    if (!record.login_time) {
      return <Badge className="bg-red-600">Absent</Badge>;
    }
    if (record.login_time && !record.logout_time) {
      return <Badge className="bg-yellow-600">Active</Badge>;
    }
    if (record.net_working_minutes < 240) {
      return <Badge className="bg-orange-600">Short Day</Badge>;
    }
    return <Badge className="bg-green-600">Present</Badge>;
  };

  const isLoggedIn = todayAttendance?.login_time && !todayAttendance?.logout_time;
  const isOnBreak = todayAttendance?.is_on_break;

  if (loading) {
    return (
      <DashboardLayout title="My Attendance">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="My Attendance">
      <div className="space-y-6">
        {/* Today's Status Card */}
        <Card className="bg-gradient-to-r from-cyan-900 to-blue-900 border-cyan-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Today's Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-slate-900/50 rounded-lg p-4">
                <p className="text-slate-400 text-sm">Login Time</p>
                <p className="text-2xl font-bold text-white font-mono">
                  {formatTime(todayAttendance?.login_time)}
                </p>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-4">
                <p className="text-slate-400 text-sm">Logout Time</p>
                <p className="text-2xl font-bold text-white font-mono">
                  {formatTime(todayAttendance?.logout_time)}
                </p>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-4">
                <p className="text-slate-400 text-sm">Break Time</p>
                <p className="text-2xl font-bold text-yellow-400">
                  {formatHours(todayAttendance?.total_break_minutes)}
                </p>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-4">
                <p className="text-slate-400 text-sm">Net Working</p>
                <p className="text-2xl font-bold text-green-400">
                  {formatHours(todayAttendance?.net_working_minutes)}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 mt-6">
              {!isLoggedIn && !todayAttendance?.logout_time && (
                <Button 
                  onClick={() => handleAction('login')}
                  disabled={actionLoading}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {actionLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <PlayCircle className="w-4 h-4 mr-2" />}
                  Start Shift
                </Button>
              )}
              
              {isLoggedIn && !isOnBreak && (
                <>
                  <Button 
                    onClick={() => handleAction('break-start')}
                    disabled={actionLoading}
                    className="bg-yellow-600 hover:bg-yellow-700"
                  >
                    {actionLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Coffee className="w-4 h-4 mr-2" />}
                    Start Break
                  </Button>
                  <Button 
                    onClick={() => handleAction('logout')}
                    disabled={actionLoading}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    {actionLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <PauseCircle className="w-4 h-4 mr-2" />}
                    End Shift
                  </Button>
                </>
              )}

              {isLoggedIn && isOnBreak && (
                <Button 
                  onClick={() => handleAction('break-end')}
                  disabled={actionLoading}
                  className="bg-cyan-600 hover:bg-cyan-700"
                >
                  {actionLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <PlayCircle className="w-4 h-4 mr-2" />}
                  End Break
                </Button>
              )}

              {todayAttendance?.logout_time && (
                <Badge className="bg-green-600 text-lg px-4 py-2">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Shift Completed
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Monthly Summary */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Days Present</p>
                  <p className="text-2xl font-bold text-white">{data.summary?.total_days_present || 0}</p>
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
                  <p className="text-2xl font-bold text-white">{data.summary?.total_hours_worked?.toFixed(1) || 0}h</p>
                </div>
                <Timer className="w-8 h-8 text-green-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Avg Hours/Day</p>
                  <p className="text-2xl font-bold text-white">{data.summary?.average_hours_per_day?.toFixed(1) || 0}h</p>
                </div>
                <TrendingUp className="w-8 h-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Break Time</p>
                  <p className="text-2xl font-bold text-yellow-400">{formatHours(data.summary?.total_break_minutes)}</p>
                </div>
                <Coffee className="w-8 h-8 text-yellow-400" />
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
            </div>
          </CardContent>
        </Card>

        {/* Attendance Records */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">
              Attendance History - {MONTHS.find(m => m.value === selectedMonth)?.label} {selectedYear}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left p-3 text-slate-400 text-sm">Date</th>
                    <th className="text-center p-3 text-slate-400 text-sm">Login</th>
                    <th className="text-center p-3 text-slate-400 text-sm">Logout</th>
                    <th className="text-center p-3 text-slate-400 text-sm">Breaks</th>
                    <th className="text-center p-3 text-slate-400 text-sm">Break Time</th>
                    <th className="text-center p-3 text-slate-400 text-sm">Net Hours</th>
                    <th className="text-center p-3 text-slate-400 text-sm">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.records?.map((r) => (
                    <tr key={r.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                      <td className="p-3">
                        <p className="text-white font-mono">{r.date}</p>
                        <p className="text-slate-400 text-xs">
                          {new Date(r.date).toLocaleDateString('en-IN', { weekday: 'short' })}
                        </p>
                      </td>
                      <td className="p-3 text-center text-green-400 font-mono">{formatTime(r.login_time)}</td>
                      <td className="p-3 text-center text-red-400 font-mono">{formatTime(r.logout_time)}</td>
                      <td className="p-3 text-center text-slate-300">{r.breaks?.length || 0}</td>
                      <td className="p-3 text-center text-yellow-400">{formatHours(r.total_break_minutes)}</td>
                      <td className="p-3 text-center text-cyan-400 font-medium">{formatHours(r.net_working_minutes)}</td>
                      <td className="p-3 text-center">{getStatusBadge(r)}</td>
                    </tr>
                  ))}
                  {data.records?.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400">
                        No attendance records for this month
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
