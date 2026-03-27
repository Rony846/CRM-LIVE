import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  FileCheck, Download, Loader2, Award, Crown, Star, QrCode, Building2, MapPin, Calendar
} from 'lucide-react';

const TIER_CONFIG = {
  silver: { label: 'Silver', color: 'from-slate-400 to-slate-500', textColor: 'text-slate-300', icon: Star },
  gold: { label: 'Gold', color: 'from-yellow-400 to-amber-500', textColor: 'text-yellow-400', icon: Award },
  platinum: { label: 'Platinum', color: 'from-purple-400 to-indigo-400', textColor: 'text-purple-300', icon: Crown }
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
      <DashboardLayout title="Dealer Certificate">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
        </div>
      </DashboardLayout>
    );
  }

  const dealer = dashboardData?.dealer || {};
  const tier = tierData?.current_tier || 'silver';
  const tierConfig = TIER_CONFIG[tier];
  const TierIcon = tierConfig?.icon || Star;
  const isApproved = dealer.status === 'approved';

  return (
    <DashboardLayout title="Dealer Certificate">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Certificate Preview Card */}
        <Card className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-orange-500/30 overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 to-amber-500" />
          <CardContent className="p-8">
            {/* Certificate Header */}
            <div className="text-center mb-8">
              <div className="w-24 h-24 mx-auto bg-gradient-to-r from-orange-500 to-amber-500 rounded-full flex items-center justify-center mb-4">
                <span className="text-3xl font-bold text-white">MG</span>
              </div>
              <h1 className="text-3xl font-bold text-orange-400 tracking-wider">MUSCLEGRID</h1>
              <p className="text-slate-400 text-sm tracking-widest mt-1">CONSISTENCY THROUGH YOU</p>
            </div>

            {/* Certificate Title */}
            <div className="text-center mb-8">
              <h2 className="text-2xl font-serif text-white tracking-wide">Certificate of Authorization</h2>
              <div className="w-32 h-0.5 bg-gradient-to-r from-transparent via-orange-500 to-transparent mx-auto mt-3" />
            </div>

            {/* Dealer Info */}
            <div className="text-center mb-8">
              <p className="text-slate-400 mb-2">This is to certify that</p>
              <h3 className="text-3xl font-bold text-white mb-4 border-b-2 border-orange-500 inline-block pb-2 px-4">
                {dealer.firm_name}
              </h3>
              
              <div className="flex justify-center my-4">
                <div className={`px-6 py-2 rounded-full bg-gradient-to-r ${tierConfig?.color} flex items-center gap-2`}>
                  <TierIcon className="w-5 h-5 text-white" />
                  <span className="text-white font-bold text-lg">{tierConfig?.label} Tier Partner</span>
                </div>
              </div>
              
              <p className="text-slate-300 max-w-xl mx-auto">
                is an officially authorized dealer of MuscleGrid India Pvt. Ltd. for the distribution of
                Inverters, Batteries, Stabilizers, and related products.
              </p>
            </div>

            {/* Details */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="p-4 bg-slate-800/50 rounded-lg text-center">
                <MapPin className="w-5 h-5 text-orange-400 mx-auto mb-2" />
                <p className="text-slate-400 text-sm">Location</p>
                <p className="text-white">{dealer.address?.city || dealer.city}, {dealer.address?.state || dealer.state}</p>
              </div>
              <div className="p-4 bg-slate-800/50 rounded-lg text-center">
                <Calendar className="w-5 h-5 text-orange-400 mx-auto mb-2" />
                <p className="text-slate-400 text-sm">Dealer Since</p>
                <p className="text-white">{dealer.created_at ? new Date(dealer.created_at).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : 'N/A'}</p>
              </div>
              <div className="p-4 bg-slate-800/50 rounded-lg text-center">
                <Building2 className="w-5 h-5 text-orange-400 mx-auto mb-2" />
                <p className="text-slate-400 text-sm">Total Business</p>
                <p className="text-white">{formatCurrency(tierData?.total_purchase_value)}</p>
              </div>
            </div>

            {/* QR Code Section */}
            <div className="flex items-center justify-between border-t border-slate-700 pt-6">
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 bg-white rounded-lg flex items-center justify-center">
                  <QrCode className="w-12 h-12 text-slate-800" />
                </div>
                <div>
                  <p className="text-slate-400 text-sm">Scan to verify</p>
                  <p className="text-slate-500 text-xs">Certificate authenticity</p>
                </div>
              </div>
              
              <div className="text-right">
                <p className="text-slate-400 text-sm">Issue Date</p>
                <p className="text-white">{new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Download Section */}
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-orange-600 rounded-lg flex items-center justify-center">
                  <FileCheck className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-white font-semibold">Download Official Certificate</h3>
                  <p className="text-slate-400 text-sm">
                    {isApproved 
                      ? 'Download your official MuscleGrid Authorized Dealer Certificate (PDF with QR verification)'
                      : 'Certificate will be available once your account is approved'}
                  </p>
                </div>
              </div>
              
              <Button 
                onClick={handleDownload}
                disabled={downloading || !isApproved}
                className="bg-orange-600 hover:bg-orange-700 min-w-[180px]"
              >
                {downloading ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
                ) : (
                  <><Download className="w-4 h-4 mr-2" /> Download PDF</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Benefits Info */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Certificate Benefits</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-slate-900 rounded-lg">
                <h4 className="text-white font-medium mb-2">Official Authorization</h4>
                <p className="text-slate-400 text-sm">
                  Display your certificate to customers as proof of official MuscleGrid dealership.
                </p>
              </div>
              <div className="p-4 bg-slate-900 rounded-lg">
                <h4 className="text-white font-medium mb-2">QR Verification</h4>
                <p className="text-slate-400 text-sm">
                  Each certificate contains a unique QR code that anyone can scan to verify authenticity.
                </p>
              </div>
              <div className="p-4 bg-slate-900 rounded-lg">
                <h4 className="text-white font-medium mb-2">Tier Recognition</h4>
                <p className="text-slate-400 text-sm">
                  Your certificate displays your current tier status - Silver, Gold, or Platinum.
                </p>
              </div>
              <div className="p-4 bg-slate-900 rounded-lg">
                <h4 className="text-white font-medium mb-2">Print Ready</h4>
                <p className="text-slate-400 text-sm">
                  High-quality PDF suitable for printing and framing at your store or office.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
