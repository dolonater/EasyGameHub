import React from "sdk";
import { LiveFeed } from "../components/LiveFeed";
import { openLive } from "../navigation";

/** 直播首页（P9 阶段 2）：侧边栏"直播"入口，推荐直播列表。 */
export function LiveHomePage() {
  return (
    <section className="bili-live-home">
      <LiveFeed onOpenLive={openLive} />
    </section>
  );
}
