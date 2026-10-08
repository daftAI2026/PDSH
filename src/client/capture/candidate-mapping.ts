/**
 * [INPUT]: 依赖 DOM 候选、Renderer 视口几何与原生 PNG 尺寸/pointPixelScale。
 * [OUTPUT]: Mac 满窗使用零平移；Windows 使用同张 PNG 的原生客户区偏移。未知、缩放或变动布局返回空候选。
 * [POS]: DOM CSS 坐标→冻结整窗像素的窄边界；不以透明像素猜原点，不影响手绘或取像。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import type { CaptureCandidate } from './model.ts';
import { isCaptureGeometry, type CaptureGeometry } from '../../shared/capture-geometry.ts';

type WindowViewport = {
  width: number; height: number; scale: number; x: number; y: number;
  outerWidth: number; outerHeight: number; platform: 'mac' | 'windows';
};

/** 只接受 rc.2 Electron 44 主页面；Windows 客户区原点由独立原生元数据提供。 */
export function readCandidateWindowViewport(doc: Document): WindowViewport | null {
  const view = doc.defaultView;
  if (!view || view !== view.top || doc !== view.document || !doc.documentElement?.isConnected
    || doc.location.protocol !== 'dsh-app:' || doc.location.hostname !== 'app'
    || !/\bElectron\/44\.0\.0(?:\s|$)/.test(view.navigator.userAgent)) return null;
  const platform = view.navigator.platform.startsWith('Mac') ? 'mac'
    : view.navigator.platform.startsWith('Win') ? 'windows' : null;
  if (!platform) return null;
  const { innerWidth: width, innerHeight: height, outerWidth, outerHeight, devicePixelRatio: scale, screenX: x, screenY: y, visualViewport } = view;
  if (![width, height, outerWidth, outerHeight, scale, x, y].every(Number.isFinite)
    || width <= 0 || height <= 0 || scale <= 0 || outerWidth < width || outerHeight < height
    || (platform === 'mac' && (width !== outerWidth || height !== outerHeight))
    || !visualViewport || visualViewport.scale !== 1 || visualViewport.offsetLeft !== 0 || visualViewport.offsetTop !== 0) return null;
  return { width, height, scale, x, y, outerWidth, outerHeight, platform };
}

export function mapWindowCandidatesToPng(
  candidates: CaptureCandidate[], currentCandidates: CaptureCandidate[],
  source: { width: number; height: number }, nativeScale: number,
  before: WindowViewport | null, after: WindowViewport | null,
  geometry?: CaptureGeometry,
): CaptureCandidate[] {
  if (!before || !after || !Object.keys(before).every(key => before[key] === after[key])
    || !Number.isFinite(nativeScale) || nativeScale <= 0 || nativeScale !== before.scale
    || !Number.isSafeInteger(source.width) || !Number.isSafeInteger(source.height)) return [];
  const width = Math.ceil(before.width * nativeScale), height = Math.ceil(before.height * nativeScale);
  let offsetX = 0, offsetY = 0;
  if (before.platform === 'windows') {
    if (!isCaptureGeometry(geometry, { ...source, pointPixelScale: nativeScale })
      || geometry.width !== width || geometry.height !== height) return [];
    offsetX = geometry.x; offsetY = geometry.y;
  } else if (source.width !== width || source.height !== height) return [];

  const current = new Map(currentCandidates.map(candidate => [candidate.id, candidate]));
  // +--- 拍摄中滚动/节点移动不借用新位置；只映射两端仍一致的冻结候选。 ---+
  return candidates.flatMap(candidate => {
    const latest = current.get(candidate.id);
    const { x, y, width, height } = candidate;
    if (!latest || ![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0
      || x < 0 || y < 0 || x + width > before.width || y + height > before.height
      || x !== latest.x || y !== latest.y || width !== latest.width || height !== latest.height) return [];
    return [{ ...candidate, x: offsetX + x * nativeScale, y: offsetY + y * nativeScale, width: width * nativeScale, height: height * nativeScale }];
  });
}
