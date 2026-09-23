<template>
  <div class="chat-panel" @click.stop>
    <div class="chat-header">
      <span>💬 {{ stage === 'egg' ? '蛋' : mbti }}</span>
      <button class="close-btn" @click="$emit('close')">✕</button>
    </div>
    <div class="chat-messages" ref="msgList">
      <div v-for="(msg, i) in messages" :key="i" :class="['msg', msg.role]">
        <div class="bubble">{{ msg.content }}</div>
      </div>
      <div v-if="loading" class="msg assistant">
        <div class="bubble thinking">...</div>
      </div>
    </div>
    <div class="chat-input">
      <input
        ref="inputEl"
        v-model="input"
        @keydown.enter="send"
        placeholder="说点什么..."
      />
      <button @click="send" :disabled="loading || !input.trim()">发送</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch, onMounted } from "vue";
import { pet, chat } from "../stores/petStore";

defineProps<{
  stage: string;
  mbti: string;
  messages: { role: string; content: string }[];
}>();

defineEmits<{ close: [] }>();

const input = ref("");
const loading = ref(false);
const msgList = ref<HTMLElement | null>(null);
const inputEl = ref<HTMLInputElement | null>(null);

/** 把焦点交回输入框，保证能连续输入 */
async function focusInput() {
  await nextTick();
  inputEl.value?.focus();
}

async function send() {
  const text = input.value.trim();
  if (!text || loading.value) return;
  input.value = "";
  loading.value = true;
  // 注意：输入框不设 disabled（禁用会让浏览器自动夺走焦点，且重新启用不会还原）
  // 等待期间用户可以继续打字，send 函数本身已做 loading 拦截
  await chat(text);
  loading.value = false;
  focusInput();
}

watch(() => pet.messages.length, async () => {
  await nextTick();
  if (msgList.value) msgList.value.scrollTop = msgList.value.scrollHeight;
});

// 打开聊天面板时自动聚焦，可直接打字
onMounted(focusInput);
</script>

<style scoped>
.chat-panel {
  width: 260px;
  height: 280px;
  background: rgba(30, 30, 30, 0.95);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0,0,0,0.4);
  backdrop-filter: blur(10px);
}
.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  color: #ccc;
  font-size: 13px;
  border-bottom: 1px solid #333;
}
.close-btn {
  background: none;
  border: none;
  color: #666;
  cursor: pointer;
  font-size: 14px;
}
.close-btn:hover { color: #fff; }
.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.msg { display: flex; }
.msg.user { justify-content: flex-end; }
.bubble {
  max-width: 85%;
  padding: 8px 12px;
  border-radius: 10px;
  font-size: 13px;
  line-height: 1.4;
  word-break: break-word;
}
.user .bubble {
  background: #1976d2;
  color: white;
  border-bottom-right-radius: 2px;
}
.assistant .bubble {
  background: #333;
  color: #ddd;
  border-bottom-left-radius: 2px;
}
.thinking { color: #888; font-style: italic; }
.chat-input {
  display: flex;
  gap: 6px;
  padding: 8px 10px;
  border-top: 1px solid #333;
}
.chat-input input {
  flex: 1;
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid #444;
  background: #222;
  color: #eee;
  font-size: 13px;
  outline: none;
}
.chat-input input:focus { border-color: #1976d2; }
.chat-input button {
  padding: 8px 14px;
  border-radius: 6px;
  border: none;
  background: #1976d2;
  color: white;
  cursor: pointer;
  font-size: 13px;
}
.chat-input button:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
