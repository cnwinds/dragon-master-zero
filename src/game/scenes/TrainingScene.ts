// 训练场景：读阵 → 编舞（竹简×鼓谱）→ 传意（口令）→ 进入演练。
// PC 与触控共用“点选竹简—点选拍位”，同时支持鼠标拖放。

import Phaser from "phaser";
import { TRIALS } from "../content/trials";
import { MOVES } from "../content/moves";
import { analyzeTimeline, isTimelineFull, removeAt, tryPlace } from "../systems/timeline";
import { interpretCommand, validateCommandText } from "../systems/commandInterpreter";
import { StageRenderer } from "../render/stage";
import { TroupeRenderer } from "../entities/troupe";
import { buildTray, buildTimeline, buildCommandPanel, clearUI, showTopBar, playDialogue, toast, type TrayController, type TimelineController, type CommandPanelController } from "../../ui/dom";
import { SPEAKER_NAMES } from "../content/dialogue";
import { getRun, setRun } from "../../main";
import { audioBus } from "../systems/audio";
import { writeCheckpoint } from "../systems/saveHelpers";
import type { MoveId, TrainingIntent } from "../../../shared/types";
import { addVignette, addFireflies } from "../render/atmosphere";

export class TrainingScene extends Phaser.Scene {
  private trial = TRIALS[0];
  private slots: Array<{ beat: number; moveId: MoveId }> = [];
  private pickedMove: MoveId | null = null;
  private tray!: TrayController;
  private timeline!: TimelineController;
  private panel!: CommandPanelController;
  private stage!: StageRenderer;
  private troupe!: TroupeRenderer;
  private intent: TrainingIntent | null = null;
  private busy = false;

  constructor() {
    super("Training");
  }

  create(data: { trialIndex?: number }): void {
    clearUI();
    const run = getRun();
    this.trial = TRIALS[data.trialIndex ?? run.trialIndex];
    run.trialIndex = this.trial.index;
    run.phase = this.trial.index === 0 ? "training-1" : this.trial.index === 1 ? "training-2" : "final-training";
    setRun(run);
    writeCheckpoint(run);
    this.slots = [];
    this.intent = null;
    this.pickedMove = null;
    this.busy = false;

    // 舞台与龙队待机
    this.stage = new StageRenderer(this);
    this.stage.build(this.trial.scene);
    addVignette(this, 0.22);
    addFireflies(this, this.trial.scene === "yard" ? 6 : 12);
    this.troupe = new TroupeRenderer(this);
    this.troupe.reset();

    // 预测轨迹（编排预览）
    this.events.on(Phaser.Scenes.Events.UPDATE, this.onSceneUpdate, this);

    this.buildInterface();

    // 开场指引
    const intro = this.trial.intro.map((l) => {
      const [speaker, ...rest] = l.split("：");
      return { speaker: this.speakerKey(speaker), text: rest.join("：") };
    });
    playDialogue(intro, SPEAKER_NAMES, {
      speedMs: 40,
      onDone: () => {
        toast(`阵势目标：${this.trial.goals.hard}`, 3200);
      },
    });
  }

  private speakerKey(name: string): string {
    if (name.includes("师傅")) return "master";
    if (name.includes("小满")) return "xiaoman";
    if (name.includes("执事")) return "steward";
    return "narration";
  }

  private buildInterface(): void {
    showTopBar(this.trial.title, this.trial.goals.hard, this.trial.goals.soft);

    this.tray = buildTray({
      unlocked: this.trial.unlockedMoves,
      onPick: (moveId) => {
        if (this.busy) return;
        const count = this.slots.filter((s) => s.moveId === moveId).length;
        if (count >= 2) {
          toast(`「${MOVES[moveId].name}」每轮最多两次`, 1800);
          audioBus.place(false);
          return;
        }
        this.pickedMove = this.pickedMove === moveId ? null : moveId;
        this.tray.setSelected(this.pickedMove);
        audioBus.place(true);
        this.timeline.setHint(
          this.pickedMove ? `已选「${MOVES[this.pickedMove].name}」，点选要放入的拍位` : ""
        );
      },
    });

    this.timeline = buildTimeline({
      interactive: true,
      onPlace: (beat) => this.handlePlace(beat),
      onRemove: (beat) => {
        if (this.busy) return;
        this.slots = removeAt(this.slots, beat);
        this.refreshTimeline();
        audioBus.bambooNow();
      },
    });

    this.panel = buildCommandPanel({
      suggestions: this.trial.suggestedCommands,
      onSubmit: (text) => this.handleCommand(text),
      onStart: () => this.startPerformance(),
      startEnabled: () => isTimelineFull(this.slots) && this.intent !== null,
      startLabel: this.trial.index === 2 ? "登上舞台" : "开始演练",
    });

    this.refreshTimeline();
  }

  private handlePlace(beat: number): void {
    if (this.busy) return;
    // 已占用 → 移除（再次编辑）
    const existing = this.slots.find((s) => s.beat === beat || (MOVES[s.moveId].beats === 2 && beat === s.beat + 1));
    if (existing) {
      this.slots = removeAt(this.slots, beat);
      this.refreshTimeline();
      audioBus.bambooNow();
      return;
    }
    if (!this.pickedMove) {
      this.timeline.setHint("先从左侧选一张动作竹简");
      return;
    }
    const result = tryPlace(this.slots, this.pickedMove, beat, this.trial.unlockedMoves);
    if (!result.ok) {
      toast(result.reason, 2200);
      this.timeline.setHint(result.reason);
      audioBus.place(false);
      // 竹简弹回
      this.pickedMove = null;
      this.tray.setSelected(null);
      return;
    }
    this.slots = result.slots;
    audioBus.place(true);
    const count = this.slots.filter((s) => s.moveId === this.pickedMove).length;
    if (count >= 2) {
      this.pickedMove = null;
      this.tray.setSelected(null);
    }
    this.refreshTimeline();
  }

  private refreshTimeline(): void {
    const analyses = analyzeTimeline(this.slots);
    const ok: number[] = [];
    const bad: number[] = [];
    const risk: number[] = [];
    analyses.forEach((a) => {
      if (a.transition === "good") ok.push(a.slot.beat);
      if (a.transition === "risky") risk.push(a.slot.beat);
      if ((a.slot.moveId === "thread" || a.slot.moveId === "leap") && !a.observedBefore) bad.push(a.slot.beat);
    });
    this.timeline.update(this.slots, { ok, bad, risk });
    this.tray.updateCounts(
      this.trial.unlockedMoves.reduce<Record<string, number>>((acc, m) => {
        acc[m] = this.slots.filter((s) => s.moveId === m).length;
        return acc;
      }, {})
    );
    this.timeline.setHint(
      isTimelineFull(this.slots) ? "鼓谱已满。去右侧写下口令，然后开始演练。" : "把八拍填满才能开始演练"
    );
  }

  private async handleCommand(text: string): Promise<void> {
    if (this.busy) return;
    const err = validateCommandText(text);
    if (err) {
      this.panel.setError(err);
      return;
    }
    this.busy = true;
    this.panel.setBusy();
    const placed = this.slots.map((s) => s.moveId);
    const outcome = await interpretCommand(text.trim(), this.trial.id, this.trial.unlockedMoves, placed);
    this.intent = outcome.intent;
    this.panel.setResult(outcome.intent, outcome.status);
    this.busy = false;
  }

  private startPerformance(): void {
    if (!isTimelineFull(this.slots) || !this.intent || this.busy) return;
    const run = getRun();
    run.choreographies[this.trial.index] = {
      trialId: this.trial.id,
      slots: [...this.slots],
      command: "",
      intent: this.intent,
    };
    setRun(run);
    audioBus.stopBeatClock();
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.time.delayedCall(420, () => {
      this.scene.start("Performance", { trialIndex: this.trial.index });
    });
  }

  private onSceneUpdate(_time: number, delta: number): void {
    this.stage.update(delta, this.time.now / 1000);
    this.troupe.update(delta, {
      beatFloat: 0,
      currentMove: null,
      moveT: 0,
      amplitude: 1,
      lagMs: 0,
      lookBack: false,
      teamStrained: false,
      incident: false,
    });
  }
}
