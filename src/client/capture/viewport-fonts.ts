/**
 * [INPUT]: 依赖当前 Document 的 CSSOM、AbortSignal 与注入的 URL→data URL 资产边界；不自行发起网络请求。
 * [OUTPUT]: 对外提供 collectViewportFontCSS 与可供视口采集器分类的安全收集错误。
 * [POS]: capture/viewport.ts 的字体准备层；只内嵌可读 @font-face，所有资源策略交由 Client 采集边界注入。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

export type ViewportFontCollectionErrorCode =
  | 'stylesheet-unreadable'
  | 'font-resource-failed'
  | 'invalid-font-css';

export class ViewportFontCollectionError extends Error {
  readonly code: ViewportFontCollectionErrorCode;

  constructor(code: ViewportFontCollectionErrorCode) {
    super(messageFor(code));
    this.name = 'ViewportFontCollectionError';
    this.code = code;
  }
}

export interface ViewportFontCollectionOptions {
  signal?: AbortSignal;
  loadAsset: (url: string) => Promise<string>;
}

interface FontRuleSource {
  cssText: string;
  baseUrl: string;
}

interface CssUrlToken {
  start: number;
  end: number;
  value: string;
}

const FONT_FACE_RULE = 5;
const IMPORT_RULE = 3;
const EMPTY_FONT_CSS = '/* No readable @font-face rules. */';

function messageFor(code: ViewportFontCollectionErrorCode): string {
  switch (code) {
    case 'stylesheet-unreadable': return '字体样式表不可读取';
    case 'font-resource-failed': return '字体资源无法安全内嵌';
    default: return '字体 CSS 无法安全解析';
  }
}

function checkAbort(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  throw makeAbortError();
}

function makeAbortError(): Error {
  const error = new Error('字体采集已取消');
  error.name = 'AbortError';
  return error;
}

function raceAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  checkAbort(signal);
  if (!signal) return promise;

  return new Promise<T>((resolve, reject) => {
    const cleanup = () => signal.removeEventListener('abort', onAbort);
    const onAbort = () => {
      cleanup();
      reject(makeAbortError());
    };
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (value) => {
        cleanup();
        if (signal.aborted) reject(makeAbortError());
        else resolve(value);
      },
      (error) => {
        cleanup();
        if (signal.aborted) reject(makeAbortError());
        else reject(error);
      },
    );
  });
}

function read<T>(readValue: () => T): T {
  try {
    return readValue();
  } catch {
    throw new ViewportFontCollectionError('stylesheet-unreadable');
  }
}

function stylesheetBase(doc: Document, sheet: CSSStyleSheet): string {
  const href = read(() => sheet.href);
  const documentBase = read(() => doc.baseURI);
  try {
    return new URL(href || documentBase, documentBase).href;
  } catch {
    throw new ViewportFontCollectionError('stylesheet-unreadable');
  }
}

function decodeCssEscapes(value: string): string {
  let decoded = '';
  for (let index = 0; index < value.length; index++) {
    const current = value[index];
    if (current !== '\\' || index + 1 >= value.length) {
      decoded += current;
      continue;
    }

    const next = value[index + 1];
    if (next === '\n' || next === '\f') {
      index++;
      continue;
    }
    if (next === '\r') {
      index++;
      if (value[index + 1] === '\n') index++;
      continue;
    }

    const hexStart = index + 1;
    let hexEnd = hexStart;
    while (hexEnd < value.length && hexEnd - hexStart < 6 && /[\da-f]/i.test(value[hexEnd])) hexEnd++;
    if (hexEnd > hexStart) {
      const codePoint = Number.parseInt(value.slice(hexStart, hexEnd), 16);
      decoded += codePoint === 0 || codePoint > 0x10ffff ? '\uFFFD' : String.fromCodePoint(codePoint);
      index = hexEnd - 1;
      if (/\s/.test(value[index + 1] ?? '')) index++;
      continue;
    }

    decoded += next;
    index++;
  }
  return decoded;
}

function isNameCharacter(value: string | undefined): boolean {
  return value !== undefined && /[\w-]/.test(value);
}

function isCssSpace(value: string | undefined): boolean {
  return value !== undefined && /\s/.test(value);
}

function skipString(cssText: string, start: number): number {
  const quote = cssText[start];
  for (let index = start + 1; index < cssText.length; index++) {
    if (cssText[index] === '\\') index++;
    else if (cssText[index] === quote) return index + 1;
  }
  return cssText.length;
}

function readUrlToken(cssText: string, start: number): CssUrlToken {
  let cursor = start + 3;
  if (cssText[cursor] !== '(') throw new ViewportFontCollectionError('invalid-font-css');
  cursor++;
  while (isCssSpace(cssText[cursor])) cursor++;

  let value = '';
  const quote = cssText[cursor];
  if (quote === '"' || quote === "'") {
    const valueStart = ++cursor;
    while (cursor < cssText.length) {
      if (cssText[cursor] === '\\') cursor += 2;
      else if (cssText[cursor] === quote) break;
      else cursor++;
    }
    if (cursor >= cssText.length) throw new ViewportFontCollectionError('invalid-font-css');
    value = cssText.slice(valueStart, cursor);
    cursor++;
    while (isCssSpace(cssText[cursor])) cursor++;
    if (cssText[cursor] !== ')') throw new ViewportFontCollectionError('invalid-font-css');
  } else {
    const valueStart = cursor;
    while (cursor < cssText.length) {
      if (cssText[cursor] === '\\') cursor += 2;
      else if (cssText[cursor] === ')') break;
      else if (cssText[cursor] === '"' || cssText[cursor] === "'") {
        throw new ViewportFontCollectionError('invalid-font-css');
      } else cursor++;
    }
    if (cursor >= cssText.length) throw new ViewportFontCollectionError('invalid-font-css');
    value = cssText.slice(valueStart, cursor).trim();
  }

  return { start, end: cursor + 1, value: decodeCssEscapes(value) };
}

function findCssUrls(cssText: string): CssUrlToken[] {
  const tokens: CssUrlToken[] = [];
  for (let index = 0; index < cssText.length; index++) {
    if (cssText[index] === '/' && cssText[index + 1] === '*') {
      const end = cssText.indexOf('*/', index + 2);
      index = end < 0 ? cssText.length : end + 1;
      continue;
    }
    if (cssText[index] === '"' || cssText[index] === "'") {
      index = skipString(cssText, index) - 1;
      continue;
    }
    if (cssText.slice(index, index + 3).toLowerCase() !== 'url' || isNameCharacter(cssText[index - 1])) continue;
    if (cssText[index + 3] !== '(') continue;
    tokens.push(readUrlToken(cssText, index));
    index = tokens[tokens.length - 1].end - 1;
  }
  return tokens;
}

function escapeCssString(value: string): string {
  return value.replace(/[\\"\n\r\f]/g, (character) => {
    if (character === '\n') return '\\a ';
    if (character === '\r') return '\\d ';
    if (character === '\f') return '\\c ';
    return `\\${character}`;
  });
}

async function toDataUrl(
  rawUrl: string,
  baseUrl: string,
  options: ViewportFontCollectionOptions,
  signal: AbortSignal | undefined,
  cache: Map<string, Promise<string>>,
): Promise<string> {
  checkAbort(signal);
  let absoluteUrl: string;
  try {
    absoluteUrl = new URL(rawUrl, baseUrl).href;
  } catch {
    throw new ViewportFontCollectionError('font-resource-failed');
  }
  if (/^data:/i.test(absoluteUrl)) return absoluteUrl;

  let pending = cache.get(absoluteUrl);
  if (!pending) {
    pending = Promise.resolve()
      .then(() => options.loadAsset(absoluteUrl))
      .then((dataUrl) => {
        if (typeof dataUrl !== 'string' || !/^data:/i.test(dataUrl)) {
          throw new ViewportFontCollectionError('font-resource-failed');
        }
        return dataUrl;
      })
      .catch((error) => {
        if (error instanceof ViewportFontCollectionError) throw error;
        throw new ViewportFontCollectionError('font-resource-failed');
      });
    cache.set(absoluteUrl, pending);
  }

  try {
    const dataUrl = await raceAbort(pending, signal);
    checkAbort(signal);
    return dataUrl;
  } catch (error) {
    if (signal?.aborted) throw makeAbortError();
    throw error;
  }
}

async function inlineRule(source: FontRuleSource, options: ViewportFontCollectionOptions, cache: Map<string, Promise<string>>): Promise<string> {
  checkAbort(options.signal);
  const urls = findCssUrls(source.cssText);
  if (urls.length === 0) return source.cssText;

  let output = '';
  let cursor = 0;
  for (const token of urls) {
    checkAbort(options.signal);
    const dataUrl = await toDataUrl(token.value, source.baseUrl, options, options.signal, cache);
    output += `${source.cssText.slice(cursor, token.start)}url("${escapeCssString(dataUrl)}")`;
    cursor = token.end;
  }
  return output + source.cssText.slice(cursor);
}

/** 收集可读字体规则并将 URL 交给调用方内嵌；不解析/刷新 @import 网络请求。 */
export async function collectViewportFontCSS(doc: Document, options: ViewportFontCollectionOptions): Promise<string> {
  checkAbort(options.signal);
  const sources: FontRuleSource[] = [];
  const visitedSheets = new Set<CSSStyleSheet>();

  const visitSheet = (sheet: CSSStyleSheet): void => {
    checkAbort(options.signal);
    if (!sheet || visitedSheets.has(sheet)) return;
    visitedSheets.add(sheet);
    const baseUrl = stylesheetBase(doc, sheet);
    const rules = read(() => Array.from(sheet.cssRules));
    visitRules(rules, baseUrl);
  };

  const visitRules = (rules: CSSRule[], baseUrl: string): void => {
    for (const rule of rules) {
      checkAbort(options.signal);
      const type = read(() => rule.type);
      if (type === FONT_FACE_RULE) {
        sources.push({ cssText: read(() => rule.cssText), baseUrl });
      } else if (type === IMPORT_RULE) {
        const imported = read(() => (rule as CSSImportRule).styleSheet);
        if (imported) visitSheet(imported);
      }

      const nestedRules = read(() => (rule as CSSGroupingRule).cssRules);
      if (nestedRules) visitRules(Array.from(nestedRules), baseUrl);
    }
  };

  const sheets = read(() => Array.from(doc.styleSheets));
  for (const sheet of sheets) visitSheet(sheet);
  checkAbort(options.signal);
  if (sources.length === 0) return EMPTY_FONT_CSS;

  const cache = new Map<string, Promise<string>>();
  const inlined: string[] = [];
  for (const source of sources) {
    checkAbort(options.signal);
    inlined.push(await inlineRule(source, options, cache));
  }
  checkAbort(options.signal);
  return inlined.join('\n');
}
