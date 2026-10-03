/**
 * [INPUT]: 依赖官方accepted配置、shared目录语法、本机Node path、单个Remote uplink与原子独占写入器。
 * [OUTPUT]: 提供惰性single-flight保存流；停用/取消后等待uplink和真实磁盘写入结算。
 * [POS]: pdshWindowCapture Host service复用的磁盘后端；不创建Cordis service、不接受Renderer路径或目标文件名。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { createHash } from 'node:crypto';
import { isAbsolute, join, normalize } from 'node:path';
import { CAPTURE_FILE_NAME_PATTERN, CAPTURE_SAVE_FORMATS, CAPTURE_EXPORT_MAX_PIXELS, captureExportFileName, isCaptureSaveDirectory } from '../shared/capture-export.ts';
import type { CaptureSaveFormat } from '../shared/capture-export.ts';
import { isCaptureId } from '../shared/capture-bridge.ts';
import { writeUniqueImage } from './page-save-file.ts';
import { validateWindowSaveImage } from './window-save-image.ts';
import {
  WINDOW_SAVE_CHUNK_BYTES, WINDOW_SAVE_MAX_BASE64_CHARS, WINDOW_SAVE_MAX_BYTES, WINDOW_SAVE_MAX_CHUNKS,
} from '../shared/window-save-protocol.ts';
import type { WindowSaveFailureCode, WindowSaveFrame, WindowSaveInputFrame, WindowSaveRequest } from '../shared/window-save-protocol.ts';

/** 只在Host内持有的Settings快照；路径来自 accepted Config，不来自wire。 */
export interface WindowSavePreferences {
  readonly captureEnabled: boolean;
  readonly saveDirectory: string;
  readonly saveFormat: CaptureSaveFormat;
  readonly fileNamePattern: string;
}

/** 文件写入接缝只服务临时目录合同；生产默认复用既有 fsync/独占link实现。 */
export type WindowSaveWriter = (target: string, bytes: Uint8Array, beforeCommit?: () => void) => Promise<void>;

export interface WindowSaveBackendOptions {
  /** 每次保存和提交前从官方 Settings 读取当前接受值。 */
  readonly preferences: () => WindowSavePreferences;
  /** 测试接缝；生产不注入时使用 page-save-file.ts 的独占自动编号提交。 */
  readonly writeUniqueImage?: WindowSaveWriter;
}

export interface WindowSaveSession {
  readonly signal: AbortSignal;
  readonly lifetimeSignal: AbortSignal;
  readonly uplink: AsyncIterable<WindowSaveInputFrame>;
}

interface UplinkIterator extends AsyncIterator<WindowSaveInputFrame> {}
interface ActiveSave {
  readonly requestId: string;
  readonly aborter: AbortController;
  readonly settled: Promise<void>;
  readonly generator: AsyncGenerator<WindowSaveFrame>;
  input?: UplinkIterator;
  removeAborters: () => void;
  resolve: () => void;
}

interface SaveLock { owner?: object }
const SAVE_LOCK = Symbol.for('@daftai/pdsh.window-save-singleflight.v1');
const INVALID_UUID = '';
const MAX_TITLE_BYTES = 2048;
const MAX_DIRECTORY_BYTES = 4096;
const BASE64_PATTERN = /^[A-Za-z0-9+/]*={0,2}$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;

class SaveFailure extends Error {
  readonly code:WindowSaveFailureCode;
  constructor(code: WindowSaveFailureCode) { super(code); this.code=code; this.name='SaveFailure'; }
}

/** 创建Host本地后端；构造不读Settings、开文件或接收网络。 */
export function createWindowSaveBackend(options: WindowSaveBackendOptions) {
  let state: 'active'|'disposing'|'disposed'='active';
  let current: ActiveSave|undefined;
  const writer=options.writeUniqueImage??writeUniqueImage;

  function save(request: WindowSaveRequest, session: WindowSaveSession): AsyncIterable<WindowSaveFrame> {
    // +--- 真实工作只在首次next启动；Remote方法的构造/mount不触碰磁盘 ---+
    let generator!: AsyncGenerator<WindowSaveFrame>;
    generator=runSave(request,session,()=>generator);
    return generator;
  }

  async function* runSave(request: WindowSaveRequest, session: WindowSaveSession, getGenerator:()=>AsyncGenerator<WindowSaveFrame>): AsyncGenerator<WindowSaveFrame> {
    const requestId=isCaptureId(request?.requestId)?request.requestId:INVALID_UUID;
    const terminal=(code:WindowSaveFailureCode):WindowSaveFrame=>({type:'terminal',requestId,code});
    if (state!=='active') { yield terminal('disposed'); return; }
    if (session?.signal?.aborted || session?.lifetimeSignal?.aborted) { yield terminal('cancelled'); return; }

    let accepted:WindowSavePreferences;
    try { accepted=readPreferences(options.preferences); validateRequest(request,accepted); }
    catch (error) { yield terminal(failureCode(error)); return; }
    const lock=saveLock();
    const owner={};
    if (current || lock.owner) { yield terminal('busy'); return; }

    const aborter=new AbortController();
    const abort=()=>{ if (!aborter.signal.aborted) aborter.abort(); };
    const sources=[session.signal,session.lifetimeSignal];
    for (const source of sources) source.addEventListener('abort',abort,{once:true});
    const removeAborters=()=>{ for (const source of sources) source.removeEventListener('abort',abort); };
    let resolve!:()=>void;
    const settled=new Promise<void>(done=>{resolve=done;});
    const active:ActiveSave={requestId,aborter,settled,generator:getGenerator(),removeAborters,resolve};
    current=active; lock.owner=owner;
    let input:UplinkIterator|undefined, done=false;
    try {
      assertActive(active,options.preferences,accepted);
      input=session.uplink[Symbol.asyncIterator](); active.input=input;
      const chunks:Buffer[]=[];
      const digest=createHash('sha256');
      let byteLength=0, chunkCount=0;
      let final:Extract<WindowSaveInputFrame,{type:'finish'}>|undefined;

      while (!final) {
        const next=await nextUplink(input,active.aborter.signal);
        if (next.done) throw new SaveFailure('invalid-input');
        assertActive(active,options.preferences,accepted);
        const frame=next.value;
        if (!isRecord(frame)) throw new SaveFailure('invalid-input');
        if (frame.type==='chunk') {
          const bytes=decodeChunk(frame,chunkCount);
          if (chunkCount>=WINDOW_SAVE_MAX_CHUNKS || byteLength+bytes.length>WINDOW_SAVE_MAX_BYTES) throw new SaveFailure('invalid-input');
          if (chunkCount>0 && chunks[chunkCount-1]!.length!==WINDOW_SAVE_CHUNK_BYTES) throw new SaveFailure('invalid-input');
          chunks.push(bytes); digest.update(bytes); byteLength+=bytes.length; ++chunkCount;
          yield {type:'ack',requestId,nextIndex:chunkCount};
          continue;
        }
        if (frame.type!=='finish' || !validFinish(frame,chunkCount,byteLength)) throw new SaveFailure('invalid-input');
        final=frame;
      }

      // +--- finish必须由Client half-close确认；任何尾帧都使整张图片失效 ---+
      const end=await nextUplink(input,active.aborter.signal);
      if (!end.done) throw new SaveFailure('invalid-input');
      if (chunkCount!==final.chunkCount || byteLength!==final.byteLength || digest.digest('hex')!==final.sha256) throw new SaveFailure('invalid-input');
      assertActive(active,options.preferences,accepted);
      const bytes=Buffer.concat(chunks,byteLength);
      try { validateWindowSaveImage(bytes,request.format,request.width,request.height); }
      catch { throw new SaveFailure('invalid-image'); }
      const fileName=captureExportFileName(accepted,new Date(request.capturedAt),{title:request.title,width:request.width,height:request.height});
      const target=join(accepted.saveDirectory,fileName);
      await writer(target,bytes,()=>assertActive(active,options.preferences,accepted));
      // +--- writer已通过提交围栏并resolve即代表atomic commit；此后abort不能谎报失败 ---+
      done=true;
      yield {type:'receipt',requestId,outcome:'saved',format:request.format,byteLength,width:request.width,height:request.height};
    } catch (error) {
      yield terminal(failureCode(error,active.aborter.signal));
    } finally {
      // +--- 回收仍打开的uplink，再释放单航班；dispose等此finally完成 ---+
      if (input && !done) {
        try { await input.return?.(); } catch { /* 不泄漏Host错误正文。 */ }
      }
      removeAborters();
      if (lock.owner===owner) delete lock.owner;
      if (current===active) current=undefined;
      resolve();
    }
  }

  async function dispose():Promise<void> {
    if (state==='disposed') return;
    state='disposing';
    const active=current;
    if (active) {
      active.aborter.abort();
      // +--- Close当前downlink generation；写入器不可取消时仍真实等待其settle ---+
      const closing=active.generator.return(undefined).then(()=>undefined,()=>undefined);
      await Promise.all([active.settled,closing]);
    }
    state='disposed';
  }

  return { save, dispose };
}

function saveLock():SaveLock {
  const root=globalThis as any;
  const existing=root[SAVE_LOCK] as SaveLock|undefined;
  if (existing) return existing;
  const created:SaveLock={}; root[SAVE_LOCK]=created; return created;
}

function readPreferences(read:()=>WindowSavePreferences):WindowSavePreferences {
  let value:WindowSavePreferences;
  try { value=read(); } catch { throw new SaveFailure('invalid-request'); }
  if (!isRecord(value) || value.captureEnabled!==true) throw new SaveFailure('disposed');
  const saveDirectory=typeof value.saveDirectory==='string' ? normalizeNativeSaveDirectory(value.saveDirectory) : null;
  if (!saveDirectory || value.saveDirectory.length>MAX_DIRECTORY_BYTES
    || Buffer.byteLength(value.saveDirectory)>MAX_DIRECTORY_BYTES
    || !CAPTURE_SAVE_FORMATS.includes(value.saveFormat) || typeof value.fileNamePattern!=='string'
    || !CAPTURE_FILE_NAME_PATTERN.test(value.fileNamePattern)) throw new SaveFailure('invalid-request');
  // +--- Settings read may expose a mutable live value; retain a value snapshot for the precommit fence ---+
  return {
    captureEnabled:true,
    saveDirectory,
    saveFormat:value.saveFormat,
    fileNamePattern:value.fileNamePattern,
  };
}

function normalizeNativeSaveDirectory(value:string):string|null {
  if (!value || !isCaptureSaveDirectory(value) || !isAbsolute(value)) return null;
  const normalized=normalize(value);
  if (normalized===value) return value;
  // +--- win32.normalize会给无尾分隔符的UNC共享根补一个分隔符；它仍是同一个目录 ---+
  if (normalized===`${value}\\` && /^\\\\[^\\]+\\[^\\]+$/u.test(value)) return normalized;
  return null;
}

function validateRequest(request:WindowSaveRequest,accepted:WindowSavePreferences):void {
  if (!isRecord(request) || !isCaptureId(request.requestId) || Object.keys(request).sort().join(',')!=='capturedAt,format,height,requestId,title,width'
    || !CAPTURE_SAVE_FORMATS.includes(request.format) || request.format!==accepted.saveFormat
    || typeof request.title!=='string' || request.title.length>1024 || Buffer.byteLength(request.title)>MAX_TITLE_BYTES
    || typeof request.capturedAt!=='string' || !isCanonicalDate(request.capturedAt)) throw new SaveFailure('invalid-request');
  try { assertCaptureSize(request.width,request.height); } catch { throw new SaveFailure('invalid-request'); }
}

function assertCaptureSize(width:number,height:number):void {
  // +--- 复用共享导出预算；取像的16MP限制不属于编辑器最终文件 ---+
  if (!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1||width>CAPTURE_EXPORT_MAX_PIXELS/height) throw new Error('size');
}

function isCanonicalDate(value:string):boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)) return false;
  const timestamp=Date.parse(value);
  return Number.isFinite(timestamp)&&new Date(timestamp).toISOString()===value;
}

function assertActive(active:ActiveSave,read:()=>WindowSavePreferences,initial:WindowSavePreferences):void {
  if (stateIsAborted(active.aborter.signal)) throw new SaveFailure('cancelled');
  let now:WindowSavePreferences;
  try { now=readPreferences(read); } catch (error) { if (error instanceof SaveFailure && error.code==='disposed') throw error; throw new SaveFailure('invalid-request'); }
  if (now.saveDirectory!==initial.saveDirectory||now.saveFormat!==initial.saveFormat||now.fileNamePattern!==initial.fileNamePattern) throw new SaveFailure('invalid-request');
}

function stateIsAborted(signal:AbortSignal):boolean { return signal.aborted; }

function decodeChunk(frame:Record<string,unknown>,expectedIndex:number):Buffer {
  if (frame.type!=='chunk'||frame.index!==expectedIndex||!Number.isSafeInteger(frame.index)
    ||typeof frame.base64!=='string'||!frame.base64.length||frame.base64.length>WINDOW_SAVE_MAX_BASE64_CHARS
    ||frame.base64.length%4!==0||!BASE64_PATTERN.test(frame.base64)) throw new SaveFailure('invalid-input');
  const bytes=Buffer.from(frame.base64,'base64');
  if (!bytes.length||bytes.length>WINDOW_SAVE_CHUNK_BYTES||bytes.toString('base64')!==frame.base64) throw new SaveFailure('invalid-input');
  return bytes;
}

function validFinish(frame:Record<string,unknown>,chunks:number,bytes:number):frame is Extract<WindowSaveInputFrame,{type:'finish'}> {
  return frame.type==='finish'&&Number.isSafeInteger(frame.chunkCount)&&frame.chunkCount===chunks
    &&Number.isSafeInteger(frame.byteLength)&&frame.byteLength===bytes&&bytes>0&&bytes<=WINDOW_SAVE_MAX_BYTES
    &&chunks>0&&chunks<=WINDOW_SAVE_MAX_CHUNKS&&chunks===Math.ceil(bytes/WINDOW_SAVE_CHUNK_BYTES)
    &&typeof frame.sha256==='string'&&SHA256_PATTERN.test(frame.sha256);
}

async function nextUplink(iterator:UplinkIterator,signal:AbortSignal):Promise<IteratorResult<WindowSaveInputFrame>> {
  if (signal.aborted) throw new SaveFailure('cancelled');
  const pending=Promise.resolve().then(()=>iterator.next());
  let remove=()=>{};
  const interrupted=new Promise<never>((_resolve,reject)=>{
    const abort=()=>reject(new SaveFailure('cancelled'));
    signal.addEventListener('abort',abort,{once:true});
    remove=()=>signal.removeEventListener('abort',abort);
    if (signal.aborted) abort();
  });
  try { return await Promise.race([pending,interrupted]); }
  catch (error) {
    if (signal.aborted) {
      // +--- 请求级/Host停用都要打断uplink读取；仍等待正在执行的next真实结束 ---+
      try { await iterator.return?.(); } catch { /* 最终错误映射为固定失败码。 */ }
      await pending.then(()=>undefined,()=>undefined);
      throw new SaveFailure('cancelled');
    }
    throw error;
  } finally { remove(); }
}

function failureCode(error:unknown,signal?:AbortSignal):WindowSaveFailureCode {
  if (signal?.aborted) return 'cancelled';
  return error instanceof SaveFailure?error.code:'save-failed';
}

function isRecord(value:unknown):value is Record<string,any> {
  return Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
}
