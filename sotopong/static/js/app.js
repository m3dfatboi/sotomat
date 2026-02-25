// App component + mount — depends on all other JS files being loaded

function App() {
  const [players, setPlayers] = React.useState([]);
  const [tournaments, setTournaments] = React.useState([]);
  const [matches, setMatches] = React.useState([]);
  const [view, setView] = React.useState("leaderboard");
  const [showMatch, setShowMatch] = React.useState(false);
  const [showPlayer, setShowPlayer] = React.useState(false);
  const [toast, setToast] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [offline, setOffline] = React.useState(false);
  const [savedP1, setSavedP1] = React.useState("");
  const [savedP2, setSavedP2] = React.useState("");

  var loadAll = async function() {
    try {
      var results = await Promise.all([apiFetch("/api/players"), apiFetch("/api/matches")]);
      setPlayers(results[0]); setMatches(results[1]); setOffline(false);
      setAvatarCache(results[0]);
      apiFetch("/api/tournaments").then(function(t){ setTournaments(t); }).catch(function(){});
    } catch(e) {
      setOffline(true);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(function(){ loadAll(); }, []);
  React.useEffect(function(){
    var t = setInterval(loadAll, 15000);
    return function(){ clearInterval(t); };
  }, []);

  var showMsg = function(msg) {
    setToast(msg);
    setTimeout(function(){ setToast(null); }, 2800);
  };

  var addPlayer = async function(name) {
    var p = await apiFetch("/api/players", {method:"POST",body:JSON.stringify({name:name})});
    setPlayers(function(prev){ return [...prev,p].sort(function(a,b){ return b.rating-a.rating; }); });
    showMsg(name+" добавлен!");
  };
  var addMatch = async function(data) {
    await apiFetch("/api/matches", {method:"POST",body:JSON.stringify(data)});
    await loadAll();
    showMsg("Матч записан!");
  };
  var deleteMatch = async function(id) {
    await apiFetch("/api/matches/"+id, {method:"DELETE"});
    await loadAll();
    showMsg("Матч удалён, рейтинг откатан");
  };
  var deletePlayer = async function(id) {
    var pl = players.find(function(p){ return p.id===id; });
    await apiFetch("/api/players/"+id, {method:"DELETE"});
    await loadAll();
    showMsg((pl?.name||"Игрок")+" удалён");
  };

  var NAV = [
    {id:"leaderboard",label:"Рейтинг",  icon:"🏆"},
    {id:"history",    label:"История",  icon:"📋"},
    {id:"players",    label:"Игроки",   icon:"👤"},
    {id:"compare",    label:"Сравнение",icon:"⚔️"},
    {id:"tournament", label:"Турнир",   icon:"🥊"},
  ];

  return (
    <div style={{minHeight:"100vh",background:"#F2F3F5"}}>
      {offline && <div className="offline-bar">⚠ Нет соединения с сервером — данные могут быть устаревшими</div>}

      {/* Header */}
      <header style={{background:"#fff",borderBottom:"1px solid #E8EAEC",position:"sticky",top:0,zIndex:100}}>
        <div style={{maxWidth:1100,margin:"0 auto",padding:"0 16px",display:"flex",alignItems:"center",gap:16,height:56}}>
          <div style={{display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
            <span style={{fontSize:24}}>🏓</span>
            <div>
              <div style={{fontSize:16,fontWeight:800,letterSpacing:-0.3}}>SotoPong</div>
              <div className="hide-mob" style={{fontSize:11,color:"#8C9BAB"}}>Рейтинг пинг-понга</div>
            </div>
          </div>
          <nav className="desk" style={{gap:2}}>
            {NAV.map(function(n){
              return (
                <button key={n.id} onClick={function(){ setView(n.id); }}
                  style={{padding:"6px 14px",borderRadius:8,border:"none",
                    background:view===n.id?"#FEF3E8":"transparent",
                    color:view===n.id?"#E8822A":"#8C9BAB",
                    fontWeight:view===n.id?600:500,cursor:"pointer",fontSize:14,transition:"all .15s"}}>
                  {n.label}
                </button>
              );
            })}
          </nav>
          <div style={{flex:1}}/>
          <button className="desk" onClick={function(){ setShowMatch(true); }}
            style={{gap:8,padding:"8px 16px",borderRadius:8,background:"#E8822A",color:"#fff",border:"none",fontWeight:700,fontSize:14,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0}}>
            Новый матч +
          </button>
          <button className="mob" onClick={function(){ setShowMatch(true); }}
            style={{width:38,height:38,borderRadius:8,flexShrink:0,background:"#E8822A",color:"#fff",border:"none",fontWeight:700,fontSize:22,cursor:"pointer",display:"none",alignItems:"center",justifyContent:"center",lineHeight:1,paddingBottom:2}}>
            +
          </button>
        </div>
      </header>

      {/* Main */}
      <main style={{maxWidth:1100,margin:"0 auto",padding:"20px 16px 90px"}}>
        {loading ? <Spinner/> : <>
          {view==="leaderboard" && <Leaderboard players={players} matches={matches}/>}
          {view==="history"     && <History matches={matches} players={players} onDelete={deleteMatch}/>}
          {view==="players"     && <PlayersPage players={players} onAdd={addPlayer} onDelete={deletePlayer} onOpenAdd={function(){ setShowPlayer(true); }} onAvatarUpdate={loadAll}/>}
          {view==="compare"     && <ComparePage players={players} matches={matches}/>}
          {view==="tournament"  && <TournamentPage tournaments={tournaments} players={players} onReload={loadAll}/>}
        </>}
      </main>

      {/* Mobile tab bar */}
      <nav className="mob" style={{position:"fixed",bottom:0,left:0,right:0,background:"#fff",borderTop:"1px solid #E8EAEC",zIndex:90,paddingBottom:"env(safe-area-inset-bottom)"}}>
        {NAV.map(function(n){
          return (
            <button key={n.id} onClick={function(){ setView(n.id); }}
              style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"8px 0",background:"none",border:"none",
                color:view===n.id?"#E8822A":"#8C9BAB",cursor:"pointer",transition:"color .15s"}}>
              <span style={{fontSize:20,lineHeight:1}}>{n.icon}</span>
              <span style={{fontSize:10,fontWeight:view===n.id?700:500,marginTop:2}}>{n.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Toast */}
      {toast && (
        <div className="toast" style={{position:"fixed",bottom:88,left:"50%",transform:"translateX(-50%)",background:"#1A1A1A",color:"#fff",padding:"10px 20px",borderRadius:24,fontSize:14,fontWeight:600,zIndex:500,whiteSpace:"nowrap",boxShadow:"0 4px 16px rgba(0,0,0,.25)"}}>
          {toast}
        </div>
      )}

      {showMatch && (
        <NewMatchModal players={players} onClose={function(){ setShowMatch(false); }} onSubmit={addMatch}
          savedP1={savedP1} savedP2={savedP2}
          onSavePlayers={function(p1,p2){ setSavedP1(p1); setSavedP2(p2); }}/>
      )}
      {showPlayer && <NewPlayerModal onClose={function(){ setShowPlayer(false); }} onSubmit={addPlayer}/>}
    </div>
  );
}

ReactDOM.render(<App/>, document.getElementById("root"));
