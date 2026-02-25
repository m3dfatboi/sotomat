// Shared UI components — depends on utils.js being loaded first

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
    </svg>
  );
}

function Avatar({ name, size }) {
  size = size || 36;
  const [,bump] = React.useState(0);
  React.useEffect(function(){
    var h = function(){ bump(function(v){ return v+1; }); };
    window.addEventListener("ac", h);
    return function(){ window.removeEventListener("ac", h); };
  }, []);
  var url = AC[name];
  if (url) return <img src={url+"?v="+AV} alt={name} style={{width:size,height:size,borderRadius:"50%",objectFit:"cover",display:"block",flexShrink:0}}/>;
  var idx = name.charCodeAt(0) % AVATAR_COLORS.length;
  var initials = name.split(" ").map(function(w){ return w[0]; }).join("").toUpperCase().slice(0,2);
  return <div style={{width:size,height:size,borderRadius:"50%",background:AVATAR_COLORS[idx],color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*.38,fontWeight:700,flexShrink:0,userSelect:"none"}}>{initials}</div>;
}

function EditableAvatar({ name, size, playerId, initialUrl, onAvatarUpdate }) {
  size = size || 36;
  const [has, setHas] = React.useState(!!initialUrl);
  const [ts, setTs] = React.useState(Date.now());
  const [hover, setHover] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(function(){ setHas(!!initialUrl); }, [initialUrl]);
  var onFile = async function(e) {
    var file = e.target.files && e.target.files[0];
    if (!file || !playerId) return;
    try {
      var fd = new FormData(); fd.append("file", file);
      var r = await fetch("/api/players/"+playerId+"/avatar", {method:"POST", body:fd});
      if (r.ok) {
        var t = Date.now(); setHas(true); setTs(t);
        AC[name] = "/api/players/"+playerId+"/avatar"; AV = t;
        window.dispatchEvent(new CustomEvent("ac"));
        if (onAvatarUpdate) onAvatarUpdate();
      }
    } catch(e2) {}
    e.target.value = "";
  };
  var src2 = has && playerId ? "/api/players/"+playerId+"/avatar?t="+ts : null;
  return (
    <div style={{position:"relative",width:size,height:size,flexShrink:0}}
      onMouseEnter={function(){ setHover(true); }}
      onMouseLeave={function(){ setHover(false); }}
      onClick={function(){ if(ref.current) ref.current.click(); }}
      title="Загрузить фото">
      {src2
        ? <img src={src2} alt={name} style={{width:size,height:size,borderRadius:"50%",objectFit:"cover",display:"block",cursor:"pointer"}}/>
        : <div style={{cursor:"pointer"}}><Avatar name={name} size={size}/></div>
      }
      {hover && <div style={{position:"absolute",inset:0,borderRadius:"50%",cursor:"pointer",background:"rgba(0,0,0,0.45)",display:"flex",alignItems:"center",justifyContent:"center"}}>
        <svg width={size*.38} height={size*.38} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
        </svg>
      </div>}
      <input ref={ref} type="file" accept="image/*" style={{display:"none"}} onChange={onFile}/>
    </div>
  );
}

function PlayerSelect({ value, onChange, players, placeholder, busyNames }) {
  const [open, setOpen] = React.useState(false);
  const [ds, setDs] = React.useState({});
  const tRef = React.useRef(null), dRef = React.useRef(null);
  busyNames = busyNames || [];
  var calc = function() {
    if (!tRef.current) return;
    var r = tRef.current.getBoundingClientRect();
    setDs({position:"fixed",top:r.bottom+4,left:r.left,width:r.width,zIndex:9999});
  };
  React.useEffect(function(){
    var onD = function(e) {
      if (!(tRef.current && tRef.current.contains(e.target)) && !(dRef.current && dRef.current.contains(e.target))) setOpen(false);
    };
    document.addEventListener("mousedown", onD);
    return function(){ document.removeEventListener("mousedown", onD); };
  }, []);
  var toggle = function(){ calc(); setOpen(function(o){ return !o; }); };
  var sel = players.find(function(pl){ return String(pl.id) === String(value); });
  var drop = open ? (
    <div ref={dRef} style={{...ds,background:"#fff",borderRadius:8,border:"1px solid #E8EAEC",boxShadow:"0 8px 24px rgba(0,0,0,.14)",maxHeight:220,overflowY:"auto"}}>
      {players.length===0 && <div style={{padding:"12px 14px",color:"#8C9BAB",fontSize:13}}>Нет игроков</div>}
      {players.map(function(pl){
        var busy = busyNames.includes(pl.name) && String(pl.id) !== String(value);
        return (
          <div key={pl.id} onClick={function(){ onChange(String(pl.id)); setOpen(false); }}
            style={{display:"flex",alignItems:"center",gap:10,padding:"9px 14px",cursor:"pointer",background:String(pl.id)===String(value)?"#FEF3E8":"#fff"}}
            onMouseEnter={function(e){ e.currentTarget.style.background="#FAFBFC"; }}
            onMouseLeave={function(e){ e.currentTarget.style.background=String(pl.id)===String(value)?"#FEF3E8":"#fff"; }}>
            <Avatar name={pl.name} size={26}/>
            <span style={{fontWeight:600,fontSize:14,flex:1}}>{pl.name}</span>
            <span style={{color:"#8C9BAB",fontSize:12}}>{pl.rating}</span>
            {busy && <span style={{fontSize:11,color:"#E8822A",fontWeight:700}} title="Уже в другом матче">✓ в матче</span>}
          </div>
        );
      })}
    </div>
  ) : null;
  return (
    <div style={{position:"relative"}}>
      <div ref={tRef} onClick={toggle}
        style={{display:"flex",alignItems:"center",gap:10,padding:"0 36px 0 12px",height:42,boxSizing:"border-box",borderRadius:8,border:"1px solid #E8EAEC",background:"#fff",cursor:"pointer",fontSize:14,color:sel?"#1A1A1A":"#8C9BAB",position:"relative",userSelect:"none",overflow:"hidden"}}>
        {sel
          ? <><Avatar name={sel.name} size={24}/><span style={{fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{sel.name}</span><span style={{color:"#8C9BAB",fontSize:12,flexShrink:0}}>{sel.rating} очков</span></>
          : <span style={{whiteSpace:"nowrap"}}>{placeholder}</span>
        }
        <span style={{position:"absolute",right:12,top:"50%",transform:open?"translateY(-50%) rotate(180deg)":"translateY(-50%)",color:"#8C9BAB",fontSize:10,transition:"transform .15s",lineHeight:1,pointerEvents:"none"}}>▼</span>
      </div>
      {ReactDOM.createPortal(drop, document.body)}
    </div>
  );
}

function TeamCell({ name, name2, isWinner, align, size, ratings }) {
  align = align || "left"; size = size || 28;
  var win="#2E7D32", lose="#8C9BAB", isRight = align==="right";
  var row = function(n) {
    var rating = ratings && ratings[n];
    return (
      <div style={{display:"flex",flexDirection:isRight?"row-reverse":"row",alignItems:"center",gap:8}}>
        <Avatar name={n} size={size}/>
        <div style={{display:"flex",flexDirection:"column",gap:1,alignItems:isRight?"flex-end":"flex-start"}}>
          <span style={{fontWeight:isWinner?700:400,color:isWinner?win:lose,fontSize:14,lineHeight:1.3,whiteSpace:"nowrap"}}>{n}</span>
          {rating!==undefined && <span style={{fontSize:11,color:"#8C9BAB"}}>{rating}</span>}
        </div>
      </div>
    );
  };
  return <div style={{display:"flex",flexDirection:"column",gap:6,alignItems:isRight?"flex-end":"flex-start"}}>{row(name)}{name2?row(name2):null}</div>;
}

function RankPill({ rating }) {
  var rank = getRank(rating);
  return <span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:20,display:"inline-block",color:rank.color,background:rank.bg}}>{rank.label}</span>;
}

function DeltaBadge({ d, name, right }) {
  var green = d > 0;
  return (
    <span style={{fontSize:11,fontWeight:700,display:"flex",alignItems:"center",gap:4,color:green?"#2E7D32":"#C62828"}}>
      {right && <span style={{color:"#8C9BAB",fontWeight:400}}>{name}</span>}
      <span style={{padding:"2px 7px",borderRadius:20,background:green?"#E8F5E9":"#FFEBEE"}}>{green?"+":""}{d}</span>
      {!right && <span style={{color:"#8C9BAB",fontWeight:400}}>{name}</span>}
    </span>
  );
}

function StatCard({ label, value, icon, accent }) {
  return (
    <div style={{background:accent?"#E8822A":"#fff",borderRadius:12,border:"1px solid #E8EAEC",padding:"14px 18px"}}>
      <div style={{fontSize:18,marginBottom:6}}>{icon}</div>
      <div style={{fontSize:24,fontWeight:800,lineHeight:1,color:accent?"#fff":"#1A1A1A"}}>{value}</div>
      <div style={{fontSize:11,marginTop:4,color:accent?"rgba(255,255,255,.8)":"#8C9BAB"}}>{label}</div>
    </div>
  );
}

function Spinner() {
  return (
    <div style={{display:"flex",justifyContent:"center",padding:80}}>
      <div className="spinner" style={{width:36,height:36,borderRadius:"50%",border:"3px solid #E8EAEC",borderTop:"3px solid #E8822A"}}/>
    </div>
  );
}

function ConfirmModal({ text, onConfirm, onCancel, loading }) {
  return (
    <div className="modal-bg" onClick={function(e){ if(e.target===e.currentTarget) onCancel(); }}
      style={{position:"fixed",inset:0,background:"rgba(0,0,0,.45)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:"#fff",borderRadius:16,padding:28,maxWidth:380,width:"100%",boxShadow:"0 24px 64px rgba(0,0,0,.22)"}}>
        <div style={{fontSize:16,fontWeight:700,marginBottom:10}}>Подтверждение</div>
        <div style={{fontSize:14,color:"#8C9BAB",lineHeight:1.55,marginBottom:24}}>{text}</div>
        <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
          <button onClick={onCancel} style={btnOutline} disabled={loading}>Отмена</button>
          <button onClick={onConfirm} style={{...btnDanger,opacity:loading?.5:1}} disabled={loading}>{loading?"Удаление...":"Удалить"}</button>
        </div>
      </div>
    </div>
  );
}

function Empty({ text }) {
  return (
    <div style={{textAlign:"center",padding:"72px 20px"}}>
      <div style={{fontSize:52}}>🏓</div>
      <div style={{fontSize:15,color:"#8C9BAB",marginTop:12,lineHeight:1.5}}>{text}</div>
    </div>
  );
}
