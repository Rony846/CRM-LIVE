import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/App';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { 
  Folder, File, ArrowLeft, ChevronRight, Download, 
  Eye, Home, RefreshCw, FileText, Image, Archive
} from 'lucide-react';

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
        return <FileText className="w-5 h-5 text-red-400" />;
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
      case 'webp':
        return <Image className="w-5 h-5 text-green-400" />;
      case 'zip':
      case 'rar':
      case '7z':
        return <Archive className="w-5 h-5 text-yellow-400" />;
      default:
        return <File className="w-5 h-5 text-gray-400" />;
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

  return (
    <div className="p-6 space-y-4" data-testid="file-repository-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">File Repository</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Browse invoices, labels, and documents</p>
          </div>
        </div>
        <button
          onClick={() => fetchContents(currentPath)}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-1 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <button
          onClick={navigateToRoot}
          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
        >
          <Home className="w-4 h-4 text-gray-600 dark:text-gray-400" />
        </button>
        {getBreadcrumbs().map((part, index) => (
          <React.Fragment key={index}>
            <ChevronRight className="w-4 h-4 text-gray-400" />
            <button
              onClick={() => navigateToBreadcrumb(index)}
              className="px-2 py-1 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              {part}
            </button>
          </React.Fragment>
        ))}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* File Browser */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-500">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
              Loading...
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {/* Back button if not at root */}
              {currentPath && (
                <div
                  onClick={navigateUp}
                  className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                >
                  <ArrowLeft className="w-5 h-5 text-gray-400" />
                  <span className="text-gray-600 dark:text-gray-400">..</span>
                </div>
              )}
              
              {/* Folders */}
              {contents.folders.map((folder, index) => (
                <div
                  key={`folder-${index}`}
                  onClick={() => navigateToFolder(folder.name)}
                  className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                >
                  <Folder className="w-5 h-5 text-yellow-500" />
                  <span className="flex-1 text-gray-900 dark:text-white font-medium">{folder.name}</span>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </div>
              ))}
              
              {/* Files */}
              {contents.files.map((file, index) => (
                <div
                  key={`file-${index}`}
                  className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  {getFileIcon(file.name)}
                  <span className="flex-1 text-gray-900 dark:text-white">{file.name}</span>
                  <span className="text-sm text-gray-500 dark:text-gray-400 hidden sm:block">
                    {formatFileSize(file.size)}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400 hidden md:block">
                    {formatDate(file.modified)}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => previewFile(file.name)}
                      className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded"
                      title="Preview"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => downloadFile(file.name)}
                      className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded"
                      title="Download"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              
              {/* Empty state */}
              {contents.folders.length === 0 && contents.files.length === 0 && (
                <div className="p-8 text-center text-gray-500">
                  <Folder className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>This folder is empty</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Preview Panel */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white">Preview</h3>
          </div>
          <div className="p-4">
            {selectedFile ? (
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white mb-2 truncate">
                  {selectedFile.name}
                </p>
                {selectedFile.type === 'pdf' ? (
                  <iframe
                    src={selectedFile.url}
                    className="w-full h-96 border border-gray-200 dark:border-gray-700 rounded"
                    title="PDF Preview"
                  />
                ) : ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(selectedFile.type) ? (
                  <img
                    src={selectedFile.url}
                    alt={selectedFile.name}
                    className="w-full h-auto rounded"
                  />
                ) : (
                  <div className="h-48 flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded">
                    <p className="text-gray-500">Preview not available</p>
                  </div>
                )}
                <button
                  onClick={() => window.open(selectedFile.url, '_blank')}
                  className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                >
                  <Download className="w-4 h-4" /> Download
                </button>
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-gray-500">
                <p>Select a file to preview</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Folder Structure Info */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
        <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">Folder Structure</h3>
        <div className="text-sm text-blue-800 dark:text-blue-400 space-y-1">
          <p><strong>amazon_orders/</strong> - Amazon order invoices and shipping labels (by date)</p>
          <p><strong>invoices/</strong> - Sales and purchase invoices</p>
          <p><strong>tickets/</strong> - Support ticket documents and labels</p>
          <p><strong>Dispatches/</strong> - Dispatch labels and manifests</p>
          <p><strong>Returns/</strong> - Return shipment documents</p>
        </div>
      </div>
    </div>
  );
}
