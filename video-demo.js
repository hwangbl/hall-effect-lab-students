const CHAPTERS = [
  {time:0,title:'观察装置与既有连线',detail:'镜头展示真实实验仪、螺线管、探头和已经接好的导线。对照三维平台，辨认工作电流回路、霍尔电压测量回路与励磁回路。'},
  {time:10,title:'观察励磁旋钮与数显',detail:'右侧调节旋钮和励磁电流显示进入近景。注意区分工作电流、工作电压、霍尔电压和励磁电流四块表头。'},
  {time:45,title:'认识标尺与探头位置',detail:'镜头转向标尺杆、线圈端面和接线端。读数前先确认霍尔片的位置、左端面零点，以及标尺与实验坐标的换算。'},
  {time:65,title:'励磁调节与电压读数',detail:'观察调节旋钮时励磁电流及输出电压的变化。正式实验中固定工作电流，待读数稳定后记录电流和带正负号的电压。'},
  {time:150,title:'反向状态的读数符号',detail:'观察这一段中的反向励磁及输出电压符号。换向后应保持两路电流的绝对值一致，再按约定状态记录读数。'},
  {time:180,title:'继续调节与多点读数',detail:'演示继续调节励磁旋钮并观察多组读数。正式采集时按规定电流间隔和四次换向顺序逐组记录，再完成零差扣除与对称法处理。'}
];
const stamp=s=>`${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
export function videoDemoHtml(){return `<section class="vd-section" id="operation-demo"><style>
.vd-section{--vd-blue:#10405c;--vd-line:#d7e2e8;border-top:1px solid var(--vd-line);padding-top:35px;margin-top:38px;color:#294557}.vd-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:21px}.vd-heading .eyebrow{margin-bottom:7px}.vd-heading h2{font-size:28px;margin:0}.vd-source{font-size:11px;color:#6b8090;text-align:right}.vd-badge{font-size:10px;letter-spacing:1px;display:inline-block;padding:4px 9px;background:#e8f2f7;color:#27637e;margin-bottom:7px}.vd-layout{display:grid;grid-template-columns:minmax(0,1.9fr) minmax(245px,1fr);gap:22px;align-items:start}.vd-player{min-width:0;background:#eef4f6;border:1px solid var(--vd-line)}.vd-player video{display:block;width:100%;aspect-ratio:16/9;background:#172f3d;object-fit:contain}.vd-controls{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:11px 13px;background:#f6f9fa;font-size:12px}.vd-controls button{font-size:12px;padding:7px 15px;background:var(--vd-blue);color:white;border-color:var(--vd-blue)}.vd-controls select{padding:4px 7px;border:1px solid #cbdce5;background:white;color:var(--vd-blue)}.vd-controls label{display:flex;align-items:center;gap:7px}.vd-clock{margin-left:auto;font:12px ui-monospace,SFMono-Regular,monospace;color:#668090}.vd-current{background:white;border-top:1px solid var(--vd-line);padding:18px}.vd-current-kicker{font-size:9px;letter-spacing:1.8px;color:#7991a0;margin-bottom:6px}.vd-current h3{font-size:18px;margin:0 0 7px}.vd-current p{font-size:13px;line-height:1.9;color:#647b89;margin:0}.vd-chapters{padding:0;margin:0;list-style:none;border:1px solid var(--vd-line);background:#fff}.vd-chapters li+li{border-top:1px solid var(--vd-line)}.vd-chapter{display:flex;gap:12px;align-items:flex-start;width:100%;border:0!important;padding:13px 15px!important;background:#fff!important;text-align:left;color:#496476!important;font-size:12px!important;line-height:1.75}.vd-chapter time{font:12px ui-monospace,SFMono-Regular,monospace;line-height:1.75;color:#7c98a8;flex:none}.vd-chapter[aria-current=true]{background:#eaf3f8!important;color:var(--vd-blue)!important;box-shadow:inset 3px 0 #2a83a7}.vd-chapter:hover{background:#f0f6f9!important}.vd-foot{display:flex;justify-content:space-between;align-items:center;gap:15px;margin-top:15px;flex-wrap:wrap}.vd-download{font-size:12px;display:inline-block;color:#10405c;border-bottom:1px solid #3c91ad;padding:3px 0}.vd-subtitle{display:flex;align-items:center;gap:8px;font-size:11px;color:#708894;flex-wrap:wrap}.vd-subtitle input{max-width:200px;font-size:11px}.vd-caption{font-size:11px;line-height:1.9;color:#748793;margin:13px 0 0}.vd-message{font-size:11px;color:#517d93;min-height:1.5em;margin-top:6px}.vd-error{display:none;font-size:12px;padding:14px;background:#fbf1e8;color:#93653c}@media(max-width:900px){.vd-layout{grid-template-columns:1fr}.vd-chapters{display:grid;grid-template-columns:repeat(2,1fr)}.vd-chapters li+li{border-top:0}.vd-chapters li{border-bottom:1px solid var(--vd-line)}.vd-chapter{height:100%}.vd-heading{align-items:flex-start}.vd-heading h2{font-size:24px}}@media(max-width:540px){.vd-heading{display:block}.vd-source{text-align:left;margin-top:12px}.vd-chapters{grid-template-columns:1fr}.vd-controls{font-size:11px;gap:7px}.vd-current{padding:14px}.vd-current h3{font-size:17px}.vd-clock{font-size:10px}.vd-foot{display:block}.vd-subtitle{margin-top:13px}}
</style><div class="vd-heading"><div><p class="eyebrow">WATCH THE REAL EXPERIMENT</p><h2>学生操作演示</h2></div><div class="vd-source"><span class="vd-badge">真实仪器 · 学生录制</span><br>课程文件：演示视频.mp4　/　3 分 46 秒</div></div><div class="vd-layout"><div class="vd-player"><video data-vd-video controls playsinline preload="metadata" poster="assets/operation-demo-poster.jpg" aria-label="霍尔效应学生操作演示"><source src="assets/operation-demo.mp4" type="video/mp4">当前浏览器无法播放此视频，可使用下方下载链接。</video><div class="vd-error" data-vd-error>当前浏览器未能加载视频。请稍后重试，或使用下方下载链接。</div><div class="vd-controls"><button data-vd-play>播放演示</button><label>播放速度 <select data-vd-speed aria-label="操作演示播放速度"><option value="0.5">0.5×</option><option value="0.75">0.75×</option><option value="1" selected>1×</option><option value="1.25">1.25×</option><option value="1.5">1.5×</option><option value="2">2×</option></select></label><span class="vd-clock" data-vd-clock>0:00 / 3:46</span></div><div class="vd-current" aria-live="polite"><div class="vd-current-kicker">当前观察重点</div><h3 data-vd-title>${CHAPTERS[0].title}</h3><p data-vd-detail>${CHAPTERS[0].detail}</p></div></div><ol class="vd-chapters" aria-label="操作演示观察时间点">${CHAPTERS.map((c,i)=>`<li><button class="vd-chapter" data-vd-chapter="${i}" aria-current="${i===0}"><time>${stamp(c.time)}</time><span>${c.title}</span></button></li>`).join('')}</ol></div><div class="vd-foot"><a class="vd-download" href="assets/operation-demo.mp4" download="霍尔效应-学生操作演示.mp4">下载操作演示视频 ↓ <small>约 20 MB</small></a><label class="vd-subtitle">载入自己的 VTT 字幕 <input data-vd-subtitles type="file" accept=".vtt,text/vtt" aria-label="载入本地VTT字幕"></label></div><div class="vd-message" data-vd-message role="status"></div><p class="vd-caption">时间点依据视频实际画面设置，便于回看观察重点；这段视频从已连线的装置开始，不能代替完整的课前检查与测量规范。字幕文件仅在当前浏览器预览，不会上传网站。课件和标准报告不提供下载。</p></section>`}
export function bindVideoDemo(root=document){
 const host=root.matches?.('.vd-section')?root:root.querySelector('.vd-section');if(!host)return()=>{};
 const q=s=>host.querySelector(s),video=q('[data-vd-video]'),play=q('[data-vd-play]'),buttons=[...host.querySelectorAll('[data-vd-chapter]')];
 const aborter=new AbortController();let active=-1,subtitleUrl=null,bufferUrl=null,bufferTask=null,pending=null,jumpId=0,disposed=false;
 const message=text=>{if(!disposed)q('[data-vd-message]').textContent=text;};
 function renderChapter(idx){active=idx;buttons.forEach((b,i)=>b.setAttribute('aria-current',String(i===idx)));q('[data-vd-title]').textContent=CHAPTERS[idx].title;q('[data-vd-detail]').textContent=CHAPTERS[idx].detail;}
 function update(){
  const t=Number.isFinite(video.currentTime)?video.currentTime:0,duration=Number.isFinite(video.duration)?video.duration:226.5333;
  q('[data-vd-clock]').textContent=`${stamp(t)} / ${stamp(duration)}`;
  if(pending!==null)return;
  let idx=0;for(let i=0;i<CHAPTERS.length;i++)if(t>=CHAPTERS[i].time)idx=i;
  if(idx!==active)renderChapter(idx);
 }
 async function start(){try{await video.play()}catch{message('已定位到对应步骤，请点击视频中的播放按钮。');}}
 function waitMetadata(){
  if(video.readyState>=1&&Number.isFinite(video.duration))return Promise.resolve();
  return new Promise((resolve,reject)=>{let timer;const done=()=>{clearTimeout(timer);video.removeEventListener('loadedmetadata',ok);video.removeEventListener('error',bad);aborter.signal.removeEventListener('abort',bad);};const ok=()=>{done();resolve();};const bad=()=>{done();reject(Error('media'));};video.addEventListener('loadedmetadata',ok,{once:true});video.addEventListener('error',bad,{once:true});aborter.signal.addEventListener('abort',bad,{once:true});timer=setTimeout(bad,12000);});
 }
 async function prepareBufferedVideo(){
  if(bufferTask)return bufferTask;
  if(bufferUrl)return;
  bufferTask=(async()=>{
   const mediaUrl=new URL('assets/operation-demo.mp4',document.baseURI);
   if(mediaUrl.origin!==location.origin)throw Error('same-origin media only');
   message('正在缓冲演示视频，完成后自动跳到所选步骤…');
   const response=await fetch(mediaUrl.href,{signal:aborter.signal,cache:'force-cache'});
   if(!response.ok)throw Error('media download failed');
   const expected=Number(response.headers.get('content-length'))||20705226;let blob;
   if(response.body?.getReader){const reader=response.body.getReader(),chunks=[];let received=0;
    while(true){const {value,done}=await reader.read();if(done)break;chunks.push(value);received+=value.byteLength;message(`正在缓冲演示视频 ${Math.min(99,Math.round(received/expected*100))}%，随后定位所选步骤…`);}
    blob=new Blob(chunks,{type:'video/mp4'});
   }else blob=await response.blob();
   if(disposed)throw Error('disposed');
   bufferUrl=URL.createObjectURL(blob);video.src=bufferUrl;video.load();await waitMetadata();video.playbackRate=Number(q('[data-vd-speed]').value);q('[data-vd-error]').style.display='none';
  })();
  try{await bufferTask;}catch(error){bufferTask=null;if(bufferUrl){URL.revokeObjectURL(bufferUrl);bufferUrl=null;}throw error;}
 }
 function canSeekTo(t){if(bufferUrl)return true;if(t===0)return video.readyState>=1;for(let i=0;i<video.seekable.length;i++)if(video.seekable.start(i)<=t&&video.seekable.end(i)>=t)return true;return false;}
 function seekTo(t){return new Promise((resolve,reject)=>{let timer;const done=()=>{clearTimeout(timer);video.removeEventListener('seeked',ok);video.removeEventListener('error',bad);aborter.signal.removeEventListener('abort',bad);};const ok=()=>{if(Math.abs(video.currentTime-t)>.75)return;done();resolve();};const bad=()=>{done();reject(Error('seek'));};video.addEventListener('seeked',ok);video.addEventListener('error',bad,{once:true});aborter.signal.addEventListener('abort',bad,{once:true});timer=setTimeout(bad,8000);try{video.currentTime=t;if(!video.seeking&&Math.abs(video.currentTime-t)<.25)ok();}catch{bad();}});}
 async function jumpToChapter(idx){
  const id=++jumpId,target=CHAPTERS[idx].time;pending=idx;video.pause();renderChapter(idx);message(`正在准备 ${stamp(target)}「${CHAPTERS[idx].title}」…`);
  try{
   try{await waitMetadata();}catch{await prepareBufferedVideo();}
   if(!canSeekTo(target))await prepareBufferedVideo();
   if(disposed||id!==jumpId)return;
   try{await seekTo(target);}catch{if(disposed||id!==jumpId)return;if(bufferUrl)throw Error('seek failed');await prepareBufferedVideo();if(disposed||id!==jumpId)return;await seekTo(target);}
   if(disposed||id!==jumpId)return;pending=null;update();message(`已跳至 ${stamp(target)} · ${CHAPTERS[idx].title}`);await start();
  }catch{if(disposed||id!==jumpId)return;pending=null;message('暂时无法定位视频。请等待视频加载后重试，或下载演示视频观看。');update();}
 }
 const onPlay=()=>play.textContent='暂停演示',onPause=()=>play.textContent='播放演示';
 const onError=()=>{if(pending===null)q('[data-vd-error]').style.display='block';};
 video.addEventListener('timeupdate',update);video.addEventListener('loadedmetadata',update);video.addEventListener('play',onPlay);video.addEventListener('pause',onPause);video.addEventListener('ended',onPause);video.addEventListener('error',onError);
 play.onclick=()=>video.paused?start():video.pause();q('[data-vd-speed]').onchange=e=>video.playbackRate=Number(e.target.value);
 buttons.forEach((b,i)=>b.onclick=()=>jumpToChapter(i));
 q('[data-vd-subtitles]').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;try{if(file.size>2*1024*1024){message('字幕文件请小于 2 MB。');return;}const source=await file.text();if(!/^\uFEFF?WEBVTT(?:\s|$)/.test(source)){message('请选择以 WEBVTT 开头的 .vtt 字幕文件。');return;}video.querySelectorAll('track[data-local]').forEach(t=>t.remove());if(subtitleUrl)URL.revokeObjectURL(subtitleUrl);subtitleUrl=URL.createObjectURL(new Blob([source],{type:'text/vtt'}));const track=document.createElement('track');track.dataset.local='1';track.kind='captions';track.label='本地字幕';track.srclang='zh';track.src=subtitleUrl;track.default=true;track.onload=()=>track.track.mode='showing';video.append(track);track.track.mode='showing';message(`已载入字幕：${file.name}（仅当前浏览器）。`);}catch{message('未能读取字幕，请核对文件格式。');}};
 update();return()=>{disposed=true;++jumpId;aborter.abort();video.pause();video.removeEventListener('timeupdate',update);video.removeEventListener('loadedmetadata',update);video.removeEventListener('play',onPlay);video.removeEventListener('pause',onPause);video.removeEventListener('ended',onPause);video.removeEventListener('error',onError);if(subtitleUrl)URL.revokeObjectURL(subtitleUrl);if(bufferUrl)URL.revokeObjectURL(bufferUrl)};
}
