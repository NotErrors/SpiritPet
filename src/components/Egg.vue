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

    <svg
      viewBox="0 0 100 120"
      class="egg-svg"
      :class="{ shaking: isShaking, petting: petting }"
    >
      <defs>
        <radialGradient id="eggGrad" cx="40%" cy="35%" r="55%">
          <stop offset="0%" :stop-color="lightColor" />
          <stop offset="100%" :stop-color="eggColor" />
        </radialGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <ellipse cx="50" cy="62" rx="28" ry="38" fill="url(#eggGrad)" stroke="#999" stroke-width="0.5" />
      <!-- 裂纹：亲密度越高裂纹越多 -->
      <path v-if="intimacy >= 10" d="M35 50 Q42 55 40 65" stroke="#666" stroke-width="0.8" fill="none" opacity="0.5" />
      <path v-if="intimacy >= 20" d="M55 45 Q60 55 58 70" stroke="#666" stroke-width="0.8" fill="none" opacity="0.6" />
      <circle cx="50" cy="50" r="15" fill="white" opacity="0.08" :filter="intimacy > 15 ? 'url(#glow)' : undefined" />
    </svg>

    <div class="intimacy-bar">
      <div class="intimacy-fill" :style="{ width: percent + '%' }"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  intimacy: number;
  petting?: boolean;
}>();

const percent = computed(() => Math.min(100, (props.intimacy / 30) * 100));

const eggColor = computed(() => {
  if (props.intimacy < 10) return "#888";
  if (props.intimacy < 20) return "#aa8";
  return "#eea";
});

const lightColor = computed(() => {
  if (props.intimacy < 10) return "#aaa";
  if (props.intimacy < 20) return "#ccb";
  return "#ffe";
});

const isShaking = computed(() => props.intimacy >= 25 && !props.petting);
</script>

<style scoped>
.egg-container {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  user-select: none;
  cursor: pointer;
}
.egg-svg {
  width: 80px;
  height: 96px;
  transition: filter 0.5s;
  cursor: pointer;
}
.egg-svg.shaking {
  animation: shake 0.5s ease-in-out infinite;
}
.egg-svg.petting {
  animation: petHop 0.55s cubic-bezier(0.34, 1.56, 0.64, 1);
}
@keyframes shake {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(-2deg); }
  75% { transform: rotate(2deg); }
}
@keyframes petHop {
  0%   { transform: scale(1) rotate(0deg); }
  30%  { transform: scale(1.12) rotate(-3deg); }
  55%  { transform: scale(0.96) rotate(3deg); }
  75%  { transform: scale(1.04) rotate(-1deg); }
  100% { transform: scale(1) rotate(0deg); }
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
</style>
