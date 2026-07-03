import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import { API } from '@/App';
import {
  CheckCircle, XCircle, Loader2, Building2, MapPin, Calendar,
  Award, Crown, Star, Shield
} from 'lucide-react';
import { T, Fonts } from '@/components/iron/IronKit';

const TIER_CONFIG = {
  silver: { label: 'Silver', accent: '#8A8F98', icon: Star },
  gold: { label: 'Gold', accent: '#D4A017', icon: Award },
  platinum: { label: 'Platinum', accent: '#7C6BB0', icon: Crown }
};

export default function VerifyDealer() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (token) {
      verifyDealer();
    }
  }, [token]);

  const verifyDealer = async () => {
    try {
      const response = await axios.get(`${API}/verify-dealer/${token}`);
      setResult(response.data);
    } catch (error) {
      setResult({ valid: false, message: 'Verification failed' });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const canvas = {
    minHeight: '100vh',
    width: '100%',
    background: 'radial-gradient(1200px 600px at 50% -10%, #23262B, #141517)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    fontFamily: T.body,
  };

  const card = {
    width: 'min(420px, 100%)',
    background: T.white,
    borderRadius: 14,
    padding: '32px 30px',
    boxShadow: '0 30px 80px rgba(0,0,0,.45)',
    border: `1px solid ${T.iron200}`,
  };

  const brand = (
    <div style={{ textAlign: 'center', marginBottom: 22 }}>
      <div style={{
        width: 56, height: 56, margin: '0 auto 12px', borderRadius: 14,
        background: `linear-gradient(135deg, ${T.orange}, ${T.orangeDeep})`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 8px 20px rgba(245,130,32,.35)'
      }}>
        <span style={{ fontFamily: T.display, fontWeight: 800, fontSize: 22, color: '#fff', letterSpacing: '.04em' }}>MG</span>
      </div>
      <div style={{ fontFamily: T.display, fontWeight: 800, fontSize: 26, letterSpacing: '.06em', color: T.iron900 }}>
        MUSCLE<span style={{ color: T.orange }}>GRID</span>
      </div>
      <div style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase', color: T.iron400, marginTop: 4 }}>
        Dealer Certificate Verification
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="iron" style={canvas}>
        <Fonts />
        <div style={card}>
          {brand}
          <div style={{ textAlign: 'center', padding: '18px 0 6px' }}>
            <Loader2 className="w-10 h-10 animate-spin" style={{ color: T.orange, margin: '0 auto 12px' }} />
            <p style={{ fontFamily: T.body, fontSize: 14, color: T.iron500 }}>Verifying certificate...</p>
          </div>
        </div>
      </div>
    );
  }

  const tier = result?.dealer?.tier || 'silver';
  const tierConfig = TIER_CONFIG[tier];
  const TierIcon = tierConfig?.icon || Star;

  const detailRow = (Icon, label, value) => (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
      <Icon className="w-5 h-5" style={{ color: T.orange, flexShrink: 0, marginTop: 2 }} />
      <div>
        <div style={{ fontFamily: T.mono, fontSize: 9.5, letterSpacing: '.12em', textTransform: 'uppercase', color: T.iron400 }}>{label}</div>
        <div style={{ fontFamily: T.headline, fontWeight: 600, fontSize: 15, color: T.iron900, marginTop: 2 }}>{value}</div>
      </div>
    </div>
  );

  return (
    <div className="iron" style={canvas}>
      <Fonts />
      <div style={card}>
        {brand}

        {result?.valid ? (
          <>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{
                width: 64, height: 64, margin: '0 auto 12px', borderRadius: '50%',
                background: T.greenTint, display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: `1px solid #CBE5D6`
              }}>
                <CheckCircle className="w-8 h-8" style={{ color: T.green }} />
              </div>
              <h2 style={{ fontFamily: T.headline, fontWeight: 800, fontSize: 20, color: T.iron900 }}>Certificate Verified</h2>
              <p style={{ fontFamily: T.body, fontSize: 13, color: T.iron500, marginTop: 4 }}>
                This is an authentic MuscleGrid dealer certificate
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: T.iron50, border: `1px solid ${T.iron200}`, borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
                {detailRow(Building2, 'Dealer Name', result.dealer.firm_name)}
                {detailRow(MapPin, 'Location', `${result.dealer.city}, ${result.dealer.state}`)}
              </div>

              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <div style={{
                  padding: '8px 18px', borderRadius: 999,
                  background: tierConfig?.accent, display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <TierIcon className="w-4 h-4" style={{ color: '#fff' }} />
                  <span style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 13, color: '#fff', letterSpacing: '.02em' }}>
                    {tierConfig?.label} Partner
                  </span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ background: T.iron50, border: `1px solid ${T.iron200}`, borderRadius: 10, padding: 12, textAlign: 'center' }}>
                  <Shield className="w-5 h-5" style={{ color: T.green, margin: '0 auto 6px' }} />
                  <div style={{ fontFamily: T.mono, fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: T.iron400 }}>Status</div>
                  <div style={{
                    display: 'inline-block', marginTop: 6, padding: '2px 10px', borderRadius: 999,
                    background: T.greenTint, color: T.green, border: '1px solid #CBE5D6',
                    fontFamily: T.headline, fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.04em'
                  }}>
                    {result.dealer.status}
                  </div>
                </div>
                <div style={{ background: T.iron50, border: `1px solid ${T.iron200}`, borderRadius: 10, padding: 12, textAlign: 'center' }}>
                  <Calendar className="w-5 h-5" style={{ color: T.blue, margin: '0 auto 6px' }} />
                  <div style={{ fontFamily: T.mono, fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: T.iron400 }}>Dealer Since</div>
                  <div style={{ fontFamily: T.headline, fontWeight: 600, fontSize: 13, color: T.iron900, marginTop: 6 }}>
                    {formatDate(result.dealer.dealer_since)}
                  </div>
                </div>
              </div>

              {result.dealer.certificate_issued_at && (
                <p style={{ textAlign: 'center', fontFamily: T.body, fontSize: 12, color: T.iron400 }}>
                  Certificate issued on {formatDate(result.dealer.certificate_issued_at)}
                </p>
              )}
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 64, height: 64, margin: '0 auto 12px', borderRadius: '50%',
              background: '#FDEEE6', display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1px solid #F6D8BA'
            }}>
              <XCircle className="w-8 h-8" style={{ color: T.orangeDeep }} />
            </div>
            <h2 style={{ fontFamily: T.headline, fontWeight: 800, fontSize: 20, color: T.iron900 }}>Verification Failed</h2>
            <p style={{ fontFamily: T.body, fontSize: 13, color: T.iron500, marginTop: 8 }}>
              {result?.message || 'This certificate could not be verified. It may be invalid or expired.'}
            </p>
            <p style={{ fontFamily: T.body, fontSize: 12, color: T.iron400, marginTop: 14 }}>
              If you believe this is an error, please contact MuscleGrid support.
            </p>
          </div>
        )}

        <p style={{ textAlign: 'center', fontFamily: T.mono, fontSize: 11, color: T.iron400, marginTop: 24 }}>
          MuscleGrid Industries Pvt. Ltd. &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
