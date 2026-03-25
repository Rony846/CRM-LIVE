import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  DollarSign, TrendingUp, Clock, CheckCircle, Loader2, RefreshCw,
  Calendar, Package, IndianRupee, ArrowRight, Wallet, Award
} from 'lucide-react';

const STATUS_CONFIG = {
  pending: { label: 'Pending', color: 'bg-yellow-600', icon: Clock },
  approved: { label: 'Approved', color: 'bg-blue-600', icon: CheckCircle },
  paid: { label: 'Paid', color: 'bg-green-600', icon: Wallet },
  cancelled: { label: 'Cancelled', color: 'bg-red-600', icon: Clock }
};

export default function MyIncentives() {
  const { token, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ incentives: [], summary: {} });
  const [stats, setStats] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState('all');

  useEffect(() => {
    if (token) {
      fetchData();
    }
  }, [token, selectedMonth]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const params = {};
      if (selectedMonth !== 'all') params.month = selectedMonth;
      
      const [incentivesRes, statsRes] = await Promise.all([
        axios.get(`${API}/my-incentives`, { headers, params }),
        axios.get(`${API}/my-incentives/stats`, { headers })
      ]);
      
      setData(incentivesRes.data);
      setStats(statsRes.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load incentives');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  // Generate month options for filter
  const getMonthOptions = () => {
    const options = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = date.toISOString().slice(0, 7);
      const label = date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
      options.push({ value, label });
    }
    return options;
  };

  if (loading) {
    return (
      <DashboardLayout title="My Incentives">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="My Incentives">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Award className="w-7 h-7 text-yellow-400" />
              My Incentives
            </h1>
            <p className="text-slate-400">Track your earnings from PI conversions</p>
          </div>
          <Button 
            variant="outline" 
            onClick={fetchData}
            className="border-slate-600 text-slate-300 hover:bg-slate-700"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-green-900/50 to-green-800/30 border-green-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-green-600/30 flex items-center justify-center">
                  <IndianRupee className="w-6 h-6 text-green-400" />
                </div>
                <div>
                  <p className="text-green-300 text-sm">This Month</p>
                  <p className="text-2xl font-bold text-white">
                    {formatCurrency(data.summary?.this_month?.total || 0)}
                  </p>
                  <p className="text-green-400 text-xs">
                    {data.summary?.this_month?.conversions || 0} conversions
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-cyan-900/50 to-cyan-800/30 border-cyan-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-cyan-600/30 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-cyan-400" />
                </div>
                <div>
                  <p className="text-cyan-300 text-sm">Total Earned</p>
                  <p className="text-2xl font-bold text-white">
                    {formatCurrency(data.summary?.total_earned || 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-yellow-900/50 to-yellow-800/30 border-yellow-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-yellow-600/30 flex items-center justify-center">
                  <Clock className="w-6 h-6 text-yellow-400" />
                </div>
                <div>
                  <p className="text-yellow-300 text-sm">Pending</p>
                  <p className="text-2xl font-bold text-white">
                    {formatCurrency(data.summary?.pending_amount || 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-purple-900/50 to-purple-800/30 border-purple-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-purple-600/30 flex items-center justify-center">
                  <Wallet className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <p className="text-purple-300 text-sm">Paid Out</p>
                  <p className="text-2xl font-bold text-white">
                    {formatCurrency(data.summary?.paid_amount || 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Stats Overview */}
        {stats && (
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Performance Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-slate-900 rounded-lg text-center">
                  <p className="text-3xl font-bold text-white">{stats.total_quotations || 0}</p>
                  <p className="text-slate-400 text-sm">Total PIs Created</p>
                </div>
                <div className="p-4 bg-slate-900 rounded-lg text-center">
                  <p className="text-3xl font-bold text-green-400">{stats.converted_quotations || 0}</p>
                  <p className="text-slate-400 text-sm">Converted to Sale</p>
                </div>
                <div className="p-4 bg-slate-900 rounded-lg text-center">
                  <p className="text-3xl font-bold text-cyan-400">{stats.conversion_rate || 0}%</p>
                  <p className="text-slate-400 text-sm">Conversion Rate</p>
                </div>
                <div className="p-4 bg-slate-900 rounded-lg text-center">
                  <p className="text-3xl font-bold text-yellow-400">
                    {stats.monthly_breakdown?.[0]?.conversions || 0}
                  </p>
                  <p className="text-slate-400 text-sm">This Month Conversions</p>
                </div>
              </div>
              
              {/* Monthly Trend */}
              <div className="mt-6">
                <h4 className="text-white font-medium mb-3">Monthly Trend (Last 6 Months)</h4>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                  {stats.monthly_breakdown?.slice(0, 6).reverse().map((month, idx) => (
                    <div key={idx} className="p-3 bg-slate-900 rounded-lg text-center">
                      <p className="text-xs text-slate-500 mb-1">
                        {new Date(month.month + '-01').toLocaleDateString('en-IN', { month: 'short' })}
                      </p>
                      <p className="text-lg font-bold text-cyan-400">{formatCurrency(month.total_incentive)}</p>
                      <p className="text-xs text-slate-400">{month.conversions} sales</p>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filter */}
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="w-48">
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="bg-slate-900 border-slate-700 text-white">
                    <SelectValue placeholder="Select Month" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-700">
                    <SelectItem value="all">All Time</SelectItem>
                    {getMonthOptions().map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Incentives Table */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Incentive History</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-700">
                  <TableHead className="text-slate-400">Date</TableHead>
                  <TableHead className="text-slate-400">PI Number</TableHead>
                  <TableHead className="text-slate-400">Customer</TableHead>
                  <TableHead className="text-slate-400 text-right">Sale Value</TableHead>
                  <TableHead className="text-slate-400 text-right">Incentive</TableHead>
                  <TableHead className="text-slate-400">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.incentives?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-slate-400">
                      <DollarSign className="w-12 h-12 mx-auto mb-4 text-slate-600" />
                      <p>No incentives yet</p>
                      <p className="text-sm">Convert PIs to sales to earn incentives!</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  data.incentives?.map((inc) => {
                    const statusConfig = STATUS_CONFIG[inc.status] || {};
                    const StatusIcon = statusConfig.icon || Clock;
                    
                    return (
                      <TableRow key={inc.id} className="border-slate-700">
                        <TableCell className="text-slate-300">
                          {formatDate(inc.created_at)}
                        </TableCell>
                        <TableCell>
                          <p className="text-white font-mono text-sm">{inc.quotation_number}</p>
                        </TableCell>
                        <TableCell className="text-slate-300">{inc.customer_name}</TableCell>
                        <TableCell className="text-right text-white">
                          {formatCurrency(inc.sale_value)}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-green-400 font-semibold">
                            +{formatCurrency(inc.incentive_amount)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge className={`${statusConfig.color} text-white`}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {statusConfig.label}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
