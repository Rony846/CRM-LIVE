import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { PhoneCall, Search, Loader2, ShieldCheck, Package, ChevronRight, MapPin, UserPlus } from 'lucide-react';

/**
 * "Who's calling me?" widget — paste/type a phone number and instantly see
 * matching customer + their products and warranty status. Drop it on the
 * dealer dashboard top row. Compact when idle; expands when a search begins.
 */
export default function CustomerQuickLookup() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [matches, setMatches] = useState(null);   // null = idle, [] = no results, [...] = results
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 4) {
      setMatches(null);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        setLoading(true);
        const resp = await axios.get(`${API}/dealer/customers/lookup`, {
          headers: { Authorization: `Bearer ${token}` },
          params: { phone },
        });
        setMatches(resp.data.matches || []);
      } catch (err) {
        console.warn('lookup failed', err);
        setMatches([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => debounceRef.current && clearTimeout(debounceRef.current);
  }, [phone, token]);

  const open = matches !== null;

  return (
    <Card className="mg-card border-border">
      <CardContent className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 rounded-lg bg-primary/15 text-primary">
            <PhoneCall className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Customer Quick Lookup</div>
            <div className="text-sm text-foreground">Who's calling you?</div>
          </div>
        </div>

        <div className="relative">
          {loading ? (
            <Loader2 className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-primary animate-spin" />
          ) : (
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          )}
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Paste or type phone number…"
            className="pl-9 bg-background border-border text-foreground font-mono"
          />
        </div>

        {open && (
          <div className="mt-3 space-y-2">
            {matches.length === 0 && !loading && (
              <div className="text-xs text-muted-foreground py-3 px-2 flex items-center justify-between">
                <span>No customer with that number in your book.</span>
                <button
                  onClick={() => navigate('/dealer/customers')}
                  className="text-primary hover:underline flex items-center gap-1"
                >
                  <UserPlus className="w-3 h-3" /> Add as new
                </button>
              </div>
            )}
            {matches.map(c => (
              <button
                key={c.id}
                onClick={() => navigate('/dealer/customers')}
                className="w-full text-left p-3 rounded-md border border-border bg-muted/20 hover:bg-accent/40 transition-colors flex items-center gap-3 group"
              >
                <div className="w-8 h-8 rounded-full bg-primary/15 text-primary flex items-center justify-center font-semibold text-sm flex-shrink-0">
                  {(c.name || '?').charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground text-sm truncate">{c.name || 'Unnamed'}</span>
                    {c.in_warranty_count > 0 && (
                      <Badge className="bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/25 font-mono text-[9px] uppercase">
                        <ShieldCheck className="w-2.5 h-2.5 mr-0.5" />{c.in_warranty_count} in warranty
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    <span className="font-mono">{c.phone}</span>
                    {c.city && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{c.city}</span>}
                    <span className="font-mono"><Package className="w-3 h-3 inline mr-0.5" />{c.total_products || 0}</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
