'use client';

import { useCallback } from 'react';
import { useFeature } from '@bengo-hub/shared-ui-lib/subscription';
import { useServicePermissions } from '@/hooks/usePermissions';
import { PERMS } from '@/lib/auth/permissions';
import type { Attachment, Comment, Task } from '@/types';

/**
 * What the user may do on the work screens, by projects permission and plan feature, matching the
 * checks projects-api makes: change_own covers the tasks the user is assigned to (any assignee),
 * comments and files need team_collaboration, the Gantt chart gantt_chart.
 */
export function useTaskAccess() {
  const { can, profile, isLoading } = useServicePermissions();
  const me = profile?.user_id ?? '';
  const tracking = useFeature('task_tracking');
  const collaboration = useFeature('team_collaboration');
  const gantt = useFeature('gantt_chart');

  const canChangeAll = can(PERMS.tasksChange);
  const canChangeOwn = can(PERMS.tasksChangeOwn);
  const commentsManage = can(PERMS.commentsManage);
  const commentsDeleteOwn = can(PERMS.commentsDeleteOwn);
  const commentsChangeOwn = can(PERMS.commentsChangeOwn);

  const isMine = useCallback((t: Pick<Task, 'edges'>) => !!me && (t.edges?.assignees ?? []).some((a) => a.user_id === me), [me]);

  const canEdit = useCallback((t: Pick<Task, 'edges'>) => tracking && (canChangeAll || (canChangeOwn && isMine(t))), [tracking, canChangeAll, canChangeOwn, isMine]);

  return {
    me,
    isLoading,
    tracking,
    collaboration,
    gantt,
    canViewAll: can(PERMS.tasksView),
    canView: can([PERMS.tasksView, PERMS.tasksViewOwn]),
    canAdd: tracking && can(PERMS.tasksAdd),
    canDelete: tracking && can(PERMS.tasksDelete),
    canEdit,
    isMine,
    canManageStatuses: tracking && can(PERMS.projectsChange),
    canViewActivity: can(PERMS.projectsView),
    canViewMembers: can([PERMS.membersView, PERMS.membersManage]),
    canViewComments: collaboration && can(PERMS.commentsView),
    canComment: collaboration && can(PERMS.commentsAdd),
    canEditComment: (c: Comment) => collaboration && (commentsManage || (commentsChangeOwn && c.user_id === me)),
    canDeleteComment: (c: Comment) => collaboration && (commentsManage || (commentsDeleteOwn && c.user_id === me)),
    canAttach: collaboration && can(PERMS.commentsAdd),
    canDeleteFile: (a: Attachment) => collaboration && (commentsManage || (commentsDeleteOwn && a.uploaded_by === me)),
  };
}

export type TaskAccess = ReturnType<typeof useTaskAccess>;
