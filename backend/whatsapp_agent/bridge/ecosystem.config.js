/**
 * pm2 ecosystem config for the MuscleGrid CRM WhatsApp bridge.
 *
 * Port 3011 is chosen because 3001 is already taken by mg-shipper's separate
 * wa-bot — we mustn't collide with that service.
 *
 * The bridge talks to the backend over localhost using the shared
 * WHATSAPP_BRIDGE_SECRET (set in backend/.env). Don't put the secret here —
 * pm2 reads env from process at start, so export it in the start command,
 * or set it via `pm2 set` once and reload.
 */
module.exports = {
  apps: [
    {
      name: 'crm-wa-bridge',
      cwd: '/var/www/crm/backend/whatsapp_agent/bridge',
      script: 'index.js',
      interpreter: 'node',
      autorestart: true,
      max_restarts: 20,
      min_uptime: '30s',
      restart_delay: 5000,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        WHATSAPP_BRIDGE_PORT: '3011',
        BACKEND_URL: 'http://127.0.0.1:8001',
        // WHATSAPP_BRIDGE_SECRET is sourced from backend/.env via a wrapper —
        // see start command in README. If empty, /api/whatsapp/message will 401.
        PUPPETEER_EXECUTABLE_PATH: '/root/.cache/puppeteer/chrome/linux-146.0.7680.31/chrome-linux64/chrome',
      },
      out_file: '/root/.pm2/logs/crm-wa-bridge-out.log',
      error_file: '/root/.pm2/logs/crm-wa-bridge-error.log',
      merge_logs: true,
      time: true,
    },
  ],
};
