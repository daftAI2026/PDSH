/**
 * [INPUT]: 依赖 v0.5.3 已提交的 macOS 助手及全部编译输入。
 * [OUTPUT]: 只允许原字节助手和同源输入用于 Windows 构建。
 * [POS]: Bundle 构建的异平台复用门；输入变化要求 macOS SDK 重建，不证明 Mac 实机。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

// +--- 绑定官方 v0.5.3 的原生闭包；文本按 Git LF 形态比较 ---+
export const MAC_BASELINE = Object.freeze({
  'native/window-capture': 'b1f7faef1867ac6e140f0867792e59a5aa82195df88a771a2693ebc2fe2bfafd',
  'native/window-capture.mm': '384d13eae7ab6513bf2fef15de511fe7284f1a0d865a9315d67248cf5924cf33',
  'native/system-wallpaper.mm': '32802e9808150a8dfbc7c9465e8237583f8fe04065303a5cf85400d470dfaa3b',
  'native/system-wallpaper.h': '886511b5fa368701a40317295656e85b8727d43a09ebdc89bd66e64d2a13e54a',
  'native/build.sh': 'e8af7d81a096b4458380e33097078c212403e1ac341f26e2989f59980da67634',
});

export async function assertReusableMacBaseline(root: string): Promise<void> {
  for (const [file, expected] of Object.entries(MAC_BASELINE)) {
    const bytes = await readFile(join(root, file));
    const canonical = file === 'native/window-capture' ? bytes : bytes.toString('utf8').replace(/\r\n/g, '\n');
    if (createHash('sha256').update(canonical).digest('hex') !== expected) {
      throw new Error(`Mac native baseline changed; rebuild with macOS SDK: ${file}`);
    }
  }
}
