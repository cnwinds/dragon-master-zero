// 本地存档：设置、结局图鉴与最近进度。损坏时丢弃异常字段采用默认值。

const KEY = "dragon-master-zero/save";
const VERSION = 1;

export interface Settings {
  musicOn: boolean;
  sfxOn: boolean;
  textSpeed: "slow" | "normal" | "fast";
}

export interface SaveData {
  version: number;
  settings: Settings;
  reachedEndings: string[];
  tutorialSeen: boolean;
  checkpoint: {
    trialIndex: 0 | 1 | 2;
    hidden: { masterTrust: number; teamBond: number; audienceHeat: number };
    memories: Array<{ id: string; evidence: string }>;
    phaseTag: string;
  } | null;
}

export function defaultSettings(): Settings {
  return { musicOn: true, sfxOn: true, textSpeed: "normal" };
}

export function loadSave(): SaveData {
  const fallback: SaveData = {
    version: VERSION,
    settings: defaultSettings(),
    reachedEndings: [],
    tutorialSeen: false,
    checkpoint: null,
  };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    return {
      version: VERSION,
      settings: {
        ...fallback.settings,
        ...(typeof parsed.settings === "object" && parsed.settings ? parsed.settings : {}),
      },
      reachedEndings: Array.isArray(parsed.reachedEndings)
        ? parsed.reachedEndings.filter((x) => typeof x === "string").slice(0, 10)
        : [],
      tutorialSeen: parsed.tutorialSeen === true,
      checkpoint:
        parsed.checkpoint && typeof parsed.checkpoint === "object" && typeof parsed.checkpoint.trialIndex === "number"
          ? {
              trialIndex: (parsed.checkpoint.trialIndex as 0 | 1 | 2) ?? 0,
              hidden: {
                masterTrust: Number(parsed.checkpoint.hidden?.masterTrust ?? 50),
                teamBond: Number(parsed.checkpoint.hidden?.teamBond ?? 50),
                audienceHeat: Number(parsed.checkpoint.hidden?.audienceHeat ?? 35),
              },
              memories: Array.isArray(parsed.checkpoint.memories)
                ? parsed.checkpoint.memories.filter((m) => m && typeof m.id === "string").slice(0, 2)
                : [],
              phaseTag: typeof parsed.checkpoint.phaseTag === "string" ? parsed.checkpoint.phaseTag : "",
            }
          : null,
    };
  } catch {
    return fallback;
  }
}

export function persistSave(data: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* 存储被禁用时静默放弃 */
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
}
