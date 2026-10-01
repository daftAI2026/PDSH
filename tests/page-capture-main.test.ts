/**
 * [INPUT]: 依赖 Main 真实 capture 控制器与 EventEmitter 原生窗口/frame/图像桩。
 * [OUTPUT]: 验证原 frame 交付、同 URL reload、取消后锁保留、独立视图/DPR/PNG 拒绝与卸载监听归还。
 * [POS]: Main 生命周期合同；桩原生图像不是安装件页面覆盖证明。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { runInNewContext } from 'node:vm';
import { createNativePageCapture } from '../src/host/page-capture-main.ts';
import { CAPTURE_RECEIVER } from '../src/shared/capture-bridge.ts';
const id = '11111111-1111-4111-8111-111111111111';
function fixture() {
  const bytes = Buffer.alloc(33); Buffer.from([137,80,78,71,13,10,26,10]).copy(bytes); bytes.writeUInt32BE(13, 8); bytes.write('IHDR',12);bytes.writeUInt32BE(2560,16);bytes.writeUInt32BE(1640,20);
  const before = { nonce: id, width: 1280, height: 820, dpr: 2, theme: 'light', scrollX: 0, scrollY: 0 }, deliveries = [];
  const receiver = { probe: () => before, receive(...args) { deliveries.push(args); return true; } };
  const frame = { isDestroyed: () => false, executeJavaScript: async (source, gesture) => { assert.equal(gesture, false); return runInNewContext(source, { [Symbol.for(CAPTURE_RECEIVER)]: receiver }); } };
  const image = { getScaleFactors: () => [2], getSize: () => ({ width: 2560, height: 1640 }), toPNG: () => bytes };
  const contents = Object.assign(new EventEmitter(), { isDestroyed: () => false, getURL: () => 'dsh-app://app/', mainFrame: frame, capturePage: async () => image });
  const win = Object.assign(new EventEmitter(), { webContents: contents, isDestroyed: () => false, isVisible: () => true, getContentSize: () => [1280,820], contentView: { children: [] as any[] } });
  return { win, contents, image, bytes, before, deliveries, capture: createNativePageCapture(win) };
}
test('原生 PNG 交付原 mainFrame 的固定接收器，全部监听归还', async () => {
  const h = fixture(); await h.capture.capture(id);
  assert.equal(h.deliveries.length,1);assert.equal(h.deliveries[0][1],id);assert.equal(h.deliveries[0][2],h.bytes.toString('base64'));
  h.capture.dispose();assert.equal(h.win.eventNames().length,0);assert.equal(h.contents.eventNames().length,0);
});
for (const reason of ['cancel', 'reload', 'dispose']) test(`${reason} 后不能送迟到 PNG，capturePage 结算前不能启动第二次`, async () => {
  const h = fixture(); let settle;
  h.contents.capturePage = () => new Promise(resolve => { settle = () => resolve(h.image); });
  const work = h.capture.capture(id), rejected = assert.rejects(work);
  await Promise.resolve();await Promise.resolve();
  if(reason==='cancel')h.capture.cancel(id);if(reason==='reload')h.contents.emit('did-start-navigation');if(reason==='dispose')h.capture.dispose();
  await assert.rejects(h.capture.capture(id));settle();await rejected;assert.equal(h.deliveries.length,0);h.capture.dispose();
});
test('未知请求/独立可见 WebContentsView/变化 DPR 拒绝，不伪造整窗覆盖', async () => {
  const h=fixture();await assert.rejects(h.capture.capture('not-id'));
  h.win.contentView.children=[{webContents:{},getVisible:()=>true}];await assert.rejects(h.capture.capture(id));
  h.win.contentView.children=[];h.before.dpr=1;await assert.rejects(h.capture.capture(id));h.capture.dispose();
});
test('PNG 原生声明尺寸和实际 IHDR 不同拒绝交付', async () => {
  const h=fixture();h.bytes.writeUInt32BE(2561,16);await assert.rejects(h.capture.capture(id));assert.equal(h.deliveries.length,0);h.capture.dispose();
});
test('停用后重新装配也不能绕过仍在执行的原生 capture 锁', async () => {
  const h=fixture();let settle;
  h.contents.capturePage=()=>new Promise(resolve=>{settle=()=>resolve(h.image);});
  const work=h.capture.capture(id), rejected=assert.rejects(work);await Promise.resolve();await Promise.resolve();
  h.capture.dispose();const next=createNativePageCapture(h.win);
  await assert.rejects(next.capture(id));settle();await rejected;
  h.contents.capturePage=async()=>h.image;await next.capture(id);next.dispose();
});
test('原生 getter 抛错也结算并释放共享锁，重装不永久失效',async()=>{
  const h=fixture(),original=h.win.getContentSize;h.win.getContentSize=()=>{throw new Error('native getter failed');};
  await assert.rejects(h.capture.capture(id));await Promise.race([h.capture.settled(),new Promise((_,reject)=>setTimeout(()=>reject(new Error('settlement stuck')),50))]);
  h.capture.dispose();h.win.getContentSize=original;const next=createNativePageCapture(h.win);await next.capture(id);next.dispose();
});
test('每次都限定 DSH 页面；可见 webview/iframe 未证明覆盖时拒绝',async()=>{
  const h=fixture();h.contents.getURL=()=> 'https://other.example/';await assert.rejects(h.capture.capture(id));
  h.contents.getURL=()=> 'dsh-app://app/';(h.before as any).unsupportedEmbed=true;await assert.rejects(h.capture.capture(id));h.capture.dispose();
});
