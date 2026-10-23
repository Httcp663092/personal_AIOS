const $ = id => document.getElementById(id);
const invoke = (cmd,args) => window.__TAURI__.core.invoke(cmd,args);
async function api(method,path,body=null){return invoke('api',{method,path,body});}
function notice(text,error=false){$('notice').textContent=text;$('notice').classList.toggle('error',error);}
function fail(e){notice(String(e),true);}
const titles={chat:'开始一段对话',models:'模型与节点',knowledge:'你的知识库',settings:'偏好设置'};
document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>{
 document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t===b));
 document.querySelectorAll('.page').forEach(p=>p.classList.toggle('hidden',p.id!==b.dataset.page));
 $('title').textContent=titles[b.dataset.page];
}));
function message(role,content,source=''){
 const box=document.createElement('div');box.className='message '+role;
 const name=document.createElement('div');name.className='role';name.textContent=role==='user'?'你':'PERSONAL AI';box.append(name);
 const text=document.createElement('div');text.textContent=content;box.append(text);
 if(source){const s=document.createElement('p');s.className='source';s.textContent=source;box.append(s);}
 $('messages').append(box);box.scrollIntoView({block:'end'});
}
async function history(){const rows=await api('GET','/messages');$('messages').replaceChildren();if(!rows.length){const e=document.createElement('div');e.className='empty';e.textContent='你好，今天想做什么？';$('messages').append(e);}rows.forEach(r=>message(r.role,r.content));}
let chatting=false;
$('chatForm').addEventListener('submit',async e=>{
 e.preventDefault();const text=$('prompt').value.trim();if(!text||chatting)return;
 chatting=true;$('send').disabled=true;$('clearChat').disabled=true;
 $('messages').querySelector('.empty')?.remove();message('user',text);notice('正在本地推理…');
 try{const r=await api('POST','/chat',{message:text,knowledge:$('useKnowledge').checked});message('assistant',r.content,'节点：'+r.node+' · 参考：'+(r.sources.map(s=>'['+s.id+'] '+s.name).join('、')||'无'));$('prompt').value='';notice('回答已保存在本机');}
 catch(e){fail(e);message('assistant','本次请求失败，未保存。请检查节点与模型状态后重试。');}
 finally{chatting=false;$('send').disabled=false;$('clearChat').disabled=false;}
});
$('prompt').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();$('chatForm').requestSubmit();}});
$('clearChat').onclick=async()=>{if(confirm('清空本机的全部聊天记录？'))try{await api('DELETE','/messages');await history();notice('聊天已清空');}catch(e){fail(e);}};
async function status(){
 const r=await api('GET','/status');$('nodes').replaceChildren();
 for(const n of r.nodes){const el=document.createElement('div');el.className='node';const info=document.createElement('div');const name=document.createElement('strong');name.textContent=n.node==='local'?'本机 Ollama':'Mac M5 节点';const models=document.createElement('p');models.textContent=n.models.map(m=>m.name).join('、')||'暂无可用模型';info.append(name,models);const tag=document.createElement('span');tag.className=n.online?'online':'offline';tag.textContent=n.online?'已连接':'离线';el.append(info,tag);$('nodes').append(el);}
 notice(r.nodes.some(n=>n.online)?'节点状态已更新 · 当前模型 '+r.settings.model:'未连接 Ollama，请先启动 Ollama，再下载本地模型。');
}
$('refresh').onclick=()=>status().catch(fail);
$('pull').onclick=async()=>{
 if(!confirm('下载模型可能需要数 GB 空间并使用网络，确认开始？'))return;
 $('pull').disabled=true;$('deleteModel').disabled=true;$('modelProgress').textContent='正在下载，请保持应用运行；初次下载可能较久…';
 try{await api('POST','/models/pull',{name:$('modelName').value.trim()});$('modelProgress').textContent='下载完成。请在偏好设置中选择相同模型标签。';await status();}catch(e){$('modelProgress').textContent='下载失败，可重试；已下载的层通常可继续使用。';fail(e);}finally{$('pull').disabled=false;$('deleteModel').disabled=false;}
};
$('deleteModel').onclick=async()=>{if(confirm('从本机 Ollama 删除此模型？其他应用也可能正在使用。'))try{await api('DELETE','/models',{name:$('modelName').value.trim()});await status();}catch(e){fail(e);}};
async function documents(){
 const docs=await api('GET','/documents');$('documents').replaceChildren();
 for(const d of docs){const row=document.createElement('div');row.className='doc';const t=document.createElement('span');t.textContent=d.name+' · '+d.size+' 字符';const b=document.createElement('button');b.textContent='删除';b.onclick=async()=>{if(confirm('删除此知识文件？'))try{await api('DELETE','/documents/'+d.id);await documents();}catch(e){fail(e);}};row.append(t,b);$('documents').append(row);}
}
$('file').onchange=async()=>{const f=$('file').files[0];if(!f)return;try{if(f.size>2000000)throw Error('文件超过 2 MB');const content=new TextDecoder('utf-8',{fatal:true}).decode(await f.arrayBuffer());await api('POST','/documents',{name:f.name,content});await documents();notice('知识文件已导入本机');}catch(e){fail(e);}finally{$('file').value='';}};
async function loadSettings(){const s=await api('GET','/settings');$('selectedModel').value=s.model;$('primary').value=s.primary;$('macEnabled').checked=s.mac_enabled;$('macUrl').value=s.mac_url;$('fallback').checked=s.fallback;}
$('settingsForm').onsubmit=async e=>{e.preventDefault();try{await api('PUT','/settings',{model:$('selectedModel').value.trim(),primary:$('primary').value,mac_enabled:$('macEnabled').checked,mac_url:$('macUrl').value.trim(),fallback:$('fallback').checked});notice('偏好设置已保存');}catch(e){fail(e);}};
$('autostart').onchange=async()=>{try{await invoke('plugin:autostart|'+($('autostart').checked?'enable':'disable'));notice('开机自启设置已更新');}catch(e){$('autostart').checked=!$('autostart').checked;fail(e);}};
async function start(){
 let ready=false;for(let i=0;i<30;i++){try{await api('GET','/health');ready=true;break;}catch{await new Promise(r=>setTimeout(r,500));}}
 if(!ready){notice('后台服务未启动。请退出托盘并重新打开；若持续失败，请检查安全软件。',true);return;}
 try{await loadSettings();await history();await documents();await status();$('autostart').checked=await invoke('plugin:autostart|is_enabled');}catch(e){fail(e);}
}
start();
