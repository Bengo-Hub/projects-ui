'use client';

import { LogOut, User } from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { cn } from '@/lib/utils';

interface HeaderProps {
  orgSlug: string;
  className?: string;
}

export default function Header({ orgSlug, className }: HeaderProps) {
  const { user, logout } = useAuthStore();

  return (
    <header
      className={cn(
        'h-14 border-b border-border bg-white flex items-center justify-between px-6 shrink-0',
        className
      )}
    >
      <div className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{orgSlug}</span>
      </div>
      <div className="flex items-center gap-3">
        {user && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10">
              <User className="h-4 w-4 text-primary" />
            </div>
            <span className="hidden sm:block">{user.email}</span>
          </div>
        )}
        <button
          onClick={() => void logout()}
          className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          title="Sign out"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:block">Sign out</span>
        </button>
      </div>
    </header>
  );
}
