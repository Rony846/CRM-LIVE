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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter 
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { 
  Wrench, Loader2, Eye, Search, Package, Clock, CheckCircle,
  AlertTriangle, UserPlus, FileText, User, Phone
} from 'lucide-react';

export default function AdminRepairs() {
  const { token } = useAuth();
  const [repairs, setRepairs] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedRepair, setSelectedRepair] = useState(null);
  const [viewOpen, setViewOpen] = useState(false);

  useEffect(() => {
    fetchRepairs();
  }, [token]);

  const fetchRepairs = async () => {
    try {
      const response = await axios.get(`${API}/admin/all-repairs`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRepairs(response.data.tickets || []);
      setStats(response.data.stats || {});
    } catch (error) {
      toast.error('Failed to load repairs');
    } finally {
      setLoading(false);
    }
  };

  const openViewDialog = (repair) => {
    setSelectedRepair(repair);
    setViewOpen(true);
  };

  const filteredRepairs = repairs.filter(repair => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      repair.ticket_number?.toLowerCase().includes(searchLower) ||
      repair.customer_name?.toLowerCase().includes(searchLower) ||
      repair.customer_phone?.includes(search) ||
      repair.device_type?.toLowerCase().includes(searchLower)
    );
  });

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white">Repair Activities</h1>
          <p className="text-slate-400">Monitor all repair activities across the service center</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-600/20 rounded-lg">
                  <Package className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{stats.total || 0}</p>
                  <p className="text-xs text-slate-400">Total</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-600/20 rounded-lg">
                  <Clock className="w-5 h-5 text-yellow-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{stats.awaiting_repair || 0}</p>
                  <p className="text-xs text-slate-400">Awaiting</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-cyan-600/20 rounded-lg">
                  <Wrench className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{stats.in_repair || 0}</p>
                  <p className="text-xs text-slate-400">In Repair</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-600/20 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{stats.repair_completed || 0}</p>
                  <p className="text-xs text-slate-400">Completed</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-600/20 rounded-lg">
                  <FileText className="w-5 h-5 text-orange-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{stats.awaiting_invoice || 0}</p>
                  <p className="text-xs text-slate-400">Awaiting Invoice</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-600/20 rounded-lg">
                  <Package className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{stats.ready_for_dispatch || 0}</p>
                  <p className="text-xs text-slate-400">Ready to Ship</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-600/20 rounded-lg">
                  <UserPlus className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{stats.walkin_count || 0}</p>
                  <p className="text-xs text-slate-400">Walk-ins</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search by ticket #, customer, phone, device..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 bg-slate-900 border-slate-600"
                data-testid="repairs-search"
              />
            </div>
          </CardContent>
        </Card>

        {/* Repairs Table */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Wrench className="w-5 h-5 text-orange-400" />
              All Repairs ({filteredRepairs.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredRepairs.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <Wrench className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No repairs found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-700">
                      <TableHead className="text-slate-300">Ticket #</TableHead>
                      <TableHead className="text-slate-300">Customer</TableHead>
                      <TableHead className="text-slate-300">Device</TableHead>
                      <TableHead className="text-slate-300">Serial Numbers</TableHead>
                      <TableHead className="text-slate-300">Status</TableHead>
                      <TableHead className="text-slate-300">Received</TableHead>
                      <TableHead className="text-slate-300 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRepairs.map((repair) => (
                      <TableRow key={repair.id} className="border-slate-700 hover:bg-slate-700/50">
                        <TableCell>
                          <span className="font-mono text-cyan-400">{repair.ticket_number}</span>
                          {repair.is_walkin && (
                            <span className="ml-2 px-2 py-0.5 text-xs bg-purple-600 text-white rounded">
                              Walk-in
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <p className="text-white">{repair.customer_name}</p>
                          <p className="text-xs text-slate-500 flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {repair.customer_phone}
                          </p>
                        </TableCell>
                        <TableCell className="text-white">
                          {repair.device_type}
                          {repair.serial_number && (
                            <p className="text-xs text-slate-500">S/N: {repair.serial_number}</p>
                          )}
                        </TableCell>
                        <TableCell>
                          {repair.board_serial_number || repair.device_serial_number ? (
                            <div className="text-sm">
                              {repair.board_serial_number && (
                                <p className="text-slate-300">Board: {repair.board_serial_number}</p>
                              )}
                              {repair.device_serial_number && (
                                <p className="text-slate-300">Device: {repair.device_serial_number}</p>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-500">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={repair.status} />
                        </TableCell>
                        <TableCell className="text-slate-400 text-sm">
                          {repair.received_at ? new Date(repair.received_at).toLocaleDateString('en-IN') : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-slate-600"
                            onClick={() => openViewDialog(repair)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* View Repair Dialog */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="w-5 h-5 text-orange-600" />
              Repair Details - {selectedRepair?.ticket_number}
            </DialogTitle>
          </DialogHeader>
          
          {selectedRepair && (
            <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
              {/* Status Badge */}
              <div className="flex items-center gap-2">
                <StatusBadge status={selectedRepair.status} />
                {selectedRepair.is_walkin && (
                  <span className="px-2 py-1 text-xs bg-purple-600 text-white rounded">Walk-in Customer</span>
                )}
              </div>

              {/* Customer Info */}
              <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-lg space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <User className="w-4 h-4" /> Customer Information
                </h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <p><strong>Name:</strong> {selectedRepair.customer_name}</p>
                  <p><strong>Phone:</strong> {selectedRepair.customer_phone}</p>
                  <p><strong>Email:</strong> {selectedRepair.customer_email || '-'}</p>
                  <p><strong>Address:</strong> {selectedRepair.address || '-'}</p>
                </div>
              </div>

              {/* Device Info */}
              <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-lg space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <Package className="w-4 h-4" /> Device Information
                </h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <p><strong>Device Type:</strong> {selectedRepair.device_type}</p>
                  <p><strong>Serial Number:</strong> {selectedRepair.serial_number || '-'}</p>
                  <p><strong>Board Serial:</strong> {selectedRepair.board_serial_number || '-'}</p>
                  <p><strong>Device Serial:</strong> {selectedRepair.device_serial_number || '-'}</p>
                </div>
              </div>

              {/* Issue & Diagnosis */}
              <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-lg space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <FileText className="w-4 h-4" /> Issue & Diagnosis
                </h4>
                <div className="text-sm space-y-2">
                  <div>
                    <p className="font-medium text-slate-500">Customer Issue:</p>
                    <p>{selectedRepair.issue_description || '-'}</p>
                  </div>
                  {selectedRepair.diagnosis && (
                    <div>
                      <p className="font-medium text-slate-500">Diagnosis:</p>
                      <p>{selectedRepair.diagnosis}</p>
                    </div>
                  )}
                  {selectedRepair.repair_notes && (
                    <div>
                      <p className="font-medium text-slate-500">Repair Notes:</p>
                      <p>{selectedRepair.repair_notes}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Timeline */}
              <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-lg space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <Clock className="w-4 h-4" /> Timeline
                </h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <p><strong>Created:</strong> {selectedRepair.created_at ? new Date(selectedRepair.created_at).toLocaleString() : '-'}</p>
                  <p><strong>Received:</strong> {selectedRepair.received_at ? new Date(selectedRepair.received_at).toLocaleString() : '-'}</p>
                  <p><strong>Repaired:</strong> {selectedRepair.repaired_at ? new Date(selectedRepair.repaired_at).toLocaleString() : '-'}</p>
                  <p><strong>Updated:</strong> {selectedRepair.updated_at ? new Date(selectedRepair.updated_at).toLocaleString() : '-'}</p>
                </div>
              </div>

              {/* Service Charges */}
              {(selectedRepair.service_charges || selectedRepair.service_invoice) && (
                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg space-y-2">
                  <h4 className="font-medium text-green-700 dark:text-green-400">Service Invoice</h4>
                  <div className="text-sm">
                    <p><strong>Charges:</strong> ₹{selectedRepair.service_charges || 0}</p>
                    {selectedRepair.service_invoice && (
                      <p><strong>Invoice:</strong> <a href={selectedRepair.service_invoice} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">View Invoice</a></p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
