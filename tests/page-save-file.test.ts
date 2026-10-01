/**
 * [INPUT]: 依赖真实原子保存函数与独立临时目录，文件仅为测试创建的字节。
 * [OUTPUT]: 验证已确认替换、并发自动编号不覆盖、提交前取消和临时文件精确归还。
 * [POS]: Main 文件提交合同；不调用 Electron 或用户目录，不能替代原生面板验收。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeConfirmedImage, writeUniqueImage } from '../src/host/page-save-file.ts';
test('同目录临时文件完整提交，新增文件0600；覆盖不残留临时文件',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'pdsh-save-file-')),target=join(directory,'fixture.png');
  try{await writeConfirmedImage(target,Buffer.from('first'));assert.equal((await stat(target)).mode&0o777,0o600);await writeConfirmedImage(target,Buffer.from('replacement'));assert.equal(await readFile(target,'utf8'),'replacement');assert.deepEqual(await readdir(directory),['fixture.png']);}finally{await rm(directory,{recursive:true,force:true});}
});

test('直接保存完整文件后独占命名，并发同名自动编号绝不覆盖已有图片',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'pdsh-save-unique-')),target=join(directory,'fixture.png');
  try{
    await writeFile(target,'original');await Promise.all([writeUniqueImage(target,Buffer.from('first')),writeUniqueImage(target,Buffer.from('second'))]);
    assert.equal(await readFile(target,'utf8'),'original');assert.deepEqual((await readdir(directory)).sort(),['fixture (1).png','fixture (2).png','fixture.png']);
    assert.deepEqual([await readFile(join(directory,'fixture (1).png'),'utf8'),await readFile(join(directory,'fixture (2).png'),'utf8')].sort(),['first','second']);
    await assert.rejects(writeUniqueImage(target,Buffer.from('cancelled'),()=>{throw Error('cancelled fixture');}));assert.equal((await readdir(directory)).length,3);
  }finally{await rm(directory,{recursive:true,force:true});}
});
test('提交前围栏拒绝时旧文件字节不变，失败只归还独占临时文件',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'pdsh-save-file-')),target=join(directory,'fixture.png');
  try{await writeFile(target,'original');await assert.rejects(writeConfirmedImage(target,Buffer.from('must not publish'),()=>{throw Error('cancelled fixture');}));assert.equal(await readFile(target,'utf8'),'original');assert.deepEqual(await readdir(directory),['fixture.png']);}finally{await rm(directory,{recursive:true,force:true});}
});

test('临时文件中途写入失败不会截断现有目标，精确移除半成品',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'pdsh-save-file-')),target=join(directory,'fixture.png');
  async function* interrupted(){yield Buffer.from('partial new bytes');throw Error('simulated IO interruption');}
  try{await writeFile(target,'original');await assert.rejects(writeConfirmedImage(target,interrupted() as any));assert.equal(await readFile(target,'utf8'),'original');assert.deepEqual(await readdir(directory),['fixture.png']);}finally{await rm(directory,{recursive:true,force:true});}
});
