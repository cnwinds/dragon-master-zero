// 训练记忆：候选生成（必须源自本轮真实行为）与效果常量。

import type { MistakeType, TrainingMemoryId } from "../../../shared/types";
import type { TrialId } from "../../../shared/types";

export interface MemoryDefinition {
  id: TrainingMemoryId;
  name: string;
  glyph: string;
  description: string;
  effect: string;
}

export const MEMORY_DEFS: Record<TrainingMemoryId, MemoryDefinition> = {
  observeThenThread: {
    id: "observeThenThread",
    name: "先探后穿",
    glyph: "观",
    description: "探或回望之后接「穿」，路径风险下降。",
    effect: "「穿」在观察之后执行时，路线更稳，稳与韵上升。",
  },
  lookBackForTeam: {
    id: "lookBackForTeam",
    name: "回望同伴",
    glyph: "望",
    description: "高风险动作前回望，协作提升。",
    effect: "腾、跃之前若刚回望过，队伍提前调整杆位，合上升。",
  },
  chaseTheSpotlight: {
    id: "chaseTheSpotlight",
    name: "抢先争彩",
    glyph: "彩",
    description: "腾与跃的幅度、热度提高，但过冲风险增加。",
    effect: "腾、跃幅度更大、观众更热，但过冲风险上升。",
  },
  steadyTheHead: {
    id: "steadyTheHead",
    name: "稳住龙头",
    glyph: "稳",
    description: "纠偏后的恢复更快，但表现略降。",
    effect: "鼓点纠偏之后，恢复更快，稳上升、意略降。",
  },
};

/** 复盘用的一轮行为摘要，由演出结果导出。 */
export interface RunFacts {
  trialId: TrialId;
  observeThenThreadCount: number; // 探/回望 → 穿 的次数
  lookBackBeforeHighRisk: number; // 高风险动作前的回望次数
  expressiveMoveCount: number; // 腾+跃 次数
  correctionCount: number; // 使用纠偏的次数
  worstMistake: { type: MistakeType; moveName: string; beat: number } | null;
  intentStability: number;
  intentExpression: number;
}

export interface MemoryCandidate {
  id: TrainingMemoryId;
  evidence: string;
  isLesson: boolean; // true = 来自失误教训而非已满足条件
}

const QUALIFIED_BY_WORST: Record<MistakeType, TrainingMemoryId> = {
  disconnect: "observeThenThread",
  lanternTouch: "observeThenThread",
  overshoot: "steadyTheHead",
  early: "steadyTheHead",
  hesitate: "lookBackForTeam",
};

/**
 * 候选记忆生成规则（GDD §9.4）：
 * 1. 已满足条件的记忆按证据强度排序，取最高者为第一条候选；
 * 2. 最严重失误对应的教训为第二条；
 * 3. 不足两条时按固定顺序补基础记忆。
 */
export function buildCandidates(facts: RunFacts): MemoryCandidate[] {
  const satisfied: Array<{ id: TrainingMemoryId; score: number; evidence: string }> = [];

  if (facts.observeThenThreadCount >= 1) {
    satisfied.push({
      id: "observeThenThread",
      score: 10 + facts.observeThenThreadCount * 4,
      evidence: facts.observeThenThreadCount === 1
        ? "有一拍「穿」之前，你让它先看清了路。"
        : `有${facts.observeThenThreadCount}次「穿」之前，你让它先看清了路。`,
    });
  }
  if (facts.lookBackBeforeHighRisk >= 2) {
    satisfied.push({
      id: "lookBackForTeam",
      score: 12 + facts.lookBackBeforeHighRisk * 3,
      evidence: `它在腾跃之前，${facts.lookBackBeforeHighRisk}次回望了小满。`,
    });
  }
  if (facts.expressiveMoveCount >= 2 && facts.intentExpression >= 65) {
    satisfied.push({
      id: "chaseTheSpotlight",
      score: 9 + facts.expressiveMoveCount * 3,
      evidence: `它把${facts.expressiveMoveCount}次腾跃做得很满，观众的欢呼很响。`,
    });
  }
  if (facts.correctionCount >= 1 && facts.intentStability >= 60) {
    satisfied.push({
      id: "steadyTheHead",
      score: 8 + facts.correctionCount * 4,
      evidence: `你用鼓点把它按回了拍子上，共${facts.correctionCount}次。`,
    });
  }

  const candidates: MemoryCandidate[] = [];
  const used = new Set<TrainingMemoryId>();

  const top = [...satisfied].sort((a, b) => b.score - a.score)[0];
  if (top) {
    candidates.push({ id: top.id, evidence: top.evidence, isLesson: false });
    used.add(top.id);
  }

  if (facts.worstMistake) {
    const lessonId = QUALIFIED_BY_WORST[facts.worstMistake.type];
    if (!used.has(lessonId)) {
      const name = { early: "抢拍", hesitate: "迟疑", overshoot: "过冲", disconnect: "脱节", lanternTouch: "触灯" }[facts.worstMistake.type];
      candidates.push({
        id: lessonId,
        evidence: `第${facts.worstMistake.beat}拍的「${facts.worstMistake.moveName}」出现${name}——把这次教训记下来。`,
        isLesson: true,
      });
      used.add(lessonId);
    }
  }

  const basicOrder: TrainingMemoryId[] = ["observeThenThread", "lookBackForTeam", "steadyTheHead", "chaseTheSpotlight"];
  for (const id of basicOrder) {
    if (candidates.length >= 2) break;
    if (used.has(id)) continue;
    const def = MEMORY_DEFS[id];
    let evidence = "这轮没有特别的证据，先记一条基本功。";
    if (id === "observeThenThread") evidence = "师傅说：先看清，再穿过去。这是基本功。";
    if (id === "lookBackForTeam") evidence = "师傅说：回头不是为了动作，是为了看见人。";
    if (id === "steadyTheHead") evidence = "师傅说：龙头稳一分，全队就稳三分。";
    candidates.push({ id, evidence, isLesson: false });
    used.add(id);
  }

  return candidates.slice(0, 2);
}
