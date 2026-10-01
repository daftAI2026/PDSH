/**
 * [INPUT]: 依赖 src/host/titles.ts，由 build.ts 生成。
 * [OUTPUT]: 提供 @daftai/pdsh-titles 的 Config/name/apply。
 * [POS]: titles Host 入口，不手工修改。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

// src/host/titles.ts
import z from "@deepseek-ai/schemastery";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
function ownsModule(specifier) {
  try {
    const url = new URL(specifier);
    return url.protocol === "file:" && realpathSync(fileURLToPath(url)) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}
var name = "pdsh-titles";
var Config = z.object({ maskTitles: z.boolean().default(false).description("Mask sidebar titles / \u906E\u6321\u4FA7\u680F\u6807\u9898").volatile() });
async function inheritLegacyTitles(ctx, isDisposed = () => false) {
  await ctx.root.loader.await();
  if (isDisposed()) return;
  const rows = ctx.configEditor.configuration();
  const own = rows.find((row) => row.entry.options.id === "pdsh-titles" && ownsModule(row.entry.options.name));
  const legacy = rows.find((row) => row.entry.options.id === "pdsh" && row.entry.options.name === "@daftai/pdsh");
  if (!own || !legacy || Object.hasOwn(own.entry.options.config ?? {}, "maskTitles")) return;
  const raw = legacy.entry.options.config?.maskTitles;
  if (typeof raw !== "boolean") return;
  const descriptor = ctx.settings.describe().find((view) => view.ns === "pdsh-titles");
  if (!descriptor || isDisposed()) return;
  await ctx.settings.mutate("pdsh-titles", [{ op: "set", path: ["maskTitles"], value: raw }], descriptor.revision);
}
function apply(ctx) {
  ctx.inject(["settings", "configEditor"], (child) => {
    child.effect(() => child.settings.configure({ auto: false }, ctx.fiber));
    child.effect(() => {
      let disposed = false;
      void inheritLegacyTitles(child, () => disposed).catch(() => {
        if (!disposed) child.logger.warn("PDSH title preferences were not migrated; existing configuration was left intact.");
      });
      return () => {
        disposed = true;
      };
    });
  });
}
export {
  Config,
  apply,
  inheritLegacyTitles,
  name
};
