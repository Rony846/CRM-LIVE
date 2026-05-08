import { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
  Phone, Plus, Edit, Trash2, Loader2, Users, RefreshCw, Headphones, Building2, Key, User, Check, X
} from 'lucide-react';
import { toast } from 'sonner';

const DEPARTMENTS = [
  { value: 'Sales', label: 'Sales' },
  { value: 'Cx Exp', label: 'Customer Support' },
];

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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Phone className="w-7 h-7 text-cyan-400" />
              Smartflo Agent Mapping
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Map CRM users to Tata Smartflo IVR agents for call tracking and click-to-call
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={fetchAgents} variant="outline" className="gap-2">
              <RefreshCw className="w-4 h-4" />
              Refresh
            </Button>
            <Button onClick={openCreateDialog} className="bg-cyan-600 hover:bg-cyan-700 gap-2">
              <Plus className="w-4 h-4" />
              Add Agent
            </Button>
          </div>
        </div>

        {/* Info Card */}
        <Card className="bg-blue-900/30 border-blue-700">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Headphones className="w-5 h-5 text-blue-400 mt-0.5" />
              <div className="text-sm text-blue-200">
                <p className="font-medium mb-1">How Agent Mapping Works</p>
                <ul className="space-y-1 text-blue-300">
                  <li>• <strong>Smartflo Agent Number</strong>: The extension/number assigned to the agent in Tata Smartflo IVR system</li>
                  <li>• <strong>Phone</strong>: The agent's phone number (used to match incoming call data)</li>
                  <li>• <strong>API Key</strong>: Required for Click-to-Call feature (obtain from Smartflo portal)</li>
                  <li>• <strong>CRM User</strong>: Link to CRM account so agents see their own call dashboard</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Agents Table */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="w-5 h-5 text-cyan-400" />
              Mapped Agents ({agents.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
              </div>
            ) : agents.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Phone className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No Smartflo agents mapped yet</p>
                <Button variant="link" className="text-cyan-400" onClick={openCreateDialog}>
                  Add your first agent mapping
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-700">
                    <TableHead className="text-slate-400">Name</TableHead>
                    <TableHead className="text-slate-400">Phone</TableHead>
                    <TableHead className="text-slate-400">Smartflo #</TableHead>
                    <TableHead className="text-slate-400">Department</TableHead>
                    <TableHead className="text-slate-400">CRM User</TableHead>
                    <TableHead className="text-slate-400">API Key</TableHead>
                    <TableHead className="text-slate-400">Status</TableHead>
                    <TableHead className="text-slate-400 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agents.map((agent) => {
                    const linkedUser = crmUsers.find(u => u.id === agent.crm_user_id);
                    return (
                      <TableRow key={agent.id} className="border-slate-700">
                        <TableCell>
                          <div>
                            <p className="font-medium text-white">{agent.name}</p>
                            {agent.email && (
                              <p className="text-xs text-slate-400">{agent.email}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-white">{agent.phone}</TableCell>
                        <TableCell className="font-mono text-cyan-400">{agent.smartflo_agent_number}</TableCell>
                        <TableCell>
                          <Badge className={agent.department === 'Sales' ? 'bg-green-600' : 'bg-purple-600'}>
                            {agent.department === 'Cx Exp' ? 'Support' : agent.department}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {linkedUser ? (
                            <div className="flex items-center gap-2">
                              <User className="w-3 h-3 text-cyan-400" />
                              <span className="text-slate-300 text-sm">{linkedUser.email}</span>
                            </div>
                          ) : (
                            <span className="text-slate-500 text-sm">Not linked</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {agent.api_key ? (
                            <div className="flex items-center gap-1 text-green-400">
                              <Key className="w-3 h-3" />
                              <span className="text-xs">Configured</span>
                            </div>
                          ) : (
                            <span className="text-slate-500 text-xs">Not set</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {agent.is_active !== false ? (
                            <Badge className="bg-green-600"><Check className="w-3 h-3 mr-1" />Active</Badge>
                          ) : (
                            <Badge className="bg-slate-600"><X className="w-3 h-3 mr-1" />Inactive</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditDialog(agent)}
                              className="text-cyan-400 hover:text-cyan-300"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openDeleteDialog(agent)}
                              className="text-red-400 hover:text-red-300"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Phone className="w-5 h-5 text-cyan-400" />
              {selectedAgent ? 'Edit Agent Mapping' : 'Add Agent Mapping'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Link to CRM User */}
            <div>
              <Label className="text-slate-300">Link to CRM User (Optional)</Label>
              <Select 
                value={formData.crm_user_id || 'none'} 
                onValueChange={handleCrmUserChange}
              >
                <SelectTrigger className="bg-slate-700 border-slate-600">
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
              <p className="text-xs text-slate-500 mt-1">
                Link to CRM user to enable their personal call dashboard
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-300">Agent Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Harleen"
                  className="bg-slate-700 border-slate-600"
                />
              </div>
              <div>
                <Label className="text-slate-300">Department *</Label>
                <Select 
                  value={formData.department} 
                  onValueChange={(v) => setFormData({ ...formData, department: v })}
                >
                  <SelectTrigger className="bg-slate-700 border-slate-600">
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
                <Label className="text-slate-300">Phone Number *</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="9876543210"
                  className="bg-slate-700 border-slate-600"
                />
                <p className="text-xs text-slate-500 mt-1">Agent's phone number</p>
              </div>
              <div>
                <Label className="text-slate-300">Smartflo Agent Number *</Label>
                <Input
                  value={formData.smartflo_agent_number}
                  onChange={(e) => setFormData({ ...formData, smartflo_agent_number: e.target.value })}
                  placeholder="e.g., 1001"
                  className="bg-slate-700 border-slate-600"
                />
                <p className="text-xs text-slate-500 mt-1">Extension in Smartflo IVR</p>
              </div>
            </div>
            
            <div>
              <Label className="text-slate-300">Email</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="agent@example.com"
                className="bg-slate-700 border-slate-600"
              />
            </div>
            
            <div>
              <Label className="text-slate-300">Click-to-Call API Key</Label>
              <Input
                value={formData.api_key}
                onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                className="bg-slate-700 border-slate-600 font-mono text-sm"
              />
              <p className="text-xs text-slate-500 mt-1">
                Required for click-to-call feature. Get from Smartflo admin portal.
              </p>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-slate-700/50 rounded-lg">
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <div>
                <Label className="text-white">Active</Label>
                <p className="text-xs text-slate-400">Inactive agents won't receive click-to-call</p>
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
              className="bg-cyan-600 hover:bg-cyan-700"
            >
              {formLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {selectedAgent ? 'Save Changes' : 'Create Agent'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-slate-800 border-slate-700 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Agent Mapping?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Are you sure you want to delete the mapping for <strong>{selectedAgent?.name}</strong>?
              <br /><br />
              This will not delete any call records, but the agent won't be able to use click-to-call
              and their calls won't be attributed to their CRM account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-700 border-slate-600 hover:bg-slate-600">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={formLoading}
            >
              {formLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
