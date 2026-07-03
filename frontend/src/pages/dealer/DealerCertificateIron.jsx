import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { toast } from 'sonner';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, badgeStyle } from '@/components/iron/IronKit';
import {
  FileCheck, Download, Loader2, Award, Crown, Star, QrCode, Building2, MapPin, Calendar
} from 'lucide-react';

// Tier presentation: accent color + icon + Iron badge tone (preserves silver/gold/platinum).
const TIER_CONFIG = {
  silver:   { label: 'Silver',   accent: T.iron500,  icon: Star,  tone: 'slate' },
  gold:     { label: 'Gold',     accent: '#B8860B',  icon: Award, tone: 'warn' },
  platinum: { label: 'Platinum', accent: '#6D4AB0',  icon: Crown, tone: 'violet' },
};

export default function DealerCertificate() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [tierData, setTierData] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);

  useEffect(() => {
    if (token) {
      fetchData();
    }
  }, [token]);

  const fetchData = async () => {
    try {
      const [tierRes, dashboardRes] = await Promise.all([
        axios.get(`${API}/dealer/tier`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/dealer/dashboard`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setTierData(tierRes.data);
      setDashboardData(dashboardRes.data);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
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

      toast.success('Certificate downloaded successfully');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to download certificate');
    } finally {
      setDownloading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  if (loading) {
    return (
      <IronShell title="Certificate" subtitle="ACCOUNT · CREDENTIALS">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 260 }}>
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: T.orange }} />
        </div>
      </IronShell>
    );
  }

  const dealer = dashboardData?.dealer || {};
  const tier = tierData?.current_tier || 'silver';
  const tierConfig = TIER_CONFIG[tier] || TIER_CONFIG.silver;
  const TierIcon = tierConfig.icon;
  const isApproved = dealer.status === 'approved';

  const details = [
    {
      icon: MapPin,
      label: 'Location',
      value: `${dealer.address?.city || dealer.city}, ${dealer.address?.state || dealer.state}`
    },
    {
      icon: Calendar,
      label: 'Dealer Since',
      value: dealer.created_at
        ? new Date(dealer.created_at).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
        : 'N/A'
    },
    {
      icon: Building2,
      label: 'Total Business',
      value: formatCurrency(tierData?.total_purchase_value)
    }
  ];

  const benefits = [
    {
      title: 'Official Authorization',
      body: 'Display your certificate to customers as proof of official MuscleGrid dealership.'
    },
    {
      title: 'QR Verification',
      body: 'Each certificate contains a unique QR code that anyone can scan to verify authenticity.'
    },
    {
      title: 'Tier Recognition',
      body: 'Your certificate displays your current tier status — Silver, Gold, or Platinum.'
    },
    {
      title: 'Print Ready',
      body: 'High-quality PDF suitable for printing and framing at your store or office.'
    }
  ];

  const downloadBtn = (
    <button
      onClick={handleDownload}
      disabled={downloading || !isApproved}
      style={{
        border: 'none',
        background: (downloading || !isApproved) ? T.iron400 : T.orange,
        color: '#fff', borderRadius: 6, padding: '9px 18px', minWidth: 168,
        fontFamily: T.headline, fontWeight: 700, fontSize: 12.5,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        cursor: (downloading || !isApproved) ? 'not-allowed' : 'pointer'
      }}
    >
      {downloading ? (
        <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
      ) : (
        <><Download className="w-4 h-4" /> Download PDF</>
      )}
    </button>
  );

  return (
    <IronShell title="Certificate" subtitle="ACCOUNT · CREDENTIALS" onRefresh={fetchData}>
      <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>

        {/* Page header */}
        <div>
          <Caps size={10} color={T.iron400}>Account · Credentials</Caps>
          <div style={{ fontFamily: T.headline, fontWeight: 800, fontSize: 24, color: T.iron900, letterSpacing: '-0.01em', marginTop: 4 }}>
            Dealer Certificate
          </div>
        </div>

        {/* Certificate artwork — branded dark preview inside Iron chrome */}
        <IronCard pad={0} style={{ overflow: 'hidden', border: `1px solid ${T.iron200}` }}>
          <div style={{ height: 4, width: '100%', background: `linear-gradient(90deg, ${T.orange}, ${T.voltage})` }} />
          <div style={{ background: 'linear-gradient(135deg,#0e0c07,#131007,#0e0c07)', padding: 40 }}>

            {/* Certificate header */}
            <div style={{ textAlign: 'center', marginBottom: 34 }}>
              <div style={{ width: 78, height: 78, margin: '0 auto 16px', borderRadius: '50%', display: 'grid', placeItems: 'center',
                background: `linear-gradient(90deg, ${T.orange}, ${T.voltage})`, boxShadow: '0 0 32px rgba(245,130,32,0.25)' }}>
                <span style={{ fontSize: 24, fontWeight: 800, color: '#fff', fontFamily: T.headline }}>MG</span>
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: T.orange, letterSpacing: '0.18em', fontFamily: T.display }}>MUSCLEGRID</div>
              <div style={{ ...mono, fontSize: 11, color: T.iron400, letterSpacing: '0.18em', textTransform: 'uppercase', marginTop: 6 }}>
                Consistency Through You
              </div>
            </div>

            {/* Certificate title */}
            <div style={{ textAlign: 'center', marginBottom: 34 }}>
              <div style={{ fontSize: 22, color: '#fff', letterSpacing: '0.04em', fontFamily: T.headline, fontWeight: 600 }}>Certificate of Authorization</div>
              <div style={{ width: 130, height: 1, margin: '12px auto 0', background: `linear-gradient(90deg, transparent, ${T.orange}, transparent)` }} />
            </div>

            {/* Dealer info */}
            <div style={{ textAlign: 'center', marginBottom: 34 }}>
              <div style={{ color: T.iron400, fontSize: 13, marginBottom: 12 }}>This is to certify that</div>
              <div style={{ display: 'inline-block', fontSize: 26, fontWeight: 800, color: '#fff', borderBottom: `1px solid rgba(245,130,32,0.5)`, paddingBottom: 8, padding: '0 16px 8px', marginBottom: 16, fontFamily: T.headline }}>
                {dealer.firm_name}
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', margin: '16px 0' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 22px', borderRadius: 999,
                  background: tierConfig.accent, boxShadow: '0 0 20px rgba(0,0,0,0.4)' }}>
                  <TierIcon className="w-5 h-5" style={{ color: '#fff' }} />
                  <span style={{ color: '#fff', fontWeight: 800, fontSize: 15, fontFamily: T.headline }}>{tierConfig.label} Tier Partner</span>
                </div>
              </div>

              <div style={{ color: T.iron400, fontSize: 13, maxWidth: 560, margin: '0 auto', lineHeight: 1.5 }}>
                is an officially authorized dealer of MuscleGrid Industries Private Limited for the distribution of
                Inverters, Batteries, Stabilizers, and related products.
              </div>
            </div>

            {/* Details grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 34 }}>
              {details.map(({ icon: Icon, label, value }) => (
                <div key={label} style={{ padding: 16, borderRadius: 8, background: 'rgba(255,255,255,0.05)', textAlign: 'center', border: '1px solid rgba(245,130,32,0.12)' }}>
                  <Icon className="w-4 h-4" style={{ color: T.orange, margin: '0 auto 8px' }} />
                  <div style={{ ...mono, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: T.iron400 }}>{label}</div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#fff', marginTop: 4 }}>{value}</div>
                </div>
              ))}
            </div>

            {/* QR + issue date */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 56, height: 56, background: '#fff', borderRadius: 8, display: 'grid', placeItems: 'center' }}>
                  <QrCode className="w-10 h-10" style={{ color: '#1f2937' }} />
                </div>
                <div>
                  <div style={{ fontSize: 12, color: T.iron400 }}>Scan to verify</div>
                  <div style={{ ...mono, fontSize: 10, color: 'rgba(154,154,154,0.6)' }}>Certificate authenticity</div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ ...mono, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: T.iron400 }}>Issue Date</div>
                <div style={{ fontSize: 13, color: '#fff', marginTop: 2 }}>
                  {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
              </div>
            </div>
          </div>
        </IronCard>

        {/* Download action */}
        <IronCard pad={18}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ height: 48, width: 48, borderRadius: 8, display: 'grid', placeItems: 'center', background: '#FDEEE6', color: T.orangeDeep, flexShrink: 0 }}>
                <FileCheck className="w-6 h-6" />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.iron900, fontFamily: T.headline }}>Download Official Certificate</div>
                <div style={{ fontSize: 12.5, color: T.iron500, marginTop: 2 }}>
                  {isApproved
                    ? 'Download your official MuscleGrid Authorized Dealer Certificate (PDF with QR verification)'
                    : 'Certificate will be available once your account is approved'}
                </div>
                {!isApproved && (
                  <span style={{ ...badgeStyle('warn'), marginTop: 8 }}>Pending Approval</span>
                )}
              </div>
            </div>
            {downloadBtn}
          </div>
        </IronCard>

        {/* Benefits */}
        <IronCard pad={0}>
          <div style={{ padding: '16px 18px', borderBottom: `1px solid ${T.iron200}` }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.iron900, fontFamily: T.headline }}>Certificate Benefits</div>
          </div>
          <div style={{ padding: 18 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              {benefits.map(({ title, body }) => (
                <div key={title} style={{ padding: 16, borderRadius: 8, background: T.iron50, border: `1px solid ${T.iron200}` }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: T.iron900, marginBottom: 4, fontFamily: T.headline }}>{title}</div>
                  <div style={{ fontSize: 12.5, color: T.iron500, lineHeight: 1.5 }}>{body}</div>
                </div>
              ))}
            </div>
          </div>
        </IronCard>

      </div>
    </IronShell>
  );
}
