import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  Download, FileText, FileCheck, CreditCard, Shield, Search, Loader2,
  Calendar, IndianRupee, ExternalLink, File, FolderOpen
} from 'lucide-react';

const DOC_TYPE_CONFIG = {
  certificate: { icon: FileCheck, color: 'text-amber-400', bgColor: 'bg-amber-600', label: 'Certificate' },
  invoice: { icon: FileText, color: 'text-green-400', bgColor: 'bg-green-600', label: 'Invoice' },
  proforma: { icon: File, color: 'text-blue-400', bgColor: 'bg-blue-600', label: 'Proforma' },
  payment: { icon: CreditCard, color: 'text-purple-400', bgColor: 'bg-purple-600', label: 'Payment' },
  deposit: { icon: Shield, color: 'text-cyan-400', bgColor: 'bg-cyan-600', label: 'Deposit' }
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
          <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Download Center">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white">Download Center</h1>
          <p className="text-slate-400">Access all your documents, invoices, and certificates</p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {Object.entries(DOC_TYPE_CONFIG).map(([type, config]) => {
            const Icon = config.icon;
            const count = countByType[type] || 0;
            return (
              <Card 
                key={type} 
                className={`bg-slate-800 border-slate-700 cursor-pointer hover:border-slate-600 transition-colors ${activeTab === type ? 'ring-2 ring-cyan-500' : ''}`}
                onClick={() => setActiveTab(type)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-slate-400 text-sm">{config.label}</p>
                      <p className="text-2xl font-bold text-white">{count}</p>
                    </div>
                    <Icon className={`w-6 h-6 ${config.color}`} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Filters */}
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search documents..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 bg-slate-900 border-slate-700"
                />
              </div>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="bg-slate-900">
                  <TabsTrigger value="all" className="data-[state=active]:bg-cyan-600">All</TabsTrigger>
                  <TabsTrigger value="invoice" className="data-[state=active]:bg-cyan-600">Invoices</TabsTrigger>
                  <TabsTrigger value="proforma" className="data-[state=active]:bg-cyan-600">PI</TabsTrigger>
                  <TabsTrigger value="payment" className="data-[state=active]:bg-cyan-600">Payments</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardContent>
        </Card>

        {/* Documents List */}
        {filteredDocuments.length === 0 ? (
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-12 text-center">
              <FolderOpen className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">No Documents Found</h3>
              <p className="text-slate-400">
                {searchTerm || activeTab !== 'all'
                  ? 'No documents match your search criteria'
                  : 'Your documents will appear here once you have orders and transactions'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredDocuments.map((doc) => {
              const typeConfig = DOC_TYPE_CONFIG[doc.type] || DOC_TYPE_CONFIG.invoice;
              const Icon = typeConfig.icon;
              const isDownloading = downloading === doc.id;
              
              return (
                <Card key={doc.id} className="bg-slate-800 border-slate-700 hover:border-slate-600 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 ${typeConfig.bgColor} rounded-lg flex items-center justify-center flex-shrink-0`}>
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-white font-medium truncate">{doc.name}</h3>
                            <p className="text-slate-400 text-sm truncate">{doc.description}</p>
                          </div>
                          <Badge className={typeConfig.bgColor}>
                            {typeConfig.label}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center justify-between mt-3">
                          {doc.created_at && (
                            <span className="text-slate-500 text-sm flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {formatDate(doc.created_at)}
                            </span>
                          )}
                          
                          <Button
                            size="sm"
                            onClick={() => handleDownload(doc)}
                            disabled={isDownloading || !doc.available}
                            className="bg-cyan-600 hover:bg-cyan-700"
                          >
                            {isDownloading ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <Download className="w-4 h-4 mr-1" />
                                Download
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Help Card */}
        <Card className="bg-blue-900/20 border-blue-600">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-blue-300 font-medium">Need Help?</p>
                <p className="text-blue-200 text-sm mt-1">
                  Documents are automatically generated when orders are processed. If you need a specific document 
                  or notice any errors, please raise a support ticket and our team will assist you.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
