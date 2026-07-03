import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, FileText, Search } from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell, badgeStyle } from '@/components/iron/IronKit';

const DEVICE_TYPES = ['Inverter', 'Battery', 'Stabilizer', 'Solar', 'Others'];
const STATUSES = ['published', 'draft', 'archived'];
const empty = { title: '', problem_summary: '', resolution_steps: '', device_type: '', tags: '', status: 'published' };

const inputStyle = { border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '7px 10px', fontSize: 12.5, color: T.iron900, background: T.white, fontFamily: T.body, outline: 'none' };
const selectStyle = { ...inputStyle, cursor: 'pointer' };
const rowActionStyle = { border: `1px solid ${T.iron200}`, background: T.white, borderRadius: 6, height: 28, width: 28, display: 'inline-grid', placeItems: 'center', cursor: 'pointer', color: T.iron700 };

const statusTone = (s) => (s === 'published' ? 'ok' : s === 'draft' ? 'warn' : 'slate');

export default function KnowledgeBase() {
  const { token } = useAuth();
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [deviceFilter, setDeviceFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/kb/articles`, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          q: query || undefined,
          device_type: deviceFilter || undefined,
          status: statusFilter || undefined,
          limit: 100,
        },
      });
      setArticles(r.data?.articles || []);
    } catch (e) {
      toast.error('Failed to load articles');
    } finally {
      setLoading(false);
    }
  }, [token, query, deviceFilter, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const startNew = () => {
    setEditing('new');
    setForm(empty);
  };
  const startEdit = (art) => {
    setEditing(art.id);
    setForm({
      title: art.title || '',
      problem_summary: art.problem_summary || '',
      resolution_steps: art.resolution_steps || '',
      device_type: art.device_type || '',
      tags: (art.tags || []).join(', '),
      status: art.status || 'published',
    });
  };

  const save = async () => {
    if (!form.title.trim()) {
      toast.error('Title is required');
      return;
    }
    setSaving(true);
    try {
      const body = {
        title: form.title,
        problem_summary: form.problem_summary,
        resolution_steps: form.resolution_steps,
        device_type: form.device_type || null,
        tags: form.tags.split(',').map((s) => s.trim()).filter(Boolean),
        status: form.status,
      };
      if (editing === 'new') {
        await axios.post(`${API}/kb/articles`, body, {
          headers: { Authorization: `Bearer ${token}` },
        });
        toast.success('Article created');
      } else {
        await axios.patch(`${API}/kb/articles/${editing}`, body, {
          headers: { Authorization: `Bearer ${token}` },
        });
        toast.success('Article updated');
      }
      setEditing(null);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this article?')) return;
    try {
      await axios.delete(`${API}/kb/articles/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('Deleted');
      load();
    } catch (e) {
      toast.error('Delete failed');
    }
  };

  const H = ['Title', 'Device', 'Tags', 'Status', 'Updated', ''];

  const headerRight = (
    <button
      onClick={startNew}
      style={{ border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
    >
      <Plus size={14} /> New Article
    </button>
  );

  return (
    <IronShell title="Knowledge Base" subtitle="KB / SUPPORT PLAYBOOKS" onRefresh={load} headerRight={headerRight}>
      {/* Filters */}
      <IronCard pad={14} style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 280 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: T.iron400 }} />
            <input
              placeholder="Search title / problem / resolution / tag…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ ...inputStyle, paddingLeft: 30, width: '100%' }}
            />
          </div>
          <select value={deviceFilter} onChange={(e) => setDeviceFilter(e.target.value)} style={{ ...selectStyle, minWidth: 150 }}>
            <option value="">All devices</option>
            {DEVICE_TYPES.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ ...selectStyle, minWidth: 130 }}>
            <option value="">Any status</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </IronCard>

      {/* Table */}
      <IronCard pad={0}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <Caps size={10} color={T.iron400}>Loading articles…</Caps>
          </div>
        ) : articles.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: T.iron500 }}>
            <FileText size={34} style={{ margin: '0 auto 8px', color: T.iron200 }} />
            <div style={{ fontSize: 13 }}>No articles yet.</div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                {H.map((h, i) => (
                  <th key={i} style={{ ...thCell, textAlign: i === H.length - 1 ? 'right' : 'left' }}>
                    <Caps size={8.5}>{h}</Caps>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {articles.map((a) => (
                <tr key={a.id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                  <td style={{ ...tdCell, fontWeight: 600, color: T.iron900, maxWidth: 360 }}>{a.title}</td>
                  <td style={tdCell}>{a.device_type || '-'}</td>
                  <td style={tdCell}>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {(a.tags || []).map((t) => (
                        <span key={t} style={badgeStyle('slate')}>{t}</span>
                      ))}
                    </div>
                  </td>
                  <td style={tdCell}>
                    <span style={badgeStyle(statusTone(a.status))}>{a.status}</span>
                  </td>
                  <td style={{ ...tdCell, ...mono, color: T.iron500, fontSize: 11 }}>
                    {a.updated_at ? new Date(a.updated_at).toLocaleDateString() : '-'}
                  </td>
                  <td style={{ ...tdCell, textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button title="Edit" style={rowActionStyle} onClick={() => startEdit(a)}>
                        <Edit size={13} />
                      </button>
                      <button title="Delete" style={{ ...rowActionStyle, color: T.rose }} onClick={() => remove(a.id)}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </IronCard>

      {/* Editor Dialog */}
      <Dialog open={!!editing} onOpenChange={(v) => { if (!v) setEditing(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing === 'new' ? 'New article' : 'Edit article'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Title</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Device type</Label>
                <Select value={form.device_type || 'none'} onValueChange={(v) => setForm({ ...form, device_type: v === 'none' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Any</SelectItem>
                    {DEVICE_TYPES.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Problem summary</Label>
              <Textarea
                rows={2}
                value={form.problem_summary}
                onChange={(e) => setForm({ ...form, problem_summary: e.target.value })}
                placeholder="Customer complaint, in one or two sentences"
              />
            </div>
            <div>
              <Label>Resolution steps</Label>
              <Textarea
                rows={8}
                value={form.resolution_steps}
                onChange={(e) => setForm({ ...form, resolution_steps: e.target.value })}
                placeholder="Step-by-step what the agent should do / say"
              />
            </div>
            <div>
              <Label>Tags (comma-separated)</Label>
              <Input
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                placeholder="e.g. no_power, low_backup, fan_noise"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={save} disabled={saving} style={{ background: T.orange, color: '#fff' }}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </IronShell>
  );
}
