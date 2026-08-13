use std::sync::OnceLock;
use std::time::Duration;

static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();

fn client() -> &'static reqwest::Client {
    CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
            .connect_timeout(Duration::from_secs(5))
            .build()
            .unwrap()
    })
}

#[test]
fn debug_cover_concurrent() {
    let rt = tokio::runtime::Runtime::new().unwrap();
    rt.block_on(async {
        let urls: Vec<String> = (0..24)
            .map(|i| format!("http://i1.hdslb.com/bfs/archive/02f05d586f322cd97a42ba3468666d887270454f.jpg?x={i}"))
            .collect();
        let mut tasks = Vec::new();
        for url in urls {
            let url_clone = url.clone();
            tasks.push(tokio::spawn(async move {
                match client().get(&url_clone)
                    .header("Referer", "https://www.bilibili.com/")
                    .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
                    .send().await
                {
                    Ok(resp) => {
                        let ct = resp.headers().get("content-type").and_then(|v| v.to_str().ok()).unwrap_or("none").to_string();
                        format!("OK status={} ct={}", resp.status(), ct)
                    }
                    Err(e) => format!("ERR {}", e),
                }
            }));
        }
        let mut ok = 0;
        let mut fail = 0;
        for task in tasks {
            let r = task.await.unwrap();
            if r.starts_with("OK") { ok += 1; } else { fail += 1; println!("{r}"); }
        }
        println!("total: ok={ok} fail={fail}");
    });
}
