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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  BookOpen, Loader2, Search, Download, ArrowUpRight, ArrowDownRight,
  Calendar, IndianRupee
} from 'lucide-react';

const ENTRY_TYPE_CONFIG = {
  opening_balance: { label: 'Opening Balance', color: 'bg-slate-600' },
  sales_invoice: { label: 'Sales Invoice', color: 'bg-blue-600' },
  purchase_invoice: { label: 'Purchase', color: 'bg-purple-600' },
  payment_received: { label: 'Payment Received', color: 'bg-green-600' },
  payment_made: { label: 'Payment Made', color: 'bg-orange-600' },
  credit_note: { label: 'Credit Note', color: 'bg-red-600' },
  debit_note: { label: 'Debit Note', color: 'bg-yellow-600' }
};

export default function PartyLedger() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [parties, setParties] = useState([]);
  const [selectedPartyId, setSelectedPartyId] = useState('');
  const [ledgerData, setLedgerData] = useState(null);
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchParties();
  }, [token]);

  const fetchParties = async () => {
    try {
      const res = await axios.get(`${API}/parties`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setParties(res.data || []);
    } catch (error) {
      toast.error('Failed to load parties');
    } finally {
      setLoading(false);
    }
  };

  const fetchLedger = async (partyId) => {
    if (!partyId) return;
    
    setLoading(true);
    try {
      const params = {};
      if (dateRange.from) params.from_date = dateRange.from;
      if (dateRange.to) params.to_date = dateRange.to;
      
      const res = await axios.get(`${API}/party-ledger/${partyId}`, {
        headers: { Authorization: `Bearer ${token}` },
        params
      });
      setLedgerData(res.data);
    } catch (error) {
      toast.error('Failed to load ledger');
    } finally {
      setLoading(false);
    }
  };

  const handlePartyChange = (partyId) => {
    setSelectedPartyId(partyId);
    fetchLedger(partyId);
  };

  const handleDateFilter = () => {
    if (selectedPartyId) {
      fetchLedger(selectedPartyId);
    }
  };

  const filteredParties = parties.filter(p => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return p.name?.toLowerCase().includes(search) || 
           p.phone?.includes(search) ||
           p.gstin?.toLowerCase().includes(search);
  });

  const exportCSV = () => {
    if (!ledgerData?.entries?.length) {
      toast.error('No data to export');
      return;
    }

    const headers = ['Date', 'Entry Number', 'Type', 'Narration', 'Debit', 'Credit', 'Balance'];
    const rows = ledgerData.entries.map(e => [
      new Date(e.created_at).toLocaleDateString(),
      e.entry_number,
      ENTRY_TYPE_CONFIG[e.entry_type]?.label || e.entry_type,
      e.narration,
      e.debit || 0,
      e.credit || 0,
      e.running_balance
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ledger_${ledgerData.party.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    toast.success('Ledger exported successfully');
  };

  if (loading && !ledgerData) {
    return (
      <DashboardLayout title="Party Ledger">
        <div className="flex justify-center items-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Party Ledger">
      <div className="space-y-6">
        {/* Filters */}
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="md:col-span-2">
                <Label className="text-slate-300">Select Party</Label>
                <div className="relative mt-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <Input
                    placeholder="Search parties..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-slate-700 border-slate-600 text-white mb-2"
                  />
                </div>
                <Select value={selectedPartyId} onValueChange={handlePartyChange}>
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                    <SelectValue placeholder="Select a party" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-700 border-slate-600 max-h-60">
                    {filteredParties.map(p => (
                      <SelectItem key={p.id} value={p.id} className="text-white">
                        {p.name} {p.gstin ? `(${p.gstin})` : p.phone ? `(${p.phone})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-slate-300">From Date</Label>
                <Input
                  type="date"
                  value={dateRange.from}
                  onChange={(e) => setDateRange({...dateRange, from: e.target.value})}
                  className="bg-slate-700 border-slate-600 text-white mt-1"
                />
              </div>
              <div>
                <Label className="text-slate-300">To Date</Label>
                <Input
                  type="date"
                  value={dateRange.to}
                  onChange={(e) => setDateRange({...dateRange, to: e.target.value})}
                  className="bg-slate-700 border-slate-600 text-white mt-1"
                />
              </div>
              <div className="flex items-end gap-2">
                <Button onClick={handleDateFilter} className="bg-cyan-600 hover:bg-cyan-700">
                  Apply Filter
                </Button>
                {ledgerData && (
                  <Button variant="outline" onClick={exportCSV} className="border-slate-600">
                    <Download className="w-4 h-4 mr-1" />
                    Export
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Party Summary */}
        {ledgerData && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-4">
                <p className="text-slate-400 text-sm">Party Name</p>
                <p className="text-white text-lg font-medium">{ledgerData.party.name}</p>
                <div className="flex gap-1 mt-1">
                  {ledgerData.party.party_types?.map(type => (
                    <Badge key={type} className="text-xs bg-slate-600">{type}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-4">
                <p className="text-slate-400 text-sm">Total Debit</p>
                <p className="text-green-400 text-2xl font-bold flex items-center">
                  <ArrowUpRight className="w-5 h-5 mr-1" />
                  ₹{ledgerData.total_debit?.toLocaleString()}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-4">
                <p className="text-slate-400 text-sm">Total Credit</p>
                <p className="text-red-400 text-2xl font-bold flex items-center">
                  <ArrowDownRight className="w-5 h-5 mr-1" />
                  ₹{ledgerData.total_credit?.toLocaleString()}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-4">
                <p className="text-slate-400 text-sm">Current Balance</p>
                <p className={`text-2xl font-bold ${
                  ledgerData.current_balance > 0 ? 'text-green-400' : 
                  ledgerData.current_balance < 0 ? 'text-red-400' : 'text-slate-400'
                }`}>
                  ₹{Math.abs(ledgerData.current_balance || 0).toLocaleString()}
                  <span className="text-sm ml-1">
                    {ledgerData.current_balance > 0 ? 'DR' : ledgerData.current_balance < 0 ? 'CR' : ''}
                  </span>
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {ledgerData.current_balance > 0 ? 'Receivable' : ledgerData.current_balance < 0 ? 'Payable' : 'Settled'}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Ledger Entries */}
        {ledgerData ? (
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center">
                <BookOpen className="w-5 h-5 mr-2" />
                Ledger Entries ({ledgerData.entries?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {ledgerData.entries?.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No ledger entries found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-700">
                        <TableHead className="text-slate-300">Date</TableHead>
                        <TableHead className="text-slate-300">Entry #</TableHead>
                        <TableHead className="text-slate-300">Type</TableHead>
                        <TableHead className="text-slate-300">Narration</TableHead>
                        <TableHead className="text-slate-300 text-right">Debit</TableHead>
                        <TableHead className="text-slate-300 text-right">Credit</TableHead>
                        <TableHead className="text-slate-300 text-right">Balance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ledgerData.entries.map((entry) => (
                        <TableRow key={entry.id} className="border-slate-700">
                          <TableCell className="text-slate-300">
                            {new Date(entry.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-cyan-400 font-mono text-sm">
                            {entry.entry_number}
                          </TableCell>
                          <TableCell>
                            <Badge className={ENTRY_TYPE_CONFIG[entry.entry_type]?.color || 'bg-slate-600'}>
                              {ENTRY_TYPE_CONFIG[entry.entry_type]?.label || entry.entry_type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-white max-w-xs truncate">
                            {entry.narration}
                          </TableCell>
                          <TableCell className="text-green-400 text-right font-medium">
                            {entry.debit > 0 ? `₹${entry.debit.toLocaleString()}` : '-'}
                          </TableCell>
                          <TableCell className="text-red-400 text-right font-medium">
                            {entry.credit > 0 ? `₹${entry.credit.toLocaleString()}` : '-'}
                          </TableCell>
                          <TableCell className={`text-right font-bold ${
                            entry.running_balance > 0 ? 'text-green-400' : 
                            entry.running_balance < 0 ? 'text-red-400' : 'text-slate-400'
                          }`}>
                            ₹{Math.abs(entry.running_balance).toLocaleString()}
                            <span className="text-xs ml-1">
                              {entry.running_balance > 0 ? 'DR' : entry.running_balance < 0 ? 'CR' : ''}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="py-12 text-center">
              <BookOpen className="w-16 h-16 mx-auto mb-4 text-slate-600" />
              <p className="text-slate-400 text-lg">Select a party to view their ledger</p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
