export type UserRole = 'Admin' | 'Merchandiser' | 'Factory Team';
export type Team = 'Export' | 'Domestic';
export type ProjectStatus = 'Active' | 'Completed';
export type StepStatus = 'Done' | 'Not Done';

export interface UserProfile {
  uid: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  team?: Team;
}

export interface WorkflowStep {
  name: string;
  plannedDate: string; // ISO string
  actualDate?: string; // ISO string
  status: StepStatus;
  remark?: string;
  assignedToEmail: string;
  tat: number; // days
}

export interface Project {
  id: string;
  merchandiser_uid: string;
  merchandiser_name: string;
  customer_name: string;
  project_name: string;
  po_number: string;
  po_date: string;
  article_name: string;
  color: string;
  order_date: string;
  dispatch_date: string;
  remark?: string;
  current_step_index: number;
  status: ProjectStatus;
  steps: WorkflowStep[];
  created_at: string;
}

export interface WorkflowConfigStep {
  name: string;
  assignedToEmail: string;
  tat: number;
}

export interface WorkflowConfig {
  steps: WorkflowConfigStep[];
}

export const WORKFLOW_STEP_NAMES = [
  "Style Handover",
  "PI Number Generation",
  "Lab Approval",
  "Purchase Order Confirmation",
  "Fabric Inward Tracking",
  "FPT (Fabric Performance Test)",
  "Trims & Accessories Arrangement",
  "GPT / PP / PS",
  "Cutting",
  "Sewing",
  "Packing",
  "Dispatch"
];
