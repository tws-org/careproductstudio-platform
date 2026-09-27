export interface Client {
  id: string;
  name: string;
  email: string;
  waiver_signed: boolean;
  waiver_signed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  client_id: string;
  name: string;
  description: string | null;
  status: "active" | "on_hold" | "completed" | "cancelled";
  start_date: string | null;
  target_end_date: string | null;
  actual_end_date: string | null;
  outcome_metric_name: string | null;
  outcome_metric_baseline: number | null;
  outcome_metric_baseline_date: string | null;
  outcome_metric_followup: number | null;
  outcome_metric_followup_date: string | null;
  scope_change_count: number;
  direction_change_count: number;
  deliverables_planned: number;
  deliverables_shipped: number;
  satisfaction_checkin: string | null;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: "pending" | "in_progress" | "done";
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface Comment {
  id: string;
  task_id: string;
  author_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}
