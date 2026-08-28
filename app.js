(function(){
"use strict";

function boot(){
  function $(id){ return document.getElementById(id); }
  var state={
    ws:null,
    userId:"u_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2),
    userName:localStorage.getItem("0low_name")||"Diego",
    server:null,
    peers:{},
    stream:null,
    inCall:false
  };
  var toastTimer=null;

  function toast(text){
    var el=$("toast");
    if(!el){ alert(text); return; }
    el.textContent=text;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer=setTimeout(function(){el.classList.remove("show");},3000);
  }

  function esc(s){
    return String(s).replace(/[&<>"']/g,function(c){
      return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];
    });
  }

  function wsURL(){
    return (location.protocol==="https:"?"wss://":"ws://")+location.host;
  }

  function send(obj){
    if(state.ws && state.ws.readyState===1){
      state.ws.send(JSON.stringify(obj));
      return true;
    }
    toast("Conectando... tente novamente.");
    connect();
    return false;
  }

  function connect(){
    if(state.ws && (state.ws.readyState===0 || state.ws.readyState===1)) return;
    try{
      state.ws=new WebSocket(wsURL());
      state.ws.onopen=function(){
        if(state.server){
          send({type:"join",code:state.server.code,userId:state.userId,userName:state.userName});
        }
      };
      state.ws.onmessage=onMessage;
      state.ws.onclose=function(){
        state.ws=null;
        setTimeout(connect,1500);
      };
      state.ws.onerror=function(){};
    }catch(e){
      setTimeout(connect,2000);
    }
  }

  function onMessage(ev){
    var m;
    try{m=JSON.parse(ev.data);}catch(e){return;}

    if(m.type==="created" || m.type==="joined"){
      state.server=m.server;
      localStorage.setItem("0low_server",JSON.stringify(state.server));
      renderServer();
      enableChat();
      renderMembers(m.members||[]);
      toast(m.type==="created"?"Servidor criado!":"Você entrou!");
      return;
    }

    if(m.type==="error"){ toast(m.message||"Erro"); return; }
    if(m.type==="chat"){ renderMessage(m.name,m.text,m.id===state.userId); return; }
    if(m.type==="user-joined"){
      addMember(m.user);
      if(state.inCall) makeOffer(m.user.id);
      return;
    }
    if(m.type==="user-left"){
      removeMember(m.id);
      removePeer(m.id);
      return;
    }
    if(m.type==="offer"){ handleOffer(m); return; }
    if(m.type==="answer"){ handleAnswer(m); return; }
    if(m.type==="ice"){ handleIce(m); return; }
    if(m.type==="call-left"){ removePeer(m.id); }
  }

  function renderServer(){
    $("serverName").textContent=state.server?state.server.name:"0low Connect";
    $("serverCode").textContent=state.server?"Código: "+state.server.code:"Nenhum servidor";
    $("meName").textContent=state.userName;
    $("meAvatar").textContent=(state.userName.charAt(0)||"D").toUpperCase();
    $("serverButtons").innerHTML=state.server?
      '<button class="createdServer selected">'+esc(state.server.name.slice(0,2).toUpperCase())+"</button>":"";
  }

  function enableChat(){
    $("messageInput").disabled=!state.server;
    $("messageInput").placeholder=state.server?
      "Mensagem em #geral":"Crie ou entre em um servidor primeiro";
  }

  function openModal(mode){
    var modal=$("modal");
    if(!modal){toast("Tela de criação não encontrada.");return;}
    modal.classList.remove("hidden");

    if(mode==="create"){
      $("modalTitle").textContent="Criar servidor";
      $("modalDescription").textContent="Crie seu servidor para conversar e fazer call.";
      $("modalInput").placeholder="Nome do servidor";
      $("modalInput").value="";
      $("modalAction").textContent="Criar servidor";
      $("modalHint").textContent="Você receberá um código.";
      $("modalAction").onclick=createServer;
    }else if(mode==="join"){
      $("modalTitle").textContent="Entrar em servidor";
      $("modalDescription").textContent="Digite o código do servidor.";
      $("modalInput").placeholder="Código";
      $("modalInput").value="";
      $("modalAction").textContent="Entrar";
      $("modalHint").textContent="Use o código enviado pelo seu amigo.";
      $("modalAction").onclick=joinServer;
    }
  }

  function closeModal(){ $("modal").classList.add("hidden"); }

  function createServer(){
    var name=$("modalInput").value.trim()||"Meu servidor";
    state.server=null;
    var wait=setInterval(function(){
      if(state.ws && state.ws.readyState===1){
        clearInterval(wait);
        send({type:"create",name:name,userId:state.userId,userName:state.userName});
        closeModal();
      }
    },100);
    connect();
    setTimeout(function(){clearInterval(wait);},10000);
  }

  function joinServer(){
    var code=$("modalInput").value.trim().toLowerCase();
    if(!code){toast("Digite o código.");return;}
    var wait=setInterval(function(){
      if(state.ws && state.ws.readyState===1){
        clearInterval(wait);
        send({type:"join",code:code,userId:state.userId,userName:state.userName});
        closeModal();
      }
    },100);
    connect();
    setTimeout(function(){clearInterval(wait);},10000);
  }

  function renderMessage(name,text,mine){
    var w=$("messages").querySelector(".welcome");
    if(w)w.remove();
    var d=document.createElement("div");
    d.className="msg";
    d.innerHTML='<div class="avatar">'+esc((name||"?").charAt(0).toUpperCase())+
      '</div><div class="msgBody"><b>'+esc(name)+'</b><time>'+
      new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})+
      '</time><p>'+esc(text)+'</p></div>';
    $("messages").appendChild(d);
    $("messages").scrollTop=$("messages").scrollHeight;
  }

  function addMember(u){
    if(!u || document.getElementById("m"+u.id))return;
    var d=document.createElement("div");
    d.className="member";
    d.id="m"+u.id;
    d.innerHTML='<div class="avatar">'+esc((u.name||"?").charAt(0).toUpperCase())+
      '</div><b>'+esc(u.name)+'</b><i class="onlineDot"></i>';
    $("memberList").appendChild(d);
    updateCount();
  }

  function removeMember(id){
    var d=document.getElementById("m"+id);
    if(d)d.remove();
    updateCount();
  }

  function renderMembers(list){
    $("memberList").innerHTML="";
    addMember({id:state.userId,name:state.userName});
    for(var i=0;i<list.length;i++)addMember(list[i]);
  }

  function updateCount(){ $("memberCount").textContent=$("memberList").children.length; }

  $("createBtn").addEventListener("click",function(e){e.preventDefault();openModal("create");});
  $("joinBtn").addEventListener("click",function(e){e.preventDefault();openModal("join");});
  $("modalClose").addEventListener("click",closeModal);

  $("chatForm").addEventListener("submit",function(e){
    e.preventDefault();
    var v=$("messageInput").value.trim();
    if(v && state.server && send({type:"chat",text:v}))$("messageInput").value="";
  });

  $("inviteBtn").addEventListener("click",function(){
    if(!state.server){toast("Crie um servidor primeiro.");return;}
    var link=location.origin+"/?server="+encodeURIComponent(state.server.code);
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(link).then(function(){toast("Link copiado!");})
      .catch(function(){toast("Código: "+state.server.code);});
    }else toast("Código: "+state.server.code);
  });

  $("settingsBtn").addEventListener("click",function(){
    openModal("join");
    $("modalTitle").textContent="Configurações";
    $("modalDescription").textContent="Altere seu nome.";
    $("modalInput").value=state.userName;
    $("modalAction").textContent="Salvar";
    $("modalAction").onclick=function(){
      state.userName=$("modalInput").value.trim()||"Usuário";
      localStorage.setItem("0low_name",state.userName);
      renderServer();closeModal();toast("Nome salvo!");
    };
  });
  $("mobileSettings").addEventListener("click",function(){$("settingsBtn").click();});
  $("mobileGear").addEventListener("click",function(){$("settingsBtn").click();});

  $("serverMenu").addEventListener("click",function(){
    toast(state.server?"Código: "+state.server.code:"Crie ou entre em um servidor.");
  });

  $("voiceChannel").addEventListener("click",startCall);
  $("screenChannel").addEventListener("click",startCall);
  $("mobileCall").addEventListener("click",startCall);
  $("closeCall").addEventListener("click",leaveCall);
  $("hangupBtn").addEventListener("click",leaveCall);

  $("membersBtn").addEventListener("click",function(){
    $("memberPanel").style.display=$("memberPanel").style.display==="none"?"block":"";
  });
  $("mobileMembers").addEventListener("click",function(){$("memberPanel").style.display="block";});
  $("mobileServers").addEventListener("click",function(){toast("Use + para criar ou ↗ para entrar.");});
  $("attachBtn").addEventListener("click",function(){toast("Anexos em breve.");});

  function startCall(){
    if(!state.server){toast("Crie ou entre em um servidor primeiro.");return;}
    if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
      toast("Câmera/microfone não disponíveis neste navegador.");
      return;
    }
    $("callPanel").classList.remove("hidden");
    if(state.inCall)return;
    navigator.mediaDevices.getUserMedia({video:true,audio:true}).then(function(stream){
      state.stream=stream;
      state.inCall=true;
      showVideo(state.userId,stream,state.userName,true);
      for(var id in state.peers)makeOffer(id);
      toast("Você entrou na call!");
    }).catch(function(){toast("Permita câmera e microfone no navegador.");$("callPanel").classList.add("hidden");});
  }

  function leaveCall(){
    state.inCall=false;
    if(state.stream){
      state.stream.getTracks().forEach(function(t){t.stop();});
      state.stream=null;
    }
    for(var id in state.peers){try{state.peers[id].close();}catch(e){}}
    state.peers={};
    $("videos").innerHTML='<div class="callEmpty">Entre na call para ligar câmera/microfone.</div>';
    send({type:"leave-call"});
  }

  function peer(pid){
    if(state.peers[pid])return state.peers[pid];
    var p=new RTCPeerConnection({iceServers:[{urls:"stun:stun.l.google.com:19302"}]});
    if(state.stream)state.stream.getTracks().forEach(function(t){p.addTrack(t,state.stream);});
    p.onicecandidate=function(e){if(e.candidate)send({type:"ice",to:pid,candidate:e.candidate});};
    p.ontrack=function(e){if(e.streams[0])showVideo(pid,e.streams[0],"Amigo",false);};
    state.peers[pid]=p;
    return p;
  }

  function makeOffer(pid){
    if(!state.inCall)return;
    var p=peer(pid);
    p.createOffer().then(function(o){
      return p.setLocalDescription(o);
    }).then(function(){
      send({type:"offer",to:pid,offer:p.localDescription});
    }).catch(function(){});
  }

  function handleOffer(m){
    if(!state.inCall)return;
    var p=peer(m.from);
    p.setRemoteDescription(m.offer).then(function(){
      return p.setLocalDescription(p.createAnswer());
    }).then(function(){
      send({type:"answer",to:m.from,answer:p.localDescription});
    }).catch(function(){});
  }

  function handleAnswer(m){
    var p=state.peers[m.from];
    if(p)p.setRemoteDescription(m.answer).catch(function(){});
  }

  function handleIce(m){
    var p=state.peers[m.from];
    if(p && m.candidate)p.addIceCandidate(m.candidate).catch(function(){});
  }

  function showVideo(id,stream,name,mine){
    var tile=document.getElementById("v"+id);
    if(!tile){
      tile=document.createElement("div");
      tile.className="videoTile";
      tile.id="v"+id;
      tile.innerHTML='<video autoplay playsinline '+(mine?'muted':'')+'></video><div class="videoLabel">'+esc(name)+'</div>';
      var empty=$("videos").querySelector(".callEmpty");
      if(empty)empty.remove();
      $("videos").appendChild(tile);
    }
    tile.querySelector("video").srcObject=stream;
  }

  function removePeer(id){
    if(state.peers[id]){try{state.peers[id].close();}catch(e){}delete state.peers[id];}
    var v=document.getElementById("v"+id);if(v)v.remove();
  }

  $("micBtn").addEventListener("click",function(){
    if(!state.stream){toast("Entre na call primeiro.");return;}
    var tracks=state.stream.getAudioTracks();
    if(tracks.length){tracks[0].enabled=!tracks[0].enabled;$("micBtn").textContent=tracks[0].enabled?"🎙️":"🔇";}
  });
  $("camBtn").addEventListener("click",function(){
    if(!state.stream){toast("Entre na call primeiro.");return;}
    var tracks=state.stream.getVideoTracks();
    if(tracks.length){tracks[0].enabled=!tracks[0].enabled;$("camBtn").textContent=tracks[0].enabled?"📷":"🚫";}
  });

  $("screenBtn").addEventListener("click",function(){
    if(!state.inCall){toast("Entre na call primeiro.");return;}
    if(!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia){toast("Compartilhamento de tela não é suportado neste navegador.");return;}
    navigator.mediaDevices.getDisplayMedia({video:true}).then(function(s){
      var t=s.getVideoTracks()[0];
      for(var id in state.peers){
        var senders=state.peers[id].getSenders();
        for(var i=0;i<senders.length;i++){
          if(senders[i].track && senders[i].track.kind==="video")senders[i].replaceTrack(t);
        }
      }
      showVideo(state.userId,s,state.userName,true);
    }).catch(function(){toast("Compartilhamento cancelado.");});
  });

  try{
    state.server=JSON.parse(localStorage.getItem("0low_server")||"null");
  }catch(e){state.server=null;}

  renderServer();
  enableChat();
  connect();

  var qs=new URLSearchParams(location.search);
  if(qs.get("server")){
    setTimeout(function(){
      openModal("join");
      $("modalInput").value=qs.get("server");
    },500);
  }
}

if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);
else boot();
})();