<template>
  <div class="app" @contextmenu.prevent="onContextMenu" @click="showMenu = false">
    
    <!-- 窗口控制按钮 -->
    <div class="window-controls">
      <div class="win-btn close" @click.stop="closeApp" title="关闭">✕</div>
    </div>
    
    <!-- 右键菜单 -->
    <div v-if="showMenu" class="context-menu" @click.stop
      :style="{ left: menuX + 'px', top: menuY + 'px' }">
      <div class="menu-item" @click="closeApp">✕ 退出 SpiritPet</div>
    </div>
    <!-- 没有 API Key 时显示设置 -->
    <Settings
      v-if="!hasApiKey"
      @saved="onSaved"
      @close="() => {}"
    />

    <!-- 有 API Key 时显示蛋/宠物 -->
    <template v-if="hasApiKey">
      <div class="pet-area" @click="toggleChat">
        <!-- 蛋阶段 -->
        <Egg v-if="stage === 'egg'" :intimacy="intimacy" @click="toggleChat" />
        
        <!-- 宠物阶段 -->
        <Pet
          v-if="stage === 'pet'"
          :color="mbtiColor"
          :mbti="mbti || '???'"
          :intimacy="intimacy"
          @click="toggleChat"
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
import { pet, hasApiKey, mbtiColor, tryHatch, type Message } from "./stores/petStore";
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

// 右键菜单位置
function onContextMenu(e: MouseEvent) {
  menuX.value = e.clientX;
  menuY.value = e.clientY;
  showMenu.value = true;
}

async function closeApp() {
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().close();
  } catch {
    // fallback: if running in browser dev mode
    window.close();
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

function toggleChat() {
  chatOpen.value = !chatOpen.value;
}

function onSaved() {
  // Settings saved, start showing egg
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
  -webkit-app-region: drag;
}
.window-controls, .settings-overlay, .chat-wrapper, .pet-area, .hatch-notice {
  -webkit-app-region: no-drag;
}
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  padding-bottom: 10px;
  position: relative;
}

.pet-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
}

.chat-wrapper {
  position: fixed;
  bottom: 80px;
  left: 10px;
  z-index: 100;
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
</style>
