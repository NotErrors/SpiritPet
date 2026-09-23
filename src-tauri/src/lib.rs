use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::Manager;

// ==================== 退出 ====================

#[tauri::command]
fn exit_app() {
    std::process::exit(0);
}

// ==================== 点击穿透 ====================
//
// 目标：像 QQ 宠物那样「没有框」——窗口的透明区域不能挡住桌面点击，
// 只有宠物本体（和展开的面板）能接收鼠标。
//
// 难点：窗口一旦设成完全穿透，前端就收不到任何鼠标事件，
// 于是永远无法知道光标什么时候又回到宠物身上 —— 死锁。
// 所以必须在 Rust 侧轮询全局光标位置，自己做命中测试。
//
// 前端负责上报「当前有哪些可点击矩形」（宠物本体 + 展开的聊天/设置面板），
// Rust 每 40ms 测一次，且只在结果变化时才调用系统 API（避免无谓开销）。

/// 前端上报的可点击矩形（逻辑像素，相对窗口左上角）
#[derive(serde::Deserialize, Clone)]
struct Rect {
    x: f64,
    y: f64,
    w: f64,
    h: f64,
}

#[derive(Default)]
struct HitRects(Mutex<Option<Vec<Rect>>>);

/// 窗口最近一次被移动的时刻。
///
/// 拖动窗口时系统正在跑模态拖拽循环，这期间绝不能改穿透状态，
/// 否则会把拖拽打断（表现为"拖着拖着就掉了"）。
/// 拖动过程中 Moved 事件会持续触发，等于不断续期，
/// 因此不需要前端配合就能自动识别"正在拖动"。
struct LastMoved(Mutex<Instant>);

#[tauri::command]
fn update_hit_rects(state: tauri::State<'_, HitRects>, rects: Vec<Rect>) {
    if let Ok(mut g) = state.0.lock() {
        *g = Some(rects);
    }
}

/// 命中测试：光标是否落在任意一个可点击矩形内
fn is_over_hit_rect(window: &tauri::WebviewWindow, rects: &[Rect]) -> bool {
    let (cursor, pos, scale) = match (
        window.cursor_position(),
        window.outer_position(),
        window.scale_factor(),
    ) {
        (Ok(c), Ok(p), Ok(s)) => (c, p, s),
        // 读不到就当作命中 —— 宁可多挡一点，也绝不能让宠物点不到
        _ => return true,
    };

    let lx = (cursor.x - pos.x as f64) / scale;
    let ly = (cursor.y - pos.y as f64) / scale;

    rects
        .iter()
        .any(|r| lx >= r.x && lx <= r.x + r.w && ly >= r.y && ly <= r.y + r.h)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .manage(HitRects::default())
        .manage(LastMoved(Mutex::new(
            Instant::now() - Duration::from_secs(60),
        )))
        .invoke_handler(tauri::generate_handler![exit_app, update_hit_rects])
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_always_on_top(true);

                // 光标轮询线程
                let handle = app.handle().clone();
                std::thread::spawn(move || {
                    let mut last_ignore: Option<bool> = None;

                    loop {
                        std::thread::sleep(Duration::from_millis(40));

                        let Some(win) = handle.get_webview_window("main") else {
                            continue;
                        };

                        // 窗口正在被拖动 → 让出控制权
                        // 注意：State 必须先用变量接住，不能直接链式调用 ——
                        // 它是临时值，会在语句结束前被释放，导致 borrow 检查失败。
                        let moved_state = handle.state::<LastMoved>();
                        let moved_recently = match moved_state.0.lock() {
                            Ok(t) => t.elapsed() < Duration::from_millis(700),
                            Err(_) => false,
                        };
                        if moved_recently {
                            continue;
                        }

                        // 前端还没上报区域时不动穿透状态，保证启动阶段可用
                        let hit_state = handle.state::<HitRects>();
                        let rects: Vec<Rect> = {
                            let guard = match hit_state.0.lock() {
                                Ok(g) => g,
                                Err(_) => continue,
                            };
                            match guard.as_ref() {
                                // 注意用 to_vec 而不是 r.clone()：
                                // 后者会解析成克隆「引用」，返回 &Vec 而不是 Vec
                                Some(r) if !r.is_empty() => r.to_vec(),
                                _ => continue,
                            }
                        };

                        let ignore = !is_over_hit_rect(&win, &rects);
                        if last_ignore != Some(ignore) {
                            let _ = win.set_ignore_cursor_events(ignore);
                            last_ignore = Some(ignore);
                        }
                    }
                });
            }
            Ok(())
        })
        .on_window_event(|window, event| match event {
            tauri::WindowEvent::CloseRequested { .. } => std::process::exit(0),
            tauri::WindowEvent::Moved(_) => {
                if let Ok(mut t) = window.state::<LastMoved>().0.lock() {
                    *t = Instant::now();
                }
            }
            _ => {}
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
