/* Hakeman House — app logic.
   Sections: 1 core + state · 2 Today, Lists, Dinners · 3 Hosting (ported engine) · 4 Cookbook + cooking mode · 5 Capture (voice + Claude sorting) · 6 events + boot */
(() => {
"use strict";

/* ───────────────────────── 1. Core ───────────────────────── */
const CB = window.COOKBOOK || {recipes:{}, timing:{}, flex:{}, category:{}};
const R = CB.recipes, TIMING = CB.timing, FLEX = CB.flex, RCAT = CB.category;
const COURSES = ["Breakfast","Appetizers","Dinner","Sides","Dessert","Drinks","Other"];
const HTABS = [["plan","Checklist"],["menu","Menu"],["day","Day-of"],["shop","Shop"],["guests","Guests"],["rooms","Rooms"]];
const CATS = [["invites","Invites"],["reservations","Reservations"],["rooms","Rooms"],["house","House"],["food","Food"]];
const ROOM_ITEMS = ["Fresh sheets","Towels","Extra blanket","Chocolate on the pillow"];
const WK_NAMES = {thanksgiving:"Thanksgiving", christmas:"Christmas"};
const VIEWS = [["today","Today"],["lists","Lists"],["dinners","Dinners"],["hosting","Hosting"],["cookbook","Cookbook"]];
const RCATS = ["Breakfast","Appetizers","Mains","Sides","Desserts","Drinks","For the pups"];
const LIST_ALIASES = {grocery:["grocery","groceries","store","supermarket","food shop","shopping"], costco:["costco","bulk","warehouse"], todo:["to-do","todo","to do","tasks","errands","list"], ideas:["ideas","meal ideas","dinner ideas","meals","dinners"]};

const S = {events:[], dishes:[], guests:[], tasks:[], extras:[], rooms:[], lists:[], items:[], plans:[], checks:{}, dinners:{}};
const U = {view:"today", wk:null, sub:"all", htab:"plan", catF:"all", listId:null, editList:false, weekOff:0, editDinner:null, pickIdea:null, open:{}, armed:null, dayEv:null, q:"", rcat:"All"};
let db = null, sample = null, ready = false, noDb = false, seen = 0;
const ls = {get:(k) => { try { return localStorage.getItem(k); } catch(e) { return null; } }, set:(k,v) => { try { localStorage.setItem(k,v); } catch(e) {} }};
U.view = ["today","lists","dinners","hosting","cookbook","plans"].includes(ls.get("hph_view")) ? ls.get("hph_view") : "today";
U.wk = ls.get("hph_wk"); U.htab = ls.get("hph_htab") || "plan"; U.listId = ls.get("hph_list");
if (/^#(today|lists|dinners|hosting|cookbook|plans)$/.test(location.hash)) U.view = location.hash.slice(1);

const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const uid = () => Math.random().toString(36).slice(2,8) + Date.now().toString(36);
const pad = n => String(n).padStart(2,"0");
const iso = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const todayISO = () => iso(new Date());
const pd = s => { const [y,m,d] = String(s).split("-").map(Number); return new Date(y, m-1, d); };
const addDays = (s,n) => { const d = pd(s); d.setDate(d.getDate()+n); return iso(d); };
const fmt = (s, o={weekday:"short",month:"short",day:"numeric"}) => s ? pd(s).toLocaleDateString("en-US", o) : "";
const daysTo = s => Math.round((pd(s) - pd(todayISO())) / 864e5);
const byDate = (a,b) => (a.date||"").localeCompare(b.date||"");
const weekStart = s => { const d = pd(s); d.setDate(d.getDate() - d.getDay()); return iso(d); }; // weeks run Sunday to Saturday: plan and shop on Sunday
const norm = s => String(s||"").toLowerCase().replace(/[^a-z0-9 ]+/g," ").replace(/\s+/g," ").trim();
const CHECK = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.5l3 3 7-7"/></svg>';
const I = {
  today:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  lists:'<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2"/>',
  dinners:'<path d="M7 3v8a2 2 0 0 0 4 0V3M9 11v10M17 3c-2 0-3 2-3 5s1 4 3 4v9"/>',
  hosting:'<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  cookbook:'<path d="M4 4h7a2 2 0 0 1 2 2v14a1 1 0 0 0-1-1H4zM20 4h-7a2 2 0 0 0-2 2v14a1 1 0 0 1 1-1h8z"/>',
  mic:'<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  up:'<path d="M12 19V5M5 12l7-7 7 7"/>', prev:'<path d="M15 5l-7 7 7 7"/>', next:'<path d="M9 5l7 7-7 7"/>',
  close:'<path d="M6 6l12 12M18 6L6 18"/>', plus:'<path d="M12 5v14M5 12h14"/>'
};
const svg = (k, cls="") => `<svg viewBox="0 0 24 24" aria-hidden="true" class="${cls}">${I[k]}</svg>`;

function setHTML(el, html){
  const a = document.activeElement, keep = a && el.contains(a) && a.id ? {id:a.id, v:a.value, s:a.selectionStart, e:a.selectionEnd, t:a.type} : null;
  el.innerHTML = html;
  if (!keep) return;
  const n = document.getElementById(keep.id); if (!n) return;
  if (/^(text|search)$/.test(keep.t) && n.value !== keep.v) n.value = keep.v;
  try { n.focus({preventScroll:true}); if (/^(text|search)$/.test(keep.t) && keep.s != null) n.setSelectionRange(keep.s, keep.e); } catch(e) {}
}
function toast(m){ const n = document.createElement("p"); n.className = "toast"; n.textContent = m; document.body.append(n); setTimeout(() => n.remove(), 3200); }

/* Writes. Every add uses a generated id so a capture can be undone. */
async function w(col, id, data, mode="update"){
  if (!db) { toast("Sign in to claude.ai to save changes."); return null; }
  try {
    const ref = db.collection(col).doc(id || uid());
    if (mode === "set") await ref.set(data); else if (mode === "delete") await ref.delete(); else await ref.update(data);
    return ref.id;
  } catch(e) { toast(e && e.code === "not_granted" ? "You have view-only access to this plan." : "That change didn't save. Check your connection and try again."); return null; }
}
const add = (col, data) => w(col, null, data, "set");

/* ───────────────────────── Derived data ───────────────────────── */
const sortedLists = () => S.lists.slice().sort((a,b) => (a.order||0)-(b.order||0) || a.name.localeCompare(b.name));
const listItems = id => S.items.filter(i => i.listId === id).sort((a,b) => (a.createdAt||0)-(b.createdAt||0));
const openItems = id => listItems(id).filter(i => !i.done);
const findListByName = name => { const n = norm(name); if (!n) return null;
  let hit = S.lists.find(l => norm(l.name) === n) || S.lists.find(l => (LIST_ALIASES[l.id]||[]).includes(n));
  if (!hit) hit = S.lists.find(l => norm(l.name).includes(n) || n.includes(norm(l.name)));
  return hit || null; };
const wkKey = e => e.weekend || e.id;
const weekends = () => { const m = {}; S.events.forEach(e => (m[wkKey(e)] ||= []).push(e)); return Object.entries(m).map(([k,v]) => ({k, evs:v.sort(byDate)})).sort((a,b) => byDate(a.evs[0], b.evs[0])); };
const wkEvs = () => S.events.filter(e => wkKey(e) === U.wk).sort(byDate);
const scopeEvs = () => U.sub === "all" ? wkEvs() : wkEvs().filter(e => e.id === U.sub);
const inScope = k => { const ids = scopeEvs().map(e => e.id); return S[k].filter(x => ids.includes(x.eventId)); };
const evById = id => S.events.find(e => e.id === id);
const wkName = () => WK_NAMES[U.wk] || (wkEvs()[0]||{}).name || "";
const byOther = x => !!(x.who && !/^(me|i|hailey|you|us|we)$/i.test(x.who.trim()));
const nextEvent = () => S.events.filter(e => daysTo(e.date) >= 0).sort(byDate)[0] || S.events.slice().sort(byDate).pop();
const hk = t => { let h = 5381; for (const ch of t) h = ((h << 5) + h + ch.charCodeAt(0)) >>> 0; return h.toString(36); };
const ck = (on, act, id, label) => `<button class="ck" role="checkbox" aria-checked="${!!on}" aria-label="${esc(label)}" data-act="${act}" data-id="${esc(id)}">${on ? CHECK : ""}</button>`;
const del = (col, id) => `<button class="x ${U.armed===col+id ? "arm" : ""}" data-act="del" data-col="${col}" data-id="${esc(id)}" aria-label="Remove">${U.armed===col+id ? "Remove" : "×"}</button>`;
const recipeFor = title => { const n = norm(title); if (!n) return ""; return Object.keys(R).find(k => norm(R[k].title) === n) || Object.keys(R).find(k => n.includes(norm(R[k].title)) || norm(R[k].title).includes(n)) || ""; };
const recipeTime = k => { const r = R[k]; if (!r) return ""; const m = r.meta.map(x => x.split(": ")); const get = l => (m.find(x => x[0] === l) || [])[1] || ""; const cook = get("Cook") || get("Roast") || get("Steam") || get("Chill") || get("Rest"); const prep = get("Prep"); return [prep && "Prep " + prep, cook && ((get("Cook") ? "Cook " : "") + cook)].filter(Boolean).join(" · "); };
const linkLabel = u => { try { const h = new URL(u).hostname.replace(/^www\./,""); return /pinterest/.test(h) ? "Pinterest" : /instagram/.test(h) ? "Instagram" : /tiktok/.test(h) ? "TikTok" : /youtu/.test(h) ? "YouTube" : h.split(".")[0].replace(/^./, c => c.toUpperCase()); } catch(e) { return "Link"; } };
const safeUrl = u => /^https?:\/\//i.test(String(u||"").trim()) ? String(u).trim() : "";
const timePill = t => t ? `<span class="pill time">${esc(t)}</span>` : "";
const shortTime = (t, k) => t || (k && R[k] ? (((R[k].meta.find(x => /^(Cook|Roast|Steam|Chill|Bake):/.test(x)) || "").split(": ")[1] || "").replace(/^about /i, "")) : "");
const linkPill = u => safeUrl(u) ? `<a class="pill link ext" href="${esc(safeUrl(u))}" target="_blank" rel="noopener">${esc(linkLabel(u))} ↗</a>` : "";
const plansOn = d => S.plans.filter(p => p.date && p.date <= d && (p.endDate || p.date) >= d).sort((a,b) => (a.time||"").localeCompare(b.time||""));
/* A recipe to show or cook can come from the cookbook (key), from fields stored on a dinner or idea (imported), or be link-only. */
const hasContent = o => !!(o && ((o.ingredients||[]).length || (o.steps||[]).length));
function recipeObj(o, src){ if (!o) return null;
  if (o.recipe && R[o.recipe]) return {...R[o.recipe], key:o.recipe, link:o.link || "", src};
  if (hasContent(o) || safeUrl(o.link)) return {title:o.title || o.text || "Recipe", note:o.note || "", meta:[o.time ? "Time: " + o.time : "", o.servings ? "Serves: " + o.servings : ""].filter(Boolean), ingredients:o.ingredients || [], steps:o.steps || [], link:o.link || "", src};
  return null; }
const recipeFromRef = ref => { const [kind, ...rest] = String(ref||"").split(":"); const id = rest.join(":");
  if (kind === "dinner") return recipeObj(S.dinners[id], ref); if (kind === "item") return recipeObj(S.items.find(i => i.id === id), ref); return R[kind] ? {...R[kind], key:kind, src:"cb:"+kind} : (R[id] ? {...R[id], key:id, src:"cb:"+id} : null); };
const recipeOptions = sel => `<option value="">From the cookbook (optional)</option>` + Object.entries(R).sort((a,b) => a[1].title.localeCompare(b[1].title)).map(([k,v]) => `<option value="${k}" ${sel===k?"selected":""}>${esc(v.title)}</option>`).join("");

/* ───────────────────────── Render shell ───────────────────────── */
function render(){
  const counts = {lists: S.items.filter(i => !i.done).length, hosting: S.tasks.filter(t => !t.done && daysTo(t.date||todayISO()) <= 7).length};
  setHTML($("#nav"), VIEWS.map(([k,l]) => `<button class="nav-item" role="tab" aria-selected="${U.view===k}" data-act="view" data-id="${k}">${svg(k)}<span>${l}</span>${counts[k] ? `<span class="n">${counts[k]}</span>` : ""}</button>`).join(""));
  $("#railfoot").innerHTML = `${new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}<br>${ready ? (db ? "Shared with the household" : "Not signed in") : "Loading…"}`;
  const key = [U.view, U.listId, U.wk, U.sub, U.htab, U.weekOff].join("|");
  let body;
  if (!ready) body = `<p class="status">Loading the house…</p>`;
  else if (noDb) body = `<div class="empty"><b>Sign in to claude.ai</b>Your lists, dinners and hosting plans live in the shared database. Sign in and reopen this page.</div>`;
  else body = ({today:vToday, lists:vLists, dinners:vDinners, hosting:vHosting, cookbook:vCookbook, plans:vPlans})[U.view]();
  const sc = $("#main");
  setHTML(sc, `<div class="wrap">${body}</div>`);
  if (render.k !== key) { sc.scrollTop = 0; render.k = key; }
}

/* ───────────────────────── 2. Today ───────────────────────── */
function vToday(){
  const t = todayISO(), h = new Date().getHours();
  const greet = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  const dn = S.dinners[t], ws = weekStart(t);
  const dnTime = dn && (dn.time || (dn.recipe && recipeTime(dn.recipe)));
  const hero = dn && dn.title ? `<p class="eyebrow">Tonight</p><div class="big">${esc(dn.title)}</div>${dn.note ? `<div class="muted">${esc(dn.note)}</div>` : ""}${dnTime || (dn && dn.link) ? `<div>${timePill(dnTime)}${linkPill(dn.link)}</div>` : ""}
      <div class="inline">${recipeObj(dn) ? `${(recipeObj(dn).steps||[]).length ? `<button class="btn sm" data-act="cook" data-id="dinner:${t}">Cook it</button>` : ""}<button class="btn sm ghost" data-act="recipe" data-id="dinner:${t}">Recipe</button>` : ""}<button class="btn sm quiet" data-act="editdinner" data-id="${t}">Change</button></div>`
    : `<p class="eyebrow">Tonight</p><div class="big" style="color:var(--faint)">Nothing planned yet</div><div class="inline"><button class="btn sm" data-act="editdinner" data-id="${t}">Plan dinner</button></div>`;
  const strip = `<div class="weekstrip">${[0,1,2,3,4,5,6].map(i => { const d = addDays(ws,i), m = S.dinners[d]; return `<button class="${d===t?"now":""}" data-act="editdinner" data-id="${d}"><b>${fmt(d,{weekday:"short"})}</b><span>${m && m.title ? esc(m.title) : "–"}</span></button>`; }).join("")}</div>`;
  const lists = sortedLists();
  const lcards = lists.length ? `<div class="grid c4">${lists.slice(0,8).map(l => { const o = openItems(l.id); return `<button class="lcard" data-act="golist" data-id="${l.id}"><p class="eyebrow">${esc(l.name)}</p><div class="big ${o.length?"":"faint"}" ${o.length?"":'style="color:var(--faint)"'}>${o.length}</div><div class="peek">${o.length ? esc(o.slice(0,3).map(i => i.text).join(" · ")) : "All clear"}</div></button>`; }).join("")}</div>` : `<div class="empty"><b>No lists yet</b>Open Lists to make the first one, or say "add milk to grocery".</div>`;
  const ev = nextEvent(); let host = `<div class="empty"><b>No events planned</b>Open Hosting to add the first one.</div>`;
  if (ev) { const evs = S.events.filter(e => wkKey(e) === wkKey(ev)), ids = evs.map(e => e.id), tasks = S.tasks.filter(x => ids.includes(x.eventId)), done = tasks.filter(x => x.done).length, g = S.guests.filter(x => x.eventId === ev.id), yes = g.filter(x => x.rsvp === "yes").length, n = daysTo(ev.date);
    host = `<button class="card tap" data-act="gohost" data-id="${wkKey(ev)}"><div class="host-card"><div><p class="eyebrow">Up next</p><div class="name">${esc(ev.name)}</div><div class="when">${fmt(ev.date,{weekday:"long",month:"long",day:"numeric"})}${ev.time ? " · " + esc(ev.time) : ""}</div>${ev.theme ? `<div class="sum-th">${esc(ev.theme)}</div>` : ""}</div><div class="count"><b>${n < 0 ? "Done" : n}</b><span>${n < 0 ? "" : n === 1 ? "day to go" : "days to go"}</span></div></div>
      <div class="stats"><span><b>${done}/${tasks.length}</b> to-dos done</span><span><b>${yes}/${g.length}</b> guests confirmed</span></div><div class="bar"><i style="width:${tasks.length ? Math.round(done/tasks.length*100) : 0}%"></i></div></button>`; }
  const due = S.tasks.filter(x => !x.done && x.date && daysTo(x.date) <= 7).sort((a,b) => byDate(a,b) || (a.t||"99").localeCompare(b.t||"99")).slice(0,8);
  const dueHtml = due.length ? `<div class="card soft"><div class="list">${due.map(x => { const d = daysTo(x.date), e = evById(x.eventId); return `<div class="row ${d<0?"overdue":""}">${ck(false,"task",x.id,x.title)}<div class="main"><div class="t">${esc(x.title)}</div><div class="s">${d<0?"Overdue · ":d===0?"Today · ":d===1?"Tomorrow · ":""}${fmt(x.date)}${e ? " · " + esc(e.short||e.name) : ""}${x.detail ? " · " + esc(x.detail) : ""}</div></div></div>`; }).join("")}</div></div>` : "";
  const soon = S.plans.filter(p => p.date && daysTo(p.endDate || p.date) >= 0 && daysTo(p.date) <= 14).sort((a,b) => byDate(a,b) || (a.time||"").localeCompare(b.time||""));
  const coming = `<div class="card soft">${soon.length ? `<div class="list">${soon.map(p => planRow(p)).join("")}</div>` : `<div class="empty" style="padding:12px 4px"><b>Nothing on the horizon</b>Trips, appointments, nights out. Add one below or say "New York next Sunday".</div>`}
    <form class="add" data-form="plan" style="margin-top:10px"><input type="text" id="np" placeholder="e.g. New York for the day" required><input type="date" id="npd" value="${t}"><input type="text" id="npt" placeholder="Time (optional)" style="flex:0 1 150px"><button class="btn">Add</button><button class="btn quiet" type="button" data-act="view" data-id="plans">All plans</button></form></div>`;
  return `<div class="ph"><div><svg class="mark" aria-hidden="true"><use href="#hh-mark"/></svg><h1>${greet}</h1><div class="sub">${new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}${plansOn(t).length ? " · " + esc(plansOn(t).map(p => p.title).join(", ")) : ""}</div></div>${wxCard()}</div>
    <div class="widgets">${calCard()}${habitsCard()}</div>
    <div class="today-grid"><div class="card dinner-hero">${hero}${strip}</div>${host}</div>
    <h2 class="eyebrow">Coming up</h2>${coming}
    <h2 class="eyebrow">Lists</h2>${lcards}
    ${due.length ? `<h2 class="eyebrow">Hosting to-dos this week</h2>${dueHtml}` : ""}`;
}

/* ───────────────────────── Weather (AccuWeather connector, Philadelphia) ───────────────────────── */
const WX_SERVER = "AccuWeather®", WX_IN = {queryParams:{locationKey:"2627552", unit:"imperial", lang:"en"}};
const WX = {mcp:null, cur:null, daily:null, state:"off", msg:"", at:0, stale:false};
const WXI = {
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon:'<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  partly:'<path d="M8 2.5V4M2.5 8H4M4.1 4.1l1 1M11.9 4.1l-1 1"/><path d="M11 9.5A3.5 3.5 0 0 0 4.6 10.8"/><path d="M8 20h9a3.5 3.5 0 0 0 .4-7A5 5 0 0 0 8 13.2 3.4 3.4 0 0 0 8 20z"/>',
  cloud:'<path d="M7 18h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6.1 11 3.5 3.5 0 0 0 7 18z"/>',
  rain:'<path d="M7 15h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6.1 8 3.5 3.5 0 0 0 7 15z"/><path d="M9 18l-1 2.5M13 18l-1 2.5M17 18l-1 2.5"/>',
  snow:'<path d="M7 15h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6.1 8 3.5 3.5 0 0 0 7 15z"/><path d="M8.5 18.5h.01M12 19.5h.01M15.5 18.5h.01M10 21.5h.01M14 21.5h.01"/>',
  storm:'<path d="M7 15h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6.1 8 3.5 3.5 0 0 0 7 15z"/><path d="M12.5 15.5l-2 3.5h3l-2 3.5"/>'
};
const wxKind = c => { c = +c; if ([15,16,17,41,42].includes(c)) return "storm"; if ((c>=12 && c<=18) || c===39 || c===40) return "rain"; if ((c>=19 && c<=29) || c===43 || c===44) return "snow";
  if (c===33 || c===34) return "moon"; if (c>=35 && c<=38) return "partly"; if (c>=6 && c<=11) return "cloud"; if (c>=3 && c<=5) return "partly"; return "sun"; };
const wxSvg = c => `<svg viewBox="0 0 24 24" aria-hidden="true">${WXI[wxKind(c)]}</svg>`;
function wxCard(){
  if (WX.state === "off") return "";
  const head = `<p class="eyebrow">Philadelphia</p>`;
  if (WX.state === "approve") return `<div class="wx card soft">${head}<div class="wx-msg">The weather needs your OK once.</div><div><button class="btn sm" data-act="wxallow">Show the weather</button></div></div>`;
  if (WX.state === "connect") return ""; /* a household member without the AccuWeather connector simply doesn't see the card */
  const c = WX.cur && WX.cur.currentConditions, d = (WX.daily && WX.daily.dailyForecast) || [];
  if (!c && !d.length) return `<div class="wx card soft">${head}<div class="wx-msg">${WX.state === "error" ? "The weather isn't loading right now. It will try again shortly." : "Checking the weather…"}</div></div>`;
  const t0 = d[0], isDay = c ? c.isDayTime !== false : true;
  const temp = c ? c.temperatureValue : t0.day.temperature, code = c ? c.iconCode : t0.day.icon, cond = c ? c.phrase : t0.day.phrase;
  const rain = t0 ? Math.max(t0.day.rainProbabilityValue || 0, t0.night.rainProbabilityValue || 0) : 0;
  const say = t0 ? (isDay ? t0.day.longPhrase : "Tonight: " + t0.night.longPhrase) : "";
  const next = d.slice(1, 4).map(x => `<div><b>${esc(x.dayOfWeek || "")}</b>${wxSvg(x.day.icon)}<span>${x.day.temperature}°<i>${x.night.temperature}°</i></span>${(x.day.rainProbabilityValue || 0) >= 40 ? `<em>${x.day.rainProbabilityValue}% rain</em>` : ""}</div>`).join("");
  const upd = WX.stale && WX.at ? `<div class="wx-say">Last updated ${new Date(WX.at).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"})}</div>` : "";
  return `<div class="wx card soft">${head}<div class="wx-now">${wxSvg(code)}<div class="wx-temp">${temp}°</div><div><div class="wx-cond">${esc(cond || "")}</div>${t0 ? `<div class="wx-hl">H ${t0.day.temperature}° · L ${t0.night.temperature}°${rain >= 30 ? ` · <span class="wx-rain">${rain}% rain</span>` : ""}</div>` : ""}</div></div>
    ${say ? `<div class="wx-say">${esc(say)}</div>` : ""}${next ? `<div class="wx-next">${next}</div>` : ""}${upd}</div>`;
}
function wxErr(e){ const code = e && e.code;
  const retract = () => { WX.cur = null; WX.daily = null; };
  if (code === "approval_required") { retract(); WX.state = "approve"; }
  else if (code === "server_not_connected" || code === "selection_required" || code === "server_not_found") { retract(); WX.state = "connect"; WX.msg = code === "selection_required" ? "Choose which AccuWeather connection to use when claude.ai asks, then reopen this page." : "Add AccuWeather in claude.ai Settings → Connectors to see the weather here."; }
  else if (code === "needs_reauth") { retract(); WX.state = "connect"; WX.msg = "Reconnect AccuWeather in claude.ai Settings → Connectors to see the weather here."; }
  else if (["not_in_manifest","blocked_by_policy","not_granted","capability_disabled","capability_removed","bad_request","transform_error","user_changed"].includes(code)) { retract(); WX.state = "off"; }
  else { if (WX.cur || WX.daily) { WX.stale = true; WX.state = "ok"; } else WX.state = "error"; }
}
const wxHandler = key => ev => {
  if (ev.type === "data") { const p = ev.result && ev.result.payload; if (p && typeof p === "object") { WX[key] = p; WX.at = (ev.result.cache && ev.result.cache.storedAt) || Date.now(); WX.state = "ok"; WX.stale = false; } }
  else wxErr(ev.error);
  if (U.view === "today") render();
};
function wxStart(m){ if (!m) return; WX.mcp = m; WX.state = "loading"; if (U.view === "today") render();
  m.watchTool(WX_SERVER, "widgets-current-claude", WX_IN, wxHandler("cur"), {refetchInterval: 30*60*1000, cache:{staleTime: 10*60*1000, gcTime: 6*3600*1000}});
  m.watchTool(WX_SERVER, "widgets-daily-claude", WX_IN, wxHandler("daily"), {refetchInterval: 3*3600*1000, cache:{staleTime: 60*60*1000, gcTime: 24*3600*1000}}); }
document.addEventListener("click", async e => { if (!e.target.closest('[data-act="wxallow"]') || !WX.mcp) return;
  WX.state = "loading"; render();
  try { const r = await WX.mcp.callTool(WX_SERVER, "widgets-current-claude", WX_IN); if (r && r.payload && typeof r.payload === "object") { WX.cur = r.payload; WX.at = Date.now(); WX.stale = false; WX.state = "ok"; }
    WX.mcp.invalidate(WX_SERVER).catch(() => {}); }
  catch (err) { wxErr(err); }
  render(); });

/* ───────────────────────── Calendar (Microsoft 365 / Outlook) ───────────────────────── */
const CAL_SERVER = "Microsoft 365", CAL_TOOL = "outlook_calendar_search";
const CAL = {mcp:null, day:null, today:null, tomorrow:null, state:"off", msg:"", stale:false, un:[]};
const calIn = (a, b) => ({query:"*", afterDateTime:a + "T00:00:00", beforeDateTime:b + "T00:00:00", order:"oldest", limit:25, offset:0});
/* The connector answers with one JSON object per event (plus a trailing {totalResultCount}), as separate text blocks or run together in one. */
function calParse(result){
  const out = [], push = o => { if (Array.isArray(o)) o.forEach(push); else if (o && typeof o === "object") { if (o.subject !== undefined || o.start) out.push(o); else if (Array.isArray(o.events)) o.events.forEach(push); else if (Array.isArray(o.value)) o.value.forEach(push); } };
  const split = txt => { let depth = 0, inStr = false, esc_ = false, start = -1;
    for (let i = 0; i < txt.length; i++) { const ch = txt[i];
      if (inStr) { if (esc_) esc_ = false; else if (ch === "\\") esc_ = true; else if (ch === '"') inStr = false; continue; }
      if (ch === '"') inStr = true; else if (ch === "{") { if (depth++ === 0) start = i; } else if (ch === "}") { if (--depth === 0 && start >= 0) { try { push(JSON.parse(txt.slice(start, i + 1))); } catch (e) {} start = -1; } } } };
  if (result && result.structuredContent && typeof result.structuredContent === "object") push(result.structuredContent);
  if (!out.length && result && Array.isArray(result.content)) result.content.forEach(b => { if (b && b.type === "text" && typeof b.text === "string") { try { push(JSON.parse(b.text)); } catch (e) { split(b.text); } } });
  return out;
}
const calWall = s => { const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/.exec(String(s || "")); return m ? {date:m[1], min:+m[2]*60 + +m[3]} : null; };
const calTime = min => { const h = Math.floor(min/60), m = min % 60; return `${h % 12 || 12}${m ? ":" + String(m).padStart(2,"0") : ""}${h < 12 ? "am" : "pm"}`; };
const calWhere = l => { l = String(l || "").trim(); if (!l) return ""; if (/teams/i.test(l)) return "Teams"; if (/zoom/i.test(l)) return "Zoom"; if (/meet\.google|google meet/i.test(l)) return "Meet"; return l.length > 28 ? l.slice(0, 27) + "…" : l; };
function calDay(list, d){
  const evs = (list || []).filter(e => !e.isCancelled), allDay = [], timed = [];
  evs.forEach(e => { const s = calWall(e.start && e.start.dateTime), en = calWall(e.end && e.end.dateTime); if (!s) return;
    if (e.isAllDay) { if (s.date <= d && (!en || en.date > d)) allDay.push(e); }
    else if (s.date === d) timed.push({e, s:s.min, en: en && en.date === d ? en.min : 24*60}); });
  timed.sort((a,b) => a.s - b.s);
  return {allDay, timed};
}
function calRows(timed, nowMin){
  return timed.map(x => { const past = nowMin != null && x.en <= nowMin, now = nowMin != null && x.s <= nowMin && x.en > nowMin, href = safeUrl(x.e.webLink), where = calWhere(x.e.location);
    const inner = `<span class="cal-t">${calTime(x.s)}</span><span class="cal-m"><span class="cal-s">${esc(x.e.subject || "(No title)")}</span>${where || now ? `<span class="cal-w">${now ? `<b>Now</b>${where ? " · " : ""}` : ""}${esc(where)}</span>` : ""}</span>`;
    return href ? `<a class="cal-row ${past ? "past" : ""} ${now ? "now" : ""}" href="${esc(href)}" target="_blank" rel="noopener">${inner}</a>` : `<div class="cal-row ${past ? "past" : ""} ${now ? "now" : ""}">${inner}</div>`; }).join("");
}
function calCard(){
  if (CAL.state === "off") return "";
  const head = `<p class="eyebrow">Today's calendar</p>`;
  if (CAL.state === "approve") return `<div class="card soft cal">${head}<div class="wx-msg">Your Outlook calendar needs your OK once.</div><div><button class="btn sm" data-act="calallow">Show my calendar</button></div></div>`;
  if (CAL.state === "connect") return ""; /* a household member without the Microsoft 365 connector simply doesn't see the card */
  if (!CAL.today) return `<div class="card soft cal">${head}<div class="wx-msg">${CAL.state === "error" ? "Your calendar isn't loading right now. It will try again shortly." : "Checking your calendar…"}</div></div>`;
  const t = todayISO(), now = new Date(), nowMin = now.getHours()*60 + now.getMinutes();
  const td = calDay(CAL.today, t), left = td.timed.filter(x => x.en > nowMin);
  const chips = td.allDay.length ? `<div class="cal-all">${td.allDay.map(e => `<span class="pill">${esc(e.subject || "All day")}</span>`).join("")}</div>` : "";
  let body;
  if (!td.timed.length) body = `<div class="cal-empty">No meetings today.</div>`;
  else if (!left.length) body = `<div class="cal-empty">That's it for meetings today.</div>`;
  else { const shown = td.timed.filter(x => x.en > nowMin - 60).slice(0, 5); body = `<div class="cal-list">${calRows(shown, nowMin)}</div>${left.length > shown.filter(x => x.en > nowMin).length ? `<div class="wx-say">+${left.length - shown.filter(x => x.en > nowMin).length} more later</div>` : ""}`; }
  let tm = "";
  if (!left.length && CAL.tomorrow) { const tt = calDay(CAL.tomorrow, addDays(t, 1)); if (tt.timed.length) tm = `<p class="eyebrow cal-tm">Tomorrow</p><div class="cal-list">${calRows(tt.timed.slice(0, 3), null)}</div>${tt.timed.length > 3 ? `<div class="wx-say">+${tt.timed.length - 3} more</div>` : ""}`; }
  const sum = td.timed.length ? `<span class="cal-n">${left.length ? `${left.length} to go` : `${td.timed.length} done`}</span>` : "";
  return `<div class="card soft cal"><div class="cal-head">${head}${sum}</div>${chips}${body}${tm}${CAL.stale ? `<div class="wx-say">May be out of date</div>` : ""}</div>`;
}
function calErr(e){ const code = e && e.code, retract = () => { CAL.today = null; CAL.tomorrow = null; };
  if (code === "approval_required") { retract(); CAL.state = "approve"; }
  else if (code === "server_not_connected" || code === "selection_required" || code === "server_not_found") { retract(); CAL.state = "connect"; CAL.msg = code === "selection_required" ? "Choose which Microsoft 365 connection to use when claude.ai asks, then reopen this page." : "Add Microsoft 365 in claude.ai Settings → Connectors to see your meetings here."; }
  else if (code === "needs_reauth") { retract(); CAL.state = "connect"; CAL.msg = "Reconnect Microsoft 365 in claude.ai Settings → Connectors to see your meetings here."; }
  else if (["not_in_manifest","blocked_by_policy","not_granted","capability_disabled","capability_removed","bad_request","transform_error","user_changed"].includes(code)) { retract(); CAL.state = "off"; }
  else { if (CAL.today) { CAL.stale = true; CAL.state = "ok"; } else CAL.state = "error"; }
}
const calHandler = key => ev => {
  if (ev.type === "data") { CAL[key] = calParse(ev.result); CAL.state = "ok"; CAL.stale = false; }
  else calErr(ev.error);
  if (U.view === "today") render();
};
function calWatch(){ if (!CAL.mcp) return; const t = todayISO(); if (CAL.day === t) return; CAL.day = t;
  CAL.un.forEach(u => { try { u(); } catch (e) {} }); CAL.today = null; CAL.tomorrow = null;
  const opts = {refetchInterval: 10*60*1000, cache:{staleTime: 5*60*1000, gcTime: 12*3600*1000}};
  CAL.un = [CAL.mcp.watchTool(CAL_SERVER, CAL_TOOL, calIn(t, addDays(t,1)), calHandler("today"), opts),
            CAL.mcp.watchTool(CAL_SERVER, CAL_TOOL, calIn(addDays(t,1), addDays(t,2)), calHandler("tomorrow"), opts)]; }
function calStart(m){ if (!m) return; CAL.mcp = m; CAL.state = "loading"; calWatch(); if (U.view === "today") render(); }
setInterval(calWatch, 60000);
document.addEventListener("click", async e => { if (!e.target.closest('[data-act="calallow"]') || !CAL.mcp) return;
  CAL.state = "loading"; render(); const t = todayISO();
  try { const r = await CAL.mcp.callTool(CAL_SERVER, CAL_TOOL, calIn(t, addDays(t,1))); CAL.today = calParse(r); CAL.state = "ok"; CAL.stale = false; CAL.mcp.invalidate(CAL_SERVER).catch(() => {}); }
  catch (err) { calErr(err); }
  render(); });

/* ───────────────────────── Daily habits ───────────────────────── */
const HABIT_ICONS = {
  workout:'<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/>',
  water:'<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
  dog:'<path d="M5 9.5l1.5-4.5L9 8h6l2.5-3L19 9.5v4.5a5 5 0 0 1-5 5h-4a5 5 0 0 1-5-5z"/><path d="M10 12.5h.01M14 12.5h.01M11 15.5h2"/>',
  check:'<path d="M5 12.5l4.5 4.5L19 7.5"/>'
};
const habitList = () => (S.habits || []).filter(h => !h.archived).sort((a,b) => (a.order||0) - (b.order||0));
const habitDone = (d, id) => !!((S.habitlog || {})[d] || {})[id];
function habitStreak(id){ let d = todayISO(), n = 0; if (!habitDone(d, id)) d = addDays(d, -1); while (habitDone(d, id) && n < 400) { n++; d = addDays(d, -1); } return n; }
function habitsCard(){
  if (!db) return "";
  const hs = habitList(), t = todayISO();
  if (!hs.length) return `<div class="card soft habits"><p class="eyebrow">Daily habits</p><div class="wx-msg">No habits set up yet.</div></div>`;
  const done = hs.filter(h => habitDone(t, h.id)).length;
  return `<div class="card soft habits"><div class="cal-head"><p class="eyebrow">Daily habits</p><span class="cal-n">${done === hs.length ? "All done today" : `${done} of ${hs.length}`}</span></div>
    <div class="hab-row">${hs.map(h => { const on = habitDone(t, h.id), st = habitStreak(h.id);
      return `<button class="hab ${on ? "on" : ""}" data-act="habit" data-id="${esc(h.id)}" aria-pressed="${on}"><span class="hab-dot"><svg viewBox="0 0 24 24" aria-hidden="true">${HABIT_ICONS[on ? "check" : (h.icon || "check")] || HABIT_ICONS.check}</svg></span><span class="hab-name">${esc(h.name)}</span><span class="hab-st">${st > 1 ? `${st} days in a row` : on ? "Done today" : " "}</span></button>`; }).join("")}</div></div>`;
}
document.addEventListener("click", e => { const b = e.target.closest('[data-act="habit"]'); if (!b || !db) return;
  const t = todayISO(), id = b.dataset.id, cur = {...((S.habitlog || {})[t] || {})}; cur[id] = !cur[id];
  S.habitlog = {...(S.habitlog || {}), [t]: cur}; render(); w("habitlog", t, cur, "set"); });

/* ───────────────────────── Plans (coming up) ───────────────────────── */
function planRow(p){ const d = daysTo(p.date), multi = p.endDate && p.endDate !== p.date;
  const when = `${d===0?"Today":d===1?"Tomorrow":d<0?"Started "+fmt(p.date):fmt(p.date,{weekday:"long",month:"short",day:"numeric"})}${multi ? " – " + fmt(p.endDate,{month:"short",day:"numeric"}) : ""}${p.time ? " · " + esc(p.time) : ""}`;
  return `<div class="sw" data-col="plans" data-id="${p.id}"><div class="row plan"><span class="dot"></span><div class="main"><div class="t">${esc(p.title)}</div><div class="s">${when}${p.note ? " · " + esc(p.note) : ""}</div></div>${d > 1 && d <= 14 ? `<span class="pill">in ${d} days</span>` : ""}${del("plans", p.id)}</div><button class="sw-del" data-act="swdel" data-col="plans" data-id="${p.id}" tabindex="-1">Delete</button></div>`; }
function vPlans(){
  const t = todayISO(), all = S.plans.slice().sort((a,b) => byDate(a,b) || (a.time||"").localeCompare(b.time||""));
  const up = all.filter(p => (p.endDate || p.date) >= t), past = all.filter(p => (p.endDate || p.date) < t).reverse();
  let html = "", last = "";
  up.forEach(p => { const m = fmt(p.date,{month:"long",year:"numeric"}); if (m !== last) { if (last) html += `</div></div>`; last = m; html += `<h2 class="eyebrow">${m}</h2><div class="card soft"><div class="list">`; } html += planRow(p); });
  if (last) html += `</div></div>`;
  return `<div class="ph"><div><h1>Coming up</h1><div class="sub">Trips, appointments, nights out. Not a calendar, just what's ahead.</div></div><button class="btn sm ghost" data-act="view" data-id="today">Back to Today</button></div>
    <div class="card"><form class="add" data-form="plan" style="margin-top:0"><input type="text" id="np" placeholder="What's coming up?" required><input type="date" id="npd" value="${t}" aria-label="Date"><input type="date" id="npe" aria-label="End date (optional)"><input type="text" id="npt" placeholder="Time (optional)" style="flex:0 1 150px"><input type="text" id="npn" placeholder="Note (optional)"><button class="btn">Add</button></form><p class="note">Second date is optional, for a trip that spans days.</p></div>
    ${html || `<div class="empty"><b>Nothing planned yet</b></div>`}
    ${past.length ? `<details class="checked"><summary>Past (${past.length})</summary><div class="card soft"><div class="list">${past.slice(0,30).map(planRow).join("")}</div></div></details>` : ""}`;
}

/* ───────────────────────── Lists ───────────────────────── */
function vLists(){
  const lists = sortedLists();
  if (!lists.find(l => l.id === U.listId)) U.listId = lists[0] ? lists[0].id : null;
  const index = `<div class="list-index">${lists.map(l => `<button aria-pressed="${l.id===U.listId}" data-act="list" data-id="${l.id}">${esc(l.name)}<span class="n">${openItems(l.id).length || ""}</span></button>`).join("")}
    <form class="newlist" data-form="list"><input type="text" id="nl" placeholder="New list…" aria-label="New list name"></form></div>`;
  if (!U.listId) return `<div class="ph"><h1>Lists</h1></div><div class="lists-layout">${index}<div class="empty"><b>Make your first list</b>Grocery, Costco, to-do, anything. Type a name on the left.</div></div>`;
  const L = S.lists.find(l => l.id === U.listId), items = listItems(L.id), open = items.filter(i => !i.done), done = items.filter(i => i.done), isIdeas = L.id === "ideas" || /idea/i.test(L.name);
  const week = [0,1,2,3,4,5,6].map(i => addDays(todayISO(), i));
  const row = i => { const rk = i.recipe && R[i.recipe] ? i.recipe : (isIdeas ? recipeFor(i.text) : ""), tm = i.time || (rk && recipeTime(rk));
    return `<div class="sw" data-col="items" data-id="${i.id}"><div class="row ${i.done?"done":""} ${isIdeas?"idea-row":""}">${ck(i.done,"item",i.id,i.text)}<div class="main"><div class="t">${esc(i.text)}</div>${i.note ? `<div class="s">${esc(i.note)}</div>` : ""}${tm || i.link || rk || hasContent(i) ? `<div>${timePill(tm)}${rk ? `<button class="pill link" data-act="recipe" data-id="${rk}">Recipe</button>` : hasContent(i) ? `<button class="pill link" data-act="recipe" data-id="item:${i.id}">Recipe</button>` : ""}${linkPill(i.link)}</div>` : ""}
    ${U.editList ? `<div class="edit"><input type="text" id="it-${i.id}" value="${esc(i.time||"")}" placeholder="Time, e.g. 30 min" style="flex:0 1 160px"><input type="text" id="il-${i.id}" value="${esc(i.link||"")}" placeholder="Link (Pinterest, recipe site)" style="flex:1 1 200px"><button class="btn sm ghost" data-act="saveitem" data-id="${i.id}">Save</button></div>` : ""}
    ${isIdeas && !i.done && U.pickIdea === i.id ? `<div class="daypick">${week.map(d => `<button class="chip" data-act="pickday" data-id="${d}" data-idea="${esc(i.text)}">${d===todayISO()?"Tonight":fmt(d,{weekday:"short"})}</button>`).join("")}<button class="chip" data-act="plan" data-id="">Cancel</button></div>` : ""}</div>
    ${isIdeas && !i.done && U.pickIdea !== i.id ? `<button class="pill link plan" data-act="plan" data-id="${i.id}">Plan it</button>` : ""}${U.editList ? del("items", i.id) : ""}</div><button class="sw-del" data-act="swdel" data-col="items" data-id="${i.id}" tabindex="-1">Delete</button></div>`; };
  const main = `<div class="lhead"><h2>${esc(L.name)}</h2><div class="tools">${safeUrl(L.link) ? `<a class="btn sm ghost" href="${esc(safeUrl(L.link))}" target="_blank" rel="noopener">${esc(linkLabel(L.link))} board ↗</a>` : ""}${done.length ? `<button class="btn sm ghost" data-act="clearchecked" data-id="${L.id}">Clear ${done.length} checked</button>` : ""}<button class="btn sm ${U.editList?"":"quiet"}" data-act="editlist">${U.editList ? "Done" : "Edit"}</button>${U.editList ? `<button class="btn sm clay" data-act="dellist" data-id="${L.id}">${U.armed==="list"+L.id ? "Really delete?" : "Delete list"}</button>` : ""}</div></div>
    ${U.editList ? `<form class="add" data-form="listlink" data-id="${L.id}" style="margin:0 0 10px"><input type="text" id="ll" value="${esc(L.link||"")}" placeholder="Board or page link for this list (e.g. your Pinterest board)"><button class="btn sm ghost">Save link</button></form>` : ""}
    <form class="quickadd" data-form="item"><input type="text" id="ni" placeholder="${isIdeas ? "A dinner idea…" : "Add to " + esc(L.name) + "…"}" aria-label="Add item" autocomplete="off">${isIdeas ? `<input type="text" id="ni-time" placeholder="Time" aria-label="How long it takes" style="flex:0 1 110px">` : ""}<button class="rbtn primary" aria-label="Add">${svg("plus")}</button></form>
    <div class="card soft">${open.length ? `<div class="list">${open.map(row).join("")}</div>` : `<div class="empty"><b>${isIdeas ? "No ideas saved" : "All clear"}</b>${isIdeas ? "Jot down dinners you want to make. Plan one into the week with a tap." : "Add something above, or say it out loud."}</div>`}</div>
    ${done.length ? `<details class="checked" ${U.editList?"open":""}><summary>Checked off (${done.length})</summary><div class="card soft"><div class="list">${done.map(row).join("")}</div></div></details>` : ""}`;
  return `<div class="ph"><h1>Lists</h1><div class="sub">${S.items.filter(i => !i.done).length} open across ${lists.length} lists</div></div><div class="lists-layout">${index}<div>${main}</div></div>`;
}

/* ───────────────────────── Dinners ───────────────────────── */
function vDinners(){
  const t = todayISO(), start = addDays(weekStart(t), U.weekOff*7), days = [0,1,2,3,4,5,6].map(i => addDays(start,i));
  const range = `${fmt(start,{month:"long",day:"numeric"})} – ${fmt(days[6],{month:pd(start).getMonth()===pd(days[6]).getMonth()?undefined:"long",day:"numeric"})}`;
  const nav = `<div class="weeknav"><span class="range">${U.weekOff===0 ? "This week" : U.weekOff===1 ? "Next week" : U.weekOff===-1 ? "Last week" : "Week of " + fmt(start,{month:"short",day:"numeric"})}<span style="color:var(--muted);font-family:var(--sans);font-size:14px;margin-left:10px">${range}</span></span>
    <button class="rbtn" data-act="week" data-id="-1" aria-label="Previous week">${svg("prev")}</button>${U.weekOff ? `<button class="btn sm ghost" data-act="week" data-id="0">Today</button>` : ""}<button class="rbtn" data-act="week" data-id="1" aria-label="Next week">${svg("next")}</button></div>`;
  const cards = `<div class="week">${days.map(d => { const m = S.dinners[d] || {}, n = daysTo(d), pl = plansOn(d), tm = shortTime(m.time, m.recipe); return `<button class="daycard ${d===t?"now":""} ${n<0?"past":""} ${U.editDinner===d?"editing":""}" data-act="${recipeObj(m) ? "dayrecipe" : "editdinner"}" data-id="${d}"><div class="d">${fmt(d,{weekday:"short"})}<b>${pd(d).getDate()}</b></div>${pl.length ? `<div class="plans">${pl.map(p => `<span class="plan-chip">${esc(p.title)}</span>`).join("")}</div>` : ""}<div class="m ${m.title?"":"none"}">${m.title ? esc(m.title) : "Nothing yet"}</div>${m.note ? `<div class="nt">${esc(m.note)}</div>` : ""}<div class="tag">${timePill(tm)}${m.recipe && R[m.recipe] || hasContent(m) ? `<span class="pill link">Recipe</span>` : safeUrl(m.link) ? `<span class="pill link">${esc(linkLabel(m.link))}</span>` : ""}</div></button>`; }).join("")}</div>`;
  let edit = "";
  if (U.editDinner) { const d = U.editDinner, m = S.dinners[d] || {};
    edit = `<div class="card dinner-edit"><h3>Dinner on ${fmt(d,{weekday:"long",month:"long",day:"numeric"})}</h3><form class="add" data-form="dinner" data-date="${d}"><input type="text" id="dn-title" value="${esc(m.title||"")}" placeholder="What's for dinner?" autocomplete="off"><select id="dn-recipe" aria-label="Cookbook recipe">${recipeOptions(m.recipe)}</select><input type="text" id="dn-note" value="${esc(m.note||"")}" placeholder="Note (who's cooking, prep, takeout)"><input type="text" id="dn-time" value="${esc(m.time||"")}" placeholder="Time, e.g. 30 min" style="flex:0 1 150px"><input type="text" id="dn-link" value="${esc(m.link||"")}" placeholder="Link (optional)"><button class="btn">Save</button>${m.title ? `<button class="btn ghost" type="button" data-act="cleardinner" data-id="${d}">Clear</button>` : ""}<button class="btn quiet" type="button" data-act="canceldinner">Close</button></form>
      ${recipeObj(m) ? `<div class="inline">${(recipeObj(m).steps||[]).length ? `<button class="btn sm" data-act="cook" data-id="dinner:${d}">Cook it</button>` : ""}<button class="btn sm ghost" data-act="recipe" data-id="dinner:${d}">Recipe</button>${(recipeObj(m).ingredients||[]).length ? `<button class="btn sm ghost" data-act="togrocery" data-id="dinner:${d}">Add ingredients to Grocery</button>` : ""}${safeUrl(m.link) ? `<a class="btn sm ghost" href="${esc(safeUrl(m.link))}" target="_blank" rel="noopener">Open ${esc(linkLabel(m.link))} ↗</a>` : ""}</div>` : ""}</div>`; }
  const ideasList = S.lists.find(l => l.id === "ideas") || S.lists.find(l => /idea/i.test(l.name));
  const ideas = ideasList ? openItems(ideasList.id) : [];
  const ideasHtml = `<div class="ideas-panel"><div class="ideas-head"><p class="eyebrow">Meal ideas</p>${ideasList && safeUrl(ideasList.link) ? `<a class="pill link ext" href="${esc(safeUrl(ideasList.link))}" target="_blank" rel="noopener" style="margin:0">${esc(linkLabel(ideasList.link))} board ↗</a>` : ""}</div>${ideas.length ? `<div class="ideas">${ideas.map(i => { const tm = shortTime(i.time, i.recipe || recipeFor(i.text)); return `<button class="idea" aria-pressed="${U.pickIdea===i.id}" data-act="plan" data-id="${i.id}">${esc(i.text)}${tm ? `<span>${esc(tm)}</span>` : ""}</button>`; }).join("")}</div>` : `<p class="note">Save dinner ideas in the Meal ideas list, or say "idea: lemon chicken". They show up here to drop into the week.</p>`}
    ${U.pickIdea && ideas.find(i => i.id === U.pickIdea) ? `<p class="note" style="margin-top:14px">Put <b>${esc(ideas.find(i => i.id === U.pickIdea).text)}</b> on which night?</p><div class="daypick">${days.map(d => `<button class="chip" data-act="pickday" data-id="${d}" data-idea="${esc(ideas.find(i => i.id === U.pickIdea).text)}">${fmt(d,{weekday:"short",day:"numeric"})}</button>`).join("")}</div>` : ""}</div>`;
  return `<div class="ph"><div><h1>Dinners</h1><div class="sub">Plan the week on Sunday, shop once.</div></div></div>${nav}${cards}${edit}${ideasHtml}`;
}

/* ───────────────────────── 3. Hosting (ported engine) ───────────────────────── */
const evSelect = idAttr => { const evs = scopeEvs(); return evs.length === 1 ? `<input type="hidden" id="${idAttr}" value="${evs[0].id}">` : `<select id="${idAttr}" aria-label="Event">${evs.map(e => `<option value="${e.id}">${esc(e.short||e.name)}</option>`).join("")}</select>`; };
const perEvent = fn => scopeEvs().map(e => { const inner = fn(e); return inner ? (scopeEvs().length > 1 ? `<div class="evh">${esc(e.name)}<small>${fmt(e.date)}</small></div>` : "") + inner : ""; }).join("");

function vHosting(){
  const wks = weekends();
  if (!wks.length) return `<div class="ph"><h1>Hosting</h1></div><div class="empty"><b>No events yet</b>Tell me about one: "we're hosting Easter brunch on April 5".</div>`;
  if (!wks.find(x => x.k === U.wk)) U.wk = (wks.find(x => daysTo(x.evs[x.evs.length-1].date) >= 0) || wks[0]).k;
  const evs = wkEvs(); if (U.sub !== "all" && !evs.find(e => e.id === U.sub)) U.sub = "all";
  const first = evs[0], last = evs[evs.length-1], target = (U.sub !== "all" ? evById(U.sub) : evs.find(e => daysTo(e.date) >= 0)) || first, n = daysTo(target.date);
  const tasks = S.tasks.filter(t => evs.some(e => e.id === t.eventId)), done = tasks.filter(t => t.done).length;
  const gAll = inScope("guests"), yes = gAll.filter(x => x.rsvp === "yes").length;
  const range = first.date === last.date ? fmt(first.date,{weekday:"long",month:"long",day:"numeric"}) : `${fmt(first.date)} – ${fmt(last.date)}`;
  const one = U.sub !== "all" ? evById(U.sub) : null;
  const head = `<div class="ph"><div><h1>Hosting</h1></div><div class="seg" role="tablist" aria-label="Holiday">${wks.map(x => `<button role="tab" aria-pressed="${x.k===U.wk}" data-act="wk" data-id="${x.k}">${esc(WK_NAMES[x.k] || x.evs[0].name)}</button>`).join("")}</div></div>
    <div class="chips evchips" role="tablist" aria-label="Events"><button class="chip" aria-pressed="${U.sub==="all"}" data-act="sub" data-id="all">All</button>${evs.map(e => `<button class="chip" aria-pressed="${U.sub===e.id}" data-act="sub" data-id="${e.id}">${esc(e.short||e.name)}</button>`).join("")}</div>
    <div class="card sum"><div class="host-card"><div><div class="name">${esc(one ? one.name : wkName())}</div><div class="when">${one ? `${fmt(one.date,{weekday:"long",month:"long",day:"numeric"})}${one.time ? " · " + esc(one.time) : ""}` : range}</div>${one && one.theme ? `<div class="sum-th">${esc(one.theme)}</div>` : ""}</div>
      <div class="count"><b>${n < 0 ? "Done" : n}</b><span>${n < 0 ? "" : n === 1 ? "day to go" : "days to go"}</span></div></div>
      <div class="stats"><span><b>${done}/${tasks.length}</b> to-dos done</span><span><b>${yes}/${gAll.length}</b> guests confirmed</span></div><div class="bar"><i style="width:${tasks.length ? Math.round(done/tasks.length*100) : 0}%"></i></div></div>
    <div class="htabs" role="tablist">${HTABS.map(([k,l]) => `<button role="tab" aria-selected="${U.htab===k}" data-act="htab" data-id="${k}">${l}</button>`).join("")}</div>`;
  return head + ({plan:vPlan, menu:vMenu, day:vDay, shop:vShop, guests:vGuests, rooms:vRooms})[U.htab]();
}

function vPlan(){
  const all = inScope("tasks"), catLab = Object.fromEntries(CATS), multi = scopeEvs().length > 1;
  const t = all.filter(x => U.catF === "all" || (x.cat||"food") === U.catF).sort((a,b) => byDate(a,b) || (a.t||"99").localeCompare(b.t||"99"));
  const left = k => all.filter(x => !x.done && (k === "all" || (x.cat||"food") === k)).length;
  let html = `<div class="chips" style="margin-top:12px">` + [["all","All"],...CATS].map(([k,l]) => `<button class="chip" aria-pressed="${U.catF===k}" data-act="cat" data-id="${k}">${l} <span>${left(k)}</span></button>`).join("") + `</div>`, last = null;
  if (!t.length) html += `<div class="empty"><b>Nothing here yet</b>Add the first to-do below.</div>`;
  t.forEach(x => {
    if (x.date !== last) { if (last !== null) html += `</div></div>`; last = x.date; const d = daysTo(x.date);
      html += `<div class="day ${d<0?"past":""}">${fmt(x.date)}<small class="${d===0?"now":d>0&&d<=7?"soon":""}">${d===0?"Today":d===1?"Tomorrow":d>0?`in ${d} days`:""}</small></div><div class="card soft"><div class="list">`; }
    const e = evById(x.eventId), od = !x.done && daysTo(x.date) < 0;
    html += `<div class="row ${x.done?"done":""} ${od?"overdue":""}">${ck(x.done,"task",x.id,x.title)}<div class="main"><div class="t">${esc(x.title)}</div>${x.detail?`<div class="s">${esc(x.detail)}</div>`:""}${od?`<span class="pill od">Overdue</span>`:""}<span class="pill cat-${x.cat||"food"}">${catLab[x.cat||"food"]}</span>${multi&&e?`<span class="pill">${esc(e.short||e.name)}</span>`:""}${x.recipe&&R[x.recipe]?`<button class="pill link" data-act="recipe" data-id="${x.recipe}">${esc(R[x.recipe].title)}</button>`:""}</div>${x.time?`<span class="time">${esc(x.time)}</span>`:""}${del("tasks",x.id)}</div>`;
  });
  if (last !== null) html += `</div></div>`;
  return html + `<h2 class="eyebrow">Add a to-do</h2><form class="add" data-form="task"><input type="text" id="nt" placeholder="e.g. Iron the tablecloth" required><select id="ntc" aria-label="Category">${CATS.map(([k,l]) => `<option value="${k}" ${U.catF===k?"selected":""}>${l}</option>`).join("")}</select>${evSelect("nte")}<input type="date" id="ntd" value="${scopeEvs()[0].date}"><input type="text" id="ntt" placeholder="Time (optional)" style="flex:0 1 150px"><button class="btn">Add</button></form>`;
}

function vMenu(){
  const html = perEvent(e => { const d = S.dishes.filter(x => x.eventId === e.id); if (!d.length) return `<div class="empty"><b>No menu yet for ${esc(e.name)}</b>Add a dish below.</div>`;
    return COURSES.map(c => { const items = d.filter(x => (x.course||"Other") === c).sort((a,b) => (a.order||0)-(b.order||0)); if (!items.length) return "";
      const qk = e.id + "|" + c, qOpen = U.addCourse === qk;
      const qform = qOpen ? `<form class="add qadd" data-form="dishq" data-ev="${e.id}" data-course="${c}"><input type="text" id="nq" placeholder="Add to ${c}" aria-label="New ${c.toLowerCase()} dish" autocomplete="off"><select id="nqr" aria-label="From the cookbook">${recipeOptions("")}</select><button class="btn">Add</button><button class="btn quiet" type="button" data-act="addcourse" data-id="">Done</button></form>` : "";
      return `<div class="sec-h"><h2 class="eyebrow">${c}</h2><button class="sec-add ${qOpen?"on":""}" data-act="addcourse" data-id="${qk}" aria-label="Add to ${c}" aria-expanded="${qOpen}">+</button></div><div class="card soft">${qform}<div class="list">` + items.map(x => { const r = R[x.recipe], o = U.open[x.id];
        return `<div class="sw" data-col="dishes" data-id="${x.id}"><div class="row ${x.ready?"done":""}">${ck(x.ready,"dish",x.id,"Made "+x.name)}<div class="main"><div class="t">${esc(x.name)}</div>
          <div>${x.ready?`<span class="pill made">Made</span>`:""}${r?`<button class="pill link" data-act="recipe" data-id="${x.recipe}">Recipe</button>`:""}${x.makeAhead?`<span class="pill fz">${esc(x.makeAhead)}</span>`:""}${x.who?`<span class="pill">${esc(x.who)} bringing</span>`:""}${x.note?`<span class="pill">${esc(x.note)}</span>`:""}</div>
          ${o?`<div class="edit"><input type="text" id="who-${x.id}" value="${esc(x.who||"")}" placeholder="Who's bringing it?" style="flex:1 1 150px"><input type="text" id="ma-${x.id}" value="${esc(x.makeAhead||"")}" placeholder="Make ahead (e.g. Freeze Nov 7)" style="flex:1 1 180px"><button class="btn sm ghost" data-act="savedish" data-id="${x.id}">Save</button>${del("dishes",x.id)}</div>`:""}
          </div><button class="btn sm quiet" data-act="toggle" data-id="${x.id}">${o?"Close":"Edit"}</button></div><button class="sw-del" data-act="swdel" data-col="dishes" data-id="${x.id}" tabindex="-1">Delete</button></div>`; }).join("") + `</div></div>`; }).join(""); });
  return html + `<h2 class="eyebrow">Add a dish</h2><form class="add" data-form="dish">${evSelect("nde")}<select id="ndr" aria-label="From the cookbook">${recipeOptions("")}</select><input type="text" id="nd" placeholder="Or type a dish"><select id="ndc" aria-label="Course">${COURSES.map(c => `<option>${c}</option>`).join("")}</select><button class="btn">Add</button></form>
    <p class="note">Tap the circle once a dish is made. Swipe a dish left to delete it, or tap + on a course to add to it. Shop pulls ingredients from every dish linked to a cookbook recipe.</p>`;
}

function vShop(){
  let total = 0, got = 0;
  const html = perEvent(e => { const c = S.checks[e.id] || {};
    const ex = S.extras.filter(x => x.eventId === e.id);
    let out = ex.length ? `<h2 class="eyebrow">Supplies &amp; extras</h2><div class="card soft"><div class="list">${ex.map(x => `<div class="row ${x.done?"done":""}">${ck(x.done,"extra",x.id,x.item)}<div class="main"><div class="t">${esc(x.item)}</div>${x.detail?`<div class="s">${esc(x.detail)}</div>`:""}</div>${del("extras",x.id)}</div>`).join("")}</div></div>` : "";
    S.dishes.filter(x => x.eventId === e.id && R[x.recipe] && !byOther(x)).sort((a,b) => COURSES.indexOf(a.course)-COURSES.indexOf(b.course) || (a.order||0)-(b.order||0)).forEach(x => {
      const rows = R[x.recipe].ingredients.map(ing => { if (ing.startsWith("## ")) return `<div class="s" style="padding:10px 0 2px;font-style:italic;color:var(--berry);font-family:var(--display);font-size:17px">${esc(ing.slice(3))}</div>`;
        const k = x.id+"_"+hk(ing), on = !!c[k]; total++; if (on) got++;
        return `<div class="row ${on?"done":""}" style="padding:8px 4px">${ck(on,"chk",e.id+"|"+k,ing)}<div class="main"><div class="t">${esc(ing)}</div></div></div>`; }).join("");
      out += `<h2 class="eyebrow">${esc(x.name)}${x.who?` · ${esc(x.who)}`:""}</h2><div class="card soft"><div class="list">${rows}</div></div>`; });
    const others = S.dishes.filter(x => x.eventId === e.id && byOther(x));
    if (others.length) out += `<h2 class="eyebrow">Covered by others</h2><div class="card soft"><div class="list">${others.map(x => `<div class="row"><div class="main"><div class="t">${esc(x.name)}</div><div class="s">${esc(x.who)} is bringing it, so it's off your list</div></div></div>`).join("")}</div></div>`;
    return out || `<div class="empty"><b>Nothing to buy yet for ${esc(e.name)}</b>Link dishes to cookbook recipes and their ingredients land here.</div>`; });
  return (total ? `<p class="note">${got} of ${total} recipe ingredients checked off. Check off what you already have at home, too.</p>` : "") + html +
    `<h2 class="eyebrow">Add an item</h2><form class="add" data-form="extra">${evSelect("nee")}<input type="text" id="ne" placeholder="e.g. 12 dinner plates" required><button class="btn">Add</button></form>`;
}

function vGuests(){
  const lab = {yes:"Coming", no:"Can't make it", maybe:"Invited"};
  const html = perEvent(e => { const g = S.guests.filter(x => x.eventId === e.id).sort((a,b) => a.name.localeCompare(b.name));
    return g.length ? `<div class="card soft"><div class="list">${g.map(x => `<div class="row"><div class="main"><div class="t">${esc(x.name)}</div><div><button class="pill ${x.rsvp||"maybe"}" style="cursor:pointer" data-act="rsvp" data-id="${x.id}">${lab[x.rsvp]||"Invited"}</button>${x.diet?`<span class="pill">${esc(x.diet)}</span>`:""}</div></div>${del("guests",x.id)}</div>`).join("")}</div></div>` : `<div class="empty"><b>No guests yet for ${esc(e.name)}</b></div>`; });
  return html + `<p class="note">Tap a status to cycle Invited, Coming, Can't make it.</p><h2 class="eyebrow">Add a guest</h2><form class="add" data-form="guest">${evSelect("nge")}<input type="text" id="ng" placeholder="Name" required><input type="text" id="ngd" placeholder="Dietary note (optional)"><button class="btn">Add</button></form>`;
}

function vRooms(){
  const rooms = S.rooms.filter(r => r.weekend === U.wk).sort((a,b) => (a.order||0)-(b.order||0));
  const html = rooms.map(r => { const it = r.items || {}; const n = ROOM_ITEMS.filter(i => it[i]).length;
    return `<div class="card room"><div class="rhead"><b>${esc(r.name)}</b><span class="${n===ROOM_ITEMS.length?"ready":""}">${n===ROOM_ITEMS.length?"Ready":`${n}/${ROOM_ITEMS.length} ready`}</span></div>
      <div class="edit" style="margin-top:8px"><input type="text" id="rg-${r.id}" value="${esc(r.guests||"")}" placeholder="Who's staying here?" style="flex:1 1 160px"><input type="text" id="rn-${r.id}" value="${esc(r.nights||"")}" placeholder="Nights (e.g. Fri–Sun)" style="flex:1 1 120px"><button class="btn sm ghost" data-act="saveroom" data-id="${r.id}">Save</button></div>
      <div class="ritems">${ROOM_ITEMS.map(i => `<div class="row ${it[i]?"done":""}">${ck(it[i],"ritem",r.id+"|"+i,i)}<div class="main"><div class="t">${esc(i)}</div></div></div>`).join("")}</div>
      <div style="text-align:right">${del("rooms",r.id)}</div></div>`; }).join("");
  return `<p class="note" style="margin-top:12px">Guest rooms for ${esc(wkName())}. Each room gets the same setup list.</p>` + (html || `<div class="empty"><b>No guest rooms set up yet</b></div>`) +
    `<h2 class="eyebrow">Add a room</h2><form class="add" data-form="room"><input type="text" id="nr" placeholder="e.g. Basement suite" required><button class="btn">Add</button></form>`;
}

/* Day-of: one oven, dishes fitted backward from serving time. Ported unchanged, plus a "now" marker on the day. */
const hm = s => { const m = /^(\d{1,2}):(\d{2})/.exec(s||""); return m ? (+m[1])*60 + (+m[2]) : null; };
const m2hm = m => pad(Math.floor(((m%1440)+1440)%1440/60)) + ":" + pad(((m%60)+60)%60);
const fmtT = m => { m = ((m%1440)+1440)%1440; const h = Math.floor(m/60), mm = m%60; return `${(h%12)||12}:${pad(mm)} ${h<12?"AM":"PM"}`; };
function to24(s){ const m = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i.exec(s||""); if (!m) return ""; let h = +m[1]; if (m[3]) { const pm = /pm/i.test(m[3]); if (pm && h < 12) h += 12; if (!pm && h === 12) h = 0; } return pad(h) + ":" + (m[2]||"00"); }
function vDay(){
  const evs = scopeEvs().filter(e => S.dishes.some(d => d.eventId === e.id));
  if (!evs.length) return `<div class="empty"><b>Nothing to time yet</b>Add dishes on the Menu tab and the cooking timeline shows up here.</div>`;
  const e = evs.find(x => x.id === U.dayEv) || evs.find(x => daysTo(x.date) >= 0) || evs[0];
  const dishes = S.dishes.filter(d => d.eventId === e.id), mineD = dishes.filter(d => !byOther(d));
  const ovenSteps = d => { let P = TIMING[d.recipe]; if (!P) return null; if (byOther(d)) { const k = P.findIndex(p => p[2]); if (k < 0) return null; P = P.slice(k); } return P; };
  const cooks = dishes.filter(d => ovenSteps(d));
  const hasC = c => mineD.concat(cooks).some(d => (d.course||"Other") === c);
  const dinner = hm(e.dinnerAt) ?? hm(to24(e.time)) ?? 18*60;
  const apps = hm(e.appsAt) ?? dinner - 60, bfast = hm(e.breakfastAt) ?? 8*60+30;
  const cap = +(e.ovenCap || 3);
  const mains = mineD.concat(cooks).some(d => !["Appetizers","Breakfast","Drinks"].includes(d.course||"Other"));
  let html = evs.length > 1 ? `<div class="chips" style="margin-top:12px">${evs.map(x => `<button class="chip" aria-pressed="${x.id===e.id}" data-act="dayev" data-id="${x.id}">${esc(x.short||x.name)}</button>`).join("")}</div>` : "";
  html += `<div class="times">` +
    (hasC("Breakfast") ? `<label>Breakfast<input type="time" id="t-bf" data-set="breakfastAt" data-ev="${e.id}" value="${m2hm(bfast)}"></label>` : "") +
    (hasC("Appetizers") ? `<label>Guests arrive, apps out<input type="time" id="t-apps" data-set="appsAt" data-ev="${e.id}" value="${m2hm(apps)}"></label>` : "") +
    (mains ? `<label>Dinner on the table<input type="time" id="t-din" data-set="dinnerAt" data-ev="${e.id}" value="${m2hm(dinner)}"></label>` : "") +
    `<label>Oven fits at once<select id="t-cap" data-set="ovenCap" data-ev="${e.id}">${[1,2,3,4,5].map(n => `<option value="${n}" ${n===cap?"selected":""}>${n} dish${n>1?"es":""}</option>`).join("")}</select></label></div>`;
  const anchorOf = d => { const c = d.course||"Other"; return c === "Breakfast" ? bfast : c === "Appetizers" ? apps : dinner; };
  const blocks = cooks.map(d => { const P = ovenSteps(d), ov = P.filter(p => p[2]); if (!ov.length) return null;
    const a = anchorOf(d), s0 = a + ov[0][0], e0 = Math.max(...ov.map(p => a + p[0] + p[3])), f = FLEX[d.recipe] || [ov[0][2]-25, ov[0][2]+25, true];
    return {d, a, s0: Math.floor(s0/5)*5, dur: Math.ceil((e0 - Math.floor(s0/5)*5)/5)*5, temp: ov[0][2], lo: f[0], hi: f[1], hold: f[2], big: d.recipe === "Turducken" || d.recipe === "Ham"}; }).filter(Boolean);
  const STEP = 5, slots = new Map(), slot = t => slots.get(t) || {temp:null, n:0, names:[]};
  const fits = (b, end) => { let t0 = null; for (let t = end - b.dur; t < end; t += STEP) { const s = slot(t); if (s.n >= cap) return null; if (s.temp != null) { if (s.temp < b.lo || s.temp > b.hi) return null; if (t0 != null && t0 !== s.temp) return null; t0 = s.temp; } } return t0 ?? b.temp; };
  blocks.sort((x,y) => (y.big?1:0) - (x.big?1:0) || (x.hold?1:0) - (y.hold?1:0) || y.dur - x.dur);
  const bad = [];
  blocks.forEach(b => { const latest = b.s0 + b.dur;
    for (let end = latest; end >= latest - 8*60; end -= STEP) { const t = fits(b, end); if (t == null) continue;
      for (let x = end - b.dur; x < end; x += STEP) { const s = slot(x); s.temp = t; s.n++; s.names.push(b.d.name); slots.set(x, s); }
      b.shift = end - (b.s0 + b.dur); b.at = t; return; }
    b.shift = 0; b.at = b.temp; bad.push(b); });
  const shiftOf = new Map(blocks.map(b => [b.d.id, b]));
  const rows = [];
  cooks.forEach(d => { const P = ovenSteps(d), b = shiftOf.get(d.id), sh = b ? b.shift : 0, a = anchorOf(d);
    P.forEach(([off, txt, temp]) => { let note = "";
      if (temp && b && b.at !== temp) note = ` at ${b.at}°F (recipe says ${temp}°F, so check it ${b.at > temp ? "a few minutes early" : "a few minutes late"})`;
      rows.push({t: a + off + sh, txt: txt + note, d, temp: temp ? (b ? b.at : temp) : null}); });
    if (b && !bad.includes(b)) { const end = b.s0 + b.dur + sh;
      if (!P.some(p => a + p[0] + sh === end)) rows.push({t:end, txt:"Out of the oven", d});
      if (b.shift <= -15 && b.hold) rows.push({t:end, txt:`Cover with foil to keep warm until ${fmtT(b.a)}`, d});
      if (b.shift <= -15 && !b.hold) rows.push({t:end, txt:"Best served right away. It comes out early because the oven is full", d}); }
    if (b && bad.includes(b)) rows.push({t: a - 30, warn:true, txt:`${d.name} won't fit in the oven today. Bake it the day before and rewarm, or ask whoever is bringing it to bring it hot.`});
  });
  const ts = [...slots.keys()].sort((x,y) => x-y); let prev = null;
  ts.forEach((t,i) => { const s = slots.get(t); const gap = i && t - ts[i-1] > STEP;
    if (s.temp !== prev || gap) { rows.push({t, oven:true, txt:`Oven to ${s.temp}°F`}); prev = s.temp; } });
  if (hasC("Breakfast")) rows.push({t:bfast, ms:true, txt:"Breakfast is served"});
  if (hasC("Appetizers")) rows.push({t:apps, ms:true, txt:"Guests arrive. Apps out"});
  if (mains) rows.push({t:dinner, ms:true, txt:"Dinner on the table"});
  const isToday = e.date === todayISO(), nowM = isToday ? new Date().getHours()*60 + new Date().getMinutes() : null;
  if (isToday && rows.length) rows.push({t: nowM, now:true});
  rows.sort((a,b) => a.t - b.t || (b.oven?1:0) - (a.oven?1:0) || (a.ms?1:0) - (b.ms?1:0));
  if (!rows.some(r => r.d)) html += `<div class="empty"><b>No day-of cooking for ${esc(e.name)}</b>None of its dishes have oven or stove steps on the day.</div>`;
  else html += `<div class="card soft"><div class="list tl">${rows.map(r => r.now ? `<div class="row nowline"><span class="time">Now</span><div class="main"></div></div>`
    : r.ms ? `<div class="row ms"><span class="time">${fmtT(r.t)}</span><div class="main"><div class="t">${esc(r.txt)}</div></div></div>`
    : r.oven ? `<div class="row ovenrow ${nowM!=null&&r.t<nowM?"pastrow":""}"><span class="time">${fmtT(r.t)}</span><div class="main"><div class="t">${esc(r.txt)}</div></div></div>`
    : r.warn ? `<div class="row"><span class="time">${fmtT(r.t)}</span><div class="main"><div class="s clash">${esc(r.txt)}</div></div></div>`
    : `<div class="row ${nowM!=null&&r.t<nowM?"pastrow":""}"><span class="time">${fmtT(r.t)}</span><div class="main"><div class="t">${esc(r.d.name)}</div><div class="s">${esc(r.txt)}</div>${byOther(r.d)?`<span class="pill">${esc(r.d.who)} bringing</span>`:""}${r.temp?`<span class="pill oven">Oven ${r.temp}°F</span>`:""}</div>${R[r.d.recipe]?`<button class="pill link" data-act="cook" data-id="${r.d.recipe}">Cook</button>`:""}</div>`).join("")}</div></div>`;
  const untimed = mineD.filter(d => !TIMING[d.recipe]), others = dishes.filter(d => byOther(d) && !ovenSteps(d));
  if (untimed.length) html += `<h2 class="eyebrow">No day-of cooking</h2><p class="note">${untimed.map(d => esc(d.name)).join(", ")}. Made ahead, bought, or no timing set yet.</p>`;
  if (others.length) html += `<h2 class="eyebrow">Brought ready to serve</h2><p class="note">${others.map(d => `${esc(d.name)} (${esc(d.who)})`).join(", ")}</p>`;
  return html + `<p class="note">Planned for one oven, ${cap} dish${cap>1?"es":""} at a time, one temperature at a time. Change a time above and everything shifts.</p>`;
}

/* ───────────────────────── 4. Cookbook + cooking mode ───────────────────────── */
function vCookbook(){
  const q = norm(U.q), all = Object.entries(R).sort((a,b) => a[1].title.localeCompare(b[1].title));
  const hits = all.filter(([k,v]) => (U.rcat === "All" || RCAT[k] === U.rcat) && (!q || norm(v.title).includes(q) || v.ingredients.some(i => norm(i).includes(q))));
  const card = ([k,v]) => `<button class="rcard" data-act="recipe" data-id="${k}"><b>${esc(v.title)}</b><span>${esc(v.meta.slice(0,2).join(" · "))}</span><span class="cat">${esc(RCAT[k]||"")}</span></button>`;
  return `<div class="ph"><div><h1>Cookbook</h1><div class="sub">${all.length} family recipes</div></div></div>
    <div class="cb-tools"><input type="search" id="cb-q" value="${esc(U.q)}" placeholder="Search recipes or ingredients" aria-label="Search recipes"></div>
    <div class="chips">${["All",...RCATS].map(c => `<button class="chip" aria-pressed="${U.rcat===c}" data-act="rcat" data-id="${c}">${c}</button>`).join("")}</div>
    ${hits.length ? `<div class="rgrid">${hits.map(card).join("")}</div>` : `<div class="empty"><b>No recipes match</b>Try a shorter word.</div>`}`;
}

function showRecipe(ref){
  const r = recipeFromRef(ref); if (!r) return; const src = r.src || ref, date = /^dinner:/.test(src) ? src.slice(7) : "", cookable = (r.steps||[]).length > 0;
  const body = cookable || (r.ingredients||[]).length ? `<div class="cols"><div><p class="eyebrow">Ingredients</p><ul class="ing">${r.ingredients.map(i => i.startsWith("## ") ? `<li class="sub">${esc(i.slice(3))}</li>` : `<li>${esc(i)}</li>`).join("")}</ul>${r.ingredients.length ? `<div class="inline"><button class="btn sm ghost" data-act="togrocery" data-id="${esc(src)}">Add ingredients to Grocery</button></div>` : ""}</div>
    <div><p class="eyebrow">Method</p><ol>${r.steps.map(s => `<li>${esc(s)}</li>`).join("")}</ol></div></div>`
    : `<div class="empty" style="padding:10px 0 4px"><b>The full recipe lives on ${esc(linkLabel(r.link))}</b>Tap Open recipe to read it there. The Sunday import brings ingredients and steps into the app for new recipes, and a note to me pulls in this one.</div>`;
  $("#overlay").innerHTML = `<div class="sheet" data-act="closebg"><div class="panel" role="dialog" aria-modal="true" aria-label="${esc(r.title)}"><div class="top-actions">${cookable ? `<button class="btn sm" data-act="cook" data-id="${esc(src)}">Cook</button>` : ""}<button class="close" data-act="close" aria-label="Close">${svg("close")}</button></div><h3>${esc(r.title)}</h3>
    ${r.note?`<p class="note" style="font-style:italic;font-size:15px">${esc(r.note)}</p>`:""}${r.meta.length ? `<div class="meta">${r.meta.map(m => { const [a,...b] = m.split(": "); return `<span><b>${esc(a)}</b>${esc(b.join(": "))}</span>`; }).join("")}</div>` : ""}
    ${safeUrl(r.link) || date ? `<div class="inline" style="margin:4px 0 12px">${safeUrl(r.link) ? `<a class="btn sm ${cookable ? "ghost" : ""}" href="${esc(safeUrl(r.link))}" target="_blank" rel="noopener">Open recipe on ${esc(linkLabel(r.link))} ↗</a>` : ""}${date ? `<button class="btn sm quiet" data-act="editdinner" data-id="${date}">Change this dinner</button>` : ""}</div>` : ""}
    ${body}</div></div>`;
  $("#overlay .close").focus();
}

/* Cooking mode: big type, one step at a time, ingredient check-off, timers, screen stays awake. */
let COOK = null, wake = null, tick = null, audioCtx = null;
async function keepAwake(on){ try { if (on && !wake && navigator.wakeLock) { wake = await navigator.wakeLock.request("screen"); wake.addEventListener("release", () => { wake = null; }); } else if (!on && wake) { await wake.release(); wake = null; } } catch(e) { wake = null; } }
document.addEventListener("visibilitychange", () => { if (COOK && document.visibilityState === "visible") keepAwake(true); });
function startCook(ref){ const r = recipeFromRef(ref); if (!r || !(r.steps||[]).length) return; $("#overlay").innerHTML = ""; COOK = {r, step:0, ing:{}, timer:null}; keepAwake(true); renderCook(); }
function stopCook(){ COOK = null; clearInterval(tick); tick = null; keepAwake(false); $("#cookroot").innerHTML = ""; }
const minsIn = s => { const out = []; const re = /(\d+(?:\.\d+)?)(?:\s*(?:[–-]|to)\s*(\d+(?:\.\d+)?))?\s*(min(?:ute)?s?|hours?|hrs?)\b/gi; let m;
  while ((m = re.exec(s))) { const f = /h/i.test(m[3]) ? 60 : 1; out.push(Math.round(+m[1]*f)); if (m[2]) out.push(Math.round(+m[2]*f)); }
  return [...new Set(out)].filter(n => n > 0 && n <= 600); };
function renderCook(){
  if (!COOK) return; const r = COOK.r, i = COOK.step, mins = minsIn(r.steps[i]);
  const chips = (mins.length ? mins : [5,10,15]).map(n => `<button class="chip" data-act="timer" data-id="${n}">${n >= 60 ? `${Math.floor(n/60)} hr${n%60 ? " " + n%60 + " min" : ""}` : n + " min"}</button>`).join("");
  $("#cookroot").innerHTML = `<div class="cook" role="dialog" aria-modal="true" aria-label="Cooking ${esc(r.title)}"><div class="cook-top"><h3>${esc(r.title)}</h3><span class="note" style="margin:0">Step ${i+1} of ${r.steps.length}</span><button class="close" data-act="cookclose" aria-label="Close cooking mode">${svg("close")}</button></div>
    <div class="cook-body"><div class="cook-ing"><p class="eyebrow">Ingredients</p><div class="list">${r.ingredients.map((x,j) => x.startsWith("## ") ? `<div class="s" style="padding:10px 0 2px;font-style:italic;color:var(--berry);font-family:var(--display);font-size:18px">${esc(x.slice(3))}</div>` : `<div class="row ${COOK.ing[j]?"done":""}">${ck(COOK.ing[j],"cing",j,x)}<div class="main"><div class="t">${esc(x)}</div></div></div>`).join("")}</div></div>
    <div class="cook-steps">${r.steps.map((s,j) => `<div class="step ${j===i?"cur":j<i?"past":""}" data-act="step" data-id="${j}"><span class="num">${j+1}</span><span>${esc(s)}</span></div>`).join("")}</div></div>
    <div class="cook-foot"><button class="rbtn lg" data-act="stepprev" aria-label="Previous step" ${i===0?"disabled":""}>${svg("prev")}</button><div class="mid" id="cookmid">${timerHtml(chips)}</div><button class="rbtn lg primary" data-act="stepnext" aria-label="Next step" ${i===r.steps.length-1?"disabled":""}>${svg("next")}</button></div></div>`;
  const cur = $("#cookroot .step.cur"); if (cur) cur.scrollIntoView({block:"center", behavior:"smooth"});
}
function timerHtml(chips){
  const T = COOK && COOK.timer; if (!T) return `<span class="note" style="margin:0 6px 0 0">Timer</span>${chips}`;
  const left = Math.max(0, Math.round((T.end - Date.now())/1000)), done = left === 0;
  return `<span class="timer ${done?"done":""}" id="timer">${done ? "Done" : `${Math.floor(left/60)}:${pad(left%60)}`}</span><button class="btn sm ghost" data-act="timerstop">${done ? "Clear" : "Stop"}</button>${done ? "" : `<button class="btn sm quiet" data-act="timer" data-id="+1">+1 min</button>`}`;
}
function startTimer(min){ if (!COOK) return; if (min === "+1" && COOK.timer) { COOK.timer.end += 60000; } else { COOK.timer = {end: Date.now() + (+min)*60000, rang:false}; }
  clearInterval(tick); tick = setInterval(() => { if (!COOK || !COOK.timer) return clearInterval(tick); const mid = $("#cookmid"); if (mid) mid.innerHTML = timerHtml(""); if (Date.now() >= COOK.timer.end && !COOK.timer.rang) { COOK.timer.rang = true; ring(); } }, 500);
  const mid = $("#cookmid"); if (mid) mid.innerHTML = timerHtml(""); }
function ring(){ try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); const t0 = audioCtx.currentTime;
  [0,0.35,0.7,1.4,1.75,2.1].forEach(dt => { const o = audioCtx.createOscillator(), g = audioCtx.createGain(); o.type = "sine"; o.frequency.value = 880; g.gain.setValueAtTime(0.0001, t0+dt); g.gain.exponentialRampToValueAtTime(0.4, t0+dt+0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0+dt+0.3); o.connect(g).connect(audioCtx.destination); o.start(t0+dt); o.stop(t0+dt+0.32); }); } catch(e) {}
  if (navigator.vibrate) { try { navigator.vibrate([300,150,300,150,600]); } catch(e) {} } }

async function ingredientsToGrocery(ref){
  const r = recipeFromRef(ref); if (!r || !(r.ingredients||[]).length) return; const L = findListByName("grocery") || sortedLists()[0]; if (!L) return toast("Make a Grocery list first.");
  const have = new Set(openItems(L.id).map(i => norm(i.text))); const ings = r.ingredients.filter(i => !i.startsWith("## ") && !have.has(norm(i)));
  const base = Date.now(); await Promise.all(ings.map((text, i) => add("items", {listId:L.id, text, note:r.title, done:false, createdAt: base + i})));
  toast(`${ings.length} ingredient${ings.length===1?"":"s"} added to ${L.name}`);
}

/* ───────────────────────── 5. Capture: voice in, Claude sorts, undo ───────────────────────── */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition; let rec = null, micOK = ls.get("hph_mic") !== "off", capBusy = false, lastUndo = null;
function renderCapture(){
  const useMic = !!SR && micOK;
  $("#capture .inner").innerHTML = `<form class="capform" id="capform">${useMic ? `<button type="button" class="rbtn ${rec?"live":""}" id="micbtn" data-act="mic" aria-label="${rec?"Stop listening":"Speak"}">${svg("mic")}</button>` : ""}<input type="text" id="capin" placeholder="${rec ? "Listening…" : sample ? "Say or type anything: add paper towels to Costco, Thursday is tacos, Nick confirmed for Thanksgiving" : "Type a to-do…"}" autocomplete="off" aria-label="Tell the house something"><button class="rbtn primary" id="capsend" aria-label="Send" ${capBusy?"disabled":""}>${svg("up")}</button></form><div id="capout"></div>`;
}
function startMic(){
  if (!SR || rec) return; const input = $("#capin"); const r = new SR(); r.lang = "en-US"; r.interimResults = true; r.continuous = false; r.maxAlternatives = 1; rec = r;
  r.onresult = e => { let s = ""; for (const res of e.results) s += res[0].transcript; if (input) input.value = s; };
  r.onerror = e => { rec = null; if (["not-allowed","service-not-allowed","audio-capture"].includes(e.error)) { micOK = false; ls.set("hph_mic","off"); toast("The microphone isn't available in this viewer. Tap the mic key on your keyboard to dictate instead."); } renderCapture(); };
  r.onend = () => { const v = ($("#capin")||{}).value || ""; rec = null; renderCapture(); const i = $("#capin"); if (i) i.value = v; if (v.trim()) submitCapture(v.trim()); };
  try { r.start(); renderCapture(); } catch(e) { rec = null; renderCapture(); }
}
function stopMic(){ if (rec) { try { rec.stop(); } catch(e) {} } }

function captureContext(){
  const t = todayISO(), ws = weekStart(t);
  const lists = sortedLists().map(l => `- ${l.name} (id ${l.id}): ${openItems(l.id).slice(0,40).map(i => i.text).join("; ") || "empty"}`).join("\n");
  const dinners = [...Array(14)].map((_,i) => addDays(ws,i)).map(d => `${d} ${fmt(d,{weekday:"short"})}: ${(S.dinners[d]||{}).title || "-"}`).join("\n");
  const events = S.events.slice().sort(byDate).map(e => `- id ${e.id}: ${e.name} on ${e.date} (${fmt(e.date,{weekday:"long"})}), weekend ${wkKey(e)}${e.time ? ", " + e.time : ""}`).join("\n");
  const guests = S.events.map(e => `${e.id}: ${S.guests.filter(g => g.eventId === e.id).map(g => `${g.name} (${g.rsvp||"maybe"})`).join(", ") || "none"}`).join("\n");
  const dishes = S.events.map(e => `${e.id}: ${S.dishes.filter(d => d.eventId === e.id).map(d => d.name + (d.ready ? " [made]" : "") + (d.who ? " (" + d.who + ")" : "")).join(", ") || "none"}`).join("\n");
  const tasks = S.tasks.filter(x => !x.done).sort(byDate).slice(0,60).map(x => `- ${x.title} (${x.eventId}, ${x.date||"no date"})`).join("\n");
  const cookbook = Object.entries(R).map(([k,v]) => `${k}=${v.title}`).join("; ");
  const plans = S.plans.filter(p => (p.endDate || p.date) >= addDays(t,-1)).sort(byDate).slice(0,40).map(p => `- ${p.title} on ${p.date}${p.endDate && p.endDate !== p.date ? " to " + p.endDate : ""}${p.time ? " " + p.time : ""}`).join("\n");
  return `Today is ${fmt(t,{weekday:"long",month:"long",day:"numeric",year:"numeric"})} (${t}). This week runs ${ws} to ${addDays(ws,6)}, Sunday to Saturday.

LISTS (name, id, open items):
${lists || "(no lists yet)"}

DINNERS planned (this week and next):
${dinners}

COMING UP (plans: trips, appointments, nights out):
${plans || "(none)"}

HOSTING EVENTS:
${events || "(none)"}
Guests per event: 
${guests}
Dishes per event:
${dishes}
Open hosting to-dos:
${tasks || "(none)"}

COOKBOOK keys=titles: ${cookbook}`;
}
const CAPTURE_RULES = `You sort spoken or typed notes for a household app (lists, weekly dinners, holiday hosting). Turn the note into actions. Reply with ONLY a JSON object: {"reply": string, "actions": [ ... ]}. "reply" is one short, warm sentence (under 20 words) saying what you did, written to the person who spoke.

Allowed action shapes:
{"type":"add_items","list":"Grocery","items":[{"text":"paper towels","note":"","time":""}]}
{"type":"check_items","list":"Costco","items":["paper towels"]}
{"type":"uncheck_items","list":"Costco","items":["paper towels"]}
{"type":"remove_items","list":"Costco","items":["paper towels"]}
{"type":"create_list","name":"Target"}
{"type":"set_dinner","date":"YYYY-MM-DD","title":"Tacos","recipe":"","note":"","time":""}
{"type":"add_plan","title":"New York for the day","date":"YYYY-MM-DD","endDate":"","time":"","note":""}
{"type":"remove_plan","match":"<words from the plan title>"}
{"type":"clear_dinner","date":"YYYY-MM-DD"}
{"type":"add_task","event":"<event id>","title":"...","date":"YYYY-MM-DD","time":"","cat":"food","detail":""}
{"type":"complete_task","match":"<words from the to-do title>"}
{"type":"reopen_task","match":"..."}
{"type":"add_dish","event":"<event id>","name":"...","course":"Sides","who":"","recipe":"","makeAhead":""}
{"type":"dish_ready","match":"<words from the dish name>","ready":true}
{"type":"add_guest","event":"<event id>","name":"...","diet":""}
{"type":"rsvp","event":"<event id or empty>","name":"Nick","status":"yes"}
{"type":"add_extra","event":"<event id>","item":"...","detail":""}
{"type":"set_event_time","event":"<event id>","field":"dinnerAt","value":"HH:MM"}

Rules:
- Lists: Grocery is for food and supermarket items, Costco for bulk or anything said with "Costco", To-do for errands and general tasks, Meal ideas for dinner ideas ("idea: ..."). Use an existing list name exactly as given. Create a new list only when the note clearly names a list that doesn't exist.
- "Tonight" is today. A weekday name means the next such day from today (today if it is that day); "next Sunday" after a weekday name means the one after this coming one only when the note says "next week". "What's for dinner" style notes are set_dinner. When the dinner matches a cookbook title, put its key in "recipe". A time estimate mentioned ("takes 30 minutes") goes in "time".
- Things happening on a date that are not to-dos (a trip, an appointment, a night out, a visitor, a game) are add_plan. A to-do is something to get done; a plan is somewhere to be.
- Dinner ideas without a date ("idea: lemon chicken", "I want to make tacos sometime") are add_items on Meal ideas; a duration that was said ("takes 30 minutes") goes in the item's "time".
- cat is one of invites, reservations, rooms, house, food. course is one of Breakfast, Appetizers, Dinner, Sides, Dessert, Drinks, Other. status is yes, no or maybe. For rsvp, leave event empty to update that guest on every event of their weekend.
- Hosting notes go to the event the note is about. If a holiday is named but not an event, use the main dinner event of that weekend. If a to-do has no date, use a sensible date before the event.
- Split a note with several things into several actions. Keep item text short, like a list entry. Don't invent items. Don't repeat an action that already exists in the data (for example an item already on the list).
- If the note is a question or nothing can be done, return an empty actions array and answer briefly in "reply".`;

async function submitCapture(text){
  if (!text || capBusy) return;
  if (!sample) { const L = findListByName("to-do") || sortedLists()[0]; if (!L) return toast("Make a list first."); await add("items", {listId:L.id, text, done:false, createdAt:Date.now()}); $("#capin").value = ""; toast(`Added to ${L.name}`); return; }
  capBusy = true; renderCapture(); $("#capout").innerHTML = `<p class="capnote">Sorting that out…</p>`;
  let res;
  try { res = await sample.json(CAPTURE_RULES + "\n\n" + captureContext() + `\n\nNOTE: """${text.replace(/"""/g,'"')}"""`, {modelTier:"quick", cache:false}); }
  catch(e) { capBusy = false; renderCapture(); $("#capin").value = text;
    const msg = e && e.code === "not_granted" ? "Claude sorting is turned off for this page. Items you type go to To-do until you allow it." : e && e.code === "rate_limited" ? "Too many notes at once. Give it a moment and try again." : "Couldn't sort that one. Try again, or add it by hand.";
    $("#capout").innerHTML = `<div class="capres"><div class="reply">${esc(msg)}</div></div>`; return; }
  const result = await applyActions(Array.isArray(res && res.actions) ? res.actions : []);
  capBusy = false; renderCapture();
  const reply = (res && typeof res.reply === "string" && res.reply.trim()) || (result.done.length ? "Done." : "Nothing to do there.");
  $("#capout").innerHTML = `<div class="capres"><div class="reply">${esc(reply)}</div>${result.done.length || result.skipped.length ? `<ul>${result.done.map(d => `<li>${esc(d)}</li>`).join("")}${result.skipped.map(d => `<li class="warn">${esc(d)}</li>`).join("")}</ul>` : ""}<div class="acts">${result.undo.length ? `<button class="btn sm ghost" data-act="undo">Undo</button>` : ""}<button class="btn sm quiet" data-act="dismiss">Dismiss</button></div></div>`;
  lastUndo = result.undo.length ? result.undo : null;
}

/* Apply Claude's actions against the live data. Each write is recorded so Undo can reverse the whole note. */
async function applyActions(actions){
  const done = [], skipped = [], undo = [];
  const created = async (col, data) => { const id = await add(col, data); if (id) undo.push({col, id, prev:null}); return id; };
  const updated = async (col, doc, data) => { const prev = {}; Object.keys(data).forEach(k => prev[k] = doc[k] === undefined ? {__delete__:true} : doc[k]); const ok = await w(col, doc.id, data); if (ok) undo.push({col, id:doc.id, prev}); return ok; };
  const removed = async (col, doc) => { const {id, ...rest} = doc; const ok = await w(col, id, null, "delete"); if (ok) undo.push({col, id, prev:rest, recreate:true}); return ok; };
  const fuzzy = (arr, text, key) => { const n = norm(text); if (!n) return null; return arr.find(x => norm(x[key]) === n) || arr.find(x => norm(x[key]).includes(n)) || arr.find(x => n.includes(norm(x[key])) && norm(x[key]).length > 3) || null; };
  const eventOf = id => evById(id) || S.events.find(e => norm(e.name) === norm(id)) || null;
  let listOrder = S.lists.length;
  for (const a of actions.slice(0, 30)) { if (!a || typeof a !== "object") continue;
    try {
      if (a.type === "create_list" || (a.type === "add_items" && a.list && !findListByName(a.list))) { const name = String(a.name || a.list || "").trim(); if (name && !findListByName(name)) { const id = await created("lists", {name, order: listOrder++, createdAt: Date.now()}); if (id) { S.lists.push({id, name, order:listOrder}); done.push(`New list: ${name}`); } } if (a.type === "create_list") continue; }
      if (a.type === "add_items") { const L = findListByName(a.list) || findListByName("to-do") || sortedLists()[0]; if (!L) { skipped.push("No list to add to"); continue; }
        const have = new Set(openItems(L.id).map(i => norm(i.text))); let n = 0; const base = Date.now();
        for (const it of (a.items||[]).slice(0,40)) { const text = String((it && it.text) || it || "").trim(); if (!text || have.has(norm(text))) continue;
          const old = listItems(L.id).find(i => i.done && norm(i.text) === norm(text));
          if (old) { if (await updated("items", old, {done:false, createdAt: base + n})) { have.add(norm(text)); n++; } continue; }
          const note0 = String((it && it.note) || ""), time0 = String((it && it.time) || "") || (/^\s*(about\s*)?\d+\s*(min|minute|hr|hour)/i.test(note0) ? note0 : "");
          if (await created("items", {listId:L.id, text, note: time0 === note0 ? "" : note0, time: time0, link:"", recipe: L.id === "ideas" ? recipeFor(text) : "", done:false, createdAt: base + n})) { have.add(norm(text)); n++; } }
        done.push(`${n} added to ${L.name}`); }
      else if (a.type === "check_items" || a.type === "uncheck_items" || a.type === "remove_items") { const L = findListByName(a.list); const pool = L ? listItems(L.id) : S.items; let n = 0;
        for (const t of (a.items||[]).slice(0,40)) { const it = fuzzy(pool, t, "text"); if (!it) { skipped.push(`Couldn't find "${t}"${L ? " on " + L.name : ""}`); continue; }
          if (a.type === "remove_items") { if (await removed("items", it)) n++; } else { const wantDone = a.type === "check_items"; if (!!it.done !== wantDone && await updated("items", it, {done:wantDone, doneAt: wantDone ? Date.now() : null})) n++; } }
        if (n) done.push(`${n} ${a.type === "remove_items" ? "removed from" : a.type === "check_items" ? "checked off" : "put back on"} ${L ? L.name : "lists"}`); }
      else if (a.type === "set_dinner") { const d = String(a.date||"").slice(0,10); if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) { skipped.push("Dinner needs a date"); continue; }
        const cur = S.dinners[d], idea = fuzzy(S.items.filter(i => i.listId === "ideas"), a.title, "text"), data = {title:String(a.title||"").trim(), recipe: R[a.recipe] ? a.recipe : recipeFor(a.title), note:String(a.note||""), time:String(a.time||"") || (idea && idea.time) || ""};
        if (idea) { data.link = idea.link || ""; data.ingredients = idea.ingredients || []; data.steps = idea.steps || []; data.servings = idea.servings || ""; }
        if (!data.title) { skipped.push("Dinner needs a name"); continue; }
        if (cur) { await updated("dinners", {id:d, ...cur}, data); } else { const ok = await w("dinners", d, data, "set"); if (ok) undo.push({col:"dinners", id:d, prev:null}); }
        done.push(`${fmt(d,{weekday:"short"})}: ${data.title}`); }
      else if (a.type === "add_plan") { const d = String(a.date||"").slice(0,10); const title = String(a.title||"").trim(); if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !title) { skipped.push("A plan needs a name and a date"); continue; }
        if (S.plans.some(p => p.date === d && norm(p.title) === norm(title))) { skipped.push(`${title} is already on ${fmt(d)}`); continue; }
        const endDate = /^\d{4}-\d{2}-\d{2}$/.test(a.endDate||"") && a.endDate > d ? a.endDate : "";
        if (await created("plans", {title, date:d, endDate, time:String(a.time||""), note:String(a.note||""), createdAt:Date.now()})) done.push(`${fmt(d,{weekday:"short",month:"short",day:"numeric"})}: ${title}`); }
      else if (a.type === "remove_plan") { const p = fuzzy(S.plans, a.match, "title"); if (!p) { skipped.push(`Couldn't find plan "${a.match}"`); continue; } if (await removed("plans", p)) done.push(`Removed ${p.title}`); }
      else if (a.type === "clear_dinner") { const d = String(a.date||""), cur = S.dinners[d]; if (cur) { await removed("dinners", {id:d, ...cur}); done.push(`Cleared ${fmt(d,{weekday:"short"})}`); } else skipped.push("Nothing planned that night"); }
      else if (a.type === "add_task") { const e = eventOf(a.event) || nextEvent(); if (!e) { skipped.push("No event for that to-do"); continue; } const title = String(a.title||"").trim(); if (!title) continue;
        const date = /^\d{4}-\d{2}-\d{2}$/.test(a.date||"") ? a.date : (daysTo(e.date) > 1 ? addDays(e.date,-1) : e.date);
        if (await created("tasks", {eventId:e.id, title, date, time:String(a.time||""), t:to24(a.time||""), cat:CATS.some(c => c[0]===a.cat) ? a.cat : "food", detail:String(a.detail||""), done:false})) done.push(`To-do: ${title}`); }
      else if (a.type === "complete_task" || a.type === "reopen_task") { const want = a.type === "complete_task"; const x = fuzzy(S.tasks.filter(t => !!t.done !== want), a.match, "title") || fuzzy(S.tasks, a.match, "title"); if (!x) { skipped.push(`Couldn't find to-do "${a.match}"`); continue; } if (await updated("tasks", x, {done:want})) done.push(`${want ? "Done" : "Reopened"}: ${x.title}`); }
      else if (a.type === "add_dish") { const e = eventOf(a.event) || nextEvent(); if (!e) { skipped.push("No event for that dish"); continue; } const recipe = R[a.recipe] ? a.recipe : ""; const name = String(a.name||"").trim() || (recipe && R[recipe].title); if (!name) continue;
        if (await created("dishes", {eventId:e.id, name, recipe, course: COURSES.includes(a.course) ? a.course : "Other", who:String(a.who||""), makeAhead:String(a.makeAhead||""), order:Date.now()%1e7, ready:false})) done.push(`${e.short||e.name}: ${name}`); }
      else if (a.type === "dish_ready") { const x = fuzzy(S.dishes, a.match, "name"); if (!x) { skipped.push(`Couldn't find dish "${a.match}"`); continue; } if (await updated("dishes", x, {ready: a.ready !== false})) done.push(`${x.name} ${a.ready !== false ? "made" : "not made yet"}`); }
      else if (a.type === "add_guest") { const e = eventOf(a.event) || nextEvent(); const name = String(a.name||"").trim(); if (!e || !name) continue; if (S.guests.some(g => g.eventId === e.id && norm(g.name) === norm(name))) { skipped.push(`${name} is already on ${e.short||e.name}`); continue; }
        if (await created("guests", {eventId:e.id, name, diet:String(a.diet||""), rsvp:"maybe"})) done.push(`${name} invited to ${e.short||e.name}`); }
      else if (a.type === "rsvp") { const st = ["yes","no","maybe"].includes(a.status) ? a.status : "yes"; const e = eventOf(a.event); let pool = S.guests.filter(g => !e || g.eventId === e.id); if (!e) { const nx = nextEvent(); if (nx) { const wkIds = S.events.filter(x => wkKey(x) === wkKey(nx)).map(x => x.id); const inWk = pool.filter(g => wkIds.includes(g.eventId)); if (inWk.some(g => norm(g.name) === norm(a.name))) pool = inWk; } }
        const hits = pool.filter(g => norm(g.name) === norm(a.name)); const hit = hits.length ? hits : (fuzzy(pool, a.name, "name") ? [fuzzy(pool, a.name, "name")] : []); if (!hit.length) { skipped.push(`Couldn't find guest "${a.name}"`); continue; }
        let n = 0; for (const g of hit) if ((g.rsvp||"maybe") !== st && await updated("guests", g, {rsvp:st})) n++; done.push(`${hit[0].name}: ${{yes:"coming",no:"can't make it",maybe:"invited"}[st]}${n > 1 ? ` (${n} events)` : ""}`); }
      else if (a.type === "add_extra") { const e = eventOf(a.event) || nextEvent(); const item = String(a.item||"").trim(); if (!e || !item) continue; if (await created("extras", {eventId:e.id, item, detail:String(a.detail||""), done:false})) done.push(`Buy for ${e.short||e.name}: ${item}`); }
      else if (a.type === "set_event_time") { const e = eventOf(a.event); if (!e || !["dinnerAt","appsAt","breakfastAt"].includes(a.field) || !/^\d{2}:\d{2}$/.test(a.value||"")) { skipped.push("Couldn't set that time"); continue; } if (await updated("events", e, {[a.field]: a.value})) done.push(`${e.short||e.name} ${a.field.replace("At","")} at ${fmtT(hm(a.value))}`); }
      else skipped.push(`Didn't understand "${a.type}"`);
    } catch(e) { skipped.push("One change didn't save"); }
  }
  return {done, skipped, undo};
}
async function undoLast(){
  if (!lastUndo || !db) return; const ops = lastUndo.slice().reverse(); lastUndo = null;
  for (const op of ops) { try { const ref = db.collection(op.col).doc(op.id); if (op.prev === null) await ref.delete(); else if (op.recreate) await ref.set(op.prev); else { const d = {}; let full = false; Object.entries(op.prev).forEach(([k,v]) => { if (v && v.__delete__) full = true; else d[k] = v; }); if (full) { const snap = await ref.get(); const cur = snap.exists ? snap.data() : {}; Object.keys(op.prev).forEach(k => delete cur[k]); await ref.set({...cur, ...d}); } else await ref.update(d); } } catch(e) {} }
  $("#capout").innerHTML = ""; toast("Undone");
}

/* ───────────────────────── 6. Events + boot ───────────────────────── */
document.addEventListener("click", async ev => {
  const b = ev.target.closest("[data-act]"); if (!b) return;
  const a = b.dataset.act, id = b.dataset.id;
  if (a === "closebg" && ev.target !== b) return;
  if (a !== "del" && a !== "dellist") U.armed = null;
  switch (a) {
    case "view": U.view = id; ls.set("hph_view", id); break;
    case "golist": U.view = "lists"; U.listId = id; ls.set("hph_view","lists"); ls.set("hph_list", id); break;
    case "gohost": U.view = "hosting"; U.wk = id; U.sub = "all"; ls.set("hph_view","hosting"); ls.set("hph_wk", id); break;
    case "list": U.listId = id; U.editList = false; U.pickIdea = null; ls.set("hph_list", id); break;
    case "editlist": U.editList = !U.editList; break;
    case "dellist": if (U.armed === "list"+id) { U.armed = null; U.editList = false; const its = listItems(id); await Promise.all(its.map(i => w("items", i.id, null, "delete"))); await w("lists", id, null, "delete"); toast("List deleted"); } else U.armed = "list"+id; break;
    case "item": { const x = S.items.find(i => i.id === id); if (x) w("items", id, {done:!x.done, doneAt: x.done ? null : Date.now()}); break; }
    case "clearchecked": { const its = listItems(id).filter(i => i.done); await Promise.all(its.map(i => w("items", i.id, null, "delete"))); toast(`Cleared ${its.length}`); break; }
    case "plan": U.pickIdea = id || null; break;
    case "pickday": { const title = b.dataset.idea || "", idea = S.items.find(i => i.id === U.pickIdea) || {}; if (title) { const cur = S.dinners[id] || {}; const rk = idea.recipe && R[idea.recipe] ? idea.recipe : recipeFor(title); await w("dinners", id, {...cur, title, recipe: rk, note: cur.note || "", time: idea.time || "", link: idea.link || "", ingredients: idea.ingredients || [], steps: idea.steps || [], servings: idea.servings || ""}, "set"); toast(`${title} on ${fmt(id,{weekday:"long"})}`); } U.pickIdea = null; break; }
    case "dayrecipe": showRecipe("dinner:" + id); return;
    case "editdinner": $("#overlay").innerHTML = ""; U.view = "dinners"; ls.set("hph_view","dinners"); U.weekOff = Math.round((pd(weekStart(id)) - pd(weekStart(todayISO()))) / (7*864e5)); U.editDinner = id; U.pickIdea = null; break;
    case "canceldinner": U.editDinner = null; break;
    case "cleardinner": await w("dinners", id, null, "delete"); U.editDinner = null; break;
    case "week": U.weekOff = id === "0" ? 0 : U.weekOff + (+id); U.editDinner = null; U.pickIdea = null; break;
    case "wk": U.wk = id; U.sub = "all"; U.catF = "all"; ls.set("hph_wk", id); break;
    case "sub": U.sub = id; break;
    case "htab": U.htab = id; ls.set("hph_htab", id); break;
    case "cat": U.catF = id; break;
    case "dayev": U.dayEv = id; break;
    case "task": { const x = S.tasks.find(t => t.id === id); if (x) w("tasks", id, {done:!x.done}); break; }
    case "dish": { const x = S.dishes.find(t => t.id === id); if (x) w("dishes", id, {ready:!x.ready}); break; }
    case "extra": { const x = S.extras.find(t => t.id === id); if (x) w("extras", id, {done:!x.done}); break; }
    case "chk": { const [eid,k] = id.split("|"); const c = S.checks[eid]; if (c) w("checks", eid, {[k]:!c[k]}); else w("checks", eid, {[k]:true}, "set"); break; }
    case "rsvp": { const x = S.guests.find(t => t.id === id); if (x) w("guests", id, {rsvp:{maybe:"yes",yes:"no",no:"maybe"}[x.rsvp||"maybe"]}); break; }
    case "ritem": { const [rid,item] = id.split("|"); const r = S.rooms.find(x => x.id === rid); if (r) w("rooms", rid, {items:{...(r.items||{}), [item]:!(r.items||{})[item]}}); break; }
    case "saveitem": w("items", id, {time:$("#it-"+id).value.trim(), link:$("#il-"+id).value.trim()}); toast("Saved"); break;
    case "saveroom": w("rooms", id, {guests:$("#rg-"+id).value.trim(), nights:$("#rn-"+id).value.trim()}); toast("Saved"); break;
    case "toggle": U.open[id] = !U.open[id]; break;
    case "addcourse": U.addCourse = (id && U.addCourse !== id) ? id : null; render(); if (U.addCourse) { const q = $("#nq"); if (q) q.focus(); } return;
    case "savedish": w("dishes", id, {who:$("#who-"+id).value.trim(), makeAhead:$("#ma-"+id).value.trim()}); U.open[id] = false; break;
    case "swdel": w(b.dataset.col, id, null, "delete"); toast("Deleted"); break;
    case "del": { const k = b.dataset.col+id; if (U.armed === k) { U.armed = null; w(b.dataset.col, id, null, "delete"); } else U.armed = k; break; }
    case "recipe": showRecipe(id); return;
    case "rcat": U.rcat = id; break;
    case "cook": startCook(id); return;
    case "cookclose": stopCook(); return;
    case "step": COOK.step = +id; renderCook(); return;
    case "stepprev": if (COOK && COOK.step > 0) { COOK.step--; renderCook(); } return;
    case "stepnext": if (COOK && COOK.step < COOK.r.steps.length-1) { COOK.step++; renderCook(); } return;
    case "cing": if (COOK) { COOK.ing[id] = !COOK.ing[id]; b.setAttribute("aria-checked", String(!!COOK.ing[id])); b.innerHTML = COOK.ing[id] ? CHECK : ""; b.closest(".row").classList.toggle("done", !!COOK.ing[id]); } return;
    case "timer": startTimer(id); return;
    case "timerstop": if (COOK) { COOK.timer = null; clearInterval(tick); renderCook(); } return;
    case "togrocery": ingredientsToGrocery(id); return;
    case "mic": if (rec) stopMic(); else startMic(); return;
    case "undo": undoLast(); return;
    case "dismiss": $("#capout").innerHTML = ""; return;
    case "close": case "closebg": $("#overlay").innerHTML = ""; return;
    default: return;
  }
  render();
});
document.addEventListener("keydown", e => { if (e.key === "Escape") { if (COOK) stopCook(); else $("#overlay").innerHTML = ""; } });
document.addEventListener("input", e => { if (e.target.id === "cb-q") { U.q = e.target.value; render(); } });
document.addEventListener("change", e => { const i = e.target.closest("[data-set]"); if (!i || !i.value) return; w("events", i.dataset.ev, {[i.dataset.set]: i.dataset.set === "ovenCap" ? +i.value : i.value}); });
document.addEventListener("submit", async e => {
  e.preventDefault(); const f = e.target.dataset.form, v = s => ($(s) ? $(s).value : "").trim();
  if (e.target.id === "capform") { const t = v("#capin"); if (!t) return; $("#capin").value = ""; submitCapture(t); return; }
  if (f === "item" && v("#ni") && U.listId) { await add("items", {listId:U.listId, text:v("#ni"), note:"", time:v("#ni-time"), link:"", recipe:recipeFor(v("#ni")), done:false, createdAt:Date.now()}); e.target.reset(); const i = $("#ni"); if (i) i.focus(); return; }
  if (f === "plan" && v("#np")) { const d = v("#npd") || todayISO(), e2 = v("#npe"); await add("plans", {title:v("#np"), date:d, endDate: e2 && e2 > d ? e2 : "", time:v("#npt"), note:v("#npn"), createdAt:Date.now()}); toast("Added to Coming up"); }
  if (f === "listlink") { await w("lists", e.target.dataset.id, {link: v("#ll")}); toast("Link saved"); U.editList = false; }
  if (f === "list" && v("#nl")) { const name = v("#nl"); const id = await add("lists", {name, order:S.lists.length, createdAt:Date.now()}); if (id) { U.listId = id; ls.set("hph_list", id); } }
  if (f === "dinner") { const d = e.target.dataset.date, cur = S.dinners[d] || {}; const title = v("#dn-title"), recipe = v("#dn-recipe"); if (!title && !recipe) { await w("dinners", d, null, "delete"); } else await w("dinners", d, {...cur, title: title || R[recipe].title, recipe: recipe || recipeFor(title), note:v("#dn-note"), time:v("#dn-time"), link:v("#dn-link")}, "set"); U.editDinner = null; toast("Saved"); }
  if (f === "task" && v("#nt")) add("tasks", {eventId:v("#nte"), title:v("#nt"), date:v("#ntd") || evById(v("#nte")).date, time:v("#ntt"), t:to24(v("#ntt")), cat:v("#ntc") || "food", done:false});
  if (f === "guest" && v("#ng")) add("guests", {eventId:v("#nge"), name:v("#ng"), diet:v("#ngd"), rsvp:"maybe"});
  if (f === "extra" && v("#ne")) add("extras", {eventId:v("#nee"), item:v("#ne"), done:false});
  if (f === "room" && v("#nr")) add("rooms", {weekend:U.wk, name:v("#nr"), order:Date.now()%1e7, items:{}});
  if (f === "dish") { const r = v("#ndr"), n = v("#nd") || (R[r] && R[r].title); if (n) add("dishes", {eventId:v("#nde"), name:n, recipe:r, course:v("#ndc"), order:Date.now()%1e7, ready:false}); }
  if (f === "dishq") { const r = v("#nqr"), n = v("#nq") || (R[r] && R[r].title); if (n) { await add("dishes", {eventId:e.target.dataset.ev, name:n, recipe: r || recipeFor(n), course:e.target.dataset.course, order:Date.now()%1e7, ready:false}); toast("Added to " + e.target.dataset.course); }
    e.target.reset(); render(); const q = $("#nq"); if (q) q.focus(); return; }
  e.target.reset(); render();
});

/* Swipe a list row left to reveal Delete. Vertical scrolling is untouched (touch-action: pan-y). */
/* Touch uses touch events with a non-passive move, so once a drag reads as sideways the page keeps it
   (the app around the page can't claim it as a scroll or back gesture). Mouse, trackpad and pencil use pointer events.
   Direction is decided only after 8px of movement, so a finger's first tiny wobble doesn't cancel the swipe. */
let SW = null;
const swReset = except => document.querySelectorAll(".sw.open").forEach(el => { if (el !== except) el.classList.remove("open"); });
const swStart = (target, x, y) => { const el = target.closest && target.closest(".sw"); if (!el) { swReset(); return false; }
  if (target.closest("button, input, select, textarea, a")) return false;
  SW = {el, x, y, dx:0, moved:false, dir:null, open:el.classList.contains("open")}; return true; };
const swMove = (x, y) => { if (!SW) return false; const dx = x - SW.x, dy = y - SW.y;
  if (!SW.dir) { if (Math.max(Math.abs(dx), Math.abs(dy)) < 8) return false; SW.dir = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
    if (SW.dir === "v") { SW = null; return false; } SW.el.querySelector(".row").style.transition = "none"; }
  SW.moved = true; SW.dx = Math.max(-130, Math.min(SW.open ? 96 : 0, dx + (SW.open ? -96 : 0)));
  SW.el.querySelector(".row").style.transform = `translateX(${SW.dx}px)`; return true; };
const swEnd = () => { if (!SW) return; const el = SW.el, row = el.querySelector(".row"); row.style.transition = ""; row.style.transform = "";
  if (SW.moved) { swReset(el); el.classList.toggle("open", SW.dx < -40); el.dataset.justSwiped = "1"; setTimeout(() => { delete el.dataset.justSwiped; }, 350); }
  SW = null; };
document.addEventListener("touchstart", e => { if (e.touches.length !== 1) { SW = null; return; } const t = e.touches[0]; swStart(e.target, t.clientX, t.clientY); }, {passive:true});
document.addEventListener("touchmove", e => { if (!SW) return; const t = e.touches[0]; if (swMove(t.clientX, t.clientY) && e.cancelable) e.preventDefault(); }, {passive:false});
document.addEventListener("touchend", swEnd, {passive:true}); document.addEventListener("touchcancel", swEnd, {passive:true});
document.addEventListener("pointerdown", e => { if (e.pointerType === "touch") return; if (e.pointerType === "mouse" && e.button !== 0) return; swStart(e.target, e.clientX, e.clientY); });
document.addEventListener("pointermove", e => { if (e.pointerType === "touch" || !SW) return; if (swMove(e.clientX, e.clientY)) e.preventDefault(); });
document.addEventListener("pointerup", e => { if (e.pointerType !== "touch") swEnd(); }); document.addEventListener("pointercancel", e => { if (e.pointerType !== "touch") swEnd(); });
document.addEventListener("click", e => { const el = e.target.closest(".sw"); if (el && el.dataset.justSwiped) { e.stopPropagation(); e.preventDefault(); } }, true);

renderCapture(); render();
(async () => {
  const use = n => (window.claude && typeof claude.use === "function") ? claude.use(n).catch(() => null) : Promise.resolve(null);
  use("sample").then(s => { sample = s; renderCapture(); });
  use("mcp").then(m => { wxStart(m); calStart(m); });
  db = await use("db");
  if (!db) { ready = true; noDb = true; render(); return; }
  const cols = ["events","dishes","guests","tasks","extras","rooms","lists","items","plans"];
  const first = () => { if (++seen >= cols.length + 2) ready = true; render(); };
  cols.forEach(c => db.collection(c).onSnapshot(s => { S[c] = s.docs.map(d => ({id:d.id, ...d.data()})); first(); }, () => first()));
  db.collection("checks").onSnapshot(s => { S.checks = {}; s.docs.forEach(d => S.checks[d.id] = d.data()); first(); }, () => first());
  db.collection("dinners").onSnapshot(s => { S.dinners = {}; s.docs.forEach(d => S.dinners[d.id] = d.data()); first(); }, () => first());
  db.collection("habits").onSnapshot(s => { S.habits = s.docs.map(d => ({id:d.id, ...d.data()})); render(); }, () => {});
  db.collection("habitlog").onSnapshot(s => { S.habitlog = {}; s.docs.forEach(d => S.habitlog[d.id] = d.data()); render(); }, () => {});
  setTimeout(() => { if (!ready) { ready = true; render(); } }, 8000);
})();
setInterval(() => { if (U.view === "today" || (U.view === "hosting" && U.htab === "day")) render(); }, 60000);
})();
