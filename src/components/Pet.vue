<template>
  <div class="pet-container">
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

    <div
      class="pet-body"
      :class="{ petting: petting }"
      :style="{ backgroundColor: color }"
    >
      <div class="eyes">
        <!-- 被抚摸时眯起眼睛 -->
        <template v-if="petting">
          <span class="eye happy left">^</span>
          <span class="eye happy right">^</span>
        </template>
        <template v-else>
          <span class="eye left">●</span>
          <span class="eye right">●</span>
        </template>
      </div>
    </div>

    <div class="mbti-badge">{{ mbti }}</div>
    <div class="intimacy-label">♥ {{ intimacy }}</div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  color: string;
  mbti: string;
  intimacy: number;
  petting?: boolean;
}>();
</script>

<style scoped>
.pet-container {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  user-select: none;
  cursor: grab;
}
.pet-body {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: breathe 3s ease-in-out infinite;
  transition: background-color 0.5s;
  cursor: grab;
}
.pet-body.petting {
  animation: petHop 0.55s cubic-bezier(0.34, 1.56, 0.64, 1);
}
@keyframes breathe {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.06); }
}
@keyframes petHop {
  0%   { transform: scale(1) rotate(0deg); }
  30%  { transform: scale(1.14) rotate(-4deg); }
  55%  { transform: scale(0.95) rotate(4deg); }
  75%  { transform: scale(1.05) rotate(-1deg); }
  100% { transform: scale(1) rotate(0deg); }
}

.eyes {
  display: flex;
  gap: 12px;
}
.eye {
  color: white;
  font-size: 10px;
  line-height: 1;
}
.eye.happy {
  font-size: 14px;
  margin-top: -3px;
}

.hearts {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 60px;
  pointer-events: none;
  overflow: visible;
}
.heart {
  position: absolute;
  bottom: 6px;
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

.mbti-badge {
  font-size: 11px;
  font-weight: 600;
  color: #999;
  letter-spacing: 1px;
}
.intimacy-label {
  font-size: 10px;
  color: #e91e63;
}
</style>
