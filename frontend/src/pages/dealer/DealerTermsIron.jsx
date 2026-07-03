import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import {
  FileText, Loader2, CheckCircle2, ShieldCheck, Download,
  AlertTriangle, Clock, FileCheck2, ScrollText, ChevronDown,
} from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, badgeStyle } from '@/components/iron/IronKit';

/**
 * Dealer Terms & Conditions page — Iron Console theme.
 *
 * - GET /dealer/terms          → markdown + version + effective_date
 * - GET /dealer/terms/status   → has the current dealer accepted the current version?
 * - POST /dealer/terms/accept  → stamps acceptance (ip + ua + timestamp + version)
 * - GET /dealer/terms/pdf      → branded PDF (with acceptance block if accepted)
 *
 * The Accept button is gated until the user has scrolled within ~120px of the bottom of
 * the agreement — encourages actually reading it and avoids accidental clicks.
 */
export default function DealerTerms() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [doc, setDoc] = useState(null);             // { markdown, version, effective_date }
  const [status, setStatus] = useState(null);       // { accepted_version, accepted_at, accepted_ip, needs_acceptance }
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const scrollRef = useRef(null);

  const fetchAll = useCallback(async () => {
    try {
      const [docResp, statusResp] = await Promise.all([
        axios.get(`${API}/dealer/terms`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/dealer/terms/status`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      setDoc(docResp.data);
      setStatus(statusResp.data);
      // If they already accepted the current version, unlock the button by default
      if (!statusResp.data.needs_acceptance) setScrolledToBottom(true);
    } catch (err) {
      console.error('Failed to load T&C:', err);
      toast.error('Failed to load Dealer Agreement');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) fetchAll();
  }, [token, fetchAll]);

  const handleScroll = (e) => {
    const el = e.target;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distFromBottom < 120) setScrolledToBottom(true);
  };

  const handleAccept = async () => {
    if (accepting) return;
    setAccepting(true);
    try {
      const resp = await axios.post(
        `${API}/dealer/terms/accept`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success('Dealer Agreement accepted. A signed copy has been emailed to you.');
      setStatus({
        current_version: resp.data.version,
        accepted_version: resp.data.version,
        accepted_at: resp.data.accepted_at,
        accepted_ip: resp.data.accepted_ip,
        needs_acceptance: false,
      });
    } catch (err) {
      console.error('Failed to accept T&C:', err);
      toast.error(err.response?.data?.detail || 'Failed to record acceptance. Please retry.');
    } finally {
      setAccepting(false);
    }
  };

  const handleDownloadPdf = async () => {
    try {
      const resp = await axios.get(`${API}/dealer/terms/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob',
      });
      const blob = new Blob([resp.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `MuscleGrid_Dealer_TandC_v${doc?.version || '1.0'}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download PDF:', err);
      toast.error('Failed to generate PDF');
    }
  };

  const btnPrimary = {
    border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '10px 18px',
    fontFamily: T.headline, fontWeight: 700, fontSize: 13, cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', gap: 8,
  };
  const btnOutline = {
    border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, borderRadius: 6,
    padding: '7px 12px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', gap: 6,
  };

  if (loading) {
    return (
      <IronShell title="Terms & Conditions" subtitle="DEALER AGREEMENT">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 384 }}>
          <Loader2 className="w-8 h-8 animate-spin" color={T.orange} />
        </div>
      </IronShell>
    );
  }

  const needsAcceptance = status?.needs_acceptance;
  const accepted = !!status?.accepted_version;

  const mdComponents = {
    h1: ({ node, ...props }) => <h1 style={{ fontSize: 22, fontWeight: 800, color: T.iron900, margin: '24px 0 16px', paddingBottom: 8, borderBottom: `1px solid ${T.iron200}`, fontFamily: T.headline }} {...props} />,
    h2: ({ node, ...props }) => <h2 style={{ fontSize: 17, fontWeight: 700, color: T.iron900, margin: '24px 0 12px', borderLeft: `4px solid ${T.orange}`, paddingLeft: 12, fontFamily: T.headline }} {...props} />,
    h3: ({ node, ...props }) => <h3 style={{ fontSize: 15, fontWeight: 700, color: T.iron900, margin: '16px 0 8px', fontFamily: T.headline }} {...props} />,
    p:  ({ node, ...props }) => <p style={{ fontSize: 13, color: T.iron700, lineHeight: 1.7, margin: '8px 0' }} {...props} />,
    ul: ({ node, ...props }) => <ul style={{ fontSize: 13, color: T.iron700, listStyle: 'disc', paddingLeft: 24, margin: '8px 0' }} {...props} />,
    ol: ({ node, ...props }) => <ol style={{ fontSize: 13, color: T.iron700, listStyle: 'decimal', paddingLeft: 24, margin: '8px 0' }} {...props} />,
    li: ({ node, ...props }) => <li style={{ lineHeight: 1.7, margin: '2px 0' }} {...props} />,
    strong: ({ node, ...props }) => <strong style={{ color: T.iron900, fontWeight: 700 }} {...props} />,
    em: ({ node, ...props }) => <em style={{ color: T.iron500 }} {...props} />,
    hr: ({ node, ...props }) => <hr style={{ border: 'none', borderTop: `1px solid ${T.iron200}`, margin: '24px 0' }} {...props} />,
    code: ({ node, ...props }) => <code style={{ padding: '1px 6px', borderRadius: 4, background: T.iron100, color: T.orangeDeep, fontFamily: T.mono, fontSize: 12 }} {...props} />,
    blockquote: ({ node, ...props }) => <blockquote style={{ borderLeft: `2px solid ${T.iron200}`, paddingLeft: 12, fontStyle: 'italic', color: T.iron500, margin: '12px 0' }} {...props} />,
    table: ({ node, ...props }) => (
      <div style={{ overflowX: 'auto', margin: '12px 0' }}>
        <table style={{ minWidth: '100%', fontSize: 12, borderCollapse: 'collapse', border: `1px solid ${T.iron200}` }} {...props} />
      </div>
    ),
    thead: ({ node, ...props }) => <thead style={{ background: T.iron50 }} {...props} />,
    th: ({ node, ...props }) => <th style={{ textAlign: 'left', padding: '8px 12px', border: `1px solid ${T.iron200}`, fontFamily: T.headline, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', fontSize: 10, color: T.iron500 }} {...props} />,
    td: ({ node, ...props }) => <td style={{ padding: '8px 12px', border: `1px solid ${T.iron200}`, verticalAlign: 'top', color: T.iron700 }} {...props} />,
  };

  return (
    <IronShell
      title="Terms & Conditions"
      subtitle="DEALER AGREEMENT"
      onRefresh={fetchAll}
      headerRight={
        <button onClick={handleDownloadPdf} style={btnOutline} title="Download PDF">
          <Download size={14} /> PDF
        </button>
      }
    >
      <div style={{ maxWidth: 1024, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Header card — version + status */}
        <IronCard pad={20}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
              <div style={{ padding: 12, borderRadius: 12, background: '#FDEEE6', color: T.orange }}>
                <ScrollText className="w-6 h-6" />
              </div>
              <div>
                <Caps size={9} color={T.iron400}>Authorised Dealer Agreement</Caps>
                <h1 style={{ fontSize: 20, fontWeight: 700, color: T.iron900, fontFamily: T.headline, margin: '4px 0 0' }}>
                  MuscleGrid Energy Solutions Pvt. Ltd.
                </h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
                  <span style={{ ...badgeStyle('bad'), ...mono }}>Version {doc?.version}</span>
                  <span style={{ fontSize: 12, color: T.iron500 }}>Effective {doc?.effective_date}</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
              {needsAcceptance ? (
                <span style={{ ...badgeStyle('warn'), display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Acceptance Required
                </span>
              ) : (
                <span style={{ ...badgeStyle('ok'), display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Current Version Accepted
                </span>
              )}
              {accepted && (
                <div style={{ fontSize: 11, color: T.iron500, textAlign: 'right' }}>
                  Accepted v{status.accepted_version}<br />
                  <span style={mono}>{status.accepted_at?.slice(0, 19).replace('T', ' ')} UTC</span>
                </div>
              )}
            </div>
          </div>
        </IronCard>

        {/* What this means — quick callouts */}
        {needsAcceptance && (
          <IronCard pad={16} style={{ border: `1px solid ${T.voltageTint}`, background: '#FEFCEF' }}>
            <div style={{ display: 'flex', gap: 12 }}>
              <AlertTriangle className="w-5 h-5" color={T.voltageText} style={{ flexShrink: 0, marginTop: 2 }} />
              <div style={{ fontSize: 13, color: T.iron700 }}>
                <div style={{ fontWeight: 600, marginBottom: 4, color: T.iron900 }}>You need to accept the current version to continue using the dealer portal.</div>
                <p style={{ color: T.iron500, margin: 0 }}>
                  Please read the full agreement below. The <strong style={{ color: T.iron700 }}>Accept</strong> button unlocks once
                  you reach the bottom — we want every dealer to actually read what they sign.
                </p>
              </div>
            </div>
          </IronCard>
        )}

        {/* The agreement itself */}
        <IronCard pad={0}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${T.iron200}`, background: T.iron50, padding: '12px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: T.headline, fontWeight: 700, fontSize: 13, color: T.iron900 }}>
              <FileText className="w-4 h-4" color={T.orange} />
              Full Agreement Text
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {!scrolledToBottom && needsAcceptance && (
                <span style={{ ...mono, fontSize: 11, color: T.iron500, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <ChevronDown className="w-3.5 h-3.5 animate-bounce" />
                  Scroll to bottom to unlock Accept
                </span>
              )}
              <button onClick={handleDownloadPdf} style={btnOutline}>
                <Download size={14} /> PDF
              </button>
            </div>
          </div>

          <div
            ref={scrollRef}
            onScroll={handleScroll}
            style={{ height: 600, overflowY: 'auto', padding: '16px 24px', background: T.white }}
          >
            <div className="dealer-tnc">
              <ReactMarkdown components={mdComponents}>
                {doc?.markdown || ''}
              </ReactMarkdown>
            </div>
          </div>
        </IronCard>

        {/* Accept band — sits at the page bottom */}
        <IronCard
          pad={20}
          style={needsAcceptance
            ? { border: `1px solid ${T.orange}`, background: '#FEF6EF' }
            : { border: `1px solid ${T.green}`, background: T.greenTint }}
        >
          {needsAcceptance ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <ShieldCheck className="w-6 h-6" color={T.orange} style={{ flexShrink: 0, marginTop: 2 }} />
                <div style={{ fontSize: 13 }}>
                  <div style={{ fontWeight: 600, color: T.iron900, marginBottom: 4 }}>
                    By clicking <span style={{ color: T.orange }}>"I Accept"</span> below, you confirm:
                  </div>
                  <ul style={{ fontSize: 11, color: T.iron500, listStyle: 'disc', paddingLeft: 16, margin: 0, lineHeight: 1.6 }}>
                    <li>You have read and understood all sections of this Agreement</li>
                    <li>You are authorised to bind the dealer entity to these terms</li>
                    <li>This electronic acceptance has the same legal force as a physical signature (IT Act 2000)</li>
                    <li>Your IP address, browser and timestamp will be logged for audit purposes</li>
                  </ul>
                </div>
              </div>
              <button
                disabled={!scrolledToBottom || accepting}
                onClick={handleAccept}
                style={{ ...btnPrimary, opacity: (!scrolledToBottom || accepting) ? 0.5 : 1, cursor: (!scrolledToBottom || accepting) ? 'not-allowed' : 'pointer' }}
              >
                {accepting ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Recording acceptance…</>
                ) : (
                  <><FileCheck2 className="w-4 h-4" /> I Accept the Terms</>
                )}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <CheckCircle2 className="w-6 h-6" color={T.green} style={{ flexShrink: 0, marginTop: 2 }} />
                <div style={{ fontSize: 13 }}>
                  <div style={{ fontWeight: 600, color: T.iron900, marginBottom: 4 }}>
                    You have accepted version {status?.accepted_version} of this Agreement.
                  </div>
                  <div style={{ fontSize: 11, color: T.iron500, lineHeight: 1.6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Clock className="w-3 h-3" />
                      <span style={mono}>{status?.accepted_at?.slice(0, 19).replace('T', ' ')} UTC</span>
                    </div>
                    {status?.accepted_ip && (
                      <div>From IP <span style={mono}>{status.accepted_ip}</span></div>
                    )}
                  </div>
                </div>
              </div>
              <button onClick={handleDownloadPdf} style={btnPrimary}>
                <Download className="w-4 h-4" /> Download Signed PDF
              </button>
            </div>
          )}
        </IronCard>
      </div>
    </IronShell>
  );
}
