import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  FileCheck, Download, Loader2, Award, Crown, Star, QrCode, Building2, MapPin, Calendar
} from 'lucide-react';

const TIER_CONFIG = {
  silver:   { label: 'Silver',   color: 'from-slate-400 to-slate-500',    textColor: 'text-slate-300',   icon: Star,  tone: 'bg-muted text-muted-foreground ring-border' },
  gold:     { label: 'Gold',     color: 'from-yellow-400 to-amber-500',   textColor: 'text-amber-400',   icon: Award, tone: 'bg-amber-400/15 text-amber-400 ring-amber-400/25' },
  platinum: { label: 'Platinum', color: 'from-purple-400 to-indigo-400',  textColor: 'text-violet-300',  icon: Crown, tone: 'bg-violet-400/15 text-violet-400 ring-violet-400/25' }
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
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  const dealer = dashboardData?.dealer || {};
  const tier = tierData?.current_tier || 'silver';
  const tierConfig = TIER_CONFIG[tier] || TIER_CONFIG.silver;
  const TierIcon = tierConfig.icon;
  const isApproved = dealer.status === 'approved';

  return (
    <DashboardLayout title="Dealer Certificate">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Page header */}
        <div>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-1">
            Account · Credentials
          </p>
          <h1 className="text-[26px] font-bold leading-tight tracking-tight text-foreground">Dealer Certificate</h1>
        </div>

        {/* Certificate artwork — keeps the designed branded look, wrapped in dark chrome */}
        <div className="mg-card rounded-lg border border-amber-500/20 bg-gradient-to-br from-[#0e0c07] via-[#131007] to-[#0e0c07] overflow-hidden">
          {/* Orange accent top bar */}
          <div className="h-1 w-full bg-gradient-to-r from-orange-500 to-amber-400" />

          <div className="p-8">
            {/* Certificate Header */}
            <div className="text-center mb-8">
              <div className="w-20 h-20 mx-auto bg-gradient-to-r from-orange-500 to-amber-400 rounded-full flex items-center justify-center mb-4 shadow-[0_0_32px_rgba(249,115,22,0.25)]">
                <span className="text-2xl font-bold text-white">MG</span>
              </div>
              <h1 className="text-3xl font-bold text-orange-400 tracking-widest">MUSCLEGRID</h1>
              <p className="text-muted-foreground text-xs tracking-widest mt-1 font-mono uppercase">
                Consistency Through You
              </p>
            </div>

            {/* Certificate Title */}
            <div className="text-center mb-8">
              <h2 className="text-2xl font-serif text-foreground tracking-wide">Certificate of Authorization</h2>
              <div className="w-32 h-px bg-gradient-to-r from-transparent via-orange-500 to-transparent mx-auto mt-3" />
            </div>

            {/* Dealer Info */}
            <div className="text-center mb-8">
              <p className="text-muted-foreground text-sm mb-3">This is to certify that</p>
              <h3 className="text-3xl font-bold text-foreground mb-4 border-b border-orange-500/50 inline-block pb-2 px-4">
                {dealer.firm_name}
              </h3>

              <div className="flex justify-center my-4">
                <div className={`px-6 py-2 rounded-full bg-gradient-to-r ${tierConfig.color} flex items-center gap-2 shadow-[0_0_20px_rgba(0,0,0,0.4)]`}>
                  <TierIcon className="w-5 h-5 text-white" />
                  <span className="text-white font-bold text-base">{tierConfig.label} Tier Partner</span>
                </div>
              </div>

              <p className="text-muted-foreground text-sm max-w-xl mx-auto">
                is an officially authorized dealer of MuscleGrid Industries Private Limited for the distribution of
                Inverters, Batteries, Stabilizers, and related products.
              </p>
            </div>

            {/* Details grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              {[
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
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="p-4 rounded-md bg-white/5 text-center border border-orange-500/10">
                  <Icon className="w-4 h-4 text-orange-400 mx-auto mb-2" />
                  <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
                  <p className="text-sm font-medium text-foreground mt-1">{value}</p>
                </div>
              ))}
            </div>

            {/* QR + issue date row */}
            <div className="flex items-center justify-between border-t border-border/40 pt-6">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 bg-white rounded-md flex items-center justify-center">
                  <QrCode className="w-10 h-10 text-slate-800" />
                </div>
                <div>
                  <p className="text-[12px] text-muted-foreground">Scan to verify</p>
                  <p className="font-mono text-[10px] text-muted-foreground/60">Certificate authenticity</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Issue Date</p>
                <p className="text-sm text-foreground mt-0.5">
                  {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Download action */}
        <div className="mg-card rounded-lg border border-border bg-card p-5">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded bg-primary/15 text-primary flex-shrink-0">
                <FileCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Download Official Certificate</h3>
                <p className="text-[12px] text-muted-foreground mt-0.5">
                  {isApproved
                    ? 'Download your official MuscleGrid Authorized Dealer Certificate (PDF with QR verification)'
                    : 'Certificate will be available once your account is approved'}
                </p>
              </div>
            </div>
            <Button
              onClick={handleDownload}
              disabled={downloading || !isApproved}
              className="min-w-[160px]"
            >
              {downloading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
              ) : (
                <><Download className="w-4 h-4 mr-2" /> Download PDF</>
              )}
            </Button>
          </div>
        </div>

        {/* Benefits */}
        <div className="mg-card rounded-lg border border-border bg-card">
          <div className="px-5 pt-5 pb-3 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">Certificate Benefits</h2>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
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
              ].map(({ title, body }) => (
                <div key={title} className="p-4 rounded-md bg-muted/40">
                  <h4 className="text-sm font-semibold text-foreground mb-1">{title}</h4>
                  <p className="text-[12px] text-muted-foreground">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
