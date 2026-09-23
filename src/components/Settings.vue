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
        <input v-model="model" placeholder="gpt-4o-mini / deepseek-chat / 自定义模型名" />
        <div class="hint">常用模型：gpt-4o-mini · deepseek-chat · qwen-turbo</div>
      </div>
      <div class="field">
        <label>Base URL</label>
        <input v-model="baseUrl" placeholder="https://api.openai.com" />
      </div>

      <div class="divider"></div>
      <div class="section-title">Jev 决策路由（可选）</div>
      <div class="field">
        <label>Jev API Key</label>
        <input v-model="jevKey" type="password" placeholder="留空则不启用路由" />
      </div>
      <div class="field">
        <label>Jev Base URL</label>
        <input v-model="jevBaseUrl" placeholder="https://api.typesafe.ai" />
        <div class="jev-hint">简单聊天走短上下文，复杂对话走完整记忆，节省 token</div>
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
const jevKey = ref(pet.jevKey);
const jevBaseUrl = ref(pet.jevBaseUrl);
const testing = ref(false);
const error = ref("");
const success = ref(false);

async function testConnection() {
  testing.value = true;
  error.value = "";
  success.value = false;
  try {
    let base = (baseUrl.value || "https://api.openai.com").replace(/\/$/, "");
    
    // 智能选择路径：避免 /v1 重复
    let paths: string[];
    if (/\/v1$/.test(base)) {
      paths = ["/chat/completions"];
    } else {
      paths = ["/chat/completions", "/v1/chat/completions"];
    }
    let errs: string[] = [];
    let ok = false;

    for (const p of paths) {
      const url = base + p;
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + key.value,
          },
          body: JSON.stringify({
            model: model.value || "gpt-4o-mini",
            messages: [{ role: "user", content: "hi" }],
            max_tokens: 1,
          }),
        });
        if (res.ok) { ok = true; break; }
        const errBody = await res.text().catch(() => "");
        errs.push(url + " HTTP " + res.status + ": " + errBody.substring(0, 80));
      } catch (e: any) {
        errs.push(url + " " + e.message);
      }
    }

    if (ok) {
      success.value = true;
    } else {
      error.value = errs.join(" | ");
    }
  } catch (e: any) {
    error.value = "连接失败: " + e.message;
  } finally {
    testing.value = false;
  }
}

function save() {
  saveConfig(key.value, model.value, baseUrl.value, jevKey.value, jevBaseUrl.value);
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
  width: 360px;
  max-height: 90vh;
  overflow-y: auto;
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
.hint { color: #666; font-size: 11px; margin-top: 4px; }
.jev-hint { font-size: 11px; color: #666; margin-top: 4px; }
.divider { border-top: 1px solid #333; margin: 16px 0; }
.section-title { font-size: 11px; color: #888; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 1px; }
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