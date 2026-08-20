// 离线关键词口令解析器。
// 目标不是聪明，而是断网、无密钥、模型异常时游戏依然完整可玩，且结果可解释。

import type { MoveId, TrainingIntent } from "./types";
import { normalizeIntentQuad, sanitizeIntent, type IntentField } from "./intent";

/**
 * 权重 → 四项侧重：先做均值居中（保留相对侧重、剔除整体抬升），
 * 再经 normalizeIntentQuad 收敛到 15–85 / 合计200。
 * 这样“稳+队友”不会因为预算惩罚而反噬协作项。
 */
function weightsToQuad(weights: Record<IntentField, number>): Record<IntentField, number> {
  const fields = Object.keys(weights) as IntentField[];
  const mean = fields.reduce((s, f) => s + weights[f], 0) / fields.length;
  const centered = { ...weights };
  for (const f of fields) centered[f] = 50 + (weights[f] - mean);
  return normalizeIntentQuad(centered);
}

const KEYWORDS: Array<{ field: IntentField; words: string[]; weight: number }> = [
  { field: "stability", words: ["稳", "慢", "谨慎", "小心", "别摔", "控制", "扎实", "先看"], weight: 9 },
  { field: "stability", words: ["稳住", "放稳"], weight: 12 },
  { field: "rhythm", words: ["拍", "鼓", "节奏", "衔接", "连贯", "同步", "跟上"], weight: 9 },
  { field: "coordination", words: ["队友", "后面", "回头", "一起", "配合", "照顾", "同伴", "队伍"], weight: 10 },
  { field: "coordination", words: ["看看", "回望"], weight: 9 },
  { field: "expression", words: ["快", "高", "跳", "精彩", "大胆", "掌声", "亮眼", "出彩"], weight: 9 },
  { field: "expression", words: ["全力", "高点"], weight: 11 },
];

const NEGATORS = ["别", "不要", "不", "无须", "少"];

const MOVE_WORDS: Array<{ move: MoveId; words: string[] }> = [
  { move: "probe", words: ["探", "先看", "观察"] },
  { move: "thread", words: ["穿", "钻"] },
  { move: "rise", words: ["腾", "抬"] },
  { move: "coil", words: ["盘"] },
  { move: "leap", words: ["跃", "跳"] },
  { move: "lookBack", words: ["回望", "回头", "回头看"] },
];

export const COMMAND_MAX_LEN = 40;

function containsAny(text: string, words: string[]): string | null {
  for (const w of words) {
    if (w && text.includes(w)) return w;
  }
  return null;
}

/** 否定窗口：否定词之后 5 个字符内的关键词按反向计入。 */
function negatedAt(text: string, index: number): boolean {
  for (const neg of NEGATORS) {
    let from = 0;
    for (;;) {
      const at = text.indexOf(neg, from);
      if (at < 0) break;
      if (index >= at && index < at + neg.length + 5 && index >= at + neg.length) return true;
      from = at + neg.length;
    }
  }
  return false;
}

export function interpretOffline(command: string, allowedMoves: MoveId[], trialId: string): TrainingIntent {
  const text = (command ?? "").replace(/\s+/g, "");
  if (!text) {
    return sanitizeIntent(
      { stability: 50, rhythm: 50, coordination: 50, expression: 50 },
      { allowedMoves, source: "offline", defaultExplanation: "未收到口令，保持均衡执行。" }
    );
  }

  const weights: Record<IntentField, number> = { stability: 0, rhythm: 0, coordination: 0, expression: 0 };
  const hits: string[] = [];
  for (const group of KEYWORDS) {
    for (const word of group.words) {
      let from = 0;
      for (;;) {
        const at = text.indexOf(word, from);
        if (at < 0) break;
        const neg = negatedAt(text, at);
        weights[group.field] += neg ? -Math.round(group.weight * 0.8) : group.weight;
        if (!neg) hits.push(word);
        from = at + word.length;
      }
    }
  }

  // “先……再/后……”结构：强调先后而不是单项拔高。
  const staged = /先.+[再而后]/.test(text);
  if (staged) {
    weights.rhythm += 6;
    weights.stability += 4;
  }

  const quad = weightsToQuad(weights);

  // 偏好 / 规避动作：只认本轮已解锁动作。
  let preferredMove: MoveId | null = null;
  let avoidMove: MoveId | null = null;
  for (const { move, words } of MOVE_WORDS) {
    if (!allowedMoves.includes(move)) continue;
    for (const word of words) {
      let from = 0;
      for (;;) {
        const at = text.indexOf(word, from);
        if (at < 0) break;
        if (negatedAt(text, at)) avoidMove = avoidMove ?? move;
        else preferredMove = preferredMove ?? move;
        from = at + word.length;
      }
    }
  }

  const entries = Object.entries(quad).sort((a, b) => b[1] - a[1]);
  const strong = entries.filter(([, v]) => v > 55).slice(0, 2);
  const labels: Record<string, string> = { stability: "稳", rhythm: "韵", coordination: "合", expression: "意" };
  const explanation = hits.length
    ? `侧重${strong.map(([f]) => labels[f]).join("与")}，按口令分配注意力。`
    : "未识别到明确倾向，按均衡侧重执行。";

  return sanitizeIntent(
    { ...quad, preferredMove, avoidMove, explanation },
    { allowedMoves, source: "offline", defaultExplanation: explanation }
  );
}
