// 客户端口令解释器：先尝试服务端 /api/interpret（在线/缓存），
// 网络失败或超时立即回落本地解析，永不阻断游戏。

import type { InterpretRequest, InterpretResponse } from "../../../shared/intent";
import type { MoveId, TrainingIntent, TrialId } from "../../../shared/types";
import { interpretOffline } from "../../../shared/offlineInterpreter";
import { COMMAND_MAX_LEN } from "../../../shared/offlineInterpreter";

export type InterpretStatus = "idle" | "invalid" | "loading" | "online" | "cache" | "offline";

export interface InterpretOutcome {
  intent: TrainingIntent;
  status: "online" | "cache" | "offline";
}

export function validateCommandText(text: string): string | null {
  const t = text.trim();
  if (!t) return "请输入一句训练口令，或选择下方建议。";
  if (t.length > COMMAND_MAX_LEN) return `口令不超过${COMMAND_MAX_LEN}个字（当前${t.length}字）。`;
  return null;
}

export async function interpretCommand(
  command: string,
  trialId: TrialId,
  unlockedMoves: MoveId[],
  placedMoves: MoveId[],
  timeoutMs = 4500
): Promise<InterpretOutcome> {
  const moves = Array.from(new Set(placedMoves));
  const local = (): InterpretOutcome => ({
    intent: interpretOffline(command, unlockedMoves, trialId),
    status: "offline",
  });

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch("/api/interpret", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ command, trialId, moves } satisfies InterpretRequest),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return local();
    const data = (await res.json()) as InterpretResponse;
    if (!data?.ok || !data?.intent) return local();
    return { intent: data.intent, status: data.cached ? "cache" : data.intent.source === "offline" ? "offline" : "online" };
  } catch {
    return local();
  }
}

export const STATUS_LABEL: Record<InterpretStatus, string> = {
  idle: "",
  invalid: "口令不合规矩",
  loading: "正在领会口令…",
  online: "已由在线训练解析",
  cache: "已使用缓存解析",
  offline: "当前使用本地训练解析",
};
