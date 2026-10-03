<!--
[INPUT]: 依赖 DeepSeek Harness upstream 的固定 rc.2 Typert protocol 源与 MIT 许可。
[OUTPUT]: 记录 build-only TypeScript 分析输入来源及所有文件 SHA-256。
[POS]: 第三方源码 provenance；包运行时仍解析精确 npm 依赖，本目录不进入 PDSH tgz。
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->
# Typert protocol source reference

- Upstream: `https://github.com/deepseek-ai/deepseek-harness`
- Commit: `639ed015397290b3745d163aafe02ffee4aa3f84`
- Package: `packages/typert/protocol`, `@deepseek-ai/dsh-typert-protocol@0.2.0-rc.2`
- Purpose: official `WorkspaceTypertGenerator` build-time type/reference analysis only. Production Host code imports the exact npm runtime dependency; this directory is neither an installable workspace package nor a packaged runtime copy.
- `package.json` keeps upstream bytes (including workspace protocol specifiers); package resolution in the temporary analyzer workspace is supplied by the exact npm dependency and TypeScript source paths.

| Path | SHA-256 |
| --- | --- |
| `src/index.ts` | `d44d7bd7811f975dd7937e818f43360a6d683e465e688002dfc0aa25c3f65a33` |
| `src/json-value.ts` | `c5d58b60b7e085004041326055737f7e718e719f5df7b7df5b09d2fb147e57c0` |
| `src/owned-value.ts` | `096c583e2093cd814d0cef5bc3f8161f6aabfe8cfe97eff78c3a340c0c95a44d` |
| `src/remote-error.ts` | `bb902ec537e1dfbc74885e77a01192e6532b50a959a5bc4cc55c1fbf52e0a368` |
| `src/types.ts` | `5ffb787a9d0751c7296723de83a4ec54abaf814bc41dbc7dd62d2de30cb32e94` |
| `package.json` | `847d7758d0c2ca9ee3b609eeecc73f179d685e226ed205d1d6bf22f5440a32fb` |
| `LICENSE` | `ebb4f09972aee8608be255debaf78451a68e95c290f55c240dec2ecfa16ea6be` |
