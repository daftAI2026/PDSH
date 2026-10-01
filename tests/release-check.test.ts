/**
 * [INPUT]: 依赖真实 check-release.ts、隔离临时 Git 树与受控生成产物。
 * [OUTPUT]: 验证三包版本/入口/真实包名同步门的正例和漂移拒绝。
 * [POS]: 发布守门回归，不提交用户仓库、创建 tag 或访问网络。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync, rmSync, unlinkSync, symlinkSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
function fixture() {
  const root=mkdtempSync(join(tmpdir(),'pdsh-release-contract-')),version='0.3.0';
  const write=(path,value)=>writeFileSync(join(root,path),value),git=(...args)=>execFileSync('git',args,{cwd:root,stdio:'pipe'});
  copyFileSync(new URL('../check-release.ts',import.meta.url),join(root,'check-release.ts'));
  copyFileSync(new URL('../component-source.ts',import.meta.url),join(root,'component-source.ts'));
  write('package.json',JSON.stringify({version,files:['components/']}));write('client.js',JSON.stringify(version));write('README.md','**0.3.0 版本** v0.3.0');write('AGENTS.md','## 0.3.0 release contract');
  write('cordis.patch.yml', '- insert:\n    - id: pdsh\n      name: "@daftai/pdsh"\n    - id: pdsh-titles\n      name: "@daftai/pdsh-titles"\n    - id: pdsh-capture\n      name: "@daftai/pdsh-capture"\n');
  for(const kind of ['titles','capture']) {
    mkdirSync(join(root,`components/${kind}/locale`),{recursive:true});write(`components/${kind}/package.json`,JSON.stringify({name:`@daftai/pdsh-${kind}`,version}));
    for(const file of ['index.js','client.js','client.js.map','plugin-icon.svg','locale/zh.json','locale/en.json',...(kind==='capture'?['main.cjs']:[])])write(`components/${kind}/${file}`,JSON.stringify(version));
  }
  git('init','-q');git('add','.');git('-c','user.name=PDSH Fixture','-c','user.email=fixture@example.invalid','commit','-qm','component sources');
  const sha=git('rev-parse','HEAD').toString().trim();
  const dependencies=Object.fromEntries(['titles','capture'].map(kind=>[`@daftai/pdsh-${kind}`,`github:daftAI2026/PDSH#${sha}&path:/components/${kind}`]));
  write('package.json',JSON.stringify({version,files:['components/'],dependencies}));
  git('add','.');git('-c','user.name=PDSH Fixture','-c','user.email=fixture@example.invalid','commit','-qm','fixed component source');
  return {root,write,git,check(){try{return {ok:true,text:execFileSync(process.execPath,['--experimental-strip-types','check-release.ts'],{cwd:root,encoding:'utf8',stdio:'pipe'})};}catch(error){return {ok:false,text:String(error.stderr)};}},dispose(){rmSync(root,{recursive:true,force:true});}};
}
test('三个完整入口与正确真实包名可形成清洁发布候选，不自动打 tag',()=>{
  const h=fixture();try{const result=h.check();assert.equal(result.ok,true,result.text);assert.match(result.text,/tag not created/);assert.equal(h.git('tag','--list').toString(),'');}finally{h.dispose();}
});
test('子包版本、Main 入口或 profile 加载路径漂移必须拒绝',()=>{
  for(const defect of ['version','main','path','archive','dependencies']) {
    const h=fixture();try{
      if(defect==='dependencies')h.write('package.json',JSON.stringify({version:'0.3.0',files:['components/'],dependencies:{}}));
      if(defect==='archive')h.write('package.json',JSON.stringify({version:'0.3.0',files:[]}));
      if(defect==='version')h.write('components/capture/package.json',JSON.stringify({name:'@daftai/pdsh-capture',version:'0.2.1'}));
      if(defect==='main')unlinkSync(join(h.root,'components/capture/main.cjs'));
      if(defect==='path')h.write('cordis.patch.yml', '- insert:\n    - id: pdsh-titles\n      name: "@daftai/pdsh-titles"\n');
      const result=h.check();assert.equal(result.ok,false);assert.match(result.text,defect==='version'?/name\/version drift/:defect==='main'?/main.cjs/:defect==='archive'?/archive component membership missing/:defect==='dependencies'?/must pin/:/profile loading path drift/);
    }finally{h.dispose();}
  }
});

test('固定组件提交旧字节、缺失或符号链接不能过发布门',()=>{
  for(const defect of ['stale','missing','link','pin']) {
    const h=fixture();try {
      const target='components/capture/client.js';
      if(defect==='stale')h.write(target,'old connection.rpc');
      if(defect==='missing')unlinkSync(join(h.root,target));
      if(defect==='link'){unlinkSync(join(h.root,target));symlinkSync('../titles/client.js',join(h.root,target));}
      if(defect==='pin'){
        const manifest=JSON.parse(readFileSync(join(h.root,'package.json'),'utf8'));
        for(const kind of ['titles','capture'])manifest.dependencies[`@daftai/pdsh-${kind}`]=`github:daftAI2026/PDSH#${'1'.repeat(40)}&path:/components/${kind}`;
        h.write('package.json',JSON.stringify(manifest));
      }
      h.git('add','-A');h.git('-c','user.name=PDSH Fixture','-c','user.email=fixture@example.invalid','commit','-qm','defect');
      const result=h.check();assert.equal(result.ok,false,`${defect} source accepted`);assert.match(result.text,/component source/);
    }finally{h.dispose();}
  }
});
