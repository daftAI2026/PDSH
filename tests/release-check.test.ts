/**
 * [INPUT]: 依赖真实发布守门脚本与隔离 Git 单包产物。
 * [OUTPUT]: 验证长期指南与双语当前版本分离。拒绝缺章、漂移、脏树及 tag 冲突。
 * [POS]: 发布流程回归；实验包安装不依赖本门或 tag。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync, rmSync, chmodSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { artifactFixture } from './bundle-fixture.ts';
import { syncPublicMetadata } from '../tools/release-metadata.ts';
function fixture() {
  const base = artifactFixture();
  const {root,write} = base;
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, stdio: 'pipe' });
  for (const file of ['check-release.ts', 'bundle-artifacts.ts', 'tools/release-metadata.ts']) {
    mkdirSync(join(root, file, '..'), {recursive:true});
    copyFileSync(new URL(`../${file}`, import.meta.url), join(root, file));
  }
  write('README.md','**0.3.0 版本** v0.3.0\n<!-- pdsh:description:start -->\n旧简介\n<!-- pdsh:description:end -->'); write('AGENTS.md','# PDSH Agent Guide\n\n## Release\n\n稳定发布使用清洁 main。\n');
  write('README.en.md','**Version 0.3.0** v0.3.0\n<!-- pdsh:description:start -->\nOld description\n<!-- pdsh:description:end -->');
  write('locale/zh.json', JSON.stringify({meta:{}}));write('locale/en.json', JSON.stringify({meta:{}}));
  syncPublicMetadata(root);
  const currentManifest=JSON.parse(readFileSync(join(root,'package.json'),'utf8'));
  write('github.json', JSON.stringify({description:currentManifest.description,homepage:currentManifest.homepage,topics:['dsh-plugin','deepseek-harness','deepseek','screenshot','redaction','typescript']}));
  write('.bin/gh',`#!/usr/bin/env node\nimport fs from 'node:fs';if(process.argv[2]!=='api'||process.argv.includes('--method'))process.exit(9);const value=JSON.parse(fs.readFileSync('github.json','utf8'));if(process.argv[3]==='repos/daftAI2026/PDSH')process.stdout.write(JSON.stringify(value));else if(process.argv[3]==='repos/daftAI2026/PDSH/topics')process.stdout.write(JSON.stringify({names:value.topics}));else process.exit(9);\n`);chmodSync(join(root,'.bin/gh'),0o755);
  const commit=()=>{git('add','.');git('-c','user.name=PDSH Fixture','-c','user.email=fixture@example.invalid','commit','-qm','fixture');};
  git('init','-q','-b','main');commit();
  return {root,write,git,commit,check(tag?:string){try{return {ok:true,text:execFileSync(process.execPath,['--experimental-strip-types','check-release.ts',...(tag?[tag]:[])],{cwd:root,encoding:'utf8',stdio:'pipe',env:{...process.env,PATH:`${join(root,'.bin')}:${process.env.PATH}`}})};}catch(error){return {ok:false,text:String(error.stderr)};}},dispose(){rmSync(root,{recursive:true,force:true});}};
}
test('清洁单包稳定候选通过，但不创建 tag',()=>{const h=fixture();try{const result=h.check();assert.equal(result.ok,true,result.text);assert.match(result.text,/tag not created/);assert.equal(h.git('tag','--list').toString(),'');}finally{h.dispose();}});
test('发布门接受实际长期指南，不要求逐版本发布标题',()=>{
  const h=fixture();try{
    h.write('AGENTS.md',readFileSync(new URL('../AGENTS.md',import.meta.url),'utf8'));h.commit();
    const result=h.check();assert.equal(result.ok,true,result.text);
    assert.match(result.text,/tag not created/);assert.equal(h.git('tag','--list').toString(),'');
  }finally{h.dispose();}
});
test('发布门拒绝缺失、逐版本或非精确的 Release 章节',()=>{
  for(const guide of ['# PDSH Agent Guide\n## Project\n','## 0.3.0 release contract\n',
    '### Release\n','## Release notes\n','prefix ## Release\n']){
    const h=fixture();try{
      h.write('AGENTS.md',guide);h.commit();
      const result=h.check();assert.equal(result.ok,false,guide);
      assert.match(result.text,/AGENTS must include a version-independent Release section/);
      assert.equal(h.git('tag','--list').toString(),'');
    }finally{h.dispose();}
  }
});
test('漂移、脏树、错误 tag 与已存在异位 tag 均拒绝',()=>{
  for(const defect of ['artifact','readme','readmeEnglish','dirty','tag','existing','branch']) {const h=fixture();try{
    if(defect==='artifact')h.write('index.js','stale');
    if(defect==='readme'){h.write('README.md',readFileSync(join(h.root,'README.md'),'utf8').replaceAll('0.3.0','0.2.1'));h.commit();}
    if(defect==='readmeEnglish'){h.write('README.en.md',readFileSync(join(h.root,'README.en.md'),'utf8').replaceAll('0.3.0','0.2.1'));h.commit();}
    if(defect==='branch')h.git('switch','-c','rc/fixture');
    if(defect==='dirty')h.write('untracked','x');
    if(defect==='existing'){h.git('tag','v0.3.0');h.write('change','x');h.commit();}
    const result=h.check(defect==='tag'?'v0.4.0':undefined);assert.equal(result.ok,false,defect);assert.match(result.text,/version drift|clean|does not match|another commit|checked on main/);
  }finally{h.dispose();}}
});

test('发布前拒绝本地简介和 GitHub About/Topics 未同步，不自动修补远端',()=>{
  for(const defect of ['locale','about','topics']){const h=fixture();try{
    if(defect==='locale')h.write('locale/zh.json',JSON.stringify({meta:{title:'旧标题',description:'旧简介'}}));
    else {const remote=JSON.parse(readFileSync(join(h.root,'github.json'),'utf8'));if(defect==='about')remote.description='旧功能';else remote.topics=['dsh-plugin'];h.write('github.json',JSON.stringify(remote));}
    h.commit();const result=h.check();assert.equal(result.ok,false,defect);assert.match(result.text,/metadata|简介|locale|description|topics|主题|元信息/i);
  }finally{h.dispose();}}
});
