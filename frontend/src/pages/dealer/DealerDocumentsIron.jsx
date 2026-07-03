import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { toast } from 'sonner';
import {
  Download, FileText, FileCheck, CreditCard, Shield, Search, Loader2,
  Calendar, File, FolderOpen
} from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, badgeStyle } from '@/components/iron/IronKit';

const inputStyle = { border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '7px 10px', fontSize: 12.5, color: T.iron900, background: T.white, fontFamily: T.body, outline: 'none' };

// Doc-type visual config, mapped to Iron palette + badge tones.
const DOC_TYPE_CONFIG = {
  certificate: { icon: FileCheck, tone: 'warn', accent: T.voltageText, label: 'Certificate' },
  invoice: { icon: FileText, tone: 'ok', accent: T.green, label: 'Invoice' },
  proforma: { icon: File, tone: 'info', accent: T.blue, label: 'Proforma' },
  payment: { icon: CreditCard, tone: 'violet', accent: '#6D4AB0', label: 'Payment' },
  deposit: { icon: Shield, tone: 'info', accent: T.blue, label: 'Deposit' },
};

const TABS = [
  ['all', 'All'],
  ['invoice', 'Invoices'],
  ['proforma', 'PI'],
  ['payment', 'Payments'],
];

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

  const headerRight = (
    <div style={{ position: 'relative' }}>
      <Search size={14} color={T.iron400} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
      <input
        placeholder="Search documents..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        style={{ ...inputStyle, paddingLeft: 30, width: 220 }}
      />
    </div>
  );

  if (loading) {
    return (
      <IronShell title="Documents" subtitle="ACCOUNT · FILES" onRefresh={fetchDocuments} roleLabel="Dealer Portal">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 240 }}>
          <Loader2 className="w-8 h-8 animate-spin" color={T.orange} />
        </div>
      </IronShell>
    );
  }

  return (
    <IronShell title="Documents" subtitle="ACCOUNT · FILES" onRefresh={fetchDocuments} roleLabel="Dealer Portal" headerRight={headerRight}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1180 }}>
        {/* Intro */}
        <div>
          <Caps size={9} color={T.iron400}>Download Center</Caps>
          <div style={{ fontFamily: T.headline, fontWeight: 800, fontSize: 22, color: T.iron900, marginTop: 2 }}>Download Center</div>
          <div style={{ fontSize: 13, color: T.iron500, marginTop: 2 }}>Access all your documents, invoices, and certificates</div>
        </div>

        {/* Quick stats — clickable type tiles */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
          {Object.entries(DOC_TYPE_CONFIG).map(([type, config]) => {
            const Icon = config.icon;
            const count = countByType[type] || 0;
            const active = activeTab === type;
            return (
              <button
                key={type}
                onClick={() => setActiveTab(type)}
                style={{
                  textAlign: 'left', cursor: 'pointer', background: T.white,
                  border: `1px solid ${active ? T.orange : T.iron200}`,
                  boxShadow: active ? `0 0 0 1px ${T.orange}` : '0 1px 2px rgba(15,15,15,.06)',
                  borderRadius: 8, padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <Caps size={9} color={T.iron400}>{config.label}</Caps>
                  <div style={{ ...mono, fontSize: 22, fontWeight: 700, color: T.iron900, marginTop: 4 }}>{count}</div>
                </div>
                <div style={{ height: 34, width: 34, flexShrink: 0, borderRadius: 6, display: 'grid', placeItems: 'center', background: T.iron50, color: config.accent }}>
                  <Icon size={17} />
                </div>
              </button>
            );
          })}
        </div>

        {/* Tab filter row */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {TABS.map(([val, label]) => {
            const active = activeTab === val;
            return (
              <button
                key={val}
                onClick={() => setActiveTab(val)}
                style={{
                  border: `1px solid ${active ? T.orange : T.iron200}`,
                  background: active ? T.orange : T.white,
                  color: active ? '#fff' : T.iron700,
                  borderRadius: 6, padding: '7px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Documents list */}
        {filteredDocuments.length === 0 ? (
          <IronCard pad={0}>
            <div style={{ padding: 48, textAlign: 'center' }}>
              <FolderOpen size={52} color={T.iron200} style={{ margin: '0 auto 14px' }} />
              <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 15, color: T.iron900, marginBottom: 4 }}>No Documents Found</div>
              <div style={{ fontSize: 13, color: T.iron500 }}>
                {searchTerm || activeTab !== 'all'
                  ? 'No documents match your search criteria'
                  : 'Your documents will appear here once you have orders and transactions'}
              </div>
            </div>
          </IronCard>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 10 }}>
            {filteredDocuments.map((doc) => {
              const typeConfig = DOC_TYPE_CONFIG[doc.type] || DOC_TYPE_CONFIG.invoice;
              const Icon = typeConfig.icon;
              const isDownloading = downloading === doc.id;
              const disabled = isDownloading || !doc.available;

              return (
                <IronCard key={doc.id} pad={14}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ height: 40, width: 40, flexShrink: 0, borderRadius: 6, display: 'grid', placeItems: 'center', background: T.iron50, color: typeConfig.accent }}>
                      <Icon size={20} />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 13, color: T.iron900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{doc.name}</div>
                          <div style={{ fontSize: 12, color: T.iron500, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{doc.description}</div>
                        </div>
                        <span style={{ ...badgeStyle(typeConfig.tone), flexShrink: 0 }}>{typeConfig.label}</span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
                        {doc.created_at ? (
                          <span style={{ ...mono, fontSize: 11, color: T.iron500, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Calendar size={12} />
                            {formatDate(doc.created_at)}
                          </span>
                        ) : (
                          <span />
                        )}

                        <button
                          onClick={() => handleDownload(doc)}
                          disabled={disabled}
                          style={{
                            border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700,
                            borderRadius: 6, padding: '7px 12px', fontFamily: T.headline, fontWeight: 700, fontSize: 12,
                            cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.55 : 1,
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                          }}
                        >
                          {isDownloading ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <>
                              <Download size={13} />
                              Download
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </IronCard>
              );
            })}
          </div>
        )}

        {/* Help note */}
        <div style={{ background: '#FDF3EA', border: `1px solid ${T.orange}33`, borderRadius: 8, padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <FileText size={18} color={T.orange} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 13, color: T.iron900 }}>Need Help?</div>
              <div style={{ fontSize: 13, color: T.iron500, marginTop: 3 }}>
                Documents are automatically generated when orders are processed. If you need a specific document
                or notice any errors, please raise a support ticket and our team will assist you.
              </div>
            </div>
          </div>
        </div>
      </div>
    </IronShell>
  );
}
