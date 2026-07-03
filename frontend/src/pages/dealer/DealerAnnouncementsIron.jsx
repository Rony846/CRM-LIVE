import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { toast } from 'sonner';
import {
  Megaphone, Loader2, Calendar, AlertTriangle, Info, Gift,
  Truck, TrendingUp, Clock, ChevronRight, Bell, CheckCircle
} from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, badgeStyle } from '@/components/iron/IronKit';

// type -> icon + iron badge tone + tile color
const ANNOUNCEMENT_TYPES = {
  general:   { label: 'General',       icon: Megaphone,     tone: 'bad',    color: T.orange },
  promotion: { label: 'Promotion',     icon: Gift,          tone: 'violet', color: '#6D4AB0' },
  urgent:    { label: 'Urgent',        icon: AlertTriangle, tone: 'bad',    color: T.orangeDeep },
  policy:    { label: 'Policy Update', icon: Info,          tone: 'warn',   color: T.voltageText },
  product:   { label: 'New Product',   icon: TrendingUp,    tone: 'ok',     color: T.green },
  logistics: { label: 'Logistics',     icon: Truck,         tone: 'info',   color: T.blue },
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const headerRight = unreadCount > 0 ? (
    <span style={{ ...badgeStyle('bad'), display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', fontSize: 10 }}>
      <Bell size={12} /> {unreadCount} Unread
    </span>
  ) : null;

  const content = loading ? (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 260 }}>
      <Loader2 className="animate-spin" size={30} color={T.orange} />
    </div>
  ) : (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Sub-header */}
      <div>
        <Caps size={9} color={T.iron400}>Dealer Portal — News &amp; Updates</Caps>
        <div style={{ fontFamily: T.body, fontSize: 12.5, color: T.iron500, marginTop: 3 }}>
          Stay updated with the latest news and updates
        </div>
      </div>

      {/* Type filter */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {types.map(type => {
          const typeConfig = type !== 'all' ? ANNOUNCEMENT_TYPES[type] : null;
          const TypeIcon = typeConfig?.icon || Megaphone;
          const isActive = selectedType === type;
          return (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 12px', borderRadius: 6, cursor: 'pointer',
                fontFamily: T.headline, fontWeight: 700, fontSize: 11,
                letterSpacing: '.05em', textTransform: 'uppercase',
                border: `1px solid ${isActive ? T.orange : T.iron200}`,
                background: isActive ? T.orange : T.white,
                color: isActive ? '#fff' : T.iron700,
              }}
            >
              <TypeIcon size={14} />
              {type === 'all' ? 'All' : typeConfig?.label}
            </button>
          );
        })}
      </div>

      {/* List */}
      {filteredAnnouncements.length === 0 ? (
        <IronCard pad={0}>
          <div style={{ padding: '56px 20px', textAlign: 'center' }}>
            <Megaphone size={44} color={T.iron200} style={{ margin: '0 auto 14px' }} />
            <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 16, color: T.iron900, marginBottom: 6 }}>
              No Announcements
            </div>
            <div style={{ fontFamily: T.body, fontSize: 12.5, color: T.iron500 }}>
              {selectedType === 'all'
                ? 'There are no announcements at this time.'
                : `No ${ANNOUNCEMENT_TYPES[selectedType]?.label} announcements.`}
            </div>
          </div>
        </IronCard>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filteredAnnouncements.map((announcement) => {
            const typeConfig = ANNOUNCEMENT_TYPES[announcement.type] || ANNOUNCEMENT_TYPES.general;
            const TypeIcon = typeConfig.icon;
            const unread = !announcement.is_read;

            return (
              <IronCard
                key={announcement.id}
                pad={0}
                style={unread ? { borderLeft: `3px solid ${T.orange}` } : undefined}
              >
                <div data-testid={`announcement-${announcement.id}`} style={{ padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 8, flexShrink: 0,
                      display: 'grid', placeItems: 'center',
                      background: T.iron50, border: `1px solid ${T.iron200}`, color: typeConfig.color,
                    }}>
                      <TypeIcon size={20} />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14.5, color: T.iron900 }}>
                              {announcement.title}
                            </span>
                            {unread && <span style={badgeStyle('bad')}>New</span>}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 7, flexWrap: 'wrap' }}>
                            <span style={badgeStyle(typeConfig.tone)}>{typeConfig.label}</span>
                            <span style={{ ...mono, fontSize: 11, color: T.iron500, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <Calendar size={12} />
                              {formatDate(announcement.created_at)}
                            </span>
                          </div>
                        </div>

                        {unread && (
                          <button
                            onClick={() => markAsRead(announcement.id)}
                            title="Mark as read"
                            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: T.iron400, padding: 4, borderRadius: 6, flexShrink: 0 }}
                          >
                            <CheckCircle size={16} />
                          </button>
                        )}
                      </div>

                      <p style={{ fontFamily: T.body, fontSize: 12.5, color: T.iron700, marginTop: 12, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                        {announcement.content}
                      </p>

                      {announcement.action_url && (
                        <a
                          href={announcement.action_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 12, fontFamily: T.headline, fontWeight: 700, fontSize: 12.5, color: T.orange, textDecoration: 'none' }}
                        >
                          {announcement.action_text || 'Learn More'}
                          <ChevronRight size={15} />
                        </a>
                      )}

                      {announcement.expires_at && (
                        <div style={{ ...mono, fontSize: 11, color: T.voltageText, marginTop: 9, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Clock size={12} />
                          Expires: {new Date(announcement.expires_at).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </IronCard>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <IronShell title="Announcements" subtitle="DEALER / ANNOUNCEMENTS" onRefresh={fetchAnnouncements} headerRight={headerRight}>
      {content}
    </IronShell>
  );
}
