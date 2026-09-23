<template>
  <div class="ceremony" :class="'phase-' + phase">
    <!-- 爆裂白光 -->
    <div v-if="phase === 'burst'" class="flash"></div>

    <!-- 诞生光晕 -->
    <div class="halo" :class="{ on: phase === 'reveal' }"></div>

    <div class="stage">
      <!-- ========== 阶段一：蛋 + 逐渐裂开 ========== -->
      <div v-if="phase === 'crack'" class="egg-wrap">
        <svg viewBox="0 0 100 120" class="egg-svg">
          <defs>
            <radialGradient id="cerEgg" cx="38%" cy="30%" r="75%">
              <stop offset="0%" stop-color="#fffdf7" />
              <stop offset="55%" stop-color="#f5ead2" />
              <stop offset="100%" stop-color="#d9c8a4" />
            </radialGradient>
          </defs>

          <!-- 蛋身 -->
          <path
            d="M50 8 C 74 8, 90 40, 90 66 C 90 95, 72 112, 50 112 C 28 112, 10 95, 10 66 C 10 40, 26 8, 50 8 Z"
            fill="url(#cerEgg)"
          />
          <!-- 斑点 -->
          <circle cx="34" cy="46" r="3.2" fill="#c9b48c" opacity="0.55" />
          <circle cx="64" cy="38" r="2.4" fill="#c9b48c" opacity="0.5" />
          <circle cx="58" cy="90" r="3.6" fill="#c9b48c" opacity="0.45" />
          <circle cx="30" cy="82" r="2.2" fill="#c9b48c" opacity="0.5" />

          <!-- 裂纹：逐条出现 -->
          <g
            class="cracks"
            stroke="#7a6a4a" stroke-width="2.2" fill="none"
            stroke-linecap="round" stroke-linejoin="round"
          >
            <path v-if="crackCount >= 1" d="M24 60 L36 66 L32 76 L44 82" />
            <path v-if="crackCount >= 2" d="M76 56 L64 64 L70 74 L58 82" />
            <path v-if="crackCount >= 3" d="M50 10 L45 32 L56 44 L47 60 L58 74" />
          </g>
        </svg>

        <!-- 摇晃时散出的光点 -->
        <span v-for="i in 4" :key="i" class="spark-dot" :style="{ animationDelay: i * 0.28 + 's' }"></span>
      </div>

      <!-- ========== 阶段二：蛋壳碎片飞散 ========== -->
      <div v-else-if="phase === 'burst'" class="shell">
        <span
          v-for="(p, i) in pieces"
          :key="i"
          class="piece"
          :style="{
            '--dx': p.dx + 'px',
            '--dy': p.dy + 'px',
            '--rot': p.rot + 'deg',
            width: p.size + 'px',
            height: p.size + 'px',
            animationDelay: p.delay + 's',
          }"
        ></span>
      </div>

      <!-- ========== 阶段三：宠物诞生 ========== -->
      <div v-else-if="phase === 'reveal'" class="pet-pop">
        <Pet :color="color" :mbti="mbti || '???'" :intimacy="30" />
      </div>
    </div>

    <!-- ========== 文案 ========== -->
    <div v-if="phase === 'crack'" class="caption">
      <div class="cap-hint">蛋在动…</div>
    </div>

    <div v-else-if="phase === 'reveal'" class="caption fade-in">
      <div class="cap-title" :style="{ color: color }">
        「{{ persona.title }}」<span class="cap-mbti">{{ mbti }}</span>
      </div>
      <div class="cap-line">{{ persona.sample }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import Pet from "./Pet.vue";
import { getPersonality } from "../data/personalities";

const props = defineProps<{
  mbti: string | null;
  color: string;
}>();

const emit = defineEmits<{ burst: []; done: [] }>();

const persona = computed(() => getPersonality(props.mbti));

type Phase = "crack" | "burst" | "reveal";
const phase = ref<Phase>("crack");
const crackCount = ref(0);

/** 蛋壳碎片：随机方向、距离、旋转，做出炸开的效果 */
const pieces = Array.from({ length: 14 }, (_, i) => {
  const angle = (i / 14) * Math.PI * 2 + Math.random() * 0.5;
  const dist = 55 + Math.random() * 55;
  return {
    dx: Math.cos(angle) * dist,
    dy: Math.sin(angle) * dist - 12, // 稍微向上偏，更自然
    rot: (Math.random() - 0.5) * 900,
    size: 5 + Math.random() * 8,
    delay: Math.random() * 0.12,
  };
});

const timers: number[] = [];

function at(ms: number, fn: () => void) {
  timers.push(window.setTimeout(fn, ms));
}

onMounted(() => {
  // 裂纹一条一条裂开，制造"要出来了"的紧张感
  at(350,  () => { crackCount.value = 1; });
  at(900,  () => { crackCount.value = 2; });
  at(1450, () => { crackCount.value = 3; });

  // 爆裂：此刻才真正提交破壳状态（父组件监听 burst）
  at(1950, () => {
    phase.value = "burst";
    emit("burst");
  });

  // 宠物登场
  at(2750, () => { phase.value = "reveal"; });

  // 落下帷幕
  at(6200, () => { emit("done"); });
});

onUnmounted(() => timers.forEach(clearTimeout));
</script>

<style scoped>
.ceremony {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: radial-gradient(circle at 50% 45%, rgba(40, 35, 60, 0.92), rgba(12, 10, 20, 0.97));
  z-index: 200;
  overflow: hidden;
}

/* ---------- 白光 ---------- */
.flash {
  position: absolute;
  left: 50%;
  top: 45%;
  width: 40px;
  height: 40px;
  margin: -20px 0 0 -20px;
  border-radius: 50%;
  background: radial-gradient(circle, #fff 0%, #ffe9b0 45%, rgba(255, 220, 150, 0) 70%);
  animation: flashBurst 0.85s ease-out forwards;
  pointer-events: none;
}
@keyframes flashBurst {
  0%   { transform: scale(0);   opacity: 1; }
  35%  { transform: scale(9);   opacity: 0.95; }
  100% { transform: scale(22);  opacity: 0; }
}

/* ---------- 光晕 ---------- */
.halo {
  position: absolute;
  left: 50%;
  top: 45%;
  width: 150px;
  height: 150px;
  margin: -75px 0 0 -75px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 236, 179, 0.55), rgba(255, 236, 179, 0) 70%);
  opacity: 0;
  transform: scale(0.4);
  transition: opacity 0.7s ease, transform 0.7s ease;
  pointer-events: none;
}
.halo.on { opacity: 1; transform: scale(1); animation: haloPulse 2.4s ease-in-out infinite; }
@keyframes haloPulse {
  0%, 100% { transform: scale(1); }
  50%      { transform: scale(1.12); }
}

.stage {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 120px;
}

/* ---------- 蛋 ---------- */
.egg-wrap {
  position: relative;
  animation: violentShake 0.14s linear infinite;
}
.egg-svg {
  width: 92px;
  height: 110px;
  display: block;
  filter: drop-shadow(0 0 14px rgba(255, 230, 170, 0.5));
}
@keyframes violentShake {
  0%, 100% { transform: translate(0, 0) rotate(0deg); }
  20%      { transform: translate(-3px, 1px) rotate(-2.5deg); }
  40%      { transform: translate(3px, -1px) rotate(2.5deg); }
  60%      { transform: translate(-2px, 2px) rotate(-1.5deg); }
  80%      { transform: translate(2px, -2px) rotate(1.5deg); }
}

/* 裂纹出现时的抖动 */
.cracks path {
  animation: crackIn 0.18s ease-out;
  filter: drop-shadow(0 0 4px rgba(255, 240, 190, 0.9));
}
@keyframes crackIn {
  0%   { opacity: 0; stroke-width: 0.5; }
  100% { opacity: 1; stroke-width: 2.2; }
}

.spark-dot {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 4px;
  height: 4px;
  margin: -2px 0 0 -2px;
  border-radius: 50%;
  background: #ffe082;
  box-shadow: 0 0 8px #ffe082;
  animation: dotOut 1.6s ease-out infinite;
  pointer-events: none;
}
@keyframes dotOut {
  0%   { opacity: 0; transform: translate(0, 0) scale(0.5); }
  30%  { opacity: 1; }
  100% { opacity: 0; transform: translate(38px, -34px) scale(0.4); }
}

/* ---------- 碎片 ---------- */
.shell {
  position: relative;
  width: 0;
  height: 0;
}
.piece {
  position: absolute;
  left: 0;
  top: 0;
  background: linear-gradient(135deg, #fffdf7, #d9c8a4);
  clip-path: polygon(50% 0%, 100% 60%, 55% 100%, 0% 70%);
  animation: flyOut 1.1s cubic-bezier(0.2, 0.7, 0.4, 1) forwards;
}
@keyframes flyOut {
  0%   { transform: translate(0, 0) rotate(0deg) scale(1); opacity: 1; }
  100% { transform: translate(var(--dx), var(--dy)) rotate(var(--rot)) scale(0.5); opacity: 0; }
}

/* ---------- 宠物登场 ---------- */
.pet-pop {
  animation: birthPop 0.75s cubic-bezier(0.34, 1.56, 0.64, 1);
}
@keyframes birthPop {
  0%   { transform: scale(0) rotate(-25deg); opacity: 0; }
  55%  { transform: scale(1.22) rotate(8deg); opacity: 1; }
  75%  { transform: scale(0.94) rotate(-3deg); }
  100% { transform: scale(1) rotate(0deg); }
}

/* ---------- 文案 ---------- */
.caption {
  position: relative;
  z-index: 2;
  padding: 0 14px;
  text-align: center;
}
.fade-in { animation: capIn 0.6s ease-out 0.35s both; }
@keyframes capIn {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}

.cap-hint {
  font-size: 11px;
  color: #9a94b8;
  letter-spacing: 2px;
}

.cap-title {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 1px;
  text-shadow: 0 0 14px currentColor;
}
.cap-mbti {
  font-size: 11px;
  opacity: 0.75;
  letter-spacing: 2px;
  margin-left: 2px;
}

.cap-line {
  margin-top: 8px;
  font-size: 11.5px;
  line-height: 1.6;
  color: #ded9ee;
  background: rgba(255, 255, 255, 0.07);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  padding: 8px 10px;
  max-width: 216px;
  margin-left: auto;
  margin-right: auto;
}
</style>
