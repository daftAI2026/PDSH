/**
 * [INPUT]: 依赖 Host Client Loader 提供的控件、URL 图标、Modal 契约与 esbuild 文本资源加载器。
 * [OUTPUT]: 声明仅在构建/宿主边界存在的模块形状。
 * [POS]: TypeScript 编译边界；运行时仍由 Harness 与 build.ts 提供实际实现。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
declare module '*.css' { const value: string; export default value; }
declare module '*.svg' { const value: string; export default value; }
declare const __PDSH_VERSION__: string;
declare module '@deepseek-ai/dsh-client-ui-primitives' {
  export const Modal: import('react').ComponentType<{
    open: boolean;
    onClose: () => void;
    title?: string;
    closeLabel?: string;
    description?: string;
    children?: import('react').ReactNode;
    footer?: import('react').ReactNode;
  }>;
  export const Input: any, Button: any, SettingsValueField: any, Switch: any, Tooltip: any, Toast: any, SegmentedControl: any, LinkIconRegular: any;
  export const IconUserOutlineMedium: any, IconEditOutlineRegular: any, IconCheckOutlineRegular: any, IconWarningOutlineRegular: any;
}
