# WhatsApp AI Agent - Complete Technical Documentation

## Overview

The WhatsApp AI Agent is a GPT-powered CRM assistant that allows users to control the entire MuscleGrid CRM system through natural WhatsApp conversations. It connects to WhatsApp Web via QR code and processes messages using GPT-4 with tool execution capabilities.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER'S WHATSAPP                          │
└─────────────────────────┬───────────────────────────────────────┘
                          │ (QR Code Link)
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│              WHATSAPP-WEB.JS NODE BRIDGE                        │
│              /app/backend/whatsapp_agent/bridge/index.js        │
│              - Runs on port 3001                                │
│              - Managed by Supervisor                            │
│              - Generates QR codes                               │
│              - Relays messages to Python backend                │
└─────────────────────────┬───────────────────────────────────────┘
                          │ HTTP POST to /api/whatsapp/message
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│              FASTAPI BACKEND (server.py)                        │
│              - Receives incoming messages                       │
│              - Routes to WhatsAppAIBrain                        │
│              - Sends responses back via bridge                  │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│              WHATSAPP AI BRAIN                                  │
│              /app/backend/whatsapp_agent/__init__.py            │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  ConversationContext                                     │   │
│  │  - Stores message history                               │   │
│  │  - Tracks authentication state                          │   │
│  │  - Maintains extracted file data                        │   │
│  │  - Persisted to MongoDB                                 │   │
│  └─────────────────────────────────────────────────────────┘   │
│                          │                                      │
│                          ▼                                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  GPT-4 / GPT-4o (via Emergent LLM Key)                  │   │
│  │  - Natural language understanding                        │   │
│  │  - Tool call generation                                  │   │
│  │  - Response summarization                                │   │
│  └─────────────────────────────────────────────────────────┘   │
│                          │                                      │
│                          ▼                                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  CRMToolRegistry                                         │   │
│  │  - 20+ CRM operations                                    │   │
│  │  - Direct MongoDB access                                 │   │
│  │  - File/document processing                              │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                      MONGODB DATABASE                           │
│  Collections accessed:                                          │
│  - parties (customers/suppliers)                                │
│  - master_skus (products)                                       │
│  - purchases, sales                                             │
│  - amazon_orders, amazon_order_processing                       │
│  - finished_good_serials (inventory)                            │
│  - payments                                                     │
│  - whatsapp_conversations (chat history)                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Authentication

### Secret Code System
- **Code**: `Rony846`
- **Flow**:
  1. User sends any message → Bot asks for access code
  2. User sends `Rony846` → Bot grants access
  3. Authentication state saved to MongoDB
  4. Future sessions auto-authenticate (persisted)

### Security Features
- Authentication required before any CRM access
- Session-based (tied to phone number)
- No password/OTP - single secret code for authorized users

---

## Conversation Memory

### How It Works
1. **On Message Received**:
   - Load conversation from MongoDB (`whatsapp_conversations` collection)
   - Restore: messages array, auth state, extracted data, current task

2. **Context Priming**:
   - Last 15 messages sent to GPT as conversation history
   - Allows follow-up questions ("What did I just ask?")

3. **On Response**:
   - User message + AI response saved to context
   - Full context persisted to MongoDB
   - Keeps last 50 messages (auto-truncates older)

### Database Schema
```javascript
{
  "user_number": "919876543210",
  "messages": [
    {"role": "user", "content": "...", "timestamp": "..."},
    {"role": "assistant", "content": "...", "timestamp": "..."},
    {"role": "system", "content": "[Tool result]", "timestamp": "..."}
  ],
  "is_authenticated": true,
  "current_task": "Creating purchase entry",
  "pending_questions": ["TDS applicable?"],
  "extracted_data": { /* from file analysis */ },
  "last_activity": "2026-04-29T14:00:00Z"
}
```

---

## Tool Execution Loop

### How GPT Calls Tools
1. GPT generates response with special syntax:
   ```
   TOOL_CALL: search_party
   PARAMETERS: {"query": "Sharma"}
   END_TOOL
   ```

2. Bot parses and executes the tool
3. Tool result appended to context
4. GPT called again to summarize results in natural language
5. Final human-friendly response sent to user

### Max Iterations
- `MAX_TOOL_ITERATIONS = 3` prevents infinite loops
- Chained tool calls supported (e.g., search → create → update)

---

## Available Tools (CRM Operations)

### Party/Ledger Management

| Tool | Description | Parameters |
|------|-------------|------------|
| `search_party` | Search customers/suppliers by name, phone, GST | `query`, `party_type` |
| `create_party` | Create new customer or supplier | `name`, `party_type`, `phone`, `email`, `gst_number`, `address`, `tds_applicable` |
| `get_party_details` | Get full party info with balance | `party_id` |
| `get_ledger_balance` | Get current balance for a party | `party_id` |
| `record_payment` | Record payment received/made | `party_id`, `amount`, `payment_type`, `payment_mode`, `reference` |
| `get_outstanding_payments` | Get receivables or payables | `type` (receivable/payable) |

### Product/Inventory Management

| Tool | Description | Parameters |
|------|-------------|------------|
| `search_product` | Search products by name or SKU | `query` |
| `create_product` | Create new product/SKU | `name`, `sku`, `category`, `unit`, `purchase_price`, `sale_price` |
| `get_product_stock` | Get current stock of product | `product_id` |
| `get_low_stock_items` | Get items below threshold | `threshold` (default: 10) |

### Purchase Management

| Tool | Description | Parameters |
|------|-------------|------------|
| `create_purchase` | Create purchase entry | `supplier_id` OR `supplier_name`, `invoice_number`, `invoice_date`, `items`, `total_amount`, `gst_amount` |
| `get_recent_purchases` | Get recent purchase entries | `limit` |

**Smart Feature**: If `supplier_name` is passed instead of `supplier_id`, the system automatically:
1. Searches for existing supplier
2. Creates new supplier if not found
3. Links to purchase entry

### Sales Management

| Tool | Description | Parameters |
|------|-------------|------------|
| `create_sale` | Create sale entry | `customer_id` OR `customer_name`, `items`, `total_amount` |
| `get_recent_sales` | Get recent sales | `limit` |

### Amazon/E-commerce Orders

| Tool | Description | Parameters |
|------|-------------|------------|
| `get_pending_orders` | Get pending/unshipped Amazon orders | - |
| `process_amazon_orders` | Trigger browser agent processing | `count` |

### Reports & Analytics

| Tool | Description | Parameters |
|------|-------------|------------|
| `get_daily_summary` | Today's sales, purchases, orders | - |

### Document Processing

| Tool | Description | Parameters |
|------|-------------|------------|
| `extract_invoice_data` | Extract data from invoice PDF/image | `file_data` (base64), `file_type` |
| `analyze_document` | Analyze any document (manual, contract) | `file_data` (base64), `file_type` |

---

## Document Processing (GPT-4 Vision)

### Supported Formats
- **PDF**: Multi-page support (up to 10 pages)
- **Images**: JPEG, PNG, WEBP
- **Auto-detection**: Determines file type from content

### Processing Pipeline
1. **PDF**: Convert pages to images at 150 DPI using PyMuPDF
2. **Image**: Resize if >2000px, convert to JPEG
3. **Vision API**: Send to GPT-4o for analysis
4. **Multi-page**: Each page analyzed, data aggregated

### Extraction Capabilities

#### Invoices/Bills
```json
{
  "document_type": "invoice",
  "supplier_name": "ABC Trading",
  "supplier_gst": "27AABCU9603R1ZM",
  "invoice_number": "INV-2024-001",
  "invoice_date": "15-12-2024",
  "items": [
    {"name": "Product A", "quantity": 10, "rate": 500, "amount": 5000}
  ],
  "subtotal": 5000,
  "cgst": 450,
  "sgst": 450,
  "total_amount": 5900
}
```

#### User Manuals
```json
{
  "document_type": "manual",
  "product_name": "XYZ Inverter 5000",
  "model_number": "XYZ-INV-5000",
  "manufacturer": "PowerTech Industries",
  "specifications": {"power": "5000VA", "input": "12V DC"},
  "key_features": ["Pure Sine Wave", "LCD Display"],
  "installation_steps": ["Mount on wall", "Connect battery"],
  "safety_warnings": ["Keep away from water"],
  "warranty_info": "2 years"
}
```

### Dependencies
- `PyMuPDF` (fitz) - PDF to image conversion
- `Pillow` - Image processing
- `emergentintegrations` - GPT-4 Vision API

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/whatsapp/status` | GET | Get connection status |
| `/api/whatsapp/qr` | GET | Get QR code for linking |
| `/api/whatsapp/message` | POST | Webhook for incoming messages |
| `/api/whatsapp/send` | POST | Send message to a number |
| `/api/whatsapp/conversations` | GET | Get recent conversations |

---

## Error Handling

### Budget Exceeded
When Emergent LLM key budget is exceeded:
```
⚠️ *AI Service Temporarily Unavailable*

The AI assistant's usage budget has been reached. 
Please contact your admin to top up the balance.

👉 Go to Profile → Universal Key → Add Balance
```

### Rate Limiting
```
⏳ I'm getting a lot of requests right now! Please wait a moment and try again.
```

### General Errors
```
Sorry, I encountered an issue. Please try again or rephrase your request.
```

---

## Database Collections Accessed

| Collection | Access Level | Operations |
|------------|--------------|------------|
| `parties` | Read/Write | Search, Create, Update balance |
| `master_skus` | Read/Write | Search, Create, Stock check |
| `purchases` | Read/Write | Create, List recent |
| `sales` | Read/Write | Create, List recent |
| `payments` | Read/Write | Create payment records |
| `amazon_orders` | Read | Get pending orders |
| `amazon_order_processing` | Read | Get processed count |
| `finished_good_serials` | Read | Stock queries |
| `whatsapp_conversations` | Read/Write | Conversation persistence |

---

## Configuration

### Environment Variables
```bash
EMERGENT_LLM_KEY=sk-emergent-xxxxx  # Universal LLM key
MONGO_URL=mongodb://...             # Database connection
DB_NAME=crm_db                      # Database name
```

### Supervisor Service
```ini
[program:whatsapp-bridge]
command=node /app/backend/whatsapp_agent/bridge/index.js
directory=/app/backend/whatsapp_agent/bridge
autostart=true
autorestart=true
```

---

## File Structure

```
/app/backend/whatsapp_agent/
├── __init__.py                 # Main Python module
│   ├── WhatsAppMessage         # Message dataclass
│   ├── ConversationContext     # Context management
│   ├── CRMToolRegistry         # Tool definitions & implementations
│   └── WhatsAppAIBrain         # AI processing logic
│
└── bridge/
    ├── index.js                # Node.js WhatsApp Web bridge
    ├── package.json            # Node dependencies
    └── .wwebjs_auth/           # WhatsApp session data
```

---

## Example Conversations

### Creating a Purchase from Invoice
```
User: [sends invoice PDF]
Bot: 📄 Analyzing your document with AI Vision...

I've extracted the invoice details:
• Supplier: Bluesun Electronics System
• Invoice #: BS/13/26-27
• Date: 29-04-2026
• Items: 4 products
• Total: ₹5,75,840

I couldn't find this supplier in your records. Should I:
1. Create a new supplier?
2. Link to an existing one?

User: Create new supplier
Bot: ✅ Created supplier "Bluesun Electronics System"
✅ Purchase entry created with 4 items

Would you like me to:
1. Check stock for these items?
2. Create a payment record?
```

### Checking Daily Summary
```
User: Show me today's summary
Bot: 📊 Here's your business summary for today:

• Sales: 12 entries
• Purchases: 5 entries  
• Amazon Orders Processed: 23

Would you like details on any of these?
```

### Searching for a Customer
```
User: Find customer Sharma
Bot: 🔍 Found 3 customers matching "Sharma":

1. Rahul Sharma - 9876543210 - Balance: ₹15,000
2. Priya Sharma - 9123456789 - Balance: ₹0
3. Sharma Traders - GST: 27AABCS1234R1ZM

Which one would you like to know more about?
```

---

## Limitations

1. **No Real-time Notifications**: Cannot push updates (polling required)
2. **Session Dependency**: Requires phone to stay connected
3. **Rate Limits**: Emergent LLM key has usage limits
4. **File Size**: Large PDFs may timeout (max 10 pages processed)
5. **No Voice Messages**: Text-only (voice transcription not implemented)

---

## Security Considerations

1. **Authentication**: Single secret code - consider implementing OTP
2. **Data Access**: Full CRM read/write - no role-based restrictions via WhatsApp
3. **Audit Trail**: No logging of who made what changes via WhatsApp
4. **Session Hijacking**: If someone gets the QR code, they have full access

---

## Future Enhancements (Suggestions)

1. **Voice Message Support**: Integrate OpenAI Whisper for transcription
2. **Role-Based Access**: Different capabilities for different users
3. **Audit Logging**: Track all CRM changes made via WhatsApp
4. **Multi-Language**: Support Hindi and regional languages
5. **Scheduled Reports**: Daily/weekly summaries sent automatically
6. **Payment Reminders**: Auto-remind customers about outstanding dues
7. **Order Status Updates**: Notify customers when orders ship
8. **Barcode/QR Scanning**: Scan product barcodes via camera

---

## Troubleshooting

### "Sorry, I encountered an issue"
1. Check backend logs: `tail -f /var/log/supervisor/backend.err.log`
2. Common causes:
   - Budget exceeded (top up Emergent key)
   - MongoDB connection issue
   - Tool parameter mismatch

### QR Code Not Showing
1. Check bridge status: `sudo supervisorctl status whatsapp-bridge`
2. Restart bridge: `sudo supervisorctl restart whatsapp-bridge`
3. Check logs: `tail -f /var/log/supervisor/whatsapp-bridge.err.log`

### Bot Not Responding
1. Check if authenticated (send secret code again)
2. Verify bridge is connected to WhatsApp Web
3. Check backend is running: `sudo supervisorctl status backend`

---

*Document generated: April 29, 2026*
*Version: 1.0*
