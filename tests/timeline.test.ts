import { describe, expect, it } from "vitest";
import { isTimelineFull, moveAt, removeAt, tryPlace, analyzeTimeline, firstLegalIssue } from "../src/game/systems/timeline";
import type { MoveId } from "../shared/types";

const UNLOCKED_R1: MoveId[] = ["probe", "thread", "coil", "lookBack"];
const UNLOCKED_ALL: MoveId[] = ["probe", "thread", "rise", "coil", "leap", "lookBack"];

describe("八拍时间轴", () => {
  it("双拍动作不能从第8拍开始", () => {
    const r = tryPlace([], "leap", 8, UNLOCKED_ALL);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("两个空拍");
  });

  it("动作不能重叠", () => {
    const first = tryPlace([], "coil", 1, UNLOCKED_ALL);
    if (!first.ok) throw new Error("place failed");
    const slots = first.slots;
    const r = tryPlace(slots, "thread", 2, UNLOCKED_ALL);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("第2拍已被占用");
  });

  it("每种动作每轮最多两次", () => {
    let s1 = tryPlace([], "thread", 1, UNLOCKED_ALL); if (!s1.ok) throw new Error(); let slots = s1.slots;
    const q2 = tryPlace(slots, "thread", 2, UNLOCKED_ALL); if (!q2.ok) throw new Error(); slots = q2.slots;
    const r = tryPlace(slots, "thread", 3, UNLOCKED_ALL);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("最多编入两次");
  });

  it("未解锁动作被拒绝并给出原因", () => {
    const r = tryPlace([], "leap", 1, UNLOCKED_R1);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("学不会");
  });

  it("填满检测与移除", () => {
    let p1 = tryPlace([], "probe", 1, UNLOCKED_R1); if (!p1.ok) throw new Error(); let slots = p1.slots;
    const p2 = tryPlace(slots, "thread", 2, UNLOCKED_R1); if (!p2.ok) throw new Error(); slots = p2.slots;
    const p3 = tryPlace(slots, "lookBack", 3, UNLOCKED_R1); if (!p3.ok) throw new Error(); slots = p3.slots;
    const p4 = tryPlace(slots, "coil", 4, UNLOCKED_R1); if (!p4.ok) throw new Error(); slots = p4.slots;
    expect(isTimelineFull(slots)).toBe(false); // 1+1+1+2 = 5 拍
    const r6 = tryPlace(slots, "lookBack", 6, UNLOCKED_R1); if (!r6.ok) throw new Error(); slots = r6.slots;
    const r7 = tryPlace(slots, "thread", 7, UNLOCKED_R1); if (!r7.ok) throw new Error(); slots = r7.slots;
    const r8 = tryPlace(slots, "probe", 8, UNLOCKED_R1); if (!r8.ok) throw new Error(); slots = r8.slots;
    expect(isTimelineFull(slots)).toBe(true);
    expect(moveAt(slots, 5)?.moveId).toBe("coil");
    slots = removeAt(slots, 5);
    expect(moveAt(slots, 5)).toBeNull();
    expect(firstLegalIssue(slots, UNLOCKED_R1)).toBeNull();
  });

  it("衔接分析：探→穿 为良好，跃→跃 为风险", () => {
    let q1 = tryPlace([], "probe", 1, UNLOCKED_ALL); if (!q1.ok) throw new Error(); let slots = q1.slots;
    const q2 = tryPlace(slots, "thread", 2, UNLOCKED_ALL); if (!q2.ok) throw new Error(); slots = q2.slots;
    const q3 = tryPlace(slots, "leap", 3, UNLOCKED_ALL); if (!q3.ok) throw new Error(); slots = q3.slots;
    const q4 = tryPlace(slots, "leap", 5, UNLOCKED_ALL); if (!q4.ok) throw new Error(); slots = q4.slots;
    const a = analyzeTimeline(slots);
    expect(a[1].transition).toBe("good");
    expect(a[3].transition).toBe("risky");
    expect(a[2].observedBefore).toBe(true); // 探在 leap 前两拍
    expect(a[3].observedBefore).toBe(false);
  });
});
