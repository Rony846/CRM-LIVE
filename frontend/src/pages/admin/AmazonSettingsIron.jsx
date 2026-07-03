import React, { useState, useEffect } from 'react';
import { useAuth, API } from '@/App';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import axios from 'axios';
import {
  Key, CheckCircle2, AlertCircle, Loader2, Building2,
  ExternalLink, ShieldCheck, Save, Trash2
} from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, badgeStyle } from '@/components/iron/IronKit';

const inputStyle = { border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '7px 10px', fontSize: 12.5, color: T.iron900, background: T.white, fontFamily: T.body, outline: 'none', width: '100%' };
const btnPrimary = { border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
const btnOutline = { border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };

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

  const headerRight = (
    <a
      href="https://developer-docs.amazon.com/sp-api/docs/getting-started"
      target="_blank"
      rel="noopener noreferrer"
      style={{ ...btnOutline, textDecoration: 'none', color: T.blue }}
    >
      <ExternalLink size={14} />
      SP-API Documentation
    </a>
  );

  if (loading) {
    return (
      <IronShell title="Amazon Settings" subtitle="SP-API CREDENTIALS" onRefresh={fetchFirms}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 260 }}>
          <Loader2 className="animate-spin" size={30} color={T.orange} />
        </div>
      </IronShell>
    );
  }

  return (
    <IronShell title="Amazon Settings" subtitle="SP-API CREDENTIALS" onRefresh={fetchFirms} headerRight={headerRight}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Setup Instructions */}
        <IronCard pad={14} style={{ borderLeft: `3px solid ${T.blue}` }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 999, background: T.blueTint, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <ShieldCheck size={20} color={T.blue} />
            </div>
            <div>
              <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron900 }}>How to Get Amazon SP-API Credentials</div>
              <ol style={{ color: T.iron700, fontSize: 12.5, marginTop: 8, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 3, lineHeight: 1.5 }}>
                <li>Register as a developer in Amazon Seller Central</li>
                <li>Create a new app in Developer Console to get LWA Client ID &amp; Secret</li>
                <li>Authorize your app to get the Refresh Token</li>
                <li>Create IAM user in AWS for Access Key &amp; Secret Key</li>
                <li>Enter all credentials below for each firm/seller account</li>
              </ol>
            </div>
          </div>
        </IronCard>

        {/* Firms List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {firms.map(firm => {
            const hasCredentials = firm.has_amazon_credentials || firmCredentialsInfo[firm.id]?.has_credentials;
            const credInfo = firmCredentialsInfo[firm.id];

            return (
              <IronCard key={firm.id} pad={14}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 46, height: 46, borderRadius: 10, display: 'grid', placeItems: 'center', background: hasCredentials ? T.greenTint : T.voltageTint }}>
                      <Building2 size={22} color={hasCredentials ? T.green : T.voltageText} />
                    </div>
                    <div>
                      <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron900, display: 'flex', alignItems: 'center', gap: 8 }}>
                        {firm.name}
                        {hasCredentials
                          ? <CheckCircle2 size={15} color={T.green} />
                          : <AlertCircle size={15} color={T.voltageText} />}
                        <span style={badgeStyle(hasCredentials ? 'ok' : 'warn')}>
                          {hasCredentials ? 'Configured' : 'Not Set'}
                        </span>
                      </div>
                      {hasCredentials && credInfo ? (
                        <div style={{ color: T.iron500, fontSize: 12, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 4 }}>
                          <span>Seller: <span style={{ ...mono, color: T.iron700 }}>{credInfo.seller_id}</span></span>
                          <span style={{ color: T.iron200 }}>•</span>
                          <span>
                            {marketplaces.find(m => m.id === credInfo.marketplace_id)?.flag || '🌐'}
                            {' '}
                            {marketplaces.find(m => m.id === credInfo.marketplace_id)?.name || credInfo.marketplace_id}
                          </span>
                          {credInfo.updated_at && (
                            <>
                              <span style={{ color: T.iron200 }}>•</span>
                              <span style={mono}>Updated: {new Date(credInfo.updated_at).toLocaleDateString()}</span>
                            </>
                          )}
                        </div>
                      ) : hasCredentials ? (
                        <div style={{ color: T.green, fontSize: 12, marginTop: 4 }}>Credentials configured</div>
                      ) : (
                        <div style={{ color: T.voltageText, fontSize: 12, marginTop: 4 }}>No Amazon credentials configured</div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {hasCredentials && (
                      <button
                        onClick={() => handleDeleteCredentials(firm.id)}
                        title="Delete credentials"
                        style={{ ...btnOutline, borderColor: '#F6D8BA', color: T.orangeDeep, padding: '8px 10px' }}
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                    <button
                      onClick={() => openCredentialsDialog(firm.id)}
                      style={hasCredentials ? btnOutline : btnPrimary}
                    >
                      <Key size={14} />
                      {hasCredentials ? 'Edit Credentials' : 'Add Credentials'}
                    </button>
                  </div>
                </div>
              </IronCard>
            );
          })}

          {firms.length === 0 && (
            <IronCard pad={14}>
              <div style={{ padding: 32, textAlign: 'center' }}>
                <Building2 size={46} color={T.iron400} style={{ margin: '0 auto 14px' }} />
                <div style={{ color: T.iron500, fontSize: 13 }}>No firms found. Create firms first in Inventory → Firms.</div>
              </div>
            </IronCard>
          )}
        </div>
      </div>

      {/* Credentials Dialog */}
      <Dialog open={showCredentialsDialog} onOpenChange={setShowCredentialsDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" style={{ background: T.white, border: `1px solid ${T.iron200}`, color: T.iron900 }}>
          <DialogHeader>
            <DialogTitle style={{ color: T.iron900, display: 'flex', alignItems: 'center', gap: 8, fontFamily: T.headline }}>
              <Key size={18} color={T.orange} />
              Amazon SP-API Credentials
            </DialogTitle>
          </DialogHeader>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 8 }}>
            <p style={{ fontSize: 12.5, color: T.iron500 }}>
              Enter credentials for: <strong style={{ color: T.iron900 }}>{firms.find(f => f.id === selectedFirm)?.name}</strong>
            </p>

            {/* Seller ID */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Caps size={9} color={T.iron500}>Seller ID *</Caps>
              <input
                value={credentialsForm.seller_id}
                onChange={(e) => setCredentialsForm(prev => ({ ...prev, seller_id: e.target.value }))}
                placeholder="e.g., A2XXXXXXXXXXXXX"
                style={inputStyle}
                data-testid="amazon-seller-id"
              />
              <p style={{ fontSize: 10.5, color: T.iron400 }}>Found in Seller Central → Settings → Account Info</p>
            </div>

            {/* Marketplace ID */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Caps size={9} color={T.iron500}>Marketplace</Caps>
              <Select
                value={credentialsForm.marketplace_id}
                onValueChange={(v) => setCredentialsForm(prev => ({ ...prev, marketplace_id: v }))}
              >
                <SelectTrigger style={inputStyle}>
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
            <div style={{ borderTop: `1px solid ${T.iron200}`, paddingTop: 14 }}>
              <Caps size={9} color={T.iron500} style={{ display: 'block', marginBottom: 10 }}>Login with Amazon (LWA) Credentials</Caps>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Caps size={9} color={T.iron500}>LWA Client ID *</Caps>
                  <input
                    value={credentialsForm.lwa_client_id}
                    onChange={(e) => setCredentialsForm(prev => ({ ...prev, lwa_client_id: e.target.value }))}
                    placeholder="amzn1.application-oa2-client.xxxxx"
                    style={inputStyle}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Caps size={9} color={T.iron500}>LWA Client Secret *</Caps>
                  <input
                    type="password"
                    value={credentialsForm.lwa_client_secret}
                    onChange={(e) => setCredentialsForm(prev => ({ ...prev, lwa_client_secret: e.target.value }))}
                    placeholder="Enter client secret"
                    style={inputStyle}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Caps size={9} color={T.iron500}>Refresh Token *</Caps>
                  <input
                    type="password"
                    value={credentialsForm.refresh_token}
                    onChange={(e) => setCredentialsForm(prev => ({ ...prev, refresh_token: e.target.value }))}
                    placeholder="Atzr|xxxxx..."
                    style={inputStyle}
                  />
                  <p style={{ fontSize: 10.5, color: T.iron400 }}>Generated when authorizing your app in Seller Central</p>
                </div>
              </div>
            </div>

            {/* AWS IAM Credentials */}
            <div style={{ borderTop: `1px solid ${T.iron200}`, paddingTop: 14 }}>
              <Caps size={9} color={T.iron500} style={{ display: 'block', marginBottom: 10 }}>AWS IAM Credentials (for SP-API signing)</Caps>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Caps size={9} color={T.iron500}>AWS Access Key</Caps>
                  <input
                    value={credentialsForm.aws_access_key}
                    onChange={(e) => setCredentialsForm(prev => ({ ...prev, aws_access_key: e.target.value }))}
                    placeholder="AKIAXXXXXXXX"
                    style={inputStyle}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Caps size={9} color={T.iron500}>AWS Secret Key</Caps>
                  <input
                    type="password"
                    value={credentialsForm.aws_secret_key}
                    onChange={(e) => setCredentialsForm(prev => ({ ...prev, aws_secret_key: e.target.value }))}
                    placeholder="Enter secret"
                    style={inputStyle}
                  />
                </div>
              </div>
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, paddingTop: 14, borderTop: `1px solid ${T.iron200}` }}>
              <button
                onClick={() => setShowCredentialsDialog(false)}
                style={btnOutline}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCredentials}
                disabled={savingCredentials}
                style={{ ...btnPrimary, opacity: savingCredentials ? 0.6 : 1 }}
              >
                {savingCredentials ? (
                  <>
                    <Loader2 className="animate-spin" size={14} />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={14} />
                    Save Credentials
                  </>
                )}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </IronShell>
  );
}
