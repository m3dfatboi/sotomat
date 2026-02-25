// Tournament components — all bracket, seeding, BYE, rating logic
// Depends on utils.js + components.js + modals.js

// Expand/collapse toggle button — shared style for collapse + action buttons
var _expandBtnBase = {
  background:"none", border:"1px solid #E8EAEC", borderRadius:6,
  padding:0, width:30, height:30, cursor:"pointer", color:"#1A1A1A",
  display:"flex", alignItems:"center", justifyContent:"center",
  transition:"all .15s", lineHeight:0, flexShrink:0,
};
var _expandBtnHoverOn  = function(e){ e.currentTarget.style.background="#F2F3F5"; e.currentTarget.style.borderColor="#C8D0DA"; e.currentTarget.style.color="#1A1A1A"; };
var _expandBtnHoverOff = function(e){ e.currentTarget.style.background="none"; e.currentTarget.style.borderColor="#E8EAEC"; e.currentTarget.style.color="#1A1A1A"; };

// Action button (+ Player) — same hover states as expand button
var _actionBtnBase = {
  background:"none", border:"1px solid #E8EAEC", borderRadius:6,
  padding:"0 14px", height:30, cursor:"pointer", color:"#1A1A1A",
  display:"flex", alignItems:"center", justifyContent:"center",
  transition:"all .15s", lineHeight:1, flexShrink:0, fontSize:13, fontWeight:600,
};

function TournamentCard({ tournament, players, onReload, onDelete, isOpen, onToggle, autoShowAdd, onAutoShowAddDone }) {
  const [showAdd, setShowAdd] = React.useState(false);
  const [confirmRemove, setConfirmRemove] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const [bracketTab, setBracketTab] = React.useState("bracket");
  const [bracket, setBracketRaw] = React.useState(null);
  const [bracketLoaded, setBracketLoaded] = React.useState(false);
  const [finishBusy, setFinishBusy] = React.useState(false);
  const [isMobile, setIsMobile] = React.useState(window.innerWidth <= 640);
  const [thirdPlaceMatch, setThirdPlaceMatch] = React.useState(null);
  const dragRef = React.useRef(null);
  const saveTimer = React.useRef(null);
  const tournamentId = tournament.id;
  const isActive = tournament.status === "active";
  const collapsed = !isOpen;

  // Auto-open add players modal after creation
  React.useEffect(function(){
    if (autoShowAdd && isActive) { setShowAdd(true); if(onAutoShowAddDone) onAutoShowAddDone(); }
  }, [autoShowAdd]);

  var prizePool = tournament.prize_pool;
  var prizeMode = tournament.prize_mode || "winner_takes_all";
  var betType   = tournament.bet_type || "money";
  var betIcon   = betType === "points" ? "⭐" : "💰";
  var existingNames = tournament.players.map(function(p){ return p.player_name; });
  var playerNames   = tournament.players.map(function(p){ return p.player_name; });

  // Rating map for seeding
  var ratingMap = {};
  players.forEach(function(p){ ratingMap[p.name] = p.rating; });

  function calcPrizes(pool) {
    if (prizeMode==="top3_split") return { first:Math.round(pool*.6), second:Math.round(pool*.25), third:Math.round(pool*.15) };
    return { first:pool, second:0, third:0 };
  }
  var prizes = calcPrizes(prizePool);

  React.useEffect(function(){
    var fn=function(){ setIsMobile(window.innerWidth<=640); };
    window.addEventListener("resize",fn);
    return function(){ window.removeEventListener("resize",fn); };
  }, []);

  // ── Build bracket with rating-based seeding + BYE all stages ─────────────
  function buildBracket(names) {
    if (names.length < 2) return null;

    // Sort by rating desc for seeding (highest = seed 1)
    var seeded = [...names].sort(function(a,b){
      return (ratingMap[b]||0) - (ratingMap[a]||0);
    });

    // Standard tournament seeding: 1 vs n, 2 vs n-1, etc.
    function seedBracket(seeds) {
      var n = seeds.length;
      if (n <= 1) return seeds;
      var result = [];
      var lo = 0, hi = n-1;
      while (lo <= hi) {
        result.push(seeds[lo]);
        if (lo !== hi) result.push(seeds[hi]);
        lo++; hi--;
      }
      return result;
    }
    var arranged = seedBracket(seeded);

    var rounds = [];
    var current = arranged;

    // Round 1
    var r1matches = [];
    for (var i=0; i<current.length; i+=2) {
      if (i+1 < current.length) {
        r1matches.push({p1:current[i], p2:current[i+1], winner:null, bye:false});
      } else {
        r1matches.push({p1:current[i], p2:null, winner:current[i], bye:true});
      }
    }
    rounds.push(r1matches);

    // Subsequent rounds — support BYE for odd counts
    var prevCount = r1matches.length;
    while (prevCount > 1) {
      var nextCount = Math.ceil(prevCount / 2);
      var rMatches = [];
      for (var j=0; j<nextCount; j++) {
        rMatches.push({p1:null, p2:null, winner:null, bye:false});
      }
      rounds.push(rMatches);
      prevCount = nextCount;
    }

    // Auto-propagate BYE winners from round 1 into round 2
    r1matches.forEach(function(m, mi){
      if (m.bye && m.winner && rounds.length > 1) {
        var nextMi = Math.floor(mi/2);
        var isP1 = mi%2===0;
        rounds[1][nextMi][isP1?"p1":"p2"] = m.winner;
      }
    });

    return rounds;
  }

  // Update BYE state for all rounds based on single-player slots
  function applyAutobye(nb) {
    nb.forEach(function(round, ri) {
      round.forEach(function(match) {
        if (!match.bye) {
          // If only one player is assigned and no winner yet, mark as BYE
          var hasP1 = !!match.p1;
          var hasP2 = !!match.p2;
          if (hasP1 && !hasP2 && !match.winner) {
            match.bye = true;
            match.winner = match.p1;
          } else if (!hasP1 && hasP2 && !match.winner) {
            match.bye = true;
            match.winner = match.p2;
          } else if (hasP1 && hasP2) {
            // Both present — not a BYE
            match.bye = false;
          }
        }
      });
    });
    return nb;
  }

  // Load bracket from server on mount
  React.useEffect(function(){
    if (bracketLoaded) return;
    setBracketLoaded(true);
    if (tournament.bracket_json) {
      try { setBracketRaw(JSON.parse(tournament.bracket_json)); return; } catch(e) {}
    }
    if (playerNames.length >= 2) setBracketRaw(buildBracket(playerNames));
  }, []);

  // Rebuild when players change (active only)
  React.useEffect(function(){
    if (!isActive || !bracketLoaded) return;
    if (playerNames.length < 2) { setBracketRaw(null); return; }
    setBracketRaw(function(prev){
      var fresh = buildBracket(playerNames);
      if (!prev) return fresh;
      fresh.forEach(function(round, ri){
        if (!prev[ri]) return;
        round.forEach(function(match, mi){
          var old = prev[ri][mi];
          if (!old) return;
          if (match.p1===old.p1 && match.p2===old.p2 && old.winner) match.winner = old.winner;
        });
      });
      return fresh;
    });
    setThirdPlaceMatch(null);
  }, [playerNames.join(',')]);

  // Auto-save bracket
  React.useEffect(function(){
    if (!bracket || !isActive || !bracketLoaded) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(function(){
      apiFetch("/api/tournaments/"+tournamentId+"/bracket", {
        method:"POST", body:JSON.stringify({bracket_json:JSON.stringify(bracket)})
      }).catch(function(){});
    }, 800);
    return function(){ if(saveTimer.current) clearTimeout(saveTimer.current); };
  }, [bracket]);

  // Auto-finish when final winner determined
  React.useEffect(function(){
    if (!bracket || !isActive) return;
    var finalRound = bracket[bracket.length-1];
    if (finalRound.length !== 1) return;
    var finalWinner = finalRound[0].winner;
    if (!finalWinner || tournament.winner_name) return;
    if (bracket.length >= 3) {
      if (!thirdPlaceMatch || !thirdPlaceMatch.winner) return;
    }

    // Progressive rating: R1=5, R2=10, R3=15, R4=20, R5+=30
    function roundPts(ri) { return [5,10,15,20,30][Math.min(ri,4)]; }

    var ratingDeltas = {};
    bracket.forEach(function(round, ri){
      if (!Array.isArray(round)) return;
      round.forEach(function(match){
        if (match.winner && !match.bye) {
          ratingDeltas[match.winner] = (ratingDeltas[match.winner]||0) + roundPts(ri);
        }
      });
    });

    // -15 for players who lost in round 1 (didn't pass first stage)
    var firstRound = bracket[0];
    firstRound.forEach(function(match){
      if (match.winner && !match.bye) {
        var loser = match.winner===match.p1 ? match.p2 : match.p1;
        if (loser) ratingDeltas[loser] = (ratingDeltas[loser]||0) - 15;
      }
    });

    var finalMatch = finalRound[0];
    var secondName = finalMatch.p1===finalWinner ? finalMatch.p2 : finalMatch.p1;
    var thirdName  = thirdPlaceMatch ? thirdPlaceMatch.winner : null;

    // Place bonuses
    ratingDeltas[finalWinner] = (ratingDeltas[finalWinner]||0) + 50;
    if (secondName) ratingDeltas[secondName] = (ratingDeltas[secondName]||0) + 20;
    if (thirdName)  ratingDeltas[thirdName]  = (ratingDeltas[thirdName]||0)  + 10;

    // Participation for players with no record (neither won nor lost in R1)
    tournament.players.forEach(function(p){
      if (ratingDeltas[p.player_name] === undefined) ratingDeltas[p.player_name] = 2;
    });

    setFinishBusy(true);
    apiFetch("/api/tournaments/"+tournamentId+"/finish", {
      method:"POST",
      body:JSON.stringify({
        winner_name: finalWinner,
        second_name: secondName||null,
        third_name:  thirdName||null,
        bracket_json: JSON.stringify(bracket),
        rounds_won: ratingDeltas,
      })
    }).then(function(){ onReload(); }).catch(function(){}).finally(function(){ setFinishBusy(false); });
  }, [bracket, thirdPlaceMatch]);

  function applyWinner(ri, mi, winner) {
    setBracketRaw(function(state){
      if (!state) return state;
      var nb = state.map(function(r){ return r.map(function(m){ return Object.assign({},m); }); });
      nb[ri][mi].winner = winner;
      nb[ri][mi].bye = false;
      if (ri+1 < nb.length) {
        var nextMi = Math.floor(mi/2);
        var isP1 = mi%2===0;
        nb[ri+1][nextMi][isP1?"p1":"p2"] = winner;
        nb[ri+1][nextMi].winner = null;
        for (var r=ri+2; r<nb.length; r++) {
          var m2 = Math.floor(mi/Math.pow(2,r-ri));
          if (nb[r]&&nb[r][m2]) nb[r][m2].winner=null;
        }
      }
      return nb;
    });
  }

  function clearWinner(ri, mi) {
    setBracketRaw(function(state){
      if (!state) return state;
      var nb = state.map(function(r){ return r.map(function(m){ return Object.assign({},m); }); });
      nb[ri][mi].winner = null;
      nb[ri][mi].bye = false;
      if (ri+1 < nb.length) {
        var nextMi = Math.floor(mi/2);
        var isP1 = mi%2===0;
        nb[ri+1][nextMi][isP1?"p1":"p2"] = null;
        nb[ri+1][nextMi].winner = null;
        nb[ri+1][nextMi].bye = false;
        for (var r=ri+2; r<nb.length; r++) {
          var m2 = Math.floor(mi/Math.pow(2,r-ri));
          if (nb[r]&&nb[r][m2]) { nb[r][m2].winner=null; nb[r][m2].p1=null; nb[r][m2].p2=null; nb[r][m2].bye=false; }
        }
      }
      return nb;
    });
  }

  function setSlotPlayer(mi, side, name) {
    setBracketRaw(function(state){
      if (!state) return state;
      var nb = state.map(function(r){ return r.map(function(m){ return Object.assign({},m); }); });
      if (name) {
        nb[0].forEach(function(match,mIdx){
          ["p1","p2"].forEach(function(s){
            if (match[s]===name && !(mIdx===mi&&s===side)) {
              nb[0][mIdx][s]=null; nb[0][mIdx].winner=null; nb[0][mIdx].bye=false;
            }
          });
        });
      }
      nb[0][mi][side] = name||null;
      nb[0][mi].winner = null;
      nb[0][mi].bye = false;
      applyAutobye(nb);
      return nb;
    });
  }

  function movePlayer(fromMatch, fromSide, toMatch, toSide) {
    setBracketRaw(function(state){
      if (!state) return state;
      var nb = state.map(function(r){ return r.map(function(m){ return Object.assign({},m); }); });
      var name = fromMatch!==null ? nb[0][fromMatch][fromSide] : (dragRef.current&&dragRef.current.name);
      if (!name) return state;
      var displaced = nb[0][toMatch][toSide];
      nb[0][toMatch][toSide] = name;
      nb[0][toMatch].winner = null;
      nb[0][toMatch].bye = false;
      if (fromMatch!==null) {
        nb[0][fromMatch][fromSide] = displaced||null;
        nb[0][fromMatch].winner = null;
        nb[0][fromMatch].bye = false;
      }
      applyAutobye(nb);
      return nb;
    });
  }

  function clearSlot(mi, side) {
    setBracketRaw(function(state){
      if (!state) return state;
      var nb = state.map(function(r){ return r.map(function(m){ return Object.assign({},m); }); });
      nb[0][mi][side] = null;
      nb[0][mi].winner = null;
      nb[0][mi].bye = false;
      return nb;
    });
  }

  function getR1PlacedNames() {
    if (!bracket) return new Set();
    var s = new Set();
    bracket[0].forEach(function(m){ if(m.p1&&m.p1!=="BYE") s.add(m.p1); if(m.p2&&m.p2!=="BYE") s.add(m.p2); });
    return s;
  }

  function getRoundName(total, ri) {
    var fromEnd = total-1-ri;
    if (fromEnd===0) return "Финал";
    if (fromEnd===1) return "Полуфинал";
    if (fromEnd===2) return "1/4 финала";
    if (fromEnd===3) return "1/8 финала";
    return "Раунд "+(ri+1);
  }

  // Which players are currently in a bracket slot (for status indicator)
  function getBusyInBracket() {
    if (!bracket) return new Set();
    var busy = new Set();
    bracket.forEach(function(round){
      round.forEach(function(match){
        if (match.p1) busy.add(match.p1);
        if (match.p2) busy.add(match.p2);
      });
    });
    return busy;
  }

  function PlayerSlot({ name, matchIdx, side, isWinner, roundIdx, isBye }) {
    var isR1 = roundIdx===0;
    var pool = playerNames;
    var busySet = getBusyInBracket();

    var handleDragStart = function(e) {
      if (!name||!isR1||isMobile) return;
      dragRef.current = {name, fromMatch:matchIdx, fromSide:side, fromPool:false};
      e.dataTransfer.effectAllowed = "move";
    };
    var handleDrop = function(e) {
      e.preventDefault();
      if (!isR1||isMobile) return;
      var d = dragRef.current;
      if (!d) return;
      if (!d.fromPool && d.fromMatch===matchIdx && d.fromSide===side) { dragRef.current=null; return; }
      if (d.fromPool) {
        var nb = bracket.map(function(r){ return r.map(function(m){ return Object.assign({},m); }); });
        nb[0][matchIdx][side] = d.name;
        nb[0][matchIdx].winner = null;
        nb[0][matchIdx].bye = false;
        applyAutobye(nb);
        setBracketRaw(nb);
      } else {
        movePlayer(d.fromMatch, d.fromSide, matchIdx, side);
      }
      dragRef.current = null;
    };
    var handleDragOver = function(e){ e.preventDefault(); };

    if (isBye && !name) {
      return <div style={{height:34,borderRadius:7,background:"#F0F0F0",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:"#C8D0DA",fontStyle:"italic"}}>BYE</div>;
    }

    // Non-R1 or finished: static display
    if (!isR1 || !isActive) {
      if (!name) return <div style={{height:34,borderRadius:7,background:"#F5F5F5",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:"#C8D0DA"}}>—</div>;
      var isFinalWinner = !isActive && name===tournament.winner_name;
      var isFinalSecond = !isActive && name===tournament.second_name;
      var isFinalThird  = !isActive && name===tournament.third_name;
      var placeEmoji = isFinalWinner?"🏆":isFinalSecond?"🥈":isFinalThird?"🥉":isWinner?"✓":null;
      return (
        <div style={{display:"flex",alignItems:"center",gap:7,padding:"0 8px",height:34,borderRadius:7,background:isWinner?"#E8F5E9":"#F8F9FA",border:isWinner?"1.5px solid #2E7D32":"1.5px solid #E8EAEC"}}>
          <Avatar name={name} size={18}/>
          <span style={{fontWeight:isWinner?700:500,fontSize:13,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:isWinner?"#2E7D32":"#1A1A1A"}}>{name}</span>
          {placeEmoji && <span style={{fontSize:10}}>{placeEmoji}</span>}
        </div>
      );
    }

    // R1 active — build select with busy indicator in options
    var buildSelect = function() {
      return (
        <select value={name||""} onChange={function(e){ setSlotPlayer(matchIdx,side,e.target.value); }}
          style={{width:"100%",padding:"0 8px",height:34,borderRadius:7,border:"1px solid #E8EAEC",background:"#fff",fontSize:13,color:name?"#1A1A1A":"#C8D0DA",outline:"none",appearance:"none",WebkitAppearance:"none",boxSizing:"border-box"}}>
          <option value="">— выбрать —</option>
          {pool.map(function(n){
            var isInSlot = busySet.has(n) && n!==name;
            return <option key={n} value={n}>{isInSlot ? "✓ "+n : n}</option>;
          })}
          {name && !pool.includes(name) && <option value={name}>{name}</option>}
        </select>
      );
    };

    if (isMobile) {
      var matchHasWinner = bracket&&bracket[roundIdx]&&bracket[roundIdx][matchIdx]?.winner;
      if (matchHasWinner) {
        return (
          <div style={{display:"flex",alignItems:"center",gap:7,padding:"0 8px",height:34,borderRadius:7,background:isWinner?"#E8F5E9":"#F8F9FA",border:isWinner?"1.5px solid #2E7D32":"1.5px solid #E8EAEC"}}>
            {name?<><Avatar name={name} size={18}/><span style={{fontWeight:isWinner?700:500,fontSize:13,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:isWinner?"#2E7D32":"#1A1A1A"}}>{name}</span>{isWinner&&<span style={{fontSize:10}}>✓</span>}</> : <span style={{fontSize:12,color:"#C8D0DA",flex:1}}>—</span>}
          </div>
        );
      }
      return (
        <div style={{position:"relative",display:"flex",alignItems:"center",gap:6}}>
          {name&&<Avatar name={name} size={18} style={{flexShrink:0}}/>}
          {buildSelect()}
        </div>
      );
    }

    // Desktop: chip with drag + invisible select overlay
    return (
      <div style={{position:"relative"}}>
        {name?(
          <div draggable onDragStart={handleDragStart} onDragOver={handleDragOver} onDrop={handleDrop}
            style={{display:"flex",alignItems:"center",gap:7,padding:"0 28px 0 8px",height:34,borderRadius:7,cursor:"grab",
              background:isWinner?"#E8F5E9":"#fff",border:isWinner?"1.5px solid #2E7D32":"1.5px solid #E8EAEC",userSelect:"none"}}>
            <Avatar name={name} size={18}/>
            <span style={{fontWeight:500,fontSize:13,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{name}</span>
          </div>
        ):(
          <div onDragOver={handleDragOver} onDrop={handleDrop}
            style={{height:34,borderRadius:7,border:"2px dashed #D0D5DD",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:"#C8D0DA",background:"#FAFBFC"}}>
            ↓ перетяни
          </div>
        )}
        <select value={name||""} onChange={function(e){ setSlotPlayer(matchIdx,side,e.target.value); }}
          style={{position:"absolute",inset:0,opacity:0,cursor:"pointer",width:"100%",height:"100%"}}>
          <option value="">— выбрать —</option>
          {pool.map(function(n){
            var isInSlot = busySet.has(n) && n!==name;
            return <option key={n} value={n}>{isInSlot ? "✓ "+n : n}</option>;
          })}
          {name && !pool.includes(name) && <option value={name}>{name}</option>}
        </select>
      </div>
    );
  }

  function MatchCard({ match, matchIdx, roundIdx }) {
    var canPlay = match.p1 && match.p2 && !match.bye;
    var isBye = match.bye;
    return (
      <div style={{background:"#FAFBFC",borderRadius:10,border:"1px solid #E8EAEC",overflow:"hidden"}}>
        <div style={{padding:"5px 5px 3px"}}>
          <PlayerSlot name={match.p1} matchIdx={matchIdx} side="p1" isWinner={match.winner===match.p1&&!isBye} roundIdx={roundIdx} isBye={false}/>
        </div>
        <div style={{height:1,background:"#E8EAEC",margin:"0 5px"}}/>
        <div style={{padding:"3px 5px 5px"}}>
          {isBye
            ? <div style={{height:34,borderRadius:7,background:"#F0F0F0",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:"#C8D0DA",fontStyle:"italic"}}>BYE — авто-проход</div>
            : <PlayerSlot name={match.p2} matchIdx={matchIdx} side="p2" isWinner={match.winner===match.p2} roundIdx={roundIdx} isBye={false}/>
          }
        </div>
        {isBye && match.p1 && (
          <div style={{padding:"3px 5px 5px",borderTop:"1px solid #F0F0F0",display:"flex",alignItems:"center",gap:6,fontSize:11,color:"#2E7D32",fontWeight:600}}>
            <span>✓</span> {match.p1} проходит автоматически
          </div>
        )}
        {canPlay && !match.winner && isActive && (
          <div style={{display:"flex",gap:3,padding:"4px 5px 5px",borderTop:"1px solid #F0F0F0"}}>
            {[{n:match.p1,s:"p1"},{n:match.p2,s:"p2"}].map(function(btn){
              return (
                <button key={btn.s} onClick={function(){ applyWinner(roundIdx,matchIdx,btn.n); }}
                  style={{flex:1,padding:"4px 4px",borderRadius:6,border:"1px solid #E8EAEC",background:"#fff",cursor:"pointer",fontSize:11,fontWeight:600,color:"#2E7D32",transition:"background .1s"}}
                  onMouseEnter={function(e){ e.currentTarget.style.background="#E8F5E9"; }}
                  onMouseLeave={function(e){ e.currentTarget.style.background="#fff"; }}>
                  {btn.n.split(" ")[0]} ✓
                </button>
              );
            })}
          </div>
        )}
        {match.winner && !isBye && isActive && (
          <div style={{display:"flex",justifyContent:"flex-end",padding:"2px 5px 3px",borderTop:"1px solid #F0F0F0"}}>
            <button onClick={function(){ clearWinner(roundIdx,matchIdx); }}
              style={{fontSize:10,color:"#8C9BAB",background:"none",border:"none",cursor:"pointer",padding:"2px 4px"}}>сбросить</button>
          </div>
        )}
      </div>
    );
  }

  function BracketView() {
    if (!bracket) {
      return (
        <div style={{padding:"28px 20px",textAlign:"center",color:"#8C9BAB",fontSize:14}}>
          {playerNames.length<2
            ? "Добавьте минимум 2 игроков — сетка создастся автоматически"
            : <button onClick={function(){ setBracketRaw(buildBracket(playerNames)); }} style={{...btnOutline,padding:"8px 18px",fontSize:14}}>Создать сетку</button>
          }
        </div>
      );
    }

    var placed = getR1PlacedNames();
    var pool = playerNames.filter(function(n){ return !placed.has(n); });
    var totalRounds = bracket.length;
    var finalWinner = bracket[totalRounds-1][0]?.winner;

    var poolDrop = function(e) {
      e.preventDefault();
      var d = dragRef.current;
      if (!d||d.fromPool) return;
      clearSlot(d.fromMatch, d.fromSide);
      dragRef.current = null;
    };

    return (
      <div style={{padding:"16px 20px"}}>
        {/* Unplaced pool — desktop only */}
        {!isMobile && pool.length>0 && (
          <div onDragOver={function(e){ e.preventDefault(); }} onDrop={poolDrop}
            style={{marginBottom:14,padding:"10px 12px",background:"#F8F9FA",borderRadius:10,border:"1px solid #E8EAEC"}}>
            <div style={{fontSize:11,fontWeight:700,color:"#8C9BAB",textTransform:"uppercase",letterSpacing:.7,marginBottom:8}}>Вне сетки — перетяни или нажми на слот:</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
              {pool.map(function(name){
                var ds = function(e) { dragRef.current={name,fromMatch:null,fromSide:null,fromPool:true}; e.dataTransfer.effectAllowed="move"; };
                return (
                  <div key={name} draggable onDragStart={ds}
                    style={{display:"flex",alignItems:"center",gap:7,padding:"5px 10px",background:"#fff",borderRadius:8,border:"1px solid #E8EAEC",cursor:"grab",userSelect:"none"}}>
                    <Avatar name={name} size={18}/>
                    <span style={{fontWeight:600,fontSize:13}}>{name}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {finishBusy && <div style={{marginBottom:14,padding:"8px 14px",background:"#F0FBF1",borderRadius:8,fontSize:13,color:"#2E7D32",fontWeight:600}}>⏳ Сохраняем результаты турнира…</div>}

        {/* 3rd place match */}
        {isActive && bracket && bracket.length>=3 && (function(){
          var semiFinalRound = bracket[bracket.length-2];
          var semiLosers = semiFinalRound
            .filter(function(m){ return m.winner&&!m.bye; })
            .map(function(m){ return m.winner===m.p1?m.p2:m.p1; })
            .filter(Boolean);
          if (semiLosers.length<2) return null;
          var tpm = thirdPlaceMatch||{p1:semiLosers[0],p2:semiLosers[1],winner:null};
          var applyThirdWinner = function(winner){ setThirdPlaceMatch({p1:tpm.p1,p2:tpm.p2,winner:winner}); };
          return (
            <div style={{marginBottom:14,padding:"10px 14px",background:"#F8F9FA",borderRadius:10,border:"1px solid #E8EAEC"}}>
              <div style={{fontSize:11,fontWeight:700,color:"#8C9BAB",textTransform:"uppercase",letterSpacing:.7,marginBottom:8}}>🥉 Матч за 3-е место</div>
              <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                {[{n:tpm.p1,s:"p1"},{n:tpm.p2,s:"p2"}].map(function(btn,i){
                  return (
                    <React.Fragment key={btn.s}>
                      {i===1&&<span style={{fontSize:13,color:"#C8D0DA",fontWeight:700}}>vs</span>}
                      <div style={{display:"flex",alignItems:"center",gap:6,padding:"6px 10px",borderRadius:8,border:tpm.winner===btn.n?"2px solid #6A1B9A":"1px solid #E8EAEC",background:tpm.winner===btn.n?"#F3E5F5":"#fff"}}>
                        <Avatar name={btn.n} size={20}/>
                        <span style={{fontWeight:600,fontSize:13}}>{btn.n}</span>
                        {tpm.winner===btn.n&&<span style={{fontSize:12}}>🥉</span>}
                      </div>
                    </React.Fragment>
                  );
                })}
                {!tpm.winner && (
                  <div style={{display:"flex",gap:6,marginLeft:"auto"}}>
                    {[tpm.p1,tpm.p2].map(function(n){
                      return <button key={n} onClick={function(){ applyThirdWinner(n); }}
                        style={{padding:"5px 10px",borderRadius:6,border:"1px solid #E8EAEC",background:"#fff",cursor:"pointer",fontSize:12,fontWeight:600,color:"#6A1B9A"}}>
                        {n.split(" ")[0]} 🥉
                      </button>;
                    })}
                  </div>
                )}
                {tpm.winner && <button onClick={function(){ applyThirdWinner(null); }} style={{marginLeft:"auto",fontSize:10,color:"#8C9BAB",background:"none",border:"none",cursor:"pointer"}}>сбросить</button>}
              </div>
            </div>
          );
        })()}

        {/* Desktop bracket */}
        <div className="hide-mob" style={{overflowX:"auto",paddingBottom:4}}>
          <div style={{display:"flex",gap:16,minWidth:"max-content",alignItems:"flex-start"}}>
            {bracket.map(function(round,ri){
              var matchH=102, matchGap=10;
              var span=Math.pow(2,ri);
              var gap=span>1?(span-1)*(matchH+matchGap)+matchGap:matchGap;
              var topPad=ri>0?((span-1)*(matchH+matchGap))/2:0;
              return (
                <div key={ri} style={{minWidth:210,flexShrink:0}}>
                  <div style={{fontSize:11,fontWeight:700,color:"#8C9BAB",textTransform:"uppercase",letterSpacing:.7,marginBottom:10,textAlign:"center"}}>{getRoundName(totalRounds,ri)}</div>
                  <div style={{display:"flex",flexDirection:"column",gap,paddingTop:topPad}}>
                    {round.map(function(match,mi){ return <MatchCard key={mi} match={match} matchIdx={mi} roundIdx={ri}/>; })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Mobile bracket */}
        <div className="mob-list">
          {bracket.map(function(round,ri){
            return (
              <div key={ri} style={{marginBottom:16}}>
                <div style={{fontSize:11,fontWeight:700,color:"#8C9BAB",textTransform:"uppercase",letterSpacing:.7,marginBottom:8}}>{getRoundName(totalRounds,ri)}</div>
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {round.map(function(match,mi){ return <MatchCard key={mi} match={match} matchIdx={mi} roundIdx={ri}/>; })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  async function addPlayer(playerName, bet) {
    await apiFetch("/api/tournaments/"+tournamentId+"/players", {
      method:"POST", body:JSON.stringify({player_name:playerName, bet:bet})
    });
    await onReload();
  }
  async function removePlayer() {
    setBusy(true);
    try {
      await apiFetch("/api/tournaments/"+tournamentId+"/players/"+confirmRemove, {method:"DELETE"});
      setConfirmRemove(null); await onReload();
    } finally { setBusy(false); }
  }

  function RatingDelta({ delta }) {
    if (delta===undefined||delta===null||delta===0) return null;
    var pos=delta>0;
    return <span style={{fontSize:11,fontWeight:700,color:pos?"#2E7D32":"#C62828",background:pos?"#E8F5E9":"#FFEBEE",borderRadius:5,padding:"1px 5px",marginLeft:4}}>{pos?"+":" "}{delta}</span>;
  }

  var place1 = tournament.winner_name;
  var place2 = tournament.second_name;
  var place3 = tournament.third_name;

  return (
    <div style={{...card,marginBottom:14}}>
      {confirmRemove && <ConfirmModal text="Удалить игрока из турнира?" onConfirm={removePlayer} onCancel={function(){ setConfirmRemove(null); }} loading={busy}/>}

      {/* ── Header ── */}
      <div style={ch}>
        {/* Collapse button — icon always black, spacing = 20px (same as button gap) */}
        <button onClick={onToggle} style={_expandBtnBase}
          onMouseEnter={_expandBtnHoverOn} onMouseLeave={_expandBtnHoverOff}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#1A1A1A" strokeWidth="2.5" strokeLinecap="round">
            {collapsed?<polyline points="6 9 12 15 18 9"/>:<polyline points="6 15 12 9 18 15"/>}
          </svg>
        </button>

        {/* Gap between expand button and title = 20px to match action button gap */}
        <div style={{flex:1,minWidth:0,marginLeft:20}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:15,fontWeight:700}}>{isActive?"⚔️":"🏁"} {tournament.name}</span>
            {isActive && (
              <span style={{display:"inline-flex",alignItems:"center",gap:5,background:"#FFF0F0",border:"1px solid #FFCDD2",borderRadius:20,padding:"2px 8px 2px 6px",flexShrink:0}}>
                <span className="live-dot" style={{width:7,height:7,borderRadius:"50%",background:"#E53935",display:"inline-block",flexShrink:0}}/>
                <span style={{fontSize:10,fontWeight:800,color:"#E53935",letterSpacing:.8}}>LIVE</span>
              </span>
            )}
          </div>
          <div style={{fontSize:11,color:"#8C9BAB",marginTop:2}}>
            {prizeMode==="top3_split"?"🏅 Раздел призов 1–3 место":"🥇 Победитель забирает всё"}
            {betType==="points"?" · ⭐ Ставки в очках":""}
          </div>
        </div>

        {/* Desktop: stats + buttons */}
        <div className="desk-flex" style={{alignItems:"center",gap:20,flexShrink:0,marginLeft:12}}>
          <div style={{display:"flex",gap:16}}>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:11,color:"#8C9BAB",textTransform:"uppercase",letterSpacing:.5}}>Игроков</div>
              <div style={{fontSize:15,fontWeight:800,color:"#1A1A1A"}}>{tournament.players.length}</div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:11,color:"#8C9BAB",textTransform:"uppercase",letterSpacing:.5}}>Банк</div>
              <div style={{fontSize:15,fontWeight:800,color:"#E8822A"}}>{prizePool} {betIcon}</div>
            </div>
            {!isActive && place1 && (
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:11,color:"#8C9BAB",textTransform:"uppercase",letterSpacing:.5}}>{prizeMode==="winner_takes_all"?"Победитель":"1-е место"}</div>
                <div style={{fontSize:15,fontWeight:800,color:"#2E7D32"}}>{place1}</div>
              </div>
            )}
          </div>
          {isActive && (
            <button onClick={function(){ setShowAdd(true); }} style={_actionBtnBase}
              onMouseEnter={_expandBtnHoverOn} onMouseLeave={_expandBtnHoverOff}>
              + Игрок
            </button>
          )}
          <button className="del-btn" onClick={function(){ onDelete(tournamentId); }} style={delBtn}><TrashIcon/></button>
        </div>

        {/* Mobile: action buttons */}
        <div className="mob" style={{gap:8,flexShrink:0,marginLeft:8}}>
          {isActive && <button onClick={function(){ setShowAdd(true); }} style={{...btnOutline,padding:"7px 12px",fontSize:13}}>+ Игрок</button>}
          <button className="del-btn" onClick={function(){ onDelete(tournamentId); }} style={delBtn}><TrashIcon/></button>
        </div>
      </div>

      {/* Mobile stats tiles — only for FINISHED tournaments */}
      {!isActive && (
        <div className="mob" style={{display:"none",flexWrap:"wrap",gap:8,padding:"12px 16px",borderBottom:"1px solid #E8EAEC",background:"#FAFBFC"}}>
          {(function(){
            var getMob = function(icon,label,name,prize){
              if (!name) return null;
              var pl = tournament.players.find(function(p){ return p.player_name===name; });
              var rd = pl?pl.rating_delta:null;
              return (
                <div key={label} style={{flex:"1 1 calc(50% - 8px)",minWidth:100,background:"#fff",borderRadius:10,border:"1px solid #E8EAEC",padding:"10px 14px"}}>
                  <div style={{fontSize:10,color:"#8C9BAB",textTransform:"uppercase",letterSpacing:.5,marginBottom:3}}>{icon} {label}</div>
                  <div style={{fontSize:14,fontWeight:800,color:"#1A1A1A",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{name}</div>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginTop:2,flexWrap:"wrap"}}>
                    <span style={{fontSize:12,fontWeight:700,color:"#E8822A"}}>{prize} {betIcon}</span>
                    {rd!==null&&rd!==0&&<span style={{fontSize:11,fontWeight:700,color:rd>0?"#2E7D32":"#C62828",background:rd>0?"#E8F5E9":"#FFEBEE",borderRadius:5,padding:"1px 5px"}}>{rd>0?"+":""}{rd}</span>}
                  </div>
                </div>
              );
            };
            var items = [
              getMob("🥇",prizeMode==="winner_takes_all"?"Победитель":"1-е место",place1,prizeMode==="winner_takes_all"?prizePool:prizes.first),
              ...(prizeMode==="top3_split"?[getMob("🥈","2-е место",place2,prizes.second),getMob("🥉","3-е место",place3,prizes.third)]:[]),
            ].filter(Boolean);
            return items;
          })()}
        </div>
      )}

      {/* Finished: top-3 places row (desktop) */}
      {!isActive && (place1||place2||place3) && (
        <div className="desk-flex" style={{display:"none",borderBottom:"1px solid #E8EAEC",flexWrap:"wrap"}}>
          {(function(){
            var getRatingDelta = function(name){ var pl=tournament.players.find(function(p){ return p.player_name===name; }); return pl?pl.rating_delta:null; };
            var places = [
              {icon:"🥇",label:prizeMode==="winner_takes_all"?"Победитель":"1-е место",name:place1,prize:prizeMode==="winner_takes_all"?prizePool:prizes.first},
              ...(prizeMode==="top3_split"?[{icon:"🥈",label:"2-е место",name:place2,prize:prizes.second},{icon:"🥉",label:"3-е место",name:place3,prize:prizes.third}]:[]),
            ].filter(function(p){ return p.name; });
            return places.map(function(p){
              var rd=getRatingDelta(p.name);
              return (
                <div key={p.label} style={{flex:"1 1 120px",padding:"10px 16px",borderRight:"1px solid #E8EAEC",minWidth:0}}>
                  <div style={{fontSize:11,color:"#8C9BAB",marginBottom:3}}>{p.icon} {p.label}</div>
                  <div style={{fontWeight:700,fontSize:14,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{p.name}</div>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginTop:2,flexWrap:"wrap"}}>
                    <span style={{fontSize:12,color:"#E8822A",fontWeight:700}}>{p.prize} {betIcon}</span>
                    {rd!==null&&rd!==0&&<span style={{fontSize:11,fontWeight:700,color:rd>0?"#2E7D32":"#C62828",background:rd>0?"#E8F5E9":"#FFEBEE",borderRadius:5,padding:"1px 6px"}}>{rd>0?"+":""}{rd}</span>}
                  </div>
                </div>
              );
            });
          })()}
          <div style={{flex:"1 1 120px",padding:"10px 16px",minWidth:0}}>
            <div style={{fontSize:11,color:"#8C9BAB",marginBottom:3}}>Банк</div>
            <div style={{fontWeight:700,fontSize:14}}>{prizePool} {betIcon}</div>
            <div style={{fontSize:11,color:"#8C9BAB"}}>{tournament.players.length} игроков</div>
          </div>
        </div>
      )}

      {!collapsed && (
        <>
          {tournament.players.length>0 && (
            <div style={{display:"flex",borderBottom:"1px solid #E8EAEC",background:"#FAFBFC"}}>
              {[{id:"bracket",label:"🏆 Сетка"},{id:"players",label:"👤 Игроки"}].map(function(tab){
                return (
                  <button key={tab.id} onClick={function(){ setBracketTab(tab.id); }}
                    style={{flex:1,padding:"9px 0",border:"none",cursor:"pointer",fontSize:13,fontWeight:bracketTab===tab.id?700:500,
                      background:"none",color:bracketTab===tab.id?"#E8822A":"#8C9BAB",
                      borderBottom:bracketTab===tab.id?"2px solid #E8822A":"2px solid transparent",transition:"all .15s"}}>
                    {tab.label}
                  </button>
                );
              })}
            </div>
          )}

          {(bracketTab==="players"||tournament.players.length===0) && (
            <>
              {tournament.players.length===0?(
                <div style={{padding:"32px 20px",color:"#8C9BAB",fontSize:14,textAlign:"center"}}>
                  <div style={{fontSize:36,marginBottom:8}}>🎮</div>
                  {isActive?"Добавь первого игрока!":"Турнир без игроков"}
                </div>
              ):(function(){
                var placeOrder = {};
                placeOrder[place1]=1; placeOrder[place2]=2; placeOrder[place3]=3;
                var sortedPlayers = !isActive
                  ? [...tournament.players].sort(function(a,b){ return (placeOrder[a.player_name]||999)-(placeOrder[b.player_name]||999); })
                  : tournament.players;
                return (
                  <>
                    <table className="desk-table" style={{width:"100%",borderCollapse:"collapse"}}>
                      <thead><tr>
                        {["#","Игрок","Ставка","Доля в банке",...(!isActive?["Приз","Рейтинг"]:[""])].map(function(h,i){ return <th key={i} style={th}>{h}</th>; })}
                      </tr></thead>
                      <tbody>
                        {sortedPlayers.map(function(p,i){
                          var share=prizePool>0?Math.round(p.bet/prizePool*100):0;
                          var isWinner=!isActive&&tournament.winner_name===p.player_name;
                          var isSecond=!isActive&&tournament.second_name===p.player_name;
                          var isThird=!isActive&&tournament.third_name===p.player_name;
                          var placeEmoji=isWinner?"🏆":isSecond?"🥈":isThird?"🥉":null;
                          var prizeWon=isWinner?(prizeMode==="winner_takes_all"?prizePool:prizes.first):isSecond?prizes.second:isThird?prizes.third:0;
                          return (
                            <tr key={p.id} className="row-hover" style={{borderBottom:"1px solid #E8EAEC",background:isWinner?"#F0FBF1":isSecond?"#F5F0FA":isThird?"#FBF5E6":undefined}}>
                              <td style={{...td,width:36,fontWeight:700,color:"#8C9BAB"}}>{i+1}</td>
                              <td style={td}><div style={{display:"flex",alignItems:"center",gap:10}}><Avatar name={p.player_name} size={30}/><span style={{fontWeight:600}}>{p.player_name}</span>{placeEmoji&&<span>{placeEmoji}</span>}</div></td>
                              <td style={{...td,fontWeight:800,fontSize:16,color:"#E8822A"}}>{p.bet} {betIcon}</td>
                              <td style={td}>
                                <div style={{display:"flex",alignItems:"center",gap:8}}>
                                  <div style={{flex:1,height:6,background:"#F0F0F0",borderRadius:3,overflow:"hidden",minWidth:60}}>
                                    <div style={{height:"100%",width:`${share}%`,background:"#E8822A",borderRadius:3}}/>
                                  </div>
                                  <span style={{fontSize:12,fontWeight:600,color:"#8C9BAB",minWidth:32}}>{share}%</span>
                                </div>
                              </td>
                              {!isActive&&<td style={td}>{prizeWon>0?<span style={{fontSize:13,fontWeight:800,color:"#E8822A"}}>{prizeWon} {betIcon}</span>:<span style={{fontSize:12,color:"#C8D0DA"}}>—</span>}</td>}
                              {!isActive&&<td style={td}>{p.rating_delta!==0&&p.rating_delta!==undefined?<span style={{fontSize:12,fontWeight:700,color:p.rating_delta>0?"#2E7D32":"#C62828",background:p.rating_delta>0?"#E8F5E9":"#FFEBEE",borderRadius:5,padding:"2px 7px"}}>{p.rating_delta>0?"+":""}{p.rating_delta}</span>:<span style={{fontSize:12,color:"#C8D0DA"}}>—</span>}</td>}
                              {isActive&&<td style={{...td,textAlign:"right",width:1}}><button className="del-btn" onClick={function(){ setConfirmRemove(p.id); }} style={delBtn}><TrashIcon/></button></td>}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <div className="mob-list">
                      {sortedPlayers.map(function(p,i){
                        var share=prizePool>0?Math.round(p.bet/prizePool*100):0;
                        var isWinner=!isActive&&tournament.winner_name===p.player_name;
                        var isSecond=!isActive&&tournament.second_name===p.player_name;
                        var isThird=!isActive&&tournament.third_name===p.player_name;
                        var placeEmoji=isWinner?"🏆":isSecond?"🥈":isThird?"🥉":null;
                        var prizeWon=isWinner?(prizeMode==="winner_takes_all"?prizePool:prizes.first):isSecond?prizes.second:isThird?prizes.third:0;
                        return (
                          <div key={p.id} style={{display:"flex",alignItems:"center",gap:10,padding:"12px 16px",borderBottom:"1px solid #E8EAEC",background:isWinner?"#F0FBF1":isSecond?"#F5F0FA":isThird?"#FBF5E6":undefined}}>
                            <span style={{fontWeight:700,fontSize:12,color:"#8C9BAB",minWidth:18,textAlign:"center"}}>{i+1}</span>
                            <Avatar name={p.player_name} size={34}/>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{fontWeight:700,fontSize:14}}>{p.player_name} {placeEmoji||""}</div>
                              <div style={{display:"flex",alignItems:"center",gap:4,marginTop:1,flexWrap:"wrap"}}>
                                <span style={{fontSize:12,color:"#8C9BAB"}}>Ставка: {p.bet} {betIcon} · {share}%</span>
                                {prizeWon>0&&<span style={{fontSize:11,fontWeight:700,color:"#E8822A"}}>{prizeWon} {betIcon}</span>}
                                {!isActive&&p.rating_delta!==0&&p.rating_delta!==undefined&&<span style={{fontSize:11,fontWeight:700,color:p.rating_delta>0?"#2E7D32":"#C62828",background:p.rating_delta>0?"#E8F5E9":"#FFEBEE",borderRadius:5,padding:"1px 5px"}}>{p.rating_delta>0?"+":""}{p.rating_delta}</span>}
                              </div>
                            </div>
                            {isActive&&<button className="del-btn" onClick={function(){ setConfirmRemove(p.id); }} style={delBtn}><TrashIcon/></button>}
                          </div>
                        );
                      })}
                    </div>
                  </>
                );
              })()}
            </>
          )}

          {bracketTab==="bracket" && tournament.players.length>0 && <BracketView/>}
        </>
      )}

      {showAdd && <AddTournamentPlayerModal players={players} existingNames={existingNames} betType={betType} onClose={function(){ setShowAdd(false); }} onSubmit={addPlayer}/>}
    </div>
  );
}

function TournamentPage({ tournaments, players, onReload }) {
  const [showNew, setShowNew] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(null);
  const [delLoading, setDelLoading] = React.useState(false);
  var firstActive = tournaments.find(function(t){ return t.status==="active"; });
  const [openId, setOpenId] = React.useState(firstActive?firstActive.id:null);
  const [showAddForId, setShowAddForId] = React.useState(null);

  var active   = tournaments.filter(function(t){ return t.status==="active"; });
  var finished = tournaments.filter(function(t){ return t.status==="finished"; });

  React.useEffect(function(){
    if (active.length>0) {
      var openStillExists = tournaments.find(function(t){ return t.id===openId; });
      if (!openStillExists) setOpenId(active[active.length-1].id);
    }
  }, [tournaments.map(function(t){ return t.id; }).join(',')]);

  var createTournament = async function(name, prizeMode, betType) {
    var newT = await apiFetch("/api/tournaments", {method:"POST",body:JSON.stringify({name:name,prize_mode:prizeMode,bet_type:betType||"money"})});
    if (newT&&newT.id) { setOpenId(newT.id); setShowAddForId(newT.id); }
    onReload();
  };
  var handleDelete = async function() {
    setDelLoading(true);
    try {
      await apiFetch("/api/tournaments/"+confirmDelete, {method:"DELETE"});
      if (confirmDelete===openId) setOpenId(null);
      setConfirmDelete(null); onReload();
    } finally { setDelLoading(false); }
  };
  var handleToggle = function(id){ setOpenId(function(prev){ return prev===id?null:id; }); };

  var totalPrizePool = tournaments.reduce(function(s,t){ return s+(t.prize_pool||0); },0);
  var finishedWithWinner = finished.filter(function(t){ return t.winner_name; });
  var winCounts={};
  finishedWithWinner.forEach(function(t){ winCounts[t.winner_name]=(winCounts[t.winner_name]||0)+1; });
  var topWinner=Object.entries(winCounts).sort(function(a,b){ return b[1]-a[1]; })[0];
  var biggestT=tournaments.length?tournaments.reduce(function(a,b){ return (b.prize_pool||0)>(a.prize_pool||0)?b:a; }):null;

  return (
    <div>
      {confirmDelete && <ConfirmModal text="Удалить турнир и все ставки?" onConfirm={handleDelete} onCancel={function(){ setConfirmDelete(null); }} loading={delLoading}/>}

      {/* Stats */}
      {tournaments.length>0 && (
        <div className="stats-grid" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:14}}>
          <StatCard label="Всего турниров" value={tournaments.length} icon="🏆"/>
          {topWinner&&<StatCard label="Лучший игрок" value={topWinner[0].split(" ")[0]} icon="👑"/>}
          {biggestT&&biggestT.prize_pool>0&&<StatCard label="Макс. банк" value={biggestT.prize_pool+" 💰"} icon="🎯"/>}
          {finishedWithWinner.length>0&&<StatCard label="Всего призовых" value={finishedWithWinner.reduce(function(s,t){ return s+(t.prize_pool||0); },0)+" 💰"} icon="🏅"/>}
        </div>
      )}

      {/* Empty state — button inside block */}
      {active.length===0 && finished.length===0 ? (
        <div style={{...card,padding:"60px 20px",textAlign:"center"}}>
          <div style={{fontSize:52}}>🏆</div>
          <div style={{fontSize:15,color:"#8C9BAB",marginTop:12,lineHeight:1.6}}>Нет турниров.<br/>Создай первый и добавь игроков со ставками!</div>
          <button onClick={function(){ setShowNew(true); }}
            style={{...btnPrimary,marginTop:20,padding:"10px 28px",fontSize:14,fontWeight:700}}>
            Новый турнир
          </button>
        </div>
      ) : (
        <>
          {/* New tournament button — no trophy emoji */}
          <button onClick={function(){ setShowNew(true); }}
            style={{...btnPrimary,width:"100%",padding:"13px 0",fontSize:15,fontWeight:700,borderRadius:10,marginBottom:14,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
            Новый турнир
          </button>
          {active.map(function(t){
            return <TournamentCard key={t.id} tournament={t} players={players} onReload={onReload}
              onDelete={function(id){ setConfirmDelete(id); }}
              isOpen={openId===t.id} onToggle={function(){ handleToggle(t.id); }}
              autoShowAdd={showAddForId===t.id} onAutoShowAddDone={function(){ setShowAddForId(null); }}/>;
          })}
          {finished.map(function(t){
            return <TournamentCard key={t.id} tournament={t} players={players} onReload={onReload}
              onDelete={function(id){ setConfirmDelete(id); }}
              isOpen={openId===t.id} onToggle={function(){ handleToggle(t.id); }}/>;
          })}
        </>
      )}

      {showNew && <NewTournamentModal onClose={function(){ setShowNew(false); }} onSubmit={createTournament}/>}
    </div>
  );
}
