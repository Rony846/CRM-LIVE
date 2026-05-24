import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Megaphone, Loader2, Calendar, AlertTriangle, Info, Gift,
  Truck, TrendingUp, Clock, ChevronRight, Bell, CheckCircle
} from 'lucide-react';

const ANNOUNCEMENT_TYPES = {
  general:   { label: 'General',        icon: Megaphone,     tone: 'bg-primary/15 text-primary ring-primary/25' },
  promotion: { label: 'Promotion',      icon: Gift,          tone: 'bg-violet-400/15 text-violet-400 ring-violet-400/25' },
  urgent:    { label: 'Urgent',         icon: AlertTriangle, tone: 'bg-rose-500/15 text-rose-400 ring-rose-500/25' },
  policy:    { label: 'Policy Update',  icon: Info,          tone: 'bg-amber-400/15 text-amber-400 ring-amber-400/25' },
  product:   { label: 'New Product',    icon: TrendingUp,    tone: 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/25' },
  logistics: { label: 'Logistics',      icon: Truck,         tone: 'bg-sky-400/15 text-sky-400 ring-sky-400/25' }
};

// Icon tile bg/text without ring (for the card icon square)
const TYPE_TILE = {
  general:   'bg-primary/15 text-primary',
  promotion: 'bg-violet-400/15 text-violet-400',
  urgent:    'bg-rose-500/15 text-rose-400',
  policy:    'bg-amber-400/15 text-amber-400',
  product:   'bg-emerald-500/15 text-emerald-400',
  logistics: 'bg-sky-400/15 text-sky-400',
};

export default function DealerAnnouncements() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [announcements, setAnnouncements] = useState([]);
  const [selectedType, setSelectedType] = useState('all');

  useEffect(() => {
    if (token) {
      fetchAnnouncements();
    }
  }, [token]);

  const fetchAnnouncements = async () => {
    try {
      const response = await axios.get(`${API}/dealer/announcements`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAnnouncements(response.data.announcements || []);
    } catch (error) {
      console.error('Failed to fetch announcements:', error);
      toast.error('Failed to load announcements');
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (announcementId) => {
    try {
      await axios.post(`${API}/dealer/announcements/${announcementId}/read`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAnnouncements(prev =>
        prev.map(a => a.id === announcementId ? { ...a, is_read: true } : a)
      );
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const types = ['all', ...Object.keys(ANNOUNCEMENT_TYPES)];

  const filteredAnnouncements = announcements.filter(a =>
    selectedType === 'all' || a.type === selectedType
  );

  const unreadCount = announcements.filter(a => !a.is_read).length;

  if (loading) {
    return (
      <DashboardLayout title="Announcements">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Announcements">
      <div className="space-y-6">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground mb-1">
              Dealer Portal
            </p>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Megaphone className="w-6 h-6 text-primary" />
              Announcements
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Stay updated with the latest news and updates</p>
          </div>
          {unreadCount > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wide bg-rose-500/15 text-rose-400 ring-1 ring-rose-500/25">
              <Bell className="w-3.5 h-3.5" />
              {unreadCount} unread
            </span>
          )}
        </div>

        {/* Type Filter */}
        <div className="flex gap-2 flex-wrap">
          {types.map(type => {
            const typeConfig = type !== 'all' ? ANNOUNCEMENT_TYPES[type] : null;
            const TypeIcon = typeConfig?.icon || Megaphone;
            const isActive = selectedType === type;
            return (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-mono font-semibold uppercase tracking-wide border transition-colors ${
                  isActive
                    ? 'bg-primary/15 text-primary border-primary/40'
                    : 'bg-muted text-muted-foreground border-border hover:border-primary/30 hover:text-foreground'
                }`}
              >
                <TypeIcon className="w-3.5 h-3.5" />
                {type === 'all' ? 'All' : typeConfig?.label}
              </button>
            );
          })}
        </div>

        {/* Announcements List */}
        {filteredAnnouncements.length === 0 ? (
          <div className="mg-card rounded-lg border border-border bg-card p-12 text-center">
            <Megaphone className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No Announcements</h3>
            <p className="text-muted-foreground text-sm">
              {selectedType === 'all'
                ? 'There are no announcements at this time.'
                : `No ${ANNOUNCEMENT_TYPES[selectedType]?.label} announcements.`}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredAnnouncements.map((announcement) => {
              const typeConfig = ANNOUNCEMENT_TYPES[announcement.type] || ANNOUNCEMENT_TYPES.general;
              const TypeIcon = typeConfig.icon;
              const tileTone = TYPE_TILE[announcement.type] || TYPE_TILE.general;

              return (
                <div
                  key={announcement.id}
                  data-testid={`announcement-${announcement.id}`}
                  className={`mg-card rounded-lg border bg-card transition-all ${
                    !announcement.is_read
                      ? 'border-l-2 border-l-primary border-border'
                      : 'border-border'
                  }`}
                >
                  <div className="p-4">
                    <div className="flex items-start gap-4">
                      <div className={`w-10 h-10 rounded flex items-center justify-center flex-shrink-0 ${tileTone}`}>
                        <TypeIcon className="w-5 h-5" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-foreground font-semibold">
                                {announcement.title}
                              </h3>
                              {!announcement.is_read && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold uppercase tracking-wide bg-primary/15 text-primary ring-1 ring-primary/25">
                                  New
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wide ring-1 ${typeConfig.tone}`}>
                                {typeConfig.label}
                              </span>
                              <span className="text-muted-foreground text-xs flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {formatDate(announcement.created_at)}
                              </span>
                            </div>
                          </div>

                          {!announcement.is_read && (
                            <button
                              className="text-muted-foreground hover:text-emerald-400 transition-colors p-1 rounded"
                              onClick={() => markAsRead(announcement.id)}
                              title="Mark as read"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        <p className="text-muted-foreground text-sm mt-3 whitespace-pre-wrap leading-relaxed">
                          {announcement.content}
                        </p>

                        {announcement.action_url && (
                          <a
                            href={announcement.action_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:text-primary/80 mt-3 text-sm font-medium transition-colors"
                          >
                            {announcement.action_text || 'Learn More'}
                            <ChevronRight className="w-4 h-4" />
                          </a>
                        )}

                        {announcement.expires_at && (
                          <p className="text-amber-400 text-xs mt-2 flex items-center gap-1 font-mono">
                            <Clock className="w-3 h-3" />
                            Expires: {new Date(announcement.expires_at).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
