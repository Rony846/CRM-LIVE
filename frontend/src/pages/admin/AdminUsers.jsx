import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter 
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Users, Plus, Loader2, Phone, Wrench, FileText, Truck, Settings, Edit2, ArrowUpCircle, Scan } from 'lucide-react';

const ROLES = [
  { value: 'call_support', label: 'Call Support Agent', icon: Phone },
  { value: 'supervisor', label: 'Supervisor', icon: ArrowUpCircle },
  { value: 'service_agent', label: 'Service Agent', icon: Wrench },
  { value: 'accountant', label: 'Accountant', icon: FileText },
  { value: 'dispatcher', label: 'Dispatcher', icon: Truck },
  { value: 'gate', label: 'Gate Operator', icon: Scan },
  { value: 'admin', label: 'Admin', icon: Settings },
];

const roleLabels = {
  customer: 'Customer',
  call_support: 'Call Support',
  supervisor: 'Supervisor',
  service_agent: 'Service Agent',
  accountant: 'Accountant',
  dispatcher: 'Dispatcher',
  gate: 'Gate Operator',
  admin: 'Admin'
};

const roleBadgeColors = {
  customer: 'bg-slate-100 text-slate-700',
  call_support: 'bg-blue-100 text-blue-700',
  supervisor: 'bg-purple-100 text-purple-700',
  service_agent: 'bg-yellow-100 text-yellow-700',
  accountant: 'bg-green-100 text-green-700',
  dispatcher: 'bg-orange-100 text-orange-700',
  gate: 'bg-teal-100 text-teal-700',
  admin: 'bg-red-100 text-red-700'
};

export default function AdminUsers() {
  const { token } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [roleFilter, setRoleFilter] = useState('all');
  const [selectedUser, setSelectedUser] = useState(null);
  const [newUser, setNewUser] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    password: '',
    role: ''
  });
  const [editUser, setEditUser] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    role: '',
    password: '' // Optional for edit
  });

  useEffect(() => {
    fetchUsers();
  }, [token]);

  const fetchUsers = async () => {
    try {
      const response = await axios.get(`${API}/admin/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(response.data);
    } catch (error) {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (newUser.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setActionLoading(true);
    try {
      await axios.post(`${API}/admin/users`, newUser, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('User created successfully');
      setCreateOpen(false);
      setNewUser({ first_name: '', last_name: '', email: '', phone: '', password: '', role: '' });
      fetchUsers();
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to create user';
      toast.error(message);
    } finally {
      setActionLoading(false);
    }
  };

  const openEditDialog = (user) => {
    setSelectedUser(user);
    setEditUser({
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      password: ''
    });
    setEditOpen(true);
  };

  const handleEditUser = async (e) => {
    e.preventDefault();
    if (editUser.password && editUser.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setActionLoading(true);
    try {
      const payload = { ...editUser };
      if (!payload.password) delete payload.password;
      
      await axios.patch(`${API}/admin/users/${selectedUser.id}`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('User updated successfully');
      setEditOpen(false);
      fetchUsers();
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to update user';
      toast.error(message);
    } finally {
      setActionLoading(false);
    }
  };

  const filteredUsers = roleFilter === 'all' 
    ? users 
    : users.filter(u => u.role === roleFilter);

  const internalUsers = users.filter(u => u.role !== 'customer');
  const customers = users.filter(u => u.role === 'customer');

  if (loading) {
    return (
      <DashboardLayout title="User Management">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="User Management">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-slate-500">Total Users</p>
            <p className="text-2xl font-bold font-['Barlow_Condensed']">{users.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-slate-500">Staff Members</p>
            <p className="text-2xl font-bold font-['Barlow_Condensed']">{internalUsers.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-slate-500">Customers</p>
            <p className="text-2xl font-bold font-['Barlow_Condensed']">{customers.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-slate-500">Admins</p>
            <p className="text-2xl font-bold font-['Barlow_Condensed']">
              {users.filter(u => u.role === 'admin').length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="font-['Barlow_Condensed'] flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              All Users
            </CardTitle>
            <div className="flex items-center gap-3">
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="customer">Customers</SelectItem>
                  <SelectItem value="call_support">Call Support</SelectItem>
                  <SelectItem value="service_agent">Service Agents</SelectItem>
                  <SelectItem value="accountant">Accountants</SelectItem>
                  <SelectItem value="dispatcher">Dispatchers</SelectItem>
                  <SelectItem value="admin">Admins</SelectItem>
                </SelectContent>
              </Select>
              <Button 
                className="bg-blue-600 hover:bg-blue-700"
                onClick={() => setCreateOpen(true)}
                data-testid="create-user-btn"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add User
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id} className="data-row">
                  <TableCell className="font-medium">
                    {user.first_name} {user.last_name}
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell className="font-mono text-sm">{user.phone}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${roleBadgeColors[user.role]}`}>
                      {roleLabels[user.role]}
                    </span>
                  </TableCell>
                  <TableCell className="text-slate-500 text-sm">
                    {new Date(user.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(user)}
                      data-testid={`edit-user-${user.id}`}
                    >
                      <Edit2 className="w-4 h-4 mr-1" />
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create User Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-['Barlow_Condensed'] text-xl">Add New User</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateUser} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>First Name *</Label>
                <Input
                  value={newUser.first_name}
                  onChange={(e) => setNewUser({...newUser, first_name: e.target.value})}
                  required
                  data-testid="new-user-firstname"
                />
              </div>
              <div className="space-y-2">
                <Label>Last Name *</Label>
                <Input
                  value={newUser.last_name}
                  onChange={(e) => setNewUser({...newUser, last_name: e.target.value})}
                  required
                  data-testid="new-user-lastname"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Email *</Label>
              <Input
                type="email"
                value={newUser.email}
                onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                required
                data-testid="new-user-email"
              />
            </div>

            <div className="space-y-2">
              <Label>Phone *</Label>
              <Input
                type="tel"
                value={newUser.phone}
                onChange={(e) => setNewUser({...newUser, phone: e.target.value})}
                required
                data-testid="new-user-phone"
              />
            </div>

            <div className="space-y-2">
              <Label>Role *</Label>
              <Select value={newUser.role} onValueChange={(v) => setNewUser({...newUser, role: v})}>
                <SelectTrigger data-testid="new-user-role">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      <div className="flex items-center gap-2">
                        <role.icon className="w-4 h-4" />
                        {role.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Password *</Label>
              <Input
                type="password"
                placeholder="Min. 6 characters"
                value={newUser.password}
                onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                required
                data-testid="new-user-password"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="bg-blue-600 hover:bg-blue-700" 
                disabled={actionLoading}
                data-testid="submit-new-user"
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                Create User
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-['Barlow_Condensed'] text-xl">Edit User</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditUser} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>First Name *</Label>
                <Input
                  value={editUser.first_name}
                  onChange={(e) => setEditUser({...editUser, first_name: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Last Name *</Label>
                <Input
                  value={editUser.last_name}
                  onChange={(e) => setEditUser({...editUser, last_name: e.target.value})}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Email *</Label>
              <Input
                type="email"
                value={editUser.email}
                onChange={(e) => setEditUser({...editUser, email: e.target.value})}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Phone *</Label>
              <Input
                type="tel"
                value={editUser.phone}
                onChange={(e) => setEditUser({...editUser, phone: e.target.value})}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Role *</Label>
              <Select value={editUser.role} onValueChange={(v) => setEditUser({...editUser, role: v})}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="customer">Customer</SelectItem>
                  {ROLES.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      <div className="flex items-center gap-2">
                        <role.icon className="w-4 h-4" />
                        {role.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>New Password (leave blank to keep current)</Label>
              <Input
                type="password"
                placeholder="Min. 6 characters"
                value={editUser.password}
                onChange={(e) => setEditUser({...editUser, password: e.target.value})}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="bg-blue-600 hover:bg-blue-700" 
                disabled={actionLoading}
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Edit2 className="w-4 h-4 mr-2" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
