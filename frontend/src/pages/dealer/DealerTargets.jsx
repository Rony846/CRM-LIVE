import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import {
  Target, Loader2, TrendingUp, TrendingDown, Calendar, Award, 
  IndianRupee, Package, CheckCircle2, AlertCircle, ArrowRight,
  Trophy, Star, Flame, ChevronRight
} from 'lucide-react';

export default function DealerTargets() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    if (token) {
      fetchTargets();
    }
  }, [token]);

  const fetchTargets = async () => {
    try {
      const response = await axios.get(`${API}/dealer/targets`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(response.data);
    } catch (error) {
      console.error('Failed to fetch targets:', error);
      toast.error('Failed to load targets');
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

  const getProgressColor = (percentage) => {
    if (percentage >= 100) return 'bg-green-500';
    if (percentage >= 75) return 'bg-cyan-500';
    if (percentage >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getStatusBadge = (percentage) => {
    if (percentage >= 100) return { label: 'Achieved!', color: 'bg-green-600', icon: Trophy };
    if (percentage >= 75) return { label: 'On Track', color: 'bg-cyan-600', icon: TrendingUp };
    if (percentage >= 50) return { label: 'Needs Attention', color: 'bg-yellow-600', icon: AlertCircle };
    return { label: 'Behind Target', color: 'bg-red-600', icon: TrendingDown };
  };

  if (loading) {
    return (
      <DashboardLayout title="Sales Targets">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
        </div>
      </DashboardLayout>
    );
  }

  const currentTarget = data?.current_target;
  const quarterlyTarget = data?.quarterly_target;
  const yearlyTarget = data?.yearly_target;
  const achievements = data?.achievements || [];
  const incentives = data?.incentives || [];

  return (
    <DashboardLayout title="Sales Targets">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Target className="w-6 h-6 text-cyan-400" />
              Sales Targets
            </h1>
            <p className="text-slate-400">Track your performance and unlock incentives</p>
          </div>
        </div>

        {/* Current Month Target */}
        {currentTarget && (
          <Card className="bg-gradient-to-r from-slate-800 to-slate-900 border-slate-700">
            <CardContent className="p-6">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="w-5 h-5 text-cyan-400" />
                    <h2 className="text-xl font-bold text-white">{currentTarget.month} Target</h2>
                    <Badge className={getStatusBadge(currentTarget.percentage).color}>
                      {React.createElement(getStatusBadge(currentTarget.percentage).icon, { className: "w-3 h-3 mr-1" })}
                      {getStatusBadge(currentTarget.percentage).label}
                    </Badge>
                  </div>
                  
                  <div className="mt-4">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-slate-400">Progress</span>
                      <span className="text-white font-semibold">{currentTarget.percentage.toFixed(1)}%</span>
                    </div>
                    <Progress value={Math.min(currentTarget.percentage, 100)} className="h-3" />
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 mt-4">
                    <div>
                      <p className="text-slate-500 text-xs">Target</p>
                      <p className="text-white font-bold text-lg">{formatCurrency(currentTarget.target_amount)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-xs">Achieved</p>
                      <p className="text-green-400 font-bold text-lg">{formatCurrency(currentTarget.achieved_amount)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-xs">Remaining</p>
                      <p className="text-yellow-400 font-bold text-lg">{formatCurrency(currentTarget.remaining)}</p>
                    </div>
                  </div>
                </div>
                
                <div className="lg:border-l lg:border-slate-700 lg:pl-6">
                  <p className="text-slate-400 text-sm mb-2">Days Remaining</p>
                  <div className="text-5xl font-bold text-cyan-400">{currentTarget.days_remaining}</div>
                  <p className="text-slate-500 text-sm">days left</p>
                  
                  {currentTarget.daily_required > 0 && (
                    <div className="mt-4 p-3 bg-slate-900 rounded-lg">
                      <p className="text-slate-400 text-xs">Daily target to achieve goal:</p>
                      <p className="text-white font-bold">{formatCurrency(currentTarget.daily_required)}/day</p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quarterly & Yearly Targets */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Quarterly Target */}
          {quarterlyTarget && (
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-lg flex items-center gap-2">
                  <Flame className="w-5 h-5 text-orange-400" />
                  {quarterlyTarget.quarter} Target
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-slate-400 text-sm">Target</p>
                      <p className="text-white font-bold text-xl">{formatCurrency(quarterlyTarget.target_amount)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-slate-400 text-sm">Achieved</p>
                      <p className="text-green-400 font-bold text-xl">{formatCurrency(quarterlyTarget.achieved_amount)}</p>
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-400">Progress</span>
                      <span className={quarterlyTarget.percentage >= 100 ? 'text-green-400' : 'text-white'}>
                        {quarterlyTarget.percentage.toFixed(1)}%
                      </span>
                    </div>
                    <Progress value={Math.min(quarterlyTarget.percentage, 100)} className="h-2" />
                  </div>
                  
                  {quarterlyTarget.incentive_earned > 0 && (
                    <div className="p-3 bg-green-900/30 border border-green-600/50 rounded-lg">
                      <p className="text-green-400 text-sm flex items-center gap-1">
                        <Award className="w-4 h-4" />
                        Incentive Earned: {formatCurrency(quarterlyTarget.incentive_earned)}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Yearly Target */}
          {yearlyTarget && (
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-lg flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-yellow-400" />
                  FY {yearlyTarget.year} Target
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-slate-400 text-sm">Target</p>
                      <p className="text-white font-bold text-xl">{formatCurrency(yearlyTarget.target_amount)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-slate-400 text-sm">Achieved</p>
                      <p className="text-green-400 font-bold text-xl">{formatCurrency(yearlyTarget.achieved_amount)}</p>
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-400">Progress</span>
                      <span className={yearlyTarget.percentage >= 100 ? 'text-green-400' : 'text-white'}>
                        {yearlyTarget.percentage.toFixed(1)}%
                      </span>
                    </div>
                    <Progress value={Math.min(yearlyTarget.percentage, 100)} className="h-2" />
                  </div>
                  
                  <p className="text-slate-500 text-sm">
                    {yearlyTarget.months_remaining} months remaining
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Incentive Slabs */}
        {incentives.length > 0 && (
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Star className="w-5 h-5 text-yellow-400" />
                Incentive Slabs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {incentives.map((slab, idx) => (
                  <div 
                    key={idx}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      slab.achieved ? 'bg-green-900/30 border border-green-600/50' : 'bg-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {slab.achieved ? (
                        <CheckCircle2 className="w-5 h-5 text-green-400" />
                      ) : (
                        <div className="w-5 h-5 rounded-full border-2 border-slate-600" />
                      )}
                      <div>
                        <p className={`font-medium ${slab.achieved ? 'text-green-400' : 'text-white'}`}>
                          {slab.name}
                        </p>
                        <p className="text-slate-500 text-sm">
                          Achieve {formatCurrency(slab.threshold)} in {slab.period}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold ${slab.achieved ? 'text-green-400' : 'text-cyan-400'}`}>
                        {slab.type === 'percentage' ? `${slab.value}% bonus` : formatCurrency(slab.value)}
                      </p>
                      {slab.achieved && (
                        <Badge className="bg-green-600 text-xs">Unlocked</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Achievements */}
        {achievements.length > 0 && (
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Award className="w-5 h-5 text-purple-400" />
                Recent Achievements
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {achievements.map((achievement, idx) => (
                  <div key={idx} className="flex items-center gap-4 p-3 bg-slate-900 rounded-lg">
                    <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center">
                      <Trophy className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="text-white font-medium">{achievement.title}</p>
                      <p className="text-slate-500 text-sm">{achievement.description}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-green-400 font-bold">{formatCurrency(achievement.reward)}</p>
                      <p className="text-slate-500 text-xs">{new Date(achievement.achieved_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* No Targets Message */}
        {!currentTarget && !quarterlyTarget && !yearlyTarget && (
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-12 text-center">
              <Target className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <h3 className="text-xl text-white mb-2">No Targets Set</h3>
              <p className="text-slate-400">
                Your sales targets will appear here once they are assigned by the admin.
              </p>
            </CardContent>
          </Card>
        )}

        {/* CTA */}
        <Card className="bg-gradient-to-r from-cyan-900/50 to-blue-900/50 border-cyan-600/50">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="text-white font-semibold">Ready to achieve your targets?</h3>
                <p className="text-slate-400 text-sm">Browse our catalogue and place your orders now</p>
              </div>
              <Link to="/dealer/orders/new">
                <Button className="bg-cyan-600 hover:bg-cyan-700">
                  <Package className="w-4 h-4 mr-2" />
                  Place Order
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
