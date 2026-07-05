import React from 'react';
import { useAuth } from '@/App';
import ShipDesk from './accountant/ShipDeskIron';
import DispatchTasks from './dispatch/DispatchTasksIron';
import DispatcherDashboard from './dispatcher/DispatcherDashboardIron';

/**
 * Role-aware Ship Desk — the single top-of-sidebar entry point for the whole dispatch flow.
 * Each sub-view already scopes its own data by role on the backend, so this just picks which one:
 *   - accountant / admin           -> Ship Desk: pick category + attach label → routes to makers
 *   - supervisor                   -> their Battery + Stabilizer + rest tasks (with label + invoice)
 *   - technician / service_agent   -> their Inverter tasks (with label + invoice)
 *   - dispatcher                   -> the courier dispatch queue
 */
export default function ShipDeskHome() {
  const { user } = useAuth();
  const role = user?.role;

  if (role === 'supervisor' || role === 'technician' || role === 'service_agent') {
    return <DispatchTasks />;
  }
  if (role === 'dispatcher') {
    return <DispatcherDashboard />;
  }
  return <ShipDesk />; // accountant + admin
}
