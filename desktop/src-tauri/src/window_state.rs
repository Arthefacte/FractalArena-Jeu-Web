//! Persist normal geometry independently of webview count, tray visibility and fullscreen.
use serde::{Deserialize, Serialize};
use std::{
    fs,
    sync::{
        atomic::{AtomicBool, Ordering},
        Mutex,
    },
};
use tauri::{AppHandle, LogicalSize, Manager, PhysicalPosition, Window};

#[derive(Clone, Debug, Serialize, Deserialize)]
struct Geometry {
    x: i32,
    y: i32,
    width: f64,
    height: f64,
    maximized: bool,
}
impl Geometry {
    fn valid(&self) -> bool {
        self.width.is_finite()
            && self.height.is_finite()
            && (960.0..=16384.0).contains(&self.width)
            && (600.0..=16384.0).contains(&self.height)
    }
}
#[derive(Default)]
pub struct WindowState {
    geometry: Mutex<Option<Geometry>>,
    pub fullscreen: AtomicBool,
    ready: AtomicBool,
}

pub fn restore(window: &Window) -> Result<(), Box<dyn std::error::Error>> {
    let app = window.app_handle();
    let saved = fs::read(app.path().app_config_dir()?.join("window-state.json"))
        .ok()
        .and_then(|bytes| serde_json::from_slice::<Geometry>(&bytes).ok())
        .filter(Geometry::valid);
    if let Some(saved) = saved {
        // Require a visible title-bar area; a disconnected monitor must not strand the app.
        let visible = window.available_monitors()?.iter().any(|monitor| {
            let p = monitor.position();
            let s = monitor.size();
            i64::from(saved.x) + 160 > i64::from(p.x)
                && i64::from(saved.x) + 160 < i64::from(p.x) + i64::from(s.width)
                && i64::from(saved.y) >= i64::from(p.y)
                && i64::from(saved.y) + 40 < i64::from(p.y) + i64::from(s.height)
        });
        window.set_size(LogicalSize::new(saved.width, saved.height))?;
        if visible {
            window.set_position(PhysicalPosition::new(saved.x, saved.y))?;
        } else {
            window.center()?;
        }
        *app.state::<WindowState>().geometry.lock().unwrap() = Some(saved.clone());
        if saved.maximized {
            window.maximize()?;
        }
    }
    app.state::<WindowState>()
        .ready
        .store(true, Ordering::SeqCst);
    record(window);
    Ok(())
}

pub fn record(window: &Window) {
    let state = window.state::<WindowState>();
    if !state.ready.load(Ordering::SeqCst)
        || state.fullscreen.load(Ordering::SeqCst)
        || window.is_fullscreen().unwrap_or(true)
        || window.is_minimized().unwrap_or(true)
    {
        return;
    }
    let Ok(maximized) = window.is_maximized() else {
        return;
    };
    let mut geometry = state.geometry.lock().unwrap();
    if maximized {
        if let Some(g) = geometry.as_mut() {
            g.maximized = true;
        }
    } else if let (Ok(position), Ok(size), Ok(scale)) = (
        window.outer_position(),
        window.inner_size(),
        window.scale_factor(),
    ) {
        let size = size.to_logical::<f64>(scale);
        let current = Geometry {
            x: position.x,
            y: position.y,
            width: size.width,
            height: size.height,
            maximized,
        };
        if current.valid() {
            *geometry = Some(current);
        }
    }
}

pub fn save(app: &AppHandle) {
    let state = app.state::<WindowState>();
    let geometry = state.geometry.lock().unwrap().clone();
    if let Some(geometry) = geometry {
        let result = (|| -> Result<(), Box<dyn std::error::Error>> {
            let dir = app.path().app_config_dir()?;
            fs::create_dir_all(&dir)?;
            fs::write(
                dir.join("window-state.json"),
                serde_json::to_vec_pretty(&geometry)?,
            )?;
            Ok(())
        })();
        if let Err(error) = result {
            eprintln!("Cannot save window geometry: {error}");
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn corrupted_or_unusable_sizes_are_not_restored() {
        let mut g = Geometry {
            x: -1000,
            y: 20,
            width: 1280.0,
            height: 800.0,
            maximized: false,
        };
        assert!(g.valid());
        for width in [0.0, 959.0, f64::NAN, f64::INFINITY, 20000.0] {
            g.width = width;
            assert!(!g.valid());
        }
    }
}
