import { reactive, computed } from "vue";

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
}

const MBTI_TYPES = [
  "INFP", "ENFP", "INTJ", "ENTP", "ISTJ", "ESTJ", "INTP", "ENFJ",
  "INFJ", "ISFJ", "ESFJ", "ISTP", "ESTP", "ENTJ",
];

const MBTI_COLORS: Record<string, string> = {
  INFP: "#b39ddb", ENFP: "#ff8a65", INTJ: "#5c6bc0", ENTP: "#ff7043",
  ISTJ: "#66bb6a", ESTJ: "#43a047", INTP: "#7e57c2", ENFJ: "#ef5350",
  INFJ: "#ce93d8", ISFJ: "#81c784", ESFJ: "#a5d6a7", ISTP: "#90a4ae",
  ESTP: "#ffa726", ENTJ: "#42a5f5", ISFP: "#f48fb1", ESFP: "#ffcc80",
};

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
});

export const hasApiKey = computed(() => pet.apiKey.length > 0);
export const hasJevKey = computed(() => pet.jevKey.length > 0);
export const intimacyPercent = computed(() => Math.min(100, (pet.intimacy / 30) * 100));
export const mbtiColor = computed(() => (pet.mbti ? MBTI_COLORS[pet.mbti] || "#90a4ae" : "#90a4ae"));



export function addIntimacy(amount: number) {
  pet.intimacy = Math.min(999, pet.intimacy + amount);
  saveState(pet);
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
    const res = await fetch(base + path, {
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

  const systemPrompt = pet.stage === "egg"
    ? "你是一枚神秘的宠物蛋。你还没有破壳，但已经能感受到主人的温暖。说话要简短、模糊、带点神秘感。每次只说1-2句话。" + extraHint
    : `你是一只叫 SpiritPet 的桌面宠物。你的性格类型是 ${pet.mbti}。${getMBTIPrompt(pet.mbti || "INFP")}\n你现在的亲密度是 ${pet.intimacy}（满值30时你破壳了）。说话要简短自然，每次1-3句话。` + extraHint;

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
        const res = await fetch(url, {
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

function getMBTIPrompt(mbti: string): string {
  const prompts: Record<string, string> = {
    INFP: "你温柔、敏感、富有诗意。说话常常用比喻，关注感受。",
    ENFP: "你热情、充满好奇心、爱说话。语气活泼跳跃，经常用感叹号。",
    INTJ: "你理性、精炼、有点高冷。说话简洁直接，偶尔毒舌。",
    ENTP: "你聪明、爱抬杠、思维跳跃。喜欢反问和辩论。",
    ISTJ: "你可靠、守规矩、务实。说话精确有条理，偶尔唠叨。",
    ESTJ: "你果断、有领导力、直率。说话干脆利落，喜欢给建议。",
    INTP: "你理性、爱思考、有点宅。说话带着分析欲，偶尔跑题讲原理。",
    ENFJ: "你温暖、善于鼓励人、有感染力。说话体贴包容。",
    INFJ: "你有洞察力、安静但有深度。说话温和但有力量。",
    ISFJ: "你体贴、细心、默默付出。说话温柔，喜欢关心人。",
    ESFJ: "你热情大方、爱照顾人。说话唠叨但暖心。",
    ISTP: "你冷静、务实、动手能力强。说话简洁不爱废话。",
    ESTP: "你精力充沛、爱冒险、喜欢新鲜。说话直接有力。",
    ENTJ: "你有战略眼光、果断自信。说话有说服力和目标感。",
    ISFP: "你安静、敏感、有艺术气质。说话柔软而诗意。",
    ESFP: "你活泼开朗、爱热闹、享受当下。说话幽默风趣。",
  };
  return prompts[mbti] || "你是一个有个性的宠物。";
}