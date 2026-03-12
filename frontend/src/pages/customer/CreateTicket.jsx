import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Send, ArrowLeft, Shield, AlertTriangle } from 'lucide-react';

export default function CreateTicket() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [warranties, setWarranties] = useState([]);
  const [loadingWarranties, setLoadingWarranties] = useState(true);
  const [selectedWarranty, setSelectedWarranty] = useState(null);
  const [issueDescription, setIssueDescription] = useState('');

  useEffect(() => {
    fetchApprovedWarranties();
  }, [token]);

  const fetchApprovedWarranties = async () => {
    try {
      const response = await axios.get(`${API}/warranties?status=approved`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setWarranties(response.data);
    } catch (error) {
      console.error('Failed to fetch warranties:', error);
      toast.error('Failed to load your products');
    } finally {
      setLoadingWarranties(false);
    }
  };

  const handleWarrantySelect = (warrantyId) => {
    const warranty = warranties.find(w => w.id === warrantyId);
    setSelectedWarranty(warranty);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedWarranty) {
      toast.error('Please select a registered product');
      return;
    }

    if (!issueDescription.trim()) {
      toast.error('Please describe your issue');
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('device_type', selectedWarranty.device_type);
      formData.append('product_name', selectedWarranty.product_name || selectedWarranty.device_type);
      formData.append('serial_number', selectedWarranty.serial_number || '');
      formData.append('order_id', selectedWarranty.order_id || '');
      formData.append('issue_description', issueDescription);

      await axios.post(`${API}/tickets`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Ticket created successfully!');
      navigate('/customer/tickets');
    } catch (error) {
      console.error('Create ticket error:', error);
      const message = error.response?.data?.detail || 'Failed to create ticket';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const isWarrantyValid = (warranty) => {
    if (!warranty.warranty_end_date) return false;
    const endDate = new Date(warranty.warranty_end_date);
    return endDate > new Date();
  };

  return (
    <DashboardLayout title="Create Ticket">
      <div className="max-w-2xl mx-auto">
        <Button
          variant="ghost"
          className="mb-4 text-slate-300 hover:text-white hover:bg-slate-800"
          onClick={() => navigate('/customer/tickets')}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Tickets
        </Button>

        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white text-2xl">Create Support Ticket</CardTitle>
            <CardDescription className="text-slate-400">
              Select your registered product and describe your issue
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingWarranties ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
              </div>
            ) : warranties.length === 0 ? (
              <div className="text-center py-12">
                <Shield className="w-16 h-16 mx-auto mb-4 text-slate-600" />
                <h3 className="text-xl font-semibold text-white mb-2">No Registered Products</h3>
                <p className="text-slate-400 mb-6">
                  You can only create support tickets for products with approved warranty registration.
                </p>
                <Button 
                  onClick={() => navigate('/customer/warranty/register')}
                  className="bg-cyan-600 hover:bg-cyan-700"
                >
                  Register a Product
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Product Selection */}
                <div className="space-y-2">
                  <Label className="text-white">Select Product *</Label>
                  <Select onValueChange={handleWarrantySelect}>
                    <SelectTrigger className="bg-slate-900 border-slate-700 text-white" data-testid="product-select">
                      <SelectValue placeholder="Choose a registered product" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-700">
                      {warranties.map((warranty) => (
                        <SelectItem 
                          key={warranty.id} 
                          value={warranty.id}
                          className="text-white"
                        >
                          <div className="flex items-center gap-2">
                            <span>{warranty.product_name || warranty.device_type}</span>
                            {!isWarrantyValid(warranty) && (
                              <span className="text-xs text-red-400">(Expired)</span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Selected Product Details */}
                {selectedWarranty && (
                  <Card className="bg-slate-900 border-slate-700">
                    <CardContent className="pt-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-slate-400">Product</p>
                          <p className="text-white font-medium">{selectedWarranty.product_name || selectedWarranty.device_type}</p>
                        </div>
                        <div>
                          <p className="text-slate-400">Serial Number</p>
                          <p className="text-white font-mono">{selectedWarranty.serial_number || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-slate-400">Order ID</p>
                          <p className="text-white font-mono">{selectedWarranty.order_id || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-slate-400">Warranty Valid Until</p>
                          <p className={`font-medium ${isWarrantyValid(selectedWarranty) ? 'text-green-400' : 'text-red-400'}`}>
                            {selectedWarranty.warranty_end_date 
                              ? new Date(selectedWarranty.warranty_end_date).toLocaleDateString('en-IN')
                              : 'N/A'}
                          </p>
                        </div>
                      </div>
                      
                      {!isWarrantyValid(selectedWarranty) && (
                        <div className="mt-4 p-3 bg-red-900/20 border border-red-800 rounded-lg flex items-start gap-2">
                          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-red-400 font-medium">Warranty Expired</p>
                            <p className="text-red-400/80 text-sm">
                              This product's warranty has expired. Service charges may apply.
                            </p>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Issue Description */}
                <div className="space-y-2">
                  <Label className="text-white">Issue Description *</Label>
                  <Textarea
                    placeholder="Please describe your issue in detail. Include any error messages, symptoms, or steps to reproduce the problem."
                    value={issueDescription}
                    onChange={(e) => setIssueDescription(e.target.value)}
                    rows={6}
                    className="bg-slate-900 border-slate-700 text-white placeholder:text-slate-500"
                    data-testid="issue-description-input"
                  />
                </div>

                {/* Submit */}
                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="border-slate-600 text-slate-300 hover:bg-slate-700"
                    onClick={() => navigate('/customer/tickets')}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="bg-cyan-600 hover:bg-cyan-700 flex-1"
                    disabled={loading || !selectedWarranty}
                    data-testid="submit-ticket-btn"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Submit Ticket
                      </>
                    )}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
