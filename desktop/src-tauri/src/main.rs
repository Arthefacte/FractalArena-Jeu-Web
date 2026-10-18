#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{fs, time::Instant};
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    webview::{NewWindowResponse, PageLoadEvent, WebviewBuilder},
    window::WindowBuilder,
    AppHandle, LogicalPosition, LogicalSize, Manager, Webview, WebviewUrl, Window,
};
use tauri_plugin_opener::OpenerExt;
mod window_state;

// Unique source of truth. Milestone 2: replace game_source() with WebviewUrl::App,
// after packaging the client and defining its API/offline synchronization contract.
const GAME_URL: &str = "https://fractalarena.com";
const TITLE_HEIGHT: f64 = 40.0;

struct Startup(Instant, std::sync::atomic::AtomicBool);

fn game_source() -> WebviewUrl {
    WebviewUrl::External(GAME_URL.parse().expect("valid game URL"))
}

fn is_game_url(url: &tauri::Url) -> bool {
    let base = tauri::Url::parse(GAME_URL).expect("valid game URL");
    url.origin() == base.origin() && url.username().is_empty() && url.password().is_none()
}

fn open_external(app: &AppHandle, url: &tauri::Url) {
    // Never dispatch arbitrary file:, javascript: or custom executable protocols.
    if matches!(url.scheme(), "https" | "http" | "mailto") {
        if let Err(error) = app.opener().open_url(url.as_str(), None::<&str>) {
            eprintln!("Cannot open external link: {error}");
        }
    }
}

fn restore(app: &AppHandle) {
    if let Some(window) = app.get_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
        if let Some(game) = app.get_webview("game") {
            let _ = game.set_focus();
        }
    }
}

fn layout(window: &Window) -> tauri::Result<()> {
    let scale = window.scale_factor()?;
    let size = window.inner_size()?.to_logical::<f64>(scale);
    if size.width <= 0.0 || size.height <= 0.0 {
        return Ok(());
    }
    let fullscreen = window.is_fullscreen()?;
    let top = if fullscreen { 0.0 } else { TITLE_HEIGHT };
    if let Some(chrome) = window.app_handle().get_webview("chrome") {
        chrome.set_size(LogicalSize::new(size.width, TITLE_HEIGHT))?;
        if fullscreen {
            chrome.hide()?;
        } else {
            chrome.show()?;
        }
    }
    if let Some(game) = window.app_handle().get_webview("game") {
        game.set_position(LogicalPosition::new(0.0, top))?;
        game.set_size(LogicalSize::new(size.width, (size.height - top).max(1.0)))?;
    }
    Ok(())
}

fn quit(app: &AppHandle) {
    window_state::save(app);
    app.exit(0);
}

fn game_control(app: &AppHandle, action: &str) -> Result<(), String> {
    let window = app.get_window("main").ok_or("Window unavailable")?;
    let game = app.get_webview("game").ok_or("Game unavailable")?;
    let result = match action {
        "reload" => game.reload(),
        "fullscreen" => window.is_fullscreen().and_then(|full| {
            if !full {
                window_state::record(&window);
            }
            app.state::<window_state::WindowState>()
                .fullscreen
                .store(!full, std::sync::atomic::Ordering::SeqCst);
            window.set_fullscreen(!full)?;
            layout(&window)
        }),
        "devtools" => {
            game.open_devtools();
            Ok(())
        }
        "quit" => {
            quit(app);
            Ok(())
        }
        _ => return Err("Unsupported game action".into()),
    };
    result.map_err(|error| error.to_string())
}

#[tauri::command]
async fn game_action(app: AppHandle, webview: Webview, action: String) -> Result<(), String> {
    if webview.label() != "game" || !is_game_url(&webview.url().map_err(|e| e.to_string())?) {
        return Err("Untrusted game caller".into());
    }
    game_control(&app, &action)
}

#[tauri::command]
async fn chrome_action(app: AppHandle, webview: Webview, action: String) -> Result<(), String> {
    if webview.label() != "chrome" {
        return Err("Local title bar only".into());
    }
    let window = webview.window();
    let result = match action.as_str() {
        "minimize" => window.minimize(),
        "maximize" => window.is_maximized().and_then(|max| {
            if max {
                window.unmaximize()
            } else {
                window.maximize()
            }
        }),
        "drag" => window.start_dragging(),
        "hide" => {
            window_state::save(&app);
            window.hide()
        }
        _ => return game_control(&app, &action),
    };
    result.map_err(|error| error.to_string())
}

fn main() {
    let started = Instant::now();
    tauri::Builder::default()
        // Must be first: a second process must never build a second window/tray.
        .plugin(tauri_plugin_single_instance::init(|app, _, _| restore(app)))
        .plugin(
            tauri_plugin_opener::Builder::new()
                .open_js_links_on_click(false)
                .build(),
        )
        .manage(Startup(started, std::sync::atomic::AtomicBool::new(false)))
        .manage(window_state::WindowState::default())
        .invoke_handler(tauri::generate_handler![chrome_action, game_action])
        .setup(|app| {
            let origin = tauri::Url::parse(GAME_URL)?.origin().ascii_serialization();
            // Scope permissions by WEBVIEW, not window: the remote game shares
            // a native window with chrome but must not inherit its capabilities.
            app.add_capability(
                serde_json::json!({
                    "identifier": "local-chrome", "webviews": ["chrome"],
                    "permissions": ["allow-chrome-action"]
                })
                .to_string(),
            )?;
            app.add_capability(
                serde_json::json!({
                    "identifier": "remote-shortcuts", "local": false,
                    "remote": { "urls": [format!("{origin}/*")] },
                    "webviews": ["game"], "permissions": ["allow-game-action"]
                })
                .to_string(),
            )?;

            let window = WindowBuilder::new(app, "main")
                .title("Fractal Arena")
                .inner_size(1280.0, 800.0)
                .min_inner_size(960.0, 600.0)
                .decorations(false)
                .resizable(true)
                .center()
                .visible(false)
                .build()?;
            window_state::restore(&window)?;
            let size = window
                .inner_size()?
                .to_logical::<f64>(window.scale_factor()?);
            window.add_child(
                WebviewBuilder::new("chrome", WebviewUrl::App("index.html".into()))
                    .zoom_hotkeys_enabled(false)
                    .on_navigation(|url| {
                        matches!(url.host_str(), Some("tauri.localhost")) || url.scheme() == "tauri"
                    }),
                LogicalPosition::new(0.0, 0.0),
                LogicalSize::new(size.width, TITLE_HEIGHT),
            )?;
            let navigation_app = app.handle().clone();
            let popup_app = app.handle().clone();
            let script = format!(
                "{}\n{}",
                include_str!("../../ui/shortcuts.js"),
                include_str!("game-init.js")
                    .replace("__GAME_ORIGIN__", &serde_json::to_string(&origin)?)
            );
            window.add_child(
                WebviewBuilder::new("game", game_source())
                    .devtools(true)
                    .disable_drag_drop_handler()
                    .initialization_script(script)
                    .on_navigation(move |url| {
                        if is_game_url(url) {
                            true
                        } else {
                            open_external(&navigation_app, url);
                            false
                        }
                    })
                    .on_new_window(move |url, _| {
                        open_external(&popup_app, &url);
                        NewWindowResponse::Deny
                    })
                    .on_page_load(|view, payload| {
                        if payload.event() == PageLoadEvent::Finished && is_game_url(payload.url())
                        {
                            let app = view.app_handle();
                            let startup = app.state::<Startup>();
                            if startup.1.swap(true, std::sync::atomic::Ordering::SeqCst) {
                                return;
                            }
                            let elapsed = startup.0.elapsed().as_millis();
                            if let Ok(dir) = app.path().app_log_dir() {
                                let _ = fs::create_dir_all(&dir);
                                let _ = fs::write(
                                    dir.join("startup.txt"),
                                    format!("game_page_load_ms={elapsed}\n"),
                                );
                            }
                        }
                    }),
                LogicalPosition::new(0.0, TITLE_HEIGHT),
                LogicalSize::new(size.width, (size.height - TITLE_HEIGHT).max(1.0)),
            )?;
            let open = MenuItem::with_id(app, "open", "Ouvrir Fractal Arena", true, None::<&str>)?;
            let hide = MenuItem::with_id(app, "hide", "Réduire dans la barre", true, None::<&str>)?;
            let separator = PredefinedMenuItem::separator(app)?;
            let exit = MenuItem::with_id(app, "quit", "Quitter", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open, &hide, &separator, &exit])?;
            TrayIconBuilder::with_id("main-tray")
                .icon(app.default_window_icon().expect("bundled icon").clone())
                .tooltip("Fractal Arena")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => restore(app),
                    "hide" => {
                        if let Some(w) = app.get_window("main") {
                            let _ = w.hide();
                        }
                    }
                    "quit" => quit(app),
                    _ => (),
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(w) = app.get_window("main") {
                            if w.is_visible().unwrap_or(false) && !w.is_minimized().unwrap_or(false)
                            {
                                let _ = w.hide();
                            } else {
                                restore(app);
                            }
                        }
                    }
                })
                .build(app)?;
            layout(&window)?;
            window.show()?;
            window.set_focus()?;
            if let Some(game) = app.get_webview("game") {
                game.set_focus()?;
            }
            Ok(())
        })
        .on_window_event(|window, event| match event {
            tauri::WindowEvent::Resized(_) | tauri::WindowEvent::ScaleFactorChanged { .. } => {
                let _ = layout(window);
                window_state::record(window);
            }
            tauri::WindowEvent::Moved(_) => window_state::record(window),
            tauri::WindowEvent::CloseRequested { .. } => quit(window.app_handle()),
            _ => (),
        })
        .run(tauri::generate_context!())
        .expect("Fractal Arena desktop failed to start");
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn only_exact_game_origin_is_embedded() {
        for path in ["/", "/?lang=fr", "/earn/#rules"] {
            assert!(is_game_url(&format!("{GAME_URL}{path}").parse().unwrap()));
        }
        for url in [
            "http://fractalarena.com",
            "https://fractalarena.com.evil.test",
            "https://evil.test",
            "https://fractalarena.com:444",
            "file:///C:/Windows",
            "https://user@fractalarena.com",
        ] {
            assert!(!is_game_url(&url.parse().unwrap()), "{url}");
        }
    }
}
