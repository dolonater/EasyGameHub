import type { PluginSdk } from "sdk";

export type { PluginSdk } from "sdk";
export type {
  BiliComment,
  BiliCommentContent,
  BiliCommentMember,
  BiliCommentPage,
  BiliCommentSort,
  BiliDanmakuItem,
  BiliErrorDto,
  BiliErrorKind,
  BiliFavoriteFolder,
  BiliFavoriteItem,
  BiliHistoryItem,
  BiliOwner,
  BiliOwnerInteractionState,
  BiliLoginInfo,
  BiliLocalProgress,
  BiliOperationResult,
  BiliPlaybackSource,
  BiliQualityOption,
  BiliQrLoginKey,
  BiliQrLoginStatus,
  BiliReportReason,
  BiliSdkError,
  BiliToViewItem,
  BiliVideoCard,
  BiliVideoDetail,
  BiliVideoInteractionState,
  BiliVideoInteractionStats,
  BiliVideoPage,
  BiliVideoStats,
} from "sdk";

export interface BilibiliRuntime {
  sdk: PluginSdk | null;
  disposed: boolean;
}
