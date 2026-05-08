# MuscleGrid CRM - MCP Server

Model Context Protocol (MCP) server that exposes your CRM functionality as tools for AI agents.

## Quick Start

### 1. Install Dependencies
```bash
cd /app/mcp-server
pip install -r requirements.txt
```

### 2. Configure Environment
Edit `.env` file:
```env
CRM_BASE_URL=https://newcrm.musclegrid.in
CRM_EMAIL=admin@musclegrid.in
CRM_PASSWORD=YOUR_PASSWORD
MCP_PORT=8002
```

### 3. Run Server
```bash
python server.py
```

Server will be available at `http://localhost:8002`

---

## Deployment

### Deploy to Your Server

1. Copy the `/app/mcp-server` folder to your server
2. Set up a reverse proxy (nginx) to expose it at `https://mcp.musclegrid.in`
3. Configure SSL certificate
4. Run with systemd or PM2

**Nginx Example:**
```nginx
server {
    listen 443 ssl;
    server_name mcp.musclegrid.in;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:8002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

---

## API Usage

### Method 1: REST API (Simple)

**List Available Tools:**
```bash
curl https://mcp.musclegrid.in/mcp/tools
```

**Execute a Tool:**
```bash
curl -X POST https://mcp.musclegrid.in/mcp/execute \
  -H "Content-Type: application/json" \
  -d '{
    "tool_name": "get_inventory",
    "arguments": {}
  }'
```

**Get Low Stock Items:**
```bash
curl -X POST https://mcp.musclegrid.in/mcp/execute \
  -H "Content-Type: application/json" \
  -d '{
    "tool_name": "get_low_stock_items",
    "arguments": {"threshold": 5}
  }'
```

### Method 2: MCP JSON-RPC Protocol

**Initialize Connection:**
```bash
curl -X POST https://mcp.musclegrid.in/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {}
  }'
```

**List Tools:**
```bash
curl -X POST https://mcp.musclegrid.in/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/list"
  }'
```

**Call a Tool:**
```bash
curl -X POST https://mcp.musclegrid.in/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "get_inventory",
      "arguments": {}
    }
  }'
```

### Method 3: Convenience Endpoints

Direct REST endpoints that bypass tool execution:

| Endpoint | Description |
|----------|-------------|
| `GET /inventory` | Get all stock |
| `GET /inventory/low-stock?threshold=10` | Get low stock items |
| `GET /dashboard` | Dashboard statistics |
| `GET /tickets?status=new_request` | Support tickets |
| `GET /parties?party_type=customer` | Customers/Suppliers |
| `GET /dispatches?status=pending` | Order dispatches |

---

## Available Tools (32 Total)

### Inventory (4 tools)
| Tool | Description |
|------|-------------|
| `get_inventory` | Get current stock levels |
| `get_low_stock_items` | Items below threshold |
| `get_sku_details` | SKU/product details |
| `transfer_stock` | Transfer between warehouses |

### Finance (7 tools)
| Tool | Description |
|------|-------------|
| `get_sales_ledger` | Sales invoices |
| `get_party_balance` | Customer/supplier balance |
| `get_aging_report` | Receivables/Payables aging |
| `get_revenue_trends` | Monthly revenue charts |
| `get_profit_loss` | P&L statement |
| `get_gst_summary` | GST for filing |
| `record_payment` | Record payment |

### Orders & Dispatch (4 tools)
| Tool | Description |
|------|-------------|
| `get_pending_orders` | Orders awaiting fulfillment |
| `create_dispatch` | Create shipment |
| `get_dispatches` | List dispatches |
| `update_dispatch_status` | Update shipping status |

### Support (3 tools)
| Tool | Description |
|------|-------------|
| `get_tickets` | Support tickets |
| `create_ticket` | Create ticket |
| `get_sla_breaches` | SLA breached tickets |

### Dealers (3 tools)
| Tool | Description |
|------|-------------|
| `get_dealer_orders` | All dealer orders |
| `approve_dealer_order` | Approve order |
| `get_overdue_payments` | Overdue verifications |

### Customers/Suppliers (3 tools)
| Tool | Description |
|------|-------------|
| `get_parties` | List parties |
| `create_party` | Create party |
| `get_party_ledger` | Transaction history |

### Admin (3 tools)
| Tool | Description |
|------|-------------|
| `get_dashboard_stats` | Dashboard overview |
| `get_firms` | List warehouses |
| `get_top_customers` | Top customers by revenue |

### Warranty (2 tools)
| Tool | Description |
|------|-------------|
| `get_warranties` | List warranties |
| `register_warranty` | Register warranty |

### E-commerce (1 tool)
| Tool | Description |
|------|-------------|
| `get_amazon_orders` | Scraped Amazon orders |

### WhatsApp (2 tools)
| Tool | Description |
|------|-------------|
| `send_whatsapp_message` | Send message |
| `get_whatsapp_status` | Connection status |

---

## Connecting to AI Agents

### Claude (Anthropic)

Add to your MCP configuration:
```json
{
  "mcpServers": {
    "musclegrid-crm": {
      "url": "https://mcp.musclegrid.in/mcp",
      "transport": "http"
    }
  }
}
```

### Custom AI Agent

```python
import httpx

MCP_URL = "https://mcp.musclegrid.in"

async def call_crm_tool(tool_name: str, arguments: dict):
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{MCP_URL}/mcp/execute",
            json={"tool_name": tool_name, "arguments": arguments}
        )
        return response.json()

# Example: Get low stock items
result = await call_crm_tool("get_low_stock_items", {"threshold": 5})
print(result)
```

---

## Security Notes

- The MCP server handles authentication internally - no CRM credentials needed by AI agents
- Token caching prevents excessive login calls
- Consider adding API key authentication for production:

```python
# Add to server.py
API_KEY = os.environ.get("MCP_API_KEY")

@app.middleware("http")
async def verify_api_key(request: Request, call_next):
    if request.url.path not in ["/", "/health"]:
        key = request.headers.get("X-API-Key")
        if key != API_KEY:
            return JSONResponse(status_code=401, content={"error": "Invalid API key"})
    return await call_next(request)
```

---

## Support

For issues with:
- **MCP Server**: Check logs, verify CRM connectivity
- **CRM API**: Access Swagger docs at `https://newcrm.musclegrid.in/api/docs`
- **Tools not working**: Ensure CRM credentials are valid

---

*Last Updated: April 2025*
