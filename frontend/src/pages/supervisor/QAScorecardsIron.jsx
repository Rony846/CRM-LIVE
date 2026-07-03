import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, badgeStyle } from '@/components/iron/IronKit';
import { ChartArea, Sparkles } from 'lucide-react';

/* QA Scorecards — Iron Console restyle. Per-agent 5-criteria call-quality averages.
   Preserves the single endpoint GET /api/smartflo/qa/agent-scorecards?days=<n>. */

const CRITERIA = [
  { key: 'greeting', label: 'Greeting' },
  { key: 'empathy', label: 'Empathy' },
  { key: 'resolution', label: 'Resolution' },
  { key: 'handoff', label: 'Handoff' },
  { key: 'close', label: 'Close' },
];

// Score -> Iron colour (mirrors the legacy scoreTone thresholds).
const scoreColor = (n) => {
  if (n == null) return T.iron400;
  if (n >= 4.5) return T.green;
  if (n >= 3.5) return T.blue;
  if (n >= 2.5) return T.voltageText;
  return T.orangeDeep;
};

export default function QAScorecards() {
  const { token } = useAuth();
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/smartflo/qa/agent-scorecards`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { days },
      });
      setData(r.data);
    } catch (e) {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [token, days]);

  useEffect(() => { load(); }, [load]);

  const agents = data?.agents || [];

  const selectStyle = {
    border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '7px 10px',
    fontSize: 12.5, color: T.iron900, background: T.white, outline: 'none',
  };

  const headerRight = (
    <select
      value={String(days)}
      onChange={(e) => setDays(Number(e.target.value))}
      style={selectStyle}
    >
      <option value="7">Last 7d</option>
      <option value="30">Last 30d</option>
      <option value="90">Last 90d</option>
    </select>
  );

  return (
    <IronShell title="QA Scorecards" subtitle="CALL QUALITY" onRefresh={load} headerRight={headerRight}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <p style={{ fontFamily: T.body, fontSize: 12.5, color: T.iron500, margin: 0, maxWidth: 720 }}>
          Per-agent 5-criteria call-quality averages over the selected window. Calls must have a
          transcript + scorecard to appear.
        </p>

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <IronCard key={i} style={{ height: 190, background: T.iron100 }}>
                <div style={{ opacity: 0.5 }}>
                  <Caps size={9} color={T.iron400}>Loading…</Caps>
                </div>
              </IronCard>
            ))}
          </div>
        ) : agents.length === 0 ? (
          <IronCard style={{ padding: 0 }}>
            <div style={{ padding: '48px 20px', textAlign: 'center', color: T.iron500 }}>
              <ChartArea size={38} strokeWidth={1.5} style={{ color: T.iron200, margin: '0 auto 10px' }} />
              <p style={{ fontFamily: T.body, fontSize: 13, margin: 0 }}>No QA scorecards yet for this window.</p>
              <p style={{ fontFamily: T.body, fontSize: 11.5, marginTop: 8, color: T.iron400 }}>
                Run{' '}
                <code style={{ ...mono, background: T.iron100, padding: '1px 5px', borderRadius: 4, fontSize: 11 }}>
                  POST /api/smartflo/calls/{'{id}'}/qa-score
                </code>{' '}
                on calls with transcripts to populate.
              </p>
            </div>
          </IronCard>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
            {agents.map((a) => (
              <IronCard key={a.agent_name} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron900 }}>
                      {a.agent_name}
                    </div>
                    <div style={{ ...mono, fontSize: 11, color: T.iron500, marginTop: 2 }}>
                      {(a.calls_scored || 0)} call{a.calls_scored === 1 ? '' : 's'} scored
                    </div>
                  </div>
                  <div style={{ ...mono, fontSize: 26, fontWeight: 700, lineHeight: 1, color: scoreColor(a.averages?.overall) }}>
                    {(a.averages?.overall ?? 0).toFixed(1)}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6, textAlign: 'center' }}>
                  {CRITERIA.map((c) => (
                    <div key={c.key} style={{ background: T.iron50, border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '6px 2px' }}>
                      <Caps size={7.5} color={T.iron400}>{c.label}</Caps>
                      <div style={{ ...mono, fontSize: 13, fontWeight: 700, marginTop: 3, color: scoreColor(a.averages?.[c.key]) }}>
                        {(a.averages?.[c.key] ?? 0).toFixed(1)}
                      </div>
                    </div>
                  ))}
                </div>

                {a.weakest_criterion && (
                  <div>
                    <span style={badgeStyle('warn')}>Weakest: {a.weakest_criterion}</span>
                  </div>
                )}

                {a.latest_coaching?.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Sparkles size={11} strokeWidth={1.75} color={T.orange} />
                      <Caps size={8.5} color={T.iron400}>Coaching tips</Caps>
                    </div>
                    {a.latest_coaching.map((t, i) => (
                      <p key={i} style={{ fontFamily: T.body, fontSize: 11.5, fontStyle: 'italic', color: T.iron700, margin: 0 }}>
                        "{t.tip}"
                      </p>
                    ))}
                  </div>
                )}
              </IronCard>
            ))}
          </div>
        )}
      </div>
    </IronShell>
  );
}
