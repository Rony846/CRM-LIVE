import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, useAuth } from '@/App';
import { useNavigate } from 'react-router-dom';

/* A mandatory "you still need to do this training" banner. Checks /me/training and, until the given
   training is completed, shows a prominent prompt that sends the user to the guided walkthrough. */
export function TrainingBanner({ trainingKey = 'ship_desk', label = 'Ship Desk', to = '/ship-desk' }) {
  const { token } = useAuth();
  const nav = useNavigate();
  const [show, setShow] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await axios.get(`${API}/me/training`, { headers: { Authorization: `Bearer ${token}` } });
        if (alive) setShow(!(data && data.training && data.training[trainingKey] && data.training[trainingKey].done));
      } catch (e) { /* ignore */ }
    })();
    return () => { alive = false; };
  }, [token, trainingKey]);

  if (!show) return null;
  return (
    <div style={{ background: 'linear-gradient(90deg,#f97316,#ea580c)', color: '#fff', borderRadius: 10,
      padding: '14px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 12, boxShadow: '0 8px 24px rgba(234,88,12,.30)' }}>
      <div>
        <div style={{ fontWeight: 800, fontSize: 15, fontFamily: 'Barlow, system-ui, sans-serif' }}>⚠️ Required training: {label}</div>
        <div style={{ fontSize: 12.5, opacity: 0.95, marginTop: 2 }}>Please finish the quick guided {label} walkthrough before you start dispatching today — it takes under a minute.</div>
      </div>
      <button onClick={() => nav(to)} style={{ border: 'none', background: '#fff', color: '#ea580c', fontWeight: 800,
        borderRadius: 8, padding: '10px 18px', cursor: 'pointer', whiteSpace: 'nowrap' }}>Start training →</button>
    </div>
  );
}

export default TrainingBanner;
