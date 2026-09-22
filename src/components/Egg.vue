<template>
  <div class="egg-container" @click="$emit('click')" :style="{ cursor: 'pointer' }">
    <svg viewBox="0 0 100 120" class="egg-svg" :class="{ shaking: isShaking }">
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
}>();

defineEmits<{ click: [] }>();

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

const isShaking = computed(() => props.intimacy >= 25);
</script>

<style scoped>
.egg-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  user-select: none;
}
.egg-svg {
  width: 80px;
  height: 96px;
  transition: filter 0.5s;
}
.egg-svg.shaking {
  animation: shake 0.5s ease-in-out infinite;
}
@keyframes shake {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(-2deg); }
  75% { transform: rotate(2deg); }
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
