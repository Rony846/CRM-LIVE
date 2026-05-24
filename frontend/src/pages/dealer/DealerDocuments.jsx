import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  Download, FileText, FileCheck, CreditCard, Shield, Search, Loader2,
  Calendar, IndianRupee, ExternalLink, File, FolderOpen
} from 'lucide-react';

const BADGE_BASE = 'px-2 py-0.5 text-[10px] font-mono font-semibold rounded uppercase tracking-wide ring-1';

const DOC_TYPE_CONFIG = {
  certificate: {
    icon: FileCheck,
    tone: 'bg-amber-400/15 text-amber-400 ring-amber-400/25',
    iconTone: 'bg-amber-400/15 text-amber-400',
    label: 'Certificate'
  },
  invoice: {
    icon: FileText,
    tone: 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/25',
    iconTone: 'bg-emerald-500/15 text-emerald-500',
    label: 'Invoice'
  },
  proforma: {
    icon: File,
    tone: 'bg-sky-400/15 text-sky-400 ring-sky-400/25',
    iconTone: 'bg-sky-400/15 text-sky-400',
    label: 'Proforma'
  },
  payment: {
    icon: CreditCard,
    tone: 'bg-violet-400/15 text-violet-400 ring-violet-400/25',
    iconTone: 'bg-violet-400/15 text-violet-400',
    label: 'Payment'
  },
  deposit: {
    icon: Shield,
    tone: 'bg-sky-400/15 text-sky-400 ring-sky-400/25',
    iconTone: 'bg-sky-400/15 text-sky-400',
    label: 'Deposit'
  }
};

export default function DealerDocuments() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [downloading, setDownloading] = useState(null);

  useEffect(() => {
    if (token) {
      fetchDocuments();
    }
  }, [token]);

  const fetchDocuments = async () => {
    try {
      const response = await axios.get(`${API}/dealer/documents`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(response.data);
    } catch (error) {
      toast.error('Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (doc) => {
    setDownloading(doc.id);
    try {
      if (doc.type === 'certificate') {
        // Certificate needs special handling
        const response = await axios.get(`${API}/dealer/certificate/download`, {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        });

        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `MuscleGrid_Dealer_Certificate.pdf`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);

        toast.success('Certificate downloaded');
      } else if (doc.download_url) {
        // For direct file URLs
        if (doc.download_url.startsWith('http') || doc.download_url.startsWith('/uploads')) {
          window.open(doc.download_url.startsWith('http') ? doc.download_url : `${API.replace('/api', '')}${doc.download_url}`, '_blank');
          toast.success('Opening document...');
        } else {
          // API endpoint
          const response = await axios.get(`${API}${doc.download_url.replace('/api', '')}`, {
            headers: { Authorization: `Bearer ${token}` },
            responseType: 'blob'
          });

          const url = window.URL.createObjectURL(new Blob([response.data]));
          const link = document.createElement('a');
          link.href = url;
          link.setAttribute('download', `${doc.name.replace(/\s+/g, '_')}.pdf`);
          document.body.appendChild(link);
          link.click();
          link.remove();
          window.URL.revokeObjectURL(url);

          toast.success('Document downloaded');
        }
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to download document');
    } finally {
      setDownloading(null);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const filteredDocuments = (data?.documents || []).filter(doc => {
    if (activeTab !== 'all' && doc.type !== activeTab) return false;
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (doc.name || '').toLowerCase().includes(term) ||
      (doc.description || '').toLowerCase().includes(term)
    );
  });

  // Count by type
  const countByType = (data?.documents || []).reduce((acc, doc) => {
    acc[doc.type] = (acc[doc.type] || 0) + 1;
    return acc;
  }, {});

  if (loading) {
    return (
      <DashboardLayout title="Download Center">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Download Center">
      <div className="space-y-6">
        {/* Page header */}
        <div>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-1">
            Account · Files
          </p>
          <h1 className="text-[26px] font-bold leading-tight tracking-tight text-foreground">Download Center</h1>
          <p className="mt-1 text-sm text-muted-foreground">Access all your documents, invoices, and certificates</p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {Object.entries(DOC_TYPE_CONFIG).map(([type, config]) => {
            const Icon = config.icon;
            const count = countByType[type] || 0;
            return (
              <button
                key={type}
                onClick={() => setActiveTab(type)}
                className={`mg-card rounded-lg border bg-card p-4 text-left transition-all hover:border-primary/40 ${
                  activeTab === type ? 'border-primary/60 ring-1 ring-primary/30' : 'border-border'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground truncate">
                      {config.label}
                    </p>
                    <p className="mt-1 font-mono text-xl font-bold tabular-nums text-foreground">{count}</p>
                  </div>
                  <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded ${config.iconTone}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Filter bar */}
        <div className="mg-card rounded-lg border border-border bg-card p-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search documents..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="invoice">Invoices</TabsTrigger>
                <TabsTrigger value="proforma">PI</TabsTrigger>
                <TabsTrigger value="payment">Payments</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {/* Documents list */}
        {filteredDocuments.length === 0 ? (
          <div className="mg-card rounded-lg border border-border bg-card p-12 text-center">
            <FolderOpen className="w-14 h-14 text-muted-foreground/25 mx-auto mb-4" />
            <h3 className="text-base font-semibold text-foreground mb-1">No Documents Found</h3>
            <p className="text-sm text-muted-foreground">
              {searchTerm || activeTab !== 'all'
                ? 'No documents match your search criteria'
                : 'Your documents will appear here once you have orders and transactions'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredDocuments.map((doc) => {
              const typeConfig = DOC_TYPE_CONFIG[doc.type] || DOC_TYPE_CONFIG.invoice;
              const Icon = typeConfig.icon;
              const isDownloading = downloading === doc.id;

              return (
                <div
                  key={doc.id}
                  className="mg-card rounded-lg border border-border bg-card p-4 hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded ${typeConfig.iconTone}`}>
                      <Icon className="w-5 h-5" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold text-foreground truncate">{doc.name}</h3>
                          <p className="text-[12px] text-muted-foreground truncate mt-0.5">{doc.description}</p>
                        </div>
                        <span className={`${BADGE_BASE} ${typeConfig.tone} flex-shrink-0`}>
                          {typeConfig.label}
                        </span>
                      </div>

                      <div className="flex items-center justify-between mt-3">
                        {doc.created_at ? (
                          <span className="font-mono text-[11px] tabular-nums text-muted-foreground flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(doc.created_at)}
                          </span>
                        ) : (
                          <span />
                        )}

                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleDownload(doc)}
                          disabled={isDownloading || !doc.available}
                        >
                          {isDownloading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <Download className="w-3.5 h-3.5 mr-1.5" />
                              Download
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Help note */}
        <div className="mg-card rounded-lg border border-primary/20 bg-primary/5 p-4">
          <div className="flex items-start gap-3">
            <FileText className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-foreground">Need Help?</p>
              <p className="text-sm text-muted-foreground mt-1">
                Documents are automatically generated when orders are processed. If you need a specific document
                or notice any errors, please raise a support ticket and our team will assist you.
              </p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
