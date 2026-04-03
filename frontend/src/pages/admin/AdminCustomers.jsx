import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import StatusBadge from '@/components/ui/StatusBadge';
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

const STORAGE_KEY = 'admin_customers_filters';

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
    e.preventDefault();
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

  return (
    <DashboardLayout title="Customer CRM">
      {/* Search */}
      <Card className="mb-6 bg-slate-800 border-slate-700">
        <CardContent className="pt-6">
          <form onSubmit={handleSearch} className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search by name, email, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-slate-900 border-slate-700 text-white"
                data-testid="customer-search-input"
              />
            </div>
            <Button type="submit" className="bg-cyan-600 hover:bg-cyan-700" data-testid="search-btn">
              Search
            </Button>
            <Button 
              type="button" 
              variant="outline" 
              className="border-slate-600 text-slate-300"
              onClick={() => { 
                setSearchQuery(''); 
                sessionStorage.setItem(STORAGE_KEY, '');
                setCurrentPage(1);
                fetchCustomers(''); 
              }}
            >
              Clear
            </Button>
            <Button 
              type="button" 
              onClick={openCreateDialog}
              className="bg-green-600 hover:bg-green-700"
              data-testid="add-customer-btn"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Customer
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Customers Table */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader className="border-b border-slate-700">
          <div className="flex items-center justify-between">
            <CardTitle className="font-['Barlow_Condensed'] flex items-center gap-2 text-white">
              <Users className="w-5 h-5 text-cyan-400" />
              All Customers ({totalCount})
            </CardTitle>
            <div className="text-sm text-slate-400">
              Showing {customers.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} - {Math.min(currentPage * pageSize, totalCount)} of {totalCount}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
            </div>
          ) : customers.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Users className="w-12 h-12 mx-auto mb-3 text-slate-600" />
              <p>No customers found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-slate-700 hover:bg-transparent">
                  <TableHead className="text-slate-400">Name</TableHead>
                  <TableHead className="text-slate-400">Email</TableHead>
                  <TableHead className="text-slate-400">Phone</TableHead>
                  <TableHead className="text-slate-400">Warranties</TableHead>
                  <TableHead className="text-slate-400">Tickets</TableHead>
                  <TableHead className="text-slate-400">Joined</TableHead>
                  <TableHead className="text-right text-slate-400">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((customer) => (
                  <TableRow key={customer.id} className="border-slate-700 hover:bg-slate-700/30" data-testid={`customer-row-${customer.id}`}>
                    <TableCell className="font-medium text-white">
                      {customer.first_name} {customer.last_name}
                    </TableCell>
                    <TableCell className="text-slate-300">{customer.email}</TableCell>
                    <TableCell className="font-mono text-sm text-slate-300">{customer.phone}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-green-400">
                        <Shield className="w-4 h-4" />
                        {customer.warranties?.length || 0}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-cyan-400">
                        <Ticket className="w-4 h-4" />
                        {customer.tickets?.length || 0}
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-400 text-sm">
                      {new Date(customer.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => viewCustomerDetails(customer)}
                          className="text-cyan-400 hover:text-cyan-300 hover:bg-slate-700"
                          data-testid={`view-customer-${customer.id}`}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(customer)}
                          className="text-yellow-400 hover:text-yellow-300 hover:bg-slate-700"
                          data-testid={`edit-customer-${customer.id}`}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openDeleteDialog(customer)}
                          className="text-red-400 hover:text-red-300 hover:bg-slate-700"
                          data-testid={`delete-customer-${customer.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t border-slate-700">
              <div className="text-sm text-slate-400">
                Page {currentPage} of {totalPages}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(1)}
                  disabled={currentPage === 1}
                  className="border-slate-600 text-slate-300 disabled:opacity-50"
                >
                  First
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="border-slate-600 text-slate-300 disabled:opacity-50"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                
                {getPaginationRange().map((page) => (
                  <Button
                    key={page}
                    variant={page === currentPage ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePageChange(page)}
                    className={page === currentPage 
                      ? "bg-cyan-600 text-white" 
                      : "border-slate-600 text-slate-300"
                    }
                  >
                    {page}
                  </Button>
                ))}
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="border-slate-600 text-slate-300 disabled:opacity-50"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(totalPages)}
                  disabled={currentPage === totalPages}
                  className="border-slate-600 text-slate-300 disabled:opacity-50"
                >
                  Last
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Customer Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-slate-800 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle className="font-['Barlow_Condensed'] text-xl text-white">
              Customer Details
            </DialogTitle>
          </DialogHeader>
          
          {selectedCustomer && (
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="bg-slate-900 p-4 rounded-lg">
                <h3 className="font-medium mb-3 text-cyan-400">Contact Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-400">Name</p>
                    <p className="font-medium text-white">{selectedCustomer.first_name} {selectedCustomer.last_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Email</p>
                    <p className="font-medium text-white">{selectedCustomer.email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Phone</p>
                    <p className="font-mono text-white">{selectedCustomer.phone}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Member Since</p>
                    <p className="font-medium text-white">{new Date(selectedCustomer.created_at).toLocaleDateString()}</p>
                  </div>
                  {selectedCustomer.address && (
                    <div className="col-span-2">
                      <p className="text-sm text-slate-400">Address</p>
                      <p className="font-medium text-white">
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
                <h3 className="font-medium mb-3 flex items-center gap-2 text-white">
                  <Shield className="w-4 h-4 text-green-400" />
                  Warranties ({selectedCustomer.warranties?.length || 0})
                </h3>
                {selectedCustomer.warranties?.length > 0 ? (
                  <div className="space-y-2">
                    {selectedCustomer.warranties.map((w) => (
                      <div key={w.id} className="flex items-center justify-between p-3 bg-green-900/20 rounded-lg border border-green-700/30">
                        <div>
                          <p className="font-medium text-white">{w.device_type}</p>
                          <p className="text-sm text-slate-400">
                            {w.warranty_end_date ? `Expires: ${new Date(w.warranty_end_date).toLocaleDateString()}` : 'Pending'}
                          </p>
                        </div>
                        <StatusBadge status={w.status} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-500 text-sm">No warranties registered</p>
                )}
              </div>

              {/* Tickets */}
              <div>
                <h3 className="font-medium mb-3 flex items-center gap-2 text-white">
                  <Ticket className="w-4 h-4 text-cyan-400" />
                  Tickets ({selectedCustomer.tickets?.length || 0})
                </h3>
                {selectedCustomer.tickets?.length > 0 ? (
                  <div className="space-y-2">
                    {selectedCustomer.tickets.map((t) => (
                      <div key={t.id} className="flex items-center justify-between p-3 bg-cyan-900/20 rounded-lg border border-cyan-700/30">
                        <div>
                          <p className="font-mono text-sm font-medium text-white">{t.ticket_number}</p>
                          <p className="text-sm text-slate-400">{t.device_type}</p>
                        </div>
                        <StatusBadge status={t.status} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-500 text-sm">No tickets created</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Customer Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md bg-slate-800 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Add New Customer</DialogTitle>
          </DialogHeader>
          <CustomerForm onSubmit={handleCreateCustomer} submitLabel="Create Customer" />
        </DialogContent>
      </Dialog>

      {/* Edit Customer Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md bg-slate-800 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Edit Customer</DialogTitle>
          </DialogHeader>
          <CustomerForm onSubmit={handleUpdateCustomer} submitLabel="Save Changes" />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="bg-slate-800 border-slate-700 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete Customer?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Are you sure you want to delete {selectedCustomer?.first_name} {selectedCustomer?.last_name}?
              <br /><br />
              <span className="text-yellow-500">
                Note: Customers with existing tickets, warranties, or orders cannot be deleted.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-700 text-white border-slate-600 hover:bg-slate-600">Cancel</AlertDialogCancel>
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
    </DashboardLayout>
  );
}
