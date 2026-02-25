// All modal components — depends on utils.js + components.js

function NewMatchModal({ players, onClose, onSubmit, savedP1, savedP2, onSavePlayers }) {
  const [mode, setMode] = React.useState("1v1");
  const [p1, setP1] = React.useState(savedP1||"");
  const [p1b, setP1b] = React.useState("");
  const [p2, setP2] = React.useState(savedP2||"");
  const [p2b, setP2b] = React.useState("");
  const [s1, setS1] = React.useState("");
  const [s2, setS2] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");
  var is2v2 = mode === "2v2";
  var p1obj  = players.find(function(p){ return p.id === parseInt(p1);  });
  var p1bobj = players.find(function(p){ return p.id === parseInt(p1b); });
  var p2obj  = players.find(function(p){ return p.id === parseInt(p2);  });
  var p2bobj = players.find(function(p){ return p.id === parseInt(p2b); });
  var allIds2v2 = [p1,p1b,p2,p2b].filter(Boolean);
  var noDupes2v2 = (new Set(allIds2v2)).size === allIds2v2.length;
  var valid = is2v2
    ? p1&&p1b&&p2&&p2b&&noDupes2v2&&s1!==""&&s2!==""&&parseInt(s1)!==parseInt(s2)
    : p1&&p2&&p1!==p2&&s1!==""&&s2!==""&&parseInt(s1)!==parseInt(s2);

  var handleSubmit = async function() {
    if (!valid||busy) return;
    setBusy(true); setErr("");
    try {
      var payload = {
        p1_name: p1obj.name, p2_name: p2obj.name,
        score1: parseInt(s1), score2: parseInt(s2),
        ...(is2v2 && { p1b_name: p1bobj.name, p2b_name: p2bobj.name }),
      };
      await onSubmit(payload);
      if (onSavePlayers) onSavePlayers(p1, p2);
      onClose();
    } catch(e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  var usedIds = is2v2 ? [p1,p1b,p2,p2b] : [p1,p2];
  var availFor = function(ownVal) {
    return players.filter(function(p){
      return p.id===parseInt(ownVal) || !usedIds.filter(function(id){ return id!==ownVal; }).includes(String(p.id));
    });
  };
  var teamLabel = function(obj1, obj2) {
    if (!obj1&&!obj2) return "Команда";
    if (obj1&&obj2) return obj1.name.split(" ")[0]+" & "+obj2.name.split(" ")[0];
    return (obj1||obj2).name.split(" ")[0];
  };

  return (
    <div className="modal-bg" onClick={function(e){ if(e.target===e.currentTarget) onClose(); }}
      style={{position:"fixed",inset:0,background:"rgba(0,0,0,.45)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:"24px 16px",overflowY:"auto"}}>
      <div style={{background:"#fff",borderRadius:16,width:"100%",maxWidth:520,boxShadow:"0 24px 64px rgba(0,0,0,.2)"}}>
        {/* Header */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"18px 20px",borderBottom:"1px solid #E8EAEC"}}>
          <div>
            <div style={{fontSize:16,fontWeight:700}}>Новый матч</div>
            <div style={{fontSize:12,color:"#8C9BAB",marginTop:2}}>Запишите результат игры</div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",fontSize:22,color:"#8C9BAB",lineHeight:1,padding:"4px 8px"}}>✕</button>
        </div>

        {/* ФОРМАТ */}
        <div style={{padding:"14px 20px",borderBottom:"1px solid #E8EAEC",display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:12,fontWeight:700,color:"#8C9BAB",textTransform:"uppercase",letterSpacing:.7,marginRight:4}}>Формат</span>
          <div style={{display:"flex",background:"#F2F3F5",borderRadius:10,padding:3,gap:3}}>
            {["1v1","2v2"].map(function(m){
              return (
                <button key={m} onClick={function(){ setMode(m); setP1b(""); setP2b(""); }}
                  style={{padding:"6px 20px",borderRadius:8,border:"none",cursor:"pointer",fontWeight:700,fontSize:14,transition:"all .15s",
                    background:mode===m?"#fff":"transparent",color:mode===m?"#E8822A":"#8C9BAB",
                    boxShadow:mode===m?"0 1px 4px rgba(0,0,0,.12)":"none"}}>
                  {m==="1v1"?"👤 1 на 1":"👥 2 на 2"}
                </button>
              );
            })}
          </div>
        </div>

        {/* Player 1 — no bottom border (divider removed, VS strip remains) */}
        <div style={{padding:"16px 20px"}}>
          <div style={labelSt}>{is2v2?"Команда 1":"Игрок 1"}</div>
          <PlayerSelect value={p1} onChange={function(id){ setP1(id); }} players={availFor(p1)} placeholder="Выбрать игрока..."/>
          {is2v2 && <>
            <div style={{margin:"10px 0 4px",fontSize:11,fontWeight:700,color:"#C8D0DA",textTransform:"uppercase",letterSpacing:.7}}>+ Партнёр</div>
            <PlayerSelect value={p1b} onChange={function(id){ setP1b(id); }} players={availFor(p1b)} placeholder="Выбрать партнёра..."/>
          </>}
        </div>

        {/* VS strip only */}
        <div style={{display:"flex",alignItems:"center",gap:12,padding:"4px 20px"}}>
          <div style={{flex:1,height:1,background:"#E8EAEC"}}/>
          <span style={{fontSize:11,fontWeight:800,color:"#C8D0DA",letterSpacing:3}}>VS</span>
          <div style={{flex:1,height:1,background:"#E8EAEC"}}/>
        </div>

        {/* Player 2 */}
        <div style={{padding:"8px 20px 16px",borderBottom:"1px solid #E8EAEC"}}>
          <div style={labelSt}>{is2v2?"Команда 2":"Игрок 2"}</div>
          <PlayerSelect value={p2} onChange={function(id){ setP2(id); }} players={availFor(p2)} placeholder="Выбрать игрока..."/>
          {is2v2 && <>
            <div style={{margin:"10px 0 4px",fontSize:11,fontWeight:700,color:"#C8D0DA",textTransform:"uppercase",letterSpacing:.7}}>+ Партнёр</div>
            <PlayerSelect value={p2b} onChange={function(id){ setP2b(id); }} players={availFor(p2b)} placeholder="Выбрать партнёра..."/>
          </>}
        </div>

        {/* Score */}
        <div style={{padding:"16px 20px",borderBottom:"1px solid #E8EAEC"}}>
          <div style={labelSt}>Счёт</div>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            {[{val:s1,set:setS1,obj:p1obj,obj2:is2v2?p1bobj:null,label:"Команда 1"},
              {val:s2,set:setS2,obj:p2obj,obj2:is2v2?p2bobj:null,label:"Команда 2"}].map(function(item,idx){
              return (
                <React.Fragment key={idx}>
                  {idx===1 && <div style={{fontSize:24,fontWeight:800,color:"#C8D0DA",paddingTop:22}}>:</div>}
                  <div style={{flex:1,textAlign:"center"}}>
                    <div style={{fontSize:11,color:"#8C9BAB",marginBottom:6,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                      {item.obj?(is2v2?teamLabel(item.obj,item.obj2):item.obj.name.split(" ")[0]):item.label}
                    </div>
                    <input type="number" min="0" max="99" value={item.val}
                      onChange={function(e){ item.set(e.target.value); }} placeholder="0"
                      style={{padding:12,borderRadius:8,border:"1px solid #E8EAEC",fontSize:32,fontWeight:800,textAlign:"center",color:"#1A1A1A",outline:"none",width:"100%"}}/>
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {err && <div style={{margin:"0 20px",padding:"10px 14px",background:"#FFEBEE",borderRadius:8,color:"#C62828",fontSize:13,fontWeight:500}}>⚠ {err}</div>}
        <div style={{padding:"16px 20px"}}>
          <button disabled={!valid||busy} onClick={handleSubmit}
            style={{width:"100%",padding:13,borderRadius:9,background:valid&&!busy?"#E8822A":"#E8EAEC",color:valid&&!busy?"#fff":"#8C9BAB",border:"none",fontWeight:700,fontSize:15,cursor:valid&&!busy?"pointer":"not-allowed",transition:"all .15s"}}>
            {busy?"Сохраняем...":"Записать результат"}
          </button>
        </div>
      </div>
    </div>
  );
}

function NewPlayerModal({ onClose, onSubmit }) {
  const [name, setName] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");
  var valid = name.trim().length > 0;
  var handleSubmit = async function() {
    if (!valid||busy) return;
    setBusy(true); setErr("");
    try { await onSubmit(name.trim()); onClose(); }
    catch(e) { setErr(e.message); }
    finally { setBusy(false); }
  };
  return (
    <div className="modal-bg" onClick={function(e){ if(e.target===e.currentTarget) onClose(); }}
      style={{position:"fixed",inset:0,background:"rgba(0,0,0,.45)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:"24px 16px",overflowY:"auto"}}>
      <div style={{background:"#fff",borderRadius:16,width:"100%",maxWidth:420,boxShadow:"0 24px 64px rgba(0,0,0,.2)"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"18px 20px",borderBottom:"1px solid #E8EAEC"}}>
          <div>
            <div style={{fontSize:16,fontWeight:700}}>Новый игрок</div>
            <div style={{fontSize:12,color:"#8C9BAB",marginTop:2}}>Добавьте участника рейтинга</div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",fontSize:22,color:"#8C9BAB",lineHeight:1,padding:"4px 8px"}}>✕</button>
        </div>
        <div style={{padding:"20px 20px",borderBottom:"1px solid #E8EAEC"}}>
          <div style={labelSt}>Имя игрока</div>
          <input autoFocus placeholder="Введите имя..." value={name}
            onChange={function(e){ setName(e.target.value); }}
            onKeyDown={function(e){ if(e.key==="Enter") handleSubmit(); }}
            style={{width:"100%",padding:"11px 14px",borderRadius:8,border:"1px solid #E8EAEC",fontSize:15,color:"#1A1A1A",outline:"none",boxSizing:"border-box"}}/>
        </div>
        {err && <div style={{margin:"0 20px",marginTop:12,padding:"10px 14px",background:"#FFEBEE",borderRadius:8,color:"#C62828",fontSize:13,fontWeight:500}}>⚠ {err}</div>}
        <div style={{padding:"16px 20px"}}>
          <button disabled={!valid||busy} onClick={handleSubmit}
            style={{width:"100%",padding:13,borderRadius:9,background:valid&&!busy?"#E8822A":"#E8EAEC",color:valid&&!busy?"#fff":"#8C9BAB",border:"none",fontWeight:700,fontSize:15,cursor:valid&&!busy?"pointer":"not-allowed",transition:"all .15s"}}>
            {busy?"Добавляем...":"Добавить игрока"}
          </button>
        </div>
      </div>
    </div>
  );
}

function NewTournamentModal({ onClose, onSubmit }) {
  const [name, setName] = React.useState("");
  const [prizeMode, setPrizeMode] = React.useState("winner_takes_all");
  const [betType, setBetType] = React.useState("money");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");
  var valid = name.trim().length > 0;
  var handleSubmit = async function() {
    if (!valid||busy) return;
    setBusy(true); setErr("");
    try { await onSubmit(name.trim(), prizeMode, betType); onClose(); }
    catch(e) { setErr(e.message); }
    finally { setBusy(false); }
  };
  return (
    <div className="modal-bg" onClick={function(e){ if(e.target===e.currentTarget) onClose(); }}
      style={{position:"fixed",inset:0,background:"rgba(0,0,0,.45)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:"24px 16px"}}>
      <div style={{background:"#fff",borderRadius:16,width:"100%",maxWidth:420,boxShadow:"0 24px 64px rgba(0,0,0,.2)"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"18px 20px",borderBottom:"1px solid #E8EAEC"}}>
          <div>
            <div style={{fontSize:16,fontWeight:700}}>Новый турнир</div>
            <div style={{fontSize:12,color:"#8C9BAB",marginTop:2}}>Настройте параметры перед стартом</div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",fontSize:22,color:"#8C9BAB",lineHeight:1,padding:"4px 8px"}}>×</button>
        </div>

        {/* Name */}
        <div style={{padding:"20px 20px",borderBottom:"1px solid #E8EAEC"}}>
          <div style={labelSt}>Название турнира</div>
          <input autoFocus placeholder="Например: Пятничный турнир" value={name}
            onChange={function(e){ setName(e.target.value); }}
            onKeyDown={function(e){ if(e.key==="Enter") handleSubmit(); }}
            style={{width:"100%",padding:"11px 14px",borderRadius:8,border:"1px solid #E8EAEC",fontSize:15,color:"#1A1A1A",outline:"none",boxSizing:"border-box"}}/>
        </div>

        {/* ФОРМАТ — bet type */}
        <div style={{padding:"14px 20px",borderBottom:"1px solid #E8EAEC",display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:12,fontWeight:700,color:"#8C9BAB",textTransform:"uppercase",letterSpacing:.7,marginRight:4}}>Формат</span>
          <div style={{display:"flex",background:"#F2F3F5",borderRadius:10,padding:3,gap:3}}>
            {[{v:"money",l:"💰 Деньги"},{v:"points",l:"⭐ Очки"}].map(function(opt){
              return (
                <button key={opt.v} onClick={function(){ setBetType(opt.v); }}
                  style={{padding:"6px 16px",borderRadius:8,border:"none",cursor:"pointer",fontWeight:700,fontSize:13,transition:"all .15s",
                    background:betType===opt.v?"#fff":"transparent",color:betType===opt.v?"#E8822A":"#8C9BAB",
                    boxShadow:betType===opt.v?"0 1px 4px rgba(0,0,0,.12)":"none"}}>
                  {opt.l}
                </button>
              );
            })}
          </div>
        </div>

        {/* Prize distribution */}
        <div style={{padding:"16px 20px",borderBottom:"1px solid #E8EAEC"}}>
          <div style={labelSt}>Распределение призов</div>
          <select value={prizeMode} onChange={function(e){ setPrizeMode(e.target.value); }}
            style={{width:"100%",padding:"11px 14px",borderRadius:8,border:"1px solid #E8EAEC",fontSize:14,color:"#1A1A1A",background:"#fff",outline:"none",boxSizing:"border-box"}}>
            <option value="winner_takes_all">🥇 Победитель забирает всё</option>
            <option value="top3_split">🏅 Раздел 1–3 места</option>
          </select>
          {prizeMode==="top3_split" && (
            <div style={{marginTop:8,padding:"8px 12px",background:"#F8F9FA",borderRadius:8,fontSize:12,color:"#5A6474",lineHeight:1.7}}>
              1-е место: 60% · 2-е: 25% · 3-е: 15%
            </div>
          )}
        </div>

        {err && <div style={{margin:"0 20px",marginTop:12,padding:"10px 14px",background:"#FFEBEE",borderRadius:8,color:"#C62828",fontSize:13}}>{err}</div>}
        <div style={{padding:"16px 20px"}}>
          <button disabled={!valid||busy} onClick={handleSubmit}
            style={{...btnPrimary,width:"100%",padding:13,borderRadius:9,fontSize:15,opacity:(!valid||busy)?0.5:1,cursor:(!valid||busy)?"not-allowed":"pointer"}}>
            {busy?"Создаём…":"Создать турнир"}
          </button>
        </div>
      </div>
    </div>
  );
}

var _lastBet = "";
function AddTournamentPlayerModal({ players, existingNames, onClose, onSubmit, betType }) {
  const [selIds, setSelIds] = React.useState([]);
  const [bet, setBet] = React.useState(_lastBet);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");
  var isPoints = betType === "points";
  var betLabel = isPoints ? "Очки рейтинга для каждого ⭐" : "Ставка для каждого 💰";
  var available = players.filter(function(p){ return !existingNames.includes(p.name); });
  var valid = selIds.length > 0 && bet !== "" && parseInt(bet) >= 0;

  var togglePlayer = function(id) {
    setSelIds(function(prev){ return prev.includes(id) ? prev.filter(function(x){ return x!==id; }) : [...prev, id]; });
  };

  var handleSubmit = async function() {
    if (!valid||busy) return;
    setBusy(true); setErr("");
    try {
      _lastBet = bet;
      for (var i=0; i<selIds.length; i++) {
        var id = selIds[i];
        var p = available.find(function(p){ return String(p.id)===String(id); });
        if (p) await onSubmit(p.name, parseInt(bet));
      }
      onClose();
    } catch(e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="modal-bg" onClick={function(e){ if(e.target===e.currentTarget) onClose(); }}
      style={{position:"fixed",inset:0,background:"rgba(0,0,0,.45)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:"24px 16px"}}>
      <div style={{background:"#fff",borderRadius:16,width:"100%",maxWidth:420,boxShadow:"0 24px 64px rgba(0,0,0,.2)"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"18px 20px",borderBottom:"1px solid #E8EAEC"}}>
          <div style={{fontSize:16,fontWeight:700}}>👤 Добавить игроков</div>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",fontSize:22,color:"#8C9BAB",lineHeight:1,padding:"4px 8px"}}>×</button>
        </div>
        <div style={{padding:"16px 20px 8px"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
            <div style={labelSt}>Игроки {selIds.length>0&&<span style={{color:"#E8822A",fontWeight:700}}>({selIds.length} выбрано)</span>}</div>
            {available.length>0 && (
              <button onClick={function(){ selIds.length===available.length ? setSelIds([]) : setSelIds(available.map(function(p){ return String(p.id); })); }}
                style={{fontSize:12,fontWeight:600,color:selIds.length===available.length?"#C62828":"#E8822A",background:"none",border:"none",cursor:"pointer",padding:"2px 4px"}}>
                {selIds.length===available.length?"Снять всех":"Выбрать всех"}
              </button>
            )}
          </div>
          {available.length===0
            ? <div style={{fontSize:13,color:"#8C9BAB",padding:"8px 0"}}>Все игроки уже в турнире</div>
            : <div style={{maxHeight:220,overflowY:"auto",border:"1px solid #E8EAEC",borderRadius:8,background:"#fff"}}>
                {available.map(function(p){
                  var sel = selIds.includes(String(p.id));
                  return (
                    <div key={p.id} onClick={function(){ togglePlayer(String(p.id)); }}
                      style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",cursor:"pointer",
                        background:sel?"#FEF3E8":"#fff",borderBottom:"1px solid #F0F2F4",transition:"background .12s"}}>
                      <div style={{width:18,height:18,borderRadius:4,border:`2px solid ${sel?"#E8822A":"#C8D0DA"}`,
                        background:sel?"#E8822A":"#fff",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                        {sel && <span style={{color:"#fff",fontSize:11,fontWeight:700,lineHeight:1}}>✓</span>}
                      </div>
                      <Avatar name={p.name} size={28}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontWeight:600,fontSize:14}}>{p.name}</div>
                        <div style={{fontSize:11,color:"#8C9BAB"}}>{p.rating} очков</div>
                      </div>
                    </div>
                  );
                })}
              </div>
          }
        </div>
        <div style={{padding:"8px 20px",borderBottom:"1px solid #E8EAEC"}}>
          <div style={labelSt}>{betLabel}</div>
          <input type="number" min="0" placeholder="0" value={bet}
            onChange={function(e){ setBet(e.target.value); }}
            onKeyDown={function(e){ if(e.key==="Enter") handleSubmit(); }}
            style={{width:"100%",padding:"11px 14px",borderRadius:8,border:"1px solid #E8EAEC",fontSize:28,fontWeight:800,textAlign:"center",color:"#1A1A1A",outline:"none",boxSizing:"border-box"}}/>
        </div>
        {err && <div style={{margin:"0 20px",marginTop:12,padding:"10px 14px",background:"#FFEBEE",borderRadius:8,color:"#C62828",fontSize:13}}>{err}</div>}
        <div style={{padding:"16px 20px"}}>
          <button disabled={!valid||busy} onClick={handleSubmit}
            style={{...btnPrimary,width:"100%",padding:13,borderRadius:9,fontSize:15,opacity:(!valid||busy)?0.5:1,cursor:(!valid||busy)?"not-allowed":"pointer"}}>
            {busy?"⏳…":`Добавить ${selIds.length>1?selIds.length+" игроков":"игрока"}`}
          </button>
        </div>
      </div>
    </div>
  );
}
