/**
 * [INPUT]: 依赖当前单包 manifest 与自有临时目录。
 * [OUTPUT]: 提供含壁纸 DTO/descriptor、独立基础/扩展标记的合成产物与归档清单。
 * [POS]: bundle/release 测试共用合成产物；假 helper 从不执行，不冒充实机产物。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
export function artifactFixture() {
  const root = mkdtempSync(join(tmpdir(), 'pdsh-artifacts-'));
  const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  manifest.version = '0.3.0'; manifest.scripts = {};
  const files: string[] = [...manifest.files.filter((file: string) => !file.includes('*')), `lib/capture-runtime/${manifest.version}.js`, 'locale/zh.json', 'locale/en.json', 'package.json', 'README.md'];
  const write = (file: string, value: string) => { mkdirSync(dirname(join(root, file)), {recursive:true}); writeFileSync(join(root, file), value); };
  const save = () => write('package.json', JSON.stringify(manifest));
  for (const file of files) write(file, 'fixture');
  save();
  write('cordis.patch.yml', '- insert:\n    - id: pdsh\n      name: "@daftai/pdsh"\n');
  write('index.js', '/* PDSH build "0.3.0" */ @deepseek-ai/dsh-typert-protocol ./native/window-capture');
  write('lib/capture-runtime/0.3.0.js', '/* PDSH build \"0.3.0\" */ pdsh-capture-runtime-v1 pdsh-wallpaper-runtime-v1');
  write('client.js', '/* PDSH build "0.3.0" */\nwindow.__ModuleLoader__.load({id:"@daftai/pdsh",factory:()=>({})});');
  write('lib/typert.host.js', "service: 'pdshWindowCapture' namespace: 'pdshNativeWindowCapture' method: 'capture' method: 'save' method: 'wallpaper' method: 'implementationVersion' uplink:");
  write('lib/typert.remote-client.js', "method: 'capture' method: 'save' method: 'wallpaper' method: 'implementationVersion'");
  write('lib/typert.remote-client.d.ts', 'RemoteStreamHandle<WindowSaveFrame, WindowSaveInputFrame>');
  // +--- 只有可解析的头部，没有机器指令；从不作为可运行 helper 使用 ---+
  const helper = Buffer.alloc(160);
  helper.writeUInt32BE(0xcafebabe, 0); helper.writeUInt32BE(2, 4);
  for (const [index, cpu] of [0x01000007, 0x0100000c].entries()) {
    const entry = 8 + index * 20, offset = 48 + index * 56;
    helper.writeUInt32BE(cpu, entry); helper.writeUInt32BE(offset, entry + 8); helper.writeUInt32BE(56, entry + 12);
    helper.writeUInt32LE(0xfeedfacf, offset); helper.writeUInt32LE(cpu, offset + 4);
    helper.writeUInt32LE(1, offset + 16); helper.writeUInt32LE(24, offset + 20);
    helper.writeUInt32LE(0x32, offset + 32); helper.writeUInt32LE(24, offset + 36);
    helper.writeUInt32LE(1, offset + 40); helper.writeUInt32LE(0x000e0000, offset + 44);
  }
  writeFileSync(join(root, 'native/window-capture'), helper);
  const windows = Buffer.alloc(512);
  windows.writeUInt16LE(0x5a4d); windows.writeUInt32LE(64, 0x3c);
  windows.writeUInt32LE(0x00004550, 64); windows.writeUInt16LE(0x8664, 68);
  windows.writeUInt16LE(240, 84); windows.writeUInt16LE(0x20b, 88); windows.writeUInt16LE(3, 156);
  windows.write('<requestedExecutionLevel level="asInvoker" uiAccess="false"/>', 256);
  writeFileSync(join(root, 'native/windows/window-capture-x64.exe'), windows);
  chmodSync(join(root,'native/window-capture'), 0o755);
  return { root, manifest, files, write, save, dispose: () => rmSync(root, { recursive: true, force: true }) };
}
