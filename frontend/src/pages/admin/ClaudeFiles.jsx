import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
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

const MAX_FILE_BYTES = 50 * 1024 * 1024;

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

function formatDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleString('en-IN');
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

  return (
    <DashboardLayout title="Files for Claude">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">Files for Claude</h2>
        <p className="text-slate-400">
          Upload screenshots, spreadsheets, or any reference file you want to share with Claude in future sessions.
          Each upload gets a permanent number you can quote like <span className="font-mono text-slate-300">&quot;please refer to file number 17&quot;</span>.
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" /> Upload a file
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm text-slate-300 mb-1 block">File (max 50 MB)</label>
            <Input ref={fileInputRef} type="file" onChange={handlePick} />
            {pickedFile && (
              <p className="text-xs text-slate-400 mt-1">
                {pickedFile.name} — {formatBytes(pickedFile.size)}
              </p>
            )}
          </div>
          <div>
            <label className="text-sm text-slate-300 mb-1 block">
              Note (optional) — what is this file? Helps Claude know which one you mean.
            </label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Vyapar GSTR3B export for MGIG April 2026 — the parser dropped all 3.1 rows"
              rows={2}
            />
          </div>
          <Button onClick={handleUpload} disabled={!pickedFile || uploading}>
            {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
            Upload
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Uploaded files</CardTitle>
          <Button variant="outline" size="sm" onClick={fetchFiles} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-slate-400">
              <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Loading...
            </div>
          ) : files.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Upload className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p>No files uploaded yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">#</TableHead>
                    <TableHead>File</TableHead>
                    <TableHead>Note</TableHead>
                    <TableHead className="w-32">Size</TableHead>
                    <TableHead className="w-48">Uploaded</TableHead>
                    <TableHead className="w-56 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {files.map((f) => {
                    const Icon = iconForMime(f.mime_type, f.filename);
                    const isEditing = editingNumber === f.number;
                    return (
                      <TableRow key={f.id}>
                        <TableCell>
                          <Badge className="bg-blue-600 hover:bg-blue-700 text-white font-mono text-base">#{f.number}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-start gap-2">
                            <Icon className="w-4 h-4 mt-1 text-slate-400 flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="font-medium text-slate-100 truncate" title={f.filename}>{f.filename}</p>
                              <p className="text-xs text-slate-500 font-mono truncate" title={f.disk_filename}>{f.disk_filename}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <div className="flex flex-col gap-1">
                              <Textarea
                                value={editNote}
                                onChange={(e) => setEditNote(e.target.value)}
                                rows={2}
                              />
                              <div className="flex gap-1">
                                <Button size="sm" onClick={() => saveNote(f.number)}>Save</Button>
                                <Button size="sm" variant="outline" onClick={() => { setEditingNumber(null); setEditNote(''); }}>Cancel</Button>
                              </div>
                            </div>
                          ) : (
                            <button
                              className="text-left text-slate-300 hover:text-white"
                              onClick={() => { setEditingNumber(f.number); setEditNote(f.note || ''); }}
                              title="Click to edit"
                            >
                              {f.note || <span className="italic text-slate-500">click to add a note</span>}
                            </button>
                          )}
                        </TableCell>
                        <TableCell className="text-slate-400 text-sm">{formatBytes(f.size_bytes)}</TableCell>
                        <TableCell className="text-sm">
                          <p className="text-slate-300">{formatDate(f.created_at)}</p>
                          <p className="text-xs text-slate-500">{f.uploaded_by_name}</p>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="sm" title="Copy reference phrase" onClick={() => copyReference(f.number)}>
                              <Copy className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" title="Edit note" onClick={() => { setEditingNumber(f.number); setEditNote(f.note || ''); }}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" title="Download" onClick={() => handleDownload(f)}>
                              <Download className="w-4 h-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600" title="Delete">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
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
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
