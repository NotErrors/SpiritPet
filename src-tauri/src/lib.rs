use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::{Emitter, Manager};

#[tauri::command]
fn exit_app() {
    std::process::exit(0);
}

// ==================== 光标轮询 ====================
//
// 这个线程同时服务两件事：
//
// 1) 点击穿透：窗口的透明区域不能挡住桌面点击，只有宠物本体能接收鼠标。
//    窗口一旦设成穿透，前端就收不到鼠标事件，也就永远不知道光标何时回来
//    —— 死锁。所以命中测试只能放在这里做。
//
// 2) 眼睛跟随：前端的 mousemove 只在光标位于窗口内时才有。
//    而桌宠的眼睛应该能跟着屏幕任何角落的光标转。
//    全局光标位置只有这里拿得到，所以顺路推给前端。
//
// 【坐标基准】前端 getBoundingClientRect() 是相对【客户区】的，
// 因此这里必须用 inner_position()（客户区原点）。
// 用 outer_position() 会带上 Windows 给可调尺寸窗口加的无形边框，
// 实测约 8px 水平偏移。
//
// 【排查提示】关键失败路径都会 eprintln。不要吞错误 ——
// 曾经因为吞错误，"拖不动"完全无从下手。

#[derive(serde::Deserialize, Clone, Debug)]
struct Rect {
    x: f64,
    y: f64,
    w: f64,
    h: f64,
}

#[derive(Default)]
struct HitRects(Mutex<Option<Vec<Rect>>>);

/// 窗口最近一次被移动的时刻。拖动期间系统在跑模态拖拽循环，
/// 这期间绝不能改穿透状态，否则会打断拖拽。
struct LastMoved(Mutex<Instant>);

#[derive(Clone, serde::Serialize)]
struct CursorPayload {
    x: f64,
    y: f64,
}

#[tauri::command]
fn update_hit_rects(state: tauri::State<'_, HitRects>, rects: Vec<Rect>) {
    if let Ok(mut g) = state.0.lock() {
        *g = Some(rects);
    }
}

/// 全局光标位置 → 相对窗口客户区的逻辑坐标
fn cursor_in_client(window: &tauri::WebviewWindow) -> Result<(f64, f64), String> {
    let cursor = window
        .cursor_position()
        .map_err(|e| format!("cursor_position: {e}"))?;
    let origin = window
        .inner_position()
        .map_err(|e| format!("inner_position: {e}"))?;
    let scale = window.scale_factor().unwrap_or(1.0);
    Ok((
        (cursor.x - origin.x as f64) / scale,
        (cursor.y - origin.y as f64) / scale,
    ))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .manage(HitRects::default())
        .manage(LastMoved(Mutex::new(Instant::now() - Duration::from_secs(60))))
        .invoke_handler(tauri::generate_handler![exit_app, update_hit_rects])
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_always_on_top(true);

                let handle = app.handle().clone();
                std::thread::spawn(move || {
                    let mut last_ignore: Option<bool> = None;
                    let mut last_cursor: Option<(f64, f64)> = None;

                    loop {
                        std::thread::sleep(Duration::from_millis(40));

                        let Some(win) = handle.get_webview_window("main") else {
                            continue;
                        };

                        let (lx, ly) = match cursor_in_client(&win) {
                            Ok(v) => v,
                            Err(_) => continue,
                        };

                        // ---- 眼睛跟随：位移超过 1px 才推送，静止时不产生流量 ----
                        let cursor_moved = match last_cursor {
                            Some((px, py)) => (px - lx).abs() >= 1.0 || (py - ly).abs() >= 1.0,
                            None => true,
                        };
                        if cursor_moved {
                            last_cursor = Some((lx, ly));
                            let _ = win.emit("pet://cursor", CursorPayload { x: lx, y: ly });
                        }

                        // ---- 点击穿透 ----
                        // State 必须先用变量接住：它是临时值，
                        // 直接链式调用会在语句结束前被释放，borrow 检查不过。
                        let moved_state = handle.state::<LastMoved>();
                        let moved_recently = match moved_state.0.lock() {
                            Ok(t) => t.elapsed() < Duration::from_millis(700),
                            Err(_) => false,
                        };
                        if moved_recently {
                            continue;
                        }

                        let hit_state = handle.state::<HitRects>();
                        let rects: Vec<Rect> = {
                            let guard = match hit_state.0.lock() {
                                Ok(g) => g,
                                Err(_) => continue,
                            };
                            match guard.as_ref() {
                                Some(r) if !r.is_empty() => r.to_vec(),
                                _ => continue,
                            }
                        };

                        let hit = rects
                            .iter()
                            .any(|r| lx >= r.x && lx <= r.x + r.w && ly >= r.y && ly <= r.y + r.h);
                        let ignore = !hit;

                        if last_ignore != Some(ignore) {
                            if let Err(e) = win.set_ignore_cursor_events(ignore) {
                                eprintln!("[hit] set_ignore_cursor_events({ignore}) 失败: {e}");
                                continue;
                            }
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
