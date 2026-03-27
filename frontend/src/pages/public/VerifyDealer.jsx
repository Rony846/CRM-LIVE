import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { API } from '@/App';
import {
  CheckCircle, XCircle, Loader2, Building2, MapPin, Calendar,
  Award, Crown, Star, Shield
} from 'lucide-react';

const TIER_CONFIG = {
  silver: { label: 'Silver', color: 'from-slate-400 to-slate-500', textColor: 'text-slate-300', icon: Star },
  gold: { label: 'Gold', color: 'from-yellow-400 to-amber-500', textColor: 'text-yellow-400', icon: Award },
  platinum: { label: 'Platinum', color: 'from-purple-400 to-indigo-400', textColor: 'text-purple-300', icon: Crown }
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <Card className="bg-slate-800 border-slate-700 w-full max-w-md">
          <CardContent className="p-8 text-center">
            <Loader2 className="w-12 h-12 animate-spin text-cyan-500 mx-auto mb-4" />
            <p className="text-slate-400">Verifying certificate...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const tier = result?.dealer?.tier || 'silver';
  const tierConfig = TIER_CONFIG[tier];
  const TierIcon = tierConfig?.icon || Star;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Logo Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto bg-gradient-to-r from-orange-500 to-amber-500 rounded-full flex items-center justify-center mb-4">
            <span className="text-2xl font-bold text-white">MG</span>
          </div>
          <h1 className="text-2xl font-bold text-orange-400">MUSCLEGRID</h1>
          <p className="text-slate-500 text-sm">Dealer Certificate Verification</p>
        </div>

        <Card className={`border-2 ${result?.valid ? 'bg-green-900/20 border-green-600' : 'bg-red-900/20 border-red-600'}`}>
          <CardContent className="p-8">
            {result?.valid ? (
              <>
                {/* Success Icon */}
                <div className="text-center mb-6">
                  <div className="w-20 h-20 mx-auto bg-green-600 rounded-full flex items-center justify-center mb-4">
                    <CheckCircle className="w-10 h-10 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-green-400">Certificate Verified</h2>
                  <p className="text-slate-400 mt-1">This is an authentic MuscleGrid dealer certificate</p>
                </div>

                {/* Dealer Details */}
                <div className="space-y-4">
                  <div className="p-4 bg-slate-800 rounded-lg">
                    <div className="flex items-center gap-3 mb-3">
                      <Building2 className="w-5 h-5 text-orange-400" />
                      <div>
                        <p className="text-slate-400 text-sm">Dealer Name</p>
                        <p className="text-white font-semibold text-lg">{result.dealer.firm_name}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <MapPin className="w-5 h-5 text-orange-400" />
                      <div>
                        <p className="text-slate-400 text-sm">Location</p>
                        <p className="text-white">{result.dealer.city}, {result.dealer.state}</p>
                      </div>
                    </div>
                  </div>

                  {/* Tier Badge */}
                  <div className="flex justify-center">
                    <div className={`px-6 py-3 rounded-full bg-gradient-to-r ${tierConfig?.color} flex items-center gap-2`}>
                      <TierIcon className="w-5 h-5 text-white" />
                      <span className="text-white font-bold">{tierConfig?.label} Partner</span>
                    </div>
                  </div>

                  {/* Status and Dates */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-slate-800 rounded-lg text-center">
                      <Shield className="w-5 h-5 text-green-400 mx-auto mb-1" />
                      <p className="text-slate-400 text-xs">Status</p>
                      <Badge className="bg-green-600 mt-1">{result.dealer.status}</Badge>
                    </div>
                    <div className="p-3 bg-slate-800 rounded-lg text-center">
                      <Calendar className="w-5 h-5 text-cyan-400 mx-auto mb-1" />
                      <p className="text-slate-400 text-xs">Dealer Since</p>
                      <p className="text-white text-sm mt-1">{formatDate(result.dealer.dealer_since)}</p>
                    </div>
                  </div>

                  {result.dealer.certificate_issued_at && (
                    <p className="text-center text-slate-500 text-sm">
                      Certificate issued on {formatDate(result.dealer.certificate_issued_at)}
                    </p>
                  )}
                </div>
              </>
            ) : (
              <>
                {/* Invalid Icon */}
                <div className="text-center">
                  <div className="w-20 h-20 mx-auto bg-red-600 rounded-full flex items-center justify-center mb-4">
                    <XCircle className="w-10 h-10 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-red-400">Verification Failed</h2>
                  <p className="text-slate-400 mt-2">
                    {result?.message || 'This certificate could not be verified. It may be invalid or expired.'}
                  </p>
                  <p className="text-slate-500 text-sm mt-4">
                    If you believe this is an error, please contact MuscleGrid support.
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-slate-600 text-sm mt-6">
          MuscleGrid India Pvt. Ltd. &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
