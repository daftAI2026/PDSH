/**
 * [INPUT]: 依赖组件分发实体化器与独立临时树，覆盖真实文件、链接和 hardlink。
 * [OUTPUT]: 验证普通文件交付、完整成员白名单与原子替换，不触碰用户 profile/store。
 * [POS]: GitHub 首装与旧组件残留复发的持久化回归；传输/实机验收另行执行。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, symlink, link, unlink, rm, readdir, lstat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { materializeComponentPackages } from '../component-packages.ts';
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'pdsh-self-packages-'));
  for (const kind of ['titles', 'capture']) {
    await mkdir(join(root, `components/${kind}/locale`), { recursive: true });
    for (const file of ['package.json','index.js','client.js','client.js.map','plugin-icon.svg','CLAUDE.md','locale/zh.json','locale/en.json','locale/CLAUDE.md',...(kind==='capture'?['main.cjs']:[])]) await writeFile(join(root, `components/${kind}/${file}`), `source ${kind}/${file}`);
  }
  return { root, target: join(root, 'node_modules/@daftai/pdsh-titles'), dispose: () => rm(root, { recursive: true, force: true }) };
}
test('实体化重复执行保持同源；替换 hardlink 不改源，也不遗漏未知临时文件', async () => {
  const h = await fixture();
  try {
    await materializeComponentPackages(h.root);
    const file = join(h.target, 'client.js'), neighbor = join(h.root, 'neighbor');
    await writeFile(neighbor, 'keep neighbor'); await unlink(file); await link(neighbor, file);
    await materializeComponentPackages(h.root);
    assert.equal(await readFile(neighbor, 'utf8'), 'keep neighbor');
    assert.equal(await readFile(file, 'utf8'), 'source titles/client.js');
    assert.ok(!(await readdir(h.target)).some(name => name.endsWith('.tmp')));
  } finally { await h.dispose(); }
});
test('未知目录/成员与 leaf/scope 符号链接拒绝，不清除陌生内容', async () => {
  for (const defect of ['unknown-dir','unknown-file','unknown-locale','leaf-link','scope-link']) {
    const h = await fixture();
    try {
      await materializeComponentPackages(h.root);
      if (defect === 'unknown-dir') { await unlink(join(h.target, '.pdsh-generated')); }
      if (defect === 'unknown-file') await writeFile(join(h.target, 'foreign'), 'keep');
      if (defect === 'unknown-locale') await writeFile(join(h.target, 'locale/foreign'), 'keep');
      if (defect === 'leaf-link') { await unlink(join(h.target, 'client.js')); await symlink(join(h.root,'components/titles/client.js'), join(h.target,'client.js')); }
      if (defect === 'scope-link') { const scope=join(h.root,'node_modules/@daftai'); await rm(scope,{recursive:true}); await symlink(join(h.root,'components'), scope); }
      await assert.rejects(materializeComponentPackages(h.root), /ownership|unknown/);
      assert.equal(await readFile(join(h.root, 'components/titles/client.js'), 'utf8'), 'source titles/client.js');
    } finally { await h.dispose(); }
  }
});

test('缺源产物不破坏旧链接也不创建半成品，补回源后可再次构建', async()=>{
  for(const linked of [false,true]) {
    const h=await fixture();try {
      const target=join(h.root,'node_modules/@daftai/pdsh-capture');
      if(linked){await mkdir(join(h.root,'node_modules/@daftai'),{recursive:true});await symlink('../../components/capture',target);}
      await unlink(join(h.root,'components/capture/main.cjs'));
      await assert.rejects(materializeComponentPackages(h.root),/ownership/);
      if(linked) assert.ok((await lstat(target)).isSymbolicLink());
      else await assert.rejects(lstat(target),{code:'ENOENT'});
      await writeFile(join(h.root,'components/capture/main.cjs'),'source capture/main.cjs');
      await materializeComponentPackages(h.root);
      assert.equal(await readFile(join(target,'main.cjs'),'utf8'),'source capture/main.cjs');
    } finally{await h.dispose();}
  }
});
