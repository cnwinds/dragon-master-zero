// 存档与界面之间的小工具。

import { getSave, putSave } from "../../main";
import { TEXT_SPEED } from "../config";
import type { RunState } from "../GameState";

export function saveStoreSpeed(): number {
  return TEXT_SPEED[getSave().settings.textSpeed] ?? TEXT_SPEED.normal;
}

/** 每段开始时写检查点，刷新后可继续。 */
export function writeCheckpoint(run: RunState): void {
  const save = getSave();
  save.checkpoint = {
    trialIndex: run.trialIndex,
    hidden: { ...run.hidden },
    memories: run.memories.map((m) => ({ id: m.id as string, evidence: m.evidence })),
    phaseTag: run.phase,
  };
  putSave(save);
}

export function markEndingReached(endingId: string): void {
  const save = getSave();
  if (!save.reachedEndings.includes(endingId)) {
    save.reachedEndings.push(endingId);
    putSave(save);
  }
}
