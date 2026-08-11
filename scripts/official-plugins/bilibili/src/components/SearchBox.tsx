import React, { TextField, useEffect, useRef, useState } from "sdk";
import { getState } from "../runtime";

interface SearchBoxProps {
  value: string;
  onChange(value: string): void;
  onSubmit(): void;
  placeholder?: string;
  disabled?: boolean;
}

/** 搜索输入框 + 联想下拉（suggest，300ms debounce；空词不请求） */
export function SearchBox({ value, onChange, onSubmit, placeholder, disabled }: SearchBoxProps) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const keyword = value.trim();
    if (!keyword) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      const sdk = getState().sdk;
      if (!sdk) return;
      sdk.bilibili.search
        .suggest(keyword)
        .then((data) => {
          if (!cancelled) {
            setSuggestions(data);
            setOpen(data.length > 0);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setSuggestions([]);
            setOpen(false);
          }
        });
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [value]);

  useEffect(() => {
    function onDocumentClick(event: MouseEvent) {
      const el = containerRef.current;
      if (el && event.target instanceof Node && !el.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocumentClick);
    return () => document.removeEventListener("mousedown", onDocumentClick);
  }, []);

  function pickSuggestion(keyword: string) {
    onChange(keyword);
    setOpen(false);
    onSubmit();
  }

  return (
    <div className="bili-search-box" ref={containerRef}>
      <TextField
        value={value}
        disabled={disabled}
        onChange={(event: any) => onChange(event.currentTarget.value)}
        placeholder={placeholder}
        onFocus={() => {
          if (suggestions.length > 0) setOpen(true);
        }}
      />
      {open ? (
        <ul className="bili-suggest-dropdown" role="listbox">
          {suggestions.map((item, index) => (
            <li key={`${item}-${index}`}>
              <button type="button" className="bili-suggest-item" onClick={() => pickSuggestion(item)}>
                {item}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
