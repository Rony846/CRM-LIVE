import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { Bell, Check, CheckCheck, X, ExternalLink, AlertTriangle, Info, CheckCircle, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

const NOTIFICATION_ICONS = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error: AlertCircle,
  action_required: AlertTriangle
};

// Opacity-tint tones so the bell reads cleanly on both Obsidian (dark) and Lumina (light).
const NOTIFICATION_COLORS = {
  info:            'text-sky-500 bg-sky-500/15',
  success:         'text-emerald-500 bg-emerald-500/15',
  warning:         'text-amber-500 bg-amber-500/15',
  error:           'text-rose-500 bg-rose-500/15',
  action_required: 'text-orange-500 bg-orange-500/15',
  // PI lifecycle types — colour-coded to their meaning
  pi_approved:     'text-emerald-500 bg-emerald-500/15',
  pi_rejected:     'text-rose-500 bg-rose-500/15',
  pi_converted:    'text-primary bg-primary/15',
  ticket_created:  'text-sky-500 bg-sky-500/15',
  lead_created:    'text-violet-500 bg-violet-500/15',
  dealer:          'text-violet-500 bg-violet-500/15',
  incentive:       'text-emerald-500 bg-emerald-500/15',
  alert:           'text-rose-500 bg-rose-500/15',
};

export default function NotificationBell() {
  const { token } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  const fetchNotifications = async () => {
    if (!token) return;
    try {
      const response = await axios.get(`${API}/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { limit: 20 }
      });
      setNotifications(response.data.notifications || []);
      setUnreadCount(response.data.unread_count || 0);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  };

  useEffect(() => {
    fetchNotifications();
    // Poll for new notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [token]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markAsRead = async (notificationId) => {
    try {
      await axios.post(`${API}/notifications/${notificationId}/read`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(prev => prev.map(n => 
        n.id === notificationId ? { ...n, is_read: true } : n
      ));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    setLoading(true);
    try {
      await axios.post(`${API}/notifications/read-all`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-accent transition-colors"
        data-testid="notification-bell"
      >
        <Bell className="w-5 h-5 text-muted-foreground" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="mg-card absolute right-0 mt-2 w-96 rounded-lg border border-border bg-popover shadow-soft-lg z-50 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-muted/40">
            <h3 className="font-semibold text-foreground">Notifications</h3>
            {unreadCount > 0 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={markAllAsRead}
                disabled={loading}
                className="text-primary hover:text-primary hover:bg-primary/10 text-xs"
              >
                <CheckCheck className="w-4 h-4 mr-1" />
                Mark all read
              </Button>
            )}
          </div>

          {/* Notifications List */}
          <ScrollArea className="max-h-[400px]">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No notifications yet</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {notifications.map((notification) => {
                  const Icon = NOTIFICATION_ICONS[notification.type] || Info;
                  const colorClass = NOTIFICATION_COLORS[notification.type] || NOTIFICATION_COLORS.info;

                  return (
                    <div
                      key={notification.id}
                      className={`p-4 hover:bg-accent/50 transition-colors cursor-pointer ${
                        !notification.is_read ? 'bg-primary/[0.04]' : ''
                      }`}
                      onClick={() => {
                        if (!notification.is_read) markAsRead(notification.id);
                        if (notification.link) window.location.href = notification.link;
                      }}
                    >
                      <div className="flex gap-3">
                        <div className={`p-2 rounded-lg ${colorClass}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className={`text-sm font-medium ${notification.is_read ? 'text-muted-foreground' : 'text-foreground'}`}>
                              {notification.title}
                            </p>
                            {!notification.is_read && (
                              <span className="w-2 h-2 bg-primary rounded-full flex-shrink-0 mt-1.5" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {notification.message}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs text-muted-foreground/70 font-mono">
                              {formatTime(notification.created_at)}
                            </span>
                            {notification.priority === 'urgent' && (
                              <Badge className="bg-rose-500/15 text-rose-500 ring-1 ring-rose-500/25 text-[10px] font-mono uppercase tracking-wide px-1.5 py-0">Urgent</Badge>
                            )}
                            {notification.priority === 'high' && (
                              <Badge className="bg-amber-500/15 text-amber-500 ring-1 ring-amber-500/25 text-[10px] font-mono uppercase tracking-wide px-1.5 py-0">High</Badge>
                            )}
                            {notification.link && (
                              <ExternalLink className="w-3 h-3 text-muted-foreground/70" />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
