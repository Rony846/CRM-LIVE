import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { API, useAuth } from '@/App';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

/**
 * Reusable ticket search — find ANY ticket by number (MG-R-…), customer name,
 * phone, serial, invoice or order id. On a hit it navigates to the main
 * dashboard (default /supervisor) with ?ticket=<id>, which opens the ticket there.
 */
export default function TicketSearchBar({ basePath = '/supervisor' }) {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e?.preventDefault();
    const term = q.trim();
    if (!term) return;
    setLoading(true);
    try {
      const res = await axios.get(`${API}/tickets`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { search: term, limit: 10 },
      });
      const list = res.data?.tickets || res.data || [];
      if (list.length) {
        navigate(`${basePath}?ticket=${encodeURIComponent(list[0].id)}`);
        if (list.length > 1) toast.message(`${list.length} matches — opened ${list[0].ticket_number}`);
      } else {
        toast.error(`No ticket found for "${term}"`);
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="mb-4 flex gap-2" data-testid="ticket-search-bar">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search any ticket — number (MG-R-…), customer, phone, serial, order id…"
        className="flex-1 rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/40"
      />
      <Button type="submit" disabled={loading}>{loading ? 'Searching…' : 'Search'}</Button>
    </form>
  );
}
