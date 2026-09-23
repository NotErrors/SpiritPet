// 统一的 HTTP 请求封装
//
// 背景：Tauri 的 webview 里用浏览器原生 fetch 请求第三方 API 会被 CORS 拦截
// （多数 OpenAI 兼容服务不返回 Access-Control-Allow-Origin），表现为 "Failed to fetch"。
//
// 方案：在 Tauri 环境下改用 @tauri-apps/plugin-http，请求由 Rust 侧发出，
// 不受同源策略限制；在纯浏览器环境下自动降级为原生 fetch。

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

let httpFetchImpl: FetchFn | null = null;
let loading: Promise<void> | null = null;

async function loadImpl(): Promise<void> {
  if (!isTauri || httpFetchImpl) return;
  if (loading) return loading;
  loading = (async () => {
    try {
      const mod = await import("@tauri-apps/plugin-http");
      httpFetchImpl = mod.fetch as unknown as FetchFn;
    } catch {
      httpFetchImpl = null; // 插件不可用时降级
    }
  })();
  return loading;
}

/** 发 HTTP 请求：Tauri 环境走 Rust 侧（绕过 CORS），否则用原生 fetch */
export async function httpFetch(url: string, init?: RequestInit): Promise<Response> {
  await loadImpl();
  const f = httpFetchImpl ?? (globalThis.fetch as unknown as FetchFn);
  return f(url, init);
}
