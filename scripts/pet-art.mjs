// 16 种 MBTI 形象的美术规格
//
// ⚠️ 一致性是生成多角色图最大的难点。
// 如果每张图各写各的 prompt，出来的 16 只宠物会像 16 个不同世界的东西。
// 解法：所有图共用同一段 STYLE 前缀，只在中间替换「性格特征 + 主色」，
// 并且显式锁死视角(正面)、构图(居中全身)、背景(纯白)，把自由度压到最小。
//
// 主色与人 data/personalities.ts 里的 color 一致，保证 UI 徽章和形象同色系。

/** 公共风格前缀——决定 16 张图看起来是不是同一个系列 */
export const STYLE = [
  "cute chibi mascot creature",
  "kawaii style",
  "soft rounded body",
  "thick clean outlines",
  "flat vector illustration with soft cel shading",
  "big glossy expressive eyes",
  "full body, front facing, centered composition",
  "sticker design",
  "plain pure white background",
  "no text, no watermark, no border, no drop shadow on background",
  "clean lineart, high quality",
].join(", ");

/**
 * 每种性格的差异化描述。
 * 设计原则：外貌要能"一眼看出性格"——
 * 眼睛形状(圆/细/半睁)、姿态(前倾/挺直/蜷缩)、小道具(书/扳手/画笔)是关键。
 */
export const ART = {
  INFP: {
    color: "soft lavender",
    subject: "gentle dreamy creature with big soft droopy eyes and a shy smile, holding a tiny book, flower petals floating around",
  },
  ENFP: {
    color: "vivid coral orange",
    subject: "bouncy energetic creature mid-jump with a huge open grin, arms raised, sparkles and stars bursting around it",
  },
  INTJ: {
    color: "deep indigo blue",
    subject: "sleek composed creature with narrow sharp half-lidded eyes and a flat neutral mouth, small round glasses, floating geometric triangles",
  },
  ENTP: {
    color: "strong deep orange",
    subject: "mischievous creature with a sly smirk and one raised eyebrow, one hand on chin, a glowing lightbulb above its head",
  },
  ISTJ: {
    color: "steady leaf green",
    subject: "neat orderly creature sitting perfectly upright with calm round eyes and a small serious mouth, holding a tiny clipboard",
  },
  ESTJ: {
    color: "confident forest green",
    subject: "sturdy commanding creature standing firm with determined eyes and a straight mouth, wearing a tiny necktie, arms crossed",
  },
  INTP: {
    color: "muted violet purple",
    subject: "curious absent-minded creature with wide thoughtful eyes looking upward, small gears and formulas floating around it",
  },
  ENFJ: {
    color: "warm bright red",
    subject: "warm radiant creature with a kind bright smile and open welcoming arms, a soft glowing halo behind it",
  },
  INFJ: {
    color: "pale lilac purple",
    subject: "serene mysterious creature with calm deep eyes and a faint knowing smile, a tiny candle flame glowing beside it",
  },
  ISFJ: {
    color: "soft sage green",
    subject: "gentle caring creature with kind worried eyes and a small warm smile, holding a tiny first-aid kit",
  },
  ESFJ: {
    color: "fresh mint green",
    subject: "cheerful sociable creature with a big wide smile and rosy cheeks, wearing a tiny apron, tiny hearts floating",
  },
  ISTP: {
    color: "cool blue grey",
    subject: "cool calm creature with relaxed half-lidded eyes and a flat mouth, holding a small wrench, slightly slouched posture",
  },
  ESTP: {
    color: "bold amber orange",
    subject: "bold energetic creature with a confident toothy grin, sunglasses pushed up on its head, dynamic leaning forward pose",
  },
  ENTJ: {
    color: "strong azure blue",
    subject: "strong leader creature with sharp determined eyes and a confident smile, wearing a small cape, standing tall",
  },
  ISFP: {
    color: "soft blush pink",
    subject: "quiet artistic creature with shy soft eyes looking down slightly, holding a tiny paintbrush, a small paint splash nearby",
  },
  ESFP: {
    color: "warm peach",
    subject: "playful performer creature laughing widely with both eyes closed in joy, arms out mid-dance, confetti and stars around it",
  },
};

/** 组装最终 prompt */
export function buildPrompt(mbti) {
  const a = ART[mbti];
  if (!a) throw new Error("未知类型: " + mbti);
  return "A cute chibi mascot creature, main body color is " + a.color + ", " + a.subject + ", " + STYLE + ".";
}

/** 全部类型 */
export const MBTI_LIST = Object.keys(ART);
