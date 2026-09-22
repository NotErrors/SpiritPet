<template>
  <div class="settings-overlay" @click.self="$emit('close')">
    <div class="settings-panel" @click.stop>
      <h2>⚙️ 设置</h2>
      <p class="subtitle">配置 AI 模型后即可开始和你的宠物对话</p>

      <div class="field">
        <label>API Key</label>
        <input v-model="key" type="password" placeholder="sk-..." />
      </div>
      <div class="field">
        <label>Model</label>
        <select v-model="model">
          <option value="gpt-4o-mini">GPT-4o-mini (推荐)</option>
          <option value="gpt-4o">GPT-4o</option>
          <option value="deepseek-chat">DeepSeek Chat</option>
          <option value="qwen-turbo">通义千问 Turbo</option>
        </select>
      </div>
      <div class="field">
        <label>Base URL</label>
        <input v-model="baseUrl" placeholder="https://api.openai.com" />
      </div>

      <div v-if="error" class="error">{{ error }}</div>
      <div v-if="success" class="success">✅ 连接成功！开始和你的蛋聊天吧</div>

      <div class="actions">
        <button class="btn-test" @click="testConnection" :disabled="testing">
          {{ testing ? "测试中..." : "测试连接" }}
        </button>
        <button class="btn-save" @click="save" :disabled="!key.trim()">保存</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { pet, saveConfig } from "../stores/petStore";

const emit = defineEmits<{ close: []; saved: [] }>();

const key = ref(pet.apiKey);
const model = ref(pet.model);
const baseUrl = ref(pet.baseUrl);
const testing = ref(false);
const error = ref("");
const success = ref(false);

async function testConnection() {
  testing.value = true;
  error.value = "";
  success.value = false;
  try {
    const url = (baseUrl.value || "https://api.openai.com").replace(/\/$/, "");
    const res = await fetch(url + "/v1/models", {
      headers: { Authorization: "Bearer " + key.value },
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    success.value = true;
  } catch (e: any) {
    error.value = "连接失败: " + e.message;
  } finally {
    testing.value = false;
  }
}

function save() {
  saveConfig(key.value, model.value, baseUrl.value);
  emit("saved");
}
</script>

<style scoped>
.settings-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.settings-panel {
  width: 340px;
  background: #1e1e1e;
  border-radius: 12px;
  padding: 24px;
  color: #ddd;
  box-shadow: 0 8px 32px rgba(0,0,0,0.5);
}
h2 { font-size: 18px; margin-bottom: 4px; }
.subtitle { font-size: 12px; color: #888; margin-bottom: 20px; }
.field { margin-bottom: 14px; }
.field label { display: block; font-size: 12px; color: #aaa; margin-bottom: 4px; }
.field input, .field select {
  width: 100%;
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid #444;
  background: #2a2a2a;
  color: #eee;
  font-size: 13px;
  outline: none;
}
.field input:focus, .field select:focus { border-color: #1976d2; }
.error { color: #ef5350; font-size: 12px; margin-bottom: 10px; }
.success { color: #66bb6a; font-size: 12px; margin-bottom: 10px; }
.actions { display: flex; gap: 8px; margin-top: 16px; }
.actions button {
  flex: 1;
  padding: 10px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  font-size: 13px;
}
.btn-test { background: #333; color: #ccc; }
.btn-test:hover { background: #444; }
.btn-save { background: #1976d2; color: white; }
.btn-save:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
