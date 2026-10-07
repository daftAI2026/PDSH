/**
 * [INPUT]: 依赖已发布截图和保存的调用及结算语义。
 * [OUTPUT]: 提供稳定基础合同与独立壁纸扩展合同。
 * [POS]: 固定壳与业务模块共享的兼容边界。新增可选能力不更改基础合同。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
export const CAPTURE_RUNTIME_CONTRACT = 'pdsh-capture-runtime-v1'
export const CAPTURE_WALLPAPER_CONTRACT = 'pdsh-wallpaper-runtime-v1'
