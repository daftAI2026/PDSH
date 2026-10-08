/**
 * [INPUT]: 依赖自身插件详情的唯一标题及浏览器原生 text-box 支持。
 * [OUTPUT]: 提供可卸载的标题排版标记；CSS 仅裁去标题字体留白，不改变版本胶囊。
 * [POS]: Client 详情排版适配边界。原生排版拥有字号和对齐；未知结构保留原布局。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { BUNDLE_NAME } from '../shared/components.ts';

export function mountPluginDetailTypography(doc: Document, bundleName = BUNDLE_NAME) {
  const view = doc.defaultView!;
  const marker = 'data-pdsh-detail-heading';
  let disposed = false, queued = false, owned: HTMLElement | undefined;
  const relinquished = new WeakSet<HTMLElement>();
  function release() {
    if (owned?.getAttribute(marker) === '') owned.removeAttribute(marker);
    owned = undefined;
  }
  function sample() {
    if (disposed) return;
    if (owned && owned.getAttribute(marker) !== '') { relinquished.add(owned); owned = undefined; }
    const details = [...doc.querySelectorAll<HTMLElement>('[data-plugin-detail]')]
      .filter(node => node.dataset.pluginDetail === bundleName);
    const titles = details.length === 1 ? details[0].querySelectorAll<HTMLHeadingElement>('h3') : [];
    const title = titles.length === 1 ? titles[0] : undefined;
    const version = title?.nextElementSibling as HTMLElement | undefined;
    if (owned !== title) release();
    if (!title || title.childElementCount || !title.textContent?.trim() ||
      !version || version.tagName !== 'SPAN' || version.dataset.tone !== 'neutral' ||
      !/^v\d+\.\d+\.\d+(?:-[\w.]+)?$/.test(version.textContent?.trim() ?? '') ||
      relinquished.has(title) || (title.hasAttribute(marker) && owned !== title)) return;
    if (!owned) { title.setAttribute(marker, ''); owned = title; }
  }
  function schedule() {
    if (disposed || queued) return;
    queued = true;
    view.queueMicrotask(() => { queued = false; observer.disconnect(); sample(); observe(); });
  }
  const observer = new view.MutationObserver(schedule);
  function observe() {
    if (!disposed) observer.observe(doc.documentElement, { subtree: true, childList: true, characterData: true,
      attributes: true, attributeFilter: ['data-plugin-detail', marker] });
  }
  sample(); observe();
  return { dispose() {
    if (disposed) return;
    disposed = true; observer.disconnect(); release();
  } };
}