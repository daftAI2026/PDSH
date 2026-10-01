/**
 * [INPUT]: 依赖编辑器阶段、状态命令及关闭/复制回调；读取工作台自身焦点控件。
 * [OUTPUT]: 提供工作台键盘绑定，Escape 归还资源，Tab 限定焦点，忙碌阶段拒绝复制/历史变更。
 * [POS]: 编辑器的输入适配边界；不持有图片或保存任务，生命周期由 editor.ts 所属根节点承担。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { captureHistoryShortcut, type CaptureWindowState, type CaptureWindowCommand } from './model.ts';
export function wireKeyboard(
  root: HTMLElement,
  state: CaptureWindowState,
  dispatch: (command: CaptureWindowCommand) => void,
  close: () => void,
  copy: () => Promise<void>,
): void {
  root.onkeydown = (event) => {
    const modifier = event.metaKey || event.ctrlKey;
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key === "Tab") {
      trapTabFocus(root, event);
      return;
    }
    if (root.getAttribute("data-state") !== "editing") return;
    if (modifier && event.key.toLowerCase() === "c") {
      event.preventDefault();
      void copy();
      return;
    }
    const historyCommand = captureHistoryShortcut(event.key, {
      control: event.ctrlKey,
      modifier,
      shift: event.shiftKey,
    });
    if (!historyCommand) return;
    event.preventDefault();
    dispatch({ kind: historyCommand });
  };
  root.setAttribute("tabindex", "-1");
  root.querySelector<HTMLElement>("button:not(:disabled), input:not(:disabled)")?.focus();
  root.setAttribute("data-tool", state.tool);
}

function trapTabFocus(root: HTMLElement, event: KeyboardEvent): void {
  const controls = [...root.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), [tabindex='0']")];
  if (controls.length === 0) return;
  const current = controls.indexOf(document.activeElement as HTMLElement);
  const next = event.shiftKey
    ? controls[(current <= 0 ? controls.length : current) - 1]
    : controls[(current + 1) % controls.length];
  event.preventDefault();
  next.focus();
}
