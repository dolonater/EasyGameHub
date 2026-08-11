import { useEffect, useRef, useState } from "sdk";
import { errorMessage } from "../runtime";

interface UsePagedFeedOptions {
  /** 标识变化时自动重置到第一页并加载（如搜索关键词） */
  key?: string | number;
  /** false 时不加载并清空数据（如空关键词搜索、懒加载模式） */
  enabled?: boolean;
}

interface UsePagedFeedResult<T> {
  items: T[];
  page: number;
  loading: boolean;
  error: string;
  /** 换一批：page+1 并绕过缓存（对齐现有"刷新"语义） */
  reload(): void;
  /** 重新加载第一页（同词重提交场景） */
  reset(): void;
}

/**
 * 分页 feed 状态机。每个调用方持有独立实例，互不污染。
 * - key 变化时自动重置到第一页并加载
 * - enabled 为 false 时不加载并清空数据
 * - 用请求序号丢弃过期响应，避免旧响应覆盖新内容
 */
export function usePagedFeed<T>(
  fetcher: (page: number, refresh: boolean) => Promise<T[]>,
  options: UsePagedFeedOptions = {},
): UsePagedFeedResult<T> {
  const { key, enabled = true } = options;
  const [items, setItems] = useState<T[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestSeqRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      requestSeqRef.current += 1;
      setItems([]);
      setPage(1);
      setError("");
      setLoading(false);
      return;
    }
    void load(1, false);
    return () => {
      requestSeqRef.current += 1;
    };
    // key/enabled 是加载触发源；fetcher 只读闭包，不需纳入 deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  async function load(targetPage: number, refresh: boolean) {
    const seq = requestSeqRef.current + 1;
    requestSeqRef.current = seq;
    setLoading(true);
    setError("");
    try {
      const next = await fetcher(targetPage, refresh);
      if (requestSeqRef.current !== seq) return;
      setItems(next);
      setPage(targetPage);
    } catch (err) {
      if (requestSeqRef.current !== seq) return;
      setError(errorMessage(err));
    } finally {
      if (requestSeqRef.current === seq) setLoading(false);
    }
  }

  function reload() {
    void load(page + 1, true);
  }

  function reset() {
    void load(1, false);
  }

  return { items, page, loading, error, reload, reset };
}
