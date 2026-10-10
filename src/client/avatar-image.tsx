/**
 * [INPUT]: 依赖 React；调用方提供图片来源、加载事件与隐藏状态。
 * [OUTPUT]: 提供设置预览与历史缩略图共用的圆形头像图像。
 * [POS]: 身份设置的纯展示边界。尺寸、裁切与描边只由同一 CSS 类定义，不读配置。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import React, { forwardRef } from 'react';

type AvatarImageProps = Pick<React.ImgHTMLAttributes<HTMLImageElement>,
  'src' | 'alt' | 'hidden' | 'onLoad' | 'onError'>;

export const AvatarImage = forwardRef<HTMLImageElement, AvatarImageProps>(function AvatarImage(props, ref) {
  return <img {...props} ref={ref} className="pdsh-avatar-preview" referrerPolicy="no-referrer" />;
});
