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
import { toast } from 'sonner';
import {
  BookOpen, Loader2, Search, Download, ArrowUpRight, ArrowDownRight,
  Calendar, IndianRupee
} from 'lucide-react';

const ENTRY_TYPE_CONFIG = {
  opening_balance:  { label: 'Opening Balance',  tone: 'bg-muted text-muted-foreground ring-1 ring-border' },
  sales_invoice:    { label: 'Sales Invoice',     tone: 'bg-sky-400/15 text-sky-400 ring-1 ring-sky-400/25' },
  purchase_invoice: { label: 'Purchase',          tone: 'bg-violet-400/15 text-violet-400 ring-1 ring-violet-400/25' },
  payment_received: { label: 'Payment Received',  tone: 'bg-emerald-500/15 text-emerald-500 ring-1 ring-emerald-500/25' },
  payment_made:     { label: 'Payment Made',      tone: 'bg-orange-400/15 text-orange-400 ring-1 ring-orange-400/25' },
  credit_note:      { label: 'Credit Note',       tone: 'bg-rose-500/15 text-rose-400 ring-1 ring-rose-500/25' },
  debit_note:       { label: 'Debit Note',        tone: 'bg-amber-400/15 text-amber-400 ring-1 ring-amber-400/25' }
};

const EntryTypeBadge = ({ entryType }) => {
  const cfg = ENTRY_TYPE_CONFIG[entryType] || { label: entryType, tone: 'bg-muted text-muted-foreground ring-1 ring-border' };
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wide ${cfg.tone}`}>
      {cfg.label}
    </span>
  );
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

    const headerRow = ['Date', 'Entry Number', 'Type', 'Narration', 'Debit', 'Credit', 'Balance'];
    const rows = ledgerData.entries.map(e => [
      new Date(e.created_at).toLocaleDateString(),
      e.entry_number,
      ENTRY_TYPE_CONFIG[e.entry_type]?.label || e.entry_type,
      e.narration,
      e.debit || 0,
      e.credit || 0,
      e.running_balance
    ]);

    const csv = [headerRow, ...rows].map(row => row.join(',')).join('\n');
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
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Party Ledger">
      <div className="space-y-6">
        {/* Filters */}
        <Card className="mg-card border border-border bg-card">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="md:col-span-2">
                <Label className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Select Party</Label>
                <div className="relative mt-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="Search parties..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 mb-2"
                  />
                </div>
                <Select value={selectedPartyId} onValueChange={handlePartyChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a party" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {filteredParties.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} {p.gstin ? `(${p.gstin})` : p.phone ? `(${p.phone})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">From Date</Label>
                <Input
                  type="date"
                  value={dateRange.from}
                  onChange={(e) => setDateRange({...dateRange, from: e.target.value})}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">To Date</Label>
                <Input
                  type="date"
                  value={dateRange.to}
                  onChange={(e) => setDateRange({...dateRange, to: e.target.value})}
                  className="mt-1"
                />
              </div>
              <div className="flex items-end gap-2">
                <Button onClick={handleDateFilter} className="bg-primary text-primary-foreground hover:bg-primary/90">
                  Apply Filter
                </Button>
                {ledgerData && (
                  <Button variant="outline" onClick={exportCSV} className="border-border text-muted-foreground hover:text-foreground">
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
            <div className="mg-card rounded-lg border border-border bg-card p-4">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Party Name</p>
              <p className="font-medium text-foreground text-lg mt-1">{ledgerData.party.name}</p>
              <div className="flex flex-wrap gap-1 mt-2">
                {ledgerData.party.party_types?.map(type => (
                  <span key={type} className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wide bg-muted text-muted-foreground ring-1 ring-border">
                    {type}
                  </span>
                ))}
              </div>
            </div>
            <div className="mg-card rounded-lg border border-border bg-card p-4">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Total Debit</p>
              <p className="font-mono text-2xl font-bold tabular-nums text-emerald-500 mt-1 flex items-center gap-1">
                <ArrowUpRight className="w-5 h-5" />
                ₹{ledgerData.total_debit?.toLocaleString()}
              </p>
            </div>
            <div className="mg-card rounded-lg border border-border bg-card p-4">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Total Credit</p>
              <p className="font-mono text-2xl font-bold tabular-nums text-rose-400 mt-1 flex items-center gap-1">
                <ArrowDownRight className="w-5 h-5" />
                ₹{ledgerData.total_credit?.toLocaleString()}
              </p>
            </div>
            <div className="mg-card rounded-lg border border-border bg-card p-4">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Current Balance</p>
              <p className={`font-mono text-2xl font-bold tabular-nums mt-1 ${
                ledgerData.current_balance > 0 ? 'text-emerald-500' :
                ledgerData.current_balance < 0 ? 'text-rose-400' : 'text-muted-foreground'
              }`}>
                ₹{Math.abs(ledgerData.current_balance || 0).toLocaleString()}
                <span className="text-sm ml-1 font-normal">
                  {ledgerData.current_balance > 0 ? 'DR' : ledgerData.current_balance < 0 ? 'CR' : ''}
                </span>
              </p>
              <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground mt-1">
                {ledgerData.current_balance > 0 ? 'Receivable' : ledgerData.current_balance < 0 ? 'Payable' : 'Settled'}
              </p>
            </div>
          </div>
        )}

        {/* Ledger Entries */}
        {ledgerData ? (
          <Card className="mg-card border border-border bg-card">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2 font-mono text-sm uppercase tracking-wide">
                <BookOpen className="w-4 h-4 text-muted-foreground" />
                Ledger Entries ({ledgerData.entries?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {ledgerData.entries?.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p className="font-mono text-[11px] uppercase tracking-wide">No ledger entries found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Date</TableHead>
                        <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Entry #</TableHead>
                        <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Type</TableHead>
                        <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">Narration</TableHead>
                        <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground text-right">Debit</TableHead>
                        <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground text-right">Credit</TableHead>
                        <TableHead className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground text-right">Balance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ledgerData.entries.map((entry) => (
                        <TableRow key={entry.id} className="border-border hover:bg-muted/30">
                          <TableCell className="font-mono text-sm tabular-nums text-muted-foreground">
                            {new Date(entry.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="font-mono tabular-nums text-sky-400 text-sm">
                            {entry.entry_number}
                          </TableCell>
                          <TableCell>
                            <EntryTypeBadge entryType={entry.entry_type} />
                          </TableCell>
                          <TableCell className="text-foreground max-w-xs truncate">
                            {entry.narration}
                          </TableCell>
                          <TableCell className="font-mono tabular-nums text-emerald-500 text-right">
                            {entry.debit > 0 ? `₹${entry.debit.toLocaleString()}` : '-'}
                          </TableCell>
                          <TableCell className="font-mono tabular-nums text-rose-400 text-right">
                            {entry.credit > 0 ? `₹${entry.credit.toLocaleString()}` : '-'}
                          </TableCell>
                          <TableCell className={`font-mono tabular-nums text-right font-bold bg-muted/40 ${
                            entry.running_balance > 0 ? 'text-emerald-500' :
                            entry.running_balance < 0 ? 'text-rose-400' : 'text-muted-foreground'
                          }`}>
                            ₹{Math.abs(entry.running_balance).toLocaleString()}
                            <span className="text-xs ml-1 font-normal">
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
          <Card className="mg-card border border-border bg-card">
            <CardContent className="py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded bg-muted mx-auto mb-4">
                <BookOpen className="w-8 h-8 text-muted-foreground opacity-50" />
              </div>
              <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                Select a party to view their ledger
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
