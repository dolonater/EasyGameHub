use std::path::Path;

/// Restore a snapshot: create a safety backup of current saves, then unzip the snapshot.
pub fn restore_snapshot(
    snapshot_path: &Path,
    target_dir: &Path,
    backup_root: &Path,
    game_name: &str,
) -> Result<(), anyhow::Error> {
    // Step 1: Create safety snapshot of current saves if they exist
    if target_dir.exists()
        && std::fs::read_dir(target_dir)
            .map(|mut r| r.next().is_some())
            .unwrap_or(false)
    {
        crate::core::backup::create_snapshot(
            game_name,
            target_dir,
            backup_root,
            Some("恢复前安全快照"),
        )?;
    }

    // Step 2: Clear target directory contents (keep the directory itself)
    if target_dir.exists() {
        for entry in std::fs::read_dir(target_dir)? {
            let entry = entry?;
            let path = entry.path();
            if path.is_dir() {
                std::fs::remove_dir_all(&path)?;
            } else {
                std::fs::remove_file(&path)?;
            }
        }
    } else {
        std::fs::create_dir_all(target_dir)?;
    }

    // Step 3: Extract ZIP to target directory
    let file = std::fs::File::open(snapshot_path)?;
    let mut archive = zip::ZipArchive::new(file)?;

    // Determine the base path from ZIP entries (strip common prefix)
    let target_parent = target_dir.parent().unwrap_or(target_dir);

    for i in 0..archive.len() {
        let mut entry = archive.by_index(i)?;
        let entry_name = entry.name().to_owned();
        let output_path = target_parent.join(&entry_name);

        if entry.is_dir() {
            std::fs::create_dir_all(&output_path)?;
        } else {
            if let Some(parent) = output_path.parent() {
                std::fs::create_dir_all(parent)?;
            }
            let mut outfile = std::fs::File::create(&output_path)?;
            std::io::copy(&mut entry, &mut outfile)?;
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::backup::create_snapshot;

    #[test]
    fn test_restore_with_safety_snapshot() {
        let tmp = tempfile::tempdir().unwrap();
        let save_dir = tmp.path().join("GameSaves");
        let backup_dir = tmp.path().join("backups");
        std::fs::create_dir_all(&save_dir).unwrap();

        // Create original data
        std::fs::write(save_dir.join("original.txt"), b"original content").unwrap();

        // Backup it
        let snap = create_snapshot("TestGame", &save_dir, &backup_dir, None).unwrap();

        // Modify original
        std::fs::write(save_dir.join("original.txt"), b"modified content").unwrap();

        // Restore: this should create a safety snapshot first
        let snap_path = std::path::PathBuf::from(&snap.path);
        restore_snapshot(&snap_path, &save_dir, &backup_dir, "TestGame").unwrap();

        // Verify original content restored
        let restored = std::fs::read_to_string(save_dir.join("original.txt")).unwrap();
        assert_eq!(restored, "original content");

        // Verify safety snapshot was created
        let snaps = crate::core::backup::get_snapshots("TestGame", &backup_dir).unwrap();
        assert_eq!(snaps.len(), 2); // original + safety
        assert!(snaps.iter().any(|s| s.note.contains("安全快照")));
    }
}
