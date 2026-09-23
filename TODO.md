# SpiritPet TODO

## 待启用功能

### Jev 决策路由（代码已集成，等待 API Key）

**状态**：代码已完成，设置面板已就位，但 TypeSafe AI 当前注册不了，暂不启用。

**启用方式**：在设置面板填 `Jev API Key` + `Jev Base URL`（默认 `https://api.typesafe.ai`），保存即生效，**无需改代码**。

**Jev 是什么**：TypeSafe AI 的 System One 决策模型，不生成文字，只做结构化判断（Choice / Score / Noul）。
- 价格：输入 $0.042/百万 token，**输出免费**
- 注册赠 $5 额度（够用几十万次调用）
- 文档：https://docs.typesafe.ai/

**为什么要它**：省 token 的关键不是"本地硬编回复"，而是**减少上下文长度**。
简单对话（"早安"）不需要 20 条聊天历史，只带最近 2 条就够，回复仍由 LLM 生成 —— 保持新鲜感的同时省掉 90% 上下文 token。

**路由逻辑**（见 `src/stores/petStore.ts` 的 `callJevRouter` / `chat`）：

```
用户说话
  ↓
有 Jev Key？
  ├─ 没有 → 走默认逻辑（20 条完整上下文）
  └─ 有   → Jev 分类消息类型
            ├─ greeting / casual → contextMsgCount = 2（短上下文）
            └─ emotional / query / command → contextMsgCount = 20（完整）
  ↓
调 LLM 生成回复
```

**已埋的坑（已修）**：Base URL 已含 `/v1` 时不能再追加 `/v1`，否则拼成 `/v1/v1/chat/completions` 报 `Failed to fetch`。

---

## 后续版本规划

### v1.0
- 系统托盘 + 右键菜单
- 多分支进化（MBTI 维度演变）
- 长期记忆（NDJSON + sqlite-vec）
- TTS 语音互动实验

### v1.1
- 记忆回声（1-2 天前的对话回顾）
- 语音互动生产化

### 架构备注
- Go 后端服务（用于常驻进程单二进制交付）：MVP 未使用，必要时引入
