/**
 * [INPUT]: 依赖 src/client/client-entry.tsx 与宿主 module table，由 build.ts 生成。
 * [OUTPUT]: 提供 @daftai/pdsh-identity 的 lazy factory。
 * [POS]: identity 独立 Client 入口，不手工修改。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
window.__ModuleLoader__.load({id:"@daftai/pdsh-identity",factory:(require)=>{var module={exports:{}};var exports=module.exports;
var ke=Object.defineProperty;var Rt=Object.getOwnPropertyDescriptor;var Ht=Object.getOwnPropertyNames;var $t=Object.prototype.hasOwnProperty;var Nt=(e,t)=>{for(var r in t)ke(e,r,{get:t[r],enumerable:!0})},It=(e,t,r,a)=>{if(t&&typeof t=="object"||typeof t=="function")for(let o of Ht(t))!$t.call(e,o)&&o!==r&&ke(e,o,{get:()=>t[o],enumerable:!(a=Rt(t,o))||a.enumerable});return e};var Wt=e=>It(ke({},"__esModule",{value:!0}),e);var ha={};Nt(ha,{apply:()=>pa,inject:()=>xt});module.exports=Wt(ha);var St=require("react"),Et=require("react-dom/client");var le="@daftai/pdsh",Se={identity:{id:"pdsh",module:"@daftai/pdsh-identity",locale:"pdsh.identity"},titles:{id:"pdsh-titles",module:"@daftai/pdsh-titles",locale:"pdsh.titles"},capture:{id:"pdsh-capture",module:"@daftai/pdsh-capture",locale:"pdsh.capture"}};var ze={zh:{identityDescription:"\u81EA\u5B9A\u4E49\u4FA7\u680F\u663E\u793A\u7684\u5934\u50CF\u4E0E\u6635\u79F0\uFF0C\u4E0D\u4FEE\u6539\u8D26\u53F7\u8D44\u6599\u3002",saveLocation:"\u4FDD\u5B58\u4F4D\u7F6E",chooseDirectory:"\u9009\u62E9\u76EE\u5F55",saveAsk:"\u6BCF\u6B21\u9009\u62E9",saveDirect:"\u9ED8\u8BA4\u76EE\u5F55",saveDirectory:"\u4FDD\u5B58\u76EE\u5F55",directoryUnavailable:"\u76EE\u5F55\u5C1A\u672A\u5C31\u7EEA",editFileName:"\u7F16\u8F91\u6587\u4EF6\u540D\u6A21\u677F",doneFileName:"\u4FDD\u5B58\u6587\u4EF6\u540D\u6A21\u677F",templateTokens:"{date} \u65E5\u671F \xB7 {time} \u65F6\u95F4 \xB7 {title} \u9875\u9762\u6807\u9898 \xB7 {width} \u5BBD \xB7 {height} \u9AD8",saveFormat:"\u4FDD\u5B58\u683C\u5F0F",fileNamePattern:"\u6587\u4EF6\u540D\u6A21\u677F",exportSaveFailed:"\u8BBE\u7F6E\u672A\u4FDD\u5B58\uFF0C\u8BF7\u68C0\u67E5\u6A21\u677F\u6216\u91CD\u8BD5\u3002",entry:"\u906E\u6321\u4FA7\u680F\u6807\u9898",entryOn:"\u663E\u793A\u4FA7\u680F\u6807\u9898",toggleFailed:"\u672A\u80FD\u4FDD\u5B58\u5207\u6362\uFF0C\u8BF7\u91CD\u8BD5",capture:"\u622A\u53D6\u5F53\u524D\u7A97\u53E3",languageHint:"\u754C\u9762\u8BED\u8A00\u8DDF\u968F Harness\u3002\u53EF\u5728\u201C\u8BBE\u7F6E \u2192 \u901A\u7528\u8BBE\u7F6E \u2192 \u8BED\u8A00\u201D\u5207\u6362\u4E2D\u6587 / English\u3002",titlesHint:"\u5DE5\u4F5C\u533A\u4E0E\u4F1A\u8BDD\u540D\u79F0",identityPreview:"\u663E\u793A\u8EAB\u4EFD\u6458\u8981",editNickname:"\u7F16\u8F91\u663E\u793A\u6635\u79F0",doneEditing:"\u4FDD\u5B58\u6635\u79F0",avatarLabel:"\u5934\u50CF\u6765\u6E90",accountAvatar:"\u8D26\u53F7\u5934\u50CF",accountAvatarHint:"\u4FDD\u7559\u8D26\u53F7\u539F\u59CB\u5934\u50CF\uFF0C\u5305\u62EC\u5BBF\u4E3B\u9ED8\u8BA4\u5934\u50CF\uFF1B\u663E\u793A\u6635\u79F0\u4ECD\u53EF\u72EC\u7ACB\u4FEE\u6539\u3002\u539F\u59CB\u5934\u50CF\u53EF\u80FD\u66B4\u9732\u4F60\u7684\u8EAB\u4EFD\u3002",nicknameSaveFailed:"\u6635\u79F0\u672A\u80FD\u4FDD\u5B58\uFF0C\u70B9\u51FB\u52FE\u91CD\u8BD5\u3002",nicknameConflict:"\u6635\u79F0\u5DF2\u5728\u522B\u5904\u66F4\u65B0\uFF0C\u6309 Esc \u64A4\u56DE\u540E\u91CD\u65B0\u7F16\u8F91\u3002",avatarSaveFailed:"\u5934\u50CF\u672A\u80FD\u4FDD\u5B58\uFF0C\u539F\u5934\u50CF\u4FDD\u6301\u4E0D\u53D8\u3002",avatarConflict:"\u5934\u50CF\u5DF2\u5728\u522B\u5904\u66F4\u65B0\uFF0C\u8BF7\u91CD\u65B0\u9009\u62E9\u3002",retryAvatar:"\u91CD\u8BD5",title:"DSH \u79C1\u5BC6\u6A21\u5F0F\u8BBE\u7F6E",description:"\u906E\u6321\u4FA7\u680F\u6807\u9898\u3001\u81EA\u5B9A\u4E49\u672C\u5730\u8EAB\u4EFD\uFF1BmacOS \u53EF\u622A\u53D6\u5E76\u7F16\u8F91\u5F53\u524D\u7A97\u53E3\u3002",maskTitles:"\u906E\u6321\u4FA7\u680F\u6807\u9898",maskIdentity:"\u66FF\u6362\u4FA7\u680F\u8EAB\u4EFD",nickname:"\u663E\u793A\u6635\u79F0",avatar:"\u9009\u62E9\u56FE\u7247",avatarHint:"\u9ED8\u8BA4\u6309\u6635\u79F0\u79BB\u7EBF\u751F\u6210\u5934\u50CF\u3002\u4E5F\u53EF\u9009 PNG / JPEG / WebP\uFF1B\u4E0D\u4F1A\u4E0A\u4F20\u56FE\u7247\u6216\u8BF7\u6C42\u5934\u50CF\u670D\u52A1\u3002",generated:"\u6309\u6635\u79F0\u751F\u6210",preview:"\u663E\u793A\u5934\u50CF\u9884\u89C8",loading:"\u6B63\u5728\u8BFB\u53D6\u63D2\u4EF6\u8BBE\u7F6E\u2026",unavailable:"\u5F53\u524D\u8FDE\u63A5\u65E0\u6CD5\u7F16\u8F91\u63D2\u4EF6\u8BBE\u7F6E\u3002",readOnly:"\u5F53\u524D\u8BBE\u7F6E\u53EA\u8BFB\u3002",avatarLoading:"\u6B63\u5728\u8BFB\u53D6\u5934\u50CF\u2026",avatarFailed:"\u5934\u50CF\u683C\u5F0F\u3001\u5185\u5BB9\u6216\u5927\u5C0F\u4E0D\u5408\u6CD5\uFF0C\u8BF7\u9009\u62E9\u8F83\u5C0F\u7684 PNG / JPEG / WebP \u56FE\u7247\u3002",invalidNickname:"\u6635\u79F0\u4E0D\u80FD\u4E3A\u7A7A\u3001\u8FC7\u957F\u6216\u542B\u63A7\u5236\u5B57\u7B26\u3002","status.signed-out":"\u5F53\u524D\u672A\u767B\u5F55\uFF0C\u4FDD\u7559\u539F\u751F\u201C\u66F4\u591A\u201D\u5165\u53E3\uFF1B\u767B\u5F55\u540E\u624D\u66FF\u6362\u663E\u793A\u8EAB\u4EFD\u3002","status.unsupported":"\u672A\u8BC6\u522B\u552F\u4E00\u7684\u539F\u751F\u4FA7\u680F\u8EAB\u4EFD\uFF0C\u672C\u6B21\u4E0D\u66FF\u6362\u3002",updateTitle:"\u63D2\u4EF6\u66F4\u65B0",installSourceHint:"\u5C06\u4ECE GitHub \u56FA\u5B9A\u63D0\u4EA4\u5B89\u88C5\uFF0C\u53EF\u80FD\u5207\u6362\u5F53\u524D\u6765\u6E90\uFF1B\u4E0D\u4F1A\u81EA\u52A8\u91CD\u542F\u3002",installUpdate:"\u5B89\u88C5\u7248\u672C","update.cancel":"\u53D6\u6D88","update.retry":"\u91CD\u65B0\u68C0\u67E5","update.available":"\u6709\u65B0\u7248\u672C\u53EF\u5B89\u88C5","update.installing":"\u6B63\u5728\u901A\u8FC7\u5BBF\u4E3B\u5B89\u88C5\u2026","update.installed":"\u5BBF\u4E3B\u5DF2\u5E94\u7528\u7248\u672C","update.restart":"\u5B89\u88C5\u5B8C\u6210\uFF1B\u8BF7\u5728\u5408\u9002\u65F6\u673A\u91CD\u542F Harness\uFF0C\u542F\u7528\u7248\u672C","update.installFailed":"\u5B89\u88C5\u7ED3\u679C\u672A\u786E\u8BA4\uFF1B\u8BF7\u5728\u5B98\u65B9\u63D2\u4EF6\u9875\u6838\u5BF9\u72B6\u6001\u540E\u91CD\u8BD5\u3002"},en:{identityDescription:"Customize the sidebar avatar and nickname without changing account data.",saveLocation:"Save location",chooseDirectory:"Choose folder",saveAsk:"Choose each time",saveDirect:"Default folder",saveDirectory:"Save folder",directoryUnavailable:"Folder is not ready",editFileName:"Edit file name template",doneFileName:"Save file name template",templateTokens:"{date} Date \xB7 {time} Time \xB7 {title} Page title \xB7 {width} Width \xB7 {height} Height",saveFormat:"Save format",fileNamePattern:"File name template",exportSaveFailed:"Settings were not saved. Check the template or try again.",entry:"Mask sidebar titles",entryOn:"Show sidebar titles",toggleFailed:"Toggle was not saved. Try again",capture:"Capture current window",languageHint:"Language follows Harness. Switch in Settings \u2192 General \u2192 Language: \u4E2D\u6587 / English.",titlesHint:"Workspace and session names",identityPreview:"Display identity summary",editNickname:"Edit display nickname",doneEditing:"Save nickname",avatarLabel:"Avatar source",accountAvatar:"Account avatar",accountAvatarHint:"Keep the native account picture, including its default icon. Display nickname remains independent. Your original picture may identify you.",nicknameSaveFailed:"Nickname was not saved. Click the check to retry.",nicknameConflict:"Nickname changed elsewhere. Press Esc, then edit again.",avatarSaveFailed:"Avatar was not saved. Your previous avatar is unchanged.",avatarConflict:"Avatar changed elsewhere. Choose again.",retryAvatar:"Retry",title:"DSH Private Mode settings",description:"Mask sidebar titles and customize local identity; capture and edit this window on macOS.",maskTitles:"Mask sidebar titles",maskIdentity:"Replace sidebar identity",nickname:"Display nickname",avatar:"Choose image",avatarHint:"An offline avatar is generated from the nickname. Or choose PNG / JPEG / WebP. No uploads or avatar-service requests.",generated:"Generate",preview:"Display avatar preview",loading:"Loading plugin settings\u2026",unavailable:"Plugin settings cannot be edited in this connection.",readOnly:"Settings are read-only.",avatarLoading:"Reading avatar\u2026",avatarFailed:"Invalid or oversized avatar. Choose a smaller PNG / JPEG / WebP image.",invalidNickname:"Nickname must be non-empty, within the length limit and control-free.","status.signed-out":"Signed out: the native More control stays unchanged. Identity replacement applies after sign-in.","status.unsupported":"No unique native sidebar identity recognized; replacement skipped.",updateTitle:"Plugin updates",installSourceHint:"Install a pinned GitHub commit. This may change your current source. No automatic restart.",installUpdate:"Install version","update.cancel":"Cancel","update.retry":"Check again","update.available":"A newer version is available","update.installing":"Installing through the host\u2026","update.installed":"The host applied version","update.restart":"Installed; restart Harness when convenient to activate version","update.installFailed":"Installation was not confirmed. Verify the official Plugins page before retrying."}};function Ee({l:e,c:t,h:r}){let a=r*Math.PI/180,o=t*Math.cos(a),n=t*Math.sin(a),i=e+.3963377774*o+.2158037573*n,l=e-.1055613458*o-.0638541728*n,d=e-.0894841775*o-1.291485548*n,b=i*i*i,u=l*l*l,p=d*d*d;return[4.0767416621*b-3.3077115913*u+.2309699292*p,-1.2684380046*b+2.6097574011*u-.3413193965*p,-.0041960863*b-.7034186147*u+1.707614701*p]}var Oe=e=>e.every(t=>t>=-1e-4&&t<=1.0001);function qe(e){let t=Ee(e);if(!Oe(t)){let r=0,a=e.c;for(let o=0;o<12;o++){let n=(r+a)/2;Oe(Ee({...e,c:n}))?r=n:a=n}t=Ee({...e,c:r})}return t.map(r=>Math.min(1,Math.max(0,r)))}function Be(e){let[t,r,a]=qe(e);return .2126*t+.7152*r+.0722*a}function ce(e,t){let r=Be(e),a=Be(t);return(Math.max(r,a)+.05)/(Math.min(r,a)+.05)}function Ve(e,t,r){if(ce(e,t)>=r)return e;let a=e.l>=t.l?1:-1;for(let i of[a,-a]){let l={...e};for(let d=0;d<60;d++){if(l.l=Math.min(1,Math.max(0,l.l+i*.02)),ce(l,t)>=r)return l;if(l.l===0||l.l===1)break}}let o={...e,l:0,c:0},n={...e,l:1,c:0};return ce(o,t)>=ce(n,t)?o:n}function _t(e){return"#"+qe(e).map(t=>{let r=t<=.0031308?12.92*t:1.055*Math.pow(t,.4166666666666667)-.055;return Math.round(r*255).toString(16).padStart(2,"0")}).join("")}var Ue=[[.2,{l:.86,c:.085}],[.36,{l:.9,c:.028}],[.62,{l:.73,c:.135}],[.8,{l:.62,c:.165}],[.93,{l:.87,c:.16}],[1,{l:.34,c:.035}]],Dt=e=>Ue.find(([t])=>e<t)?.[1]??Ue[0][1],zt={l:.145,c:0,h:0},Ot=1.5,Bt=(e,t)=>{let r=Dt(t),a=Ve({l:r.l,c:r.c,h:e},zt,Ot);return{bg:{l:.965,c:.01,h:e},head:a,eye:a.l>=.5?{l:.17,c:.02,h:e}:{l:.97,c:.012,h:e}}},Ut=[["head","bg",1.25],["eye","head",4.5]];function Ft(e,t=!0,r=0){let a=Bt(e,r);if(t)for(let[o,n,i]of Ut)a[o]=Ve(a[o],a[n],i);return a}function qt(e,t=!0,r=0){let a=Ft(e,t,r),o={};for(let n in a)o[n]=_t(a[n]);return o}var A=e=>{let t=Math.round(e*100)/100;return Object.is(t,-0)?"0":String(t)};function xe({cx:e,cy:t,rx:r,ry:a,n:o=4,rot:n=0}){let i=Math.min(1,(8*Math.pow(2,-1/o)-4)/3),l=r,d=a,b=l*i,u=d*i,p=[[l,0],[l,u],[b,d],[0,d],[-b,d],[-l,u],[-l,0],[-l,-u],[-b,-d],[0,-d],[b,-d],[l,-u],[l,0]],w=n*Math.PI/180,v=Math.cos(w),y=Math.sin(w),k=c=>{let[s,m]=p[c];return`${A(e+s*v-m*y)} ${A(t+s*y+m*v)}`},E=`M${k(0)}`;for(let c=1;c<13;c+=3)E+=`C${k(c)} ${k(c+1)} ${k(c+2)}`;return E+"Z"}function Vt(e,t,r,a,o,n=0){let i=o.length,l=n*Math.PI/180,d=o.map((p,w)=>{let v=l+2*Math.PI*w/i;return[e+r*p*Math.cos(v),t+a*p*Math.sin(v)]}),b=p=>d[(p%i+i)%i],u=`M${A(b(0)[0])} ${A(b(0)[1])}`;for(let p=0;p<i;p++){let[w,v]=b(p-1),[y,k]=b(p),[E,c]=b(p+1),[s,m]=b(p+2);u+=`C${A(y+(E-w)/6)} ${A(k+(c-v)/6)} ${A(E-(s-y)/6)} ${A(c-(m-k)/6)} ${A(E)} ${A(c)}`}return u+"Z"}function jt({cx:e,cy:t,rx:r,ry:a,sides:o,round:n=.3,rot:i=0}){let l=n>0?n<1?n/2:.5:0,d=i*Math.PI/180-Math.PI/2,b=Array.from({length:o},(v,y)=>{let k=d+2*Math.PI*y/o;return[e+r*Math.cos(k),t+a*Math.sin(k)]}),u=v=>b[(v%o+o)%o],p=(v,y)=>{let[k,E]=u(v),[c,s]=u(y);return`${A(k+(c-k)*l)} ${A(E+(s-E)*l)}`},w=`M${p(0,-1)}`;for(let v=0;v<o;v++){let[y,k]=u(v);w+=`Q${A(y)} ${A(k)} ${p(v,v+1)}`,l<.5&&(w+=`L${p(v+1,v)}`)}return w+"Z"}function Gt(e,t,r,a){let o=A(e-r),n=A(e+r);return`M${o} ${A(t-a)}H${n}V${A(t+a)}H${o}Z`}function Xt(e,t,r,a,o){let n=Math.max(1.05,o),i=r*Math.sqrt(1-1/(n*n)),l=t-a/n,d=t-n*a,b=i*.14,u=l+.86*(d-l);return`M${A(e-i)} ${A(l)}L${A(e-b)} ${A(u)}Q${A(e)} ${A(d)} ${A(e+b)} ${A(u)}L${A(e+i)} ${A(l)}Z`}function Pe(e,t){for(let r=0;r<t.length;r++)e=Math.imul(e^t[r],3432918353),e=e<<13|e>>>19;return e}function Yt(e){return e=Math.imul(e^e>>>16,2246822507),e=Math.imul(e^e>>>13,3266489909),(e^e>>>16)>>>0}var je=new TextEncoder;function Kt(e){return e.normalize("NFC").trim().toLowerCase()}function Zt(e,t=!0){let r=t?Kt(e):e;return Pe(1779033703^r.length,je.encode(r))}function Fe(e,t){return Yt(Pe(Pe(e,Uint8Array.of(255)),je.encode(t)))/4294967296}function Jt(e,t=!0,r){let a=Zt(e,t),o=n=>{let i=r?.[n],l=Array.isArray(i)?i[Math.floor(Fe(a,n)*i.length)]:i;return l===void 0?Fe(a,n):l>0?l<1?l:.999999:0};return o.num=(n,i,l)=>i+o(n)*(l-i),o.int=(n,i,l)=>i+Math.floor(o(n)*(l-i+1)),o.pick=(n,i)=>i[Math.floor(o(n)*i.length)],o.bool=(n,i=.5)=>o(n)<i,o.jitter=(n,i)=>(o(n)*2-1)*i,o}function Qt(e,t,r){let a=t.expression;return r||!a?{l:e,wrap:""}:a.bake(e,a.p)}var er=(e,t)=>t?.tint?t.tint(e,t.p):e,tr=(e,t)=>t?`<g transform="${t}">${e}</g>`:e,rr=e=>e.replace(/[&<>]/g,t=>t==="&"?"&amp;":t==="<"?"&lt;":"&gt;");function ar(e,t){let r=Jt(e,t.normalize??!0,t.traits);return{t:r,palette:{...qt(t.hue??r.num("hue",0,360),t.contrast??!0,t.tone??r("tone")),...t.palette}}}var nr=e=>e.title?`<title>${rr(e.title)}</title>`:"";function or(e,t,r){let a=t.background??e.background;if(a!==!1)return{d:a==="square"?"M0 0H100V100H0Z":xe({cx:50,cy:50,rx:50,ry:50,n:a==="circle"?2:6}),fill:r.bg}}var ir=e=>e?`<path d="${e.d}" fill="${e.fill}"/>`:"";function sr(e){return(t,r={})=>{let{t:a,palette:o}=ar(t,r),n=er(o,r.expression),i=r.size?` width="${r.size}" height="${r.size}"`:"",l=Qt(e.layout(a),r),d=nr(r)+ir(or(e,r,n))+tr(e.render(l.l,n),l.wrap);return`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"${i}>${d}</svg>`}}var lr=(e,t,r)=>{let a=t.rx,o=e.num("eye.rx",.075,.105)*a,n=e.num("eye.ratio",1.9,3.2),i=e.num("eye.scale",.78,1.24),l=e.num("eye.stretch",.85,1.18),d=e.num("eye.gap",.1,.24)*a,b=o*Math.max(1,i),u=o*n*Math.max(1,i*l),p=b+a*.03+d,w=e.jitter("gaze.x",.09)*r.rx,v=e.num("gaze.y",-.2,.08)*r.ry,y=e.jitter("eye.dy",.04)*r.ry,k=Math.hypot(b,u),E=Math.hypot((Math.abs(w)+p+k)/r.rx,(Math.abs(v)+Math.abs(y)+k)/r.ry),c=E>.9?.9/E:1,s=o*c,m=s*n,h=p*c,P=Math.max(0,Math.min(1,d/u)),L=Math.min(12,Math.asin(P)*180/Math.PI),_=e.num("eye.lean",-1,1)*L,x=Math.max(-12,Math.min(12,_+e.jitter("eye.lean2",3.5))),H=r.cx+w*c,g=r.cy+v*c;return[{cx:H-h,cy:g,rx:s,ry:m,n:e.num("eye.n",3.5,6),rot:_},{cx:H+h,cy:g+y*c,rx:s*i,ry:m*i*l,n:e.num("eye.n",3.5,6),rot:x}]};function cr(e,t){let r=n=>(e.find(([,i])=>n<i)??e[e.length-1])[0];function a(n){let i=r(n("shape")),l=n.num("body.r",31,38)*i.core,d={cx:50+n.jitter("body.x",1.5),cy:50+n.jitter("body.y",1.5),rx:l,ry:l*n.num("body.ratio",.92,1.08),n:n.num("body.n",1.9,2.5),rot:0,radii:Array.from({length:n.int("body.pts",6,8)},(p,w)=>1+n.jitter(`body.r${w}`,.16))};i.body?.(n,d);let b=i.face?.(d)??d,u={petals:[],extra:[]};return i.decorate?.(n,d,u),{shape:i.name,draw:i.path,body:d,face:b,petals:u.petals,extra:u.extra,eyes:t(n,d,b)}}function o(n,i,l){let d=p=>Math.round(p*100)/100,b=(p,w)=>{let v=`<path d="${xe(p)}"/>`;return l?`<g class="mo-eye" style="--mo-wrap:${w?1:-1};--mo-lean:${d(p.rot)};transform-origin:${d(p.cx)}px ${d(p.cy)}px">${v}</g>`:v},u=`<g fill="${i.head}">`+n.petals.map(p=>`<circle cx="${d(p.cx)}" cy="${d(p.cy)}" r="${d(p.r)}"/>`).join("")+n.extra.map(p=>`<path d="${p}"/>`).join("")+`<path d="${n.draw?n.draw(n.body):xe(n.body)}"/></g><g fill="${i.eye}"${l?' class="mo-eyes"':""}>`+n.eyes.map(b).join("")+"</g>";return l?`<g class="mo-breathe"><g class="mo-bob">${u}</g></g>`:u}return{layout:a,render:o,background:!1}}var Ge=e=>jt(e),Xe=e=>Vt(e.cx,e.cy,e.rx,e.ry,e.radii,e.rot),Me=e=>t=>({cx:t.cx,cy:t.cy,rx:t.rx*e,ry:t.ry*e}),Ye=e=>Me(Math.min(...e.radii)*.95)(e),dr=e=>Me(.84)(e),ur={name:"round",core:1},pr={name:"organic",core:.98,path:Xe,face:Ye},hr={name:"boxy",core:.86,body:(e,t)=>{t.n=e.num("body.n",3.4,6),t.rot=e.num("body.rot",-20,20)}},mr={name:"capsule",core:1.02,body:(e,t)=>{t.ry*=e.num("capsule.squat",.55,.68)},face:Me(.94),decorate:(e,t,r)=>{for(let a of[-1,1])r.petals.push({cx:t.cx+a*(t.rx-t.ry),cy:t.cy,r:t.ry})},path:e=>Gt(e.cx,e.cy,e.rx-e.ry,e.ry)},gr={name:"nub",core:.88,decorate:(e,t,r)=>{let a=e.int("nub.n",1,2);for(let o=0;o<a;o++){let n=e.num(`nub.a${o}`,0,2*Math.PI);r.petals.push({cx:t.cx+Math.cos(n)*t.rx*.88,cy:t.cy+Math.sin(n)*t.rx*.88,r:t.rx*e.num(`nub.r${o}`,.24,.4)})}}},fr={name:"cloud",core:.78,face:Ye,path:Xe,decorate:(e,t,r)=>{let a=e.int("cloud.n",4,6);for(let o=0;o<a;o++){let n=Math.PI+Math.PI*(o+.5)/a;r.petals.push({cx:t.cx+Math.cos(n)*t.rx*.8,cy:t.cy+Math.sin(n)*t.rx*.5,r:t.rx*e.num(`cloud.r${o}`,.44,.62)})}}},vr={name:"droplet",core:.78,body:(e,t)=>{t.cy+=.22*t.ry,t.n=2},face:e=>({cx:e.cx,cy:e.cy+e.ry*.05,rx:e.rx*.88,ry:e.ry*.88}),decorate:(e,t,r)=>{r.extra.push(Xt(t.cx,t.cy,t.rx,t.ry,e.num("droplet.tip",1.4,1.65)))}},br={name:"hexagon",core:1.05,path:Ge,face:dr,body:(e,t)=>{t.sides=6,t.rot=e.num("body.rot",-12,12),t.round=e.num("poly.round",.24,.5)}},yr={name:"sun",core:.7,decorate:(e,t,r)=>{let a=e.int("sun.n",6,9),o=t.rx*e.num("sun.dist",1,1.08),n=t.rx*e.num("sun.r",.2,.26),i=e.num("sun.rot",0,2*Math.PI);for(let l=0;l<a;l++){let d=i+2*Math.PI*l/a;r.petals.push({cx:t.cx+Math.cos(d)*o,cy:t.cy+Math.sin(d)*o,r:n})}}},wr={name:"triangle",core:1.15,path:Ge,body:(e,t)=>{t.sides=3,t.rot=e.num("body.rot",-5,5),t.round=e.num("poly.round",.24,.5)},face:e=>({cx:e.cx,cy:e.cy+e.ry*.1,rx:e.rx*.54,ry:e.ry*.36})},Cr=[[ur,.22],[pr,.48],[hr,.6],[mr,.7],[gr,.79],[fr,.86],[vr,.915],[br,.95],[yr,.98],[wr,1]],kr=cr(Cr,lr),Sr=sr(kr);function Ke(e,t){return"data:image/svg+xml,"+Sr(e,t).replace(/"/g,"'").replace(/[%#<>{}|\\^[\]`]/g,r=>"%"+r.charCodeAt(0).toString(16).toUpperCase()).replace(/\s+/g," ")}var de=64,Te=8*1024*1024,Ae=/^(?![\s\S]*\p{Cc})(?=[\s\S]*\S)[\s\S]+$/u,Er=/^(?:|data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2})$/,B=Object.freeze({maskTitles:!1,maskIdentity:!1,useAccountAvatar:!1,nickname:"\u4E34\u65F6\u8BBF\u5BA2",avatar:""});function J(e){let t=e&&typeof e=="object"?Object.entries(e):[],r={...B,...Object.fromEntries(t.filter(([o])=>Object.hasOwn(B,o)))};for(let o of["maskTitles","maskIdentity","useAccountAvatar"])if(typeof r[o]!="boolean")throw new TypeError(o);if(typeof r.nickname!="string")throw new TypeError("nickname");let a=r.nickname.trim();if(!Ae.test(r.nickname)||r.nickname.length>de)throw new TypeError("nickname");if(typeof r.avatar!="string"||r.avatar.length>Te||!Er.test(r.avatar))throw new TypeError("avatar");return{maskTitles:r.maskTitles,maskIdentity:r.maskIdentity,useAccountAvatar:r.useAccountAvatar,nickname:a,avatar:r.avatar||Ke(a,{background:"circle"})}}var ue=require("react"),z=require("@deepseek-ai/dsh-client-ui-primitives");function Ze(e){let t=e.getAttribute("viewBox")?.trim().split(/[\s,]+/).map(Number);return t?.length===4&&t.every(Number.isFinite)&&t[2]>0&&t[3]>0?t:null}function Re(e,t){let r=Ze(e),a=Number.parseFloat(t.width),o=Number.parseFloat(t.height),n=t.strokeWidth?.trim()??"";if(!r||!/^(?:\d*\.)?\d+(?:px)?$/.test(n))return null;let i=Number.parseFloat(n);return!(a>0&&o>0&&i>0)||a*r[3]!==o*r[2]||t.vectorEffect&&t.vectorEffect!=="none"?null:i/r[2]}function Je(e,t,r){let a=Re(e,r),o=Ze(t);return a===null||!o||Number.parseFloat(r.width)*o[3]!==Number.parseFloat(r.height)*o[2]?null:String(a*o[2])}function Qe(e,t){let r=e.defaultView,a=new Map,o=e.body.hasAttribute("style"),n=!1,i=!1,l=new Set;function d(s){for(let m of l)s.has(m)||E?.unobserve(m);for(let m of s)l.has(m)||E?.observe(m);l=s}function b(s,m){a.has(s)||a.set(s,{value:e.body.style.getPropertyValue(s),priority:e.body.style.getPropertyPriority(s)}),m===null?e.body.style.getPropertyValue(s)&&e.body.style.removeProperty(s):e.body.style.getPropertyValue(s)!==m&&e.body.style.setProperty(s,m)}let u=(s,m=!1)=>{let h=Number.parseFloat(s);return Number.isFinite(h)&&(m?h>=0:h>0)?s:null},p=s=>s.trim()||null,w=s=>s.trim()&&Number(s)>=0&&Number(s)<=1?s:null;function v(){if(n)return;if(!t.isConnected){d(new Set);for(let g of a.keys())b(g,null);return}let s=new Set([t]),m=new Set;function h(g,S){m.add(g),b(g,S)}let P=t.querySelector("input");if(P?.parentElement){s.add(P.parentElement);let g=r.getComputedStyle(P.parentElement);h("--pdsh-outline-width",u(g.borderTopWidth,!0)),h("--pdsh-control-size",u(g.height))}let L=t.querySelector("[data-pdsh-button-probe]");if(L){s.add(L);let g=r.getComputedStyle(L);h("--pdsh-action-size",u(g.height)),h("--pdsh-button-inset",u(g.paddingInlineStart,!0)),h("--pdsh-button-gap",u(g.gap,!0)),h("--pdsh-action-radius",p(g.borderRadius)),h("--pdsh-action-corner-shape",p(g.getPropertyValue("corner-shape"))),h("--pdsh-action-disabled-opacity",w(g.opacity)),h("--pdsh-action-transition",p(g.transition));let S=L.querySelector("svg");if(S){s.add(S);let M=r.getComputedStyle(S),D=Re(S,M);h("--pdsh-native-icon-stroke-ratio",D===null?null:String(D)),h("--pdsh-native-icon-opacity",w(M.opacity)),h("--pdsh-native-icon-size",u(M.width))}}let _=t.querySelector('[role="switch"]');if(_?.firstElementChild){s.add(_),s.add(_.firstElementChild);let g=r.getComputedStyle(_),S=r.getComputedStyle(_.firstElementChild);h("--pdsh-switch-width",u(g.width)),h("--pdsh-switch-height",u(g.height)),h("--pdsh-switch-radius",p(g.borderRadius)),h("--pdsh-switch-thumb-size",u(S.width)),h("--pdsh-switch-thumb-transition",p(S.transition)),h("--pdsh-switch-thumb-shadow",p(S.boxShadow)),h("--pdsh-switch-thumb-radius",p(S.borderRadius))}let x=t.querySelector("[data-pdsh-field-probe]")?.firstElementChild;if(x?.firstElementChild){s.add(x),s.add(x.firstElementChild);let g=r.getComputedStyle(x),S=r.getComputedStyle(x.firstElementChild);h("--pdsh-section-inset",u(g.paddingTop,!0)),h("--pdsh-field-gap",u(g.gap,!0)),h("--pdsh-action-gap",u(S.gap,!0))}let H=t.querySelector('[role="tooltip"]');if(H){s.add(H),H.hasAttribute("data-portal")||H.setAttribute("data-portal","");let g=r.getComputedStyle(H);h("--pdsh-tooltip-padding",p(g.padding)),h("--pdsh-tooltip-duration",p(g.animationDuration)),h("--pdsh-tooltip-ease",p(g.animationTimingFunction)),h("--pdsh-tooltip-max-width",p(g.maxWidth)),h("--pdsh-tooltip-layer",p(g.zIndex))}d(s);for(let g of a.keys())m.has(g)||b(g,null)}function y(){i||n||(i=!0,r.queueMicrotask(()=>{i=!1,v()}))}let k=new r.MutationObserver(y),E=r.ResizeObserver?new r.ResizeObserver(y):null,c=["(prefers-color-scheme: dark)","(prefers-reduced-motion: reduce)"].map(s=>r.matchMedia?.(s)).filter(Boolean);k.observe(e.documentElement,{subtree:!0,childList:!0,characterData:!0,attributes:!0,attributeFilter:["class","style","data-theme","data-dsw-theme","href","disabled","viewBox","stroke-width","vector-effect","width","height"]}),r.addEventListener("resize",y),e.addEventListener("load",y,!0);for(let s of c)s.addEventListener("change",y);return v(),{dispose(){if(!n){n=!0,k.disconnect(),E?.disconnect(),l.clear(),r.removeEventListener("resize",y),e.removeEventListener("load",y,!0);for(let s of c)s.removeEventListener("change",y);for(let[s,m]of a)m.value?e.body.style.setProperty(s,m.value,m.priority):e.body.style.removeProperty(s);!o&&!e.body.getAttribute("style")&&e.body.removeAttribute("style"),a.clear()}}}}var O=require("react/jsx-runtime");function et({doc:e}){let t=(0,ue.useRef)(null);return(0,ue.useLayoutEffect)(()=>{if(!t.current)return;let r=Qe(e,t.current);return t.current.querySelector("[data-pdsh-tooltip-probe]")?.dispatchEvent(new e.defaultView.MouseEvent("mouseover",{bubbles:!0,relatedTarget:null})),()=>r.dispose()},[e]),(0,O.jsxs)("span",{ref:t,children:[(0,O.jsx)(z.Input,{tabIndex:-1,"aria-hidden":"true"}),(0,O.jsx)(z.Button,{"data-pdsh-button-probe":!0,disabled:!0,tabIndex:-1,"aria-hidden":"true",children:(0,O.jsx)(z.IconCheckOutlineRegular,{})}),(0,O.jsx)(z.Switch,{checked:!1,onChange:()=>{},label:"",disabled:!0}),(0,O.jsx)("span",{"data-pdsh-field-probe":!0,children:(0,O.jsx)(z.SettingsValueField,{id:"pdsh-layout-probe",label:"",text:"",overridden:!1,invalid:!1,overriddenLabel:"",resetLabel:"",invalidLabel:"",disabled:!0,onEdit:()=>{},onReset:()=>{}})}),(0,O.jsx)(z.Tooltip,{label:" ",side:"bottom",delayMs:0,focusDelayMs:0,portal:!1,children:(0,O.jsx)("span",{"data-pdsh-tooltip-probe":!0,tabIndex:-1})})]})}var xr='[data-slot="settings.launcher"] button[aria-haspopup="menu"][data-collapsed][data-signed-out]',Pr="[data-pdsh-name], [data-pdsh-avatar-image]",tt=["data-pdsh-original-label","data-pdsh-avatar"];function rt(e){let t=[...e.querySelectorAll(xr)];if(t.length!==1)return{status:"unsupported"};let r=t[0];if(r.dataset.signedOut==="true")return{status:"signed-out"};if(r.dataset.signedOut!=="false"||!["true","false"].includes(r.dataset.collapsed))return{status:"unsupported"};let a=r.dataset.collapsed==="false",o=[...r.children].filter(l=>!l.matches(Pr)),n=o[0],i=a?o[1]:null;return o.length!==(a?2:1)||n?.tagName!=="SPAN"||!n.querySelector(":scope > img:not([data-pdsh-avatar-image]), :scope > svg")||a&&i?.tagName!=="SPAN"?{status:"unsupported"}:{status:"recognized",trigger:r,wide:a,avatar:n,label:i}}function at(e){let t,r="disabled",a="",o=!1,n=new Set,i=new Set,l=new Set;function d(v,y=""){if(!(r===v&&a===y)){r=v,a=y;for(let k of l)k()}}function b(){for(let v of n)v.remove();n.clear();for(let v of i)for(let y of tt)v.removeAttribute(y);i.clear()}function u(){if(o||!t)return;let v=rt(e),y=v.status==="recognized"?v.avatar.querySelector(":scope > img:not([data-pdsh-avatar-image])")?.getAttribute("src")??"":"";if(!t.maskIdentity){b(),d("disabled",y);return}if(v.status!=="recognized"){b(),d(v.status);return}let{trigger:k,wide:E,avatar:c,label:s}=v;for(let P of[...n])k.contains(P)||(P.remove(),n.delete(P));for(let P of[...i])if(!k.contains(P)){for(let L of tt)P.removeAttribute(L);i.delete(P)}let m=c.querySelector(":scope > [data-pdsh-avatar-image]");t.useAccountAvatar?(m&&(m.remove(),n.delete(m)),c.removeAttribute("data-pdsh-avatar"),i.delete(c)):(c.setAttribute("data-pdsh-avatar",""),i.add(c),m||(m=e.createElement("img"),m.setAttribute("data-pdsh-avatar-image",""),m.alt="",m.referrerPolicy="no-referrer",c.append(m),n.add(m)),m.getAttribute("src")!==t.avatar&&m.setAttribute("src",t.avatar));let h=k.querySelector(":scope > [data-pdsh-name]");E?(s.setAttribute("data-pdsh-original-label",""),i.add(s),h||(h=e.createElement("span"),h.setAttribute("data-pdsh-name",""),k.append(h),n.add(h)),h.className!==s.className&&(h.className=s.className),h.textContent!==t.nickname&&(h.textContent=t.nickname)):h&&(h.remove(),n.delete(h)),d("masked",y)}let p=new e.defaultView.MutationObserver(()=>{p.disconnect(),u(),w()});function w(){o||p.observe(e.body,{subtree:!0,childList:!0,characterData:!0,attributes:!0,attributeFilter:["data-collapsed","data-signed-out","class","src"]})}return w(),{update(v){p.disconnect(),t=v,u(),w()},refresh(){p.disconnect(),u(),w()},status:()=>r,accountAvatar:()=>a,subscribe(v){return l.add(v),()=>l.delete(v)},dispose(){o=!0,p.disconnect(),b(),l.clear()}}}var Mr="data-pdsh-redacted-title";var Ra=`[${Mr}] {
  -webkit-mask-image: none !important;
  mask-image: none !important;
}`;var Tr='button[aria-label="\u641C\u7D22\u4F1A\u8BDD"], button[aria-label="Search sessions"]';function Ar(e,t){let r=[];function a(o){for(let n of o)if(n.selectorText&&n.style)r.push(n);else if(n.cssRules){if(n.constructor.name==="CSSMediaRule"&&!e.defaultView.matchMedia?.(n.conditionText).matches||n.constructor.name==="CSSSupportsRule"&&!e.defaultView.CSS?.supports(n.conditionText))continue;a(n.cssRules)}}for(let o of[...e.styleSheets,...e.adoptedStyleSheets??[]])try{a(o.cssRules)}catch{}for(let o=t;o;o=o.parentElement){let n="";for(let i of r)try{o.matches(i.selectorText)&&i.style.color&&(n=i.style.color)}catch{}if(n=o.style.color||n,!(!n||n==="inherit"||n==="currentcolor"))return/var\(--[\w-]+/.test(n)?n:null}return null}function Lr(e){let t=e.querySelectorAll('[data-slot="sidebar.workspaces"]');if(t.length!==1)return null;let r=t[0].querySelectorAll(Tr);if(r.length!==1)return null;let a=r[0],o=a.parentElement,n=t[0].firstElementChild;if(!n||!o||a.type!=="button"||!a.className||!a.querySelector("svg"))return null;let i=a.hasAttribute("aria-expanded");if(i){let l=o.parentElement,d=l?.parentElement;return d?.parentElement!==n||d!==n.firstElementChild||!o.querySelector('input[type="text"]')||!["true","false"].includes(a.getAttribute("aria-expanded"))?null:{button:a,search:o,parent:d,anchor:l,wide:i}}return o.parentElement!==n||o===n.firstElementChild||!o.className||o.querySelector("input")?null:{button:a,search:o,parent:n,anchor:o,wide:i}}function U(e,t,r){e.getAttribute(t)!==r&&e.setAttribute(t,r)}function nt(e,{icon:t=null,label:r=()=>"",state:a=()=>({pressed:!1,busy:!1,disabled:!1}),onActivate:o=()=>{},capture:n=null}={}){let i=null,l=!1,d=null,b="",u=null;function p(c,s,m,h,P,L=!1){let _=e.createElement("template");_.innerHTML=c;let x=_.content.querySelector("svg");if(!x)throw new Error("PDSH trusted entry icon missing");x.removeAttribute("width"),x.removeAttribute("height"),x.setAttribute("aria-hidden","true"),x.setAttribute("focusable","false");let H=e.createElement("button");H.type="button",H.append(x),H.setAttribute("data-pdsh-capture-hide","");let g=()=>{H.isConnected&&!H.hidden&&!H.disabled&&!l&&P()};return H.addEventListener("click",g),{button:H,svg:x,marker:s,readState:m,readLabel:h,pressed:L,click:g,wasBusy:!1,pendingFocus:!1}}let w=[...t?[p(t,"data-pdsh-search-entry",a,r,o,!0)]:[],...n?[p(n.icon,"data-pdsh-capture-entry",n.state,n.label,n.onActivate)]:[]];w[0]?.button.setAttribute("data-pdsh-entry-first","");function v(){for(let c of w)c.pendingFocus=!1,c.button.remove();i?.remove(),i=null}function y(){if(l||!w.length)return;let c=Lr(e);if(!c){v();return}let s=c.button.querySelector("svg"),m=e.defaultView.getComputedStyle(s);if(!(Number.parseFloat(m.width)>0&&Number.parseFloat(m.height)>0)){v();return}let h=w.map(g=>Je(s,g.svg,m));if(h.some(g=>!g)){v();return}let P=[];for(let g=c.button;g;g=g.parentElement)P.push(`${g.getAttribute("class")??""}|${g.style.color}`);let L=[e.documentElement,e.body].map(g=>`${g.className}|${g.getAttribute("data-theme")}|${g.getAttribute("data-dsw-theme")}|${g.style.cssText}`).join(";"),_=`${e.styleSheets.length}:${L}:${P.join(";")}`;(d!==c.button||b!==_)&&(d=c.button,b=_,u=Ar(e,c.button));let x=Number.parseFloat(m.opacity),H=c.wide&&c.button.getAttribute("aria-expanded")==="true";for(let[g,S]of w.entries()){let{button:M,svg:D}=S,F=S.readState();U(D,"stroke-width",h[g]),Number.isFinite(x)&&x>=0&&x<=1?D.style.getPropertyValue("--pdsh-icon-opacity")!==String(x)&&D.style.setProperty("--pdsh-icon-opacity",String(x)):D.style.removeProperty("--pdsh-icon-opacity"),U(D,"width",m.width),U(D,"height",m.height),U(M,"class",c.button.className),U(M,S.marker,c.wide?"wide":"rail"),U(M,"aria-label",S.readLabel()),U(M,"data-pdsh-tooltip",S.readLabel()),S.pressed&&U(M,"aria-pressed",String(F.pressed)),U(M,"aria-busy",String(F.busy)),M.disabled=F.disabled,F.busy&&!S.wasBusy&&(S.pendingFocus=e.activeElement===M),M.hidden!==H&&(M.hidden=H),u&&M.style.getPropertyValue("--pdsh-search-color")!==u?M.style.setProperty("--pdsh-search-color",u):u||M.style.removeProperty("--pdsh-search-color"),S.wasBusy&&!F.busy&&(S.pendingFocus&&!M.disabled&&!M.hidden&&M.isConnected&&(e.activeElement===e.body||e.activeElement===M)&&M.focus(),S.pendingFocus=!1),S.wasBusy=F.busy}if(c.wide){if(i){for(let{button:S}of w)S.remove();i.remove(),i=null}let g=c.anchor;for(let{button:S}of[...w].reverse())(S.parentElement!==c.parent||S.nextElementSibling!==g)&&c.parent.insertBefore(S,g),g=S}else{i||(i=e.createElement("div"),i.setAttribute("data-pdsh-entry-shell","")),U(i,"class",c.search.className);let g=null;for(let{button:S}of w)(S.parentElement!==i||S.previousElementSibling!==g)&&i.insertBefore(S,g?g.nextElementSibling:i.firstElementChild),g=S;(i.parentElement!==c.parent||i.nextElementSibling!==c.anchor)&&c.parent.insertBefore(i,c.anchor)}}let k=new e.defaultView.MutationObserver(c=>{c.some(s=>e.head.contains(s.target))&&(b=""),y()});w.length&&k.observe(e.documentElement,{subtree:!0,childList:!0,attributes:!0,attributeFilter:["class","data-theme","data-dsw-theme","aria-label","aria-expanded","style","width","height","viewBox","stroke-width","vector-effect"]});let E=()=>{b="",y()};return e.defaultView.addEventListener("resize",E),y(),{refresh:y,dispose(){if(!l){l=!0,k.disconnect(),e.defaultView.removeEventListener("resize",E);for(let{button:c,click:s}of w)c.removeEventListener("click",s);v()}}}}var Rr="[data-pdsh-tooltip]";function ot(e){let t=null,r=null,a=null,o=!1,n=!1;function i(c){if(!(c instanceof e.defaultView.HTMLElement))return null;let s=c.closest(Rr);return s&&(s.matches("[data-pdsh-search-entry], [data-pdsh-capture-entry]")||s.closest("[data-pdsh-capture]"))?s:null}function l(){a!==null&&clearTimeout(a),a=null,r?.remove(),r=null,t=null}function d(c){if(n||!c.isConnected||c.matches(":disabled")||!c.getAttribute("data-pdsh-tooltip"))return;r?.remove(),r=e.createElement("span"),r.className="pdsh-native-tooltip",r.setAttribute("role","tooltip"),r.textContent=c.getAttribute("data-pdsh-tooltip"),e.body.append(r);let s=c.getBoundingClientRect(),h=r.getBoundingClientRect().width/2,P=Math.max(12+h,Math.min(s.left+s.width/2,e.defaultView.innerWidth-12-h)),L=s.bottom+8+r.getBoundingClientRect().height>e.defaultView.innerHeight-12;r.dataset.side=L?"top":"bottom",r.style.left=`${P}px`,r.style.top=`${L?s.top-8:s.bottom+8}px`}function b(c,s){t!==c&&(l(),t=c,s===0?d(c):a=setTimeout(()=>{a=null,t===c&&d(c)},s))}function u(c){let s=i(c.target);s&&b(s,500)}function p(c){t&&c.target instanceof e.defaultView.Node&&t.contains(c.target)&&!(c.relatedTarget instanceof e.defaultView.Node&&t.contains(c.relatedTarget))&&l()}function w(c){let s=i(c.target);s&&!o&&b(s,0)}function v(c){t&&c.target instanceof e.defaultView.Node&&t.contains(c.target)&&l()}function y(){o=!0,l()}function k(c){o=!1,(c.key==="Escape"||c.key==="Tab")&&l()}function E(){l()}return e.addEventListener("mouseover",u),e.addEventListener("mouseout",p),e.addEventListener("focusin",w),e.addEventListener("focusout",v),e.addEventListener("pointerdown",y,!0),e.addEventListener("keydown",k,!0),e.addEventListener("click",E,!0),e.defaultView.addEventListener("scroll",E,!0),e.defaultView.addEventListener("resize",E),()=>{n||(n=!0,l(),e.removeEventListener("mouseover",u),e.removeEventListener("mouseout",p),e.removeEventListener("focusin",w),e.removeEventListener("focusout",v),e.removeEventListener("pointerdown",y,!0),e.removeEventListener("keydown",k,!0),e.removeEventListener("click",E,!0),e.defaultView.removeEventListener("scroll",E,!0),e.defaultView.removeEventListener("resize",E))}}var He=[{colors:["#d7eee8","#71b6ae","#2f6870"],id:"sea",section:"wallpapers"},{colors:["#f4cfaa","#c67b5c","#65443e"],id:"canyon",section:"wallpapers"},{colors:["#eef2f1","#aab9b6","#74817e"],id:"mist",section:"wallpapers"},{colors:["#d8d7b6","#779175","#3f5c59"],id:"highland",section:"wallpapers"},{colors:["#b8e8e8","#4d9bb1","#24526f"],id:"ocean",section:"wallpapers"},{colors:["#ff8db8","#d64ac7","#6540c8"],direction:"bottom-right",id:"rose",section:"gradients"},{colors:["#243f96","#784fd2","#ef85c0"],direction:"bottom-right",id:"ultraviolet",section:"gradients"},{colors:["#08275f","#087fc4","#26d7df"],direction:"bottom-right",id:"lagoon",section:"gradients"},{colors:["#54bda9","#b9e6c3","#fff0c2"],direction:"bottom-right",id:"mint",section:"gradients"},{colors:["#ffca72","#f56f73","#bd3c7d"],direction:"bottom-right",id:"sunset",section:"gradients"},{colors:["#35c6dc","#a276e8","#cb45dd"],direction:"top-right",id:"silver",section:"gradients"},{colors:["#c8d0d5","#f2c7cf","#b8c6c3"],direction:"bottom",id:"azure",section:"gradients"},{colors:["#8ebdb8","#e9c4a4","#c98574"],direction:"bottom-right",id:"indigo",section:"gradients"},{colors:["#7256d8","#a77ce8","#5cc8e2"],direction:"top-right",id:"ember",section:"gradients"},{colors:["#29113f","#43145d","#120a26"],direction:"bottom-right",id:"graphite",section:"gradients"},{colors:["#17436b","#4e83a5","#dfa85d"],direction:"bottom",id:"prism",section:"gradients"},{colors:["#5e91cc","#a68bc2","#e9a3ad"],direction:"bottom-right",id:"blossom",section:"gradients"},{colors:["#5537c2","#d176d6","#47b9d0"],direction:"top-right",id:"coral",section:"gradients"},{colors:["#5b1223","#a82439","#d5464a"],direction:"right",id:"aurora",section:"gradients"},{colors:["#244b9b","#501a54","#b51e36"],direction:"bottom-right",id:"dusk",section:"gradients"},{colors:["#b9a1ee","#957cbd","#e6a1c0"],direction:"bottom-right",id:"horizon",section:"gradients"},{colors:["#ff7c25","#e73a43","#ffe08b"],direction:"bottom-right",id:"twilight",section:"gradients"},{colors:["#6c39bb","#f05f7a","#ffbc55"],direction:"bottom-right",id:"flare",section:"gradients"},{colors:["#f04a2f","#f56d62","#5d1b6e"],direction:"bottom-right",id:"spectrum",section:"gradients"},{colors:["#3156a4","#6a3592","#c74783"],direction:"bottom-right",id:"nocturne",section:"gradients"}];var za=He.filter(e=>e.section==="wallpapers").map(e=>e.id),Oa=[{id:"gradients",presets:He.filter(e=>e.section==="gradients")},{id:"wallpapers",presets:He.filter(e=>e.section==="wallpapers")}];var Za=Object.freeze({light:Object.freeze({blurRadius:30,saturation:2.2,base:"#f6f6f6",tint:"rgb(96.47% 96.47% 96.47%)",tintOpacity:.84,tone:"rgb(91.5% 91.5% 91.5%)",toneBlend:"darken"}),dark:Object.freeze({blurRadius:30,saturation:2.4,base:"#282828",tint:"rgb(15.69% 15.69% 15.69%)",tintOpacity:.8,tone:"rgb(14% 14% 14%)",toneBlend:"lighten"})});var Xr=require("react-dom/client"),it=require("@deepseek-ai/dsh-client-ui-primitives"),Yr=require("react/jsx-runtime");var R=require("react"),W=require("@deepseek-ai/dsh-client-ui-primitives");var C=require("react/jsx-runtime");function pe(e){return{avatar:e?.avatar??B.avatar,useAccountAvatar:e?.useAccountAvatar??B.useAccountAvatar}}function $e(e,t){return!!(e&&t&&e.avatar===t.avatar&&e.useAccountAvatar===t.useAccountAvatar)}function ae({label:e,children:t}){return(0,C.jsx)(W.Tooltip,{label:e,side:"bottom",delayMs:500,focusDelayMs:0,portal:!0,children:t})}function Kr({id:e,label:t,hint:r,checked:a,disabled:o,pending:n,error:i,onChange:l}){let d=(0,R.useRef)(null);return(0,C.jsxs)(C.Fragment,{children:[(0,C.jsxs)("div",{className:"pdsh-row pdsh-group-header",ref:d,"aria-busy":n||void 0,children:[(0,C.jsx)("h4",{id:e,children:t}),r?(0,C.jsx)(ae,{label:r,children:(0,C.jsx)("span",{className:"pdsh-switch-tooltip",children:(0,C.jsx)(W.Switch,{checked:a,onChange:()=>l(d.current?.querySelector('[role="switch"]')),label:t,disabled:o})})}):(0,C.jsx)(W.Switch,{checked:a,onChange:()=>l(d.current?.querySelector('[role="switch"]')),label:t,disabled:o})]}),i&&(0,C.jsx)("p",{className:"pdsh-error",role:"alert",children:i})]})}function st({view:e,preferencesForm:t,presentation:r,t:a,showTitles:o=!0}){let n=(0,R.useSyncExternalStore)(f=>t.subscribe(f),()=>t.getSnapshot()),i=(0,R.useSyncExternalStore)(f=>r.subscribe(f),()=>r.status()),l=(0,R.useSyncExternalStore)(f=>r.subscribe(f),()=>r.accountAvatar()),[d,b]=(0,R.useState)(null),[u,p]=(0,R.useState)(""),[w,v]=(0,R.useState)(""),[y,k]=(0,R.useState)(null),[E,c]=(0,R.useState)(!1),[s,m]=(0,R.useState)(null),[h,P]=(0,R.useState)(""),L=(0,R.useRef)(null),_=(0,R.useRef)(null),x=(0,R.useRef)(null),H=(0,R.useRef)(null),g=(0,R.useRef)(!0),S=(0,R.useRef)(0),M=(0,R.useRef)(null),D=(0,R.useRef)(null);function F(){++S.current;let f=M.current;M.current=null,f?.abort()}function ge(){F(),c(!1)}if((0,R.useEffect)(()=>(g.current=!0,()=>{g.current=!1,F()}),[]),(0,R.useEffect)(()=>{(n.status!=="ready"||!n.writable)&&ge()},[n.status,n.writable]),(0,R.useEffect)(()=>{if(s||!H.current)return;let{origin:f,nickname:$}=H.current;H.current=null;let T=f.ownerDocument;if(T.activeElement===T.body||T.activeElement===f){let N=$?_.current?.querySelector("input, button"):f;N?.isConnected&&!N.disabled&&N.focus()}},[s,d]),e==="summary")return a(o?"description":"identityDescription");let fe=n.status==="ready",q=fe&&n.writable&&s===null,ee=n.value?.nickname??B.nickname,te=d??ee,j=typeof te!="string"||te.length>de||!Ae.test(te),ie=d!==null&&fe&&L.current!==ee,se=pe(n.value),V=se.useAccountAvatar?"account":se.avatar?"local":"generated",re=y&&!$e(y.base,se),ve;try{ve=J({...se,nickname:j?ee:te}).avatar}catch{}function Ne(f,$=!1){H.current=f?.ownerDocument.activeElement===f?{origin:f,nickname:$}:null}async function be(f,$,T,N,G=!1){if(x.current||T.status!=="ready"||!T.writable)return!1;Ne(N,G),x.current=f,m(f);try{return await t.mutate($,T.revision)}catch{return!1}finally{x.current=null,g.current&&m(null)}}function Mt(){let f=t.getSnapshot();x.current||f.status!=="ready"||!f.writable||(L.current=f.value?.nickname??B.nickname,b(L.current),p(""))}function Ie(f){x.current!=="nickname"&&(Ne(f,!0),b(null),p(""),L.current=null)}async function We(f){let $=t.getSnapshot();if(d===null||j||E||x.current||$.status!=="ready"||!$.writable)return;let T=$.value?.nickname??B.nickname;if(L.current!==T){p("nicknameConflict");return}if(d===T){Ie(f);return}p("");let N=await be("nickname",[{op:"set",path:["nickname"],value:d}],$,f,!0);g.current&&(N?(b(null),L.current=null):p("nicknameSaveFailed"))}async function Tt(f,$){let T=t.getSnapshot();if(x.current||E||T.status!=="ready"||!T.writable)return;let N=T.value?.[f]??B[f];if(typeof N!="boolean")return;P("");let G=await be(f,[{op:"set",path:[f],value:!N}],T,$);g.current&&!G&&P(f)}async function ye(f,$,T){let N=t.getSnapshot();if(x.current||N.status!=="ready"||!N.writable)return;if(v(""),k(null),!$e($,pe(N.value))){v("avatarConflict");return}if($e(f,$))return;let G=await be("avatar",["avatar","useAccountAvatar"].map(Z=>({op:"set",path:[Z],value:f[Z]})),N,T);g.current&&!G&&(v("avatarSaveFailed"),k({value:f,base:$}))}function we(f,$){let T=t.getSnapshot();if(x.current||T.status!=="ready"||!T.writable)return;if(ge(),k(null),v(""),f==="local"){D.current?.click();return}let N=pe(T.value);ye(f==="account"?{...N,useAccountAvatar:!0}:{avatar:"",useAccountAvatar:!1},N,$)}async function At(f){let $=f.target.files?.[0];f.target.value="";let T=t.getSnapshot();if(!$||x.current||T.status!=="ready"||!T.writable)return;ge();let N=++S.current,G=pe(T.value);c(!0),k(null),v("");try{if(!["image/png","image/jpeg","image/webp"].includes($.type)||$.size>Te*3/4)throw new Error("avatar");let Z=await new Promise((Lt,Ce)=>{let X=new FileReader;M.current=X,X.onload=()=>typeof X.result=="string"?Lt(X.result):Ce(new Error("avatar")),X.onerror=Ce,X.onabort=Ce,X.readAsDataURL($)});if(!g.current||N!==S.current)return;M.current=null,J({avatar:Z});let De=new Image;De.src=Z,await De.decode(),g.current&&N===S.current&&await ye({avatar:Z,useAccountAvatar:!1},G,null)}catch{g.current&&N===S.current&&v("avatarFailed")}finally{g.current&&N===S.current&&(M.current=null,c(!1))}}function _e(f,$,T=""){return(0,C.jsx)(Kr,{id:$,label:a(f),hint:T?a(T):void 0,checked:n.value?.[f]??B[f],disabled:!q||E,pending:s===f,error:h===f?a("toggleFailed"):"",onChange:N=>Tt(f,N)})}return(0,C.jsxs)("section",{className:"pdsh-settings","data-pdsh-settings":!0,children:[n.status==="loading"&&(0,C.jsx)("p",{role:"status",children:a("loading")}),n.status==="unavailable"&&(0,C.jsx)("p",{role:"status",children:a("unavailable")}),fe&&!n.writable&&(0,C.jsx)("p",{role:"status",children:a("readOnly")}),o&&(0,C.jsx)("section",{className:"pdsh-group",role:"group","aria-labelledby":"pdsh-display-title",children:_e("maskTitles","pdsh-display-title","titlesHint")}),(0,C.jsxs)("section",{className:"pdsh-group pdsh-identity-group",role:"group","aria-labelledby":"pdsh-identity-title",children:[_e("maskIdentity","pdsh-identity-title"),(0,C.jsxs)("div",{className:"pdsh-identity","aria-label":a("identityPreview"),children:[V==="account"&&!l?(0,C.jsx)("span",{className:"pdsh-avatar-preview pdsh-avatar-fallback",role:"img","aria-label":a("accountAvatar"),children:(0,C.jsx)(W.IconUserOutlineMedium,{})}):ve&&(0,C.jsx)("img",{className:"pdsh-avatar-preview",src:V==="account"?l:ve,alt:a(V==="account"?"accountAvatar":"preview"),referrerPolicy:"no-referrer"}),(0,C.jsx)("div",{className:"pdsh-copy pdsh-profile-copy",children:(0,C.jsx)("strong",{className:"pdsh-profile-name",children:te})}),(0,C.jsxs)("div",{className:"pdsh-avatar-actions",role:"group","aria-labelledby":"pdsh-avatar-source-label","aria-describedby":w||re?"pdsh-avatar-error":void 0,"aria-busy":E||s==="avatar"||void 0,children:[(0,C.jsx)("span",{className:"pdsh-avatar-source-label pdsh-label",id:"pdsh-avatar-source-label",children:a("avatarLabel")}),(0,C.jsx)(W.Button,{variant:V==="generated"?"outline":"ghost","aria-pressed":V==="generated",onClick:f=>we("generated",f.currentTarget),disabled:!q,children:a("generated")}),(0,C.jsx)(ae,{label:a("avatarHint"),children:(0,C.jsx)(W.Button,{variant:V==="local"?"outline":"ghost","aria-pressed":V==="local",onClick:f=>we("local",f.currentTarget),disabled:!q,children:a("avatar")})}),(0,C.jsx)(ae,{label:a("accountAvatarHint"),children:(0,C.jsx)(W.Button,{variant:V==="account"?"outline":"ghost","aria-pressed":V==="account",onClick:f=>we("account",f.currentTarget),disabled:!q,children:a("accountAvatar")})})]})]}),(w||re||E)&&(0,C.jsxs)("div",{className:"pdsh-avatar-feedback","data-pdsh-avatar-feedback":!0,children:[E&&(0,C.jsx)("span",{role:"status",className:"pdsh-hint","data-pdsh-avatar-loading":!0,children:a("avatarLoading")}),(w||re)&&(0,C.jsx)("span",{role:"alert",id:"pdsh-avatar-error",className:"pdsh-error",children:a(re?"avatarConflict":w)}),y&&(0,C.jsx)(W.Button,{onClick:f=>ye(y.value,y.base,f.currentTarget),disabled:!q||re,children:a("retryAvatar")})]}),(0,C.jsxs)("div",{className:"pdsh-detail-row",ref:_,children:[(0,C.jsx)("span",{className:"pdsh-label",id:"pdsh-nickname-label",children:a("nickname")}),d!==null?(0,C.jsxs)("div",{className:"pdsh-field pdsh-nickname-editor",children:[(0,C.jsxs)("div",{className:"pdsh-inline-editor",children:[(0,C.jsx)(W.Input,{id:"pdsh-nickname","aria-labelledby":"pdsh-nickname-label","aria-invalid":j,"aria-describedby":j||ie||u?"pdsh-nickname-error":void 0,autoFocus:!0,value:d,maxLength:de,onChange:f=>{b(f.target.value),p("")},onKeyDown:f=>{f.nativeEvent.isComposing||(f.key==="Enter"&&(f.preventDefault(),We(f.currentTarget)),f.key==="Escape"&&(f.preventDefault(),f.stopPropagation(),Ie(f.currentTarget)))},disabled:!q}),(0,C.jsx)(ae,{label:a("doneEditing"),children:(0,C.jsx)(W.Button,{className:"pdsh-nickname-action",variant:"ghost","aria-label":a("doneEditing"),onClick:f=>We(f.currentTarget),disabled:!q||j||ie||E,children:(0,C.jsx)(W.IconCheckOutlineRegular,{})})})]}),(j||ie||u)&&(0,C.jsx)("p",{role:"alert",id:"pdsh-nickname-error",className:"pdsh-error",children:a(j?"invalidNickname":ie?"nicknameConflict":u)})]}):(0,C.jsxs)("div",{className:"pdsh-value-action",children:[(0,C.jsx)("span",{children:ee}),(0,C.jsx)(ae,{label:a("editNickname"),children:(0,C.jsx)(W.Button,{className:"pdsh-nickname-action",variant:"ghost","aria-label":`${a("editNickname")}: ${ee}`,onClick:Mt,disabled:!q,children:(0,C.jsx)(W.IconEditOutlineRegular,{})})})]})]}),(0,C.jsx)("input",{ref:D,id:"pdsh-avatar-file",type:"file",accept:"image/png,image/jpeg,image/webp",onChange:At,disabled:!q,hidden:!0,"aria-label":a("avatar")}),["signed-out","unsupported"].includes(i)&&(0,C.jsx)("p",{role:"status",className:"pdsh-hint",children:a(`status.${i}`)})]})]})}var he=require("react"),ne=require("@deepseek-ai/dsh-client-ui-primitives");var lt=require("react/jsx-runtime");var Zr=require("react"),ct=require("@deepseek-ai/dsh-client-ui-primitives"),dt=require("react/jsx-runtime");var Jr="@daftai/pdsh",Qr="github:daftAI2026/PDSH#";function ut(e){if(!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(e))return null;let t=e.split(".").map(Number);return t.every(Number.isSafeInteger)?t:null}function pt(e,t){for(let r=0;r<3;r++)if(e[r]!==t[r])return e[r]-t[r];return 0}function ea(e,t){let r=ut(t);if(!r||!Array.isArray(e))return null;let a=null;for(let o of e){let n=/^v(.*)$/.exec(o?.name)?.[1],i=n&&ut(n),l=o?.commit?.sha;!i||typeof l!="string"||!/^[a-f0-9]{40}$/i.test(l)||pt(i,r)<=0||(!a||pt(i,a.parts)>0)&&(a={version:n,sha:l.toLowerCase(),parts:i})}return a&&{version:a.version,sha:a.sha}}function ht(e,t,r){let a={phase:"idle"},o=null,n=!1,i=!1,l=new Set;function d(u){if(!n){a=u;for(let p of l)p()}}async function b(){let u=await e.listBundles();if(!u.ok||!Array.isArray(u.value))throw new Error("bundle inventory unavailable");let w=u.value.filter(v=>v.name===Jr&&v.installed);return w.length===1&&w[0].version===r?w[0]:null}return{getSnapshot:()=>a,subscribe(u){return l.add(u),()=>l.delete(u)},async check(){if(!(n||i||a.phase==="restart"||a.phase==="installed")){i=!0,o=null,d({phase:"checking"});try{if(!await b())throw new Error("installed bundle differs from running code");let u=ea(await t(),r);if(n)return;o=u,d(u?{phase:"available",version:u.version}:{phase:"current"})}catch{d({phase:"failed",operation:"check"})}finally{i=!1}}},async install(){if(n||i||a.phase!=="available"||!o)return;i=!0;let u=o;d({phase:"installing",version:u.version});try{if(!await b())throw new Error("installed bundle changed");let p=await e.installBundle(`${Qr}${u.sha}`,{enabled:!0});if(!p.ok||!p.value?.changed||!["restart-required","applied"].includes(p.value.application??""))throw new Error("installation not accepted");o=null,d({phase:p.value.application==="applied"?"installed":"restart",version:u.version})}catch{d({phase:"failed",operation:"install"})}finally{i=!1}},dispose(){n=!0,o=null,l.clear()}}}var ta="https://api.github.com/repos/daftAI2026/PDSH/tags?per_page=100";async function mt(e=fetch){let t=await e(ta,{credentials:"omit",cache:"no-store",headers:{Accept:"application/vnd.github+json"}});if(!t.ok)throw new Error("release tag request failed");let r=await t.json();if(!Array.isArray(r))throw new Error("release tags invalid");return r}var Q=require("react"),Y=require("@deepseek-ai/dsh-client-ui-primitives"),I=require("react/jsx-runtime"),ra="@daftai/pdsh";function gt({subject:e,updater:t,version:r,t:a}){let o=(0,Q.useSyncExternalStore)(u=>t.subscribe(u),()=>t.getSnapshot()),[n,i]=(0,Q.useState)(!1),l=e.kind==="bundle"&&e.pkg.name===ra&&e.pkg.installed&&e.pkg.version===r;(0,Q.useEffect)(()=>{l&&t.check()},[l,t]);let d=["installing","installed","restart"].includes(o.phase),b=n&&o.phase==="failed"&&o.operation==="install";return!l||o.phase!=="available"&&!d&&!b?null:(0,I.jsxs)("span",{className:"pdsh-update-badge","data-pdsh-update-badge":!0,children:[o.phase==="available"&&(0,I.jsx)(Y.Tooltip,{label:`${a("update.available")} v${o.version}`,side:"bottom",delayMs:500,focusDelayMs:0,portal:!0,children:(0,I.jsx)(Y.Button,{variant:"ghost",size:"sm",className:"pdsh-update-trigger","data-pdsh-update-trigger":!0,"aria-label":`${a("update.available")} v${o.version}`,"aria-expanded":n,onClick:()=>i(u=>!u),children:(0,I.jsxs)("svg",{xmlns:"http://www.w3.org/2000/svg",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeLinecap:"round",strokeLinejoin:"round","aria-hidden":"true",children:[(0,I.jsx)("circle",{cx:"12",cy:"12",r:"10"}),(0,I.jsx)("path",{d:"m16 12-4-4-4 4"}),(0,I.jsx)("path",{d:"M12 16V8"})]})})}),(n||d)&&(0,I.jsxs)("span",{className:"pdsh-update-confirm","data-pdsh-update-confirm":!0,role:"group","aria-label":a("updateTitle"),children:[o.phase==="available"&&(0,I.jsxs)(I.Fragment,{children:[(0,I.jsxs)("span",{children:["v",o.version," \xB7 ",a("installSourceHint")]}),(0,I.jsx)(Y.Button,{size:"sm","data-pdsh-update-install":!0,onClick:()=>void t.install(),children:a("installUpdate")}),(0,I.jsx)(Y.Button,{size:"sm",variant:"ghost",onClick:()=>i(!1),children:a("update.cancel")})]}),["installing","installed","restart"].includes(o.phase)&&(0,I.jsxs)("span",{role:"status",children:[a(`update.${o.phase}`)," ",o.version]}),o.phase==="failed"&&(0,I.jsxs)(I.Fragment,{children:[(0,I.jsx)("span",{role:"alert",className:"pdsh-error",children:a("update.installFailed")}),(0,I.jsx)(Y.Button,{size:"sm",variant:"ghost",onClick:()=>void t.check(),children:a("update.retry")})]})]})]})}var ft=`<!--
[INPUT]: \u590D\u7528 InCodex assets/hat-glasses.svg \u7684 Lucide \u7EBF\u6761\u56FE\u5F62\uFF1B\u4E0D\u8BFB\u53D6\u7528\u6237\u8F93\u5165\u3002
[OUTPUT]: \u63D0\u4F9B\u4E94\u6BB5\u51E0\u4F55\u5408\u5E76\u7684\u5355\u4E00\u8DEF\u5F84\u63CF\u8FB9\uFF1B\u900F\u660E\u5E95\uFF0C\u5750\u6807\u548C\u79BB\u7EBF\u56FE\u7A3F\u7EBF\u5BBD\u4FDD\u6301\u539F\u5F62\u3002
[POS]: PDSH \u5355\u4E00\u56FE\u5F62\u6E90\uFF1B\u8FD0\u884C\u65F6\u7EBF\u5BBD\u7531\u539F\u751F\u641C\u7D22\u7684\u5750\u6807/\u663E\u793A\u6BD4\u4F8B\u6362\u7B97\uFF0C\u53EA\u5728 SVG \u6839\u5408\u6210\u900F\u660E\u5EA6\u3002
[PROTOCOL]: \u53D8\u66F4\u65F6\u66F4\u65B0\u6B64\u5934\u90E8\uFF0C\u7136\u540E\u68C0\u67E5 CLAUDE.md
-->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <path d="M14 18a2 2 0 0 0-4 0 M19 11l-2.11-6.657a2 2 0 0 0-2.752-1.148l-1.276.61A2 2 0 0 1 12 4H8.5a2 2 0 0 0-1.925 1.456L5 11 M2 11h20 M20 18a3 3 0 1 1-6 0a3 3 0 1 1 6 0Z M10 18a3 3 0 1 1-6 0a3 3 0 1 1 6 0Z"/>
</svg>
`;var vt=`<!--
[INPUT]: \u4F9D\u8D56 InCodex Shot \u7684 Lucide \u76F8\u673A\u7EBF\u6761\u56FE\u5F62\uFF1B\u5BBF\u4E3B\u5165\u53E3\u63D0\u4F9B\u5B9E\u65F6\u5C3A\u5BF8\u3001\u989C\u8272\u3001viewBox\u63CF\u8FB9\u6362\u7B97\u548C\u6574\u4F53\u900F\u660E\u5EA6\u3002
[OUTPUT]: \u63D0\u4F9B\u5E3D\u5B50\u53F3\u4FA7\u7684\u72EC\u7ACB\u76F8\u673A\u56FE\u6807\uFF0C\u79BB\u7EBF\u9ED8\u8BA4\u63CF\u8FB9\u7531\u8FD0\u884C\u9002\u914D\u5668\u8986\u76D6\uFF0C\u4E0D\u5185\u7F6E\u50CF\u7D20\u5C3A\u5BF8\u6216\u5355\u7B14\u900F\u660E\u5EA6\u3002
[POS]: PDSH \u622A\u56FE\u5165\u53E3\u8D44\u4EA7\uFF1B\u6784\u5EFA\u671F\u5185\u8054\uFF0C\u4E0D\u6539\u53D8\u539F\u751F\u641C\u7D22 SVG\u3002
[PROTOCOL]: \u53D8\u66F4\u65F6\u66F4\u65B0\u6B64\u5934\u90E8\uFF0C\u7136\u540E\u68C0\u67E5 CLAUDE.md
-->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3"/></svg>
`;var bt=`/*
 * [INPUT]: Harness ui-theme \u7684\u8BED\u4E49\u8272/\u5706\u89D2/\u5B57\u53F7\uFF0C\u4EE5\u53CA\u53EF\u5378\u8F7D\u7684\u539F\u751F Input/Button/Switch/SettingsValueField/Tooltip/\u56FE\u6807\u63A2\u9488\u7684\u5B9E\u65F6\u8BA1\u7B97\u53C2\u6570\u3002
 * [OUTPUT]: \u63D0\u4F9B\u6807\u9898\u7070\u6761\u3001\u8EAB\u4EFD\u8986\u76D6\u3001\u53EF\u89C1\u5934\u50CF\u6765\u6E90\u3001\u539F\u751F\u8BBE\u7F6E/\u63D0\u793A\u3001\u6210\u529F\u8272\u66F4\u65B0\u5FBD\u6807\u4E0E\u65E0\u5E38\u9A7B\u5E95\u8272\u7684\u5165\u53E3\u6837\u5F0F\u3002
 * [POS]: PDSH \u7684\u5C55\u793A\u5C42\uFF1B\u6765\u6E90\u548C\u4F7F\u7528\u5904\u8BB0\u5F55\u4E8E style-sources.json\uFF0C\u5378\u8F7D\u65F6\u6574\u4F53\u79FB\u9664\u3002
 * [PROTOCOL]: \u53D8\u66F4\u65F6\u66F4\u65B0\u6B64\u5934\u90E8\uFF0C\u7136\u540E\u68C0\u67E5 CLAUDE.md
 */
/* \u6837\u5F0F\u63A2\u9488\u4FDD\u7559\u771F\u5B9E\u5E03\u5C40\u4EE5\u6D4B\u91CF\uFF0C\u4F46\u4E0D\u7ED8\u5236\u3001\u4E0D\u547D\u4E2D\u3001\u4E0D\u5360\u5BBF\u4E3B\u6587\u6863\u6D41\u3002 */
[data-pdsh-probe] { opacity: 0; position: fixed; inset: 0 auto auto 0; width: max-content; height: max-content; pointer-events: none; }
[data-pdsh-probe], [data-pdsh-probe] * { visibility: hidden !important; }
[data-pdsh-probe] > span { display: block; }
[data-pdsh-redacted-title],
html.pdsh-capture-redact [data-pdsh-capture-redact="text"] {
  position: relative; color: transparent !important; -webkit-text-fill-color: transparent !important;
  text-shadow: none !important; mask-image: none !important;
  /* \u7A33\u5B9A\u5728\u539F\u751F\u53EF\u89C6\u6807\u9898\u6846\u5185\uFF1B\u6587\u5B57\u4ECD\u53EF\u547D\u4E2D\uFF0C\u53CC\u51FB\u4EA4\u7ED9\u5BBF\u4E3B\u3002 */
  overflow: clip !important;
}
[data-pdsh-redacted-title]::after,
html.pdsh-capture-redact [data-pdsh-capture-redact="text"]::after {
  content: ""; pointer-events: none; position: absolute;
  inset-inline: 0; top: 50%; transform: translateY(-50%);
  height: 50%; background: var(--dsw-alias-bg-skeleton); border-radius: var(--dsw-radius-xs);
}
[data-pdsh-original-label] { display: none !important; }
[data-pdsh-avatar] { position: relative; }
[data-pdsh-avatar] > :not([data-pdsh-avatar-image]) { visibility: hidden; }
[data-pdsh-avatar-image] {
  position: absolute; inset: 0;
  display: block; width: 100%; height: 100%;
  border-radius: inherit; object-fit: cover; corner-shape: inherit;
}
.pdsh-settings { display: flex; flex-direction: column; gap: var(--pdsh-section-inset); font: var(--dsw-font-xs-13); color: var(--dsw-alias-label-primary); }
.pdsh-settings :is(p, h4) { margin: 0; }
.pdsh-group { display: flex; flex-direction: column; gap: 0; padding: var(--pdsh-section-inset); border: var(--pdsh-outline-width) solid var(--dsw-alias-settings-card-stroke); border-radius: var(--dsw-radius-xl); background: var(--dsw-alias-settings-card-fill); }
/* \u672B\u4E2A\u8BBE\u7F6E\u884C\u72EC\u5360\u5E95\u90E8\u7559\u767D\uFF0C\u907F\u514D\u884C\u5185\u8FB9\u8DDD\u4E0E\u5361\u7247\u5E95\u8FB9\u8DDD\u53E0\u52A0\u9020\u6210\u4E0A\u504F\u3002 */
.pdsh-group:is(.pdsh-identity-group, .pdsh-fields-group) { padding-bottom: 0; }
/* \u6807\u9898\u4E0E\u5F00\u5173\u5171\u7528\u4E00\u884C\uFF1B\u6458\u8981\u81EA\u5E26\u5185\u8FB9\u8DDD\uFF0C\u4E0D\u518D\u53E0\u52A0\u72EC\u7ACB\u6807\u9898\u95F4\u9694\u3002 */
.pdsh-group > p { margin-top: var(--pdsh-field-gap); }
:is(.pdsh-identity-group, .pdsh-fields-group) > p:last-child { padding-bottom: var(--pdsh-section-inset); }
.pdsh-update-badge, .pdsh-update-confirm { display: inline-flex; align-items: center; flex-wrap: wrap; gap: var(--pdsh-field-gap); }
.pdsh-update-trigger { flex: none; }
.pdsh-update-trigger svg { width: var(--pdsh-native-icon-size); height: var(--pdsh-native-icon-size); stroke-width: calc(24 * var(--pdsh-native-icon-stroke-ratio)); opacity: var(--pdsh-native-icon-opacity); color: var(--dsw-alias-state-success-primary); }
.pdsh-update-confirm { font: var(--dsw-font-xxs-12); color: var(--dsw-alias-label-secondary); }
.pdsh-group h4, .pdsh-profile-name { font: var(--dsw-font-s-strong-14); }
.pdsh-hint { font: var(--dsw-font-xxs-12); color: var(--dsw-alias-label-secondary); overflow-wrap: anywhere; }
.pdsh-label { font: var(--dsw-font-xs-strong-13); }
.pdsh-copy, .pdsh-field { display: flex; flex-direction: column; gap: var(--pdsh-field-gap); min-width: 0; }
.pdsh-row { display: flex; align-items: center; justify-content: space-between; gap: var(--pdsh-action-gap); }
.pdsh-row > :last-child { flex: none; }
.pdsh-switch-tooltip { display: inline-flex; }
.pdsh-identity { display: flex; align-items: center; flex-wrap: wrap; gap: var(--pdsh-section-inset); padding-block: var(--pdsh-section-inset); }
/* \u540D\u5B57\u53C2\u4E0E\u539F\u751F\u6362\u884C\u6D4B\u91CF\uFF0C\u5148\u4FDD\u4F4F\u5934\u50CF+\u540D\u5B57\uFF0C\u4E0D\u4E3A\u4E09\u4E2A\u64CD\u4F5C\u6324\u6210\u9010\u5B57\u7AD6\u6392\u3002 */
.pdsh-profile-copy { flex: 0 1 auto; flex-direction: row; align-items: center; max-width: calc(100% - var(--pdsh-control-size) - var(--pdsh-control-size) - var(--pdsh-section-inset)); }
.pdsh-profile-name { min-width: 0; overflow-wrap: anywhere; }
.pdsh-avatar-actions { display: flex; flex: none; flex-wrap: wrap; justify-content: flex-end; gap: var(--pdsh-field-gap); max-width: 100%; margin-left: auto; }
/* \u6807\u7B7E\u5230\u9996\u4E2A\u6309\u94AE\u8F6E\u5ED3\u7684\u53EF\u89C1\u95F4\u9694\uFF0C\u5339\u914D\u4E24\u4E2A ghost \u6309\u94AE\u6587\u5B57\u4E4B\u95F4\u7684 gap + \u53CC\u4FA7\u5185\u8FB9\u8DDD\u3002 */
.pdsh-avatar-source-label { flex: none; align-self: center; color: var(--dsw-alias-label-secondary); white-space: nowrap; margin-inline-end: calc(var(--pdsh-button-inset) + var(--pdsh-button-inset)); }
/* \u6458\u8981\u5934\u50CF\u5360\u4E24\u4E2A\u539F\u751F\u63A7\u4EF6\u9AD8\u5EA6\uFF1B\u6765\u6E90\u4ECD\u662F Input \u63A2\u9488\uFF0C\u4E0D\u51ED\u7A7A\u6307\u5B9A\u5934\u50CF\u5C3A\u5BF8\u3002 */
.pdsh-avatar-preview { flex: none; border-radius: 50%; corner-shape: round; object-fit: cover; width: calc(var(--pdsh-control-size) + var(--pdsh-control-size)); height: calc(var(--pdsh-control-size) + var(--pdsh-control-size)); }
.pdsh-detail-row { display: flex; align-items: center; justify-content: space-between; gap: var(--pdsh-section-inset); padding-block: var(--pdsh-section-inset); border-top: var(--pdsh-outline-width) solid var(--dsw-alias-border-l2); }
/* \u62CD\u7167\u6807\u9898\u4E0D\u662F\u5B57\u6BB5\uFF1B\u9996\u884C\u4E0D\u753B\u8D34\u4F4F\u6807\u9898\u7684\u7EBF\uFF0C\u540E\u7EED\u5B57\u6BB5\u7EE7\u7EED\u5171\u7528\u539F\u751F\u5206\u9694\u3002 */
.pdsh-fields-group > .pdsh-group-header + .pdsh-detail-row { border-top: 0; }
.pdsh-detail-row > .pdsh-label { flex: none; }
.pdsh-value-action { display: flex; align-items: center; gap: var(--pdsh-field-gap); min-width: 0; max-width: 100%; font: var(--dsw-font-xs-13); }
.pdsh-value-action > span { min-width: 0; overflow-wrap: anywhere; text-align: right; }
.pdsh-nickname-action { flex: none; padding-inline: 0; width: var(--pdsh-action-size); }
.pdsh-inline-editor { display: flex; flex: 1; min-width: 0; min-height: var(--pdsh-action-size); align-items: center; gap: var(--pdsh-field-gap); }
.pdsh-inline-editor > span { flex: 1; min-width: 0; }
.pdsh-inline-editor > span:has(input[aria-invalid="true"]) { border-color: var(--dsw-alias-state-error-primary); }
.pdsh-inline-editor > button { flex: none; }
.pdsh-nickname-editor { flex: 0 1 auto; min-width: 0; max-width: 100%; }
.pdsh-avatar-feedback { display: flex; align-items: center; flex-wrap: wrap; gap: var(--pdsh-field-gap); padding-bottom: var(--pdsh-field-gap); }
.pdsh-avatar-fallback { display: flex; align-items: center; justify-content: center; }
.pdsh-error { color: var(--dsw-alias-state-error-primary); }
[data-pdsh-search-entry], [data-pdsh-capture-entry] { color: var(--pdsh-search-color); }
[data-pdsh-search-entry] svg, [data-pdsh-capture-entry] svg { opacity: var(--pdsh-icon-opacity); }
[data-pdsh-search-entry][hidden], [data-pdsh-capture-entry][hidden] { display: none !important; }
/* +--- \u539F\u751F searchSlot \u7684\u81EA\u52A8\u7559\u767D\u8FC1\u81F3\u81EA\u6709\u5DE6\u4FA7\u5165\u53E3\uFF1B\u9690\u85CF/\u5378\u8F7D\u540E\u89C4\u5219\u81EA\u52A8\u5931\u6548 ---+ */
[data-pdsh-search-entry="wide"], [data-pdsh-capture-entry="wide"][data-pdsh-entry-first] { margin-left: auto; flex: none; }
[data-pdsh-search-entry="wide"]:not([hidden]) + div { margin-left: 0; }
[data-pdsh-capture-entry="wide"]:not([hidden]) + div { margin-left: 0; }
`;var yt=`/**
 * [INPUT]: \u4F9D\u8D56\u771F\u5B9E Host Tooltip \u7684\u5B9E\u65F6\u8BA1\u7B97\u53C2\u6570\u53CA ui-theme \u7684 tooltip \u8BED\u4E49 token\u3002
 * [OUTPUT]: \u4E3A\u975E React \u4FA7\u680F/\u5DE5\u4F5C\u53F0\u63A7\u4EF6\u63D0\u4F9B\u4E0E\u5BBF\u4E3B\u5E95\u8272\u3001\u5B57\u53F7\u3001\u5706\u89D2\u3001portal \u5C42\u7EA7\u4E00\u81F4\u7684\u63D0\u793A\u6CE1\u3002
 * [POS]: dom-tooltip.ts \u7684\u89C6\u89C9\u8FB9\u754C\uFF1BReact \u63A7\u4EF6\u4ECD\u76F4\u63A5\u4F7F\u7528\u5B98\u65B9 Tooltip\u3002
 * [PROTOCOL]: \u53D8\u66F4\u65F6\u66F4\u65B0\u6B64\u5934\u90E8\uFF0C\u7136\u540E\u68C0\u67E5 CLAUDE.md
 */
.pdsh-native-tooltip {
  position: fixed; z-index: var(--pdsh-tooltip-layer); display: inline-flex; align-items: center;
  width: max-content; max-width: var(--pdsh-tooltip-max-width); padding: var(--pdsh-tooltip-padding);
  border-radius: var(--dsw-radius-sm); background: var(--dsw-alias-tooltip-bg);
  color: var(--dsw-static-neutral-bluish-00); font: var(--dsw-font-xs-13);
  white-space: pre-line; overflow-wrap: break-word; pointer-events: none;
  animation: pdsh-tooltip-in var(--pdsh-tooltip-duration) var(--pdsh-tooltip-ease);
}
.pdsh-native-tooltip[data-side="bottom"] { transform: translateX(-50%); }
.pdsh-native-tooltip[data-side="top"] { transform: translate(-50%, -100%); }
@keyframes pdsh-tooltip-in { from { opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .pdsh-native-tooltip { animation: none; } }
`;var wt=`/**
 * [INPUT]: \u4F9D\u8D56 view.ts \u8F93\u51FA\u7684 capture-window DOM\u3001DSH \u4E3B\u9898/\u52A8\u753B token \u4E0E\u5B9E\u65F6\u539F\u751F Button/Switch/\u56FE\u6807/\u5B57\u6BB5\u6837\u5F0F\u63A2\u9488
 * [OUTPUT]: \u5DE5\u4F5C\u53F0\u3001\u753B\u5E03\u3001\u68C0\u67E5\u5668\u4E0E\u5934\u50CF\u62CD\u6444\u5360\u4F4D\uFF1B\u6807\u9898\u4E34\u65F6\u7070\u6761\u7531 ../styles.css \u7EDF\u4E00\u7ED8\u5236\uFF0C\u5916\u58F3\u5E95\u8272\u53EA\u7ED8\u5236\u4E00\u6B21\uFF0C\u7A97\u53E3\u653E\u5927\u4E0D\u6539\u53D8\u63A7\u4EF6\u5BC6\u5EA6\u3002
 * [POS]: capture-window \u7684\u89C6\u89C9\u5951\u7EA6\uFF0C\u548C color-popover.css \u5206\u5DE5\u7EF4\u62A4\u4E3B\u7F16\u8F91\u5668\u4E0E\u6D6E\u5C42\u6837\u5F0F
 * [PROTOCOL]: \u53D8\u66F4\u65F6\u66F4\u65B0\u6B64\u5934\u90E8\uFF0C\u7136\u540E\u68C0\u67E5 CLAUDE.md
 */
[data-pdsh-capture],
[data-pdsh-capture-preview] {
  --pdsh-capture-window-scale: 1.2;
  /* \u539F\u5E03\u5C40\u975E\u753B\u5E03\u9AD8\u5EA6\uFF1Aheader 14 \u683C + footer 14 \u683C + \u5DE5\u5177\u680F\u53CA\u7559\u767D 13 \u683C\u3002
     \u63A7\u4EF6\u4E0D\u7F29\u653E\uFF0C\u7A97\u53E3\u65B0\u589E\u7684\u9AD8\u5EA6\u5168\u90E8\u8BA9\u7ED9\u753B\u5E03\u3002 */
  --pdsh-capture-chrome-height: calc(var(--pdsh-capture-space) * (14 + 14 + 13));
  --pdsh-capture-stage-height: calc((50vh + var(--pdsh-capture-chrome-height)) * var(--pdsh-capture-window-scale) - var(--pdsh-capture-chrome-height));
  --pdsh-capture-space: calc(var(--pdsh-field-gap) / 2);
  --pdsh-capture-surface: var(--dsw-alias-bg-layer-2);
  --pdsh-capture-surface-secondary: var(--dsw-alias-bg-layer-1);
  --pdsh-capture-surface-tertiary: var(--dsw-alias-bg-layer-3);
  --pdsh-capture-surface-under: var(--dsw-alias-bg-base);
  --pdsh-capture-text: var(--dsw-alias-label-primary);
  --pdsh-capture-text-secondary: var(--dsw-alias-label-secondary);
  --pdsh-capture-text-tertiary: var(--dsw-alias-label-tertiary);
  --pdsh-capture-text-disabled: var(--dsw-alias-label-dimmed);
  --pdsh-capture-border: var(--dsw-alias-border-l2);
  --pdsh-capture-border-strong: var(--dsw-alias-border-l3);
  --pdsh-capture-hover: var(--dsw-alias-interactive-bg-hover);
  --pdsh-capture-active: var(--dsw-alias-interactive-bg-active);
  --pdsh-capture-primary: var(--dsw-alias-button-primary-fill);
  --pdsh-capture-primary-text: var(--dsw-alias-label-primary-inverted);
  --pdsh-capture-ring: var(--dsw-alias-brand-primary);
  --pdsh-capture-focus: var(--dsw-alias-state-business-primary);
  --pdsh-capture-danger: var(--dsw-alias-state-error-primary);
  --pdsh-capture-font-base: var(--dsw-font-s-14-font-size);
  --pdsh-capture-font-sm: var(--dsw-font-xs-13-font-size);
  --pdsh-capture-font-xs: var(--dsw-font-xxs-12-font-size);
  --pdsh-capture-icon-sm: var(--pdsh-native-icon-size);
  --pdsh-capture-icon-base: var(--pdsh-native-icon-size);
  --pdsh-capture-radius-sm: var(--dsw-radius-sm);
  --pdsh-capture-radius-md: var(--dsw-radius-md);
  --pdsh-capture-radius-lg: var(--dsw-radius-lg);
  --pdsh-capture-radius-xl: var(--dsw-radius-xl);
  --pdsh-capture-radius-2xl: var(--dsw-radius-panel);
  --pdsh-capture-radius-dialog: var(--dsw-radius-panel);
  --pdsh-capture-shadow: var(--dsw-elevation-prominent);
  --pdsh-capture-control-height: var(--pdsh-action-size);
  --pdsh-capture-toolbar-height: calc(var(--pdsh-action-size) + var(--pdsh-field-gap));
  --pdsh-capture-duration: var(--ds-transition-duration-fast);
  --pdsh-capture-ease: var(--ds-ease-in-out);
  color: var(--pdsh-capture-text);
  font-family: var(--dsw-font-family);
}

/* 24 \u662F\u56FE\u7A3F\u5750\u6807\u7CFB\uFF1B\u7B14\u89E6\u5BC6\u5EA6\u4E0E\u6839\u900F\u660E\u5EA6\u6765\u81EA\u771F\u5B9E Host SVG\u3002 */
[data-pdsh-capture] [data-capture-icon] {
  width: var(--pdsh-native-icon-size); height: var(--pdsh-native-icon-size);
  stroke-width: calc(24 * var(--pdsh-native-icon-stroke-ratio));
  opacity: var(--pdsh-native-icon-opacity);
}

[data-pdsh-capture] *,
[data-pdsh-capture] *::before,
[data-pdsh-capture] *::after,
[data-pdsh-capture-preview] *,
[data-pdsh-capture-preview] *::before,
[data-pdsh-capture-preview] *::after {
  box-sizing: border-box;
}

html.pdsh-capturing [data-pdsh-capture-hide],
html.pdsh-capturing [data-pdsh-capture-hide] * {
  transition: none !important;
  visibility: hidden !important;
}

html.pdsh-capture-redact [data-pdsh-capture-redact-profile] > img {
  filter: grayscale(1) contrast(0);
  opacity: .32;
}

.pdsh-capture-root {
  align-items: center;
  display: flex;
  inset: 0;
  justify-content: center;
  padding: calc(var(--pdsh-capture-space) * 4);
  position: fixed;
  z-index: 1000;
}

.pdsh-capture-backdrop {
  backdrop-filter: var(--dsw-mask-blur);
  background: var(--dsw-alias-bg-mask-1);
  inset: 0;
  position: absolute;
}

.pdsh-capture-dialog {
  background: var(--pdsh-capture-surface);
  border: var(--pdsh-outline-width) solid var(--pdsh-capture-border);
  border-radius: var(--pdsh-capture-radius-dialog);
  box-shadow: var(--pdsh-capture-shadow);
  display: grid;
  grid-template-rows: auto auto auto;
  isolation: isolate;
  max-height: calc(100dvh - var(--pdsh-capture-space) * 8);
  max-width: calc(100vw - var(--pdsh-capture-space) * 8);
  overflow: hidden;
  position: relative;
  width: calc(clamp(56rem, 60vw, 64rem) * var(--pdsh-capture-window-scale));
  container-type: inline-size;
}

.pdsh-capture-header,
.pdsh-capture-footer {
  align-items: center;
  display: flex;
  gap: calc(var(--pdsh-capture-space) * 3);
}

.pdsh-capture-header {
  min-width: 0;
  padding: calc(var(--pdsh-capture-space) * 4) calc(var(--pdsh-capture-space) * 5) calc(var(--pdsh-capture-space) * 3);
}

.pdsh-capture-heading {
  align-items: center;
  display: flex;
  flex: 1;
  gap: calc(var(--pdsh-capture-space) * 2);
  min-width: 0;
}

.pdsh-capture-heading > svg {
  height: var(--pdsh-capture-icon-base);
  width: var(--pdsh-capture-icon-base);
}

.pdsh-capture-title {
  font: var(--dsw-font-s-strong-14);
  margin: 0;
}

.pdsh-capture-workspace {
  display: grid;
  gap: calc(var(--pdsh-capture-space) * 5);
  grid-template-columns: minmax(0, 1fr) calc(var(--pdsh-capture-space) * 60);
  min-height: 0;
  padding: 0 calc(var(--pdsh-capture-space) * 5) calc(var(--pdsh-capture-space) * 4);
}

.pdsh-capture-preview-pane {
  display: grid;
  gap: calc(var(--pdsh-capture-space) * 2);
  grid-template-rows: var(--pdsh-capture-toolbar-height) var(--pdsh-capture-stage-height);
  min-width: 0;
  overflow: hidden;
}

.pdsh-capture-toolbar {
  align-items: center;
  display: flex;
  gap: calc(var(--pdsh-capture-space) * 2);
  min-height: var(--pdsh-capture-control-height);
}

.pdsh-capture-region-hint {
  color: var(--pdsh-capture-text-tertiary);
  flex: 1;
  font-size: var(--pdsh-capture-font-xs);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pdsh-capture-toolbar-controls {
  align-items: center;
  display: flex;
  flex: none;
  gap: calc(var(--pdsh-capture-space) * .5);
}

.pdsh-capture-toolbar-divider {
  background: var(--pdsh-capture-border);
  height: var(--pdsh-capture-icon-base);
  margin-inline: calc(var(--pdsh-capture-space) * .5);
  width: 1px;
}

.pdsh-capture-zoom-reset {
  appearance: none;
  background: transparent;
  border: 0;
  color: var(--pdsh-capture-text-tertiary);
  cursor: pointer;
  font: inherit;
  font-size: var(--pdsh-capture-font-xs);
  font-variant-numeric: tabular-nums;
  height: var(--pdsh-capture-control-height);
  min-width: calc(var(--pdsh-capture-space) * 10);
  padding-inline: var(--pdsh-capture-space);
}

.pdsh-capture-button,
.pdsh-capture-icon-button,
.pdsh-capture-background-option {
  -webkit-appearance: none;
  appearance: none;
  border: 0;
  color: inherit;
  cursor: pointer;
  font: inherit;
  outline: none;
  transition: var(--pdsh-action-transition);
}

.pdsh-capture-button:focus-visible,
.pdsh-capture-icon-button:focus-visible,
.pdsh-capture-background-option:focus-visible,
.pdsh-capture-switch:focus-visible,
.pdsh-capture-range:focus-visible {
  outline: var(--dsw-focus-ring-width) solid var(--pdsh-capture-focus);
  outline-offset: var(--dsw-focus-ring-width);
}

.pdsh-capture-icon-button {
  align-items: center;
  background: transparent;
  border-radius: var(--pdsh-action-radius);
  display: inline-flex;
  height: var(--pdsh-capture-control-height);
  justify-content: center;
  padding: 0;
  width: var(--pdsh-capture-control-height);
}

.pdsh-capture-icon-button > svg {
  height: var(--pdsh-capture-icon-sm);
  width: var(--pdsh-capture-icon-sm);
}

.pdsh-capture-icon-button[data-action="close"] {
  height: var(--pdsh-capture-control-height);
  width: var(--pdsh-capture-control-height);
}

.pdsh-capture-icon-button[aria-pressed="true"] {
  background: var(--pdsh-capture-surface-tertiary);
  color: var(--pdsh-capture-text);
}

.pdsh-capture-icon-button:hover:not(:disabled),
.pdsh-capture-button:hover:not(:disabled) {
  background: var(--pdsh-capture-hover);
}

.pdsh-capture-icon-button:active:not(:disabled),
.pdsh-capture-button:active:not(:disabled) {
  background: var(--pdsh-capture-active);
}

.pdsh-capture-icon-button:disabled,
.pdsh-capture-button:disabled {
  opacity: var(--pdsh-action-disabled-opacity);
  cursor: default;
}

.pdsh-capture-stage {
  align-items: center;
  background-color: var(--pdsh-capture-surface-secondary);
  border: var(--pdsh-outline-width) solid var(--pdsh-capture-border);
  border-radius: var(--pdsh-capture-radius-md);
  cursor: grab;
  display: flex;
  justify-content: center;
  height: var(--pdsh-capture-stage-height);
  overflow: hidden;
  padding: 0;
  position: relative;
  touch-action: none;
}

.pdsh-capture-stage,
.pdsh-capture-checker {
  background-image:
    linear-gradient(45deg, rgb(128 128 128 / 16%) 25%, transparent 25%, transparent 75%, rgb(128 128 128 / 16%) 75%),
    linear-gradient(45deg, rgb(128 128 128 / 16%) 25%, transparent 25%, transparent 75%, rgb(128 128 128 / 16%) 75%);
  background-position: 0 0, 8px 8px;
  background-size: 16px 16px;
}

.pdsh-capture-stage[data-tool="redact"] {
  cursor: crosshair;
}

.pdsh-capture-stage[data-panning="true"] {
  cursor: grabbing;
}

.pdsh-capture-canvas-frame {
  line-height: 0;
  max-height: 100%;
  max-width: 100%;
  position: relative;
  transform-origin: center;
  transition: transform var(--pdsh-capture-duration) var(--pdsh-capture-ease);
  user-select: none;
}

.pdsh-capture-canvas {
  display: block;
  height: auto;
  /* fitCanvas \u72EC\u5360\u5C3A\u5BF8\u8BA1\u7B97\uFF1B\u4F4D\u56FE\u4E0D\u80FD\u518D\u88AB\u65E7\u50CF\u7D20\u4E0A\u9650\u4E8C\u6B21\u538B\u7F29\u3002 */
  max-height: none;
  max-width: none;
  pointer-events: none;
  width: auto;
}

.pdsh-capture-region-layer {
  inset: 0;
  pointer-events: none;
  position: absolute;
}

.pdsh-capture-region {
  border: var(--pdsh-outline-width) solid transparent;
  border-radius: var(--dsw-radius-xs);
  position: absolute;
}

.pdsh-capture-region-candidate {
  border-color: color-mix(in srgb, var(--pdsh-capture-ring) 55%, transparent);
  border-style: dashed;
}

.pdsh-capture-region-candidate[data-interactive="true"] {
  cursor: pointer;
  pointer-events: auto;
}

.pdsh-capture-region-candidate[data-interactive="true"]:hover {
  background: color-mix(in srgb, var(--pdsh-capture-ring) 10%, transparent);
  border-color: var(--pdsh-capture-ring);
}

.pdsh-capture-region-candidate[data-interactive="false"] {
  opacity: var(--pdsh-action-disabled-opacity);
}

.pdsh-capture-region-confirmed[data-interactive="true"] {
  cursor: pointer;
  pointer-events: auto;
}

.pdsh-capture-region-confirmed[data-interactive="true"]:hover {
  border-color: color-mix(in srgb, var(--pdsh-capture-ring) 70%, transparent);
}

.pdsh-capture-region-remove {
  align-items: center;
  background: var(--pdsh-capture-primary-text);
  border: var(--pdsh-outline-width) solid var(--pdsh-capture-primary);
  border-radius: 50%;
  corner-shape: round;
  color: var(--pdsh-capture-primary);
  display: none;
  font-family: var(--dsw-font-family);
  font-size: var(--pdsh-capture-font-xs);
  font-weight: var(--dsw-font-xs-strong-13-font-weight);
  height: var(--pdsh-capture-icon-base);
  justify-content: center;
  padding: 0;
  position: absolute;
  right: calc(var(--pdsh-capture-icon-base) / -2);
  top: calc(var(--pdsh-capture-icon-base) / -2);
  width: var(--pdsh-capture-icon-base);
}

.pdsh-capture-region-confirmed[data-interactive="true"]:hover .pdsh-capture-region-remove {
  display: flex;
}

.pdsh-capture-draft-region {
  background: color-mix(in srgb, var(--pdsh-capture-ring) 10%, transparent);
  border: var(--pdsh-outline-width) dashed var(--pdsh-capture-ring);
  border-radius: var(--pdsh-capture-radius-sm);
  pointer-events: none;
  position: fixed;
  z-index: 1;
}

.pdsh-capture-inspector {
  max-height: calc(var(--pdsh-capture-stage-height) + var(--pdsh-capture-space) * 9);
  background: transparent;
  display: flex;
  flex-direction: column;
  gap: calc(var(--pdsh-capture-space) * 2);
  min-height: 0;
  overflow: hidden;
  padding-block: var(--pdsh-capture-space);
}

.pdsh-capture-inspector > .pdsh-capture-section-title { flex-shrink: 0; }

.pdsh-capture-inspector-scroll {
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
  scrollbar-width: none;
}

.pdsh-capture-inspector-scroll::-webkit-scrollbar { display: none; }

.pdsh-capture-inspector-content {
  display: flex;
  flex-direction: column;
  gap: calc(var(--pdsh-capture-space) * 5);
  padding-block: var(--pdsh-capture-space);
}

/* \u53EA\u501F\u7528 alpha \u906E\u7F69\u7B97\u6CD5\uFF1BcurrentColor \u4EC5\u63D0\u4F9B\u4E0D\u900F\u660E\u5EA6\uFF0C\u4E0D\u5728\u5185\u5BB9\u4E0A\u7ED8\u5236\u989C\u8272\u3002 */
.pdsh-capture-inspector-scroll[data-overflowing="true"] {
  --capture-fade-top: calc(var(--pdsh-capture-space) * 3);
  --capture-fade-bottom: calc(var(--pdsh-capture-space) * 3);
  mask-image: linear-gradient(to bottom, transparent, currentColor var(--capture-fade-top), currentColor calc(100% - var(--capture-fade-bottom)), transparent);
  mask-mode: alpha;
  mask-repeat: no-repeat;
}
.pdsh-capture-inspector-scroll[data-at-start="true"] { --capture-fade-top: 0px; }
.pdsh-capture-inspector-scroll[data-at-end="true"] { --capture-fade-bottom: 0px; }

.pdsh-capture-section + .pdsh-capture-section {
  margin: 0;
}

.pdsh-capture-section-heading,
.pdsh-capture-row {
  align-items: center;
  display: flex;
  gap: calc(var(--pdsh-capture-space) * 2);
  justify-content: space-between;
}

.pdsh-capture-section-title {
  color: var(--pdsh-capture-text-secondary);
  font: var(--dsw-font-xxs-strong-12);
  margin: 0;
}

.pdsh-capture-section-description {
  color: var(--pdsh-capture-text-tertiary);
  font: var(--dsw-font-xxs-12);
  margin: 2px 0 0;
}

.pdsh-capture-privacy-copy {
  min-width: 0;
  padding-right: calc(var(--pdsh-capture-space) * 2);
}

.pdsh-capture-padding-heading {
  margin-bottom: calc(var(--pdsh-capture-space) * 2);
}

.pdsh-capture-switch {
  appearance: none;
  background: var(--dsw-alias-border-l3);
  border: 0;
  border-radius: var(--pdsh-switch-radius);
  corner-shape: round;
  cursor: pointer;
  flex: none;
  height: var(--pdsh-switch-height);
  margin: 0;
  padding: calc((var(--pdsh-switch-height) - var(--pdsh-switch-thumb-size)) / 2);
  position: relative;
  width: var(--pdsh-switch-width);
}

.pdsh-capture-switch::after {
  background: var(--dsw-alias-switch-thumb);
  border-radius: var(--pdsh-switch-thumb-radius);
  corner-shape: round;
  box-shadow: var(--pdsh-switch-thumb-shadow);
  content: "";
  display: block;
  height: var(--pdsh-switch-thumb-size);
  transform: translateX(0);
  transition: var(--pdsh-switch-thumb-transition);
  width: var(--pdsh-switch-thumb-size);
}

.pdsh-capture-switch:checked {
  background: var(--dsw-alias-brand-primary);
}
.pdsh-capture-switch:checked::after { background: var(--dsw-alias-label-primary-foreground); }

.pdsh-capture-switch:checked::after {
  transform: translateX(calc(var(--pdsh-switch-width) - var(--pdsh-switch-height)));
}

.pdsh-capture-solid-color:focus-visible {
  outline: var(--dsw-focus-ring-width) solid var(--pdsh-capture-focus);
  outline-offset: var(--dsw-focus-ring-width);
}

.pdsh-capture-solid-color {
  align-items: center;
  background: transparent;
  border: 0;
  display: flex;
  height: var(--pdsh-capture-control-height);
  justify-content: center;
  padding: 0;
  position: relative;
  width: var(--pdsh-capture-control-height);
}

.pdsh-capture-solid-color > span {
  background: var(--capture-solid-color);
  border: var(--pdsh-outline-width) solid var(--dsw-alias-border-l2);
  border-radius: 50%;
  corner-shape: round;
  height: var(--pdsh-capture-icon-sm);
  pointer-events: none;
  width: var(--pdsh-capture-icon-sm);
}

.pdsh-capture-range {
  accent-color: var(--pdsh-capture-primary);
  cursor: pointer;
  width: 100%;
}

/* \u5341\u7B49\u5206\u89C6\u89C9\u53C2\u7167\u4E0D\u53C2\u4E0E\u547D\u4E2D\u6216\u91CF\u5316\uFF0C\u6570\u503C\u8F93\u5165\u7EE7\u7EED\u4EA4\u7ED9\u539F\u751F range\u3002 */
.pdsh-capture-range-field .pdsh-capture-range { margin: 0; }
.pdsh-capture-range-ticks {
  color: var(--pdsh-capture-text-tertiary);
  height: var(--pdsh-capture-space);
  margin-inline: calc(var(--pdsh-capture-space) * 2);
  pointer-events: none;
  position: relative;
}
.pdsh-capture-range-ticks > i {
  background: currentColor;
  border-radius: 9999px;
  height: calc(var(--pdsh-capture-space) * .5);
  left: var(--capture-tick-position);
  position: absolute;
  transform: translateX(-50%);
  width: calc(var(--pdsh-capture-space) * .5);
}

.pdsh-capture-value {
  color: var(--pdsh-capture-text-secondary);
  font-size: var(--pdsh-capture-font-xs);
  font-variant-numeric: tabular-nums;
}

.pdsh-capture-footer {
  justify-content: flex-end;
  padding: var(--pdsh-capture-space) calc(var(--pdsh-capture-space) * 5) calc(var(--pdsh-capture-space) * 4);
}

.pdsh-capture-footer-spacer {
  flex: 1;
  margin-right: auto;
}

.pdsh-capture-button {
  align-items: center;
  background: transparent;
  border: var(--pdsh-outline-width) solid transparent;
  border-radius: var(--pdsh-action-radius);
  display: inline-flex;
  font: var(--dsw-font-s-14);
  gap: var(--pdsh-button-gap);
  height: var(--pdsh-capture-control-height);
  justify-content: center;
  padding-inline: var(--pdsh-button-inset);
}

.pdsh-capture-button > svg {
  height: var(--pdsh-capture-icon-sm);
  width: var(--pdsh-capture-icon-sm);
}

.pdsh-capture-button-secondary {
  border-color: var(--pdsh-capture-border);
}

.pdsh-capture-button-primary {
  background: var(--pdsh-capture-primary);
  color: var(--pdsh-capture-primary-text);
}

.pdsh-capture-button-primary:hover:not(:disabled) {
  background: var(--dsw-alias-button-primary-hover);
}

.pdsh-capture-preview-shell {
  background: var(--pdsh-capture-surface-secondary);
  color: var(--pdsh-capture-text);
  height: 100dvh;
  overflow: hidden;
}

.pdsh-capture-preview-app {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  height: 100%;
}

.pdsh-capture-preview-sidebar {
  background: var(--pdsh-capture-surface-tertiary);
  border-right: 1px solid var(--pdsh-capture-border);
  padding: calc(var(--pdsh-capture-space) * 4);
}

.pdsh-capture-preview-main {
  align-items: center;
  background: var(--pdsh-capture-surface);
  display: flex;
  flex-direction: column;
  gap: calc(var(--pdsh-capture-space) * 6);
  justify-content: center;
  padding: calc(var(--pdsh-capture-space) * 8);
}

.pdsh-capture-preview-card {
  background: var(--pdsh-capture-surface-secondary);
  border: var(--pdsh-outline-width) solid var(--pdsh-capture-border);
  border-radius: var(--pdsh-capture-radius-2xl);
  max-width: 560px;
  padding: calc(var(--pdsh-capture-space) * 5);
  width: 100%;
}

.pdsh-capture-preview-controls {
  align-items: center;
  display: flex;
  gap: calc(var(--pdsh-capture-space) * 2);
  position: fixed;
  right: calc(var(--pdsh-capture-space) * 4);
  top: calc(var(--pdsh-capture-space) * 4);
  z-index: calc(2147480000 + 1);
}

@media (max-width: 719px) {
  .pdsh-capture-preview-controls {
    display: none;
  }

  .pdsh-capture-root {
    padding: 0;
  }

  .pdsh-capture-dialog {
    border: 0;
    border-radius: 0;
    height: 100dvh;
    max-height: 100dvh;
    min-height: 0;
    width: 100vw;
  }

  [data-pdsh-capture-preview] .pdsh-capture-dialog {
    height: 100dvh;
    max-height: 100dvh;
  }

  .pdsh-capture-footer .pdsh-capture-button {
    flex: 1;
  }
}

@media (max-height: 639px) and (min-width: 720px) {
  .pdsh-capture-dialog {
    min-height: 0;
  }
}

/* \u66F2\u7387\u968F Host \u5168\u5C40 token\uFF1B\u5706\u5F62 Switch \u5355\u72EC\u6CBF\u7528\u539F\u751F round \u5951\u7EA6\u3002 */
.pdsh-capture-dialog { corner-shape: var(--dsw-corner-shape); }
.pdsh-capture-button, .pdsh-capture-icon-button { corner-shape: var(--pdsh-action-corner-shape); }

@media (prefers-reduced-motion: reduce) {
  [data-pdsh-capture] *,
  [data-pdsh-capture] *::before,
  [data-pdsh-capture] *::after {
    scroll-behavior: auto !important;
    transition: none !important;
    animation: none !important;
  }
}
`;var Ct=`/**
 * [INPUT]: \u4F9D\u8D56 capture-window.css \u5B9A\u4E49\u7684 DSH \u8BED\u4E49\u4EE4\u724C\u3001\u5B9E\u65F6\u539F\u751F\u8FB9\u6846/\u7981\u7528\u6001\u4E0E\u68C0\u67E5\u5668\u5E95\u7EB9
 * [OUTPUT]: \u4E3A\u6E10\u53D8\u3001\u58C1\u7EB8\u4E0E\u7EAF\u8272\u63D0\u4F9B\u9002\u5E94\u7C7B\u522B\u5BC6\u5EA6\u7684\u6B63\u65B9\u5F62\u8272\u677F\u3001\u9009\u4E2D\u73AF\u53CA\u4EA4\u4E92\u6001
 * [POS]: capture-window \u7684\u80CC\u666F\u9009\u62E9\u5668\u6837\u5F0F\u8FB9\u754C\uFF0C\u4E0E\u7F16\u8F91\u5668\u58F3\u5C42\u53CA\u989C\u8272\u5F39\u5C42\u6837\u5F0F\u6309\u804C\u8D23\u5206\u79BB
 * [PROTOCOL]: \u53D8\u66F4\u65F6\u66F4\u65B0\u6B64\u5934\u90E8\uFF0C\u7136\u540E\u68C0\u67E5 CLAUDE.md
 */
.pdsh-capture-background-sections {
  display: flex;
  flex-direction: column;
  gap: calc(var(--pdsh-capture-space) * 3);
  margin-top: calc(var(--pdsh-capture-space) * 2);
}

.pdsh-capture-background-section {
  min-width: 0;
}

.pdsh-capture-background-section-title {
  color: var(--pdsh-capture-text-secondary);
  font: var(--dsw-font-xxs-strong-12);
  margin: 0 0 calc(var(--pdsh-capture-space) * 2);
}

.pdsh-capture-background-section-heading {
  align-items: center;
  display: flex;
  justify-content: space-between;
  margin-bottom: calc(var(--pdsh-capture-space) * 2);
}

.pdsh-capture-background-section-heading .pdsh-capture-background-section-title {
  margin-bottom: 0;
}

.pdsh-capture-background-expand {
  background: none;
  border: 0;
  color: var(--pdsh-capture-text-secondary);
  font: inherit;
  font-size: var(--pdsh-capture-font-xs);
  padding: 0;
}

.pdsh-capture-background-expand:hover {
  color: var(--pdsh-capture-text);
}

.pdsh-capture-background-grid {
  display: grid;
  gap: calc(var(--pdsh-capture-space) * 2);
  grid-template-columns: repeat(5, minmax(0, 1fr));
  justify-items: stretch;
  padding: var(--pdsh-capture-space);
  width: 100%;
}

.pdsh-capture-background-grid-plain {
  gap: calc(var(--pdsh-capture-space) * 2);
  grid-template-columns: repeat(8, minmax(0, 1fr));
}

.pdsh-capture-background-grid-plain .pdsh-capture-background-option {
  border-radius: 50%;
  corner-shape: round;
}


.pdsh-capture-background-option {
  aspect-ratio: 1;
  background: var(--capture-swatch);
  background-clip: border-box;
  background-origin: border-box;
  border: var(--pdsh-outline-width) solid var(--dsw-alias-border-l2);
  border-radius: var(--pdsh-capture-radius-sm);
  height: auto;
  min-width: 0;
  overflow: hidden;
  padding: 0;
  position: relative;
  width: 100%;
}

.pdsh-capture-background-option[aria-pressed="true"],
.pdsh-capture-background-option[data-selected="true"] {
  box-shadow: 0 0 0 var(--dsw-focus-ring-width) var(--pdsh-capture-surface), 0 0 0 calc(var(--dsw-focus-ring-width) * 2) var(--pdsh-capture-ring);
}

.pdsh-capture-background-option svg {
  color: inherit;
  height: var(--pdsh-capture-icon-sm);
  inset: 50% auto auto 50%;
  position: absolute;
  transform: translate(-50%, -50%);
  width: var(--pdsh-capture-icon-sm);
}

.pdsh-capture-color-label[data-selected="false"] {
  background: var(--pdsh-capture-surface-tertiary);
  color: var(--pdsh-capture-text);
}

.pdsh-capture-color-label,
.pdsh-capture-wallpaper-label {
  align-items: center;
  color: var(--pdsh-capture-text-tertiary);
  cursor: pointer;
  display: flex;
  justify-content: center;
  overflow: hidden;
  padding: 0;
  position: relative;
}

.pdsh-capture-wallpaper-label {
  background: transparent;
  border-style: dashed;
  color: var(--pdsh-capture-text-secondary);
}

.pdsh-capture-wallpaper-label:hover {
  color: var(--pdsh-capture-text);
}

.pdsh-capture-wallpaper-label[data-selected="true"] {
  border-style: solid;
}

.pdsh-capture-wallpaper-label img {
  height: 100%;
  object-fit: cover;
  width: 100%;
}

.pdsh-capture-wallpaper-label [data-wallpaper-placeholder] {
  inset: 0;
  position: absolute;
}

.pdsh-capture-wallpaper-label [data-wallpaper-placeholder] > svg {
  color: inherit;
}

.pdsh-capture-color-label:focus-visible,
.pdsh-capture-wallpaper-label:focus-visible {
  outline: var(--dsw-focus-ring-width) solid var(--pdsh-capture-focus);
  outline-offset: var(--dsw-focus-ring-width);
}

.pdsh-capture-wallpaper-input {
  display: none;
}

.pdsh-capture-change-wallpaper {
  background: transparent;
  border: 0;
  color: var(--pdsh-capture-text-secondary);
  cursor: pointer;
  font: inherit;
  font-size: var(--pdsh-capture-font-xs);
  margin-top: calc(var(--pdsh-capture-space) * 2);
  padding: 0;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.pdsh-capture-change-wallpaper:hover {
  color: var(--pdsh-capture-text);
}

/* \u7B49\u5F85\u539F\u56FE\u65F6\u4FDD\u7559\u552F\u4E00\u5DF2\u5E94\u7528\u9009\u4E2D\u6001\uFF0C\u76EE\u6807\u9879\u53EA\u663E\u793A\u5904\u7406\u4E2D\u3002 */
.pdsh-capture-background-option[aria-busy="true"] {
  cursor: progress;
  opacity: var(--pdsh-action-disabled-opacity);
}

/* -------------------- \u7CFB\u7EDF\u8D44\u6E90\u52A0\u8F7D\u5360\u4F4D -------------------- */
.pdsh-capture-skeleton {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: inherit;
  background: var(--pdsh-capture-surface-tertiary);
}
/* Host \u6CA1\u6709\u516C\u5F00\u7EDF\u4E00\u52A0\u8F7D\u5468\u671F\uFF1B\u4FDD\u7559\u9759\u6001\u5360\u4F4D\uFF0C\u4E0D\u81EA\u9020\u7B2C\u4E8C\u5957\u52A8\u753B\u53C2\u6570\u3002 */
`;var kt=`/**
 * [INPUT]: \u4F9D\u8D56\u5171\u4EAB\u8868\u9762/\u6587\u5B57 token\u3001\u5B9E\u65F6\u539F\u751F Input \u8FB9\u7EBF\u4E0E\u989C\u8272\u6A21\u578B\u63D0\u4F9B\u7684\u8272\u76F8\uFF1B\u8272\u8C31\u4E2D\u7684\u9ED1\u767D\u662F\u989C\u8272\u7A7A\u95F4\u7AEF\u70B9\uFF0C\u4E0D\u662F\u4E3B\u9898\u6587\u5B57\u3002
 * [OUTPUT]: \u63D0\u4F9B\u989C\u8272\u6D6E\u5C42\u3001\u8272\u8C31\u548C\u8F93\u5165\u63A7\u4EF6\u6837\u5F0F\u3002
 * [POS]: capture-window \u7684\u9009\u8272\u89C6\u89C9\u8FB9\u754C\uFF0C\u4E0E\u80CC\u666F\u9009\u62E9\u5668\u5171\u7528\u8868\u9762\u8BED\u4E49\u3002
 * [PROTOCOL]: \u53D8\u66F4\u65F6\u66F4\u65B0\u6B64\u5934\u90E8\uFF0C\u7136\u540E\u68C0\u67E5 CLAUDE.md
 */
.pdsh-capture-color-popover {
  background: var(--pdsh-capture-surface);
  border: var(--pdsh-outline-width) solid var(--pdsh-capture-border);
  border-radius: var(--pdsh-capture-radius-md);
  box-shadow: var(--dsw-elevation-panel);
  box-sizing: border-box;
  color: var(--pdsh-capture-text);
  display: flex;
  flex-direction: column;
  gap: calc(var(--pdsh-capture-space) * 3);
  padding: calc(var(--pdsh-capture-space) * 3);
  position: fixed;
  width: auto;
  z-index: 50;
}

.react-colorful {
  cursor: default;
  display: flex;
  flex-direction: column;
  height: 200px;
  position: relative;
  user-select: none;
  width: 200px;
}

.react-colorful__saturation {
  /* \u8272\u8C31\u5E95\u90E8\u7EAF\u9ED1\u662F\u989C\u8272\u7A7A\u95F4\u7AEF\u70B9\uFF0C\u4E0D\u662F\u4E3B\u9898\u8FB9\u6846\u3002 */
  background-color: var(--capture-picker-hue);
  background-image: linear-gradient(0deg, #000, transparent), linear-gradient(90deg, #fff, rgb(255 255 255 / 0%));
  border-bottom: 12px solid #000;
  border-radius: var(--dsw-radius-sm) var(--dsw-radius-sm) 0 0;
  box-shadow: inset 0 0 0 1px var(--dsw-alias-border-l2);
  flex-grow: 1;
  position: relative;
}

.react-colorful__hue {
  background: linear-gradient(90deg, red 0, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, red);
  height: 24px;
  position: relative;
}

.react-colorful__last-control {
  border-radius: 0 0 var(--dsw-radius-sm) var(--dsw-radius-sm);
}

.react-colorful__interactive {
  border-radius: inherit;
  inset: 0;
  outline: none;
  position: absolute;
  touch-action: none;
}

.react-colorful__pointer {
  background: var(--dsw-alias-bg-layer-1);
  border: var(--dsw-focus-ring-width) solid var(--dsw-alias-border-inverted);
  border-radius: 50%;
  corner-shape: round;
  box-shadow: var(--dsw-elevation-panel);
  box-sizing: border-box;
  height: var(--pdsh-action-size);
  position: absolute;
  transform: translate(-50%, -50%);
  width: var(--pdsh-action-size);
  z-index: 1;
}

.react-colorful__interactive:focus .react-colorful__pointer {
  transform: translate(-50%, -50%) scale(1.1);
}

.react-colorful__pointer-fill {
  border-radius: inherit;
  inset: 0;
  pointer-events: none;
  position: absolute;
}

.react-colorful__saturation-pointer {
  z-index: 3;
}

.react-colorful__hue-pointer {
  z-index: 2;
}

.pdsh-capture-color-hex {
  background: var(--dsw-alias-bg-layer-1);
  border: var(--pdsh-outline-width) solid var(--dsw-alias-border-l4);
  border-radius: var(--pdsh-capture-radius-md);
  box-sizing: border-box;
  color: var(--pdsh-capture-text);
  font: var(--dsw-font-s-14);
  font-family: var(--ds-font-family-code);
  height: var(--pdsh-control-size);
  outline: none;
  padding: calc(var(--pdsh-capture-space) * 1) calc(var(--pdsh-capture-space) * 3);
  width: 100%;
}

.pdsh-capture-color-hex:focus-visible {
  border-color: var(--pdsh-capture-focus);
}
`;var K=require("react/jsx-runtime"),me=Symbol.for("@daftai/pdsh.component-resources.v1"),da=["slots","locale","configForms","remote","remote.pluginManager"],xt=da;function oe(e){let t;for(let r of e)try{r()}catch(a){t??=a}if(t)throw t}function ua(e){let t=new Map,r=new Set,a=!1,o=[],n=null,i=null,l=[],d=e.createElement("style");d.dataset.plugin=le,d.textContent=`${bt}
${yt}
${wt}
${Ct}
${kt}`,e.head.append(d);let b=e.createElement("div");b.setAttribute("aria-hidden","true"),b.setAttribute("inert",""),b.setAttribute("data-pdsh-probe",""),e.body.append(b);let u=(0,Et.createRoot)(b);u.render((0,K.jsx)(et,{doc:e}));let p=ot(e),w=new Proxy({},{get:(s,m)=>(...h)=>{let P=t.values().next().value;if(!P)throw new Error("PDSH bundle inactive");return P.ctx.remote.pluginManager[m](...h)}}),v=ht(w,mt,"0.3.0-rc.10"),y={subscribe(s){return r.add(s),()=>r.delete(s)},getSnapshot:()=>o,structureChanged(){k(),y.refresh()},refresh(){n?.refresh(),o=[...t.values()];for(let s of r)s()},releaseUnused(){t.size||a||(a=!0,oe([()=>v.dispose(),p,()=>u.unmount(),()=>b.remove(),()=>d.remove(),()=>r.clear()]),e[me]===y&&delete e[me])},join(s){if(t.has(s.kind))throw new Error("PDSH duplicate component owner");t.set(s.kind,s);try{c(),k(),y.refresh()}catch(m){t.delete(s.kind);try{c(),k(),y.refresh()}finally{y.releaseUnused()}throw m}return()=>{if(t.get(s.kind)===s){t.delete(s.kind);try{c(),k(),y.refresh()}finally{y.releaseUnused()}}}}};function k(){n?.dispose(),n=null;let s=t.get("titles"),m=t.get("capture");!s&&!m?.capture||(n=nt(e,{icon:s?ft:null,state:s?.title.state,label:()=>s?`${s.t(s.title.state().pressed?"entryOn":"entry")}${s.title.state().failed?` \xB7 ${s.t("toggleFailed")}`:""}`:"",onActivate:()=>void s?.title.activate(),capture:m?.capture?{icon:vt,label:()=>m.t("capture"),state:m.capture.state,onActivate:m.capture.activate}:null}))}function E({view:s}){let m=(0,St.useSyncExternalStore)(y.subscribe,y.getSnapshot);return s==="summary"?m[0]?.t("description")??"":(0,K.jsxs)(K.Fragment,{children:[m.find(h=>h.kind==="titles")&&m.find(h=>h.kind==="titles").render(s),m.find(h=>h.kind==="identity")&&m.find(h=>h.kind==="identity").render(s),m.find(h=>h.kind==="capture")&&m.find(h=>h.kind==="capture").render(s)]})}function c(){let s=[...t.values()];if(i!==s[0]?.ctx){oe(l.splice(0).reverse()),i=null;for(let m of s){let h=m.ctx,P=Se[m.kind].locale;try{l.push(h.slots.inject("plugins.bundle.config",()=>h.slots.register({name:"plugins.bundle.config",key:le,locale:P},E))),l.push(h.slots.inject("plugins.detail.badge",()=>h.slots.register({name:"plugins.detail.badge",id:"pdsh-update",locale:P,inject:()=>({updater:v,version:"0.3.0-rc.10"})},gt))),i=h;return}catch(L){if(oe(l.splice(0).reverse()),L?.code!=="INACTIVE_EFFECT")throw L}}}}return y}function Pt(e,t=document){let r="identity",a=Se[r],o=e.configForms.get(a.id);e.effect(()=>e.locale.register(a.locale,ze),`pdsh: ${r} dictionaries`),e.effect(()=>e.configForms.whileServed([a.id],()=>{let n=t[me]??(t[me]=ua(t)),i={kind:r,ctx:e,form:o,t:e.locale.bind(a.locale)},l=[],d;try{{i.presentation=at(t),l.push(()=>i.presentation.dispose());let u=()=>{let p=o.getSnapshot();try{i.presentation.update(J(p.status==="ready"?p.value:{maskIdentity:!1}))}catch{i.presentation.update(J({maskIdentity:!1})),e.logger.warn("PDSH identity configuration rejected.")}};u(),l.push(o.subscribe(u)),i.render=p=>(0,K.jsx)(st,{view:p,preferencesForm:o,presentation:i.presentation,t:i.t,showTitles:!1})}d=n.join(i),l.push(e.locale.subscribe(n.refresh));let b=({view:u})=>i.render(u);l.push(e.slots.inject("plugins.row.config",()=>e.slots.register({name:"plugins.row.config",key:`${le}#${a.id}`,locale:a.locale},b)))}catch(b){try{oe(l.reverse())}finally{d?.(),n.releaseUnused()}throw b}return()=>{try{oe(l.reverse())}finally{d?.(),n.releaseUnused()}}}),`pdsh: ${r} lifetime`)}function pa(e){Pt(e)}
return module.exports;}});
//# sourceMappingURL=client.js.map
