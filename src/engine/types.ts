export type ProductArea = 'cards' | 'expenses' | 'billpay' | 'travel';
export const PRODUCT_AREAS: readonly ProductArea[] = ['cards', 'expenses', 'billpay', 'travel'];
export const AREA_INFO: Record<ProductArea, { label: string; owner: string }> = {
  cards: { label: 'Cards', owner: 'Priya Raman' },
  expenses: { label: 'Expenses', owner: 'Marcus Bell' },
  billpay: { label: 'Bill Pay', owner: 'Elena Sorensen' },
  travel: { label: 'Travel', owner: 'Tomás Herrera' },
};

export type Segment = 'smb' | 'mid_market' | 'enterprise';
export const SEGMENTS: readonly Segment[] = ['smb', 'mid_market', 'enterprise'];
export type Channel = 'support_ticket' | 'csm_call' | 'sales_call' | 'in_app' | 'nps_comment' | 'shared_slack';
export const CHANNELS: readonly Channel[] = ['support_ticket', 'csm_call', 'sales_call', 'in_app', 'nps_comment', 'shared_slack'];

export interface FeedbackItem {
  id: string;
  receivedAt: string;
  channel: Channel;
  accountId: string;
  accountName: string;
  segment: Segment;
  arrUsd: number;
  text: string;
}

export interface Theme {
  id: string;
  area: ProductArea;
  title: string;
  keywords: ReadonlyArray<readonly [string, number]>;
}

export type TriageStatus = 'routed' | 'needs_human' | 'rejected';
export interface Triage {
  feedbackId: string;
  status: TriageStatus;
  themeId: string | null;
  area: ProductArea | null;
  by: 'agent' | 'human';
  score: number;
  runnerUp: { themeId: string; score: number } | null;
  matched: string[];
  rationale: string;
}

export interface Override { themeId: string; note: string; at: string }
export interface ThemeHandoff { themeId: string; area: ProductArea; at: string; fingerprint: string; receiptId: string; accounts: number; arrUsd: number; feedbackIds: string[] }

export type LaunchStage = 'alpha' | 'beta' | 'ga';
export type ItemCategory = 'enablement' | 'support' | 'quality' | 'comms' | 'measurement';
export const ITEM_CATEGORIES: readonly ItemCategory[] = ['enablement', 'support', 'quality', 'comms', 'measurement'];
export type ItemStatus = 'not_started' | 'in_progress' | 'done' | 'blocked';
export const ITEM_STATUSES: readonly ItemStatus[] = ['not_started', 'in_progress', 'done', 'blocked'];
export interface ChecklistItem {
  id: string;
  category: ItemCategory;
  label: string;
  owner: string;
  due: string;
  status: ItemStatus;
  evidence: string | null;
  blockedReason: string | null;
  critical: boolean;
}
export type SignoffRole = 'pm' | 'eng' | 'support' | 'prodops';
export const SIGNOFF_ROLES: readonly SignoffRole[] = ['pm', 'eng', 'support', 'prodops'];
export interface Signoff { role: SignoffRole; name: string; at: string; fingerprint: string }
export interface LaunchDecision { verdict: 'go' | 'no_go'; at: string; fingerprint: string; note: string }
export interface Launch {
  id: string;
  name: string;
  area: ProductArea;
  stage: LaunchStage;
  targetDate: string;
  summary: string;
  people: Record<SignoffRole, string>;
  linkedThemeIds: string[];
  items: ChecklistItem[];
  signoffs: Signoff[];
  decision: LaunchDecision | null;
}

export type Severity = 1 | 2 | 3 | 4;
export type IncidentStatus = 'investigating' | 'mitigated' | 'resolved';
export type RootCause = 'config_change' | 'release_regression' | 'partner_outage' | 'data_mapping' | 'capacity' | 'third_party_api';
export const ROOT_CAUSES: readonly RootCause[] = ['config_change', 'release_regression', 'partner_outage', 'data_mapping', 'capacity', 'third_party_api'];
export const ROOT_CAUSE_LABEL: Record<RootCause, string> = {
  config_change: 'Configuration change',
  release_regression: 'Release regression',
  partner_outage: 'Partner outage',
  data_mapping: 'Data mapping',
  capacity: 'Capacity',
  third_party_api: 'Third-party API',
};
export interface ActionItem { id: string; text: string; owner: string; due: string; done: boolean }
export interface Pir { status: 'draft' | 'complete'; summary: string; whys: string[]; actionItems: ActionItem[]; completedAt: string | null }
export interface IncidentUpdate { at: string; text: string }
export interface Incident {
  id: string;
  title: string;
  area: ProductArea;
  severity: Severity;
  status: IncidentStatus;
  detectedAt: string;
  mitigatedAt: string | null;
  resolvedAt: string | null;
  commander: string;
  accountsAffected: number;
  customerImpact: string;
  rootCause: RootCause | null;
  rootCauseNote: string | null;
  linkedThemeId: string | null;
  linkedLaunchId: string | null;
  updates: IncidentUpdate[];
  pir: Pir | null;
}

export interface ActivityEntry { at: string; kind: string; text: string }

export interface WorkspaceState {
  anchor: string;
  feedback: FeedbackItem[];
  overrides: Record<string, Override>;
  handoffs: Record<string, ThemeHandoff>;
  launches: Launch[];
  incidents: Incident[];
  activity: ActivityEntry[];
  counters: { feedback: number; incident: number; receipt: number; action: number };
}
