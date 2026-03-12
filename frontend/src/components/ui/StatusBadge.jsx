import React from 'react';
import { cn } from '@/lib/utils';

const statusConfig = {
  // Ticket statuses
  open: { label: 'Open', className: 'bg-blue-100 text-blue-700' },
  in_progress: { label: 'In Progress', className: 'bg-yellow-100 text-yellow-700' },
  diagnosed: { label: 'Diagnosed', className: 'bg-indigo-100 text-indigo-700' },
  hardware_required: { label: 'Hardware Required', className: 'bg-orange-100 text-orange-700 status-pulse-warning' },
  software_issue: { label: 'Software Issue', className: 'bg-green-100 text-green-700' },
  pending_pickup: { label: 'Pending Pickup', className: 'bg-pink-100 text-pink-700' },
  pending_dispatch: { label: 'Pending Dispatch', className: 'bg-orange-100 text-orange-700' },
  dispatched: { label: 'Dispatched', className: 'bg-cyan-100 text-cyan-700' },
  resolved: { label: 'Resolved', className: 'bg-emerald-100 text-emerald-700' },
  closed: { label: 'Closed', className: 'bg-slate-100 text-slate-600' },
  
  // Warranty statuses
  pending: { label: 'Pending', className: 'bg-yellow-100 text-yellow-700 status-pulse-warning' },
  approved: { label: 'Approved', className: 'bg-green-100 text-green-700' },
  rejected: { label: 'Rejected', className: 'bg-red-100 text-red-700' },
  
  // Dispatch statuses
  pending_label: { label: 'Pending Label', className: 'bg-yellow-100 text-yellow-700' },
  ready_to_dispatch: { label: 'Ready to Dispatch', className: 'bg-blue-100 text-blue-700 status-pulse-success' },
};

export default function StatusBadge({ status, className }) {
  const config = statusConfig[status] || { label: status, className: 'bg-slate-100 text-slate-600' };
  
  return (
    <span className={cn(
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
      config.className,
      className
    )}>
      {config.label}
    </span>
  );
}
