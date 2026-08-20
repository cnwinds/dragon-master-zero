// 三结局判定：严格按固定优先级，互斥且完备（AC-STORY-03）。

import type { PerformanceResult } from "./performanceEngine";

export type EndingId = "trueApprentice" | "championMachine" | "lightsFade";

export interface HiddenStates {
  masterTrust: number;
  teamBond: number;
  audienceHeat: number;
}

export interface EndingResolution {
  ending: EndingId;
  epilogueKey: "formation" | "completion" | "balance" | null; // 仅灯散之后使用
  matched: string[]; // 命中条件的人话描述（结局画面展示因果）
}

export function initialHiddenStates(): HiddenStates {
  return { masterTrust: 50, teamBond: 50, audienceHeat: 35 };
}

export function applyDelta(states: HiddenStates, delta: { masterTrust: number; teamBond: number; audienceHeat: number }): HiddenStates {
  const clamp = (v: number) => Math.min(100, Math.max(0, Math.round(v)));
  return {
    masterTrust: clamp(states.masterTrust + delta.masterTrust),
    teamBond: clamp(states.teamBond + delta.teamBond),
    audienceHeat: clamp(states.audienceHeat + delta.audienceHeat),
  };
}

/**
 * 结局判定顺序不可互换：
 * 1. 真正出师：终局自主回望 + 完成度≥60 + 同心≥65 + 信任≥55 + 热度≥45
 * 2. 冠军机器：未回望 + 热度≥70 + 同心<55
 * 3. 灯散之后：其余全部；尾声按最低状态切换
 */
export function resolveEnding(final: PerformanceResult, states: HiddenStates): EndingResolution {
  const lookedBack = final.finalDecision?.lookedBack === true;
  const matched: string[] = [];
  matched.push(lookedBack ? "终局自主回望成立" : "终局没有回望");

  if (
    lookedBack &&
    final.completion >= 60 &&
    states.teamBond >= 65 &&
    states.masterTrust >= 55 &&
    states.audienceHeat >= 45
  ) {
    matched.push(`完成度${final.completion}`, `同心${states.teamBond}`, `信任${states.masterTrust}`, `热度${states.audienceHeat}`);
    return { ending: "trueApprentice", epilogueKey: null, matched };
  }

  if (!lookedBack && states.audienceHeat >= 70 && states.teamBond < 55) {
    matched.push(`热度${states.audienceHeat}`, `同心${states.teamBond}`);
    return { ending: "championMachine", epilogueKey: null, matched };
  }

  // 灯散之后：按最低状态选择“还没学会什么”
  const candidates: Array<{ key: "formation" | "completion" | "balance"; value: number }> = [
    { key: "formation", value: states.teamBond },
    { key: "completion", value: final.completion },
    { key: "balance", value: Math.min(states.audienceHeat, states.teamBond, final.completion) },
  ];
  candidates.sort((a, b) => a.value - b.value);
  const epilogueKey = candidates[0].key;
  matched.push(`同心${states.teamBond}`, `完成度${final.completion}`, `热度${states.audienceHeat}`);
  return { ending: "lightsFade", epilogueKey, matched };
}
