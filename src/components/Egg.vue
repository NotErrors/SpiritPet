<template>
  <div class="egg-container">
    <!-- 抚摸时飘出的爱心 -->
    <div class="hearts" v-if="petting">
      <span
        v-for="i in 6"
        :key="i"
        class="heart"
        :style="{
          left: 12 + i * 12 + '%',
          animationDelay: (i - 1) * 0.07 + 's',
          fontSize: 10 + (i % 3) * 5 + 'px',
        }"
      >♥</span>
    </div>

    <div class="egg-stage">
      <!-- 内部的微光：亲密度越高越亮 -->
      <div class="aura" :style="{
        opacity: auraOpacity,
        transform: 'scale(' + auraScale + ')',
      }"></div>

      <svg
        viewBox="0 0 100 120"
        class="egg-svg"
        :class="{ shaking: isShaking, petting: petting }"
        :style="isShaking ? { animationDuration: shakeSpeed } : {}"
      >
        <defs>
          <radialGradient id="eggGrad" cx="38%" cy="28%" r="78%">
            <stop offset="0%" :stop-color="lightColor" />
            <stop offset="62%" :stop-color="eggColor" />
            <stop offset="100%" :stop-color="shadowColor" />
          </radialGradient>
          <filter id="eggGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.2" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        <!-- 蛋身 -->
        <path
          d="M50 8 C 74 8, 90 40, 90 66 C 90 95, 72 112, 50 112 C 28 112, 10 95, 10 66 C 10 40, 26 8, 50 8 Z"
          fill="url(#eggGrad)"
        />

        <!-- 斑点 -->
        <circle cx="34" cy="44" r="3" fill="#000" opacity="0.08" />
        <circle cx="64" cy="36" r="2.4" fill="#000" opacity="0.07" />
        <circle cx="58" cy="92" r="3.4" fill="#000" opacity="0.06" />
        <circle cx="30" cy="84" r="2.2" fill="#000" opacity="0.07" />

        <!-- 顶部高光 -->
        <ellipse cx="38" cy="30" rx="12" ry="7" fill="#fff" opacity="0.42" transform="rotate(-18 38 30)" />

        <!-- 裂纹：每 +5 亲密度多一道（设计文档 §3.2） -->
        <g
          class="cracks"
          stroke="#7a6a4a" stroke-width="1.6" fill="none"
          stroke-linecap="round" stroke-linejoin="round"
          :opacity="crackOpacity"
        >
          <path v-if="crackCount >= 1" d="M24 58 L34 65 L30 76" />
          <path v-if="crackCount >= 2" d="M76 54 L66 63 L70 74" />
          <path v-if="crackCount >= 3" d="M50 12 L46 30 L56 40" />
          <path v-if="crackCount >= 4" d="M32 86 L42 90 L38 100" />
          <path v-if="crackCount >= 5" d="M68 84 L58 92 L66 101" />
          <path v-if="crackCount >= 6" d="M50 44 L43 58 L54 68 L47 82" />
        </g>

        <!-- 裂缝里透出的光：裂纹越多光越强 -->
        <g
          v-if="crackCount >= 3"
          class="crack-light"
          stroke="#ffe9a8" stroke-width="0.9" fill="none"
          stroke-linecap="round" stroke-linejoin="round"
          :style="{ opacity: crackLight }"
        >
          <path v-if="crackCount >= 3" d="M50 12 L46 30 L56 40" />
          <path v-if="crackCount >= 4" d="M32 86 L42 90 L38 100" />
          <path v-if="crackCount >= 5" d="M68 84 L58 92 L66 101" />
          <path v-if="crackCount >= 6" d="M50 44 L43 58 L54 68 L47 82" />
        </g>

        <!-- 高亲密度时整蛋外发光 -->
        <path
          v-if="intimacy >= 20"
          d="M50 8 C 74 8, 90 40, 90 66 C 90 95, 72 112, 50 112 C 28 112, 10 95, 10 66 C 10 40, 26 8, 50 8 Z"
          fill="none" stroke="#ffe082" stroke-width="1.4"
          :filter="'url(#eggGlow)'"
          :style="{ opacity: glowOpacity }"
        />
      </svg>
    </div>

    <div class="intimacy-bar">
      <div class="intimacy-fill" :style="{ width: percent + '%' }"></div>
    </div>
    <div class="intimacy-text">{{ intimacy }} / 30</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  intimacy: number;
  petting?: boolean;
}>();

/** 破壳所需的亲密度（与 petStore.tryHatch 保持一致） */
const HATCH_AT = 30;

const percent = computed(() => Math.min(100, (props.intimacy / HATCH_AT) * 100));

/**
 * 裂纹数：每 +5 亲密度多一道，共 6 道。
 * 这是"养成有反馈"的关键——用户能看见自己的每一分付出。
 */
const crackCount = computed(() => Math.min(6, Math.floor(props.intimacy / 5)));

/** 裂纹的不透明度：刚开始很淡，后来越来越明显 */
const crackOpacity = computed(() => 0.35 + Math.min(0.5, (props.intimacy / HATCH_AT) * 0.5));

/** 裂缝透光强度 */
const crackLight = computed(() => Math.min(0.85, Math.max(0, (props.intimacy - 12) / 24)));

// ---------- 颜色随亲密度变暖：从灰扑扑到暖黄 ----------
function lerp(a: number, b: number, t: number) {
  return Math.round(a + (b - a) * t);
}
function mixHex(from: string, to: string, t: number) {
  const f = from.replace("#", ""), o = to.replace("#", "");
  const fr = parseInt(f.slice(0, 2), 16), fg = parseInt(f.slice(2, 4), 16), fb = parseInt(f.slice(4, 6), 16);
  const tr = parseInt(o.slice(0, 2), 16), tg = parseInt(o.slice(2, 4), 16), tb = parseInt(o.slice(4, 6), 16);
  return "#" + [lerp(fr, tr, t), lerp(fg, tg, t), lerp(fb, tb, t)]
    .map(v => v.toString(16).padStart(2, "0")).join("");
}

const t = computed(() => Math.min(1, props.intimacy / HATCH_AT));

/** 蛋壳主色：灰 → 暖黄 */
const eggColor = computed(() => mixHex("#9e9e9e", "#f2dea6", t.value));
/** 高光色 */
const lightColor = computed(() => mixHex("#c8c8c8", "#fffdf0", t.value));
/** 暗部色 */
const shadowColor = computed(() => mixHex("#6d6d6d", "#c9b47f", t.value));

// ---------- 蛋内微光 ----------
const auraOpacity = computed(() => 0.08 + t.value * 0.5);
const auraScale = computed(() => 0.75 + t.value * 0.45);
const glowOpacity = computed(() => Math.max(0, (props.intimacy - 18) / 22) * 0.75);

// ---------- 晃动 ----------
// 越接近破壳晃得越急，直接反映"里面要出来了"的活跃度
const isShaking = computed(() => props.intimacy >= 20 && !props.petting);
const shakeSpeed = computed(() => {
  const s = Math.max(0.22, 0.62 - t.value * 0.35);
  return s.toFixed(2) + "s";
});
</script>

<style scoped>
.egg-container {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  user-select: none;
  cursor: grab;
}
.egg-container:active { cursor: grabbing; }

.egg-stage {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 蛋内部的微光，从壳里透出来 */
.aura {
  position: absolute;
  width: 76px;
  height: 96px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 236, 170, 0.95), rgba(255, 220, 130, 0) 70%);
  filter: blur(9px);
  transition: opacity 0.6s ease, transform 0.6s ease;
  pointer-events: none;
}

.egg-svg {
  position: relative;
  width: 80px;
  height: 96px;
  cursor: grab;
  filter: drop-shadow(0 3px 6px rgba(0, 0, 0, 0.3));
}
.egg-svg.shaking {
  animation: shake 0.5s ease-in-out infinite;
}
.egg-svg.petting {
  animation: petHop 0.55s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes shake {
  0%, 100% { transform: translate(0, 0) rotate(0deg); }
  20%      { transform: translate(-2px, 1px) rotate(-2.5deg); }
  45%      { transform: translate(2px, -1px) rotate(2.5deg); }
  70%      { transform: translate(-1px, 1px) rotate(-1.5deg); }
}
@keyframes petHop {
  0%   { transform: scale(1) rotate(0deg); }
  30%  { transform: scale(1.12) rotate(-3deg); }
  55%  { transform: scale(0.96) rotate(3deg); }
  75%  { transform: scale(1.04) rotate(-1deg); }
  100% { transform: scale(1) rotate(0deg); }
}

/* 新裂纹出现时有个"裂开"的动效 */
.cracks path {
  animation: crackIn 0.4s ease-out;
}
@keyframes crackIn {
  0%   { stroke-dasharray: 0 100; opacity: 0; }
  100% { stroke-dasharray: 100 0; opacity: 1; }
}

.crack-light path {
  animation: lightPulse 2.4s ease-in-out infinite;
}
@keyframes lightPulse {
  0%, 100% { opacity: 0.45; }
  50%      { opacity: 1; }
}

.hearts {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 96px;
  pointer-events: none;
  overflow: visible;
}
.heart {
  position: absolute;
  bottom: 10px;
  color: #ff6b9d;
  text-shadow: 0 0 6px rgba(255, 107, 157, 0.7);
  animation: floatUp 1s ease-out forwards;
  opacity: 0;
}
@keyframes floatUp {
  0%   { opacity: 0; transform: translateY(0) scale(0.5); }
  25%  { opacity: 1; transform: translateY(-14px) scale(1.15); }
  100% { opacity: 0; transform: translateY(-52px) scale(0.85); }
}

.intimacy-bar {
  width: 60px;
  height: 4px;
  background: #333;
  border-radius: 2px;
  overflow: hidden;
}
.intimacy-fill {
  height: 100%;
  background: linear-gradient(90deg, #f57c00, #ffb74d);
  border-radius: 2px;
  transition: width 0.5s ease;
}
.intimacy-text {
  font-size: 9px;
  color: rgba(255, 255, 255, 0.35);
  letter-spacing: 0.5px;
}
</style>
