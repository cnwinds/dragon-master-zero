// 《龙师零号》共享类型 —— 前端与 Node 服务端共同使用。
// 这些类型同时是演出引擎与 /api/interpret 的契约，改动需同步验收标准。

export type MoveId = "probe" | "thread" | "rise" | "coil" | "leap" | "lookBack";

export type TrialId = "bamboo-yard" | "lantern-street" | "river-stage";

/** 四项训练侧重：15–85，合计恒为 200。 */
export interface TrainingIntent {
  stability: number;
  rhythm: number;
  coordination: number;
  expression: number;
  preferredMove: MoveId | null;
  avoidMove: MoveId | null;
  explanation: string;
  source: "online" | "cache" | "offline";
}

export interface IntentIssue {
  field: string;
  reason: string;
}

export type TrainingMemoryId =
  | "observeThenThread"
  | "lookBackForTeam"
  | "chaseTheSpotlight"
  | "steadyTheHead";

export interface TrainingMemory {
  id: TrainingMemoryId;
  sourceTrialId: TrialId;
  evidence: string;
}

export interface ChoreographySlot {
  beat: number; // 1–8，双拍动作记录起始拍
  moveId: MoveId;
}

export interface Choreography {
  trialId: TrialId;
  slots: ChoreographySlot[];
  command: string;
  intent: TrainingIntent | null;
}

export type MistakeType = "early" | "hesitate" | "overshoot" | "disconnect" | "lanternTouch";

export type CorrectionGrade = "perfect" | "near" | "wrong";

export type PerformanceEventType =
  | "move-start"
  | "move-complete"
  | "mistake"
  | "correction-window"
  | "correction-result"
  | "memory-triggered"
  | "incident"
  | "autonomous-decision"
  | "performance-complete";

export interface PerformanceEvent {
  atBeat: number;
  type: PerformanceEventType;
  moveId?: MoveId;
  severity?: number;
  text?: string;
  payload?: Record<string, unknown>;
}
