import React from 'react';
import Sidebar from '@/components/admin/Sidebar';
import TopBar from '@/components/admin/TopBar';
import '@/styles/admin.css';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div id="admin-app">
      <Sidebar />
      <div className="admin-main">
        <TopBar />
        <main className="admin-content">{children}</main>
      </div>
    </div>
  );
}
