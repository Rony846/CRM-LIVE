import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShieldAlert, FileCheck2, ScrollText, ArrowRight } from 'lucide-react';

/**
 * Renders a non-dismissible modal for any signed-in dealer who has not yet accepted
 * the current Dealer Agreement version.
 *
 * - Pings /api/dealer/terms/status on mount and on every route change.
 * - If the dealer is already on /dealer/terms, the modal stays hidden (so they
 *   can actually read and accept without our own modal getting in their way).
 * - The single primary action sends them to /dealer/terms.
 *
 * Mount this once near the top of dealer-area routing (DashboardLayout works).
 */
export default function TermsAcceptanceGuard() {
  const { user, token } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [needsAcceptance, setNeedsAcceptance] = useState(false);
  const [version, setVersion] = useState(null);
  const [effectiveDate, setEffectiveDate] = useState(null);
  const [acceptedVersion, setAcceptedVersion] = useState(null);

  const shouldCheck = user?.role === 'dealer' && !!token;

  useEffect(() => {
    if (!shouldCheck) {
      setNeedsAcceptance(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const resp = await axios.get(`${API}/dealer/terms/status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (cancelled) return;
        setNeedsAcceptance(!!resp.data.needs_acceptance);
        setVersion(resp.data.current_version);
        setEffectiveDate(resp.data.effective_date);
        setAcceptedVersion(resp.data.accepted_version);
      } catch (err) {
        // Don't block the UI if the status check fails — log and move on.
        console.warn('Dealer T&C status check failed:', err?.response?.status || err);
      }
    })();
    return () => { cancelled = true; };
  }, [shouldCheck, token, location.pathname]);

  // Hide the modal if the user is already on the agreement page — they're acting on the prompt.
  const onTermsPage = location.pathname.startsWith('/dealer/terms');
  const open = needsAcceptance && shouldCheck && !onTermsPage;

  return (
    <Dialog open={open} onOpenChange={() => { /* intentionally non-dismissible */ }}>
      <DialogContent
        className="bg-popover border border-primary/40 max-w-lg"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        hideCloseButton
      >
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-xl bg-amber-400/15 text-amber-400">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <DialogTitle className="text-foreground text-lg">
                Dealer Agreement — Acceptance Required
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                You must accept the current agreement to continue using the dealer portal.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="flex items-center justify-between bg-muted/40 border border-border rounded-lg p-3 text-sm">
            <div className="flex items-center gap-2 text-foreground">
              <ScrollText className="w-4 h-4 text-primary" />
              <span className="font-medium">MuscleGrid Dealer Agreement</span>
            </div>
            <Badge className="bg-primary/15 text-primary ring-1 ring-primary/30 font-mono text-[10px]">
              v{version} · {effectiveDate}
            </Badge>
          </div>

          {acceptedVersion ? (
            <p className="text-sm text-foreground/85 leading-relaxed">
              We've updated our Dealer Agreement. You previously accepted{' '}
              <span className="font-mono text-foreground">v{acceptedVersion}</span>; the current
              version is{' '}
              <span className="font-mono text-primary">v{version}</span>. Please review the changes
              and re-accept to continue.
            </p>
          ) : (
            <p className="text-sm text-foreground/85 leading-relaxed">
              This is the standard agreement governing your relationship with MuscleGrid as an
              authorised dealer — covering spare-parts support, warranty pass-through, brand
              standards, sales targets and the commercial terms of our partnership.
            </p>
          )}

          <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-5">
            <li>Reviewing the full agreement is required before acceptance.</li>
            <li>Your acceptance is recorded with timestamp and IP for audit.</li>
            <li>A signed PDF copy will be emailed to you immediately on acceptance.</li>
          </ul>
        </div>

        <div className="flex justify-end pt-2">
          <Button
            size="lg"
            onClick={() => navigate('/dealer/terms')}
            className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
          >
            <FileCheck2 className="w-4 h-4 mr-2" />
            Review &amp; Accept
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
