<template>
  <div class="app" :class="{ 'chat-open': chatOpen }" @contextmenu.prevent="onContextMenu" @click="showMenu = false">
    
    <!-- 窗口控制按钮 -->
    <div class="window-controls">
      <div class="win-btn close" @click.stop="closeApp" title="关闭">✕</div>
    </div>
    
    <!-- 右键菜单 -->
    <div v-if="showMenu" class="context-menu" @click.stop
      :style="{ left: menuX + 'px', top: menuY + 'px' }">
      <div class="menu-item" @click="openChat">💬 聊天</div>
      <div class="menu-item" @click="restart">🔄 重新养一只</div>
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
      <div
        class="pet-area"
        @click="onPetClick"
        @dblclick="onPetDblClick"
        @pointerdown="onPetPointerDown"
        @pointermove="onPetPointerMove"
        @pointerup="onPetPointerUp"
        @pointerleave="onPetPointerUp"
      >
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

      <!-- 破壳仪式：蛋摇晃裂开 → 碎壳飞散 → 宠物诞生 -->
      <HatchCeremony
        v-if="showCeremony"
        :mbti="mbti"
        :color="mbtiColor"
        :reasons="hatchReasons"
        @burst="commitHatch"
        @done="onCeremonyDone"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from "vue";
import { pet, hasApiKey, mbtiColor, tryHatch, petTouch, resetPet, hatchAnalysis, addMessage, type Message } from "./stores/petStore";
import { getPersonality } from "./data/personalities";
import Egg from "./components/Egg.vue";
import Pet from "./components/Pet.vue";
import ChatPanel from "./components/ChatPanel.vue";
import Settings from "./components/Settings.vue";
import HatchCeremony from "./components/HatchCeremony.vue";
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";

// 懒加载：纯浏览器里打开时这些 API 不存在，不能在模块顶层就调用
let _appWindow: ReturnType<typeof getCurrentWindow> | null = null;
function appWindow() {
  if (!_appWindow) _appWindow = getCurrentWindow();
  return _appWindow;
}
const isTauri = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const stage = ref(pet.stage);
const intimacy = ref(pet.intimacy);
const mbti = ref(pet.mbti);
const chatOpen = ref(false);
const showCeremony = ref(false);
/** 破壳时展示的性格判定理由 */
const hatchReasons = ref<string[]>([]);
const showMenu = ref(false);
const menuX = ref(0);
const menuY = ref(0);
const showConfirmExit = ref(false);
const showSettings = ref(false);

// 右键菜单位置
function onContextMenu(e: MouseEvent) {
  // 窗口很窄，菜单直接放在光标处会被裁掉，先夹进窗口内
  const MENU_W = 152;
  const MENU_H = 144;
  menuX.value = Math.max(0, Math.min(e.clientX, window.innerWidth - MENU_W));
  menuY.value = Math.max(0, Math.min(e.clientY, window.innerHeight - MENU_H));
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
    // 用顶部静态导入的 invoke（动态导入会和其它模块的静态导入冲突，触发打包警告）
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

// 亲密度达标 → 播破壳仪式
// 注意：这里先不真的破壳，要等仪式播到「爆裂」那一刻才提交状态，
// 否则蛋会在用户看到之前就消失，整个仪式就没意义了
watch(() => pet.intimacy, (val) => {
  intimacy.value = val;
  if (pet.stage === "egg" && val >= 30 && !showCeremony.value) {
    showCeremony.value = true;
  }
});

/** 仪式播到爆裂瞬间：此刻才正式提交破壳 */
function commitHatch() {
  if (tryHatch()) {
    stage.value = "pet";
    mbti.value = pet.mbti;
    chatOpen.value = false;
    // 让它说第一句话。用性格自带的示例台词，
    // 不调接口所以必定成功——破壳这么重要的时刻不能因为网络失败而冷场。
    hatchReasons.value = hatchAnalysis.value?.reasons || [];
    const p = getPersonality(pet.mbti);
    addMessage("assistant", p.sample);
  }
}

/** 重新养一只：回到蛋阶段 */
function restart() {
  showMenu.value = false;
  resetPet();
  stage.value = "egg";
  mbti.value = null;
  intimacy.value = 0;
  chatOpen.value = false;
  showCeremony.value = false;
  hatchReasons.value = [];
}

function onCeremonyDone() {
  showCeremony.value = false;
}

// Watch for state changes from other components
watch(() => pet.stage, (val) => { stage.value = val; });
watch(() => pet.mbti, (val) => { mbti.value = val; });

let clickTimer: number | null = null;
let petTimer: number | null = null;
const petting = ref(false);

/** 单击 = 抚摸（延时判定，避免与双击冲突） */
function onPetClick() {
  // 刚拖动过，这次 click 是拖动的余波，不当成抚摸
  if (didDrag) return;
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

// ==================== 窗口形态 ====================
//
// 目标：像 QQ 宠物那样「没有框」。
//
// 窗口本身是透明无边框的，但透明区域默认仍然会拦住鼠标 ——
// 你以为点到了桌面图标，其实点在了一块看不见的玻璃上。
// 解决办法：光标不在宠物身上时，把窗口设成点击穿透。
// 这件事必须在 Rust 侧做，因为窗口一旦穿透，前端就收不到任何
// 鼠标事件，也就永远无法知道光标何时回来（见 src-tauri/src/lib.rs）。
//
// 前端这里只负责一件事：告诉 Rust 当前哪些矩形是可点的。

type Rect = { x: number; y: number; w: number; h: number };

const SIZES: Record<string, { w: number; h: number }> = {
  pet: { w: 240, h: 230 },
  chat: { w: 280, h: 500 },
  settings: { w: 400, h: 650 },
};

let currentSizeKey = "";

/** 是否有占满窗口的大面板（设置 / 破壳仪式 / 退出确认） */
const fullPanelOpen = computed(
  () => !hasApiKey.value || showSettings.value || showCeremony.value || showConfirmExit.value
);

function rectOf(selector: string, pad: number): Rect[] {
  const el = document.querySelector(selector) as HTMLElement | null;
  if (!el) return [];
  const r = el.getBoundingClientRect();
  if (r.width < 1 || r.height < 1) return [];
  return [{ x: r.left - pad, y: r.top - pad, w: r.width + pad * 2, h: r.height + pad * 2 }];
}

/** 上报可点击区域，Rust 据此决定窗口穿透与否 */
async function reportHitRects() {
  if (!isTauri()) return;
  await nextTick();

  let rects: Rect[];
  if (fullPanelOpen.value) {
    // 大面板基本占满窗口，整窗可点最省事
    rects = [{ x: 0, y: 0, w: window.innerWidth, h: window.innerHeight }];
  } else {
    rects = [
      ...rectOf(".pet-area", 8),
      ...rectOf(".window-controls", 6),
      ...(chatOpen.value ? rectOf(".chat-wrapper", 4) : []),
      ...(showMenu.value ? rectOf(".context-menu", 4) : []),
    ];
  }

  try {
    await invoke("update_hit_rects", { rects });
  } catch {
    /* 上报失败不影响使用，下次界面变化会重试 */
  }
}

/** 按当前界面切换窗口大小 */
async function applyWindowSize() {
  const key = fullPanelOpen.value ? "settings" : chatOpen.value ? "chat" : "pet";
  if (key === currentSizeKey) return;
  currentSizeKey = key;
  if (!isTauri()) return;
  try {
    const s = SIZES[key];
    await appWindow().setSize(new LogicalSize(s.w, s.h));
  } catch {
    /* 忽略 */
  }
}

// 界面变化 → 同步窗口大小与可点击区域
watch(
  [fullPanelOpen, chatOpen, showMenu, showCeremony, showConfirmExit],
  async () => {
    await applyWindowSize();
    await reportHitRects();
  },
  { immediate: true, flush: "post" }
);

onMounted(async () => {
  await applyWindowSize();
  await reportHitRects();
});

// ==================== 拖动 ====================
//
// 刻意不用 -webkit-app-region: drag —— 它会把鼠标事件整个吞掉，
// 「单击抚摸 / 双击聊天」就全废了（这也是之前只能拖空白处的原因）。
// 改成手动判定：按下后位移超过阈值才算拖动，否则当点击处理。

let downAt: { x: number; y: number } | null = null;
let didDrag = false;

function onPetPointerDown(e: PointerEvent) {
  if (e.button !== 0) return;
  downAt = { x: e.clientX, y: e.clientY };
  didDrag = false;
}

function onPetPointerMove(e: PointerEvent) {
  if (!downAt || didDrag) return;
  if (Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < 4) return;
  // 超过 4px 才认定为拖动，避免手抖把单击吃掉
  didDrag = true;
  downAt = null;
  if (isTauri()) appWindow().startDragging().catch(() => {});
}

function onPetPointerUp() {
  downAt = null;
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

/*
 * 注意这里没有 -webkit-app-region: drag。
 * 它会让整块区域吞掉鼠标事件（单击抚摸/双击聊天全部失效），
 * 而且会把光标强制变成默认箭头。拖动改由 .pet-area 手动实现。
 */
.app {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  padding-top: 30px;
  position: relative;
}
.window-controls, .settings-overlay, .chat-wrapper, .pet-area {
  -webkit-app-region: no-drag;
}

.pet-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: grab;
}
/* 悬停变手掌：覆盖窗口拖动区(drag)的默认光标 */
.pet-area,
.pet-area * {
  cursor: grab !important;
  -webkit-app-region: no-drag;
}
/* 按住时握拳 */
.pet-area:active,
.pet-area *:active {
  cursor: grabbing !important;
}

/* 原来用 fixed 悬浮会盖住宠物；窗口现在按内容高度自适应，
   改成正常流：宠物在上，面板在下，宠物始终露在面板之外。 */
.chat-wrapper {
  position: relative;
  margin-top: 8px;
  z-index: 100;
  -webkit-app-region: no-drag;
}

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
