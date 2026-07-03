import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell, badgeStyle } from '@/components/iron/IronKit';
import { Upload, X, ArrowUp, ArrowDown, Loader2, Search, ExternalLink } from 'lucide-react';

const STATUS_TONE = { published: 'ok', hidden: 'slate', no_image: 'warn', no_price: 'warn', inactive: 'bad' };
const STATUS_LABEL = { published: 'Live', hidden: 'Hidden', no_image: 'No image', no_price: 'No price', inactive: 'Inactive' };
const FILTERS = [['', 'All'], ['published', 'Live'], ['no_image', 'No image'], ['no_price', 'No price'], ['hidden', 'Hidden'], ['inactive', 'Inactive']];
const inr = (n) => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');

const inputStyle = { border: '1px solid ' + T.iron200, borderRadius: 6, padding: '8px 10px', fontSize: 13, color: T.iron900, background: T.white, outline: 'none', width: '100%', fontFamily: T.body };
const labelStyle = { display: 'block', marginBottom: 5 };
const btnPrimary = { border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '9px 16px', fontFamily: T.headline, fontWeight: 700, fontSize: 12.5, cursor: 'pointer' };
const btnOutline = { border: '1px solid ' + T.iron200, background: T.white, color: T.iron700, borderRadius: 6, padding: '9px 16px', fontFamily: T.headline, fontWeight: 700, fontSize: 12.5, cursor: 'pointer' };

export default function AdminStoreProducts() {
  const { token } = useAuth();
  const H = { Authorization: `Bearer ${token}` };
  const [data, setData] = useState({ products: [], status_counts: {}, categories: [] });
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (q) params.q = q;
      if (filter) params.status = filter;
      const res = await axios.get(`${API}/admin/store/products`, { headers: H, params });
      setData(res.data);
    } catch (e) { /* noop */ } finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, filter, token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openEdit = (p) => setEdit({ ...p, images: [...(p.images || [])] });
  const upd = (k, v) => setEdit((e) => ({ ...e, [k]: v }));

  const uploadImage = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData(); fd.append('file', file);
      const res = await axios.post(`${API}/master-skus/upload-image`, fd, { headers: { ...H, 'Content-Type': 'multipart/form-data' } });
      const url = res.data.image_url || res.data.url;
      if (url) setEdit((e) => ({ ...e, images: [...(e.images || []), url] }));
    } catch (e) { alert(e.response?.data?.detail || 'Upload failed'); } finally { setUploading(false); }
  };
  const moveImg = (i, dir) => setEdit((e) => { const a = [...e.images]; const j = i + dir; if (j < 0 || j >= a.length) return e; [a[i], a[j]] = [a[j], a[i]]; return { ...e, images: a }; });
  const removeImg = (i) => setEdit((e) => ({ ...e, images: e.images.filter((_, x) => x !== i) }));

  const save = async () => {
    setSaving(true);
    try {
      const body = {
        images: edit.images, description: edit.description || '', seo_title: edit.seo_title || '',
        seo_description: edit.seo_description || '', web_slug: edit.web_slug || '', category: edit.category || '',
        selling_price: Number(edit.selling_price) || 0, mrp: Number(edit.mrp) || 0, store_hidden: !!edit.store_hidden,
      };
      await axios.post(`${API}/admin/store/product/${edit.id}`, body, { headers: H });
      setEdit(null); fetchData();
    } catch (e) { alert(e.response?.data?.detail || 'Save failed'); } finally { setSaving(false); }
  };

  const sc = data.status_counts || {};
  const subtitle = `${data.count || 0} PRODUCTS · ${sc.published || 0} LIVE · ${(sc.no_image || 0) + (sc.no_price || 0)} NEED FIXING`;

  return (
    <IronShell title="Store Products" subtitle={subtitle} onRefresh={fetchData}
      headerRight={<a href="https://store.musclegrid.in/" target="_blank" rel="noreferrer" style={{ ...btnOutline, display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}><ExternalLink size={13} /> View store</a>}>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        {FILTERS.map(([k, lbl]) => (
          <button key={k} onClick={() => setFilter(k)}
            style={{ border: '1px solid ' + (filter === k ? T.orange : T.iron200), background: filter === k ? T.orange : T.white, color: filter === k ? '#fff' : T.iron700, borderRadius: 20, padding: '6px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 11.5, cursor: 'pointer' }}>
            {lbl}{k && sc[k] != null ? ` (${sc[k]})` : ''}
          </button>
        ))}
        <div style={{ position: 'relative', marginLeft: 'auto', minWidth: 240 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: T.iron400 }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or SKU…"
            style={{ ...inputStyle, paddingLeft: 30 }} />
        </div>
      </div>

      <IronCard pad={0}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid ' + T.iron200, background: T.iron50 }}>
              {['', 'Product', 'Category', 'Price', 'Status', ''].map((h, i) => (
                <th key={i} style={thCell}><Caps size={8.5}>{h}</Caps></th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ ...tdCell, textAlign: 'center', padding: 40, color: T.iron400 }}><Loader2 size={18} className="animate-spin" /></td></tr>
            ) : data.products.length === 0 ? (
              <tr><td colSpan={6} style={{ ...tdCell, textAlign: 'center', padding: 40, color: T.iron400 }}>No products</td></tr>
            ) : data.products.map((p) => (
              <tr key={p.id} className="iron-row" style={{ borderBottom: '1px solid ' + T.iron200 }}>
                <td style={{ ...tdCell, width: 52 }}>
                  {p.image_url ? <img src={p.image_url} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6, border: '1px solid ' + T.iron200 }} />
                    : <div style={{ width: 40, height: 40, borderRadius: 6, background: T.iron100, border: '1px dashed ' + T.iron200 }} />}
                </td>
                <td style={tdCell}>
                  <div style={{ fontWeight: 600, color: T.iron900, fontSize: 13 }}>{p.name}</div>
                  <div style={{ ...mono, fontSize: 11, color: T.iron400 }}>{p.sku_code}</div>
                </td>
                <td style={{ ...tdCell, color: T.iron500, fontSize: 12.5 }}>{p.category || '—'}</td>
                <td style={{ ...tdCell, ...mono }}>{p.selling_price ? inr(p.selling_price) : '—'}</td>
                <td style={tdCell}><span style={badgeStyle(STATUS_TONE[p.status] || 'slate')}>{STATUS_LABEL[p.status] || p.status}</span></td>
                <td style={{ ...tdCell, textAlign: 'right' }}>
                  <button onClick={() => openEdit(p)} style={btnOutline}>Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </IronCard>

      {edit && (
        <div onClick={() => !saving && setEdit(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,15,15,.45)', zIndex: 60, display: 'flex', justifyContent: 'flex-end' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(620px,100%)', height: '100%', background: T.white, overflowY: 'auto', boxShadow: '-8px 0 30px rgba(0,0,0,.2)' }}>
            <div style={{ position: 'sticky', top: 0, background: T.white, borderBottom: '1px solid ' + T.iron200, padding: '16px 22px', display: 'flex', alignItems: 'center', gap: 12, zIndex: 2 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: T.headline, fontWeight: 800, fontSize: 16, color: T.iron900 }}>{edit.name}</div>
                <div style={{ ...mono, fontSize: 11, color: T.iron400 }}>{edit.sku_code}</div>
              </div>
              <button onClick={() => setEdit(null)} style={{ ...btnOutline, padding: 8 }}><X size={16} /></button>
            </div>

            <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* Gallery */}
              <div>
                <Caps size={9} color={T.iron400} style={labelStyle}>Images (first = main; drag order with arrows)</Caps>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  {(edit.images || []).map((src, i) => (
                    <div key={i} style={{ position: 'relative', width: 92, height: 92, borderRadius: 8, overflow: 'hidden', border: '1px solid ' + (i === 0 ? T.orange : T.iron200) }}>
                      <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      {i === 0 && <span style={{ position: 'absolute', top: 3, left: 3, background: T.orange, color: '#fff', fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 4, fontFamily: T.headline }}>MAIN</span>}
                      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', background: 'rgba(0,0,0,.5)' }}>
                        <button onClick={() => moveImg(i, -1)} disabled={i === 0} style={{ flex: 1, border: 'none', background: 'none', color: '#fff', cursor: 'pointer', padding: 3, opacity: i === 0 ? 0.3 : 1 }}><ArrowUp size={12} /></button>
                        <button onClick={() => moveImg(i, 1)} disabled={i === (edit.images.length - 1)} style={{ flex: 1, border: 'none', background: 'none', color: '#fff', cursor: 'pointer', padding: 3, opacity: i === (edit.images.length - 1) ? 0.3 : 1 }}><ArrowDown size={12} /></button>
                        <button onClick={() => removeImg(i)} style={{ flex: 1, border: 'none', background: 'none', color: '#fff', cursor: 'pointer', padding: 3 }}><X size={12} /></button>
                      </div>
                    </div>
                  ))}
                  <label style={{ width: 92, height: 92, borderRadius: 8, border: '1px dashed ' + T.iron200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, cursor: 'pointer', color: T.iron400, background: T.iron50 }}>
                    {uploading ? <Loader2 size={18} className="animate-spin" /> : <><Upload size={16} /><span style={{ fontSize: 10, fontFamily: T.headline }}>Upload</span></>}
                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => uploadImage(e.target.files?.[0])} />
                  </label>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><Caps size={9} color={T.iron400} style={labelStyle}>Selling price (₹, GST-incl)</Caps><input type="number" value={edit.selling_price || ''} onChange={(e) => upd('selling_price', e.target.value)} style={inputStyle} /></div>
                <div><Caps size={9} color={T.iron400} style={labelStyle}>MRP (₹, strikethrough)</Caps><input type="number" value={edit.mrp || ''} onChange={(e) => upd('mrp', e.target.value)} style={inputStyle} /></div>
              </div>

              <div><Caps size={9} color={T.iron400} style={labelStyle}>Category</Caps>
                <input list="cats" value={edit.category || ''} onChange={(e) => upd('category', e.target.value)} style={inputStyle} />
                <datalist id="cats">{(data.categories || []).map((c) => <option key={c} value={c} />)}</datalist>
              </div>

              <div><Caps size={9} color={T.iron400} style={labelStyle}>Description</Caps>
                <textarea value={edit.description || ''} onChange={(e) => upd('description', e.target.value)} rows={5} style={{ ...inputStyle, resize: 'vertical' }} /></div>

              <div style={{ borderTop: '1px solid ' + T.iron200, paddingTop: 16 }}>
                <Caps size={9} color={T.orange} style={{ marginBottom: 10 }}>Search engine (SEO)</Caps>
                <div style={{ marginBottom: 10 }}><Caps size={9} color={T.iron400} style={labelStyle}>SEO title</Caps>
                  <input value={edit.seo_title || ''} onChange={(e) => upd('seo_title', e.target.value)} placeholder={edit.name} style={inputStyle} /></div>
                <div style={{ marginBottom: 10 }}><Caps size={9} color={T.iron400} style={labelStyle}>SEO meta description</Caps>
                  <textarea value={edit.seo_description || ''} onChange={(e) => upd('seo_description', e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical' }} /></div>
                <div><Caps size={9} color={T.iron400} style={labelStyle}>URL slug</Caps>
                  <input value={edit.web_slug || ''} onChange={(e) => upd('web_slug', e.target.value)} placeholder="auto from name" style={{ ...inputStyle, fontFamily: T.mono }} /></div>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', borderTop: '1px solid ' + T.iron200, paddingTop: 16 }}>
                <input type="checkbox" checked={!edit.store_hidden} onChange={(e) => upd('store_hidden', !e.target.checked)} style={{ width: 16, height: 16 }} />
                <span style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 13, color: T.iron900 }}>Show on store</span>
                <span style={{ fontSize: 11.5, color: T.iron400 }}>(needs a price and at least one image to go live)</span>
              </label>
            </div>

            <div style={{ position: 'sticky', bottom: 0, background: T.white, borderTop: '1px solid ' + T.iron200, padding: '14px 22px', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setEdit(null)} style={btnOutline}>Cancel</button>
              <button onClick={save} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.6 : 1, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {saving && <Loader2 size={14} className="animate-spin" />} Save
              </button>
            </div>
          </div>
        </div>
      )}
    </IronShell>
  );
}
