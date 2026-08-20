import Phaser from "phaser";
import { PALETTE } from "../config";
import { clearUI, el, confirmPanel } from "../../ui/dom";
import { Serpent } from "../render/serpent";
import { getSave, putSave, setRun } from "../../main";
import { freshRun } from "../GameState";
import { audioBus } from "../systems/audio";
import { addVignette, addFireflies } from "../render/atmosphere";

/** 标题：水墨夜色中的龙脊剪影 + 开始/继续/设置。 */
export class TitleScene extends Phaser.Scene {
  private serpent: Serpent | null = null;

  constructor() {
    super("Title");
  }

  create(): void {
    clearUI();
    this.cameras.main.setBackgroundColor(PALETTE.nightDeep);
    this.paintBackdrop();
    this.buildUI();

    if (audioBus.musicOn) {
      audioBus.ensure();
    }
  }

  private paintBackdrop(): void {
    const g = this.add.graphics();
    // 夜空渐变
    g.fillGradientStyle(0x070d17, 0x070d17, 0x12233a, 0x1a3350, 1);
    g.fillRect(0, 0, 1920, 1080);

    // 月：完整挂右上，龙在月下昂首仰望（分离式构图，互不遮挡）
    this.add.image(1650, 280, "tex-glow").setScale(8.5, 8.5).setAlpha(0.55).setTint(0xbfd8e8);
    this.add.image(1650, 280, "tex-moon").setDisplaySize(150, 150);

    // 远山
    this.add.image(0, 330, "tex-hill").setOrigin(0, 0).setAlpha(0.5).setTint(0x24405c);

    // 灯海
    for (let i = 0; i < 30; i++) {
      const x = 80 + (i % 15) * 130 + (Math.floor(i / 15) === 0 ? 0 : 60);
      const y = 780 + Math.floor(i / 15) * 50;
      this.tweens.add({
        targets: this.add.image(x, y, "tex-glow").setScale(0.6 + (i % 3) * 0.2).setAlpha(0.4).setTint(0xf0c27a),
        alpha: { from: 0.28, to: 0.55 },
        duration: 1600 + (i % 5) * 400,
        yoyo: true,
        repeat: -1,
        delay: i * 90,
      });
    }

    // 一条完整且游动的龙：蛇形起伏 + 头颈随波 + 背鳍金脊
    this.serpent = new Serpent(this, {
      points: [
        { x: -80, y: 700 },
        { x: 180, y: 640 },
        { x: 430, y: 560 },
        { x: 660, y: 615 },
        { x: 890, y: 530 },
        { x: 1110, y: 585 },
        { x: 1320, y: 520 },
        { x: 1430, y: 500 },
        { x: 1490, y: 480 },
      ],
      headScale: 1.35,
      maxRadius: 30,
      segmentEvery: 84,
      alpha: 0.95,
    });
    this.events.on(Phaser.Scenes.Events.UPDATE, (_t: number, delta: number) => {
      this.serpent?.update(delta);
    });

    // 书法标题（贴图版，带飞白与落款）
    this.add.image(960, 195, "tex-title").setDisplaySize(880, 233).setDepth(95);
    // 微弱金辉衬托
    this.add.image(960, 200, "tex-glow").setScale(8, 2.6).setAlpha(0.1).setTint(0xf0c27a).setDepth(94);

    // 宣纸颗粒
    this.add.image(0, 0, "tex-paper").setOrigin(0, 0).setDisplaySize(1920, 1080).setAlpha(0.06);
    addVignette(this, 0.26);
    addFireflies(this, 12, { x0: 80, x1: 1840, y0: 420, y1: 900 });
  }

  private buildUI(): void {
    const save = getSave();
    const runBtns: HTMLElement[] = [];

    const startRun = (fromCheckpoint: boolean) => {
      audioBus.ensure();
      const run = freshRun();
      if (fromCheckpoint && save.checkpoint) {
        run.trialIndex = save.checkpoint.trialIndex;
        run.hidden = {
          masterTrust: save.checkpoint.hidden.masterTrust,
          teamBond: save.checkpoint.hidden.teamBond,
          audienceHeat: save.checkpoint.hidden.audienceHeat,
        };
        run.memories = save.checkpoint.memories.map((m) => ({
          id: m.id as never,
          sourceTrialId: (run.trialIndex === 0 ? "bamboo-yard" : run.trialIndex === 1 ? "lantern-street" : "bamboo-yard") as never,
          evidence: m.evidence,
        }));
      }
      setRun(run);
      this.scene.start("Prologue");
    };

    const settingsPanel = () => {
      const musicT = el("div", { class: `toggle ${save.settings.musicOn ? "on" : ""}` });
      musicT.addEventListener("click", () => {
        save.settings.musicOn = !save.settings.musicOn;
        musicT.classList.toggle("on", save.settings.musicOn);
        audioBus.setMusic(save.settings.musicOn);
        putSave(save);
      });
      const sfxT = el("div", { class: `toggle ${save.settings.sfxOn ? "on" : ""}` });
      sfxT.addEventListener("click", () => {
        save.settings.sfxOn = !save.settings.sfxOn;
        sfxT.classList.toggle("on", save.settings.sfxOn);
        audioBus.setSfx(save.settings.sfxOn);
        putSave(save);
      });
      const panel = el("div", { class: "center-panel settings-panel" },
        el("h2", { text: "设置" }),
        el("div", { class: "setting-row" }, el("span", { text: "音乐" }), musicT),
        el("div", { class: "setting-row" }, el("span", { text: "音效" }), sfxT),
        el("div", { style: "display:flex;gap:10px;justify-content:center;margin-top:16px" },
          save.checkpoint || save.reachedEndings.length
            ? el("button", {
                class: "btn danger", type: "button", text: "清除本地进度", onclick: () => {
                  save.checkpoint = null;
                  save.reachedEndings = [];
                  save.tutorialSeen = false;
                  putSave(save);
                  panel.remove();
                  clearUI();
                  this.buildUI();
                },
              })
            : null,
          el("button", { class: "btn primary", type: "button", text: "回到标题", onclick: () => panel.remove() })
        )
      );
      document.getElementById("ui-root")!.append(panel);
    };

    const root = document.getElementById("ui-root")!;
    const name = el("div", { class: "title-name" },
      el("h1", { text: "龙师零号" }),
      el("div", { class: "tagline", text: "动作可以编排，分寸需要人来教" })
    );
    const btns = el("div", { class: "title-buttons" });
    if (save.checkpoint && save.checkpoint.trialIndex > 0) {
      const cont = el("button", { class: "btn primary", type: "button", text: `继续训练 · 第${["一", "二", "三"][save.checkpoint.trialIndex]}段` });
      cont.addEventListener("click", () => startRun(true));
      btns.append(cont);
      runBtns.push(cont);
    }
    const begin = el("button", {
      class: "btn", type: "button",
      text: save.checkpoint && save.checkpoint.trialIndex > 0 ? "从头开始" : "开始训练",
    });
    begin.addEventListener("click", () => {
      if (save.checkpoint && save.checkpoint.trialIndex > 0) {
        confirmPanel("从头开始", "当前进度将被清除，从序章重新开始。", "确认", () => {
          save.checkpoint = null;
          putSave(save);
          startRun(false);
        });
      } else {
        startRun(false);
      }
    });
    btns.append(begin);
    runBtns.push(begin);
    const setBtn = el("button", { class: "btn", type: "button", text: "设 置" });
    setBtn.addEventListener("click", settingsPanel);
    btns.append(setBtn);
    runBtns.push(setBtn);

    if (save.reachedEndings.length) {
      const names: Record<string, string> = { trueApprentice: "真正出师", championMachine: "冠军机器", lightsFade: "灯散之后" };
      btns.append(el("div", {
        style: "color:var(--mist);font-size:13px;letter-spacing:2px;margin-top:6px",
        text: `已达成的结局：${save.reachedEndings.map((e) => names[e] ?? e).join(" · ")}`,
      }));
    }

    const ui = el("div", { class: "title-ui" }, name, btns);
    root.append(ui);

    // 开场锣
    if (audioBus.musicOn) {
      window.setTimeout(() => audioBus.gong(0.5), 400);
    }
  }
}
