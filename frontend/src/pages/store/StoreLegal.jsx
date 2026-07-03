import React, { useEffect } from 'react';
import { ChevronLeft } from 'lucide-react';
import { LEGAL_DOCS, LEGAL_ORDER, COMPANY } from './legalContent';

/* Renders a single legal/policy document inside the storefront, and injects per-page SEO
   (title, meta description, canonical) + Organization JSON-LD. Self-contained palette so it
   does not depend on StoreFront's internal constants. */

const O = '#F58220', INK = '#1A1A1A', SUB = '#4B4B4B', MUT = '#9A9A9A', LINE = '#E6E6E6', PAPER = '#FAFAF8';
const F = "'Inter', system-ui, sans-serif", FH = "'Inter Tight', system-ui, sans-serif", FM = "'JetBrains Mono', ui-monospace, monospace";

function setMeta(name, content, attr = 'name') {
  if (typeof document === 'undefined') return;
  let el = document.head.querySelector(`meta[${attr}="${name}"]`);
  if (!el) { el = document.createElement('meta'); el.setAttribute(attr, name); document.head.appendChild(el); }
  el.setAttribute('content', content);
}
function setCanonical(href) {
  if (typeof document === 'undefined') return;
  let el = document.head.querySelector('link[rel="canonical"]');
  if (!el) { el = document.createElement('link'); el.setAttribute('rel', 'canonical'); document.head.appendChild(el); }
  el.setAttribute('href', href);
}

export default function StoreLegal({ slug = 'terms', onBack, onNav }) {
  const doc = LEGAL_DOCS[slug] || LEGAL_DOCS.terms;

  // SEO: title + meta + canonical + Organization structured data.
  useEffect(() => {
    const prevTitle = document.title;
    document.title = doc.seoTitle;
    setMeta('description', doc.seoDescription);
    setMeta('og:title', doc.seoTitle, 'property');
    setMeta('og:description', doc.seoDescription, 'property');
    setMeta('og:type', 'website', 'property');
    setCanonical(`${COMPANY.site}/policies/${doc.slug}`);

    const ld = document.createElement('script');
    ld.type = 'application/ld+json';
    ld.setAttribute('data-legal-ld', '1');
    ld.text = JSON.stringify({
      '@context': 'https://schema.org', '@type': 'Organization',
      name: COMPANY.legalName, alternateName: COMPANY.brand, url: COMPANY.site,
      email: COMPANY.email, telephone: COMPANY.phone,
      address: { '@type': 'PostalAddress', streetAddress: COMPANY.address, addressCountry: 'IN' },
    });
    document.head.appendChild(ld);
    return () => {
      document.title = prevTitle;
      document.head.querySelectorAll('script[data-legal-ld="1"]').forEach((n) => n.remove());
    };
  }, [doc]);

  const renderBody = (item, i) => {
    if (typeof item === 'string') return <p key={i} style={{ margin: '0 0 12px', color: SUB, fontSize: 14.5, lineHeight: 1.7 }}>{item}</p>;
    if (item.list) return (
      <ul key={i} style={{ margin: '0 0 12px', paddingLeft: 20, color: SUB, fontSize: 14.5, lineHeight: 1.7 }}>
        {item.list.map((li, j) => <li key={j} style={{ marginBottom: 6 }}>{li}</li>)}
      </ul>
    );
    return null;
  };

  return (
    <div className="mgs" style={{ fontFamily: F, color: INK, background: '#fff' }}>
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '28px 20px 56px' }}>
        <button className="mgs-btn" onClick={onBack}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: `1px solid ${LINE}`, background: '#fff', borderRadius: 8, padding: '7px 12px', cursor: 'pointer', fontFamily: FH, fontWeight: 600, fontSize: 12.5, color: SUB, marginBottom: 22 }}>
          <ChevronLeft size={15} /> Back to store
        </button>

        <h1 style={{ fontFamily: FH, fontWeight: 800, fontSize: 30, letterSpacing: '-0.02em', margin: '0 0 6px' }}>{doc.title}</h1>
        <div style={{ fontFamily: FM, fontSize: 11.5, color: MUT, marginBottom: 20 }}>
          {COMPANY.legalName} · Last updated {doc.updated}
        </div>

        {doc.intro && <p style={{ margin: '0 0 22px', color: SUB, fontSize: 15, lineHeight: 1.75 }}>{doc.intro}</p>}

        {doc.sections.map((s, i) => (
          <section key={i} style={{ marginBottom: 24 }}>
            <h2 style={{ fontFamily: FH, fontWeight: 700, fontSize: 17, margin: '0 0 10px', color: INK }}>{s.h}</h2>
            {s.body.map(renderBody)}
          </section>
        ))}

        {/* Cross-links to the other policies (internal linking helps SEO + navigation) */}
        <div style={{ borderTop: `1px solid ${LINE}`, marginTop: 28, paddingTop: 18 }}>
          <div style={{ fontFamily: FH, fontWeight: 700, fontSize: 13, color: INK, marginBottom: 10 }}>More policies</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {LEGAL_ORDER.filter((s) => s !== slug).map((s) => (
              <button key={s} className="mgs-btn" onClick={() => onNav && onNav(s)}
                style={{ border: `1px solid ${LINE}`, background: PAPER, borderRadius: 8, padding: '7px 12px', cursor: 'pointer', fontFamily: FH, fontWeight: 600, fontSize: 12.5, color: O }}>
                {LEGAL_DOCS[s].nav}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
