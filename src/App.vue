<template>
  <div class="app" @contextmenu.prevent="onContextMenu" @click="showMenu = false">
    
    <!-- 窗口控制按钮 -->
    <div class="window-controls">
      <div class="win-btn close" @click.stop="closeApp" title="关闭">✕</div>
    </div>
    
    <!-- 右键菜单 -->
    <div v-if="showMenu" class="context-menu" @click.stop
      :style="{ left: menuX + 'px', top: menuY + 'px' }">
      <div class="menu-item" @click="openChat">💬 聊天</div>
      <div class="menu-item" @click="openSettings">⚙ 设置</div>
      <div class="menu-item" @click="closeApp">✕ 退出 SpiritPet</div>
    </div>
    <!-- 没有 API Key 时显示设置 -->
    <Settings
      v-if="!hasApiKey || showSettings"
      @saved="onSaved"
      @close="showSettings = false"
    />

    <!-- 有 API Key 时显示蛋/宠物 -->
    <template v-if="hasApiKey">
      <div class="pet-area" @click="onPetClick" @dblclick="onPetDblClick">
        <!-- 蛋阶段 -->
        <Egg v-if="stage === 'egg'" :intimacy="intimacy" :petting="petting" />
        <div class="click-hint" v-if="!chatOpen">💡 单击抚摸 · 双击聊天</div>
        
        <!-- 宠物阶段 -->
        <Pet
          v-if="stage === 'pet'"
          :color="mbtiColor"
          :mbti="mbti || '???'"
          :intimacy="intimacy"
          :petting="petting"
        />
      </div>

      <!-- 聊天面板 -->
      <div v-if="chatOpen" class="chat-wrapper">
        <ChatPanel
          :stage="stage"
          :mbti="mbti || '???'"
          :messages="pet.messages"
          @close="chatOpen = false"
        />
      </div>

      <!-- 破壳通知 -->
      <!-- 退出确认弹框 -->
      <div v-if="showConfirmExit" class="confirm-overlay" @click="showConfirmExit = false">
        <div class="confirm-dialog" @click.stop>
          <div class="confirm-icon">👋</div>
          <div class="confirm-text">确定要离开吗？</div>
          <div class="confirm-sub">你的 SpiritPet 会想你的</div>
          <div class="confirm-actions">
            <button class="confirm-cancel" @click="showConfirmExit = false">取消</button>
            <button class="confirm-ok" @click="doExit">确定退出</button>
          </div>
        </div>
      </div>

      <div v-if="showHatchNotice" class="hatch-notice" @click="showHatchNotice = false">
        <div class="hatch-card">
          <div class="hatch-icon">🐣</div>
          <div class="hatch-title">新生命诞生了！</div>
          <div class="hatch-mbti">它是个 <strong>{{ mbti }}</strong></div>
          <div class="hatch-tip">点击关闭</div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from "vue";
import { pet, hasApiKey, mbtiColor, tryHatch, petTouch, type Message } from "./stores/petStore";
import Egg from "./components/Egg.vue";
import Pet from "./components/Pet.vue";
import ChatPanel from "./components/ChatPanel.vue";
import Settings from "./components/Settings.vue";

const stage = ref(pet.stage);
const intimacy = ref(pet.intimacy);
const mbti = ref(pet.mbti);
const chatOpen = ref(false);
const showHatchNotice = ref(false);
const showMenu = ref(false);
const menuX = ref(0);
const menuY = ref(0);
const showConfirmExit = ref(false);
const showSettings = ref(false);

// 右键菜单位置
function onContextMenu(e: MouseEvent) {
  menuX.value = e.clientX;
  menuY.value = e.clientY;
  showMenu.value = true;
}

function openSettings() {
  showMenu.value = false;
  showSettings.value = true;
}

function closeApp() {
  showConfirmExit.value = true;
}

async function doExit() {
  showConfirmExit.value = false;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("exit_app");
  } catch {
    try { window.close(); } catch {}
  }
}

// Escape 键关闭菜单或退出
function onKeyDown(e: KeyboardEvent) {
  if (e.key === "Escape") {
    if (showMenu.value) {
      showMenu.value = false;
    }
  }
}

onMounted(() => window.addEventListener("keydown", onKeyDown));
onUnmounted(() => window.removeEventListener("keydown", onKeyDown));

// Watch intimacy changes for auto-hatch
watch(() => pet.intimacy, (val) => {
  intimacy.value = val;
  if (tryHatch()) {
    stage.value = "pet";
    mbti.value = pet.mbti;
    showHatchNotice.value = true;
  }
});

// Watch for state changes from other components
watch(() => pet.stage, (val) => { stage.value = val; });
watch(() => pet.mbti, (val) => { mbti.value = val; });

let clickTimer: number | null = null;
let petTimer: number | null = null;
const petting = ref(false);

/** 单击 = 抚摸（延时判定，避免与双击冲突） */
function onPetClick() {
  if (clickTimer !== null) return;
  clickTimer = window.setTimeout(() => {
    clickTimer = null;
    doPet();
  }, 240);
}

/** 双击 = 打开聊天 */
function onPetDblClick() {
  if (clickTimer !== null) {
    clearTimeout(clickTimer);
    clickTimer = null;
  }
  chatOpen.value = true;
}

/** 抚摸：播放动画，冷却期内不加亲密度 */
function doPet() {
  petting.value = true;
  petTouch();
  if (petTimer !== null) clearTimeout(petTimer);
  petTimer = window.setTimeout(() => { petting.value = false; }, 1000);
}

/** 右键菜单：打开聊天 */
function openChat() {
  showMenu.value = false;
  chatOpen.value = true;
}

function toggleChat() {
  chatOpen.value = !chatOpen.value;
}

function onSaved() {
  showSettings.value = false;
}
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #app {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: transparent;
}

.window-controls {
  position: fixed;
  top: 6px;
  right: 6px;
  display: flex;
  gap: 4px;
  z-index: 999;
  opacity: 0.6;
  transition: opacity 0.2s;
}
.window-controls:hover { opacity: 1; }
.win-btn {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  cursor: pointer;
  user-select: none;
}
.win-btn.close {
  background: rgba(255, 70, 70, 0.8);
  color: white;
}
.win-btn.close:hover { background: rgb(255, 70, 70); }

.context-menu {
  position: fixed;
  background: #2a2a2a;
  border: 1px solid #444;
  border-radius: 8px;
  padding: 4px 0;
  z-index: 9999;
  box-shadow: 0 4px 16px rgba(0,0,0,0.4);
  min-width: 140px;
}
.menu-item {
  padding: 8px 16px;
  color: #ddd;
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
}
.menu-item:hover {
  background: #1976d2;
  color: white;
}

.app {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  padding-bottom: 10px;
  position: relative;
  -webkit-app-region: drag;
}
.window-controls, .settings-overlay, .chat-wrapper, .pet-area, .hatch-notice {
  -webkit-app-region: no-drag;
}

.pet-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
}
/* 悬停变手型：覆盖窗口拖动区(drag)的默认光标 */
.pet-area,
.pet-area * {
  cursor: pointer !important;
  -webkit-app-region: no-drag;
}

.chat-wrapper {
  position: fixed;
  left: 0;
  top: 30px;
  z-index: 100;
  -webkit-app-region: no-drag;
}

/* 破壳通知 */
.hatch-notice {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
  cursor: pointer;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.hatch-card {
  background: #1e1e1e;
  border-radius: 16px;
  padding: 40px;
  text-align: center;
  color: #eee;
  box-shadow: 0 8px 40px rgba(0,0,0,0.5);
  animation: popIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

@keyframes popIn {
  from { transform: scale(0.5); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

.hatch-icon { font-size: 64px; margin-bottom: 16px; }
.hatch-title { font-size: 22px; font-weight: 600; margin-bottom: 8px; }
.hatch-mbti { font-size: 16px; color: #aaa; margin-bottom: 16px; }
.hatch-mbti strong { color: #fff; font-size: 20px; }
.hatch-tip { font-size: 12px; color: #666; }

.click-hint {
  font-size: 10px;
  color: rgba(255,255,255,0.4);
  margin-top: 4px;
  animation: pulse-hint 2s ease-in-out infinite;
  -webkit-app-region: no-drag;
}
@keyframes pulse-hint {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.8; }
}

/* 退出确认弹框 */
.confirm-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  -webkit-app-region: no-drag;
}
.confirm-dialog {
  background: #1e1e1e;
  border-radius: 16px;
  padding: 32px;
  text-align: center;
  color: #eee;
  box-shadow: 0 8px 40px rgba(0,0,0,0.5);
  width: 260px;
}
.confirm-icon { font-size: 48px; margin-bottom: 12px; }
.confirm-text { font-size: 18px; font-weight: 600; margin-bottom: 4px; }
.confirm-sub { font-size: 12px; color: #888; margin-bottom: 24px; }
.confirm-actions { display: flex; gap: 10px; }
.confirm-actions button {
  flex: 1;
  padding: 10px;
  border-radius: 8px;
  border: none;
  font-size: 13px;
  cursor: pointer;
}
.confirm-cancel { background: #333; color: #ccc; }
.confirm-cancel:hover { background: #444; }
.confirm-ok { background: #e53935; color: white; }
.confirm-ok:hover { background: #c62828; }
</style>
