/**
 * [INPUT]: 依赖材质 recipe、合成器与拍摄控制器；Canvas 桩只验证绘制边界。
 * [OUTPUT]: 回归当前 macOS 材质参数、原图无滤镜、归还临时画布与背景/外观冻结合同。
 * [POS]: 截图编辑合成测试，不把模拟材质或桩渲染当作原生窗口像素验收。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { captureMaterialRecipe, createCaptureMaterialBackdrop } from '../src/client/capture/material.ts';
import { renderCaptureToCanvas } from '../src/client/capture/compositor.ts';
import { createCaptureWindowState } from '../src/client/capture/model.ts';
import { readFileSync } from 'node:fs';

test('sidebar 材质来自当前 macOS 实测配方，深浅色分别保留混合方式', () => {
  const light = captureMaterialRecipe('light'), dark = captureMaterialRecipe('dark');
  assert.equal(light.blurRadius, 30); assert.equal(dark.blurRadius, 30);
  assert.equal(light.saturation, 2.2); assert.equal(dark.saturation, 2.4);
  assert.equal(light.tintOpacity, .84); assert.equal(dark.tintOpacity, .8);
  assert.equal(light.toneBlend, 'darken'); assert.equal(dark.toneBlend, 'lighten');
  assert.ok(Object.isFrozen(light)); assert.ok(Object.isFrozen(dark));
  const provenance = JSON.parse(readFileSync(new URL('../style-sources.json', import.meta.url), 'utf8')).captureMaterial;
  for (const [name, recipe] of [['light', light], ['dark', dark]] as const) {
    assert.equal(recipe.blurRadius, provenance[name].blurRadius);
    assert.equal(recipe.saturation, provenance[name].saturation);
    assert.equal(recipe.tintOpacity, provenance[name].fillAlpha);
    assert.equal(recipe.toneBlend, provenance[name].toneBlend);
  }
});

function canvasFixture() {
  const canvases: any[] = [], draws: any[] = [];
  function make() {
    const stack: any[] = [];
    const canvas: any = { width: 0, height: 0, ownerDocument: { createElement: () => make() } };
    const ctx: any = { canvas, filter: 'none', globalAlpha: 1, globalCompositeOperation: 'source-over',
      save() { stack.push([this.filter, this.globalAlpha, this.globalCompositeOperation]); },
      restore() { [this.filter, this.globalAlpha, this.globalCompositeOperation] = stack.pop(); },
      drawImage(image, ...args) { draws.push({ image, filter: this.filter, args }); },
      fillRect() {}, clearRect() {}, beginPath() {}, moveTo() {}, arcTo() {}, roundRect() {}, closePath() {}, fill() {}, clip() {},
    };
    canvas.getContext = () => ctx; canvases.push(canvas); return canvas;
  }
  return { canvases, draws, make };
}
test('模糊只绘制背景而非源截图；临时材质画布释放，主图维持原尺寸', () => {
  const fixture = canvasFixture(), source = fixture.make(); source.width = 640; source.height = 400;
  const state = { ...createCaptureWindowState({ width: 640, height: 400, scaleFactor: 2 }),
    background: { color: '#1a7788', kind: 'color' as const }, regions: [], padding: 0, shadow: false };
  const oldDocument = globalThis.document;
  (globalThis as any).document = source.ownerDocument;
  try {
    const result = renderCaptureToCanvas(source, state, { isMacOS: true, materialAppearance: 'dark' });
    assert.deepEqual([result.width, result.height], [640, 400]);
    const imageDraw = fixture.draws.filter(draw => draw.image === source);
    assert.equal(imageDraw.length, 1); assert.equal(imageDraw[0].filter, 'none');
    assert.deepEqual(imageDraw[0].args, [0, 0, 640, 400]);
    assert.ok(fixture.draws.some(draw => /blur\(30px\) saturate\(2\.4\)/.test(draw.filter)));
    assert.ok(fixture.canvases.slice(2).every(canvas => canvas.width === 0 && canvas.height === 0));
  } finally { (globalThis as any).document = oldDocument; }
});
test('材质创建异常归还临时画布，不修改背景画布', () => {
  const fixture = canvasFixture(), target = fixture.make(); target.width = 640; target.height = 400;
  target.ownerDocument.createElement = () => { const canvas = fixture.make(); canvas.getContext = () => null; return canvas; };
  assert.throws(() => createCaptureMaterialBackdrop(target, { x: 0, y: 0, width: 640, height: 400 }, 'light', 2), /Canvas 2D/);
  assert.deepEqual([target.width, target.height], [640, 400]);
  assert.ok(fixture.canvases.slice(1).every(canvas => canvas.width === 0 && canvas.height === 0));
});
test('极端宽高截图只降低背景材质计算尺寸，不分配无界高斯留白', () => {
  const fixture = canvasFixture(), target = fixture.make(); target.width = 16_000_000; target.height = 1;
  const material = createCaptureMaterialBackdrop(target, { x: 0, y: 0, width: target.width, height: 1 }, 'light', 1);
  assert.ok(material.width <= 4096); assert.equal(material.height, 1);
  assert.ok(fixture.draws.some(draw => draw.filter.startsWith('blur(')));
  material.width = 0; material.height = 0;
});
test('原图绘制失败时归还输出及材质位图，不清除原图', () => {
  const fixture = canvasFixture(), source = fixture.make(); source.width = 640; source.height = 400;
  source.ownerDocument.createElement = () => {
    const canvas = fixture.make(), ctx = canvas.getContext('2d'), originalDraw = ctx.drawImage;
    ctx.drawImage = function(image, ...args) {
      if (image === source) throw new Error('source-draw-failed');
      originalDraw.call(this, image, ...args);
    };
    return canvas;
  };
  const before = globalThis.document; (globalThis as any).document = source.ownerDocument;
  try {
    const state = { ...createCaptureWindowState({ width: 640, height: 400, scaleFactor: 2 }),
      background: { color: '#555', kind: 'color' as const } };
    assert.throws(() => renderCaptureToCanvas(source, state, { isMacOS: true }), /source-draw-failed/);
    assert.deepEqual([source.width, source.height], [640, 400]);
    assert.ok(fixture.canvases.slice(1).every(canvas => canvas.width === 0 && canvas.height === 0));
  } finally { (globalThis as any).document = before; }
});
