// 确定性随机：同一 (trialId, beatIndex, moveId, occurrence) 永远得到同一样本。
// 口令与记忆只改变风险阈值，绝不重新掷骰——这是演出可复现的根基。

export function hashString(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function sample01(trialId: string, beatIndex: number, moveId: string, occurrence: number): number {
  return mulberry32(hashString(`${trialId}:${beatIndex}:${moveId}:${occurrence}`))();
}
