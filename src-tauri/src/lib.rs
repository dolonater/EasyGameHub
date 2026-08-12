use std::sync::{Arc, Mutex};

use core::backup::BackupQueue;
use core::process::ProcessManager;
use core::scheduler::Scheduler;
use core::watcher::{FileWatcher, WatchedGame, WatcherConfig};
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::Emitter;
use tauri::Manager;

mod commands;
mod core;
mod steam_helper;
mod traits;

/// Application shared state
pub struct AppState {
    pub tool_dir: std::path::PathBuf,
    pub config_path: std::path::PathBuf,
    pub db_path: std::path::PathBuf,
    pub games_index_path: std::path::PathBuf,
    pub custom_games_path: std::path::PathBuf,
    pub user_games_path: std::path::PathBuf,
    pub themes_path: std::path::PathBuf,
    pub view_settings_path: std::path::PathBuf,
    pub background_thumbnails_dir: std::path::PathBuf,
    pub background_runtime_dir: std::path::PathBuf,
    pub backup_root: std::path::PathBuf,
    pub plugins_dir: std::path::PathBuf,
    pub plugins_registry_path: std::path::PathBuf,
    pub backup_queue: BackupQueue,
    pub watcher: Arc<Mutex<FileWatcher>>,
    pub scheduler: Arc<Mutex<Scheduler>>,
    pub process_manager: ProcessManager,
}

fn cli_switch_steam_account_request() -> Option<String> {
    let mut args = std::env::args().skip(1);
    while let Some(arg) = args.next() {
        if arg == "--switch-steam-account" {
            return args.next();
        }
    }
    None
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    if let Some(request) = steam_helper::cli_steam_achievements_helper_request() {
        if let Err(error) = steam_helper::run_steam_achievements_helper(request) {
            eprintln!("{}", error);
            std::process::exit(1);
        }
        return;
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .setup(|app| {
            #[cfg(debug_assertions)]
            let (data_dir, resource_dir) = {
                let manifest = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"));
                let project_root = manifest.parent().unwrap().to_path_buf();
                let defaults_dir = project_root.join("resources").join("defaults");
                (project_root, defaults_dir)
            };
            #[cfg(not(debug_assertions))]
            let (data_dir, resource_dir) = {
                let data_dir = app
                    .path()
                    .app_data_dir()
                    .unwrap_or_else(|_| std::env::current_dir().unwrap());
                let resource_dir = app
                    .path()
                    .resource_dir()
                    .unwrap_or_else(|_| std::env::current_dir().unwrap());
                (data_dir, resource_dir)
            };

            let runtime_paths = core::paths::initialize_runtime_paths(&data_dir, &resource_dir)?;

            let backup_queue = BackupQueue::new(2);
            let tool_dir = runtime_paths.data_dir.clone();
            let backup_root = runtime_paths.backup_root.clone();
            let config_path = runtime_paths.config_path.clone();
            let db_path = runtime_paths.db_path.clone();
            let games_index_path = runtime_paths.games_index_path.clone();
            let custom_games_path = runtime_paths.custom_games_path.clone();
            let user_games_path = runtime_paths.user_games_path.clone();
            let themes_path = runtime_paths.themes_path.clone();
            let view_settings_path = runtime_paths.view_settings_path.clone();
            let background_thumbnails_dir = runtime_paths.background_thumbnails_dir.clone();
            let background_runtime_dir = runtime_paths.background_runtime_dir.clone();
            let plugins_dir = tool_dir.join("plugins");
            let plugins_registry_path = plugins_dir.join("plugins_registry.json");
            std::fs::create_dir_all(&plugins_dir)?;
            core::plugins::sync_builtin_plugins(
                &resource_dir.join("plugins"),
                &plugins_dir,
                &plugins_registry_path,
            )?;

            // Build/load game index once at startup
            let _ = core::db::load_game_index(&db_path, &games_index_path);

            // Bridge backup queue events to Tauri events (event name preserved:
            // backup:started / backup:completed / backup:failed / backup:queue_changed)
            let app_handle = app.handle().clone();
            backup_queue.set_event_callback(std::sync::Arc::new(
                move |event, game_id, game_name, snap, err| {
                    let payload = serde_json::json!({
                        "event": event,
                        "game_id": game_id,
                        "game_name": game_name,
                        "snapshot": snap,
                        "error": err,
                    });
                    let _ = app_handle.emit(event, &payload);
                },
            ));

            // ── File watcher ──
            let watcher = Arc::new(Mutex::new(FileWatcher::new(WatcherConfig::default())));
            let watcher_for_scheduler = Arc::clone(&watcher);

            // ── Scheduler ──
            let scheduler = Arc::new(Mutex::new(Scheduler::new()));
            scheduler.lock().unwrap().set_watcher(watcher_for_scheduler);

            // Wire watcher trigger → backup queue
            let bq_for_watcher = Arc::new(Mutex::new(backup_queue.clone()));
            let backup_root_for_w = backup_root.clone();
            watcher
                .lock()
                .unwrap()
                .set_trigger(Arc::new(move |id, name, save_path| {
                    let bq = bq_for_watcher.lock().unwrap();
                    bq.enqueue(core::backup::BackupTask {
                        game_name: name.to_string(),
                        save_dir: save_path.clone(),
                        backup_root: backup_root_for_w.clone(),
                        note: Some("auto".into()),
                        game_id: id.to_string(),
                    });
                }));

            // Wire scheduler periodic backup → same backup queue
            let bq_for_sched = Arc::new(Mutex::new(backup_queue.clone()));
            let backup_root_for_s = backup_root.clone();
            scheduler
                .lock()
                .unwrap()
                .set_backup_cb(Arc::new(move |_id, name, save_path| {
                    let bq = bq_for_sched.lock().unwrap();
                    bq.enqueue(core::backup::BackupTask {
                        game_name: name.to_string(),
                        save_dir: save_path.clone(),
                        backup_root: backup_root_for_s.clone(),
                        note: Some("periodic".into()),
                        game_id: _id.to_string(),
                    });
                }));

            // ── Process manager ──
            let mut process_manager = ProcessManager::new();

            // Wire game exit → record playtime + auto-backup
            let up_for_pm = user_games_path.clone();
            let db_exit = db_path.clone();
            let idx_exit = games_index_path.clone();
            let bq_for_pm = Arc::new(Mutex::new(backup_queue.clone()));
            let br_for_pm = backup_root.clone();
            let cfg_path_for_pm = config_path.clone();
            process_manager.set_exit_callback(Arc::new(move |game_id, game_name, duration| {
                // Record play session
                if let Ok(mut ug) = core::db::load_user_games(&up_for_pm) {
                    ug.record_session(core::db::PlaySession {
                        game_id: game_id.to_string(),
                        start_time: chrono::Local::now().format("%Y-%m-%dT%H:%M:%S").to_string(),
                        end_time: Some(
                            chrono::Local::now().format("%Y-%m-%dT%H:%M:%S").to_string(),
                        ),
                        duration_seconds: Some(duration),
                    });
                    let _ = core::db::save_user_games(&up_for_pm, &ug);
                }

                // Auto-backup on exit if enabled
                if let Ok(cfg) = core::config::load_config(&cfg_path_for_pm) {
                    if cfg.auto_backup_on_game_exit {
                        if let Ok(index) = core::db::load_game_index(&db_exit, &idx_exit) {
                            if let Some(entry) = core::db::lookup_game(&index, game_id) {
                                let resolved = core::db::resolve_save_path(&entry.save_path);
                                let save_dir = std::path::PathBuf::from(&resolved);
                                if save_dir.exists() {
                                    let bq = bq_for_pm.lock().unwrap();
                                    bq.enqueue(core::backup::BackupTask {
                                        game_name: game_name.to_string(),
                                        save_dir,
                                        backup_root: br_for_pm.clone(),
                                        note: Some("game_exit".into()),
                                        game_id: game_id.to_string(),
                                    });
                                }
                            }
                        }
                    }
                }
            }));

            process_manager.start_monitor();

            // ── Sync Steam playtime at startup (background) ──
            let db_path_for_sync = db_path.clone();
            let index_path_for_sync = games_index_path.clone();
            let ug_path_for_sync = user_games_path.clone();
            std::thread::spawn(move || {
                if let Ok(steam_data) = core::steam_sync::parse_steam_playtime() {
                    if steam_data.is_empty() {
                        return;
                    }
                    if let Ok(index) =
                        core::db::load_game_index(&db_path_for_sync, &index_path_for_sync)
                    {
                        if let Ok(mut ug) = core::db::load_user_games(&ug_path_for_sync) {
                            for (game_id, entry) in &index.entries {
                                if let Some(sid) = entry.steam_app_id {
                                    if let Some(&secs) = steam_data.get(&sid) {
                                        if let Some(existing) = ug
                                            .total_playtime
                                            .iter_mut()
                                            .find(|(id, _)| id == game_id)
                                        {
                                            existing.1 = secs;
                                        } else {
                                            ug.total_playtime.push((game_id.clone(), secs));
                                        }
                                    }
                                }
                            }
                            let _ = core::db::save_user_games(&ug_path_for_sync, &ug);
                        }
                    }
                }
            });

            // Start scheduler + watcher if auto_backup is enabled
            {
                let cfg = core::config::load_config(&config_path).unwrap_or_default();
                if cfg.auto_backup {
                    let game_entries = load_watched_games(
                        &db_path,
                        &games_index_path,
                        &custom_games_path,
                        &user_games_path,
                        &backup_root,
                    );
                    if !game_entries.is_empty() {
                        watcher.lock().unwrap().update_config(WatcherConfig {
                            debounce_seconds: cfg.debounce_seconds,
                            min_interval_minutes: cfg.min_interval_minutes,
                        });
                        let _ = watcher.lock().unwrap().start(game_entries.clone());
                        scheduler.lock().unwrap().update_games(game_entries);
                        scheduler.lock().unwrap().set_periodic_minutes(0); // no periodic by default
                        scheduler
                            .lock()
                            .unwrap()
                            .set_daily_time(cfg.daily_backup_time.clone());
                        scheduler.lock().unwrap().start();
                    }
                }
            }

            // ── Tray icon ──
            let show_item = MenuItemBuilder::with_id("show", "Show Window").build(app)?;
            let quit_item = MenuItemBuilder::with_id("quit", "Quit").build(app)?;
            let tray_menu = MenuBuilder::new(app)
                .item(&show_item)
                .item(&quit_item)
                .build()?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("EasyGameHub")
                .menu(&tray_menu)
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            // ── Window close → hide to tray ──
            let window = app.get_webview_window("main").unwrap();
            let window_clone = window.clone();
            window.on_window_event(move |event| {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = window_clone.hide();
                }
            });

            let state = AppState {
                config_path,
                db_path,
                games_index_path,
                custom_games_path,
                user_games_path,
                themes_path,
                view_settings_path,
                background_thumbnails_dir,
                background_runtime_dir,
                backup_root,
                tool_dir,
                plugins_dir,
                plugins_registry_path,
                backup_queue,
                watcher,
                scheduler,
                process_manager,
            };

            app.manage(state);

            // Background social poller: drains the live CM connection's message
            // buffers once a second, writes them through to the social cache and
            // emits social:chat / social:group events (event-driven chat push).
            commands::steam_social::start_social_poller(&app.handle());

            if let Some(steam_id64) = cli_switch_steam_account_request() {
                let _ = commands::steam_account::switch_steam_account(steam_id64);
                app.handle().exit(0);
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::config::get_config,
            commands::config::update_config,
            commands::config::get_system_fonts,
            commands::config::get_stats,
            commands::config::check_db_update,
            commands::config::apply_db_update,
            commands::config::get_auto_start,
            commands::config::set_auto_start,
            commands::themes::get_themes_data,
            commands::themes::save_themes_data,
            commands::themes::reset_preset_themes,
            commands::themes::read_theme_file,
            commands::themes::write_theme_file,
            commands::view_settings::get_view_settings_data,
            commands::view_settings::save_view_settings_data,
            commands::view_settings::reset_builtin_view_settings_presets,
            commands::view_settings::read_view_settings_file,
            commands::view_settings::write_view_settings_file,
            commands::games::scan_installed_games,
            commands::games::add_game,
            commands::games::remove_game,
            commands::games::get_games,
            commands::games::get_available_games,
            commands::games::pin_game,
            commands::games::unpin_game,
            commands::games::update_game_path,
            commands::games::open_in_explorer,
            commands::games::set_game_auto_backup,
            commands::backup::backup_now,
            commands::backup::get_snapshots,
            commands::backup::delete_snapshot,
            commands::backup::edit_note,
            commands::backup::batch_backup,
            commands::backup::batch_restore,
            commands::backup::batch_delete_snapshots,
            commands::backup::start_watcher,
            commands::backup::stop_watcher,
            commands::backup::set_periodic_backup,
            commands::backup::set_daily_backup_time,
            commands::backup::list_zip_contents,
            commands::backup::read_zip_file,
            commands::process::launch_game,
            commands::process::stop_game,
            commands::process::get_running_games,
            commands::process::get_playtime,
            commands::process::set_launch_config,
            commands::process::get_launch_config,
            commands::process::set_process_check_interval,
            commands::process::sync_steam_playtime,
            commands::process::get_playtime_stats,
            commands::screenshots::get_screenshots,
            commands::screenshots::delete_screenshot,
            commands::screenshots::add_screenshot_dir,
            commands::screenshots::get_screenshot_counts,
            commands::games::toggle_favorite,
            commands::games::get_favorites,
            commands::games::set_game_tags,
            commands::games::get_all_tags,
            commands::games::get_game_tags,
            commands::games::find_steam_exe_path,
            commands::games::get_game_by_id,
            commands::games::get_game_profile,
            commands::restore::restore_snapshot,
            commands::steam_account::get_steam_accounts,
            commands::steam_account::switch_steam_account,
            commands::steam_account::switch_steam_account_with_options,
            commands::steam_account::get_current_steam_user,
            commands::steam_account::set_steam_account_remark,
            commands::steam_account::get_steam_account_userdata_path,
            commands::steam_account::open_steam_account_userdata_folder,
            commands::steam_account::delete_steam_account_data,
            commands::steam_account::create_steam_account_shortcut,
            commands::steam_account::check_steam_status,
            commands::steam_api::get_local_steam_games,
            commands::steam_api::get_steam_inventory,
            commands::steam_api::get_recently_played,
            commands::steam_api::get_game_achievements_summary,
            commands::steam_api::get_game_achievements,
            commands::steam_api::get_library_stats,
            commands::steam_api::get_library_completion,
            commands::steam_cloud::get_local_cloud_files,
            commands::steam_cloud::get_local_cloud_quota,
            commands::steam_cloud::get_local_cloud_entries,
            commands::steam_cloud::read_local_cloud_file,
            commands::steam_cloud::write_local_cloud_file,
            commands::steam_cloud::delete_local_cloud_file,
            commands::steam_api::get_steam_user_info,
            commands::steam_api::set_steam_api_key,
            commands::steam_community::get_game_news,
            commands::steam_community::get_news_feed,
            commands::steam_community::get_manual_watchlist,
            commands::steam_community::add_manual_watch,
            commands::steam_community::remove_manual_watch,
            commands::steam_community::get_steam_wishlist,
            commands::steam_community::get_steam_prices,
            commands::steam_community::get_steam_metadata,
            commands::steam_community::search_steam_games,
            commands::steam_community::set_price_threshold,
            commands::steam_community::get_price_thresholds,
            commands::steam_community::get_price_drop_events,
            commands::steam_community::get_news_article,
            commands::steam_community::get_store_detail,
            commands::steam_community::get_multi_region_price,
            commands::authenticator::get_auth_entries,
            commands::authenticator::add_auth_entry,
            commands::authenticator::delete_auth_entry,
            commands::authenticator::import_from_uri,
            commands::authenticator::import_mafile,
            commands::steam_guard::get_pending_confirmations,
            commands::steam_guard::respond_confirmation,
            commands::steam_guard::export_mafile,
            commands::steam_guard::save_mafile,
            commands::steam_social::load_friends,
            commands::steam_social::refresh_friends,
            commands::steam_social::get_friend_profile,
            commands::steam_social::send_chat_message,
            commands::steam_social::open_chat,
            commands::steam_social::refresh_chat,
            commands::steam_social::load_sessions,
            commands::steam_social::refresh_sessions,
            commands::steam_social::load_groups,
            commands::steam_social::refresh_groups,
            commands::steam_social::open_group_chat,
            commands::steam_social::refresh_group_chat,
            commands::steam_social::send_group_message,
            commands::steam_social::upload_chat_image,
            commands::steam_social::upload_group_image,
            commands::steam_social::get_sticker_catalog,
            commands::steam_social::send_sticker_message,
            commands::steam_social::set_active_thread,
            commands::steam_social::open_chat_window,
            commands::steam_social::get_chat_window_params,
            commands::steam_social::poll_thread,
            commands::steam_notifications::get_notifications,
            commands::steam_notifications::mark_notifications_read,
            commands::files::write_binary_file,
            commands::steam_auth::login_step1,
            commands::steam_auth::login_poll,
            commands::steam_auth::login_submit_guard,
            commands::steam_auth::login_begin_qr,
            commands::steam_auth::get_active_session,
            commands::steam_auth::logout,
            commands::steam_api::open_url,
            commands::steam_api::toggle_hide_game,
            commands::steam_api::edit_steam_game_info,
            commands::steam_api::get_custom_game_names,
            commands::steam_api::open_steam_cloud_manager,
            commands::steam_api::get_game_save_files,
            commands::steam_api::set_game_cover_image,
            commands::steam_api::register_download,
            commands::steam_api::start_steam_install,
            commands::steam_api::get_downloading_games,
            commands::window::toggle_fullscreen,
            commands::window::maximize_window,
            commands::window::unmaximize_window,
            commands::window::is_maximized,
            commands::window::minimize_window,
            commands::plugins::install_plugin,
            commands::plugins::uninstall_plugin,
            commands::plugins::get_plugin_registry,
            commands::plugins::save_plugin_registry,
            commands::plugins::read_plugin_config,
            commands::plugins::write_plugin_config,
            commands::bilibili::bilibili_ping,
            commands::bilibili::bilibili_login_qr_key,
            commands::bilibili::bilibili_login_qr_check,
            commands::bilibili::bilibili_login_status,
            commands::bilibili::bilibili_logout,
            commands::bilibili::bilibili_search_videos,
            commands::bilibili::bilibili_popular_videos,
            commands::bilibili::bilibili_recommend_videos,
            commands::bilibili::bilibili_video_detail,
            commands::bilibili::bilibili_related_videos,
            commands::bilibili::bilibili_proxy_port,
            commands::bilibili::bilibili_create_playback,
            commands::bilibili::bilibili_save_local_progress,
            commands::bilibili::bilibili_load_local_progress,
            commands::bilibili::bilibili_report_progress,
            commands::bilibili::bilibili_open_video,
            commands::bilibili::bilibili_save_screenshot,
            commands::bilibili::bilibili_open_screenshot_folder,
            commands::bilibili::bilibili_danmaku_list,
            commands::bilibili::bilibili_danmaku_segment,
            commands::bilibili::bilibili_danmaku_thumbup,
            commands::bilibili::bilibili_danmaku_report,
            commands::bilibili::bilibili_danmaku_recall,
            commands::bilibili::bilibili_send_danmaku,
            commands::bilibili::bilibili_history_list,
            commands::bilibili::bilibili_toview_list,
            commands::bilibili::bilibili_toview_add,
            commands::bilibili::bilibili_toview_remove,
            commands::bilibili::bilibili_favorite_folders,
            commands::bilibili::bilibili_favorite_items,
            commands::bilibili::bilibili_favorite_video,
            commands::bilibili::bilibili_interaction_state,
            commands::bilibili::bilibili_like_video,
            commands::bilibili::bilibili_coin_video,
            commands::bilibili::bilibili_favorite_video_interaction,
            commands::bilibili::bilibili_toview_video_interaction,
            commands::bilibili::bilibili_follow_owner,
            commands::bilibili::bilibili_copy_share_link,
            commands::bilibili::bilibili_open_report,
            commands::bilibili::bilibili_dynamic_all,
            commands::bilibili::bilibili_dynamic_detail,
            commands::bilibili::bilibili_dynamic_like,
            commands::bilibili::bilibili_dynamic_create_text,
            commands::bilibili::bilibili_dynamic_top,
            commands::bilibili::bilibili_dynamic_forwards,
            commands::bilibili::bilibili_comment_list,
            commands::bilibili::bilibili_comment_replies,
            commands::bilibili::bilibili_comment_add,
            commands::bilibili::bilibili_comment_like,
            commands::bilibili::bilibili_comment_dislike,
            commands::bilibili::bilibili_comment_delete,
            commands::bilibili::bilibili_comment_top,
            commands::bilibili::bilibili_comment_report,
            commands::bilibili::bilibili_clear_cache,
            commands::bilibili::bilibili_ranking_videos,
            commands::bilibili::bilibili_weekly_series_list,
            commands::bilibili::bilibili_weekly_series_one,
            commands::bilibili::bilibili_precious_videos,
            commands::bilibili::bilibili_search_suggest,
            commands::bilibili::bilibili_search_hotwords,
            commands::bilibili::bilibili_fav_folder_create,
            commands::bilibili::bilibili_fav_folder_edit,
            commands::bilibili::bilibili_fav_folder_delete,
            commands::bilibili::bilibili_fav_resource_delete,
            commands::bilibili::bilibili_fav_resource_move,
            commands::bilibili::bilibili_fav_resource_copy,
            commands::bilibili::bilibili_fav_resource_clean,
            commands::bilibili::bilibili_user_space,
            commands::bilibili::bilibili_user_videos,
            commands::bilibili::bilibili_user_follow,
            commands::bilibili::bilibili_season_detail,
            commands::bilibili::bilibili_season_follow,
            commands::bilibili::bilibili_pgc_tabs,
            commands::bilibili::bilibili_pgc_rank,
            commands::bilibili::bilibili_bangumi_follow_list,
            commands::music::music_open_login_window,
            commands::music::music_login_qr_key,
            commands::music::music_login_qr_check,
            commands::music::music_login_send_captcha,
            commands::music::music_login_cellphone,
            commands::music::music_login_status,
            commands::music::music_logout,
            commands::music::music_search,
            commands::music::music_user_playlists,
            commands::music::music_likelist,
            commands::music::music_like,
            commands::music::music_playlist_subscribe,
            commands::music::music_recommend_songs,
            commands::music::music_toplists,
            commands::music::music_personalized_playlists,
            commands::music::music_playlist_search,
            commands::music::music_album_search,
            commands::music::music_artist_search,
            commands::music::music_album_songs,
            commands::music::music_artist_songs,
            commands::music::music_playlist_tracks,
            commands::music::music_playlist_tracks_range,
            commands::music::music_song_url,
            commands::music::music_lyric,
            commands::music::music_proxy_port,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/// Helper: load all monitored games as WatchedGame entries (uses index for O(1) lookups).
pub fn load_watched_games(
    db_path: &std::path::Path,
    index_path: &std::path::Path,
    custom_path: &std::path::Path,
    user_path: &std::path::Path,
    _backup_root: &std::path::Path,
) -> Vec<WatchedGame> {
    let mut results = vec![];

    let index = core::db::load_game_index(db_path, index_path).ok();
    let custom = core::db::load_custom_games(custom_path).ok();
    let user_games = core::db::load_user_games(user_path).ok();

    if let (Some(index), Some(ug)) = (&index, &user_games) {
        for gid in &ug.monitored {
            if ug.auto_backup.iter().any(|a| a == gid) {
                if let Some(entry) = core::db::lookup_game(index, gid) {
                    let effective_path = ug
                        .get_path_override(gid)
                        .map(|s| s.to_string())
                        .unwrap_or_else(|| entry.save_path.clone());
                    let resolved = core::db::resolve_save_path(&effective_path);
                    results.push(WatchedGame {
                        id: gid.clone(),
                        name: entry.name.clone(),
                        save_path: std::path::PathBuf::from(resolved),
                    });
                }
            }
        }
    }

    if let (Some(cg), Some(ug)) = (&custom, &user_games) {
        for entry in &cg.games {
            if !ug.auto_backup.iter().any(|a| a == &entry.id) {
                continue;
            }
            let resolved = core::db::resolve_save_path(&entry.save_path);
            results.push(WatchedGame {
                id: entry.id.clone(),
                name: entry.name.clone(),
                save_path: std::path::PathBuf::from(resolved),
            });
        }
    }

    results
}
