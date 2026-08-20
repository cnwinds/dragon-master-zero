// DOM 界面层：竹简托盘、八拍鼓谱、口令面板、对白框、鼓面与印章。
// 全部通过 #ui-root 挂载，场景负责编排；输入天然支持中文 IME 与触控。

import type { MoveId } from "../../shared/types";
import { MOVES } from "../game/content/moves";
import { CSS } from "../game/config";
import { sealBgUrl } from "../game/render/textures";

export function uiRoot(): HTMLElement {
  return document.getElementById("ui-root")!;
}

export function clearUI(): void {
  uiRoot().innerHTML = "";
}

type Attrs = Record<string, string | boolean | ((e: Event) => void) | undefined>;

export function el(tag: string, attrs: Attrs = {}, ...children: Array<Node | string | null | undefined>): HTMLElement {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (k.startsWith("on") && typeof v === "function") {
      node.addEventListener(k.slice(2), v as EventListener);
    } else if (k === "class") node.className = v as string;
    else if (k === "text") node.textContent = v as string;
    else if (v === true) node.setAttribute(k, "");
    else node.setAttribute(k, v as string);
  }
  for (const c of children) {
    if (c == null) continue;
    node.append(c instanceof Node ? c : document.createTextNode(c));
  }
  return node;
}

// ———— 顶部信息条 ————

export function showTopBar(phaseText: string, hard: string, soft: string): HTMLElement {
  const bar = el("div", { class: "top-bar" },
    el("span", { class: "phase", text: phaseText }),
    el("span", { class: "goal", text: "" }, `硬目标：${hard}　`, el("i", { text: `软目标：${soft}` }))
  );
  uiRoot().append(bar);
  return bar;
}

export function removeTopBar(): void {
  uiRoot().querySelector(".top-bar")?.remove();
}

// ———— 动作竹简托盘 ————

export interface TrayController {
  updateCounts(counts: Record<string, number>): void;
  setSelected(moveId: MoveId | null): void;
  lock(): void;
  unlock(): void;
  setPhase(text: string): void;
  root: HTMLElement;
}

export function buildTray(opts: {
  unlocked: MoveId[];
  onPick: (moveId: MoveId) => void;
  onInfo?: (moveId: MoveId) => void;
}): TrayController {
  const title = el("div", { class: "tray-title", text: "动作竹简" });
  const wrap = el("div", { class: "tray" }, title);
  const slips = new Map<MoveId, HTMLElement>();
  const counts = new Map<MoveId, HTMLElement>();
  let selected: MoveId | null = null;
  let locked = false;

  for (const id of opts.unlocked) {
    const def = MOVES[id];
    const countEl = el("span", { class: "count", text: "0/2" });
    const slip = el("div", {
      class: "slip",
      role: "button",
      tabindex: "0",
      onclick: () => !locked && opts.onPick(id),
      onkeydown: (e: Event) => {
        if ((e as KeyboardEvent).key === "Enter" || (e as KeyboardEvent).key === " ") {
          e.preventDefault();
          if (!locked) opts.onPick(id);
        }
      },
    },
      el("span", { class: "glyph", text: def.glyph }),
      el("div", { class: "meta" },
        el("div", {}, el("span", { class: "m-name", text: def.name }), "　", el("span", { class: "m-beats", text: def.beats === 2 ? "双拍" : "单拍" })),
        el("div", { class: "m-desc", text: def.meaning })
      ),
      countEl
    );
    slips.set(id, slip);
    counts.set(id, countEl);
    wrap.append(slip);
  }

  uiRoot().append(wrap);

  return {
    root: wrap,
    updateCounts(map) {
      for (const id of opts.unlocked) {
        const c = map[id] ?? 0;
        const node = counts.get(id)!;
        node.textContent = `${c}/2`;
        node.classList.toggle("max", c >= 2);
        slips.get(id)!.classList.toggle("disabled", c >= 2);
      }
    },
    setSelected(id) {
      selected = id;
      for (const [mid, node] of slips) node.classList.toggle("selected", mid === id);
    },
    lock() {
      locked = true;
      wrap.classList.add("hidden");
    },
    unlock() {
      locked = false;
      wrap.classList.remove("hidden");
    },
    setPhase(text) {
      title.textContent = text;
    },
  };
}

// ———— 八拍鼓谱时间轴 ————

export interface TimelineHints {
  ok: number[];
  bad: number[];
  risk: number[];
  windows: number[];
}

export interface TimelineController {
  update(slots: Array<{ beat: number; moveId: MoveId }>, hints?: Partial<TimelineHints>): void;
  setNow(beat: number | null): void;
  lock(): void;
  setHint(text: string): void;
  root: HTMLElement;
}

export function buildTimeline(opts: {
  onPlace: (beat: number) => void;
  onRemove: (beat: number) => void;
  interactive: boolean;
}): TimelineController {
  const cells: HTMLElement[] = [];
  const hint = el("div", { class: "timeline-hint", text: "" });
  const grid = el("div", { class: "timeline" });
  for (let b = 1; b <= 8; b++) {
    const cell = el("div", { class: "beat-cell", role: "button", tabindex: "0" },
      el("span", { class: "beat-no", text: String(b) })
    );
    if (opts.interactive) {
      cell.addEventListener("click", () => opts.onPlace(b));
      cell.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        opts.onRemove(b);
      });
    }
    grid.append(cell);
    cells.push(cell);
  }
  const wrap = el("div", { class: "timeline-wrap" }, grid, hint);
  uiRoot().append(wrap);

  let locked = !opts.interactive;

  return {
    root: wrap,
    update(slots, h) {
      const beatMove = new Map<number, { moveId: MoveId; start: boolean }>();
      for (const s of slots) {
        beatMove.set(s.beat, { moveId: s.moveId, start: true });
        if (MOVES[s.moveId].beats === 2) beatMove.set(s.beat + 1, { moveId: s.moveId, start: false });
      }
      for (let b = 1; b <= 8; b++) {
        const cell = cells[b - 1];
        const info = beatMove.get(b);
        cell.classList.remove("filled", "hl-ok", "hl-bad", "hl-risk", "window", "dbl-occ");
        const old = cell.querySelector(".slip-mini");
        if (old) old.remove();
        if (info) {
          cell.classList.add("filled");
          if (!info.start) cell.classList.add("dbl-occ");
          const def = MOVES[info.moveId];
          cell.append(el("span", { class: `slip-mini${def.beats === 2 ? " dbl" : ""}`, text: def.glyph }));
        }
        if (h?.ok?.includes(b)) cell.classList.add("hl-ok");
        if (h?.bad?.includes(b)) cell.classList.add("hl-bad");
        if (h?.risk?.includes(b)) cell.classList.add("hl-risk");
        if (h?.windows?.includes(b)) cell.classList.add("window");
      }
    },
    setNow(beat) {
      for (let b = 1; b <= 8; b++) cells[b - 1].classList.toggle("now", b === beat);
    },
    lock() {
      locked = true;
      grid.classList.add("locked");
    },
    setHint(text) {
      hint.textContent = text;
    },
  };
}

// ———— 口令面板 ————

export interface CommandPanelController {
  setBusy(): void;
  setResult(intent: {
    stability: number; rhythm: number; coordination: number; expression: number;
    explanation: string;
  }, status: "online" | "cache" | "offline"): void;
  setError(msg: string): void;
  lock(): void;
  unlock(): void;
  root: HTMLElement;
}

const STATUS_TEXT: Record<string, string> = {
  online: "已由在线训练解析",
  cache: "已使用缓存解析",
  offline: "当前使用本地训练解析",
};

export function buildCommandPanel(opts: {
  suggestions: string[];
  onSubmit: (text: string) => void;
  onStart: () => void;
  startEnabled: () => boolean;
  startLabel?: string;
}): CommandPanelController {
  const input = el("input", {
    id: "command-input",
    type: "text",
    maxlength: "40",
    placeholder: "对阿零说一句话（≤40字）",
    autocomplete: "off",
  }) as HTMLInputElement;
  const status = el("div", { class: "intent-status", text: "" });
  const bars: Record<string, HTMLElement> = {};
  const vals: Record<string, HTMLElement> = {};
  const rows = el("div", { class: "intent-preview" });
  const labels: Array<[string, string, string]> = [
    ["stability", "稳", CSS.bambooLight],
    ["rhythm", "韵", CSS.blueprint],
    ["coordination", "合", CSS.gold],
    ["expression", "意", CSS.cinnabar],
  ];
  const exp = el("div", { class: "intent-exp", text: "" });
  for (const [key, label, color] of labels) {
    const bar = el("i", { style: `background:${color}` });
    bars[key] = bar;
    vals[key] = el("span", { class: "val", text: "50" });
    rows.append(el("div", { class: "intent-row" },
      el("span", { class: "lb", text: label }),
      el("div", { class: "intent-bar" }, bar),
      vals[key]
    ));
  }
  rows.append(exp);

  const suggestList = el("div", { class: "suggest-list" });
  const fillSuggest = () => {
    suggestList.innerHTML = "";
    for (const s of opts.suggestions) {
      suggestList.append(el("button", {
        class: "suggest",
        type: "button",
        onclick: () => {
          input.value = s;
          opts.onSubmit(s);
        },
      }, s));
    }
  };
  fillSuggest();

  const startBtn = el("button", { class: "btn primary", type: "button", text: opts.startLabel ?? "开始演练" }) as HTMLButtonElement;
  startBtn.addEventListener("click", () => {
    if (startBtn.disabled) return;
    opts.onStart();
  });

  const panel = el("div", { class: "command-panel" },
    el("h3", { text: "训练口令" }),
    el("div", { class: "command-input-row" }, input,
      el("button", { class: "btn", type: "button", text: "传意", onclick: () => opts.onSubmit(input.value) })),
    suggestList,
    rows,
    status,
    el("div", { class: "start-row" }, startBtn)
  );
  uiRoot().append(panel);

  const refreshStart = () => {
    startBtn.disabled = !opts.startEnabled();
  };
  refreshStart();
  const observer = setInterval(refreshStart, 300);

  return {
    root: panel,
    setBusy() {
      status.textContent = "正在领会口令…";
      status.className = "intent-status";
    },
    setResult(intent, st) {
      rows.classList.add("show");
      (["stability", "rhythm", "coordination", "expression"] as const).forEach((k) => {
        bars[k].style.width = `${intent[k]}%`;
        vals[k].textContent = String(intent[k]);
      });
      exp.textContent = intent.explanation;
      status.textContent = STATUS_TEXT[st];
      status.className = `intent-status ${st}`;
      refreshStart();
    },
    setError(msg) {
      status.textContent = msg;
      status.className = "intent-status";
      rows.classList.remove("show");
      refreshStart();
    },
    lock() {
      panel.classList.add("hidden");
      clearInterval(observer);
    },
    unlock() {
      panel.classList.remove("hidden");
    },
  };
}

// ———— 对白框 ————

export interface DialogueOptions {
  speedMs?: number;
  onDone?: () => void;
}

export function playDialogue(
  lines: Array<{ speaker: string; text: string; hold?: number }>,
  speakerNames: Record<string, string>,
  opts: DialogueOptions = {}
): { promise: Promise<void>; skip: () => void; destroy: () => void } {
  let idx = 0;
  let resolveDone: () => void;
  const promise = new Promise<void>((r) => (resolveDone = r));
  let box: HTMLElement | null = null;
  let textEl: HTMLElement | null = null;
  let typeTimer: number | null = null;
  let holdTimer: number | null = null;
  let skipped = false;
  let destroyed = false;
  let typing = false;

  const cleanup = () => {
    if (typeTimer != null) clearInterval(typeTimer);
    if (holdTimer != null) clearTimeout(holdTimer);
  };

  const showLine = () => {
    if (destroyed) return;
    cleanup();
    if (idx >= lines.length) {
      box?.remove();
      box = null;
      resolveDone();
      opts.onDone?.();
      return;
    }
    const line = lines[idx];
    if (!box) {
      textEl = el("div", { class: "d-text" });
      box = el("div", { class: "dialogue-box" }, el("div", { class: "d-speaker" }), textEl, el("div", { class: "d-next", text: "点击继续 ▸" }));
      box.addEventListener("click", () => advance());
      uiRoot().append(box);
    }
    const speakerEl = box.querySelector(".d-speaker") as HTMLElement;
    speakerEl.className = `d-speaker ${line.speaker}`;
    speakerEl.textContent = speakerNames[line.speaker] ?? "";
    box.querySelector(".d-next")!.textContent = line.hold ? "" : "点击继续 ▸";

    // 打字机
    const text = line.text;
    let i = 0;
    textEl!.textContent = "";
    typing = true;
    const speed = opts.speedMs ?? 45;
    typeTimer = window.setInterval(() => {
      i++;
      textEl!.textContent = text.slice(0, i);
      if (i >= text.length) {
        if (typeTimer != null) clearInterval(typeTimer);
        typeTimer = null;
        typing = false;
        if (line.hold && !skipped) {
          holdTimer = window.setTimeout(advance, line.hold * 1000);
        }
      }
    }, speed);
  };

  const advance = () => {
    if (destroyed) return;
    const line = lines[idx];
    // 打字未完成时先补全
    if (line && typing && textEl) {
      if (typeTimer != null) clearInterval(typeTimer);
      typeTimer = null;
      typing = false;
      textEl.textContent = line.text;
      if (line.hold && !skipped) {
        holdTimer = window.setTimeout(advance, line.hold * 1000);
      }
      return;
    }
    idx++;
    showLine();
  };

  showLine();

  return {
    promise,
    skip: () => {
      skipped = true;
      cleanup();
      idx = lines.length;
      box?.remove();
      box = null;
      resolveDone();
      opts.onDone?.();
    },
    destroy: () => {
      destroyed = true;
      cleanup();
      box?.remove();
      box = null;
    },
  };
}

// ———— 鼓点纠偏 ————

export interface DrumController {
  setTokens(left: number): void;
  showWindow(): void;
  showGrade(grade: "perfect" | "near" | "wrong" | null): void;
  setEnabled(on: boolean): void;
  hit(): void;
  root: HTMLElement;
}

export function buildDrum(opts: {
  onHit: () => void;
  hint?: string;
}): DrumController {
  const tokens = [el("span", { class: "drum-token" }), el("span", { class: "drum-token" })];
  const ring = el("span", { class: "ring" });
  const skin = el("span", { class: "drum-skin", text: "鼓" });
  const grade = el("div", { class: "drum-grade", text: "" });
  const drum = el("div", { class: "drum disabled" }, ring, skin);
  drum.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    ctrl.hit();
  });
  const zone = el("div", { class: "drum-zone" },
    grade,
    el("div", { class: "drum-tokens" }, tokens[0], tokens[1]),
    drum,
    el("div", { class: "drum-hint", text: opts.hint ?? "关键拍时按 空格 或点鼓纠偏" })
  );
  uiRoot().append(zone);

  let enabled = false;
  const ctrl: DrumController = {
    root: zone,
    setTokens(left) {
      tokens.forEach((t, i) => t.classList.toggle("used", i >= left));
    },
    showWindow() {
      drum.classList.remove("window");
      void drum.offsetWidth; // 重启动画
      drum.classList.add("window");
    },
    showGrade(g) {
      if (!g) {
        grade.textContent = "";
        grade.className = "drum-grade";
        return;
      }
      grade.textContent = g === "perfect" ? "正拍" : g === "near" ? "近拍" : "错拍";
      grade.className = `drum-grade ${g}`;
    },
    setEnabled(on) {
      enabled = on;
      drum.classList.toggle("disabled", !on);
    },
    hit() {
      if (enabled) opts.onHit();
    },
  };
  return ctrl;
}

// ———— 复盘印章 ————

export function buildSeals(scores: { stability: number; rhythm: number; coordination: number; expression: number }): HTMLElement {
  const defs: Array<[string, number, number]> = [
    ["稳", scores.stability, -3],
    ["韵", scores.rhythm, 2],
    ["合", scores.coordination, -2],
    ["意", scores.expression, 3],
  ];
  const row = el("div", { class: "seal-row" });
  for (const [glyph, val, rot] of defs) {
    const style = sealBgUrl
      ? `--rot:${rot}deg;background-image:url(${sealBgUrl});background-size:100% 100%;border-color:transparent;color:var(--paper);text-shadow:0 1px 2px rgba(90,10,6,0.6)`
      : `--rot:${rot}deg`;
    const s = el("div", { class: "seal", style },
      el("span", { class: "s-glyph", text: glyph }),
      el("span", { class: "s-val", text: String(val) })
    );
    row.append(s);
  }
  return row;
}

export function stampSeals(row: HTMLElement, onEach?: (i: number) => void): void {
  const seals = row.querySelectorAll(".seal");
  seals.forEach((s, i) => {
    window.setTimeout(() => {
      s.classList.add("stamp");
      onEach?.(i);
      // 数值滚动
      const valEl = s.querySelector(".s-val") as HTMLElement | null;
      if (valEl) {
        const target = Number(valEl.textContent ?? "0") || 0;
        const t0 = performance.now();
        const dur = 620;
        const tick = (t: number) => {
          const k = Math.min(1, (t - t0) / dur);
          valEl.textContent = String(Math.round(target * (1 - Math.pow(1 - k, 3))));
          if (k < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }
    }, 350 + i * 420);
  });
}

// ———— 通用浮层 ————

export function toast(text: string, ms = 2400): void {
  const t = el("div", { class: "toast", text });
  uiRoot().append(t);
  window.setTimeout(() => t.remove(), ms);
}

export function confirmPanel(title: string, body: string, okText: string, onOk: () => void, onCancel?: () => void): void {
  const panel = el("div", { class: "center-panel", style: "width:min(430px,88vw)" },
    el("h2", { text: title }),
    el("div", { class: "sub", text: body }),
    el("div", { style: "display:flex;gap:10px;justify-content:center;margin-top:14px" },
      el("button", { class: "btn", type: "button", text: "取消", onclick: () => { panel.remove(); onCancel?.(); } }),
      el("button", { class: "btn primary", type: "button", text: okText, onclick: () => { panel.remove(); onOk(); } })
    )
  );
  uiRoot().append(panel);
}
