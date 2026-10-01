/**
 * [INPUT]: 编辑器已绘制的背景、冻结的截图外观和物理像素比例；Canvas 仅处理背景。
 * [OUTPUT]: 提供 macOS sidebar 材质近似配方与临时背景位图，原始截图不参与模糊。
 * [POS]: compositor 的编辑内容层；参数取证于 macOS 27.0.1，而非 Host 控件主题或实时原生采集。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import type { CaptureRect } from './model.ts';

export type CaptureMaterialAppearance = 'light' | 'dark';

// +--- 原生 sidebar active / behindWindow 实测快照 ---+
// macOS 27.0.1 (26A434)，NSVisualEffectView 自有离屏层：gaussianBlur +
// colorSaturate → fill → tone。Chameleon 的桌面着色和 SDR 归一化不在模拟范围内。
// 配方是编辑内容，不读取桌面、不分发探针、不依赖私有 Core Animation API。
const RECIPES = Object.freeze({
  light: Object.freeze({ blurRadius: 30, saturation: 2.2, base: '#f6f6f6',
    tint: 'rgb(96.47% 96.47% 96.47%)', tintOpacity: .84,
    tone: 'rgb(91.5% 91.5% 91.5%)', toneBlend: 'darken' as const }),
  dark: Object.freeze({ blurRadius: 30, saturation: 2.4, base: '#282828',
    tint: 'rgb(15.69% 15.69% 15.69%)', tintOpacity: .8,
    tone: 'rgb(14% 14% 14%)', toneBlend: 'lighten' as const }),
});
const MAX_MATERIAL_PIXELS = 4_000_000;
const MAX_MATERIAL_EDGE = 4096;
export function captureMaterialRecipe(appearance: CaptureMaterialAppearance) {
  return RECIPES[appearance];
}

/** 返回临时位图的所有权交给调用者；用后将 width/height 归零。 */
export function createCaptureMaterialBackdrop(
  background: HTMLCanvasElement, rect: CaptureRect,
  appearance: CaptureMaterialAppearance, scaleFactor: number,
): HTMLCanvasElement {
  const recipe = captureMaterialRecipe(appearance);
  const pixelScale = Math.max(1, scaleFactor);
  const scale = Math.max(pixelScale, rect.width / MAX_MATERIAL_EDGE, rect.height / MAX_MATERIAL_EDGE,
    Math.sqrt(rect.width * rect.height / MAX_MATERIAL_PIXELS));
  // 只降低材质的计算分辨率到逻辑像素，源截图始终等尺寸绘制。
  const width = Math.max(1, Math.ceil(rect.width / scale));
  const height = Math.max(1, Math.ceil(rect.height / scale));
  const radius = recipe.blurRadius * pixelScale / scale;
  const halo = Math.ceil(radius * 3);
  const input = background.ownerDocument.createElement('canvas');
  const output = background.ownerDocument.createElement('canvas');
  input.width = width + halo * 2; input.height = height + halo * 2;
  output.width = width; output.height = height;
  try {
    const source = input.getContext('2d'), target = output.getContext('2d');
    if (!source || !target) throw new Error('Canvas 2D is unavailable');
    // 背景选择“透明”时窗口内部仍有中性材质，外部透明区域保持原语义。
    source.fillStyle = recipe.base; source.fillRect(0, 0, input.width, input.height);
    source.drawImage(background, rect.x, rect.y, rect.width, rect.height, halo, halo, width, height);
    // 高斯核的三倍半径留白，边缘复制模拟 native normalizeEdges，避免透明黑边。
    for (const [sx, sw, dx, dw] of [[halo, 1, 0, halo], [halo, width, halo, width], [halo + width - 1, 1, halo + width, halo]]) {
      for (const [sy, sh, dy, dh] of [[halo, 1, 0, halo], [halo, height, halo, height], [halo + height - 1, 1, halo + height, halo]]) {
        if (dx === halo && dy === halo) continue;
        source.drawImage(input, sx, sy, sw, sh, dx, dy, dw, dh);
      }
    }
    target.filter = `blur(${radius}px) saturate(${recipe.saturation})`;
    target.drawImage(input, -halo, -halo);
    target.filter = 'none';
    target.fillStyle = recipe.tint; target.globalAlpha = recipe.tintOpacity;
    target.fillRect(0, 0, width, height);
    target.globalAlpha = 1; target.globalCompositeOperation = recipe.toneBlend;
    target.fillStyle = recipe.tone; target.fillRect(0, 0, width, height);
    target.globalCompositeOperation = 'source-over';
    return output;
  } catch (error) {
    output.width = 0; output.height = 0; throw error;
  } finally {
    input.width = 0; input.height = 0;
  }
}
