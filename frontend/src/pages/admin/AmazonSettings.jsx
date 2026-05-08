import React, { useState, useEffect } from 'react';
import { useAuth, API } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import axios from 'axios';
import { 
  Key, CheckCircle2, AlertCircle, Loader2, Building2, 
  ExternalLink, ShieldCheck, Settings, Save, Trash2
} from 'lucide-react';

export default function AmazonSettings() {
  const { token } = useAuth();
  const [firms, setFirms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFirm, setSelectedFirm] = useState('');
  const [showCredentialsDialog, setShowCredentialsDialog] = useState(false);
  const [savingCredentials, setSavingCredentials] = useState(false);
  const [credentialsForm, setCredentialsForm] = useState({
    seller_id: '',
    lwa_client_id: '',
    lwa_client_secret: '',
    refresh_token: '',
    aws_access_key: '',
    aws_secret_key: '',
    marketplace_id: 'A21TJRUUN4KGV'
  });
  const [firmCredentialsInfo, setFirmCredentialsInfo] = useState({});

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetchFirms();
  }, []);

  const fetchFirms = async () => {
    try {
      const res = await axios.get(`${API}/amazon/firms-with-credentials`, { headers });
      setFirms(res.data.firms || []);
      
      // Build credentials info map
      const infoMap = {};
      for (const firm of res.data.firms || []) {
        if (firm.has_amazon_credentials) {
          try {
            const credRes = await axios.get(`${API}/amazon/credentials/${firm.id}`, { headers });
            infoMap[firm.id] = credRes.data;
          } catch (e) {
            infoMap[firm.id] = { has_credentials: true };
          }
        }
      }
      setFirmCredentialsInfo(infoMap);
    } catch (err) {
      console.error('Error fetching firms:', err);
      toast.error('Failed to load firms');
    } finally {
      setLoading(false);
    }
  };

  const openCredentialsDialog = async (firmId) => {
    setSelectedFirm(firmId);
    
    // Reset form
    setCredentialsForm({
      seller_id: '',
      lwa_client_id: '',
      lwa_client_secret: '',
      refresh_token: '',
      aws_access_key: '',
      aws_secret_key: '',
      marketplace_id: 'A21TJRUUN4KGV'
    });
    
    // Pre-fill if credentials exist
    if (firmCredentialsInfo[firmId]?.has_credentials) {
      setCredentialsForm(prev => ({
        ...prev,
        seller_id: firmCredentialsInfo[firmId].seller_id || '',
        marketplace_id: firmCredentialsInfo[firmId].marketplace_id || 'A21TJRUUN4KGV'
      }));
    }
    
    setShowCredentialsDialog(true);
  };

  const handleSaveCredentials = async () => {
    if (!selectedFirm) {
      toast.error('No firm selected');
      return;
    }
    
    if (!credentialsForm.seller_id || !credentialsForm.lwa_client_id || !credentialsForm.refresh_token) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    setSavingCredentials(true);
    try {
      // Send firm_id as query parameter, credentials in body
      await axios.post(`${API}/amazon/credentials?firm_id=${selectedFirm}`, {
        seller_id: credentialsForm.seller_id,
        marketplace_id: credentialsForm.marketplace_id || 'A21TJRUUN4KGV',
        lwa_client_id: credentialsForm.lwa_client_id,
        lwa_client_secret: credentialsForm.lwa_client_secret,
        refresh_token: credentialsForm.refresh_token,
        aws_access_key: credentialsForm.aws_access_key || '',
        aws_secret_key: credentialsForm.aws_secret_key || ''
      }, { headers });
      
      toast.success('Amazon credentials saved successfully!');
      setShowCredentialsDialog(false);
      fetchFirms(); // Refresh
    } catch (err) {
      console.error('Error saving credentials:', err);
      const errorMsg = err.response?.data?.detail;
      if (Array.isArray(errorMsg)) {
        toast.error(errorMsg.map(e => e.msg).join(', '));
      } else {
        toast.error(errorMsg || 'Failed to save credentials');
      }
    } finally {
      setSavingCredentials(false);
    }
  };

  const handleDeleteCredentials = async (firmId) => {
    if (!confirm('Are you sure you want to delete Amazon credentials for this firm?')) return;
    
    try {
      await axios.delete(`${API}/amazon/credentials/${firmId}`, { headers });
      toast.success('Credentials deleted');
      fetchFirms();
    } catch (err) {
      toast.error('Failed to delete credentials');
    }
  };

  const marketplaces = [
    { id: 'A21TJRUUN4KGV', name: 'India (amazon.in)', flag: '🇮🇳' },
    { id: 'ATVPDKIKX0DER', name: 'USA (amazon.com)', flag: '🇺🇸' },
    { id: 'A1F83G8C2ARO7P', name: 'UK (amazon.co.uk)', flag: '🇬🇧' },
    { id: 'A1PA6795UKMFR9', name: 'Germany (amazon.de)', flag: '🇩🇪' },
    { id: 'A13V1IB3VIYZZH', name: 'France (amazon.fr)', flag: '🇫🇷' },
    { id: 'APJ6JRA9NG5V4', name: 'Italy (amazon.it)', flag: '🇮🇹' },
    { id: 'A1RKKUPIHCS9HS', name: 'Spain (amazon.es)', flag: '🇪🇸' },
  ];

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Amazon SP-API Settings</h1>
            <p className="text-slate-400 text-sm mt-1">
              Manage Amazon Seller Partner API credentials for each firm
            </p>
          </div>
          <a 
            href="https://developer-docs.amazon.com/sp-api/docs/getting-started" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300 text-sm"
          >
            <ExternalLink className="w-4 h-4" />
            SP-API Documentation
          </a>
        </div>

        {/* Setup Instructions */}
        <Card className="bg-gradient-to-r from-blue-900/30 to-cyan-900/30 border-blue-700/50">
          <CardContent className="p-4">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                <ShieldCheck className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold">How to Get Amazon SP-API Credentials</h3>
                <ol className="text-slate-300 text-sm mt-2 space-y-1 list-decimal list-inside">
                  <li>Register as a developer in Amazon Seller Central</li>
                  <li>Create a new app in Developer Console to get LWA Client ID & Secret</li>
                  <li>Authorize your app to get the Refresh Token</li>
                  <li>Create IAM user in AWS for Access Key & Secret Key</li>
                  <li>Enter all credentials below for each firm/seller account</li>
                </ol>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Firms List */}
        <div className="grid gap-4">
          {firms.map(firm => {
            const hasCredentials = firm.has_amazon_credentials || firmCredentialsInfo[firm.id]?.has_credentials;
            const credInfo = firmCredentialsInfo[firm.id];
            
            return (
              <Card key={firm.id} className="bg-slate-800/50 border-slate-700">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        hasCredentials ? 'bg-green-500/20' : 'bg-yellow-500/20'
                      }`}>
                        <Building2 className={`w-6 h-6 ${hasCredentials ? 'text-green-400' : 'text-yellow-400'}`} />
                      </div>
                      <div>
                        <h3 className="text-white font-semibold flex items-center gap-2">
                          {firm.name}
                          {hasCredentials ? (
                            <CheckCircle2 className="w-4 h-4 text-green-400" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-yellow-400" />
                          )}
                        </h3>
                        {hasCredentials && credInfo ? (
                          <div className="text-slate-400 text-sm flex flex-wrap items-center gap-2 sm:gap-3 mt-1">
                            <span>Seller: {credInfo.seller_id}</span>
                            <span className="hidden sm:inline">•</span>
                            <span>
                              {marketplaces.find(m => m.id === credInfo.marketplace_id)?.flag || '🌐'} 
                              {' '}
                              {marketplaces.find(m => m.id === credInfo.marketplace_id)?.name || credInfo.marketplace_id}
                            </span>
                            {credInfo.updated_at && (
                              <>
                                <span>•</span>
                                <span>Updated: {new Date(credInfo.updated_at).toLocaleDateString()}</span>
                              </>
                            )}
                          </div>
                        ) : hasCredentials ? (
                          <p className="text-green-400 text-sm">Credentials configured</p>
                        ) : (
                          <p className="text-yellow-400 text-sm">No Amazon credentials configured</p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {hasCredentials && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteCredentials(firm.id)}
                          className="border-red-600 text-red-400 hover:bg-red-600/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        onClick={() => openCredentialsDialog(firm.id)}
                        className={hasCredentials ? 'bg-slate-700 hover:bg-slate-600' : 'bg-orange-500 hover:bg-orange-600'}
                      >
                        <Key className="w-4 h-4 mr-2" />
                        {hasCredentials ? 'Edit Credentials' : 'Add Credentials'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          
          {firms.length === 0 && (
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-8 text-center">
                <Building2 className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400">No firms found. Create firms first in Inventory → Firms.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Credentials Dialog */}
      <Dialog open={showCredentialsDialog} onOpenChange={setShowCredentialsDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Key className="w-5 h-5 text-orange-400" />
              Amazon SP-API Credentials
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 pt-4">
            <p className="text-sm text-slate-400">
              Enter credentials for: <strong className="text-white">{firms.find(f => f.id === selectedFirm)?.name}</strong>
            </p>
            
            {/* Seller ID */}
            <div className="space-y-2">
              <Label className="text-slate-300">Seller ID *</Label>
              <Input
                value={credentialsForm.seller_id}
                onChange={(e) => setCredentialsForm(prev => ({ ...prev, seller_id: e.target.value }))}
                placeholder="e.g., A2XXXXXXXXXXXXX"
                className="bg-slate-800 border-slate-700 text-white"
                data-testid="amazon-seller-id"
              />
              <p className="text-xs text-slate-500">Found in Seller Central → Settings → Account Info</p>
            </div>
            
            {/* Marketplace ID */}
            <div className="space-y-2">
              <Label className="text-slate-300">Marketplace</Label>
              <Select 
                value={credentialsForm.marketplace_id} 
                onValueChange={(v) => setCredentialsForm(prev => ({ ...prev, marketplace_id: v }))}
              >
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue placeholder="Select marketplace" />
                </SelectTrigger>
                <SelectContent>
                  {marketplaces.map(m => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.flag} {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* LWA Credentials */}
            <div className="border-t border-slate-700 pt-4">
              <p className="text-slate-400 text-xs mb-3 font-medium">Login with Amazon (LWA) Credentials</p>
              
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-slate-300">LWA Client ID *</Label>
                  <Input
                    value={credentialsForm.lwa_client_id}
                    onChange={(e) => setCredentialsForm(prev => ({ ...prev, lwa_client_id: e.target.value }))}
                    placeholder="amzn1.application-oa2-client.xxxxx"
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className="text-slate-300">LWA Client Secret *</Label>
                  <Input
                    type="password"
                    value={credentialsForm.lwa_client_secret}
                    onChange={(e) => setCredentialsForm(prev => ({ ...prev, lwa_client_secret: e.target.value }))}
                    placeholder="Enter client secret"
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className="text-slate-300">Refresh Token *</Label>
                  <Input
                    type="password"
                    value={credentialsForm.refresh_token}
                    onChange={(e) => setCredentialsForm(prev => ({ ...prev, refresh_token: e.target.value }))}
                    placeholder="Atzr|xxxxx..."
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                  <p className="text-xs text-slate-500">Generated when authorizing your app in Seller Central</p>
                </div>
              </div>
            </div>
            
            {/* AWS IAM Credentials */}
            <div className="border-t border-slate-700 pt-4">
              <p className="text-slate-400 text-xs mb-3 font-medium">AWS IAM Credentials (for SP-API signing)</p>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-slate-300 text-xs">AWS Access Key</Label>
                  <Input
                    value={credentialsForm.aws_access_key}
                    onChange={(e) => setCredentialsForm(prev => ({ ...prev, aws_access_key: e.target.value }))}
                    placeholder="AKIAXXXXXXXX"
                    className="bg-slate-800 border-slate-700 text-white text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300 text-xs">AWS Secret Key</Label>
                  <Input
                    type="password"
                    value={credentialsForm.aws_secret_key}
                    onChange={(e) => setCredentialsForm(prev => ({ ...prev, aws_secret_key: e.target.value }))}
                    placeholder="Enter secret"
                    className="bg-slate-800 border-slate-700 text-white text-sm"
                  />
                </div>
              </div>
            </div>
            
            {/* Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
              <Button
                variant="outline"
                onClick={() => setShowCredentialsDialog(false)}
                className="border-slate-600"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveCredentials}
                disabled={savingCredentials}
                className="bg-orange-500 hover:bg-orange-600"
              >
                {savingCredentials ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Credentials
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
