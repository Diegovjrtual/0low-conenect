const $=id=>document.getElementById(id);
const state={ws:null,userId:crypto.randomUUID(),userName:localStorage.getItem("0low_name")||"Diego",server:null,peers:new Map(),stream:null,inCall:false,screenTrack:null};
let toastTimer;
function toast(t){$("toast").textContent=t;$("toast").classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>$("toast").classList.remove("show"),3000)}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function wsURL(){return (location.protocol==="https:"?"wss":"ws")+"://"+location.host}
function connect(){if(state.ws&&[0,1].includes(state.ws.readyState))return;state.ws=new WebSocket(wsURL());state.ws.onopen=()=>{if(state.server)send({type:"join",code:state.server.code,userId:state.userId,userName:state.userName})};state.ws.onclose=()=>{state.ws=null;setTimeout(connect,1200)};state.ws.onerror=()=>{};state.ws.onmessage=onMessage}
function send(m){
  if(state.ws?.readyState===1){state.ws.send(JSON.stringify(m));return true}
  toast("Conectando ao servidor... tente novamente em 1 segundo.");
  connect();
  return false
}
function onMessage(e){let m;try{m=JSON.parse(e.data)}catch{return}
 if(m.type==="created"||m.type==="joined"){state.server=m.server;saveServer();renderServer();enableChat();if(m.members)renderMembers(m.members);toast(m.type==="created"?"Servidor criado!":"Você entrou no servidor!");return}
 if(m.type==="error"){toast(m.message);return}
 if(m.type==="user-joined"){addMember(m.user);if(state.inCall)makeOffer(m.user.id);return}
 if(m.type==="user-left"){removeMember(m.id);removePeer(m.id);return}
 if(m.type==="chat"){renderMessage(m.name,m.text,m.id===state.userId);return}
 if(m.type==="offer")handleOffer(m);if(m.type==="answer")handleAnswer(m);if(m.type==="ice")handleIce(m);if(m.type==="call-left")removePeer(m.id)
}
function saveServer(){localStorage.setItem("0low_server",JSON.stringify(state.server))}
function loadServer(){try{state.server=JSON.parse(localStorage.getItem("0low_server")||"null")}catch{}}
function renderServer(){$("serverName").textContent=state.server?.name||"0low Connect";$("serverCode").textContent=state.server?`Código: ${state.server.code}`:"Nenhum servidor";$("meName").textContent=state.userName;$("meAvatar").textContent=state.userName[0]?.toUpperCase()||"D";$("serverButtons").innerHTML=state.server?`<button class="createdServer selected">${esc(state.server.name.slice(0,2).toUpperCase())}</button>`:""}
function enableChat(){$("messageInput").disabled=!state.server;$("messageInput").placeholder=state.server?"Mensagem em #geral":"Crie ou entre em um servidor primeiro"}
function openModal(mode){$("modal").classList.remove("hidden");if(mode==="create"){ $("modalTitle").textContent="Criar servidor";$("modalDescription").textContent="Crie seu próprio servidor para conversar e fazer call.";$("modalInput").placeholder="Nome do servidor";$("modalInput").value="";$("modalAction").textContent="Criar servidor";$("modalHint").textContent="Depois você recebe um código para mandar para seu amigo.");$("modalAction").onclick=createServer}else{$("modalTitle").textContent="Entrar em servidor";$("modalDescription").textContent="Digite o código que seu amigo enviou.";$("modalInput").placeholder="Ex.: a1b2c3d4";$("modalInput").value="";$("modalAction").textContent="Entrar";$("modalHint").textContent="O código aparece no topo do servidor.";$("modalAction").onclick=joinServer}}
function closeModal(){$("modal").classList.add("hidden")}
function createServer(){let name=$("modalInput").value.trim()||"Meu servidor";state.server=null;connect();const wait=()=>{if(state.ws?.readyState===1){send({type:"create",name,userId:state.userId,userName:state.userName});closeModal()}else setTimeout(wait,100)};wait()}
function joinServer(){let code=$("modalInput").value.trim().toLowerCase();if(!code)return toast("Digite o código.");connect();const wait=()=>{if(state.ws?.readyState===1){send({type:"join",code,userId:state.userId,userName:state.userName});closeModal()}else setTimeout(wait,100)};wait()}
function renderMessage(name,text,mine){const welcome=$("messages").querySelector(".welcome");welcome?.remove();const d=document.createElement("div");d.className="msg";d.innerHTML=`<div class="avatar">${esc(name[0]?.toUpperCase()||"?")}</div><div class="msgBody"><b>${esc(name)}</b><time>${new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</time><p>${esc(text)}</p></div>`;$("messages").append(d);$("messages").scrollTop=$("messages").scrollHeight}
$("chatForm").onsubmit=e=>{e.preventDefault();const v=$("messageInput").value.trim();if(!v||!state.server)return;send({type:"chat",text:v});$("messageInput").value=""}
function addMember(u){if(document.getElementById("m"+u.id))return;const d=document.createElement("div");d.className="member";d.id="m"+u.id;d.innerHTML=`<div class="avatar">${esc(u.name[0]?.toUpperCase()||"?")}</div><b>${esc(u.name)}</b><i class="onlineDot"></i>`;$("memberList").append(d);updateCount()}
function removeMember(id){document.getElementById("m"+id)?.remove();updateCount()}
function renderMembers(list){$("memberList").innerHTML="";addMember({id:state.userId,name:state.userName});list.forEach(addMember);updateCount()}
function updateCount(){$("memberCount").textContent=$("memberList").children.length}
$("createBtn").onclick=()=>openModal("create");$("joinBtn").onclick=()=>openModal("join");$("modalClose").onclick=closeModal;$("settingsBtn").onclick=()=>settings();$("mobileGear").onclick=()=>settings();$("mobileSettings").onclick=()=>settings();
$("serverMenu").onclick=()=>state.server?toast(`Código do servidor: ${state.server.code}`):toast("Crie ou entre em um servidor.");
$("inviteBtn").onclick=async()=>{
  if(!state.server)return toast("Crie um servidor primeiro.");
  const link=location.origin+"/?server="+encodeURIComponent(state.server.code);
  try{
    await navigator.clipboard.writeText(link);
    toast("Link de convite copiado!");
  }catch{
    toast("Código: "+state.server.code);
  }
};
function settings(){openModal("settings");$("modalTitle").textContent="Configurações";$("modalDescription").textContent="Seu nome aparece para as pessoas do servidor.";$("modalInput").placeholder="Seu nome";$("modalInput").value=state.userName;$("modalAction").textContent="Salvar";$("modalHint").textContent="Isso fica salvo neste celular."; $("modalAction").onclick=()=>{state.userName=$("modalInput").value.trim()||"Usuário";localStorage.setItem("0low_name",state.userName);renderServer();closeModal();toast("Nome salvo.")}}
$("voiceChannel").onclick=startCall;$("screenChannel").onclick=startCall;$("mobileCall").onclick=startCall;$("closeCall").onclick=leaveCall;$("hangupBtn").onclick=leaveCall;
async function startCall(){if(!state.server)return toast("Crie ou entre em um servidor primeiro.");$("callPanel").classList.remove("hidden");if(state.inCall)return;try{state.stream=await navigator.mediaDevices.getUserMedia({video:true,audio:true});state.inCall=true;showVideo(state.userId,state.stream,state.userName,true);for(const [id] of state.peers)await makeOffer(id);toast("Você entrou na call.")}catch(e){toast("Permita câmera e microfone no navegador.");$("callPanel").classList.add("hidden")}}
async function leaveCall(){state.inCall=false;state.stream?.getTracks().forEach(t=>t.stop());state.stream=null;state.peers.forEach(p=>p.close());state.peers.clear();$("videos").innerHTML='<div class="callEmpty">Entre na call para ligar câmera/microfone.</div>';send({type:"leave-call"})}
function peer(pid){if(state.peers.has(pid))return state.peers.get(pid);const p=new RTCPeerConnection({iceServers:[{urls:"stun:stun.l.google.com:19302"}]});state.stream?.getTracks().forEach(t=>p.addTrack(t,state.stream));p.onicecandidate=e=>e.candidate&&send({type:"ice",to:pid,candidate:e.candidate});p.ontrack=e=>showVideo(pid,e.streams[0],"Amigo",false);state.peers.set(pid,p);return p}
async function makeOffer(pid){if(!state.inCall)return;const p=peer(pid);try{const o=await p.createOffer();await p.setLocalDescription(o);send({type:"offer",to:pid,offer:p.localDescription})}catch{}}
async function handleOffer(m){if(!state.inCall)return;const p=peer(m.from);try{await p.setRemoteDescription(m.offer);await p.setLocalDescription(await p.createAnswer());send({type:"answer",to:m.from,answer:p.localDescription})}catch{}}
async function handleAnswer(m){const p=state.peers.get(m.from);if(p)try{await p.setRemoteDescription(m.answer)}catch{}}
async function handleIce(m){const p=state.peers.get(m.from);if(p&&m.candidate)try{await p.addIceCandidate(m.candidate)}catch{}}
function showVideo(id,stream,name,mine){let tile=document.getElementById("v"+id);if(!tile){tile=document.createElement("div");tile.className="videoTile";tile.id="v"+id;tile.innerHTML=`<video autoplay playsinline ${mine?"muted":""}></video><div class="videoLabel">${esc(name)}</div>`;$("videos").querySelector(".callEmpty")?.remove();$("videos").append(tile)}tile.querySelector("video").srcObject=stream}
function removePeer(id){state.peers.get(id)?.close();state.peers.delete(id);document.getElementById("v"+id)?.remove()}
$("micBtn").onclick=()=>{state.stream?.getAudioTracks().forEach(t=>t.enabled=!t.enabled);$("micBtn").textContent=state.stream?.getAudioTracks()[0]?.enabled?"🎙️":"🔇"}
$("camBtn").onclick=()=>{state.stream?.getVideoTracks().forEach(t=>t.enabled=!t.enabled);$("camBtn").textContent=state.stream?.getVideoTracks()[0]?.enabled?"📷":"🚫"}
$("screenBtn").onclick=async()=>{if(!state.inCall)return toast("Entre na call primeiro.");try{const s=await navigator.mediaDevices.getDisplayMedia({video:true});const t=s.getVideoTracks()[0];for(const p of state.peers.values()){const sender=p.getSenders().find(x=>x.track?.kind==="video");if(sender)await sender.replaceTrack(t)}showVideo(state.userId,s,state.userName,true);t.onended=()=>state.stream?.getVideoTracks()[0]&&state.peers.forEach(p=>p.getSenders().find(x=>x.track?.kind==="video")?.replaceTrack(state.stream.getVideoTracks()[0]))}catch{}}
$("membersBtn").onclick=()=>{$("memberPanel").style.display=$("memberPanel").style.display==="none"?"block":""};$("mobileMembers").onclick=()=>{$("memberPanel").style.display="block"};$("mobileServers").onclick=()=>toast("Use ＋ para criar e ↗ para entrar.");
$("attachBtn").onclick=()=>toast("Anexos podem ser adicionados depois.");
window.addEventListener("beforeunload",()=>state.ws?.close());
loadServer();renderServer();enableChat();connect();
const qs=new URLSearchParams(location.search);if(qs.get("server")){setTimeout(()=>{openModal("join");$("modalInput").value=qs.get("server")},500)}