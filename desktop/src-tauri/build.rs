fn main() {
    tauri_build::try_build(
        tauri_build::Attributes::new().app_manifest(
            tauri_build::AppManifest::new().commands(&["chrome_action", "game_action"]),
        ),
    )
    .expect("failed to build desktop resources");
}
