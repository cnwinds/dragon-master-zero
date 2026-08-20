import { describe, expect, it } from "vitest";
import { simulateRun, seq, type TrialPlan } from "./helpers/runSim";

// —— 三条标准验收路径（AC-STORY-04）——
// 表现：腾跃为主 + 高表现口令 + 抢先争彩记忆 → 冠军机器
// 守护：探盘回望为主 + 稳定协作口令 → 灯散之后（表现不足）
// 平衡：观察 + 衔接 + 一次高难 + 协作记忆 → 真正出师

function pathPerformance(): [TrialPlan, TrialPlan, TrialPlan] {
  return [
    {
      slots: seq(["thread", 2], ["coil", 2], ["lookBack", 2]),
      command: "快一点，动作连贯。",
      pickMemory: (c) => c[0].id,
    },
    {
      slots: seq(["rise", 2], ["leap", 2], ["thread", 1], ["probe", 1]),
      command: "动作再高再快，最后全力跃起。",
      pickMemory: (c) => c.find((x) => x.id === "chaseTheSpotlight")?.id ?? c[0].id,
    },
    {
      slots: seq(["rise", 2], ["leap", 2], ["thread", 2]),
      command: "放开手脚，全力冲，让他们记住这一晚。",
      pickMemory: () => "chaseTheSpotlight",
    },
  ];
}

function pathGuardian(): [TrialPlan, TrialPlan, TrialPlan] {
  return [
    {
      slots: seq(["probe", 2], ["thread", 2], ["lookBack", 2], ["coil", 1]),
      command: "先稳住龙头，多看看后面的小满。",
      pickMemory: (c) => c.find((x) => x.id === "observeThenThread")?.id ?? c[0].id,
    },
    {
      slots: seq(["probe", 2], ["lookBack", 2], ["coil", 2]),
      command: "稳住，跟着鼓点，多照顾队友。",
      pickMemory: (c) => c.find((x) => x.id === "steadyTheHead")?.id ?? c.find((x) => x.id === "lookBackForTeam")?.id ?? c[0].id,
    },
    {
      slots: seq(["probe", 2], ["thread", 2], ["lookBack", 2], ["coil", 1]),
      command: "别急，稳稳地走完，照顾好队伍。",
      pickMemory: () => "lookBackForTeam",
    },
  ];
}

function pathBalanced(): [TrialPlan, TrialPlan, TrialPlan] {
  return [
    {
      slots: seq(["probe", 2], ["thread", 2], ["lookBack", 2], ["coil", 1]),
      command: "先看清路，跟着鼓点，穿过去。",
      pickMemory: (c) => c.find((x) => x.id === "observeThenThread")?.id ?? c[0].id,
    },
    {
      slots: seq(["probe", 1], ["lookBack", 1], ["rise", 1], ["lookBack", 1], ["leap", 1], ["coil", 1]),
      command: "先回望小满，再大胆跃起。",
      pickMemory: (c) => c.find((x) => x.id === "lookBackForTeam")?.id ?? c[0].id,
    },
    {
      slots: seq(["probe", 1], ["lookBack", 1], ["leap", 1], ["thread", 1], ["coil", 1], ["rise", 1]),
      command: "先看队伍，再完成高点。",
      pickMemory: () => "lookBackForTeam",
    },
  ];
}

describe("三条标准路径稳定命中对应结局", () => {
  it("表现路径 → 冠军机器", () => {
    const out = simulateRun(pathPerformance(), { verbose: true });
    expect(out.ending.ending).toBe("championMachine");
    expect(out.finalResult.finalDecision?.lookedBack).toBe(false);
  });

  it("守护路径 → 灯散之后", () => {
    const out = simulateRun(pathGuardian(), { verbose: true });
    expect(out.ending.ending).toBe("lightsFade");
    expect(out.hidden.audienceHeat).toBeLessThan(45);
  });

  it("平衡路径 → 真正出师", () => {
    const out = simulateRun(pathBalanced(), { verbose: true });
    expect(out.ending.ending).toBe("trueApprentice");
    expect(out.finalResult.finalDecision?.lookedBack).toBe(true);
    expect(out.finalResult.completion).toBeGreaterThanOrEqual(60);
  });
});

describe("确定性（AC-AI-06）", () => {
  it("相同输入两次模拟，结局与全部事件一致", () => {
    const a = simulateRun(pathBalanced());
    const b = simulateRun(pathBalanced());
    expect(JSON.stringify(a.finalResult.outcomes)).toBe(JSON.stringify(b.finalResult.outcomes));
    expect(a.ending).toEqual(b.ending);
    expect(a.hidden).toEqual(b.hidden);
  });

  it("只改变口令时动作序列不变", () => {
    const plans = pathBalanced();
    const alt: [TrialPlan, TrialPlan, TrialPlan] = [
      { ...plans[0], command: "动作再高再快，全力表现。" },
      plans[1],
      plans[2],
    ];
    const a = simulateRun(plans);
    const b = simulateRun(alt);
    expect(a.finalResult.outcomes.map((o) => o.moveId)).toEqual(b.finalResult.outcomes.map((o) => o.moveId));
  });
});

describe("口令改变行为（AC-AI-03）", () => {
  it("同序列稳健 vs 表现：至少两个评分维度差≥10", () => {
    const plans = pathBalanced();
    const steady = simulateRun([
      plans[0],
      plans[1],
      { ...plans[2], command: "先稳住龙头，多照顾后面的队友，不要急。" },
    ]);
    const flashy = simulateRun([
      plans[0],
      plans[1],
      { ...plans[2], command: "动作再高再快，最后全力跃起。" },
    ]);
    const s = steady.finalResult.scores;
    const f = flashy.finalResult.scores;
    const diffs = [
      Math.abs(s.stability - f.stability),
      Math.abs(s.rhythm - f.rhythm),
      Math.abs(s.coordination - f.coordination),
      Math.abs(s.expression - f.expression),
    ];
    expect(diffs.filter((d) => d >= 10).length).toBeGreaterThanOrEqual(2);
  });
});
