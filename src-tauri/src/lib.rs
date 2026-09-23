use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::Manager;

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
// 【坐标基准】前端 getBoundingClientRect() 是相对【客户区】的，
// 因此这里必须用 inner_position()（客户区原点）。
// 用 outer_position() 会带上 Windows 给可调尺寸窗口加的无形边框，
// 实测有约 8px 的水平偏移。
//
// 【排查提示】这里的关键失败路径都会 eprintln，跑 tauri dev 时直接打在终端。
// 不要图省事把错误吞掉 —— 曾经因为吞错误，导致"拖不动"完全无从下手。

#[derive(serde::Deserialize, Clone, Debug)]
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

/// 把全局光标坐标换算成客户区坐标，再和前端上报的矩形做命中测试
fn hit_test(window: &tauri::WebviewWindow, rects: &[Rect]) -> Result<bool, String> {
    let cursor = window
        .cursor_position()
        .map_err(|e| format!("cursor_position: {e}"))?;
    let origin = window
        .inner_position()
        .map_err(|e| format!("inner_position: {e}"))?;
    let scale = window.scale_factor().unwrap_or(1.0);

    let lx = (cursor.x - origin.x as f64) / scale;
    let ly = (cursor.y - origin.y as f64) / scale;

    Ok(rects
        .iter()
        .any(|r| lx >= r.x && lx <= r.x + r.w && ly >= r.y && ly <= r.y + r.h))
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

                    loop {
                        std::thread::sleep(Duration::from_millis(40));

                        let Some(win) = handle.get_webview_window("main") else {
                            continue;
                        };

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

                        // 读不到光标就当作命中：宁可多挡一点，
                        // 也绝不能让宠物点不到（那是致命体验问题）
                        let hit = match hit_test(&win, &rects) {
                            Ok(h) => h,
                            Err(e) => {
                                eprintln!("[hit] {e}");
                                true
                            }
                        };
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
