import { describe, expect, it } from "vitest";
import { buildCandidates, type RunFacts } from "../src/game/systems/memory";
import { TRIALS } from "../src/game/content/trials";
import { PerformanceEngine } from "../src/game/systems/performanceEngine";
import { interpretOffline } from "../shared/offlineInterpreter";
import { resolveEnding, initialHiddenStates } from "../src/game/systems/endings";
import type { TrainingMemory } from "../shared/types";

const facts = (over: Partial<RunFacts> = {}): RunFacts => ({
  trialId: "bamboo-yard",
  observeThenThreadCount: 0,
  lookBackBeforeHighRisk: 0,
  expressiveMoveCount: 0,
  correctionCount: 0,
  worstMistake: null,
  intentStability: 50,
  intentExpression: 50,
  ...over,
});

describe("训练记忆候选（AC-MEM-01/02）", () => {
  it("探/回望后接穿 → 先探后穿入池且证据来自真实行为", () => {
    const c = buildCandidates(facts({ observeThenThreadCount: 2 }));
    expect(c[0].id).toBe("observeThenThread");
    expect(c[0].evidence).toContain("2次");
    expect(c[0].isLesson).toBe(false);
  });

  it("两次高风险前回望 → 回望同伴入池", () => {
    const c = buildCandidates(facts({ lookBackBeforeHighRisk: 2 }));
    expect(c.map((x) => x.id)).toContain("lookBackForTeam");
  });

  it("腾跃≥2且表现≥65 → 抢先争彩入池", () => {
    const c = buildCandidates(facts({ expressiveMoveCount: 3, intentExpression: 70 }));
    expect(c.map((x) => x.id)).toContain("chaseTheSpotlight");
  });

  it("条件不满足时绝不入池", () => {
    const c = buildCandidates(facts({ expressiveMoveCount: 3, intentExpression: 50 }));
    expect(c.map((x) => x.id)).not.toContain("chaseTheSpotlight");
  });

  it("最严重失误产生教训候选", () => {
    const c = buildCandidates(
      facts({ worstMistake: { type: "disconnect", moveName: "穿", beat: 4 } })
    );
    expect(c.some((x) => x.isLesson)).toBe(true);
  });

  it("不足两条时补足两条", () => {
    const c = buildCandidates(facts());
    expect(c.length).toBe(2);
  });
});

describe("纠偏只影响未来（AC-PERF-04）", () => {
  it("已发出的事件不因后续纠偏改变", () => {
    const trial = TRIALS[1];
    const slots = [
      { beat: 1, moveId: "probe" as const },
      { beat: 2, moveId: "leap" as const },
      { beat: 4, moveId: "thread" as const },
      { beat: 5, moveId: "leap" as const },
      { beat: 7, moveId: "coil" as const },
    ];
    const intent = interpretOffline("稳住龙头", trial.unlockedMoves, trial.id);

    const run = (corrections: Array<"perfect" | null>) => {
      const engine = new PerformanceEngine({ trial, slots, intent, memories: [] });
      const played: string[] = [];
      let i = 0;
      for (;;) {
        const seg = engine.nextSegment();
        if (seg.finished) break;
        if (seg.waitingFor === "correction") {
          // 记录纠偏前已经播出的动作
          played.push(
            ...seg.events.filter((e) => e.type === "move-complete").map((e) => `${e.atBeat}:${e.payload?.ok}`)
          );
          engine.submitCorrection(corrections[i++] ?? null);
        }
      }
      return played;
    };

    const noCorrect = run([null, null]);
    const withCorrect = run(["perfect", "perfect"]);
    // 纠偏窗口之前的动作结果必须一致
    const firstWindow = Math.min(...new PerformanceEngine({ trial, slots, intent, memories: [] }).windowBeats());
    expect(noCorrect.filter((p) => Number(p.split(":")[0]) < firstWindow)).toEqual(
      withCorrect.filter((p) => Number(p.split(":")[0]) < firstWindow)
    );
    void firstWindow;
  });
});

describe("结局互斥完备（AC-STORY-03）", () => {
  it("任意离散状态只命中一个结局", () => {
    const mk = (lookedBack: boolean, completion: number) => ({
      finalDecision: { lookedBack, score: 0, reasons: [] },
      completion,
      scores: { stability: 0, rhythm: 0, coordination: 0, expression: 0 },
    });
    const endings = new Set<string>();
    for (const lookedBack of [false, true]) {
      for (const completion of [0, 59, 60, 100]) {
        for (const bond of [0, 54, 55, 64, 65, 100]) {
          for (const trust of [0, 54, 55, 100]) {
            for (const heat of [0, 44, 45, 69, 70, 100]) {
              const r = resolveEnding(
                mk(lookedBack, completion) as never,
                { masterTrust: trust, teamBond: bond, audienceHeat: heat }
              );
              endings.add(r.ending);
              // 出师必含回望；冠军必不含回望
              if (r.ending === "trueApprentice") expect(lookedBack).toBe(true);
              if (r.ending === "championMachine") expect(lookedBack).toBe(false);
              if (lookedBack && r.ending === "championMachine") throw new Error("矛盾");
            }
          }
        }
      }
    }
    expect(endings.size).toBe(3);
  });

  it("灯散之后的尾声按最低状态切换", () => {
    const mk = (completion: number) => ({
      finalDecision: { lookedBack: false, score: 0, reasons: [] },
      completion,
      scores: { stability: 0, rhythm: 0, coordination: 0, expression: 0 },
    });
    const a = resolveEnding(mk(30) as never, { masterTrust: 80, teamBond: 20, audienceHeat: 60 });
    expect(a.epilogueKey).toBe("formation");
    const b = resolveEnding(mk(10) as never, { masterTrust: 80, teamBond: 70, audienceHeat: 60 });
    expect(b.epilogueKey).toBe("completion");
  });
});

describe("记忆效果可见（AC-MEM-03）", () => {
  it("lookBackForTeam 记忆在触发条件下改变演出结果", () => {
    const trial = TRIALS[1];
    const slots = [
      { beat: 1, moveId: "lookBack" as const },
      { beat: 2, moveId: "leap" as const },
      { beat: 4, moveId: "probe" as const },
      { beat: 5, moveId: "thread" as const },
      { beat: 6, moveId: "rise" as const },
      { beat: 7, moveId: "lookBack" as const },
    ];
    const intent = interpretOffline("大胆一点，全力表现。", trial.unlockedMoves, trial.id);
    const memories: TrainingMemory[] = [{ id: "lookBackForTeam", sourceTrialId: "bamboo-yard", evidence: "" }];
    const withMem = new PerformanceEngine({ trial, slots, intent, memories });
    for (;;) {
      const seg = withMem.nextSegment();
      if (seg.finished) break;
      if (seg.waitingFor === "correction") withMem.submitCorrection(null);
    }
    const r1 = withMem.result();
    expect(r1.memoryTriggers.some((t) => t.id === "lookBackForTeam")).toBe(true);

    const noMem = new PerformanceEngine({ trial, slots, intent, memories: [] });
    for (;;) {
      const seg = noMem.nextSegment();
      if (seg.finished) break;
      if (seg.waitingFor === "correction") noMem.submitCorrection(null);
    }
    const r2 = noMem.result();
    // 触发记忆后，至少一个后续事件或评价发生变化
    const changed =
      r1.scores.coordination !== r2.scores.coordination ||
      r1.outcomes.some((o, i) => o.ok !== r2.outcomes[i]?.ok);
    expect(changed).toBe(true);
  });

  it("未满足触发条件时复盘可解释", () => {
    const trial = TRIALS[1];
    const slots = [
      { beat: 1, moveId: "probe" as const },
      { beat: 2, moveId: "thread" as const },
      { beat: 3, moveId: "coil" as const },
      { beat: 5, moveId: "thread" as const },
      { beat: 6, moveId: "probe" as const },
      { beat: 7, moveId: "lookBack" as const },
    ];
    const intent = interpretOffline("稳住", trial.unlockedMoves, trial.id);
    const memories: TrainingMemory[] = [{ id: "chaseTheSpotlight", sourceTrialId: "bamboo-yard", evidence: "" }];
    const engine = new PerformanceEngine({ trial, slots, intent, memories });
    for (;;) {
      const seg = engine.nextSegment();
      if (seg.finished) break;
      if (seg.waitingFor === "correction") engine.submitCorrection(null);
    }
    const r = engine.result();
    // 没有腾跃 → 抢先争彩不触发，且能说明原因
    expect(r.memoryTriggers.filter((t) => t.id === "chaseTheSpotlight")).toHaveLength(0);
    expect(r.facts.expressiveMoveCount).toBe(0);
  });
});
