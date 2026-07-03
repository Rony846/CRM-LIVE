import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, Link2 } from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell, badgeStyle } from '@/components/iron/IronKit';

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

  const H = ['Amazon SKU', 'Product Title', 'Times Seen', 'Sample Order', 'Last Seen'];

  return (
    <IronShell
      title="Amazon Unmapped"
      subtitle="AMAZON_SKUS · UNRESOLVED"
      onRefresh={load}
    >
      <div style={{ maxWidth: 1040, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <AlertTriangle size={26} strokeWidth={1.75} color={T.orange} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <div style={{ fontFamily: T.headline, fontWeight: 800, fontSize: 20, color: T.iron900 }}>
              Unmapped Amazon SKUs
            </div>
            <div style={{ fontSize: 12.5, color: T.iron500, marginTop: 2, maxWidth: 640 }}>
              Amazon SKUs that didn't match a catalogue SKU. They ship, but don't deduct stock or book GST until mapped.
            </div>
          </div>
        </div>

        {loading ? (
          <IronCard>
            <div style={{ padding: '36px 0', textAlign: 'center', color: T.iron400, fontSize: 13 }}>Loading…</div>
          </IronCard>
        ) : data.count === 0 ? (
          <IronCard>
            <div style={{ padding: '48px 0', textAlign: 'center', color: T.iron500 }}>
              <CheckCircle2 size={40} strokeWidth={1.5} color={T.green} style={{ opacity: 0.75, marginBottom: 8 }} />
              <div style={{ fontSize: 13.5 }}>All Amazon SKUs are mapped. Nothing to fix. 🎉</div>
            </div>
          </IronCard>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <span style={badgeStyle('bad')}>{data.count} SKU(s) unmapped</span>
              <span style={badgeStyle('warn')}>{data.total_lines} order line(s) affected</span>
            </div>

            <IronCard pad={0}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', borderBottom: `1px solid ${T.iron200}` }}>
                <Link2 size={15} strokeWidth={1.75} color={T.iron700} />
                <span style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 13, color: T.iron900 }}>
                  To fix: add the Amazon SKU as an alias on the matching master SKU
                </span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                      {H.map((h, i) => (
                        <th key={h} style={{ ...thCell, textAlign: i === 2 ? 'right' : 'left' }}>
                          <Caps size={8.5}>{h}</Caps>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.unmapped.map((u) => (
                      <tr key={u.amazon_sku} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                        <td style={{ ...tdCell, ...mono, fontWeight: 700, color: T.iron900 }}>{u.amazon_sku}</td>
                        <td style={tdCell}>
                          {u.title || <span style={{ color: T.iron400 }}>—</span>}
                        </td>
                        <td style={{ ...tdCell, ...mono, textAlign: 'right' }}>{u.count}</td>
                        <td style={{ ...tdCell, ...mono, color: T.iron500 }}>{u.sample_order || '—'}</td>
                        <td style={{ ...tdCell, ...mono, color: T.iron500 }}>
                          {u.last_seen ? String(u.last_seen).slice(0, 10) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </IronCard>
          </>
        )}
      </div>
    </IronShell>
  );
}
