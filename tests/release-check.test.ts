/**
 * [INPUT]: 依赖真实发布守门脚本与隔离 Git 单包产物。
 * [OUTPUT]: 验证清洁稳定候选、产物漂移、脏树与 tag 冲突拒绝，不自动创建 tag。
 * [POS]: 发布流程回归；实验包安装不依赖本门或 tag。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'pdsh-release-'));
  const write = (file: string, value: string) => writeFileSync(join(root, file), value);
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, stdio: 'pipe' });
  for (const file of ['check-release.ts', 'bundle-artifacts.ts']) copyFileSync(new URL(`../${file}`, import.meta.url), join(root, file));
  mkdirSync(join(root, 'locale'));
  write('package.json', JSON.stringify({name:'@daftai/pdsh',version:'0.3.0',private:true,files:['index.js','client.js','client.js.map','main.cjs','cordis.patch.yml','plugin-icon.svg','style-sources.json','THIRD_PARTY_NOTICES.md','LICENSE','locale/*.json'],exports:{'.':'./index.js','./client':'./client.js'},dsh:{bundle:{patch:'./cordis.patch.yml'}}}));
  for (const file of ['index.js','main.cjs']) write(file, '/* PDSH build "0.3.0" */');
  write('client.js', '/* PDSH build "0.3.0" */ window.__ModuleLoader__.load({id:"@daftai/pdsh"});');
  for (const file of ['client.js.map','plugin-icon.svg','locale/zh.json','locale/en.json']) write(file, '{}');
  write('cordis.patch.yml', '- insert:\n    - id: pdsh\n      name: "@daftai/pdsh"');
  write('README.md','**0.3.0 版本** v0.3.0'); write('AGENTS.md','## 0.3.0 release contract');
  const commit=()=>{git('add','.');git('-c','user.name=PDSH Fixture','-c','user.email=fixture@example.invalid','commit','-qm','fixture');};
  git('init','-q','-b','main');commit();
  return {root,write,git,commit,check(tag?:string){try{return {ok:true,text:execFileSync(process.execPath,['--experimental-strip-types','check-release.ts',...(tag?[tag]:[])],{cwd:root,encoding:'utf8',stdio:'pipe'})};}catch(error){return {ok:false,text:String(error.stderr)};}},dispose(){rmSync(root,{recursive:true,force:true});}};
}
test('清洁单包稳定候选通过，但不创建 tag',()=>{const h=fixture();try{const result=h.check();assert.equal(result.ok,true,result.text);assert.match(result.text,/tag not created/);assert.equal(h.git('tag','--list').toString(),'');}finally{h.dispose();}});
test('漂移、脏树、错误 tag 与已存在异位 tag 均拒绝',()=>{
  for(const defect of ['artifact','dirty','tag','existing','branch']) {const h=fixture();try{
    if(defect==='artifact')h.write('main.cjs','stale');
    if(defect==='branch')h.git('switch','-c','rc/fixture');
    if(defect==='dirty')h.write('untracked','x');
    if(defect==='existing'){h.git('tag','v0.3.0');h.write('change','x');h.commit();}
    const result=h.check(defect==='tag'?'v0.4.0':undefined);assert.equal(result.ok,false,defect);assert.match(result.text,/version drift|clean|does not match|another commit|checked on main/);
  }finally{h.dispose();}}
});
