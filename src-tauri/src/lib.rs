mod migrations;

use tauri::{AppHandle, Manager};

/// Borra la base de datos y el directorio de estímulos, luego sale.
/// El usuario reabre la app manualmente; al hacerlo el schema v2 se crea limpio.
///
/// La DB de tauri-plugin-sql vive en `app_config_dir` (NO en `app_data_dir`).
/// Los audios grabados (stimuli/) viven en `app_data_dir` via plugin-fs.
/// Borramos ambos caminos por las dudas.
#[tauri::command]
fn reset_database(app: AppHandle) -> Result<String, String> {
    let mut report = Vec::<String>::new();

    let candidates = [
        app.path().app_config_dir().ok(),
        app.path().app_data_dir().ok(),
        app.path().app_local_data_dir().ok(),
    ];

    for dir_opt in candidates.iter().flatten() {
        let db = dir_opt.join("audiopac.db");
        if db.exists() {
            match std::fs::remove_file(&db) {
                Ok(_) => report.push(format!("rm {}", db.display())),
                Err(e) => report.push(format!("ERR rm {}: {}", db.display(), e)),
            }
        }
        for ext in ["-shm", "-wal"] {
            let sidecar = dir_opt.join(format!("audiopac.db{ext}"));
            if sidecar.exists() {
                let _ = std::fs::remove_file(&sidecar);
                report.push(format!("rm {}", sidecar.display()));
            }
        }
    }

    if let Ok(app_data) = app.path().app_data_dir() {
        let stimuli = app_data.join("stimuli");
        if stimuli.exists() {
            match std::fs::remove_dir_all(&stimuli) {
                Ok(_) => report.push(format!("rmdir {}", stimuli.display())),
                Err(e) => report.push(format!("ERR rmdir {}: {}", stimuli.display(), e)),
            }
        }
    }

    let summary = report.join("\n");
    eprintln!("[reset_database]\n{summary}");

    // En vez de app.restart(): salir limpio. En dev mode el restart no logra
    // reconectar con vite. El user reabre y la migración v2 corre fresca.
    app.exit(0);
    Ok(summary)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = migrations::get_migrations();

    let mut builder = tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:audiopac.db", migrations)
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![reset_database]);

    if cfg!(debug_assertions) {
        builder = builder.plugin(
            tauri_plugin_log::Builder::default()
                .level(log::LevelFilter::Info)
                .build(),
        );
    }

    builder
        .setup(|app| {
            #[cfg(target_os = "linux")]
            {
                use webkit2gtk::{PermissionRequestExt, SettingsExt, WebViewExt};

                for (_, window) in app.webview_windows() {
                    let _ = window.with_webview(|webview| {
                        let wv = webview.inner();
                        if let Some(settings) = WebViewExt::settings(&wv) {
                            settings.set_enable_media_stream(true);
                            settings.set_enable_mediasource(true);
                            settings.set_media_playback_requires_user_gesture(false);
                        }
                        wv.connect_permission_request(|_, request| {
                            request.allow();
                            true
                        });
                    });
                }
            }

            #[cfg(target_os = "windows")]
            {
                use webview2_com::{
                    Microsoft::Web::WebView2::Win32::COREWEBVIEW2_PERMISSION_STATE_ALLOW,
                    PermissionRequestedEventHandler,
                };

                for (_, window) in app.webview_windows() {
                    let _ = window.with_webview(|webview| unsafe {
                        if let Ok(core) = webview.controller().CoreWebView2() {
                            let mut token = Default::default();
                            let handler = PermissionRequestedEventHandler::create(Box::new(
                                |_sender, args| {
                                    if let Some(args) = args {
                                        let _ = args.SetState(COREWEBVIEW2_PERMISSION_STATE_ALLOW);
                                    }
                                    Ok(())
                                },
                            ));
                            let _ = core.add_PermissionRequested(&handler, &mut token);
                        }
                    });
                }
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
