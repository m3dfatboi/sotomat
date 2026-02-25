// Page components: Leaderboard, History, PlayersPage, ComparePage
// Depends on utils.js + components.js

function Leaderboard({ players, matches }) {
  if (!players.length) return <Empty text="Нет игроков — добавьте первого во вкладке «Игроки»"/>;
  const listRef = React.useRef(null);
  const [visibleCount, setVisibleCount] = React.useState(5);
  React.useEffect(function(){
    var CARD_H=92, HDR_H=52, BOT=20;
    var calc = function() {
      if (window.innerWidth<=640){ setVisibleCount(10); return; }
      if (!listRef.current) return;
      var top = listRef.current.getBoundingClientRect().top + HDR_H;
      var avail = window.innerHeight - top - BOT;
      setVisibleCount(Math.max(1, Math.floor(avail/CARD_H)));
    };
    calc();
    var ro;
    if (window.ResizeObserver){ ro=new ResizeObserver(calc); ro.observe(document.body); }
    window.addEventListener("resize", calc);
    return function(){ if(ro) ro.disconnect(); window.removeEventListener("resize", calc); };
  }, []);
  var recent = matches.slice(0, visibleCount);
  var ratingHist = React.useMemo(function(){ return buildRatingHistory(players, matches); }, [players, matches]);

  return (
    <div>
      <div className="stats-grid" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:14}}>
        <StatCard label="Игроков" value={players.length} icon="👤"/>
        <StatCard label="Матчей" value={matches.length} icon="🏓"/>
        <StatCard label="Лидер" value={players[0].name.split(" ")[0]} icon="🏆" accent/>
        <StatCard label="Рейтинг топ 1" value={players[0].rating} icon="⚡"/>
      </div>

      <div className="two-col" style={{display:"grid",gridTemplateColumns:"1fr 320px",gap:14,alignItems:"start"}}>

        {/* Leaderboard table */}
        <div style={card}>
          <div style={ch}>
            <span style={{fontSize:15,fontWeight:700}}>Таблица лидеров</span>
            <span style={{fontSize:13,color:"#8C9BAB"}}>{players.length} игроков</span>
          </div>
          <div style={{overflowX:"auto"}}>
            <table className="desk-table" style={{width:"100%",borderCollapse:"collapse"}}>
              <thead>
                <tr>
                  <th className="lb-rank-col" style={{...th,padding:"9px 8px",textAlign:"center"}}>#</th>
                  {["Игрок","Рейтинг","В","П","WR%"].map(function(h){
                    return <th key={h} style={th}>{h}</th>;
                  })}
                </tr>
              </thead>
              <tbody>
                {players.map(function(p, i){
                  var total = p.wins+p.losses, wr = total?Math.round(p.wins/total*100):0;
                  return (
                    <tr key={p.id} className="row-hover" style={{borderBottom:"1px solid #E8EAEC"}}>
                      <td className="lb-rank-cell" style={{...td,padding:"11px 8px",textAlign:"center"}}>
                        <span style={{fontWeight:700,fontSize:i<3?16:13,color:"#8C9BAB"}}>
                          {i===0?"🥇":i===1?"🥈":i===2?"🥉":`#${i+1}`}
                        </span>
                      </td>
                      <td style={td}>
                        <div style={{display:"flex",alignItems:"center",gap:10}}>
                          <Avatar name={p.name} size={32}/>
                          <div>
                            <div style={{fontWeight:600,fontSize:14}}>{p.name}</div>
                            <RankPill rating={p.rating}/>
                          </div>
                        </div>
                      </td>
                      <td style={{...td,fontWeight:800,fontSize:16,color:"#E8822A"}}>{p.rating}</td>
                      <td style={{...td,color:"#2E7D32",fontWeight:600}}>{p.wins}</td>
                      <td style={{...td,color:"#C62828",fontWeight:600}}>{p.losses}</td>
                      <td style={td}>
                        <div style={{display:"flex",alignItems:"center",gap:8,minWidth:90}}>
                          <div style={{flex:1,height:5,background:"#F0F0F0",borderRadius:3,overflow:"hidden"}}>
                            <div style={{height:"100%",width:wr+"%",borderRadius:3,background:wr>60?"#2E7D32":wr>40?"#E8822A":"#C62828"}}/>
                          </div>
                          <span style={{fontSize:12,fontWeight:600,color:"#8C9BAB",minWidth:28}}>{wr}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mob-list">
            {players.map(function(p, i){
              var total=p.wins+p.losses, wr=total?Math.round(p.wins/total*100):0;
              return (
                <div key={p.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",borderBottom:"1px solid #E8EAEC"}}>
                  <span style={{fontWeight:700,fontSize:i<3?20:14,minWidth:30,textAlign:"center"}}>
                    {i===0?"🥇":i===1?"🥈":i===2?"🥉":`#${i+1}`}
                  </span>
                  <Avatar name={p.name} size={40}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:700,fontSize:15,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{p.name}</div>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginTop:4}}>
                      <RankPill rating={p.rating}/>
                      <span style={{fontSize:11,color:"#8C9BAB"}}>{p.wins}В {p.losses}П</span>
                    </div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:20,fontWeight:800,color:"#E8822A"}}>{p.rating}</div>
                    <div style={{fontSize:11,color:"#8C9BAB"}}>WR {wr}%</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent matches */}
        <div style={card} ref={listRef}>
          <div style={ch}>
            <span style={{fontSize:15,fontWeight:700}}>Последние матчи</span>
          </div>
          {recent.length===0 && <div style={{padding:"28px 20px",color:"#8C9BAB",fontSize:14,textAlign:"center"}}>Матчей ещё не было</div>}
          {recent.map(function(raw){
            var m = normalizeMatch(raw);
            return (
              <div key={m.id} style={{padding:"14px 20px",borderBottom:"1px solid #E8EAEC"}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                  <div style={{flex:1}}><TeamCell name={m.p1} name2={m.p1b} isWinner={m.winner===m.p1} size={24} ratings={ratingHist[m.id]||{}}/></div>
                  <span style={{padding:"4px 12px",background:"#F5F5F5",borderRadius:20,fontWeight:800,fontSize:15,flexShrink:0}}>{m.s1}:{m.s2}</span>
                  <div style={{flex:1,display:"flex",justifyContent:"flex-end"}}><TeamCell name={m.p2} name2={m.p2b} isWinner={m.winner===m.p2} align="right" size={24} ratings={ratingHist[m.id]||{}}/></div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <DeltaBadge d={m.d1}/>
                  <span style={{flex:1,textAlign:"center",fontSize:11,color:"#8C9BAB"}}>{m.date} · {m.time}</span>
                  <DeltaBadge d={m.d2} right/>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function History({ matches, players, onDelete }) {
  const [confirmId, setConfirmId] = React.useState(null);
  const [delLoading, setDelLoading] = React.useState(false);
  var ratingHist = React.useMemo(function(){ return buildRatingHistory(players||[], matches); }, [players, matches]);
  var measured = React.useMemo(function(){
    var ms=function(t){ try{ var c=document.createElement("canvas").getContext("2d"); c.font="600 14px sans-serif"; return c.measureText(t).width; }catch(e){ return 70; } };
    var md=function(t){ try{ var c=document.createElement("canvas").getContext("2d"); c.font="600 13px sans-serif"; return c.measureText(t).width; }catch(e){ return 70; } };
    var norm=matches.map(normalizeMatch);
    var n1=norm.flatMap(function(m){ return [m.p1,m.p1b].filter(Boolean); });
    var n2=norm.flatMap(function(m){ return [m.p2,m.p2b].filter(Boolean); });
    var ds=norm.map(function(m){ return m.date; }).filter(Boolean);
    return {
      col1W: Math.ceil(n1.length?Math.max(...n1.map(ms)):80)+120,
      col2W: Math.ceil(n2.length?Math.max(...n2.map(ms)):80)+120,
      dateColW: Math.ceil(ds.length?Math.max(...ds.map(md)):70)+52,
    };
  }, [matches]);

  if (!matches.length) return <Empty text="Матчей ещё не было. Сыграйте первый!"/>;

  var handleDelete = async function() {
    setDelLoading(true);
    await onDelete(confirmId);
    setConfirmId(null); setDelLoading(false);
  };

  return (
    <div style={card}>
      {confirmId && <ConfirmModal text="Удалить этот матч? Рейтинг игроков будет откатан." onConfirm={handleDelete} onCancel={function(){ setConfirmId(null); }} loading={delLoading}/>}
      <div style={ch}>
        <span style={{fontSize:15,fontWeight:700}}>История матчей</span>
        <span style={{fontSize:13,color:"#8C9BAB"}}>{matches.length} матчей</span>
      </div>
      <table className="desk-table" style={{width:"100%",borderCollapse:"collapse"}}>
        <thead>
          <tr>
            <th style={{...th,width:measured.dateColW}}>Дата</th>
            <th style={{...th,width:measured.col1W}}>Игрок 1</th>
            <th style={{...th,textAlign:"center"}}>Счёт</th>
            <th style={{...th,width:measured.col2W}}>Игрок 2</th>
            <th style={{...th,width:1}}></th>
          </tr>
        </thead>
        <tbody>
          {matches.map(function(raw){
            var m=normalizeMatch(raw);
            return (
              <tr key={m.id} className="row-hover" style={{borderBottom:"1px solid #E8EAEC"}}>
                <td style={{...td,width:measured.dateColW}}>
                  <div style={{display:"flex",flexDirection:"column",gap:1}}>
                    <span style={{fontSize:13,fontWeight:600,lineHeight:1.3}}>{m.date}</span>
                    <span style={{fontSize:11,color:"#8C9BAB"}}>{m.time}</span>
                  </div>
                </td>
                <td style={{...td,width:measured.col1W}}>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <TeamCell name={m.p1} name2={m.p1b} isWinner={m.winner===m.p1} size={28} ratings={ratingHist[m.id]||{}}/>
                    <DeltaBadge d={m.d1}/>
                  </div>
                </td>
                <td style={{...td,textAlign:"center"}}>
                  <span style={{display:"inline-block",padding:"3px 14px",background:"#F5F5F5",borderRadius:20,fontWeight:800,fontSize:14}}>{m.s1}:{m.s2}</span>
                </td>
                <td style={{...td,width:measured.col2W}}>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <TeamCell name={m.p2} name2={m.p2b} isWinner={m.winner===m.p2} size={28} ratings={ratingHist[m.id]||{}}/>
                    <DeltaBadge d={m.d2}/>
                  </div>
                </td>
                <td style={{...td,textAlign:"right",width:1,whiteSpace:"nowrap"}}>
                  <button className="del-btn" onClick={function(){ setConfirmId(m.id); }} style={delBtn} title="Удалить матч"><TrashIcon/></button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="mob-list">
        {matches.map(function(raw){
          var m=normalizeMatch(raw);
          return (
            <div key={m.id} onClick={function(){ setConfirmId(m.id); }} style={{padding:"14px 16px",borderBottom:"1px solid #E8EAEC",cursor:"pointer"}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                <div style={{flex:1}}><TeamCell name={m.p1} name2={m.p1b} isWinner={m.winner===m.p1} size={26} ratings={ratingHist[m.id]||{}}/></div>
                <span style={{padding:"4px 12px",background:"#F5F5F5",borderRadius:20,fontWeight:800,fontSize:15,flexShrink:0}}>{m.s1}:{m.s2}</span>
                <div style={{flex:1,display:"flex",justifyContent:"flex-end"}}><TeamCell name={m.p2} name2={m.p2b} isWinner={m.winner===m.p2} align="right" size={26} ratings={ratingHist[m.id]||{}}/></div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <DeltaBadge d={m.d1}/>
                <span style={{flex:1,textAlign:"center",fontSize:11,color:"#8C9BAB"}}>{m.date} · {m.time}</span>
                <DeltaBadge d={m.d2} right/>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PlayersPage({ players, onDelete, onOpenAdd, onAvatarUpdate }) {
  const [confirmId, setConfirmId] = React.useState(null);
  const [delLoading, setDelLoading] = React.useState(false);
  var handleDelete = async function() {
    setDelLoading(true); await onDelete(confirmId);
    setConfirmId(null); setDelLoading(false);
  };

  if (players.length===0) {
    return (
      <div>
        {confirmId && <ConfirmModal text="Удалить игрока? Все его матчи и изменения рейтинга соперников тоже будут откатаны." onConfirm={handleDelete} onCancel={function(){ setConfirmId(null); }} loading={delLoading}/>}
        <div style={{...card,padding:"60px 20px",textAlign:"center"}}>
          <div style={{fontSize:52}}>👤</div>
          <div style={{fontSize:15,color:"#8C9BAB",marginTop:12,lineHeight:1.6}}>Нет игроков.<br/>Добавь первого участника рейтинга!</div>
          <button onClick={onOpenAdd} style={{...btnPrimary,marginTop:20,padding:"10px 28px",fontSize:14,fontWeight:700}}>Добавить игрока +</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {confirmId && <ConfirmModal text="Удалить игрока? Все его матчи и изменения рейтинга соперников тоже будут откатаны." onConfirm={handleDelete} onCancel={function(){ setConfirmId(null); }} loading={delLoading}/>}
      <div className="hide-mob" style={card}>
        <div style={ch}>
          <span style={{fontSize:15,fontWeight:700}}>Все игроки</span>
          <span style={{fontSize:13,color:"#8C9BAB"}}>{players.length} человек</span>
        </div>
        {players.map(function(p, i){
          var total=p.wins+p.losses, wr=total?Math.round(p.wins/total*100):0;
          return (
            <div key={p.id} className="row-hover desk-flex" style={{alignItems:"center",gap:12,padding:"12px 16px",borderBottom:"1px solid #E8EAEC"}}>
              <span style={{fontWeight:700,fontSize:i<3?18:13,color:"#8C9BAB",minWidth:26,textAlign:"center"}}>{i===0?"🥇":i===1?"🥈":i===2?"🥉":`#${i+1}`}</span>
              <EditableAvatar name={p.name} size={36} playerId={p.id} initialUrl={p.avatar_url} onAvatarUpdate={onAvatarUpdate}/>
              <div style={{flex:1,minWidth:80}}>
                <div style={{fontWeight:700,fontSize:14}}>{p.name}</div>
                <RankPill rating={p.rating}/>
              </div>
              <div style={{textAlign:"center",minWidth:52}}>
                <div style={{fontSize:18,fontWeight:800,color:"#E8822A"}}>{p.rating}</div>
                <div style={{fontSize:10,color:"#8C9BAB",textTransform:"uppercase"}}>рейтинг</div>
              </div>
              <div style={{textAlign:"center",minWidth:44}}>
                <div style={{fontSize:15,fontWeight:700,color:"#2E7D32"}}>{p.wins}</div>
                <div style={{fontSize:10,color:"#8C9BAB",textTransform:"uppercase"}}>побед</div>
              </div>
              <div style={{textAlign:"center",minWidth:52}}>
                <div style={{fontSize:15,fontWeight:700,color:"#C62828"}}>{p.losses}</div>
                <div style={{fontSize:10,color:"#8C9BAB",textTransform:"uppercase"}}>пораж.</div>
              </div>
              <div style={{textAlign:"center",minWidth:44}}>
                <div style={{fontSize:15,fontWeight:700}}>{wr}%</div>
                <div style={{fontSize:10,color:"#8C9BAB",textTransform:"uppercase"}}>WR</div>
              </div>
              <button className="del-btn" onClick={function(){ setConfirmId(p.id); }} style={delBtn} title="Удалить"><TrashIcon/></button>
            </div>
          );
        })}
        <div style={{padding:"12px 16px"}}>
          <button onClick={onOpenAdd} style={{...btnOutline,width:"100%",padding:"9px 0",fontSize:14,fontWeight:600,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
            Добавить игрока +
          </button>
        </div>
      </div>

      <div className="mob-list">
        <div style={{display:"grid",gap:10}}>
          {players.map(function(p, i){
            var total=p.wins+p.losses, wr=total?Math.round(p.wins/total*100):0;
            return (
              <div key={p.id} style={{background:"#fff",borderRadius:14,border:"1px solid #E8EAEC",padding:"14px 16px",boxShadow:"0 2px 8px rgba(0,0,0,.05)"}}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                  <span style={{fontSize:i<3?22:14,fontWeight:700,color:"#8C9BAB",minWidth:30,textAlign:"center"}}>{i===0?"🥇":i===1?"🥈":i===2?"🥉":`#${i+1}`}</span>
                  <EditableAvatar name={p.name} size={42} playerId={p.id} initialUrl={p.avatar_url} onAvatarUpdate={onAvatarUpdate}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:700,fontSize:15,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{p.name}</div>
                    <div style={{marginTop:4}}><RankPill rating={p.rating}/></div>
                  </div>
                  <button className="del-btn" onClick={function(){ setConfirmId(p.id); }} style={delBtn}><TrashIcon/></button>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:7}}>
                  {[{v:p.rating,l:"Рейтинг",bg:"#FEF3E8",c:"#E8822A",w:800},
                    {v:p.wins,l:"Побед",bg:"#E8F5E9",c:"#2E7D32",w:700},
                    {v:p.losses,l:"Пораж.",bg:"#FFEBEE",c:"#C62828",w:700},
                    {v:wr+"%",l:"WR",bg:"#F5F5F5",c:wr>=60?"#2E7D32":wr>=40?"#E8822A":"#C62828",w:700}
                  ].map(function(s){
                    return (
                      <div key={s.l} style={{textAlign:"center",padding:"9px 4px",background:s.bg,borderRadius:10}}>
                        <div style={{fontSize:17,fontWeight:s.w,color:s.c,lineHeight:1}}>{s.v}</div>
                        <div style={{fontSize:9,color:"#8C9BAB",textTransform:"uppercase",letterSpacing:.4,marginTop:3}}>{s.l}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          <button onClick={onOpenAdd} style={{...btnOutline,width:"100%",padding:"14px 0",fontSize:14,fontWeight:600,borderRadius:14,display:"flex",alignItems:"center",justifyContent:"center",gap:6,boxShadow:"0 2px 8px rgba(0,0,0,.05)"}}>
            Добавить игрока +
          </button>
        </div>
      </div>
    </div>
  );
}

function ComparePage({ players, matches }) {
  const [p1id, setP1id] = React.useState("");
  const [p2id, setP2id] = React.useState("");
  var p1 = players.find(function(p){ return p.id===parseInt(p1id); });
  var p2 = players.find(function(p){ return p.id===parseInt(p2id); });
  var h2h = (p1&&p2)?matches.filter(function(m){
    return (m.p1===p1.name&&m.p2===p2.name)||(m.p1===p2.name&&m.p2===p1.name);
  }):[];
  var total=h2h.length;
  var p1wins=h2h.filter(function(m){ return m.winner===p1?.name; }).length;
  var p2wins=h2h.filter(function(m){ return m.winner===p2?.name; }).length;
  var p1wr=total?Math.round(p1wins/total*100):null;
  var p2wr=total?Math.round(p2wins/total*100):null;
  var bothSelected=!!(p1&&p2);
  var WC="#E8822A", WB="#FEF3E8";
  var statRows=[
    {label:"Побед",v1:p1wins,v2:p2wins,fmt:function(v){ return total?v:"—"; },better:function(a,b){ return a>b; }},
    {label:"Winrate",v1:p1wr,v2:p2wr,fmt:function(v){ return v!==null?v+"%":"—"; },better:function(a,b){ return a>b; }},
  ];
  return (
    <div>
      <div style={{...card,marginBottom:14}}>
        <div style={ch}><span style={{fontSize:15,fontWeight:700}}>Сравнение — личные встречи</span></div>
        <div style={{padding:"16px 20px"}}>
          <div style={{display:"flex",flexWrap:"wrap",gap:10,alignItems:"flex-end"}}>
            <div style={{flex:"1 1 140px",minWidth:0}}><div style={labelSt}>Игрок 1</div><PlayerSelect value={p1id} onChange={function(id){ setP1id(id); }} players={players.filter(function(p){ return String(p.id)!==String(p2id); })} placeholder="Выбрать..."/></div>
            <div style={{flexShrink:0,textAlign:"center",fontSize:13,fontWeight:800,color:"#C8D0DA",paddingBottom:10,minWidth:28}}>VS</div>
            <div style={{flex:"1 1 140px",minWidth:0}}><div style={labelSt}>Игрок 2</div><PlayerSelect value={p2id} onChange={function(id){ setP2id(id); }} players={players.filter(function(p){ return String(p.id)!==String(p1id); })} placeholder="Выбрать..."/></div>
          </div>
        </div>
      </div>

      {!bothSelected && (
        <div style={{textAlign:"center",padding:"72px 20px"}}>
          <div style={{fontSize:52}}>⚔️</div>
          <div style={{fontSize:15,color:"#8C9BAB",marginTop:12,lineHeight:1.6}}>Выберите двух игроков<br/>чтобы увидеть их личную статистику</div>
        </div>
      )}

      {bothSelected && <>
        <div style={{...card,marginBottom:14}}>
          <div style={{padding:"20px 16px",display:"grid",gridTemplateColumns:"1fr 40px 1fr",gap:8,alignItems:"center"}}>
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6}}>
              <Avatar name={p1.name} size={56}/>
              <div style={{textAlign:"center"}}>
                <div style={{fontWeight:700,fontSize:15}}>{p1.name}</div>
                <div style={{marginTop:3}}><RankPill rating={p1.rating}/></div>
                <div style={{fontSize:11,color:"#8C9BAB",marginTop:4}}>{p1.rating} ELO</div>
              </div>
            </div>
            <div style={{textAlign:"center",fontSize:15,fontWeight:800,color:"#C8D0DA"}}>VS</div>
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6}}>
              <Avatar name={p2.name} size={56}/>
              <div style={{textAlign:"center"}}>
                <div style={{fontWeight:700,fontSize:15}}>{p2.name}</div>
                <div style={{marginTop:3}}><RankPill rating={p2.rating}/></div>
                <div style={{fontSize:11,color:"#8C9BAB",marginTop:4}}>{p2.rating} ELO</div>
              </div>
            </div>
          </div>
        </div>

        <div style={{...card,marginBottom:14}}>
          <div style={ch}>
            <span style={{fontSize:15,fontWeight:700}}>Личная статистика</span>
            <span style={{fontSize:13,color:"#8C9BAB"}}>{total} {total===1?"матч":total>=2&&total<=4?"матча":"матчей"} между ними</span>
          </div>
          {total===0?(
            <div style={{padding:"28px 20px",textAlign:"center"}}>
              <div style={{fontSize:28}}>🤝</div>
              <div style={{fontSize:14,color:"#8C9BAB",marginTop:8}}>Эти игроки ещё не встречались</div>
            </div>
          ):(
            <>
              <div style={{display:"grid",gridTemplateColumns:"1fr 40px 1fr",alignItems:"center",padding:"20px 20px 0"}}>
                <div style={{textAlign:"center"}}><div style={{fontSize:52,fontWeight:900,lineHeight:1,color:p1wins>p2wins?WC:"#1A1A1A"}}>{p1wins}</div><div style={{fontSize:11,color:"#8C9BAB",marginTop:4}}>{p1.name.split(" ")[0]}</div></div>
                <div style={{textAlign:"center",fontSize:20,fontWeight:800,color:"#E8EAEC"}}>:</div>
                <div style={{textAlign:"center"}}><div style={{fontSize:52,fontWeight:900,lineHeight:1,color:p2wins>p1wins?WC:"#1A1A1A"}}>{p2wins}</div><div style={{fontSize:11,color:"#8C9BAB",marginTop:4}}>{p2.name.split(" ")[0]}</div></div>
              </div>
              <div style={{padding:"16px 20px 0"}}>
                <div style={{height:8,background:"#F0F0F0",borderRadius:4,overflow:"hidden"}}>
                  <div style={{height:"100%",borderRadius:4,background:WC,width:(p1wins/total*100)+"%",transition:"width .4s ease"}}/>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
                  <span style={{fontSize:11,color:"#8C9BAB"}}>{p1.name.split(" ")[0]}: {p1wr}%</span>
                  <span style={{fontSize:11,color:"#8C9BAB"}}>{p2.name.split(" ")[0]}: {p2wr}%</span>
                </div>
              </div>
              <div style={{padding:"8px 0 0"}}>
                {statRows.map(function(s){
                  var w=total===0?0:s.better(s.v1,s.v2)?1:s.better(s.v2,s.v1)?-1:0;
                  return (
                    <div key={s.label} style={{display:"grid",gridTemplateColumns:"1fr auto 1fr",padding:"11px 16px",borderTop:"1px solid #F5F5F5",alignItems:"center"}}>
                      <div style={{display:"flex",justifyContent:"flex-end"}}><span style={{fontSize:18,fontWeight:800,padding:"5px 14px",borderRadius:10,background:w===1?WB:"transparent",color:w===1?WC:"#1A1A1A"}}>{s.fmt(s.v1)}</span></div>
                      <div style={{fontSize:10,fontWeight:700,color:"#8C9BAB",textTransform:"uppercase",textAlign:"center",padding:"0 12px",letterSpacing:.5}}>{s.label}</div>
                      <div style={{display:"flex",justifyContent:"flex-start"}}><span style={{fontSize:18,fontWeight:800,padding:"5px 14px",borderRadius:10,background:w===-1?WB:"transparent",color:w===-1?WC:"#1A1A1A"}}>{s.fmt(s.v2)}</span></div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {total>0 && (
          <div style={card}>
            <div style={ch}>
              <span style={{fontSize:15,fontWeight:700}}>История встреч</span>
              <span style={{fontSize:13,color:"#8C9BAB"}}>{total}</span>
            </div>
            {h2h.map(function(raw){
              var m=normalizeMatch(raw);
              return (
                <div key={m.id} style={{padding:"14px 20px",borderBottom:"1px solid #E8EAEC"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                    <div style={{flex:1}}><TeamCell name={m.p1} name2={m.p1b} isWinner={m.winner===m.p1} size={24} ratings={{}}/></div>
                    <span style={{padding:"4px 12px",background:"#F5F5F5",borderRadius:20,fontWeight:800,fontSize:15,flexShrink:0}}>{m.s1}:{m.s2}</span>
                    <div style={{flex:1,display:"flex",justifyContent:"flex-end"}}><TeamCell name={m.p2} name2={m.p2b} isWinner={m.winner===m.p2} align="right" size={24} ratings={{}}/></div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <DeltaBadge d={m.d1}/>
                    <span style={{flex:1,textAlign:"center",fontSize:11,color:"#8C9BAB"}}>{m.date} · {m.time}</span>
                    <DeltaBadge d={m.d2} right/>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </>}
    </div>
  );
}
