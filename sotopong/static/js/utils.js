// ── Avatar cache (mutable singleton) ─────────────────────────────────────────
var AC = {};
var AV = 0;
function setAvatarCache(players) {
  players.forEach(function(p){ if(p.avatar_url) AC[p.name] = p.avatar_url; });
  AV = Date.now();
  window.dispatchEvent(new CustomEvent('ac'));
}

// ── API ───────────────────────────────────────────────────────────────────────
var API = window.location.origin;
async function apiFetch(path, options) {
  options = options || {};
  var res = await fetch(API + path, Object.assign({ headers: { "Content-Type": "application/json" } }, options));
  if (!res.ok) {
    var err = await res.json().catch(function(){ return { detail: "Ошибка сервера" }; });
    throw new Error(err.detail || "Ошибка сервера");
  }
  return res.json();
}

// ── Constants ─────────────────────────────────────────────────────────────────
var AVATAR_COLORS = ["#E8822A","#2E7D32","#1565C0","#6A1B9A","#C62828","#00838F","#AD6800","#006064"];

function getRank(r) {
  if (r >= 1300) return { label:"Мастер",   color:"#E8822A", bg:"#FEF3E8" };
  if (r >= 1200) return { label:"Эксперт",  color:"#2E7D32", bg:"#E8F5E9" };
  if (r >= 1100) return { label:"Профи",    color:"#1565C0", bg:"#E3F2FD" };
  if (r >= 1050) return { label:"Опытный",  color:"#6A1B9A", bg:"#F3E5F5" };
  return              { label:"Новичок",  color:"#78909C", bg:"#ECEFF1" };
}

function normalizeMatch(raw) {
  if (!raw) return raw;
  var p1b = raw.p1b||null, p2b = raw.p2b||null;
  var m = Object.assign({}, raw, {p1b:p1b, p2b:p2b});
  if (m.p1 <= m.p2) return m;
  return Object.assign({}, m, {p1:m.p2,p2:m.p1,s1:m.s2,s2:m.s1,d1:m.d2,d2:m.d1,p1b:m.p2b,p2b:m.p1b});
}

function buildRatingHistory(players, matches) {
  var cur = {};
  players.forEach(function(p){ cur[p.name] = p.rating; });
  var sorted = [...matches].sort(function(a,b){ return a.id - b.id; });
  sorted.forEach(function(m){
    [m.p1,m.p1b].filter(Boolean).forEach(function(n){ if(cur[n]!==undefined) cur[n] -= m.d1; });
    [m.p2,m.p2b].filter(Boolean).forEach(function(n){ if(cur[n]!==undefined) cur[n] -= m.d2; });
  });
  var hist = {};
  sorted.forEach(function(m){
    hist[m.id] = {};
    [...[m.p1,m.p1b].filter(Boolean),...[m.p2,m.p2b].filter(Boolean)].forEach(function(n){
      if(cur[n]!==undefined) hist[m.id][n] = cur[n];
    });
    [m.p1,m.p1b].filter(Boolean).forEach(function(n){ if(cur[n]!==undefined) cur[n] += m.d1; });
    [m.p2,m.p2b].filter(Boolean).forEach(function(n){ if(cur[n]!==undefined) cur[n] += m.d2; });
  });
  return hist;
}

// ── Shared styles ─────────────────────────────────────────────────────────────
var card     = { background:"#fff", borderRadius:12, border:"1px solid #E8EAEC", overflow:"hidden" };
var ch       = { display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 18px", borderBottom:"1px solid #E8EAEC" };
var th       = { padding:"9px 16px", textAlign:"left", fontSize:11, fontWeight:700, color:"#8C9BAB", textTransform:"uppercase", letterSpacing:.6, background:"#FAFBFC", borderBottom:"1px solid #E8EAEC" };
var td       = { padding:"11px 16px", fontSize:14, verticalAlign:"middle" };
var delBtn   = { background:"none", border:"1px solid #E8EAEC", borderRadius:6, padding:0, width:34, height:34, cursor:"pointer", color:"#8C9BAB", display:"flex", alignItems:"center", justifyContent:"center", transition:"all .15s", lineHeight:0, flexShrink:0 };
var btnPrimary  = { padding:"9px 20px", borderRadius:8, background:"#E8822A", color:"#fff", border:"none", fontWeight:700, fontSize:14, cursor:"pointer" };
var btnOutline  = { padding:"9px 20px", borderRadius:8, background:"#fff", color:"#1A1A1A", border:"1px solid #E8EAEC", fontWeight:600, fontSize:14, cursor:"pointer" };
var btnDanger   = { padding:"9px 20px", borderRadius:8, background:"#C62828", color:"#fff", border:"none", fontWeight:700, fontSize:14, cursor:"pointer" };
var labelSt     = { fontSize:11, fontWeight:700, color:"#8C9BAB", textTransform:"uppercase", letterSpacing:.7, marginBottom:8 };
var selectSt    = { width:"100%", padding:"10px 36px 10px 14px", borderRadius:8, border:"1px solid #E8EAEC", background:"#fff", color:"#1A1A1A", fontSize:14, outline:"none", cursor:"pointer", marginBottom:10 };
