import { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Phone, Plus, Edit, Trash2, Loader2, Users, Headphones, Key, User, Check, X
} from 'lucide-react';
import { toast } from 'sonner';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell, badgeStyle } from '@/components/iron/IronKit';

const DEPARTMENTS = [
  { value: 'Sales', label: 'Sales' },
  { value: 'Cx Exp', label: 'Customer Support' },
];

const btnPrimary = { border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
const btnOutline = { border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
const rowIconBtn = (color) => ({ border: `1px solid ${T.iron200}`, background: T.white, color, borderRadius: 6, padding: '5px 8px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' });

export default function SmartfloAgents() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [agents, setAgents] = useState([]);
  const [crmUsers, setCrmUsers] = useState([]);

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [formLoading, setFormLoading] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    department: 'Sales',
    smartflo_agent_number: '',
    api_key: '',
    is_active: true,
    crm_user_id: ''
  });

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetchAgents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchAgents = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/smartflo/agents/list`, { headers });
      setAgents(res.data.agents || []);
      setCrmUsers(res.data.crm_users || []);
    } catch (err) {
      console.error('Failed to fetch agents:', err);
      toast.error('Failed to load Smartflo agents');
    } finally {
      setLoading(false);
    }
  };

  const openCreateDialog = () => {
    setSelectedAgent(null);
    setFormData({
      name: '',
      email: '',
      phone: '',
      department: 'Sales',
      smartflo_agent_number: '',
      api_key: '',
      is_active: true,
      crm_user_id: ''
    });
    setDialogOpen(true);
  };

  const openEditDialog = (agent) => {
    setSelectedAgent(agent);
    setFormData({
      name: agent.name || '',
      email: agent.email || '',
      phone: agent.phone || '',
      department: agent.department || 'Sales',
      smartflo_agent_number: agent.smartflo_agent_number || '',
      api_key: agent.api_key || '',
      is_active: agent.is_active !== false,
      crm_user_id: agent.crm_user_id || ''
    });
    setDialogOpen(true);
  };

  const openDeleteDialog = (agent) => {
    setSelectedAgent(agent);
    setDeleteDialogOpen(true);
  };

  const handleCrmUserChange = (userId) => {
    setFormData({ ...formData, crm_user_id: userId });

    // Auto-fill from CRM user if selected
    if (userId && userId !== 'none') {
      const user = crmUsers.find(u => u.id === userId);
      if (user) {
        setFormData(prev => ({
          ...prev,
          crm_user_id: userId,
          name: prev.name || `${user.first_name || ''} ${user.last_name || ''}`.trim(),
          email: prev.email || user.email || '',
          phone: prev.phone || user.phone || ''
        }));
      }
    }
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.phone || !formData.smartflo_agent_number) {
      toast.error('Name, Phone, and Smartflo Agent Number are required');
      return;
    }

    setFormLoading(true);
    try {
      if (selectedAgent) {
        // Update
        await axios.put(`${API}/smartflo/agents/${selectedAgent.id}`, formData, { headers });
        toast.success('Agent updated successfully');
      } else {
        // Create
        await axios.post(`${API}/smartflo/agents`, formData, { headers });
        toast.success('Agent created successfully');
      }
      setDialogOpen(false);
      fetchAgents();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Operation failed');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    setFormLoading(true);
    try {
      await axios.delete(`${API}/smartflo/agents/${selectedAgent.id}`, { headers });
      toast.success('Agent deleted successfully');
      setDeleteDialogOpen(false);
      fetchAgents();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Delete failed');
    } finally {
      setFormLoading(false);
    }
  };

  const H = ['Name', 'Phone', 'Smartflo #', 'Department', 'CRM User', 'API Key', 'Status', 'Actions'];

  return (
    <IronShell
      title="Smartflo Agents"
      subtitle={`${agents.length} MAPPED · TATA SMARTFLO IVR · CLICK-TO-CALL`}
      onRefresh={fetchAgents}
      headerRight={<button onClick={openCreateDialog} style={btnPrimary}><Plus size={14} />Add Agent</button>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Info Card */}
        <IronCard style={{ background: T.blueTint, borderColor: '#CBE0F0' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <Headphones size={18} color={T.blue} style={{ marginTop: 2, flexShrink: 0 }} />
            <div style={{ fontSize: 12.5, color: T.iron700, lineHeight: 1.6 }}>
              <div style={{ fontFamily: T.headline, fontWeight: 700, color: T.iron900, marginBottom: 4 }}>How Agent Mapping Works</div>
              <ul style={{ margin: 0, paddingLeft: 16 }}>
                <li><strong>Smartflo Agent Number</strong>: The extension/number assigned to the agent in Tata Smartflo IVR system</li>
                <li><strong>Phone</strong>: The agent's phone number (used to match incoming call data)</li>
                <li><strong>API Key</strong>: Required for Click-to-Call feature (obtain from Smartflo portal)</li>
                <li><strong>CRM User</strong>: Link to CRM account so agents see their own call dashboard</li>
              </ul>
            </div>
          </div>
        </IronCard>

        {/* Agents Table */}
        <IronCard pad={0} style={{ overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
            <Users size={16} color={T.orange} />
            <span style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 13, color: T.iron900 }}>Mapped Agents</span>
            <span style={{ ...mono, fontSize: 12, color: T.iron400 }}>({agents.length})</span>
          </div>

          {loading ? (
            <div style={{ display: 'grid', placeItems: 'center', padding: '60px 0' }}>
              <Loader2 className="animate-spin" size={28} color={T.iron400} />
            </div>
          ) : agents.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: T.iron400 }}>
              <Phone size={44} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
              <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron700 }}>No Smartflo agents mapped yet</div>
              <button onClick={openCreateDialog} style={{ border: 'none', background: 'none', color: T.orange, cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 12.5, marginTop: 6 }}>
                Add your first agent mapping
              </button>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                    {H.map((h, i) => (
                      <th key={i} style={{ ...thCell, textAlign: i === H.length - 1 ? 'right' : 'left' }}><Caps size={8.5}>{h}</Caps></th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {agents.map((agent) => {
                    const linkedUser = crmUsers.find(u => u.id === agent.crm_user_id);
                    return (
                      <tr key={agent.id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                        <td style={tdCell}>
                          <div style={{ fontFamily: T.headline, fontWeight: 600, fontSize: 12.5, color: T.iron900 }}>{agent.name}</div>
                          {agent.email && <div style={{ fontSize: 10.5, color: T.iron400, marginTop: 2 }}>{agent.email}</div>}
                        </td>
                        <td style={{ ...tdCell, ...mono, fontSize: 12, color: T.iron900 }}>{agent.phone}</td>
                        <td style={{ ...tdCell, ...mono, fontSize: 12, fontWeight: 700, color: T.orangeDeep }}>{agent.smartflo_agent_number}</td>
                        <td style={tdCell}>
                          <span style={badgeStyle(agent.department === 'Sales' ? 'ok' : 'violet')}>
                            {agent.department === 'Cx Exp' ? 'Support' : agent.department}
                          </span>
                        </td>
                        <td style={tdCell}>
                          {linkedUser ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: T.iron700, fontSize: 12 }}>
                              <User size={12} color={T.orange} />{linkedUser.email}
                            </span>
                          ) : (
                            <span style={{ color: T.iron400, fontSize: 12 }}>Not linked</span>
                          )}
                        </td>
                        <td style={tdCell}>
                          {agent.api_key ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: T.green, fontSize: 11 }}>
                              <Key size={12} />Configured
                            </span>
                          ) : (
                            <span style={{ color: T.iron400, fontSize: 11 }}>Not set</span>
                          )}
                        </td>
                        <td style={tdCell}>
                          {agent.is_active !== false ? (
                            <span style={{ ...badgeStyle('ok'), display: 'inline-flex', alignItems: 'center', gap: 3 }}><Check size={11} />Active</span>
                          ) : (
                            <span style={{ ...badgeStyle('slate'), display: 'inline-flex', alignItems: 'center', gap: 3 }}><X size={11} />Inactive</span>
                          )}
                        </td>
                        <td style={{ ...tdCell, textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: 6, justifyContent: 'flex-end' }}>
                            <button onClick={() => openEditDialog(agent)} title="Edit" style={rowIconBtn(T.blue)}><Edit size={13} /></button>
                            <button onClick={() => openDeleteDialog(agent)} title="Delete" style={rowIconBtn(T.orangeDeep)}><Trash2 size={13} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </IronCard>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Phone className="w-5 h-5" style={{ color: T.orange }} />
              {selectedAgent ? 'Edit Agent Mapping' : 'Add Agent Mapping'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Link to CRM User */}
            <div>
              <Label>Link to CRM User (Optional)</Label>
              <Select
                value={formData.crm_user_id || 'none'}
                onValueChange={handleCrmUserChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select CRM user..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- No CRM User --</SelectItem>
                  {crmUsers.map(user => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.first_name} {user.last_name} ({user.email}) - {user.role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Link to CRM user to enable their personal call dashboard
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Agent Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Harleen"
                />
              </div>
              <div>
                <Label>Department *</Label>
                <Select
                  value={formData.department}
                  onValueChange={(v) => setFormData({ ...formData, department: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DEPARTMENTS.map(d => (
                      <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Phone Number *</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="9876543210"
                />
                <p className="text-xs text-muted-foreground mt-1">Agent's phone number</p>
              </div>
              <div>
                <Label>Smartflo Agent Number *</Label>
                <Input
                  value={formData.smartflo_agent_number}
                  onChange={(e) => setFormData({ ...formData, smartflo_agent_number: e.target.value })}
                  placeholder="e.g., 1001"
                />
                <p className="text-xs text-muted-foreground mt-1">Extension in Smartflo IVR</p>
              </div>
            </div>

            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="agent@example.com"
              />
            </div>

            <div>
              <Label>Click-to-Call API Key</Label>
              <Input
                value={formData.api_key}
                onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Required for click-to-call feature. Get from Smartflo admin portal.
              </p>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: T.iron50, border: `1px solid ${T.iron200}` }}>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <div>
                <Label>Active</Label>
                <p className="text-xs text-muted-foreground">Inactive agents won't receive click-to-call</p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)} disabled={formLoading}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={formLoading}
              style={{ background: T.orange, color: '#fff' }}
            >
              {formLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {selectedAgent ? 'Save Changes' : 'Create Agent'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Agent Mapping?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the mapping for <strong>{selectedAgent?.name}</strong>?
              <br /><br />
              This will not delete any call records, but the agent won't be able to use click-to-call
              and their calls won't be attributed to their CRM account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              style={{ background: T.orangeDeep, color: '#fff' }}
              disabled={formLoading}
            >
              {formLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </IronShell>
  );
}
