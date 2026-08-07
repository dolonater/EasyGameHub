use serde::{Deserialize, Serialize};
use std::path::Path;

pub const VERSION: u32 = 1;
pub const LIST_COMPACT_PRESET_ID: &str = "list-compact";
pub const LIST_STANDARD_PRESET_ID: &str = "list-standard";
pub const LIST_INFO_RICH_PRESET_ID: &str = "list-info-rich";
pub const LIST_BANNER_PRESET_ID: &str = "list-banner";
pub const GRID_COMPACT_PRESET_ID: &str = "grid-compact";
pub const GRID_STANDARD_PRESET_ID: &str = "grid-standard";
pub const GRID_POSTER_WALL_PRESET_ID: &str = "grid-poster-wall";
pub const GRID_INFO_CARD_WALL_PRESET_ID: &str = "grid-info-card-wall";

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ViewKind {
    List,
    Grid,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ViewBindingMode {
    Preset,
    Adjusted,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ContentDensity {
    Compact,
    Standard,
    Comfortable,
}

impl Default for ContentDensity {
    fn default() -> Self {
        Self::Standard
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum CardRadius {
    Small,
    Medium,
    Large,
}

impl Default for CardRadius {
    fn default() -> Self {
        Self::Medium
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ShadowLevel {
    None,
    Soft,
    Medium,
}

impl Default for ShadowLevel {
    fn default() -> Self {
        Self::Soft
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum ListTemplate {
    Compact,
    Standard,
    InfoRich,
    Banner,
}

impl Default for ListTemplate {
    fn default() -> Self {
        Self::Standard
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum SpacingLevel {
    Tight,
    Standard,
    Relaxed,
}

impl Default for SpacingLevel {
    fn default() -> Self {
        Self::Standard
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum BannerWidth {
    Narrow,
    Standard,
    Wide,
}

impl Default for BannerWidth {
    fn default() -> Self {
        Self::Standard
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum GridTemplate {
    Compact,
    Standard,
    PosterWall,
    InfoCardWall,
}

impl Default for GridTemplate {
    fn default() -> Self {
        Self::Standard
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum GridDensity {
    Compact,
    Standard,
    Relaxed,
}

impl Default for GridDensity {
    fn default() -> Self {
        Self::Standard
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum CoverScale {
    Tight,
    Standard,
    Showcase,
}

impl Default for CoverScale {
    fn default() -> Self {
        Self::Standard
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ViewSettingsData {
    #[serde(default = "default_version")]
    pub version: u32,
    #[serde(default)]
    pub page_settings: PageSettings,
    #[serde(default)]
    pub preset_libraries: ViewPresetLibraries,
}

impl Default for ViewSettingsData {
    fn default() -> Self {
        default_view_settings_data()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PageSettings {
    #[serde(default = "default_launcher_page_settings")]
    pub launcher: PageViewSettings,
    #[serde(default = "default_game_list_page_settings")]
    pub game_list: PageViewSettings,
    #[serde(default = "default_inventory_page_settings")]
    pub inventory: PageViewSettings,
}

impl Default for PageSettings {
    fn default() -> Self {
        Self {
            launcher: default_launcher_page_settings(),
            game_list: default_game_list_page_settings(),
            inventory: default_inventory_page_settings(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ViewPresetLibraries {
    #[serde(default = "preset_list_view_settings")]
    pub list: ViewPresetLibrary<ListViewSettings>,
    #[serde(default = "preset_grid_view_settings")]
    pub grid: ViewPresetLibrary<GridViewSettings>,
}

impl Default for ViewPresetLibraries {
    fn default() -> Self {
        Self {
            list: preset_list_view_settings(),
            grid: preset_grid_view_settings(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PageViewSettings {
    pub default_view: ViewKind,
    #[serde(default)]
    pub common: CommonViewSettings,
    #[serde(default)]
    pub list: PageViewBinding<ListViewSettings>,
    #[serde(default)]
    pub grid: PageViewBinding<GridViewSettings>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PageViewBinding<T> {
    pub preset_id: Option<String>,
    #[serde(default)]
    pub mode: ViewBindingMode,
    pub values: T,
    pub last_preset_id: Option<String>,
}

impl<T: Default> Default for PageViewBinding<T> {
    fn default() -> Self {
        Self {
            preset_id: None,
            mode: ViewBindingMode::Preset,
            values: T::default(),
            last_preset_id: None,
        }
    }
}

impl Default for ViewBindingMode {
    fn default() -> Self {
        Self::Preset
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ViewPresetLibrary<T> {
    #[serde(default)]
    pub builtins: Vec<ViewPreset<T>>,
    #[serde(default)]
    pub customs: Vec<ViewPreset<T>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ViewPreset<T> {
    pub id: String,
    pub name: String,
    pub is_preset: bool,
    pub description: String,
    pub values: T,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub struct CommonViewSettings {
    #[serde(default)]
    pub content_density: ContentDensity,
    #[serde(default)]
    pub card_radius: CardRadius,
    #[serde(default)]
    pub shadow_level: ShadowLevel,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ListViewSettings {
    #[serde(default)]
    pub template: ListTemplate,
    #[serde(default)]
    pub row_gap: SpacingLevel,
    #[serde(default)]
    pub banner_width: BannerWidth,
    #[serde(default = "default_title_lines")]
    pub title_lines: u8,
    #[serde(default = "default_true")]
    pub show_path: bool,
    #[serde(default = "default_true")]
    pub show_app_id: bool,
    #[serde(default = "default_true")]
    pub show_last_backup: bool,
    #[serde(default = "default_true")]
    pub show_snapshot_count: bool,
    #[serde(default = "default_true")]
    pub show_playtime: bool,
    #[serde(default = "default_true")]
    pub show_install_state: bool,
    #[serde(default = "default_true")]
    pub show_running_state: bool,
    #[serde(default = "default_true")]
    pub show_badges: bool,
}

impl Default for ListViewSettings {
    fn default() -> Self {
        standard_list_values()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GridViewSettings {
    #[serde(default)]
    pub template: GridTemplate,
    #[serde(default)]
    pub grid_density: GridDensity,
    #[serde(default)]
    pub card_gap: SpacingLevel,
    #[serde(default)]
    pub cover_scale: CoverScale,
    #[serde(default = "default_true")]
    pub show_title: bool,
    #[serde(default = "default_true")]
    pub show_subtitle: bool,
    #[serde(default = "default_true")]
    pub show_last_backup: bool,
    #[serde(default = "default_true")]
    pub show_snapshot_count: bool,
    #[serde(default = "default_true")]
    pub show_playtime: bool,
    #[serde(default = "default_true")]
    pub show_install_state: bool,
    #[serde(default = "default_true")]
    pub show_running_state: bool,
    #[serde(default = "default_true")]
    pub show_badges: bool,
}

impl Default for GridViewSettings {
    fn default() -> Self {
        standard_grid_values()
    }
}

pub fn load_view_settings(path: &Path) -> Result<ViewSettingsData, anyhow::Error> {
    if !path.exists() {
        let data = default_view_settings_data();
        save_view_settings(path, &data)?;
        return Ok(data);
    }

    let json = std::fs::read_to_string(path)?;
    let data: ViewSettingsData = serde_json::from_str(&json)?;
    Ok(data)
}

pub fn save_view_settings(path: &Path, data: &ViewSettingsData) -> Result<(), anyhow::Error> {
    let json = serde_json::to_string_pretty(data)?;
    std::fs::write(path, json)?;
    Ok(())
}

pub fn default_view_settings_data() -> ViewSettingsData {
    ViewSettingsData {
        version: VERSION,
        page_settings: PageSettings::default(),
        preset_libraries: ViewPresetLibraries::default(),
    }
}

pub fn preset_list_view_settings() -> ViewPresetLibrary<ListViewSettings> {
    ViewPresetLibrary {
        builtins: vec![
            make_list_preset(
                LIST_COMPACT_PRESET_ID,
                "紧凑",
                "高密度列表，尽量压缩辅助信息。",
                compact_list_values(),
            ),
            make_list_preset(
                LIST_STANDARD_PRESET_ID,
                "标准",
                "映射当前列表布局，作为迁移后的默认基线。",
                standard_list_values(),
            ),
            make_list_preset(
                LIST_INFO_RICH_PRESET_ID,
                "信息增强",
                "保留更多辅助信息，适合管理与检索。",
                info_rich_list_values(),
            ),
            make_list_preset(
                LIST_BANNER_PRESET_ID,
                "横幅",
                "强调横向封面展示，同时保留核心状态信息。",
                banner_list_values(),
            ),
        ],
        customs: Vec::new(),
    }
}

pub fn preset_grid_view_settings() -> ViewPresetLibrary<GridViewSettings> {
    ViewPresetLibrary {
        builtins: vec![
            make_grid_preset(
                GRID_COMPACT_PRESET_ID,
                "紧凑",
                "提高网格密度，突出快速浏览。",
                compact_grid_values(),
            ),
            make_grid_preset(
                GRID_STANDARD_PRESET_ID,
                "标准",
                "映射当前封面网格布局，作为迁移后的默认基线。",
                standard_grid_values(),
            ),
            make_grid_preset(
                GRID_POSTER_WALL_PRESET_ID,
                "海报墙",
                "突出封面展示，弱化辅助信息。",
                poster_wall_grid_values(),
            ),
            make_grid_preset(
                GRID_INFO_CARD_WALL_PRESET_ID,
                "信息卡片墙",
                "在封面网格中保留更多文本与状态信息。",
                info_card_wall_grid_values(),
            ),
        ],
        customs: Vec::new(),
    }
}

pub fn reset_builtin_view_presets(data: &mut ViewSettingsData) {
    data.preset_libraries.list.builtins = preset_list_view_settings().builtins;
    data.preset_libraries.grid.builtins = preset_grid_view_settings().builtins;
}

fn make_list_preset(
    id: &str,
    name: &str,
    description: &str,
    values: ListViewSettings,
) -> ViewPreset<ListViewSettings> {
    ViewPreset {
        id: id.to_string(),
        name: name.to_string(),
        is_preset: true,
        description: description.to_string(),
        values,
    }
}

fn make_grid_preset(
    id: &str,
    name: &str,
    description: &str,
    values: GridViewSettings,
) -> ViewPreset<GridViewSettings> {
    ViewPreset {
        id: id.to_string(),
        name: name.to_string(),
        is_preset: true,
        description: description.to_string(),
        values,
    }
}

fn default_version() -> u32 {
    VERSION
}

fn default_true() -> bool {
    true
}

fn default_title_lines() -> u8 {
    1
}

fn default_launcher_page_settings() -> PageViewSettings {
    make_page_view_settings(ViewKind::Grid)
}

fn default_game_list_page_settings() -> PageViewSettings {
    make_page_view_settings(ViewKind::List)
}

fn default_inventory_page_settings() -> PageViewSettings {
    make_page_view_settings(ViewKind::Grid)
}

fn make_page_view_settings(default_view: ViewKind) -> PageViewSettings {
    PageViewSettings {
        default_view,
        common: CommonViewSettings::default(),
        list: PageViewBinding {
            preset_id: Some(LIST_STANDARD_PRESET_ID.to_string()),
            mode: ViewBindingMode::Preset,
            values: standard_list_values(),
            last_preset_id: Some(LIST_STANDARD_PRESET_ID.to_string()),
        },
        grid: PageViewBinding {
            preset_id: Some(GRID_STANDARD_PRESET_ID.to_string()),
            mode: ViewBindingMode::Preset,
            values: standard_grid_values(),
            last_preset_id: Some(GRID_STANDARD_PRESET_ID.to_string()),
        },
    }
}

fn compact_list_values() -> ListViewSettings {
    ListViewSettings {
        template: ListTemplate::Compact,
        row_gap: SpacingLevel::Tight,
        banner_width: BannerWidth::Narrow,
        title_lines: 1,
        show_path: false,
        show_app_id: false,
        show_last_backup: false,
        show_snapshot_count: true,
        show_playtime: true,
        show_install_state: true,
        show_running_state: false,
        show_badges: false,
    }
}

fn standard_list_values() -> ListViewSettings {
    ListViewSettings {
        template: ListTemplate::Standard,
        row_gap: SpacingLevel::Standard,
        banner_width: BannerWidth::Standard,
        title_lines: 1,
        show_path: true,
        show_app_id: true,
        show_last_backup: true,
        show_snapshot_count: true,
        show_playtime: true,
        show_install_state: true,
        show_running_state: true,
        show_badges: true,
    }
}

fn info_rich_list_values() -> ListViewSettings {
    ListViewSettings {
        template: ListTemplate::InfoRich,
        row_gap: SpacingLevel::Relaxed,
        banner_width: BannerWidth::Wide,
        title_lines: 2,
        show_path: true,
        show_app_id: true,
        show_last_backup: true,
        show_snapshot_count: true,
        show_playtime: true,
        show_install_state: true,
        show_running_state: true,
        show_badges: true,
    }
}

fn banner_list_values() -> ListViewSettings {
    ListViewSettings {
        template: ListTemplate::Banner,
        row_gap: SpacingLevel::Standard,
        banner_width: BannerWidth::Wide,
        title_lines: 1,
        show_path: false,
        show_app_id: true,
        show_last_backup: true,
        show_snapshot_count: true,
        show_playtime: true,
        show_install_state: true,
        show_running_state: true,
        show_badges: true,
    }
}

fn compact_grid_values() -> GridViewSettings {
    GridViewSettings {
        template: GridTemplate::Compact,
        grid_density: GridDensity::Compact,
        card_gap: SpacingLevel::Tight,
        cover_scale: CoverScale::Tight,
        show_title: true,
        show_subtitle: false,
        show_last_backup: false,
        show_snapshot_count: false,
        show_playtime: true,
        show_install_state: true,
        show_running_state: false,
        show_badges: false,
    }
}

fn standard_grid_values() -> GridViewSettings {
    GridViewSettings {
        template: GridTemplate::Standard,
        grid_density: GridDensity::Standard,
        card_gap: SpacingLevel::Standard,
        cover_scale: CoverScale::Standard,
        show_title: true,
        show_subtitle: true,
        show_last_backup: true,
        show_snapshot_count: true,
        show_playtime: true,
        show_install_state: true,
        show_running_state: true,
        show_badges: true,
    }
}

fn poster_wall_grid_values() -> GridViewSettings {
    GridViewSettings {
        template: GridTemplate::PosterWall,
        grid_density: GridDensity::Relaxed,
        card_gap: SpacingLevel::Standard,
        cover_scale: CoverScale::Showcase,
        show_title: true,
        show_subtitle: false,
        show_last_backup: false,
        show_snapshot_count: false,
        show_playtime: false,
        show_install_state: false,
        show_running_state: true,
        show_badges: false,
    }
}

fn info_card_wall_grid_values() -> GridViewSettings {
    GridViewSettings {
        template: GridTemplate::InfoCardWall,
        grid_density: GridDensity::Standard,
        card_gap: SpacingLevel::Standard,
        cover_scale: CoverScale::Standard,
        show_title: true,
        show_subtitle: true,
        show_last_backup: true,
        show_snapshot_count: true,
        show_playtime: true,
        show_install_state: true,
        show_running_state: true,
        show_badges: true,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_load_default_when_missing() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("view-settings.json");

        let data = load_view_settings(&path).unwrap();

        assert!(path.exists());
        assert_eq!(data.version, VERSION);
        assert_eq!(data.page_settings.launcher.default_view, ViewKind::Grid);
        assert_eq!(data.page_settings.game_list.default_view, ViewKind::List);
        assert_eq!(data.page_settings.inventory.default_view, ViewKind::Grid);
        assert_eq!(
            data.page_settings.launcher.list.preset_id.as_deref(),
            Some(LIST_STANDARD_PRESET_ID)
        );
        assert_eq!(
            data.page_settings.launcher.grid.preset_id.as_deref(),
            Some(GRID_STANDARD_PRESET_ID)
        );
        assert_eq!(data.preset_libraries.list.builtins.len(), 4);
        assert_eq!(data.preset_libraries.grid.builtins.len(), 4);
    }

    #[test]
    fn test_save_and_load_roundtrip() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("view-settings.json");
        let mut data = default_view_settings_data();

        data.page_settings.launcher.default_view = ViewKind::List;
        data.page_settings.inventory.common.shadow_level = ShadowLevel::Medium;
        data.preset_libraries.list.customs.push(ViewPreset {
            id: "custom-list".into(),
            name: "我的列表".into(),
            is_preset: false,
            description: "自定义列表预设".into(),
            values: banner_list_values(),
        });

        save_view_settings(&path, &data).unwrap();
        let loaded = load_view_settings(&path).unwrap();

        assert_eq!(loaded, data);
    }

    #[test]
    fn test_reset_builtin_view_presets_preserves_customs_and_pages() {
        let mut data = default_view_settings_data();
        data.page_settings.launcher.default_view = ViewKind::List;
        data.page_settings.launcher.list.mode = ViewBindingMode::Adjusted;
        data.page_settings.launcher.list.values = compact_list_values();
        data.preset_libraries.list.builtins[1].name = "改坏的标准".into();
        data.preset_libraries.grid.builtins.clear();
        data.preset_libraries.list.customs.push(ViewPreset {
            id: "custom-list".into(),
            name: "我的列表".into(),
            is_preset: false,
            description: "自定义列表预设".into(),
            values: banner_list_values(),
        });

        reset_builtin_view_presets(&mut data);

        assert_eq!(data.page_settings.launcher.default_view, ViewKind::List);
        assert_eq!(
            data.page_settings.launcher.list.mode,
            ViewBindingMode::Adjusted
        );
        assert_eq!(
            data.page_settings.launcher.list.values,
            compact_list_values()
        );
        assert_eq!(data.preset_libraries.list.builtins.len(), 4);
        assert_eq!(data.preset_libraries.grid.builtins.len(), 4);
        assert_eq!(
            data.preset_libraries.list.builtins[1].id,
            LIST_STANDARD_PRESET_ID
        );
        assert_eq!(data.preset_libraries.list.builtins[1].name, "标准");
        assert_eq!(data.preset_libraries.list.customs.len(), 1);
        assert_eq!(data.preset_libraries.list.customs[0].id, "custom-list");
    }
}
