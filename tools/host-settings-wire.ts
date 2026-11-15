/**
 * [INPUT]: 依赖精确 Host 的 SettingsSchemaService 源码、Cordis 与 Settings 描述。只接收隔离 profile 数据。
 * [OUTPUT]: 用官方 Client 校验器验证真实 JSON schema/value；释放独立验证 Context。
 * [POS]: verify-host 的设置传输门。编译既有官方类，不伪造解析成功，不连接 Desktop。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import { transformSync } from 'esbuild'
import type { createRequire } from 'node:module'

export function createHostSettingsWireProbe(requireFromHost: ReturnType<typeof createRequire>) {
  const root = dirname(requireFromHost.resolve('@deepseek-ai/dsh-client-ui-settings'))
  const source = resolve(root, '../src/client/schema.ts')
  const module = { exports: {} as any }
  const { code } = transformSync(readFileSync(source, 'utf8'), { loader: 'ts', format: 'cjs' })
  runInNewContext(code, { module, exports: module.exports, require: requireFromHost }, { filename: source })
  const { Context } = requireFromHost('@deepseek-ai/cordis')
  const ctx = new Context()
  const validator = new module.exports.SettingsSchemaService(ctx)
  return {
    verify(view: { schema: unknown; value: unknown }) {
      const wire = JSON.parse(JSON.stringify(view))
      const failure = validator.validate(validator.rehydrate(wire.schema), wire.value)
      assert.equal(failure, undefined, '官方 Client 拒绝 Settings JSON 快照')
    },
    async dispose() { await ctx.fiber.dispose() },
  }
}
