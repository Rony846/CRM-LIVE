import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { toast } from 'sonner';
import { Loader2, AlertTriangle } from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono } from '@/components/iron/IronKit';

/* Battery Production — Iron Console conversion of AdminSupervisorProduction.
   Preserves the single GET /admin/supervisor-production report + every derived stat,
   the serial breakdown, team payments, overpaid caveat and the by-model bars. */

const inr = (n) => (n < 0 ? '−₹' : '₹') + Math.abs(Number(n || 0)).toLocaleString('en-IN');

const Tile = ({ label, value, accent = T.iron900, sub, ring }) => (
  <IronCard pad="13px 14px" style={ring ? { boxShadow: `0 1px 2px rgba(15,15,15,.06), 0 0 0 1px ${ring}` } : undefined}>
    <Caps size={8.5} color={T.iron400}>{label}</Caps>
    <div style={{ ...mono, fontWeight: 700, fontSize: 26, color: accent, marginTop: 6, lineHeight: 1.1 }}>{value}</div>
    {sub && <div style={{ marginTop: 4 }}><Caps size={8.5} color={T.iron500} ls=".05em">{sub}</Caps></div>}
  </IronCard>
);

export default function AdminSupervisorProduction() {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/admin/supervisor-production`, { headers: { Authorization: `Bearer ${token}` } });
      setData(res.data);
    } catch { toast.error('Failed to load report'); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const overpaid = (data?.outstanding ?? 0) < 0;
  const maxSku = data?.by_sku?.[0]?.batteries || 1;

  const breakdown = data ? [
    ['New (tagged)', data.new_tagged, T.green],
    ['Untagged (built, no condition)', data.untagged, T.green],
    ['Repaired — excluded', data.repaired_excluded, T.orangeDeep],
    ['In refunded orders — excluded', data.refunded, T.orangeDeep],
  ] : [];

  return (
    <IronShell
      title="Battery Production"
      subtitle="SERIAL MASTER · ANGAD & AJEET"
      onRefresh={fetchReport}
    >
      {loading || !data ? (
        <div style={{ display: 'grid', placeItems: 'center', height: 300 }}>
          <Loader2 className="animate-spin" size={30} color={T.iron400} />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: 12.5, color: T.iron500 }}>
            Anchored on the finished-goods serial master · Angad &amp; Ajeet
          </div>

          {/* Headline stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12 }}>
            <Tile label="Built" value={Number(data.total_batteries).toLocaleString('en-IN')} accent={T.iron900} sub="serialized batteries" />
            <Tile label="Payable" value={Number(data.payable_batteries).toLocaleString('en-IN')} accent={T.green} sub="new + untagged" />
            <Tile label="Owed" value={inr(data.owed)} accent={T.iron700} sub={`${data.rate_2000} ×₹2k + ${data.rate_1500} ×₹1.5k`} />
            <Tile label="Paid (bank)" value={inr(data.paid_bank)} accent={T.green} sub="Angad + Ajeet" />
            <Tile
              label={overpaid ? 'Overpaid' : 'Outstanding'}
              value={inr(Math.abs(data.outstanding))}
              accent={overpaid ? T.blue : T.voltageText}
              sub="owed − paid"
              ring={overpaid ? T.blue : T.voltage}
            />
          </div>

          {/* Composition */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <IronCard pad={0}>
              <div style={{ padding: '13px 16px' }}><Caps size={11} color={T.iron900} ls=".1em">Serial Breakdown</Caps></div>
              <div style={{ padding: '0 16px 14px' }}>
                {breakdown.map(([label, val, color]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${T.iron200}`, padding: '8px 0' }}>
                    <span style={{ fontSize: 12.5, color: T.iron700 }}>{label}</span>
                    <span style={{ ...mono, fontWeight: 700, fontSize: 13, color }}>{Number(val || 0).toLocaleString('en-IN')}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8 }}>
                  <span style={{ fontSize: 12.5, color: T.iron500 }}>Pay rates</span>
                  <span style={{ ...mono, fontSize: 12, color: T.iron900 }}>
                    {data.rate_2000} @ ₹2,000 · {data.rate_1500} @ ₹1,500{data.norate ? ` · ${data.norate} no-rate` : ''}
                  </span>
                </div>
              </div>
            </IronCard>

            {/* Team payments */}
            <IronCard pad={0}>
              <div style={{ padding: '13px 16px 4px' }}>
                <Caps size={11} color={T.iron900} ls=".1em">Paid to Battery Team (Bank)</Caps>
                <div style={{ marginTop: 4 }}><Caps size={8.5} color={T.iron400} ls=".04em">From raw bank-statement narrations · mostly the Electronics Bay account</Caps></div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: '10px 16px 16px' }}>
                {(data.team_payments || []).map((t) => (
                  <div key={t.name} style={{ flex: 1, minWidth: 150, background: T.iron50, border: `1px solid ${T.iron200}`, borderRadius: 8, padding: 12 }}>
                    <div style={{ fontSize: 12.5, color: T.iron700, fontWeight: 600 }}>{t.name}</div>
                    <div style={{ ...mono, fontWeight: 700, fontSize: 22, color: T.green, marginTop: 4 }}>{inr(t.paid)}</div>
                    <div style={{ ...mono, fontSize: 10.5, color: T.iron400, marginTop: 4 }}>
                      {t.payments} payments · {String(t.first || '').slice(0, 7)} → {String(t.last || '').slice(0, 7)}
                    </div>
                  </div>
                ))}
              </div>
            </IronCard>
          </div>

          {/* Overpaid / caveat */}
          <div style={{ background: T.voltageTint, border: '1px solid #EDDFA6', borderLeft: `4px solid ${T.orange}`, borderRadius: 8, padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <AlertTriangle size={16} color={T.orangeDeep} style={{ marginTop: 1, flexShrink: 0 }} />
            <p style={{ margin: 0, fontSize: 12.5, color: T.iron900, lineHeight: 1.5 }}>
              {overpaid ? (
                <>Paid (<b>{inr(data.paid_bank)}</b>) exceeds the battery-build value (<b>{inr(data.owed)}</b>) by <b>{inr(Math.abs(data.outstanding))}</b>.
                That gap is expected if the pay also covers repairs, advances, or production not yet in the serial master. </>
              ) : null}
              New + untagged serialized batteries; <b>{data.repaired_excluded}</b> repaired &amp; <b>{data.refunded}</b> refunded excluded.
              Rates: ₹2,000 (48/51V) · ₹1,500 (24/25V).
            </p>
          </div>

          {/* By model */}
          <IronCard pad={0}>
            <div style={{ padding: '13px 16px' }}><Caps size={11} color={T.iron900} ls=".1em">By Model</Caps></div>
            <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {data.by_sku.slice(0, 10).map((s) => (
                <div key={s.sku}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 5 }}>
                    <span style={{ fontSize: 12, color: T.iron700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.sku}</span>
                    <span style={{ ...mono, fontWeight: 700, fontSize: 12.5, color: T.iron900 }}>{s.batteries}</span>
                  </div>
                  <div style={{ height: 8, background: T.iron100, borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ height: 8, background: T.orange, borderRadius: 999, width: `${(s.batteries / maxSku) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </IronCard>
        </div>
      )}
    </IronShell>
  );
}
