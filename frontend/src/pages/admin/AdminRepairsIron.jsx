import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Wrench, Loader2, Eye, Search, Package, Clock, CheckCircle,
  AlertTriangle, UserPlus, FileText, User, Phone
} from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell, badgeStyle, ticketPill, fmtDateTime } from '@/components/iron/IronKit';

const inputStyle = { border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '7px 10px', fontSize: 12.5, color: T.iron900, background: T.white, fontFamily: T.body, outline: 'none', width: '100%' };
const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

const STAT_TILES = [
  ['total', 'Total', Package, T.iron700],
  ['awaiting_repair', 'Awaiting', Clock, T.voltageText],
  ['in_repair', 'In Repair', Wrench, T.blue],
  ['repair_completed', 'Completed', CheckCircle, T.green],
  ['awaiting_invoice', 'Awaiting Invoice', FileText, T.orange],
  ['ready_for_dispatch', 'Ready to Ship', Package, '#6D4AB0'],
  ['dispatched', 'Dispatched', CheckCircle, T.green],
  ['walkin_count', 'Walk-ins', UserPlus, '#6D4AB0'],
];

export default function AdminRepairs() {
  const { token } = useAuth();
  const [repairs, setRepairs] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedRepair, setSelectedRepair] = useState(null);
  const [viewOpen, setViewOpen] = useState(false);

  const fetchRepairs = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/admin/all-repairs`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRepairs(response.data.tickets || []);
      setStats(response.data.stats || {});
    } catch (error) {
      toast.error('Failed to load repairs');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchRepairs(); }, [fetchRepairs]);

  const openViewDialog = (repair) => {
    setSelectedRepair(repair);
    setViewOpen(true);
  };

  const filteredRepairs = repairs.filter(repair => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      repair.ticket_number?.toLowerCase().includes(searchLower) ||
      repair.customer_name?.toLowerCase().includes(searchLower) ||
      repair.customer_phone?.includes(search) ||
      repair.device_type?.toLowerCase().includes(searchLower)
    );
  });

  const headers = ['TICKET #', 'CUSTOMER', 'DEVICE', 'SERIAL NUMBERS', 'STATUS', 'RECEIVED', ''];

  return (
    <IronShell
      title="Repairs"
      subtitle={`${(stats.total || 0).toLocaleString('en-IN')} REPAIRS · SERVICE CENTER`}
      onRefresh={fetchRepairs}
    >
      {/* Stat tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 16 }}>
        {STAT_TILES.map(([key, label, Icon, color]) => (
          <IronCard key={key} pad={14}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: T.iron50, border: `1px solid ${T.iron200}`, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <Icon size={16} color={color} strokeWidth={1.9} />
              </div>
              <div>
                <div style={{ ...mono, fontWeight: 700, fontSize: 20, color: T.iron900, lineHeight: 1 }}>{(stats[key] || 0).toLocaleString('en-IN')}</div>
                <Caps size={8.5} style={{ display: 'block', marginTop: 4 }}>{label}</Caps>
              </div>
            </div>
          </IronCard>
        ))}
      </div>

      {/* Search */}
      <IronCard style={{ marginBottom: 16 }} pad={14}>
        <div style={{ position: 'relative', maxWidth: 420 }}>
          <Search size={14} color={T.iron400} style={{ position: 'absolute', left: 9, top: 9 }} />
          <input
            placeholder="Search by ticket #, customer, phone, device..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="repairs-search"
            style={{ ...inputStyle, paddingLeft: 30 }}
          />
        </div>
      </IronCard>

      {/* Repairs table */}
      <IronCard pad={0} style={{ overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: `1px solid ${T.iron200}` }}>
          <Wrench size={16} color={T.orange} />
          <span style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 13, color: T.iron900 }}>All Repairs</span>
          <span style={{ ...mono, fontSize: 11, color: T.iron400 }}>({filteredRepairs.length})</span>
        </div>

        {loading ? (
          <div style={{ display: 'grid', placeItems: 'center', height: 260 }}><Loader2 className="animate-spin" size={28} color={T.iron400} /></div>
        ) : filteredRepairs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: T.iron400 }}>
            <Wrench size={44} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
            <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron700 }}>No repairs found</div>
            <div style={{ fontSize: 12, marginTop: 3 }}>Try adjusting your search.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                {headers.map((h, i) => <th key={i} style={thCell}><Caps size={8.5}>{h}</Caps></th>)}
              </tr></thead>
              <tbody>{filteredRepairs.map((repair) => {
                const pill = ticketPill(repair.status);
                return (
                  <tr key={repair.id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                    <td style={tdCell}>
                      <div style={{ ...mono, fontWeight: 700, fontSize: 12, color: T.orangeDeep }}>{repair.ticket_number}</div>
                      {repair.is_walkin && <span style={{ ...badgeStyle('violet'), marginTop: 4 }}>Walk-in</span>}
                    </td>
                    <td style={{ ...tdCell, maxWidth: 180 }}>
                      <div style={{ fontFamily: T.headline, fontWeight: 600, fontSize: 12.5, color: T.iron900 }}>{repair.customer_name}</div>
                      <div style={{ ...mono, fontSize: 10.5, color: T.iron500, marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Phone size={11} /> {repair.customer_phone}
                      </div>
                    </td>
                    <td style={tdCell}>
                      <div style={{ fontSize: 12, color: T.iron900 }}>{repair.device_type}</div>
                      {repair.serial_number && <div style={{ ...mono, fontSize: 10.5, color: T.iron400, marginTop: 2 }}>S/N: {repair.serial_number}</div>}
                    </td>
                    <td style={tdCell}>
                      {repair.board_serial_number || repair.device_serial_number ? (
                        <div style={{ ...mono, fontSize: 10.5, color: T.iron700, lineHeight: 1.7 }}>
                          {repair.board_serial_number && <div><span style={{ color: T.iron400 }}>BOARD </span>{repair.board_serial_number}</div>}
                          {repair.device_serial_number && <div><span style={{ color: T.iron400 }}>DEVICE </span>{repair.device_serial_number}</div>}
                        </div>
                      ) : <span style={{ color: T.iron400 }}>-</span>}
                    </td>
                    <td style={tdCell}><span style={pill.style}>{pill.label}</span></td>
                    <td style={tdCell}>
                      <span style={{ ...mono, fontSize: 10.5, color: T.iron500 }}>{repair.received_at ? new Date(repair.received_at).toLocaleDateString('en-IN') : '-'}</span>
                    </td>
                    <td style={{ ...tdCell, textAlign: 'right' }}>
                      <button onClick={() => openViewDialog(repair)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: `1px solid ${T.orange}`, background: T.white, color: T.orangeDeep, borderRadius: 6, padding: '5px 11px', cursor: 'pointer', fontFamily: T.headline, fontWeight: 700, fontSize: 11 }}><Eye size={13} /> View</button>
                    </td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        )}
      </IronCard>

      {/* View Repair Dialog */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="w-5 h-5 text-orange-600" />
              Repair Details - {selectedRepair?.ticket_number}
            </DialogTitle>
          </DialogHeader>

          {selectedRepair && (
            <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
              {/* Status Badge */}
              <div className="flex items-center gap-2">
                {(() => { const p = ticketPill(selectedRepair.status); return <span style={p.style}>{p.label}</span>; })()}
                {selectedRepair.is_walkin && (
                  <span style={badgeStyle('violet')}>Walk-in Customer</span>
                )}
              </div>

              {/* Customer Info */}
              <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-lg space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <User className="w-4 h-4" /> Customer Information
                </h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <p><strong>Name:</strong> {selectedRepair.customer_name}</p>
                  <p><strong>Phone:</strong> {selectedRepair.customer_phone}</p>
                  <p><strong>Email:</strong> {selectedRepair.customer_email || '-'}</p>
                  <p><strong>Address:</strong> {selectedRepair.address || '-'}</p>
                </div>
              </div>

              {/* Device Info */}
              <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-lg space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <Package className="w-4 h-4" /> Device Information
                </h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <p><strong>Device Type:</strong> {selectedRepair.device_type}</p>
                  <p><strong>Serial Number:</strong> {selectedRepair.serial_number || '-'}</p>
                  <p><strong>Board Serial:</strong> {selectedRepair.board_serial_number || '-'}</p>
                  <p><strong>Device Serial:</strong> {selectedRepair.device_serial_number || '-'}</p>
                </div>
              </div>

              {/* Issue & Diagnosis */}
              <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-lg space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <FileText className="w-4 h-4" /> Issue & Diagnosis
                </h4>
                <div className="text-sm space-y-2">
                  <div>
                    <p className="font-medium text-slate-500">Customer Issue:</p>
                    <p>{selectedRepair.issue_description || '-'}</p>
                  </div>
                  {selectedRepair.diagnosis && (
                    <div>
                      <p className="font-medium text-slate-500">Diagnosis:</p>
                      <p>{selectedRepair.diagnosis}</p>
                    </div>
                  )}
                  {selectedRepair.repair_notes && (
                    <div>
                      <p className="font-medium text-slate-500">Repair Notes:</p>
                      <p>{selectedRepair.repair_notes}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Timeline */}
              <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-lg space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <Clock className="w-4 h-4" /> Timeline
                </h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <p><strong>Created:</strong> {selectedRepair.created_at ? new Date(selectedRepair.created_at).toLocaleString() : '-'}</p>
                  <p><strong>Received:</strong> {selectedRepair.received_at ? new Date(selectedRepair.received_at).toLocaleString() : '-'}</p>
                  <p><strong>Repaired:</strong> {selectedRepair.repaired_at ? new Date(selectedRepair.repaired_at).toLocaleString() : '-'}</p>
                  <p><strong>Updated:</strong> {selectedRepair.updated_at ? new Date(selectedRepair.updated_at).toLocaleString() : '-'}</p>
                </div>
              </div>

              {/* Service Charges */}
              {(selectedRepair.service_charges || selectedRepair.service_invoice) && (
                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg space-y-2">
                  <h4 className="font-medium text-green-700 dark:text-green-400">Service Invoice</h4>
                  <div className="text-sm">
                    <p><strong>Charges:</strong> {inr(selectedRepair.service_charges || 0)}</p>
                    {selectedRepair.service_invoice && (
                      <p><strong>Invoice:</strong> <a href={selectedRepair.service_invoice} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">View Invoice</a></p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </IronShell>
  );
}
