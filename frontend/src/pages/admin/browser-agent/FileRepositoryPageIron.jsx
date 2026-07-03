import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/App';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import {
  Folder, File, ArrowLeft, ChevronRight, Download,
  Eye, Home, FileText, Image as ImageIcon, Archive
} from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono } from '@/components/iron/IronKit';

const API = process.env.REACT_APP_BACKEND_URL;

export default function FileRepositoryPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [currentPath, setCurrentPath] = useState('');
  const [contents, setContents] = useState({ folders: [], files: [] });
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  const headers = { Authorization: `Bearer ${token}` };

  const fetchContents = useCallback(async (path = '') => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/file-repository/list?path=${encodeURIComponent(path)}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setContents(data);
        setCurrentPath(path);
      } else {
        toast.error('Failed to load folder');
      }
    } catch (err) {
      toast.error('Error loading folder');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    fetchContents('');
  }, [fetchContents]);

  const navigateToFolder = (folderName) => {
    const newPath = currentPath ? `${currentPath}/${folderName}` : folderName;
    fetchContents(newPath);
  };

  const navigateUp = () => {
    const parts = currentPath.split('/');
    parts.pop();
    fetchContents(parts.join('/'));
  };

  const navigateToRoot = () => {
    fetchContents('');
  };

  const getBreadcrumbs = () => {
    if (!currentPath) return [];
    return currentPath.split('/');
  };

  const navigateToBreadcrumb = (index) => {
    const parts = currentPath.split('/');
    const newPath = parts.slice(0, index + 1).join('/');
    fetchContents(newPath);
  };

  const getFileIcon = (filename) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'pdf':
        return <FileText className="w-4 h-4" style={{ color: T.orangeDeep }} />;
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
      case 'webp':
        return <ImageIcon className="w-4 h-4" style={{ color: T.green }} />;
      case 'zip':
      case 'rar':
      case '7z':
        return <Archive className="w-4 h-4" style={{ color: T.voltageText }} />;
      default:
        return <File className="w-4 h-4" style={{ color: T.iron400 }} />;
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '-';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const downloadFile = (filename) => {
    const fullPath = currentPath ? `${currentPath}/${filename}` : filename;
    window.open(`${API}/api/files/${fullPath}`, '_blank');
  };

  const previewFile = (filename) => {
    const fullPath = currentPath ? `${currentPath}/${filename}` : filename;
    setSelectedFile({
      name: filename,
      url: `${API}/api/files/${fullPath}`,
      type: filename.split('.').pop()?.toLowerCase()
    });
  };

  const rowBase = { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: `1px solid ${T.iron200}` };
  const iconBtn = { border: `1px solid ${T.iron200}`, background: T.white, borderRadius: 6, height: 30, width: 30, display: 'grid', placeItems: 'center', cursor: 'pointer', color: T.iron700 };

  const headerRight = (
    <button
      onClick={() => navigate(-1)}
      style={{ border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, borderRadius: 6, padding: '8px 12px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
    >
      <ArrowLeft className="w-4 h-4" /> Back
    </button>
  );

  return (
    <IronShell
      title="File Repository"
      subtitle="BROWSE INVOICES, LABELS & DOCUMENTS"
      onRefresh={() => fetchContents(currentPath)}
      headerRight={headerRight}
    >
      <div data-testid="file-repository-page" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Breadcrumb Navigation */}
        <IronCard pad={0}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '10px 12px', flexWrap: 'wrap' }}>
            <button onClick={navigateToRoot} style={iconBtn} title="Root">
              <Home className="w-4 h-4" />
            </button>
            {getBreadcrumbs().map((part, index) => (
              <React.Fragment key={index}>
                <ChevronRight className="w-4 h-4" style={{ color: T.iron400 }} />
                <button
                  onClick={() => navigateToBreadcrumb(index)}
                  style={{ border: 'none', background: 'transparent', color: T.iron700, fontFamily: T.body, fontSize: 12.5, padding: '4px 8px', borderRadius: 6, cursor: 'pointer', ...mono }}
                >
                  {part}
                </button>
              </React.Fragment>
            ))}
            {!currentPath && <Caps size={9} style={{ marginLeft: 4 }}>Root</Caps>}
          </div>
        </IronCard>

        {/* Main Content */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr)', gap: 14, alignItems: 'start' }}>
          {/* File Browser */}
          <IronCard pad={0} style={{ overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
              <Folder className="w-4 h-4" style={{ color: T.orange }} />
              <Caps size={8.5}>Files & Folders</Caps>
            </div>

            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: T.iron500, fontSize: 13 }}>
                Loading...
              </div>
            ) : (
              <div>
                {/* Back button if not at root */}
                {currentPath && (
                  <div className="iron-row" onClick={navigateUp} style={{ ...rowBase, cursor: 'pointer' }}>
                    <ArrowLeft className="w-4 h-4" style={{ color: T.iron400 }} />
                    <span style={{ color: T.iron500, fontSize: 13, ...mono }}>..</span>
                  </div>
                )}

                {/* Folders */}
                {contents.folders.map((folder, index) => (
                  <div
                    key={`folder-${index}`}
                    className="iron-row"
                    onClick={() => navigateToFolder(folder.name)}
                    style={{ ...rowBase, cursor: 'pointer' }}
                  >
                    <Folder className="w-4 h-4" style={{ color: T.orange }} />
                    <span style={{ flex: 1, color: T.iron900, fontWeight: 600, fontSize: 13 }}>{folder.name}</span>
                    <ChevronRight className="w-4 h-4" style={{ color: T.iron400 }} />
                  </div>
                ))}

                {/* Files */}
                {contents.files.map((file, index) => (
                  <div key={`file-${index}`} className="iron-row" style={rowBase}>
                    {getFileIcon(file.name)}
                    <span style={{ flex: 1, color: T.iron900, fontSize: 13, wordBreak: 'break-all' }}>{file.name}</span>
                    <span style={{ fontSize: 11.5, color: T.iron500, ...mono }} className="hidden sm:block">
                      {formatFileSize(file.size)}
                    </span>
                    <span style={{ fontSize: 11.5, color: T.iron500, ...mono }} className="hidden md:block">
                      {formatDate(file.modified)}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button onClick={() => previewFile(file.name)} style={iconBtn} title="Preview">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button onClick={() => downloadFile(file.name)} style={iconBtn} title="Download">
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}

                {/* Empty state */}
                {contents.folders.length === 0 && contents.files.length === 0 && (
                  <div style={{ padding: 40, textAlign: 'center', color: T.iron500 }}>
                    <Folder className="w-10 h-10" style={{ margin: '0 auto 8px', opacity: 0.4 }} />
                    <p style={{ fontSize: 13 }}>This folder is empty</p>
                  </div>
                )}
              </div>
            )}
          </IronCard>

          {/* Preview Panel */}
          <IronCard pad={0} style={{ overflow: 'hidden' }}>
            <div style={{ padding: '9px 14px', borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
              <Caps size={8.5}>Preview</Caps>
            </div>
            <div style={{ padding: 14 }}>
              {selectedFile ? (
                <div>
                  <p style={{ fontSize: 12.5, fontWeight: 600, color: T.iron900, marginBottom: 10, wordBreak: 'break-all' }}>
                    {selectedFile.name}
                  </p>
                  {selectedFile.type === 'pdf' ? (
                    <iframe
                      src={selectedFile.url}
                      style={{ width: '100%', height: 384, border: `1px solid ${T.iron200}`, borderRadius: 6 }}
                      title="PDF Preview"
                    />
                  ) : ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(selectedFile.type) ? (
                    <img
                      src={selectedFile.url}
                      alt={selectedFile.name}
                      style={{ width: '100%', height: 'auto', borderRadius: 6, border: `1px solid ${T.iron200}` }}
                    />
                  ) : (
                    <div style={{ height: 192, display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.iron100, borderRadius: 6 }}>
                      <p style={{ color: T.iron500, fontSize: 13 }}>Preview not available</p>
                    </div>
                  )}
                  <button
                    onClick={() => window.open(selectedFile.url, '_blank')}
                    style={{ width: '100%', marginTop: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '9px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
                  >
                    <Download className="w-4 h-4" /> Download
                  </button>
                </div>
              ) : (
                <div style={{ height: 192, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.iron500 }}>
                  <p style={{ fontSize: 13 }}>Select a file to preview</p>
                </div>
              )}
            </div>
          </IronCard>
        </div>

        {/* Folder Structure Info */}
        <IronCard pad={14} style={{ background: T.blueTint, borderColor: '#CBE0F0' }}>
          <div style={{ marginBottom: 8 }}>
            <Caps size={9} color={T.blue}>Folder Structure</Caps>
          </div>
          <div style={{ fontSize: 12.5, color: T.iron700, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <p><strong style={{ ...mono }}>amazon_orders/</strong> - Amazon order invoices and shipping labels (by date)</p>
            <p><strong style={{ ...mono }}>invoices/</strong> - Sales and purchase invoices</p>
            <p><strong style={{ ...mono }}>tickets/</strong> - Support ticket documents and labels</p>
            <p><strong style={{ ...mono }}>Dispatches/</strong> - Dispatch labels and manifests</p>
            <p><strong style={{ ...mono }}>Returns/</strong> - Return shipment documents</p>
          </div>
        </IronCard>
      </div>
    </IronShell>
  );
}
