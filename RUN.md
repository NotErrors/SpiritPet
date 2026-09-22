# SpiritPet MVP 运行指南

## 前置条件

| 工具 | 版本要求 | 验证命令 |
|------|---------|---------|
| Node.js | >= 18 | `node --version` |
| Rust | >= 1.70 | `rustc --version` |
| Visual Studio Build Tools | 2022+ (含 C++ 工具集) | `link.exe /?` |

> Windows 上 Rust 需要 MSVC 链接器。安装 Visual Studio Build Tools 时勾选"使用 C++ 的桌面开发"工作负载。

## 快速启动

```bash
cd SpiritPet
npm install
npx tauri dev
```

## 构建安装包

```bash
npx tauri build
```

## 项目结构

```
SpiritPet/
  src/                        # Vue3 前端
    main.ts                   # 入口
    App.vue                   # 主组件（流程控制）
    components/
      Egg.vue                 # 蛋组件（SVG 动画）
      Pet.vue                 # 宠物组件（圆形+MBTI色）
      ChatPanel.vue           # 聊天面板
      Settings.vue            # API 配置面板
    stores/
      petStore.ts             # 状态管理
  src-tauri/                  # Tauri Rust 壳
    src/lib.rs                # 窗口管理
    src/main.rs               # 入口
    tauri.conf.json           # Tauri 配置
  index.html
  package.json
  vite.config.ts
  tsconfig.json
```

## MVP 功能流程

```
启动 → 检测 API Key
  ├─ 无 → 弹出设置面板
  └─ 有 → 显示蛋 → 点击聊天 → 每轮亲密度+1
         → 亲密度>=30 → 破壳动画 → 显示宠物（随机MBTI）
         → 继续聊天
```

## 常见问题

**link.exe not found** → 安装 VS Build Tools，勾选 C++ 桌面开发

**窗口不透明** → tauri.conf.json 设 transparent: true

**蛋一直不动** → 亲密度需达 30 才破壳，每轮对话 +1