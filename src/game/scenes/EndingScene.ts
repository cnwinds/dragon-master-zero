// 结局：三选一判定已由系统完成；这里呈现定格竹刻画、尾声对白与重玩。

import Phaser from "phaser";
import { clearUI, el, playDialogue } from "../../ui/dom";
import { resolveEnding } from "../systems/endings";
import { ENDING_TEXT, LIGHTSFADE_EPILOGUE, SPEAKER_NAMES } from "../content/dialogue";
import { getRun, setRun, getSave, putSave } from "../../main";
import { markEndingReached } from "../systems/saveHelpers";
import { audioBus } from "../systems/audio";
import { buildSerpent } from "../render/serpent";
import { addVignette, addFireflies } from "../render/atmosphere";

export class EndingScene extends Phaser.Scene {
  constructor() {
    super("Ending");
  }

  create(): void {
    clearUI();
    const run = getRun();
    const result = run.lastResult!;
    const resolution = resolveEnding(result, run.hidden);
    run.endingId = resolution.ending;
    run.phase = "ending";
    setRun(run);
    markEndingReached(resolution.ending);

    const ending = ENDING_TEXT[resolution.ending];

    // ———— 定格竹刻画 ————
    this.paintTableau(resolution.ending, result.finalDecision?.lookedBack === true);

    if (audioBus.musicOn) {
      audioBus.gong(resolution.ending === "trueApprentice" ? 1 : 0.6);
      if (resolution.ending === "championMachine") audioBus.crowd(1, 2.4);
    }

    // ———— 结局标题 ————
    const title = el("div", { class: "ending-ui" },
      el("div", { class: "ending-title", text: ending.title })
    );
    document.getElementById("ui-root")!.append(title);

    this.time.delayedCall(1900, () => {
      title.remove();
      // ———— 尾声对白 ————
      const lines = [...ending.lines];
      if (resolution.ending === "lightsFade") {
        lines.push({ speaker: "narration", text: LIGHTSFADE_EPILOGUE[resolution.epilogueKey ?? "balance"], hold: 3.2 });
      }
      const dlg = playDialogue(lines, SPEAKER_NAMES, {
        speedMs: 55,
        onDone: () => this.showFinalPanel(resolution.ending, resolution.matched),
      });
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => dlg.destroy());
    });
  }

  private paintTableau(ending: string, lookedBack: boolean): void {
    const g = this.add.graphics();
    // 深夜底
    g.fillGradientStyle(0x060c16, 0x060c16, 0x0e1d31, 0x16324c, 1);
    g.fillRect(0, 0, 1920, 1080);
    this.add.image(0, 330, "tex-hill").setOrigin(0, 0).setAlpha(0.5).setTint(0x24405c);
    addVignette(this, 0.26);
    addFireflies(this, 14, { x0: 80, x1: 1840, y0: 400, y1: 880 });

    // 灯海
    for (let i = 0; i < 40; i++) {
      const x = 40 + (i % 20) * 96 + (Math.floor(i / 20) === 0 ? 0 : 44);
      const y = 620 + Math.floor(i / 20) * 60;
      this.tweens.add({
        targets: this.add.image(x, y, "tex-glow").setScale(0.7 + (i % 3) * 0.2).setAlpha(0.4).setTint(0xf0c27a),
        alpha: { from: 0.3, to: 0.55 },
        duration: 1800 + (i % 5) * 380,
        yoyo: true,
        repeat: -1,
        delay: i * 80,
      });
    }

    // 整龙定格：回望之龙（弧线折向队伍）或孤高之龙（直冲高点）
    buildSerpent(this, {
      points: lookedBack
        ? [
            { x: 300, y: 720 },
            { x: 520, y: 620 },
            { x: 760, y: 500 },
            { x: 1000, y: 520 },
            { x: 1220, y: 620 },
            { x: 1420, y: 590 },
            { x: 1560, y: 540 },
          ]
        : [
            { x: 300, y: 720 },
            { x: 560, y: 560 },
            { x: 860, y: 400 },
            { x: 1180, y: 360 },
            { x: 1480, y: 330 },
            { x: 1740, y: 300 },
          ],
      headScale: 1.0,
      maxRadius: 30,
      segmentEvery: 96,
      alpha: 0.95,
    });

    // 队伍剪影
    const team = this.add.graphics();
    team.fillStyle(0x1c2c3c, 0.95);
    for (const x of [420, 560, 700, 840]) {
      team.fillRect(x - 9, 830, 18, 76);
      team.fillCircle(x, 818, 11);
    }
    // 阿零
    team.lineStyle(8, 0x9aa7b0, 1);
    team.beginPath();
    team.moveTo(950, 910);
    team.lineTo(lookedBack ? 938 : 962, 800);
    team.strokePath();
    team.fillStyle(0xb9c4cc, 1);
    team.fillRoundedRect(lookedBack ? 928 : 952, 778, 22, 26, 6);
    team.fillStyle(lookedBack ? 0x72a9c2 : 0xb64036, 1);
    team.fillRect(lookedBack ? 926 : 956, 788, 18, 4);

    // 落款印章
    const seal = this.add.image(1710, 880, "tex-sealbg").setScale(0.9).setAlpha(0.92);
    const label = this.add.text(1710, 880, ENDING_TEXT[ending as keyof typeof ENDING_TEXT].tableau, {
      fontFamily: '"Noto Serif SC","Source Han Serif SC","STSong","SimSun",serif',
      fontSize: "38px",
      color: "#e9e0c8",
    }).setOrigin(0.5);
    void seal;
    void label;

    // 宣纸颗粒
    this.add.image(0, 0, "tex-paper").setOrigin(0, 0).setDisplaySize(1920, 1080).setAlpha(0.07);

    // 缓慢推近
    this.cameras.main.setZoom(1.0);
    this.tweens.add({
      targets: this.cameras.main,
      zoom: 1.06,
      duration: 9000,
      ease: "Sine.easeInOut",
    });
  }

  private showFinalPanel(endingId: string, matched: string[]): void {
    const run = getRun();
    const names: Record<string, string> = { trueApprentice: "真正出师", championMachine: "冠军机器", lightsFade: "灯散之后" };

    const replay = () => {
      const save = getSave();
      save.checkpoint = null;
      putSave(save);
      setRun({ ...run, phase: "title" });
      this.scene.start("Prologue");
    };
    const toTitle = () => {
      const save = getSave();
      save.checkpoint = null;
      putSave(save);
      this.scene.start("Title");
    };

    const panel = el("div", { class: "center-panel", style: "width:min(560px,92vw);text-align:center" },
      el("h2", { text: names[endingId] }),
      el("div", { class: "sub", text: matched.join(" · ") }),
      el("div", {
        style: "font-size:13px;color:var(--mist);line-height:1.8;margin:6px 0 14px",
        text: `隐藏状态——师傅信任 ${run.hidden.masterTrust} ／ 队伍同心 ${run.hidden.teamBond} ／ 观众热度 ${run.hidden.audienceHeat}`,
      }),
      el("div", { style: "display:flex;gap:10px;justify-content:center" },
        el("button", { class: "btn primary", type: "button", text: "再训练一次", onclick: replay }),
        el("button", { class: "btn", type: "button", text: "回到标题", onclick: toTitle })
      )
    );
    document.getElementById("ui-root")!.append(panel);
  }
}
