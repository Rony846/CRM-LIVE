import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import {
  FileText, Loader2, CheckCircle2, ShieldCheck, Download,
  AlertTriangle, Clock, FileCheck2, ScrollText, ChevronDown,
} from 'lucide-react';

/**
 * Dealer Terms & Conditions page.
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

  if (loading) {
    return (
      <DashboardLayout title="Dealer Agreement">
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  const needsAcceptance = status?.needs_acceptance;
  const accepted = !!status?.accepted_version;

  return (
    <DashboardLayout title="Dealer Agreement">
      <div className="space-y-4 max-w-5xl mx-auto">
        {/* Header card — version + status */}
        <Card className="mg-card border-border">
          <CardContent className="p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-primary/15 text-primary">
                <ScrollText className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1">
                  Authorised Dealer Agreement
                </div>
                <h1 className="text-xl font-semibold text-foreground">
                  MuscleGrid Energy Solutions Pvt. Ltd.
                </h1>
                <div className="flex items-center gap-3 mt-2 text-xs">
                  <Badge className="bg-primary/15 text-primary ring-1 ring-primary/30 font-mono">
                    Version {doc?.version}
                  </Badge>
                  <span className="text-muted-foreground">
                    Effective {doc?.effective_date}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2">
              {needsAcceptance ? (
                <Badge className="bg-amber-400/15 text-amber-400 ring-1 ring-amber-400/30 font-mono uppercase tracking-wide">
                  <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
                  Acceptance Required
                </Badge>
              ) : (
                <Badge className="bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30 font-mono uppercase tracking-wide">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                  Current Version Accepted
                </Badge>
              )}
              {accepted && (
                <div className="text-xs text-muted-foreground text-right">
                  Accepted v{status.accepted_version}<br/>
                  <span className="font-mono">{status.accepted_at?.slice(0, 19).replace('T', ' ')} UTC</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* What this means — quick callouts */}
        {needsAcceptance && (
          <Card className="mg-card border-amber-400/30 bg-amber-400/[0.04]">
            <CardContent className="p-4 flex gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-foreground">
                <div className="font-medium mb-1">You need to accept the current version to continue using the dealer portal.</div>
                <p className="text-muted-foreground">
                  Please read the full agreement below. The <strong>Accept</strong> button unlocks once
                  you reach the bottom — we want every dealer to actually read what they sign.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* The agreement itself */}
        <Card className="mg-card border-border">
          <CardHeader className="border-b border-border bg-muted/30 py-3 px-5 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              Full Agreement Text
            </CardTitle>
            <div className="flex items-center gap-2">
              {!scrolledToBottom && needsAcceptance && (
                <span className="text-xs text-muted-foreground flex items-center gap-1.5 font-mono">
                  <ChevronDown className="w-3.5 h-3.5 animate-bounce" />
                  Scroll to bottom to unlock Accept
                </span>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={handleDownloadPdf}
                className="text-xs border-border hover:bg-accent"
              >
                <Download className="w-3.5 h-3.5 mr-1.5" />
                PDF
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <ScrollArea
              className="h-[600px] px-6 py-4"
              ref={scrollRef}
              onScrollCapture={handleScroll}
            >
              <div className="dealer-tnc prose prose-sm max-w-none">
                <ReactMarkdown
                  components={{
                    h1: ({ node, ...props }) => <h1 className="text-2xl font-bold text-foreground mt-6 mb-4 pb-2 border-b border-border" {...props} />,
                    h2: ({ node, ...props }) => <h2 className="text-lg font-semibold text-foreground mt-6 mb-3 border-l-4 border-primary pl-3" {...props} />,
                    h3: ({ node, ...props }) => <h3 className="text-base font-semibold text-foreground mt-4 mb-2" {...props} />,
                    p:  ({ node, ...props }) => <p className="text-sm text-foreground/85 leading-relaxed my-2" {...props} />,
                    ul: ({ node, ...props }) => <ul className="text-sm text-foreground/85 list-disc pl-6 my-2 space-y-1" {...props} />,
                    ol: ({ node, ...props }) => <ol className="text-sm text-foreground/85 list-decimal pl-6 my-2 space-y-1" {...props} />,
                    li: ({ node, ...props }) => <li className="leading-relaxed" {...props} />,
                    strong: ({ node, ...props }) => <strong className="text-foreground font-semibold" {...props} />,
                    em: ({ node, ...props }) => <em className="text-muted-foreground" {...props} />,
                    hr: ({ node, ...props }) => <hr className="border-border my-6" {...props} />,
                    code: ({ node, ...props }) => <code className="px-1.5 py-0.5 rounded bg-muted text-primary font-mono text-xs" {...props} />,
                    blockquote: ({ node, ...props }) => <blockquote className="border-l-2 border-border pl-3 italic text-muted-foreground my-3" {...props} />,
                    table: ({ node, ...props }) => (
                      <div className="overflow-x-auto my-3">
                        <table className="min-w-full text-xs border border-border" {...props} />
                      </div>
                    ),
                    thead: ({ node, ...props }) => <thead className="bg-muted/50" {...props} />,
                    th: ({ node, ...props }) => <th className="text-left px-3 py-2 border border-border font-mono uppercase tracking-wide text-[10px] text-muted-foreground" {...props} />,
                    td: ({ node, ...props }) => <td className="px-3 py-2 border border-border align-top text-foreground/85" {...props} />,
                  }}
                >
                  {doc?.markdown || ''}
                </ReactMarkdown>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Accept band — sticky in spirit, sits at the page bottom */}
        <Card className={`mg-card ${needsAcceptance ? 'border-primary/40 bg-primary/[0.04]' : 'border-emerald-500/30 bg-emerald-500/[0.04]'}`}>
          <CardContent className="p-5">
            {needsAcceptance ? (
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="w-6 h-6 text-primary flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <div className="font-medium text-foreground mb-1">
                      By clicking <span className="text-primary">"I Accept"</span> below, you confirm:
                    </div>
                    <ul className="text-xs text-muted-foreground space-y-0.5 list-disc pl-4">
                      <li>You have read and understood all sections of this Agreement</li>
                      <li>You are authorised to bind the dealer entity to these terms</li>
                      <li>This electronic acceptance has the same legal force as a physical signature (IT Act 2000)</li>
                      <li>Your IP address, browser and timestamp will be logged for audit purposes</li>
                    </ul>
                  </div>
                </div>
                <Button
                  size="lg"
                  disabled={!scrolledToBottom || accepting}
                  onClick={handleAccept}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold disabled:opacity-50"
                >
                  {accepting ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Recording acceptance…</>
                  ) : (
                    <><FileCheck2 className="w-4 h-4 mr-2" /> I Accept the Terms</>
                  )}
                </Button>
              </div>
            ) : (
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <div className="font-medium text-foreground mb-1">
                      You have accepted version {status?.accepted_version} of this Agreement.
                    </div>
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3 h-3" />
                        <span className="font-mono">{status?.accepted_at?.slice(0, 19).replace('T', ' ')} UTC</span>
                      </div>
                      {status?.accepted_ip && (
                        <div>From IP <span className="font-mono">{status.accepted_ip}</span></div>
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  size="lg"
                  onClick={handleDownloadPdf}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download Signed PDF
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
