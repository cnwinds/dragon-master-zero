// 复盘：四维印章、双归因、训练记忆二选一。

import Phaser from "phaser";
import { clearUI, el, buildSeals, stampSeals, toast } from "../../ui/dom";
import { MEMORY_DEFS, buildCandidates } from "../systems/memory";
import { reviewAttribution } from "../content/dialogue";
import { getRun, setRun } from "../../main";
import { advanceTrial } from "../GameState";
import { audioBus } from "../systems/audio";
import { putSave, getSave } from "../../main";
import type { TrainingMemoryId } from "../../../shared/types";
import { StageRenderer } from "../render/stage";

export class ReviewScene extends Phaser.Scene {
  constructor() {
    super("Review");
  }

  create(): void {
    clearUI();
    const run = getRun();
    const result = run.lastResult!;
    const trialIndex = result.trialIndex as 0 | 1;

    // 背景：压暗的舞台 + 轨迹竹刻化
    this.cameras.main.setBackgroundColor(0x0b141f);
    const stage = new StageRenderer(this);
    stage.build(trialIndex === 0 ? "yard" : "street");
    const veil = this.add.graphics();
    veil.fillStyle(0x060c14, 0.55);
    veil.fillRect(0, 0, 1920, 1080);

    // 印章面板
    const seals = buildSeals(result.scores);
    const intent = run.choreographies[trialIndex]?.intent;
    const attr = reviewAttribution({
      mistakes: result.mistakes,
      memoryTriggers: result.memoryTriggers,
      corrections: result.corrections,
      scores: result.scores,
      intentSummary: intent
        ? `「${["稳", "韵", "合", "意"]}」侧重${intent.stability}/${intent.rhythm}/${intent.coordination}/${intent.expression}，让它把注意力放在了${
            intent.coordination >= Math.max(intent.stability, intent.expression) ? "队伍" : intent.expression >= intent.stability ? "表现" : "稳定"
          }上。`
        : "没有口令，它按均衡侧重执行。",
    });

    const candidates = buildCandidates({
      trialId: trialIndex === 0 ? "bamboo-yard" : "lantern-street",
      observeThenThreadCount: result.facts.observeThenThreadCount,
      lookBackBeforeHighRisk: result.facts.lookBackBeforeHighRisk,
      expressiveMoveCount: result.facts.expressiveMoveCount,
      correctionCount: result.facts.correctionCount,
      worstMistake: result.facts.worstMistake
        ? {
            type: result.facts.worstMistake.type,
            moveName: result.facts.worstMistake.moveName,
            beat: result.facts.worstMistake.beat,
          }
        : null,
      intentStability: intent?.stability ?? 50,
      intentExpression: intent?.expression ?? 50,
    });

    const memCards = el("div", { class: "memory-choice" });
    for (const c of candidates) {
      const def = MEMORY_DEFS[c.id];
      const card = el("button", {
        class: `memory-card ${c.isLesson ? "lesson" : ""}`,
        type: "button",
        onclick: () => pick(c.id),
      },
        el("div", { style: "display:flex;gap:12px;align-items:center" },
          el("span", { class: "m-glyph", text: def.glyph }),
          el("div", {},
            el("div", { class: "m-title", text: def.name + (c.isLesson ? "（教训）" : "") }),
            el("div", { class: "m-evidence", text: c.evidence })
          )
        ),
        el("div", { class: "m-effect", text: def.effect })
      );
      memCards.append(card);
    }

    let picked = false;
    const pick = (id: TrainingMemoryId) => {
      if (picked) return;
      picked = true;
      const def = MEMORY_DEFS[id];
      audioBus.seal();
      toast(`「${def.name}」已刻上记忆签`, 2000);
      run.memories.push({ id, sourceTrialId: trialIndex === 0 ? "bamboo-yard" : "lantern-street", evidence: candidates.find((c) => c.id === id)?.evidence ?? "" });
      setRun(run);
      const save = getSave();
      if (save.checkpoint) {
        save.checkpoint.memories = run.memories.map((m) => ({ id: m.id as string, evidence: m.evidence }));
        putSave(save);
      }
      this.time.delayedCall(900, () => {
        this.cameras.main.fadeOut(400, 0, 0, 0);
        this.time.delayedCall(430, () => {
          this.scene.start("Training", { trialIndex: advanceTrial(trialIndex) });
        });
      });
    };

    const panel = el("div", { class: "center-panel" },
      el("h2", { text: trialIndex === 0 ? "复盘 · 第一轮" : "复盘 · 第二轮" }),
      el("div", { class: "sub", text: "四枚印章，各自陈述——不合并为总分" }),
      seals,
      el("div", { style: "margin:18px 0 8px" },
        el("div", { class: "attr-line" }, el("span", { class: "tag action", text: "动作" }), el("span", { text: attr.moveLine })),
        el("div", { class: "attr-line" }, el("span", { class: "tag train", text: "训练" }), el("span", { text: attr.trainLine })),
        result.memoryTriggers.length === 0 && run.memories.length > 0
          ? el("div", { class: "attr-line" }, el("span", { class: "tag", text: "记忆" }), el("span", { text: "上一轮的记忆本轮未触发——没有出现满足条件的动作衔接。", style: "color:var(--mist)" }))
          : null
      ),
      el("div", { class: "sub", style: "margin-top:14px", text: "把一条经验刻在它的记忆签上" }),
      memCards
    );
    document.getElementById("ui-root")!.append(panel);

    stampSeals(seals, () => audioBus.seal());
  }
}
