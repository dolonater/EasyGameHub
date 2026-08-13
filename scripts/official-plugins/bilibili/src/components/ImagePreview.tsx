import React, { createPortal } from "sdk";
import { BiliImage } from "./BiliImage";

interface ImagePreviewProps {
  images: string[];
  index: number;
  onClose(): void;
  onIndexChange(index: number): void;
}

/**
 * 图片放大预览（共享组件，动态详情/评论区通用）：
 * fixed 遮罩 + 居中大图 + 多图上一张/下一张/计数，点遮罩关闭。
 */
export function ImagePreview({ images, index, onClose, onIndexChange }: ImagePreviewProps) {
  const image = images[index];
  if (!image) return null;
  // portal 到 body：突破 backdrop-filter/transform 祖先（如播放器详情面板）创建的
  // containing block，保证遮罩/图片相对视口全屏显示
  return createPortal(
    <div className="bili-image-preview-backdrop" onClick={onClose}>
      <div className="bili-image-preview-wrap">
        <BiliImage className="bili-image-preview" src={image} alt="预览大图" />
        {images.length > 1 ? (
          <div className="bili-image-preview-nav">
            <button
              className="bili-image-preview-nav-btn"
              type="button"
              disabled={index === 0}
              onClick={(event: any) => {
                event.stopPropagation();
                onIndexChange(index - 1);
              }}
            >
              上一张
            </button>
            <span>
              {index + 1}/{images.length}
            </span>
            <button
              className="bili-image-preview-nav-btn"
              type="button"
              disabled={index === images.length - 1}
              onClick={(event: any) => {
                event.stopPropagation();
                onIndexChange(index + 1);
              }}
            >
              下一张
            </button>
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
