import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  Package, Truck, Factory, ShoppingCart, Clock, AlertTriangle,
  CheckCircle, ArrowRight, Loader2, RefreshCw, Eye, IndianRupee
} from 'lucide-react';

const BUCKET_CONFIG = {
  stock_available: { label: 'Stock Available', color: 'bg-green-600', icon: CheckCircle },
  pending_production: { label: 'Pending Production', color: 'bg-purple-600', icon: Factory },
  pending_procurement: { label: 'Pending Procurement', color: 'bg-blue-600', icon: ShoppingCart },
  pending_dispatch: { label: 'Pending Dispatch', color: 'bg-cyan-600', icon: Truck },
  expired: { label: 'Expired', color: 'bg-orange-600', icon: Clock }
};

export default function PIPendingAction() {
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ buckets: {}, counts: {}, total: 0 });
  const [selectedBucket, setSelectedBucket] = useState('stock_available');
  const [actionLoading, setActionLoading] = useState(null);

  useEffect(() => {
    if (token) {
      fetchData();
    }
  }, [token]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const response = await axios.get(`${API}/quotations/pending-action`, { headers });
      setData(response.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load pending quotations');
    } finally {
      setLoading(false);
    }
  };

  const handleConvert = async (quotationId, conversionType) => {
    setActionLoading(quotationId);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      await axios.post(`${API}/quotations/${quotationId}/convert`, null, {
        headers,
        params: { conversion_type: conversionType }
      });
      
      toast.success(`Quotation converted to ${conversionType}`);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Conversion failed');
    } finally {
      setActionLoading(null);
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
      month: 'short'
    });
  };

  const currentQuotations = data.buckets?.[selectedBucket] || [];

  if (loading) {
    return (
      <DashboardLayout title="Approved PI - Pending Action">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Approved PI - Pending Action">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Approved PI - Pending Action</h1>
            <p className="text-slate-400">Convert approved quotations into business flow</p>
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
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {Object.entries(BUCKET_CONFIG).map(([key, config]) => {
            const BucketIcon = config.icon;
            const count = data.counts?.[key] || 0;
            
            return (
              <Card 
                key={key}
                className={`bg-slate-800 border-slate-700 cursor-pointer transition-all ${
                  selectedBucket === key ? 'ring-2 ring-cyan-500' : 'hover:border-slate-600'
                }`}
                onClick={() => setSelectedBucket(key)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${config.color}/20`}>
                      <BucketIcon className={`w-5 h-5 ${config.color.replace('bg-', 'text-').replace('-600', '-400')}`} />
                    </div>
                    <div>
                      <p className="text-slate-400 text-xs">{config.label}</p>
                      <p className="text-2xl font-bold text-white">{count}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Current Bucket */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              {React.createElement(BUCKET_CONFIG[selectedBucket]?.icon || Package, { className: 'w-5 h-5 text-cyan-400' })}
              {BUCKET_CONFIG[selectedBucket]?.label} ({currentQuotations.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-700">
                  <TableHead className="text-slate-400">PI Number</TableHead>
                  <TableHead className="text-slate-400">Customer</TableHead>
                  <TableHead className="text-slate-400">Items</TableHead>
                  <TableHead className="text-slate-400 text-right">Value</TableHead>
                  <TableHead className="text-slate-400">Approved</TableHead>
                  <TableHead className="text-slate-400">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentQuotations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-slate-400">
                      <Package className="w-12 h-12 mx-auto mb-4 text-slate-600" />
                      <p>No quotations in this bucket</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  currentQuotations.map((q) => (
                    <TableRow key={q.id} className="border-slate-700">
                      <TableCell>
                        <p className="text-white font-mono text-sm">{q.quotation_number}</p>
                        <p className="text-slate-500 text-xs">{q.firm_name}</p>
                      </TableCell>
                      <TableCell>
                        <p className="text-white">{q.customer_name}</p>
                        <p className="text-slate-400 text-sm">{q.customer_phone}</p>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {q.items?.slice(0, 2).map((item, idx) => (
                            <div key={idx} className="text-sm">
                              <span className="text-slate-300">{item.name}</span>
                              <span className="text-slate-500 ml-2">x{item.quantity}</span>
                              {item.current_stock !== undefined && (
                                <Badge 
                                  variant="outline" 
                                  className={`ml-2 text-xs ${
                                    item.current_stock >= item.quantity 
                                      ? 'border-green-600 text-green-400' 
                                      : 'border-red-600 text-red-400'
                                  }`}
                                >
                                  Stock: {item.current_stock}
                                </Badge>
                              )}
                            </div>
                          ))}
                          {q.items?.length > 2 && (
                            <p className="text-slate-500 text-xs">+{q.items.length - 2} more</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <p className="text-white font-semibold">{formatCurrency(q.grand_total)}</p>
                      </TableCell>
                      <TableCell className="text-slate-300">
                        {formatDate(q.approved_at)}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => navigate(`/quotations?view=${q.id}`)}
                            className="text-slate-400 hover:text-white"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          
                          {selectedBucket === 'stock_available' && (
                            <Button
                              size="sm"
                              onClick={() => handleConvert(q.id, 'dispatch')}
                              disabled={actionLoading === q.id}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              {actionLoading === q.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <>
                                  <Truck className="w-4 h-4 mr-1" />
                                  To Dispatch
                                </>
                              )}
                            </Button>
                          )}
                          
                          {selectedBucket === 'pending_production' && (
                            <Button
                              size="sm"
                              onClick={() => handleConvert(q.id, 'production')}
                              disabled={actionLoading === q.id}
                              className="bg-purple-600 hover:bg-purple-700"
                            >
                              {actionLoading === q.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <>
                                  <Factory className="w-4 h-4 mr-1" />
                                  To Production
                                </>
                              )}
                            </Button>
                          )}
                          
                          {selectedBucket === 'pending_procurement' && (
                            <Button
                              size="sm"
                              onClick={() => handleConvert(q.id, 'procurement')}
                              disabled={actionLoading === q.id}
                              className="bg-blue-600 hover:bg-blue-700"
                            >
                              {actionLoading === q.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <>
                                  <ShoppingCart className="w-4 h-4 mr-1" />
                                  To Procurement
                                </>
                              )}
                            </Button>
                          )}
                          
                          {selectedBucket === 'expired' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => navigate(`/quotations/edit/${q.id}`)}
                              className="border-slate-600 text-slate-300"
                            >
                              Create New Version
                            </Button>
                          )}
                          
                          {/* Alternative actions */}
                          <Select 
                            onValueChange={(v) => handleConvert(q.id, v)}
                            disabled={actionLoading === q.id}
                          >
                            <SelectTrigger className="w-10 h-8 bg-slate-900 border-slate-700 p-0">
                              <span className="text-slate-400">...</span>
                            </SelectTrigger>
                            <SelectContent className="bg-slate-900 border-slate-700">
                              <SelectItem value="dispatch">Convert to Dispatch</SelectItem>
                              <SelectItem value="production">Send to Production</SelectItem>
                              <SelectItem value="pending_fulfillment">Hold in Pending</SelectItem>
                              <SelectItem value="procurement">Send to Procurement</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
