import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ErrorBannerProps {
  message?: string;
  className?: string;
}

export function ErrorBanner({ message = 'Something went wrong. Please try again.', className }: ErrorBannerProps) {
  return (
    <div className={cn('flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive', className)}>
      <AlertCircle className="h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
