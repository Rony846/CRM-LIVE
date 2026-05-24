import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API } from '@/App';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import {
  Users, Loader2, Phone, Mail, MapPin, Building2, FileText,
  CheckCircle, ArrowLeft, Shield, IndianRupee, AlertCircle
} from 'lucide-react';

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Chandigarh', 'Puducherry'
];

export default function DealerRegister() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    // Business Details
    firm_name: '',
    business_type: '',
    gst_number: '',
    pan_number: '',
    years_in_business: '',

    // Contact Person
    contact_person: '',
    designation: '',
    phone: '',
    alternate_phone: '',
    email: '',

    // Address
    address_line1: '',
    address_line2: '',
    city: '',
    district: '',
    state: '',
    pincode: '',

    // Business Info
    current_brands: '',
    monthly_turnover: '',
    shop_area: '',
    godown_available: false,
    delivery_vehicle: false,

    // References
    reference_name: '',
    reference_phone: '',

    // Terms
    agree_terms: false
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.agree_terms) {
      toast.error('Please agree to the terms and conditions');
      return;
    }

    setLoading(true);

    try {
      await axios.post(`${API}/dealer-applications`, {
        firm_name: formData.firm_name,
        business_type: formData.business_type,
        gst_number: formData.gst_number || null,
        pan_number: formData.pan_number || null,
        years_in_business: parseInt(formData.years_in_business) || 0,
        contact_person: formData.contact_person,
        designation: formData.designation,
        phone: formData.phone,
        alternate_phone: formData.alternate_phone || null,
        email: formData.email,
        address: {
          line1: formData.address_line1,
          line2: formData.address_line2 || null,
          city: formData.city,
          district: formData.district,
          state: formData.state,
          pincode: formData.pincode
        },
        current_brands: formData.current_brands || null,
        monthly_turnover: formData.monthly_turnover || null,
        shop_area: formData.shop_area || null,
        godown_available: formData.godown_available,
        delivery_vehicle: formData.delivery_vehicle,
        reference: formData.reference_name ? {
          name: formData.reference_name,
          phone: formData.reference_phone
        } : null
      });

      setSubmitted(true);
      toast.success('Application submitted successfully!');
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to submit application';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col bg-background" style={{
        background: 'radial-gradient(ellipse 80% 60% at 50% -10%, hsl(243 75% 62% / 0.12) 0%, transparent 60%), hsl(var(--background))'
      }}>
        <Header />

        <div className="flex-1 flex items-center justify-center p-8">
          <div className="mg-card w-full max-w-lg rounded-lg border border-border bg-card p-8 text-center">
            <div className="w-16 h-16 mx-auto bg-emerald-500/15 border border-emerald-500/30 rounded-full flex items-center justify-center mb-6">
              <CheckCircle className="w-8 h-8 text-emerald-400" />
            </div>

            <h2 className="text-2xl font-bold text-foreground mb-3">Application Submitted!</h2>

            <p className="text-muted-foreground mb-6 leading-relaxed">
              Thank you for your interest in becoming a MuscleGrid dealer.
              Our team will review your application and contact you within 2-3 business days.
            </p>

            <div className="p-4 bg-amber-400/10 border border-amber-400/25 rounded mb-6">
              <div className="flex items-start gap-3 text-left">
                <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-amber-400 font-semibold text-sm">Important Note</p>
                  <p className="text-muted-foreground text-sm mt-1">
                    After approval, you'll need to pay a security deposit of{' '}
                    <span className="text-foreground font-semibold">₹1,00,000</span> to activate your dealer account and start placing orders.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Link to="/partners">
                <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                  Go to Dealer Login
                </Button>
              </Link>
              <p className="text-muted-foreground text-sm">
                Questions? Call us at{' '}
                <a href="tel:+919999036254" className="text-primary hover:text-primary/80 hover:underline">
                  +91 98000 06416
                </a>
              </p>
            </div>
          </div>
        </div>

        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background" style={{
      background: 'radial-gradient(ellipse 80% 60% at 50% -10%, hsl(243 75% 62% / 0.12) 0%, transparent 60%), hsl(var(--background))'
    }}>
      <Header />

      <div className="flex-1 py-8 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Back Button */}
          <Link
            to="/partners"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Login
          </Link>

          <div className="mg-card rounded-lg border border-border bg-card overflow-hidden">
            {/* Card Header */}
            <div className="p-6 border-b border-border text-center">
              <h2 className="text-xl font-bold text-foreground">Dealer Application Form</h2>
              <p className="text-muted-foreground text-sm mt-1">
                Fill in your details to apply for MuscleGrid dealership
              </p>

              {/* Security Deposit Banner */}
              <div className="mt-4 p-4 bg-amber-400/10 border border-amber-400/25 rounded text-left">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-amber-400 font-semibold text-sm">Security Deposit Required</p>
                    <p className="text-muted-foreground text-sm mt-1">
                      After approval, a refundable security deposit of{' '}
                      <span className="text-foreground font-bold">₹1,00,000</span> is required
                      to activate your dealer account and start placing orders.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6">
              <form onSubmit={handleSubmit} className="space-y-8">

                {/* Business Details Section */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 pb-2 border-b border-border">
                    <Building2 className="w-4 h-4 text-primary" />
                    Business Details
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Firm / Shop Name *
                      </Label>
                      <Input
                        value={formData.firm_name}
                        onChange={(e) => handleChange('firm_name', e.target.value)}
                        required
                        placeholder="e.g., ABC Electronics"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Business Type *
                      </Label>
                      <Select value={formData.business_type} onValueChange={(v) => handleChange('business_type', v)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select business type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="retailer">Retailer</SelectItem>
                          <SelectItem value="wholesaler">Wholesaler</SelectItem>
                          <SelectItem value="distributor">Distributor</SelectItem>
                          <SelectItem value="dealer">Dealer</SelectItem>
                          <SelectItem value="service_center">Service Center</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        GST Number
                      </Label>
                      <Input
                        value={formData.gst_number}
                        onChange={(e) => handleChange('gst_number', e.target.value.toUpperCase())}
                        placeholder="e.g., 07AABCU9603R1ZM"
                        className="uppercase"
                        maxLength={15}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        PAN Number
                      </Label>
                      <Input
                        value={formData.pan_number}
                        onChange={(e) => handleChange('pan_number', e.target.value.toUpperCase())}
                        placeholder="e.g., ABCDE1234F"
                        className="uppercase"
                        maxLength={10}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Years in Business *
                      </Label>
                      <Select value={formData.years_in_business} onValueChange={(v) => handleChange('years_in_business', v)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select experience" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">New Business</SelectItem>
                          <SelectItem value="1">Less than 1 year</SelectItem>
                          <SelectItem value="2">1-3 years</SelectItem>
                          <SelectItem value="5">3-5 years</SelectItem>
                          <SelectItem value="10">5-10 years</SelectItem>
                          <SelectItem value="15">10+ years</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Contact Person Section */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 pb-2 border-b border-border">
                    <Users className="w-4 h-4 text-primary" />
                    Contact Person
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Contact Person Name *
                      </Label>
                      <Input
                        value={formData.contact_person}
                        onChange={(e) => handleChange('contact_person', e.target.value)}
                        required
                        placeholder="Full name"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Designation
                      </Label>
                      <Input
                        value={formData.designation}
                        onChange={(e) => handleChange('designation', e.target.value)}
                        placeholder="e.g., Owner, Manager"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Mobile Number *
                      </Label>
                      <Input
                        value={formData.phone}
                        onChange={(e) => handleChange('phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                        required
                        placeholder="10-digit mobile number"
                        maxLength={10}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Alternate Phone
                      </Label>
                      <Input
                        value={formData.alternate_phone}
                        onChange={(e) => handleChange('alternate_phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                        placeholder="Optional"
                        maxLength={10}
                      />
                    </div>

                    <div className="space-y-1.5 md:col-span-2">
                      <Label className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Email Address *
                      </Label>
                      <Input
                        type="email"
                        value={formData.email}
                        onChange={(e) => handleChange('email', e.target.value)}
                        required
                        placeholder="business@example.com"
                      />
                    </div>
                  </div>
                </div>

                {/* Address Section */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 pb-2 border-b border-border">
                    <MapPin className="w-4 h-4 text-primary" />
                    Business Address
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5 md:col-span-2">
                      <Label className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Address Line 1 *
                      </Label>
                      <Input
                        value={formData.address_line1}
                        onChange={(e) => handleChange('address_line1', e.target.value)}
                        required
                        placeholder="Shop/Building number, Street"
                      />
                    </div>

                    <div className="space-y-1.5 md:col-span-2">
                      <Label className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Address Line 2
                      </Label>
                      <Input
                        value={formData.address_line2}
                        onChange={(e) => handleChange('address_line2', e.target.value)}
                        placeholder="Landmark, Area (Optional)"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        City *
                      </Label>
                      <Input
                        value={formData.city}
                        onChange={(e) => handleChange('city', e.target.value)}
                        required
                        placeholder="City"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        District *
                      </Label>
                      <Input
                        value={formData.district}
                        onChange={(e) => handleChange('district', e.target.value)}
                        required
                        placeholder="District"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        State *
                      </Label>
                      <Select value={formData.state} onValueChange={(v) => handleChange('state', v)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select state" />
                        </SelectTrigger>
                        <SelectContent className="max-h-60">
                          {INDIAN_STATES.map(state => (
                            <SelectItem key={state} value={state}>{state}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Pincode *
                      </Label>
                      <Input
                        value={formData.pincode}
                        onChange={(e) => handleChange('pincode', e.target.value.replace(/\D/g, '').slice(0, 6))}
                        required
                        placeholder="6-digit pincode"
                        maxLength={6}
                      />
                    </div>
                  </div>
                </div>

                {/* Business Info Section */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 pb-2 border-b border-border">
                    <FileText className="w-4 h-4 text-primary" />
                    Business Information
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5 md:col-span-2">
                      <Label className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Current Brands Dealing
                      </Label>
                      <Textarea
                        value={formData.current_brands}
                        onChange={(e) => handleChange('current_brands', e.target.value)}
                        placeholder="e.g., Luminous, Microtek, Su-Kam, etc."
                        className="min-h-[80px]"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Monthly Turnover (Approx)
                      </Label>
                      <Select value={formData.monthly_turnover} onValueChange={(v) => handleChange('monthly_turnover', v)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select range" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="below_5l">Below ₹5 Lakhs</SelectItem>
                          <SelectItem value="5l_10l">₹5 - 10 Lakhs</SelectItem>
                          <SelectItem value="10l_25l">₹10 - 25 Lakhs</SelectItem>
                          <SelectItem value="25l_50l">₹25 - 50 Lakhs</SelectItem>
                          <SelectItem value="above_50l">Above ₹50 Lakhs</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Shop/Showroom Area
                      </Label>
                      <Select value={formData.shop_area} onValueChange={(v) => handleChange('shop_area', v)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select area" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="below_200">Below 200 sq ft</SelectItem>
                          <SelectItem value="200_500">200 - 500 sq ft</SelectItem>
                          <SelectItem value="500_1000">500 - 1000 sq ft</SelectItem>
                          <SelectItem value="above_1000">Above 1000 sq ft</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center gap-3">
                      <Checkbox
                        id="godown"
                        checked={formData.godown_available}
                        onCheckedChange={(v) => handleChange('godown_available', v)}
                        className="border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                      />
                      <Label htmlFor="godown" className="text-foreground cursor-pointer text-sm">
                        Godown/Warehouse Available
                      </Label>
                    </div>

                    <div className="flex items-center gap-3">
                      <Checkbox
                        id="vehicle"
                        checked={formData.delivery_vehicle}
                        onCheckedChange={(v) => handleChange('delivery_vehicle', v)}
                        className="border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                      />
                      <Label htmlFor="vehicle" className="text-foreground cursor-pointer text-sm">
                        Own Delivery Vehicle
                      </Label>
                    </div>
                  </div>
                </div>

                {/* Reference Section */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 pb-2 border-b border-border">
                    <Users className="w-4 h-4 text-primary" />
                    Reference (Optional)
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Reference Name
                      </Label>
                      <Input
                        value={formData.reference_name}
                        onChange={(e) => handleChange('reference_name', e.target.value)}
                        placeholder="Name of referral person"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Reference Phone
                      </Label>
                      <Input
                        value={formData.reference_phone}
                        onChange={(e) => handleChange('reference_phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                        placeholder="Reference phone number"
                        maxLength={10}
                      />
                    </div>
                  </div>
                </div>

                {/* Terms Section */}
                <div className="p-4 bg-muted rounded border border-border space-y-4">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="terms"
                      checked={formData.agree_terms}
                      onCheckedChange={(v) => handleChange('agree_terms', v)}
                      className="border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary mt-1"
                    />
                    <Label htmlFor="terms" className="text-muted-foreground cursor-pointer text-sm leading-relaxed">
                      I agree to the terms and conditions. I understand that:
                      <ul className="mt-2 space-y-1 text-muted-foreground list-disc list-inside">
                        <li>My application will be reviewed by MuscleGrid team</li>
                        <li>A security deposit of ₹1,00,000 is required after approval</li>
                        <li>The security deposit is refundable upon account closure</li>
                        <li>I can only place orders after the deposit is verified</li>
                      </ul>
                    </Label>
                  </div>
                </div>

                {/* Submit Button */}
                <Button
                  type="submit"
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90 py-6 text-base"
                  disabled={loading || !formData.agree_terms}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Submitting Application...
                    </>
                  ) : (
                    <>
                      <FileText className="w-5 h-5 mr-2" />
                      Submit Application
                    </>
                  )}
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className="py-4 px-6 border-b border-border/50">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <Link to="/partners" className="flex items-center gap-3">
          <div className="w-9 h-9 bg-primary/15 border border-primary/30 rounded flex items-center justify-center">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div>
            <span className="text-lg font-bold text-foreground tracking-tight">MuscleGrid</span>
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wide text-primary ml-2">
              Partner Portal
            </span>
          </div>
        </Link>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="py-4 px-6 border-t border-border/50">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-center md:text-left">
            <p className="font-mono text-[11px] font-semibold text-muted-foreground">
              MuscleGrid Industries Private Limited
            </p>
            <p className="font-mono text-[10px] text-muted-foreground/70">
              24, B2, Neb Sarai, New Delhi 110068 | GST: 07AATCM1213F1ZM
            </p>
          </div>
          <div className="flex items-center gap-4">
            <a href="tel:+919999036254" className="flex items-center gap-1.5 text-primary hover:text-primary/80 transition-colors text-sm">
              <Phone className="w-4 h-4" />
              +91 98000 06416
            </a>
            <a href="mailto:service@musclegrid.in" className="flex items-center gap-1.5 text-primary hover:text-primary/80 transition-colors text-sm">
              <Mail className="w-4 h-4" />
              service@musclegrid.in
            </a>
          </div>
        </div>
        <p className="text-center font-mono text-[10px] text-muted-foreground/50 mt-4">
          © {new Date().getFullYear()} MuscleGrid. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
