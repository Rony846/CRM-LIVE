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
  const [pickedFile, setPickedFile] = useState(null);
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

  const handlePick = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_FILE_BYTES) {
      toast.error('File exceeds 50 MB limit');
      e.target.value = '';
      return;
    }
    setPickedFile(f);
  };

  const handleUpload = async () => {
    if (!pickedFile) {
      toast.error('Pick a file first');
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', pickedFile);
      if (note.trim()) fd.append('note', note.trim());
      const res = await axios.post(`${API}/claude-files`, fd, { headers });
      toast.success(`Uploaded as file #${res.data.number}`);
      setPickedFile(null);
      setNote('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      fetchFiles();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Upload failed');
    } finally {
      setUploading(false);
    }
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
            <Caps size={9} color={T.iron400} style={{ display: 'block', marginBottom: 6 }}>File (max 50 MB)</Caps>
            <input ref={fileInputRef} type="file" onChange={handlePick} style={{ ...inputStyle, padding: '6px 8px', cursor: 'pointer' }} />
            {pickedFile && (
              <p style={{ ...mono, fontSize: 11, color: T.iron500, marginTop: 6 }}>
                {pickedFile.name} — {formatBytes(pickedFile.size)}
              </p>
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
            <button onClick={handleUpload} disabled={!pickedFile || uploading} style={{ ...btnPrimary, opacity: (!pickedFile || uploading) ? 0.55 : 1, cursor: (!pickedFile || uploading) ? 'not-allowed' : 'pointer' }}>
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              Upload
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
