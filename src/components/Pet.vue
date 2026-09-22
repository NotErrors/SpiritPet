<template>
  <div class="pet-container" @click="$emit('click')" :style="{ cursor: 'pointer' }">
    <div class="pet-body" :style="{ backgroundColor: color }">
      <div class="eyes">
        <span class="eye left">●</span>
        <span class="eye right">●</span>
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
}>();

defineEmits<{ click: [] }>();
</script>

<style scoped>
.pet-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  user-select: none;
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
}
@keyframes breathe {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.06); }
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
