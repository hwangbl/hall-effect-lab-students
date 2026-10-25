import * as THREE from './assets/three.module.js';
import { OrbitControls } from './assets/OrbitControls.js';

/** LY-528 teaching reconstruction from the course's real apparatus photographs. */
export function createLabScene(host, {onPortClick, onSelect} = {}) {
  const scene=new THREE.Scene();scene.background=new THREE.Color('#edf2f3');
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.17;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.domElement.style.cssText='display:block;width:100%;height:100%;touch-action:none;outline:none';
  renderer.domElement.tabIndex=0;renderer.domElement.setAttribute('aria-label','LY-528 透明实验箱三维模型。拖动旋转、滚轮缩放；点击仪器部件查看名称和用途，点击接线孔连接导线。');host.appendChild(renderer.domElement);
  const camera=new THREE.PerspectiveCamera(32,1,.1,80),controls=new OrbitControls(camera,renderer.domElement);
  controls.enableDamping=false;controls.minDistance=4.8;controls.maxDistance=23;controls.maxPolarAngle=Math.PI*.49;controls.screenSpacePanning=true;
  let destroyed=false,powered=false,fieldRequested=false,probeMm=0,selectedObject=null,selectionBox=null,hoveredPort=null;
  const readings={IH:0,VH:0,IM:0},resources=new Set(),ports=new Map(),portHits=[],componentHits=[],descriptions=new Map(),screenDraw=[],knobIndices={};
  const record=x=>(resources.add(x),x);
  const material=(color,extra={})=>record(new THREE.MeshStandardMaterial({color,roughness:.48,metalness:.05,...extra}));
  const black=material('#172027',{roughness:.4}),silver=material('#c3cbcf',{metalness:.88,roughness:.26}),blue=material('#173b85',{roughness:.28}),copper=material('#8e4525',{metalness:.85,roughness:.30});
  const white=material('#f3f5ed',{roughness:.4}),pcb=material('#23604c',{roughness:.7}),board=material('#272437',{roughness:.55});
  const acrylic=material('#d9edf1',{transparent:true,opacity:.14,roughness:.12,metalness:.04,depthWrite:false,side:THREE.DoubleSide});
  const acrylicEdge=material('#d6e8e9',{transparent:true,opacity:.66,roughness:.20,metalness:.12,depthWrite:false});
  const glass=material('#d6eced',{transparent:true,opacity:.19,roughness:.14,depthWrite:false,side:THREE.DoubleSide});
  scene.add(new THREE.HemisphereLight('#f7fbff','#82959c',3.2));
  const sun=new THREE.DirectionalLight('#fff4e9',4.1);sun.position.set(-4,9,7);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
  Object.assign(sun.shadow.camera,{left:-7,right:7,top:7,bottom:-6,near:1,far:25});sun.shadow.bias=-.0004;sun.shadow.normalBias=.025;scene.add(sun);
  const fill=new THREE.DirectionalLight('#d1e5ff',1.55);fill.position.set(5,5,-5);scene.add(fill);
  function mesh(geometry,mat,pos=[0,0,0],parent=scene){record(geometry);const o=new THREE.Mesh(geometry,mat);o.position.set(...pos);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
  const box=(w,h,d,mat,pos,parent=scene)=>mesh(new THREE.BoxGeometry(w,h,d),mat,pos,parent);
  function cylinder(r,len,mat,pos,axis='y',parent=scene,open=false,segments=40){const o=mesh(new THREE.CylinderGeometry(r,r,len,segments,1,open),mat,pos,parent);if(axis==='x')o.rotation.z=Math.PI/2;if(axis==='z')o.rotation.x=Math.PI/2;return o;}
  function texture(c){const t=record(new THREE.CanvasTexture(c));t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());return t;}
  function plane(w,h,c,pos,parent=scene){const m=record(new THREE.MeshBasicMaterial({map:texture(c),transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false}));const o=mesh(new THREE.PlaneGeometry(w,h),m,pos,parent);o.castShadow=false;return o;}
  function canvas(w=1024,h=256){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
  function print(text,w,h,pos,{size=70,color='#182d3e',bg=null,parent=scene,weight=600}={}){const c=canvas(1024,256),ctx=c.getContext('2d');if(bg){ctx.fillStyle=bg;ctx.fillRect(0,0,1024,256)}ctx.font=`${weight} ${size}px "PingFang SC","Microsoft YaHei",sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=color;ctx.fillText(text,512,128,990);return plane(w,h,c,pos,parent);}
  function curveLine(points,color,radius=.019,parent=scene,closed=false){const path=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)),closed,'catmullrom',.35);return mesh(new THREE.TubeGeometry(path,Math.max(30,points.length*11),radius,6,closed),material(color,{roughness:.55}),[0,0,0],parent);}
  function describe(id,title,description){descriptions.set(id,{id,title,description});}
  function component(o,id){o.traverse(n=>{if(n.isMesh){n.userData.selectId=id;componentHits.push(n)}});return o;}
  function screw(x,y,z,axis='z',parent=scene,r=.042){const o=cylinder(r,.05,silver,[x,y,z],axis,parent,false,18);if(axis==='z'){const cut=box(r*1.35,.011,.007,black,[x,y,z+.03],parent);cut.rotation.z=.55}return o;}
  function panelPort(x,y,z,color,parent=scene,r=.095){const g=new THREE.Group();g.position.set(x,y,z);parent.add(g);const rim=mesh(new THREE.TorusGeometry(r,.028,10,28),material(color,{metalness:.32,roughness:.30}),[0,0,.01],g);cylinder(r*.77,.10,black,[0,0,-.02],'z',g);return{g,rim};}
  function port(id,x,y,z,color,label){const {g,rim}=panelPort(x,y,z,color);const hit=mesh(new THREE.SphereGeometry(.145,16,10),record(new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false})),[0,0,.045],g);hit.userData.port=id;portHits.push(hit);ports.set(id,{group:g,rim,color});print(label,.38,.13,[x,y-.19,z+.045],{size:83,bg:'#edf2f0d9'});return g;}
  const cableGroup=new THREE.Group();scene.add(cableGroup);

  // Clear laboratory box, metal fasteners and visible electronics.
  box(11.5,.14,6.0,material('#e6ecec',{roughness:.84}),[0,-.19,0]);
  box(100,.06,100,material('#edf2f3',{roughness:1}),[0,-.30,0]);
  const groundGrid=new THREE.GridHelper(10,20,'#bdccd0','#d7e1e3');groundGrid.position.set(0,-.115,0);groundGrid.material.transparent=true;groundGrid.material.opacity=.24;scene.add(groundGrid);
  const cabinet=new THREE.Group();scene.add(cabinet);
  box(7.7,.16,3.15,acrylicEdge,[0,.18,0],cabinet);box(7.7,.16,3.15,acrylicEdge,[0,2.65,0],cabinet);
  for(const x of [-3.75,3.75]){box(.12,2.45,3.1,acrylic,[x,1.42,0],cabinet);for(const z of [-1.48,1.48])box(.105,2.43,.105,acrylicEdge,[x,1.42,z],cabinet)}
  box(7.45,2.34,.055,acrylic,[0,1.42,-1.50],cabinet);box(7.45,2.34,.055,acrylic,[0,1.42,1.50],cabinet);
  for(const x of [-3.68,3.68])for(const z of [-1.43,1.43]){cylinder(.12,.13,black,[x,.045,z]);screw(x,2.77,z,'y',cabinet,.045)}
  const motherboard=box(7.10,.06,2.52,pcb,[0,.39,0],cabinet);
  const pcbCanvas=canvas(1536,768),pc=pcbCanvas.getContext('2d');pc.fillStyle='#236249';pc.fillRect(0,0,1536,768);pc.strokeStyle='#a8b889';pc.lineWidth=2;
  for(let i=0;i<24;i++){const x=50+i*61;pc.beginPath();pc.moveTo(x,28);pc.lineTo(x,740);pc.stroke();pc.beginPath();pc.moveTo(25,x/2);pc.lineTo(1510,x/2);pc.stroke()}
  pc.fillStyle='#c4cbbc';pc.font='26px sans-serif';pc.fillText('LY-528  SENSOR CONTROL BOARD',60,704);
  const pcbTop=plane(7.08,2.50,pcbCanvas,[0,.424,0],cabinet);pcbTop.rotation.x=-Math.PI/2;
  for(let i=0;i<8;i++){box(.39,.12,.23,black,[-2.55+i*.72,.52,-.15+(i%2)*.55],cabinet);for(const d of [-1,1])for(let j=0;j<4;j++)box(.025,.045,.055,silver,[-2.69+i*.72+j*.085,.49,-.15+(i%2)*.55+d*.15],cabinet)}
  for(let i=0;i<10;i++)cylinder(.065,.19,material(i%3===0?'#4c90b2':'#333e43',{metalness:.2}),[-2.9+i*.59,.55,-.75],'y',cabinet,false,16);
  box(1.10,.66,.70,material('#3b4143',{metalness:.3,roughness:.7}),[-2.3,.78,-.8],cabinet);
  for(let i=0;i<11;i++)box(1.13,.022,.74,material('#778284',{metalness:.65}),[-2.3,.52+i*.045,-.8],cabinet);
  describe('cabinet','LY-528 透明综合实验箱','亚克力机箱内集成传感器电流源、电压测量和线圈励磁电源。螺线管测量架安装在机箱顶部，四路数显位于正面上排。');component(cabinet,'cabinet');

  // Four individual purple display PCBs, with bright seven-segment readouts.
  const boardXs=[-2.73,-.91,.91,2.73];
  const specs=[['IH','工作电流','Iₕ / mA',3],['VB','工作电压','Vᵦ / V',3],['VH','传感器输出','Vₕ / mV',4],['IM','励磁电流','Iₘ / A',4]];
  function drawDigit(ctx,d,x,y,scale,lit){
    const segs={0:'ab cdef'.replace(/ /g,''),1:'bc',2:'abged',3:'abgcd',4:'fgbc',5:'afgcd',6:'afgecd',7:'abc',8:'abcdefg',9:'abfgcd','-':'g',' ':''};
    const shapes={a:[[5,0],[41,0],[46,5],[41,10],[5,10],[0,5]],g:[[5,47],[41,47],[46,52],[41,57],[5,57],[0,52]],d:[[5,94],[41,94],[46,99],[41,104],[5,104],[0,99]],f:[[0,8],[5,13],[5,44],[0,49],[-5,44],[-5,13]],b:[[46,8],[51,13],[51,44],[46,49],[41,44],[41,13]],e:[[0,56],[5,61],[5,91],[0,96],[-5,91],[-5,61]],c:[[46,56],[51,61],[51,91],[46,96],[41,91],[41,61]]};
    for(const [k,pts]of Object.entries(shapes)){const on=lit&&(segs[d]||'').includes(k);ctx.fillStyle=on?'#ff4b29':'#3b2929';ctx.shadowColor=on?'#ff512b':'transparent';ctx.shadowBlur=on?13:0;ctx.beginPath();pts.forEach(([xx,yy],i)=>i?ctx.lineTo(x+xx*scale,y+yy*scale):ctx.moveTo(x+xx*scale,y+yy*scale));ctx.closePath();ctx.fill()}
    ctx.shadowBlur=0;
  }
  for(let i=0;i<4;i++){
    const [key,title,unit,digits]=specs[i],x=boardXs[i],g=new THREE.Group();scene.add(g);
    box(1.69,.93,.055,board,[x,2.02,1.56],g);box(1.54,.53,.07,black,[x,1.94,1.61],g);
    for(const dx of [-.76,.76])for(const dy of [-.38,.38])screw(x+dx,2.02+dy,1.60,'z',g,.035);
    const c=canvas(1280,700),ctx=c.getContext('2d'),t=texture(c);const m=record(new THREE.MeshBasicMaterial({map:t,toneMapped:false}));const face=mesh(new THREE.PlaneGeometry(1.57,.84),m,[x,2.02,1.655],g);face.castShadow=false;
    const draw=()=>{ctx.fillStyle='#292638';ctx.fillRect(0,0,1280,700);ctx.fillStyle='#eee9d6';ctx.fillRect(36,44,1208,156);ctx.fillStyle='#142330';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='600 81px "PingFang SC",sans-serif';ctx.fillText(title,640,112);ctx.font='600 60px Georgia,serif';ctx.fillText(unit,640,235);ctx.fillStyle='#180e0c';ctx.fillRect(40,285,1200,355);let val=key==='VB'?0:readings[key];let text=powered?Number(val).toFixed(digits):'0.0000';if(text.length>7)text=text.slice(0,7);const chars=text.split(''),segments=chars.filter(c=>c!=='.').length;const sc=2.42,spacing=172;let px=(1280-(segments*spacing+35))/2;
      for(const char of chars){if(char==='.'){ctx.fillStyle=powered?'#ff5638':'#422926';ctx.beginPath();ctx.arc(px-24,597,14,0,Math.PI*2);ctx.fill();continue}drawDigit(ctx,char,px,318,sc,powered);px+=spacing}
      t.needsUpdate=true;};screenDraw.push(draw);draw();
    describe('screen-'+key,title+'数显表',key==='IH'?'显示霍尔片工作电流，单位 mA；本实验常设 5.000 mA。':key==='VB'?'显示传感器工作电压，单位 V；此功能不参与本次霍尔效应数据处理。':key==='VH'?'霍尔模式下显示探头横向输出电压，单位 mV。换向测量应记录原始正负号。':'显示螺线管励磁电流，单位 A。正负号由励磁换向状态决定。');component(g,'screen-'+key);
    // Small pin headers, ribbon connectors and curved white wiring are visible through the cover.
    for(let j=0;j<6;j++){cylinder(.017,.16,silver,[x-.56+j*.21,1.52,1.40],'y',g,false,10);const z=.80+(j%3)*.13;curveLine([[x-.56+j*.21,1.52,1.39],[x-.56+j*.21,1.24,1.28],[x-.50+j*.16,.92,z],[x-.45+j*.15,.50,z-.13]],j%5===0?'#dce4d8':'#c7d0c9',.014,g)}
  }

  // Printed labels sit on the real front panel rather than floating in the air.
  print('Iₕ 换向',.68,.17,[-3.10,1.39,1.573],{size:85});print('Iₕ 调节',.72,.17,[-2.36,1.39,1.573],{size:85});print('Vᵦ 调节',.72,.17,[-1.40,1.39,1.573],{size:85});
  print('复位',.52,.15,[.17,1.30,1.573],{size:89});print('霍尔　测量选择　磁阻',1.50,.17,[1.10,1.40,1.573],{size:65});
  print('Iₘ 换向',.72,.17,[2.08,1.39,1.573],{size:85});print('Iₘ 调节',.72,.17,[2.85,1.39,1.573],{size:85});
  print('LY-528  多种手段测磁场综合实验仪',6.95,.21,[0,.20,1.605],{size:55,color:'#203f3c',bg:'#a8c2aeeb'});
  function knob(x,id){const g=new THREE.Group();g.position.set(x,1.01,1.61);scene.add(g);cylinder(.19,.06,blue,[0,0,0],'z',g);cylinder(.133,.34,silver,[0,0,.16],'z',g);
    for(let i=0;i<24;i++){const a=i/24*Math.PI*2;cylinder(.005,.29,material('#72818b',{metalness:.75,roughness:.26}),[Math.sin(a)*.135,Math.cos(a)*.135,.16],'z',g,false,6)}
    cylinder(.142,.065,blue,[0,0,.35],'z',g);const indicator=box(.016,.11,.008,white,[0,.048,.386],g);knobIndices[id]={g:indicator};describe('knob-'+id,id==='IH'?'霍尔片工作电流调节旋钮':id==='IM'?'螺线管励磁电流调节旋钮':'工作电压调节旋钮',id==='IH'?'银色旋钮配蓝色端盖，调节 Iₕ 的绝对值。本平台通过下方控制条同步调节。':id==='IM'?'调节励磁电流大小。先归零再通电，实验中不超过 0.2200 A。':'用于其他传感器工作电压设置，本次霍尔效应实验不使用。');component(g,'knob-'+id);return g;}
  knob(-2.36,'IH');knob(-1.40,'VB');knob(2.85,'IM');
  const rockerFaces={};
  function rocker(x,id){const g=new THREE.Group();g.position.set(x,1.00,1.65);scene.add(g);box(.34,.46,.10,black,[0,0,0],g);const face=box(.265,.335,.08,material('#292127',{roughness:.5}),[0,0,.08],g);print('+　−',.30,.12,[0,-.275,.08],{size:94,parent:g});print('Ⅰ  〇',.22,.21,[0,0,.128],{size:85,color:'#ddd9cf',parent:g});rockerFaces[id]=face;describe('direction-'+id,id==='IH'?'工作电流换向开关':'励磁电流换向开关',id==='IH'?'改变 Iₕ 的方向，保持工作电流绝对值不变，用于四次换向法。':'改变 Iₘ 方向，线圈磁场及 N/S 极随之反向；保持励磁电流绝对值不变。');component(g,'direction-'+id)}
  rocker(-3.12,'IH');rocker(2.07,'IM');
  const selector=new THREE.Group();scene.add(selector);box(.41,.38,.12,black,[1.08,1.00,1.66],selector);box(.30,.27,.07,material('#40272c'),[1.08,1.00,1.75],selector);describe('selector','霍尔 / 磁阻测量选择开关','本实验将选择置于霍尔（VH）位置，毫伏表量程为 200 mV。右侧磁阻挡用于其他实验。');component(selector,'selector');
  const reset=new THREE.Group();scene.add(reset);cylinder(.075,.11,silver,[.17,1.02,1.68],'z',reset);cylinder(.056,.06,material('#9e302b'),[.17,1.02,1.76],'z',reset);describe('reset','复位按钮','综合实验仪的复位控制。霍尔电压零差仍应按四个方向分别测量并记录。');component(reset,'reset');
  panelPort(-.55,1.01,1.64,'#57a041');print('Vₛ/R+',.58,.15,[-.55,1.24,1.66],{size:76});panelPort(-.55,.49,1.64,'#151b20');
  panelPort(-1.40,.49,1.64,'#a13732');print('Vᵦ',.37,.13,[-1.40,.29,1.67],{size:92});panelPort(1.18,.49,1.64,'#dda638');print('Vɢᴍʀ',.58,.13,[1.18,.29,1.67],{size:86});
  port('IH+',-3.12,.49,1.65,'#ce4039','Iₕ +');port('IH-',-2.38,.49,1.65,'#25292e','Iₕ −');
  port('VH+',.13,.49,1.65,'#d5a438','Vₕ +');port('VH-',.67,.49,1.65,'#25292e','Vₕ −');
  port('IM+',2.06,.49,1.65,'#ce4039','Iₘ +');port('IM-',2.83,.49,1.65,'#25292e','Iₘ −');

  // The solenoid stage belongs on top of the instrument, as in the real LY-528.
  const deck=new THREE.Group();scene.add(deck);box(7.28,.115,2.32,acrylicEdge,[0,2.83,-.02],deck);
  const deckGrid=canvas(1536,512),dg=deckGrid.getContext('2d');dg.clearRect(0,0,1536,512);dg.strokeStyle='#52646b8a';dg.lineWidth=2;for(let x=20;x<1536;x+=50){dg.beginPath();dg.moveTo(x,14);dg.lineTo(x,500);dg.stroke()}for(let y=12;y<512;y+=50){dg.beginPath();dg.moveTo(20,y);dg.lineTo(1516,y);dg.stroke()}
  const deckMap=plane(7.05,2.12,deckGrid,[0,2.895,-.02],deck);deckMap.rotation.x=-Math.PI/2;
  for(const x of [-3.45,3.45])for(const z of [-1.0,1.0])screw(x,2.92,z,'y',deck,.042);
  describe('deck','透明测量架底板与支架','上层透明底板固定线圈与导向支架；网格有助于辨认安装位置。请保持探头沿螺线管轴线移动。');component(deck,'deck');
  const coilStart=.28,coilLength=3.05,coilY=3.91,coilZ=-.05,coilRadius=.35;
  const supports=new THREE.Group();scene.add(supports);
  for(const x of [coilStart,coilStart+coilLength]){box(.105,1.19,1.27,acrylic,[x,3.48,coilZ],supports);box(.23,.11,1.42,acrylicEdge,[x,2.96,coilZ],supports);cylinder(.465,.14,acrylicEdge,[x,coilY,coilZ],'x',supports);cylinder(.25,.145,glass,[x,coilY,coilZ],'x',supports,true);screw(x,3.02,.53,'y',supports,.04);screw(x,3.02,-.60,'y',supports,.04)}
  describe('supports','螺线管亚克力端架','透明端架、圆形护环和螺钉把线圈固定在透明平台上，并引导标尺杆穿过轴线。');component(supports,'supports');
  const coil=new THREE.Group();scene.add(coil);
  cylinder(coilRadius-.012,coilLength,copper,[coilStart+coilLength/2,coilY,coilZ],'x',coil,true,64);
  cylinder(.247,coilLength+.25,glass,[coilStart+coilLength/2,coilY,coilZ],'x',coil,true,48);
  const points=[];const turns=112,samples=2800;
  for(let i=0;i<=samples;i++){const t=i/samples,a=t*Math.PI*2*turns;points.push(new THREE.Vector3(coilStart+t*coilLength,coilY+Math.sin(a)*coilRadius,coilZ+Math.cos(a)*coilRadius))}
  mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),samples,.013,6,false),copper,[0,0,0],coil);
  const coilLabel=canvas(1536,512),cl=coilLabel.getContext('2d');cl.fillStyle='#f4f4e8';cl.fillRect(0,0,1536,512);cl.strokeStyle='#38423c';cl.lineWidth=7;cl.strokeRect(20,20,1496,472);cl.fillStyle='#202923';cl.textAlign='center';cl.textBaseline='middle';cl.font='600 86px sans-serif';cl.fillText('N = 3445     L = 150.2 mm',768,122);cl.fillText('D = 19.5 mm',768,265);cl.font='600 77px "PingFang SC",sans-serif';cl.fillText('磁场方向：电源正侧为 N',768,410);plane(1.88,.44,coilLabel,[1.92,4.01,.266],coil);
  describe('coil','3445 匝有限长螺线管','铜线绕组的真实铭牌参数为 N=3445、L=150.2 mm、D=19.5 mm。线圈安装于箱体上方，红黑接线柱接励磁输出；正电源接线侧为 N 极。');component(coil,'coil');
  port('C+',coilStart,3.22,.66,'#ce4039','线圈 +');port('C-',coilStart+coilLength,3.22,.66,'#25292e','线圈 −');
  curveLine([[coilStart,3.22,.59],[coilStart+.17,3.40,.36],[coilStart+.08,3.63,.11]],'#9d482c',.022);
  curveLine([[coilStart+coilLength,3.22,.59],[coilStart+coilLength-.16,3.40,.36],[coilStart+coilLength-.06,3.64,.11]],'#633d2a',.022);
  for(const x of [coilStart,coilStart+coilLength/2,coilStart+coilLength])print(x===coilStart?'x = 0':x===coilStart+coilLength?'x = L':'L / 2',.50,.12,[x,2.90,1.167],{size:75,bg:'#d9e7e3dd'});

  // A small four-pin probe plug replaces the fictional freestanding terminal box.
  const connector=new THREE.Group();scene.add(connector);box(1.58,.25,.38,material('#e0ddc6'),[-2.73,3.04,1.01],connector);
  const pinIds=['P1','P3','P2','P4'],pinXs=[-3.26,-2.90,-2.54,-2.18],pinColors=['#ce4039','#25292e','#2c86ac','#a48231'];
  for(let i=0;i<4;i++)port(pinIds[i],pinXs[i],3.045,1.25,pinColors[i],pinIds[i].slice(1));
  describe('probe-connector','霍尔探头四针接头','此处展开显示探头的四个引脚，方便练习连线：1、3 脚接工作电流，2、4 脚测量霍尔电压。真实探头端部通过细线束连接，教学模型将四针分开显示。');component(connector,'probe-connector');
  const probe=new THREE.Group();scene.add(probe);const rodLength=3.50;
  cylinder(.081,rodLength,glass,[-rodLength/2,0,0],'x',probe,true,40);cylinder(.032,rodLength-.08,material('#b9c2be'),[-rodLength/2,0,0],'x',probe);
  cylinder(.095,.16,material('#d9dfd1'),[-rodLength-.05,0,0],'x',probe);box(.10,.105,.055,pcb,[.015,0,0],probe);
  cylinder(.035,.04,material('#255e3d'),[.025,0,0],'x',probe,false,18);
  const scaleCanvas=canvas(2048,128),sc=scaleCanvas.getContext('2d');sc.clearRect(0,0,2048,128);sc.strokeStyle='#243333';sc.fillStyle='#243333';sc.lineWidth=3;sc.font='30px sans-serif';sc.textAlign='center';
  for(let i=0;i<=100;i++){const x=i/100*2000+24;sc.beginPath();sc.moveTo(x,2);sc.lineTo(x,i%10===0?50:i%5===0?34:20);sc.stroke();if(i%10===0)sc.fillText(String(20-i/5),x,89)}
  const scale=plane(rodLength-.15,.14,scaleCanvas,[-rodLength/2,.056,.065],probe);scale.rotation.x=-.32;
  describe('probe','霍尔探头与透明标尺杆','细小霍尔片位于标尺杆末端，沿螺线管轴线移动。实验坐标取左端面为 x=0；本课件装置的标尺读数 r=x+50.0 mm。');component(probe,'probe');
  // Fixed transparent guide rings make the sliding direction visible.
  const guide=new THREE.Group();scene.add(guide);for(const x of [-3.25,-1.20]){box(.08,1.00,.57,acrylic,[x,3.45,coilZ],guide);cylinder(.19,.15,acrylicEdge,[x,coilY,coilZ],'x',guide);cylinder(.105,.17,glass,[x,coilY,coilZ],'x',guide,true)}
  describe('guide','标尺杆导向支架','透明导向环使探头沿线圈轴线滑动，减少偏心和角度误差。移动时应轻缓，避免碰撞霍尔片。');component(guide,'guide');
  const probeCableGroup=new THREE.Group();scene.add(probeCableGroup);
  function disposeTree(group){while(group.children.length){const c=group.children[0];group.remove(c);c.traverse(o=>{if(o.geometry){o.geometry.dispose();resources.delete(o.geometry)}if(o.material)for(const m of [].concat(o.material)){if(m.map){m.map.dispose();resources.delete(m.map)}m.dispose();resources.delete(m)}})}}
  function setProbe(value){probeMm=Number.isFinite(Number(value))?Math.max(-50,Math.min(200,Number(value))):0;const x=coilStart+probeMm/150.2*coilLength;probe.position.set(x,coilY,coilZ);disposeTree(probeCableGroup);for(let i=0;i<4;i++)curveLine([[x-rodLength-.10,coilY,coilZ+(i-1.5)*.025],[x-rodLength-.38,coilY-.12,.10+(i-1.5)*.03],[-3.85-i*.035,3.35,.55],[pinXs[i],3.15,.97]],pinColors[i],.016,probeCableGroup);if(selectionBox)selectionBox.update();render()}

  // Conditional magnetic-field arrows and polarity, shown only with nonzero excitation.
  const fieldGroup=new THREE.Group(),nsGroup=new THREE.Group();scene.add(fieldGroup,nsGroup);const arrows=[];
  for(const a of [-Math.PI/2,0,Math.PI/2,Math.PI]){const r=.76;const offsets=[[-.20,.0],[-.02,.45],[.55,r],[2.50,r],[3.15,.45],[3.28,0],[2.70,0],[.45,0]];const pts=offsets.map(([dx,rr])=>[coilStart+dx,coilY+Math.sin(a)*rr,coilZ+Math.cos(a)*rr]);curveLine(pts,'#2384a0',.013,fieldGroup,true);const ar=new THREE.ArrowHelper(new THREE.Vector3(1,0,0),new THREE.Vector3(1.30,coilY+Math.sin(a)*r,coilZ+Math.cos(a)*r),.48,'#137897',.16,.10);arrows.push(ar);fieldGroup.add(ar)}
  const axisArrow=new THREE.ArrowHelper(new THREE.Vector3(-1,0,0),new THREE.Vector3(3.0,coilY,coilZ),2.50,'#0c7c9c',.18,.10);fieldGroup.add(axisArrow);
  function polarity(text,color){const c=canvas(128,128),cx=c.getContext('2d');cx.fillStyle='#ffffffed';cx.beginPath();cx.arc(64,64,57,0,Math.PI*2);cx.fill();cx.fillStyle=color;cx.font='700 82px Georgia,serif';cx.textAlign='center';cx.textBaseline='middle';cx.fillText(text,64,67);const m=record(new THREE.SpriteMaterial({map:texture(c),transparent:true,depthTest:false,depthWrite:false}));const s=new THREE.Sprite(m);s.scale.set(.31,.31,1);nsGroup.add(s);return s}
  const north=polarity('N','#b23f35'),south=polarity('S','#286d9a');
  function syncMagnetism(){const active=powered&&Math.abs(readings.IM)>1e-9,sign=readings.IM<0?-1:1;nsGroup.visible=active;fieldGroup.visible=active&&fieldRequested;north.position.set(sign>0?coilStart-.19:coilStart+coilLength+.19,coilY+.47,coilZ);south.position.set(sign>0?coilStart+coilLength+.19:coilStart-.19,coilY+.47,coilZ);for(const a of arrows){a.setDirection(new THREE.Vector3(sign,0,0));a.position.x=sign>0?1.3:1.78}axisArrow.setDirection(new THREE.Vector3(-sign,0,0));axisArrow.position.x=sign>0?3.0:.65;rockerFaces.IM.rotation.x=readings.IM<0?-.10:.10;rockerFaces.IH.rotation.x=readings.IH<0?-.10:.10;}

  const portDescriptions={
    'IH+':['工作电流输出正端 Iₕ+','连接霍尔探头 1 脚，给霍尔片提供工作电流。'],'IH-':['工作电流输出负端 Iₕ−','连接霍尔探头 3 脚，与 Iₕ+ 构成工作电流回路。'],
    'VH+':['霍尔电压输入正端 Vₕ+','连接霍尔探头 2 脚，用于测量横向霍尔电压。'],'VH-':['霍尔电压输入负端 Vₕ−','连接霍尔探头 4 脚，保留毫伏表读数的正负号。'],
    'IM+':['励磁电流输出正端 Iₘ+','连接螺线管红色接线柱。'],'IM-':['励磁电流输出负端 Iₘ−','连接螺线管黑色接线柱。'],
    'P1':['霍尔探头 1 脚','接工作电流输出 Iₕ+。'],'P3':['霍尔探头 3 脚','接工作电流输出 Iₕ−。'],'P2':['霍尔探头 2 脚','接霍尔电压输入 Vₕ+。'],'P4':['霍尔探头 4 脚','接霍尔电压输入 Vₕ−。'],
    'C+':['螺线管红色接线柱','接励磁输出 Iₘ+。铭牌规定正电源接线侧为 N 极。'],'C-':['螺线管黑色接线柱','接励磁输出 Iₘ−，闭合励磁电流回路。']};
  for(const [id,[title,description]]of Object.entries(portDescriptions))describe('port:'+id,title,description);
  function choose(id,o){const d=descriptions.get(id);if(!d)return;if(selectionBox){scene.remove(selectionBox);selectionBox.geometry.dispose();selectionBox.material.dispose();selectionBox=null}selectedObject=o;if(o){selectionBox=new THREE.BoxHelper(o,'#2398bc');selectionBox.material.transparent=true;selectionBox.material.opacity=.50;selectionBox.material.depthTest=false;selectionBox.renderOrder=7;scene.add(selectionBox)}onSelect?.(d);render()}
  function setWires(pairs=[]){disposeTree(cableGroup);const connected=new Set();for(let i=0;i<pairs.length;i++){const p=pairs[i],from=Array.isArray(p)?p[0]:p.from,to=Array.isArray(p)?p[1]:p.to,a=ports.get(from),b=ports.get(to);if(!a||!b)continue;const color=(Array.isArray(p)?p[2]:p.color)||a.color,av=a.group.position,bv=b.group.position;let pts;if(to.startsWith('P')||from.startsWith('P')){const v=to.startsWith('P')?bv:av,u=to.startsWith('P')?av:bv;const side=-4.08-(i%4)*.08;pts=[[u.x,u.y,u.z+.06],[u.x,u.y-.10,u.z+.31],[side,.50,1.94+(i%3)*.07],[side,2.96,1.43],[v.x,v.y,v.z+.08]]}else{const side=4.08+(i%2)*.12;pts=[[av.x,av.y,av.z+.06],[av.x,av.y-.08,av.z+.35],[side,.56,1.88],[side,3.28,1.12],[bv.x+.18,bv.y-.10,bv.z+.24],[bv.x,bv.y,bv.z+.07]]}curveLine(pts,color,.028,cableGroup);for(const v of [av,bv]){cylinder(.061,.18,material(color,{roughness:.35}),[v.x,v.y,v.z+.11],'z',cableGroup)}connected.add(from);connected.add(to)}for(const[id,p]of ports){p.rim.material.emissive.set(connected.has(id)?p.color:'#000000');p.rim.material.emissiveIntensity=.22}render()}
  function setPower(v){powered=Boolean(v);screenDraw.forEach(d=>d());syncMagnetism();render()}
  function setReadings(values={}){for(const k of ['IH','VH','IM'])if(Number.isFinite(Number(values[k])))readings[k]=Number(values[k]);screenDraw.forEach(d=>d());for(const[k,max]of [['IH',5.5],['IM',.22]]){const a=(-.8+Math.min(1,Math.abs(readings[k])/max)*3.8);knobIndices[k].g.rotation.z=-a;knobIndices[k].g.position.set(Math.sin(a)*.048,Math.cos(a)*.048,.386)}syncMagnetism();render()}
  function setField(v){fieldRequested=Boolean(v);syncMagnetism();render()}
  function render(){if(!destroyed&&host.clientWidth>1&&host.clientHeight>1)renderer.render(scene,camera)}
  let currentView='home';
  function setView(name='home'){currentView=name;const views={home:{p:[4.7,5.55,10.1],t:[0,2.12,.05]},front:{p:[0,4.1,11.15],t:[0,2.18,0]},top:{p:[0,12.8,.06],t:[0,2.1,0]},panel:{p:[0,1.59,9.25],t:[0,1.42,1.38]},detail:{p:[0,1.59,9.25],t:[0,1.42,1.38]},coil:{p:[3.5,5.2,7.1],t:[.45,3.68,0]}};const v=views[name]||views.home;camera.position.set(...v.p);camera.up.set(0,1,0);controls.target.set(...v.t);controls.update();render()}
  function resize(){const w=host.clientWidth,h=host.clientHeight;if(destroyed||w<2||h<2)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();if(w/h<1.25&&currentView==='home'){camera.position.set(6.5,6.5,14);controls.target.set(0,2.1,0);controls.update()}render()}
  const observer=new ResizeObserver(resize);observer.observe(host);controls.addEventListener('change',render);
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();let down=null;
  function ray(event){const rect=renderer.domElement.getBoundingClientRect();if(!rect.width||!rect.height)return false;pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);return true}
  function portAt(event){return ray(event)?raycaster.intersectObjects(portHits,false)[0]?.object.userData.port:null}
  function pointerDown(e){down={x:e.clientX,y:e.clientY}}
  function pointerUp(e){if(down&&Math.hypot(e.clientX-down.x,e.clientY-down.y)<6){const id=portAt(e);if(id){choose('port:'+id,ports.get(id).group);onPortClick?.(id)}else if(ray(e)){const hit=raycaster.intersectObjects(componentHits,false)[0];if(hit)choose(hit.object.userData.selectId,hit.object)}}down=null}
  function pointerMove(e){const id=portAt(e);if(id!==hoveredPort){if(hoveredPort){const p=ports.get(hoveredPort);p.rim.scale.setScalar(1);p.rim.material.emissiveIntensity=.22}hoveredPort=id;if(id){const p=ports.get(id);p.rim.scale.setScalar(1.18);p.rim.material.emissive.set(p.color);p.rim.material.emissiveIntensity=.52}render()}renderer.domElement.style.cursor=id?'pointer':'grab'}
  renderer.domElement.addEventListener('pointerdown',pointerDown);renderer.domElement.addEventListener('pointerup',pointerUp);renderer.domElement.addEventListener('pointermove',pointerMove);
  function destroy(){destroyed=true;observer.disconnect();controls.dispose();renderer.domElement.removeEventListener('pointerdown',pointerDown);renderer.domElement.removeEventListener('pointerup',pointerUp);renderer.domElement.removeEventListener('pointermove',pointerMove);if(selectionBox){selectionBox.geometry.dispose();selectionBox.material.dispose()}for(const r of resources)r.dispose?.();resources.clear();renderer.dispose();renderer.domElement.remove()}
  setView('home');setProbe(0);setPower(false);resize();
  return{setWires,setProbe,setPower,setField,setView,setReadings,destroy};
}
