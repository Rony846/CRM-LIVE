import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import {
  Upload, Download, Trash2, Loader2, FileText, Image as ImageIcon,
  FileSpreadsheet, FileQuestion, Pencil, Copy, RefreshCw,
} from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell, badgeStyle, fmtDateTime } from '@/components/iron/IronKit';

const MAX_FILE_BYTES = 50 * 1024 * 1024;

const inputStyle = { border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '7px 10px', fontSize: 12.5, color: T.iron900, background: T.white, fontFamily: T.body, outline: 'none', width: '100%' };
const btnPrimary = { border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
const btnOutline = { border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, borderRadius: 6, padding: '7px 12px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
const iconBtn = { border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, borderRadius: 6, width: 30, height: 30, display: 'inline-grid', placeItems: 'center', cursor: 'pointer' };

function iconForMime(mime, filename = '') {
  const m = (mime || '').toLowerCase();
  const ext = (filename.split('.').pop() || '').toLowerCase();
  if (m.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext)) return ImageIcon;
  if (m.includes('spreadsheet') || ['xlsx', 'xls', 'csv'].includes(ext)) return FileSpreadsheet;
  if (m.includes('pdf') || m.startsWith('text/') || ['pdf', 'txt', 'md', 'log'].includes(ext)) return FileText;
  return FileQuestion;
}

function formatBytes(n) {
  if (!n && n !== 0) return '-';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export default function ClaudeFiles() {
  const { token } = useAuth();
  const headers = { Authorization: `Bearer ${token}` };

  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [pickedFiles, setPickedFiles] = useState([]); // [{ file, url }]
  const [note, setNote] = useState('');
  const fileInputRef = useRef(null);

  const [editingNumber, setEditingNumber] = useState(null);
  const [editNote, setEditNote] = useState('');

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/claude-files`, { headers });
      setFiles(res.data || []);
    } catch (e) {
      toast.error('Failed to load files');
    } finally {
      setLoading(false);
    }
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchFiles(); }, [fetchFiles]);

  const addFiles = (fileList) => {
    const arr = Array.from(fileList || []);
    const valid = [];
    for (const f of arr) {
      if (f.size > MAX_FILE_BYTES) { toast.error(`${f.name} exceeds 50 MB — skipped`); continue; }
      valid.push({ file: f, url: (f.type || '').startsWith('image/') ? URL.createObjectURL(f) : null });
    }
    if (valid.length) setPickedFiles((prev) => [...prev, ...valid]);
  };

  const removePicked = (idx) => setPickedFiles((prev) => {
    const it = prev[idx]; if (it?.url) URL.revokeObjectURL(it.url);
    return prev.filter((_, i) => i !== idx);
  });

  const clearPicked = () => setPickedFiles((prev) => { prev.forEach((it) => it.url && URL.revokeObjectURL(it.url)); return []; });

  const handlePick = (e) => { addFiles(e.target.files); e.target.value = ''; };

  // Paste a screenshot from the clipboard (Ctrl/Cmd+V anywhere on this page)
  useEffect(() => {
    const onPaste = (e) => {
      if (e.target && ['INPUT', 'TEXTAREA'].includes(e.target.tagName) && e.target.type !== 'file') {
        // still allow image paste even while typing a note
      }
      const items = e.clipboardData?.items || [];
      for (const it of items) {
        if (it.type && it.type.startsWith('image/')) {
          const blob = it.getAsFile();
          if (blob) {
            const ext = (blob.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
            addFiles([new File([blob], `screenshot-${Date.now()}.${ext}`, { type: blob.type })]);
            toast.success('Screenshot pasted — click Upload');
            e.preventDefault();
            return;
          }
        }
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleUpload = async () => {
    if (!pickedFiles.length) {
      toast.error('Pick at least one file');
      return;
    }
    setUploading(true);
    const nums = [];
    const remaining = []; // items that failed — keep them queued for retry
    // Upload sequentially so the file numbers stay in order.
    for (const it of pickedFiles) {
      try {
        const fd = new FormData();
        fd.append('file', it.file);
        if (note.trim()) fd.append('note', note.trim());
        const res = await axios.post(`${API}/claude-files`, fd, { headers });
        nums.push(res.data.number);
        if (it.url) URL.revokeObjectURL(it.url);
      } catch (e) {
        remaining.push(it);
        toast.error(`${it.file.name}: ${e.response?.data?.detail || 'upload failed'}`);
      }
    }
    if (nums.length === 1) toast.success(`Uploaded as file #${nums[0]}`);
    else if (nums.length > 1) toast.success(`Uploaded ${nums.length} files: #${nums[0]}–#${nums[nums.length - 1]}`);
    setPickedFiles(remaining);
    if (!remaining.length) { setNote(''); if (fileInputRef.current) fileInputRef.current.value = ''; }
    setUploading(false);
    fetchFiles();
  };

  const handleDownload = async (record) => {
    try {
      const res = await axios.get(`${API}/claude-files/${record.number}/download`, {
        headers, responseType: 'blob',
      });
      const url = window.URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = record.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      toast.error('Download failed');
    }
  };

  const handleDelete = async (number) => {
    try {
      await axios.delete(`${API}/claude-files/${number}`, { headers });
      toast.success(`File #${number} deleted`);
      fetchFiles();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Delete failed');
    }
  };

  const saveNote = async (number) => {
    try {
      await axios.patch(`${API}/claude-files/${number}`, { note: editNote }, { headers });
      toast.success('Note saved');
      setEditingNumber(null);
      setEditNote('');
      fetchFiles();
    } catch (e) {
      toast.error('Failed to save note');
    }
  };

  const copyReference = (number) => {
    const text = `please refer to file number ${number}`;
    navigator.clipboard.writeText(text).then(
      () => toast.success(`Copied: "${text}"`),
      () => toast.error('Copy failed')
    );
  };

  const H = ['#', 'File', 'Note', 'Size', 'Uploaded', 'Actions'];

  return (
    <IronShell title="Files for Claude" subtitle="FOC · REFERENCE REPOSITORY" onRefresh={fetchFiles}>
      {/* Intro */}
      <div style={{ marginBottom: 16, maxWidth: 900 }}>
        <div style={{ fontFamily: T.headline, fontWeight: 800, fontSize: 20, color: T.iron900 }}>Files for Claude</div>
        <p style={{ fontFamily: T.body, fontSize: 13, color: T.iron500, marginTop: 6, lineHeight: 1.55 }}>
          Upload screenshots, spreadsheets, or any reference file you want to share with Claude in future sessions.
          Each upload gets a permanent number you can quote like{' '}
          <span style={{ ...mono, fontSize: 12, color: T.iron700 }}>&quot;please refer to file number 17&quot;</span>.
        </p>
      </div>

      {/* Upload card */}
      <IronCard style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <Upload size={16} color={T.orange} />
          <Caps size={11} color={T.iron700}>Upload a File</Caps>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <Caps size={9} color={T.iron400} style={{ display: 'block', marginBottom: 6 }}>Files (max 50 MB each) — pick several at once</Caps>
            <input ref={fileInputRef} type="file" multiple onChange={handlePick} style={{ ...inputStyle, padding: '6px 8px', cursor: 'pointer' }} />
            <div style={{ marginTop: 8, padding: '10px 12px', border: `1px dashed ${T.iron300}`, borderRadius: 8, background: T.iron50, textAlign: 'center', fontSize: 12, color: T.iron500 }}>
              📋 <b>Paste a screenshot</b> from your clipboard — just press <b>Ctrl / Cmd + V</b> anywhere on this page. You can add more before uploading.
            </div>
            {pickedFiles.length > 0 && (
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Caps size={9} color={T.iron500}>{pickedFiles.length} file{pickedFiles.length > 1 ? 's' : ''} queued</Caps>
                  <button onClick={clearPicked} style={{ border: 'none', background: 'none', color: T.iron500, fontSize: 11, cursor: 'pointer', textDecoration: 'underline' }}>Clear all</button>
                </div>
                {pickedFiles.map((it, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 8px', border: `1px solid ${T.iron200}`, borderRadius: 6, background: T.white }}>
                    {it.url && <img src={it.url} alt="preview" style={{ height: 36, width: 48, objectFit: 'cover', borderRadius: 4, border: `1px solid ${T.iron200}` }} />}
                    <span style={{ ...mono, fontSize: 11, color: T.iron600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.file.name} — {formatBytes(it.file.size)}</span>
                    <button onClick={() => removePicked(i)} disabled={uploading} title="Remove" style={{ border: 'none', background: 'none', color: T.iron400, cursor: 'pointer', fontSize: 15, lineHeight: 1 }}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <Caps size={9} color={T.iron400} style={{ display: 'block', marginBottom: 6 }}>
              Note (optional) — what is this file?
            </Caps>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Vyapar GSTR3B export for MGIG April 2026 — the parser dropped all 3.1 rows"
              rows={2}
              style={{ ...inputStyle, resize: 'vertical', fontFamily: T.body }}
            />
          </div>
          <div>
            <button onClick={handleUpload} disabled={!pickedFiles.length || uploading} style={{ ...btnPrimary, opacity: (!pickedFiles.length || uploading) ? 0.55 : 1, cursor: (!pickedFiles.length || uploading) ? 'not-allowed' : 'pointer' }}>
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {uploading ? 'Uploading…' : `Upload${pickedFiles.length > 1 ? ` ${pickedFiles.length} files` : ''}`}
            </button>
          </div>
        </div>
      </IronCard>

      {/* Files table */}
      <IronCard pad={0}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: `1px solid ${T.iron200}` }}>
          <Caps size={11} color={T.iron700}>Uploaded Files</Caps>
          <button onClick={fetchFiles} disabled={loading} style={{ ...btnOutline, opacity: loading ? 0.6 : 1 }}>
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 0', color: T.iron400, fontFamily: T.body, fontSize: 13 }}>
            <Loader2 size={18} className="animate-spin" style={{ marginRight: 8 }} /> Loading...
          </div>
        ) : files.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: T.iron400 }}>
            <Upload size={36} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
            <p style={{ fontFamily: T.body, fontSize: 13 }}>No files uploaded yet</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                  {H.map((h) => (
                    <th key={h} style={{ ...thCell, textAlign: h === 'Actions' ? 'right' : 'left' }}><Caps size={8.5}>{h}</Caps></th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {files.map((f) => {
                  const Icon = iconForMime(f.mime_type, f.filename);
                  const isEditing = editingNumber === f.number;
                  return (
                    <tr key={f.id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                      <td style={tdCell}>
                        <span style={{ ...badgeStyle('info'), ...mono, fontSize: 11 }}>#{f.number}</span>
                      </td>
                      <td style={tdCell}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                          <Icon size={16} color={T.iron400} style={{ marginTop: 2, flexShrink: 0 }} />
                          <div style={{ minWidth: 0 }}>
                            <p style={{ fontFamily: T.body, fontWeight: 600, fontSize: 12.5, color: T.iron900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 320 }} title={f.filename}>{f.filename}</p>
                            <p style={{ ...mono, fontSize: 10.5, color: T.iron400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 320 }} title={f.disk_filename}>{f.disk_filename}</p>
                          </div>
                        </div>
                      </td>
                      <td style={{ ...tdCell, minWidth: 220 }}>
                        {isEditing ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <textarea
                              value={editNote}
                              onChange={(e) => setEditNote(e.target.value)}
                              rows={2}
                              style={{ ...inputStyle, resize: 'vertical', fontFamily: T.body }}
                            />
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button style={btnPrimary} onClick={() => saveNote(f.number)}>Save</button>
                              <button style={btnOutline} onClick={() => { setEditingNumber(null); setEditNote(''); }}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <button
                            style={{ textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: T.body, fontSize: 12.5, color: f.note ? T.iron700 : T.iron400, fontStyle: f.note ? 'normal' : 'italic', padding: 0 }}
                            onClick={() => { setEditingNumber(f.number); setEditNote(f.note || ''); }}
                            title="Click to edit"
                          >
                            {f.note || 'click to add a note'}
                          </button>
                        )}
                      </td>
                      <td style={{ ...tdCell, ...mono, color: T.iron500 }}>{formatBytes(f.size_bytes)}</td>
                      <td style={tdCell}>
                        <p style={{ ...mono, fontSize: 11.5, color: T.iron700 }}>{fmtDateTime(f.created_at)}</p>
                        <p style={{ fontFamily: T.body, fontSize: 11, color: T.iron400 }}>{f.uploaded_by_name}</p>
                      </td>
                      <td style={{ ...tdCell, textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                          <button style={iconBtn} title="Copy reference phrase" onClick={() => copyReference(f.number)}>
                            <Copy size={14} />
                          </button>
                          <button style={iconBtn} title="Edit note" onClick={() => { setEditingNumber(f.number); setEditNote(f.note || ''); }}>
                            <Pencil size={14} />
                          </button>
                          <button style={iconBtn} title="Download" onClick={() => handleDownload(f)}>
                            <Download size={14} />
                          </button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <button style={{ ...iconBtn, color: T.orangeDeep, borderColor: '#F6D8BA' }} title="Delete">
                                <Trash2 size={14} />
                              </button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete file #{f.number}?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  The bytes will be removed from disk. The number stays reserved so future uploads keep increasing.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(f.number)}>Delete</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </IronCard>
    </IronShell>
  );
}
