use serde::{Deserialize, Serialize};
use std::path::Path;

// ── Data structures ──────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Theme {
    pub id: String,
    pub name: String,
    pub is_preset: bool,
    pub light: ThemeVariant,
    pub dark: ThemeVariant,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThemeVariant {
    pub background: String,
    pub foreground: String,
    pub card: String,
    pub card_foreground: String,
    pub primary: String,
    pub primary_foreground: String,
    pub secondary: String,
    pub secondary_foreground: String,
    pub muted: String,
    pub muted_foreground: String,
    pub accent: String,
    pub accent_foreground: String,
    pub destructive: String,
    pub destructive_foreground: String,
    pub border: String,
    pub input: String,
    pub ring: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThemesData {
    pub themes: Vec<Theme>,
    pub global_default: String,
}

// ── Persistence ──────────────────────────────────────────────────

pub fn load_themes(path: &Path) -> Result<ThemesData, anyhow::Error> {
    if !path.exists() {
        let data = default_themes_data();
        save_themes(path, &data)?;
        return Ok(data);
    }
    let json = std::fs::read_to_string(path)?;
    let data: ThemesData = serde_json::from_str(&json)?;
    Ok(data)
}

pub fn save_themes(path: &Path, data: &ThemesData) -> Result<(), anyhow::Error> {
    let json = serde_json::to_string_pretty(data)?;
    std::fs::write(path, json)?;
    Ok(())
}

// ── Built-in presets ─────────────────────────────────────────────

const SYSTEM_DEFAULT: &str = "system-default";
const OCEAN_BLUE: &str = "ocean-blue";
const WARM_AMBER: &str = "warm-amber";
const FOREST_GREEN: &str = "forest-green";
const CHERRY_PINK: &str = "cherry-pink";

/// Return a fresh set of built-in preset themes.
pub fn preset_themes() -> Vec<Theme> {
    vec![
        make_preset(
            SYSTEM_DEFAULT,
            "系统默认",
            system_default_light(),
            system_default_dark(),
        ),
        make_preset(OCEAN_BLUE, "深海蓝", ocean_blue_light(), ocean_blue_dark()),
        make_preset(WARM_AMBER, "暖琥珀", warm_amber_light(), warm_amber_dark()),
        make_preset(
            FOREST_GREEN,
            "墨绿森",
            forest_green_light(),
            forest_green_dark(),
        ),
        make_preset(CHERRY_PINK, "樱粉", cherry_pink_light(), cherry_pink_dark()),
    ]
}

fn make_preset(id: &str, name: &str, light: ThemeVariant, dark: ThemeVariant) -> Theme {
    Theme {
        id: id.to_string(),
        name: name.to_string(),
        is_preset: true,
        light,
        dark,
    }
}

pub fn default_themes_data() -> ThemesData {
    ThemesData {
        themes: preset_themes(),
        global_default: SYSTEM_DEFAULT.to_string(),
    }
}

/// Return canonical presets, overwriting any user-modified copies.
pub fn reset_presets(data: &mut ThemesData) {
    let presets = preset_themes();
    for preset in &presets {
        if let Some(existing) = data.themes.iter_mut().find(|t| t.id == preset.id) {
            *existing = preset.clone();
        } else {
            data.themes.push(preset.clone());
        }
    }
}

// ── Color definitions ────────────────────────────────────────────

// Values are "H S% L%" triplets (no hsl() wrapper).

/// system-default (light) — current :root values
fn system_default_light() -> ThemeVariant {
    ThemeVariant {
        background: "0 0% 100%".into(),
        foreground: "240 10% 3.9%".into(),
        card: "0 0% 100%".into(),
        card_foreground: "240 10% 3.9%".into(),
        primary: "240 5.9% 10%".into(),
        primary_foreground: "0 0% 98%".into(),
        secondary: "240 4.8% 95.9%".into(),
        secondary_foreground: "240 5.9% 10%".into(),
        muted: "240 4.8% 95.9%".into(),
        muted_foreground: "240 3.8% 46.1%".into(),
        accent: "240 4.8% 95.9%".into(),
        accent_foreground: "240 5.9% 10%".into(),
        destructive: "0 84.2% 60.2%".into(),
        destructive_foreground: "0 0% 98%".into(),
        border: "240 5.9% 90%".into(),
        input: "240 5.9% 90%".into(),
        ring: "240 5.9% 10%".into(),
    }
}

/// system-default (dark) — current .dark values
fn system_default_dark() -> ThemeVariant {
    ThemeVariant {
        background: "240 10% 3.9%".into(),
        foreground: "0 0% 98%".into(),
        card: "240 10% 3.9%".into(),
        card_foreground: "0 0% 98%".into(),
        primary: "0 0% 98%".into(),
        primary_foreground: "240 5.9% 10%".into(),
        secondary: "240 3.7% 15.9%".into(),
        secondary_foreground: "0 0% 98%".into(),
        muted: "240 3.7% 15.9%".into(),
        muted_foreground: "240 5% 64.9%".into(),
        accent: "240 3.7% 15.9%".into(),
        accent_foreground: "0 0% 98%".into(),
        destructive: "0 62.8% 30.6%".into(),
        destructive_foreground: "0 0% 98%".into(),
        border: "240 3.7% 15.9%".into(),
        input: "240 3.7% 15.9%".into(),
        ring: "240 4.9% 83.9%".into(),
    }
}

/// ocean-blue light — crisp blue-grey + vibrant blue primary
fn ocean_blue_light() -> ThemeVariant {
    ThemeVariant {
        background: "210 20% 98%".into(),
        foreground: "215 25% 15%".into(),
        card: "0 0% 100%".into(),
        card_foreground: "215 25% 15%".into(),
        primary: "215 70% 45%".into(),
        primary_foreground: "0 0% 100%".into(),
        secondary: "210 20% 94%".into(),
        secondary_foreground: "215 25% 20%".into(),
        muted: "210 15% 92%".into(),
        muted_foreground: "215 15% 48%".into(),
        accent: "215 60% 50%".into(),
        accent_foreground: "0 0% 100%".into(),
        destructive: "0 72% 55%".into(),
        destructive_foreground: "0 0% 98%".into(),
        border: "210 15% 88%".into(),
        input: "210 15% 88%".into(),
        ring: "215 70% 45%".into(),
    }
}

/// ocean-blue dark — VS Code Dark+ inspired
fn ocean_blue_dark() -> ThemeVariant {
    ThemeVariant {
        background: "215 25% 10%".into(),
        foreground: "210 15% 85%".into(),
        card: "215 22% 13%".into(),
        card_foreground: "210 15% 85%".into(),
        primary: "210 80% 60%".into(),
        primary_foreground: "215 25% 8%".into(),
        secondary: "215 20% 17%".into(),
        secondary_foreground: "210 15% 85%".into(),
        muted: "215 18% 15%".into(),
        muted_foreground: "215 12% 55%".into(),
        accent: "210 70% 58%".into(),
        accent_foreground: "0 0% 100%".into(),
        destructive: "0 62% 45%".into(),
        destructive_foreground: "0 0% 98%".into(),
        border: "215 18% 20%".into(),
        input: "215 18% 20%".into(),
        ring: "210 80% 60%".into(),
    }
}

/// warm-amber light — warm cream + rich amber, Steam-inspired
fn warm_amber_light() -> ThemeVariant {
    ThemeVariant {
        background: "35 30% 97%".into(),
        foreground: "30 20% 15%".into(),
        card: "0 0% 100%".into(),
        card_foreground: "30 20% 15%".into(),
        primary: "32 85% 42%".into(),
        primary_foreground: "0 0% 100%".into(),
        secondary: "35 25% 93%".into(),
        secondary_foreground: "30 20% 20%".into(),
        muted: "35 20% 90%".into(),
        muted_foreground: "30 12% 45%".into(),
        accent: "28 75% 48%".into(),
        accent_foreground: "0 0% 100%".into(),
        destructive: "0 70% 50%".into(),
        destructive_foreground: "0 0% 98%".into(),
        border: "35 18% 85%".into(),
        input: "35 18% 85%".into(),
        ring: "32 85% 42%".into(),
    }
}

/// warm-amber dark — deep brown-black + golden amber, Steam dark style
fn warm_amber_dark() -> ThemeVariant {
    ThemeVariant {
        background: "30 18% 8%".into(),
        foreground: "35 20% 88%".into(),
        card: "30 15% 11%".into(),
        card_foreground: "35 20% 88%".into(),
        primary: "36 85% 50%".into(),
        primary_foreground: "30 18% 6%".into(),
        secondary: "30 15% 15%".into(),
        secondary_foreground: "35 20% 88%".into(),
        muted: "30 12% 13%".into(),
        muted_foreground: "32 15% 58%".into(),
        accent: "32 75% 52%".into(),
        accent_foreground: "0 0% 100%".into(),
        destructive: "0 55% 42%".into(),
        destructive_foreground: "0 0% 98%".into(),
        border: "30 14% 18%".into(),
        input: "30 14% 18%".into(),
        ring: "36 85% 50%".into(),
    }
}

/// forest-green light — soft green tint + emerald accents
fn forest_green_light() -> ThemeVariant {
    ThemeVariant {
        background: "140 15% 97%".into(),
        foreground: "145 25% 12%".into(),
        card: "0 0% 100%".into(),
        card_foreground: "145 25% 12%".into(),
        primary: "155 55% 38%".into(),
        primary_foreground: "0 0% 100%".into(),
        secondary: "140 12% 93%".into(),
        secondary_foreground: "145 25% 18%".into(),
        muted: "140 10% 90%".into(),
        muted_foreground: "145 12% 45%".into(),
        accent: "150 50% 42%".into(),
        accent_foreground: "0 0% 100%".into(),
        destructive: "0 65% 52%".into(),
        destructive_foreground: "0 0% 98%".into(),
        border: "140 12% 86%".into(),
        input: "140 12% 86%".into(),
        ring: "155 55% 38%".into(),
    }
}

/// forest-green dark — deep green-black + bright emerald
fn forest_green_dark() -> ThemeVariant {
    ThemeVariant {
        background: "150 15% 7%".into(),
        foreground: "145 15% 85%".into(),
        card: "150 12% 10%".into(),
        card_foreground: "145 15% 85%".into(),
        primary: "150 55% 48%".into(),
        primary_foreground: "150 15% 6%".into(),
        secondary: "150 12% 14%".into(),
        secondary_foreground: "145 15% 85%".into(),
        muted: "150 10% 12%".into(),
        muted_foreground: "145 12% 55%".into(),
        accent: "148 50% 45%".into(),
        accent_foreground: "0 0% 100%".into(),
        destructive: "0 55% 38%".into(),
        destructive_foreground: "0 0% 98%".into(),
        border: "150 12% 17%".into(),
        input: "150 12% 17%".into(),
        ring: "150 55% 48%".into(),
    }
}

/// cherry-pink light — soft pink + rose accents
fn cherry_pink_light() -> ThemeVariant {
    ThemeVariant {
        background: "345 20% 98%".into(),
        foreground: "340 15% 18%".into(),
        card: "0 0% 100%".into(),
        card_foreground: "340 15% 18%".into(),
        primary: "340 55% 50%".into(),
        primary_foreground: "0 0% 100%".into(),
        secondary: "345 15% 94%".into(),
        secondary_foreground: "340 15% 22%".into(),
        muted: "345 12% 92%".into(),
        muted_foreground: "340 10% 48%".into(),
        accent: "335 50% 52%".into(),
        accent_foreground: "0 0% 100%".into(),
        destructive: "0 65% 52%".into(),
        destructive_foreground: "0 0% 98%".into(),
        border: "345 12% 88%".into(),
        input: "345 12% 88%".into(),
        ring: "340 55% 50%".into(),
    }
}

/// cherry-pink dark — deep maroon-black + soft rose
fn cherry_pink_dark() -> ThemeVariant {
    ThemeVariant {
        background: "340 15% 8%".into(),
        foreground: "345 15% 87%".into(),
        card: "340 12% 11%".into(),
        card_foreground: "345 15% 87%".into(),
        primary: "340 60% 58%".into(),
        primary_foreground: "340 15% 6%".into(),
        secondary: "340 12% 15%".into(),
        secondary_foreground: "345 15% 87%".into(),
        muted: "340 10% 13%".into(),
        muted_foreground: "340 12% 58%".into(),
        accent: "335 55% 52%".into(),
        accent_foreground: "0 0% 100%".into(),
        destructive: "0 52% 40%".into(),
        destructive_foreground: "0 0% 98%".into(),
        border: "340 12% 18%".into(),
        input: "340 12% 18%".into(),
        ring: "340 60% 58%".into(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_themes_has_five_presets() {
        let data = default_themes_data();
        assert_eq!(data.themes.len(), 5);
        assert_eq!(data.global_default, "system-default");
        // system-default should be first
        assert_eq!(data.themes[0].id, "system-default");
        assert!(data.themes[0].is_preset);
    }

    #[test]
    fn test_save_and_load_roundtrip() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("themes.json");
        let data = default_themes_data();
        save_themes(&path, &data).unwrap();
        let loaded = load_themes(&path).unwrap();
        assert_eq!(loaded.themes.len(), 5);
        assert_eq!(loaded.global_default, "system-default");
    }

    #[test]
    fn test_reset_presets_restores_modified() {
        let mut data = default_themes_data();
        // Modify a preset
        data.themes[0].name = "Modified".into();
        data.themes[0].light.primary = "0 100% 50%".into();
        // Reset
        reset_presets(&mut data);
        // Should be restored
        assert_eq!(data.themes[0].name, "系统默认");
        assert_eq!(data.themes[0].light.primary, "240 5.9% 10%");
    }

    #[test]
    fn test_load_creates_default_when_missing() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("themes.json");
        let data = load_themes(&path).unwrap();
        assert_eq!(data.themes.len(), 5);
        assert!(path.exists());
    }
}
