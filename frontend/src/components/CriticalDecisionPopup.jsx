import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useAuth, API } from '@/App';
import { AlertTriangle, X } from 'lucide-react';

// Global red-flag popup: fires in the center of the screen for admins while they work, so a legal threat,
// refund/replacement call, or fake-return check is never missed. Polls cheaply; snoozes so it isn't nagging.
const POLL_MS = 45000;
const SNOOZE_MS = 10 * 60 * 1000;

export default function CriticalDecisionPopup() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [pending, setPending] = useState(0);
  const [top, setTop] = useState(null);
  const [open, setOpen] = useState(false);
  const snoozeUntil = useRef(0);

  const isAdmin = user?.role === 'admin';

  const check = useCallback(async () => {
    if (!isAdmin || !token) return;
    try {
      const { data } = await axios.get(`${API}/admin/critical-decisions/pending-count`, { headers: { Authorization: `Bearer ${token}` } });
      const n = data.pending || 0;
      setPending(n);
      if (n > 0 && Date.now() > snoozeUntil.current) {
        const list = await axios.get(`${API}/admin/critical-decisions`, { headers: { Authorization: `Bearer ${token}` }, params: { status: 'pending', limit: 1 } });
        setTop((list.data.decisions || [])[0] || null);
        setOpen(true);
      }
    } catch (e) { /* silent */ }
  }, [isAdmin, token]);

  useEffect(() => {
    if (!isAdmin) return;
    check();
    const id = setInterval(check, POLL_MS);
    return () => clearInterval(id);
  }, [isAdmin, check]);

  if (!isAdmin || !open || !top) return null;

  const snooze = () => { snoozeUntil.current = Date.now() + SNOOZE_MS; setOpen(false); };

  const resolve = async (opt) => {
    const note = window.prompt(`Decision: "${opt.label}"\n\nAdd a note (optional):`, '');
    if (note === null) return;
    try {
      const { data } = await axios.post(`${API}/admin/critical-decisions/${top.id}/resolve`,
        { decision: opt.key, decision_label: opt.label, note }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success(data.message || 'Decision recorded');
      if (!data.pending) setOpen(false);
      setTimeout(check, 300);
    } catch (e) { toast.error(e?.response?.data?.detail || 'Failed'); }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100000, background: 'rgba(15,23,42,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }} onClick={snooze}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: 'min(520px, 96vw)', background: '#fff', borderRadius: 14, overflow: 'hidden',
        boxShadow: '0 24px 60px rgba(0,0,0,0.4)', border: '1px solid #fecaca',
      }}>
        <div style={{ background: '#b91c1c', color: '#fff', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <AlertTriangle size={20} />
          <div style={{ fontWeight: 800, fontSize: 15, fontFamily: 'inherit', flex: 1 }}>
            Critical decision needed{pending > 1 ? ` (1 of ${pending})` : ''}
          </div>
          <button onClick={snooze} title="Snooze 10 min" style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', opacity: 0.9 }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ padding: 18 }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: '#0f172a' }}>{top.title}</div>
          <div style={{ fontSize: 13.5, color: '#475569', marginTop: 6, lineHeight: 1.6 }}>{top.summary}</div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8, fontSize: 12, color: '#64748b' }}>
            {top.customer_name && <span>{top.customer_name}</span>}
            {top.customer_phone && <span style={{ fontFamily: 'monospace' }}>{top.customer_phone}</span>}
            {top.ticket_number && <span style={{ fontFamily: 'monospace', color: '#c2410c' }}>{top.ticket_number}</span>}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
            {(top.options || []).map((opt) => (
              <button key={opt.key} onClick={() => resolve(opt)} style={{
                border: 'none', background: '#0f172a', color: '#fff', borderRadius: 7,
                padding: '9px 15px', fontWeight: 700, fontSize: 12.5, cursor: 'pointer',
              }}>{opt.label}</button>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, paddingTop: 12, borderTop: '1px solid #f1f5f9' }}>
            <button onClick={() => { setOpen(false); navigate('/admin/critical-decisions'); }} style={{
              background: 'transparent', border: 'none', color: '#c2410c', fontWeight: 700, fontSize: 12.5, cursor: 'pointer',
            }}>View all {pending > 1 ? `(${pending})` : ''} →</button>
            <button onClick={snooze} style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: 12, cursor: 'pointer' }}>
              Snooze 10 min
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
