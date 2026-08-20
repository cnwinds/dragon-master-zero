import Phaser from "phaser";
import { PALETTE } from "../config";
import { clearUI, el, confirmPanel } from "../../ui/dom";
import { getSave, putSave, setRun } from "../../main";
import { freshRun } from "../GameState";
import { audioBus } from "../systems/audio";
import { TitleWorld } from "../render/titleWorld";

/** 标题：河岸灯会夜色中的龙脊朝月，竹简菜单入场。 */
export class TitleScene extends Phaser.Scene {
  private world: TitleWorld | null = null;

  constructor() {
    super("Title");
  }

  create(): void {
    clearUI();
    this.cameras.main.setBackgroundColor(PALETTE.nightDeep);
    this.world = new TitleWorld(this);
    this.world.build();
    this.events.on(Phaser.Scenes.Events.UPDATE, this.onUpdate, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off(Phaser.Scenes.Events.UPDATE, this.onUpdate, this);
      this.world = null;
    });

    if (audioBus.musicOn) audioBus.ensure();
    this.world.playIntro(() => this.buildUI());
  }

  private onUpdate(time: number, delta: number): void {
    this.world?.update(time, delta);
  }

  private buildUI(): void {
    const save = getSave();

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
      el("h1", { text: "龙师零号" })
    );
    const btns = el("div", { class: "title-buttons" });
    if (save.checkpoint && save.checkpoint.trialIndex > 0) {
      const cont = el("button", { class: "title-btn primary", type: "button", text: `继续训练 · 第${["一", "二", "三"][save.checkpoint.trialIndex]}段` });
      cont.addEventListener("click", () => startRun(true));
      btns.append(cont);
    }
    const begin = el("button", {
      class: save.checkpoint && save.checkpoint.trialIndex > 0 ? "title-btn" : "title-btn primary",
      type: "button",
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
    const setBtn = el("button", { class: "title-btn", type: "button", text: "设置" });
    setBtn.addEventListener("click", settingsPanel);
    btns.append(setBtn);

    const extras: HTMLElement[] = [];
    if (save.reachedEndings.length) {
      const names: Record<string, string> = { trueApprentice: "真正出师", championMachine: "冠军机器", lightsFade: "灯散之后" };
      extras.push(el("div", {
        class: "title-endings",
        text: `已达成 · ${save.reachedEndings.map((e) => names[e] ?? e).join(" · ")}`,
      }));
    }

    const ui = el("div", { class: "title-ui" }, name, btns, ...extras);
    root.append(ui);
    requestAnimationFrame(() => ui.classList.add("is-in"));
  }
}
