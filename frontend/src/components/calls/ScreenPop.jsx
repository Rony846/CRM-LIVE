import React, { useEffect, useState, useCallback, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { API, useAuth } from '@/App';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Phone, Ticket, Shield, Package, X, Sparkles, Clock } from 'lucide-react';

// Lightweight SLA pill helper duplicated from CallSupportDashboard to avoid cross-imports
const slaTone = (ticket) => {
  const due = ticket?.sla_due;
  if (!due) return null;
  const STOPPED = ['closed', 'closed_by_agent', 'resolved_on_call', 'resolved', 'delivered'];
  if (STOPPED.includes(ticket.status)) return null;
  const mins = (new Date(due).getTime() - Date.now()) / 60000;
  if (mins < 0) return { tone: 'red', label: `Breached` };
  if (mins < 30) return { tone: 'red', label: `${Math.round(mins)}m` };
  if (mins < 120) return { tone: 'amber', label: `${Math.round(mins)}m` };
  return null;
};

const ROLES_WITH_POP = new Set(['call_support', 'supervisor', 'admin']);

export default function ScreenPop() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [context, setContext] = useState(null);
  const [loading, setLoading] = useState(false);
  const esRef = useRef(null);

  const enabled = !!token && ROLES_WITH_POP.has(user?.role);

  const fetchContext = useCallback(async (phone) => {
    if (!phone) return;
    setLoading(true);
    try {
      const r = await axios.get(`${API}/screen-pop/context`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { phone },
      });
      setContext(r.data);
    } catch {
      setContext(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!enabled) return undefined;
    // Build URL with token in query (EventSource cannot send Authorization headers)
    const url = `${API}/screen-pop/stream?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);
    esRef.current = es;
    es.addEventListener('screen_pop', (ev) => {
      try {
        const payload = JSON.parse(ev.data);
        if (payload?.type === 'inbound_call') {
          setEvent(payload);
          setContext(null);
          fetchContext(payload.phone);
        }
      } catch (e) {
        // ignore malformed events
      }
    });
    es.onerror = () => {
      // EventSource auto-reconnects; do nothing
    };
    return () => {
      es.close();
      esRef.current = null;
    };
  }, [enabled, token, fetchContext]);

  if (!event) return null;

  const phone = event.phone || event.raw_phone;
  const callerName = context?.customer?.name
    || (context?.warranties?.[0]?.customer_name)
    || event.agent_name
    || 'Unknown caller';

  const close = () => { setEvent(null); setContext(null); };

  const goToTicket = (id) => {
    close();
    navigate(`/support`);
    // Caller will land on Call Support dashboard; the page-level search by phone
    // gets them to the ticket quickly. A dedicated /support/ticket/:id route
    // does not currently exist as a deep-link in this repo.
  };

  return (
    <Dialog open={!!event} onOpenChange={(v) => { if (!v) close(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-2 px-2 py-0.5 rounded-full bg-green-100 text-green-800 text-xs font-medium animate-pulse">
              <Phone className="w-3 h-3" />
              Ringing
            </span>
            <span className="text-base">{callerName}</span>
            <span className="font-mono text-slate-500 text-sm">{phone}</span>
            {context?.total_tickets > 0 && (
              <Badge variant="outline" className="ml-2">
                {context.total_tickets} ticket{context.total_tickets === 1 ? '' : 's'} on file
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Customer card */}
          {context?.customer ? (
            <div className="bg-slate-50 p-3 rounded text-sm">
              <p className="font-medium">{context.customer.name}</p>
              <p className="text-slate-500 text-xs">
                {[context.customer.email, context.customer.city, context.customer.state].filter(Boolean).join(' · ')}
              </p>
            </div>
          ) : loading ? (
            <div className="h-12 bg-slate-100 rounded animate-pulse" />
          ) : (
            <div className="bg-amber-50 border border-amber-200 p-3 rounded text-sm text-amber-800 flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              No customer record found for this number — likely a new caller.
            </div>
          )}

          {/* Open tickets */}
          {context?.open_tickets?.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-600 mb-1 flex items-center gap-1">
                <Ticket className="w-3 h-3" /> Open tickets ({context.open_tickets.length})
              </p>
              <div className="space-y-1">
                {context.open_tickets.map((t) => {
                  const sla = slaTone(t);
                  return (
                    <button
                      key={t.id}
                      onClick={() => goToTicket(t.id)}
                      className="w-full text-left bg-white hover:bg-slate-50 border border-slate-200 rounded p-2 text-xs flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-medium">{t.ticket_number}</span>
                          <span className="text-slate-500">{t.device_type}</span>
                        </div>
                        <p className="text-slate-600 truncate">{t.issue_description}</p>
                      </div>
                      {sla && (
                        <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border ${
                          sla.tone === 'red' ? 'bg-red-100 text-red-700 border-red-300' :
                          'bg-amber-100 text-amber-700 border-amber-300'
                        }`}>
                          <Clock className="w-2.5 h-2.5" />{sla.label}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Warranties */}
          {context?.warranties?.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-600 mb-1 flex items-center gap-1">
                <Shield className="w-3 h-3" /> Warranties ({context.warranties.length})
              </p>
              <div className="space-y-1">
                {context.warranties.slice(0, 3).map((w) => (
                  <div key={w.id} className="bg-emerald-50 rounded p-2 text-xs flex items-center justify-between">
                    <div>
                      <span className="font-mono">{w.warranty_number}</span>
                      <span className="text-slate-500 ml-2">{w.device_type}</span>
                    </div>
                    {w.warranty_end_date && (
                      <span className="text-slate-500">till {new Date(w.warranty_end_date).toLocaleDateString()}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent dispatches */}
          {context?.dispatches?.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-600 mb-1 flex items-center gap-1">
                <Package className="w-3 h-3" /> Recent dispatches ({context.dispatches.length})
              </p>
              <div className="space-y-1">
                {context.dispatches.map((d) => (
                  <div key={d.id} className="bg-orange-50 rounded p-2 text-xs flex items-center justify-between">
                    <div>
                      <span className="font-mono">{d.dispatch_number}</span>
                      <span className="text-slate-500 ml-2">{d.product_name || ''}</span>
                    </div>
                    <span className="text-slate-500">{d.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Last interaction */}
          {context?.last_call && (
            <div className="text-xs text-slate-500 italic">
              Last call: {new Date(context.last_call.received_at).toLocaleString()}
              {context.last_call.outcome ? ` — outcome: ${context.last_call.outcome}` : ''}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={close} data-testid="screen-pop-dismiss">
            <X className="w-4 h-4 mr-1" />
            Dismiss
          </Button>
          <Button
            className="bg-blue-600 hover:bg-blue-700"
            onClick={() => { close(); navigate('/support'); }}
            data-testid="screen-pop-create-ticket"
          >
            <Ticket className="w-4 h-4 mr-1" />
            Open Call Support
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
