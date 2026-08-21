import Phaser from "phaser";
import { PALETTE } from "../config";
import { clearUI, el, confirmPanel } from "../../ui/dom";
import { getSave, putSave, setRun } from "../../main";
import { freshRun } from "../GameState";
import { audioBus } from "../systems/audio";
import { TitleWorld } from "../render/titleWorld";
import {
  isTitlePhoneLayout,
  PHASE_LABELS,
  TRIAL_FALLBACK_LABEL,
} from "../render/titleLayout";
import type { TrainingMemoryId, TrialId } from "../../../shared/types";
import type { SaveData } from "../systems/saveStore";

const TRIAL_SOURCE: TrialId[] = ["bamboo-yard", "lantern-street", "river-stage"];

/** 标题：左静右动，严格按场景 01 规格。 */
export class TitleScene extends Phaser.Scene {
  private world: TitleWorld | null = null;
  private ui: HTMLElement | null = null;
  private interactive = false;
  private leaving = false;
  private idleTimer = 0;
  private phone = false;
  private skipHandler: ((e: Event) => void) | null = null;
  private pointerHeld = false;

  constructor() {
    super("Title");
  }

  create(): void {
    clearUI();
    this.cameras.main.setBackgroundColor(PALETTE.nightDeep);
    this.phone = isTitlePhoneLayout(document.getElementById("ui-root"));
    this.world = new TitleWorld(this);
    this.world.build(this.phone);
    this.events.on(Phaser.Scenes.Events.UPDATE, this.onUpdate, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.teardown());

    this.ui = this.buildUI();
    this.playIntro();
  }

  private teardown(): void {
    this.events.off(Phaser.Scenes.Events.UPDATE, this.onUpdate, this);
    this.world?.shutdown();
    this.world = null;
    this.unbindSkip();
    window.removeEventListener("resize", this.onResize);
    document.removeEventListener("fullscreenchange", this.onFullscreen);
  }

  private onUpdate(_time: number, delta: number): void {
    this.world?.update(_time, delta);
    if (!this.interactive || this.leaving || !this.ui) return;
    this.idleTimer += delta;
    this.ui.classList.toggle("is-dim", this.idleTimer > 8000);
  }

  private playIntro(): void {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.ui?.classList.toggle("is-playing-intro", !reduced);
    this.ui?.classList.toggle("is-ready", reduced);
    if (reduced) {
      this.world?.playIntro(() => this.enableInput());
      return;
    }
    this.bindSkip();
    this.world?.playIntro(() => this.armInput());
  }

  private armInput(): void {
    if (this.pointerHeld) {
      const go = () => this.enableInput();
      window.addEventListener("pointerup", go, { once: true });
      this.time.delayedCall(160, go);
      return;
    }
    this.enableInput();
  }

  private bindSkip(): void {
    this.unbindSkip();
    this.skipHandler = (e: Event) => {
      this.pointerHeld = e.type === "pointerdown";
      this.skipIntro();
    };
    window.addEventListener("pointerdown", this.skipHandler, true);
    window.addEventListener("keydown", this.skipHandler, true);
  }

  private unbindSkip(): void {
    if (!this.skipHandler) return;
    window.removeEventListener("pointerdown", this.skipHandler, true);
    window.removeEventListener("keydown", this.skipHandler, true);
    this.skipHandler = null;
  }

  private skipIntro(): void {
    if (this.interactive) return;
    this.unbindSkip();
    this.ui?.classList.remove("is-playing-intro");
    this.ui?.classList.add("is-ready");
    this.world?.requestSkip();
    this.armInput();
  }

  private enableInput(): void {
    if (this.interactive) return;
    this.interactive = true;
    this.pointerHeld = false;
    this.unbindSkip();
    this.ui?.classList.remove("is-playing-intro");
    this.ui?.classList.add("is-ready");
    audioBus.ensure();
    const first = this.ui?.querySelector<HTMLButtonElement>(".tm-item");
    first?.focus();
  }

  private bumpIdle(): void {
    this.idleTimer = 0;
    this.ui?.classList.remove("is-dim");
  }

  private onResize = (): void => {
    const phone = isTitlePhoneLayout(document.getElementById("ui-root"));
    if (phone === this.phone) return;
    this.phone = phone;
    this.world?.setPhoneShift(phone);
    clearUI();
    this.ui = this.buildUI();
    this.ui.classList.add("is-ready");
    this.interactive = true;
    this.ui.querySelector<HTMLButtonElement>(".tm-item")?.focus();
  };

  private onFullscreen = (): void => {
    const btn = this.ui?.querySelector("[data-act=fullscreen]");
    btn?.classList.toggle("is-on", Boolean(document.fullscreenElement));
  };

  private buildUI(): HTMLElement {
    const save = getSave();
    const hasSave = Boolean(save.checkpoint);
    const root = document.getElementById("ui-root")!;
    const ui = el("div", {
      class: `title-ui${this.phone ? " is-phone" : ""}`,
      id: "title-root",
    });
    ui.addEventListener("pointermove", () => this.bumpIdle());
    ui.addEventListener("keydown", () => this.bumpIdle());

    ui.append(this.buildLogo(), this.buildMenu(save, hasSave), this.buildUtils(save));
    if (hasSave) ui.append(this.buildSaveSummary(save));
    ui.append(this.buildVersion());
    root.append(ui);
    window.addEventListener("resize", this.onResize);
    document.addEventListener("fullscreenchange", this.onFullscreen);
    return ui;
  }

  private buildLogo(): HTMLElement {
    const mark = el("div", { class: "title-mark" },
      el("span", { class: "carve", "data-ch": "龙", text: "龙" }),
      el("span", { class: "carve", "data-ch": "师", text: "师" }),
      el("span", { class: "bp", text: "零" }),
      el("span", { class: "bp", text: "号" }),
    );
    const seal = el("div", { class: "title-seal", "aria-hidden": "true" }, el("span", { text: "零" }));
    const en = el("div", { class: "title-en", text: "DRAGON APPRENTICE: ZERO" });
    return el("div", { class: "title-logo", id: "title-logo" }, mark, seal, en);
  }

  private buildMenu(save: SaveData, hasSave: boolean): HTMLElement {
    const nav = el("nav", { class: "title-menu", id: "main-menu" });
    const items: Array<{ label: string; action: () => void; danger?: boolean }> = [];
    if (hasSave) {
      items.push({ label: "继续训练", action: () => this.continueRun(save) });
      items.push({ label: "重新开始", action: () => this.confirmRestart(save), danger: true });
    } else {
      items.push({ label: "开始训练", action: () => this.startFresh() });
    }
    items.push({ label: "设置", action: () => this.settingsPanel() });
    if (!this.phone) items.push({ label: "制作名单", action: () => this.creditsPanel() });

    items.forEach((it, i) => {
      const btn = el("button", {
        class: `tm-item${i === 0 ? " is-primary" : ""}${it.danger ? " is-danger" : ""}`,
        type: "button",
        text: it.label,
      }) as HTMLButtonElement;
      btn.addEventListener("pointerenter", () => {
        if (!this.interactive) return;
        audioBus.scrape();
        btn.focus();
      });
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!this.interactive || this.leaving) return;
        it.action();
      });
      btn.addEventListener("keydown", (e) => this.onMenuKey(e as KeyboardEvent, nav));
      nav.append(btn);
    });
    return nav;
  }

  private onMenuKey(e: KeyboardEvent, nav: HTMLElement): void {
    if (e.key === "Escape") {
      e.preventDefault();
      return;
    }
    const buttons = [...nav.querySelectorAll<HTMLButtonElement>(".tm-item")];
    const i = buttons.indexOf(e.currentTarget as HTMLButtonElement);
    if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      e.preventDefault();
      buttons[(i + 1) % buttons.length]?.focus();
      audioBus.scrape();
    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      e.preventDefault();
      buttons[(i - 1 + buttons.length) % buttons.length]?.focus();
      audioBus.scrape();
    }
  }

  private buildSaveSummary(save: SaveData): HTMLElement {
    const label = (save.checkpoint && PHASE_LABELS[save.checkpoint.phaseTag])
      || TRIAL_FALLBACK_LABEL[save.checkpoint?.trialIndex ?? 0];
    const time = save.updatedAt ? this.formatTime(save.updatedAt) : "本地进度";
    const line2 = this.phone ? `${label} · ${time} · 本地可用` : `${time} · 本地可用`;
    return el("div", { class: "title-save", id: "save-summary" },
      this.phone ? el("div", { class: "save-line", text: line2 }) : el("div", { class: "save-line", text: label }),
      this.phone ? null : el("div", { class: "save-line", text: line2 }),
    );
  }

  private formatTime(ts: number): string {
    const d = new Date(ts);
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  private buildUtils(save: SaveData): HTMLElement {
    const soundOn = save.settings.musicOn || save.settings.sfxOn;
    const sound = el("button", {
      class: `title-util-btn${soundOn ? " is-on" : ""}`,
      type: "button",
      title: "声音",
      "aria-label": "声音开关",
    });
    sound.innerHTML = ICON_SOUND;
    sound.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!this.interactive) return;
      const s = getSave();
      const next = !(s.settings.musicOn || s.settings.sfxOn);
      s.settings.musicOn = next;
      s.settings.sfxOn = next;
      audioBus.setMusic(next);
      audioBus.setSfx(next);
      if (next) audioBus.startTitleBed();
      else audioBus.stopTitleBed();
      putSave(s);
      sound.classList.toggle("is-on", next);
      audioBus.ensure();
    });

    const row = el("div", { class: "title-utils", id: "utility-actions" }, sound);
    const desktop = window.matchMedia("(pointer: fine)").matches && (document.getElementById("ui-root")?.clientHeight ?? 0) > 500;
    if (desktop && document.fullscreenEnabled) {
      const fs = el("button", {
        class: `title-util-btn${document.fullscreenElement ? " is-on" : ""}`,
        type: "button",
        title: "全屏",
        "aria-label": "全屏切换",
        "data-act": "fullscreen",
      });
      fs.innerHTML = ICON_FULLSCREEN;
      fs.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!this.interactive) return;
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen();
      });
      row.append(fs);
    }
    row.append(el("div", { class: "title-parse", title: "解析状态" },
      el("span", { class: "parse-dot" }),
      el("span", { class: "parse-text", text: "本地可用" }),
    ));
    return row;
  }

  private buildVersion(): HTMLElement {
    return el("div", {
      class: "title-version",
      id: "version-info",
      text: "Demo 0.1.0　原创游戏画面，文化元素为艺术化设计",
    });
  }

  private startFresh(): void {
    if (this.leaving) return;
    this.leaving = true;
    this.ui?.classList.add("is-leaving");
    const run = freshRun();
    setRun(run);
    this.world?.playExitToPrologue(() => this.scene.start("Prologue"));
  }

  private continueRun(save: SaveData): void {
    if (this.leaving || !save.checkpoint) return;
    this.leaving = true;
    this.ui?.classList.add("is-leaving");
    const run = freshRun();
    run.trialIndex = save.checkpoint.trialIndex;
    run.hidden = {
      masterTrust: save.checkpoint.hidden.masterTrust,
      teamBond: save.checkpoint.hidden.teamBond,
      audienceHeat: save.checkpoint.hidden.audienceHeat,
    };
    run.memories = save.checkpoint.memories.map((m) => ({
      id: m.id as TrainingMemoryId,
      sourceTrialId: TRIAL_SOURCE[save.checkpoint!.trialIndex],
      evidence: m.evidence,
    }));
    setRun(run);
    const idx = save.checkpoint.trialIndex;
    this.world?.playExitContinue(idx, () => this.scene.start("Training", { trialIndex: idx }));
  }

  private confirmRestart(save: SaveData): void {
    confirmPanel("重新开始", "当前进度将被清除，从序章重新开始。", "确认", () => {
      save.checkpoint = null;
      putSave(save);
      this.startFresh();
    });
  }

  private settingsPanel(): void {
    const save = getSave();
    const musicT = el("div", { class: `toggle ${save.settings.musicOn ? "on" : ""}` });
    musicT.addEventListener("click", () => {
      save.settings.musicOn = !save.settings.musicOn;
      musicT.classList.toggle("on", save.settings.musicOn);
      audioBus.setMusic(save.settings.musicOn);
      if (save.settings.musicOn) audioBus.startTitleBed();
      else audioBus.stopTitleBed();
      putSave(save);
    });
    const sfxT = el("div", { class: `toggle ${save.settings.sfxOn ? "on" : ""}` });
    sfxT.addEventListener("click", () => {
      save.settings.sfxOn = !save.settings.sfxOn;
      sfxT.classList.toggle("on", save.settings.sfxOn);
      audioBus.setSfx(save.settings.sfxOn);
      putSave(save);
    });
    const extra: HTMLElement[] = [];
    if (this.phone) {
      extra.push(el("button", {
        class: "btn", type: "button", text: "制作名单", onclick: () => {
          panel.remove();
          this.creditsPanel();
        },
      }));
    }
    extra.push(el("button", { class: "btn primary", type: "button", text: "回到标题", onclick: () => panel.remove() }));
    const panel = el("div", { class: "center-panel settings-panel" },
      el("h2", { text: "设置" }),
      el("div", { class: "setting-row" }, el("span", { text: "音乐" }), musicT),
      el("div", { class: "setting-row" }, el("span", { text: "音效" }), sfxT),
      save.checkpoint || save.reachedEndings.length
        ? el("div", { class: "setting-row" },
          el("button", {
            class: "btn danger", type: "button", text: "清除本地进度", onclick: () => {
              save.checkpoint = null;
              save.reachedEndings = [];
              save.tutorialSeen = false;
              putSave(save);
              panel.remove();
              this.scene.restart();
            },
          }))
        : null,
      el("div", { style: "display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:16px" }, ...extra)
    );
    document.getElementById("ui-root")!.append(panel);
  }

  private creditsPanel(): void {
    const panel = el("div", { class: "center-panel settings-panel" },
      el("h2", { text: "制作名单" }),
      el("div", { class: "credits-block" },
        el("p", { text: "龙师零号" }),
        el("p", { class: "credits-en", text: "DRAGON APPRENTICE: ZERO" }),
        el("p", { text: "系统设计 / 程序 / 画面" }),
        el("p", { text: "文化元素为艺术化设计，不模拟任何特定地区的官方仪式。" }),
        el("p", { text: "Demo 可完全离线运行。" }),
      ),
      el("div", { style: "display:flex;justify-content:center;margin-top:16px" },
        el("button", { class: "btn primary", type: "button", text: "关闭", onclick: () => panel.remove() })
      )
    );
    document.getElementById("ui-root")!.append(panel);
  }
}

const ICON_SOUND = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10h3.2L12 6.5v11L7.2 14H4z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M15.2 9.2c.9.8.9 4.8 0 5.6M17.8 7.4c1.8 1.6 1.8 7.6 0 9.2" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`;
const ICON_FULLSCREEN = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 9V5h4M19 9V5h-4M5 15v4h4M19 15v4h-4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`;
