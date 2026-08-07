//! Game process management: launch, PID tracking, exit detection, playtime.

use std::collections::HashMap;
use std::process::{Child, Command};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};
use std::thread;
use std::time::Duration;

/// A tracked running game.
struct RunningGame {
    child: Child,
    game_id: String,
    game_name: String,
    start_time: chrono::DateTime<chrono::Local>,
    pid: u32,
}

/// Callback when a game exits: (game_id, game_name, duration_seconds)
pub type GameExitCallback = Arc<dyn Fn(&str, &str, u64) + Send + Sync>;

struct ProcessManagerInner {
    running: HashMap<String, RunningGame>,
    on_exit: Option<GameExitCallback>,
    check_interval_secs: u64,
    running_flag: Arc<AtomicBool>,
}

/// Manages game process lifecycle: launch, monitor, exit detection.
pub struct ProcessManager {
    inner: Arc<Mutex<ProcessManagerInner>>,
    monitor_thread: Option<thread::JoinHandle<()>>,
}

impl ProcessManager {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(Mutex::new(ProcessManagerInner {
                running: HashMap::new(),
                on_exit: None,
                check_interval_secs: 5,
                running_flag: Arc::new(AtomicBool::new(false)),
            })),
            monitor_thread: None,
        }
    }

    /// Set callback for when a game exits.
    pub fn set_exit_callback(&self, cb: GameExitCallback) {
        self.inner.lock().unwrap().on_exit = Some(cb);
    }

    /// Set the process check interval in seconds.
    pub fn set_check_interval(&self, secs: u64) {
        self.inner.lock().unwrap().check_interval_secs = secs.max(1).min(30);
    }

    /// Launch a game by exe path. Returns the PID.
    pub fn launch(
        &self,
        game_id: &str,
        game_name: &str,
        exe_path: &std::path::Path,
        args: Option<&str>,
    ) -> Result<u32, String> {
        let mut cmd = Command::new(exe_path);
        if let Some(a) = args {
            cmd.args(a.split_whitespace());
        }

        let child = cmd
            .spawn()
            .map_err(|e| format!("Failed to launch: {}", e))?;
        let pid = child.id();

        let mut inner = self.inner.lock().unwrap();
        inner.running.insert(
            game_id.to_string(),
            RunningGame {
                child,
                game_id: game_id.to_string(),
                game_name: game_name.to_string(),
                start_time: chrono::Local::now(),
                pid,
            },
        );

        Ok(pid)
    }

    /// Check if a game is currently running.
    pub fn is_running(&self, game_id: &str) -> bool {
        self.inner.lock().unwrap().running.contains_key(game_id)
    }

    /// Get IDs of all currently running games.
    pub fn running_games(&self) -> Vec<String> {
        self.inner.lock().unwrap().running.keys().cloned().collect()
    }

    /// Get PID of a running game, if running.
    pub fn get_pid(&self, game_id: &str) -> Option<u32> {
        self.inner
            .lock()
            .unwrap()
            .running
            .get(game_id)
            .map(|r| r.pid)
    }

    /// Get start time of a running game.
    pub fn get_start_time(&self, game_id: &str) -> Option<String> {
        self.inner
            .lock()
            .unwrap()
            .running
            .get(game_id)
            .map(|r| r.start_time.format("%Y-%m-%dT%H:%M:%S").to_string())
    }

    /// Terminate a running game process.
    pub fn stop(&self, game_id: &str) -> Result<(), String> {
        let mut inner = self.inner.lock().unwrap();
        if let Some(mut rg) = inner.running.remove(game_id) {
            rg.child
                .kill()
                .map_err(|e| format!("Failed to kill: {}", e))?;
        }
        Ok(())
    }

    /// Start the background monitor thread.
    pub fn start_monitor(&mut self) {
        let inner = Arc::clone(&self.inner);
        let running_flag = {
            let mut guard = inner.lock().unwrap();
            guard.running_flag.store(true, Ordering::SeqCst);
            guard.running_flag.clone()
        };

        let handle = thread::spawn(move || {
            while running_flag.load(Ordering::SeqCst) {
                let interval = {
                    let guard = inner.lock().unwrap();
                    guard.check_interval_secs
                };
                thread::sleep(Duration::from_secs(interval));

                let exited: Vec<(String, String, u64)> = {
                    let mut guard = inner.lock().unwrap();
                    let mut completed = Vec::new();
                    let ids: Vec<String> = guard.running.keys().cloned().collect();

                    for gid in ids {
                        let should_remove = {
                            if let Some(rg) = guard.running.get_mut(&gid) {
                                match rg.child.try_wait() {
                                    Ok(Some(_status)) => {
                                        let duration = rg
                                            .start_time
                                            .signed_duration_since(chrono::Local::now())
                                            .num_seconds()
                                            .abs()
                                            as u64;
                                        completed.push((
                                            gid.clone(),
                                            rg.game_name.clone(),
                                            duration,
                                        ));
                                        true
                                    }
                                    Ok(None) => false, // still running
                                    Err(_) => true,    // error → remove
                                }
                            } else {
                                false
                            }
                        };

                        if should_remove {
                            guard.running.remove(&gid);
                        }
                    }

                    completed
                };

                // Notify exit callbacks
                if !exited.is_empty() {
                    let cb = { inner.lock().unwrap().on_exit.clone() };
                    if let Some(ref cb) = cb {
                        for (gid, gname, dur) in &exited {
                            cb(gid, gname, *dur);
                        }
                    }
                }
            }
        });

        self.monitor_thread = Some(handle);
    }

    /// Stop the background monitor thread.
    pub fn stop_monitor(&mut self) {
        {
            let guard = self.inner.lock().unwrap();
            guard.running_flag.store(false, Ordering::SeqCst);
        }
        if let Some(h) = self.monitor_thread.take() {
            let _ = h.join();
        }
    }
}
