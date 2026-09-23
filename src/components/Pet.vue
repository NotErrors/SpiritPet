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

    <svg viewBox="0 0 100 100" class="pet-svg" :class="{ petting: petting }">
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

      <!-- 落地阴影 -->
      <ellipse cx="50" cy="90" rx="26" ry="4.5" fill="#000" opacity="0.13" />

      <!-- 身体 -->
      <path
        d="M50 20 C 70 20, 84 36, 84 55 C 84 74, 69 88, 50 88 C 31 88, 16 74, 16 55 C 16 36, 30 20, 50 20 Z"
        :fill="'url(#' + gid('body') + ')'"
      />

      <!-- 头顶柔光 -->
      <ellipse cx="38" cy="33" rx="13" ry="8" fill="#fff" opacity="0.35" transform="rotate(-18 38 33)" />

      <!-- 眼睛 -->
      <g class="eyes">
        <template v-if="petting">
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

    <div class="mbti-badge" :style="{ color: lightColor }">{{ mbti }}</div>
    <div class="intimacy-label">♥ {{ intimacy }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";

const props = defineProps<{
  color: string;
  mbti: string;
  intimacy: number;
  petting?: boolean;
}>();

const containerEl = ref<HTMLElement | null>(null);

/** 每个实例用唯一的 gradient id，避免同页面多个宠物互相覆盖 */
const uid = Math.random().toString(36).slice(2, 8);
const gid = (name: string) => "pet-" + uid + "-" + name;

// ---------- 颜色派生 ----------
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

/** 顶部高光色（往白调） */
const lightColor = computed(() => mix(props.color, 255, 0.45));
/** 底部暗部色（往黑调） */
const darkColor = computed(() => mix(props.color, 0, 0.28));

// ---------- 瞳孔跟随鼠标 ----------
const pupil = ref({ x: 0, y: 0 });
const MAX_OFFSET = 2.6;

function onMouseMove(e: MouseEvent) {
  const el = containerEl.value;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const dx = e.clientX - cx;
  const dy = e.clientY - cy;
  const dist = Math.hypot(dx, dy);
  if (dist < 1) {
    pupil.value = { x: 0, y: 0 };
    return;
  }
  const scale = (Math.min(1, dist / 110) * MAX_OFFSET) / dist;
  pupil.value = { x: dx * scale, y: dy * scale };
}

onMounted(() => window.addEventListener("mousemove", onMouseMove));
onUnmounted(() => window.removeEventListener("mousemove", onMouseMove));
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

.pet-svg {
  width: 76px;
  height: 76px;
  overflow: visible;
  animation: bob 3.2s ease-in-out infinite;
  transform-origin: 50% 85%;
  cursor: grab;
}
.pet-svg.petting {
  animation: petHop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes bob {
  0%, 100% { transform: translateY(0) scale(1); }
  50%      { transform: translateY(-2.5px) scale(1.035); }
}
@keyframes petHop {
  0%   { transform: translateY(0) scale(1) rotate(0deg); }
  25%  { transform: translateY(-9px) scale(1.09) rotate(-4deg); }
  55%  { transform: translateY(1px) scale(0.96) rotate(3deg); }
  78%  { transform: translateY(-3px) scale(1.03) rotate(-1deg); }
  100% { transform: translateY(0) scale(1) rotate(0deg); }
}

.eyes {
  transform-box: fill-box;
  transform-origin: center;
  animation: blink 4.6s infinite;
}
@keyframes blink {
  0%, 92%, 100% { transform: scaleY(1); }
  95%           { transform: scaleY(0.08); }
}

.spark {
  animation: sparkle 2.2s ease-in-out infinite;
}
@keyframes sparkle {
  0%, 100% { opacity: 0.35; transform: scale(0.85); }
  50%      { opacity: 1;    transform: scale(1.15); }
}

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
