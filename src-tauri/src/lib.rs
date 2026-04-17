mod migrations;

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
        .plugin(tauri_plugin_os::init());

    if cfg!(debug_assertions) {
        builder = builder.plugin(
            tauri_plugin_log::Builder::default()
                .level(log::LevelFilter::Info)
                .build(),
        );
    }

    builder
        .setup(|app| {
            use tauri::Manager;

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
