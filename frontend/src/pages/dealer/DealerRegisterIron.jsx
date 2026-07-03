import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API } from '@/App';
import { toast } from 'sonner';
import { T, Fonts } from '@/components/iron/IronKit';
import {
  Users, Loader2, Phone, Mail, MapPin, Building2, FileText,
  CheckCircle, ArrowLeft, Shield, AlertCircle
} from 'lucide-react';

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Chandigarh', 'Puducherry'
];

// ---- Iron shared styles ----
const labelStyle = {
  display: 'block', marginBottom: 6, fontFamily: T.mono, fontSize: 10.5,
  fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: T.iron400,
};
const inputStyle = {
  width: '100%', border: `1px solid ${T.iron200}`, borderRadius: 8, padding: '11px 13px',
  fontSize: 14, color: T.iron900, background: T.white, outline: 'none', fontFamily: T.body,
};
const selectStyle = { ...inputStyle, appearance: 'none', cursor: 'pointer' };
const sectionTitle = {
  display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 8,
  borderBottom: `1px solid ${T.iron200}`, marginBottom: 16,
  fontFamily: T.headline, fontWeight: 700, fontSize: 13, color: T.iron900,
};
const primaryBtn = {
  width: '100%', border: 'none', background: T.orange, color: '#fff', borderRadius: 9,
  padding: '13px 0', fontFamily: T.headline, fontWeight: 700, fontSize: 14.5, cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
};

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

  const canvas = {
    minHeight: '100vh', width: '100%',
    background: 'radial-gradient(1200px 600px at 50% -10%, #23262B, #141517)',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '32px 16px 48px', fontFamily: T.body,
  };

  const brand = (
    <Link to="/partners" style={{ display: 'inline-flex', alignItems: 'center', gap: 12, textDecoration: 'none', marginBottom: 22 }}>
      <span style={{
        width: 40, height: 40, borderRadius: 9, background: 'rgba(245,130,32,.15)',
        border: `1px solid ${T.orange}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Users style={{ width: 20, height: 20, color: T.orange }} />
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontFamily: T.display, fontWeight: 800, fontSize: 24, letterSpacing: '.02em', color: T.white }}>
          Muscle<span style={{ color: T.orange }}>Grid</span>
        </span>
        <span style={{ fontFamily: T.mono, fontSize: 10.5, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: T.orange }}>
          Partner Portal
        </span>
      </span>
    </Link>
  );

  if (submitted) {
    return (
      <div style={canvas}>
        <Fonts />
        {brand}
        <div style={{
          width: 'min(460px, 100%)', background: T.white, borderRadius: 14, padding: '34px 30px',
          boxShadow: '0 30px 80px rgba(0,0,0,.45)', border: `1px solid ${T.iron200}`, textAlign: 'center',
        }}>
          <div style={{
            width: 64, height: 64, margin: '0 auto 22px', borderRadius: '50%',
            background: T.greenTint, border: `1px solid ${T.green}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <CheckCircle style={{ width: 32, height: 32, color: T.green }} />
          </div>

          <h2 style={{ fontFamily: T.headline, fontWeight: 800, fontSize: 22, color: T.iron900, margin: '0 0 12px' }}>
            Application Submitted!
          </h2>

          <p style={{ color: T.iron500, fontSize: 14, lineHeight: 1.6, margin: '0 0 22px' }}>
            Thank you for your interest in becoming a MuscleGrid dealer.
            Our team will review your application and contact you within 2-3 business days.
          </p>

          <div style={{ padding: 16, background: T.voltageTint, border: `1px solid #EDDFA6`, borderRadius: 10, marginBottom: 22, textAlign: 'left' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <AlertCircle style={{ width: 20, height: 20, color: T.voltageText, flexShrink: 0, marginTop: 2 }} />
              <div>
                <p style={{ color: T.voltageText, fontWeight: 700, fontSize: 13, margin: 0 }}>Important Note</p>
                <p style={{ color: T.iron700, fontSize: 13, margin: '4px 0 0' }}>
                  After approval, you'll need to pay a security deposit of{' '}
                  <span style={{ color: T.iron900, fontWeight: 700 }}>₹1,00,000</span> to activate your dealer account and start placing orders.
                </p>
              </div>
            </div>
          </div>

          <Link to="/partners" style={{ textDecoration: 'none' }}>
            <button type="button" style={primaryBtn}>Go to Dealer Login</button>
          </Link>
          <p style={{ color: T.iron500, fontSize: 13, marginTop: 14 }}>
            Questions? Call us at{' '}
            <a href="tel:+919999036254" style={{ color: T.orange, textDecoration: 'none', fontWeight: 600 }}>
              +91 98000 06416
            </a>
          </p>
        </div>
        <IronFooter />
      </div>
    );
  }

  return (
    <div style={canvas}>
      <Fonts />
      {brand}

      <div style={{ width: 'min(760px, 100%)' }}>
        <Link
          to="/partners"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: T.iron400, textDecoration: 'none', fontSize: 13, marginBottom: 14 }}
        >
          <ArrowLeft style={{ width: 15, height: 15 }} />
          Back to Login
        </Link>

        <div style={{
          background: T.white, borderRadius: 14, boxShadow: '0 30px 80px rgba(0,0,0,.45)',
          border: `1px solid ${T.iron200}`, overflow: 'hidden',
        }}>
          {/* Card Header */}
          <div style={{ padding: '26px 30px', borderBottom: `1px solid ${T.iron200}`, textAlign: 'center' }}>
            <h2 style={{ fontFamily: T.headline, fontWeight: 800, fontSize: 20, color: T.iron900, margin: 0 }}>
              Dealer Application Form
            </h2>
            <p style={{ color: T.iron500, fontSize: 13, margin: '6px 0 0' }}>
              Fill in your details to apply for MuscleGrid dealership
            </p>

            <div style={{ marginTop: 16, padding: 16, background: T.voltageTint, border: `1px solid #EDDFA6`, borderRadius: 10, textAlign: 'left' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <Shield style={{ width: 20, height: 20, color: T.voltageText, flexShrink: 0, marginTop: 2 }} />
                <div>
                  <p style={{ color: T.voltageText, fontWeight: 700, fontSize: 13, margin: 0 }}>Security Deposit Required</p>
                  <p style={{ color: T.iron700, fontSize: 13, margin: '4px 0 0' }}>
                    After approval, a refundable security deposit of{' '}
                    <span style={{ color: T.iron900, fontWeight: 700 }}>₹1,00,000</span> is required
                    to activate your dealer account and start placing orders.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div style={{ padding: '26px 30px' }}>
            <form onSubmit={handleSubmit}>

              {/* Business Details Section */}
              <div style={{ marginBottom: 28 }}>
                <h3 style={sectionTitle}>
                  <Building2 style={{ width: 16, height: 16, color: T.orange }} />
                  Business Details
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                  <div>
                    <label style={labelStyle}>Firm / Shop Name *</label>
                    <input
                      style={inputStyle}
                      value={formData.firm_name}
                      onChange={(e) => handleChange('firm_name', e.target.value)}
                      required
                      placeholder="e.g., ABC Electronics"
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Business Type *</label>
                    <select
                      style={selectStyle}
                      value={formData.business_type}
                      onChange={(e) => handleChange('business_type', e.target.value)}
                      required
                    >
                      <option value="" disabled>Select business type</option>
                      <option value="retailer">Retailer</option>
                      <option value="wholesaler">Wholesaler</option>
                      <option value="distributor">Distributor</option>
                      <option value="dealer">Dealer</option>
                      <option value="service_center">Service Center</option>
                    </select>
                  </div>

                  <div>
                    <label style={labelStyle}>GST Number</label>
                    <input
                      style={{ ...inputStyle, textTransform: 'uppercase' }}
                      value={formData.gst_number}
                      onChange={(e) => handleChange('gst_number', e.target.value.toUpperCase())}
                      placeholder="e.g., 07AABCU9603R1ZM"
                      maxLength={15}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>PAN Number</label>
                    <input
                      style={{ ...inputStyle, textTransform: 'uppercase' }}
                      value={formData.pan_number}
                      onChange={(e) => handleChange('pan_number', e.target.value.toUpperCase())}
                      placeholder="e.g., ABCDE1234F"
                      maxLength={10}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Years in Business *</label>
                    <select
                      style={selectStyle}
                      value={formData.years_in_business}
                      onChange={(e) => handleChange('years_in_business', e.target.value)}
                    >
                      <option value="" disabled>Select experience</option>
                      <option value="0">New Business</option>
                      <option value="1">Less than 1 year</option>
                      <option value="2">1-3 years</option>
                      <option value="5">3-5 years</option>
                      <option value="10">5-10 years</option>
                      <option value="15">10+ years</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Contact Person Section */}
              <div style={{ marginBottom: 28 }}>
                <h3 style={sectionTitle}>
                  <Users style={{ width: 16, height: 16, color: T.orange }} />
                  Contact Person
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                  <div>
                    <label style={labelStyle}>Contact Person Name *</label>
                    <input
                      style={inputStyle}
                      value={formData.contact_person}
                      onChange={(e) => handleChange('contact_person', e.target.value)}
                      required
                      placeholder="Full name"
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Designation</label>
                    <input
                      style={inputStyle}
                      value={formData.designation}
                      onChange={(e) => handleChange('designation', e.target.value)}
                      placeholder="e.g., Owner, Manager"
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Mobile Number *</label>
                    <input
                      style={inputStyle}
                      value={formData.phone}
                      onChange={(e) => handleChange('phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                      required
                      placeholder="10-digit mobile number"
                      maxLength={10}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Alternate Phone</label>
                    <input
                      style={inputStyle}
                      value={formData.alternate_phone}
                      onChange={(e) => handleChange('alternate_phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="Optional"
                      maxLength={10}
                    />
                  </div>

                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={labelStyle}>Email Address *</label>
                    <input
                      style={inputStyle}
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
              <div style={{ marginBottom: 28 }}>
                <h3 style={sectionTitle}>
                  <MapPin style={{ width: 16, height: 16, color: T.orange }} />
                  Business Address
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={labelStyle}>Address Line 1 *</label>
                    <input
                      style={inputStyle}
                      value={formData.address_line1}
                      onChange={(e) => handleChange('address_line1', e.target.value)}
                      required
                      placeholder="Shop/Building number, Street"
                    />
                  </div>

                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={labelStyle}>Address Line 2</label>
                    <input
                      style={inputStyle}
                      value={formData.address_line2}
                      onChange={(e) => handleChange('address_line2', e.target.value)}
                      placeholder="Landmark, Area (Optional)"
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>City *</label>
                    <input
                      style={inputStyle}
                      value={formData.city}
                      onChange={(e) => handleChange('city', e.target.value)}
                      required
                      placeholder="City"
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>District *</label>
                    <input
                      style={inputStyle}
                      value={formData.district}
                      onChange={(e) => handleChange('district', e.target.value)}
                      required
                      placeholder="District"
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>State *</label>
                    <select
                      style={selectStyle}
                      value={formData.state}
                      onChange={(e) => handleChange('state', e.target.value)}
                      required
                    >
                      <option value="" disabled>Select state</option>
                      {INDIAN_STATES.map(state => (
                        <option key={state} value={state}>{state}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={labelStyle}>Pincode *</label>
                    <input
                      style={inputStyle}
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
              <div style={{ marginBottom: 28 }}>
                <h3 style={sectionTitle}>
                  <FileText style={{ width: 16, height: 16, color: T.orange }} />
                  Business Information
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={labelStyle}>Current Brands Dealing</label>
                    <textarea
                      style={{ ...inputStyle, minHeight: 80, resize: 'vertical', fontFamily: T.body }}
                      value={formData.current_brands}
                      onChange={(e) => handleChange('current_brands', e.target.value)}
                      placeholder="e.g., Luminous, Microtek, Su-Kam, etc."
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Monthly Turnover (Approx)</label>
                    <select
                      style={selectStyle}
                      value={formData.monthly_turnover}
                      onChange={(e) => handleChange('monthly_turnover', e.target.value)}
                    >
                      <option value="" disabled>Select range</option>
                      <option value="below_5l">Below ₹5 Lakhs</option>
                      <option value="5l_10l">₹5 - 10 Lakhs</option>
                      <option value="10l_25l">₹10 - 25 Lakhs</option>
                      <option value="25l_50l">₹25 - 50 Lakhs</option>
                      <option value="above_50l">Above ₹50 Lakhs</option>
                    </select>
                  </div>

                  <div>
                    <label style={labelStyle}>Shop/Showroom Area</label>
                    <select
                      style={selectStyle}
                      value={formData.shop_area}
                      onChange={(e) => handleChange('shop_area', e.target.value)}
                    >
                      <option value="" disabled>Select area</option>
                      <option value="below_200">Below 200 sq ft</option>
                      <option value="200_500">200 - 500 sq ft</option>
                      <option value="500_1000">500 - 1000 sq ft</option>
                      <option value="above_1000">Above 1000 sq ft</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input
                      id="godown"
                      type="checkbox"
                      checked={formData.godown_available}
                      onChange={(e) => handleChange('godown_available', e.target.checked)}
                      style={{ width: 16, height: 16, accentColor: T.orange, cursor: 'pointer' }}
                    />
                    <label htmlFor="godown" style={{ color: T.iron900, cursor: 'pointer', fontSize: 13 }}>
                      Godown/Warehouse Available
                    </label>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input
                      id="vehicle"
                      type="checkbox"
                      checked={formData.delivery_vehicle}
                      onChange={(e) => handleChange('delivery_vehicle', e.target.checked)}
                      style={{ width: 16, height: 16, accentColor: T.orange, cursor: 'pointer' }}
                    />
                    <label htmlFor="vehicle" style={{ color: T.iron900, cursor: 'pointer', fontSize: 13 }}>
                      Own Delivery Vehicle
                    </label>
                  </div>
                </div>
              </div>

              {/* Reference Section */}
              <div style={{ marginBottom: 28 }}>
                <h3 style={sectionTitle}>
                  <Users style={{ width: 16, height: 16, color: T.orange }} />
                  Reference (Optional)
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                  <div>
                    <label style={labelStyle}>Reference Name</label>
                    <input
                      style={inputStyle}
                      value={formData.reference_name}
                      onChange={(e) => handleChange('reference_name', e.target.value)}
                      placeholder="Name of referral person"
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Reference Phone</label>
                    <input
                      style={inputStyle}
                      value={formData.reference_phone}
                      onChange={(e) => handleChange('reference_phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="Reference phone number"
                      maxLength={10}
                    />
                  </div>
                </div>
              </div>

              {/* Terms Section */}
              <div style={{ padding: 16, background: T.iron50, borderRadius: 10, border: `1px solid ${T.iron200}`, marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <input
                    id="terms"
                    type="checkbox"
                    checked={formData.agree_terms}
                    onChange={(e) => handleChange('agree_terms', e.target.checked)}
                    style={{ width: 16, height: 16, accentColor: T.orange, cursor: 'pointer', marginTop: 3 }}
                  />
                  <label htmlFor="terms" style={{ color: T.iron700, cursor: 'pointer', fontSize: 13, lineHeight: 1.6 }}>
                    I agree to the terms and conditions. I understand that:
                    <ul style={{ margin: '8px 0 0', paddingLeft: 18, color: T.iron500 }}>
                      <li>My application will be reviewed by MuscleGrid team</li>
                      <li>A security deposit of ₹1,00,000 is required after approval</li>
                      <li>The security deposit is refundable upon account closure</li>
                      <li>I can only place orders after the deposit is verified</li>
                    </ul>
                  </label>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                style={{ ...primaryBtn, opacity: (loading || !formData.agree_terms) ? 0.6 : 1, cursor: (loading || !formData.agree_terms) ? 'not-allowed' : 'pointer' }}
                disabled={loading || !formData.agree_terms}
              >
                {loading ? (
                  <>
                    <Loader2 style={{ width: 18, height: 18 }} className="animate-spin" />
                    Submitting Application...
                  </>
                ) : (
                  <>
                    <FileText style={{ width: 18, height: 18 }} />
                    Submit Application
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>

      <IronFooter />
    </div>
  );
}

function IronFooter() {
  return (
    <div style={{ width: 'min(760px, 100%)', marginTop: 26, textAlign: 'center' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 18, marginBottom: 10 }}>
        <a href="tel:+919999036254" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: T.orange, textDecoration: 'none', fontSize: 13 }}>
          <Phone style={{ width: 15, height: 15 }} />
          +91 98000 06416
        </a>
        <a href="mailto:service@musclegrid.in" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: T.orange, textDecoration: 'none', fontSize: 13 }}>
          <Mail style={{ width: 15, height: 15 }} />
          service@musclegrid.in
        </a>
      </div>
      <p style={{ fontFamily: T.mono, fontSize: 10.5, color: T.iron500, margin: '0 0 2px' }}>
        MuscleGrid Industries Private Limited
      </p>
      <p style={{ fontFamily: T.mono, fontSize: 10, color: T.iron400, margin: 0 }}>
        24, B2, Neb Sarai, New Delhi 110068 | GST: 07AATCM1213F1ZM
      </p>
      <p style={{ fontFamily: T.mono, fontSize: 10, color: T.iron400, marginTop: 8 }}>
        © {new Date().getFullYear()} MuscleGrid. All rights reserved.
      </p>
    </div>
  );
}
