use crate::error::{Result, SteamError};
use crate::local::steam_path::SteamInstallation;
use std::collections::HashMap;
use std::io::{Cursor, Read};

const VDF_SUBSECTION: u8 = 0x00;
const VDF_STRING: u8 = 0x01;
const VDF_INT32: u8 = 0x02;
const VDF_FLOAT32: u8 = 0x03;
const VDF_INT64: u8 = 0x07;
const VDF_UINT64: u8 = 0x0A;
const VDF_END: u8 = 0x08;

#[derive(Debug, Clone)]
pub struct LocalAchievementDef {
    pub name: String,
    pub display_name: Option<String>,
    pub description: Option<String>,
    pub hidden: bool,
    pub icon: Option<String>,
    pub icon_gray: Option<String>,
}

#[derive(Debug, Clone)]
enum SchemaValue {
    Map(HashMap<String, SchemaValue>),
    String(String),
    Int32(i32),
    Float32(f32),
    Int64(i64),
    UInt64(u64),
}

impl SchemaValue {
    fn as_map(&self) -> Option<&HashMap<String, SchemaValue>> {
        match self {
            SchemaValue::Map(map) => Some(map),
            _ => None,
        }
    }

    fn as_string(&self) -> Option<String> {
        match self {
            SchemaValue::String(value) => Some(value.clone()),
            SchemaValue::Int32(value) => Some(value.to_string()),
            SchemaValue::Float32(value) => Some(value.to_string()),
            SchemaValue::Int64(value) => Some(value.to_string()),
            SchemaValue::UInt64(value) => Some(value.to_string()),
            SchemaValue::Map(_) => None,
        }
    }
}

pub fn schema_path(install: &SteamInstallation, app_id: u32) -> std::path::PathBuf {
    install
        .path
        .join("appcache")
        .join("stats")
        .join(format!("UserGameStatsSchema_{}.bin", app_id))
}

pub fn read_achievement_schema(
    install: &SteamInstallation,
    app_id: u32,
) -> Result<Vec<LocalAchievementDef>> {
    let path = schema_path(install, app_id);
    if !path.exists() {
        return Err(SteamError::NotFound(format!(
            "Local achievement schema not found: {}",
            path.display()
        )));
    }

    let bytes = std::fs::read(&path)?;
    let root = parse_binary_vdf(&bytes)?;
    extract_achievements(&root, app_id)
}

fn parse_binary_vdf(bytes: &[u8]) -> Result<HashMap<String, SchemaValue>> {
    let mut cursor = Cursor::new(bytes);
    parse_map(&mut cursor)
}

fn parse_map(cursor: &mut Cursor<&[u8]>) -> Result<HashMap<String, SchemaValue>> {
    let mut result = HashMap::new();

    loop {
        let mut kind = [0u8; 1];
        match cursor.read_exact(&mut kind) {
            Ok(()) => {}
            Err(_) => break,
        }

        match kind[0] {
            VDF_END => break,
            VDF_SUBSECTION => {
                let key = read_cstring(cursor)?;
                let value = parse_map(cursor)?;
                result.insert(key, SchemaValue::Map(value));
            }
            VDF_STRING => {
                let key = read_cstring(cursor)?;
                let value = read_cstring(cursor)?;
                result.insert(key, SchemaValue::String(value));
            }
            VDF_INT32 => {
                let key = read_cstring(cursor)?;
                let mut buf = [0u8; 4];
                cursor.read_exact(&mut buf)?;
                result.insert(key, SchemaValue::Int32(i32::from_le_bytes(buf)));
            }
            VDF_FLOAT32 => {
                let key = read_cstring(cursor)?;
                let mut buf = [0u8; 4];
                cursor.read_exact(&mut buf)?;
                result.insert(key, SchemaValue::Float32(f32::from_le_bytes(buf)));
            }
            VDF_INT64 => {
                let key = read_cstring(cursor)?;
                let mut buf = [0u8; 8];
                cursor.read_exact(&mut buf)?;
                result.insert(key, SchemaValue::Int64(i64::from_le_bytes(buf)));
            }
            VDF_UINT64 => {
                let key = read_cstring(cursor)?;
                let mut buf = [0u8; 8];
                cursor.read_exact(&mut buf)?;
                result.insert(key, SchemaValue::UInt64(u64::from_le_bytes(buf)));
            }
            other => {
                return Err(SteamError::General(format!(
                    "Unsupported stats schema VDF type: {}",
                    other
                )));
            }
        }
    }

    Ok(result)
}

fn read_cstring(cursor: &mut Cursor<&[u8]>) -> Result<String> {
    let mut bytes = Vec::new();
    loop {
        let mut b = [0u8; 1];
        cursor.read_exact(&mut b)?;
        if b[0] == 0 {
            break;
        }
        bytes.push(b[0]);
    }
    Ok(String::from_utf8_lossy(&bytes).into_owned())
}

fn extract_achievements(
    root: &HashMap<String, SchemaValue>,
    app_id: u32,
) -> Result<Vec<LocalAchievementDef>> {
    let app = root
        .get(&app_id.to_string())
        .and_then(SchemaValue::as_map)
        .ok_or_else(|| {
            SteamError::NotFound(format!("Stats schema missing app node for {}", app_id))
        })?;

    let stats = app
        .get("stats")
        .and_then(SchemaValue::as_map)
        .ok_or_else(|| SteamError::NotFound("Stats schema missing stats section".into()))?;

    let mut achievements = Vec::new();

    for stat in stats.values() {
        let Some(stat_map) = stat.as_map() else {
            continue;
        };

        let stat_type = stat_map
            .get("type")
            .and_then(SchemaValue::as_string)
            .map(|value| value.to_ascii_uppercase());
        let type_int = stat_map
            .get("type_int")
            .and_then(SchemaValue::as_string)
            .and_then(|value| value.parse::<i32>().ok());

        let is_achievement_group = matches!(
            stat_type.as_deref(),
            Some("ACHIEVEMENTS") | Some("GROUPACHIEVEMENTS")
        ) || matches!(type_int, Some(4));

        if !is_achievement_group {
            continue;
        }

        let Some(bits) = stat_map.get("bits").and_then(SchemaValue::as_map) else {
            continue;
        };

        for bit in bits.values() {
            let Some(bit_map) = bit.as_map() else {
                continue;
            };

            let name = bit_map
                .get("name")
                .and_then(SchemaValue::as_string)
                .unwrap_or_default();
            if name.is_empty() {
                continue;
            }

            let display = bit_map.get("display").and_then(SchemaValue::as_map);
            let display_name = display.and_then(|map| localized_value(map.get("name")));
            let description = display.and_then(|map| localized_value(map.get("desc")));
            let hidden = display
                .and_then(|map| map.get("hidden"))
                .and_then(SchemaValue::as_string)
                .map(|value| value == "1")
                .unwrap_or(false);
            let icon = display
                .and_then(|map| map.get("icon"))
                .and_then(SchemaValue::as_string)
                .filter(|value| !value.is_empty());
            let icon_gray = display
                .and_then(|map| map.get("icon_gray").or_else(|| map.get("icongray")))
                .and_then(SchemaValue::as_string)
                .filter(|value| !value.is_empty());

            achievements.push(LocalAchievementDef {
                name,
                display_name,
                description,
                hidden,
                icon,
                icon_gray,
            });
        }
    }

    Ok(achievements)
}

fn localized_value(value: Option<&SchemaValue>) -> Option<String> {
    match value {
        Some(SchemaValue::Map(map)) => map
            .get("english")
            .or_else(|| map.values().next())
            .and_then(SchemaValue::as_string)
            .filter(|value| !value.is_empty()),
        Some(other) => other.as_string().filter(|value| !value.is_empty()),
        None => None,
    }
}

pub fn icon_url(app_id: u32, hash: &str) -> String {
    format!(
        "https://steamcdn-a.akamaihd.net/steamcommunity/public/images/apps/{}/{}",
        app_id, hash
    )
}
