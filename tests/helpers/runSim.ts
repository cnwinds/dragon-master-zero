// 完整一局的模拟器：与真实玩家操作同一套引擎/解析器/结局判定。

import { interpretOffline } from "../../shared/offlineInterpreter";
import { TRIALS } from "../../src/game/content/trials";
import { PerformanceEngine, type PerformanceResult } from "../../src/game/systems/performanceEngine";
import { applyDelta, initialHiddenStates, resolveEnding, type EndingResolution, type HiddenStates } from "../../src/game/systems/endings";
import { buildCandidates, type MemoryCandidate } from "../../src/game/systems/memory";
import type { CorrectionGrade, MoveId, TrainingMemory, TrainingMemoryId } from "../../shared/types";

export interface TrialPlan {
  slots: Array<{ beat: number; moveId: MoveId }>;
  command: string;
  pickMemory: (candidates: MemoryCandidate[]) => TrainingMemoryId;
  /** 每个纠偏窗口的输入；默认全部放弃 */
  corrections?: CorrectionGrade[];
}

export interface RunOutcome {
  results: PerformanceResult[];
  hidden: HiddenStates;
  ending: EndingResolution;
  finalResult: PerformanceResult;
}

export function simulateRun(plans: [TrialPlan, TrialPlan, TrialPlan], opts?: { verbose?: boolean }): RunOutcome {
  let hidden = initialHiddenStates();
  const memories: TrainingMemory[] = [];
  const results: PerformanceResult[] = [];

  for (let t = 0; t < 3; t++) {
    const trial = TRIALS[t];
    const plan = plans[t];
    const intent = interpretOffline(plan.command, trial.unlockedMoves, trial.id);
    const engine = new PerformanceEngine({ trial, slots: plan.slots, intent, memories });

    let correctionIdx = 0;
    const corrections = plan.corrections ?? [];
    for (;;) {
      const seg = engine.nextSegment();
      if (seg.finished) break;
      if (seg.waitingFor === "correction") {
        engine.submitCorrection(corrections[correctionIdx++] ?? null);
      } else if (seg.waitingFor === "incident") {
        engine.resolveIncident();
      } else if (seg.events.length === 0 && !seg.finished) {
        break;
      }
    }
    const result = engine.result();
    results.push(result);
    hidden = applyDelta(hidden, result.hiddenDelta);

    if (t < 2) {
      const candidates = buildCandidates({
        trialId: trial.id,
        observeThenThreadCount: result.facts.observeThenThreadCount,
        lookBackBeforeHighRisk: result.facts.lookBackBeforeHighRisk,
        expressiveMoveCount: result.facts.expressiveMoveCount,
        correctionCount: result.facts.correctionCount,
        worstMistake: result.facts.worstMistake
          ? {
              type: result.facts.worstMistake.type,
              moveName: result.facts.worstMistake.moveName,
              beat: result.facts.worstMistake.beat,
            }
          : null,
        intentStability: intent.stability,
        intentExpression: intent.expression,
      });
      const pick = plan.pickMemory(candidates);
      memories.push({ id: pick, sourceTrialId: trial.id, evidence: candidates.find((c) => c.id === pick)?.evidence ?? "" });
    }
  }

  const finalResult = results[2];
  const ending = resolveEnding(finalResult, hidden);
  if (opts?.verbose) {
    console.log(JSON.stringify({ hidden, ending, scores: finalResult.scores, completion: finalResult.completion, decision: finalResult.finalDecision }, null, 2));
  }
  return { results, hidden, ending, finalResult };
}

export function seq(...entries: Array<[MoveId, number]>): Array<{ beat: number; moveId: MoveId }> {
  let beat = 1;
  const slots: Array<{ beat: number; moveId: MoveId }> = [];
  const counts: Record<string, number> = {};
  for (const [move, count] of entries) {
    for (let i = 0; i < count; i++) {
      counts[move] = (counts[move] ?? 0) + 1;
      slots.push({ beat, moveId: move });
      beat += move === "coil" || move === "leap" ? 2 : 1;
    }
  }
  if (beat - 1 !== 8) throw new Error(`seq 长度错误: ${beat - 1}`);
  for (const c of Object.values(counts)) if (c > 2) throw new Error("动作超过两次");
  return slots;
}
