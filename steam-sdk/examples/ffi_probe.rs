//! 临时诊断程序：直接调用 Steam FFI 成就读取路径，复现时长统计页卡死/闪退问题。
//! 用后即删。运行：cargo run -p steam-sdk --example ffi_probe --release
use std::time::Instant;

fn main() {
    let install = steam_sdk::local::steam_path::detect_steam();
    println!(
        "detect_steam: {:?}",
        install.as_ref().map(|i| i.path.clone())
    );
    let Ok(install) = install else { return };

    // 从用户库挑几个有存档的游戏
    let probes: Vec<u32> = vec![
        730, 570, 252490, 1085660, 322330, 236390, 1245620, 281990, 431960, 227300,
    ];

    let steamclient = install.path.join("steamclient64.dll");
    println!(
        "steamclient64.dll exists: {} ({})",
        steamclient.exists(),
        steamclient.display()
    );

    let stats_dir = install.path.join("appcache").join("stats");
    let mut schemas: Vec<u32> = Vec::new();
    if let Ok(rd) = std::fs::read_dir(&stats_dir) {
        for e in rd.flatten() {
            let name = e.file_name().to_string_lossy().to_string();
            if let Some(rest) = name.strip_prefix("UserGameStatsSchema_") {
                if let Some(num) = rest.strip_suffix(".bin") {
                    if let Ok(id) = num.parse::<u32>() {
                        schemas.push(id);
                    }
                }
            }
        }
    }
    println!("本地成就 schema 数量: {}", schemas.len());

    for &app_id in &probes {
        let path = stats_dir.join(format!("UserGameStatsSchema_{}.bin", app_id));
        if !path.exists() {
            println!("app {} 无本地 schema, 跳过", app_id);
            continue;
        }
        let t0 = Instant::now();
        match steam_sdk::client::achievements::get_achievements_local_first(
            &steam_sdk::SteamHttpClient::new(),
            0,
            app_id,
        ) {
            Ok((pct, list, live, err)) => {
                println!(
                    "app {}: OK pct={:.1} list={} live={} err={:?} ({:?})",
                    app_id,
                    pct,
                    list.len(),
                    live,
                    err,
                    t0.elapsed()
                );
            }
            Err(e) => {
                println!("app {}: ERR {} ({:?})", app_id, e, t0.elapsed());
            }
        }
    }
    println!("probe done");
}
