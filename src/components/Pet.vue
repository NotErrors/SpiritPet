<template>
  <div class="pet-container" ref="containerEl">
    <!-- 抚摸时飘出的爱心 -->
    <div class="hearts" v-if="petting">
      <span
        v-for="i in 6"
        :key="i"
        class="heart"
        :style="{
          left: 14 + i * 11 + '%',
          animationDelay: (i - 1) * 0.07 + 's',
          fontSize: 10 + (i % 3) * 5 + 'px',
        }"
      >♥</span>
    </div>

    <!-- 外层：持续浮动（始终运行），内层：一次性动作 -->
    <div class="pet-float">
      <!-- 优先用 AI 生成的插画 public/pets/{MBTI}.png；
           文件不存在时 img 触发 error，自动回退到下面代码绘制的 SVG -->
      <img
        v-if="artOk"
        class="pet-shape pet-img"
        :class="[actionClass, { petting: petting }]"
        :src="artSrc"
        :alt="mbti"
        draggable="false"
        @error="artOk = false"
      />
      <svg
        v-else
        viewBox="0 0 100 100"
        class="pet-shape pet-svg"
        :class="[actionClass, { petting: petting }]"
      >
        <defs>
          <radialGradient :id="gid('body')" cx="35%" cy="28%" r="78%">
            <stop offset="0%" :stop-color="lightColor" />
            <stop offset="60%" :stop-color="color" />
            <stop offset="100%" :stop-color="darkColor" />
          </radialGradient>
          <radialGradient :id="gid('blush')">
            <stop offset="0%" stop-color="#ff8fb1" stop-opacity="0.85" />
            <stop offset="100%" stop-color="#ff8fb1" stop-opacity="0" />
          </radialGradient>
          <filter :id="gid('glow')" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        <!-- 落地阴影（独立缩放，做出"跳起来影子变小"的错觉） -->
        <ellipse
          class="shadow"
          :class="{ airborne: action === 'hop' }"
          cx="50" cy="90" rx="26" ry="4.5"
          fill="#000" opacity="0.14"
        />

        <!-- 身体 -->
        <path
          d="M50 20 C 70 20, 84 36, 84 55 C 84 74, 69 88, 50 88 C 31 88, 16 74, 16 55 C 16 36, 30 20, 50 20 Z"
          :fill="'url(#' + gid('body') + ')'"
        />

        <!-- 头顶柔光 -->
        <ellipse cx="38" cy="33" rx="13" ry="8" fill="#fff" opacity="0.35" transform="rotate(-18 38 33)" />

        <!-- 眼睛 -->
        <g class="eyes">
          <template v-if="action === 'sleep'">
            <path d="M30 53 Q36 58 42 53" stroke="#2b2b2b" stroke-width="2.4" fill="none" stroke-linecap="round" />
            <path d="M58 53 Q64 58 70 53" stroke="#2b2b2b" stroke-width="2.4" fill="none" stroke-linecap="round" />
          </template>
          <template v-else-if="petting">
            <path d="M30 52 Q36 45 42 52" stroke="#2b2b2b" stroke-width="2.6" fill="none" stroke-linecap="round" />
            <path d="M58 52 Q64 45 70 52" stroke="#2b2b2b" stroke-width="2.6" fill="none" stroke-linecap="round" />
          </template>
          <template v-else>
            <ellipse cx="36" cy="52" rx="8.5" ry="10" fill="#fff" />
            <ellipse cx="64" cy="52" rx="8.5" ry="10" fill="#fff" />
            <circle :cx="36 + pupil.x" :cy="53 + pupil.y" r="5.6" fill="#2b2b2b" />
            <circle :cx="64 + pupil.x" :cy="53 + pupil.y" r="5.6" fill="#2b2b2b" />
            <circle :cx="33.6 + pupil.x" :cy="50 + pupil.y" r="2.1" fill="#fff" />
            <circle :cx="61.6 + pupil.x" :cy="50 + pupil.y" r="2.1" fill="#fff" />
          </template>
        </g>

        <!-- 腮红 -->
        <ellipse cx="24" cy="64" rx="7" ry="4.5" :fill="'url(#' + gid('blush') + ')'" />
        <ellipse cx="76" cy="64" rx="7" ry="4.5" :fill="'url(#' + gid('blush') + ')'" />

        <!-- 嘴 -->
        <path
          v-if="!petting"
          d="M45 66 Q50 70 55 66"
          stroke="#2b2b2b" stroke-width="1.8" fill="none" stroke-linecap="round" opacity="0.75"
        />
        <ellipse v-else cx="50" cy="67" rx="4.5" ry="3.2" fill="#2b2b2b" opacity="0.8" />

        <!-- 亲密度高时头顶闪光 -->
        <circle
          v-if="intimacy >= 60"
          cx="50" cy="24" r="3"
          fill="#ffe082"
          :filter="'url(#' + gid('glow') + ')'"
          class="spark"
        />
      </svg>

      <!-- 睡觉时飘出的 Z -->
      <div v-if="action === 'sleep'" class="zzz">
        <span style="animation-delay: 0s">z</span>
        <span style="animation-delay: 0.35s">z</span>
        <span style="animation-delay: 0.7s">Z</span>
      </div>
    </div>

    <div class="mbti-badge" :style="{ color: lightColor }">{{ mbti }}</div>
    <div class="intimacy-label">♥ {{ intimacy }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { listen } from "@tauri-apps/api/event";

const props = defineProps<{
  color: string;
  mbti: string;
  intimacy: number;
  petting?: boolean;
}>();

const containerEl = ref<HTMLElement | null>(null);

// 插画资源。@error 会在文件缺失时把 artOk 置 false，
// 于是自动用回代码绘制的 SVG —— 用户没跑生成脚本也能正常显示
const artOk = ref(true);
const artSrc = computed(() => "/pets/" + props.mbti + ".png");

/** 每个实例用唯一的 gradient id，避免同页面多个宠物互相覆盖 */
const uid = Math.random().toString(36).slice(2, 8);
const gid = (name: string) => "pet-" + uid + "-" + name;

// ==================== 颜色派生 ====================
function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map(c => c + c).join("") : h;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

function mix(hex: string, target: number, amount: number) {
  const { r, g, b } = hexToRgb(hex);
  const f = (c: number) => Math.round(c + (target - c) * amount);
  return "#" + [f(r), f(g), f(b)].map(v => v.toString(16).padStart(2, "0")).join("");
}

const lightColor = computed(() => mix(props.color, 255, 0.45));
const darkColor = computed(() => mix(props.color, 0, 0.28));

// ==================== 自主行为系统 ====================
// 宠物每隔几秒自己随机做个动作，不用用户操作也有"活着"的感觉
type Action = "hop" | "wiggle" | "jelly" | "look" | "sleep";

const action = ref<Action | "">("");
const actionClass = computed(() => (action.value ? "act-" + action.value : ""));

/** 各动作持续时间（毫秒），与 CSS keyframes 时长对应 */
const DURATION: Record<Action, number> = {
  hop: 800,
  wiggle: 950,
  jelly: 850,
  look: 1500,
  sleep: 3200,
};

// 瞳孔偏移：鼠标注视 + 自发张望，两者叠加后限幅
const mousePupil = ref({ x: 0, y: 0 });
const lookPupil = ref({ x: 0, y: 0 });
const MAX_PUPIL = 3.2;

const pupil = computed(() => {
  const x = mousePupil.value.x + lookPupil.value.x;
  const y = mousePupil.value.y + lookPupil.value.y;
  const m = Math.hypot(x, y);
  if (m <= MAX_PUPIL) return { x, y };
  return { x: (x / m) * MAX_PUPIL, y: (y / m) * MAX_PUPIL };
});

let idleTimer: number | null = null;
let actionTimer: number | null = null;
let lookTimer: number | null = null;

const ACTION_POOL: Action[] = ["hop", "wiggle", "jelly", "look", "look", "look", "sleep"];

function runAction(a: Action) {
  if (props.petting) return;
  action.value = a;

  if (a === "look") {
    // 随机看一个方向，然后收回
    const ang = Math.random() * Math.PI * 2;
    lookPupil.value = { x: Math.cos(ang) * 2.8, y: Math.sin(ang) * 2.2 };
    lookTimer = window.setTimeout(() => {
      lookPupil.value = { x: 0, y: 0 };
    }, 1150);
  }

  if (actionTimer !== null) clearTimeout(actionTimer);
  actionTimer = window.setTimeout(() => {
    action.value = "";
  }, DURATION[a]);
}

/** 排下一次自发动作，间隔 2~5.5 秒随机 */
function scheduleIdle() {
  idleTimer = window.setTimeout(() => {
    const a = ACTION_POOL[Math.floor(Math.random() * ACTION_POOL.length)];
    runAction(a);
    scheduleIdle();
  }, 2000 + Math.random() * 3500);
}

function clearTimers() {
  if (idleTimer !== null) clearTimeout(idleTimer);
  if (actionTimer !== null) clearTimeout(actionTimer);
  if (lookTimer !== null) clearTimeout(lookTimer);
}

// ==================== 瞳孔跟随鼠标 ====================
//
// 两个来源：
//   1) 窗口内的 mousemove（高频，光标在窗口里时最跟手）
//   2) Rust 推来的全局光标（pet://cursor）—— 关键的那一条
//
// 为什么必须有 2：mousemove 只在光标位于窗口内时才触发，
// 光标一旦移出窗口就彻底收不到事件，眼睛等于瞎了。
// 而桌宠的眼睛应该能跟着屏幕任何角落的光标转。
// 全局光标位置只有 Rust 侧拿得到（和点击穿透的命中测试共用同一份轮询）。

/** 瞳孔最大偏移。比原来的 2.3 略大，因为现在光标可能在很远处 */
const MAX_LOOK = 2.8;

/** 把客户区坐标（CSS 像素）换算成瞳孔偏移 */
function applyCursor(cx: number, cy: number) {
  const el = containerEl.value;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const dx = cx - (rect.left + rect.width / 2);
  const dy = cy - (rect.top + rect.height / 2);
  const dist = Math.hypot(dx, dy);
  if (dist < 1) {
    mousePupil.value = { x: 0, y: 0 };
    return;
  }
  // 方向取单位向量，幅度随距离增大但封顶 ——
  // 这样光标跑到屏幕另一头时，它依然是在「看向」那边，而不是回到正中
  const mag = Math.min(1, dist / 110) * MAX_LOOK;
  mousePupil.value = { x: (dx / dist) * mag, y: (dy / dist) * mag };
}

function onMouseMove(e: MouseEvent) {
  applyCursor(e.clientX, e.clientY);
}

let unlistenCursor: (() => void) | null = null;

const isTauri = () =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

onMounted(() => {
  window.addEventListener("mousemove", onMouseMove);

  // Rust 推来的全局光标，让眼睛能跟到窗口外的任何位置
  if (isTauri()) {
    listen<{ x: number; y: number }>("pet://cursor", (e) => {
      applyCursor(e.payload.x, e.payload.y);
    })
      .then((un) => {
        unlistenCursor = un;
      })
      .catch(() => {
        /* 订阅失败就退回只用 mousemove，不至于整个组件崩掉 */
      });
  }

  // 首次动作早点来，让用户马上看到它动了
  idleTimer = window.setTimeout(() => {
    runAction("hop");
    scheduleIdle();
  }, 900);
});

onUnmounted(() => {
  window.removeEventListener("mousemove", onMouseMove);
  if (unlistenCursor) unlistenCursor();
  clearTimers();
});
</script>

<style scoped>
.pet-container {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  user-select: none;
  cursor: grab;
}
.pet-container:active { cursor: grabbing; }

/* 外层：持续浮动，始终在跑 */
.pet-float {
  position: relative;
  animation: bob 2.8s ease-in-out infinite;
  transform-origin: 50% 85%;
}

/* 插画版与 SVG 版共用的动画基类 */
.pet-shape {
  display: block;
  transform-origin: 50% 85%;
  cursor: grab;
  user-select: none;
}
.pet-svg {
  width: 76px;
  height: 76px;
  overflow: visible;
}
.pet-img {
  width: 92px;
  height: 92px;
  object-fit: contain;
  -webkit-user-drag: none;
  filter: drop-shadow(0 3px 7px rgba(0, 0, 0, 0.35));
}

/* ---------- 常驻浮动 ---------- */
@keyframes bob {
  0%, 100% { transform: translateY(0) scale(1); }
  50%      { transform: translateY(-4px) scale(1.04); }
}

/* ---------- 自发动作（一次性的） ---------- */
.pet-shape.act-hop    { animation: actHop 0.8s cubic-bezier(0.28, 1.4, 0.5, 1); }
.pet-shape.act-wiggle { animation: actWiggle 0.95s ease-in-out; }
.pet-shape.act-jelly  { animation: actJelly 0.85s ease-in-out; }
.pet-shape.act-sleep  { animation: actSleep 3.2s ease-in-out; }

@keyframes actHop {
  0%   { transform: translateY(0) scale(1, 1); }
  15%  { transform: translateY(0) scale(1.12, 0.88); }
  40%  { transform: translateY(-18px) scale(0.94, 1.1); }
  62%  { transform: translateY(0) scale(1.14, 0.86); }
  78%  { transform: translateY(-4px) scale(0.99, 1.02); }
  100% { transform: translateY(0) scale(1, 1); }
}

@keyframes actWiggle {
  0%, 100% { transform: rotate(0deg); }
  14%      { transform: rotate(-8deg); }
  30%      { transform: rotate(8deg); }
  46%      { transform: rotate(-6deg); }
  62%      { transform: rotate(5deg); }
  78%      { transform: rotate(-2deg); }
}

/* 果冻：压扁再弹回来 */
@keyframes actJelly {
  0%, 100% { transform: scale(1, 1); }
  22%      { transform: scale(1.18, 0.82); }
  45%      { transform: scale(0.88, 1.14); }
  68%      { transform: scale(1.08, 0.94); }
  85%      { transform: scale(0.97, 1.03); }
}

/* 打瞌睡：慢慢趴下 */
@keyframes actSleep {
  0%       { transform: translateY(0) scale(1, 1); }
  15%, 80% { transform: translateY(3px) scale(1.08, 0.93); }
  100%     { transform: translateY(0) scale(1, 1); }
}

/* ---------- 被抚摸：优先级最高（放最后覆盖同优先级动作） ---------- */
.pet-shape.petting { animation: petHop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1); }

@keyframes petHop {
  0%   { transform: translateY(0) scale(1) rotate(0deg); }
  25%  { transform: translateY(-11px) scale(1.1) rotate(-4deg); }
  55%  { transform: translateY(1px) scale(0.95) rotate(3deg); }
  78%  { transform: translateY(-3px) scale(1.03) rotate(-1deg); }
  100% { transform: translateY(0) scale(1) rotate(0deg); }
}

/* ---------- 影子：跳起来时缩小变淡 ---------- */
.shadow {
  transition: transform 0.25s ease, opacity 0.25s ease;
  transform-origin: 50% 90%;
}
.shadow.airborne {
  transform: scale(0.72);
  opacity: 0.07;
}

/* ---------- 眨眼 ---------- */
.eyes {
  transform-box: fill-box;
  transform-origin: center;
  animation: blink 3.6s infinite;
}
@keyframes blink {
  0%, 88%, 100% { transform: scaleY(1); }
  92%           { transform: scaleY(0.06); }
  96%           { transform: scaleY(1); }
}

/* ---------- 头顶闪光 ---------- */
.spark { animation: sparkle 2.2s ease-in-out infinite; }
@keyframes sparkle {
  0%, 100% { opacity: 0.35; transform: scale(0.85); }
  50%      { opacity: 1;    transform: scale(1.15); }
}

/* ---------- 睡觉的 Z ---------- */
.zzz {
  position: absolute;
  right: 0;
  top: 0;
  pointer-events: none;
}
.zzz span {
  position: absolute;
  right: 0;
  color: #cfd8dc;
  font-weight: 700;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
  animation: floatZ 2.4s ease-out infinite;
  opacity: 0;
}
.zzz span:nth-child(1) { font-size: 9px; }
.zzz span:nth-child(2) { font-size: 12px; }
.zzz span:nth-child(3) { font-size: 15px; }
@keyframes floatZ {
  0%   { opacity: 0; transform: translate(0, 0) scale(0.7); }
  25%  { opacity: 0.9; }
  100% { opacity: 0; transform: translate(14px, -30px) scale(1.15); }
}

/* ---------- 爱心 ---------- */
.hearts {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 76px;
  pointer-events: none;
  overflow: visible;
}
.heart {
  position: absolute;
  bottom: 8px;
  color: #ff6b9d;
  text-shadow: 0 0 6px rgba(255, 107, 157, 0.7);
  animation: floatUp 1s ease-out forwards;
  opacity: 0;
}
@keyframes floatUp {
  0%   { opacity: 0; transform: translateY(0) scale(0.5); }
  25%  { opacity: 1; transform: translateY(-14px) scale(1.15); }
  100% { opacity: 0; transform: translateY(-56px) scale(0.85); }
}

.mbti-badge {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1.5px;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
}
.intimacy-label {
  font-size: 10px;
  color: #e91e63;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
}
</style>
