// 破壳时的首次 MBTI 分配（设计文档 §3.3）
//
// 核心设计：宠物的性格不是掷骰子出来的，而是**被主人养出来的**。
// 你平时怎么跟它说话，它就会长成什么性格——
// 这才是"养成"两个字的意义所在。
//
// 分配方式 = 对话风格分析 + 加权映射 + 10~20% 随机偏移
// 最后那个随机偏移是刻意的：宠物要有"自己的意志"，
// 不然用户摸清规律后就能刷出想要的性格，养成感就没了。

/** 只依赖最小字段，避免和 petStore 循环引用 */
export interface ChatMessage {
  role: string;
  content: string;
}

export interface MbtiScores {
  E: number; I: number;
  S: number; N: number;
  T: number; F: number;
  J: number; P: number;
}

export interface MbtiAnalysis {
  /** 最终类型 */
  mbti: string;
  /** 八个字母各自的得分 */
  scores: MbtiScores;
  /** 参与分析的主人消息条数 */
  sampleCount: number;
  /** 人类可读的判定理由，用于破壳时展示"它为什么是这个性格" */
  reasons: string[];
}

// ---------------- 关键词库 ----------------

/** 外向信号：情绪外放、语气词多、爱反问 */
const E_WORDS = ["哈哈", "嘿嘿", "嘻嘻", "哇", "耶", "哎", "诶", "嘿", "冲", "走起", "来嘛", "好玩", "有意思"];
/** 内向信号：克制、陈述、留白 */
const I_WORDS = ["嗯", "好的", "还行", "算了", "没事", "随便说说", "不知道"];

/** 实感信号：具体的人事物、时间地点 */
const S_WORDS = ["今天", "明天", "昨天", "吃饭", "睡觉", "几点", "工作", "上班", "下班", "天气", "天气", "买了", "花了", "地铁", "公司", "家里", "手机", "电脑"];
/** 直觉信号：抽象、假设、追问本质 */
const N_WORDS = ["感觉", "好像", "如果", "为什么", "其实", "也许", "意义", "假设", "说不定", "大概", "想象", "本质", "或许"];

/** 思考信号：归因、效率、解决问题 */
const T_WORDS = ["因为", "所以", "应该", "问题", "解决", "效率", "逻辑", "分析", "原因", "方案", "反正", "为什么不"];
/** 情感信号：情绪、共情、关系 */
const F_WORDS = ["开心", "难过", "累了", "好累", "喜欢", "讨厌", "心疼", "加油", "辛苦", "陪你", "想你", "抱抱", "谢谢", "对不起", "感动"];

/** 判断信号：计划、必须、完成 */
const J_WORDS = ["计划", "必须", "一定要", "完成", "安排", "准备", "明天要", "后天要", "得先", "赶紧", "deadline", "截止", "记得", "该做", "要做", "几点", "什么时候", "定个", "清单", "进度", "加班", "开会"];
/** 知觉信号：随性、开放 */
const P_WORDS = ["随便", "看情况", "再说", "都行", "无所谓", "不一定", "到时候", "先这样", "慢慢来", "不急", "看吧", "可能吧", "以后再说", "懒得", "算了", "再说吧", "随缘", "碰运气"];

function countHits(text: string, words: string[]): number {
  let n = 0;
  for (const w of words) {
    let idx = 0;
    while ((idx = text.indexOf(w, idx)) !== -1) {
      n++;
      idx += w.length;
    }
  }
  return n;
}

function countChar(text: string, chars: string): number {
  let n = 0;
  for (const c of text) if (chars.includes(c)) n++;
  return n;
}

// ---------------- 分析 ----------------

export function analyzeConversation(messages: ChatMessage[]): MbtiAnalysis {
  // 只看主人说的话——宠物自己的话不算，性格是主人塑造的
  const userMsgs = messages
    .filter(m => m.role === "user")
    .map(m => m.content.trim())
    .filter(t => t.length > 0);

  const scores: MbtiScores = { E: 0, I: 0, S: 0, N: 0, T: 0, F: 0, J: 0, P: 0 };

  if (userMsgs.length === 0) {
    // 一句话都没说过就破壳了（纯靠抚摸？）——纯随机
    return {
      mbti: randomType(),
      scores,
      sampleCount: 0,
      reasons: ["你们还没怎么说过话，它凭自己的直觉长成了这样。"],
    };
  }

  const joined = userMsgs.join("\n");
  const avgLen = joined.length / userMsgs.length;

  // ---- E / I：只看情绪和语气的表达方式 ----
  // 刻意不用"消息长度"判断：话痨写长句，理性的人写长句，
  // 长度在这里是噪声不是信号——早期版本用它，导致理性分析型被误判成 100% E。
  const emojiCount = (joined.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu) || []).length;

  scores.E += countChar(joined, "！!") * 1.6;
  scores.E += countHits(joined, E_WORDS) * 1.8;
  scores.E += countChar(joined, "～~") * 1.2;
  scores.E += countChar(joined, "？?") * 0.5;
  scores.E += emojiCount * 1.5;

  scores.I += countChar(joined, "。") * 0.7;
  scores.I += countHits(joined, I_WORDS) * 1.5;
  scores.I += countChar(joined, "…") * 1.2;
  // 短句且全程没有情绪外放标记，才算内向信号
  if (avgLen < 8 && countChar(joined, "！!") === 0) scores.I += userMsgs.length * 0.9;

  // ---- S / N：具体 vs 抽象 ----
  scores.S += countHits(joined, S_WORDS) * 1.4;
  scores.N += countHits(joined, N_WORDS) * 1.6;
  // 问"为什么"是典型的 N
  scores.N += countHits(joined, ["为什么", "怎么才能", "是不是"]) * 1.0;

  // ---- T / F：理性 vs 感性 ----
  scores.T += countHits(joined, T_WORDS) * 1.5;
  scores.F += countHits(joined, F_WORDS) * 1.5;

  // ---- J / P：条理 vs 随性 ----
  scores.J += countHits(joined, J_WORDS) * 1.6;
  scores.P += countHits(joined, P_WORDS) * 1.6;

  // ---- 判定每个维度 ----
  const ei = decide(scores.E, scores.I, "E", "I");
  const sn = decide(scores.S, scores.N, "S", "N");
  const tf = decide(scores.T, scores.F, "T", "F");
  const jp = decide(scores.J, scores.P, "J", "P");

  const mbti = ei + sn + tf + jp;

  // ---- 生成人话版解释 ----
  const reasons: string[] = [];
  const total = scores.E + scores.I;
  if (total > 0) {
    reasons.push(ei === "E"
      ? "你和它说话总是很热闹，它也学会了这种活力。"
      : "你的话不多但都很认真，它也长成了安静的样子。");
  }
  const snTotal = scores.S + scores.N;
  if (snTotal > 0) {
    reasons.push(sn === "N"
      ? "你总爱想些「如果」和「为什么」，它也学会了往深处看。"
      : "你聊的都是实实在在的事，它也活得很落地。");
  }
  const tfTotal = scores.T + scores.F;
  if (tfTotal > 0) {
    reasons.push(tf === "F"
      ? "你常跟它讲感受，它也就学会了先心疼人。"
      : "你习惯讲道理、捋逻辑，它也学会了先分析问题。");
  }
  const jpTotal = scores.J + scores.P;
  if (jpTotal > 0) {
    reasons.push(jp === "J"
      ? "你做事有计划，它也沾染了这份条理。"
      : "你活得随性，它也学会了不着急。");
  }
  if (reasons.length === 0) {
    reasons.push("你说的话太少了，它凭自己的直觉长成了这样。");
  }

  return { mbti, scores, sampleCount: userMsgs.length, reasons };
}

/**
 * 单维度判定。
 * 关键在于最后那个随机偏移——它模拟"宠物有自己的意志"。
 * 信息越少，随机占比越大；即使信号很强，也保留 10% 的翻盘可能。
 */
function decide(a: number, b: number, aLetter: string, bLetter: string): string {
  const total = a + b;
  if (total === 0) return Math.random() < 0.5 ? aLetter : bLetter;

  // ① 信号强度决定采信度。总分不到 4 分说明证据不足，应该接近随机——
  //    少了这一步，0.5 : 0 这种噪声也会被当成"100% 确定 E"，
  //    实测会让理性分析型的人被稳定误判成外向。
  const confidence = Math.min(1, total / 4);
  const pA = 0.5 + (a / total - 0.5) * confidence;

  // ② 宠物自己的意志：即使信号很强也保留 10~20% 的翻盘可能，
  //    否则用户摸清规律后就能刷出想要的性格，养成感就没了。
  //    注意这里必须写成「先算最终概率再采样」，而不是
  //    pA*(1-jitter) + rand*jitter —— 后者在 pA≈0.5 附近过度敏感，
  //    0.56 的微弱倾向会被放大成 85% 的判定。
  const jitter = 0.10 + Math.random() * 0.10;
  const pFinal = 0.5 + (pA - 0.5) * (1 - jitter);

  return Math.random() < pFinal ? aLetter : bLetter;
}

const ALL_TYPES = [
  "INFP", "ENFP", "INTJ", "ENTP", "ISTJ", "ESTJ", "INTP", "ENFJ",
  "INFJ", "ISFJ", "ESFJ", "ISTP", "ESTP", "ENTJ", "ISFP", "ESFP",
];

function randomType(): string {
  return ALL_TYPES[Math.floor(Math.random() * ALL_TYPES.length)];
}
