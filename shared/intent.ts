// 训练侧重的构造、校验与归一化。
// 无论结果来自在线模型还是本地规则，进入演出引擎前都必须经过这里。

import type { MoveId, TrainingIntent, TrialId } from "./types";

export const INTENT_MIN = 15;
export const INTENT_MAX = 85;
export const INTENT_SUM = 200;
export const INTENT_FIELDS = ["stability", "rhythm", "coordination", "expression"] as const;
export type IntentField = (typeof INTENT_FIELDS)[number];

export const FIELD_LABEL: Record<IntentField, string> = {
  stability: "稳定",
  rhythm: "节奏",
  coordination: "协作",
  expression: "表现",
};

export const ALL_MOVES: MoveId[] = ["probe", "thread", "rise", "coil", "leap", "lookBack"];

export function balancedIntent(): TrainingIntent {
  return {
    stability: 50,
    rhythm: 50,
    coordination: 50,
    expression: 50,
    preferredMove: null,
    avoidMove: null,
    explanation: "没有特别侧重，四项均衡。",
    source: "offline",
  };
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/**
 * 把任意四项数值收敛为合法侧重：先限制到 15–85，再用最大余数法凑足 200。
 * 只调整还有余量/空间的项，保证结果稳定可复现。
 */
export function normalizeIntentQuad(raw: Record<IntentField, number>): Record<IntentField, number> {
  const clamped = { ...raw };
  for (const f of INTENT_FIELDS) {
    const v = Number.isFinite(clamped[f]) ? Math.round(clamped[f]) : 50;
    clamped[f] = clamp(v, INTENT_MIN, INTENT_MAX);
  }
  let diff = INTENT_SUM - INTENT_FIELDS.reduce((s, f) => s + clamped[f], 0);
  while (diff !== 0) {
    const dir = diff > 0 ? 1 : -1;
    let best: IntentField | null = null;
    let bestRoom = -1;
    for (const f of INTENT_FIELDS) {
      const room = dir > 0 ? INTENT_MAX - clamped[f] : clamped[f] - INTENT_MIN;
      if (room > bestRoom) {
        bestRoom = room;
        best = f;
      }
    }
    if (!best || bestRoom <= 0) break;
    const step = dir > 0 ? Math.min(diff, bestRoom) : Math.max(diff, -bestRoom);
    clamped[best] += step;
    diff -= step;
  }
  return clamped;
}

export function isValidIntent(intent: TrainingIntent): boolean {
  const quad = normalizeIntentQuad(intent);
  for (const f of INTENT_FIELDS) {
    if (quad[f] !== intent[f] || !Number.isInteger(intent[f])) return false;
  }
  const sum = INTENT_FIELDS.reduce((s, f) => s + intent[f], 0);
  if (sum !== INTENT_SUM) return false;
  for (const m of [intent.preferredMove, intent.avoidMove]) {
    if (m !== null && !ALL_MOVES.includes(m)) return false;
  }
  return typeof intent.explanation === "string";
}

/** 在线/离线解析的原始输出 -> 合法 TrainingIntent。动作引用不在白名单时置空。 */
export function sanitizeIntent(
  raw: object,
  opts: { allowedMoves: MoveId[]; source: TrainingIntent["source"]; defaultExplanation?: string }
): TrainingIntent {
  const r = raw as Record<string, unknown>;
  const quad = normalizeIntentQuad({
    stability: Number(r.stability ?? 50),
    rhythm: Number(r.rhythm ?? 50),
    coordination: Number(r.coordination ?? 50),
    expression: Number(r.expression ?? 50),
  });
  const pickMove = (v: unknown): MoveId | null => {
    return typeof v === "string" && (ALL_MOVES as string[]).includes(v) && opts.allowedMoves.includes(v as MoveId)
      ? (v as MoveId)
      : null;
  };
  let explanation = typeof r.explanation === "string" ? r.explanation.trim() : "";
  if (!explanation) explanation = opts.defaultExplanation ?? "已按口令调整执行侧重。";
  if (explanation.length > 30) explanation = explanation.slice(0, 30);
  return {
    ...quad,
    preferredMove: pickMove(r.preferredMove),
    avoidMove: pickMove(r.avoidMove),
    explanation,
    source: opts.source,
  };
}

export interface InterpretRequest {
  command: string;
  trialId: TrialId;
  moves: MoveId[];
}

export interface InterpretResponse {
  ok: boolean;
  intent: TrainingIntent;
  degraded?: boolean;
  cached?: boolean;
}
