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
  general: { label: 'General', icon: Megaphone, color: 'bg-blue-600' },
  promotion: { label: 'Promotion', icon: Gift, color: 'bg-purple-600' },
  urgent: { label: 'Urgent', icon: AlertTriangle, color: 'bg-red-600' },
  policy: { label: 'Policy Update', icon: Info, color: 'bg-amber-600' },
  product: { label: 'New Product', icon: TrendingUp, color: 'bg-green-600' },
  logistics: { label: 'Logistics', icon: Truck, color: 'bg-cyan-600' }
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
          <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
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
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Megaphone className="w-6 h-6 text-cyan-400" />
              Announcements
            </h1>
            <p className="text-slate-400">Stay updated with the latest news and updates</p>
          </div>
          {unreadCount > 0 && (
            <Badge className="bg-red-600 text-white px-3 py-1">
              <Bell className="w-4 h-4 mr-1" />
              {unreadCount} unread
            </Badge>
          )}
        </div>

        {/* Type Filter */}
        <div className="flex gap-2 flex-wrap">
          {types.map(type => {
            const typeConfig = type !== 'all' ? ANNOUNCEMENT_TYPES[type] : null;
            const TypeIcon = typeConfig?.icon || Megaphone;
            return (
              <Button
                key={type}
                variant={selectedType === type ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedType(type)}
                className={selectedType === type 
                  ? 'bg-cyan-600 hover:bg-cyan-700' 
                  : 'border-slate-600 text-slate-300 hover:bg-slate-700'}
              >
                <TypeIcon className="w-4 h-4 mr-1" />
                {type === 'all' ? 'All' : typeConfig?.label}
              </Button>
            );
          })}
        </div>

        {/* Announcements List */}
        {filteredAnnouncements.length === 0 ? (
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-12 text-center">
              <Megaphone className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <h3 className="text-xl text-white mb-2">No Announcements</h3>
              <p className="text-slate-400">
                {selectedType === 'all' 
                  ? 'There are no announcements at this time.' 
                  : `No ${ANNOUNCEMENT_TYPES[selectedType]?.label} announcements.`}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredAnnouncements.map((announcement) => {
              const typeConfig = ANNOUNCEMENT_TYPES[announcement.type] || ANNOUNCEMENT_TYPES.general;
              const TypeIcon = typeConfig.icon;
              
              return (
                <Card 
                  key={announcement.id} 
                  className={`bg-slate-800 border-slate-700 transition-all ${
                    !announcement.is_read ? 'border-l-4 border-l-cyan-500' : ''
                  }`}
                  data-testid={`announcement-${announcement.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className={`w-10 h-10 rounded-lg ${typeConfig.color} flex items-center justify-center flex-shrink-0`}>
                        <TypeIcon className="w-5 h-5 text-white" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h3 className="text-white font-semibold text-lg">
                              {announcement.title}
                              {!announcement.is_read && (
                                <Badge className="bg-cyan-600 ml-2 text-xs">New</Badge>
                              )}
                            </h3>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className={`border-slate-600 text-xs ${typeConfig.color.replace('bg-', 'text-').replace('-600', '-400')}`}>
                                {typeConfig.label}
                              </Badge>
                              <span className="text-slate-500 text-sm flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {formatDate(announcement.created_at)}
                              </span>
                            </div>
                          </div>
                          
                          {!announcement.is_read && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-slate-400 hover:text-cyan-400"
                              onClick={() => markAsRead(announcement.id)}
                            >
                              <CheckCircle className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                        
                        <p className="text-slate-300 mt-3 whitespace-pre-wrap">
                          {announcement.content}
                        </p>
                        
                        {announcement.action_url && (
                          <a 
                            href={announcement.action_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300 mt-3 text-sm"
                          >
                            {announcement.action_text || 'Learn More'}
                            <ChevronRight className="w-4 h-4" />
                          </a>
                        )}
                        
                        {announcement.expires_at && (
                          <p className="text-amber-400 text-xs mt-2 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Expires: {new Date(announcement.expires_at).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
