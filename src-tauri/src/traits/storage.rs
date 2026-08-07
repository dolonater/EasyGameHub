use std::path::Path;

/// Storage backend trait — pluggable storage for snapshots.
/// Current implementation: LocalFileStorage.
/// Future: OneDrive, Google Drive, WebDAV.
pub trait StorageBackend {
    fn write_snapshot(
        &self,
        game_id: &str,
        data: &[u8],
        filename: &str,
    ) -> Result<(), anyhow::Error>;
    fn read_snapshot(&self, game_id: &str, filename: &str) -> Result<Vec<u8>, anyhow::Error>;
    fn list_snapshots(&self, game_id: &str) -> Result<Vec<String>, anyhow::Error>;
    fn delete_snapshot(&self, game_id: &str, filename: &str) -> Result<(), anyhow::Error>;
    fn available_space(&self) -> Result<u64, anyhow::Error>;
}

/// Local filesystem storage implementation.
pub struct LocalFileStorage {
    pub root: Path,
}

impl StorageBackend for LocalFileStorage {
    fn write_snapshot(
        &self,
        game_id: &str,
        data: &[u8],
        filename: &str,
    ) -> Result<(), anyhow::Error> {
        let dir = self.root.join(game_id);
        std::fs::create_dir_all(&dir)?;
        std::fs::write(dir.join(filename), data)?;
        Ok(())
    }

    fn read_snapshot(&self, game_id: &str, filename: &str) -> Result<Vec<u8>, anyhow::Error> {
        let path = self.root.join(game_id).join(filename);
        Ok(std::fs::read(path)?)
    }

    fn list_snapshots(&self, game_id: &str) -> Result<Vec<String>, anyhow::Error> {
        let dir = self.root.join(game_id);
        if !dir.exists() {
            return Ok(vec![]);
        }
        let mut names = Vec::new();
        for entry in std::fs::read_dir(&dir)? {
            let entry = entry?;
            if let Some(name) = entry.file_name().to_str() {
                names.push(name.to_owned());
            }
        }
        Ok(names)
    }

    fn delete_snapshot(&self, game_id: &str, filename: &str) -> Result<(), anyhow::Error> {
        let path = self.root.join(game_id).join(filename);
        std::fs::remove_file(path)?;
        Ok(())
    }

    fn available_space(&self) -> Result<u64, anyhow::Error> {
        // Simplified: return a large value to indicate "unknown but probably OK"
        // Real implementation would use fs2 or sysinfo
        Ok(1024 * 1024 * 1024 * 100) // 100 GB placeholder
    }
}
