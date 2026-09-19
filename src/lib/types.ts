/** The kit structure the backend validates (Appendix A of the brief, plus its additive extensions). */

export type RequirementKind = "technical" | "behavioural" | "domain";
export type Priority = "must" | "nice";
export type QuestionCategory = "technical" | "behavioural" | "system-design" | "company-fit";
export type Origin = "generated" | "user" | "fallback";

/** Where an item came from and whether the user has made it their own. See `isProtected`. */
export interface Provenance {
  origin?: Origin;
  edited?: boolean;
  pinned?: boolean;
}

export interface Requirement {
  id: string;
  text: string;
  kind: RequirementKind;
  priority: Priority;
  evidence?: string;
}

export interface Question extends Provenance {
  id: string;
  requirement_ids: string[];
  category: QuestionCategory;
  prompt: string;
  answer_outline: string;
  difficulty: number;
}

export interface Flashcard extends Provenance {
  id: string;
  front: string;
  back: string;
  requirement_ids: string[];
}

export interface ScheduleDay {
  day: number;
  focus: string;
  question_ids: string[];
  minutes: number;
}

export interface ResearchLogEntry {
  source: string;
  url?: string;
  outcome: "used" | "empty" | "skipped" | "failed";
  reason?: string;
}

export interface Kit {
  source: { company: string; company_url: string; role: string; location: string; jd_chars: number; researched_at: string; pages_used: string[] };
  company_brief: Provenance & { summary: string; what_they_do: string; sources: string[] };
  role: { title: string; seniority: string; responsibilities: string[]; requirements: Requirement[] };
  questions: Question[];
  flashcards: Flashcard[];
  schedule: { days_available: number; days: ScheduleDay[]; replan?: { from_day: number; focus_question_ids: string[] } };
  coverage: { uncovered_requirement_ids: string[]; passes: number };
  hiring_stages?: string[];
  interview_insights?: string[];
  research_log?: ResearchLogEntry[];
  notes?: string[];
}

export type RegenerationTarget = { section: "brief" } | { section: "questions"; category: QuestionCategory };

export interface StoredKit {
  id: string;
  kit: Kit;
  version: number;
  regeneration: (RegenerationTarget & { status: "running" | "failed"; startedAt: string; error?: string }) | null;
  undoable: RegenerationTarget | null;
  createdAt: string;
  updatedAt: string;
}

export interface KitSummary {
  id: string;
  company: string;
  role: string;
  daysAvailable: number;
  requirementCount: number;
  questionCount: number;
  flashcardCount: number;
  notes: string[];
  createdAt: string;
  updatedAt: string;
}

export type JobStatus = "queued" | "running" | "succeeded" | "failed" | "interrupted";

export interface JobStep {
  step: string;
  status: "started" | "done" | "skipped" | "failed";
  detail?: string;
  at: string;
}

export interface Job {
  id: string;
  label: string;
  status: JobStatus;
  days: number;
  companyUrl: string;
  steps: JobStep[];
  error: { code: string; message: string } | null;
  kitId: string | null;
  batchId: string | null;
  createdAt: string;
  updatedAt: string;
}

export type StartOutcome =
  | { outcome: "started" | "already_running"; job: Job }
  | { outcome: "kit_exists"; kitId: string };

export interface User {
  id: string;
  email: string;
}

export interface CardProgress {
  box: number;
  seen: number;
  lastConfidence: 1 | 2 | 3 | 4;
  lastSeenAt: string;
}

export interface WeakSpot {
  requirement: Requirement;
  weakCards: number;
  unseenCards: number;
  totalCards: number;
  questionIds: string[];
}

export interface PracticeOverview {
  session: string[];
  coverage: { total: number; covered: number; notCovered: number; mastered: number; boxes: number[] };
  weak_spots: WeakSpot[];
  progress: Record<string, CardProgress>;
}

export const CATEGORIES: Array<{ id: QuestionCategory; label: string }> = [
  { id: "technical", label: "Technical" },
  { id: "behavioural", label: "Behavioural" },
  { id: "system-design", label: "System design" },
  { id: "company-fit", label: "Company fit" },
];

/** The same rule the backend applies: a regeneration never touches a protected item. */
export const isProtected = (item: Provenance): boolean => item.origin === "user" || item.edited === true || item.pinned === true;
