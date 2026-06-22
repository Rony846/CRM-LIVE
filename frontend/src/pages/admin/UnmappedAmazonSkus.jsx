import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { RefreshCw, AlertTriangle, CheckCircle2, Link2 } from 'lucide-react';

/**
 * Amazon SKUs the browser-agent could not map to a master_sku when creating dispatches.
 * These lines still ship (they fall to the supervisor) but won't deduct stock / book GST until mapped.
 * Fix: add the Amazon SKU as an alias on the matching master SKU (aliases.alias_code) or an
 * amazon_sku_mappings row, then it auto-resolves on the next order.
 */
export default function UnmappedAmazonSkus() {
  const { token } = useAuth();
  const [data, setData] = useState({ count: 0, total_lines: 0, unmapped: [] });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/admin/amazon/unmapped-skus`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setData(res.data || { count: 0, total_lines: 0, unmapped: [] });
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Could not load report');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
              <AlertTriangle className="h-6 w-6 text-amber-500" /> Unmapped Amazon SKUs
            </h1>
            <p className="text-xs md:text-sm text-muted-foreground">
              Amazon SKUs that didn't match a catalogue SKU. They ship, but don't deduct stock or book GST until mapped.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="h-4 w-4 md:mr-1" /> <span className="hidden md:inline">Refresh</span>
          </Button>
        </div>

        {loading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : data.count === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-green-500 opacity-70" />
              All Amazon SKUs are mapped. Nothing to fix. 🎉
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="flex gap-3">
              <Badge variant="secondary" className="text-sm">{data.count} SKU(s) unmapped</Badge>
              <Badge variant="secondary" className="text-sm">{data.total_lines} order line(s) affected</Badge>
            </div>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Link2 className="h-4 w-4" /> To fix: add the Amazon SKU as an alias on the matching master SKU
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-muted-foreground border-b">
                      <tr>
                        <th className="p-3">Amazon SKU</th>
                        <th className="p-3">Product title</th>
                        <th className="p-3 text-right">Times seen</th>
                        <th className="p-3">Sample order</th>
                        <th className="p-3">Last seen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.unmapped.map((u) => (
                        <tr key={u.amazon_sku} className="border-b last:border-0">
                          <td className="p-3 font-mono font-semibold">{u.amazon_sku}</td>
                          <td className="p-3">{u.title || <span className="text-muted-foreground">—</span>}</td>
                          <td className="p-3 text-right">{u.count}</td>
                          <td className="p-3 text-muted-foreground">{u.sample_order || '—'}</td>
                          <td className="p-3 text-muted-foreground">
                            {u.last_seen ? String(u.last_seen).slice(0, 10) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
