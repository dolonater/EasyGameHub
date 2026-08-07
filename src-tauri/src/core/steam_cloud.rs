use steam_sdk::local::cloud as local_cloud;

pub use local_cloud::{LocalCloudEntry, LocalCloudFile, LocalCloudQuota};

pub fn get_files(app_id: u32) -> Result<Vec<LocalCloudFile>, String> {
    local_cloud::get_files(app_id).map_err(|e| e.to_string())
}

pub fn get_quota(app_id: u32) -> Result<LocalCloudQuota, String> {
    local_cloud::get_quota(app_id).map_err(|e| e.to_string())
}

pub fn get_entries(app_id: u32) -> Result<Vec<LocalCloudEntry>, String> {
    local_cloud::get_entries(app_id).map_err(|e| e.to_string())
}

pub fn read_file(app_id: u32, filename: &str) -> Result<Vec<u8>, String> {
    local_cloud::read_file(app_id, filename).map_err(|e| e.to_string())
}

pub fn write_file(app_id: u32, filename: &str, bytes: &[u8]) -> Result<(), String> {
    local_cloud::write_file(app_id, filename, bytes).map_err(|e| e.to_string())
}

pub fn delete_file(app_id: u32, filename: &str) -> Result<(), String> {
    local_cloud::delete_file(app_id, filename).map_err(|e| e.to_string())
}
