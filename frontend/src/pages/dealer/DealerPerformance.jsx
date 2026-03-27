import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  BarChart3, TrendingUp, Package, IndianRupee, Calendar,
  Loader2, Award, Crown, Star, ArrowUp, ArrowDown, Minus
} from 'lucide-react';

const TIER_CONFIG = {
  silver: { label: 'Silver', color: 'from-slate-400 to-slate-500', textColor: 'text-slate-300', icon: Star },
  gold: { label: 'Gold', color: 'from-yellow-400 to-amber-500', textColor: 'text-yellow-400', icon: Award },
  platinum: { label: 'Platinum', color: 'from-purple-400 to-indigo-400', textColor: 'text-purple-300', icon: Crown }
};

export default function DealerPerformance() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('month');
  const [data, setData] = useState(null);

  useEffect(() => {
    if (token) {
      fetchPerformance();
    }
  }, [token, period]);

  const fetchPerformance = async () => {
    try {
      const response = await axios.get(`${API}/dealer/performance?period=${period}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(response.data);
    } catch (error) {
      toast.error('Failed to load performance data');
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

  if (loading) {
    return (
      <DashboardLayout title="Performance Dashboard">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
        </div>
      </DashboardLayout>
    );
  }

  const tier = data?.tier?.current_tier || 'silver';
  const tierConfig = TIER_CONFIG[tier];
  const TierIcon = tierConfig?.icon || Star;

  return (
    <DashboardLayout title="Performance Dashboard">
      <div className="space-y-6">
        {/* Header with Tier */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Performance Dashboard</h1>
            <p className="text-slate-400">Track your business growth and achievements</p>
          </div>
          <div className="flex items-center gap-3">
            <div className={`px-4 py-2 rounded-lg bg-gradient-to-r ${tierConfig?.color} flex items-center gap-2`}>
              <TierIcon className="w-5 h-5 text-white" />
              <span className="text-white font-bold">{tierConfig?.label} Partner</span>
            </div>
          </div>
        </div>

        {/* Period Tabs */}
        <Tabs value={period} onValueChange={setPeriod}>
          <TabsList className="bg-slate-800">
            <TabsTrigger value="month" className="data-[state=active]:bg-cyan-600">This Month</TabsTrigger>
            <TabsTrigger value="year" className="data-[state=active]:bg-cyan-600">This Year</TabsTrigger>
            <TabsTrigger value="all" className="data-[state=active]:bg-cyan-600">All Time</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Tier Progress */}
        {data?.tier && (
          <Card className="bg-gradient-to-r from-slate-800 to-slate-900 border-slate-700">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className={`w-20 h-20 mx-auto rounded-full bg-gradient-to-r ${tierConfig?.color} flex items-center justify-center mb-3`}>
                    <TierIcon className="w-10 h-10 text-white" />
                  </div>
                  <h3 className={`text-xl font-bold ${tierConfig?.textColor}`}>{tierConfig?.label} Tier</h3>
                  <p className="text-slate-400 text-sm">Current Status</p>
                </div>
                
                <div className="md:col-span-2">
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-slate-400">Lifetime Purchase Value</span>
                        <span className="text-white font-bold">{formatCurrency(data.tier.total_purchase_value)}</span>
                      </div>
                      <Progress value={data.tier.progress_to_next} className="h-3" />
                    </div>
                    
                    {data.tier.next_tier ? (
                      <div className="p-4 bg-slate-800 rounded-lg">
                        <p className="text-slate-400 text-sm">
                          <span className="text-white font-medium">{formatCurrency(data.tier.remaining_to_next)}</span> more to reach{' '}
                          <span className={TIER_CONFIG[data.tier.next_tier]?.textColor}>
                            {TIER_CONFIG[data.tier.next_tier]?.label}
                          </span> tier
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          Gold: ₹5L+ | Platinum: ₹15L+
                        </p>
                      </div>
                    ) : (
                      <div className="p-4 bg-purple-900/30 rounded-lg border border-purple-600">
                        <p className="text-purple-300 font-medium">Congratulations! You're a Platinum Partner!</p>
                        <p className="text-slate-400 text-sm">You've achieved the highest tier level.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <Package className="w-8 h-8 text-cyan-400" />
              </div>
              <p className="text-3xl font-bold text-white">{data?.total_orders || 0}</p>
              <p className="text-slate-400 text-sm">Total Orders</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <IndianRupee className="w-8 h-8 text-green-400" />
              </div>
              <p className="text-3xl font-bold text-green-400">{formatCurrency(data?.total_value)}</p>
              <p className="text-slate-400 text-sm">Total Value</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <TrendingUp className="w-8 h-8 text-blue-400" />
              </div>
              <p className="text-3xl font-bold text-blue-400">{formatCurrency(data?.avg_order_value)}</p>
              <p className="text-slate-400 text-sm">Avg. Order Value</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <Calendar className="w-8 h-8 text-purple-400" />
              </div>
              <p className="text-3xl font-bold text-purple-400">{data?.orders_by_status?.delivered || 0}</p>
              <p className="text-slate-400 text-sm">Delivered</p>
            </CardContent>
          </Card>
        </div>

        {/* Order Status Breakdown */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Order Status Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="p-4 bg-yellow-900/30 rounded-lg text-center">
                <p className="text-2xl font-bold text-yellow-400">{data?.orders_by_status?.pending || 0}</p>
                <p className="text-slate-400 text-sm">Pending</p>
              </div>
              <div className="p-4 bg-cyan-900/30 rounded-lg text-center">
                <p className="text-2xl font-bold text-cyan-400">{data?.orders_by_status?.confirmed || 0}</p>
                <p className="text-slate-400 text-sm">Confirmed</p>
              </div>
              <div className="p-4 bg-blue-900/30 rounded-lg text-center">
                <p className="text-2xl font-bold text-blue-400">{data?.orders_by_status?.dispatched || 0}</p>
                <p className="text-slate-400 text-sm">Dispatched</p>
              </div>
              <div className="p-4 bg-green-900/30 rounded-lg text-center">
                <p className="text-2xl font-bold text-green-400">{data?.orders_by_status?.delivered || 0}</p>
                <p className="text-slate-400 text-sm">Delivered</p>
              </div>
              <div className="p-4 bg-red-900/30 rounded-lg text-center">
                <p className="text-2xl font-bold text-red-400">{data?.orders_by_status?.cancelled || 0}</p>
                <p className="text-slate-400 text-sm">Cancelled</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Monthly Trend */}
        {data?.monthly_trend?.length > 0 && (
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Monthly Trend (Last 6 Months)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.monthly_trend.map((month, idx) => {
                  const prevMonth = data.monthly_trend[idx - 1];
                  const change = prevMonth ? ((month.value - prevMonth.value) / prevMonth.value * 100).toFixed(1) : 0;
                  
                  return (
                    <div key={month._id} className="flex items-center gap-4">
                      <div className="w-20 text-slate-400 text-sm">{month._id}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-white font-medium">{month.count} orders</span>
                          <span className="text-slate-400">•</span>
                          <span className="text-green-400">{formatCurrency(month.value)}</span>
                          {prevMonth && change !== 0 && (
                            <Badge className={change > 0 ? 'bg-green-600' : 'bg-red-600'}>
                              {change > 0 ? <ArrowUp className="w-3 h-3 mr-1" /> : <ArrowDown className="w-3 h-3 mr-1" />}
                              {Math.abs(change)}%
                            </Badge>
                          )}
                        </div>
                        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all"
                            style={{ width: `${Math.min(100, (month.value / Math.max(...data.monthly_trend.map(m => m.value))) * 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Lifetime Stats */}
        <Card className="bg-gradient-to-r from-cyan-900 to-blue-900 border-cyan-700">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Lifetime Statistics</h3>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-slate-300 text-sm">Total Orders</p>
                <p className="text-3xl font-bold text-white">{data?.lifetime?.total_orders || 0}</p>
              </div>
              <div>
                <p className="text-slate-300 text-sm">Total Business Value</p>
                <p className="text-3xl font-bold text-white">{formatCurrency(data?.lifetime?.total_value)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
