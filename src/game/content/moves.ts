// 六种动作竹简的数据定义。数值即演出引擎的因果来源，修改需回归三结局路径测试。

import type { MoveId } from "../../../shared/types";

export interface MoveDefinition {
  id: MoveId;
  glyph: string; // 竹简上的单字
  name: string;
  beats: 1 | 2;
  meaning: string;
  advantage: string;
  risk: string;
  baseRisk: number; // 0–100，触发失误的基础风险
  expressionGain: number; // 对“意”的贡献
  stabilityCost: number; // 高速动作对稳定的消耗
  preferredPrevious: MoveId[]; // 良好衔接
  riskyPrevious: MoveId[]; // 风险衔接
  /** 属于“高风险动作”：回望在其前会给协作加成 */
  highRisk: boolean;
}

export const MOVES: Record<MoveId, MoveDefinition> = {
  probe: {
    id: "probe",
    glyph: "探",
    name: "探",
    beats: 1,
    meaning: "龙头前探，观察路径。",
    advantage: "提高后续穿越与转向的稳定性",
    risk: "连续使用会降低表现力",
    baseRisk: 8,
    expressionGain: 2,
    stabilityCost: 0,
    preferredPrevious: [],
    riskyPrevious: [],
    highRisk: false,
  },
  thread: {
    id: "thread",
    glyph: "穿",
    name: "穿",
    beats: 1,
    meaning: "从灯柱、拱门或队形间隙穿过。",
    advantage: "路径精度高",
    risk: "前一拍没有探或回望时容易与队伍脱节",
    baseRisk: 20,
    expressionGain: 4,
    stabilityCost: 1,
    preferredPrevious: ["probe", "lookBack"],
    riskyPrevious: ["rise", "leap"],
    highRisk: false,
  },
  rise: {
    id: "rise",
    glyph: "腾",
    name: "腾",
    beats: 1,
    meaning: "快速抬升龙头。",
    advantage: "增加表现力与观众热度",
    risk: "稳定不足时产生摆动",
    baseRisk: 26,
    expressionGain: 10,
    stabilityCost: 3,
    preferredPrevious: ["coil", "lookBack"],
    riskyPrevious: ["thread"],
    highRisk: true,
  },
  coil: {
    id: "coil",
    glyph: "盘",
    name: "盘",
    beats: 2,
    meaning: "沿圆形路径盘旋。",
    advantage: "衔接性好，能恢复协作",
    risk: "路径空间不足时会触碰灯阵",
    baseRisk: 24,
    expressionGain: 7,
    stabilityCost: 2,
    preferredPrevious: ["rise", "probe"],
    riskyPrevious: ["coil"],
    highRisk: false,
  },
  leap: {
    id: "leap",
    glyph: "跃",
    name: "跃",
    beats: 2,
    meaning: "跨越障碍或完成高难度爆发动作。",
    advantage: "显著提高表现力",
    risk: "需要足够稳定与前置观察",
    baseRisk: 42,
    expressionGain: 16,
    stabilityCost: 6,
    preferredPrevious: ["lookBack", "probe", "coil"],
    riskyPrevious: ["leap", "rise"],
    highRisk: true,
  },
  lookBack: {
    id: "lookBack",
    glyph: "回",
    name: "回望",
    beats: 1,
    meaning: "龙头回转，确认后方队员位置。",
    advantage: "提高协作，并修复动作链冲突",
    risk: "会牺牲少量速度",
    baseRisk: 6,
    expressionGain: 1,
    stabilityCost: 0,
    preferredPrevious: [],
    riskyPrevious: [],
    highRisk: false,
  },
};

export const MOVE_ORDER: MoveId[] = ["probe", "thread", "rise", "coil", "leap", "lookBack"];
