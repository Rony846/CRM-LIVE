import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { toast } from 'sonner';
import { PackageCheck, FileText, Truck, CheckCircle2, Clock } from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, badgeStyle } from '@/components/iron/IronKit';

/**
 * Split-dispatch queue (Iron Console). Backend filters by role:
 *  - technician (service_agent) -> INVERTER tasks
 *  - supervisor -> BATTERY & other tasks
 * Each card shows the staff's own product lines + the SHARED label + invoice.
 * "Mark as Sent" turns the card GREEN but KEEPS it in the queue — it only disappears
 * once the parcel is scanned out at the outward gate (dispatch status -> dispatched).
 * Auto-refreshes every 5 minutes (and immediately after an action).
 */
export default function DispatchTasks() {
  const { token, user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [serialModal, setSerialModal] = useState(null);   // { t, serials: [] }

  const role = user?.role;
  const heading =
    role === 'service_agent' || role === 'technician'
      ? 'Inverter Dispatch'
      : role === 'supervisor'
      ? 'Battery & Items Dispatch'
      : 'Split Dispatch';

  const load = useCallback(async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.get(`${API}/dispatch-tasks`, { headers });
      setTasks(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Could not load dispatch tasks');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
    const t = setInterval(load, 5 * 60 * 1000); // auto-refresh every 5 minutes
    return () => clearInterval(t);
  }, [load]);

  const markSent = async (t, serials = null) => {
    setBusyId(t.dispatch_id);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.put(`${API}/dispatch-tasks/${t.dispatch_id}/ready`,
        serials ? { serials } : {}, { headers });
      toast.success(
        res.data?.all_ready
          ? `${t.group_label} sent — both products ready, awaiting gate scan ✅`
          : `${t.group_label} marked sent ✅`
      );
      setSerialModal(null);
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Could not mark sent');
    } finally {
      setBusyId(null);
    }
  };

  // Manufactured items (inverter/battery) need a serial captured now; traded items don't.
  const onSend = (t) => {
    if ((t.serials_needed || 0) > 0) setSerialModal({ t, serials: Array(t.serials_needed).fill('') });
    else markSent(t);
  };
  const submitSerials = () => {
    const s = (serialModal.serials || []).map((x) => (x || '').trim());
    if (s.some((x) => !x)) return toast.error('Enter every serial number');
    if (new Set(s).size !== s.length) return toast.error('Serial numbers must be unique');
    markSent(serialModal.t, s);
  };

  const pendingCount = tasks.filter((t) => t.status !== 'ready').length;

  const subtitle = pendingCount > 0
    ? `${pendingCount} TO SEND · AUTO-REFRESH 5 MIN`
    : 'ALL SENT — WAITING ON GATE SCAN · AUTO-REFRESH 5 MIN';

  const linkBtn = {
    flex: 1, minWidth: '8rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: 6, height: 40, border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700,
    borderRadius: 6, fontFamily: T.headline, fontWeight: 700, fontSize: 12, textDecoration: 'none',
  };

  const sendBtn = (disabled) => ({
    width: '100%', height: 46, display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: 8, border: 'none', background: disabled ? T.iron400 : T.orange, color: '#fff',
    borderRadius: 6, fontFamily: T.headline, fontWeight: 700, fontSize: 14,
    cursor: disabled ? 'default' : 'pointer',
  });

  return (
    <IronShell title="Dispatch Tasks" subtitle={subtitle} onRefresh={load}>
      <div style={{ maxWidth: 1040, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <PackageCheck size={22} strokeWidth={2} color={T.orange} />
          <div>
            <div style={{ fontFamily: T.headline, fontWeight: 800, fontSize: 20, color: T.iron900 }}>{heading}</div>
            <Caps size={9} color={T.iron400}>
              {pendingCount > 0 ? `${pendingCount} to send` : 'All sent — waiting on gate scan'} · auto-refreshes every 5 min
            </Caps>
          </div>
        </div>

        {loading ? (
          <div style={{ color: T.iron500, fontSize: 13, padding: '40px 0', textAlign: 'center' }}>Loading…</div>
        ) : tasks.length === 0 ? (
          <IronCard pad={0}>
            <div style={{ padding: '48px 0', textAlign: 'center', color: T.iron500 }}>
              <CheckCircle2 size={40} style={{ opacity: 0.5, margin: '0 auto 8px' }} />
              <div style={{ fontSize: 13 }}>Nothing to dispatch right now. New orders will appear here.</div>
            </div>
          </IronCard>
        ) : (
          <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))' }}>
            {tasks.map((t) => {
              const sent = t.status === 'ready';
              const counterpart = (t.all_tasks || []).find((x) => x.group !== t.group);
              const bothReady = t.dispatch_status === 'ready_for_dispatch';
              return (
                <IronCard
                  key={`${t.dispatch_id}-${t.group}`}
                  pad={0}
                  style={{
                    borderLeft: `4px solid ${sent ? T.green : T.orange}`,
                    background: sent ? T.greenTint : T.white,
                  }}
                >
                  <div style={{ padding: 14 }}>
                    {/* Header row */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ ...mono, fontWeight: 700, fontSize: 15, color: T.iron900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        #{t.dispatch_number}
                      </span>
                      {sent ? (
                        <span style={{ ...badgeStyle('ok'), display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <CheckCircle2 size={12} /> Sent
                        </span>
                      ) : (
                        <span style={badgeStyle('slate')}>{t.group_label}</span>
                      )}
                    </div>
                    <div style={{ ...mono, fontSize: 11.5, color: T.iron500, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.order_id || '—'} · {t.customer_name || 'Customer'} · {t.city || ''} {t.state || ''}
                    </div>

                    {/* Your items */}
                    <div style={{ marginTop: 12 }}>
                      <Caps size={9} color={T.iron400}>Your Items</Caps>
                      <ul style={{ listStyle: 'none', margin: '6px 0 0', padding: 0 }}>
                        {(t.items || []).map((it, i) => (
                          <li key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13, color: T.iron700, padding: '2px 0' }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {it.master_sku_name || it.sku_code || 'Item'}
                            </span>
                            <span style={{ ...mono, color: T.iron500, whiteSpace: 'nowrap', flexShrink: 0 }}>
                              x{it.quantity}{it.serial_number ? ` · ${it.serial_number}` : ''}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Courier */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, fontSize: 12, color: T.iron500 }}>
                      <Truck size={15} style={{ flexShrink: 0 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.courier || '—'}{t.tracking_id ? ` · ${t.tracking_id}` : ''}
                      </span>
                    </div>

                    {/* Label / Invoice */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                      {t.label_url && (
                        <a href={t.label_url} target="_blank" rel="noreferrer" style={linkBtn}>
                          <FileText size={15} /> Label
                        </a>
                      )}
                      {t.invoice_url && (
                        <a href={t.invoice_url} target="_blank" rel="noreferrer" style={linkBtn}>
                          <FileText size={15} /> Invoice
                        </a>
                      )}
                    </div>

                    {/* Counterpart status */}
                    {counterpart && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, fontSize: 12, color: T.iron500 }}>
                        {counterpart.status === 'ready' ? (
                          <>
                            <CheckCircle2 size={14} color={T.green} style={{ flexShrink: 0 }} />
                            {counterpart.label} already sent
                            {counterpart.completed_by_name ? ` by ${counterpart.completed_by_name}` : ''}
                          </>
                        ) : (
                          <>
                            <Clock size={14} style={{ flexShrink: 0 }} /> Waiting on {counterpart.label} too
                          </>
                        )}
                      </div>
                    )}

                    {/* Action */}
                    <div style={{ marginTop: 14 }}>
                      {sent ? (
                        <div style={{
                          width: '100%', height: 48, borderRadius: 6, background: T.greenTint,
                          border: `1px solid #CBE5D6`, display: 'flex', alignItems: 'center',
                          justifyContent: 'center', gap: 6, color: T.green, fontSize: 13,
                          fontFamily: T.headline, fontWeight: 600,
                        }}>
                          <CheckCircle2 size={16} />
                          {bothReady ? 'Sent — awaiting outward gate scan' : 'Sent — waiting for the other product'}
                        </div>
                      ) : (
                        <button
                          style={sendBtn(busyId === t.dispatch_id)}
                          disabled={busyId === t.dispatch_id}
                          onClick={() => onSend(t)}
                        >
                          <PackageCheck size={18} />
                          {busyId === t.dispatch_id ? 'Saving…' : (t.serials_needed > 0 ? `Made & Dispatch (enter ${t.serials_needed} serial${t.serials_needed > 1 ? 's' : ''})` : `Mark ${t.group_label} as Sent`)}
                        </button>
                      )}
                    </div>
                  </div>
                </IronCard>
              );
            })}
          </div>
        )}
      </div>

      {serialModal && (
        <div onClick={() => busyId ? null : setSerialModal(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,15,15,.5)', zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(440px,100%)', background: T.white, borderRadius: 12, padding: 22, boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
            <div style={{ fontFamily: T.headline, fontWeight: 800, fontSize: 17, color: T.iron900 }}>Enter serial number{serialModal.serials.length > 1 ? 's' : ''}</div>
            <div style={{ fontSize: 12.5, color: T.iron500, margin: '6px 0 16px' }}>
              You made {serialModal.serials.length} unit{serialModal.serials.length > 1 ? 's' : ''} for {serialModal.t.group_label} — enter the serial for each before dispatch.
            </div>
            {(serialModal.t.serial_items || []).map((si, k) => (
              <div key={k} style={{ fontFamily: T.mono, fontSize: 11.5, color: T.iron400, marginBottom: 4 }}>{si.product_name} × {si.quantity}</div>
            ))}
            {serialModal.serials.map((v, i) => (
              <input key={i} value={v} autoFocus={i === 0}
                onChange={(e) => setSerialModal((m) => ({ ...m, serials: m.serials.map((x, j) => j === i ? e.target.value : x) }))}
                onKeyDown={(e) => e.key === 'Enter' && i === serialModal.serials.length - 1 && submitSerials()}
                placeholder={`Serial #${i + 1}`}
                style={{ width: '100%', border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '9px 11px', fontSize: 13, fontFamily: T.mono, marginBottom: 8, outline: 'none' }} />
            ))}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
              <button onClick={() => setSerialModal(null)} disabled={!!busyId}
                style={{ border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, borderRadius: 6, padding: '9px 16px', fontFamily: T.headline, fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>Cancel</button>
              <button onClick={submitSerials} disabled={!!busyId}
                style={{ border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '9px 18px', fontFamily: T.headline, fontWeight: 700, fontSize: 12.5, cursor: 'pointer', opacity: busyId ? 0.6 : 1 }}>
                {busyId ? 'Saving…' : 'Confirm & Dispatch'}</button>
            </div>
          </div>
        </div>
      )}
    </IronShell>
  );
}
