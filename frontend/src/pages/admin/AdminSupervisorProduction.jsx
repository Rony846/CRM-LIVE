import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Loader2, BatteryCharging, IndianRupee, AlertTriangle, Wrench } from 'lucide-react';

const inr = (n) => (n < 0 ? '−₹' : '₹') + Math.abs(Number(n || 0)).toLocaleString('en-IN');

export default function AdminSupervisorProduction() {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get(`${API}/admin/supervisor-production`, { headers: { Authorization: `Bearer ${token}` } });
        setData(res.data);
      } catch { toast.error('Failed to load report'); }
      finally { setLoading(false); }
    })();
  }, [token]);

  if (loading || !data) {
    return <div className="p-6 py-20 flex justify-center"><Loader2 className="w-7 h-7 animate-spin text-emerald-400" /></div>;
  }
  const overpaid = (data.outstanding ?? 0) < 0;
  const maxSku = data.by_sku?.[0]?.batteries || 1;

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <BatteryCharging className="w-6 h-6 text-emerald-400" /> Battery Production
        </h1>
        <p className="text-slate-400 text-sm mt-1">Anchored on the finished-goods serial master · Angad &amp; Ajeet</p>
      </div>

      {/* Headline stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-slate-800 border-slate-700 p-5">
          <div className="flex items-center gap-2 text-slate-400 text-sm"><BatteryCharging className="w-4 h-4 text-emerald-400" /> Built</div>
          <div className="text-3xl font-bold text-white mt-2">{data.total_batteries.toLocaleString('en-IN')}</div>
          <div className="text-slate-500 text-xs mt-1">serialized batteries</div>
        </Card>
        <Card className="bg-slate-800 border-slate-700 p-5">
          <div className="flex items-center gap-2 text-slate-400 text-sm"><BatteryCharging className="w-4 h-4 text-emerald-400" /> Payable</div>
          <div className="text-3xl font-bold text-emerald-300 mt-2">{data.payable_batteries.toLocaleString('en-IN')}</div>
          <div className="text-slate-500 text-xs mt-1">new + untagged</div>
        </Card>
        <Card className="bg-slate-800 border-slate-700 p-5">
          <div className="flex items-center gap-2 text-slate-400 text-sm"><IndianRupee className="w-4 h-4 text-slate-300" /> Owed</div>
          <div className="text-3xl font-bold text-slate-200 mt-2">{inr(data.owed)}</div>
          <div className="text-slate-500 text-xs mt-1">{data.rate_2000} ×₹2k + {data.rate_1500} ×₹1.5k</div>
        </Card>
        <Card className="bg-slate-800 border-slate-700 p-5">
          <div className="flex items-center gap-2 text-slate-400 text-sm"><IndianRupee className="w-4 h-4 text-emerald-400" /> Paid (bank)</div>
          <div className="text-3xl font-bold text-emerald-300 mt-2">{inr(data.paid_bank)}</div>
          <div className="text-slate-500 text-xs mt-1">Angad + Ajeet</div>
        </Card>
        <Card className={`bg-slate-800 border-slate-700 p-5 ring-1 ${overpaid ? 'ring-blue-600/40' : 'ring-amber-600/40'}`}>
          <div className="flex items-center gap-2 text-slate-400 text-sm"><IndianRupee className={`w-4 h-4 ${overpaid ? 'text-blue-400' : 'text-amber-400'}`} /> {overpaid ? 'Overpaid' : 'Outstanding'}</div>
          <div className={`text-3xl font-bold mt-2 ${overpaid ? 'text-blue-300' : 'text-amber-300'}`}>{inr(Math.abs(data.outstanding))}</div>
          <div className="text-slate-500 text-xs mt-1">owed − paid</div>
        </Card>
      </div>

      {/* Composition */}
      <div className="grid md:grid-cols-2 gap-5">
        <Card className="bg-slate-800 border-slate-700 p-4">
          <div className="text-white font-semibold mb-3">Serial breakdown</div>
          <div className="space-y-2 text-sm">
            {[
              ['New (tagged)', data.new_tagged, 'text-emerald-300'],
              ['Untagged (built, no condition)', data.untagged, 'text-emerald-300'],
              ['Repaired — excluded', data.repaired_excluded, 'text-orange-300'],
              ['In refunded orders — excluded', data.refunded, 'text-orange-300'],
            ].map(([label, val, color]) => (
              <div key={label} className="flex justify-between border-b border-slate-700/60 pb-1.5">
                <span className="text-slate-300">{label}</span>
                <span className={`font-semibold ${color}`}>{Number(val || 0).toLocaleString('en-IN')}</span>
              </div>
            ))}
            <div className="flex justify-between pt-1">
              <span className="text-slate-400">Pay rates</span>
              <span className="text-slate-200">{data.rate_2000} @ ₹2,000 · {data.rate_1500} @ ₹1,500{data.norate ? ` · ${data.norate} no-rate` : ''}</span>
            </div>
          </div>
        </Card>

        {/* Team payments */}
        <Card className="bg-slate-800 border-slate-700 p-4">
          <div className="text-white font-semibold mb-1">Paid to battery team (bank)</div>
          <div className="text-slate-500 text-xs mb-3">From raw bank-statement narrations (mostly the Electronics Bay account).</div>
          <div className="flex flex-wrap gap-3">
            {(data.team_payments || []).map((t) => (
              <div key={t.name} className="flex-1 min-w-[150px] bg-slate-900/50 border border-slate-700 rounded-lg p-3">
                <div className="text-slate-300 text-sm">{t.name}</div>
                <div className="text-2xl font-bold text-emerald-300 mt-1">{inr(t.paid)}</div>
                <div className="text-slate-500 text-xs mt-1">{t.payments} payments · {String(t.first || '').slice(0, 7)} → {String(t.last || '').slice(0, 7)}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Overpaid / caveat */}
      <Card className="bg-amber-900/20 border-amber-700/40 p-3 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
        <p className="text-amber-200/90 text-sm">
          {overpaid ? (
            <>Paid (<b>{inr(data.paid_bank)}</b>) exceeds the battery-build value (<b>{inr(data.owed)}</b>) by <b>{inr(Math.abs(data.outstanding))}</b>.
            That gap is expected if the pay also covers repairs, advances, or production not yet in the serial master. </>
          ) : null}
          New + untagged serialized batteries; <b>{data.repaired_excluded}</b> repaired &amp; <b>{data.refunded}</b> refunded excluded.
          Rates: ₹2,000 (48/51V) · ₹1,500 (24/25V).
        </p>
      </Card>

      {/* By model */}
      <Card className="bg-slate-800 border-slate-700 p-4">
        <div className="text-white font-semibold mb-3">By model</div>
        <div className="space-y-2">
          {data.by_sku.slice(0, 10).map((s) => (
            <div key={s.sku}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-300 truncate mr-2">{s.sku}</span>
                <span className="text-white font-semibold">{s.batteries}</span>
              </div>
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div className="h-2 bg-emerald-500 rounded-full" style={{ width: `${(s.batteries / maxSku) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
