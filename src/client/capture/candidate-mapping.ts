/**
 * [INPUT]: 依赖 DOM 候选、Renderer 视口几何与原生 PNG 尺寸/pointPixelScale。
 * [OUTPUT]: 按 Mac Electron 44 满窗布局条件提供零平移映射；未知/缩放/变动布局返回空候选，原生 PNG 内容原点仍需实机证明。
 * [POS]: DOM CSS 坐标→冻结整窗像素的窄边界；不以透明像素猜原点，不影响手绘或取像。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import type { CaptureCandidate } from './model.ts';

type WindowViewport = {
  width: number; height: number; scale: number; x: number; y: number;
};

/** rc.2 的 hiddenInset 主 WebContents 填满窗口；这里只接受已研究的布局，不泛化到 Windows 边框。 */
export function readCandidateWindowViewport(doc: Document): WindowViewport | null {
  const view = doc.defaultView;
  if (!view || view !== view.top || doc !== view.document || !doc.documentElement?.isConnected
    || doc.location.protocol !== 'dsh-app:' || doc.location.hostname !== 'app'
    || !view.navigator.platform.startsWith('Mac') || !/\bElectron\/44\.0\.0(?:\s|$)/.test(view.navigator.userAgent)) return null;
  const { innerWidth: width, innerHeight: height, outerWidth, outerHeight, devicePixelRatio: scale, screenX: x, screenY: y, visualViewport } = view;
  if (![width, height, outerWidth, outerHeight, scale, x, y].every(Number.isFinite)
    || width <= 0 || height <= 0 || scale <= 0 || width !== outerWidth || height !== outerHeight
    || !visualViewport || visualViewport.scale !== 1 || visualViewport.offsetLeft !== 0 || visualViewport.offsetTop !== 0) return null;
  return { width, height, scale, x, y };
}

export function mapWindowCandidatesToPng(
  candidates: CaptureCandidate[], currentCandidates: CaptureCandidate[],
  source: { width: number; height: number }, nativeScale: number,
  before: WindowViewport | null, after: WindowViewport | null,
): CaptureCandidate[] {
  if (!before || !after || !Object.keys(before).every(key => before[key] === after[key])
    || !Number.isFinite(nativeScale) || nativeScale <= 0 || nativeScale !== before.scale
    || !Number.isSafeInteger(source.width) || !Number.isSafeInteger(source.height)
    || source.width !== Math.ceil(before.width * nativeScale) || source.height !== Math.ceil(before.height * nativeScale)) return [];

  const current = new Map(currentCandidates.map(candidate => [candidate.id, candidate]));
  // +--- 拍摄中滚动/节点移动不借用新位置；只映射两端仍一致的冻结候选。 ---+
  return candidates.flatMap(candidate => {
    const latest = current.get(candidate.id);
    const { x, y, width, height } = candidate;
    if (!latest || ![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0
      || x < 0 || y < 0 || x + width > before.width || y + height > before.height
      || x !== latest.x || y !== latest.y || width !== latest.width || height !== latest.height) return [];
    return [{ ...candidate, x: x * nativeScale, y: y * nativeScale, width: width * nativeScale, height: height * nativeScale }];
  });
}
