// 进化系统定义（设计文档 §4.5 阈值表 / §5.2 分支概率 / §5.3 加深性格缺陷）
//
// 这个文件是整个进化系统的"单一事实来源"：
// 形态、阈值、分支概率、行为修正全在这里，其余代码只读不写死。
// 需要调档（比如觉得 8 天走完全部进化太快）只改这里。

// ==================== 形态级别 ====================

/** 破壳之后的形态级别，按亲密度依次解锁（§4.5） */
export type FormLevel = "baby" | "youth" | "adult" | "perfect" | "ultimate";

export interface FormDef {
  id: FormLevel;
  /** 中文形态名 */
  name: string;
  /** 达到该亲密度时进化到这一级。baby 即破壳阈值 */
  threshold: number;
  /** 这一级的定位，用于进化仪式上告诉主人"它变成了什么" */
  desc: string;
}

/**
 * 形态表，顺序即进化顺序。
 *
 * 阈值取自文档 §4.5：
 *   30 破壳 → 60 第一次进化 → 100 第二次 → 150 第三次 → 200+ 终极
 * 实测节奏（每天 10 轮 + 早晚，按修正后的比例衰减）：
 *   约 2 / 3 / 6 / 9 / 13 天到达各级；重度用户 8 天可走完到终极。
 */
export const FORMS: FormDef[] = [
  { id: "baby",     name: "幼体",   threshold: 30,  desc: "刚破壳，还带着蛋壳的余温，对什么都好奇。" },
  { id: "youth",    name: "少年体", threshold: 60,  desc: "长开了些，性格开始显形，话也变多了。" },
  { id: "adult",    name: "成体",   threshold: 100, desc: "身形稳定下来，是它最像「自己」的样子。" },
  { id: "perfect",  name: "完全体", threshold: 150, desc: "气质全部展开，一眼就能看出它被你养成了什么。" },
  { id: "ultimate", name: "终极体", threshold: 200, desc: "和你一起走到的形态，往后再难有变化。" },
];

/** 取某个形态的定义，查不到时兜底到幼体 */
export function getForm(id: FormLevel | string | null): FormDef {
  return FORMS.find(f => f.id === id) || FORMS[0];
}

/** 某个亲密度下"应该"处于哪一级形态 */
export function formForIntimacy(intimacy: number): FormDef {
  let cur = FORMS[0];
  for (const f of FORMS) if (intimacy >= f.threshold) cur = f;
  return cur;
}

/** 下一级形态；已是终极时返回 null */
export function nextForm(id: FormLevel | string | null): FormDef | null {
  const i = FORMS.findIndex(f => f.id === (id || "baby"));
  return i >= 0 && i < FORMS.length - 1 ? FORMS[i + 1] : null;
}

// ==================== 进化方向（分支） ====================

/**
 * 进化方向（§5.2）。每次进化都会重新 roll 一次，
 * 决定它的外观修饰和性格走向 —— 这是"数码宝贝式"不确定性的来源。
 */
export type EvolveBranch = "positive" | "balanced" | "negative" | "rare";

export interface BranchDef {
  id: EvolveBranch;
  name: string;
  /**
   * 基础概率，四项之和为 1。
   *
   * 注意：这里**没有**照抄文档 §5.2 的 50/25/15/10。
   * 用户实际试玩后反馈"负向只有 8% 太低"，所以把负向从 15% 提到 25%。
   * 文档原值下，被好好对待的宠物负向概率会低到 8% ——
   * 那意味着"进化方向"这件事几乎没有翻盘的可能，
   * 而 §5.3 的整个设计（正向也会加深缺陷、负向也会吞掉优势）
   * 恰恰依赖结果不可预期。现在被宠爱时负向约 16%，被冷落时约 48%。
   */
  base: number;
  /** 外观修饰：给形象层用 */
  look: string;
  /** 性格走向：给提示词层用（§5.3 加深性格缺陷） */
  trait: string;
}

export const BRANCHES: BranchDef[] = [
  {
    id: "positive", name: "正向", base: 0.44,
    look: "暖色、有光泽、轮廓完整",
    trait: "性格里的优势被放大 —— 但它对应的短板也会一起加深，不是变成完美宠物",
  },
  {
    id: "balanced", name: "均衡", base: 0.21,
    look: "中性色、标准轮廓",
    trait: "各个维度都小幅成长，没有哪一面特别突出",
  },
  {
    id: "negative", name: "负向", base: 0.25,
    look: "冷色、裂纹、轮廓残缺",
    trait: "短板吞掉优势，变得偏执、带刺，甚至不太信任主人",
  },
  {
    id: "rare", name: "稀有", base: 0.10,
    look: "特殊配色、隐藏特征",
    trait: "产生变异维度，出现常规 16 型里没有的特质",
  },
];

export function getBranch(id: EvolveBranch | string | null): BranchDef | null {
  return BRANCHES.find(b => b.id === id) || null;
}

// ==================== 分支权重修正（§5.2 第 1、2 步） ====================

/** 进化时用到的近期互动统计 */
export interface RecentActivity {
  /** 近 7 天里有互动的天数 */
  activeDays: number;
  /** 近 7 天的日均对话轮数 */
  avgRounds: number;
  /** 近 7 天里问候（早安/晚安）的次数 */
  greetings: number;
}

/**
 * 按主人近期的互动方式调整各分支权重（§5.2：先看行为模式，再 roll）。
 *
 * 设计意图：让"被怎么对待"真的影响它长成什么样 ——
 * 陪伴多、有问候习惯的，更容易往正向走；被冷落的，更容易负向。
 * 但保留基础概率，所以**结果始终不确定**，这是数码宝贝式的乐趣所在。
 */
export function branchWeights(a: RecentActivity): Record<EvolveBranch, number> {
  // 基础概率只从 BRANCHES 取一次，避免两处各写一份、改一处漏一处
  const w: Record<EvolveBranch, number> = { positive: 0, balanced: 0, negative: 0, rare: 0 };
  for (const b of BRANCHES) w[b.id] = b.base;

  // 陪伴密度：近 7 天几乎天天有互动 → 正向加分
  if (a.activeDays >= 6) { w.positive += 0.15; w.negative -= 0.05; }
  else if (a.activeDays >= 4) { w.positive += 0.07; }
  // 被冷落：一周里只碰过一两天 → 负向加分
  else if (a.activeDays <= 1) { w.positive -= 0.15; w.negative += 0.20; }
  else if (a.activeDays <= 2) { w.positive -= 0.08; w.negative += 0.10; }

  // 聊得多说明陪着的时间长
  if (a.avgRounds >= 8) w.positive += 0.08;
  else if (a.avgRounds >= 3) w.positive += 0.04;
  else if (a.avgRounds < 1) { w.positive -= 0.05; w.negative += 0.05; }

  // 有早安/晚安的习惯，是"把它当回事"的信号
  if (a.greetings >= 7) w.positive += 0.06;
  else if (a.greetings >= 3) w.positive += 0.03;

  // 兜底：任何一项都不该变成负数或 0
  for (const k of Object.keys(w) as EvolveBranch[]) w[k] = Math.max(0.01, w[k]);

  // 归一化，保证可以直接当概率用
  const sum = (Object.values(w) as number[]).reduce((x, y) => x + y, 0);
  for (const k of Object.keys(w) as EvolveBranch[]) w[k] = w[k] / sum;
  return w;
}

/** 按权重 roll 一个方向 */
export function rollBranch(a: RecentActivity, rand: number = Math.random()): EvolveBranch {
  const w = branchWeights(a);
  let acc = 0;
  const order: EvolveBranch[] = ["positive", "balanced", "negative", "rare"];
  for (const k of order) {
    acc += w[k];
    if (rand < acc) return k;
  }
  return "balanced";
}
