import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Loader2, ImageOff } from 'lucide-react';

/**
 * <img> for files behind the authenticated /uploads route.
 *
 * A plain <img src> can't send a JWT, so restricted images 401. This fetches
 * the file with the auth header as a blob and renders that. Shows a sized
 * placeholder while loading or on failure.
 */
export default function AuthedImage({ path, token, apiBase, alt = '', className = '' }) {
  const [src, setSrc] = useState(null);
  const [state, setState] = useState('loading'); // loading | ok | error

  useEffect(() => {
    if (!path) { setState('error'); return undefined; }
    let cancelled = false;
    let objUrl = null;
    setState('loading');
    (async () => {
      try {
        const origin = (apiBase || '').replace(/\/api$/, '');
        const url = /^https?:/i.test(path)
          ? path
          : `${origin}${path.startsWith('/') ? '' : '/'}${path}`;
        const resp = await axios.get(url, {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob',
        });
        if (cancelled) return;
        objUrl = URL.createObjectURL(resp.data);
        setSrc(objUrl);
        setState('ok');
      } catch (e) {
        if (!cancelled) setState('error');
      }
    })();
    return () => { cancelled = true; if (objUrl) URL.revokeObjectURL(objUrl); };
  }, [path, token, apiBase]);

  if (state === 'loading') {
    return (
      <div className={`flex items-center justify-center bg-secondary/40 ${className}`}>
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (state === 'error') {
    return (
      <div className={`flex flex-col items-center justify-center gap-1 bg-secondary/40 text-muted-foreground ${className}`}>
        <ImageOff className="w-5 h-5" />
        <span className="text-[10px]">Unavailable</span>
      </div>
    );
  }
  return <img src={src} alt={alt} className={className} />;
}
