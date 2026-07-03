import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import {
  Shield, Upload, Loader2, CheckCircle, Clock, AlertTriangle,
  IndianRupee, Calendar, FileText, Eye
} from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, badgeStyle } from '@/components/iron/IronKit';

export default function DealerDeposit() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [dealer, setDealer] = useState(null);
  const [form, setForm] = useState({
    amount: '',
    payment_reference: '',
    payment_date: new Date().toISOString().split('T')[0],
    proof_file: null
  });

  useEffect(() => {
    if (token) {
      fetchProfile();
    }
  }, [token]);

  const fetchProfile = async () => {
    try {
      const response = await axios.get(`${API}/dealer/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDealer(response.data);
      setForm(prev => ({ ...prev, amount: response.data.security_deposit_amount || '' }));
    } catch (error) {
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.proof_file) {
      toast.error('Please upload deposit proof');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('amount', form.amount);
      formData.append('payment_reference', form.payment_reference);
      formData.append('payment_date', form.payment_date);
      formData.append('proof_file', form.proof_file);

      await axios.post(`${API}/dealer/deposit/upload-proof`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      toast.success('Deposit proof uploaded successfully');
      navigate('/dealer');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to upload proof');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'approved': return <CheckCircle size={20} color={T.green} />;
      case 'pending':  return <Clock size={20} color={T.voltageText} />;
      case 'rejected': return <AlertTriangle size={20} color={T.orangeDeep} />;
      default:         return <Shield size={20} color={T.iron400} />;
    }
  };

  const getStatusBadge = (status) => {
    const toneMap = { approved: 'ok', pending: 'warn', rejected: 'bad' };
    const tone = toneMap[status] || 'slate';
    return <span style={badgeStyle(tone)}>{(status || 'not paid').replace(/_/g, ' ')}</span>;
  };

  const inputStyle = {
    border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '7px 10px',
    fontSize: 12.5, color: T.iron900, background: T.white, outline: 'none', width: '100%'
  };
  const labelEl = (txt) => (
    <div style={{ marginBottom: 6 }}><Caps size={10} color={T.iron500} ls=".05em">{txt}</Caps></div>
  );
  const sectionHead = (icon, title, sub) => (
    <div style={{ padding: '14px 16px', borderBottom: `1px solid ${T.iron200}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {icon}
        <span style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 13.5, color: T.iron900 }}>{title}</span>
      </div>
      {sub && <div style={{ fontSize: 11.5, color: T.iron500, marginTop: 4 }}>{sub}</div>}
    </div>
  );

  if (loading) {
    return (
      <IronShell title="Security Deposit" subtitle="ACCOUNT · ONBOARDING">
        <div style={{ display: 'grid', placeItems: 'center', height: 260 }}>
          <Loader2 className="animate-spin" size={30} color={T.orange} />
        </div>
      </IronShell>
    );
  }

  const depositStatus = dealer?.security_deposit_status || 'not_paid';
  const canUpload = depositStatus === 'not_paid' || depositStatus === 'rejected';

  const content = (
    <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Status Card */}
      <IronCard pad={0}>
        {sectionHead(<Shield size={15} color={T.blue} />, 'Security Deposit Status')}
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Status row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderRadius: 8, background: T.iron50, border: `1px solid ${T.iron200}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {getStatusIcon(depositStatus)}
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.iron900, textTransform: 'capitalize' }}>
                  {depositStatus.replace(/_/g, ' ')}
                </div>
                <div style={{ fontSize: 11.5, color: T.iron500, marginTop: 2 }}>
                  {depositStatus === 'approved' &&
                    `Approved on ${new Date(dealer.security_deposit_approved_at).toLocaleDateString()}`}
                  {depositStatus === 'pending' && 'Under review by admin'}
                  {depositStatus === 'rejected' && dealer.security_deposit_remarks}
                  {depositStatus === 'not_paid' && 'Please upload deposit proof to activate your account'}
                </div>
              </div>
            </div>
            {getStatusBadge(depositStatus)}
          </div>

          {/* Amount & date grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div style={{ padding: 14, borderRadius: 8, background: T.iron50, border: `1px solid ${T.iron200}` }}>
              <Caps size={10} color={T.iron500} ls=".07em">Required Amount</Caps>
              <div style={{ ...mono, marginTop: 6, fontSize: 20, fontWeight: 700, color: T.iron900, display: 'flex', alignItems: 'center', gap: 3 }}>
                <IndianRupee size={16} />
                {(dealer?.security_deposit_amount || 100000).toLocaleString('en-IN')}
              </div>
            </div>
            {dealer?.security_deposit_uploaded_at && (
              <div style={{ padding: 14, borderRadius: 8, background: T.iron50, border: `1px solid ${T.iron200}` }}>
                <Caps size={10} color={T.iron500} ls=".07em">Uploaded On</Caps>
                <div style={{ marginTop: 6, fontSize: 13, fontWeight: 600, color: T.iron900, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Calendar size={14} color={T.iron400} />
                  {new Date(dealer.security_deposit_uploaded_at).toLocaleDateString()}
                </div>
              </div>
            )}
          </div>

          {/* Proof file link */}
          {dealer?.security_deposit_proof_path && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: 8, background: T.iron50, border: `1px solid ${T.iron200}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.iron500 }}>
                <FileText size={15} />
                <span style={{ fontSize: 13 }}>Deposit Proof Uploaded</span>
              </div>
              <a
                href={`${API.replace('/api', '')}${dealer.security_deposit_proof_path}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: 4, color: T.orange, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}
              >
                <Eye size={15} />
                View
              </a>
            </div>
          )}
        </div>
      </IronCard>

      {/* Upload Form */}
      {canUpload && (
        <IronCard pad={0}>
          {sectionHead(null, 'Upload Deposit Proof', 'Upload your payment proof (bank receipt, transaction screenshot, etc.)')}
          <div style={{ padding: 16 }}>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                {labelEl('Amount Paid *')}
                <input
                  type="number"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="Enter amount"
                  required
                  style={inputStyle}
                />
              </div>

              <div>
                {labelEl('Payment Reference / UTR')}
                <input
                  value={form.payment_reference}
                  onChange={(e) => setForm({ ...form, payment_reference: e.target.value })}
                  placeholder="Transaction reference number"
                  style={inputStyle}
                />
              </div>

              <div>
                {labelEl('Payment Date')}
                <input
                  type="date"
                  value={form.payment_date}
                  onChange={(e) => setForm({ ...form, payment_date: e.target.value })}
                  style={inputStyle}
                />
              </div>

              <div>
                {labelEl('Upload Proof *')}
                <div style={{ border: `2px dashed ${T.iron200}`, borderRadius: 8, padding: 24, textAlign: 'center' }}>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.heic,.webp"
                    onChange={(e) => setForm({ ...form, proof_file: e.target.files[0] })}
                    style={{ display: 'none' }}
                    id="proof-upload"
                  />
                  <label htmlFor="proof-upload" style={{ cursor: 'pointer' }}>
                    {form.proof_file ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: T.green }}>
                        <CheckCircle size={22} />
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{form.proof_file.name}</span>
                      </div>
                    ) : (
                      <>
                        <Upload size={30} color={T.iron400} style={{ margin: '0 auto 8px' }} />
                        <div style={{ fontSize: 13, color: T.iron900 }}>Click to upload</div>
                        <div style={{ fontSize: 11.5, color: T.iron500, marginTop: 4 }}>PDF, JPG, PNG (max 10MB)</div>
                      </>
                    )}
                  </label>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                style={{
                  border: 'none', background: T.orange, color: '#fff', borderRadius: 6,
                  padding: '10px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12.5,
                  cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1,
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                }}
              >
                {submitting && <Loader2 className="animate-spin" size={15} />}
                Submit Deposit Proof
              </button>
            </form>
          </div>
        </IronCard>
      )}

      {/* Payment Instructions */}
      <IronCard pad={0}>
        {sectionHead(null, 'Payment Instructions')}
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 13, color: T.iron500 }}>Please transfer the security deposit amount to:</div>
          <div style={{ padding: 14, borderRadius: 8, background: T.iron50, border: `1px solid ${T.iron200}`, display: 'flex', flexDirection: 'column', gap: 6, ...mono, fontSize: 12.5 }}>
            <div style={{ color: T.iron900 }}><span style={{ color: T.iron500 }}>Company Name: </span>MuscleGrid Industries Pvt Ltd</div>
            <div style={{ color: T.iron900 }}><span style={{ color: T.iron500 }}>Account No: </span>84684684600</div>
            <div style={{ color: T.iron900 }}><span style={{ color: T.iron500 }}>IFSC: </span>IDFB0021525</div>
            <div style={{ color: T.iron900 }}><span style={{ color: T.iron500 }}>Bank: </span>IDFC First Bank</div>
          </div>
          <div style={{ fontSize: 11.5, color: T.iron500 }}>
            Note: Your dealer account will be activated once the deposit is verified by our team.
            Security deposit amount: ₹1,00,000 (One Lakh Rupees)
          </div>
        </div>
      </IronCard>
    </div>
  );

  return (
    <IronShell title="Security Deposit" subtitle="ACCOUNT · ONBOARDING" onRefresh={fetchProfile}>
      {content}
    </IronShell>
  );
}
