'use client';

import { type ReactNode, useState } from 'react';
import { useParams } from 'next/navigation';
import { QueryProvider } from '@/providers/query-provider';
import { AuthProvider } from '@/providers/auth-provider';
import Sidebar from '@/components/layout/sidebar';
import Header from '@/components/layout/header';

export default function OrgLayout({ children }: { children: ReactNode }) {
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) ?? '';
  const [_sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <QueryProvider>
      <AuthProvider>
        <div className="flex h-screen overflow-hidden bg-background">
          <Sidebar orgSlug={orgSlug} />
          <div className="flex flex-1 flex-col overflow-hidden min-w-0">
            <Header orgSlug={orgSlug} />
            <main className="flex-1 overflow-y-auto p-6 bg-accent/5">
              {children}
            </main>
          </div>
        </div>
      </AuthProvider>
    </QueryProvider>
  );
}
