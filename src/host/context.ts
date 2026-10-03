/**
 * [INPUT]: 依赖 Cordis Context 与 Host 唯一 `WindowCaptureService` 实例类型。
 * [OUTPUT]: 将已注册的 `pdshWindowCapture` Host service 暴露给 Config owner 的窄生命周期桥。
 * [POS]: Host Context augmentation；只描述真实 `ctx.plugin(WindowCaptureService)` 注册，不伪造 Remote descriptor。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import type { Context } from '@deepseek-ai/cordis'
import type { WindowCaptureService } from './window-capture-service.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    pdshWindowCapture: WindowCaptureService
  }
}

export {}
