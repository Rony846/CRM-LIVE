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

// State
let client = null;
let qrCodeData = null;
let connectionState = 'disconnected';
let lastError = null;

// Express app for API
const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Initialize WhatsApp client
function initializeClient() {
    console.log('Initializing WhatsApp client...');
    
    client = new Client({
        authStrategy: new LocalAuth({
            dataPath: SESSION_PATH
        }),
        puppeteer: {
            headless: true,
            executablePath: '/usr/bin/chromium',  // Use system Chromium
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--single-process',
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
        console.log(`Message from ${message.from}: ${message.body}`);
        
        try {
            // Prepare message data
            const messageData = {
                message_id: message.id._serialized,
                from_number: message.from,
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
                headers: { 'Content-Type': 'application/json' }
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
        await axios.post(`${BACKEND_URL}/api/whatsapp/event`, { event, data });
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
        
        if (media) {
            // Send with media
            const mediaObj = new MessageMedia(media.mimetype, media.data, media.filename);
            sentMessage = await client.sendMessage(to, mediaObj, { caption: message });
        } else {
            // Send text only
            sentMessage = await client.sendMessage(to, message);
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
