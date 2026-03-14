import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { API, useAuth } from '@/App';
import DashboardLayout from '@/components/layout/DashboardLayout';
import StatusBadge from '@/components/ui/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { 
  ArrowLeft, Loader2, User, Phone, Mail, MapPin, Package,
  FileText, Clock, CheckCircle, AlertTriangle, Wrench,
  Truck, Calendar, History, MessageSquare
} from 'lucide-react';

const TimelineItem = ({ entry, isLast }) => {
  const getIcon = (action) => {
    const actionLower = action.toLowerCase();
    if (actionLower.includes('created')) return <Package className="w-4 h-4" />;
    if (actionLower.includes('escalat')) return <AlertTriangle className="w-4 h-4" />;
    if (actionLower.includes('supervisor')) return <User className="w-4 h-4" />;
    if (actionLower.includes('repair')) return <Wrench className="w-4 h-4" />;
    if (actionLower.includes('dispatch')) return <Truck className="w-4 h-4" />;
    if (actionLower.includes('label')) return <FileText className="w-4 h-4" />;
    if (actionLower.includes('received')) return <Package className="w-4 h-4" />;
    if (actionLower.includes('status')) return <Clock className="w-4 h-4" />;
    return <History className="w-4 h-4" />;
  };

  const getColor = (action) => {
    const actionLower = action.toLowerCase();
    if (actionLower.includes('created')) return 'bg-blue-500';
    if (actionLower.includes('escalat')) return 'bg-orange-500';
    if (actionLower.includes('supervisor')) return 'bg-purple-500';
    if (actionLower.includes('repair')) return 'bg-yellow-500';
    if (actionLower.includes('completed')) return 'bg-green-500';
    if (actionLower.includes('dispatch')) return 'bg-cyan-500';
    if (actionLower.includes('closed') || actionLower.includes('resolved')) return 'bg-green-600';
    return 'bg-slate-500';
  };

  return (
    <div className="flex gap-4">
      {/* Timeline dot and line */}
      <div className="flex flex-col items-center">
        <div className={`w-8 h-8 rounded-full ${getColor(entry.action)} flex items-center justify-center text-white`}>
          {getIcon(entry.action)}
        </div>
        {!isLast && <div className="w-0.5 h-full bg-slate-300 my-1" />}
      </div>
      
      {/* Content */}
      <div className="flex-1 pb-6">
        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
          <div className="flex items-start justify-between mb-2">
            <h4 className="font-semibold text-slate-800">{entry.action}</h4>
            <span className="text-xs text-slate-500 whitespace-nowrap ml-2">
              {new Date(entry.timestamp).toLocaleString()}
            </span>
          </div>
          
          <div className="text-sm text-slate-600 space-y-1">
            <p>
              <span className="font-medium">By:</span> {entry.by}
              <span className="text-slate-400 ml-2">({entry.by_role})</span>
            </p>
            
            {entry.details && Object.keys(entry.details).length > 0 && (
              <div className="mt-2 bg-white rounded p-2 border border-slate-100">
                {entry.details.notes && (
                  <p className="text-slate-700">
                    <span className="font-medium">Notes:</span> {entry.details.notes}
                  </p>
                )}
                {entry.details.old_status && entry.details.new_status && (
                  <p>
                    <span className="font-medium">Status:</span>{' '}
                    <span className="text-red-600">{entry.details.old_status}</span>
                    {' → '}
                    <span className="text-green-600">{entry.details.new_status}</span>
                  </p>
                )}
                {entry.details.repair_notes && (
                  <p><span className="font-medium">Repair Notes:</span> {entry.details.repair_notes}</p>
                )}
                {entry.details.courier && (
                  <p><span className="font-medium">Courier:</span> {entry.details.courier}</p>
                )}
                {entry.details.tracking_id && (
                  <p><span className="font-medium">Tracking:</span> {entry.details.tracking_id}</p>
                )}
                {entry.details.charges && (
                  <p><span className="font-medium">Service Charges:</span> ₹{entry.details.charges}</p>
                )}
                {entry.details.sku && (
                  <p><span className="font-medium">SKU:</span> {entry.details.sku}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default function AdminTicketDetail() {
  const { ticketId } = useParams();
  const { token } = useAuth();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTicket();
  }, [ticketId, token]);

  const fetchTicket = async () => {
    try {
      const response = await axios.get(`${API}/tickets/${ticketId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTicket(response.data);
    } catch (error) {
      toast.error('Failed to load ticket details');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Ticket Details">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
        </div>
      </DashboardLayout>
    );
  }

  if (!ticket) {
    return (
      <DashboardLayout title="Ticket Details">
        <div className="text-center py-12">
          <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-red-400" />
          <p className="text-slate-400">Ticket not found</p>
          <Link to="/admin/tickets">
            <Button className="mt-4" variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Tickets
            </Button>
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title={`Ticket ${ticket.ticket_number}`}>
      {/* Back Button */}
      <div className="mb-4">
        <Link to="/admin/tickets">
          <Button variant="outline" size="sm" className="text-slate-300 border-slate-600 hover:bg-slate-700">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to All Tickets
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Ticket Info */}
        <div className="lg:col-span-1 space-y-4">
          {/* Status Card */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-lg flex items-center gap-2">
                <Clock className="w-5 h-5 text-cyan-400" />
                Current Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3 mb-4">
                <StatusBadge status={ticket.status} />
                {ticket.sla_breached && (
                  <span className="px-2 py-1 bg-red-600/20 text-red-400 text-xs rounded-full">
                    SLA BREACHED
                  </span>
                )}
              </div>
              <div className="text-sm text-slate-400 space-y-1">
                <p><span className="text-slate-500">Support Type:</span> {ticket.support_type || 'Phone'}</p>
                <p><span className="text-slate-500">Created:</span> {new Date(ticket.created_at).toLocaleString()}</p>
                {ticket.sla_due && (
                  <p><span className="text-slate-500">SLA Due:</span> {new Date(ticket.sla_due).toLocaleString()}</p>
                )}
                {ticket.closed_at && (
                  <p><span className="text-slate-500">Closed:</span> {new Date(ticket.closed_at).toLocaleString()}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Customer Info */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-lg flex items-center gap-2">
                <User className="w-5 h-5 text-blue-400" />
                Customer Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 text-slate-300">
                <User className="w-4 h-4 text-slate-500" />
                <span>{ticket.customer_name}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <Phone className="w-4 h-4 text-slate-500" />
                <span>{ticket.customer_phone}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <Mail className="w-4 h-4 text-slate-500" />
                <span className="text-sm">{ticket.customer_email}</span>
              </div>
              {ticket.customer_address && (
                <div className="flex items-start gap-2 text-slate-300">
                  <MapPin className="w-4 h-4 text-slate-500 mt-1" />
                  <span className="text-sm">
                    {ticket.customer_address}
                    {ticket.customer_city && `, ${ticket.customer_city}`}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Product Info */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-lg flex items-center gap-2">
                <Package className="w-5 h-5 text-green-400" />
                Product Details
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-slate-400 space-y-2">
              <p><span className="text-slate-500">Device Type:</span> {ticket.device_type}</p>
              {ticket.product_name && <p><span className="text-slate-500">Product:</span> {ticket.product_name}</p>}
              {ticket.serial_number && <p><span className="text-slate-500">Serial:</span> {ticket.serial_number}</p>}
              {ticket.invoice_number && <p><span className="text-slate-500">Invoice #:</span> {ticket.invoice_number}</p>}
              {ticket.order_id && <p><span className="text-slate-500">Order ID:</span> {ticket.order_id}</p>}
              {ticket.invoice_file && (
                <a 
                  href={`${API.replace('/api', '')}${ticket.invoice_file}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 mt-2"
                >
                  <FileText className="w-4 h-4" />
                  View Invoice
                </a>
              )}
            </CardContent>
          </Card>

          {/* Issue Description */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-lg flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-yellow-400" />
                Issue Description
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-300 text-sm">{ticket.issue_description}</p>
            </CardContent>
          </Card>

          {/* Assignment & Logistics */}
          {(ticket.assigned_to_name || ticket.pickup_label || ticket.return_label || ticket.service_charges) && (
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-lg flex items-center gap-2">
                  <Wrench className="w-5 h-5 text-purple-400" />
                  Service Details
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-400 space-y-2">
                {ticket.assigned_to_name && (
                  <p><span className="text-slate-500">Assigned To:</span> {ticket.assigned_to_name}</p>
                )}
                {ticket.repair_notes && (
                  <div>
                    <p className="text-slate-500 mb-1">Repair Notes:</p>
                    <p className="bg-slate-700 p-2 rounded text-slate-300">{ticket.repair_notes}</p>
                  </div>
                )}
                {ticket.service_charges && (
                  <p><span className="text-slate-500">Service Charges:</span> ₹{ticket.service_charges.toLocaleString()}</p>
                )}
                {ticket.pickup_courier && (
                  <p><span className="text-slate-500">Pickup Courier:</span> {ticket.pickup_courier} ({ticket.pickup_tracking})</p>
                )}
                {ticket.return_courier && (
                  <p><span className="text-slate-500">Return Courier:</span> {ticket.return_courier} ({ticket.return_tracking})</p>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Timeline */}
        <div className="lg:col-span-2">
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white text-lg flex items-center gap-2">
                <History className="w-5 h-5 text-cyan-400" />
                Ticket Journey Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              {ticket.history && ticket.history.length > 0 ? (
                <div className="space-y-0">
                  {ticket.history.map((entry, index) => (
                    <TimelineItem 
                      key={index} 
                      entry={entry} 
                      isLast={index === ticket.history.length - 1}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No history available</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notes Section */}
          {(ticket.agent_notes || ticket.escalation_notes || ticket.supervisor_notes) && (
            <Card className="bg-slate-800 border-slate-700 mt-4">
              <CardHeader>
                <CardTitle className="text-white text-lg flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-yellow-400" />
                  Agent Notes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {ticket.agent_notes && (
                  <div className="bg-purple-900/20 border border-purple-700 rounded-lg p-3">
                    <p className="text-xs text-purple-400 font-medium mb-1">Support Agent Notes</p>
                    <p className="text-slate-300 text-sm">{ticket.agent_notes}</p>
                  </div>
                )}
                {ticket.escalation_notes && (
                  <div className="bg-orange-900/20 border border-orange-700 rounded-lg p-3">
                    <p className="text-xs text-orange-400 font-medium mb-1">
                      Escalation Notes {ticket.escalated_by_name && `(by ${ticket.escalated_by_name})`}
                    </p>
                    <p className="text-slate-300 text-sm">{ticket.escalation_notes}</p>
                  </div>
                )}
                {ticket.supervisor_notes && (
                  <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-3">
                    <p className="text-xs text-blue-400 font-medium mb-1">
                      Supervisor Decision: <span className="uppercase">{ticket.supervisor_action?.replace('_', ' ')}</span>
                      {ticket.supervisor_sku && ` (SKU: ${ticket.supervisor_sku})`}
                    </p>
                    <p className="text-slate-300 text-sm">{ticket.supervisor_notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
