import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import StatusBadge from '@/components/ui/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle 
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Users, Search, Eye, Loader2, Shield, Ticket } from 'lucide-react';

export default function AdminCustomers() {
  const { token } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    fetchCustomers();
  }, [token]);

  const fetchCustomers = async (search = '') => {
    setLoading(true);
    try {
      const params = search ? `?search=${encodeURIComponent(search)}` : '';
      const response = await axios.get(`${API}/admin/customers${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCustomers(response.data);
    } catch (error) {
      toast.error('Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchCustomers(searchQuery);
  };

  const viewCustomerDetails = (customer) => {
    setSelectedCustomer(customer);
    setDetailsOpen(true);
  };

  return (
    <DashboardLayout title="Customer CRM">
      {/* Search */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <form onSubmit={handleSearch} className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search by name, email, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="customer-search-input"
              />
            </div>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700" data-testid="search-btn">
              Search
            </Button>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => { setSearchQuery(''); fetchCustomers(); }}
            >
              Clear
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Customers Table */}
      <Card>
        <CardHeader>
          <CardTitle className="font-['Barlow_Condensed'] flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            All Customers ({customers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : customers.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Users className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p>No customers found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Warranties</TableHead>
                  <TableHead>Tickets</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((customer) => (
                  <TableRow key={customer.id} className="data-row">
                    <TableCell className="font-medium">
                      {customer.first_name} {customer.last_name}
                    </TableCell>
                    <TableCell>{customer.email}</TableCell>
                    <TableCell className="font-mono text-sm">{customer.phone}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Shield className="w-4 h-4 text-green-600" />
                        {customer.warranties?.length || 0}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Ticket className="w-4 h-4 text-blue-600" />
                        {customer.tickets?.length || 0}
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-500 text-sm">
                      {new Date(customer.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => viewCustomerDetails(customer)}
                        data-testid={`view-customer-${customer.id}`}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Customer Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-['Barlow_Condensed'] text-xl">
              Customer Details
            </DialogTitle>
          </DialogHeader>
          
          {selectedCustomer && (
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="bg-slate-50 p-4 rounded-lg">
                <h3 className="font-medium mb-3">Contact Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-500">Name</p>
                    <p className="font-medium">{selectedCustomer.first_name} {selectedCustomer.last_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Email</p>
                    <p className="font-medium">{selectedCustomer.email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Phone</p>
                    <p className="font-mono">{selectedCustomer.phone}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Member Since</p>
                    <p className="font-medium">{new Date(selectedCustomer.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>

              {/* Warranties */}
              <div>
                <h3 className="font-medium mb-3 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-green-600" />
                  Warranties ({selectedCustomer.warranties?.length || 0})
                </h3>
                {selectedCustomer.warranties?.length > 0 ? (
                  <div className="space-y-2">
                    {selectedCustomer.warranties.map((w) => (
                      <div key={w.id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-100">
                        <div>
                          <p className="font-medium">{w.device_type}</p>
                          <p className="text-sm text-slate-500">
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
                <h3 className="font-medium mb-3 flex items-center gap-2">
                  <Ticket className="w-4 h-4 text-blue-600" />
                  Tickets ({selectedCustomer.tickets?.length || 0})
                </h3>
                {selectedCustomer.tickets?.length > 0 ? (
                  <div className="space-y-2">
                    {selectedCustomer.tickets.map((t) => (
                      <div key={t.id} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-100">
                        <div>
                          <p className="font-mono text-sm font-medium">{t.ticket_number}</p>
                          <p className="text-sm text-slate-500">{t.device_type}</p>
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
    </DashboardLayout>
  );
}
