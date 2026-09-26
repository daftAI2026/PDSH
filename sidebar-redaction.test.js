/**
 * [INPUT]: 依赖 jsdom 与 sidebar-redaction.js 的 rc.2 结构适配器。
 * [OUTPUT]: 验证标题叶节点的精确归属、portal 关联、原文保留与生命周期恢复。
 * [POS]: PDSH 侧栏标题视觉遮罩合同；不把 fixture 结果冒充 Electron 实窗验收。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { mountSidebarRedaction } from './sidebar-redaction.js';

function rowFixtures() {
  const dom = new JSDOM(`<body>
    <div data-slot="sidebar.workspaces">
      <div>
        <div role="treeitem" data-row-key="workspace:ws-1" aria-expanded="true">
          <span><svg></svg></span><span><svg></svg></span>
          <span><span>Project Alpha</span></span><span><button type="button">Actions</button></span>
        </div>
        <div role="treeitem" data-row-key="session:s-1" aria-selected="false">
          <span><span>status</span></span><span>Session Secret</span><span>5 min</span>
          <span><button type="button">Actions</button></span>
        </div>
        <div role="treeitem" data-row-key="session:s-pinned" aria-selected="false">
          <span></span><span>Pinned Session</span><span>now</span><span>pin</span><span>actions</span>
        </div>
        <div role="treeitem" data-row-key="session:s-partial" aria-selected="false">
          <span></span><span>Incomplete Row</span><span>time</span>
        </div>
        <div role="treeitem" data-row-key="session:blank" aria-selected="false">
          <span></span><span>New Session</span>
        </div>
        <div role="treeitem" data-row-key="overflow:ws-1"><span>Show more</span></div>
        <div role="treeitem" data-row-key="workspace:"><span>Unknown</span></div>
        <div role="tree" aria-label="Search results"></div>
      </div>
    </div>
  </body>`);
  const doc = dom.window.document;
  return {
    dom, doc,
    region: doc.querySelector('[data-slot="sidebar.workspaces"]'),
    workspace: doc.querySelector('[data-row-key="workspace:ws-1"]'),
    workspaceTitle: doc.querySelector('[data-row-key="workspace:ws-1"] > span:nth-child(3) > span'),
    session: doc.querySelector('[data-row-key="session:s-1"]'),
    sessionTitle: doc.querySelector('[data-row-key="session:s-1"] > span:nth-child(2)'),
  };
}

function searchRow(doc, { title = 'Search Secret', workspace = 'Project Beta', snippet = 'do not mask this excerpt', archived = false } = {}) {
  const row = doc.createElement('div');
  row.setAttribute('role', 'treeitem');
  row.setAttribute('aria-selected', 'false');
  const heading = doc.createElement('span');
  const status = doc.createElement('span'); status.innerHTML = '<span>status</span>';
  const titleNode = doc.createElement('span'); titleNode.textContent = title;
  heading.append(status, titleNode);
  if (archived) {
    const actions = doc.createElement('span'); actions.innerHTML = '<button type="button">Unarchive</button>';
    heading.append(actions);
  }
  const meta = doc.createElement('span');
  const workspaceNode = doc.createElement('span'); workspaceNode.textContent = workspace;
  meta.append(workspaceNode);
  if (snippet !== undefined) {
    const snippetNode = doc.createElement('span'); snippetNode.textContent = snippet;
    meta.append(snippetNode);
  }
  row.append(heading, meta);
  doc.querySelector('[data-slot="sidebar.workspaces"] [role="tree"]').append(row);
  return { row, titleNode, workspaceNode, snippetNode: meta.children[1] };
}

const tick = (dom) => new Promise(resolve => dom.window.setTimeout(resolve, 0));

test('只标记唯一侧栏中的真实 workspace/session 标题叶，不改原文、滚动或事件结构', () => {
  const { dom, doc, workspace, workspaceTitle, session, sessionTitle } = rowFixtures();
  sessionTitle.scrollLeft = 19;
  sessionTitle.setAttribute('data-scrolled', '');
  const original = doc.body.innerHTML;
  let clicks = 0;
  workspace.addEventListener('click', () => { clicks += 1; });
  const controller = mountSidebarRedaction(doc);

  controller.update(true);
  assert.equal(workspaceTitle.getAttribute('data-pdsh-redacted-title'), 'workspace');
  assert.equal(sessionTitle.getAttribute('data-pdsh-redacted-title'), 'session');
  assert.equal(doc.querySelector('[data-row-key="session:s-pinned"] > span:nth-child(2)').getAttribute('data-pdsh-redacted-title'), 'session');
  assert.equal(doc.querySelector('[data-row-key="session:s-partial"] [data-pdsh-redacted-title]'), null);
  assert.equal(sessionTitle.scrollLeft, 19);
  assert.equal(sessionTitle.textContent, 'Session Secret');
  assert.equal(sessionTitle.hasAttribute('data-scrolled'), true);
  assert.equal(doc.querySelector('[data-row-key="session:blank"] [data-pdsh-redacted-title]'), null);
  assert.equal(doc.querySelector('[data-row-key^="overflow:"] [data-pdsh-redacted-title]'), null);
  assert.equal(doc.querySelector('[data-row-key="workspace:"] [data-pdsh-redacted-title]'), null);
  workspace.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  assert.equal(clicks, 1);

  controller.update(false);
  assert.equal(workspaceTitle.hasAttribute('data-pdsh-redacted-title'), false);
  assert.equal(sessionTitle.hasAttribute('data-pdsh-redacted-title'), false);
  assert.equal(doc.body.innerHTML, original);
  controller.dispose(); dom.window.close();
});

test('只遮罩搜索结果标题与 workspace 名，不触碰状态、snippet、time 或相邻结构', () => {
  const { dom, doc } = rowFixtures();
  const result = searchRow(doc, { archived: true });
  const controller = mountSidebarRedaction(doc);
  controller.update(true);

  assert.equal(result.titleNode.getAttribute('data-pdsh-redacted-title'), 'search');
  assert.equal(result.workspaceNode.getAttribute('data-pdsh-redacted-title'), 'search');
  assert.equal(result.snippetNode.hasAttribute('data-pdsh-redacted-title'), false);
  assert.equal(result.row.querySelector('button').hasAttribute('data-pdsh-redacted-title'), false);
  assert.equal(result.row.textContent.includes('do not mask this excerpt'), true);

  controller.dispose();
  assert.equal(result.row.querySelector('[data-pdsh-redacted-title]'), null);
  dom.window.close();
});

test('搜索结果形状或 sidebar 根不唯一时保守拒绝', () => {
  const { dom, doc, workspaceTitle } = rowFixtures();
  const malformed = searchRow(doc);
  malformed.row.firstElementChild.insertBefore(doc.createElement('em'), malformed.titleNode);
  const controller = mountSidebarRedaction(doc);
  controller.update(true);
  assert.equal(malformed.titleNode.hasAttribute('data-pdsh-redacted-title'), false);
  assert.equal(workspaceTitle.getAttribute('data-pdsh-redacted-title'), 'workspace');

  const duplicate = doc.createElement('div'); duplicate.setAttribute('data-slot', 'sidebar.workspaces');
  doc.body.append(duplicate);
  controller.refresh();
  assert.equal(workspaceTitle.hasAttribute('data-pdsh-redacted-title'), false);
  controller.dispose(); dom.window.close();
});

test('更新、重挂与文本变化后重新识别；关闭和卸载恢复原 marker 值及自有样式', async () => {
  const { dom, doc, workspaceTitle, sessionTitle, region } = rowFixtures();
  workspaceTitle.setAttribute('data-pdsh-redacted-title', 'host-value');
  const controller = mountSidebarRedaction(doc);
  controller.update(true);
  assert.equal(workspaceTitle.getAttribute('data-pdsh-redacted-title'), 'workspace');
  const style = doc.querySelector('style[data-pdsh-sidebar-redaction-style]');
  assert.ok(style);
  assert.match(style.textContent, /mask-image:\s*none/i);

  sessionTitle.textContent = 'Renamed Secret';
  const nextSession = doc.createElement('div');
  nextSession.setAttribute('role', 'treeitem'); nextSession.setAttribute('data-row-key', 'session:s-2');
  nextSession.innerHTML = '<span></span><span>Replacement Secret</span><span>now</span><span></span>';
  region.firstElementChild.append(nextSession);
  await tick(dom);
  assert.equal(sessionTitle.getAttribute('data-pdsh-redacted-title'), 'session');
  assert.equal(nextSession.children[1].getAttribute('data-pdsh-redacted-title'), 'session');

  const replacementRoot = doc.createElement('div');
  replacementRoot.setAttribute('data-slot', 'sidebar.workspaces');
  replacementRoot.innerHTML = '<div><div role="treeitem" data-row-key="workspace:ws-2"><span></span><span></span><span><span>Replacement Project</span></span><span></span></div></div>';
  region.replaceWith(replacementRoot);
  await tick(dom);
  assert.equal(workspaceTitle.getAttribute('data-pdsh-redacted-title'), 'host-value');
  assert.equal(replacementRoot.querySelector('[data-pdsh-redacted-title]')?.textContent, 'Replacement Project');

  replacementRoot.setAttribute('data-slot', 'sidebar.other');
  await tick(dom);
  assert.equal(replacementRoot.querySelector('[data-pdsh-redacted-title]'), null);
  replacementRoot.setAttribute('data-slot', 'sidebar.workspaces');
  await tick(dom);
  assert.equal(replacementRoot.querySelector('[data-pdsh-redacted-title]')?.textContent, 'Replacement Project');

  controller.dispose();
  assert.equal(workspaceTitle.getAttribute('data-pdsh-redacted-title'), 'host-value');
  assert.equal(replacementRoot.querySelector('[data-pdsh-redacted-title]'), null);
  assert.equal(doc.querySelector('style[data-pdsh-sidebar-redaction-style]'), null);
  dom.window.close();
});

test('关闭时归还运行期间被外部改写过的旧 marker', async () => {
  const { dom, doc, workspaceTitle } = rowFixtures();
  workspaceTitle.setAttribute('data-pdsh-redacted-title', 'host-before');
  const controller = mountSidebarRedaction(doc);
  controller.update(true);
  workspaceTitle.setAttribute('data-pdsh-redacted-title', 'host-during');
  await tick(dom);
  assert.equal(workspaceTitle.getAttribute('data-pdsh-redacted-title'), 'workspace');
  controller.update(false);
  assert.equal(workspaceTitle.getAttribute('data-pdsh-redacted-title'), 'host-during');
  controller.dispose(); dom.window.close();
});

test('hover portal 仅在当前确认 row 与唯一固定卡片标题精确匹配时遮罩标题', async () => {
  const { dom, doc, workspace, workspaceTitle } = rowFixtures();
  const unrelated = doc.createElement('div');
  unrelated.innerHTML = '<span>Project Alpha</span>';
  doc.body.append(unrelated);
  const controller = mountSidebarRedaction(doc);
  controller.update(true);

  workspace.dispatchEvent(new dom.window.MouseEvent('pointerover', { bubbles: true }));
  const card = doc.createElement('div'); card.style.position = 'fixed'; card.style.left = '10px'; card.style.top = '10px';
  const content = doc.createElement('div');
  const title = doc.createElement('div'); title.textContent = 'Project Alpha';
  const path = doc.createElement('div'); path.textContent = '/private/path';
  const time = doc.createElement('div'); time.textContent = 'created time';
  content.append(title, path, time); card.append(content); doc.body.append(card);
  await tick(dom);
  assert.equal(title.getAttribute('data-pdsh-redacted-title'), 'workspace');
  assert.equal(path.hasAttribute('data-pdsh-redacted-title'), false);
  assert.equal(unrelated.querySelector('span').hasAttribute('data-pdsh-redacted-title'), false);

  const outside = doc.createElement('div'); doc.body.append(outside);
  workspace.dispatchEvent(new dom.window.MouseEvent('pointerout', { bubbles: true, relatedTarget: outside }));
  assert.equal(title.getAttribute('data-pdsh-redacted-title'), 'workspace');
  assert.equal(workspaceTitle.getAttribute('data-pdsh-redacted-title'), 'workspace');

  card.dispatchEvent(new dom.window.MouseEvent('pointerout', { bubbles: true, relatedTarget: outside }));
  assert.equal(title.getAttribute('data-pdsh-redacted-title'), 'workspace');
  controller.update(false);
  assert.equal(title.hasAttribute('data-pdsh-redacted-title'), false);
  assert.equal(workspaceTitle.hasAttribute('data-pdsh-redacted-title'), false);
  assert.equal(doc.querySelector('style[data-pdsh-sidebar-redaction-style]'), null);
  controller.update(true);
  assert.equal(title.getAttribute('data-pdsh-redacted-title'), 'workspace');

  card.remove();
  await tick(dom);
  assert.equal(title.hasAttribute('data-pdsh-redacted-title'), false);
  assert.equal(workspaceTitle.getAttribute('data-pdsh-redacted-title'), 'workspace');
  controller.dispose(); dom.window.close();
});

test('名称重复导致 hover portal owner 歧义时不标记 portal 内容', async () => {
  const { dom, doc, region } = rowFixtures();
  const second = doc.createElement('div');
  second.setAttribute('role', 'treeitem'); second.setAttribute('data-row-key', 'workspace:ws-2');
  second.innerHTML = '<span></span><span></span><span><span>Project Alpha</span></span><span></span>';
  region.firstElementChild.append(second);
  const controller = mountSidebarRedaction(doc);
  controller.update(true);
  doc.querySelector('[data-row-key="workspace:ws-1"]').dispatchEvent(new dom.window.MouseEvent('pointerover', { bubbles: true }));
  const card = doc.createElement('div'); card.style.position = 'fixed';
  card.innerHTML = '<div><div>Project Alpha</div><div>path</div><div>time</div></div>';
  doc.body.append(card);
  await tick(dom);
  assert.equal(card.querySelector('div > div').hasAttribute('data-pdsh-redacted-title'), false);
  controller.dispose(); dom.window.close();
});
