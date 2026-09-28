import { reactive, computed, ref } from "vue";
import { httpFetch } from "../lib/http";
import { getPersonality, getColor, getPersonalityPrompt } from "../data/personalities";
import { analyzeConversation, type MbtiAnalysis } from "../lib/mbti-analysis";

export interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

interface PetState {
  stage: "egg" | "pet";
  intimacy: number;
  mbti: string | null;
  messages: Message[];
  apiKey: string;
  model: string;
  baseUrl: string;
  jevKey: string;
  jevBaseUrl: string;
  chatOpen: boolean;
  lastPetTime: number;
  /** 上次活跃日期 YYYY-MM-DD，用于跨天结算衰减 */
  lastActiveDate: string;
  /** 今日已加分的对话轮数（每日上限 20） */
  dailyChatCount: number;
  /** 今日早安是否已加分 */
  greetDone: boolean;
  /** 今日晚安是否已加分 */
  nightDone: boolean;
}

const STORAGE_KEY = "spiritpet_state";

/** 纯 UI 瞬时状态，不落盘：重启后应当回到默认值 */
const TRANSIENT_KEYS = new Set<keyof PetState>(["chatOpen"]);

/**
 * 全部字段的默认值 —— 同时充当持久化白名单。
 *
 * 新增状态字段只要加在这里，存取两端会自动跟上，
 * 不会再出现「加了字段忘了存 / 忘了读」这类 bug。
 * 此前 jevKey、jevBaseUrl、lastPetTime、messages 都因此丢过，
 * 所以不再手写两份字段列表。
 */
function defaults(): PetState {
  return {
    stage: "egg",
    intimacy: 0,
    mbti: null,
    messages: [],
    apiKey: "",
    model: "gpt-4o-mini",
    baseUrl: "https://api.openai.com",
    jevKey: "",
    jevBaseUrl: "https://api.typesafe.ai",
    chatOpen: false,
    lastPetTime: 0,
    lastActiveDate: "",
    dailyChatCount: 0,
    greetDone: false,
    nightDone: false,
  };
}

const ALL_KEYS = Object.keys(defaults()) as (keyof PetState)[];

function loadState(): Partial<PetState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};

    // 只认已知字段：结构变更或存档损坏时，未知字段丢弃、缺失字段回退默认值
    const src = parsed as Record<string, unknown>;
    const out: Partial<PetState> = {};
    for (const k of ALL_KEYS) {
      if (k in src) (out as Record<string, unknown>)[k] = src[k];
    }
    // 数组字段单独校验：取值损坏会让渲染直接崩，宁可丢掉重新开始
    if (!Array.isArray(out.messages)) delete out.messages;
    return out;
  } catch {
    return {};
  }
}

function saveState(state: PetState) {
  const data: Record<string, unknown> = {};
  for (const k of ALL_KEYS) {
    if (TRANSIENT_KEYS.has(k)) continue;
    data[k] = state[k];
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // 存档写不进去（配额满/隐私模式）不该让聊天本身失败
  }
}

// defaults() 每次返回全新对象（messages 是新数组），铺开安全，不会共享引用
export const pet = reactive<PetState>({ ...defaults(), ...loadState() });

export const hasApiKey = computed(() => pet.apiKey.length > 0);
export const hasJevKey = computed(() => pet.jevKey.length > 0);
export const intimacyPercent = computed(() => Math.min(100, (pet.intimacy / 30) * 100));
export const mbtiColor = computed(() => getColor(pet.mbti));



/** 重新养一只：清空进度回到蛋阶段 */
export function resetPet() {
  pet.stage = "egg";
  pet.intimacy = 0;
  pet.mbti = null;
  pet.messages = [];
  pet.lastPetTime = 0;
  pet.lastActiveDate = "";
  pet.dailyChatCount = 0;
  pet.greetDone = false;
  pet.nightDone = false;
  hatchAnalysis.value = null;
  saveState(pet);
}

export function addIntimacy(amount: number) {
  pet.intimacy = Math.min(999, pet.intimacy + amount);
  saveState(pet);
}

/** 抚摸冷却时间（毫秒），防止连点刷亲密度 */
const PET_COOLDOWN = 30_000;

/**
 * 抚摸宠物。
 * @returns true = 本次增加了亲密度；false = 冷却中（只播放动画）
 */
export function petTouch(): boolean {
  const now = Date.now();
  if (now - pet.lastPetTime < PET_COOLDOWN) return false;
  pet.lastPetTime = now;
  addIntimacy(1);
  return true;
}

// ==================== 亲密度规则（设计文档 §4） ====================

/** 每日对话加分上限（§4.2） */
const DAILY_CHAT_CAP = 20;
/** 蛋期每轮对话加分（§3.2 规定 +1~3，取中间值让闭环 15 轮左右可达） */
const EGG_CHAT_GAIN = 2;
/** 每日衰减率（§4.4：每天凌晨 总亲密度 × 0.5%） */
const DAILY_DECAY = 0.995;

function todayStr(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return d.getFullYear() + "-" + m + "-" + day;
}

/**
 * 跨天结算。
 * 按实际间隔天数补齐衰减（隔了 3 天就衰减 3 次），
 * 否则放着不管一个月，回来只掉 0.5% 就失去意义了。
 */
function rolloverDay() {
  const today = todayStr();
  if (pet.lastActiveDate === today) return;

  if (pet.lastActiveDate && pet.intimacy > 0) {
    const prev = new Date(pet.lastActiveDate + "T00:00:00").getTime();
    const now = new Date(today + "T00:00:00").getTime();
    const days = Math.max(1, Math.round((now - prev) / 86400000));
    pet.intimacy = Math.floor(pet.intimacy * Math.pow(DAILY_DECAY, days));
  }

  pet.lastActiveDate = today;
  pet.dailyChatCount = 0;
  pet.greetDone = false;
  pet.nightDone = false;
}

const MORNING_WORDS = ["早安", "早上好", "早啊", "早呀", "morning"];
const NIGHT_WORDS = ["晚安", "去睡了", "睡了", "night"];

/**
 * 对话奖励（§4.2）。
 * 超过每日上限后仍可正常聊天，只是不再加分——
 * 这是刻意的：防止用户挂机刷亲密度，让关系增长有节奏。
 */
export function chatReward(): boolean {
  rolloverDay();
  if (pet.dailyChatCount >= DAILY_CHAT_CAP) {
    saveState(pet);
    return false;
  }
  pet.dailyChatCount++;
  addIntimacy(pet.stage === "egg" ? EGG_CHAT_GAIN : 1);
  return true;
}

/**
 * 早安/晚安奖励（§4.2，每日各限 1 次 +3）。
 * @returns "morning" | "night" | null
 */
export function greetReward(text: string): string | null {
  rolloverDay();
  const t = text.toLowerCase();
  if (!pet.greetDone && MORNING_WORDS.some(w => t.includes(w))) {
    pet.greetDone = true;
    addIntimacy(3);
    return "morning";
  }
  if (!pet.nightDone && NIGHT_WORDS.some(w => t.includes(w))) {
    pet.nightDone = true;
    addIntimacy(3);
    return "night";
  }
  return null;
}

/** 破壳时的性格分析结果，供破壳仪式展示「它为什么长成这样」 */
export const hatchAnalysis = ref<MbtiAnalysis | null>(null);

export function tryHatch(): boolean {
  if (pet.intimacy >= 30 && pet.stage === "egg") {
    // 首次 MBTI 分配：分析破壳前的对话风格，而不是掷骰子（§3.3）
    const analysis = analyzeConversation(pet.messages);
    hatchAnalysis.value = analysis;
    pet.stage = "pet";
    pet.mbti = analysis.mbti;
    saveState(pet);
    return true;
  }
  return false;
}

export function saveConfig(key: string, model: string, baseUrl: string, jevKey?: string, jevBaseUrl?: string) {
  pet.apiKey = key;
  pet.model = model;
  pet.baseUrl = baseUrl.replace(/\/$/, "");
  if (jevKey !== undefined) pet.jevKey = jevKey;
  if (jevBaseUrl !== undefined) pet.jevBaseUrl = jevBaseUrl;
  saveState(pet);
}

export function addMessage(role: "user" | "assistant", content: string) {
  pet.messages.push({ role, content, timestamp: Date.now() });
  // 只保留最近 50 条，避免 localStorage 无限膨胀
  if (pet.messages.length > 50) pet.messages.shift();
  // 关键：每落一条就存盘，否则重启即丢。
  // 用户消息与宠物回复各触发一次，两次写入开销可忽略
  saveState(pet);
}

export async function callJevRouter(userInput: string): Promise<string | null> {
  if (!hasJevKey.value) return null;
  try {
    const base = pet.jevBaseUrl.replace(/\/$/, "");
    const path = /\/v1$/.test(base) ? "/chat/completions" : "/v1/chat/completions";
    const res = await httpFetch(base + path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + pet.jevKey,
      },
      body: JSON.stringify({
        model: "jev-1.13",
        messages: [
          {
            role: "system",
            content: "Classify the user message into: greeting, casual, emotional, query, or command. Reply with ONE word only.",
          },
          { role: "user", content: userInput },
        ],
        max_tokens: 10,
        temperature: 0.1,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return (data.choices?.[0]?.message?.content || "").trim().toLowerCase();
  } catch {
    return null;
  }
}

// ==================== 时间感知 ====================

/**
 * 组装当前时间上下文，注入 system prompt。
 *
 * 模型自身没有时钟：不注入的话它会把"现在"当成训练数据截止的那一天，
 * 于是半夜跟你说早安、把几年前的旧闻当成今天的事。
 * 这是纯本地信息，零成本，但对桌宠的"活着感"影响很大。
 */
function timeContext(): string {
  const now = new Date();
  const WEEK = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  const pad = (n: number) => String(n).padStart(2, "0");
  const h = now.getHours();
  const date =
    now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate());

  // 时段分得细一点，宠物才好自然用上：半夜该说晚安，而不是"下午好"
  const period =
    h < 5 ? "深夜" : h < 8 ? "清晨" : h < 11 ? "上午" : h < 13 ? "中午"
    : h < 17 ? "下午" : h < 19 ? "傍晚" : h < 23 ? "晚上" : "深夜";

  const lines = [
    "【当前时间】" + date + " " + WEEK[now.getDay()] + " " + pad(h) + ":" + pad(now.getMinutes()) + "（" + period + "）",
  ];

  // 距上次对话多久 —— 有了它宠物才能说"好久不见"，
  // 而不是每次重逢都装作没分开过。
  // 注意 chat() 会先把本条用户消息入队，所以这里要往前取两条。
  const prev = pet.messages[pet.messages.length - 2];
  if (prev) {
    const gapMin = (Date.now() - prev.timestamp) / 60000;
    if (gapMin >= 60) {
      lines.push(
        "【距上次聊天】" +
          (gapMin < 1440
            ? Math.floor(gapMin / 60) + " 小时"
            : Math.floor(gapMin / 1440) + " 天") +
          "（重逢时可以自然地带一句，但别刻意煽情）"
      );
    }
  }

  return lines.join("\n");
}
export async function chat(userInput: string): Promise<string> {
  addMessage("user", userInput);

  // Jev 路由：分类消息类型，决定上下文长度
  let contextMsgCount = 20;
  const jevResult = await callJevRouter(userInput);
  if (jevResult) {
    if (jevResult === "greeting" || jevResult === "casual") {
      contextMsgCount = 2;
    }
  }

  let extraHint = "";
  if (contextMsgCount < 20) {
    extraHint = "【注意：用户只是简单互动，请简短回应，1-2句话即可。】";
  }

  // 亲密度影响语气：从生疏到亲密
  const bondTone =
    pet.intimacy >= 60 ? "你们已经很亲近了，语气可以放松、亲昵一些。" :
    pet.intimacy >= 30 ? "你们已经熟悉了，语气自然即可。" :
    "你们还不太熟，稍微含蓄一点，不要过分热情。";

  const persona = getPersonality(pet.mbti);
  const timeCtx = timeContext();

  const systemPrompt = pet.stage === "egg"
    ? "你是一枚神秘的宠物蛋。你还没有破壳，但已经能感受到主人的温暖。说话要简短、模糊、带点神秘感。每次只说 1-2 句话。\n" +
      timeCtx + extraHint
    : persona.prompt +
      "\n" +
      "你是一只桌面宠物，性格类型 " + persona.mbti + "（" + persona.title + "）。\n" +
      bondTone + "\n" +
      "当前亲密度：" + pet.intimacy + "。\n" +
      timeCtx + "\n" +
      "【最重要的规则】每次只说 1-2 句话，严格保持上面那种说话方式和标点习惯。" +
      "不要长篇大论，不要用列表，不要说教。" + extraHint;

  const msgs = pet.messages.slice(-contextMsgCount).map(m => ({ role: m.role, content: m.content }));

  const body = JSON.stringify({
    model: pet.model,
    messages: [{ role: "system", content: systemPrompt }, ...msgs],
    max_tokens: 300,
    temperature: 0.8,
  });

  try {
    let base = pet.baseUrl.replace(/\/$/, "");
    let paths: string[];
    if (/\/v1$/.test(base)) {
      paths = ["/chat/completions"];
    } else {
      paths = ["/chat/completions", "/v1/chat/completions"];
    }
    let errs: string[] = [];
    let data: any = null;

    for (const p of paths) {
      const url = base + p;
      try {
        const res = await httpFetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + pet.apiKey,
          },
          body,
        });
        if (res.ok) {
          data = await res.json();
          break;
        }
        const errBody = await res.text().catch(() => "");
        errs.push(url + " HTTP " + res.status + ": " + errBody.substring(0, 80));
      } catch (e: any) {
        errs.push(url + " " + e.message);
      }
    }

    if (!data) throw new Error(errs.join(" | "));

    const reply = data.choices?.[0]?.message?.content || "(no response)";

    addMessage("assistant", reply);

    // 亲密度奖励：早安/晚安 +3（每日各 1 次）、对话加分（蛋期 +2 / 宠物 +1，每日上限 20 轮）
    greetReward(userInput);
    chatReward();

    return reply;
  } catch (e: any) {
    const errMsg = "[错误] " + e.message;
    addMessage("assistant", errMsg);
    return errMsg;
  }
}

// 提示词改由 data/personalities.ts 提供
// 每个类型含：说话节奏 / 标点习惯 / 关心方式 / 绝对不做的事 / 示例对话
function getMBTIPrompt(mbti: string): string {
  return getPersonalityPrompt(mbti);
}