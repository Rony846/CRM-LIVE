import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { toast } from 'sonner';
import { Star, Loader2, ShieldCheck, ShieldAlert, Upload } from 'lucide-react';
import IronShell from '@/components/iron/IronShell';
import { T, Caps, IronCard, mono, thCell, tdCell, badgeStyle, fmtDateTime } from '@/components/iron/IronKit';

const btnPrimary = { border: 'none', background: T.orange, color: '#fff', borderRadius: 6, padding: '8px 14px', fontFamily: T.headline, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
const btnOutline = { border: `1px solid ${T.iron200}`, background: T.white, color: T.iron700, borderRadius: 6, padding: '6px 10px', fontFamily: T.headline, fontWeight: 700, fontSize: 11.5, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
const textareaStyle = { border: `1px solid ${T.iron200}`, borderRadius: 6, padding: '10px 12px', fontSize: 11.5, color: T.iron900, background: T.white, outline: 'none', width: '100%', fontFamily: T.mono, resize: 'vertical' };

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
  const H = ['★', 'Title', 'Reviewer', 'ASIN', 'Date', 'Reply draft'];

  return (
    <IronShell
      title="Review Rescue"
      subtitle="NEGATIVE-REVIEW WATCH"
      onRefresh={fetchData}
      headerRight={(
        <button onClick={fetchData} disabled={loading} style={{ ...btnOutline, opacity: loading ? 0.6 : 1 }}>
          {loading ? <Loader2 size={13} className="animate-spin" /> : <Star size={13} />} Refresh
        </button>
      )}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1100 }}>
        {/* Intro */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Star size={18} color={T.voltage} />
          <span style={{ fontSize: 12.5, color: T.iron500 }}>
            Watches your Amazon listings for fresh 1–2★ reviews and drafts a goodwill response.
          </span>
        </div>

        {/* Session status */}
        <IronCard pad={14}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            {ok ? <ShieldCheck size={18} color={T.green} /> : <ShieldAlert size={18} color={T.voltageText} />}
            <span style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron900 }}>Amazon session</span>
            <span style={badgeStyle(ok ? 'ok' : 'bad')}>{ok ? 'Active' : 'Needs login'}</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
            <div>
              <Caps size={8.5}>Status</Caps>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.iron900, marginTop: 3 }}>{session.status || 'never uploaded'}</div>
            </div>
            <div>
              <Caps size={8.5}>Last updated</Caps>
              <div style={{ ...mono, fontSize: 12.5, color: T.iron700, marginTop: 4 }}>{formatDate(session.updated)}</div>
            </div>
            <div>
              <Caps size={8.5}>Agent running</Caps>
              <div style={{ fontSize: 13, fontWeight: 600, color: session.agent_enabled ? T.green : T.iron500, marginTop: 3 }}>{session.agent_enabled ? 'Yes' : 'No'}</div>
            </div>
          </div>
        </IronCard>

        {/* Paste box */}
        <IronCard pad={14}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Upload size={16} color={T.iron700} />
            <span style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron900 }}>Refresh amazon.in session</span>
          </div>
          <ol style={{ fontSize: 12.5, color: T.iron500, margin: '0 0 12px 18px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <li>Log into <b>amazon.in</b> (your shopping account) in Chrome.</li>
            <li>Open the free <b>Cookie-Editor</b> extension on amazon.in.</li>
            <li>Click <b>Export → Export as JSON</b>, then paste it below.</li>
          </ol>
          <textarea
            rows={8}
            placeholder='[ { "name": "session-token", "value": "...", "domain": ".amazon.in", ... }, ... ]'
            value={cookieText}
            onChange={(e) => setCookieText(e.target.value)}
            style={textareaStyle}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 12 }}>
            <button onClick={uploadCookies} disabled={uploading} style={{ ...btnPrimary, opacity: uploading ? 0.7 : 1 }}>
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              Upload session
            </button>
            <span style={{ fontSize: 11.5, color: T.iron400 }}>
              No password is stored — cookies only. It validates with a live test before enabling.
            </span>
          </div>
        </IronCard>

        {/* Detected low reviews */}
        <IronCard pad={0}>
          <div style={{ padding: '12px 14px', borderBottom: `1px solid ${T.iron200}`, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: T.headline, fontWeight: 700, fontSize: 14, color: T.iron900 }}>Detected 1–2★ reviews</span>
            <span style={badgeStyle('slate')}>{reviews.length}</span>
          </div>
          {reviews.length === 0 ? (
            <div style={{ padding: '28px 14px', textAlign: 'center', fontSize: 12.5, color: T.iron400 }}>
              None yet. Once the session is active, new low reviews appear here with a drafted reply.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${T.iron200}`, background: T.iron50 }}>
                  {H.map((h) => <th key={h} style={thCell}><Caps size={8.5}>{h}</Caps></th>)}
                </tr>
              </thead>
              <tbody>
                {reviews.map((r) => (
                  <tr key={r.id || r.review_id} className="iron-row" style={{ borderBottom: `1px solid ${T.iron200}` }}>
                    <td style={tdCell}><span style={badgeStyle('bad')}>{r.stars}★</span></td>
                    <td style={{ ...tdCell, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title || '(no title)'}</td>
                    <td style={tdCell}>{r.reviewer || '?'}</td>
                    <td style={{ ...tdCell, ...mono, fontSize: 11.5 }}>{r.asin}</td>
                    <td style={{ ...tdCell, ...mono, fontSize: 11.5 }}>{r.review_date || '-'}</td>
                    <td style={{ ...tdCell, maxWidth: 280 }}>
                      <button
                        style={btnOutline}
                        onClick={() => { navigator.clipboard.writeText(r.reply_draft || ''); toast.success('Reply copied'); }}
                      >
                        Copy reply
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </IronCard>
      </div>
    </IronShell>
  );
}
