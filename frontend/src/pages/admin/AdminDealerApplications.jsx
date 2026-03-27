import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  Users, Loader2, CheckCircle, XCircle, Eye, Clock, Building2,
  Phone, Mail, MapPin, FileText, Shield, IndianRupee, AlertTriangle
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function AdminDealerApplications() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [applications, setApplications] = useState([]);
  const [deposits, setDeposits] = useState([]);
  const [selectedApp, setSelectedApp] = useState(null);
  const [selectedDeposit, setSelectedDeposit] = useState(null);
  const [activeTab, setActiveTab] = useState('applications');
  const [actionLoading, setActionLoading] = useState(false);
  const [notes, setNotes] = useState('');
  const [depositAmount, setDepositAmount] = useState('100000');

  useEffect(() => {
    if (token) {
      fetchData();
    }
  }, [token]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [appsRes, depositsRes] = await Promise.all([
        axios.get(`${API}/admin/dealer-applications`, { headers }),
        axios.get(`${API}/admin/dealer-deposits?status=pending`, { headers })
      ]);
      setApplications(appsRes.data || []);
      setDeposits(depositsRes.data || []);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveApplication = async () => {
    if (!selectedApp) return;
    setActionLoading(true);
    try {
      const formData = new FormData();
      formData.append('admin_notes', notes);
      formData.append('security_deposit_amount', depositAmount);
      
      const response = await axios.post(
        `${API}/admin/dealer-applications/${selectedApp.id}/approve`,
        formData,
        { headers: { Authorization: `Bearer ${token}` }}
      );
      
      toast.success(`Dealer approved. Temp password: ${response.data.temp_password}`);
      setSelectedApp(null);
      setNotes('');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to approve');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectApplication = async () => {
    if (!selectedApp || !notes) {
      toast.error('Please provide rejection reason');
      return;
    }
    setActionLoading(true);
    try {
      const formData = new FormData();
      formData.append('admin_notes', notes);
      
      await axios.post(
        `${API}/admin/dealer-applications/${selectedApp.id}/reject`,
        formData,
        { headers: { Authorization: `Bearer ${token}` }}
      );
      
      toast.success('Application rejected');
      setSelectedApp(null);
      setNotes('');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to reject');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApproveDeposit = async () => {
    if (!selectedDeposit) return;
    setActionLoading(true);
    try {
      const formData = new FormData();
      formData.append('remarks', notes);
      
      await axios.post(
        `${API}/admin/dealer-deposits/${selectedDeposit.id}/approve`,
        formData,
        { headers: { Authorization: `Bearer ${token}` }}
      );
      
      toast.success('Deposit approved, dealer portal activated');
      setSelectedDeposit(null);
      setNotes('');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to approve');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectDeposit = async () => {
    if (!selectedDeposit || !notes) {
      toast.error('Please provide rejection reason');
      return;
    }
    setActionLoading(true);
    try {
      const formData = new FormData();
      formData.append('remarks', notes);
      
      await axios.post(
        `${API}/admin/dealer-deposits/${selectedDeposit.id}/reject`,
        formData,
        { headers: { Authorization: `Bearer ${token}` }}
      );
      
      toast.success('Deposit rejected');
      setSelectedDeposit(null);
      setNotes('');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to reject');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const colors = {
      new: 'bg-blue-600',
      review: 'bg-yellow-600',
      approved: 'bg-green-600',
      rejected: 'bg-red-600'
    };
    return <Badge className={colors[status] || 'bg-slate-600'}>{status}</Badge>;
  };

  const pendingApps = applications.filter(a => a.status === 'new' || a.status === 'review');

  if (loading) {
    return (
      <DashboardLayout title="Dealer Applications">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Dealer Applications">
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Pending Apps</p>
                  <p className="text-2xl font-bold text-yellow-400">{pendingApps.length}</p>
                </div>
                <Clock className="w-8 h-8 text-yellow-400" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Pending Deposits</p>
                  <p className="text-2xl font-bold text-cyan-400">{deposits.length}</p>
                </div>
                <Shield className="w-8 h-8 text-cyan-400" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Approved</p>
                  <p className="text-2xl font-bold text-green-400">
                    {applications.filter(a => a.status === 'approved').length}
                  </p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-400" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Total Apps</p>
                  <p className="text-2xl font-bold text-white">{applications.length}</p>
                </div>
                <Users className="w-8 h-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-slate-800">
            <TabsTrigger value="applications" className="data-[state=active]:bg-cyan-600">
              Applications ({pendingApps.length} pending)
            </TabsTrigger>
            <TabsTrigger value="deposits" className="data-[state=active]:bg-cyan-600">
              Deposit Approvals ({deposits.length})
            </TabsTrigger>
          </TabsList>

          {/* Applications Tab */}
          <TabsContent value="applications">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Dealer Applications</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="text-left p-3 text-slate-400 text-sm">Firm / Contact</th>
                        <th className="text-left p-3 text-slate-400 text-sm">Location</th>
                        <th className="text-left p-3 text-slate-400 text-sm">Contact</th>
                        <th className="text-center p-3 text-slate-400 text-sm">Status</th>
                        <th className="text-left p-3 text-slate-400 text-sm">Applied</th>
                        <th className="text-right p-3 text-slate-400 text-sm">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {applications.map((app) => (
                        <tr key={app.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                          <td className="p-3">
                            <p className="text-white font-medium">{app.firm_name}</p>
                            <p className="text-slate-400 text-sm">{app.contact_person}</p>
                          </td>
                          <td className="p-3 text-slate-300">
                            {app.city}, {app.state}
                          </td>
                          <td className="p-3">
                            <p className="text-slate-300">{app.mobile}</p>
                            <p className="text-slate-400 text-xs">{app.email}</p>
                          </td>
                          <td className="p-3 text-center">{getStatusBadge(app.status)}</td>
                          <td className="p-3 text-slate-400 text-sm">
                            {new Date(app.created_at).toLocaleDateString()}
                          </td>
                          <td className="p-3 text-right">
                            <Button
                              size="sm"
                              onClick={() => setSelectedApp(app)}
                              className="bg-cyan-600 hover:bg-cyan-700"
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              Review
                            </Button>
                          </td>
                        </tr>
                      ))}
                      {applications.length === 0 && (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-slate-400">
                            No applications found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Deposits Tab */}
          <TabsContent value="deposits">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Pending Deposit Approvals</CardTitle>
              </CardHeader>
              <CardContent>
                {deposits.length === 0 ? (
                  <p className="text-slate-400 text-center py-8">No pending deposits</p>
                ) : (
                  <div className="space-y-4">
                    {deposits.map((dealer) => (
                      <div key={dealer.id} className="p-4 bg-slate-900 rounded-lg border border-slate-700">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="text-white font-medium">{dealer.firm_name}</h4>
                            <p className="text-slate-400 text-sm">{dealer.contact_person}</p>
                            <p className="text-slate-400 text-sm">{dealer.phone}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-slate-400 text-sm">Amount</p>
                            <p className="text-white font-bold">
                              ₹{dealer.security_deposit_amount?.toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-700">
                          <div className="flex items-center gap-4">
                            {dealer.security_deposit_proof_path && (
                              <a
                                href={`${API.replace('/api', '')}${dealer.security_deposit_proof_path}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300"
                              >
                                <FileText className="w-4 h-4" />
                                View Proof
                              </a>
                            )}
                            <span className="text-slate-400 text-sm">
                              Uploaded: {dealer.security_deposit_uploaded_at ? 
                                new Date(dealer.security_deposit_uploaded_at).toLocaleDateString() : 'N/A'}
                            </span>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => setSelectedDeposit(dealer)}
                            className="bg-cyan-600 hover:bg-cyan-700"
                          >
                            Review
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Application Review Dialog */}
      <Dialog open={!!selectedApp} onOpenChange={() => setSelectedApp(null)}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">Review Application: {selectedApp?.firm_name}</DialogTitle>
            <DialogDescription className="text-slate-400">
              Application #{selectedApp?.application_number}
            </DialogDescription>
          </DialogHeader>
          
          {selectedApp && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-800 rounded-lg">
                  <p className="text-slate-400 text-xs">Firm Name</p>
                  <p className="text-white">{selectedApp.firm_name}</p>
                </div>
                <div className="p-3 bg-slate-800 rounded-lg">
                  <p className="text-slate-400 text-xs">Contact Person</p>
                  <p className="text-white">{selectedApp.contact_person}</p>
                </div>
                <div className="p-3 bg-slate-800 rounded-lg">
                  <p className="text-slate-400 text-xs">Email</p>
                  <p className="text-white">{selectedApp.email}</p>
                </div>
                <div className="p-3 bg-slate-800 rounded-lg">
                  <p className="text-slate-400 text-xs">Mobile</p>
                  <p className="text-white">{selectedApp.mobile}</p>
                </div>
                <div className="p-3 bg-slate-800 rounded-lg col-span-2">
                  <p className="text-slate-400 text-xs">Address</p>
                  <p className="text-white">
                    {selectedApp.address_line1} {selectedApp.address_line2}<br />
                    {selectedApp.city}, {selectedApp.district}, {selectedApp.state} - {selectedApp.pincode}
                  </p>
                </div>
                {selectedApp.gstin && (
                  <div className="p-3 bg-slate-800 rounded-lg">
                    <p className="text-slate-400 text-xs">GSTIN</p>
                    <p className="text-white">{selectedApp.gstin}</p>
                  </div>
                )}
                {selectedApp.business_type && (
                  <div className="p-3 bg-slate-800 rounded-lg">
                    <p className="text-slate-400 text-xs">Business Type</p>
                    <p className="text-white">{selectedApp.business_type}</p>
                  </div>
                )}
              </div>

              {selectedApp.status === 'new' || selectedApp.status === 'review' ? (
                <>
                  <div>
                    <label className="text-slate-300 text-sm">Security Deposit Amount</label>
                    <Input
                      type="number"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      className="bg-slate-800 border-slate-700 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-slate-300 text-sm">Admin Notes</label>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Add notes (required for rejection)"
                      className="bg-slate-800 border-slate-700 text-white"
                    />
                  </div>
                </>
              ) : (
                <div className="p-3 bg-slate-800 rounded-lg">
                  <p className="text-slate-400 text-xs">Admin Notes</p>
                  <p className="text-white">{selectedApp.admin_notes || 'None'}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex gap-2">
            <Button variant="ghost" onClick={() => setSelectedApp(null)} className="text-slate-400">
              Close
            </Button>
            {(selectedApp?.status === 'new' || selectedApp?.status === 'review') && (
              <>
                <Button
                  onClick={handleRejectApplication}
                  disabled={actionLoading}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  <XCircle className="w-4 h-4 mr-1" />
                  Reject
                </Button>
                <Button
                  onClick={handleApproveApplication}
                  disabled={actionLoading}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Approve
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deposit Review Dialog */}
      <Dialog open={!!selectedDeposit} onOpenChange={() => setSelectedDeposit(null)}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">Review Deposit: {selectedDeposit?.firm_name}</DialogTitle>
          </DialogHeader>
          
          {selectedDeposit && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-800 rounded-lg">
                  <p className="text-slate-400 text-xs">Dealer</p>
                  <p className="text-white">{selectedDeposit.firm_name}</p>
                </div>
                <div className="p-3 bg-slate-800 rounded-lg">
                  <p className="text-slate-400 text-xs">Amount</p>
                  <p className="text-white font-bold">
                    ₹{selectedDeposit.security_deposit_amount?.toLocaleString()}
                  </p>
                </div>
              </div>

              {selectedDeposit.security_deposit_proof_path && (
                <div className="p-4 bg-slate-800 rounded-lg">
                  <a
                    href={`${API.replace('/api', '')}${selectedDeposit.security_deposit_proof_path}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300"
                  >
                    <FileText className="w-5 h-5" />
                    View Deposit Proof Document
                  </a>
                </div>
              )}

              <div>
                <label className="text-slate-300 text-sm">Remarks</label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add remarks (required for rejection)"
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
            </div>
          )}

          <DialogFooter className="flex gap-2">
            <Button variant="ghost" onClick={() => setSelectedDeposit(null)} className="text-slate-400">
              Close
            </Button>
            <Button
              onClick={handleRejectDeposit}
              disabled={actionLoading}
              className="bg-red-600 hover:bg-red-700"
            >
              <XCircle className="w-4 h-4 mr-1" />
              Reject
            </Button>
            <Button
              onClick={handleApproveDeposit}
              disabled={actionLoading}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="w-4 h-4 mr-1" />
              Approve & Activate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
