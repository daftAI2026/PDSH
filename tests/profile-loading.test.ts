/**
 * [INPUT]: 依赖实际单 Bundle patch、生成 Host/Client 与隔离 profile 链接结构桩。
 * [OUTPUT]: 验证根包可解析 Host/Client/元信息，缺根包必须失败，不假冒官方安装验收。
 * [POS]: 基础打包路径回归；正式 PluginManager 与 Desktop UI 另行验收。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, symlinkSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
function fixture(installed=true) {
  const profile=mkdtempSync(join(tmpdir(),'pdsh-profile-loading-'));
  mkdirSync(join(profile,'node_modules/@daftai'),{recursive:true});
  if(installed)symlinkSync(fileURLToPath(new URL('../',import.meta.url)),join(profile,'node_modules/@daftai/pdsh'));
  return {require:createRequire(join(profile,'profile.cjs')),dispose:()=>rmSync(profile,{recursive:true,force:true})};
}
test('单安装包通过一个正式包名解析 Host、Client、离线名称',async()=>{
  const h=fixture();try{
    const patch=readFileSync(new URL('../cordis.patch.yml',import.meta.url),'utf8');
    const rows=[...patch.matchAll(/- id: ([\w-]+)\s+name: "([^"]+)"/g)];
    assert.deepEqual(rows.map(([,id,name])=>({id,name})),[{id:'pdsh',name:'@daftai/pdsh'}]);
    const host=await import(pathToFileURL(h.require.resolve('@daftai/pdsh')).href);assert.equal(typeof host.apply,'function');
    const client=readFileSync(h.require.resolve('@daftai/pdsh/client'),'utf8');assert.ok(client.includes('id:"@daftai/pdsh"'));
    for(const lang of ['zh','en']){const meta=JSON.parse(readFileSync(h.require.resolve(`@daftai/pdsh/locale/${lang}.json`),'utf8')).meta;assert.ok(meta.title);assert.ok(meta.description);assert.doesNotMatch(meta.title,/file:|@daftai/);}
  }finally{h.dispose();}
});
test('未安装的根包确实无法解析，不用本地源码伪造安装',()=>{const h=fixture(false);try{assert.throws(()=>h.require.resolve('@daftai/pdsh'),{code:'MODULE_NOT_FOUND'});}finally{h.dispose();}});
