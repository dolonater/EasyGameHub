use steam_sdk::client::local_inventory;
use steam_sdk::local::steam_path::detect_steam;
use steam_sdk::local::steam_service::parse_appinfo_vdf;

fn main() {
    let ids: Vec<u32> = std::env::args()
        .skip(1)
        .filter_map(|arg| arg.parse::<u32>().ok())
        .collect();

    let install = detect_steam().expect("Steam not found");
    let apps = parse_appinfo_vdf(&install.path).expect("parse_appinfo_vdf failed");
    let local_games = local_inventory::get_local_games().expect("get_local_games failed");

    for app_id in ids {
        let appinfo = apps.iter().find(|app| app.app_id == app_id);
        let local = local_games.iter().find(|game| game.app_id == app_id);

        println!("=== {} ===", app_id);
        println!(
            "appinfo.name={:?}",
            appinfo.and_then(|app| app.name.as_deref())
        );
        println!("appinfo.type={:?}", appinfo.and_then(|app| app.app_type));
        println!(
            "local.name={:?}",
            local.and_then(|game| game.name.as_deref())
        );
        println!("local.installed={:?}", local.map(|game| game.is_installed));
        println!(
            "local.install_dir={:?}",
            local.and_then(|game| game.install_dir.as_deref())
        );
        println!();
    }
}
