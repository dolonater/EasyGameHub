//! VDF text format writer.
//!
//! Serializes a [`VdfValue`] tree back to VDF text format.

use super::VdfValue;
use crate::error::VdfError;
use std::fs;
use std::io::Write;
use std::path::Path;

/// Write a [`VdfValue`] tree to a VDF-formatted string.
///
/// The output preserves the format expected by Steam, using tab indentation
/// and proper escaping.
pub fn write_vdf_to_string(value: &VdfValue) -> String {
    let mut buf = Vec::new();
    write_value(&mut buf, value, 0);
    // VDF files typically end with a trailing newline and don't have one
    // already (the recursive writer adds newlines after each entry)
    String::from_utf8(buf).unwrap_or_default()
}

/// Write a [`VdfValue`] tree to a file.
///
/// Uses `FileMode::Create` to fully replace the file content, matching
/// SteamTools' behavior (avoids leftover bytes from a longer previous file).
pub fn write_vdf(path: &Path, value: &VdfValue) -> Result<(), VdfError> {
    let content = write_vdf_to_string(value);
    fs::write(path, content).map_err(VdfError::Io)
}

/// Update a specific key path in a VDF file while preserving the rest of the
/// file's content.
///
/// This is a convenience function that:
/// 1. Parses the existing file
/// 2. Navigates to the target path and sets the value
/// 3. Writes the entire tree back
///
/// For large files where performance matters, consider implementing a
/// line-by-line patcher instead.
pub fn update_vdf_key(path: &Path, key_path: &[&str], new_value: &str) -> Result<(), VdfError> {
    let content = fs::read_to_string(path).map_err(VdfError::Io)?;
    let mut root = super::parse_vdf(&content)?;

    // Navigate to the parent, then set the leaf key
    if key_path.is_empty() {
        return Err(VdfError::Parse {
            line: 0,
            message: "empty key path".into(),
        });
    }

    if key_path.len() == 1 {
        // Top-level key: set directly on root map
        root.set(key_path[0], VdfValue::String(new_value.to_string()));
    } else {
        let (parent_path, leaf_key) = key_path.split_at(key_path.len() - 1);
        let leaf_key = leaf_key[0];

        let parent = root
            .navigate_mut(parent_path)
            .ok_or_else(|| VdfError::Parse {
                line: 0,
                message: format!("key path not found: {:?}", parent_path),
            })?;

        parent.set(leaf_key, VdfValue::String(new_value.to_string()));
    }

    write_vdf(path, &root)
}

/// Recursively write a VdfValue with the given indentation level.
fn write_value<W: Write>(w: &mut W, value: &VdfValue, indent: usize) {
    match value {
        VdfValue::String(_) => {
            // Leaf strings are always written as part of a key-value pair by
            // write_entry; if we're here it means a standalone string was
            // passed directly (shouldn't normally happen in practice).
        }
        VdfValue::Map(entries) => {
            for (key, val) in entries {
                write_entry(w, key, val, indent);
            }
        }
    }
}

/// Write a single key-value entry.
fn write_entry<W: Write>(w: &mut W, key: &str, value: &VdfValue, indent: usize) {
    let tabs = "\t".repeat(indent);

    match value {
        VdfValue::String(s) => {
            let _ = writeln!(w, "{}\"{}\"\t\t\"{}\"", tabs, escape(key), escape(s));
        }
        VdfValue::Map(entries) => {
            let _ = writeln!(w, "{}\"{}\"", tabs, escape(key));
            let _ = writeln!(w, "{}", format!("{}{{", tabs));
            for (k, v) in entries {
                write_entry(w, k, v, indent + 1);
            }
            let _ = writeln!(w, "{}}}", tabs);
        }
    }
}

/// Escape a string for VDF output.
///
/// Only `\` and `"` need escaping in VDF values.
fn escape(s: &str) -> String {
    let mut result = String::with_capacity(s.len());
    for ch in s.chars() {
        match ch {
            '\\' => result.push_str("\\\\"),
            '"' => result.push_str("\\\""),
            '\n' => result.push_str("\\n"),
            '\t' => result.push_str("\\t"),
            '\r' => result.push_str("\\r"),
            _ => result.push(ch),
        }
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_write_roundtrip() {
        let input = r#"
"users"
{
    "123456789"
    {
        "AccountName"       "testuser"
        "RememberPassword"      "1"
    }
}
"#;
        let parsed = super::super::parse_vdf(input).unwrap();
        let output = write_vdf_to_string(&parsed);

        // Re-parse the output and verify it's equivalent
        let re_parsed = super::super::parse_vdf(&output).unwrap();
        assert_eq!(
            re_parsed
                .get("users")
                .unwrap()
                .get("123456789")
                .unwrap()
                .get("AccountName")
                .unwrap()
                .as_str()
                .unwrap(),
            "testuser"
        );
    }

    #[test]
    fn test_escape_string() {
        assert_eq!(escape(r#"hello"world"#), r#"hello\"world"#);
        assert_eq!(escape(r#"path\to\file"#), r#"path\\to\\file"#);
    }

    #[test]
    fn test_update_vdf_key() {
        let input = r#"
"Config"
{
    "Setting"       "old_value"
    "Other"     "keep_me"
}
"#;
        let parsed = super::super::parse_vdf(input).unwrap();
        let mut root = parsed.clone();

        // Navigate and update
        root.navigate_mut(&["Config", "Setting"])
            .map(|v| *v = VdfValue::String("new_value".into()));

        let output = write_vdf_to_string(&root);
        let re_parsed = super::super::parse_vdf(&output).unwrap();

        assert_eq!(
            re_parsed
                .navigate(&["Config", "Setting"])
                .unwrap()
                .as_str()
                .unwrap(),
            "new_value"
        );
        // Other key should be untouched
        assert_eq!(
            re_parsed
                .navigate(&["Config", "Other"])
                .unwrap()
                .as_str()
                .unwrap(),
            "keep_me"
        );
    }

    #[test]
    fn test_write_nested_structure() {
        let input = r#"
"InstallConfigStore"
{
    "Software"
    {
        "Valve"
        {
            "Steam"
            {
                "AlwaysShowUserChooser"     "0"
            }
        }
    }
}
"#;
        let parsed = super::super::parse_vdf(input).unwrap();
        let output = write_vdf_to_string(&parsed);

        let re_parsed = super::super::parse_vdf(&output).unwrap();
        let val = re_parsed
            .navigate(&[
                "InstallConfigStore",
                "Software",
                "Valve",
                "Steam",
                "AlwaysShowUserChooser",
            ])
            .unwrap();
        assert_eq!(val.as_str().unwrap(), "0");
    }
}
