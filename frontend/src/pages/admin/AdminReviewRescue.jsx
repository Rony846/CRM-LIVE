import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { Star, Loader2, RefreshCw, ShieldCheck, ShieldAlert, Upload } from 'lucide-react';

function formatDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleString('en-IN');
}

export default function AdminReviewRescue() {
  const { token } = useAuth();
  const headers = { Authorization: `Bearer ${token}` };

  const [reviews, setReviews] = useState([]);
  const [session, setSession] = useState({});
  const [loading, setLoading] = useState(true);
  const [cookieText, setCookieText] = useState('');
  const [uploading, setUploading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/admin/low-reviews`, { headers });
      setReviews(res.data?.reviews || []);
      setSession(res.data?.session || {});
    } catch (e) {
      toast.error('Failed to load review-rescue data');
    } finally {
      setLoading(false);
    }
  }, [token]); // eslint-disable-line

  useEffect(() => { fetchData(); }, [fetchData]);

  const uploadCookies = async () => {
    const raw = cookieText.trim();
    if (!raw) { toast.error('Paste the Cookie-Editor JSON first'); return; }
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      toast.error('That is not valid JSON — use Cookie-Editor → Export → "Export as JSON"');
      return;
    }
    setUploading(true);
    try {
      const res = await axios.post(`${API}/admin/low-reviews/cookies`, parsed, { headers });
      if (res.data?.valid_session) {
        toast.success(res.data.message || 'Valid session — agent enabled');
        setCookieText('');
      } else {
        toast.warning(res.data?.message || 'Saved, but not a valid live session');
      }
      fetchData();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const ok = session.status === 'ok' && session.agent_enabled;

  return (
    <DashboardLayout>
      <div className="space-y-6 p-1">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Star className="h-6 w-6 text-amber-400" /> Negative-Review Rescue
            </h1>
            <p className="text-sm text-muted-foreground">
              Watches your Amazon listings for fresh 1–2★ reviews and drafts a goodwill response.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>

        {/* Session status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              {ok ? <ShieldCheck className="h-5 w-5 text-emerald-500" />
                  : <ShieldAlert className="h-5 w-5 text-amber-500" />}
              Amazon session
              {ok ? <Badge className="bg-emerald-600">Active</Badge>
                  : <Badge variant="destructive">Needs login</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <div>Status: <b>{session.status || 'never uploaded'}</b></div>
            <div>Last updated: {formatDate(session.updated)}</div>
            <div>Agent running: {session.agent_enabled ? 'Yes' : 'No'}</div>
          </CardContent>
        </Card>

        {/* Paste box */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Upload className="h-5 w-5" /> Refresh amazon.in session
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ol className="text-sm text-muted-foreground list-decimal ml-5 space-y-1">
              <li>Log into <b>amazon.in</b> (your shopping account) in Chrome.</li>
              <li>Open the free <b>Cookie-Editor</b> extension on amazon.in.</li>
              <li>Click <b>Export → Export as JSON</b>, then paste it below.</li>
            </ol>
            <Textarea
              rows={8}
              placeholder='[ { "name": "session-token", "value": "...", "domain": ".amazon.in", ... }, ... ]'
              value={cookieText}
              onChange={(e) => setCookieText(e.target.value)}
              className="font-mono text-xs"
            />
            <div className="flex items-center gap-3">
              <Button onClick={uploadCookies} disabled={uploading}>
                {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                Upload session
              </Button>
              <span className="text-xs text-muted-foreground">
                No password is stored — cookies only. It validates with a live test before enabling.
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Detected low reviews */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Detected 1–2★ reviews ({reviews.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {reviews.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                None yet. Once the session is active, new low reviews appear here with a drafted reply.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>★</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Reviewer</TableHead>
                    <TableHead>ASIN</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Reply draft</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reviews.map((r) => (
                    <TableRow key={r.id || r.review_id}>
                      <TableCell><Badge variant="destructive">{r.stars}★</Badge></TableCell>
                      <TableCell className="max-w-[220px] truncate">{r.title || '(no title)'}</TableCell>
                      <TableCell>{r.reviewer || '?'}</TableCell>
                      <TableCell className="font-mono text-xs">{r.asin}</TableCell>
                      <TableCell className="text-xs">{r.review_date || '-'}</TableCell>
                      <TableCell className="max-w-[280px]">
                        <Button variant="ghost" size="sm"
                          onClick={() => { navigator.clipboard.writeText(r.reply_draft || ''); toast.success('Reply copied'); }}>
                          Copy reply
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
