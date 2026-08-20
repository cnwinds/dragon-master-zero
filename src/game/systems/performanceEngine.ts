// 确定性演出引擎。
// 分段生成：每次只推进到下一个纠偏窗口 / 剧情事件 / 结束；
// 已发出的事件永不改写；相同结构化输入必得相同结果。

import { MOVES } from "../content/moves";
import type { TrialConfig } from "../content/trials";
import type {
  CorrectionGrade,
  MistakeType,
  MoveId,
  PerformanceEvent,
  TrainingIntent,
  TrainingMemory,
  TrainingMemoryId,
} from "../../../shared/types";
import { balancedIntent } from "../../../shared/intent";
import { analyzeTimeline, type SlotAnalysis } from "./timeline";
import { sample01 } from "./seededRandom";

export interface MistakeRecord {
  beat: number;
  moveId: MoveId;
  moveName: string;
  type: MistakeType;
  severity: 1 | 2 | 3; // 1 轻 2 中 3 重
  reason: string; // 复盘归因：必须引用因果词典中的具体行为
}

export interface MoveOutcome {
  beat: number;
  moveId: MoveId;
  occurrence: number;
  ok: boolean;
  mistake: MistakeRecord | null;
  amplitude: number; // 0.75–1.35，动作幅度倍率
  lagMs: number; // 正=迟疑，负=抢拍
  deviation: number; // 0–1，实际轨迹偏离预测的程度
  teamReady: boolean; // 身后队伍是否处于就位状态（张力线配色）
}

export interface CorrectionRecord {
  beat: number;
  grade: CorrectionGrade;
}

export interface MemoryTriggerRecord {
  id: TrainingMemoryId;
  atBeat: number;
  text: string;
}

export interface FinalDecision {
  lookedBack: boolean;
  score: number;
  reasons: string[];
}

export interface PerformanceResult {
  trialIndex: 0 | 1 | 2;
  outcomes: MoveOutcome[];
  mistakes: MistakeRecord[];
  corrections: CorrectionRecord[];
  memoryTriggers: MemoryTriggerRecord[];
  scores: { stability: number; rhythm: number; coordination: number; expression: number };
  hiddenDelta: { masterTrust: number; teamBond: number; audienceHeat: number };
  hardGoalPassed: boolean;
  completion: number;
  facts: {
    observeThenThreadCount: number;
    lookBackBeforeHighRisk: number;
    expressiveMoveCount: number;
    correctionCount: number;
    worstMistake: MistakeRecord | null;
  };
  finalDecision: FinalDecision | null;
}

export interface Segment {
  events: EngineEvent[];
  waitingFor: "correction" | "incident" | null;
  atBeat: number;
  finished: boolean;
}

/** 带播放时序信息的事件（场景层渲染用）。 */
export interface EngineEvent extends PerformanceEvent {
  /** 事件相对本段开始的拍距（含小数），场景按 bpm 换算时间 */
  beatOffset?: number;
}

interface PendingWindow {
  targetIndex: number;
  beat: number;
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export class PerformanceEngine {
  private readonly trial: TrialConfig;
  private readonly analyses: SlotAnalysis[];
  private readonly intent: TrainingIntent;
  private readonly memories: TrainingMemory[];
  private readonly outcomes: MoveOutcome[] = [];
  private readonly corrections: CorrectionRecord[] = [];
  private readonly memoryTriggers: MemoryTriggerRecord[] = [];
  private readonly riskOverrides = new Map<number, number>(); // analysisIndex -> risk delta
  private readonly windows: PendingWindow[] = [];
  private readonly passedWindows = new Set<number>();
  private cursor = 0;
  private teamStrain = 0;
  private finished = false;
  private finalDecision: FinalDecision | null = null;
  private incidentResolved = false;
  private pendingWindowBeat: number | null = null;
  private awaitingIncident = false;

  constructor(input: {
    trial: TrialConfig;
    slots: { beat: number; moveId: MoveId }[];
    intent: TrainingIntent | null;
    memories: TrainingMemory[];
  }) {
    this.trial = input.trial;
    this.analyses = analyzeTimeline(input.slots);
    this.intent = input.intent ?? balancedIntent();
    this.memories = input.memories;
    this.windows = this.computeWindows();
  }

  hasMemory(id: TrainingMemoryId): boolean {
    return this.memories.some((m) => m.id === id);
  }

  /** 纠偏窗口：确定性选取风险最高的两个动作起始拍（第1拍除外）。
   *  训练轮保底至少一个窗口——第一轮必须教会玩家“鼓点纠偏”。 */
  private computeWindows(): PendingWindow[] {
    const scored = this.analyses
      .map((a, i) => ({ i, beat: a.slot.beat, risk: this.baseRisk(a) }))
      .filter((w) => w.beat > 1)
      .sort((x, y) => y.risk - x.risk || x.beat - y.beat);
    const chosen: PendingWindow[] = [];
    const limit = this.trial.index === 2 ? 28 : -Infinity; // 最终演出只在高风险拍开窗
    for (const w of scored) {
      if (chosen.length >= 2) break;
      if (w.risk < limit) continue;
      if (chosen.some((c) => Math.abs(c.beat - w.beat) < 2)) continue;
      chosen.push({ targetIndex: w.i, beat: w.beat });
    }
    return chosen.sort((a, b) => a.beat - b.beat);
  }

  /** 不含纠偏与张力的一次性风险（用于选窗口）。 */
  private baseRisk(a: SlotAnalysis): number {
    const def = MOVES[a.slot.moveId];
    let risk = def.baseRisk;
    risk += a.transition === "risky" ? 14 : a.transition === "good" ? -6 : 5;
    if (this.trial.narrowBeats.includes(a.slot.beat) && (a.slot.moveId === "coil" || a.slot.moveId === "leap")) {
      risk += this.trial.narrowPenalty;
    }
    if (a.transition === "risky" || (a.slot.moveId === "thread" && !a.observedBefore)) {
      risk -= (this.intent.coordination - 50) * 0.3;
    }
    risk -= (this.intent.stability - 50) * 0.35;
    if (this.intent.avoidMove === a.slot.moveId) risk -= 6;
    return risk;
  }

  /** 玩家开局可读的窗口拍位（UI 预告“关键拍”）。 */
  windowBeats(): number[] {
    return this.windows.map((w) => w.beat);
  }

  correctionTokensLeft(): number {
    return 2 - this.corrections.length;
  }

  /** 剧情事件（小满被绊）发生在首个起始拍 ≥ incidentBeat 的动作上。 */
  private incidentAt(): number {
    const b = this.trial.incidentBeat ?? -1;
    if (b < 0 || this.incidentResolved) return -1;
    const a = this.analyses[this.cursor];
    return a && a.slot.beat >= b ? a.slot.beat : -1;
  }

  /** 生成下一段演出（到一个纠偏窗口 / 剧情事件 / 结束）。 */
  nextSegment(): Segment {
    if (this.finished) return { events: [], waitingFor: null, atBeat: 0, finished: true };
    if (this.awaitingIncident && !this.incidentResolved) {
      return { events: [], waitingFor: "incident", atBeat: this.trial.incidentBeat!, finished: false };
    }

    const seg: EngineEvent[] = [];
    let stop: "correction" | "incident" | null = null;
    let stopBeat = 0;

    while (this.cursor < this.analyses.length) {
      const a = this.analyses[this.cursor];
      const beat = a.slot.beat;

      if (this.incidentAt() === beat) {
        this.awaitingIncident = true;
        seg.push({ atBeat: beat, type: "incident" });
        stop = "incident";
        stopBeat = beat;
        break;
      }

      const w = this.windows.find((x) => x.targetIndex === this.cursor);
      if (w && !this.passedWindows.has(w.beat)) {
        if (this.correctionTokensLeft() > 0) {
          this.pendingWindowBeat = w.beat;
          seg.push({ atBeat: beat, type: "correction-window" });
          stop = "correction";
          stopBeat = beat;
          break;
        }
        this.passedWindows.add(w.beat); // 没令牌了，直接过
      }

      this.executeMove(a, seg);
      this.cursor++;
    }

    if (stop) return { events: seg, waitingFor: stop, atBeat: stopBeat, finished: false };

    this.finished = true;
    seg.push({ atBeat: 9, type: "performance-complete" });
    return { events: seg, waitingFor: null, atBeat: 9, finished: true };
  }

  /** 玩家在纠偏窗口输入（null = 放弃，不消耗令牌）。只影响尚未发生的动作。 */
  submitCorrection(grade: CorrectionGrade | null): void {
    const beat = this.pendingWindowBeat;
    if (beat == null) return;
    this.pendingWindowBeat = null;
    this.passedWindows.add(beat);
    const window = this.windows.find((w) => w.beat === beat);
    if (!window) return;

    if (!grade) {
      this.corrections.push({ beat, grade: "near" }); // 放弃：不加分不扣分，仅记录窗口已过
      this.corrections.pop();
      return;
    }
    this.corrections.push({ beat, grade });
    const delta = grade === "perfect" ? -18 : grade === "near" ? -8 : 8;
    this.riskOverrides.set(window.targetIndex, (this.riskOverrides.get(window.targetIndex) ?? 0) + delta);
    if (grade === "perfect" && window.targetIndex + 1 < this.analyses.length) {
      this.riskOverrides.set(window.targetIndex + 1, (this.riskOverrides.get(window.targetIndex + 1) ?? 0) - 8);
    }
    if (grade === "wrong" && window.targetIndex + 1 < this.analyses.length) {
      this.riskOverrides.set(window.targetIndex + 1, (this.riskOverrides.get(window.targetIndex + 1) ?? 0) + 6);
    }
    if (this.hasMemory("steadyTheHead") && grade !== "wrong") {
      for (let i = window.targetIndex; i < Math.min(window.targetIndex + 2, this.analyses.length); i++) {
        this.riskOverrides.set(i, (this.riskOverrides.get(i) ?? 0) - 6);
      }
      this.memoryTriggers.push({
        id: "steadyTheHead",
        atBeat: beat,
        text: "记忆「稳住龙头」：鼓点之后，它立刻找回了重心。",
      });
    }
  }

  /** 终局自主决策：由协作侧重、动作序列与训练记忆共同决定；纠偏不能直接命令它。 */
  resolveIncident(): FinalDecision {
    const lookBackCount = this.analyses.filter((x) => x.slot.moveId === "lookBack").length;
    const reasons: string[] = [];
    let score = 0;

    const coordTerm = (this.intent.coordination - 50) * 0.9;
    score += coordTerm;
    if (Math.abs(coordTerm) >= 6) reasons.push(`协作侧重${this.intent.coordination}`);

    score += lookBackCount * 9;
    if (lookBackCount > 0) reasons.push(`编排中回望×${lookBackCount}`);

    if (this.hasMemory("lookBackForTeam")) {
      score += 20;
      reasons.push("记忆「回望同伴」在身");
    }
    if (this.hasMemory("observeThenThread")) score += 4;
    if (this.hasMemory("chaseTheSpotlight")) {
      score -= 12;
      reasons.push("记忆「抢先争彩」在身");
    }
    score += (this.intent.expression - 50) * -0.35;

    const lookedBack = score >= 16;
    this.finalDecision = { lookedBack, score: Math.round(score * 10) / 10, reasons };
    this.incidentResolved = true;
    this.awaitingIncident = false;

    if (lookedBack) {
      // 队伍重新同步：剩余动作风险下降
      for (let i = this.cursor; i < this.analyses.length; i++) {
        this.riskOverrides.set(i, (this.riskOverrides.get(i) ?? 0) - 12);
      }
    } else {
      this.teamStrain = Math.min(3, this.teamStrain + 1);
    }
    return this.finalDecision;
  }

  getFinalDecision(): FinalDecision | null {
    return this.finalDecision;
  }

  /** 已执行动作的演出参数（播放中只读，不触发补算） */
  getOutcomes(): readonly MoveOutcome[] {
    return this.outcomes;
  }

  private executeMove(a: SlotAnalysis, seg: EngineEvent[]): void {
    const def = MOVES[a.slot.moveId];
    const { slot } = a;
    const sample = sample01(this.trial.id, slot.beat, slot.moveId, a.occurrence);

    let risk = this.baseRisk(a) + (this.riskOverrides.get(this.cursor) ?? 0);

    // 队伍张力：连续高速动作累积，观察类动作恢复
    const priorCost = this.analyses
      .slice(0, this.cursor)
      .reduce((s, x) => s + MOVES[x.slot.moveId].stabilityCost, 0);
    const priorRecovery =
      this.analyses
        .slice(Math.max(0, this.cursor - 2), this.cursor)
        .filter((x) => x.slot.moveId === "lookBack" || x.slot.moveId === "probe")
        .length * 5;
    risk += priorCost * 1.6 - priorRecovery + this.teamStrain * 6;

    // —— 记忆触发 ——
    const triggerMem = (id: TrainingMemoryId, text: string) => {
      this.memoryTriggers.push({ id, atBeat: slot.beat, text });
      seg.push({ atBeat: slot.beat, type: "memory-triggered", moveId: slot.moveId, text });
    };
    if (this.hasMemory("observeThenThread") && slot.moveId === "thread" && a.observedBefore) {
      risk -= 12;
      triggerMem("observeThenThread", `记忆「先探后穿」：第${slot.beat}拍的「穿」贴着看过的路走。`);
    }
    if (this.hasMemory("lookBackForTeam") && def.highRisk && a.lookBackNearby) {
      risk -= 10;
      triggerMem("lookBackForTeam", `记忆「回望同伴」：第${slot.beat}拍「${def.name}」之前，小满已经就位。`);
    }
    if (this.hasMemory("chaseTheSpotlight") && (slot.moveId === "rise" || slot.moveId === "leap")) {
      risk += 10;
      triggerMem("chaseTheSpotlight", `记忆「抢先争彩」：第${slot.beat}拍「${def.name}」拉到了最满。`);
    }
    if (
      slot.moveId === "lookBack" &&
      this.analyses.slice(this.cursor + 1, this.cursor + 3).some((x) => MOVES[x.slot.moveId].highRisk)
    ) {
      this.teamStrain = Math.max(0, this.teamStrain - 1);
    }

    // —— 失误判定：随机样本只决定接近阈值时是否触发 ——
    const sev = risk + (sample - 0.55) * 26;
    const mistake = sev > 55 ? this.classifyMistake(a, sev, risk) : null;

    // —— 演出参数 ——
    const exprAmp =
      0.85 +
      (this.intent.expression - 50) * 0.008 +
      (this.hasMemory("chaseTheSpotlight") && def.highRisk ? 0.08 : 0);
    const amplitude = clamp(
      exprAmp * (mistake && mistake.type === "overshoot" ? 1.18 : mistake ? 0.9 : 1),
      0.75,
      1.35
    );
    const rhythmBase = (this.intent.rhythm - 50) * 3;
    let lagMs = Math.round(
      rhythmBase * (sample - 0.5) * 2 + (mistake?.type === "hesitate" ? 260 : mistake?.type === "early" ? -220 : 0)
    );
    if (this.intent.preferredMove === slot.moveId) lagMs = Math.round(lagMs * 0.6);
    const deviation = mistake
      ? clamp((sev - 50) / 60, 0.2, 1)
      : clamp(Math.abs(sev - 40) / 90, 0, 0.25);

    const outcome: MoveOutcome = {
      beat: slot.beat,
      moveId: slot.moveId,
      occurrence: a.occurrence,
      ok: !mistake,
      mistake,
      amplitude,
      lagMs,
      deviation,
      teamReady: a.lookBackNearby || this.teamStrain === 0,
    };
    this.outcomes.push(outcome);

    seg.push({ atBeat: slot.beat, type: "move-start", moveId: slot.moveId });
    if (mistake) {
      seg.push({
        atBeat: slot.beat,
        type: "mistake",
        moveId: slot.moveId,
        severity: mistake.severity,
        text: mistake.reason,
        payload: { mistakeType: mistake.type },
      });
      if (mistake.type === "disconnect") this.teamStrain = Math.min(3, this.teamStrain + 1);
    }
    seg.push({ atBeat: slot.beat + def.beats - 1, type: "move-complete", moveId: slot.moveId, payload: { ok: !mistake } });
  }

  private classifyMistake(a: SlotAnalysis, sev: number, risk: number): MistakeRecord {
    const def = MOVES[a.slot.moveId];
    const severity: 1 | 2 | 3 = sev > 80 ? 3 : sev > 68 ? 2 : 1;
    let type: MistakeType;
    let reason: string;

    const narrow =
      this.trial.narrowBeats.includes(a.slot.beat) && (a.slot.moveId === "coil" || a.slot.moveId === "leap");
    const unobserved = (a.slot.moveId === "thread" || a.slot.moveId === "leap") && !a.observedBefore;
    const pulled = a.transition === "risky";

    if ((a.slot.moveId === "thread" && (unobserved || pulled)) || ((a.slot.moveId === "leap" || a.slot.moveId === "rise") && pulled)) {
      type = "disconnect";
      reason =
        a.slot.moveId === "thread"
          ? `第${a.slot.beat}拍「穿」之前没有探或回望，龙身与队伍脱节。`
          : `第${a.slot.beat}拍「${def.name}」前的「${MOVES[a.prevMove!].name}」拉扯了龙身，队伍没有跟上。`;
    } else if (narrow && !a.observedBefore) {
      type = "lanternTouch";
      reason = `第${a.slot.beat}拍「${def.name}」在狭窄路段没有先观察，碰到了灯。`;
    } else if (def.highRisk && (this.intent.expression >= 62 || this.hasMemory("chaseTheSpotlight"))) {
      type = "overshoot";
      reason = `第${a.slot.beat}拍「${def.name}」幅度过猛，越过了收势点。`;
    } else if (
      this.intent.rhythm < 42 ||
      sample01(this.trial.id, a.slot.beat, "timing", a.occurrence) > 0.72
    ) {
      type = "early";
      reason = `第${a.slot.beat}拍「${def.name}」抢在鼓点之前动了。`;
    } else if (this.intent.coordination >= 55 && this.intent.rhythm < 55) {
      type = "hesitate";
      reason = `第${a.slot.beat}拍「${def.name}」在等身后的队伍，起势迟了半拍。`;
    } else {
      type = "overshoot";
      reason = `第${a.slot.beat}拍「${def.name}」收势不稳，越过了预测线。`;
    }

    if (risk < 30) {
      return { beat: a.slot.beat, moveId: a.slot.moveId, moveName: def.name, type, severity: 1, reason };
    }
    return { beat: a.slot.beat, moveId: a.slot.moveId, moveName: def.name, type, severity, reason };
  }

  /** 演出全部结束后调用：评分、隐藏状态与事实摘要。 */
  result(): PerformanceResult {
    if (!this.finished) {
      while (this.cursor < this.analyses.length) {
        this.executeMove(this.analyses[this.cursor], []);
        this.cursor++;
      }
      this.finished = true;
    }
    return computeResult({
      trial: this.trial,
      outcomes: this.outcomes,
      corrections: this.corrections,
      analyses: this.analyses,
      intent: this.intent,
      memoryTriggers: this.memoryTriggers,
      finalDecision: this.finalDecision,
    });
  }
}

// ————————————————— 评分 —————————————————

export function computeResult(input: {
  trial: TrialConfig;
  outcomes: MoveOutcome[];
  corrections: CorrectionRecord[];
  analyses: SlotAnalysis[];
  intent: TrainingIntent;
  memoryTriggers: MemoryTriggerRecord[];
  finalDecision: FinalDecision | null;
}): PerformanceResult {
  const { trial, outcomes, corrections, analyses, intent, memoryTriggers, finalDecision } = input;

  const mistakes = outcomes.map((o) => o.mistake).filter((m): m is MistakeRecord => !!m);
  const sevPenalty = (s: number) => (s === 3 ? 16 : s === 2 ? 11 : 6);

  // 稳
  let stability = 66;
  for (const m of mistakes) stability -= sevPenalty(m.severity);
  if (memoryTriggers.some((t) => t.id === "steadyTheHead")) stability += 5;
  for (const c of corrections) stability += c.grade === "perfect" ? 4 : c.grade === "near" ? 2 : -2;
  stability += (intent.stability - 50) * 0.55;

  // 韵
  let rhythm = 60;
  rhythm += analyses.filter((a) => a.transition === "good").length * 3;
  rhythm -= analyses.filter((a) => a.transition === "risky").length * 4;
  for (const m of mistakes) rhythm -= m.type === "early" ? 8 : m.type === "hesitate" ? 6 : 3;
  for (const c of corrections) rhythm += c.grade === "perfect" ? 5 : c.grade === "near" ? 2 : -3;
  rhythm += (intent.rhythm - 50) * 0.45;

  // 合
  let coordination = 58;
  coordination += analyses.filter((a) => a.slot.moveId === "lookBack").length * 5;
  coordination += analyses.filter((a) => a.transition === "good").length * 2;
  for (const m of mistakes) coordination -= m.type === "disconnect" ? 12 : m.type === "lanternTouch" ? 4 : 2;
  if (memoryTriggers.some((t) => t.id === "lookBackForTeam")) coordination += 6;
  coordination += (intent.coordination - 50) * 0.55;
  if (finalDecision?.lookedBack) coordination += 10;

  // 意
  let expression = 46;
  for (const o of outcomes) {
    const def = MOVES[o.moveId];
    expression += o.ok ? def.expressionGain : def.expressionGain * 0.4;
  }
  expression -= mistakes.length * 2;
  if (memoryTriggers.some((t) => t.id === "chaseTheSpotlight")) expression += 6;
  expression += (intent.expression - 50) * 0.55;
  if (finalDecision && !finalDecision.lookedBack) expression += 4;

  const scores = {
    stability: Math.round(clamp(stability, 0, 100)),
    rhythm: Math.round(clamp(rhythm, 0, 100)),
    coordination: Math.round(clamp(coordination, 0, 100)),
    expression: Math.round(clamp(expression, 0, 100)),
  };

  // —— 隐藏状态（因果词典基线，TECH_SPEC §11）——
  let masterTrust = 0;
  let teamBond = 0;
  let audienceHeat = 0;

  masterTrust += analyses.filter((a) => a.transition === "good").length * 3;
  // 抢先争彩：即使失误，大幅度本身也带热度
  audienceHeat += memoryTriggers.filter((t) => t.id === "chaseTheSpotlight").length * 3;
  for (const a of analyses) {
    if (MOVES[a.slot.moveId].highRisk && a.lookBackNearby) {
      teamBond += 6;
      masterTrust += 2;
    }
    const o = outcomes.find((x) => x.beat === a.slot.beat);
    if (o && o.ok && (a.slot.moveId === "rise" || a.slot.moveId === "leap")) {
      audienceHeat += 8;
      masterTrust += 1;
      if (memoryTriggers.some((t) => t.id === "chaseTheSpotlight" && t.atBeat === a.slot.beat)) audienceHeat += 4;
    }
    if (
      o?.mistake?.type === "disconnect" &&
      (a.slot.moveId === "rise" || a.slot.moveId === "leap" || a.slot.moveId === "thread")
    ) {
      teamBond -= 8;
      masterTrust -= 5;
      audienceHeat += 2;
    }
  }
  for (const c of corrections) {
    masterTrust += c.grade === "perfect" ? 3 : c.grade === "near" ? 1 : -1;
  }
  if (finalDecision?.lookedBack) {
    teamBond += 12;
    masterTrust += 8;
    const highPointAfter = outcomes.find(
      (o) => o.beat > (trial.incidentBeat ?? 99) && o.ok && (o.moveId === "rise" || o.moveId === "leap")
    );
    if (highPointAfter) audienceHeat += 5;
  }

  const hiddenDelta = { masterTrust, teamBond, audienceHeat };

  // —— 硬目标 ——
  const lanternTouches = mistakes.filter((m) => m.type === "lanternTouch").length;
  const heavyDisconnects = mistakes.filter((m) => m.type === "disconnect" && m.severity === 3).length;
  const hardGoalPassed =
    trial.index === 2 ? lanternTouches === 0 && heavyDisconnects === 0 : lanternTouches === 0;

  const completion = Math.round(
    clamp(0.45 * scores.stability + 0.35 * scores.rhythm + 0.2 * (hardGoalPassed ? 100 : 0), 0, 100)
  );

  // —— 事实摘要（训练记忆候选依据）——
  const observeThenThreadCount = analyses.filter(
    (a) => a.slot.moveId === "thread" && a.prevMove && (a.prevMove === "probe" || a.prevMove === "lookBack")
  ).length;
  const lookBackBeforeHighRisk = analyses.filter(
    (a) =>
      MOVES[a.slot.moveId].highRisk &&
      analyses.some((p) => p.slot.moveId === "lookBack" && p.slot.beat >= a.slot.beat - 2 && p.slot.beat < a.slot.beat)
  ).length;
  const expressiveMoveCount = analyses.filter((a) => a.slot.moveId === "rise" || a.slot.moveId === "leap").length;
  const worstMistake =
    mistakes.length > 0 ? [...mistakes].sort((x, y) => y.severity - x.severity || y.beat - x.beat)[0] : null;

  return {
    trialIndex: trial.index,
    outcomes,
    mistakes,
    corrections,
    memoryTriggers,
    scores,
    hiddenDelta,
    hardGoalPassed,
    completion,
    facts: {
      observeThenThreadCount,
      lookBackBeforeHighRisk,
      expressiveMoveCount,
      correctionCount: corrections.length,
      worstMistake,
    },
    finalDecision,
  };
}
