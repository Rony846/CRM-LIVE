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
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <Header />
        
        <div className="flex-1 flex items-center justify-center p-8">
          <Card className="w-full max-w-lg bg-slate-800/80 border-slate-700 backdrop-blur">
            <CardContent className="p-8 text-center">
              <div className="w-20 h-20 mx-auto bg-green-600 rounded-full flex items-center justify-center mb-6">
                <CheckCircle className="w-10 h-10 text-white" />
              </div>
              
              <h2 className="text-2xl font-bold text-white mb-4">Application Submitted!</h2>
              
              <p className="text-slate-300 mb-6">
                Thank you for your interest in becoming a MuscleGrid dealer. 
                Our team will review your application and contact you within 2-3 business days.
              </p>
              
              <div className="p-4 bg-slate-900 rounded-lg mb-6">
                <div className="flex items-start gap-3 text-left">
                  <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-amber-400 font-medium">Important Note</p>
                    <p className="text-slate-400 text-sm mt-1">
                      After approval, you'll need to pay a security deposit of <span className="text-white font-semibold">₹1,00,000</span> to activate your dealer account and start placing orders.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="space-y-3">
                <Link to="/partners">
                  <Button className="w-full bg-orange-500 hover:bg-orange-600">
                    Go to Dealer Login
                  </Button>
                </Link>
                <p className="text-slate-500 text-sm">
                  Questions? Call us at <a href="tel:+919999036254" className="text-orange-400 hover:underline">+91 98000 06416</a>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
        
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <Header />
      
      <div className="flex-1 py-8 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Back Button */}
          <Link to="/partners" className="inline-flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Login
          </Link>
          
          <Card className="bg-slate-800/80 border-slate-700 backdrop-blur">
            <CardHeader className="text-center border-b border-slate-700 pb-6">
              <CardTitle className="text-2xl font-['Barlow_Condensed'] text-white">
                Dealer Application Form
              </CardTitle>
              <CardDescription className="text-slate-400">
                Fill in your details to apply for MuscleGrid dealership
              </CardDescription>
              
              {/* Info Banner */}
              <div className="mt-4 p-4 bg-amber-900/30 border border-amber-600/50 rounded-lg">
                <div className="flex items-start gap-3 text-left">
                  <Shield className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-amber-400 font-medium">Security Deposit Required</p>
                    <p className="text-slate-300 text-sm mt-1">
                      After approval, a refundable security deposit of <span className="text-white font-bold">₹1,00,000</span> is required 
                      to activate your dealer account and start placing orders.
                    </p>
                  </div>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-8">
                
                {/* Business Details Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2 pb-2 border-b border-slate-700">
                    <Building2 className="w-5 h-5 text-orange-400" />
                    Business Details
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-slate-300">Firm / Shop Name *</Label>
                      <Input
                        value={formData.firm_name}
                        onChange={(e) => handleChange('firm_name', e.target.value)}
                        required
                        placeholder="e.g., ABC Electronics"
                        className="bg-slate-700/50 border-slate-600 text-white"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-slate-300">Business Type *</Label>
                      <Select value={formData.business_type} onValueChange={(v) => handleChange('business_type', v)}>
                        <SelectTrigger className="bg-slate-700/50 border-slate-600 text-white">
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
                    
                    <div className="space-y-2">
                      <Label className="text-slate-300">GST Number</Label>
                      <Input
                        value={formData.gst_number}
                        onChange={(e) => handleChange('gst_number', e.target.value.toUpperCase())}
                        placeholder="e.g., 07AABCU9603R1ZM"
                        className="bg-slate-700/50 border-slate-600 text-white uppercase"
                        maxLength={15}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-slate-300">PAN Number</Label>
                      <Input
                        value={formData.pan_number}
                        onChange={(e) => handleChange('pan_number', e.target.value.toUpperCase())}
                        placeholder="e.g., ABCDE1234F"
                        className="bg-slate-700/50 border-slate-600 text-white uppercase"
                        maxLength={10}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-slate-300">Years in Business *</Label>
                      <Select value={formData.years_in_business} onValueChange={(v) => handleChange('years_in_business', v)}>
                        <SelectTrigger className="bg-slate-700/50 border-slate-600 text-white">
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
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2 pb-2 border-b border-slate-700">
                    <Users className="w-5 h-5 text-orange-400" />
                    Contact Person
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-slate-300">Contact Person Name *</Label>
                      <Input
                        value={formData.contact_person}
                        onChange={(e) => handleChange('contact_person', e.target.value)}
                        required
                        placeholder="Full name"
                        className="bg-slate-700/50 border-slate-600 text-white"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-slate-300">Designation</Label>
                      <Input
                        value={formData.designation}
                        onChange={(e) => handleChange('designation', e.target.value)}
                        placeholder="e.g., Owner, Manager"
                        className="bg-slate-700/50 border-slate-600 text-white"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-slate-300">Mobile Number *</Label>
                      <Input
                        value={formData.phone}
                        onChange={(e) => handleChange('phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                        required
                        placeholder="10-digit mobile number"
                        className="bg-slate-700/50 border-slate-600 text-white"
                        maxLength={10}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-slate-300">Alternate Phone</Label>
                      <Input
                        value={formData.alternate_phone}
                        onChange={(e) => handleChange('alternate_phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                        placeholder="Optional"
                        className="bg-slate-700/50 border-slate-600 text-white"
                        maxLength={10}
                      />
                    </div>
                    
                    <div className="space-y-2 md:col-span-2">
                      <Label className="text-slate-300">Email Address *</Label>
                      <Input
                        type="email"
                        value={formData.email}
                        onChange={(e) => handleChange('email', e.target.value)}
                        required
                        placeholder="business@example.com"
                        className="bg-slate-700/50 border-slate-600 text-white"
                      />
                    </div>
                  </div>
                </div>
                
                {/* Address Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2 pb-2 border-b border-slate-700">
                    <MapPin className="w-5 h-5 text-orange-400" />
                    Business Address
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2 md:col-span-2">
                      <Label className="text-slate-300">Address Line 1 *</Label>
                      <Input
                        value={formData.address_line1}
                        onChange={(e) => handleChange('address_line1', e.target.value)}
                        required
                        placeholder="Shop/Building number, Street"
                        className="bg-slate-700/50 border-slate-600 text-white"
                      />
                    </div>
                    
                    <div className="space-y-2 md:col-span-2">
                      <Label className="text-slate-300">Address Line 2</Label>
                      <Input
                        value={formData.address_line2}
                        onChange={(e) => handleChange('address_line2', e.target.value)}
                        placeholder="Landmark, Area (Optional)"
                        className="bg-slate-700/50 border-slate-600 text-white"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-slate-300">City *</Label>
                      <Input
                        value={formData.city}
                        onChange={(e) => handleChange('city', e.target.value)}
                        required
                        placeholder="City"
                        className="bg-slate-700/50 border-slate-600 text-white"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-slate-300">District *</Label>
                      <Input
                        value={formData.district}
                        onChange={(e) => handleChange('district', e.target.value)}
                        required
                        placeholder="District"
                        className="bg-slate-700/50 border-slate-600 text-white"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-slate-300">State *</Label>
                      <Select value={formData.state} onValueChange={(v) => handleChange('state', v)}>
                        <SelectTrigger className="bg-slate-700/50 border-slate-600 text-white">
                          <SelectValue placeholder="Select state" />
                        </SelectTrigger>
                        <SelectContent className="max-h-60">
                          {INDIAN_STATES.map(state => (
                            <SelectItem key={state} value={state}>{state}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-slate-300">Pincode *</Label>
                      <Input
                        value={formData.pincode}
                        onChange={(e) => handleChange('pincode', e.target.value.replace(/\D/g, '').slice(0, 6))}
                        required
                        placeholder="6-digit pincode"
                        className="bg-slate-700/50 border-slate-600 text-white"
                        maxLength={6}
                      />
                    </div>
                  </div>
                </div>
                
                {/* Business Info Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2 pb-2 border-b border-slate-700">
                    <FileText className="w-5 h-5 text-orange-400" />
                    Business Information
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2 md:col-span-2">
                      <Label className="text-slate-300">Current Brands Dealing</Label>
                      <Textarea
                        value={formData.current_brands}
                        onChange={(e) => handleChange('current_brands', e.target.value)}
                        placeholder="e.g., Luminous, Microtek, Su-Kam, etc."
                        className="bg-slate-700/50 border-slate-600 text-white min-h-[80px]"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-slate-300">Monthly Turnover (Approx)</Label>
                      <Select value={formData.monthly_turnover} onValueChange={(v) => handleChange('monthly_turnover', v)}>
                        <SelectTrigger className="bg-slate-700/50 border-slate-600 text-white">
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
                    
                    <div className="space-y-2">
                      <Label className="text-slate-300">Shop/Showroom Area</Label>
                      <Select value={formData.shop_area} onValueChange={(v) => handleChange('shop_area', v)}>
                        <SelectTrigger className="bg-slate-700/50 border-slate-600 text-white">
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
                    
                    <div className="flex items-center space-x-3">
                      <Checkbox
                        id="godown"
                        checked={formData.godown_available}
                        onCheckedChange={(v) => handleChange('godown_available', v)}
                        className="border-slate-500 data-[state=checked]:bg-orange-500"
                      />
                      <Label htmlFor="godown" className="text-slate-300 cursor-pointer">
                        Godown/Warehouse Available
                      </Label>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      <Checkbox
                        id="vehicle"
                        checked={formData.delivery_vehicle}
                        onCheckedChange={(v) => handleChange('delivery_vehicle', v)}
                        className="border-slate-500 data-[state=checked]:bg-orange-500"
                      />
                      <Label htmlFor="vehicle" className="text-slate-300 cursor-pointer">
                        Own Delivery Vehicle
                      </Label>
                    </div>
                  </div>
                </div>
                
                {/* Reference Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2 pb-2 border-b border-slate-700">
                    <Users className="w-5 h-5 text-orange-400" />
                    Reference (Optional)
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-slate-300">Reference Name</Label>
                      <Input
                        value={formData.reference_name}
                        onChange={(e) => handleChange('reference_name', e.target.value)}
                        placeholder="Name of referral person"
                        className="bg-slate-700/50 border-slate-600 text-white"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-slate-300">Reference Phone</Label>
                      <Input
                        value={formData.reference_phone}
                        onChange={(e) => handleChange('reference_phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                        placeholder="Reference phone number"
                        className="bg-slate-700/50 border-slate-600 text-white"
                        maxLength={10}
                      />
                    </div>
                  </div>
                </div>
                
                {/* Terms Section */}
                <div className="p-4 bg-slate-900 rounded-lg space-y-4">
                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="terms"
                      checked={formData.agree_terms}
                      onCheckedChange={(v) => handleChange('agree_terms', v)}
                      className="border-slate-500 data-[state=checked]:bg-orange-500 mt-1"
                    />
                    <Label htmlFor="terms" className="text-slate-300 cursor-pointer text-sm">
                      I agree to the terms and conditions. I understand that:
                      <ul className="mt-2 space-y-1 text-slate-400 list-disc list-inside">
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
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white py-6 text-lg" 
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
            </CardContent>
          </Card>
        </div>
      </div>
      
      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className="py-4 px-6 border-b border-slate-700/50">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <Link to="/partners" className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center">
            <Users className="w-6 h-6 text-white" />
          </div>
          <div>
            <span className="text-xl font-bold text-white font-['Barlow_Condensed']">MuscleGrid</span>
            <span className="text-orange-400 text-sm ml-2 font-medium">Partner Portal</span>
          </div>
        </Link>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="py-4 px-6 border-t border-slate-700/50">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <div className="text-center md:text-left">
            <p className="font-medium text-slate-400">MuscleGrid Industries Private Limited</p>
            <p>24, B2, Neb Sarai, New Delhi 110068 | GST: 07AATCM1213F1ZM</p>
          </div>
          <div className="flex items-center gap-4">
            <a href="tel:+919999036254" className="flex items-center gap-1 text-orange-400 hover:text-orange-300">
              <Phone className="w-4 h-4" />
              +91 98000 06416
            </a>
            <a href="mailto:service@musclegrid.in" className="flex items-center gap-1 text-orange-400 hover:text-orange-300">
              <Mail className="w-4 h-4" />
              service@musclegrid.in
            </a>
          </div>
        </div>
        <p className="text-center text-slate-600 text-xs mt-4">© {new Date().getFullYear()} MuscleGrid. All rights reserved.</p>
      </div>
    </footer>
  );
}
