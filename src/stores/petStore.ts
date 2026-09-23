import { reactive, computed } from "vue";
import { httpFetch } from "../lib/http";
import { MBTI_LIST, getPersonality, getColor, getPersonalityPrompt } from "../data/personalities";

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
}

// 16 种类型与配色统一由 data/personalities.ts 提供
// （旧版本这里手写的数组只有 14 种，漏了 ISFP / ESFP，永远抽不到）
const MBTI_TYPES = MBTI_LIST;

function loadState(): Partial<PetState> {
  try {
    const saved = localStorage.getItem("spiritpet_state");
    if (saved) return JSON.parse(saved);
  } catch {}
  return {};
}

function saveState(state: PetState) {
  localStorage.setItem("spiritpet_state", JSON.stringify({
    stage: state.stage,
    intimacy: state.intimacy,
    mbti: state.mbti,
    apiKey: state.apiKey,
    model: state.model,
    baseUrl: state.baseUrl,
    jevKey: state.jevKey,
    jevBaseUrl: state.jevBaseUrl,
    lastPetTime: state.lastPetTime,
  }));
}

const saved = loadState();

export const pet = reactive<PetState>({
  stage: saved.stage || "egg",
  intimacy: saved.intimacy || 0,
  mbti: saved.mbti || null,
  messages: [],
  apiKey: saved.apiKey || "",
  jevKey: saved.jevKey || "",
  jevBaseUrl: saved.jevBaseUrl || "https://api.typesafe.ai",
  model: saved.model || "gpt-4o-mini",
  baseUrl: saved.baseUrl || "https://api.openai.com",
  chatOpen: false,
  lastPetTime: saved.lastPetTime || 0,
});

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
  if (pet.stage === "egg") {
    addIntimacy(1);
  } else {
    saveState(pet);
  }
  return true;
}

export function tryHatch(): boolean {
  if (pet.intimacy >= 30 && pet.stage === "egg") {
    pet.stage = "pet";
    pet.mbti = MBTI_TYPES[Math.floor(Math.random() * MBTI_TYPES.length)];
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
  if (pet.messages.length > 50) pet.messages.shift();
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
  const systemPrompt = pet.stage === "egg"
    ? "你是一枚神秘的宠物蛋。你还没有破壳，但已经能感受到主人的温暖。说话要简短、模糊、带点神秘感。每次只说 1-2 句话。" + extraHint
    : persona.prompt +
      "\n" +
      "你是一只桌面宠物，性格类型 " + persona.mbti + "（" + persona.title + "）。\n" +
      bondTone + "\n" +
      "当前亲密度：" + pet.intimacy + "。\n" +
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

    if (pet.stage === "egg") {
      addIntimacy(1);
    }

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