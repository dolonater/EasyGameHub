use crate::client::achievements::AchievementInfo;
use crate::error::{Result, SteamError};
use crate::local::achievement_schema::{icon_url, read_achievement_schema};
#[cfg(target_os = "windows")]
use crate::local::achievements_live_windows;
use crate::local::steam_path::detect_steam;

pub fn get_achievements_with_local_client(
    app_id: u32,
) -> Result<(f64, Vec<AchievementInfo>, bool, Option<String>)> {
    let install = detect_steam()?;
    let defs = read_achievement_schema(&install, app_id)?;

    if defs.is_empty() {
        return Ok((0.0, Vec::new(), false, None));
    }

    #[cfg(target_os = "windows")]
    let (live_map, live_state_available, live_state_error): (
        std::collections::HashMap<String, (bool, u64)>,
        bool,
        Option<String>,
    ) = match achievements_live_windows::read_live_achievement_state(&defs, app_id) {
        Ok(live_state) => (
            live_state
                .into_iter()
                .map(|item| (item.name, (item.achieved, item.unlock_time)))
                .collect(),
            true,
            None,
        ),
        Err(error) => (
            std::collections::HashMap::new(),
            false,
            Some(error.to_string()),
        ),
    };

    #[cfg(not(target_os = "windows"))]
    let (live_map, live_state_available, live_state_error): (
        std::collections::HashMap<String, (bool, u64)>,
        bool,
        Option<String>,
    ) = (
        std::collections::HashMap::new(),
        false,
        Some("Local live achievements are not supported on this platform.".into()),
    );

    let achievements: Vec<AchievementInfo> = defs
        .into_iter()
        .map(|def| {
            let (achieved, unlock_time) = live_map.get(&def.name).copied().unwrap_or((false, 0));

            AchievementInfo {
                name: def.name.clone(),
                display_name: def.display_name.unwrap_or_else(|| def.name.clone()),
                description: def.description,
                hidden: def.hidden,
                icon: def.icon.as_deref().map(|hash| icon_url(app_id, hash)),
                icon_gray: def.icon_gray.as_deref().map(|hash| icon_url(app_id, hash)),
                achieved,
                unlock_time,
            }
        })
        .collect();

    let unlocked = achievements
        .iter()
        .filter(|achievement| achievement.achieved)
        .count() as f64;
    let total = achievements.len() as f64;
    let percentage = if total > 0.0 {
        (unlocked / total) * 100.0
    } else {
        0.0
    };

    Ok((
        percentage,
        achievements,
        live_state_available,
        live_state_error,
    ))
}
