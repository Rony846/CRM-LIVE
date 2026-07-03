import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { API, useAuth } from '@/App';
import {
  Loader2, PlayCircle, Power, AlertTriangle,
  Globe, MonitorPlay, RefreshCw, Clock, Inbox,
} from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, badgeStyle } from '@/components/iron/IronKit';

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

// Map the agent's last_status to an Iron badge tone.
const STATUS_TONE = {
  ok: 'ok',
  session_expired: 'warn',
  page_changed: 'bad',
  error: 'bad',
  skipped: 'slate',
};

const btnPrimary = {
  border: 'none', background: T.orange, color: '#fff', borderRadius: 6,
  padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12,
  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
};
const btnOutline = {
  border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, borderRadius: 6,
  padding: '7px 12px', fontFamily: T.headline, fontWeight: 700, fontSize: 12,
  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
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

  const headerRight = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ ...badgeStyle(browserStarted ? 'ok' : 'slate'), display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px' }}>
        <Globe size={12} /> Browser: {browserStateLabel}
      </span>
      <Link to="/admin/browser-agent" style={{ ...mono, fontSize: 11, color: T.iron500, textDecoration: 'underline' }}>
        full console
      </Link>
    </div>
  );

  return (
    <IronShell
      title="Finance Agent · Watch Live"
      subtitle={`CONTINUOUS · ${scraperState.tasks?.length || 0} TASKS`}
      onRefresh={fetchScraperState}
      headerRight={headerRight}
    >
      <div style={{ maxWidth: 1200, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Intro strip */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <MonitorPlay size={18} color={T.orange} />
          <span style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 15, color: T.iron900 }}>
            Watch the agent work
          </span>
          <span style={{ ...badgeStyle('violet') }}>
            Continuous · {scraperState.tasks?.length || 0} tasks
          </span>
          <p style={{ flexBasis: '100%', margin: 0, fontSize: 12.5, color: T.iron500, lineHeight: 1.5 }}>
            Live view of the agent's browser. A scrape pulse runs every ~30 minutes — pick the next
            due task and run it through Seller Central. Screenshots refresh every 1.5s while the
            browser is alive.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
          {/* Live screenshot */}
          <IronCard pad={0}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '12px 16px', borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <MonitorPlay size={15} color={T.orange} />
                <span style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 13, color: T.iron900 }}>Browser view</span>
                {scraperState.browser?.page_url && (
                  <span style={{ ...mono, fontSize: 10, color: T.iron400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 300 }}>
                    {scraperState.browser.page_url}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {browserStarted ? (
                  <button style={btnOutline} onClick={handleStopBrowser} disabled={browserBusy}>
                    {browserBusy ? <Loader2 size={13} className="animate-spin" /> : <Power size={13} />}
                    Stop
                  </button>
                ) : (
                  <button style={btnPrimary} onClick={handleStartBrowser} disabled={browserBusy}>
                    {browserBusy ? <Loader2 size={13} className="animate-spin" /> : <PlayCircle size={13} />}
                    Start browser
                  </button>
                )}
              </div>
            </div>
            <div>
              {screenshot ? (
                <img
                  src={`data:image/jpeg;base64,${screenshot}`}
                  alt="Live browser"
                  style={{ width: '100%', height: 'auto', display: 'block' }}
                />
              ) : (
                <div style={{ aspectRatio: '16 / 9', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: T.iron400, background: T.iron50 }}>
                  {browserStarted ? (
                    <>
                      <Loader2 size={32} className="animate-spin" style={{ marginBottom: 8 }} />
                      <div style={{ fontSize: 13 }}>Waiting for first screenshot…</div>
                    </>
                  ) : (
                    <>
                      <Globe size={40} style={{ marginBottom: 12, opacity: 0.4 }} />
                      <div style={{ fontSize: 13, fontWeight: 600, color: T.iron900 }}>Browser is not running</div>
                      <div style={{ fontSize: 11.5, marginTop: 4, textAlign: 'center', maxWidth: 420, color: T.iron500 }}>
                        Click <strong>Start browser</strong>, then log into Seller Central once at{' '}
                        <Link to="/admin/browser-agent" style={{ textDecoration: 'underline', color: T.blue }}>/admin/browser-agent</Link>.
                        After that the agent scrapes autonomously for ~14 days before cookies expire.
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </IronCard>

          {/* Task roster */}
          <IronCard pad={0}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
              <Clock size={15} color={T.orange} />
              <span style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 13, color: T.iron900 }}>Scrape roster</span>
            </div>
            <div>
              {!scraperState.tasks?.length && (
                <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: T.iron400 }}>
                  <Loader2 size={20} className="animate-spin" style={{ margin: '0 auto 8px' }} />
                  Loading…
                </div>
              )}
              {scraperState.tasks?.map((t) => (
                <div key={t.task_kind} style={{ padding: '12px 16px', borderBottom: `1px solid ${T.iron200}` }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: T.iron900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.label || t.task_kind}
                      </div>
                      <div style={{ marginTop: 2 }}>
                        <Caps size={9} color={T.iron400}>
                          every {Math.round((t.cadence_minutes || 0) / 60)}h · next {formatRelative(t.next_due_at)}
                        </Caps>
                      </div>
                    </div>
                    <button
                      style={{ ...btnOutline, flexShrink: 0, padding: '6px 10px', fontSize: 11 }}
                      title="Force run immediately (kicks an off-cycle pulse)"
                      onClick={() => handleRunTaskNow(t.task_kind)}
                      disabled={runningTask === t.task_kind || t.running}
                    >
                      {runningTask === t.task_kind || t.running
                        ? <><Loader2 size={13} className="animate-spin" /> Running…</>
                        : <><RefreshCw size={13} /> Run now</>}
                    </button>
                  </div>
                  {(t.last_run_at || t.last_status) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                      <span style={badgeStyle(STATUS_TONE[t.last_status] || 'slate')}>
                        {t.last_status || 'never run'}
                      </span>
                      <span style={{ ...mono, fontSize: 10, color: T.iron400 }}>
                        {formatRelative(t.last_run_at)}
                      </span>
                    </div>
                  )}
                  {t.last_result?.summary && (
                    <div style={{ fontSize: 11.5, color: T.iron500, marginTop: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.last_result.summary}>
                      {t.last_result.summary}
                    </div>
                  )}
                  {t.last_error && (
                    <div style={{ fontSize: 11.5, color: T.rose, marginTop: 6, display: 'flex', alignItems: 'flex-start', gap: 4 }}>
                      <AlertTriangle size={12} style={{ marginTop: 2, flexShrink: 0 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.last_error}>{t.last_error}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </IronCard>
        </div>

        {/* Honest call-out about autonomy ceiling */}
        <IronCard style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <AlertTriangle size={20} color={T.orange} style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.iron900 }}>Autonomy ceiling: ~14 days per login</div>
            <p style={{ margin: '4px 0 0', fontSize: 11.5, color: T.iron500, lineHeight: 1.5 }}>
              Amazon Seller Central cookies expire on a rolling ~14-day window. As long as cookies are
              valid the pulse runs without you. When they go stale, you'll get one high-priority
              notification — open <Link to="/admin/browser-agent" style={{ textDecoration: 'underline', color: T.blue }}>/admin/browser-agent</Link>,
              sign in once, and autonomy resumes. Full unattended mode (TOTP auto-login) is the next
              phase. Bank-statement uploads and other gaps the agent can't scrape live in the{' '}
              <Link to="/agents/finance/inbox" style={{ textDecoration: 'underline', color: T.blue, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                <Inbox size={12} /> Data Inbox
              </Link>.
            </p>
          </div>
        </IronCard>
      </div>
    </IronShell>
  );
}
