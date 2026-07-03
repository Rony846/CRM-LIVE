import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Mail, Plus, Send, Clock, CheckCircle, XCircle, Loader2,
  Eye, Users, Star
} from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell, badgeStyle } from '@/components/iron/IronKit';

const primaryBtn = { border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
const rowActionStyle = { display: 'inline-flex', alignItems: 'center', gap: 4, border: `1px solid ${T.orange}`, background: T.white, color: T.orangeDeep, borderRadius: 6, padding: '5px 9px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 11 };

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const statCards = [
    { label: 'Active Campaigns', value: campaigns.filter(c => c.status === 'running').length, icon: Mail, tone: T.blue },
    { label: 'Pending Reviews', value: extensionRequests.length, icon: Clock, tone: T.orange },
    { label: 'Total Approved', value: campaigns.reduce((sum, c) => sum + (c.approved_reviews || 0), 0), icon: CheckCircle, tone: T.green },
    { label: 'Total Customers', value: campaigns.reduce((sum, c) => sum + (c.total_customers || 0), 0), icon: Users, tone: '#6D4AB0' },
  ];

  const tabs = [
    { key: 'campaigns', label: 'Campaigns', count: campaigns.length, icon: Mail, testid: 'campaigns-tab' },
    { key: 'reviews', label: 'Pending Reviews', count: extensionRequests.length, icon: Star, testid: 'reviews-tab' },
  ];

  const headerRight = (
    <button style={primaryBtn} onClick={() => setCreateOpen(true)} data-testid="create-campaign-btn">
      <Plus size={15} strokeWidth={2.2} />
      New Campaign
    </button>
  );

  return (
    <IronShell
      title="Campaigns"
      subtitle="WARRANTY EXTENSION CAMPAIGNS"
      onRefresh={fetchData}
      headerRight={headerRight}
    >
      {loading ? (
        <div style={{ display: 'grid', placeItems: 'center', height: 320 }}>
          <Loader2 className="animate-spin" size={30} color={T.iron400} />
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
            {statCards.map((s) => {
              const Icon = s.icon;
              return (
                <IronCard key={s.label} pad={14}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 8, display: 'grid', placeItems: 'center', background: T.iron50, border: `1px solid ${T.iron200}` }}>
                      <Icon size={18} color={s.tone} strokeWidth={1.9} />
                    </div>
                    <div>
                      <div style={{ ...mono, fontSize: 22, fontWeight: 700, color: T.iron900, lineHeight: 1 }}>{s.value.toLocaleString('en-IN')}</div>
                      <Caps size={9} color={T.iron400} style={{ display: 'block', marginTop: 4 }}>{s.label}</Caps>
                    </div>
                  </div>
                </IronCard>
              );
            })}
          </div>

          {/* Tabs + table */}
          <IronCard pad={0} style={{ overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '12px 14px', borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
              {tabs.map((tb) => {
                const Icon = tb.icon;
                const active = activeTab === tb.key;
                return (
                  <button key={tb.key} data-testid={tb.testid} onClick={() => setActiveTab(tb.key)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${active ? T.orange : T.iron200}`, background: active ? T.orange : T.white, color: active ? '#fff' : T.iron700, borderRadius: 6, padding: '7px 13px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 12 }}>
                    <Icon size={14} strokeWidth={2} />{tb.label}
                    <span style={{ ...mono, fontSize: 11, opacity: 0.85 }}>({tb.count})</span>
                  </button>
                );
              })}
            </div>

            {/* Campaigns Tab */}
            {activeTab === 'campaigns' && (
              campaigns.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '52px 0', color: T.iron400 }}>
                  <Mail size={44} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
                  <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron700 }}>No campaigns created yet</div>
                  <button style={{ ...primaryBtn, margin: '14px auto 0' }} onClick={() => setCreateOpen(true)}>
                    Create First Campaign
                  </button>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                        {['CAMPAIGN NAME', 'STATUS', 'TARGET CUSTOMERS', 'PENDING', 'APPROVED', ''].map((h, i) => (
                          <th key={i} style={{ ...thCell, textAlign: i === 5 ? 'right' : 'left' }}><Caps size={8.5}>{h}</Caps></th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {campaigns.map((campaign) => (
                        <tr key={campaign.id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                          <td style={{ ...tdCell, maxWidth: 280 }}>
                            <div style={{ fontFamily: T.headline, fontWeight: 600, fontSize: 12.5, color: T.iron900 }}>{campaign.name}</div>
                            <div style={{ fontSize: 11, color: T.iron500, marginTop: 2 }}>{campaign.description}</div>
                          </td>
                          <td style={tdCell}>
                            <span style={badgeStyle(campaign.status === 'running' ? 'ok' : 'slate')}>{campaign.status}</span>
                          </td>
                          <td style={{ ...tdCell, ...mono, fontSize: 12.5, color: T.iron900 }}>{campaign.total_customers || 0}</td>
                          <td style={{ ...tdCell, ...mono, fontSize: 12.5, fontWeight: 700, color: T.orangeDeep }}>{campaign.pending_reviews || 0}</td>
                          <td style={{ ...tdCell, ...mono, fontSize: 12.5, fontWeight: 700, color: T.green }}>{campaign.approved_reviews || 0}</td>
                          <td style={{ ...tdCell, textAlign: 'right' }}>
                            <button
                              onClick={() => handleSendCampaignEmails(campaign.id)}
                              disabled={actionLoading}
                              style={{ ...rowActionStyle, opacity: actionLoading ? 0.6 : 1 }}
                            >
                              <Send size={13} />
                              Send Emails
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}

            {/* Pending Reviews Tab */}
            {activeTab === 'reviews' && (
              extensionRequests.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '52px 0', color: T.iron400 }}>
                  <CheckCircle size={44} color={T.green} style={{ margin: '0 auto 10px', opacity: 0.6 }} />
                  <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron700 }}>No pending review requests</div>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                        {['CUSTOMER', 'DEVICE', 'CURRENT EXPIRY', 'REQUESTED', ''].map((h, i) => (
                          <th key={i} style={{ ...thCell, textAlign: i === 4 ? 'right' : 'left' }}><Caps size={8.5}>{h}</Caps></th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {extensionRequests.map((request) => (
                        <tr key={request.id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                          <td style={{ ...tdCell, maxWidth: 240 }}>
                            <div style={{ fontFamily: T.headline, fontWeight: 600, fontSize: 12.5, color: T.iron900 }}>{request.first_name} {request.last_name}</div>
                            <div style={{ ...mono, fontSize: 10.5, color: T.iron500, marginTop: 2 }}>{request.email}</div>
                          </td>
                          <td style={{ ...tdCell, fontSize: 12, color: T.iron900 }}>{request.device_type}</td>
                          <td style={{ ...tdCell, ...mono, fontSize: 11.5, color: T.iron700 }}>{request.warranty_end_date || 'N/A'}</td>
                          <td style={{ ...tdCell, ...mono, fontSize: 11, color: T.iron500 }}>
                            {request.extension_requested_at ? new Date(request.extension_requested_at).toLocaleDateString() : '-'}
                          </td>
                          <td style={{ ...tdCell, textAlign: 'right' }}>
                            <button onClick={() => openReviewDialog(request)} style={rowActionStyle}>
                              <Eye size={13} />
                              Review
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </IronCard>
        </>
      )}

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
    </IronShell>
  );
}
