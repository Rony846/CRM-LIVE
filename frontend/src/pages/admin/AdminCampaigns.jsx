import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import StatusBadge from '@/components/ui/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter 
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { 
  Mail, Plus, Send, Clock, CheckCircle, XCircle, Loader2, 
  Eye, Users, Shield, Star 
} from 'lucide-react';

export default function AdminCampaigns() {
  const { token } = useAuth();
  const [campaigns, setCampaigns] = useState([]);
  const [extensionRequests, setExtensionRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('campaigns');
  const [createOpen, setCreateOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [newCampaign, setNewCampaign] = useState({
    name: '',
    description: '',
    max_sends: 3
  });

  useEffect(() => {
    fetchData();
  }, [token]);

  const fetchData = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [campaignsRes, requestsRes] = await Promise.all([
        axios.get(`${API}/campaigns`, { headers }),
        axios.get(`${API}/campaigns/extension-requests`, { headers })
      ]);
      setCampaigns(campaignsRes.data);
      setExtensionRequests(requestsRes.data);
    } catch (error) {
      toast.error('Failed to load campaign data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCampaign = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      await axios.post(`${API}/campaigns`, newCampaign, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Campaign created');
      setCreateOpen(false);
      setNewCampaign({ name: '', description: '', max_sends: 3 });
      fetchData();
    } catch (error) {
      toast.error('Failed to create campaign');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendCampaignEmails = async (campaignId) => {
    setActionLoading(true);
    try {
      const response = await axios.post(`${API}/campaigns/${campaignId}/send-emails`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(`Campaign emails queued: ${response.data.sent_count} recipients`);
      fetchData();
    } catch (error) {
      toast.error('Failed to send campaign emails');
    } finally {
      setActionLoading(false);
    }
  };

  const openReviewDialog = (request) => {
    setSelectedRequest(request);
    setReviewOpen(true);
  };

  const handleApproveExtension = async () => {
    setActionLoading(true);
    try {
      await axios.patch(`${API}/warranties/${selectedRequest.id}/approve-extension`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Extension approved! +3 months added');
      setReviewOpen(false);
      fetchData();
    } catch (error) {
      toast.error('Failed to approve extension');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectExtension = async () => {
    setActionLoading(true);
    try {
      const formData = new FormData();
      formData.append('notes', 'Review screenshot not valid');
      await axios.patch(`${API}/warranties/${selectedRequest.id}/reject-extension`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Extension rejected');
      setReviewOpen(false);
      fetchData();
    } catch (error) {
      toast.error('Failed to reject extension');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Warranty Extension Campaigns">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Warranty Extension Campaigns">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Mail className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Active Campaigns</p>
                <p className="text-2xl font-bold font-['Barlow_Condensed']">
                  {campaigns.filter(c => c.status === 'running').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Pending Reviews</p>
                <p className="text-2xl font-bold font-['Barlow_Condensed']">{extensionRequests.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Total Approved</p>
                <p className="text-2xl font-bold font-['Barlow_Condensed']">
                  {campaigns.reduce((sum, c) => sum + (c.approved_reviews || 0), 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Total Customers</p>
                <p className="text-2xl font-bold font-['Barlow_Condensed']">
                  {campaigns.reduce((sum, c) => sum + (c.total_customers || 0), 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Card>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <CardHeader className="pb-0">
            <div className="flex items-center justify-between">
              <TabsList>
                <TabsTrigger value="campaigns" data-testid="campaigns-tab">
                  <Mail className="w-4 h-4 mr-2" />
                  Campaigns ({campaigns.length})
                </TabsTrigger>
                <TabsTrigger value="reviews" data-testid="reviews-tab">
                  <Star className="w-4 h-4 mr-2" />
                  Pending Reviews ({extensionRequests.length})
                </TabsTrigger>
              </TabsList>
              <Button 
                className="bg-blue-600 hover:bg-blue-700"
                onClick={() => setCreateOpen(true)}
                data-testid="create-campaign-btn"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Campaign
              </Button>
            </div>
          </CardHeader>

          <CardContent className="pt-6">
            {/* Campaigns Tab */}
            <TabsContent value="campaigns" className="mt-0">
              {campaigns.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <Mail className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p>No campaigns created yet</p>
                  <Button 
                    className="mt-4 bg-blue-600 hover:bg-blue-700"
                    onClick={() => setCreateOpen(true)}
                  >
                    Create First Campaign
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campaign Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Target Customers</TableHead>
                      <TableHead>Pending</TableHead>
                      <TableHead>Approved</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaigns.map((campaign) => (
                      <TableRow key={campaign.id} className="data-row">
                        <TableCell>
                          <div>
                            <p className="font-medium">{campaign.name}</p>
                            <p className="text-xs text-slate-500">{campaign.description}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            campaign.status === 'running' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {campaign.status}
                          </span>
                        </TableCell>
                        <TableCell>{campaign.total_customers || 0}</TableCell>
                        <TableCell>
                          <span className="text-orange-600 font-medium">{campaign.pending_reviews || 0}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-green-600 font-medium">{campaign.approved_reviews || 0}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button 
                            size="sm"
                            className="bg-blue-600 hover:bg-blue-700"
                            onClick={() => handleSendCampaignEmails(campaign.id)}
                            disabled={actionLoading}
                          >
                            <Send className="w-4 h-4 mr-1" />
                            Send Emails
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            {/* Pending Reviews Tab */}
            <TabsContent value="reviews" className="mt-0">
              {extensionRequests.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-400" />
                  <p>No pending review requests</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Device</TableHead>
                      <TableHead>Current Expiry</TableHead>
                      <TableHead>Requested</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {extensionRequests.map((request) => (
                      <TableRow key={request.id} className="data-row">
                        <TableCell>
                          <div>
                            <p className="font-medium">{request.first_name} {request.last_name}</p>
                            <p className="text-xs text-slate-500">{request.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>{request.device_type}</TableCell>
                        <TableCell>{request.warranty_end_date || 'N/A'}</TableCell>
                        <TableCell className="text-slate-500 text-sm">
                          {request.extension_requested_at ? new Date(request.extension_requested_at).toLocaleDateString() : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button 
                            size="sm"
                            className="bg-blue-600 hover:bg-blue-700"
                            onClick={() => openReviewDialog(request)}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            Review
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>

      {/* Create Campaign Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-['Barlow_Condensed'] text-xl">
              Create Warranty Extension Campaign
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateCampaign} className="space-y-4">
            <div className="space-y-2">
              <Label>Campaign Name *</Label>
              <Input
                placeholder="e.g., Q1 2026 Review Campaign"
                value={newCampaign.name}
                onChange={(e) => setNewCampaign({...newCampaign, name: e.target.value})}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                placeholder="Describe the campaign purpose..."
                value={newCampaign.description}
                onChange={(e) => setNewCampaign({...newCampaign, description: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label>Max Email Reminders</Label>
              <Input
                type="number"
                min="1"
                max="10"
                value={newCampaign.max_sends}
                onChange={(e) => setNewCampaign({...newCampaign, max_sends: parseInt(e.target.value)})}
              />
            </div>
            <div className="bg-blue-50 p-4 rounded-lg text-sm text-blue-700">
              <p><strong>How it works:</strong></p>
              <ol className="list-decimal ml-4 mt-2 space-y-1">
                <li>Campaign emails will be sent to customers with approved warranties</li>
                <li>Customers upload their Amazon review screenshot in the portal</li>
                <li>Admin reviews and approves screenshots</li>
                <li>Approved customers get +3 months warranty extension</li>
              </ol>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={actionLoading}>
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                Create Campaign
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Review Extension Dialog */}
      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-['Barlow_Condensed'] text-xl flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-500" />
              Review Extension Request
            </DialogTitle>
          </DialogHeader>
          
          {selectedRequest && (
            <div className="space-y-4">
              {/* Customer Info */}
              <div className="bg-slate-50 p-4 rounded-lg">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-slate-500">Customer</p>
                    <p className="font-medium">{selectedRequest.first_name} {selectedRequest.last_name}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Device</p>
                    <p className="font-medium">{selectedRequest.device_type}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Current Expiry</p>
                    <p className="font-medium">{selectedRequest.warranty_end_date || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">New Expiry (if approved)</p>
                    <p className="font-medium text-green-600">
                      {selectedRequest.warranty_end_date 
                        ? new Date(new Date(selectedRequest.warranty_end_date).getTime() + 90*24*60*60*1000).toLocaleDateString()
                        : '+3 months'
                      }
                    </p>
                  </div>
                </div>
              </div>

              {/* Review Screenshot */}
              <div>
                <p className="text-sm text-slate-500 mb-2">Review Screenshot</p>
                <div className="border-2 border-dashed border-slate-200 rounded-lg p-4 text-center">
                  {selectedRequest.extension_review_file ? (
                    <div>
                      <p className="text-sm text-blue-600 mb-2">File: {selectedRequest.extension_review_file}</p>
                      <p className="text-xs text-slate-500">Open in new tab to view full image</p>
                    </div>
                  ) : (
                    <p className="text-slate-400">No file uploaded</p>
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setReviewOpen(false)}>Cancel</Button>
            <Button 
              variant="destructive"
              onClick={handleRejectExtension}
              disabled={actionLoading}
            >
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <XCircle className="w-4 h-4 mr-2" />}
              Reject
            </Button>
            <Button 
              className="bg-green-600 hover:bg-green-700"
              onClick={handleApproveExtension}
              disabled={actionLoading}
            >
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
              Approve (+3 months)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
