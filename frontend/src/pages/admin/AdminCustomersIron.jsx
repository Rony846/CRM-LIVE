import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import StatusBadge from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
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
import { toast } from 'sonner';
import { Users, Search, Eye, Loader2, Shield, Ticket, Plus, Edit, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import ClickToCallButton from '@/components/calls/ClickToCallButton';
import CustomerHistoryBadge from '@/components/customer/CustomerHistoryBadge';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell, fmtDateTime } from '@/components/iron/IronKit';

const STORAGE_KEY = 'admin_customers_filters';

const inputStyle = { border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '7px 10px', fontSize: 12.5, color: T.iron900, background: T.white, fontFamily: T.body, outline: 'none', width: '100%' };
const primaryBtn = { border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
const outlineBtn = { border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 600, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
const iconBtn = { border: `1px solid ${T.iron200}`, background: T.white, borderRadius: 6, height: 30, width: 30, display: 'grid', placeItems: 'center', cursor: 'pointer' };

export default function AdminCustomers() {
  const { token } = useAuth();

  // Initialize from sessionStorage
  const savedSearch = sessionStorage.getItem(STORAGE_KEY);
  const initialSearch = savedSearch || '';

  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 50;

  // CRUD state
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    pincode: ''
  });

  useEffect(() => {
    fetchCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, currentPage]);

  // Save search to sessionStorage
  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, searchQuery);
  }, [searchQuery]);

  const fetchCustomers = async (search = searchQuery) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      params.append('page', currentPage);
      params.append('limit', pageSize);

      const response = await axios.get(`${API}/admin/customers?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Handle paginated response
      if (response.data.customers) {
        setCustomers(response.data.customers);
        setTotalCount(response.data.total);
        setTotalPages(response.data.total_pages);
      } else {
        // Fallback for old API format (array)
        setCustomers(response.data);
        setTotalCount(response.data.length);
        setTotalPages(1);
      }
    } catch (error) {
      toast.error('Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setCurrentPage(1);
    fetchCustomers(searchQuery);
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const viewCustomerDetails = (customer) => {
    setSelectedCustomer(customer);
    setDetailsOpen(true);
  };

  // CRUD handlers
  const openCreateDialog = () => {
    setFormData({
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      address: '',
      city: '',
      state: '',
      pincode: ''
    });
    setCreateOpen(true);
  };

  const openEditDialog = (customer) => {
    setSelectedCustomer(customer);
    setFormData({
      first_name: customer.first_name || '',
      last_name: customer.last_name || '',
      email: customer.email || '',
      phone: customer.phone || '',
      address: customer.address || '',
      city: customer.city || '',
      state: customer.state || '',
      pincode: customer.pincode || ''
    });
    setEditOpen(true);
  };

  const openDeleteDialog = (customer) => {
    setSelectedCustomer(customer);
    setDeleteOpen(true);
  };

  const handleCreateCustomer = async () => {
    if (!formData.first_name || !formData.email || !formData.phone) {
      toast.error('First name, email, and phone are required');
      return;
    }

    setFormLoading(true);
    try {
      await axios.post(`${API}/admin/customers`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Customer created successfully');
      setCreateOpen(false);
      fetchCustomers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create customer');
    } finally {
      setFormLoading(false);
    }
  };

  const handleUpdateCustomer = async () => {
    setFormLoading(true);
    try {
      await axios.patch(`${API}/admin/customers/${selectedCustomer.id}`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Customer updated successfully');
      setEditOpen(false);
      fetchCustomers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update customer');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteCustomer = async () => {
    setFormLoading(true);
    try {
      await axios.delete(`${API}/admin/customers/${selectedCustomer.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Customer deleted successfully');
      setDeleteOpen(false);
      fetchCustomers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete customer');
    } finally {
      setFormLoading(false);
    }
  };

  // Calculate pagination range
  const getPaginationRange = () => {
    const range = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - 2);
    let end = Math.min(totalPages, start + maxVisible - 1);

    if (end - start < maxVisible - 1) {
      start = Math.max(1, end - maxVisible + 1);
    }

    for (let i = start; i <= end; i++) {
      range.push(i);
    }
    return range;
  };

  // Customer Form (shared between create and edit)
  const CustomerForm = ({ onSubmit, submitLabel }) => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>First Name *</Label>
          <Input
            value={formData.first_name}
            onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
            placeholder="Enter first name"
            data-testid="customer-first-name"
          />
        </div>
        <div>
          <Label>Last Name</Label>
          <Input
            value={formData.last_name}
            onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
            placeholder="Enter last name"
            data-testid="customer-last-name"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Email *</Label>
          <Input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="Enter email"
            data-testid="customer-email"
          />
        </div>
        <div>
          <Label>Phone *</Label>
          <Input
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="Enter phone number"
            data-testid="customer-phone"
          />
        </div>
      </div>
      <div>
        <Label>Address</Label>
        <Input
          value={formData.address}
          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          placeholder="Enter address"
          data-testid="customer-address"
        />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label>City</Label>
          <Input
            value={formData.city}
            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
            placeholder="City"
            data-testid="customer-city"
          />
        </div>
        <div>
          <Label>State</Label>
          <Input
            value={formData.state}
            onChange={(e) => setFormData({ ...formData, state: e.target.value })}
            placeholder="State"
            data-testid="customer-state"
          />
        </div>
        <div>
          <Label>Pincode</Label>
          <Input
            value={formData.pincode}
            onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
            placeholder="Pincode"
            data-testid="customer-pincode"
          />
        </div>
      </div>
      <DialogFooter>
        <Button
          onClick={onSubmit}
          disabled={formLoading}
          className="bg-blue-600 hover:bg-blue-700"
          data-testid="customer-submit-btn"
        >
          {formLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          {submitLabel}
        </Button>
      </DialogFooter>
    </div>
  );

  const headers = ['NAME', 'EMAIL', 'PHONE', 'WARRANTIES', 'TICKETS', 'JOINED', 'ACTIONS'];
  const showingFrom = customers.length > 0 ? (currentPage - 1) * pageSize + 1 : 0;
  const showingTo = Math.min(currentPage * pageSize, totalCount);

  return (
    <IronShell
      title="Customers"
      subtitle={`${totalCount.toLocaleString('en-IN')} CUSTOMERS · CRM`}
      onRefresh={() => fetchCustomers()}
      headerRight={
        <button onClick={openCreateDialog} style={primaryBtn} data-testid="add-customer-btn">
          <Plus size={14} /> Add Customer
        </button>
      }
    >
      {/* Search bar */}
      <IronCard style={{ marginBottom: 16 }} pad={14}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: 10, alignItems: 'end' }}>
          <div style={{ flex: 1 }}>
            <Caps size={8.5} style={{ display: 'block', marginBottom: 5 }}>Search</Caps>
            <div style={{ position: 'relative' }}>
              <Search size={14} color={T.iron400} style={{ position: 'absolute', left: 9, top: 9 }} />
              <input
                placeholder="Search by name, email, or phone…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ ...inputStyle, paddingLeft: 30 }}
                data-testid="customer-search-input"
              />
            </div>
          </div>
          <button type="submit" style={primaryBtn} data-testid="search-btn">Search</button>
          <button
            type="button"
            style={outlineBtn}
            onClick={() => {
              setSearchQuery('');
              sessionStorage.setItem(STORAGE_KEY, '');
              setCurrentPage(1);
              fetchCustomers('');
            }}
          >
            Clear
          </button>
        </form>
      </IronCard>

      {/* Customers table */}
      <IronCard pad={0} style={{ overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Users size={16} color={T.orange} />
            <span style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 13, color: T.iron900 }}>All Customers</span>
            <span style={{ ...mono, fontSize: 12, color: T.iron500 }}>({totalCount.toLocaleString('en-IN')})</span>
          </div>
          <Caps size={9} color={T.iron400}>
            Showing {showingFrom} – {showingTo} of {totalCount.toLocaleString('en-IN')}
          </Caps>
        </div>

        {loading ? (
          <div style={{ display: 'grid', placeItems: 'center', height: 260 }}>
            <Loader2 className="animate-spin" size={28} color={T.iron400} />
          </div>
        ) : customers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: T.iron400 }}>
            <Users size={44} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
            <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron700 }}>No customers found</div>
            <div style={{ fontSize: 12, marginTop: 3 }}>Try adjusting or clearing your search.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                  {headers.map((h, i) => (
                    <th key={i} style={{ ...thCell, textAlign: h === 'ACTIONS' ? 'right' : 'left' }}><Caps size={8.5}>{h}</Caps></th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr key={customer.id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }} data-testid={`customer-row-${customer.id}`}>
                    <td style={tdCell}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: T.headline, fontWeight: 600, fontSize: 12.5, color: T.iron900 }}>{customer.first_name} {customer.last_name}</span>
                        <CustomerHistoryBadge phone={customer.phone} variant="badge" />
                      </div>
                    </td>
                    <td style={{ ...tdCell, maxWidth: 220 }}>
                      <span style={{ fontSize: 12, color: T.iron700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block', maxWidth: 210 }}>{customer.email}</span>
                    </td>
                    <td style={tdCell}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ ...mono, fontSize: 11.5, color: T.iron700 }}>{customer.phone}</span>
                        {customer.phone && (
                          <ClickToCallButton
                            phone={customer.phone}
                            customerName={`${customer.first_name} ${customer.last_name}`}
                            showLabel={false}
                            size="sm"
                          />
                        )}
                      </div>
                    </td>
                    <td style={tdCell}>
                      <span style={{ ...mono, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: T.green, fontWeight: 700 }}>
                        <Shield size={13} />
                        {customer.warranties?.length || 0}
                      </span>
                    </td>
                    <td style={tdCell}>
                      <span style={{ ...mono, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: T.blue, fontWeight: 700 }}>
                        <Ticket size={13} />
                        {customer.tickets?.length || 0}
                      </span>
                    </td>
                    <td style={tdCell}>
                      <span style={{ ...mono, fontSize: 11, color: T.iron500 }}>
                        {customer.created_at ? new Date(customer.created_at).toLocaleDateString('en-IN') : '-'}
                      </span>
                    </td>
                    <td style={{ ...tdCell, textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <button
                          onClick={() => viewCustomerDetails(customer)}
                          title="View"
                          style={{ ...iconBtn, borderColor: T.orange, color: T.orangeDeep }}
                          data-testid={`view-customer-${customer.id}`}
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          onClick={() => openEditDialog(customer)}
                          title="Edit"
                          style={{ ...iconBtn, color: T.iron700 }}
                          data-testid={`edit-customer-${customer.id}`}
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          onClick={() => openDeleteDialog(customer)}
                          title="Delete"
                          style={{ ...iconBtn, color: T.rose }}
                          data-testid={`delete-customer-${customer.id}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 16px', borderTop: `1px solid ${T.iron200}`, background: T.iron50 }}>
            <Caps size={9} color={T.iron400}>Page {currentPage} of {totalPages}</Caps>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <button
                onClick={() => handlePageChange(1)}
                disabled={currentPage === 1}
                style={{ ...outlineBtn, padding: '6px 10px', opacity: currentPage === 1 ? 0.4 : 1, cursor: currentPage === 1 ? 'default' : 'pointer' }}
              >
                First
              </button>
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                style={{ border: 'none', background: 'transparent', cursor: currentPage === 1 ? 'default' : 'pointer', opacity: currentPage === 1 ? 0.3 : 1, color: T.iron700, display: 'grid', placeItems: 'center', padding: 4 }}
              >
                <ChevronLeft size={16} />
              </button>

              {getPaginationRange().map((page) => (
                <button
                  key={page}
                  onClick={() => handlePageChange(page)}
                  style={{ width: 30, height: 30, borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 12, background: page === currentPage ? T.iron900 : 'transparent', color: page === currentPage ? '#fff' : T.iron500 }}
                >
                  {page}
                </button>
              ))}

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                style={{ border: 'none', background: 'transparent', cursor: currentPage === totalPages ? 'default' : 'pointer', opacity: currentPage === totalPages ? 0.3 : 1, color: T.iron700, display: 'grid', placeItems: 'center', padding: 4 }}
              >
                <ChevronRight size={16} />
              </button>
              <button
                onClick={() => handlePageChange(totalPages)}
                disabled={currentPage === totalPages}
                style={{ ...outlineBtn, padding: '6px 10px', opacity: currentPage === totalPages ? 0.4 : 1, cursor: currentPage === totalPages ? 'default' : 'pointer' }}
              >
                Last
              </button>
            </div>
          </div>
        )}
      </IronCard>

      {/* Customer Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">Customer Details</DialogTitle>
          </DialogHeader>

          {selectedCustomer && (
            <div className="space-y-6">
              <CustomerHistoryBadge phone={selectedCustomer.phone} />
              {/* Basic Info */}
              <div className="rounded-lg border p-4">
                <h3 className="font-medium mb-3" style={{ color: T.orangeDeep }}>Contact Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Name</p>
                    <p className="font-medium">{selectedCustomer.first_name} {selectedCustomer.last_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">{selectedCustomer.email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <div className="flex items-center gap-2">
                      <p className="font-mono">{selectedCustomer.phone}</p>
                      {selectedCustomer.phone && (
                        <ClickToCallButton
                          phone={selectedCustomer.phone}
                          customerName={`${selectedCustomer.first_name} ${selectedCustomer.last_name}`}
                          showLabel={true}
                          size="sm"
                        />
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Member Since</p>
                    <p className="font-medium">{selectedCustomer.created_at ? fmtDateTime(selectedCustomer.created_at) : '-'}</p>
                  </div>
                  {selectedCustomer.address && (
                    <div className="col-span-2">
                      <p className="text-sm text-muted-foreground">Address</p>
                      <p className="font-medium">
                        {selectedCustomer.address}
                        {selectedCustomer.city && `, ${selectedCustomer.city}`}
                        {selectedCustomer.state && `, ${selectedCustomer.state}`}
                        {selectedCustomer.pincode && ` - ${selectedCustomer.pincode}`}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Warranties */}
              <div>
                <h3 className="font-medium mb-3 flex items-center gap-2">
                  <Shield className="w-4 h-4" style={{ color: T.green }} />
                  Warranties ({selectedCustomer.warranties?.length || 0})
                </h3>
                {selectedCustomer.warranties?.length > 0 ? (
                  <div className="space-y-2">
                    {selectedCustomer.warranties.map((w) => (
                      <div key={w.id} className="flex items-center justify-between p-3 rounded-lg border">
                        <div>
                          <p className="font-medium">{w.device_type}</p>
                          <p className="text-sm text-muted-foreground">
                            {w.warranty_end_date ? `Expires: ${new Date(w.warranty_end_date).toLocaleDateString('en-IN')}` : 'Pending'}
                          </p>
                        </div>
                        <StatusBadge status={w.status} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">No warranties registered</p>
                )}
              </div>

              {/* Tickets */}
              <div>
                <h3 className="font-medium mb-3 flex items-center gap-2">
                  <Ticket className="w-4 h-4" style={{ color: T.blue }} />
                  Tickets ({selectedCustomer.tickets?.length || 0})
                </h3>
                {selectedCustomer.tickets?.length > 0 ? (
                  <div className="space-y-2">
                    {selectedCustomer.tickets.map((t) => (
                      <div key={t.id} className="flex items-center justify-between p-3 rounded-lg border">
                        <div>
                          <p className="font-mono text-sm font-medium">{t.ticket_number}</p>
                          <p className="text-sm text-muted-foreground">{t.device_type}</p>
                        </div>
                        <StatusBadge status={t.status} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">No tickets created</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Customer Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Customer</DialogTitle>
          </DialogHeader>
          <CustomerForm onSubmit={handleCreateCustomer} submitLabel="Create Customer" />
        </DialogContent>
      </Dialog>

      {/* Edit Customer Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Customer</DialogTitle>
          </DialogHeader>
          <CustomerForm onSubmit={handleUpdateCustomer} submitLabel="Save Changes" />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Customer?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedCustomer?.first_name} {selectedCustomer?.last_name}?
              <br /><br />
              <span style={{ color: T.voltageText }}>
                Note: Customers with existing tickets, warranties, or orders cannot be deleted.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCustomer}
              className="bg-red-600 hover:bg-red-700"
              disabled={formLoading}
              data-testid="confirm-delete-btn"
            >
              {formLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </IronShell>
  );
}
