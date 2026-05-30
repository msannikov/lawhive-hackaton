export interface DemoDocument {
  name: string;
  kind: string;
}

export interface DemoEvidence {
  field: string;
  value?: string | number | boolean | null;
  source: string;
}

export interface DemoTool {
  id: string;
  title: string;
  category: string;
  nextAction: string;
  deadline: string;
  deadlineBasis: string;
  legalBasis?: string;
  priority: number;
  documentTemplate?: string;
}

export interface DemoEscalation {
  level: "self_serve" | "monitor" | "escalate";
  recommend: boolean;
  reason: string;
  triggers: string[];
}

export interface DemoNextMove {
  toolId: string;
  title: string;
  rationale: string;
  deadline: string;
}

export interface DemoWorkflowStep {
  id: string;
  label: string;
  detail: string;
}

export interface DemoCaseMeta {
  tenantName: string;
  landlordName: string;
  propertyAddress: string;
  depositAmount: number;
  depositFormatted: string;
  problem: string;
  playbookLabel: string;
}

export interface DemoBrand {
  product: string;
  title: string;
  subtitle: string;
}

export interface DemoNegotiationRound {
  label: string;
  stage: string;
  branchLabel: string;
  escalation: DemoEscalation;
  nextMove?: DemoNextMove;
  userReport?: string;
}

export interface DemoAssessment {
  brand: DemoBrand;
  caseMeta: DemoCaseMeta;
  letterTemplate: string;
  negotiationRounds: DemoNegotiationRound[];
  domain: string;
  branch: string;
  branchLabel: string;
  summary: string;
  reasoning: string[];
  keyDates: Record<string, string>;
  escalation: DemoEscalation;
  nextMove?: DemoNextMove;
  tools: DemoTool[];
  extraction: {
    provider: string;
    evidence: DemoEvidence[];
    warnings: string[];
  };
  documents: DemoDocument[];
  workflowSteps: DemoWorkflowStep[];
}
