/**
 * [INPUT]: 依赖 client-entry.jsx 及宿主共享 module table；由 build.mjs 生成。
 * [OUTPUT]: 提供 @daftai/pdsh 的浏览器 lazy factory，不手工修改此产物。
 * [POS]: PDSH 安装入口；提交预构建产物，使 Git/目录安装不需要运行构建脚本。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
window.__ModuleLoader__.load({id:"@daftai/pdsh",factory:(require)=>{var module={exports:{}};var exports=module.exports;
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// client-entry.jsx
var client_entry_exports = {};
__export(client_entry_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(client_entry_exports);
var import_react2 = __toESM(require("react"), 1);
var import_client = require("react-dom/client");
var import_dsh_client_ui_primitives2 = require("@deepseek-ai/dsh-client-ui-primitives");

// presentation.js
var LAUNCHER = '[data-slot="settings.launcher"] button[aria-haspopup="menu"][data-collapsed][data-signed-out]';
var OWNED = "[data-pdsh-name], [data-pdsh-avatar-image]";
var MARKERS = ["data-pdsh-original-label", "data-pdsh-avatar"];
function mountPresentation(doc) {
  let preferences;
  let currentStatus = "disabled";
  let disposed = false;
  const owned = /* @__PURE__ */ new Set();
  const marked = /* @__PURE__ */ new Set();
  const listeners = /* @__PURE__ */ new Set();
  const originalFrames = doc.body.getAttribute("data-pdsh-frames");
  function publish(status) {
    if (currentStatus === status) return;
    currentStatus = status;
    for (const listener of listeners) listener();
  }
  function clearIdentity() {
    for (const node of owned) node.remove();
    owned.clear();
    for (const node of marked) for (const attr of MARKERS) node.removeAttribute(attr);
    marked.clear();
  }
  function refresh() {
    if (disposed || !preferences) return;
    if (preferences.frames) {
      if (!doc.body.hasAttribute("data-pdsh-frames")) doc.body.setAttribute("data-pdsh-frames", "");
    } else doc.body.removeAttribute("data-pdsh-frames");
    if (!preferences.maskIdentity) {
      clearIdentity();
      publish("disabled");
      return;
    }
    const triggers = [...doc.querySelectorAll(LAUNCHER)];
    if (triggers.length !== 1) {
      clearIdentity();
      publish("unsupported");
      return;
    }
    const trigger = triggers[0];
    if (trigger.dataset.signedOut === "true") {
      clearIdentity();
      publish("signed-out");
      return;
    }
    if (trigger.dataset.signedOut !== "false") {
      clearIdentity();
      publish("unsupported");
      return;
    }
    const wide = trigger.dataset.collapsed === "false";
    const children = [...trigger.children].filter((node) => !node.matches(OWNED));
    const avatar = children[0];
    const label = wide ? children[1] : null;
    if (children.length !== (wide ? 2 : 1) || avatar?.tagName !== "SPAN" || !avatar.querySelector(":scope > img:not([data-pdsh-avatar-image]), :scope > svg") || wide && label?.tagName !== "SPAN") {
      clearIdentity();
      publish("unsupported");
      return;
    }
    for (const node of [...owned]) if (!trigger.contains(node)) {
      node.remove();
      owned.delete(node);
    }
    for (const node of [...marked]) if (!trigger.contains(node)) {
      for (const attr of MARKERS) node.removeAttribute(attr);
      marked.delete(node);
    }
    avatar.setAttribute("data-pdsh-avatar", "");
    marked.add(avatar);
    let image = avatar.querySelector(":scope > [data-pdsh-avatar-image]");
    if (!image) {
      image = doc.createElement("img");
      image.setAttribute("data-pdsh-avatar-image", "");
      image.alt = "";
      image.referrerPolicy = "no-referrer";
      avatar.append(image);
      owned.add(image);
    }
    if (image.getAttribute("src") !== preferences.avatar) image.setAttribute("src", preferences.avatar);
    let alias = trigger.querySelector(":scope > [data-pdsh-name]");
    if (wide) {
      label.setAttribute("data-pdsh-original-label", "");
      marked.add(label);
      if (!alias) {
        alias = doc.createElement("span");
        alias.setAttribute("data-pdsh-name", "");
        trigger.append(alias);
        owned.add(alias);
      }
      if (alias.className !== label.className) alias.className = label.className;
      if (alias.textContent !== preferences.nickname) alias.textContent = preferences.nickname;
    } else if (alias) {
      alias.remove();
      owned.delete(alias);
    }
    publish("masked");
  }
  const observer = new doc.defaultView.MutationObserver(() => {
    observer.disconnect();
    refresh();
    observe();
  });
  function observe() {
    if (!disposed) observer.observe(doc.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["data-collapsed", "data-signed-out", "class"]
    });
  }
  observe();
  return {
    update(value) {
      observer.disconnect();
      preferences = value;
      refresh();
      observe();
    },
    refresh() {
      observer.disconnect();
      refresh();
      observe();
    },
    status: () => currentStatus,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose() {
      disposed = true;
      observer.disconnect();
      clearIdentity();
      listeners.clear();
      if (originalFrames === null) doc.body.removeAttribute("data-pdsh-frames");
      else doc.body.setAttribute("data-pdsh-frames", originalFrames);
    }
  };
}

// settings-card.jsx
var import_react = __toESM(require("react"), 1);
var import_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");

// node_modules/.pnpm/blobatar@2.7.0_react@18.3.1/node_modules/blobatar/dist/uri.js
function v({ l: t, c: e, h: n }) {
  let a = n * Math.PI / 180, o = e * Math.cos(a), r = e * Math.sin(a), s = t + 0.3963377774 * o + 0.2158037573 * r, c = t - 0.1055613458 * o - 0.0638541728 * r, i = t - 0.0894841775 * o - 1.291485548 * r, l = s * s * s, m = c * c * c, u = i * i * i;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * u, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * u, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * u];
}
var q = (t) => t.every((e) => e >= -1e-4 && e <= 1.0001);
function V(t) {
  let e = v(t);
  if (!q(e)) {
    let n = 0, a = t.c;
    for (let o = 0; o < 12; o++) {
      let r = (n + a) / 2;
      if (q(v({ ...t, c: r }))) n = r;
      else a = r;
    }
    e = v({ ...t, c: n });
  }
  return e.map((n) => Math.min(1, Math.max(0, n)));
}
function U(t) {
  let [e, n, a] = V(t);
  return 0.2126 * e + 0.7152 * n + 0.0722 * a;
}
function B(t, e) {
  let n = U(t), a = U(e);
  return (Math.max(n, a) + 0.05) / (Math.min(n, a) + 0.05);
}
function w(t, e, n) {
  if (B(t, e) >= n) return t;
  let a = t.l >= e.l ? 1 : -1;
  for (let s of [a, -a]) {
    let c = { ...t };
    for (let i = 0; i < 60; i++) {
      if (c.l = Math.min(1, Math.max(0, c.l + s * 0.02)), B(c, e) >= n) return c;
      if (c.l === 0 || c.l === 1) break;
    }
  }
  let o = { ...t, l: 0, c: 0 }, r = { ...t, l: 1, c: 0 };
  return B(o, e) >= B(r, e) ? o : r;
}
function T(t) {
  return "#" + V(t).map((e) => {
    let n = e <= 31308e-7 ? 12.92 * e : 1.055 * Math.pow(e, 0.4166666666666667) - 0.055;
    return Math.round(n * 255).toString(16).padStart(2, "0");
  }).join("");
}
var N = [[0.2, { l: 0.86, c: 0.085 }], [0.36, { l: 0.9, c: 0.028 }], [0.62, { l: 0.73, c: 0.135 }], [0.8, { l: 0.62, c: 0.165 }], [0.93, { l: 0.87, c: 0.16 }], [1, { l: 0.34, c: 0.035 }]];
var wt = (t) => N.find(([e]) => t < e)?.[1] ?? N[0][1];
var K = { l: 0.145, c: 0, h: 0 };
var Q = 1.5;
var Et = (t, e) => {
  let n = wt(e), a = w({ l: n.l, c: n.c, h: t }, K, Q);
  return { bg: { l: 0.965, c: 0.01, h: t }, head: a, eye: a.l >= 0.5 ? { l: 0.17, c: 0.02, h: t } : { l: 0.97, c: 0.012, h: t } };
};
var vt = [["head", "bg", 1.25], ["eye", "head", 4.5]];
function It(t, e = true, n = 0) {
  let a = Et(t, n);
  if (e) for (let [o, r, s] of vt) a[o] = w(a[o], a[r], s);
  return a;
}
function G(t, e = true, n = 0) {
  let a = It(t, e, n), o = {};
  for (let r in a) o[r] = T(a[r]);
  return o;
}
var y = (t) => {
  let e = Math.round(t * 100) / 100;
  return Object.is(e, -0) ? "0" : String(e);
};
function P({ cx: t, cy: e, rx: n, ry: a, n: o = 4, rot: r = 0 }) {
  let s = Math.min(1, (8 * Math.pow(2, -1 / o) - 4) / 3), c = n, i = a, l = c * s, m = i * s, u = [[c, 0], [c, m], [l, i], [0, i], [-l, i], [-c, m], [-c, 0], [-c, -m], [-l, -i], [0, -i], [l, -i], [c, -m], [c, 0]], b = r * Math.PI / 180, p = Math.cos(b), d = Math.sin(b), h = (x) => {
    let [g, k] = u[x];
    return `${y(t + g * p - k * d)} ${y(e + g * d + k * p)}`;
  }, f = `M${h(0)}`;
  for (let x = 1; x < 13; x += 3) f += `C${h(x)} ${h(x + 1)} ${h(x + 2)}`;
  return f + "Z";
}
function J(t, e, n, a, o, r = 0) {
  let s = o.length, c = r * Math.PI / 180, i = o.map((u, b) => {
    let p = c + 2 * Math.PI * b / s;
    return [t + n * u * Math.cos(p), e + a * u * Math.sin(p)];
  }), l = (u) => i[(u % s + s) % s], m = `M${y(l(0)[0])} ${y(l(0)[1])}`;
  for (let u = 0; u < s; u++) {
    let [b, p] = l(u - 1), [d, h] = l(u), [f, x] = l(u + 1), [g, k] = l(u + 2);
    m += `C${y(d + (f - b) / 6)} ${y(h + (x - p) / 6)} ${y(f - (g - d) / 6)} ${y(x - (k - h) / 6)} ${y(f)} ${y(x)}`;
  }
  return m + "Z";
}
function W({ cx: t, cy: e, rx: n, ry: a, sides: o, round: r = 0.3, rot: s = 0 }) {
  let c = r > 0 ? r < 1 ? r / 2 : 0.5 : 0, i = s * Math.PI / 180 - Math.PI / 2, l = Array.from({ length: o }, (p, d) => {
    let h = i + 2 * Math.PI * d / o;
    return [t + n * Math.cos(h), e + a * Math.sin(h)];
  }), m = (p) => l[(p % o + o) % o], u = (p, d) => {
    let [h, f] = m(p), [x, g] = m(d);
    return `${y(h + (x - h) * c)} ${y(f + (g - f) * c)}`;
  }, b = `M${u(0, -1)}`;
  for (let p = 0; p < o; p++) {
    let [d, h] = m(p);
    if (b += `Q${y(d)} ${y(h)} ${u(p, p + 1)}`, c < 0.5) b += `L${u(p + 1, p)}`;
  }
  return b + "Z";
}
function tt(t, e, n, a) {
  let o = y(t - n), r = y(t + n);
  return `M${o} ${y(e - a)}H${r}V${y(e + a)}H${o}Z`;
}
function et(t, e, n, a, o) {
  let r = Math.max(1.05, o), s = n * Math.sqrt(1 - 1 / (r * r)), c = e - a / r, i = e - r * a, l = s * 0.14, m = c + 0.86 * (i - c);
  return `M${y(t - s)} ${y(c)}L${y(t - l)} ${y(m)}Q${y(t)} ${y(i)} ${y(t + l)} ${y(m)}L${y(t + s)} ${y(c)}Z`;
}
function I(t, e) {
  for (let n = 0; n < e.length; n++) t = Math.imul(t ^ e[n], 3432918353), t = t << 13 | t >>> 19;
  return t;
}
function At(t) {
  return t = Math.imul(t ^ t >>> 16, 2246822507), t = Math.imul(t ^ t >>> 13, 3266489909), (t ^ t >>> 16) >>> 0;
}
var nt = new TextEncoder();
function Rt(t) {
  return t.normalize("NFC").trim().toLowerCase();
}
function rt(t, e = true) {
  let n = e ? Rt(t) : t;
  return I(1779033703 ^ n.length, nt.encode(n));
}
function A(t, e) {
  return At(I(I(t, Uint8Array.of(255)), nt.encode(e))) / 4294967296;
}
function ot(t, e = true, n) {
  let a = rt(t, e), o = (r) => {
    let s = n?.[r], c = Array.isArray(s) ? s[Math.floor(A(a, r) * s.length)] : s;
    return c === void 0 ? A(a, r) : c > 0 ? c < 1 ? c : 0.999999 : 0;
  };
  return o.num = (r, s, c) => s + o(r) * (c - s), o.int = (r, s, c) => s + Math.floor(o(r) * (c - s + 1)), o.pick = (r, s) => s[Math.floor(o(r) * s.length)], o.bool = (r, s = 0.5) => o(r) < s, o.jitter = (r, s) => (o(r) * 2 - 1) * s, o;
}
function E(t, e, n) {
  let a = e.expression;
  if (n || !a) return { l: t, wrap: "" };
  return a.bake(t, a.p);
}
var R = (t, e) => e?.tint ? e.tint(t, e.p) : t;
var at = (t, e) => e ? `<g transform="${e}">${t}</g>` : t;
var Ft = (t) => t.replace(/[&<>]/g, (e) => e === "&" ? "&amp;" : e === "<" ? "&lt;" : "&gt;");
function S(t, e) {
  let n = ot(t, e.normalize ?? true, e.traits);
  return { t: n, palette: { ...G(e.hue ?? n.num("hue", 0, 360), e.contrast ?? true, e.tone ?? n("tone")), ...e.palette } };
}
var jt = (t) => t.title ? `<title>${Ft(t.title)}</title>` : "";
function L(t, e, n) {
  let a = e.background ?? t.background;
  if (a === false) return;
  return { d: a === "square" ? "M0 0H100V100H0Z" : P({ cx: 50, cy: 50, rx: 50, ry: 50, n: a === "circle" ? 2 : 6 }), fill: n.bg };
}
var Ct = (t) => t ? `<path d="${t.d}" fill="${t.fill}"/>` : "";
function st(t) {
  return (e, n = {}) => {
    let { t: a, palette: o } = S(e, n), r = R(o, n.expression), s = n.size ? ` width="${n.size}" height="${n.size}"` : "", c = E(t.layout(a), n), i = jt(n) + Ct(L(t, n, r)) + at(t.render(c.l, r), c.wrap);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"${s}>${i}</svg>`;
  };
}
var it = (t, e, n) => {
  let a = e.rx, o = t.num("eye.rx", 0.075, 0.105) * a, r = t.num("eye.ratio", 1.9, 3.2), s = t.num("eye.scale", 0.78, 1.24), c = t.num("eye.stretch", 0.85, 1.18), i = t.num("eye.gap", 0.1, 0.24) * a, l = o * Math.max(1, s), m = o * r * Math.max(1, s * c), u = l + a * 0.03 + i, b = t.jitter("gaze.x", 0.09) * n.rx, p = t.num("gaze.y", -0.2, 0.08) * n.ry, d = t.jitter("eye.dy", 0.04) * n.ry, h = Math.hypot(l, m), f = Math.hypot((Math.abs(b) + u + h) / n.rx, (Math.abs(p) + Math.abs(d) + h) / n.ry), x = f > 0.9 ? 0.9 / f : 1, g = o * x, k = g * r, C = u * x, Ot = Math.max(0, Math.min(1, i / m)), St = Math.min(12, Math.asin(Ot) * 180 / Math.PI), _ = t.num("eye.lean", -1, 1) * St, Bt = Math.max(-12, Math.min(12, _ + t.jitter("eye.lean2", 3.5))), H = n.cx + b * x, z = n.cy + p * x;
  return [{ cx: H - C, cy: z, rx: g, ry: k, n: t.num("eye.n", 3.5, 6), rot: _ }, { cx: H + C, cy: z + d * x, rx: g * s, ry: k * s * c, n: t.num("eye.n", 3.5, 6), rot: Bt }];
};
function ut(t, e) {
  let n = (r) => (t.find(([, s]) => r < s) ?? t[t.length - 1])[0];
  function a(r) {
    let s = n(r("shape")), c = r.num("body.r", 31, 38) * s.core, i = { cx: 50 + r.jitter("body.x", 1.5), cy: 50 + r.jitter("body.y", 1.5), rx: c, ry: c * r.num("body.ratio", 0.92, 1.08), n: r.num("body.n", 1.9, 2.5), rot: 0, radii: Array.from({ length: r.int("body.pts", 6, 8) }, (u, b) => 1 + r.jitter(`body.r${b}`, 0.16)) };
    s.body?.(r, i);
    let l = s.face?.(i) ?? i, m = { petals: [], extra: [] };
    return s.decorate?.(r, i, m), { shape: s.name, draw: s.path, body: i, face: l, petals: m.petals, extra: m.extra, eyes: e(r, i, l) };
  }
  function o(r, s, c) {
    let i = (u) => Math.round(u * 100) / 100, l = (u, b) => {
      let p = `<path d="${P(u)}"/>`;
      return c ? `<g class="mo-eye" style="--mo-wrap:${b ? 1 : -1};--mo-lean:${i(u.rot)};transform-origin:${i(u.cx)}px ${i(u.cy)}px">${p}</g>` : p;
    }, m = `<g fill="${s.head}">` + r.petals.map((u) => `<circle cx="${i(u.cx)}" cy="${i(u.cy)}" r="${i(u.r)}"/>`).join("") + r.extra.map((u) => `<path d="${u}"/>`).join("") + `<path d="${r.draw ? r.draw(r.body) : P(r.body)}"/></g><g fill="${s.eye}"${c ? ' class="mo-eyes"' : ""}>` + r.eyes.map(l).join("") + "</g>";
    return c ? `<g class="mo-breathe"><g class="mo-bob">${m}</g></g>` : m;
  }
  return { layout: a, render: o, background: false };
}
var lt = (t) => W(t);
var mt = (t) => J(t.cx, t.cy, t.rx, t.ry, t.radii, t.rot);
var j = (t) => (e) => ({ cx: e.cx, cy: e.cy, rx: e.rx * t, ry: e.ry * t });
var pt = (t) => j(Math.min(...t.radii) * 0.95)(t);
var _t = (t) => j(0.84)(t);
var yt = { name: "round", core: 1 };
var bt = { name: "organic", core: 0.98, path: mt, face: pt };
var xt = { name: "boxy", core: 0.86, body: (t, e) => {
  e.n = t.num("body.n", 3.4, 6), e.rot = t.num("body.rot", -20, 20);
} };
var ht = { name: "capsule", core: 1.02, body: (t, e) => {
  e.ry *= t.num("capsule.squat", 0.55, 0.68);
}, face: j(0.94), decorate: (t, e, n) => {
  for (let a of [-1, 1]) n.petals.push({ cx: e.cx + a * (e.rx - e.ry), cy: e.cy, r: e.ry });
}, path: (t) => tt(t.cx, t.cy, t.rx - t.ry, t.ry) };
var dt = { name: "nub", core: 0.88, decorate: (t, e, n) => {
  let a = t.int("nub.n", 1, 2);
  for (let o = 0; o < a; o++) {
    let r = t.num(`nub.a${o}`, 0, 2 * Math.PI);
    n.petals.push({ cx: e.cx + Math.cos(r) * e.rx * 0.88, cy: e.cy + Math.sin(r) * e.rx * 0.88, r: e.rx * t.num(`nub.r${o}`, 0.24, 0.4) });
  }
} };
var ft = { name: "cloud", core: 0.78, face: pt, path: mt, decorate: (t, e, n) => {
  let a = t.int("cloud.n", 4, 6);
  for (let o = 0; o < a; o++) {
    let r = Math.PI + Math.PI * (o + 0.5) / a;
    n.petals.push({ cx: e.cx + Math.cos(r) * e.rx * 0.8, cy: e.cy + Math.sin(r) * e.rx * 0.5, r: e.rx * t.num(`cloud.r${o}`, 0.44, 0.62) });
  }
} };
var gt = { name: "droplet", core: 0.78, body: (t, e) => {
  e.cy += 0.22 * e.ry, e.n = 2;
}, face: (t) => ({ cx: t.cx, cy: t.cy + t.ry * 0.05, rx: t.rx * 0.88, ry: t.ry * 0.88 }), decorate: (t, e, n) => {
  n.extra.push(et(e.cx, e.cy, e.rx, e.ry, t.num("droplet.tip", 1.4, 1.65)));
} };
var Mt = { name: "hexagon", core: 1.05, path: lt, face: _t, body: (t, e) => {
  e.sides = 6, e.rot = t.num("body.rot", -12, 12), e.round = t.num("poly.round", 0.24, 0.5);
} };
var kt = { name: "sun", core: 0.7, decorate: (t, e, n) => {
  let a = t.int("sun.n", 6, 9), o = e.rx * t.num("sun.dist", 1, 1.08), r = e.rx * t.num("sun.r", 0.2, 0.26), s = t.num("sun.rot", 0, 2 * Math.PI);
  for (let c = 0; c < a; c++) {
    let i = s + 2 * Math.PI * c / a;
    n.petals.push({ cx: e.cx + Math.cos(i) * o, cy: e.cy + Math.sin(i) * o, r });
  }
} };
var $t = { name: "triangle", core: 1.15, path: lt, body: (t, e) => {
  e.sides = 3, e.rot = t.num("body.rot", -5, 5), e.round = t.num("poly.round", 0.24, 0.5);
}, face: (t) => ({ cx: t.cx, cy: t.cy + t.ry * 0.1, rx: t.rx * 0.54, ry: t.ry * 0.36 }) };
var Ht = [[yt, 0.22], [bt, 0.48], [xt, 0.6], [ht, 0.7], [dt, 0.79], [ft, 0.86], [gt, 0.915], [Mt, 0.95], [kt, 0.98], [$t, 1]];
var M = ut(Ht, it);
var Pt = st(M);
function ke(t, e) {
  return "data:image/svg+xml," + Pt(t, e).replace(/"/g, "'").replace(/[%#<>{}|\\^[\]`]/g, (a) => "%" + a.charCodeAt(0).toString(16).toUpperCase()).replace(/\s+/g, " ");
}

// model.js
var MAX_NAME_CHARS = 64;
var MAX_AVATAR_CHARS = 8 * 1024 * 1024;
var NICKNAME_PATTERN = /^(?![\s\S]*\p{Cc})(?=[\s\S]*\S)[\s\S]+$/u;
var LOCAL_AVATAR_PATTERN = /^(?:|data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2})$/;
var DEFAULTS = Object.freeze({
  frames: true,
  maskIdentity: false,
  nickname: "\u4E34\u65F6\u8BBF\u5BA2",
  avatar: ""
});
function resolvePreferences(input) {
  const value = { ...DEFAULTS, ...input };
  for (const field of ["frames", "maskIdentity"]) {
    if (typeof value[field] !== "boolean") throw new TypeError(field);
  }
  if (typeof value.nickname !== "string") throw new TypeError("nickname");
  const nickname = value.nickname.trim();
  if (!NICKNAME_PATTERN.test(value.nickname) || value.nickname.length > MAX_NAME_CHARS) {
    throw new TypeError("nickname");
  }
  if (typeof value.avatar !== "string" || value.avatar.length > MAX_AVATAR_CHARS || !LOCAL_AVATAR_PATTERN.test(value.avatar)) throw new TypeError("avatar");
  return { ...value, nickname, avatar: value.avatar || ke(nickname, { background: "circle" }) };
}

// settings-card.jsx
function SettingsCard({ view, preferencesForm: form, presentation, t }) {
  const snapshot = (0, import_react.useSyncExternalStore)((fn) => form.subscribe(fn), () => form.getSnapshot());
  const status = (0, import_react.useSyncExternalStore)((fn) => presentation.subscribe(fn), () => presentation.status());
  const [draft, setDraft] = (0, import_react.useState)(null);
  const [saving, setSaving] = (0, import_react.useState)(false);
  const [error, setError] = (0, import_react.useState)("");
  const revision = (0, import_react.useRef)();
  const pendingFile = (0, import_react.useRef)(0);
  (0, import_react.useEffect)(() => () => {
    ++pendingFile.current;
  }, []);
  if (view === "summary") return t("description");
  const ready = snapshot.status === "ready";
  const writable = ready && snapshot.writable && !saving;
  const values = draft ?? snapshot.value ?? DEFAULTS;
  let resolved;
  try {
    resolved = resolvePreferences(values);
  } catch {
  }
  function edit(field, value) {
    if (draft === null) revision.current = snapshot.revision;
    setDraft((previous) => ({ ...previous ?? snapshot.value ?? DEFAULTS, [field]: value }));
    setError("");
  }
  async function save() {
    if (!writable || !resolved || draft === null) return;
    setSaving(true);
    setError("");
    try {
      const accepted = await form.mutate(Object.entries(draft).map(([field, value]) => ({ op: "set", path: [field], value })), revision.current);
      if (accepted) setDraft(null);
      else setError(t("saveFailed"));
    } catch {
      setError(t("saveFailed"));
    } finally {
      setSaving(false);
    }
  }
  async function chooseAvatar(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const request = ++pendingFile.current;
    try {
      if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > MAX_AVATAR_CHARS * 3 / 4) throw new Error("avatar");
      const data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      resolvePreferences({ ...values, avatar: data });
      const image = new Image();
      image.src = data;
      await image.decode();
      if (request === pendingFile.current) edit("avatar", data);
    } catch {
      if (request === pendingFile.current) setError(t("avatarFailed"));
    }
  }
  return /* @__PURE__ */ import_react.default.createElement("section", { className: "pdsh-settings", "data-pdsh-settings": true }, /* @__PURE__ */ import_react.default.createElement("p", { className: "pdsh-hint" }, t("description")), !ready && /* @__PURE__ */ import_react.default.createElement("p", { role: "status" }, t("loading")), ready && !snapshot.writable && /* @__PURE__ */ import_react.default.createElement("p", { role: "status" }, t("readOnly")), /* @__PURE__ */ import_react.default.createElement("p", { className: "pdsh-row" }, /* @__PURE__ */ import_react.default.createElement("span", null, t("frames")), /* @__PURE__ */ import_react.default.createElement(import_dsh_client_ui_primitives.Switch, { checked: values.frames, onChange: (value) => edit("frames", value), label: t("frames"), disabled: !writable })), /* @__PURE__ */ import_react.default.createElement("p", { className: "pdsh-row" }, /* @__PURE__ */ import_react.default.createElement("span", null, t("maskIdentity")), /* @__PURE__ */ import_react.default.createElement(import_dsh_client_ui_primitives.Switch, { checked: values.maskIdentity, onChange: (value) => edit("maskIdentity", value), label: t("maskIdentity"), disabled: !writable })), /* @__PURE__ */ import_react.default.createElement("p", null, /* @__PURE__ */ import_react.default.createElement("label", { htmlFor: "pdsh-nickname" }, t("nickname"))), /* @__PURE__ */ import_react.default.createElement(import_dsh_client_ui_primitives.Input, { id: "pdsh-nickname", value: values.nickname, maxLength: MAX_NAME_CHARS, onChange: (event) => edit("nickname", event.target.value), disabled: !writable }), /* @__PURE__ */ import_react.default.createElement("p", { className: "pdsh-hint" }, t("avatarHint")), resolved && /* @__PURE__ */ import_react.default.createElement("img", { className: "pdsh-avatar-preview", src: resolved.avatar, alt: t("preview") }), /* @__PURE__ */ import_react.default.createElement("p", null, /* @__PURE__ */ import_react.default.createElement("label", { htmlFor: "pdsh-avatar-file" }, t("avatar")), " ", /* @__PURE__ */ import_react.default.createElement("input", { id: "pdsh-avatar-file", type: "file", accept: "image/png,image/jpeg,image/webp", onChange: chooseAvatar, disabled: !writable })), /* @__PURE__ */ import_react.default.createElement(import_dsh_client_ui_primitives.Button, { onClick: () => {
    ++pendingFile.current;
    edit("avatar", "");
  }, disabled: !writable }, t("generated")), /* @__PURE__ */ import_react.default.createElement("p", { role: "status", className: "pdsh-hint" }, t(`status.${status}`)), error && /* @__PURE__ */ import_react.default.createElement("p", { role: "alert" }, error), draft !== null && !resolved && /* @__PURE__ */ import_react.default.createElement("p", { role: "alert" }, t("invalid")), /* @__PURE__ */ import_react.default.createElement("p", { className: "pdsh-row" }, /* @__PURE__ */ import_react.default.createElement(import_dsh_client_ui_primitives.Button, { variant: "primary", onClick: save, disabled: !writable || draft === null || !resolved }, t(saving ? "saving" : "save")), /* @__PURE__ */ import_react.default.createElement(import_dsh_client_ui_primitives.Button, { onClick: () => {
    ++pendingFile.current;
    setDraft(null);
    setError("");
  }, disabled: saving || draft === null }, t("discard"))));
}

// styles.css
var styles_default = '/*\n * [INPUT]: Harness ui-theme \u7684\u8BED\u4E49\u8272/\u5706\u89D2\u53D8\u91CF\uFF0C\u53CA\u539F\u751F Input \u63A2\u9488\u89E3\u6790\u7684\u8FB9\u7EBF\u5BBD\u5EA6\u3002\n * [OUTPUT]: \u63D0\u4F9B\u6D88\u606F\u7070\u6846\u4E0E\u8EAB\u4EFD\u8986\u76D6\u6837\u5F0F\uFF0C\u4E0D\u63D0\u4F9B\u72EC\u7ACB\u989C\u8272\u6216\u5C3A\u5BF8\u8C03\u8272\u677F\u3002\n * [POS]: PDSH \u7684\u5C55\u793A\u5C42\uFF1B\u6765\u6E90\u548C\u4F7F\u7528\u5904\u8BB0\u5F55\u4E8E style-sources.json\uFF0C\u5378\u8F7D\u65F6\u6574\u4F53\u79FB\u9664\u3002\n * [PROTOCOL]: \u53D8\u66F4\u65F6\u66F4\u65B0\u6B64\u5934\u90E8\uFF0C\u7136\u540E\u68C0\u67E5 CLAUDE.md\n */\nbody[data-pdsh-frames] [data-slot="conversation.view"] :is([data-chat-flow-kind="user"], [data-chat-flow-kind="steering"], [data-chat-flow-kind="assistant-step"]):not([hidden]) {\n  outline: var(--pdsh-outline-width) solid var(--dsw-alias-border-l4);\n  border-radius: var(--dsw-radius-sm);\n}\n[data-pdsh-original-label] { display: none !important; }\n[data-pdsh-avatar] { position: relative; }\n[data-pdsh-avatar] > :not([data-pdsh-avatar-image]) { visibility: hidden; }\n[data-pdsh-avatar-image] {\n  position: absolute; inset: 0;\n  display: block; width: 100%; height: 100%;\n  border-radius: inherit; object-fit: cover; corner-shape: inherit;\n}\n.pdsh-settings { color: var(--dsw-alias-label-primary); }\n.pdsh-hint { color: var(--dsw-alias-label-secondary); }\n.pdsh-row { display: flex; align-items: center; justify-content: space-between; }\n.pdsh-avatar-preview { border-radius: var(--dsw-radius-sm); width: var(--pdsh-control-size); height: var(--pdsh-control-size); }\n';

// client-entry.jsx
var inject = ["slots", "locale", "configForms"];
var NS = "pdsh";
var dictionaries = {
  zh: {
    title: "PDSH \u663E\u793A\u8BBE\u7F6E",
    description: "\u7ED9\u6BCF\u6761\u7528\u6237/\u52A9\u624B\u6D88\u606F\u52A0\u7070\u6846\uFF0C\u5E76\u53EF\u66FF\u6362\u4FA7\u680F\u6635\u79F0\u548C\u5934\u50CF\u3002\u4EC5\u6539\u53D8\u672C\u5730\u663E\u793A\uFF1A\u4E0D\u9694\u79BB\u3001\u4E0D\u5220\u9664\u5386\u53F2\uFF0C\u4E5F\u4E0D\u4FEE\u6539\u771F\u5B9E\u8D26\u6237\u3002",
    frames: "\u5BF9\u8BDD\u7070\u6846",
    maskIdentity: "\u66FF\u6362\u4FA7\u680F\u663E\u793A\u8EAB\u4EFD",
    nickname: "\u663E\u793A\u6635\u79F0",
    avatar: "\u9009\u62E9\u672C\u5730\u5934\u50CF",
    avatarHint: "\u9ED8\u8BA4\u6309\u6635\u79F0\u79BB\u7EBF\u751F\u6210\u5934\u50CF\u3002\u4E5F\u53EF\u9009 PNG / JPEG / WebP\uFF1B\u4E0D\u4F1A\u4E0A\u4F20\u56FE\u7247\u6216\u8BF7\u6C42\u5934\u50CF\u670D\u52A1\u3002",
    generated: "\u6062\u590D\u751F\u6210\u5934\u50CF",
    preview: "\u663E\u793A\u5934\u50CF\u9884\u89C8",
    save: "\u4FDD\u5B58",
    saving: "\u4FDD\u5B58\u4E2D\u2026",
    discard: "\u653E\u5F03\u4FEE\u6539",
    loading: "\u6B63\u5728\u8BFB\u53D6\u63D2\u4EF6\u8BBE\u7F6E\u2026",
    readOnly: "\u5F53\u524D\u8BBE\u7F6E\u53EA\u8BFB\u3002",
    saveFailed: "\u4FDD\u5B58\u5931\u8D25\u6216\u8BBE\u7F6E\u5DF2\u88AB\u5176\u4ED6\u7F16\u8F91\u66F4\u65B0\uFF1B\u8349\u7A3F\u4FDD\u7559\uFF0C\u8BF7\u91CD\u65B0\u8BFB\u53D6\u540E\u91CD\u8BD5\u3002",
    avatarFailed: "\u5934\u50CF\u683C\u5F0F\u3001\u5185\u5BB9\u6216\u5927\u5C0F\u4E0D\u5408\u6CD5\uFF0C\u8BF7\u9009\u62E9\u8F83\u5C0F\u7684 PNG / JPEG / WebP \u56FE\u7247\u3002",
    invalid: "\u6635\u79F0\u4E0D\u80FD\u7A7A\u767D\u3001\u8FC7\u957F\u6216\u5305\u542B\u63A7\u5236\u5B57\u7B26\uFF1B\u5934\u50CF\u5FC5\u987B\u662F\u672C\u5730\u5149\u6805\u56FE\u7247\u3002",
    "status.disabled": "\u663E\u793A\u8EAB\u4EFD\u66FF\u6362\u672A\u542F\u7528\u3002",
    "status.masked": "\u5F53\u524D\u4FA7\u680F\u8EAB\u4EFD\u5DF2\u66FF\u6362\u663E\u793A\u3002",
    "status.signed-out": "\u5F53\u524D\u672A\u767B\u5F55\uFF0C\u4FDD\u7559\u539F\u751F\u201C\u66F4\u591A\u201D\u5165\u53E3\uFF1B\u767B\u5F55\u540E\u624D\u66FF\u6362\u663E\u793A\u8EAB\u4EFD\u3002",
    "status.unsupported": "\u672A\u8BC6\u522B\u552F\u4E00\u7684\u539F\u751F\u4FA7\u680F\u8EAB\u4EFD\uFF0C\u672C\u6B21\u4E0D\u66FF\u6362\u3002"
  },
  en: {
    title: "PDSH display settings",
    description: "Outline user/assistant messages and optionally replace the sidebar nickname and avatar. Local display only: no isolation, history deletion or account changes.",
    frames: "Message outlines",
    maskIdentity: "Replace sidebar display identity",
    nickname: "Display nickname",
    avatar: "Choose a local avatar",
    avatarHint: "An offline avatar is generated from the nickname. Or choose PNG / JPEG / WebP. No uploads or avatar-service requests.",
    generated: "Use generated avatar",
    preview: "Display avatar preview",
    save: "Save",
    saving: "Saving\u2026",
    discard: "Discard changes",
    loading: "Loading plugin settings\u2026",
    readOnly: "Settings are read-only.",
    saveFailed: "Save failed or another editor changed the revision. Draft retained; reload before retrying.",
    avatarFailed: "Invalid or oversized avatar. Choose a smaller PNG / JPEG / WebP image.",
    invalid: "Nickname must be non-empty, bounded and control-free. Avatar must be a local raster image.",
    "status.disabled": "Display identity replacement is disabled.",
    "status.masked": "Sidebar identity display is replaced.",
    "status.signed-out": "Signed out: the native More control stays unchanged. Identity replacement applies after sign-in.",
    "status.unsupported": "No unique native sidebar identity recognized; replacement skipped."
  }
};
function NativeStyleProbe({ doc }) {
  const ref = (0, import_react2.useRef)(null);
  (0, import_react2.useLayoutEffect)(() => {
    const nativeInput = ref.current?.querySelector("input");
    if (!nativeInput) return;
    const style = doc.defaultView.getComputedStyle(nativeInput.parentElement);
    if (Number.parseFloat(style.borderTopWidth) > 0) {
      doc.body.style.setProperty("--pdsh-outline-width", style.borderTopWidth);
      doc.body.style.setProperty("--pdsh-control-size", style.height);
    }
  }, [doc]);
  return /* @__PURE__ */ import_react2.default.createElement("span", { ref }, /* @__PURE__ */ import_react2.default.createElement(import_dsh_client_ui_primitives2.Input, { tabIndex: -1, "aria-hidden": "true" }));
}
function mountDisplay(ctx, form) {
  const doc = document;
  const style = doc.createElement("style");
  style.dataset.plugin = "@daftai/pdsh";
  style.textContent = styles_default;
  doc.head.append(style);
  const probe = doc.createElement("div");
  probe.hidden = true;
  probe.setAttribute("data-pdsh-probe", "");
  doc.body.append(probe);
  const root = (0, import_client.createRoot)(probe);
  const properties = ["--pdsh-outline-width", "--pdsh-control-size"];
  const previous = properties.map((key) => [key, doc.body.style.getPropertyValue(key)]);
  root.render(/* @__PURE__ */ import_react2.default.createElement(NativeStyleProbe, { doc }));
  const presentation = mountPresentation(doc);
  function synchronize() {
    const snapshot = form.getSnapshot();
    try {
      presentation.update(resolvePreferences(snapshot.status === "ready" ? snapshot.value : { frames: false, maskIdentity: false }));
    } catch {
      presentation.update(resolvePreferences({ frames: false, maskIdentity: false }));
      ctx.logger.warn("PDSH display configuration rejected; presentation disabled.");
    }
  }
  synchronize();
  const unsubscribe = form.subscribe(synchronize);
  return {
    presentation,
    dispose() {
      unsubscribe();
      presentation.dispose();
      root.unmount();
      probe.remove();
      style.remove();
      for (const [key, value] of previous) {
        if (value) doc.body.style.setProperty(key, value);
        else doc.body.style.removeProperty(key);
      }
      if (!doc.body.getAttribute("style")) doc.body.removeAttribute("style");
    }
  };
}
function apply(ctx) {
  ctx.effect(() => ctx.locale.register(NS, dictionaries), "pdsh: dictionaries");
  const form = ctx.configForms.get("pdsh");
  ctx.effect(() => ctx.configForms.whileServed(["pdsh"], () => {
    const display = mountDisplay(ctx, form);
    let unregister;
    try {
      unregister = ctx.slots.inject("plugins.bundle.config", () => ctx.slots.register({
        name: "plugins.bundle.config",
        key: "@daftai/pdsh",
        locale: NS,
        inject: () => ({ preferencesForm: form, presentation: display.presentation })
      }, SettingsCard));
    } catch (error) {
      display.dispose();
      throw error;
    }
    return () => {
      try {
        unregister();
      } finally {
        display.dispose();
      }
    };
  }), "pdsh: served display and settings");
}
return module.exports;}});
//# sourceMappingURL=client.js.map
