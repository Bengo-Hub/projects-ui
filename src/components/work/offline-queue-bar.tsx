'use client';

import { OfflineSyncBanner, useOnlineStatus } from '@bengo-hub/shared-ui-lib/offline';
import { drainQueue, useOfflineQueue, useOfflineQueueRunner } from '@/hooks/useOfflineQueue';

/**
 * The shared offline ribbon over the work queue: says what still works offline, shows edits
 * waiting to sync, and drains them on reconnect (US-12.10).
 */
export function OfflineQueueBar({ userId }: { userId: string }) {
  useOfflineQueueRunner(userId);
  const online = useOnlineStatus();
  const queue = useOfflineQueue();
  return (
    <OfflineSyncBanner
      isOnline={online}
      pendingCount={queue.length}
      availableOffline={['Moving tasks between columns', 'Ticking checklist items', 'Writing comments']}
      disabledOffline={['Creating tasks', 'Uploading files', 'Changing dates']}
      onSyncNow={() => void drainQueue()}
    />
  );
}
