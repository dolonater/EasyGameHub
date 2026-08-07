//! VDF text format parser.
//!
//! Parses Valve Data Format text into a [`VdfValue`] tree.

use super::VdfValue;
use crate::error::VdfError;

/// Parse a VDF text string into a [`VdfValue`] tree.
///
/// The root of a VDF document is always a single key-value pair (typically a
/// key with a Map value), so the returned value is that root entry as a Map.
///
/// # Errors
///
/// Returns [`VdfError::Parse`] if the input is malformed.
/// Returns [`VdfError::UnmatchedBrace`] if braces are unbalanced.
pub fn parse_vdf(input: &str) -> Result<VdfValue, VdfError> {
    let mut parser = Parser::new(input);
    parser.parse_root()
}

/// Internal parser state.
struct Parser<'a> {
    /// Remaining input bytes.
    input: &'a [u8],
    /// Current position (byte offset from original start).
    pos: usize,
    /// Current line number (1-based).
    line: usize,
}

impl<'a> Parser<'a> {
    fn new(input: &'a str) -> Self {
        // Skip BOM if present
        let bytes = input.as_bytes();
        let bytes = if bytes.len() >= 3 && bytes[0] == 0xEF && bytes[1] == 0xBB && bytes[2] == 0xBF
        {
            &bytes[3..]
        } else {
            bytes
        };

        Self {
            input: bytes,
            pos: 0,
            line: 1,
        }
    }

    /// Peek at the next byte without consuming it.
    fn peek(&self) -> Option<u8> {
        self.input.first().copied()
    }

    /// Consume and return the next byte.
    fn next_byte(&mut self) -> Option<u8> {
        if let Some((&first, rest)) = self.input.split_first() {
            if first == b'\n' {
                self.line += 1;
            }
            self.pos += 1;
            self.input = rest;
            Some(first)
        } else {
            None
        }
    }

    /// Skip whitespace and comments; return the next meaningful byte or None.
    fn skip_whitespace_and_comments(&mut self) -> Option<u8> {
        loop {
            match self.peek() {
                // Whitespace
                Some(b' ') | Some(b'\t') | Some(b'\r') | Some(b'\n') => {
                    self.next_byte();
                }
                // Line comment: skip to end of line
                Some(b'/') => {
                    // Check for //
                    let after = self.input.get(1).copied();
                    if after == Some(b'/') {
                        self.next_byte(); // skip first /
                        self.next_byte(); // skip second /
                                          // Skip until newline or EOF
                        loop {
                            match self.peek() {
                                Some(b'\n') | None => break,
                                _ => {
                                    self.next_byte();
                                }
                            }
                        }
                    } else {
                        // Not a comment; just a slash character
                        return Some(b'/');
                    }
                }
                Some(_) => return self.peek(),
                None => return None,
            }
        }
    }

    /// Read a quoted string (including the surrounding quotes).
    fn read_string(&mut self) -> Result<String, VdfError> {
        // Expect opening quote
        match self.next_byte() {
            Some(b'"') => {}
            Some(_) => {
                return Err(VdfError::Parse {
                    line: self.line,
                    message: "expected opening quote '\"'".into(),
                });
            }
            None => {
                return Err(VdfError::Parse {
                    line: self.line,
                    message: "unexpected end of input while reading string".into(),
                });
            }
        }

        let mut buf = Vec::new();
        let mut escape = false;

        loop {
            match self.next_byte() {
                None => {
                    return Err(VdfError::Parse {
                        line: self.line,
                        message: "unterminated string".into(),
                    });
                }
                Some(b'"') if !escape => {
                    // Closing quote — done
                    break;
                }
                Some(b'\\') if !escape => {
                    escape = true;
                }
                Some(b) if escape => {
                    // Handle escape sequence
                    match b {
                        b'"' => buf.push(b'"'),
                        b'\\' => buf.push(b'\\'),
                        b'n' => buf.push(b'\n'),
                        b't' => buf.push(b'\t'),
                        b'r' => buf.push(b'\r'),
                        b'/' => buf.push(b'/'),
                        _ => {
                            // Unknown escape: keep both characters
                            buf.push(b'\\');
                            buf.push(b);
                        }
                    }
                    escape = false;
                }
                Some(b) => {
                    buf.push(b);
                }
            }
        }

        // Convert raw bytes to UTF-8 string (preserves multibyte characters)
        String::from_utf8(buf).map_err(|e| VdfError::Parse {
            line: self.line,
            message: format!("invalid UTF-8 in string: {}", e),
        })
    }

    /// Parse the root level: expects a key + value (map or string).
    fn parse_root(&mut self) -> Result<VdfValue, VdfError> {
        // A VDF document is one key-value pair at the top.
        // Read the root key name.
        self.skip_whitespace_and_comments();

        let root_key = self.read_string()?;

        self.skip_whitespace_and_comments();

        let root_value = self.parse_value()?;

        // Wrap the root key-value pair in a Map with a single entry.
        Ok(VdfValue::Map(vec![(root_key, root_value)]))
    }

    /// Parse a single value: either a `{ ... }` map or a quoted string.
    fn parse_value(&mut self) -> Result<VdfValue, VdfError> {
        match self.peek() {
            Some(b'{') => self.parse_map(),
            Some(b'"') => Ok(VdfValue::String(self.read_string()?)),
            Some(_) => Err(VdfError::Parse {
                line: self.line,
                message: format!(
                    "unexpected character '{}' (expected '{{' or '\"')",
                    self.peek().unwrap() as char
                ),
            }),
            None => Err(VdfError::Parse {
                line: self.line,
                message: "unexpected end of input (expected value)".into(),
            }),
        }
    }

    /// Parse a `{ key key ... }` map block.
    fn parse_map(&mut self) -> Result<VdfValue, VdfError> {
        // Consume opening brace
        match self.next_byte() {
            Some(b'{') => {}
            Some(c) => {
                return Err(VdfError::Parse {
                    line: self.line,
                    message: format!("expected '{{' but got '{}'", c as char),
                });
            }
            None => {
                return Err(VdfError::Parse {
                    line: self.line,
                    message: "unexpected end of input (expected '{{')".into(),
                });
            }
        }

        let mut entries: Vec<(String, VdfValue)> = Vec::new();

        loop {
            self.skip_whitespace_and_comments();

            match self.peek() {
                // Closing brace — map is complete
                Some(b'}') => {
                    self.next_byte();
                    break;
                }
                // A key means another entry
                Some(b'"') => {
                    let key = self.read_string()?;
                    self.skip_whitespace_and_comments();
                    let value = self.parse_value()?;
                    entries.push((key, value));
                }
                // EOF inside map is an error
                None => {
                    return Err(VdfError::UnmatchedBrace { line: self.line });
                }
                Some(_) => {
                    let c = self.peek().unwrap() as char;
                    return Err(VdfError::Parse {
                        line: self.line,
                        message: format!(
                            "unexpected character '{}' in map (expected key or '}}')",
                            c
                        ),
                    });
                }
            }
        }

        Ok(VdfValue::Map(entries))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_simple_string() {
        let input = r#""root" "value""#;
        let result = parse_vdf(input).unwrap();
        assert_eq!(
            result,
            VdfValue::Map(vec![("root".into(), VdfValue::String("value".into()))])
        );
    }

    #[test]
    fn test_parse_nested_map() {
        let input = r#"
"root"
{
    "child1"    "val1"
    "child2"
    {
        "grandchild"    "gc_val"
    }
}
"#;
        let result = parse_vdf(input).unwrap();
        let root_map = result.as_map().unwrap();
        assert_eq!(root_map[0].0, "root");

        let children = root_map[0].1.as_map().unwrap();
        assert_eq!(children[0].0, "child1");
        assert_eq!(children[0].1.as_str().unwrap(), "val1");

        assert_eq!(children[1].0, "child2");
        let grandchildren = children[1].1.as_map().unwrap();
        assert_eq!(grandchildren[0].0, "grandchild");
        assert_eq!(grandchildren[0].1.as_str().unwrap(), "gc_val");
    }

    #[test]
    fn test_parse_loginusers_vdf() {
        // Simulated loginusers.vdf structure
        let input = r#"
"users"
{
    "76561199091385455"
    {
        "AccountName"       "johndoe"
        "PersonaName"       "John"
        "RememberPassword"      "1"
    }
}
"#;
        let result = parse_vdf(input).unwrap();
        let users = result.get("users").unwrap();
        let user = users.get("76561199091385455").unwrap();
        assert_eq!(
            user.get("AccountName").unwrap().as_str().unwrap(),
            "johndoe"
        );
        assert_eq!(user.get("RememberPassword").unwrap().as_str().unwrap(), "1");
    }

    #[test]
    fn test_parse_with_comments() {
        let input = r#"
// This is a comment
"root"
{
    "key" "value" // inline comment
}
"#;
        let result = parse_vdf(input).unwrap();
        assert!(result.get("root").is_some());
    }

    #[test]
    fn test_parse_escape_sequences() {
        let input = r#""key" "hello\"world\\test""#;
        let result = parse_vdf(input).unwrap();
        assert_eq!(
            result.get("key").unwrap().as_str().unwrap(),
            "hello\"world\\test"
        );
    }

    #[test]
    fn test_parse_with_bom() {
        let input = "\u{FEFF}\"root\" \"value\"";
        let result = parse_vdf(input).unwrap();
        assert_eq!(result.get("root").unwrap().as_str().unwrap(), "value");
    }

    #[test]
    fn test_parse_unmatched_brace() {
        let input = "\"root\" { \"key\" \"val\"";
        assert!(parse_vdf(input).is_err());
    }

    #[test]
    fn test_navigate() {
        let input = r#"
"Config"
{
    "Software"
    {
        "Valve"
        {
            "Steam"
            {
                "AutoLoginUser"     "testuser"
            }
        }
    }
}
"#;
        let result = parse_vdf(input).unwrap();
        let val = result
            .navigate(&["Config", "Software", "Valve", "Steam", "AutoLoginUser"])
            .unwrap();
        assert_eq!(val.as_str().unwrap(), "testuser");
    }
}
