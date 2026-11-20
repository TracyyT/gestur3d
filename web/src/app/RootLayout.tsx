import { Outlet } from 'react-router';

export function RootLayout() {
  return (
    <div className="min-h-dvh bg-[#05060a] text-slate-100 antialiased">
      <Outlet />
    </div>
  );
}
