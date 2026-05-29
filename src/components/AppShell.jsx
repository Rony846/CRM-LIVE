import { Outlet } from 'react-router-dom';
import TopAppBar from './TopAppBar';
import BottomNav from './BottomNav';

// Mobile app frame: fixed top bar + scrollable content + fixed bottom nav.
export default function AppShell() {
  return (
    <div className="min-h-screen bg-surface font-body-base text-body-base">
      <TopAppBar />
      <main className="pt-[64px] pb-[88px] min-h-screen">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
