// 八拍时间轴：占拍、合法性、每轮限用与衔接分析。

import { MOVES, MOVE_ORDER } from "../content/moves";
import type { ChoreographySlot, MoveId } from "../../../shared/types";

export const TOTAL_BEATS = 8;
export const MAX_USES_PER_MOVE = 2;

export interface Placement {
  slots: ChoreographySlot[];
  counts: Record<string, number>;
}

export function emptyPlacement(): Placement {
  return { slots: [], counts: {} };
}

export function occupiedBeats(slots: ChoreographySlot[]): boolean[] {
  const occ = new Array(TOTAL_BEATS + 1).fill(false); // 1-based
  for (const s of slots) {
    const beats = MOVES[s.moveId].beats;
    for (let b = s.beat; b < s.beat + beats; b++) occ[b] = true;
  }
  return occ;
}

export function isTimelineFull(slots: ChoreographySlot[]): boolean {
  return slots.length > 0 && occupiedBeats(slots).slice(1).every(Boolean);
}

/**
 * 尝试放置动作。失败返回具体原因（供竹简弹回时的气泡提示）。
 */
export function tryPlace(
  slots: ChoreographySlot[],
  moveId: MoveId,
  beat: number,
  unlockedMoves: MoveId[]
): { ok: true; slots: ChoreographySlot[] } | { ok: false; reason: string } {
  const def = MOVES[moveId];
  if (!unlockedMoves.includes(moveId)) return { ok: false, reason: "这一轮还学不会这个动作。" };
  if (beat < 1 || beat > TOTAL_BEATS) return { ok: false, reason: "超出八拍鼓谱范围。" };
  const count = slots.filter((s) => s.moveId === moveId).length;
  if (count >= MAX_USES_PER_MOVE) return { ok: false, reason: `「${def.name}」每轮最多编入两次。` };
  if (def.beats === 2 && beat > TOTAL_BEATS - 1) return { ok: false, reason: `「${def.name}」需要连续两个空拍，第8拍放不下。` };
  const occ = occupiedBeats(slots);
  for (let b = beat; b < beat + def.beats; b++) {
    if (occ[b]) return { ok: false, reason: `第${b}拍已被占用，竹简放不进去。` };
  }
  return { ok: true, slots: [...slots, { beat, moveId }].sort((a, b2) => a.beat - b2.beat) };
}

export function removeAt(slots: ChoreographySlot[], beat: number): ChoreographySlot[] {
  return slots
    .filter((s) => !(s.beat === beat || (MOVES[s.moveId].beats === 2 && beat === s.beat + 1)))
    .sort((a, b) => a.beat - b.beat);
}

export function moveAt(slots: ChoreographySlot[], beat: number): ChoreographySlot | null {
  return slots.find((s) => s.beat === beat || (MOVES[s.moveId].beats === 2 && beat === s.beat + 1)) ?? null;
}

export type TransitionQuality = "good" | "neutral" | "risky";

export interface SlotAnalysis {
  slot: ChoreographySlot;
  occurrence: number; // 该动作在本轮出现的序号（用于固定随机样本）
  transition: TransitionQuality; // 与前一动作的衔接
  prevMove: MoveId | null;
  /** 前两拍内是否出现过探/回望（穿与跃的观察条件） */
  observedBefore: boolean;
  /** 前两拍内是否出现过回望（协作条件） */
  lookBackNearby: boolean;
}

/** 顺序分析整个时间轴：衔接质量与观察条件。演出引擎的因果从这里出发。 */
export function analyzeTimeline(slots: ChoreographySlot[]): SlotAnalysis[] {
  const ordered = [...slots].sort((a, b) => a.beat - b.beat);
  const seen: Partial<Record<MoveId, number>> = {};
  return ordered.map((slot, i) => {
    const def = MOVES[slot.moveId];
    const occurrence = (seen[slot.moveId] = (seen[slot.moveId] ?? 0) + 1);
    const prev = i > 0 ? ordered[i - 1] : null;
    const prevMove = prev ? prev.moveId : null;
    let transition: TransitionQuality = "neutral";
    if (prevMove) {
      if (def.preferredPrevious.includes(prevMove)) transition = "good";
      else if (def.riskyPrevious.includes(prevMove)) transition = "risky";
    }
    const window = ordered.filter((s) => s.beat < slot.beat && s.beat >= slot.beat - 2).map((s) => s.moveId);
    const observedBefore = window.some((m) => m === "probe" || m === "lookBack");
    const lookBackNearby = window.includes("lookBack");
    return { slot, occurrence, transition, prevMove, observedBefore, lookBackNearby };
  });
}

export function firstLegalIssue(slots: ChoreographySlot[], unlockedMoves: MoveId[]): string | null {
  const occ = new Array(TOTAL_BEATS + 1).fill(false);
  const counts: Record<string, number> = {};
  for (const s of slots) {
    const def = MOVES[s.moveId];
    if (!unlockedMoves.includes(s.moveId)) return "存在本轮未解锁的动作";
    counts[s.moveId] = (counts[s.moveId] ?? 0) + 1;
    if (counts[s.moveId] > MAX_USES_PER_MOVE) return "同一动作超过两次";
    if (def.beats === 2 && s.beat > TOTAL_BEATS - 1) return "双拍动作越界";
    for (let b = s.beat; b < s.beat + def.beats; b++) {
      if (b < 1 || b > TOTAL_BEATS || occ[b]) return "拍位冲突";
      occ[b] = true;
    }
  }
  return null;
}

export function allMoveIds(): MoveId[] {
  return MOVE_ORDER;
}
