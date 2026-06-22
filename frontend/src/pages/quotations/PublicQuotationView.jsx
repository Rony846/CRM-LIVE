import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  FileText, Building2, User, CheckCircle, XCircle, Loader2,
  Phone, Mail, Calendar, Clock, AlertTriangle,
  Package, Download, Printer,
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL || '';

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
    .format(amount || 0);

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
};

// Normalise a terms-and-conditions string into a clean ordered list.
const parseTerms = (text) => {
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(\d+[.)]|\-|\*)\s*/, '').trim())
    .filter(Boolean);
};

// Compact concatenated address from the five customer-address fields.
const composeAddress = (q) =>
  [q.customer_address, q.customer_city, q.customer_state, q.customer_pincode]
    .filter(Boolean).join(', ');

export default function PublicQuotationView() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [quotation, setQuotation] = useState(null);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    if (token) fetchQuotation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const fetchQuotation = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/api/pi/view/${token}`);
      setQuotation(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load quotation');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    setActionLoading(true);
    try {
      await axios.post(`${API}/api/pi/approve/${token}`);
      toast.success('Quotation approved');
      fetchQuotation();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to approve');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    setActionLoading(true);
    try {
      await axios.post(`${API}/api/pi/reject/${token}`, null, { params: { reason: rejectReason } });
      toast.success('Quotation rejected');
      setRejectDialogOpen(false);
      fetchQuotation();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to reject');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDownloadPDF = () => {
    window.open(`${API}/api/pi/pdf/${token}`, '_blank');
  };

  const handlePrint = () => window.print();

  // The full page is force-themed to Lumina so customers always see the
  // executive light document — independent of any internal user's theme.
  const shell = (children) => (
    <div data-theme="lumina" className="min-h-screen bg-background text-foreground">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body, html, [data-theme="lumina"] { background: #fff !important; }
          .mg-card { box-shadow: none !important; }
        }
      `}</style>
      {children}
    </div>
  );

  if (loading) {
    return shell(
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return shell(
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="mg-card w-full max-w-md rounded-lg border border-border bg-card p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-rose-500/10">
            <AlertTriangle className="h-7 w-7 text-rose-700" />
          </div>
          <h2 className="text-lg font-bold text-foreground">Quotation Not Found</h2>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  const isExpired =
    quotation.status === 'expired' ||
    (quotation.validity_date && new Date(quotation.validity_date) < new Date());
  const canAct = ['sent', 'viewed'].includes(quotation.status) && !isExpired;
  const terms = parseTerms(quotation.terms_and_conditions);
  const customerAddress = composeAddress(quotation);

  return shell(
    <>
      {/* Top branding bar */}
      <header className="no-print border-b border-border bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded bg-primary text-primary-foreground">
              <FileText className="h-3.5 w-3.5" />
            </div>
            <span className="text-sm font-semibold text-foreground">MuscleGrid CRM</span>
          </div>
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Proforma Invoice
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10 space-y-8">
        {/* Title row + action buttons */}
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0">
            <div className="mb-3 h-1.5 w-12 rounded bg-foreground" />
            <h1 className="font-mono text-[28px] sm:text-[36px] font-bold leading-tight tracking-tight text-foreground break-all">
              {quotation.quotation_number}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">MuscleGrid Quotation Ecosystem</p>
          </div>
          <div className="no-print flex flex-wrap gap-2">
            <button
              onClick={handleDownloadPDF}
              className="inline-flex items-center gap-2 rounded border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              <Download className="h-4 w-4" /> Download PDF
            </button>
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 rounded bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              <Printer className="h-4 w-4" /> Print
            </button>
          </div>
        </div>

        {/* Final-state status banners */}
        {quotation.status === 'approved' && (
          <StatusBanner tone="emerald" icon={CheckCircle}
            title="Quotation Approved"
            body={quotation.approved_at ? `Approved on ${formatDate(quotation.approved_at)}` : 'Approved'} />
        )}
        {quotation.status === 'rejected' && (
          <StatusBanner tone="rose" icon={XCircle}
            title="Quotation Rejected"
            body={quotation.rejection_reason ? `Reason: ${quotation.rejection_reason}` : 'This quotation was rejected.'} />
        )}
        {quotation.status === 'converted' && (
          <StatusBanner tone="emerald" icon={CheckCircle}
            title="Order Confirmed"
            body="This quotation has been converted to an order." />
        )}
        {(quotation.status === 'expired' || (isExpired && quotation.status !== 'rejected' && quotation.status !== 'approved')) && (
          <StatusBanner tone="amber" icon={Clock}
            title="Validity Expired"
            body="Please contact us to request a fresh quotation." />
        )}

        {/* FROM / TO cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <PartyCard
            label="From"
            icon={Building2}
            name={quotation.firm_name}
            gstin={quotation.firm_gstin}
            address={quotation.firm_address}
            email={quotation.firm_email}
            phone={quotation.firm_phone}
          />
          <PartyCard
            label="To"
            icon={User}
            name={quotation.customer_name}
            gstin={quotation.customer_gstin}
            address={customerAddress}
            email={quotation.customer_email}
            phone={quotation.customer_phone}
          />
        </div>

        {/* Issue date + Valid till */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <DateChip label="Issue Date" value={formatDate(quotation.created_at)} />
          <DateChip
            label="Valid Till"
            value={formatDate(quotation.validity_date)}
            danger={isExpired}
          />
        </div>

        {/* Quoted items table */}
        <div className="mg-card overflow-hidden rounded-lg border border-border bg-card">
          <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-5 py-3 font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Package className="h-3.5 w-3.5" />
            Quoted Items
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="px-5 py-3 text-left font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">#</th>
                  <th className="px-5 py-3 text-left font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Item Description</th>
                  <th className="px-5 py-3 text-right font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Qty</th>
                  <th className="px-5 py-3 text-right font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Rate</th>
                  <th className="px-5 py-3 text-right font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Discount</th>
                  <th className="px-5 py-3 text-right font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">GST</th>
                  <th className="px-5 py-3 text-right font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Amount</th>
                </tr>
              </thead>
              <tbody>
                {(quotation.items || []).map((item, idx) => (
                  <tr key={idx} className="border-t border-border">
                    <td className="px-5 py-4 align-top font-mono text-sm text-muted-foreground tabular-nums">
                      {String(idx + 1).padStart(2, '0')}
                    </td>
                    <td className="px-5 py-4 align-top">
                      <p className="font-semibold text-foreground">{item.name}</p>
                      {item.description && (
                        <p className="mt-0.5 text-[12px] text-muted-foreground">{item.description}</p>
                      )}
                      {item.hsn_code && (
                        <span className="mt-1.5 inline-block rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground ring-1 ring-border">
                          HSN: {item.hsn_code}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right align-top font-mono text-sm tabular-nums text-foreground">
                      {item.quantity}
                    </td>
                    <td className="px-5 py-4 text-right align-top font-mono text-sm tabular-nums text-foreground">
                      {formatCurrency(item.rate)}
                    </td>
                    <td className="px-5 py-4 text-right align-top font-mono text-sm tabular-nums text-rose-700">
                      {item.discount > 0 ? `-${formatCurrency(item.discount)}` : '—'}
                    </td>
                    <td className="px-5 py-4 text-right align-top font-mono text-sm tabular-nums text-muted-foreground">
                      {item.gst_rate}%
                    </td>
                    <td className="px-5 py-4 text-right align-top font-mono text-sm font-bold tabular-nums text-foreground">
                      {formatCurrency(item.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Terms (left) + Totals (right) */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
          <div className="md:col-span-7">
            {terms.length > 0 ? (
              <div className="mg-card h-full rounded-lg border border-border bg-card p-5">
                <h3 className="border-b border-border pb-2 mb-3 font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Terms &amp; Conditions
                </h3>
                <ol className="space-y-1.5 pl-4 text-sm text-foreground list-decimal">
                  {terms.map((line, i) => (<li key={i}>{line}</li>))}
                </ol>
              </div>
            ) : (
              <div className="hidden md:block" />
            )}
          </div>

          <div className="md:col-span-5">
            <div className="mg-card rounded-lg border border-border bg-card p-5 space-y-2.5">
              <TotalsRow label="Subtotal" value={formatCurrency(quotation.subtotal)} />
              {quotation.total_discount > 0 && (
                <TotalsRow label="Discount" value={`-${formatCurrency(quotation.total_discount)}`} valueClass="text-rose-700" />
              )}
              <TotalsRow label="Taxable Value" value={formatCurrency(quotation.taxable_value)} />
              {quotation.is_inter_state ? (
                <TotalsRow label="IGST" value={formatCurrency(quotation.igst)} />
              ) : (
                <>
                  <TotalsRow label="CGST" value={formatCurrency(quotation.cgst)} />
                  <TotalsRow label="SGST" value={formatCurrency(quotation.sgst)} />
                </>
              )}
              <div className="mt-2 flex items-baseline justify-between border-t border-border pt-3">
                <span className="text-sm font-bold uppercase tracking-wider text-foreground">Grand Total</span>
                <span className="font-mono text-2xl font-bold tabular-nums text-foreground">
                  {formatCurrency(quotation.grand_total)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Remarks (optional) */}
        {quotation.remarks && (
          <div className="mg-card rounded-lg border border-border bg-card p-5">
            <h3 className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Remarks
            </h3>
            <p className="whitespace-pre-wrap text-sm text-foreground">{quotation.remarks}</p>
          </div>
        )}

        {/* Approve / Reject action box */}
        {canAct && (
          <div className="no-print mg-card rounded-lg border border-border bg-muted/40 p-6">
            <p className="mb-4 text-center text-sm text-muted-foreground">
              Please review the quotation details carefully. Once approved, our logistics team will initiate the dispatch process.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-3">
              <button
                onClick={handleApprove}
                disabled={actionLoading}
                data-testid="approve-btn"
                className="inline-flex items-center justify-center gap-2 rounded bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                Approve Quotation
              </button>
              <button
                onClick={() => setRejectDialogOpen(true)}
                disabled={actionLoading}
                data-testid="reject-btn"
                className="inline-flex items-center justify-center gap-2 rounded border border-rose-700 px-6 py-3 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-700/10 disabled:opacity-50"
              >
                <XCircle className="h-4 w-4" />
                Reject
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-border pt-6 text-center font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          <p>System Generated Document · MuscleGrid CRM</p>
          <p className="mt-1 normal-case tracking-normal text-xs">
            For queries, please contact{' '}
            <a href="mailto:service@musclegrid.in" className="font-semibold text-primary hover:underline">
              service@musclegrid.in
            </a>
          </p>
        </div>
      </main>

      {/* Reject dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="bg-popover border border-border rounded-lg">
          <DialogHeader>
            <DialogTitle className="text-foreground">Reject Quotation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Are you sure you want to reject this quotation?</p>
            <div>
              <label className="mb-1.5 block font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Reason (optional)
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Why are you rejecting this quotation?"
                rows={3}
                className="w-full"
              />
            </div>
          </div>
          <DialogFooter>
            <button
              onClick={() => setRejectDialogOpen(false)}
              className="rounded bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-accent"
            >
              Cancel
            </button>
            <button
              onClick={handleReject}
              disabled={actionLoading}
              className="inline-flex items-center gap-2 rounded bg-rose-700 px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
              Confirm Reject
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---------- small presentational helpers ----------

function PartyCard({ label, icon: Icon, name, gstin, address, email, phone }) {
  return (
    <div className="mg-card rounded-lg border border-border bg-card p-5">
      <div className="mb-3 flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="text-base font-bold text-foreground">{name || '—'}</p>
      {gstin && (
        <p className="mt-1.5 inline-block rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground ring-1 ring-border">
          GSTIN: {gstin}
        </p>
      )}
      {address && <p className="mt-3 text-sm leading-relaxed text-foreground">{address}</p>}
      {(email || phone) && (
        <div className="mt-3 space-y-1 text-sm text-muted-foreground">
          {phone && (
            <p className="flex items-center gap-2">
              <Phone className="h-3.5 w-3.5" />
              <span className="font-mono tabular-nums">{phone.startsWith('+') ? phone : `+91 ${phone}`}</span>
            </p>
          )}
          {email && (
            <p className="flex items-center gap-2">
              <Mail className="h-3.5 w-3.5" />
              <a href={`mailto:${email}`} className="text-foreground hover:underline">{email}</a>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function DateChip({ label, value, danger = false }) {
  return (
    <div className="mg-card flex items-center gap-3 rounded-lg border border-border bg-card px-5 py-3">
      <Calendar className={danger ? 'h-4 w-4 text-rose-700' : 'h-4 w-4 text-muted-foreground'} />
      <span className="text-sm text-muted-foreground">{label}:</span>
      <span className={`ml-auto font-mono text-sm font-semibold tabular-nums ${danger ? 'text-rose-700' : 'text-foreground'}`}>
        {value}
      </span>
    </div>
  );
}

function TotalsRow({ label, value, valueClass = 'text-foreground' }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`font-mono text-sm font-semibold tabular-nums ${valueClass}`}>{value}</span>
    </div>
  );
}

function StatusBanner({ tone, icon: Icon, title, body }) {
  const toneMap = {
    emerald: 'border-emerald-700/30 bg-emerald-500/[0.08] text-emerald-700',
    rose:    'border-rose-700/30 bg-rose-500/[0.08] text-rose-700',
    amber:   'border-amber-700/30 bg-amber-500/[0.08] text-amber-700',
  };
  return (
    <div className={`mg-card flex items-start gap-3 rounded-lg border bg-card p-4 ${toneMap[tone] || ''}`}>
      <Icon className="mt-0.5 h-5 w-5 flex-shrink-0" />
      <div>
        <p className="text-sm font-bold">{title}</p>
        {body && <p className="mt-0.5 text-xs opacity-80">{body}</p>}
      </div>
    </div>
  );
}
