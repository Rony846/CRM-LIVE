# CRM Skill

**MuscleGrid CRM Integration** - Access your CRM data including inventory, sales, finances, tickets, and more.

## Description

This skill connects to the MuscleGrid CRM system via MCP (Model Context Protocol) server and provides access to:

- **Inventory Management**: Stock levels, low stock alerts, SKU details
- **Finance**: Sales ledger, aging reports, P&L, GST summary, revenue trends
- **Customer Management**: Parties (customers/suppliers), balances, ledger
- **Support**: Tickets, SLA breaches
- **Orders**: Pending orders, dispatches, dealer orders
- **Dashboard**: Overall CRM statistics

## Available Tools

| Tool | Description |
|------|-------------|
| `get_inventory` | Get current stock levels |
| `get_low_stock_items` | Items below threshold |
| `get_sales_ledger` | Sales invoices |
| `get_aging_report` | Receivables/Payables aging |
| `get_revenue_trends` | Monthly revenue analysis |
| `get_profit_loss` | P&L statement |
| `get_gst_summary` | GST for filing |
| `get_dashboard_stats` | Dashboard overview |
| `get_parties` | Customers/Suppliers list |
| `get_party_balance` | Outstanding balance |
| `get_tickets` | Support tickets |
| `get_sla_breaches` | SLA breached tickets |
| `get_dispatches` | Shipments list |
| `get_pending_orders` | Orders awaiting fulfillment |
| `get_dealer_orders` | Dealer orders |
| `get_overdue_payments` | Overdue payment alerts |
| `get_firms` | Warehouses/Firms |
| `get_top_customers` | Top customers by revenue |
| `get_warranties` | Warranty registrations |
| `get_whatsapp_status` | WhatsApp connection status |

## Usage Examples

- "Show me current inventory levels"
- "What items are low on stock?"
- "Get the aging report for receivables"
- "Show me this month's profit and loss"
- "List all open support tickets"
- "What's the GST summary for last month?"

## Configuration

This skill connects to: `https://mcp.musclegrid.in`

No additional configuration required - authentication is handled internally by the MCP server.
