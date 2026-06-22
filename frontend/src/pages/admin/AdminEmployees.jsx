import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Loader2, Search, Users } from 'lucide-react';

export default function AdminEmployees() {
  const { token } = useAuth();
  const headers = { Authorization: `Bearer ${token}` };
  const [data, setData] = useState({ employees: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/admin/employees`, { headers, params: { q } });
      setData(res.data);
    } catch { toast.error('Failed to load employees'); }
    finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
  const totalSalary = (data.employees || []).reduce((s, e) => s + (e.salary_received || 0), 0);

  return (
    <div className="p-6 space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-cyan-400" /> Employees
          </h1>
          <p className="text-slate-400 text-sm mt-1">{data.total} employees · imported from the onboarding form</p>
        </div>
        <div className="text-right">
          <div className="text-slate-400 text-xs">Salary paid (bank, attributed)</div>
          <div className="text-2xl font-bold text-emerald-300">{inr(totalSalary)}</div>
        </div>
      </div>

      <Card className="bg-slate-800 border-slate-700 p-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') setQ(search); }}
              placeholder="Search name, phone, account…"
              className="bg-slate-700 border-slate-600 text-white pl-9"
            />
          </div>
        </div>
      </Card>

      <Card className="bg-slate-800 border-slate-700 overflow-x-auto">
        {loading ? (
          <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-cyan-400" /></div>
        ) : data.employees.length === 0 ? (
          <div className="py-16 text-center text-slate-400">No employees.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-slate-700 hover:bg-transparent">
                <TableHead className="text-slate-400">Name</TableHead>
                <TableHead className="text-slate-400">Phone</TableHead>
                <TableHead className="text-slate-400">Joined</TableHead>
                <TableHead className="text-slate-400 text-right">Salary paid (bank)</TableHead>
                <TableHead className="text-slate-400">Account</TableHead>
                <TableHead className="text-slate-400">IFSC</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.employees.map((e) => (
                <TableRow key={e.id} className="border-slate-700">
                  <TableCell className="text-white font-medium">{e.name}</TableCell>
                  <TableCell className="text-slate-300">{e.phone || '—'}</TableCell>
                  <TableCell className="text-slate-400">{e.date_of_joining || '—'}</TableCell>
                  <TableCell className="text-right">
                    {e.salary_received
                      ? <span className="text-emerald-300 font-semibold">{inr(e.salary_received)}<span className="text-slate-500 text-xs"> · {e.salary_payments}p</span></span>
                      : <span className="text-slate-600">—</span>}
                  </TableCell>
                  <TableCell className="text-slate-300 font-mono text-sm">{e.account_number || '—'}</TableCell>
                  <TableCell className="text-slate-400 font-mono text-sm">{e.ifsc || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
