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

const NOTIFICATION_COLORS = {
  info: 'text-blue-400 bg-blue-900/30',
  success: 'text-green-400 bg-green-900/30',
  warning: 'text-yellow-400 bg-yellow-900/30',
  error: 'text-red-400 bg-red-900/30',
  action_required: 'text-orange-400 bg-orange-900/30'
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
        className="relative p-2 rounded-lg hover:bg-slate-700 transition-colors"
        data-testid="notification-bell"
      >
        <Bell className="w-5 h-5 text-slate-300" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
            <h3 className="font-semibold text-white">Notifications</h3>
            {unreadCount > 0 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={markAllAsRead}
                disabled={loading}
                className="text-cyan-400 hover:text-cyan-300 text-xs"
              >
                <CheckCheck className="w-4 h-4 mr-1" />
                Mark all read
              </Button>
            )}
          </div>

          {/* Notifications List */}
          <ScrollArea className="max-h-[400px]">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No notifications yet</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-700/50">
                {notifications.map((notification) => {
                  const Icon = NOTIFICATION_ICONS[notification.type] || Info;
                  const colorClass = NOTIFICATION_COLORS[notification.type] || NOTIFICATION_COLORS.info;
                  
                  return (
                    <div
                      key={notification.id}
                      className={`p-4 hover:bg-slate-700/50 transition-colors cursor-pointer ${
                        !notification.is_read ? 'bg-slate-700/30' : ''
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
                            <p className={`text-sm font-medium ${notification.is_read ? 'text-slate-300' : 'text-white'}`}>
                              {notification.title}
                            </p>
                            {!notification.is_read && (
                              <span className="w-2 h-2 bg-cyan-400 rounded-full flex-shrink-0 mt-1.5" />
                            )}
                          </div>
                          <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                            {notification.message}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs text-slate-500">
                              {formatTime(notification.created_at)}
                            </span>
                            {notification.priority === 'urgent' && (
                              <Badge className="bg-red-600 text-xs px-1.5 py-0">Urgent</Badge>
                            )}
                            {notification.priority === 'high' && (
                              <Badge className="bg-orange-600 text-xs px-1.5 py-0">High</Badge>
                            )}
                            {notification.link && (
                              <ExternalLink className="w-3 h-3 text-slate-500" />
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
