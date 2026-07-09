import React from 'react';
import { useAuth } from '@/App';
import ManualBooking from './accountant/ManualBooking';
import DispatcherShipDesk from './dispatcher/DispatcherShipDesk';

/**
 * Role-aware Ship Desk — the single top-of-sidebar entry point for the whole dispatch flow.
 *
 *   - admin / dispatcher / supervisor / technician / service_agent -> the unified PACK desk
 *       (DispatcherShipDesk): booked labels routed by category, Tracking ID + Amazon "Deliver by",
 *       Pickup status, ⬇ Label / ⬇ Slip / 🖨 Print pack.
 *   - accountant -> the BOOKING desk (ManualBooking): the worklist of orders (incl. critical Amazon
 *       orders) where he enters the Tracking ID (+ e-way bill & PDF above ₹50k) and it routes to
 *       Gaurav/Angad. This is where the accountant adds tracking, so his "Ship Desk" == that page.
 */
export default function ShipDeskHome() {
  const { user } = useAuth();
  const role = user?.role;

  if (['admin', 'dispatcher', 'supervisor', 'technician', 'service_agent'].includes(role)) {
    return <DispatcherShipDesk />;
  }
  return <ManualBooking />; // accountant + others
}
