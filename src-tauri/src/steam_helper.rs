use serde::{Deserialize, Serialize};
use std::io::Write;
use std::sync::atomic::{AtomicU64, Ordering};
use steam_sdk::client::achievements::AchievementInfo;

static HELPER_REQUEST_ID: AtomicU64 = AtomicU64::new(1);

#[derive(Debug, Clone)]
pub struct SteamAchievementsHelperRequest {
    pub app_id: u32,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SteamAchievementsHelperResponse {
    ok: bool,
    error: Option<String>,
    percentage: Option<f64>,
    achievements: Option<Vec<AchievementInfo>>,
    live_state_available: Option<bool>,
    live_state_error: Option<String>,
}

pub fn cli_steam_achievements_helper_request() -> Option<SteamAchievementsHelperRequest> {
    let mut args = std::env::args().skip(1);
    while let Some(arg) = args.next() {
        if arg == "--steam-achievements-helper" {
            let app_id = args.next()?.parse::<u32>().ok()?;
            return Some(SteamAchievementsHelperRequest { app_id });
        }
    }
    None
}

pub fn run_steam_achievements_helper(
    request: SteamAchievementsHelperRequest,
) -> Result<(), String> {
    let payload = match steam_sdk::local::achievements_local::get_achievements_with_local_client(
        request.app_id,
    ) {
        Ok((percentage, achievements, live_state_available, live_state_error)) => {
            SteamAchievementsHelperResponse {
                ok: true,
                error: None,
                percentage: Some(percentage),
                achievements: Some(achievements),
                live_state_available: Some(live_state_available),
                live_state_error,
            }
        }
        Err(error) => SteamAchievementsHelperResponse {
            ok: false,
            error: Some(error.to_string()),
            percentage: None,
            achievements: None,
            live_state_available: None,
            live_state_error: None,
        },
    };

    let bytes = serde_json::to_vec(&payload)
        .map_err(|error| format!("Failed to serialize achievements helper payload: {}", error))?;

    let mut stdout = std::io::stdout().lock();
    stdout
        .write_all(&bytes)
        .map_err(|error| format!("Failed to write achievements helper stdout: {}", error))?;
    stdout
        .flush()
        .map_err(|error| format!("Failed to flush achievements helper stdout: {}", error))
}

pub fn invoke_steam_achievements_helper(
    app_id: u32,
) -> Result<(f64, Vec<AchievementInfo>, bool, Option<String>), String> {
    let exe_path = std::env::current_exe()
        .map_err(|error| format!("Failed to resolve current executable: {}", error))?;

    let mut command = std::process::Command::new(&exe_path);
    command
        .arg("--steam-achievements-helper")
        .arg(app_id.to_string())
        .arg(format!(
            "--helper-run-id={}",
            HELPER_REQUEST_ID.fetch_add(1, Ordering::Relaxed)
        ))
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        command.creation_flags(CREATE_NO_WINDOW);
    }

    let output = command
        .output()
        .map_err(|error| format!("Failed to launch achievements helper: {}", error))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let detail = if !stderr.is_empty() {
            stderr
        } else if !stdout.is_empty() {
            stdout
        } else {
            format!("helper exited with status {:?}", output.status.code())
        };
        return Err(format!("Steam achievements helper failed: {}", detail));
    }

    let payload: SteamAchievementsHelperResponse = serde_json::from_slice(&output.stdout)
        .map_err(|error| format!("Failed to parse achievements helper output: {}", error))?;

    if !payload.ok {
        return Err(payload
            .error
            .unwrap_or_else(|| "Steam achievements helper returned an unknown error".into()));
    }

    Ok((
        payload.percentage.unwrap_or(0.0),
        payload.achievements.unwrap_or_default(),
        payload.live_state_available.unwrap_or(false),
        payload.live_state_error,
    ))
}
