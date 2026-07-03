import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { toast } from 'sonner';
import { Search, Users, Inbox, Loader2 } from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell } from '@/components/iron/IronKit';

const inputStyle = { border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '7px 10px', fontSize: 12.5, color: T.iron900, background: T.white, fontFamily: T.body, outline: 'none', width: '100%' };

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

  const tableHeaders = ['NAME', 'PHONE', 'JOINED', 'SALARY PAID (BANK)', 'ACCOUNT', 'IFSC'];

  return (
    <IronShell
      title="Employees"
      subtitle={`${Number(data.total || 0).toLocaleString('en-IN')} EMPLOYEES · IMPORTED FROM ONBOARDING`}
      onRefresh={fetchData}
      headerRight={
        <div style={{ textAlign: 'right', marginRight: 4 }}>
          <Caps size={8.5} color={T.iron400} style={{ display: 'block' }}>Salary paid (bank, attributed)</Caps>
          <div style={{ ...mono, fontSize: 15, fontWeight: 700, color: T.green }}>{inr(totalSalary)}</div>
        </div>
      }>

      {/* Search bar */}
      <IronCard style={{ marginBottom: 16 }} pad={14}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
          <div>
            <Caps size={8.5} style={{ display: 'block', marginBottom: 5 }}>Search</Caps>
            <div style={{ position: 'relative' }}>
              <Search size={14} color={T.iron400} style={{ position: 'absolute', left: 9, top: 9 }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') setQ(search); }}
                placeholder="Search name, phone, account…"
                style={{ ...inputStyle, paddingLeft: 30 }}
              />
            </div>
          </div>
        </div>
      </IronCard>

      {/* Table */}
      <IronCard pad={0} style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ display: 'grid', placeItems: 'center', height: 260 }}><Loader2 className="animate-spin" size={28} color={T.iron400} /></div>
        ) : data.employees.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: T.iron400 }}>
            <Inbox size={44} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
            <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron700 }}>No employees</div>
            <div style={{ fontSize: 12, marginTop: 3 }}>Nothing matched your search.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                {tableHeaders.map((h, i) => (
                  <th key={i} style={{ ...thCell, textAlign: h === 'SALARY PAID (BANK)' ? 'right' : 'left' }}><Caps size={8.5}>{h}</Caps></th>
                ))}
              </tr></thead>
              <tbody>{data.employees.map((e) => (
                <tr key={e.id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                  <td style={tdCell}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Users size={13} color={T.iron400} />
                      <span style={{ fontFamily: T.headline, fontWeight: 600, fontSize: 12.5, color: T.iron900 }}>{e.name}</span>
                    </div>
                  </td>
                  <td style={tdCell}><span style={{ ...mono, fontSize: 11.5, color: T.iron700 }}>{e.phone || '—'}</span></td>
                  <td style={tdCell}><span style={{ ...mono, fontSize: 11, color: T.iron500 }}>{e.date_of_joining || '—'}</span></td>
                  <td style={{ ...tdCell, textAlign: 'right' }}>
                    {e.salary_received
                      ? <span style={{ ...mono, fontWeight: 700, fontSize: 12, color: T.green }}>{inr(e.salary_received)}<span style={{ color: T.iron400, fontSize: 10, fontWeight: 500 }}> · {e.salary_payments}p</span></span>
                      : <span style={{ color: T.iron400 }}>—</span>}
                  </td>
                  <td style={tdCell}><span style={{ ...mono, fontSize: 11.5, color: T.iron700 }}>{e.account_number || '—'}</span></td>
                  <td style={tdCell}><span style={{ ...mono, fontSize: 11, color: T.iron500 }}>{e.ifsc || '—'}</span></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </IronCard>
    </IronShell>
  );
}
