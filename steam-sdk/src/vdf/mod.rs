//! Valve Data Format (VDF) parser and writer.
//!
//! VDF is Valve's custom key-value format used by Steam for configuration files
//! such as `loginusers.vdf`, `config.vdf`, `localconfig.vdf`, etc.
//!
//! ## Format
//!
//! ```vdf
//! "root"
//! {
//!     "key1"     "value1"
//!     "key2"
//!     {
//!         "nested"     "value"
//!     }
//! }
//! ```
//!
//! ## Features
//!
//! - Parse VDF text format into a tree of [`VdfValue`] nodes
//! - Write [`VdfValue`] trees back to VDF text format
//! - In-place modification: read → modify → write preserving formatting

mod parser;
mod writer;

pub use parser::parse_vdf;
pub use writer::write_vdf;

use std::collections::BTreeMap;

/// A value in a VDF document — either a string or a nested map.
///
/// Map entries are stored in a `Vec` to preserve insertion order (important
/// for writing back without disturbing Steam's expected ordering).
#[derive(Debug, Clone, PartialEq)]
pub enum VdfValue {
    /// A leaf string value, e.g. `"value"`.
    String(String),
    /// A nested block, e.g. `{ "k" "v" }`.  Entries are (key, value) pairs.
    Map(Vec<(String, VdfValue)>),
}

impl VdfValue {
    /// Return `true` if this is a [`VdfValue::String`].
    pub fn is_string(&self) -> bool {
        matches!(self, VdfValue::String(_))
    }

    /// Return `true` if this is a [`VdfValue::Map`].
    pub fn is_map(&self) -> bool {
        matches!(self, VdfValue::Map(_))
    }

    /// If this is a `String`, return the inner string reference.
    pub fn as_str(&self) -> Option<&str> {
        match self {
            VdfValue::String(s) => Some(s.as_str()),
            _ => None,
        }
    }

    /// If this is a `Map`, return a reference to the entries vector.
    pub fn as_map(&self) -> Option<&Vec<(String, VdfValue)>> {
        match self {
            VdfValue::Map(m) => Some(m),
            _ => None,
        }
    }

    /// Look up a key in a map. Returns `None` if this is not a map or the key
    /// is not present.
    pub fn get(&self, key: &str) -> Option<&VdfValue> {
        match self {
            VdfValue::Map(entries) => entries.iter().find(|(k, _)| k == key).map(|(_, v)| v),
            _ => None,
        }
    }

    /// Look up a key in a map mutably.
    pub fn get_mut(&mut self, key: &str) -> Option<&mut VdfValue> {
        match self {
            VdfValue::Map(entries) => entries.iter_mut().find(|(k, _)| k == key).map(|(_, v)| v),
            _ => None,
        }
    }

    /// Set a key-value pair in a map. If the key already exists, the value is
    /// replaced. If this is not a map, does nothing.
    pub fn set(&mut self, key: &str, value: VdfValue) {
        if let VdfValue::Map(entries) = self {
            if let Some(pos) = entries.iter().position(|(k, _)| k == key) {
                entries[pos] = (key.to_string(), value);
            } else {
                entries.push((key.to_string(), value));
            }
        }
    }

    /// Recursively navigate a path of keys and return a reference to the value.
    ///
    /// Example: `root.navigate(&["Software", "Valve", "Steam"])`
    pub fn navigate(&self, path: &[&str]) -> Option<&VdfValue> {
        let mut current = self;
        for key in path {
            current = current.get(key)?;
        }
        Some(current)
    }

    /// Recursively navigate a path of keys and return a mutable reference.
    pub fn navigate_mut(&mut self, path: &[&str]) -> Option<&mut VdfValue> {
        let mut current = self;
        for key in path {
            current = current.get_mut(key)?;
        }
        Some(current)
    }

    /// Ensure a nested path exists, creating intermediate Map nodes as needed,
    /// and set the final leaf to the given value.
    ///
    /// Example: `root.ensure_path(&["A", "B", "C"], VdfValue::String("val".into()))`
    /// creates `"A" { "B" { "C" "val" } }` if it doesn't exist.
    pub fn ensure_path(&mut self, path: &[&str], value: VdfValue) {
        if path.is_empty() {
            return;
        }

        let (leaf_key, ancestors) = path.split_last().unwrap();
        let mut current = self;

        // Walk/create intermediate nodes
        for key in ancestors {
            let needs_create = match current {
                VdfValue::Map(entries) => !entries.iter().any(|(k, _)| k == key),
                _ => true,
            };
            if needs_create {
                current.set(key, VdfValue::Map(Vec::new()));
            }
            // get_mut after set should succeed
            current = current.get_mut(key).unwrap();
        }

        current.set(leaf_key, value);
    }

    /// Collect all leaf key-value pairs into a flat map using dot-separated paths.
    ///
    /// For example, `{"a": {"b": "c"}}` becomes `{"a.b": "c"}`.
    pub fn flatten(&self) -> BTreeMap<String, String> {
        let mut result = BTreeMap::new();
        self.flatten_into(String::new(), &mut result);
        result
    }

    fn flatten_into(&self, prefix: String, out: &mut BTreeMap<String, String>) {
        match self {
            VdfValue::String(s) => {
                out.insert(prefix, s.clone());
            }
            VdfValue::Map(entries) => {
                for (key, value) in entries {
                    let path = if prefix.is_empty() {
                        key.clone()
                    } else {
                        format!("{}.{}", prefix, key)
                    };
                    value.flatten_into(path, out);
                }
            }
        }
    }
}
