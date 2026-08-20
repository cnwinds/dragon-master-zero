// 演出场景：八拍自主演出 + 鼓点纠偏 + 双轨迹 + 终局自主决策。
// 场景时钟驱动事件队列；纠偏窗口与剧情事件触发时暂停推进，等待玩家/剧情。

import Phaser from "phaser";
import { TRIALS } from "../content/trials";
import { MOVES } from "../content/moves";
import { PerformanceEngine, type EngineEvent, type Segment } from "../systems/performanceEngine";
import { StageRenderer } from "../render/stage";
import { TroupeRenderer } from "../entities/troupe";
import { PathRenderer } from "../render/paths";
import { buildDrum, buildTimeline, clearUI, showTopBar, toast, type DrumController, type TimelineController } from "../../ui/dom";
import { getRun, setRun } from "../../main";
import { advanceAfterPerformance } from "../GameState";
import { audioBus } from "../systems/audio";
import type { CorrectionGrade, MoveId } from "../../../shared/types";
import { addVignette, addFireflies } from "../render/atmosphere";

const INTRO_BEATS = 2;

export class PerformanceScene extends Phaser.Scene {
  private trial = TRIALS[0];
  private engine!: PerformanceEngine;
  private stage!: StageRenderer;
  private troupe!: TroupeRenderer;
  private paths!: PathRenderer;
  private timelineC!: TimelineController;
  private drum!: DrumController;

  private perfTime = 0;
  private started = false;
  private beatMs = 1000;
  private mode: "waiting" | "playing" | "window" | "incident" | "done" = "waiting";
  private queue: EngineEvent[] = [];
  private currentMove: { moveId: MoveId; beat: number } | null = null;
  private windowsBeats: number[] = [];
  private windowBeat = 0;
  private windowOpenedAt = 0;
  private windowSettled = false;
  private mistakeMarks: Array<{ x: number; y: number; type: string }> = [];
  private strainBeat = -99;
  private predictedPts: Array<{ x: number; y: number }> = [];
  private finished = false;

  constructor() {
    super("Performance");
  }

  create(data: { trialIndex?: number }): void {
    clearUI();
    // Phaser 会复用场景实例：所有可变状态必须在此重置
    this.perfTime = 0;
    this.started = false;
    this.mode = "waiting";
    this.queue = [];
    this.currentMove = null;
    this.windowsBeats = [];
    this.windowBeat = 0;
    this.windowOpenedAt = 0;
    this.windowSettled = false;
    this.mistakeMarks = [];
    this.strainBeat = -99;
    this.predictedPts = [];
    this.finished = false;

    const run = getRun();
    this.trial = TRIALS[data.trialIndex ?? run.trialIndex];
    const choreo = run.choreographies[this.trial.index];

    this.engine = new PerformanceEngine({
      trial: this.trial,
      slots: choreo.slots,
      intent: choreo.intent,
      memories: run.memories,
    });
    this.windowsBeats = this.engine.windowBeats();

    this.stage = new StageRenderer(this);
    this.stage.build(this.trial.scene);
    addVignette(this, 0.24);
    addFireflies(this, this.trial.scene === "yard" ? 6 : 12);
    this.troupe = new TroupeRenderer(this);
    this.troupe.reset();
    this.paths = new PathRenderer(this);
    this.beatMs = 60000 / this.trial.bpm;
    this.buildPredictedPath(choreo.slots);

    showTopBar(
      this.trial.index === 2 ? "最终演出 · 龙抬头" : `演练 · ${this.trial.title}`,
      this.trial.goals.hard,
      this.trial.goals.soft
    );
    this.timelineC = buildTimeline({ interactive: false, onPlace: () => {}, onRemove: () => {} });
    this.timelineC.update(choreo.slots, { windows: this.windowsBeats });
    this.timelineC.lock();
    this.drum = buildDrum({ onHit: () => this.handleDrumHit() });
    this.drum.setTokens(2);
    this.drum.setEnabled(false);

    this.input.keyboard?.on("keydown-SPACE", () => this.handleDrumHit());

    this.cameras.main.fadeIn(500, 0, 0, 0);
    const patterns: Record<number, number[]> = {
      0: [1, 0.5, 0.72, 0.5],
      1: [1, 0.45, 0.7, 0.5, 0.85, 0.45, 0.68, 0.5],
      2: [1, 0.5, 0.8, 0.55, 0.9, 0.5, 0.8, 0.6],
    };
    audioBus.startBeatClock(this.trial.bpm, patterns[this.trial.index] ?? patterns[0], () => {});
    if (this.trial.index === 2) audioBus.gong(0.9);

    this.time.delayedCall(this.beatMs * INTRO_BEATS, () => {
      this.started = true;
      this.mode = "playing";
      this.loadNextSegment();
      this.timelineC.setHint("演练开始——看蓝线与竹青线的偏差");
    });

    this.events.on(Phaser.Scenes.Events.UPDATE, this.onSceneUpdate, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      audioBus.stopBeatClock();
      this.events.off(Phaser.Scenes.Events.UPDATE, this.onSceneUpdate, this);
      this.input.keyboard?.removeAllListeners();
    });

    // 诊断探针
    (window as unknown as { __perfDebug?: () => unknown }).__perfDebug = () => ({
      mode: this.mode,
      started: this.started,
      finished: this.finished,
      perfTime: Math.round(this.perfTime),
      beatMs: Math.round(this.beatMs),
      queue: this.queue.map((e) => `${e.type}@${e.atBeat}`),
      tokens: this.engine.correctionTokensLeft(),
      currentMove: this.currentMove ? `${this.currentMove.moveId}@${this.currentMove.beat}` : null,
    });
  }

  private buildPredictedPath(slots: Array<{ beat: number; moveId: MoveId }>): void {
    const GROUND = 790 - 96;
    let x = 430;
    for (const slot of slots) {
      const def = MOVES[slot.moveId];
      const steps = def.beats * 10;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        let px = x + 128 * t;
        let py = GROUND;
        switch (slot.moveId) {
          case "rise": py -= 92 * Math.sin(t * Math.PI); break;
          case "coil": {
            const ang = t * Math.PI * 2 - Math.PI / 2;
            px += Math.cos(ang) * 52 - 20 * t;
            py += Math.sin(ang) * 46 - 6;
            break;
          }
          case "leap": {
            if (t < 0.32) py += 26 * Math.sin((t / 0.32) * Math.PI * 0.5);
            else py -= 232 * Math.sin(((t - 0.32) / 0.68) * Math.PI);
            break;
          }
          case "probe": py += 10 * Math.sin(t * Math.PI); break;
          case "thread": py += 16 * Math.sin(t * Math.PI) - 8; break;
          case "lookBack": px -= 22 * Math.sin(t * Math.PI); break;
        }
        this.predictedPts.push({ x: px, y: py });
      }
      x += 128 * def.beats;
    }
  }

  private loadNextSegment(): void {
    if (this.finished) return;
    const seg: Segment = this.engine.nextSegment();
    this.queue.push(...seg.events);
    // 恢复推进；段内的 correction-window / incident 事件触发时会再次暂停
    this.mode = "playing";
  }

  private handleDrumHit(): void {
    if (this.mode !== "window" || this.windowSettled) return;
    const dt = this.time.now - this.windowOpenedAt - this.beatMs * 0.55;
    const adt = Math.abs(dt);
    // 第一轮教学：命中窗口更宽（GDD §20 节奏门槛应对）
    const perfectW = this.trial.index === 0 ? 250 : 175;
    const nearW = this.trial.index === 0 ? 580 : 440;
    const grade: CorrectionGrade = adt <= perfectW ? "perfect" : adt <= nearW ? "near" : "wrong";
    this.settleWindow(grade);
  }

  private settleWindow(grade: CorrectionGrade | null): void {
    if (this.windowSettled) return;
    this.windowSettled = true;
    this.drum.setEnabled(false);
    if (grade) {
      this.drum.showGrade(grade);
      audioBus.correction(grade);
      this.timelineC.setHint(
        grade === "perfect" ? "正拍！实际轨迹立刻收回预测线" : grade === "near" ? "近拍，勉强压住" : "错拍，反而扰了下一拍"
      );
    } else {
      this.drum.showGrade(null);
      this.timelineC.setHint("没有纠偏——让它自己面对");
    }
    this.engine.submitCorrection(grade);
    this.drum.setTokens(this.engine.correctionTokensLeft());
    this.time.delayedCall(950, () => {
      this.drum.showGrade(null);
      this.loadNextSegment();
    });
  }

  private playIncident(): void {
    this.mode = "incident";
    toast("小满被灯绳绊住了！", 1500);
    audioBus.beep(false, 0.9);
    this.cameras.main.shake(240, 0.004);
    this.troupe.setTeamStrained(true);
    this.troupe.setIncidentFlag(true);

    // 灯绳缠绕标记（朱砂，画在小满身位）
    const headP = this.troupe.headPos;
    const mx = headP.x - 100;
    const my = 790;
    const rope = this.add.graphics().setDepth(60);
    rope.lineStyle(4, 0xb64036, 0.95);
    rope.beginPath();
    rope.moveTo(mx - 46, my - 96);
    rope.lineTo(mx - 12, my - 74);
    rope.lineTo(mx - 30, my - 56);
    rope.lineTo(mx + 10, my - 36);
    rope.strokePath();
    rope.strokeCircle(mx + 18, my - 60, 15);
    const ropeGlow = this.add.image(mx + 6, my - 64, "tex-glow").setScale(1.6).setTint(0xd96a5a).setAlpha(0.5).setDepth(59);
    this.tweens.add({ targets: ropeGlow, alpha: { from: 0.25, to: 0.6 }, duration: 420, yoyo: true, repeat: 6 });
    this.tweens.add({ targets: [rope, ropeGlow], alpha: 0, duration: 700, delay: 2600 });
    this.tweens.add({ targets: this.cameras.main, zoom: 1.07, duration: 900, yoyo: true });

    this.time.delayedCall(750, () => {
      // 阿零决策停顿（扫描缝变朱砂）
    });

    this.time.delayedCall(1300, () => {
      const decision = this.engine.resolveIncident();
      if (decision.lookedBack) {
        this.troupe.setLookBack(true);
        audioBus.bambooNow(1);
        toast(`它停住了。${decision.reasons.join("，") || "协作的侧重"}——它选择了回头`, 2600);
      } else {
        toast(`它没有回头。${decision.reasons.join("，") || "预测线"}仍指向高点`, 2600);
      }
    });

    this.time.delayedCall(3300, () => {
      this.troupe.setIncidentFlag(false);
      this.loadNextSegment();
    });
  }

  private onSceneUpdate(_t: number, delta: number): void {
    this.stage.update(delta, this.time.now / 1000);
    if (!this.started) return;

    if (this.mode === "playing") {
      this.perfTime += delta;
      const beatFloat = this.perfTime / this.beatMs + 1;

      while (this.queue.length && this.queue[0].atBeat <= beatFloat + 0.002) {
        const ev = this.queue.shift()!;
        this.fireEvent(ev, beatFloat);
        if (this.mode !== "playing") break;
      }
    }

    // 张力恢复：观察类动作完成或两个拍位后
    const bf = this.perfTime / this.beatMs + 1;
    if (this.troupe.getTeamStrained() && bf - this.strainBeat > 2.2 && this.mode === "playing") {
      this.troupe.setTeamStrained(false);
    }

    // 窗口超时（第一轮教学更宽）
    const windowTimeout = this.beatMs * (this.trial.index === 0 ? 1.7 : 1.2);
    if (this.mode === "window" && !this.windowSettled && this.time.now - this.windowOpenedAt > windowTimeout) {
      this.settleWindow(null);
    }

    // 龙队状态
    const cm = this.currentMove;
    if (cm && (this.mode === "playing" || this.mode === "window")) {
      const moveBeats = MOVES[cm.moveId].beats;
      const outcome = this.engine.getOutcomes().find((o) => o.beat === cm.beat);
      const rawT = (bf - cm.beat) / moveBeats;
      this.troupe.update(delta, {
        beatFloat: bf,
        currentMove: cm.moveId,
        moveT: Phaser.Math.Clamp(rawT, 0, 1),
        amplitude: outcome?.amplitude ?? 1,
        lagMs: outcome?.lagMs ?? 0,
        lookBack: cm.moveId === "lookBack",
        teamStrained: false,
        incident: false,
      });
    } else {
      this.troupe.update(delta, {
        beatFloat: bf,
        currentMove: null,
        moveT: 0,
        amplitude: 1,
        lagMs: 0,
        lookBack: false,
        teamStrained: false,
        incident: false,
      });
    }

    this.timelineC.setNow(Phaser.Math.Clamp(Math.ceil(bf), 1, 8));

    // 轨迹
    this.paths.clear();
    this.paths.drawPredicted(this.predictedPts);
    this.paths.drawActual(this.troupe.trail);
    for (const m of this.mistakeMarks) this.paths.markMistake(m.x, m.y, m.type as never);
  }

  private fireEvent(ev: EngineEvent, beatFloat: number): void {
    switch (ev.type) {
      case "move-start": {
        this.currentMove = { moveId: ev.moveId!, beat: ev.atBeat };
        break;
      }
      case "mistake": {
        const head = this.troupe.headPos;
        this.mistakeMarks.push({ x: head.x + 30, y: head.y - 50, type: String(ev.payload?.mistakeType ?? "overshoot") });
        this.showMistakeToast(ev.text ?? "");
        this.strainBeat = beatFloat;
        this.troupe.setTeamStrained(ev.payload?.mistakeType === "disconnect");
        if ((ev.severity ?? 1) >= 3) this.cameras.main.shake(220, 0.006);
        break;
      }
      case "memory-triggered": {
        this.showMemoryToast(ev.text ?? "");
        audioBus.bambooNow(0.7);
        break;
      }
      case "correction-window": {
        this.mode = "window";
        this.windowBeat = ev.atBeat;
        this.windowOpenedAt = this.time.now;
        this.windowSettled = false;
        this.drum.setEnabled(true);
        this.drum.showWindow();
        this.timelineC.setNow(this.windowBeat);
        this.timelineC.setHint("关键拍——圆环收拢时击鼓");
        break;
      }
      case "incident": {
        this.playIncident();
        break;
      }
      case "performance-complete": {
        this.mode = "done";
        this.time.delayedCall(700, () => this.finishPerformance());
        break;
      }
      default:
        break;
    }
  }

  private showMistakeToast(text: string): void {
    const t = document.createElement("div");
    t.className = "toast";
    t.style.borderColor = "var(--cinnabar)";
    t.textContent = text;
    document.getElementById("ui-root")!.append(t);
    window.setTimeout(() => t.remove(), 2600);
  }

  private showMemoryToast(text: string): void {
    const t = document.createElement("div");
    t.className = "toast";
    t.style.borderColor = "var(--gold)";
    t.style.top = "24%";
    t.textContent = text;
    document.getElementById("ui-root")!.append(t);
    window.setTimeout(() => t.remove(), 2400);
  }

  private finishPerformance(): void {
    if (this.finished) return;
    this.finished = true;
    const result = this.engine.result();
    const run = getRun();
    setRun(advanceAfterPerformance(run, result));
    audioBus.stopBeatClock();

    // 结尾定格
    this.timelineC.setHint("演练结束");
    this.cameras.main.fadeOut(700, 0, 0, 0);
    this.time.delayedCall(760, () => {
      if (this.trial.index === 2) this.scene.start("Ending");
      else this.scene.start("Review", { trialIndex: this.trial.index });
    });
  }
}
