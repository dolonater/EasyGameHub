use std::path::{Path, PathBuf};

pub struct RuntimePaths {
    pub data_dir: PathBuf,
    pub config_path: PathBuf,
    pub db_path: PathBuf,
    pub games_index_path: PathBuf,
    pub custom_games_path: PathBuf,
    pub user_games_path: PathBuf,
    pub themes_path: PathBuf,
    pub view_settings_path: PathBuf,
    pub background_thumbnails_dir: PathBuf,
    pub background_runtime_dir: PathBuf,
    pub backup_root: PathBuf,
}

pub fn initialize_runtime_paths(
    data_dir: &Path,
    resource_dir: &Path,
) -> Result<RuntimePaths, anyhow::Error> {
    std::fs::create_dir_all(data_dir)?;
    std::fs::create_dir_all(data_dir.join("data"))?;
    std::fs::create_dir_all(data_dir.join("cache").join("background-thumbnails"))?;
    std::fs::create_dir_all(data_dir.join("cache").join("background-runtime"))?;

    copy_seed_file(resource_dir, data_dir, "config.json")?;
    copy_seed_file(resource_dir, data_dir, "data/games.db.json")?;
    copy_seed_file(resource_dir, data_dir, "games_index.json")?;
    copy_seed_file(resource_dir, data_dir, "custom_games.json")?;
    copy_seed_file(resource_dir, data_dir, "user_games.json")?;
    copy_seed_file(resource_dir, data_dir, "themes.json")?;
    copy_seed_file(resource_dir, data_dir, "view-settings.json")?;

    Ok(RuntimePaths {
        data_dir: data_dir.to_path_buf(),
        config_path: data_dir.join("config.json"),
        db_path: data_dir.join("data").join("games.db.json"),
        games_index_path: data_dir.join("games_index.json"),
        custom_games_path: data_dir.join("custom_games.json"),
        user_games_path: data_dir.join("user_games.json"),
        themes_path: data_dir.join("themes.json"),
        view_settings_path: data_dir.join("view-settings.json"),
        background_thumbnails_dir: data_dir.join("cache").join("background-thumbnails"),
        background_runtime_dir: data_dir.join("cache").join("background-runtime"),
        backup_root: data_dir.join("backups"),
    })
}

fn copy_seed_file(
    resource_dir: &Path,
    data_dir: &Path,
    relative: &str,
) -> Result<(), anyhow::Error> {
    let target = data_dir.join(relative);
    if target.exists() {
        return Ok(());
    }

    let source = resource_dir.join(relative);
    if !source.exists() {
        return Ok(());
    }

    if let Some(parent) = target.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::copy(source, target)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn copies_seed_json_files_from_resources_when_runtime_files_are_missing() {
        let temp = tempfile::tempdir().unwrap();
        let resource_dir = temp.path().join("resources");
        let data_dir = temp.path().join("data-dir");
        std::fs::create_dir_all(resource_dir.join("data")).unwrap();

        std::fs::write(resource_dir.join("config.json"), b"{\"language\":\"zh\"}").unwrap();
        std::fs::write(
            resource_dir.join("data").join("games.db.json"),
            b"{\"version\":1,\"games\":[]}",
        )
        .unwrap();
        std::fs::write(
            resource_dir.join("games_index.json"),
            b"{\"version\":1,\"entries\":{}}",
        )
        .unwrap();
        std::fs::write(resource_dir.join("custom_games.json"), b"{\"games\":[]}").unwrap();
        std::fs::write(resource_dir.join("user_games.json"), b"{\"monitored\":[]}").unwrap();
        std::fs::write(
            resource_dir.join("themes.json"),
            b"{\"themes\":[],\"globalDefault\":\"system-default\"}",
        )
        .unwrap();
        std::fs::write(resource_dir.join("view-settings.json"), b"{\"version\":1}").unwrap();

        let paths = initialize_runtime_paths(&data_dir, &resource_dir).unwrap();

        assert_eq!(paths.db_path, data_dir.join("data").join("games.db.json"));
        assert_eq!(
            std::fs::read_to_string(&paths.db_path).unwrap(),
            "{\"version\":1,\"games\":[]}"
        );
        assert_eq!(
            std::fs::read_to_string(&paths.games_index_path).unwrap(),
            "{\"version\":1,\"entries\":{}}"
        );
        assert_eq!(
            std::fs::read_to_string(&paths.custom_games_path).unwrap(),
            "{\"games\":[]}"
        );
        assert_eq!(
            std::fs::read_to_string(&paths.user_games_path).unwrap(),
            "{\"monitored\":[]}"
        );
    }

    #[test]
    fn does_not_overwrite_existing_runtime_user_files() {
        let temp = tempfile::tempdir().unwrap();
        let resource_dir = temp.path().join("resources");
        let data_dir = temp.path().join("data-dir");
        std::fs::create_dir_all(resource_dir.join("data")).unwrap();
        std::fs::create_dir_all(data_dir.join("data")).unwrap();

        std::fs::write(resource_dir.join("user_games.json"), b"{\"monitored\":[]}").unwrap();
        std::fs::write(
            data_dir.join("user_games.json"),
            b"{\"monitored\":[\"existing\"]}",
        )
        .unwrap();

        let paths = initialize_runtime_paths(&data_dir, &resource_dir).unwrap();

        assert_eq!(
            std::fs::read_to_string(&paths.user_games_path).unwrap(),
            "{\"monitored\":[\"existing\"]}"
        );
    }

    #[test]
    fn uses_explicit_resource_seed_directory_instead_of_dev_runtime_data() {
        let temp = tempfile::tempdir().unwrap();
        let dev_runtime_dir = temp.path().join("project-root");
        let clean_seed_dir = dev_runtime_dir.join("resources").join("defaults");
        let release_data_dir = temp.path().join("release-data");
        std::fs::create_dir_all(&dev_runtime_dir).unwrap();
        std::fs::create_dir_all(&clean_seed_dir).unwrap();

        std::fs::write(
            dev_runtime_dir.join("user_games.json"),
            b"{\"monitored\":[\"dev-only\"]}",
        )
        .unwrap();
        std::fs::write(
            clean_seed_dir.join("user_games.json"),
            b"{\"monitored\":[]}",
        )
        .unwrap();

        let paths = initialize_runtime_paths(&release_data_dir, &clean_seed_dir).unwrap();

        assert_eq!(
            std::fs::read_to_string(&paths.user_games_path).unwrap(),
            "{\"monitored\":[]}"
        );
    }
}
