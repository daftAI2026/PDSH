/**
 * [INPUT]: 依赖背景模式记忆、真实模板与 DOM 同步，jsdom 只提供浏览器结构。
 * [OUTPUT]: 验证单一背景真源、各类最近选择与隐藏面板的 ARIA/焦点契约。
 * [POS]: 四模式背景交互的源合同；不冒充 DSH 原生控件或实机视觉验收。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createCaptureBackgroundMemory, captureBackgroundMode, syncCaptureBackgroundPanels } from '../src/client/capture/background-modes.ts';
import { captureWindowTemplate } from '../src/client/capture/view.ts';
import { createCaptureWindowState } from '../src/client/capture/model.ts';
import { capturePresets } from '../src/client/capture/presets.ts';
import { saveCapturePreferences, loadCapturePreferences } from '../src/client/capture/preferences.ts';
import { captureWindowCopy } from '../src/client/capture/copy.ts';

test('Tabs 从背景派生，不新增并行模式状态；各类最近素材在工作台内保留', () => {
  const memory = createCaptureBackgroundMemory({ kind: 'preset', id: 'sea' });
  assert.deepEqual(memory.read('none'), { kind: 'transparent' });
  assert.deepEqual(memory.read('plain-color'), { kind: 'color', color: '#2B3440' });
  assert.deepEqual(memory.read('gradients'), { kind: 'preset', id: 'rose' });
  memory.remember({ kind: 'preset', id: 'lagoon' });
  memory.remember({ kind: 'color', color: '#abcdef' });
  memory.remember({ kind: 'wallpaper', dataUrl: 'data:image/png;base64,fixture' });
  memory.remember({ kind: 'transparent' });
  assert.deepEqual(memory.read('gradients'), { kind: 'preset', id: 'lagoon' });
  assert.deepEqual(memory.read('plain-color'), { kind: 'color', color: '#abcdef' });
  assert.deepEqual(memory.read('wallpapers'), { kind: 'wallpaper', dataUrl: 'data:image/png;base64,fixture' });
  assert.equal(captureBackgroundMode({ kind: 'wallpaper', systemId: 'current', dataUrl: 'fixture' }), 'wallpapers');
});

for (const locale of ['zh', 'en']) test(`${locale} 四面板始终保留稳定关系，只有当前类可见且可获得焦点`, () => {
  const state = createCaptureWindowState({ width: 120, height: 80 });
  const dom = new JSDOM(captureWindowTemplate(state, captureWindowCopy(locale), { backgroundTabsId: 'fixture-background' }));
  try {
    const root = dom.window.document.body;
    assert.equal(root.querySelectorAll('[role=tabpanel]').length, 4);
    assert.equal(root.querySelector('[data-input=none]'), null);
    for (const mode of ['none', 'plain-color', 'gradients', 'wallpapers'] as const) {
      syncCaptureBackgroundPanels(root, mode);
      for (const panel of root.querySelectorAll<HTMLElement>('[role=tabpanel]')) {
        const active = panel.dataset.backgroundSection === mode;
        assert.equal(panel.hidden, !active);
        assert.equal(panel.hasAttribute('inert'), !active);
        assert.equal(panel.tabIndex, active && mode !== "none" ? 0 : -1);
        assert.equal(panel.id, `fixture-background-${panel.dataset.backgroundSection}-panel`);
        assert.equal(panel.getAttribute('aria-labelledby'), `fixture-background-${panel.dataset.backgroundSection}`);
      }
    }
    assert.equal(root.querySelectorAll('[data-background="sea"]').length, 1);
    assert.equal(root.querySelectorAll('[data-background-wallpaper]').length, 1);
    assert.equal(root.querySelector('[data-system-wallpaper]'), null);
  } finally { dom.window.close(); }
});

test('顶部类别不重复成面板标题；自选颜色始终保留可辨认的拾色入口', () => {
  const state = { ...createCaptureWindowState({width:120,height:80}), background:{kind:'color',color:'#123456'} as const };
  const dom = new JSDOM(captureWindowTemplate(state,captureWindowCopy('zh')));
  try {
    const root = dom.window.document.body;
    assert.equal(root.querySelector('[data-background-section=none]').textContent.trim(), '');
    assert.equal(root.querySelectorAll('.pdsh-capture-background-section-title').length,0);
    assert.equal(root.querySelector('[data-background-custom-icon]').hasAttribute('hidden'),false);
    assert.ok(root.querySelector('[data-background-custom-icon] svg'));
    syncCaptureBackgroundPanels(root,'none');
    assert.equal(root.querySelector('[data-background-section=none]').tabIndex,-1,'空面板不制造不可见焦点停靠');
  } finally { dom.window.close(); }
});

test('渐变完整展开，没有重复类别标题或显示更多/收起动作', () => {
  const state = {...createCaptureWindowState({width:120,height:80}), gradientsExpanded:false};
  const dom = new JSDOM(captureWindowTemplate(state,captureWindowCopy('zh')));
  try {
    const section = dom.window.document.querySelector('[data-background-section=gradients]');
    assert.equal(section.querySelectorAll('[data-background]').length,20);
    assert.equal(section.querySelectorAll('[data-background][hidden]').length,0);
    assert.equal(section.querySelector('[data-action=toggle-gradients]'),null);
    assert.equal(section.querySelector('.pdsh-capture-background-section-title'),null);
  } finally {dom.window.close();}
});

test('展开后的每个渐变都可恢复，不被旧版重复的ID白名单丢弃', () => {
  for (const preset of capturePresets) {
    let stored = '';
    const storage = {getItem:()=>stored,setItem:(_key,value)=>{stored=value;}};
    const state = {...createCaptureWindowState({width:120,height:80}),background:{kind:'preset' as const,id:preset.id}};
    saveCapturePreferences(storage,state);
    assert.deepEqual(loadCapturePreferences(storage).background,state.background,preset.id);
  }
});
