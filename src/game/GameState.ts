// 整局运行状态：跨场景传递的可序列化数据（不含任何显示对象）。

import type { TrainingIntent, TrainingMemory, TrialId, ChoreographySlot } from "../../shared/types";
import type { PerformanceResult } from "./systems/performanceEngine";
import { applyDelta, initialHiddenStates, type HiddenStates } from "./systems/endings";

export type Phase =
  | "title"
  | "prologue"
  | "training-1"
  | "performance-1"
  | "review-1"
  | "training-2"
  | "performance-2"
  | "review-2"
  | "final-training"
  | "final-performance"
  | "ending";

export interface RunState {
  phase: Phase;
  trialIndex: 0 | 1 | 2;
  hidden: HiddenStates;
  memories: TrainingMemory[]; // 已保留的训练记忆（最多两条）
  choreographies: Array<{ trialId: TrialId; slots: ChoreographySlot[]; command: string; intent: TrainingIntent | null }>;
  lastResult: PerformanceResult | null;
  endingId: string | null;
}

export function freshRun(): RunState {
  return {
    phase: "title",
    trialIndex: 0,
    hidden: initialHiddenStates(),
    memories: [],
    choreographies: [],
    lastResult: null,
    endingId: null,
  };
}

export function advanceAfterPerformance(run: RunState, result: PerformanceResult): RunState {
  const hidden = applyDelta(run.hidden, result.hiddenDelta);
  const phaseMap: Record<number, Phase> = {
    0: "review-1",
    1: "review-2",
    2: "ending",
  };
  return { ...run, hidden, lastResult: result, phase: phaseMap[result.trialIndex] };
}

export function phaseForTrial(index: 0 | 1 | 2): Phase {
  return index === 0 ? "training-1" : index === 1 ? "training-2" : "final-training";
}

export function advanceTrial(index: 0 | 1 | 2): 0 | 1 | 2 {
  return Math.min(2, index + 1) as 0 | 1 | 2;
}
