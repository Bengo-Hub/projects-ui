export interface Project {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  status: string; // active, on_hold, completed, cancelled
  start_date?: string;
  end_date?: string;
  budget?: number;
  currency: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, unknown>;
  edges?: {
    tasks?: Task[];
    members?: ProjectMember[];
    milestones?: Milestone[];
  };
}

export interface Task {
  id: string;
  tenant_id: string;
  project_id: string;
  title: string;
  description?: string;
  status: string; // todo, in_progress, review, done
  priority: string; // low, medium, high, critical
  assignee_id?: string;
  due_date?: string;
  start_date?: string;
  estimated_hours?: number;
  progress_pct?: number;
  completed_at?: string;
  parent_id?: string;
  wbs_code?: string;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, unknown>;
  edges?: {
    dependencies?: TaskDependency[];
  };
}

export interface TaskDependency {
  id: string;
  task_id: string;
  depends_on_task_id: string;
  dependency_type: string; // FS, SS, FF, SF
  created_at: string;
}

export interface Milestone {
  id: string;
  tenant_id: string;
  project_id: string;
  name: string;
  description?: string;
  target_date?: string;
  status: string; // pending, in_progress, completed, missed
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectMember {
  id: string;
  tenant_id: string;
  project_id: string;
  user_id: string;
  role_code: string;
  joined_at: string;
  left_at?: string;
}

export interface Comment {
  id: string;
  tenant_id: string;
  project_id: string;
  task_id?: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface Activity {
  id: string;
  tenant_id: string;
  project_id: string;
  task_id?: string;
  user_id: string;
  activity_type: string;
  payload?: Record<string, unknown>;
  occurred_at: string;
}

export interface Attachment {
  id: string;
  tenant_id: string;
  project_id?: string;
  task_id?: string;
  file_url: string;
  file_name: string;
  file_size: number;
  mime_type?: string;
  uploaded_by: string;
  uploaded_at: string;
}

export interface Tender {
  id: string;
  tenant_id: string;
  number: string;
  title: string;
  client_name: string;
  source?: string;
  status: string; // draft, evaluating, submitted, awarded, lost, cancelled
  priority: string; // low, medium, high, critical
  estimated_value?: number;
  currency: string;
  deadline?: string;
  description?: string;
  submission_type: string; // physical, email, online
  submitted_at?: string;
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface TenderCommittee {
  id: string;
  tender_id: string;
  tenant_id: string;
  name: string;
  created_at: string;
  edges?: {
    members?: TenderCommitteeMember[];
  };
}

export interface TenderCommitteeMember {
  id: string;
  committee_id: string;
  user_id: string;
  role: string;
  joined_at: string;
}

export interface TenderEvaluation {
  id: string;
  tender_id: string;
  tenant_id: string;
  evaluator_id: string;
  score: number;
  notes?: string;
  criteria?: string;
  evaluated_at: string;
}

export interface TenderMeeting {
  id: string;
  tender_id: string;
  tenant_id: string;
  title: string;
  scheduled_at: string;
  platform: string;
  meeting_url?: string;
  notes?: string;
  created_by: string;
  created_at: string;
}

export interface TenderStatusMetric {
  count: number;
  value: number;
}

export interface TenderMetrics {
  total: number;
  by_status: Record<string, TenderStatusMetric>;
  total_estimated_value: number;
  win_rate: number;
  pipeline_value: number;
  awarded_value: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
}

export interface ApiError {
  error: string;
  code?: string;
  upgrade?: boolean;
}

export interface GanttTask {
  id: string;
  title: string;
  start_date?: string;
  end_date?: string;
  due_date?: string;
  status: string;
  wbs_code?: string;
  dependencies: string[];
}

export interface ProjectSummary {
  project_id: string;
  name: string;
  status: string;
  total_tasks: number;
  completed_tasks: number;
  overdue_tasks: number;
  tasks_by_status: Record<string, number>;
  progress: number;
  total_members: number;
  total_milestones: number;
}
