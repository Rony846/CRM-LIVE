import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import {
  RefreshCw, Loader2, ShoppingCart, TrendingUp, Package, Calendar,
  AlertCircle, Clock, ChevronRight, Sparkles, ArrowRight, BarChart3
} from 'lucide-react';

export default function DealerReorderSuggestions() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [suggestions, setSuggestions] = useState([]);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (token) {
      fetchSuggestions();
    }
  }, [token]);

  const fetchSuggestions = async () => {
    try {
      const response = await axios.get(`${API}/dealer/reorder-suggestions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuggestions(response.data.suggestions || []);
      setStats(response.data.stats);
    } catch (error) {
      console.error('Failed to fetch suggestions:', error);
      toast.error('Failed to load reorder suggestions');
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

  const getPriorityBadge = (priority) => {
    switch (priority) {
      case 'high':
        return { label: 'High Priority', color: 'bg-red-600', icon: AlertCircle };
      case 'medium':
        return { label: 'Medium', color: 'bg-yellow-600', icon: Clock };
      default:
        return { label: 'Suggested', color: 'bg-blue-600', icon: Sparkles };
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Reorder Suggestions">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Reorder Suggestions">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-cyan-400" />
              Smart Reorder Suggestions
            </h1>
            <p className="text-slate-400">AI-powered recommendations based on your purchase history</p>
          </div>
          <Button 
            variant="outline" 
            className="border-slate-600 text-slate-300 hover:bg-slate-700"
            onClick={fetchSuggestions}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Stats Overview */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-400 text-sm">Total Suggestions</p>
                    <p className="text-2xl font-bold text-white">{stats.total_suggestions}</p>
                  </div>
                  <Sparkles className="w-8 h-8 text-cyan-400" />
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-400 text-sm">High Priority</p>
                    <p className="text-2xl font-bold text-red-400">{stats.high_priority}</p>
                  </div>
                  <AlertCircle className="w-8 h-8 text-red-400" />
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-400 text-sm">Products Ordered</p>
                    <p className="text-2xl font-bold text-white">{stats.unique_products_ordered}</p>
                  </div>
                  <Package className="w-8 h-8 text-blue-400" />
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-400 text-sm">Suggested Value</p>
                    <p className="text-2xl font-bold text-green-400">{formatCurrency(stats.suggested_order_value)}</p>
                  </div>
                  <BarChart3 className="w-8 h-8 text-green-400" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Suggestions List */}
        {suggestions.length === 0 ? (
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-12 text-center">
              <Sparkles className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <h3 className="text-xl text-white mb-2">No Suggestions Yet</h3>
              <p className="text-slate-400 mb-4">
                Place a few orders and we'll analyze your purchase patterns to provide smart reorder suggestions
              </p>
              <Link to="/dealer/orders/new">
                <Button className="bg-cyan-600 hover:bg-cyan-700">
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  Place Your First Order
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* High Priority Section */}
            {suggestions.filter(s => s.priority === 'high').length > 0 && (
              <div>
                <h2 className="text-white font-semibold mb-3 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-400" />
                  Restock Soon
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {suggestions.filter(s => s.priority === 'high').map((suggestion) => (
                    <SuggestionCard key={suggestion.id} suggestion={suggestion} formatCurrency={formatCurrency} />
                  ))}
                </div>
              </div>
            )}

            {/* Regular Suggestions */}
            {suggestions.filter(s => s.priority !== 'high').length > 0 && (
              <div>
                <h2 className="text-white font-semibold mb-3 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-cyan-400" />
                  Recommended for You
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {suggestions.filter(s => s.priority !== 'high').map((suggestion) => (
                    <SuggestionCard key={suggestion.id} suggestion={suggestion} formatCurrency={formatCurrency} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Quick Action */}
        {suggestions.length > 0 && (
          <Card className="bg-gradient-to-r from-cyan-900/50 to-blue-900/50 border-cyan-600/50">
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div>
                  <h3 className="text-white font-semibold">Ready to restock?</h3>
                  <p className="text-slate-400 text-sm">
                    Total suggested order value: {formatCurrency(stats?.suggested_order_value || 0)}
                  </p>
                </div>
                <Link to="/dealer/orders/new">
                  <Button className="bg-cyan-600 hover:bg-cyan-700">
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    Place Order Now
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

function SuggestionCard({ suggestion, formatCurrency }) {
  const priorityConfig = {
    high: { label: 'Restock Soon', color: 'bg-red-600', borderColor: 'border-red-600/50' },
    medium: { label: 'Consider', color: 'bg-yellow-600', borderColor: 'border-yellow-600/50' },
    low: { label: 'Suggested', color: 'bg-blue-600', borderColor: 'border-blue-600/50' }
  };
  
  const config = priorityConfig[suggestion.priority] || priorityConfig.low;

  return (
    <Card className={`bg-slate-800 border-slate-700 hover:${config.borderColor} transition-all`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-semibold line-clamp-1">{suggestion.product_name}</h3>
            <p className="text-slate-500 text-sm font-mono">{suggestion.sku}</p>
          </div>
          <Badge className={`${config.color} text-xs flex-shrink-0`}>{config.label}</Badge>
        </div>
        
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-400">Last Ordered</span>
            <span className="text-white">{suggestion.last_order_date}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Typical Qty</span>
            <span className="text-white">{suggestion.typical_quantity} units</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Order Frequency</span>
            <span className="text-white">Every {suggestion.avg_days_between_orders} days</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Suggested Qty</span>
            <span className="text-cyan-400 font-semibold">{suggestion.suggested_quantity} units</span>
          </div>
        </div>
        
        <div className="mt-3 pt-3 border-t border-slate-700">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-sm">Suggested Value</span>
            <span className="text-green-400 font-bold">{formatCurrency(suggestion.suggested_value)}</span>
          </div>
        </div>
        
        {suggestion.reason && (
          <p className="text-slate-500 text-xs mt-2 italic">
            "{suggestion.reason}"
          </p>
        )}
      </CardContent>
    </Card>
  );
}
