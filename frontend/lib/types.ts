export type StepStatus = "pending" | "active" | "complete" | "error" | "skipped";

export interface StepState {
  step: number;
  label: string;
  status: StepStatus;
}

export const PIPELINE_STEPS = [
  "Cleanup & Normalization",
  "Structured Extraction",
  "Escalation Check",
  "Output Generation",
];
