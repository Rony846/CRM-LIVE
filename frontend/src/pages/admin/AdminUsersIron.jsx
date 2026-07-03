import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Users, Plus, Loader2, Phone, Wrench, FileText, Truck, Settings, Edit2, ArrowUpCircle, Scan, Trash2, Inbox } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell, badgeStyle, fmtDateTime } from '@/components/iron/IronKit';

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

// Iron badge tone per role (replaces the legacy Tailwind color map).
const roleTone = {
  customer: 'slate',
  call_support: 'info',
  supervisor: 'violet',
  service_agent: 'warn',
  accountant: 'ok',
  dispatcher: 'bad',
  gate: 'info',
  admin: 'bad',
};

const inputStyle = { border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '7px 10px', fontSize: 12.5, color: T.iron900, background: T.white, fontFamily: T.body, outline: 'none' };
const selectStyle = { ...inputStyle, cursor: 'pointer' };
const primaryBtn = { border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };

export default function AdminUsers() {
  const { token } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    setActionLoading(true);
    try {
      await axios.delete(`${API}/admin/users/${userToDelete.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(`User "${userToDelete.first_name} ${userToDelete.last_name}" deleted successfully`);
      setDeleteOpen(false);
      setUserToDelete(null);
      fetchUsers();
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to delete user';
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
  const adminCount = users.filter(u => u.role === 'admin').length;

  const stats = [
    ['Total Users', users.length],
    ['Staff Members', internalUsers.length],
    ['Customers', customers.length],
    ['Admins', adminCount],
  ];

  const headerRight = (
    <button onClick={() => setCreateOpen(true)} data-testid="create-user-btn" style={primaryBtn}>
      <Plus size={14} /> Add User
    </button>
  );

  const subtitle = `${users.length.toLocaleString('en-IN')} USERS · ${internalUsers.length} STAFF · ${customers.length} CUSTOMERS`;

  const tableHeaders = ['NAME', 'EMAIL', 'PHONE', 'ROLE', 'JOINED', ''];

  return (
    <IronShell title="Users" subtitle={subtitle} onRefresh={fetchUsers} headerRight={headerRight}>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
        {stats.map(([label, val]) => (
          <IronCard key={label} pad={14}>
            <Caps size={9} color={T.iron400} style={{ display: 'block', marginBottom: 6 }}>{label}</Caps>
            <div style={{ ...mono, fontWeight: 700, fontSize: 26, color: T.iron900, lineHeight: 1 }}>{Number(val).toLocaleString('en-IN')}</div>
          </IronCard>
        ))}
      </div>

      {/* Filter bar */}
      <IronCard style={{ marginBottom: 16 }} pad={14}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron900 }}>
            <Users size={16} color={T.orange} /> All Users
          </div>
          <div>
            <Caps size={8.5} style={{ display: 'block', marginBottom: 5 }}>Filter by Role</Caps>
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} style={{ ...selectStyle, minWidth: 180 }}>
              <option value="all">All Roles</option>
              <option value="customer">Customers</option>
              <option value="call_support">Call Support</option>
              <option value="service_agent">Service Agents</option>
              <option value="accountant">Accountants</option>
              <option value="dispatcher">Dispatchers</option>
              <option value="admin">Admins</option>
            </select>
          </div>
        </div>
      </IronCard>

      {/* Table */}
      <IronCard pad={0} style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ display: 'grid', placeItems: 'center', height: 260 }}><Loader2 className="animate-spin" size={28} color={T.iron400} /></div>
        ) : filteredUsers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: T.iron400 }}>
            <Inbox size={44} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
            <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron700 }}>No users found</div>
            <div style={{ fontSize: 12, marginTop: 3 }}>Try a different role filter.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                {tableHeaders.map((h, i) => <th key={i} style={{ ...thCell, textAlign: i === tableHeaders.length - 1 ? 'right' : 'left' }}><Caps size={8.5}>{h}</Caps></th>)}
              </tr></thead>
              <tbody>{filteredUsers.map((user) => (
                <tr key={user.id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                  <td style={tdCell}>
                    <div style={{ fontFamily: T.headline, fontWeight: 600, fontSize: 12.5, color: T.iron900 }}>{user.first_name} {user.last_name}</div>
                  </td>
                  <td style={{ ...tdCell, maxWidth: 220 }}>
                    <div style={{ fontSize: 12, color: T.iron700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 210 }}>{user.email}</div>
                  </td>
                  <td style={tdCell}><span style={{ ...mono, fontSize: 11.5, color: T.iron700 }}>{user.phone}</span></td>
                  <td style={tdCell}>
                    <span style={badgeStyle(roleTone[user.role] || 'slate')}>{roleLabels[user.role] || user.role}</span>
                  </td>
                  <td style={tdCell}><span style={{ ...mono, fontSize: 11, color: T.iron500 }}>{fmtDateTime(user.created_at)}</span></td>
                  <td style={{ ...tdCell, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button
                      onClick={() => openEditDialog(user)}
                      data-testid={`edit-user-${user.id}`}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: `1px solid ${T.orange}`, background: T.white, color: T.orangeDeep, borderRadius: 6, padding: '5px 11px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 11, marginRight: 6 }}
                    >
                      <Edit2 size={12} /> Edit
                    </button>
                    <button
                      onClick={() => { setUserToDelete(user); setDeleteOpen(true); }}
                      data-testid={`delete-user-${user.id}`}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: `1px solid ${T.iron200}`, background: T.white, color: '#C2410C', borderRadius: 6, padding: '5px 11px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 11 }}
                    >
                      <Trash2 size={12} /> Delete
                    </button>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </IronCard>

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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{userToDelete?.first_name} {userToDelete?.last_name}</strong> ({userToDelete?.email})?
              <br /><br />
              This action cannot be undone. All data associated with this user will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setUserToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              className="bg-red-600 hover:bg-red-700"
              disabled={actionLoading}
            >
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Delete User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </IronShell>
  );
}
