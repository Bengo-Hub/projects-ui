'use client';

import { OfflineSyncBanner, useOnlineStatus } from '@bengo-hub/shared-ui-lib/offline';
import { drainQueue, useOfflineQueue, useOfflineQueueRunner } from '@/hooks/useOfflineQueue';

/**
 * The shared offline ribbon over the work queue: says what still works offline, shows edits
 * waiting to sync (task edits, week hours and timer stops), and drains them on reconnect
 * (US-12.10, US-13.5).
 */
export function OfflineQueueBar({ userId }: { userId: string }) {
  useOfflineQueueRunner(userId);
  const online = useOnlineStatus();
  const queue = useOfflineQueue();
  return (
    <OfflineSyncBanner
      isOnline={online}
      pendingCount={queue.length}
      availableOffline={['Moving tasks between columns', 'Ticking checklist items', 'Writing comments', 'Stopping the timer', 'Editing your week of hours']}
      disabledOffline={['Creating tasks', 'Uploading files', 'Changing dates', 'Starting a timer', 'Submitting a week']}
      onSyncNow={() => void drainQueue()}
    />
  );
}
