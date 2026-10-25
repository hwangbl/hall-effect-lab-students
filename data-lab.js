/* Browser-local Hall experiment analysis. No measurements leave the browser. */
const STORE = 'hall-lab-data-v5';
const MU0 = 4 * Math.PI * 1e-7;
const DEFAULT_PARAMS = { N: 3445, L: 150.2, R: 9.75, IM: 0.2, IS: 5, KH: 171, origin:'left', rulerOffset:50, zeros:[0,0,0,0] };
const DEFAULT_STYLE = { symbol: 'cross', size: 6, theory: true, fit: false, grid: true };
const CONFIG = {
  axial: { title: '螺线管轴线上的磁场强度分布图', short: '轴向磁场分布', coordinate: 'x', unit: 'mm', filename: '螺线管轴向磁场分布', digits: 1 },
  current: { title: '螺线管中点磁场强度随励磁电流的变化关系图', short: '磁场与励磁电流', coordinate: 'I', unit: 'A', filename: '中点磁场与励磁电流', digits: 4 }
};
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const finite = value => value !== '' && value !== null && value !== undefined && Number.isFinite(Number(value));
const num = value => finite(value) ? Number(value) : null;
const fmt = (value, digits=4) => value === null || !Number.isFinite(value) ? '—' : Number(value).toFixed(digits);

/** x in mm; geometry in mm; output in mT. N is total number of turns. */
export function solenoidField(x, current, params = DEFAULT_PARAMS) {
  const l = Number(params.L) / 1000, r = Number(params.R) / 1000, z = Number(x) / 1000;
  if (!(l > 0 && r > 0 && Number(params.N) > 0 && Number.isFinite(Number(current)))) return NaN;
  const a = z + l / 2, b = z - l / 2;
  return 1000 * MU0 * (Number(params.N) / l) * Number(current) / 2 * (a / Math.sqrt(r*r+a*a) - b / Math.sqrt(r*r+b*b));
}

function fieldAtCoordinate(x,current,params) {
  return solenoidField(params.origin==='center'?x:x-params.L/2,current,params);
}

/** U1(++), U2(-+), U3(--), U4(+-) with sign order (I_H,I_M). */
export function processHallVoltages(voltages, params = DEFAULT_PARAMS) {
  if (voltages.length !== 4 || !voltages.every(finite) || !(params.KH > 0 && params.IS > 0)) return null;
  const values=voltages.map((v,i)=>Number(v)-Number(params.zeros?.[i]??0));
  const u = (values[0] - values[1] + values[2] - values[3]) / 4;
  return { u, b: 1000*u/(Number(params.KH)*Number(params.IS)) };
}

export function linearRegression(points) {
  if (points.length < 2) return null;
  const count = points.length, mx = points.reduce((s,p)=>s+p.x,0)/count, my = points.reduce((s,p)=>s+p.b,0)/count;
  const sxx = points.reduce((s,p)=>s+(p.x-mx)**2,0);
  if (sxx < 1e-20) return null;
  const slope = points.reduce((s,p)=>s+(p.x-mx)*(p.b-my),0)/sxx, intercept = my-slope*mx;
  const sst = points.reduce((s,p)=>s+(p.b-my)**2,0), sse = points.reduce((s,p)=>s+(p.b-slope*p.x-intercept)**2,0);
  return { slope, intercept, r2: sst < 1e-20 ? null : 1-sse/sst, count };
}

function exampleRows(kind, p) {
  const xs = kind === 'axial' ? (p.origin==='center'?[-200,-160,-120,-100,-80,-60,-40,-20,0,20,40,60,80,100,120,160,200]:[-30,-20,-12,-7,-3,0,3,7,12,20,40,75]) : Array.from({length:12},(_,i)=>Number((i*.02).toFixed(4)));
  return xs.map((x,i) => {
    const ideal = kind==='axial'?fieldAtCoordinate(x,p.IM,p):solenoidField(0,x,p);
    const b = ideal*(1 + .007*Math.sin(i*1.8)) + (kind === 'current' && i === 0 ? .008 : .004*Math.cos(i));
    const u = b*p.KH*p.IS/1000, evenOffset = .012, currentOffset = .006;
    return { x, b: Number(b.toFixed(4)), v: [u+evenOffset+currentOffset,-u+evenOffset-currentOffset,u+evenOffset-currentOffset,-u+evenOffset+currentOffset].map((v,i)=>Number((v+Number(p.zeros?.[i]??0)).toFixed(5))) };
  });
}

function initialState() {
  return { params: {...DEFAULT_PARAMS,zeros:[0,0,0,0]}, active: 'axial', sets: Object.fromEntries(Object.keys(CONFIG).map(k=>[k,{ rows:exampleRows(k,DEFAULT_PARAMS), mode:'direct', source:'示例数据', style:{...DEFAULT_STYLE} }])) };
}

function loadState() {
  const fallback = initialState();
  try {
    const s = JSON.parse(localStorage.getItem(STORE));
    if (!s || !s.params || !s.sets) return fallback;
    for (const key of Object.keys(DEFAULT_PARAMS)) if (finite(s.params[key])) fallback.params[key] = Number(s.params[key]);
    if(s.params.origin==='center')fallback.params.origin='center';
    if(Array.isArray(s.params.zeros)&&s.params.zeros.length===4&&s.params.zeros.every(finite))fallback.params.zeros=s.params.zeros.map(Number);
    for (const k of Object.keys(CONFIG)) if (s.sets[k] && Array.isArray(s.sets[k].rows) && s.sets[k].rows.length <= 10000) {
      fallback.sets[k] = { ...fallback.sets[k], ...s.sets[k], style:{...DEFAULT_STYLE,...s.sets[k].style}, rows:s.sets[k].rows.map(r=>({x:finite(r.x)?Number(r.x):'', b:finite(r.b)?Number(r.b):'', v:Array.isArray(r.v)?Array.from({length:4},(_,i)=>finite(r.v[i])?Number(r.v[i]):''):['','','','']})) };
    }
    if (CONFIG[s.active]) fallback.active=s.active;
    return fallback;
  } catch { return fallback; }
}

function getPoints(set, params) {
  return set.rows.flatMap((r,index)=> {
    const x = num(r.x), result = set.mode === 'four' ? processHallVoltages(r.v,params) : null, b = set.mode === 'four' ? result?.b : num(r.b);
    return x !== null && b !== null && b !== undefined && Number.isFinite(b) ? [{x,b,index,u:result?.u ?? null}] : [];
  });
}

function niceStep(range, target=6) {
  const rough = Math.max(range / target, 1e-12), power = 10**Math.floor(Math.log10(rough)), fraction = rough/power;
  return (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10)*power;
}
function ticks(min,max,target=6) {
  const step=niceStep(max-min,target), output=[];
  for(let v=Math.ceil(min/step)*step; v<=max+step*1e-7 && output.length<50;v+=step) output.push(Math.abs(v)<step*1e-7?0:v);
  return { values:output, step };
}
function tickLabel(v,step) {
  const digits = Math.max(0,-Math.floor(Math.log10(step)));
  if (Math.abs(v)>=1e5 || (v!==0 && Math.abs(v)<1e-4)) return v.toExponential(1);
  return Number(v.toFixed(Math.min(digits+1,8))).toString();
}
function symbolSvg(symbol,x,y,size,color='#2155b6') {
  const s=size, common=`stroke="${color}" stroke-width="1.9" fill="white"`;
  if (symbol==='circle') return `<circle cx="${x}" cy="${y}" r="${s*.72}" ${common}/>`;
  if (symbol==='square') return `<rect x="${x-s*.65}" y="${y-s*.65}" width="${s*1.3}" height="${s*1.3}" ${common}/>`;
  if (symbol==='triangle') return `<path d="M${x},${y-s*.9} L${x+s*.85},${y+s*.65} L${x-s*.85},${y+s*.65} Z" ${common}/>`;
  if (symbol==='diamond') return `<path d="M${x},${y-s} L${x+s*.7},${y} L${x},${y+s} L${x-s*.7},${y} Z" ${common}/>`;
  if (symbol==='plus') return `<path d="M${x-s},${y}H${x+s} M${x},${y-s}V${y+s}" fill="none" stroke="${color}" stroke-width="1.9"/>`;
  return `<path d="M${x-s*.75},${y-s*.75}L${x+s*.75},${y+s*.75} M${x-s*.75},${y+s*.75}L${x+s*.75},${y-s*.75}" fill="none" stroke="${color}" stroke-width="1.9"/>`;
}

/** Pure SVG export includes all labels; no web-font or external raster dependencies. */
export function chartSvg(kind,set,params,options={}) {
  const width=1000,height=660,left=100,right=44,top=92,bottom=96,pw=width-left-right,ph=height-top-bottom;
  const points=getPoints(set,params), style={...DEFAULT_STYLE,...set.style}, conf=CONFIG[kind];
  const paramsOK=params.L>0 && params.R>0 && params.N>0 && params.KH>0 && params.IS>0 && Number.isFinite(Number(params.IM));
  let xmin,xmax;
  if(kind==='axial') { xmin=points.length?Math.min(...points.map(p=>p.x)):(params.origin==='center'?-200:-30); xmax=points.length?Math.max(...points.map(p=>p.x)):(params.origin==='center'?200:75); }
  else { xmin=Math.min(0,...points.map(p=>p.x));xmax=Math.max(.22,...points.map(p=>p.x)); }
  if(xmin===xmax){xmin-=kind==='axial'?10:.01;xmax+=kind==='axial'?10:.01;}
  const xpad=(xmax-xmin)*.04; xmin-=xpad;xmax+=xpad;
  const theory=Array.from({length:401},(_,i)=>{const x=xmin+(xmax-xmin)*i/400;return{x,b:kind==='axial'?fieldAtCoordinate(x,params.IM,params):solenoidField(0,x,params)};}).filter(p=>Number.isFinite(p.b));
  const fit=kind==='current'&&style.fit?linearRegression(points):null;
  const yvals=points.map(p=>p.b).concat(style.theory&&paramsOK?theory.map(p=>p.b):[]);
  if(fit)yvals.push(fit.slope*xmin+fit.intercept,fit.slope*xmax+fit.intercept);
  let ymin=Math.min(0,...yvals),ymax=Math.max(.1,...yvals),ypad=(ymax-ymin)*.13;
  if(ymin<0)ymin-=ypad*.35; ymax+=ypad;
  const yt=ticks(ymin,ymax,7),xt=ticks(xmin,xmax,7),px=x=>left+(x-xmin)/(xmax-xmin)*pw,py=y=>top+ph-(y-ymin)/(ymax-ymin)*ph;
  const path=arr=>arr.map((p,i)=>`${i?'L':'M'}${px(p.x).toFixed(2)},${py(p.b).toFixed(2)}`).join(' ');
  let body=`<rect width="1000" height="660" fill="white"/><text x="500" y="38" text-anchor="middle" font-size="24" font-weight="600" fill="#10405c">${esc(conf.title)}</text><text x="500" y="65" text-anchor="middle" font-size="15" fill="#65716d">${esc(set.source)}${kind==='axial'?` · 励磁电流 ${fmt(params.IM,4)} A · ${params.origin==='center'?'中点':'左端口'}为原点`:''}</text><defs><clipPath id="plot-area"><rect x="${left}" y="${top}" width="${pw}" height="${ph}"/></clipPath></defs>`;
  if(style.grid) {
    for(const t of xt.values)body+=`<line x1="${px(t)}" x2="${px(t)}" y1="${top}" y2="${top+ph}" stroke="#cdd3cf" stroke-width="1" stroke-dasharray="2 5"/>`;
    for(const t of yt.values)body+=`<line y1="${py(t)}" y2="${py(t)}" x1="${left}" x2="${left+pw}" stroke="#cdd3cf" stroke-width="1" stroke-dasharray="2 5"/>`;
  }
  body+=`<rect x="${left}" y="${top}" width="${pw}" height="${ph}" fill="none" stroke="#545f5a" stroke-width="1.2"/>`;
  for(const t of xt.values){const x=px(t);body+=`<path d="M${x},${top}v7 M${x},${top+ph}v-7" stroke="#545f5a"/><text x="${x}" y="${top+ph+29}" text-anchor="middle" font-size="18" fill="#38443e">${tickLabel(t,xt.step)}</text>`;}
  for(const t of yt.values){const y=py(t);body+=`<path d="M${left},${y}h7 M${left+pw},${y}h-7" stroke="#545f5a"/><text x="${left-16}" y="${y+6}" text-anchor="end" font-size="18" fill="#38443e">${tickLabel(t,yt.step)}</text>`;}
  const xMinor=xt.step/5,yMinor=yt.step/5;
  for(let t=Math.ceil(xmin/xMinor)*xMinor;t<xmax;t+=xMinor){const x=px(t);body+=`<path d="M${x},${top}v3 M${x},${top+ph}v-3" stroke="#68736d" stroke-width=".7"/>`;}
  for(let t=Math.ceil(ymin/yMinor)*yMinor;t<ymax;t+=yMinor){const y=py(t);body+=`<path d="M${left},${y}h3 M${left+pw},${y}h-3" stroke="#68736d" stroke-width=".7"/>`;}
  body+=`<g clip-path="url(#plot-area)">`;
  if(style.theory&&paramsOK)body+=`<path d="${path(theory)}" fill="none" stroke="#d12e2e" stroke-width="2.7"/>`;
  if(fit)body+=`<path d="M${px(xmin)},${py(fit.slope*xmin+fit.intercept)}L${px(xmax)},${py(fit.slope*xmax+fit.intercept)}" fill="none" stroke="#9b6e14" stroke-width="2.4" stroke-dasharray="9 5"/>`;
  for(const p of points)body+=symbolSvg(style.symbol,px(p.x),py(p.b),Number(style.size));
  body+='</g>';
  body+=`<text x="${left+pw/2}" y="${height-30}" text-anchor="middle" font-size="23" fill="#263f50" font-family="Times New Roman,serif"><tspan font-style="italic">${conf.coordinate}</tspan>${kind==='current'?'<tspan font-style="normal" baseline-shift="sub" font-size="16">M</tspan>':''}<tspan font-style="normal"> / ${conf.unit}</tspan></text><text transform="translate(31,${top+ph/2}) rotate(-90)" text-anchor="middle" font-size="23" fill="#263f50" font-family="Times New Roman,serif"><tspan font-style="italic">B</tspan><tspan font-style="normal"> / mT</tspan></text>`;
  const legx=left+pw-200,legy=top+25,legendItems=1+Number(style.theory&&paramsOK)+Number(!!fit);
  body+=`<rect x="${legx-18}" y="${legy-17}" width="206" height="${legendItems*29+14}" rx="3" fill="white" fill-opacity=".92" stroke="#dfe5ea"/>${symbolSvg(style.symbol,legx+7,legy+4,Number(style.size))}<text x="${legx+32}" y="${legy+10}" font-size="18" fill="#263f50">测量数据</text>`;
  let row=1;
  if(style.theory&&paramsOK){const y=legy+row++*29;body+=`<line x1="${legx-4}" x2="${legx+19}" y1="${y+4}" y2="${y+4}" stroke="#d12e2e" stroke-width="2.7"/><text x="${legx+32}" y="${y+10}" font-size="18" fill="#263f50">理论值</text>`;}
  if(fit){const y=legy+row*29;body+=`<line x1="${legx-4}" x2="${legx+19}" y1="${y+4}" y2="${y+4}" stroke="#9b6e14" stroke-width="2.4" stroke-dasharray="7 4"/><text x="${legx+32}" y="${y+10}" font-size="18" fill="#263f50">线性拟合</text>`;}
  if(!points.length)body+=`<text x="${left+pw/2}" y="${top+ph/2}" text-anchor="middle" font-size="21" fill="#6d7872">添加测量数据后显示散点</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(conf.title)}" font-family="Noto Sans SC,PingFang SC,Microsoft YaHei,Arial,sans-serif">${body}</svg>`;
}

const CSS = `
.dl-root{color:#263f50;font-family:inherit;line-height:1.65;--dl-line:#dce3e8;--dl-green:#10405c;--dl-gold:#9f7c31;--dl-muted:#657783}.dl-root *{box-sizing:border-box}.dl-coordinate-settings,.dl-zero-settings{display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:12px 18px;border-bottom:1px solid var(--dl-line);font-size:12px;background:#f6f9fb;color:#627c8d}.dl-coordinate-settings label,.dl-zero-settings label{display:flex;gap:5px;align-items:center}.dl-coordinate-settings input,.dl-zero-settings input{width:76px;border:1px solid var(--dl-line);background:white;padding:4px 6px;color:#24465b}.dl-coordinate-settings select{border:1px solid var(--dl-line);background:white;padding:4px 6px;color:#24465b}.dl-zero-settings strong{font-size:12px;font-weight:500}.dl-zero-settings small{width:100%;font-size:11px}.dl-root button,.dl-root input,.dl-root select,.dl-root textarea{font:inherit}.dl-root button{cursor:pointer;border:1px solid var(--dl-line);background:white;color:var(--dl-green);padding:8px 13px;border-radius:2px;line-height:1.4}.dl-root button:hover{background:#eff5f8;border-color:#91acbd}.dl-root button:focus-visible,.dl-root input:focus-visible,.dl-root select:focus-visible,.dl-root textarea:focus-visible{outline:2px solid #b78f35;outline-offset:2px}.dl-root .dl-primary{color:white;background:var(--dl-green);border-color:var(--dl-green)}.dl-root .dl-primary:hover{background:#246891}.dl-root .dl-danger{color:#9d3b31}.dl-root .dl-small{font-size:12px;padding:5px 9px}.dl-header{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;margin-bottom:20px}.dl-header h2{font-size:27px;font-weight:600;line-height:1.3;margin:0 0 8px}.dl-header p{margin:0;color:var(--dl-muted);font-size:14px}.dl-save{font-size:11px;white-space:nowrap;color:var(--dl-muted);padding-top:8px}.dl-tabs{display:flex;border-bottom:1px solid var(--dl-line);gap:0;margin:20px 0}.dl-tabs button{border:0;border-bottom:3px solid transparent;background:transparent;padding:12px 23px;font-weight:600}.dl-tabs button[aria-selected=true]{border-bottom-color:var(--dl-green);color:var(--dl-green);background:#eef4f7}.dl-formula{border-left:3px solid #b68d3b;background:#f3f5f7;display:flex;align-items:center;gap:22px;flex-wrap:wrap;padding:14px 18px;margin-bottom:20px;font-size:14px}.dl-math{font-family:"Times New Roman","STIX Two Math",serif;font-size:19px;white-space:nowrap}.dl-math i{font-style:italic}.dl-formula small{font-size:12px;color:var(--dl-muted)}.dl-chart-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}.dl-chart-card{border:1px solid var(--dl-line);background:white;min-width:0}.dl-chart-card.dl-active-chart{border-top:3px solid var(--dl-green)}.dl-chart-bar{display:flex;justify-content:space-between;align-items:center;padding:14px 16px;gap:10px;flex-wrap:wrap;border-bottom:1px solid #eef0ea}.dl-chart-bar h3{font-size:14px;margin:0;font-weight:600}.dl-chart-bar>div{display:flex;gap:6px}.dl-chart-body{padding:8px 8px 0}.dl-chart-body svg{display:block;width:100%;height:auto}.dl-chart-controls{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:10px 15px 14px;font-size:12px;color:var(--dl-muted)}.dl-chart-controls label{display:flex;align-items:center;gap:5px}.dl-chart-controls select{max-width:100px;padding:3px;border:1px solid var(--dl-line);background:white}.dl-chart-controls input[type=range]{width:74px;accent-color:var(--dl-green)}.dl-chart-controls input[type=checkbox]{accent-color:var(--dl-green)}.dl-fit{padding:0 16px 12px;font-size:12px;color:#7d5b15;min-height:28px}.dl-fit:empty{display:none}.dl-panel{border:1px solid var(--dl-line);background:white;margin-top:20px}.dl-panel-head{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;padding:15px 18px;border-bottom:1px solid var(--dl-line)}.dl-panel-head h3{margin:0;font-size:16px}.dl-badge{display:inline-block;font-size:11px;background:#f0eadb;color:#806323;padding:2px 8px;margin-left:8px;font-weight:400}.dl-badge.dl-measured{background:#e9f2f8;color:#246891}.dl-mode{display:flex;gap:6px}.dl-mode button[aria-pressed=true]{background:var(--dl-green);border-color:var(--dl-green);color:white}.dl-tools{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:12px 18px;background:#f8fafb;border-bottom:1px solid var(--dl-line)}.dl-tools .dl-spacer{flex:1}.dl-tools small{color:var(--dl-muted);font-size:12px}.dl-table-wrap{overflow:auto;max-height:430px}.dl-table{border-collapse:collapse;min-width:100%;font-size:13px;font-variant-numeric:tabular-nums}.dl-table th{position:sticky;top:0;z-index:1;background:#f0f3f5;color:#526c7c;font-weight:500;text-align:center;white-space:nowrap;padding:10px 9px;border-bottom:1px solid var(--dl-line)}.dl-table td{border-bottom:1px solid #edf0e9;padding:5px 8px;text-align:center}.dl-table td:first-child{color:#7b887f;width:45px}.dl-table input{border:1px solid transparent;background:transparent;text-align:center;border-radius:0;width:100%;min-width:80px;max-width:145px;padding:5px;color:#24465b;font-variant-numeric:tabular-nums}.dl-table input:hover,.dl-table input:focus{background:#eff6fa;border-color:#acc3d2}.dl-table tr:nth-child(even){background:#fbfcfd}.dl-table .dl-result{color:#9a7424;font-size:12px}.dl-table .dl-delete{padding:2px 7px;border:0;color:#839080;background:none;font-size:18px}.dl-table .dl-delete:hover{color:#b13e37;background:#f9eeee}.dl-table-empty{text-align:center;color:#7a897e;padding:32px!important}.dl-table-note{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;padding:10px 18px;font-size:12px;color:var(--dl-muted);border-top:1px solid var(--dl-line)}.dl-four-note{padding:12px 18px;font-size:12px;color:#68786c;background:#f8fafb;line-height:1.8}.dl-settings{display:grid;grid-template-columns:1.3fr 1fr;gap:20px;margin-top:20px}.dl-settings details{border:1px solid var(--dl-line);background:#fbfcfd;min-width:0}.dl-settings summary{padding:14px 17px;cursor:pointer;font-size:14px;font-weight:600}.dl-settings-body{padding:0 17px 17px}.dl-param-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.dl-field{display:flex;flex-direction:column;gap:5px;font-size:12px;color:var(--dl-muted)}.dl-field>span{white-space:nowrap}.dl-field input{width:100%;min-width:0;padding:7px 9px;background:white;border:1px solid var(--dl-line);color:#26475d;font-variant-numeric:tabular-nums}.dl-param-note{font-size:11px;color:#79867b;line-height:1.7;margin:13px 0 0}.dl-import-text{width:100%;min-height:110px;resize:vertical;border:1px solid var(--dl-line);background:white;padding:9px;font-family:ui-monospace,SFMono-Regular,monospace;font-size:12px;line-height:1.6}.dl-import-actions{display:flex;gap:8px;align-items:center;margin-top:10px;flex-wrap:wrap}.dl-import-actions label{display:inline-block;cursor:pointer}.dl-import-help{font-size:11px;color:#79867b;margin:10px 0 0}.dl-message{padding:12px 16px;background:#eaf3f8;border-left:3px solid #246891;font-size:13px;margin:12px 0;display:none}.dl-message.dl-error{background:#fcf0e8;border-color:#bc6944;color:#8c402d}.dl-checklist{margin-top:18px;padding:14px 17px;border:1px solid var(--dl-line);font-size:12px;color:#6b7c70}.dl-checklist strong{color:#3e5c6e}.dl-warning{color:#9d4f32}.dl-field-unit{font-family:"Times New Roman",serif;font-size:14px}.dl-root .dl-checklist code{background:#eef2e9;padding:2px 4px;font:inherit;color:#456047}@media(min-width:1500px){.dl-chart-body{padding:8px 15px 0}}@media(max-width:1050px){.dl-chart-grid{grid-template-columns:1fr}.dl-chart-body{max-width:820px;margin:auto}.dl-settings{grid-template-columns:1fr 1fr}.dl-param-grid{grid-template-columns:repeat(2,1fr)}}@media(max-width:680px){.dl-header{display:block}.dl-header h2{font-size:23px}.dl-save{padding-top:6px}.dl-chart-grid,.dl-settings{grid-template-columns:1fr}.dl-tabs button{padding:10px 12px;font-size:13px}.dl-chart-controls{gap:10px}.dl-panel-head{padding:12px}.dl-tools{padding:10px 12px}.dl-formula{gap:10px;padding:12px}.dl-math{font-size:17px}.dl-param-grid{grid-template-columns:repeat(2,1fr)}.dl-checklist{font-size:11px}.dl-mode button{font-size:11px;padding:6px 8px}}
`;

function downloadBlob(blob, name) {
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.style.display='none';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
}

/**
 * Mount: const lab = mountDataLab(element, { getSimulationRows: () => ({ axial:[{x,b}], current:[{x,b}] }) });
 * Returns { importRows(kind, rows, source='仿真数据'), getRows(kind), refresh(), destroy() }.
 * All quantities: x[mm] or I_M[A], b[mT], v[4][mV].
 */
export function mountDataLab(container, shared = {}) {
  let state=loadState(),messageTimer=null,disposed=false;
  const root=document.createElement('section');root.className='dl-root';container.replaceChildren(root);
  const save=()=>{try{localStorage.setItem(STORE,JSON.stringify(state));const e=root.querySelector('.dl-save');if(e)e.textContent='● 已保存在此浏览器';}catch{const e=root.querySelector('.dl-save');if(e)e.textContent='当前浏览器无法自动保存';}};
  const message=(text,error=false)=>{const e=root.querySelector('.dl-message');if(!e)return;e.textContent=text;e.className=`dl-message${error?' dl-error':''}`;e.style.display='block';clearTimeout(messageTimer);messageTimer=setTimeout(()=>{if(!disposed)e.style.display='none';},9000);};
  const persist=()=>{save();drawCharts();updateSummary();};
  function chartCard(kind) {
    const s=state.sets[kind],c=CONFIG[kind];
    return `<article class="dl-chart-card ${state.active===kind?'dl-active-chart':''}" data-chart="${kind}"><div class="dl-chart-bar"><h3>${kind==='axial'?'01':'02'} · ${c.short}</h3><div><button class="dl-small" data-action="export-svg" data-kind="${kind}">SVG</button><button class="dl-small" data-action="export-png" data-kind="${kind}">PNG · 3×</button></div></div><div class="dl-chart-body" data-plot="${kind}"></div><div class="dl-chart-controls"><label>散点 <select data-style="symbol" data-kind="${kind}">${[['cross','× 叉号'],['plus','＋ 加号'],['circle','○ 圆形'],['square','□ 方形'],['triangle','△ 三角'],['diamond','◇ 菱形']].map(([v,t])=>`<option value="${v}" ${s.style.symbol===v?'selected':''}>${t}</option>`).join('')}</select></label><label>大小 <input type="range" aria-label="${c.short}散点大小" min="3" max="12" step="1" value="${s.style.size}" data-style="size" data-kind="${kind}"><output data-size-output="${kind}">${s.style.size}</output></label><label><input type="checkbox" data-style="theory" data-kind="${kind}" ${s.style.theory?'checked':''}>理论线</label><label><input type="checkbox" data-style="grid" data-kind="${kind}" ${s.style.grid?'checked':''}>网格</label>${kind==='current'?`<label><input type="checkbox" data-style="fit" data-kind="${kind}" ${s.style.fit?'checked':''}>线性拟合</label>`:''}</div><div class="dl-fit" data-fit="${kind}"></div></article>`;
  }
  function render() {
    root.innerHTML=`<style>${CSS}</style><div class="dl-header"><div><h2>让测量数据，成为清晰的物理图像</h2><p>录入实验读数，对称法消除附加电势；比较理论模型，自定义散点并导出报告用图。</p></div><span class="dl-save">● 已保存在此浏览器</span></div><div class="dl-formula"><span class="dl-math"><i>U</i><sub>i</sub> = <i>V</i><sub>i</sub> − <i>V</i><sub>0i</sub></span><span class="dl-math"><i>U</i><sub>H</sub> = (<i>U</i><sub>1</sub> − <i>U</i><sub>2</sub> + <i>U</i><sub>3</sub> − <i>U</i><sub>4</sub>) / 4</span><span class="dl-math"><i>B</i> / mT = 1000 <i>U</i><sub>H</sub> / (<i>K</i><sub>H</sub> <i>I</i><sub>H</sub>)</span><small>先减同方向零差，再对称平均。<i>U</i>、<i>V</i> / mV；<i>I</i><sub>H</sub> / mA；<i>K</i><sub>H</sub> / [mV·mA<sup>−1</sup>·T<sup>−1</sup>]；输出 <i>B</i> / mT。</small></div><div class="dl-chart-grid">${chartCard('axial')}${chartCard('current')}</div><div class="dl-message" role="status" aria-live="polite"></div><div class="dl-tabs" role="tablist" aria-label="选择数据表">${Object.keys(CONFIG).map(k=>`<button role="tab" aria-selected="${state.active===k}" data-action="tab" data-kind="${k}">${k==='axial'?'B–x 轴向分布':'B–I 励磁电流'}</button>`).join('')}</div><div data-table-host></div><div class="dl-settings"><details open><summary>理论模型与仪器参数</summary><div class="dl-settings-body"><div class="dl-param-grid">${[
      ['N','总匝数 <i>N</i>','匝',1,100000,1],['L','螺线管长度 <i>L</i>','mm',.01,10000,.1],['R','平均半径 <i>R</i>','mm',.01,10000,.01],['IM','轴向分布的 <i>I</i><sub>M</sub>','A',0,.25,.0001],['IS','工作电流 <i>I</i><sub>H</sub>','mA',.0001,20,.001],['KH','霍尔灵敏度 <i>K</i><sub>H</sub>','mV/(mA·T)',.0001,10000,.1]
    ].map(([key,label,unit,min,max,step])=>`<label class="dl-field"><span>${label} <span class="dl-field-unit">/ ${unit}</span></span><input type="number" data-param="${key}" value="${state.params[key]}" min="${min}" max="${max}" step="${step}"></label>`).join('')}</div><p class="dl-param-note"><i>N</i> = 3445 匝、<i>L</i> = 150.2 mm、<i>D</i> = 19.5 mm 来自课件实物铭牌；<i>K</i><sub>H</sub> = 171 mV/(mA·T) 为课件示例，实测按探头标定。半径输入平均半径。改变参数不会改写已录入的原始读数。<br>理论模型采用有限长薄壁螺线管。默认左端口为坐标原点，模型内部使用 <i>z</i> = <i>x</i> − <i>L</i>/2 换算到中心坐标；红色理论线由参数独立计算。<span data-density></span></p><div style="overflow-x:auto;margin-top:12px"><math xmlns="http://www.w3.org/1998/Math/MathML" display="block" style="font-size:16px"><mi>B</mi><mo>(</mo><mi>z</mi><mo>)</mo><mo>=</mo><mfrac><mrow><msub><mi>μ</mi><mn>0</mn></msub><mi>n</mi><msub><mi>I</mi><mi mathvariant="normal">M</mi></msub></mrow><mn>2</mn></mfrac><mo>[</mo><mfrac><mrow><mi>z</mi><mo>+</mo><mi>L</mi><mo>/</mo><mn>2</mn></mrow><msqrt><mrow><msup><mi>R</mi><mn>2</mn></msup><mo>+</mo><msup><mrow><mo>(</mo><mi>z</mi><mo>+</mo><mi>L</mi><mo>/</mo><mn>2</mn><mo>)</mo></mrow><mn>2</mn></msup></mrow></msqrt></mfrac><mo>−</mo><mfrac><mrow><mi>z</mi><mo>−</mo><mi>L</mi><mo>/</mo><mn>2</mn></mrow><msqrt><mrow><msup><mi>R</mi><mn>2</mn></msup><mo>+</mo><msup><mrow><mo>(</mo><mi>z</mi><mo>−</mo><mi>L</mi><mo>/</mo><mn>2</mn><mo>)</mo></mrow><mn>2</mn></msup></mrow></msqrt></mfrac><mo>]</mo></math></div></div></details><details open><summary>批量录入与文件导入</summary><div class="dl-settings-body"><textarea class="dl-import-text" aria-label="粘贴实验数据" placeholder="直接磁场：x(mm),B(mT) 或 I_M(A),B(mT)&#10;四电压：坐标,V1(mV),V2(mV),V3(mV),V4(mV)&#10;可直接粘贴 Excel 的两列或五列数据"></textarea><div class="dl-import-actions"><button class="dl-primary dl-small" data-action="paste">替换当前表数据</button><button class="dl-small" data-action="file">导入 CSV / TSV</button><input type="file" data-file accept=".csv,.tsv,.txt" hidden></div><p class="dl-import-help">支持逗号、制表符或空格分列；首行可带表头。2 列为坐标与 B，5 列为坐标与四个原始读数 V。轴向导入坐标为 x，不是标尺读数 r。导入后请核对单位、零差与数据来源。</p></div></details></div><div class="dl-checklist"><strong>作图自查</strong>　① 图名、物理量、单位齐全　② 测量点使用独立 symbol　③ 理论线由仪器参数计算　④ 回归线仅用于分析，不能替代理论线　⑤ 导出图像前核对数据来源与有效位数。<br>数据只保存在当前浏览器。请用“导出数据 CSV”另存原始记录；浏览器清理后本地记录会丢失。</div>`;
    renderTable();drawCharts();updateSummary();
  }
  function renderTable() {
    const kind=state.active,s=state.sets[kind],conf=CONFIG[kind],four=s.mode==='four',axial=kind==='axial';
    const coord=axial?'<i>x</i> / mm':'<i>I</i><sub>M</sub> / A';
    const columns=four?['<i>V</i><sub>1</sub> / mV<br><small>(+, +)</small>','<i>V</i><sub>2</sub> / mV<br><small>(−, +)</small>','<i>V</i><sub>3</sub> / mV<br><small>(−, −)</small>','<i>V</i><sub>4</sub> / mV<br><small>(+, −)</small>','<i>U</i><sub>H</sub> / mV','<i>B</i> / mT']:['<i>B</i> / mT'];
    const coordinateSettings=axial?`<div class="dl-coordinate-settings"><label>坐标原点 <select data-origin aria-label="轴向坐标原点"><option value="left" ${state.params.origin==='left'?'selected':''}>螺线管左端口</option><option value="center" ${state.params.origin==='center'?'selected':''}>螺线管中点</option></select></label><label>标尺零位 <i>r</i><sub>0</sub> / mm <input type="number" data-param="rulerOffset" min="-10000" max="10000" step=".1" value="${state.params.rulerOffset}"></label><span><i>x</i> = <i>r</i> − <i>r</i><sub>0</sub>；两列可任选一列输入</span></div>`:'';
    const zeroSettings=four?`<div class="dl-zero-settings"><strong>四方向零差 / mV</strong>${state.params.zeros.map((v,i)=>`<label><i>V</i><sub>0${i+1}</sub> <input type="number" step="any" data-zero="${i}" aria-label="方向${i+1}零差 毫伏" value="${v}"></label>`).join('')}<small>按 (I_H,I_M)：(++), (−+), (−−), (+−) 的顺序输入同方向零磁场读数；无零差时填 0。</small></div>`:'';
    const rows=s.rows.map((r,index)=>{
      const result=four?processHallVoltages(r.v,state.params):null;
      const labels={x:axial?'位置 mm':'励磁电流 A',r:'标尺读数 mm',b:'磁场 mT',v:`电压 ${index+1} mV`};
      const input=(field,value,vi)=>`<input type="number" step="any" aria-label="第${index+1}行 ${field==='v'?`电压${vi+1} mV`:labels[field]}" data-row="${index}" data-field="${field}" ${vi!==undefined?`data-voltage="${vi}"`:''} value="${value??''}">`;
      const ruler=finite(r.x)?Number((Number(r.x)+Number(state.params.rulerOffset)).toFixed(6)):'';
      return `<tr data-row-display="${index}"><td>${index+1}</td>${axial?`<td>${input('r',ruler)}</td>`:''}<td>${input('x',r.x)}</td>${four?r.v.map((v,i)=>`<td>${input('v',v,i)}</td>`).join('')+`<td class="dl-result" data-result-u="${index}">${fmt(result?.u??null,5)}</td><td class="dl-result" data-result-b="${index}">${fmt(result?.b??null,4)}</td>`:`<td>${input('b',r.b)}</td>`}<td><button class="dl-delete" aria-label="删除第${index+1}行" data-action="delete" data-row="${index}">×</button></td></tr>`;
    }).join('');
    root.querySelector('[data-table-host]').innerHTML=`<div class="dl-panel"><div class="dl-panel-head"><h3>${conf.short} · 数据记录<span class="dl-badge ${s.source==='示例数据'?'':'dl-measured'}" data-source-badge>${esc(s.source)}</span></h3><div class="dl-mode"><button class="dl-small" data-action="mode" data-mode="direct" aria-pressed="${!four}">直接录入 B</button><button class="dl-small" data-action="mode" data-mode="four" aria-pressed="${four}">四电压对称法</button></div></div><div class="dl-tools"><button class="dl-small dl-primary" data-action="add">＋ 添加一行</button><button class="dl-small" data-action="example">载入示例</button><button class="dl-small" data-action="clear">新建空表</button>${typeof shared.getSimulationRows==='function'?'<button class="dl-small" data-action="simulation">读取仿真记录</button>':''}<span class="dl-spacer"></span><button class="dl-small" data-action="csv">导出数据 CSV</button><small data-count></small></div>${coordinateSettings}${zeroSettings}<div class="dl-table-wrap"><table class="dl-table"><thead><tr><th>序号</th>${axial?'<th>标尺读数 <i>r</i> / mm</th>':''}<th>${coord}</th>${columns.map(t=>`<th>${t}</th>`).join('')}<th>操作</th></tr></thead><tbody>${rows||`<tr><td colspan="${(four?9:4)+(axial?1:0)}" class="dl-table-empty">点击“添加一行”，或从右下方批量导入数据。</td></tr>`}</tbody></table></div>${four?'<div class="dl-four-note">表头括号顺序为 (<i>I</i><sub>H</sub>, <i>I</i><sub>M</sub>) 的极性；采集顺序为 (++), (−+), (−−), (+−)。四次测量保持两电流的绝对值一致，记录毫伏表的<strong>带正负号原始读数 V</strong>；系统先按同方向零差求 U，再计算 U<sub>H</sub>。改变方向前遵循仪器操作规范；空白电压不参与计算。</div>':''}<div class="dl-table-note"><span data-table-summary></span><span>负值可用于记录反向磁场；空单元格不按零处理。</span></div></div>`;
  }
  function updateSummary() {
    const s=state.sets[state.active],p=getPoints(s,state.params),n=root.querySelector('[data-count]'),summary=root.querySelector('[data-table-summary]'),density=root.querySelector('[data-density]');
    if(n)n.textContent=`${p.length} / ${s.rows.length} 行有效`;
    if(summary)summary.innerHTML=p.length?`磁场范围 <strong>${fmt(Math.min(...p.map(d=>d.b)),4)} – ${fmt(Math.max(...p.map(d=>d.b)),4)} mT</strong>${state.active==='current'&&p.some(d=>Math.abs(d.x)>.25)?'　<span class="dl-warning">存在超过 0.25 A 的记录，请核对。</span>':''}`:'当前没有可绘制的完整数据。';
    if(density)density.textContent=` 当前匝密度 n = ${fmt(state.params.N/(state.params.L/1000),1)} m⁻¹。`;
    const b=root.querySelector('[data-source-badge]');if(b){b.textContent=s.source;b.classList.toggle('dl-measured',s.source!=='示例数据');}
  }
  function drawCharts() {
    for(const kind of Object.keys(CONFIG)) {
      const slot=root.querySelector(`[data-plot="${kind}"]`);if(!slot)continue;
      const s=state.sets[kind];slot.innerHTML=chartSvg(kind,s,state.params);
      const f=root.querySelector(`[data-fit="${kind}"]`);
      if(kind==='current'&&s.style.fit){const fit=linearRegression(getPoints(s,state.params));f.innerHTML=fit?`线性回归：<i>B</i> = ${fmt(fit.slope,4)} <i>I</i><sub>M</sub> ${fit.intercept<0?'−':'+'} ${fmt(Math.abs(fit.intercept),4)}；斜率 ${fmt(fit.slope,4)} mT/A，<i>R</i><sup>2</sup> = ${fit.r2===null?'未定义（磁场恒定）':fmt(fit.r2,6)}。`:'至少需要两个不同励磁电流的有效数据点才能回归。';}
      else f.textContent='';
    }
  }
  function edited() {
    const set=state.sets[state.active];
    set.source=set.source.startsWith('示例')?'示例数据（已编辑）':set.source.startsWith('仿真')?'仿真数据（已编辑）':set.source.startsWith('导入')?'导入数据（已编辑）':'手动录入数据';
  }
  function updateComputed(index) {const r=state.sets[state.active].rows[index],result=processHallVoltages(r.v,state.params);const u=root.querySelector(`[data-result-u="${index}"]`),b=root.querySelector(`[data-result-b="${index}"]`);if(u)u.textContent=fmt(result?.u??null,5);if(b)b.textContent=fmt(result?.b??null,4);}
  function importText(text) {
    const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/).filter(l=>l.trim());
    if(!lines.length){message('请先粘贴数据或选择文件。',true);return;}
    const parsed=[],warnings=[];let columns=null,metadata=null;
    for(let i=0;i<lines.length;i++) {
      if(lines[i].startsWith('# hall-lab-params=')){try{metadata=JSON.parse(lines[i].slice('# hall-lab-params='.length));}catch{}continue;}
      if(lines[i].trim().startsWith('#'))continue;
      const tokens=lines[i].trim().split(/[\t,;，]+|\s+/).map(t=>t.trim().replace(/^"|"$/g,''));
      if(!finite(tokens[0])){if(parsed.length===0)continue;warnings.push(i+1);continue;}
      if(![2,5,7].includes(tokens.length)){warnings.push(i+1);continue;}
      const rowColumns=tokens.length===7?5:tokens.length,used=tokens.slice(0,rowColumns);
      if(columns===null)columns=rowColumns;
      if(rowColumns!==columns||used.some(v=>!finite(v))){warnings.push(i+1);continue;}
      parsed.push({x:Number(tokens[0]),b:columns===2?Number(tokens[1]):'',v:columns===5?tokens.slice(1,5).map(Number):['','','','']});
    }
    if(!parsed.length){message('未读到完整数据。每行应为 2 列（坐标、B）或 5 列（坐标、U1、U2、U3、U4），并使用数字。',true);return;}
    if(parsed.length>10000){message('单次最多导入 10000 行，请拆分文件。',true);return;}
    const metadataValid=metadata&&['N','L','R','KH','IS','IM','rulerOffset'].every(k=>finite(metadata[k]))&&metadata.N>0&&metadata.L>0&&metadata.R>0&&metadata.KH>0&&metadata.IS>0&&metadata.IM>=0&&metadata.IM<=.25&&['left','center'].includes(metadata.origin)&&Array.isArray(metadata.zeros)&&metadata.zeros.length===4&&metadata.zeros.every(finite);
    if(metadataValid){
      state.params={...state.params,...Object.fromEntries(['N','L','R','KH','IS','IM','rulerOffset'].map(k=>[k,Number(metadata[k])])),origin:metadata.origin,zeros:metadata.zeros.map(Number)};
    }
    const s=state.sets[state.active];s.rows=parsed;s.mode=columns===5?'four':'direct';s.source='导入数据';render();persist();message(`已导入 ${parsed.length} 行${warnings.length?`；忽略 ${warnings.length} 行无效数据（行号 ${warnings.slice(0,8).join('、')}${warnings.length>8?' 等':''}）`:''}${metadataValid?'，已读取文件中的仪器参数与零差':''}。请核对坐标单位与量程。`,warnings.length>0);
  }
  async function exportPNG(kind) {
    try {
      const svg=chartSvg(kind,state.sets[kind],state.params),blob=new Blob([svg],{type:'image/svg+xml;charset=utf-8'}),url=URL.createObjectURL(blob),img=new Image();
      try {await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=url;});const canvas=document.createElement('canvas');canvas.width=3000;canvas.height=1980;const ctx=canvas.getContext('2d');ctx.scale(3,3);ctx.drawImage(img,0,0);const png=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!png)throw Error('编码失败');downloadBlob(png,`${CONFIG[kind].filename}.png`);message('PNG 已导出（3000 × 1980 px，白色背景）。');}finally{URL.revokeObjectURL(url);}
    }catch{message('当前浏览器未能导出 PNG，请使用 SVG 格式导出。',true);}
  }
  function importRows(kind,rows,source='仿真数据') {
    if(!CONFIG[kind]||!Array.isArray(rows))return false;
    const clean=rows.filter(r=>finite(r.x)&&finite(r.b)).map(r=>({x:Number(r.x),b:Number(r.b),v:Array.isArray(r.v)&&r.v.length===4?r.v.map(v=>finite(v)?Number(v):''):['','','','']}));
    if(!clean.length){message('仿真记录中还没有此图所需的数据，请先在实验台采集。',true);return false;}
    state.sets[kind].rows=clean;state.sets[kind].mode='direct';state.sets[kind].source=source;state.active=kind;render();save();return true;
  }
  const onInput=event=>{
    const e=event.target;
    if(e.dataset.style){const kind=e.dataset.kind,s=state.sets[kind];s.style[e.dataset.style]=e.type==='checkbox'?e.checked:e.dataset.style==='size'?Number(e.value):e.value;const output=root.querySelector(`[data-size-output="${kind}"]`);if(output)output.textContent=s.style.size;persist();return;}
    if(e.dataset.field){
      const r=state.sets[state.active].rows[Number(e.dataset.row)];if(!r)return;const value=e.value===''?'':Number(e.value);
      if(e.dataset.field==='v')r.v[Number(e.dataset.voltage)]=value;
      else if(e.dataset.field==='r'){
        r.x=value===''?'':Number((value-state.params.rulerOffset).toFixed(6));
        const xInput=root.querySelector(`input[data-row="${e.dataset.row}"][data-field="x"]`);if(xInput)xInput.value=r.x;
      }else{
        r[e.dataset.field]=value;
        if(e.dataset.field==='x'&&state.active==='axial'){const ruler=root.querySelector(`input[data-row="${e.dataset.row}"][data-field="r"]`);if(ruler)ruler.value=value===''?'':Number((value+state.params.rulerOffset).toFixed(6));}
      }
      edited();updateComputed(Number(e.dataset.row));persist();
    }
  };
  const onChange=async event=>{
    const e=event.target;
    if(e.dataset.zero!==undefined){const value=num(e.value);if(value===null){e.value=state.params.zeros[Number(e.dataset.zero)];message('零差必须是带正负号的数值；没有零差时填 0。',true);return;}state.params.zeros[Number(e.dataset.zero)]=value;for(let i=0;i<state.sets[state.active].rows.length;i++)updateComputed(i);persist();return;}
    if(e.matches('[data-origin]')){
      const oldOrigin=state.params.origin,next=e.value;if(oldOrigin===next)return;
      const shift=(next==='center'?-1:1)*state.params.L/2;
      state.sets.axial.rows.forEach(r=>{if(finite(r.x))r.x=Number((Number(r.x)+shift).toFixed(6));});
      state.params.rulerOffset=Number((state.params.rulerOffset-shift).toFixed(6));state.params.origin=next;
      renderTable();persist();message(`已换算到${next==='center'?'中点':'左端口'}坐标，保留测量点的实际位置与标尺读数。`);return;
    }
    if(e.dataset.param){const value=num(e.value),min=Number(e.min),max=Number(e.max);if(value===null||value<min||value>max){message(`参数超出有效范围（${e.min} – ${e.max}）。请核对仪器标牌。`,true);e.value=state.params[e.dataset.param];return;}
      if(e.dataset.param==='rulerOffset'){const delta=state.params.rulerOffset-value;state.sets.axial.rows.forEach(r=>{if(finite(r.x))r.x=Number((Number(r.x)+delta).toFixed(6));});}
      state.params[e.dataset.param]=value;for(let i=0;i<state.sets[state.active].rows.length;i++)updateComputed(i);if(e.dataset.param==='rulerOffset')renderTable();persist();return;}
    if(e.matches('[data-file]')&&e.files?.[0]){const file=e.files[0];if(file.size>4*1024*1024){message('请导入 4 MB 以下的文本数据文件。',true);e.value='';return;}try{importText(await file.text());}catch{message('无法读取文件，请另存为 UTF-8 CSV 后重试。',true);}e.value='';}
  };
  const onClick=event=>{
    const b=event.target.closest('[data-action]');if(!b||!root.contains(b))return;const s=state.sets[state.active],kind=b.dataset.kind||state.active;
    switch(b.dataset.action){
      case 'tab':state.active=kind;render();save();break;
      case 'mode':{
        const next=b.dataset.mode;if(next===s.mode)break;
        if(next==='direct')s.rows.forEach(r=>{const result=processHallVoltages(r.v,state.params);r.b=result?Number(result.b.toFixed(6)):'';});
        s.mode=next;renderTable();persist();message(next==='four'?'请录入四方向原始电压。直接磁场值不会被自动换算为虚构的电压；已有电压记录保留。':'已将当前四电压计算结果写入直接磁场列，可继续编辑。');break;
      }
      case 'add':s.rows.push({x:'',b:'',v:['','','','']});edited();renderTable();persist();root.querySelector(`input[data-row="${s.rows.length-1}"]`)?.focus();break;
      case 'delete':s.rows.splice(Number(b.dataset.row),1);edited();renderTable();persist();break;
      case 'clear':s.rows=[];s.source='新建数据';renderTable();persist();message('当前数据表已清空。另一组实验数据保留。');break;
      case 'example':s.rows=exampleRows(state.active,state.params);s.source='示例数据';renderTable();persist();message('已按当前模型参数载入带微小模拟偏差的示例，不能用作实测数据。');break;
      case 'paste':importText(root.querySelector('.dl-import-text').value);break;
      case 'file':root.querySelector('[data-file]').click();break;
      case 'csv':{
        const coordinate=state.active==='axial'?'x_mm':'I_M_A';const content=[`# hall-lab-params=${JSON.stringify(state.params)}`,`# source=${s.source}`,`${coordinate},${s.mode==='four'?'V1_raw_mV,V2_raw_mV,V3_raw_mV,V4_raw_mV,U_H_corrected_mV,':''}B_mT`,...s.rows.map(r=>{const result=s.mode==='four'?processHallVoltages(r.v,state.params):null;return [r.x,...(s.mode==='four'?[...r.v,result?.u??'']:[]),s.mode==='four'?result?.b??'':r.b].join(',');})].join('\r\n');downloadBlob(new Blob(['\uFEFF'+content],{type:'text/csv;charset=utf-8'}),`${CONFIG[state.active].filename}-${s.source}.csv`);message('已导出数据 CSV；含参数、零差、带单位表头和计算值，可重新导入本平台。');break;
      }
      case 'export-svg':downloadBlob(new Blob([chartSvg(kind,state.sets[kind],state.params)],{type:'image/svg+xml;charset=utf-8'}),`${CONFIG[kind].filename}.svg`);message('SVG 矢量图已导出，可插入报告并保持清晰。');break;
      case 'export-png':exportPNG(kind);break;
      case 'simulation':{try{const records=shared.getSimulationRows?.();if(records?.then){records.then(data=>importRows(state.active,Array.isArray(data)?data:data?.[state.active])).catch(()=>message('读取仿真记录失败。',true));}else importRows(state.active,Array.isArray(records)?records:records?.[state.active]);}catch{message('读取仿真记录失败。',true);}break;}
    }
  };
  root.addEventListener('input',onInput);root.addEventListener('change',onChange);root.addEventListener('click',onClick);render();
  return { importRows, getRows:(kind=state.active)=>getPoints(state.sets[kind],state.params).map(p=>({...p})), refresh:()=>{render();save();}, destroy:()=>{disposed=true;clearTimeout(messageTimer);root.removeEventListener('input',onInput);root.removeEventListener('change',onChange);root.removeEventListener('click',onClick);root.remove();} };
}
