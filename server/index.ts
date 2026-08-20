// 生产服务：静态托管 dist/ + POST /api/interpret（在线解析 → 缓存 → 离线降级）。

import express from "express";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { interpretOffline, COMMAND_MAX_LEN } from "../shared/offlineInterpreter";
import { sanitizeIntent } from "../shared/intent";
import type { MoveId, TrialId } from "../shared/types";
import { callModel, cacheGet, cachePut, cacheKey, readModelEnv } from "./modelClient";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: "16kb" }));

const TRIAL_IDS = new Set(["bamboo-yard", "lantern-street", "river-stage"]);
const MOVE_IDS = new Set(["probe", "thread", "rise", "coil", "leap", "lookBack"]);

interface InterpretBody {
  command?: unknown;
  trialId?: unknown;
  moves?: unknown;
}

app.post("/api/interpret", (req, res) => {
  const body = req.body as InterpretBody;
  const command = typeof body.command === "string" ? body.command.replace(/\s+/g, "").slice(0, COMMAND_MAX_LEN + 8) : "";
  const trialId = typeof body.trialId === "string" && TRIAL_IDS.has(body.trialId) ? (body.trialId as TrialId) : null;
  const moves = Array.isArray(body.moves)
    ? body.moves.filter((m): m is MoveId => typeof m === "string" && MOVE_IDS.has(m as MoveId))
    : [];

  if (!command || command.length > COMMAND_MAX_LEN || !trialId) {
    res.status(400).json({ ok: false, error: "bad_request" });
    return;
  }

  const offline = () =>
    res.json({
      ok: true,
      degraded: true,
      intent: interpretOffline(command, moves, trialId),
    });

  const key = cacheKey(command, trialId, moves);
  const cached = cacheGet(key);
  if (cached) {
    res.json({ ok: true, cached: true, intent: cached });
    return;
  }

  const env = readModelEnv();
  if (!env) {
    offline();
    return;
  }

  void (async () => {
    const intent = await callModel(env, command, moves);
    if (!intent) {
      offline();
      return;
    }
    // 双重校验：sanitize 已保证预算与枚举合法
    const safe = sanitizeIntent(intent, {
      allowedMoves: moves,
      source: "online",
      defaultExplanation: intent.explanation,
    });
    cachePut(key, safe);
    res.json({ ok: true, intent: safe });
  })().catch(() => offline());
});

// 静态托管（优先 dist/，开发模式由 Vite 代理）
const distDir = path.join(__dirname, "..", "dist");
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get(/^\/(?!api\/).*/, (_req, res) => {
    res.sendFile(path.join(distDir, "index.html"));
  });
}

const port = Number(process.env.PORT ?? 4173);
app.listen(port, () => {
  console.log(`[dragon-master-zero] serving on http://localhost:${port}`);
});
