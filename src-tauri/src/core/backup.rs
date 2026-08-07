use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

/// Sanitize a string for use as a filesystem directory/file name.
/// Replaces Windows-illegal characters: < > : " / \\ | ? *
pub fn sanitize_filename(s: &str) -> String {
    s.chars()
        .map(|c| match c {
            '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' => '_',
            _ => c,
        })
        .collect()
}

/// Metadata for a single snapshot.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SnapshotInfo {
    pub game_name: String,
    pub path: String,
    pub timestamp: String,
    pub note: String,
    pub size_bytes: u64,
}

/// Create a ZIP snapshot of `save_dir` and store it under `backup_root/<game_name>/<timestamp>_<note>.zip`.
/// Uses Store (zero compression) for speed.
pub fn create_snapshot(
    game_name: &str,
    save_dir: &Path,
    backup_root: &Path,
    note: Option<&str>,
) -> Result<SnapshotInfo, anyhow::Error> {
    use std::io::Write;

    let timestamp = chrono::Local::now().format("%Y-%m-%d_%H-%M-%S").to_string();
    let note_part = note.unwrap_or("");
    let filename = if note_part.is_empty() {
        format!("{}.zip", timestamp)
    } else {
        format!("{}_{}.zip", timestamp, note_part)
    };

    let game_dir = backup_root.join(sanitize_filename(game_name));
    std::fs::create_dir_all(&game_dir)?;

    let zip_path = game_dir.join(&filename);

    let file = std::fs::File::create(&zip_path)?;
    let mut zip_writer = zip::ZipWriter::new(file);

    let options =
        zip::write::SimpleFileOptions::default().compression_method(zip::CompressionMethod::Stored);

    let save_dir_base = save_dir.parent().unwrap_or(save_dir).to_path_buf();

    let entries = walk_dir(save_dir)?;
    let entries: Vec<_> = entries.into_iter().filter(|p| p.is_file()).collect();

    for entry_path in &entries {
        let relative = entry_path
            .strip_prefix(&save_dir_base)
            .unwrap_or(entry_path);
        let relative_str = relative.to_string_lossy().replace('\\', "/");

        zip_writer.start_file(relative_str, options)?;
        let data = std::fs::read(entry_path)?;
        zip_writer.write_all(&data)?;
    }

    let finished = zip_writer.finish()?;
    let actual_size = finished.metadata()?.len();

    Ok(SnapshotInfo {
        game_name: game_name.to_owned(),
        path: zip_path.to_string_lossy().to_string(),
        timestamp,
        note: note.unwrap_or("").to_owned(),
        size_bytes: actual_size,
    })
}

/// Lightweight integrity check: open the ZIP and verify file count and names.
pub fn verify_snapshot(zip_path: &Path, expected_dir: &Path) -> Result<bool, anyhow::Error> {
    let file = std::fs::File::open(zip_path)?;
    let mut archive = zip::ZipArchive::new(file)?;

    let expected: Vec<String> = walk_dir(expected_dir)?
        .into_iter()
        .filter(|p| p.is_file())
        .map(|p| {
            p.strip_prefix(expected_dir.parent().unwrap_or(expected_dir))
                .unwrap_or(&p)
                .to_string_lossy()
                .replace('\\', "/")
        })
        .collect();

    if archive.len() != expected.len() {
        return Ok(false);
    }

    let mut zip_names: Vec<String> = Vec::new();
    for i in 0..archive.len() {
        if let Ok(f) = archive.by_index(i) {
            zip_names.push(f.name().to_owned());
        }
    }
    zip_names.sort();
    let mut expected_sorted = expected.clone();
    expected_sorted.sort();

    Ok(zip_names == expected_sorted)
}

/// List all snapshots for a game.
pub fn get_snapshots(
    game_name: &str,
    backup_root: &Path,
) -> Result<Vec<SnapshotInfo>, anyhow::Error> {
    let game_dir = backup_root.join(sanitize_filename(game_name));
    if !game_dir.exists() {
        return Ok(vec![]);
    }

    let mut snapshots = Vec::new();
    for entry in std::fs::read_dir(&game_dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.extension().map_or(false, |e| e == "zip") {
            let stem = path.file_stem().unwrap().to_string_lossy();
            // Parse timestamp from filename: "YYYY-MM-DD_HH-MM-SS" or "YYYY-MM-DD_HH-MM-SS_note"
            let (ts, note) = if stem.len() >= 19 {
                let ts = stem[..19].to_string();
                let note = if stem.len() > 20 && stem.as_bytes().get(19) == Some(&b'_') {
                    stem[20..].to_string()
                } else {
                    String::new()
                };
                (ts, note)
            } else {
                (stem.to_string(), String::new())
            };

            let size_bytes = entry.metadata().map(|m| m.len()).unwrap_or(0);

            snapshots.push(SnapshotInfo {
                game_name: game_name.to_owned(),
                path: path.to_string_lossy().to_string(),
                timestamp: ts,
                note,
                size_bytes,
            });
        }
    }

    snapshots.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
    Ok(snapshots)
}

/// Calculate total size of all backup ZIPs under backup_root.
pub fn get_total_backup_size(backup_root: &Path) -> u64 {
    let mut total: u64 = 0;
    if let Ok(entries) = std::fs::read_dir(backup_root) {
        for game_dir in entries.flatten() {
            if game_dir.path().is_dir() {
                if let Ok(snaps) = std::fs::read_dir(game_dir.path()) {
                    for snap in snaps.flatten() {
                        if let Ok(meta) = snap.metadata() {
                            total += meta.len();
                        }
                    }
                }
            }
        }
    }
    total
}

/// Delete a single snapshot file.
pub fn delete_snapshot(zip_path: &Path) -> Result<(), anyhow::Error> {
    std::fs::remove_file(zip_path)?;
    Ok(())
}

// ─────── Backup Queue ───────

use std::collections::VecDeque;
use std::sync::{Arc, Mutex};

/// A task to be executed by the backup queue.
pub struct BackupTask {
    pub game_name: String,
    pub save_dir: PathBuf,
    pub backup_root: PathBuf,
    pub note: Option<String>,
    pub game_id: String,
}

/// Callback for backup events: (event_name, game_id, game_name, snapshot, error_message).
pub type BackupEventCallback =
    Arc<dyn Fn(&str, &str, &str, Option<&SnapshotInfo>, Option<&str>) + Send + Sync>;

struct QueueInner {
    pending: VecDeque<BackupTask>,
    running: usize,
    max_concurrent: usize,
    event_cb: Option<BackupEventCallback>,
}

/// A concurrent backup queue that limits simultaneous ZIP operations.
#[derive(Clone)]
pub struct BackupQueue {
    inner: Arc<Mutex<QueueInner>>,
}

impl BackupQueue {
    /// Create a new backup queue with the given max concurrency.
    pub fn new(max_concurrent: usize) -> Self {
        Self {
            inner: Arc::new(Mutex::new(QueueInner {
                pending: VecDeque::new(),
                running: 0,
                max_concurrent,
                event_cb: None,
            })),
        }
    }

    /// Set an event callback for task completion/failure notifications.
    pub fn set_event_callback(&self, cb: BackupEventCallback) {
        self.inner.lock().unwrap().event_cb = Some(cb);
    }

    /// Enqueue a backup task. Runs asynchronously if a worker slot is available.
    pub fn enqueue(&self, task: BackupTask) {
        {
            let mut inner = self.inner.lock().unwrap();
            inner.pending.push_back(task);
        }
        self.try_dispatch();
    }

    /// Number of tasks pending + running.
    pub fn pending_count(&self) -> usize {
        let inner = self.inner.lock().unwrap();
        inner.pending.len() + inner.running
    }

    /// Try to dispatch pending tasks up to max_concurrent.
    fn try_dispatch(&self) {
        loop {
            let task = {
                let mut inner = self.inner.lock().unwrap();
                if inner.running >= inner.max_concurrent {
                    return;
                }
                match inner.pending.pop_front() {
                    Some(t) => {
                        inner.running += 1;
                        t
                    }
                    None => return,
                }
            };

            let inner = Arc::clone(&self.inner);
            std::thread::spawn(move || {
                run_single_task(task, &inner);
            });
        }
    }
}

/// Execute one backup task and handle completion.
fn run_single_task(task: BackupTask, inner: &Arc<Mutex<QueueInner>>) {
    let event_cb = {
        let mut state = inner.lock().unwrap();
        state.event_cb.clone()
    };

    // Emit start event before doing the work
    if let Some(ref cb) = event_cb {
        cb("backup:started", &task.game_id, &task.game_name, None, None);
    }

    let result = create_snapshot(
        &task.game_name,
        &task.save_dir,
        &task.backup_root,
        task.note.as_deref(),
    );

    {
        let mut state = inner.lock().unwrap();
        state.running -= 1;
    }

    // Emit events outside the lock
    if let Some(ref cb) = event_cb {
        match &result {
            Ok(snap) => {
                let ok =
                    verify_snapshot(&PathBuf::from(&snap.path), &task.save_dir).unwrap_or(false);
                if ok {
                    cb(
                        "backup:completed",
                        &task.game_id,
                        &task.game_name,
                        Some(snap),
                        None,
                    );
                } else {
                    cb(
                        "backup:failed",
                        &task.game_id,
                        &task.game_name,
                        None,
                        Some("Verification failed"),
                    );
                }
            }
            Err(e) => {
                cb(
                    "backup:failed",
                    &task.game_id,
                    &task.game_name,
                    None,
                    Some(&e.to_string()),
                );
            }
        }
        cb("backup:queue_changed", "", "", None, None);
    }

    // Try to dispatch next pending task
    loop {
        let next_task = {
            let mut state = inner.lock().unwrap();
            if state.running >= state.max_concurrent {
                return;
            }
            match state.pending.pop_front() {
                Some(t) => {
                    state.running += 1;
                    t
                }
                None => return,
            }
        };

        let inner2 = Arc::clone(inner);
        std::thread::spawn(move || {
            run_single_task(next_task, &inner2);
        });
    }
}

/// Walk a directory recursively, returning all entries.
fn walk_dir(dir: &Path) -> Result<Vec<PathBuf>, anyhow::Error> {
    let mut files = Vec::new();
    if !dir.exists() {
        return Ok(files);
    }
    for entry in walkdir::WalkDir::new(dir) {
        let entry = entry?;
        files.push(entry.path().to_path_buf());
    }
    Ok(files)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_snapshot_roundtrip() {
        let tmp = tempfile::tempdir().unwrap();
        let save_dir = tmp.path().join("GameSaves");
        let backup_dir = tmp.path().join("backups");
        std::fs::create_dir_all(&save_dir).unwrap();

        // Create fake save files
        std::fs::write(save_dir.join("save1.dat"), b"hello world").unwrap();
        std::fs::create_dir(save_dir.join("Slots")).unwrap();
        std::fs::write(save_dir.join("Slots/slot1.sav"), b"slot data").unwrap();

        // Create snapshot
        let snap = create_snapshot("TestGame", &save_dir, &backup_dir, Some("test note"))
            .expect("create_snapshot failed");

        assert!(snap.path.ends_with("_test note.zip"));
        assert!(snap.path.contains("TestGame"));

        // Verify
        assert!(verify_snapshot(&std::path::PathBuf::from(&snap.path), &save_dir).unwrap());

        // List snapshots
        let snaps = get_snapshots("TestGame", &backup_dir).unwrap();
        assert_eq!(snaps.len(), 1);
        assert_eq!(snaps[0].note, "test note");

        // Delete
        let snap_path = std::path::PathBuf::from(&snap.path);
        delete_snapshot(&snap_path).unwrap();
        assert!(!snap_path.exists());
    }

    #[test]
    fn test_backup_queue_concurrency() {
        let tmp = tempfile::tempdir().unwrap();
        let backup_dir = tmp.path().join("backups");
        std::fs::create_dir_all(&backup_dir).unwrap();

        let queue = BackupQueue::new(2);
        let completed = Arc::new(Mutex::new(Vec::new()));
        let completed2 = Arc::clone(&completed);

        queue.set_event_callback(Arc::new(move |event, _gid, gname, snap, _err| {
            if event == "backup:completed" {
                completed2.lock().unwrap().push(gname.to_string());
            }
        }));

        // Create 5 fake save directories and enqueue them
        for i in 0..5 {
            let save_dir = tmp.path().join(format!("Game{}_Saves", i));
            std::fs::create_dir_all(&save_dir).unwrap();
            std::fs::write(save_dir.join("data.sav"), format!("game {} data", i)).unwrap();

            queue.enqueue(BackupTask {
                game_name: format!("Game{}", i),
                save_dir: save_dir.clone(),
                backup_root: backup_dir.clone(),
                note: None,
                game_id: format!("game-{}", i),
            });
        }

        // Wait for all tasks to complete (poll with timeout)
        let deadline = std::time::Instant::now() + std::time::Duration::from_secs(10);
        while queue.pending_count() > 0 {
            if std::time::Instant::now() > deadline {
                break;
            }
            std::thread::sleep(std::time::Duration::from_millis(200));
        }

        let results = completed.lock().unwrap();
        assert_eq!(results.len(), 5, "All 5 backups should complete");
        assert_eq!(queue.pending_count(), 0, "Queue should be empty");
    }
}
