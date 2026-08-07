/// Build script for steam-sdk.
///
/// Compiles Steam authentication protobuf definitions from `proto/steam-protobufs/`
/// using `prost-build`. Requires `protoc` to be available.
///
/// Proto files sourced from: https://github.com/SteamDatabase/Protobufs

fn main() {
    let proto_dir = "proto/steam-protobufs/steam";
    let google_include = "protoc/include"; // Standard google/protobuf/ types

    let auth_proto = format!("{}/steammessages_auth.steamclient.proto", proto_dir);

    if !std::path::Path::new(&auth_proto).exists() {
        println!(
            "cargo:warning=Auth proto not found at {} — skipping protobuf compilation.",
            auth_proto
        );
        return;
    }

    // Point to the locally-installed protoc
    let protoc_path = std::path::Path::new("protoc/bin/protoc.exe");
    if protoc_path.exists() {
        std::env::set_var("PROTOC", protoc_path.canonicalize().unwrap());
        println!("cargo:warning=Using protoc at {}", protoc_path.display());
    }

    println!("cargo:rerun-if-changed={}/", proto_dir);

    let protos: Vec<String> = std::fs::read_dir(proto_dir)
        .expect("Failed to read proto directory")
        .filter_map(|entry| {
            let entry = entry.ok()?;
            let path = entry.path();
            if path.extension()?.to_str()? == "proto" {
                Some(path.to_string_lossy().to_string())
            } else {
                None
            }
        })
        .collect();

    if protos.is_empty() {
        println!("cargo:warning=No .proto files found in {}", proto_dir);
        return;
    }

    println!(
        "cargo:warning=Compiling {} Steam protobuf files from {}",
        protos.len(),
        proto_dir
    );

    let mut config = prost_build::Config::new();
    config.out_dir(std::env::var("OUT_DIR").unwrap());

    config
        .compile_protos(&protos, &[proto_dir, google_include])
        .expect("Failed to compile Steam protobufs");

    println!("cargo:warning=Protobuf compilation successful.");
}
