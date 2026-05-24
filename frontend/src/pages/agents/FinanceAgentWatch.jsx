import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import {
  Bot, Loader2, PlayCircle, Power, AlertTriangle, CheckCircle2,
  Globe, MonitorPlay, RefreshCw, Clock, Inbox,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const formatRelative = (iso) => {
  if (!iso) return 'never';
  try {
    const d = new Date(iso);
    const diffMs = d.getTime() - Date.now();
    const abs = Math.abs(diffMs);
    const sec = Math.round(abs / 1000);
    if (sec < 60) return diffMs >= 0 ? `in ${sec}s` : `${sec}s ago`;
    const min = Math.round(sec / 60);
    if (min < 60) return diffMs >= 0 ? `in ${min}m` : `${min}m ago`;
    const hr = Math.round(min / 60);
    if (hr < 24) return diffMs >= 0 ? `in ${hr}h` : `${hr}h ago`;
    const days = Math.round(hr / 24);
    return diffMs >= 0 ? `in ${days}d` : `${days}d ago`;
  } catch { return iso; }
};

const STATUS_TONE = {
  ok:               'bg-emerald-500/15 text-emerald-400',
  session_expired:  'bg-orange-400/15 text-orange-400',
  page_changed:     'bg-rose-500/15 text-rose-400',
  error:            'bg-rose-500/15 text-rose-400',
  skipped:          'bg-muted text-muted-foreground',
};

export default function FinanceAgentWatch() {
  const { token } = useAuth();
  const headers = { Authorization: `Bearer ${token}` };
  const [scraperState, setScraperState] = useState({ tasks: [], browser: {} });
  const [screenshot, setScreenshot] = useState(null);
  const [browserBusy, setBrowserBusy] = useState(false);
  const [runningTask, setRunningTask] = useState(null);
  const screenshotErrorRef = useRef(0);

  // Poll the agent state (task schedule + browser state)
  const fetchScraperState = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/finance/scraper-state`, { headers });
      setScraperState(r.data || { tasks: [], browser: {} });
    } catch {/* silent — UI shows stale state */}
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  // Poll the live screenshot — every ~1.5s when browser is alive, slower when not.
  const fetchScreenshot = useCallback(async () => {
    if (!scraperState.browser?.started) {
      setScreenshot(null);
      return;
    }
    try {
      const r = await axios.get(`${API}/browser-agent/screenshot`, { headers });
      if (r.data?.screenshot) {
        setScreenshot(r.data.screenshot);
        screenshotErrorRef.current = 0;
      }
    } catch {
      screenshotErrorRef.current += 1;
      if (screenshotErrorRef.current > 3) setScreenshot(null);
    }
  }, [scraperState.browser?.started, token]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchScraperState();
    const t1 = setInterval(fetchScraperState, 8000);
    return () => clearInterval(t1);
  }, [fetchScraperState]);

  useEffect(() => {
    fetchScreenshot();
    const interval = scraperState.browser?.started ? 1500 : 6000;
    const t = setInterval(fetchScreenshot, interval);
    return () => clearInterval(t);
  }, [fetchScreenshot, scraperState.browser?.started]);

  const handleStartBrowser = async () => {
    setBrowserBusy(true);
    try {
      await axios.post(`${API}/browser-agent/start`, {}, { headers });
      toast.success('Browser started. Log in to Seller Central via /admin/browser-agent if not already.');
      await fetchScraperState();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to start browser');
    } finally {
      setBrowserBusy(false);
    }
  };

  const handleStopBrowser = async () => {
    setBrowserBusy(true);
    try {
      await axios.post(`${API}/browser-agent/stop`, {}, { headers });
      toast.success('Browser stopped');
      await fetchScraperState();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to stop browser');
    } finally {
      setBrowserBusy(false);
    }
  };

  const handleRunTaskNow = async (taskKind) => {
    setRunningTask(taskKind);
    try {
      const r = await axios.post(`${API}/finance/scraper-state/${taskKind}/run-now`, {}, { headers });
      if (r.data?.queued) {
        toast.success(`Queued ${taskKind} — will run on the next pulse (within ~30s)`);
      } else {
        toast.warning(r.data?.reason || 'Could not queue task');
      }
      await fetchScraperState();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to queue task');
    } finally {
      setRunningTask(null);
    }
  };

  const browserStarted = scraperState.browser?.started;
  const browserStateLabel = scraperState.browser?.state || 'unknown';

  return (
    <DashboardLayout title="Finance Agent · Watch Live">
      <div className="space-y-4 max-w-7xl">
        {/* Header */}
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
              <MonitorPlay className="w-5 h-5 text-primary" /> Finance Agent · Watch Live
              <Badge className="bg-violet-400/15 text-violet-400 font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 ml-1">
                Continuous · {scraperState.tasks?.length || 0} tasks
              </Badge>
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Live view of the agent's browser. A scrape pulse runs every ~30 minutes — pick the next
              due task and run it through Seller Central. Screenshots refresh every 1.5s while the
              browser is alive.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={`font-mono text-[11px] uppercase tracking-wider px-3 py-1.5 ${browserStarted ? 'bg-emerald-500/15 text-emerald-400' : 'bg-muted text-muted-foreground'}`}>
              <Globe className="w-3.5 h-3.5 mr-1.5" /> Browser: {browserStateLabel}
            </Badge>
            <Link to="/admin/browser-agent" className="text-xs underline text-muted-foreground hover:text-foreground">
              full console
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Live screenshot */}
          <Card className="mg-card border-border lg:col-span-2">
            <CardHeader className="border-b border-border bg-muted/30 py-3 px-5 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                <MonitorPlay className="w-4 h-4 text-primary" /> Browser view
                {scraperState.browser?.page_url && (
                  <span className="text-[10px] font-mono text-muted-foreground truncate ml-2 max-w-[300px]">
                    {scraperState.browser.page_url}
                  </span>
                )}
              </CardTitle>
              <div className="flex items-center gap-2">
                {browserStarted ? (
                  <Button size="sm" variant="outline" onClick={handleStopBrowser} disabled={browserBusy}>
                    {browserBusy ? <Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> : <Power className="w-3 h-3 mr-1.5" />}
                    Stop
                  </Button>
                ) : (
                  <Button size="sm" onClick={handleStartBrowser} disabled={browserBusy}>
                    {browserBusy ? <Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> : <PlayCircle className="w-3 h-3 mr-1.5" />}
                    Start browser
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {screenshot ? (
                <img
                  src={`data:image/jpeg;base64,${screenshot}`}
                  alt="Live browser"
                  className="w-full h-auto block"
                />
              ) : (
                <div className="aspect-video flex flex-col items-center justify-center text-muted-foreground bg-muted/20">
                  {browserStarted ? (
                    <>
                      <Loader2 className="w-8 h-8 animate-spin mb-2" />
                      <div className="text-sm">Waiting for first screenshot…</div>
                    </>
                  ) : (
                    <>
                      <Globe className="w-10 h-10 mb-3 opacity-40" />
                      <div className="text-sm font-medium text-foreground">Browser is not running</div>
                      <div className="text-xs mt-1 text-center max-w-md">
                        Click <strong>Start browser</strong>, then log into Seller Central once at{' '}
                        <Link to="/admin/browser-agent" className="underline">/admin/browser-agent</Link>.
                        After that the agent scrapes autonomously for ~14 days before cookies expire.
                      </div>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Task roster */}
          <Card className="mg-card border-border">
            <CardHeader className="border-b border-border bg-muted/30 py-3 px-5">
              <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" /> Scrape roster
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {!scraperState.tasks?.length && (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                  Loading…
                </div>
              )}
              {scraperState.tasks?.map((t) => (
                <div key={t.task_kind} className="px-5 py-3 border-b border-border last:border-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">
                        {t.label || t.task_kind}
                      </div>
                      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mt-0.5">
                        every {Math.round((t.cadence_minutes || 0) / 60)}h ·{' '}
                        next {formatRelative(t.next_due_at)}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      title="Force run immediately (kicks an off-cycle pulse)"
                      onClick={() => handleRunTaskNow(t.task_kind)}
                      disabled={runningTask === t.task_kind || t.running}
                      className="shrink-0"
                    >
                      {runningTask === t.task_kind || t.running
                        ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Running…</>
                        : <><RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Run now</>}
                    </Button>
                  </div>
                  {(t.last_run_at || t.last_status) && (
                    <div className="flex items-center gap-2 mt-2 text-xs">
                      <Badge className={`${STATUS_TONE[t.last_status] || 'bg-muted text-muted-foreground'} text-[10px] uppercase font-mono px-1.5`}>
                        {t.last_status || 'never run'}
                      </Badge>
                      <span className="text-muted-foreground font-mono text-[10px]">
                        {formatRelative(t.last_run_at)}
                      </span>
                    </div>
                  )}
                  {t.last_result?.summary && (
                    <div className="text-xs text-muted-foreground mt-1.5 truncate" title={t.last_result.summary}>
                      {t.last_result.summary}
                    </div>
                  )}
                  {t.last_error && (
                    <div className="text-xs text-rose-400 mt-1.5 flex items-start gap-1">
                      <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                      <span className="truncate" title={t.last_error}>{t.last_error}</span>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Honest call-out about autonomy ceiling */}
        <Card className="mg-card border-border">
          <CardContent className="p-4 flex items-start gap-3 text-sm">
            <AlertTriangle className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-foreground">Autonomy ceiling: ~14 days per login</div>
              <p className="text-muted-foreground mt-1 text-xs">
                Amazon Seller Central cookies expire on a rolling ~14-day window. As long as cookies are
                valid the pulse runs without you. When they go stale, you'll get one high-priority
                notification — open <Link to="/admin/browser-agent" className="underline">/admin/browser-agent</Link>,
                sign in once, and autonomy resumes. Full unattended mode (TOTP auto-login) is the next
                phase. Bank-statement uploads and other gaps the agent can't scrape live in the{' '}
                <Link to="/agents/finance/inbox" className="underline inline-flex items-center gap-0.5">
                  <Inbox className="w-3 h-3" /> Data Inbox
                </Link>.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
