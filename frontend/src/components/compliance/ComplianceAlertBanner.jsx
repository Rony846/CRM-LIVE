import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  AlertTriangle, FileWarning, Clock, X, ChevronRight, Upload, CheckCircle 
} from 'lucide-react';
import { toast } from 'sonner';

export default function ComplianceAlertBanner() {
  const { token, user } = useAuth();
  const [alerts, setAlerts] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token && ['admin', 'accountant'].includes(user?.role)) {
      fetchComplianceAlerts();
      // Refresh every 60 seconds
      const interval = setInterval(fetchComplianceAlerts, 60000);
      return () => clearInterval(interval);
    }
  }, [token, user]);

  const fetchComplianceAlerts = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [dashboardRes, draftsRes] = await Promise.all([
        axios.get(`${API}/compliance/dashboard`, { headers }),
        axios.get(`${API}/drafts`, { headers })
      ]);
      
      setAlerts({
        openExceptions: dashboardRes.data.total_open || 0,
        criticalIssues: dashboardRes.data.by_severity?.critical || 0,
        pendingDrafts: draftsRes.data?.length || 0,
        drafts: draftsRes.data?.slice(0, 3) || [] // Show top 3 drafts
      });
    } catch (error) {
      console.error('Failed to fetch compliance alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFinalizeDraft = async (draft) => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      await axios.post(
        `${API}/drafts/${draft.transaction_type}/${draft.id}/finalize`,
        {},
        { headers }
      );
      toast.success('Draft finalized successfully');
      fetchComplianceAlerts();
    } catch (error) {
      const detail = error.response?.data?.detail;
      if (typeof detail === 'object') {
        toast.error(detail.message || 'Cannot finalize - compliance issues found');
      } else {
        toast.error(detail || 'Failed to finalize draft');
      }
    }
  };

  // Don't show if not admin/accountant or if no alerts
  if (!token || !['admin', 'accountant'].includes(user?.role)) {
    return null;
  }

  if (loading || dismissed) {
    return null;
  }

  // Only show if there are alerts
  const hasAlerts = alerts && (alerts.openExceptions > 0 || alerts.pendingDrafts > 0);
  if (!hasAlerts) {
    return null;
  }

  return (
    <div className="mb-6">
      <Card className={`border-l-4 ${
        alerts.criticalIssues > 0 ? 'border-l-red-500 bg-red-900/20' :
        alerts.openExceptions > 0 ? 'border-l-yellow-500 bg-yellow-900/20' :
        'border-l-blue-500 bg-blue-900/20'
      }`}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              {alerts.criticalIssues > 0 ? (
                <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
              ) : (
                <FileWarning className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
              )}
              
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-white font-medium">
                    Compliance Attention Required
                  </span>
                  {alerts.criticalIssues > 0 && (
                    <Badge className="bg-red-600 text-white text-xs">
                      {alerts.criticalIssues} Critical
                    </Badge>
                  )}
                </div>
                
                <div className="flex flex-wrap gap-4 text-sm">
                  {alerts.openExceptions > 0 && (
                    <div className="flex items-center gap-1 text-yellow-400">
                      <AlertTriangle className="w-4 h-4" />
                      <span>{alerts.openExceptions} open exception{alerts.openExceptions > 1 ? 's' : ''}</span>
                    </div>
                  )}
                  
                  {alerts.pendingDrafts > 0 && (
                    <div className="flex items-center gap-1 text-blue-400">
                      <Clock className="w-4 h-4" />
                      <span>{alerts.pendingDrafts} pending draft{alerts.pendingDrafts > 1 ? 's' : ''}</span>
                    </div>
                  )}
                </div>

                {/* Quick action for drafts */}
                {alerts.drafts?.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <p className="text-slate-400 text-xs">Quick finalize:</p>
                    <div className="flex flex-wrap gap-2">
                      {alerts.drafts.map((draft) => (
                        <div 
                          key={draft.id}
                          className="flex items-center gap-2 bg-slate-800 rounded px-2 py-1"
                        >
                          <span className="text-slate-300 text-sm">
                            {draft.reference_number}
                          </span>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            className="h-6 px-2 text-xs text-cyan-400 hover:text-cyan-300 hover:bg-slate-700"
                            onClick={() => handleFinalizeDraft(draft)}
                            data-testid={`quick-finalize-${draft.id}`}
                          >
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Finalize
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <a 
                href="/admin/compliance" 
                className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 text-sm"
                data-testid="compliance-alert-link"
              >
                View Dashboard
                <ChevronRight className="w-4 h-4" />
              </a>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setDismissed(true)}
                className="text-slate-400 hover:text-white p-1 h-auto"
                data-testid="dismiss-compliance-alert"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
