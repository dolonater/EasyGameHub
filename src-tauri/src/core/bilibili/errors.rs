use bpi_rs::BpiError;

use super::models::{BiliErrorDto, BiliErrorKind};

pub fn to_error_dto(error: &BpiError) -> BiliErrorDto {
    if error.requires_login() {
        let kind = if error.to_string().to_ascii_lowercase().contains("expired") {
            BiliErrorKind::LoginExpired
        } else {
            BiliErrorKind::NotLoggedIn
        };
        return BiliErrorDto::new(kind, error.to_string(), false);
    }
    if error.requires_vip() {
        return BiliErrorDto::new(BiliErrorKind::VipRequired, error.to_string(), false);
    }
    if error.is_permission_error() {
        return BiliErrorDto::new(BiliErrorKind::PermissionDenied, error.to_string(), false);
    }
    if error.is_risk_control() {
        return BiliErrorDto::new(BiliErrorKind::RiskControl, error.to_string(), true);
    }
    if matches!(
        error,
        BpiError::Network { .. }
            | BpiError::Transport { .. }
            | BpiError::Http { .. }
            | BpiError::HttpStatus { .. }
    ) {
        return BiliErrorDto::new(BiliErrorKind::Network, error.to_string(), true);
    }
    let message = error.to_string();
    if message.contains("版权") || message.to_ascii_lowercase().contains("copyright") {
        return BiliErrorDto::new(BiliErrorKind::CopyrightRestricted, message, false);
    }
    if message.contains("地区") || message.to_ascii_lowercase().contains("region") {
        return BiliErrorDto::new(BiliErrorKind::RegionRestricted, message, false);
    }

    BiliErrorDto::new(BiliErrorKind::Api, message, false)
}

#[cfg(test)]
mod tests {
    use bpi_rs::BpiError;

    use super::*;

    #[test]
    fn maps_login_errors_to_not_logged_in() {
        let dto = to_error_dto(&BpiError::from_code(-101));

        assert!(matches!(dto.kind, BiliErrorKind::NotLoggedIn));
        assert!(!dto.retryable);
    }

    #[test]
    fn maps_vip_errors_to_vip_required() {
        let dto = to_error_dto(&BpiError::from_code(-106));

        assert!(matches!(dto.kind, BiliErrorKind::VipRequired));
        assert!(!dto.retryable);
    }

    #[test]
    fn maps_risk_control_as_retryable() {
        let dto = to_error_dto(&BpiError::from_code(-352));

        assert!(matches!(dto.kind, BiliErrorKind::RiskControl));
        assert!(dto.retryable);
    }
}
