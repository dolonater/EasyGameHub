//! Background scheduler: ticks the file watcher and runs periodic backups.

use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};
use std::thread;
use std::time::Duration;

use crate::core::watcher::FileWatcher;

/// Callback for scheduled backup: (game_id, game_name, save_path)
pub type ScheduledBackupCb = Arc<dyn Fn(&str, &str, &std::path::PathBuf) + Send + Sync>;

struct SchedulerState {
    watcher: Option<Arc<Mutex<FileWatcher>>>,
    running: Arc<AtomicBool>,
    periodic_minutes: u64,
    last_periodic: std::time::Instant,
    daily_time: Option<String>, // "HH:MM"
    last_daily_date: String,    // "YYYY-MM-DD"
    on_backup: Option<ScheduledBackupCb>,
    games_snapshot: Vec<crate::core::watcher::WatchedGame>,
}

/// The background scheduler.
pub struct Scheduler {
    state: Arc<Mutex<SchedulerState>>,
    thread_handle: Option<thread::JoinHandle<()>>,
}

impl Scheduler {
    pub fn new() -> Self {
        Self {
            state: Arc::new(Mutex::new(SchedulerState {
                watcher: None,
                running: Arc::new(AtomicBool::new(false)),
                periodic_minutes: 0,
                last_periodic: std::time::Instant::now(),
                daily_time: None,
                last_daily_date: String::new(),
                on_backup: None,
                games_snapshot: vec![],
            })),
            thread_handle: None,
        }
    }

    /// Set the file watcher reference.
    pub fn set_watcher(&self, watcher: Arc<Mutex<FileWatcher>>) {
        self.state.lock().unwrap().watcher = Some(watcher);
    }

    /// Set periodic backup interval (0 = disabled). Resets the timer.
    pub fn set_periodic_minutes(&self, minutes: u64) {
        let mut s = self.state.lock().unwrap();
        s.periodic_minutes = minutes;
        s.last_periodic = std::time::Instant::now();
    }

    /// Set daily backup time ("HH:MM" or None to disable).
    pub fn set_daily_time(&self, time: Option<String>) {
        self.state.lock().unwrap().daily_time = time;
    }

    /// Update games snapshot for periodic backups.
    pub fn update_games(&self, games: Vec<crate::core::watcher::WatchedGame>) {
        self.state.lock().unwrap().games_snapshot = games;
    }

    /// Set backup callback.
    pub fn set_backup_cb(&self, cb: ScheduledBackupCb) {
        self.state.lock().unwrap().on_backup = Some(cb);
    }

    /// Start the background tick thread.
    pub fn start(&mut self) {
        let state = Arc::clone(&self.state);

        {
            let s = state.lock().unwrap();
            s.running.store(true, Ordering::SeqCst);
        }

        let running = {
            let s = state.lock().unwrap();
            s.running.clone()
        };

        let handle = thread::spawn(move || {
            while running.load(Ordering::SeqCst) {
                thread::sleep(Duration::from_secs(2));

                let (watcher, periodic_mins, games, maybe_cb, should_trigger, should_daily) = {
                    let mut s = state.lock().unwrap();
                    let trigger = s.periodic_minutes > 0
                        && s.last_periodic.elapsed()
                            >= Duration::from_secs(s.periodic_minutes * 60);
                    if trigger {
                        s.last_periodic = std::time::Instant::now();
                    }
                    // Daily backup check
                    let daily = if let Some(ref dt) = s.daily_time {
                        let now = chrono::Local::now();
                        let today = now.format("%Y-%m-%d").to_string();
                        let current = now.format("%H:%M").to_string();
                        current >= *dt && today != s.last_daily_date
                    } else {
                        false
                    };
                    if daily {
                        s.last_daily_date = chrono::Local::now().format("%Y-%m-%d").to_string();
                    }
                    (
                        s.watcher.clone(),
                        s.periodic_minutes,
                        s.games_snapshot.clone(),
                        s.on_backup.clone(),
                        trigger,
                        daily,
                    )
                };

                // Tick the file watcher
                if let Some(ref w) = watcher {
                    w.lock().unwrap().tick();
                }

                // Periodic or daily backup
                if should_trigger || should_daily {
                    if let Some(ref cb) = maybe_cb {
                        for g in &games {
                            if g.save_path.exists() {
                                cb(&g.id, &g.name, &g.save_path);
                            }
                        }
                    }
                }
            }
        });

        self.thread_handle = Some(handle);
    }

    /// Stop the background thread.
    pub fn stop(&mut self) {
        let running = {
            let s = self.state.lock().unwrap();
            s.running.clone()
        };
        running.store(false, Ordering::SeqCst);

        if let Some(h) = self.thread_handle.take() {
            let _ = h.join();
        }
    }
}
