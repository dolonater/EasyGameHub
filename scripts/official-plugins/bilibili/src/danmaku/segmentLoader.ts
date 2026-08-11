import type { BiliDanmakuItem, PluginSdk } from "../types";

/** 每段弹幕时长（秒），与后端 seg 接口一致（6 分钟）。 */
export const SEGMENT_SECONDS = 360;

/** 预取范围：当前段 ± 2 段。 */
const PREFETCH_RADIUS = 2;

export interface DanmakuSegmentLoaderOptions {
  sdk: PluginSdk | null;
  cid: number;
  aid?: number;
  /** 某段弹幕加载成功后回调（按段索引递增提供，调用方合并去重）。 */
  onSegment(items: BiliDanmakuItem[], segmentIndex: number): void;
  /** 分段失败降级为全量 XML 时回调（只触发一次）。 */
  onFallback(items: BiliDanmakuItem[]): void;
  onError(message: string): void;
}

/**
 * seg.so 分段弹幕加载器：按播放游标分段懒加载，预取当前段 ±2 段，
 * 段数据内存缓存复用；某段请求失败自动回退全量 XML（标记后不再重复回退）。
 */
export class DanmakuSegmentLoader {
  private readonly sdk: PluginSdk | null;
  private readonly cid: number;
  private readonly aid?: number;
  private readonly onSegment: DanmakuSegmentLoaderOptions["onSegment"];
  private readonly onFallback: DanmakuSegmentLoaderOptions["onFallback"];
  private readonly onError: DanmakuSegmentLoaderOptions["onError"];

  private cache = new Map<number, BiliDanmakuItem[]>();
  private inFlight = new Set<number>();
  private requested = new Set<number>();
  private fallbackActive = false;
  private fallbackRequested = false;
  private disposed = false;
  private lastSegment = -1;

  constructor(options: DanmakuSegmentLoaderOptions) {
    this.sdk = options.sdk;
    this.cid = options.cid;
    this.aid = options.aid;
    this.onSegment = options.onSegment;
    this.onFallback = options.onFallback;
    this.onError = options.onError;
  }

  /** 播放游标更新：段变化时预取当前段 ±2 段（由播放器 timeupdate 驱动）。 */
  updateTime(time: number) {
    if (this.disposed || this.fallbackActive) return;
    const current = this.segmentIndexForTime(time);
    if (current === this.lastSegment) return;
    this.lastSegment = current;
    this.prefetchRange(current);
  }

  /** 清理请求标记（供卸载/切 P 时调用）。 */
  dispose() {
    this.disposed = true;
    this.inFlight.clear();
  }

  segmentIndexForTime(time: number) {
    const safeTime = Math.max(0, Number.isFinite(time) ? time : 0);
    return Math.floor(safeTime / SEGMENT_SECONDS) + 1;
  }

  private prefetchRange(current: number) {
    for (let index = current - PREFETCH_RADIUS; index <= current + PREFETCH_RADIUS; index += 1) {
      if (index >= 1) this.ensureSegment(index);
    }
  }

  private ensureSegment(index: number) {
    if (this.cache.has(index) || this.requested.has(index) || this.inFlight.has(index)) return;
    this.requested.add(index);
    this.inFlight.add(index);

    const sdk = this.sdk;
    if (!sdk) {
      this.inFlight.delete(index);
      return;
    }
    sdk.bilibili.danmaku
      .segment({ cid: this.cid, segmentIndex: index, aid: this.aid })
      .then((items) => {
        if (this.disposed) return;
        if (!this.cache.has(index)) this.cache.set(index, items);
        if (items.length > 0) this.onSegment(items, index);
      })
      .catch(() => {
        if (this.disposed) return;
        this.requested.delete(index);
        this.fallbackToFullList();
      })
      .finally(() => {
        this.inFlight.delete(index);
      });
  }

  private fallbackToFullList() {
    if (this.fallbackActive || this.fallbackRequested) return;
    this.fallbackRequested = true;
    const sdk = this.sdk;
    if (!sdk) return;
    sdk.bilibili.danmaku
      .list({ cid: this.cid })
      .then((items) => {
        if (this.disposed) return;
        this.fallbackActive = true;
        this.inFlight.clear();
        this.onFallback(items);
      })
      .catch((error) => {
        if (!this.disposed) this.onError(errorMessageOf(error));
      });
  }

  /** 当前是否已降级为全量 XML 模式。 */
  get isFallbackActive() {
    return this.fallbackActive;
  }

  /** 测试/调试：当前已缓存段集合。 */
  get cachedSegments() {
    return [...this.cache.keys()].sort((a, b) => a - b);
  }
}

function errorMessageOf(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}
