/**
 * [INPUT]: 依赖 jsdom 的计算样式、原生控件探针 fixture 与 native-style-probe.ts 生命周期适配器。
 * [OUTPUT]: 验证原生控件、图标与 Tooltip 测量随变化同步，合法零长度保真、目标缺席时清理陈旧值且卸载归还原值。
 * [POS]: 原生样式边界的回归合同；真实 Tooltip bubble fixture 只证明计算样式读取，不冒充真实 DSH Desktop 验收。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { mountNativeStyleProbe } from '../src/client/native-style-probe.ts';

const properties = [
  '--pdsh-outline-width', '--pdsh-control-size', '--pdsh-action-size', '--pdsh-button-inset',
  '--pdsh-section-inset', '--pdsh-field-gap', '--pdsh-action-gap', '--pdsh-switch-width',
  '--pdsh-switch-height', '--pdsh-switch-thumb-size', '--pdsh-action-transition',
  '--pdsh-action-disabled-opacity', '--pdsh-action-radius', '--pdsh-native-icon-stroke-ratio',
  '--pdsh-action-corner-shape',
  '--pdsh-native-icon-opacity', '--pdsh-native-icon-size', '--pdsh-switch-radius',
  '--pdsh-switch-thumb-radius', '--pdsh-switch-thumb-transition', '--pdsh-switch-thumb-shadow', '--pdsh-tooltip-padding',
  '--pdsh-tooltip-duration', '--pdsh-tooltip-ease', '--pdsh-tooltip-max-width', '--pdsh-tooltip-layer', '--pdsh-button-gap',
];

const rules = `
  .wrap { height: 40px; border-top: 2px solid currentColor; }
  [data-pdsh-button-probe] { height: 32px; padding-inline-start: 8px; border-radius: 8px; transition: transform 170ms cubic-bezier(.2,.7,.4,1); }
  [data-pdsh-button-probe]:disabled { opacity: .38; }
  [data-pdsh-button-probe] svg { width: 14px; height: 14px; stroke-width: 1; opacity: .42; }
  [role="switch"] { display: flex; width: 36px; height: 20px; border-radius: 10px; }
  [role="switch"] > .thumb { width: 14px; height: 14px; border-radius: 50%; transition: transform 180ms linear; box-shadow: 0 1px 2px rgb(1,2,3); }
  [data-pdsh-field-probe] > .field { padding-top: 10px; display: flex; gap: 6px; }
  [data-pdsh-field-probe] .header { display: flex; gap: 12px; }
  [role="tooltip"].bubble[data-portal] { padding: 4px 9px; animation-duration: 275ms; animation-timing-function: cubic-bezier(.2,.7,.4,1); max-width: 48vw; z-index: 2400; }
  html[data-theme="dark"] .wrap { height: 44px; border-top-width: 3px; }
  html[data-theme="dark"] [data-pdsh-button-probe] { height: 36px; padding-inline-start: 10px; border-radius: 9px; transition: transform 220ms cubic-bezier(.2,.7,.4,1); }
  html[data-theme="dark"] [data-pdsh-button-probe]:disabled { opacity: .45; }
  html[data-theme="dark"] [data-pdsh-button-probe] svg { width: 18px; height: 18px; stroke-width: 2; opacity: .65; }
  html[data-theme="dark"] [role="switch"] { width: 40px; height: 22px; border-radius: 11px; }
  html[data-theme="dark"] [role="switch"] > .thumb { width: 16px; border-radius: 45%; transition: transform 240ms linear; box-shadow: 0 2px 3px rgb(4,5,6); }
  html[data-theme="dark"] [data-pdsh-field-probe] > .field { padding-top: 12px; gap: 8px; }
  html[data-theme="dark"] [data-pdsh-field-probe] .header { gap: 14px; }
  html[data-theme="dark"] [role="tooltip"].bubble[data-portal] { padding: 6px 11px; animation-duration: 360ms; animation-timing-function: linear; max-width: 56vw; z-index: 2600; }
`;

function setup() {
  const dom = new JSDOM(`<head><style>${rules}</style></head><body><div data-pdsh-probe>
    <div class="wrap"><input /></div>
    <button data-pdsh-button-probe disabled><svg viewBox="0 0 16 16"></svg></button>
    <div role="switch"><span class="thumb"></span></div>
    <span data-pdsh-field-probe><div class="field"><div class="header"></div></div></span>
    <span data-pdsh-tooltip-probe></span><div class="bubble" role="tooltip">原生提示 bubble</div>
  </div><div id="user-tooltip" role="tooltip">外部用户提示</div></body>`);
  return { dom, doc: dom.window.document, root: dom.window.document.querySelector('[data-pdsh-probe]') };
}

function installResizeObserver(view) {
  const observers = [];
  class ResizeObserverStub {
    constructor(callback) { this.callback = callback; this.targets = new Set(); this.disconnected = false; observers.push(this); }
    observe(target) { this.targets.add(target); }
    unobserve(target) { this.targets.delete(target); }
    disconnect() { this.disconnected = true; this.targets.clear(); }
    trigger() {
      if (!this.disconnected) this.callback([...this.targets].map(target => ({ target })), this);
    }
  }
  Object.defineProperty(view, 'ResizeObserver', { configurable: true, value: ResizeObserverStub });
  return {
    observers,
    trigger() {
      for (const observer of observers) observer.trigger();
      view.dispatchEvent(new view.Event('resize'));
    },
  };
}

const tick = view => new Promise(resolve => view.setTimeout(resolve, 0));
const value = (doc, property) => doc.body.style.getPropertyValue(property);

function assertLightMeasurements(doc) {
  for (const [property, expected] of [
    ['--pdsh-outline-width', '2px'], ['--pdsh-control-size', '40px'],
    ['--pdsh-action-size', '32px'], ['--pdsh-button-inset', '8px'],
    ['--pdsh-section-inset', '10px'], ['--pdsh-field-gap', '6px'],
    ['--pdsh-action-gap', '12px'], ['--pdsh-switch-width', '36px'],
    ['--pdsh-switch-height', '20px'], ['--pdsh-switch-thumb-size', '14px'],
    ['--pdsh-action-transition', 'transform 170ms cubic-bezier(.2,.7,.4,1)'],
    ['--pdsh-action-disabled-opacity', '0.38'], ['--pdsh-action-radius', '8px'],
    ['--pdsh-native-icon-stroke-ratio', '0.0625'], ['--pdsh-native-icon-opacity', '0.42'],
    ['--pdsh-native-icon-size', '14px'], ['--pdsh-switch-radius', '10px'],
    ['--pdsh-switch-thumb-radius', '50%'],
    ['--pdsh-switch-thumb-transition', 'transform 180ms linear'],
    ['--pdsh-switch-thumb-shadow', '0 1px 2px rgb(1,2,3)'],
    ['--pdsh-tooltip-padding', '4px 9px'], ['--pdsh-tooltip-duration', '275ms'],
    ['--pdsh-tooltip-ease', 'cubic-bezier(.2,.7,.4,1)'],
    ['--pdsh-tooltip-max-width', '48vw'], ['--pdsh-tooltip-layer', '2400'],
  ]) assert.equal(value(doc, property), expected, property);
}

test('初次读取 Input wrap、Button、Switch 与设置字段的宿主几何', () => {
  const { dom, doc, root } = setup();
  doc.body.style.setProperty('--pdsh-control-size', '77px');
  doc.body.style.setProperty('--host-owned-token', 'keep');
  const controller = mountNativeStyleProbe(doc, root);
  assertLightMeasurements(doc);
  assert.equal(value(doc, '--host-owned-token'), 'keep', '只写入自有测量变量');
  controller.dispose();
  assert.equal(value(doc, '--pdsh-control-size'), '77px', '已有 body 值由适配器归还');
  assert.equal(value(doc, '--host-owned-token'), 'keep');
  dom.window.close();
});

test('合法零长度边线/内距/gap 保留为0px；无有效尺寸时清除旧值而不造fallback', async () => {
  const { dom, doc, root } = setup();
  const previous = [
    ['--pdsh-outline-width', '3px'], ['--pdsh-button-inset', '7px'], ['--pdsh-button-gap', '5px'],
    ['--pdsh-section-inset', '11px'], ['--pdsh-field-gap', '9px'], ['--pdsh-action-gap', '13px'],
  ];
  for (const [property, prior] of previous) doc.body.style.setProperty(property, prior);
  root.querySelector('.wrap').style.borderTopWidth = '0px';
  const button = root.querySelector('[data-pdsh-button-probe]');
  button.style.paddingInlineStart = '0px'; button.style.gap = '0px';
  const field = root.querySelector('[data-pdsh-field-probe] > .field');
  field.style.paddingTop = '0px'; field.style.gap = '0px';
  field.firstElementChild.style.gap = '0px';

  const controller = mountNativeStyleProbe(doc, root);
  for (const property of previous.map(([property]) => property)) assert.equal(value(doc, property), '0px', property);
  assert.equal(value(doc, '--pdsh-control-size'), '40px', '零边线不应使真实控件高度归零');
  assert.equal(value(doc, '--pdsh-action-size'), '32px', '有效 Button 高度仍为正值');
  assert.equal(value(doc, '--pdsh-switch-width'), '36px', '宽高测量继续拒绝把0当作有效尺寸');

  button.style.height = '0px';
  await tick(dom.window);
  assert.equal(value(doc, '--pdsh-action-size'), '', '无效/为零的控件高度应撤回过期测量，不写零尺寸或 fallback');

  controller.dispose();
  for (const [property, prior] of previous) assert.equal(value(doc, property), prior, `${property} dispose 精确还原`);
  dom.window.close();
});

test('主题和原生 DOM 样式变更异步同步；相同测量不重写 body style', async () => {
  const { dom, doc, root } = setup();
  const resize = installResizeObserver(dom.window);
  const controller = mountNativeStyleProbe(doc, root);
  assertLightMeasurements(doc);

  doc.documentElement.setAttribute('data-theme', 'dark');
  await tick(dom.window);
  for (const [property, expected] of [
    ['--pdsh-outline-width', '3px'], ['--pdsh-control-size', '44px'],
    ['--pdsh-action-size', '36px'], ['--pdsh-button-inset', '10px'],
    ['--pdsh-section-inset', '12px'], ['--pdsh-field-gap', '8px'],
    ['--pdsh-action-gap', '14px'], ['--pdsh-switch-width', '40px'],
    ['--pdsh-switch-height', '22px'], ['--pdsh-switch-thumb-size', '16px'],
    ['--pdsh-action-transition', 'transform 220ms cubic-bezier(.2,.7,.4,1)'],
    ['--pdsh-action-disabled-opacity', '0.45'], ['--pdsh-action-radius', '9px'],
    ['--pdsh-native-icon-stroke-ratio', '0.125'], ['--pdsh-native-icon-opacity', '0.65'],
    ['--pdsh-native-icon-size', '18px'], ['--pdsh-switch-radius', '11px'],
    ['--pdsh-switch-thumb-radius', '45%'],
    ['--pdsh-switch-thumb-transition', 'transform 240ms linear'],
    ['--pdsh-switch-thumb-shadow', '0 2px 3px rgb(4,5,6)'],
    ['--pdsh-tooltip-padding', '6px 11px'], ['--pdsh-tooltip-duration', '360ms'],
    ['--pdsh-tooltip-ease', 'linear'], ['--pdsh-tooltip-max-width', '56vw'],
    ['--pdsh-tooltip-layer', '2600'],
  ]) assert.equal(value(doc, property), expected, property);

  const button = root.querySelector('[data-pdsh-button-probe]');
  button.style.height = '38px';
  await tick(dom.window);
  assert.equal(value(doc, '--pdsh-action-size'), '38px', '探针 DOM 的实时内联样式变化也要重采');

  const icon = button.querySelector('svg');
  icon.style.width = '20px'; icon.style.height = '20px'; icon.style.strokeWidth = '3'; icon.style.opacity = '0.7';
  await tick(dom.window);
  assert.equal(value(doc, '--pdsh-native-icon-stroke-ratio'), '0.1875');
  assert.equal(value(doc, '--pdsh-native-icon-opacity'), '0.7');
  assert.equal(value(doc, '--pdsh-native-icon-size'), '20px');

  const tooltip = root.querySelector('[role="tooltip"]');
  tooltip.style.padding = '7px 13px'; tooltip.style.animationDuration = '420ms';
  tooltip.style.animationTimingFunction = 'ease-out'; tooltip.style.maxWidth = '64vw'; tooltip.style.zIndex = '2800';
  await tick(dom.window);
  for (const [property, expected] of [
    ['--pdsh-tooltip-padding', '7px 13px'], ['--pdsh-tooltip-duration', '420ms'],
    ['--pdsh-tooltip-ease', 'ease-out'], ['--pdsh-tooltip-max-width', '64vw'], ['--pdsh-tooltip-layer', '2800'],
  ]) assert.equal(value(doc, property), expected, property);
  assert.equal(tooltip.hasAttribute('data-portal'), true, 'Host Tooltip bubble 的 portal selector 只加到探针拥有的 bubble');
  assert.equal(doc.querySelector('#user-tooltip').hasAttribute('data-portal'), false, '不标记或改写页面其他 Tooltip');

  const writes = [];
  const bodyObserver = new dom.window.MutationObserver(records => writes.push(...records));
  bodyObserver.observe(doc.body, { attributes: true, attributeFilter: ['style'] });
  resize.trigger();
  await tick(dom.window);
  assert.equal(writes.length, 0, '没有几何变化时不得重写 body style，避免自激观察循环');
  bodyObserver.disconnect();
  controller.dispose();
  dom.window.close();
});

test('resize 重新采样 CSSOM 几何；卸载恢复全部旧值并停止后续更新', async () => {
  const { dom, doc, root } = setup();
  const resize = installResizeObserver(dom.window);
  doc.body.style.setProperty('--pdsh-control-size', '77px');
  doc.body.style.setProperty('--pdsh-switch-height', '19px');
  doc.body.style.setProperty('--host-owned-token', 'keep');
  const controller = mountNativeStyleProbe(doc, root);
  assertLightMeasurements(doc);

  const cssRule = doc.querySelector('style').sheet.cssRules[0];
  cssRule.style.height = '52px';
  resize.trigger();
  await tick(dom.window);
  assert.equal(value(doc, '--pdsh-control-size'), '52px', 'resize 后按当前原生计算样式重采，而非沿用 mount 快照');

  controller.dispose();
  assert.equal(value(doc, '--pdsh-control-size'), '77px');
  assert.equal(value(doc, '--pdsh-switch-height'), '19px');
  for (const property of properties.filter(property => !['--pdsh-control-size', '--pdsh-switch-height'].includes(property))) {
    assert.equal(value(doc, property), '', `${property} 原先不存在，dispose 后必须移除`);
  }
  assert.equal(value(doc, '--host-owned-token'), 'keep');
  for (const observer of resize.observers) assert.equal(observer.disconnected, true, '卸载必须断开 ResizeObserver');

  cssRule.style.height = '60px';
  resize.trigger();
  await tick(dom.window);
  assert.equal(value(doc, '--pdsh-control-size'), '77px', 'dispose 后事件不得再次污染恢复值');
  assert.equal(value(doc, '--pdsh-switch-height'), '19px');
  dom.window.close();
});

test('目标节点缺席时清理所属测量，重建后重采新值，probe 根移除时清空全部值', async () => {
  const { dom, doc, root } = setup();
  const original = [
    ['--pdsh-action-size', '77px'], ['--pdsh-native-icon-size', '19px'],
    ['--pdsh-switch-width', '50px'], ['--pdsh-field-gap', '21px'], ['--pdsh-tooltip-padding', '2px'],
  ];
  for (const [property, prior] of original) doc.body.style.setProperty(property, prior);
  const controller = mountNativeStyleProbe(doc, root);
  assertLightMeasurements(doc);

  const button = root.querySelector('[data-pdsh-button-probe]');
  const iconProperties = ['--pdsh-native-icon-stroke-ratio', '--pdsh-native-icon-opacity', '--pdsh-native-icon-size'];
  button.querySelector('svg').remove();
  await tick(dom.window);
  for (const property of iconProperties) assert.equal(value(doc, property), '', `${property}: 缺少SVG不得保留旧采样`);
  assert.equal(value(doc, '--pdsh-action-size'), '32px', '缺少SVG不应误清仍存在的按钮测量');

  const replacementIcon = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
  replacementIcon.setAttribute('viewBox', '0 0 32 32');
  replacementIcon.style.cssText = 'width: 20px; height: 20px; stroke-width: 2; opacity: 0.8';
  button.append(replacementIcon);
  await tick(dom.window);
  assert.equal(value(doc, '--pdsh-native-icon-stroke-ratio'), '0.0625');
  assert.equal(value(doc, '--pdsh-native-icon-opacity'), '0.8');
  assert.equal(value(doc, '--pdsh-native-icon-size'), '20px');

  const buttonProperties = [
    '--pdsh-action-size', '--pdsh-button-inset', '--pdsh-button-gap', '--pdsh-action-radius',
    '--pdsh-action-corner-shape', '--pdsh-action-disabled-opacity', '--pdsh-action-transition',
    ...iconProperties,
  ];
  button.remove();
  await tick(dom.window);
  for (const property of buttonProperties) assert.equal(value(doc, property), '', `${property}: 缺少按钮不得保留旧采样`);

  const replacementButton = doc.createElement('button');
  replacementButton.dataset.pdshButtonProbe = '';
  replacementButton.disabled = true;
  replacementButton.style.cssText = 'height: 40px; padding-inline-start: 0px; gap: 0px; border-radius: 12px; transition: transform 300ms ease-in';
  replacementButton.style.opacity = '0.5';
  const nextIcon = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
  nextIcon.setAttribute('viewBox', '0 0 24 24');
  nextIcon.style.cssText = 'width: 16px; height: 16px; stroke-width: 3; opacity: 0.6';
  replacementButton.append(nextIcon);
  root.insertBefore(replacementButton, root.querySelector('[role="switch"]'));
  await tick(dom.window);
  assert.equal(value(doc, '--pdsh-action-size'), '40px');
  assert.equal(value(doc, '--pdsh-button-inset'), '0px');
  assert.equal(value(doc, '--pdsh-button-gap'), '0px');
  assert.equal(value(doc, '--pdsh-action-transition'), 'transform 300ms ease-in');
  assert.equal(value(doc, '--pdsh-native-icon-stroke-ratio'), '0.125');
  assert.equal(value(doc, '--pdsh-native-icon-size'), '16px');

  const switchProperties = [
    '--pdsh-switch-width', '--pdsh-switch-height', '--pdsh-switch-radius', '--pdsh-switch-thumb-size',
    '--pdsh-switch-thumb-radius', '--pdsh-switch-thumb-transition', '--pdsh-switch-thumb-shadow',
  ];
  root.querySelector('[role="switch"]').remove();
  root.querySelector('[data-pdsh-field-probe]').remove();
  root.querySelector('.bubble[role="tooltip"]').remove();
  await tick(dom.window);
  for (const property of switchProperties) assert.equal(value(doc, property), '', `${property}: 缺少Switch不得保留旧采样`);
  for (const property of ['--pdsh-section-inset', '--pdsh-field-gap', '--pdsh-action-gap']) {
    assert.equal(value(doc, property), '', `${property}: 缺少字段不得保留旧采样`);
  }
  for (const property of ['--pdsh-tooltip-padding', '--pdsh-tooltip-duration', '--pdsh-tooltip-ease', '--pdsh-tooltip-max-width', '--pdsh-tooltip-layer']) {
    assert.equal(value(doc, property), '', `${property}: 缺少Tooltip不得保留旧采样`);
  }
  assert.equal(value(doc, '--pdsh-control-size'), '40px', '其他仍在场的控件测量继续有效');

  const nextSwitch = doc.createElement('div');
  nextSwitch.setAttribute('role', 'switch');
  nextSwitch.style.cssText = 'display: flex; width: 44px; height: 24px; border-radius: 12px';
  const nextThumb = doc.createElement('span');
  nextThumb.className = 'thumb';
  nextThumb.style.cssText = 'width: 18px; height: 18px; border-radius: 20%; transition: transform 300ms ease-in; box-shadow: 0px 3px 4px rgb(1, 2, 3)';
  nextSwitch.append(nextThumb);
  root.insertBefore(nextSwitch, root.querySelector('[data-pdsh-field-probe]'));

  const nextField = doc.createElement('span');
  nextField.setAttribute('data-pdsh-field-probe', '');
  const fieldBox = doc.createElement('div');
  fieldBox.className = 'field';
  fieldBox.style.cssText = 'padding-top: 14px; display: flex; gap: 0px';
  const header = doc.createElement('div');
  header.className = 'header';
  header.style.cssText = 'display: flex; gap: 16px';
  fieldBox.append(header);
  nextField.append(fieldBox);
  root.append(nextField);

  const nextTooltip = doc.createElement('div');
  nextTooltip.className = 'bubble';
  nextTooltip.setAttribute('role', 'tooltip');
  nextTooltip.style.cssText = 'padding: 8px 12px; animation-duration: 500ms; animation-timing-function: ease-in; max-width: 60vw; z-index: 2900';
  root.append(nextTooltip);
  await tick(dom.window);
  for (const [property, expected] of [
    ['--pdsh-switch-width', '44px'], ['--pdsh-switch-height', '24px'], ['--pdsh-switch-radius', '12px'],
    ['--pdsh-switch-thumb-size', '18px'], ['--pdsh-switch-thumb-radius', '20%'],
    ['--pdsh-switch-thumb-transition', 'transform 300ms ease-in'], ['--pdsh-switch-thumb-shadow', '0px 3px 4px rgb(1, 2, 3)'],
    ['--pdsh-section-inset', '14px'], ['--pdsh-field-gap', '0px'], ['--pdsh-action-gap', '16px'],
    ['--pdsh-tooltip-padding', '8px 12px'], ['--pdsh-tooltip-duration', '500ms'],
    ['--pdsh-tooltip-ease', 'ease-in'], ['--pdsh-tooltip-max-width', '60vw'], ['--pdsh-tooltip-layer', '2900'],
  ]) assert.equal(value(doc, property), expected, property);

  root.remove();
  await tick(dom.window);
  for (const property of properties) assert.equal(value(doc, property), '', `${property}: root 脱离文档后不得残留测量`);
  controller.dispose();
  for (const [property, prior] of original) assert.equal(value(doc, property), prior, `${property}: dispose 后精确恢复初始值`);
  dom.window.close();
});

test('原生控件重建后转移 ResizeObserver 所有权，不保留已移除节点', async () => {
  const { dom, doc, root } = setup();
  const resize = installResizeObserver(dom.window);
  const controller = mountNativeStyleProbe(doc, root);
  const oldButton = root.querySelector('[data-pdsh-button-probe]');
  const replacement = oldButton.cloneNode(true);
  oldButton.replaceWith(replacement);
  await tick(dom.window);
  assert.equal(resize.observers[0].targets.has(oldButton), false);
  assert.equal(resize.observers[0].targets.has(replacement), true);
  assert.equal(resize.observers[0].targets.has(replacement.querySelector('svg')), true);
  controller.dispose();
  assert.equal(resize.observers[0].targets.size, 0);
  dom.window.close();
});
