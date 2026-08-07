//! File system watcher using the `notify` crate.

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

/// Configuration for the file watcher.
#[derive(Debug, Clone)]
pub struct WatcherConfig {
    pub debounce_seconds: u64,
    pub min_interval_minutes: u64,
}

impl Default for WatcherConfig {
    fn default() -> Self {
        Self {
            debounce_seconds: 15,
            min_interval_minutes: 10,
        }
    }
}

/// A game being watched.
#[derive(Debug, Clone)]
pub struct WatchedGame {
    pub id: String,
    pub name: String,
    pub save_path: PathBuf,
}

/// Callback when a backup should be triggered: (game_id, game_name, save_path)
pub type BackupTrigger = Arc<dyn Fn(&str, &str, &PathBuf) + Send + Sync>;

struct WatcherState {
    /// Last backup time per game ID (epoch millis).
    last_backup: HashMap<String, Instant>,
    /// Debounce timer per game ID: Instant of last file change.
    last_change: HashMap<String, Instant>,
    /// Whether the watcher is running.
    running: bool,
    /// Config
    config: WatcherConfig,
    /// Games being watched
    games: Vec<WatchedGame>,
    /// Backup trigger callback
    on_trigger: Option<BackupTrigger>,
}

/// The file watcher handle.
pub struct FileWatcher {
    state: Arc<Mutex<WatcherState>>,
    /// Notify watcher handle (stored so it stays alive)
    _notify_watcher: Option<notify::RecommendedWatcher>,
}

impl FileWatcher {
    pub fn new(config: WatcherConfig) -> Self {
        Self {
            state: Arc::new(Mutex::new(WatcherState {
                last_backup: HashMap::new(),
                last_change: HashMap::new(),
                running: false,
                config,
                games: vec![],
                on_trigger: None,
            })),
            _notify_watcher: None,
        }
    }

    pub fn set_trigger(&self, cb: BackupTrigger) {
        self.state.lock().unwrap().on_trigger = Some(cb);
    }

    pub fn update_config(&self, config: WatcherConfig) {
        self.state.lock().unwrap().config = config;
    }

    pub fn is_running(&self) -> bool {
        self.state.lock().unwrap().running
    }

    /// Start watching the given game directories.
    pub fn start(&mut self, games: Vec<WatchedGame>) -> Result<(), anyhow::Error> {
        let mut state = self.state.lock().unwrap();

        // Build list of paths to watch
        let mut paths = vec![];
        for g in &games {
            if g.save_path.exists() {
                paths.push(g.save_path.clone());
            }
        }

        state.games = games;
        state.running = true;

        // Build notify watcher
        let state2 = Arc::clone(&self.state);
        let mut watcher =
            notify::recommended_watcher(move |res: Result<notify::Event, notify::Error>| {
                if let Ok(event) = res {
                    handle_fs_event(&state2, &event);
                }
            })?;

        for p in &paths {
            let _ = notify::Watcher::watch(&mut watcher, p, notify::RecursiveMode::Recursive);
        }

        self._notify_watcher = Some(watcher);
        Ok(())
    }

    /// Stop watching.
    pub fn stop(&mut self) {
        let mut state = self.state.lock().unwrap();
        state.running = false;
        self._notify_watcher = None;
    }

    /// Manually record a backup time for a game (called after backup completes).
    pub fn record_backup(&self, game_id: &str) {
        let mut state = self.state.lock().unwrap();
        state
            .last_backup
            .insert(game_id.to_string(), Instant::now());
    }

    /// Called periodically from the scheduler thread to check debounce timers.
    pub fn tick(&self) {
        let state = self.state.lock().unwrap();
        if !state.running {
            return;
        }

        let now = Instant::now();
        let debounce = Duration::from_secs(state.config.debounce_seconds);
        let min_interval = Duration::from_secs(state.config.min_interval_minutes * 60);

        let mut to_trigger: Vec<(String, String, PathBuf)> = vec![];

        for game in &state.games {
            // Check debounce: has it been long enough since last change?
            let should_trigger = state
                .last_change
                .get(&game.id)
                .map(|t| now.duration_since(*t) >= debounce)
                .unwrap_or(false);

            // Check min interval: has enough time passed since last backup?
            let interval_ok = state
                .last_backup
                .get(&game.id)
                .map(|t| now.duration_since(*t) >= min_interval)
                .unwrap_or(true);

            if should_trigger && interval_ok {
                to_trigger.push((game.id.clone(), game.name.clone(), game.save_path.clone()));
            }
        }

        drop(state);

        // Trigger backups outside the lock
        for (id, name, path) in to_trigger {
            if let Ok(mut state) = self.state.lock() {
                // Clear the change timer so we don't re-trigger
                state.last_change.remove(&id);
                state.last_backup.insert(id.clone(), Instant::now());
                let cb = state.on_trigger.clone();
                drop(state);
                if let Some(ref cb) = cb {
                    cb(&id, &name, &path);
                }
            }
        }
    }
}

fn handle_fs_event(state: &Arc<Mutex<WatcherState>>, event: &notify::Event) {
    use notify::EventKind;
    // Only care about file modifications and creations
    match event.kind {
        EventKind::Create(_) | EventKind::Modify(_) => {}
        _ => return,
    }

    let mut s = state.lock().unwrap();
    if !s.running {
        return;
    }

    let now = Instant::now();
    let event_paths: Vec<PathBuf> = event.paths.clone();

    // Find which game(s) this event belongs to — collect IDs first
    let mut changed_ids: Vec<String> = Vec::new();
    for game in &s.games {
        for ep in &event_paths {
            if ep.starts_with(&game.save_path) {
                changed_ids.push(game.id.clone());
                break;
            }
        }
    }
    for id in changed_ids {
        s.last_change.insert(id, now);
    }
}
