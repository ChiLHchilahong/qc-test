import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

const Layout = () => {
  return (
    <div className="flex h-screen overflow-hidden bg-[#eef2f7]">
      <Sidebar />
      <main className="flex-1 overflow-y-auto px-4 py-5 md:px-8 md:py-7">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
