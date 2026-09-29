/**
 * [INPUT]: 依赖 InCodex Shot 同源的五张离线背景图，由构建器转为 data URL。
 * [OUTPUT]: 提供截图工作台预设壁纸映射；不访问远程 URL 或文件系统。
 * [POS]: capture 的静态资产边界，让 UI/导出共享同一份像素来源。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import sea from './assets/sea.jpg';
import canyon from './assets/canyon.jpg';
import mist from './assets/mist.jpg';
import highland from './assets/highland.jpg';
import ocean from './assets/ocean.jpg';
export const presetAssets = { sea, canyon, mist, highland, ocean };
