import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Star, Search, Phone, Mail, ShieldAlert, PackageSearch, Info } from 'lucide-react';

const CONF_TONE = {
  HIGH: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  MEDIUM: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  LOW: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
};

const Stars = ({ n }) => (
  <span className="inline-flex items-center gap-0.5 text-red-400">
    {Array.from({ length: n || 1 }).map((_, i) => <Star key={i} size={13} fill="currentColor" />)}
  </span>
);

const Tel = ({ phone }) => {
  const bad = !phone || /^0+$/.test(String(phone).replace(/\D/g, ''));
  if (bad) return <span className="text-zinc-600 italic">scrape PII</span>;
  return (
    <a href={`tel:${phone}`} className="inline-flex items-center gap-1 text-sky-400 hover:underline">
      <Phone size={12} /> {phone}
    </a>
  );
};

export default function ReviewMatcher() {
  const { token } = useAuth();
  const auth = { headers: { Authorization: `Bearer ${token}` } };
  const [asin, setAsin] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    const a = asin.trim().toUpperCase();
    if (!a) { toast.error('Enter an ASIN'); return; }
    setLoading(true); setData(null);
    try {
      const r = await axios.get(`${API}/admin/review-matcher`, { ...auth, params: { asin: a } });
      setData(r.data);
      if (!r.data?.matches?.length && !r.data?.complaint_first?.length)
        toast.info('No reviews or complaint matches found for this ASIN');
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Lookup failed');
    } finally { setLoading(false); }
  };

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto p-4 space-y-5">
        {/* Header */}
        <div>
          <h1 className="text-xl font-semibold text-zinc-100 flex items-center gap-2">
            <PackageSearch size={20} className="text-sky-400" /> Review → Customer Matcher
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Paste an Amazon ASIN → pull its 1–2★ reviews and match each reviewer to the likely CRM customer
            (buyer or complainant) with phone, so you can call to <b>resolve their issue</b>.
          </p>
        </div>

        {/* Compliance note */}
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          <ShieldAlert size={15} className="mt-0.5 shrink-0" />
          <span>Contact customers to <b>fix their problem</b> — never to ask them to remove or change a review.
            Soliciting review removal violates Amazon policy and risks account suspension. A fixed customer usually revises the review themselves.</span>
        </div>

        {/* Search */}
        <div className="flex gap-2">
          <Input value={asin} onChange={(e) => setAsin(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && run()}
            placeholder="Enter ASIN (e.g. B0BMT79BTX)" className="max-w-xs font-mono" />
          <Button onClick={run} disabled={loading}>
            <Search size={15} className="mr-1" /> {loading ? 'Matching…' : 'Find matches'}
          </Button>
        </div>

        {loading && <div className="text-sm text-zinc-500">Scraping reviews via the browser agent and matching against the CRM…</div>}

        {data && (
          <div className="space-y-4">
            {/* Summary */}
            <Card>
              <CardContent className="p-4">
                <div className="text-sm text-zinc-300 font-medium">{data.product || '(product unknown)'}</div>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400">
                  <span>ASIN <span className="font-mono text-zinc-300">{data.asin}</span></span>
                  <span>{data.orders_in_crm} orders in CRM</span>
                  <span>{data.complaints_found} complaints on file</span>
                  <span>{data.reviews_scraped} negative reviews scraped</span>
                  {data.scrape_blocked &&
                    <span className="text-amber-400">⚠ review scrape blocked — showing complaint list</span>}
                </div>
              </CardContent>
            </Card>

            {/* Matches */}
            {(data.matches || []).map((m, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Stars n={m.review?.stars} />
                    <span className="font-medium text-zinc-200">{m.review?.reviewer || 'Anonymous'}</span>
                    <span className="text-zinc-500 text-xs">· {m.review?.review_date}</span>
                  </div>
                  {m.review?.title && <div className="text-sm text-zinc-300 mt-1">{m.review.title}</div>}
                  {m.review?.body && <div className="text-xs text-zinc-500 mt-0.5 line-clamp-2">{m.review.body}</div>}

                  <div className="mt-3">
                    {(m.candidates || []).length === 0 ? (
                      <div className="text-xs text-zinc-600 italic">No confident CRM match.</div>
                    ) : (
                      <div className="space-y-2">
                        {m.candidates.map((c, j) => (
                          <div key={j} className="rounded-md border border-zinc-800 bg-zinc-900/40 px-3 py-2">
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                              <Badge variant="outline" className={CONF_TONE[c.confidence] || CONF_TONE.LOW}>{c.confidence}</Badge>
                              <span className="text-zinc-200 font-medium">{c.name || '(name via PII scrape)'}</span>
                              <Tel phone={c.phone} />
                              {c.email && <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1 text-sky-400 hover:underline text-xs"><Mail size={12} />{c.email}</a>}
                              {c.account && c.account !== '-' && <span className="text-xs text-zinc-500">{c.account}</span>}
                              {c.order_id && c.order_id !== '-' && <span className="text-xs font-mono text-zinc-600">{c.order_id}</span>}
                            </div>
                            <div className="text-xs text-zinc-500 mt-1 flex items-start gap-1">
                              <Info size={12} className="mt-0.5 shrink-0" /> {(c.why || []).join('; ')}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* Complaint-first fallback */}
            {data.complaint_first?.length > 0 && (
              <Card>
                <CardContent className="p-4">
                  <div className="text-sm font-medium text-zinc-200 mb-1">Likely unhappy customers for this product</div>
                  <div className="text-xs text-zinc-500 mb-3">{data.note}</div>
                  <div className="space-y-1.5">
                    {data.complaint_first.map((cp, i) => (
                      <div key={i} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm border-b border-zinc-800/60 pb-1.5">
                        <span className="text-zinc-200">{cp.name || '(no name)'}</span>
                        <Tel phone={cp.phone} />
                        {cp.email && <a href={`mailto:${cp.email}`} className="text-sky-400 hover:underline text-xs">{cp.email}</a>}
                        <Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-400">{cp.channel}</Badge>
                        <span className="text-xs text-zinc-500 truncate max-w-md">{cp.subject}</span>
                        <span className="text-xs text-zinc-600 ml-auto">{cp.date}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
