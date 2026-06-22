/**
 * WhatsApp Web Bridge
 * 
 * Connects to WhatsApp Web, shows QR code, and relays messages
 * to the Python backend for AI processing.
 */

const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8001';
const PORT = process.env.WHATSAPP_BRIDGE_PORT || 3001;
const SESSION_PATH = path.join(__dirname, '.wwebjs_auth');
// Shared secret with the backend — set on /var/www/crm/backend/.env as
// WHATSAPP_BRIDGE_SECRET. The backend rejects /api/whatsapp/* without it.
const BRIDGE_SECRET = process.env.WHATSAPP_BRIDGE_SECRET || '';
const BRIDGE_HEADERS = BRIDGE_SECRET
    ? { 'Content-Type': 'application/json', 'X-Bridge-Secret': BRIDGE_SECRET }
    : { 'Content-Type': 'application/json' };

// Whitelist of WhatsApp senders allowed to chat with the agent. Comma-separated
// digits (no +, no spaces, country-code prefixed). Anyone else is dropped
// SILENTLY by this bridge — no reply, no backend call, no token spend.
// Empty string = NO ONE allowed (paranoid default).
const ALLOWLIST_RAW = process.env.WHATSAPP_AGENT_ALLOWLIST || '';
const ALLOWLIST = new Set(
    ALLOWLIST_RAW.split(',').map(s => s.replace(/\D/g, '')).filter(s => s.length >= 10)
);
console.log(`[whitelist] ${ALLOWLIST.size} sender(s) allowed to REPLY: ${[...ALLOWLIST].map(s => s.slice(0,5)+'…').join(', ')}`);
// Observe-all: when true, forward EVERY message to the backend so Pratibha reads/logs all chatter,
// but the backend only returns a reply for allowlisted senders (so we still reply to those two only).
const OBSERVE_ALL = String(process.env.WHATSAPP_OBSERVE_ALL || '').toLowerCase() === 'true';
console.log(`[observe-all] ${OBSERVE_ALL ? 'ON — reads everyone, replies only to allowlist' : 'OFF — non-allowlisted dropped'}`);

/** Normalise a WhatsApp `from` (e.g. `919560377363@c.us`, `12345@lid`)
 *  to the digits-only form used in the allowlist. Returns '' if unknown. */
function senderDigits(from) {
    if (!from) return '';
    const id = String(from).split('@')[0];
    return id.replace(/\D/g, '');
}

/** Resolve the *real* phone number behind a WhatsApp ID by asking the message
 *  for its contact. Works around the `@lid` issue: when the agent phone hasn't
 *  saved the sender as a contact, WhatsApp delivers the message as
 *  `<hash>@lid` instead of `<phone>@c.us`. The contact object still has the
 *  actual number. Returns digits or null. */
async function resolvePhone(message) {
    try {
        const contact = await message.getContact();
        if (contact && contact.number) {
            return String(contact.number).replace(/\D/g, '');
        }
    } catch (e) {
        // contact lookup can fail for broadcasts / status updates
    }
    return null;
}

/** Allowlist check — accepts either:
 *   - the raw `from` digits (matches when sender's number is saved)
 *   - the resolved contact number (matches even for `@lid` strangers)
 *
 *  Returns { allowed: bool, resolved: string|null } so callers can log the
 *  actual phone they matched against. */
async function checkAllowed(message) {
    if ((message.from || '').includes('@broadcast')) {
        return { allowed: false, resolved: null, isGroup: false };
    }
    const isGroup = (message.from || '').includes('@g.us');
    // In a GROUP the actual sender is message.author (a participant); in a DM it's message.from.
    const principal = isGroup ? (message.author || '') : message.from;
    const raw = senderDigits(principal);
    if (raw && ALLOWLIST.has(raw)) {
        return { allowed: true, resolved: raw, isGroup };
    }
    // Resolve the sender's real number via their contact (covers @lid, in groups too).
    const resolved = await resolvePhone(message);
    if (resolved && ALLOWLIST.has(resolved)) {
        return { allowed: true, resolved, isGroup };
    }
    return { allowed: false, resolved, isGroup };
}

// State
let client = null;
let qrCodeData = null;
let connectionState = 'disconnected';
let lastError = null;

/** Map the canonical id the backend uses (e.g. `192157440847938@c.us` or bare digits)
 *  to the EXACT chat id WhatsApp delivered the message on (often `<hash>@lid`).
 *  Sending to a fabricated `@c.us` for an @lid contact throws "No LID for user";
 *  reusing the real delivered chat id is the only reliable way to message them back.
 *  Persisted to disk so it survives bridge restarts. */
const CHATMAP_PATH = path.join(SESSION_PATH, 'chat-id-map.json');
const chatIdMap = new Map();
try {
    const saved = JSON.parse(fs.readFileSync(CHATMAP_PATH, 'utf8'));
    for (const [k, v] of Object.entries(saved)) chatIdMap.set(k, v);
    console.log(`Loaded ${chatIdMap.size} chat-id mappings`);
} catch (e) { /* first run / no file yet */ }

function rememberChatId(canonical, chatId) {
    if (!chatId) return;
    const digits = String(chatId).split('@')[0].replace(/\D/g, '');
    let changed = false;
    for (const key of [chatId, canonical, digits, digits ? digits + '@c.us' : null]) {
        if (key && chatIdMap.get(key) !== chatId) { chatIdMap.set(key, chatId); changed = true; }
    }
    if (changed) {
        try { fs.writeFileSync(CHATMAP_PATH, JSON.stringify(Object.fromEntries(chatIdMap))); } catch (e) {}
    }
}

/** Resolve whatever the backend passes as `to` to the real delivered chat id when we know it. */
function resolveChatId(to) {
    if (!to) return to;
    if (chatIdMap.has(to)) return chatIdMap.get(to);
    const digits = String(to).split('@')[0].replace(/\D/g, '');
    if (digits && chatIdMap.has(digits)) return chatIdMap.get(digits);
    if (digits && chatIdMap.has(digits + '@c.us')) return chatIdMap.get(digits + '@c.us');
    return to;
}

// Express app for API
const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Initialize WhatsApp client
function initializeClient() {
    console.log('Initializing WhatsApp client...');
    
    // Resolve a Chromium binary: env override > puppeteer-bundled > system.
    // Puppeteer auto-downloads Chromium to ~/.cache/puppeteer on `npm install`,
    // so leaving executablePath undefined lets Puppeteer pick the right one.
    const PUPPETEER_EXECUTABLE = process.env.PUPPETEER_EXECUTABLE_PATH || undefined;
    // Pin a stable WhatsApp Web build. Without this, the lib falls back to whatever WA serves
    // "latest", and a newer-than-the-library build leaves it stuck at `authenticated` (ready never
    // fires). This version is close to what whatsapp-web.js 1.34.7 targets. Override via env if needed.
    const WA_WEB_VERSION = process.env.WA_WEB_VERSION || '2.3000.1036439757-alpha';
    client = new Client({
        authStrategy: new LocalAuth({
            dataPath: SESSION_PATH
        }),
        webVersionCache: {
            type: 'remote',
            remotePath: `https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/${WA_WEB_VERSION}.html`,
        },
        puppeteer: {
            headless: true,
            ...(PUPPETEER_EXECUTABLE ? { executablePath: PUPPETEER_EXECUTABLE } : {}),
            args: [
                // `--single-process` is known to cause whatsapp-web.js to get
                // stuck at `authenticated` (never firing `ready`). Avoid it.
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--disable-gpu'
            ]
        }
    });

    // QR Code event
    client.on('qr', (qr) => {
        console.log('QR Code received');
        qrCodeData = qr;
        connectionState = 'qr_ready';
        
        // Also show in terminal for debugging
        qrcode.generate(qr, { small: true });
    });

    // Ready event
    client.on('ready', () => {
        console.log('WhatsApp client is ready!');
        connectionState = 'connected';
        qrCodeData = null;
        
        // Notify backend
        notifyBackend('ready', { status: 'connected' });
    });

    // Authentication success
    client.on('authenticated', () => {
        console.log('WhatsApp authenticated');
        connectionState = 'authenticated';
    });

    // Authentication failure
    client.on('auth_failure', (msg) => {
        console.error('WhatsApp auth failure:', msg);
        connectionState = 'auth_failed';
        lastError = msg;
    });

    // Disconnected
    client.on('disconnected', (reason) => {
        console.log('WhatsApp disconnected:', reason);
        connectionState = 'disconnected';
        lastError = reason;
        
        // Try to reconnect after delay
        setTimeout(() => {
            if (connectionState === 'disconnected') {
                console.log('Attempting to reconnect...');
                client.initialize();
            }
        }, 5000);
    });

    // Message received
    client.on('message', async (message) => {
        // ===== WHITELIST GATE =====
        // Silently drop anything not from an allowlisted sender. No reply, no
        // backend call, no DB write, no token spend. Crucially, this also
        // resolves `@lid` anonymous IDs to real phone numbers so the agent
        // works with strangers / unsaved contacts.
        const { allowed, resolved, isGroup } = await checkAllowed(message);
        if (!allowed) {
            if (!OBSERVE_ALL) {
                console.log(`[whitelist] drop: ${message.from}${resolved ? ` (resolved=${resolved})` : ''}`);
                return;
            }
            // Observe-all: forward for reading/logging, but the backend won't return a reply for a
            // non-allowlisted sender, so we never message them back.
            console.log(`[observe] read-only (non-allowlisted): ${message.from}`);
        }
        // The PRINCIPAL is who actually spoke: the group participant (message.author) in a group,
        // else the DM contact. `resolvedFrom` is their canonical id for the backend allowlist/state.
        const principal = isGroup ? (message.author || message.from) : message.from;
        const resolvedFrom = (resolved || senderDigits(principal)) + '@c.us';
        // Remember the chat id to reply on. For a group that's the group JID itself.
        if (!isGroup) rememberChatId(resolvedFrom, message.from);
        console.log(`Message from ${message.from}${isGroup ? ` (group, author ${principal})` : ''} (resolved=${resolvedFrom}): ${message.body}`);

        try {
            // Prepare message data
            const messageData = {
                message_id: message.id._serialized,
                from_number: resolvedFrom,
                from_raw: message.from,  // preserved for audit
                chat_id: message.from,           // group JID or DM id — where a reply goes
                author: message.author || null,  // group participant who spoke (null for DMs)
                is_group: isGroup,
                text: message.body,
                timestamp: new Date(message.timestamp * 1000).toISOString(),
                has_media: message.hasMedia,
                quoted_message: message.hasQuotedMsg ? (await message.getQuotedMessage())?.body : null
            };

            // Handle media
            if (message.hasMedia) {
                try {
                    const media = await message.downloadMedia();
                    if (media) {
                        messageData.media_type = media.mimetype.split('/')[0]; // image, document, audio, video
                        messageData.media_data = media.data; // Base64
                        messageData.media_mimetype = media.mimetype;
                    }
                } catch (mediaError) {
                    console.error('Error downloading media:', mediaError);
                }
            }

            // Send to backend for AI processing
            const response = await axios.post(`${BACKEND_URL}/api/whatsapp/message`, messageData, {
                timeout: 120000, // 2 minute timeout for AI processing
                headers: BRIDGE_HEADERS
            });

            // Send reply if backend provides one
            if (response.data && response.data.reply) {
                await client.sendMessage(message.from, response.data.reply);
                console.log(`Reply sent to ${message.from}`);
            }

        } catch (error) {
            console.error('Error processing message:', error.message);
            
            // Send error message to user
            try {
                await client.sendMessage(
                    message.from, 
                    '⚠️ Sorry, I encountered an error processing your message. Please try again.'
                );
            } catch (sendError) {
                console.error('Error sending error message:', sendError);
            }
        }
    });

    // Start the client
    client.initialize();
}

// Notify backend of events
async function notifyBackend(event, data) {
    try {
        await axios.post(`${BACKEND_URL}/api/whatsapp/event`, { event, data }, {
            headers: BRIDGE_HEADERS,
        });
    } catch (error) {
        console.error('Error notifying backend:', error.message);
    }
}

// ==================== API Endpoints ====================

// Get status
app.get('/status', (req, res) => {
    res.json({
        state: connectionState,
        qr_available: qrCodeData !== null,
        error: lastError
    });
});

// Get QR code
app.get('/qr', (req, res) => {
    if (qrCodeData) {
        res.json({ qr: qrCodeData });
    } else if (connectionState === 'connected') {
        res.json({ message: 'Already connected', state: connectionState });
    } else {
        res.json({ message: 'QR code not yet available', state: connectionState });
    }
});

// Send message (from backend)
app.post('/send', async (req, res) => {
    try {
        const { to, message, media } = req.body;
        
        if (!client || connectionState !== 'connected') {
            return res.status(503).json({ error: 'WhatsApp not connected' });
        }

        let sentMessage;
        const target = resolveChatId(to);  // use the real delivered chat id for @lid contacts

        if (media) {
            // Send with media
            const mediaObj = new MessageMedia(media.mimetype, media.data, media.filename);
            sentMessage = await client.sendMessage(target, mediaObj, { caption: message });
        } else {
            // Send text only
            sentMessage = await client.sendMessage(target, message);
        }

        res.json({ 
            success: true, 
            message_id: sentMessage.id._serialized 
        });

    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ error: error.message });
    }
});

// Restart client
app.post('/restart', async (req, res) => {
    try {
        if (client) {
            await client.destroy();
        }
        connectionState = 'disconnected';
        qrCodeData = null;
        
        setTimeout(() => {
            initializeClient();
        }, 1000);
        
        res.json({ success: true, message: 'Restarting WhatsApp client' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Logout and clear session
app.post('/logout', async (req, res) => {
    try {
        if (client) {
            await client.logout();
            await client.destroy();
        }
        
        // Clear session data
        if (fs.existsSync(SESSION_PATH)) {
            fs.rmSync(SESSION_PATH, { recursive: true, force: true });
        }
        
        connectionState = 'disconnected';
        qrCodeData = null;
        
        setTimeout(() => {
            initializeClient();
        }, 2000);
        
        res.json({ success: true, message: 'Logged out and session cleared' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`WhatsApp Bridge running on port ${PORT}`);
    console.log(`Backend URL: ${BACKEND_URL}`);
    
    // Initialize WhatsApp client
    initializeClient();
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('Shutting down...');
    if (client) {
        await client.destroy();
    }
    process.exit(0);
});
