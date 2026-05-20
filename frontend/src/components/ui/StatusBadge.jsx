import React from 'react';
import { cn } from '@/lib/utils';

// Soft, restrained palette. Each entry: bg/text + a tiny inset ring for definition.
// Keep labels human-readable; unknown statuses fall through to neutral slate.
const pill = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium tracking-wide ring-1';

const tones = {
  blue:    `${pill} bg-blue-50 text-blue-700 ring-blue-200/60`,
  indigo:  `${pill} bg-indigo-50 text-indigo-700 ring-indigo-200/60`,
  amber:   `${pill} bg-amber-50 text-amber-700 ring-amber-200/60`,
  orange:  `${pill} bg-orange-50 text-orange-700 ring-orange-200/60`,
  emerald: `${pill} bg-emerald-50 text-emerald-700 ring-emerald-200/60`,
  rose:    `${pill} bg-rose-50 text-rose-700 ring-rose-200/60`,
  cyan:    `${pill} bg-cyan-50 text-cyan-700 ring-cyan-200/60`,
  slate:   `${pill} bg-slate-100 text-slate-600 ring-slate-200/60`,
  green:   `${pill} bg-emerald-50 text-emerald-700 ring-emerald-200/60`,
  pink:    `${pill} bg-pink-50 text-pink-700 ring-pink-200/60`,
};

const statusConfig = {
  // Ticket
  new_request:               { label: 'New',                tone: 'blue' },
  open:                      { label: 'Open',               tone: 'blue' },
  call_support_followup:     { label: 'Follow-up',          tone: 'blue' },
  in_progress:               { label: 'In Progress',        tone: 'amber' },
  diagnosed:                 { label: 'Diagnosed',          tone: 'indigo' },
  hardware_required:         { label: 'Hardware Required',  tone: 'orange' },
  hardware_service:          { label: 'Hardware',           tone: 'orange' },
  awaiting_label:            { label: 'Awaiting Label',     tone: 'amber' },
  label_uploaded:            { label: 'Label Uploaded',     tone: 'blue' },
  pickup_scheduled:          { label: 'Pickup Scheduled',   tone: 'cyan' },
  received_at_factory:       { label: 'At Factory',         tone: 'indigo' },
  in_repair:                 { label: 'In Repair',          tone: 'amber' },
  repair_completed:          { label: 'Repair Done',        tone: 'emerald' },
  software_issue:            { label: 'Software Issue',     tone: 'emerald' },
  pending_pickup:            { label: 'Pending Pickup',     tone: 'pink' },
  pending_dispatch:          { label: 'Pending Dispatch',   tone: 'orange' },
  dispatched:                { label: 'Dispatched',         tone: 'cyan' },
  delivered:                 { label: 'Delivered',          tone: 'emerald' },
  resolved:                  { label: 'Resolved',           tone: 'emerald' },
  resolved_on_call:          { label: 'Resolved on Call',   tone: 'emerald' },
  closed:                    { label: 'Closed',             tone: 'slate' },
  closed_by_agent:           { label: 'Closed',             tone: 'slate' },
  escalated_to_supervisor:   { label: 'Escalated',          tone: 'rose' },
  supervisor_followup:       { label: 'Supervisor',         tone: 'rose' },
  cancelled:                 { label: 'Cancelled',          tone: 'slate' },

  // Warranty
  pending:  { label: 'Pending',  tone: 'amber' },
  approved: { label: 'Approved', tone: 'emerald' },
  rejected: { label: 'Rejected', tone: 'rose' },

  // Dispatch / ops
  pending_label:      { label: 'Pending Label',     tone: 'amber' },
  ready_to_dispatch:  { label: 'Ready to Dispatch', tone: 'blue' },
};

const humanise = (s) =>
  String(s || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

export default function StatusBadge({ status, className }) {
  const cfg = statusConfig[status];
  const toneCls = tones[cfg?.tone] || tones.slate;
  const label = cfg?.label || humanise(status);
  return (
    <span className={cn(toneCls, 'whitespace-nowrap', className)}>
      {label}
    </span>
  );
}
