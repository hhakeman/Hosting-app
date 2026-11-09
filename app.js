/* Hakeman House — app logic.
   Sections: 1 core + state · 2 Today, Lists, Dinners · 3 Hosting (ported engine) · 4 Cookbook + cooking mode · 5 Capture (voice + Claude sorting) · 6 events + boot */
(() => {
"use strict";

/* ───────────────────────── 1. Core ───────────────────────── */
const CB = window.COOKBOOK || {recipes:{}, timing:{}, flex:{}, category:{}};
const R = CB.recipes, TIMING = CB.timing, FLEX = CB.flex, RCAT = CB.category;
const COURSES = ["Breakfast","Appetizers","Dinner","Sides","Dessert","Drinks","Other"];
const HTABS = [["plan","Checklist"],["menu","Menu"],["day","Day-of"],["shop","Shop"],["guests","Guests"],["rooms","Rooms"]];
const CATS = [["invites","Invites"],["reservations","Reservations"],["rooms","Rooms"],["house","House"],["food","Food"],["freezer","Freezer"]];
const ROOM_ITEMS = ["Fresh sheets","Towels","Extra blanket","Chocolate on the pillow"];
const WK_NAMES = {thanksgiving:"Thanksgiving", christmas:"Christmas"};
const VIEWS = [["today","Today"],["cal","Calendar"],["lists","Lists"],["meals","Meals"],["hosting","Hosting"]];
const RCATS = ["Breakfast","Appetizers","Mains","Sides","Desserts","Drinks","For the pups"];
const LIST_ALIASES = {grocery:["grocery","groceries","store","supermarket","food shop","shopping"], costco:["costco","bulk","warehouse"], todo:["to-do","todo","to do","tasks","errands","list"], ideas:["ideas","meal ideas","dinner ideas","meals","dinners"]};

const S = {events:[], dishes:[], guests:[], tasks:[], extras:[], rooms:[], lists:[], items:[], plans:[], people:[], checks:{}, dinners:{}, shared:{}};
const U = {view:"today", mtab:"dinners", who:"", peopleOpen:false, calMode:"week", calOff:0, calSel:null, calKind:"plan", wk:null, sub:"all", htab:"plan", catF:"all", hlF:"all", listId:null, editList:false, weekOff:0, editDinner:null, pickIdea:null, open:{}, armed:null, dayEv:null, q:"", rcat:"All", ideaTags:[]};
let db = null, sample = null, ready = false, noDb = false, seen = 0;
const ls = {get:(k) => { try { return localStorage.getItem(k); } catch(e) { return null; } }, set:(k,v) => { try { localStorage.setItem(k,v); } catch(e) {} }};
U.view = ["today","cal","lists","dinners","hosting","cookbook","plans"].includes(ls.get("hph_view")) ? ls.get("hph_view") : "today";
U.mtab = ls.get("hph_mtab") === "cookbook" ? "cookbook" : "dinners"; U.who = ls.get("hph_who") || "";
U.wk = ls.get("hph_wk"); U.htab = ls.get("hph_htab") || "plan"; U.listId = ls.get("hph_list");
if (/^#(today|cal|lists|dinners|hosting|cookbook|plans)$/.test(location.hash)) U.view = location.hash.slice(1);

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
  cal:'<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/><path d="M8 14h2M14 14h2M8 17.5h2"/>',
  today:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  lists:'<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2"/>',
  dinners:'<path d="M7 3v8a2 2 0 0 0 4 0V3M9 11v10M17 3c-2 0-3 2-3 5s1 4 3 4v9"/>',
  meals:'<path d="M7 3v8a2 2 0 0 0 4 0V3M9 11v10M17 3c-2 0-3 2-3 5s1 4 3 4v9"/>',
  person:'<circle cx="12" cy="8" r="3.6"/><path d="M5 20c.8-3.6 3.6-5.6 7-5.6s6.2 2 7 5.6"/>',
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
/* Hosting to-dos also live on the Lists page, one list per upcoming holiday weekend, with ids like "_host:thanksgiving". */
const HOST = "_host:";
const hostWks = () => weekends().filter(x => daysTo(x.evs[x.evs.length-1].date) >= 0);
const hostName = k => WK_NAMES[k] || ((weekends().find(x => x.k === k) || {evs:[{}]}).evs[0].name) || "Hosting";
const hostTasks = k => { const ids = S.events.filter(e => wkKey(e) === k).map(e => e.id); return S.tasks.filter(t => ids.includes(t.eventId)); };
const byDay = (a,b) => byDate(a,b) || (a.t||"99").localeCompare(b.t||"99") || (a.title||"").localeCompare(b.title||"");
/* The household: each person has a color. Hosting to-dos and list items can be assigned with a tap (who = person id). */
const PCOLORS = [["coral","#D9534F"],["blue","#2F6FD0"],["green","#2E8B57"],["purple","#7B52AB"],["amber","#B87700"],["teal","#13878A"],["pink","#C2417A"],["slate","#51606F"]];
const PC = Object.fromEntries(PCOLORS);
const people = () => (S.people || []).slice().sort((a,b) => (a.order||0)-(b.order||0) || (a.name||"").localeCompare(b.name||""));
const personOf = id => id ? (S.people || []).find(p => p.id === id) : null;
const pColor = p => PC[p && p.color] || PC.slate;
const initial = p => esc(String((p && p.name) || "?").trim().charAt(0).toUpperCase());
const avatar = (p, cls = "") => `<span class="av ${cls}" style="--pc:${pColor(p)}" title="${esc(p.name)}">${initial(p)}</span>`;
const whoBtn = (col, id, who) => { if (!(S.people || []).length) return ""; const p = personOf(who);
  return `<button class="whob ${p ? "on" : ""}" data-act="who" data-col="${col}" data-id="${esc(id)}" aria-label="${p ? "Assigned to " + esc(p.name) + ". Tap to change" : "Assign someone"}" ${p ? `style="--pc:${pColor(p)}"` : ""}>${p ? initial(p) : svg("person")}</button>`; };
const whoMatch = x => !U.who || !personOf(U.who) || x.who === U.who;
const whoChips = () => !(S.people || []).length ? `<div class="chips whochips"><button class="chip" data-act="people">${svg("person")} Add the household</button></div>`
  : `<div class="chips whochips"><button class="chip" aria-pressed="${!U.who}" data-act="whof" data-id="">Everyone</button>${people().map(p => `<button class="chip pchip" aria-pressed="${U.who===p.id}" data-act="whof" data-id="${p.id}" style="--pc:${pColor(p)}">${avatar(p, "sm")}${esc(p.name)}</button>`).join("")}<button class="chip quiet" data-act="people">Edit</button></div>`;
/* Edit sheets: tap any to-do or list entry to rename it, add a note, move it to another day (one tap) or list, or hand it to someone. */
const whoPick = (who) => !(S.people || []).length ? "" : `<p class="eyebrow">Who has it</p><div class="chips wrap whopick"><button type="button" class="chip" aria-pressed="${!personOf(who)}" data-act="epick" data-id="">No one</button>${people().map(p => `<button type="button" class="chip pchip" aria-pressed="${who===p.id}" data-act="epick" data-id="${p.id}" style="--pc:${pColor(p)}">${avatar(p,"sm")}${esc(p.name)}</button>`).join("")}</div>`;
function editTask(id){ const x = S.tasks.find(t => t.id === id); if (!x) return; U.edit = {col:"tasks", id, who:x.who || ""};
  const t = todayISO(), ev = evById(x.eventId), evs = ev ? S.events.filter(e => wkKey(e) === wkKey(ev)).sort(byDate) : [];
  const days = [0,1,2,3,4,5,6,7].map(n => addDays(t, n)).concat(x.date && x.date > addDays(t,7) ? [] : []);
  const move = `<p class="eyebrow">Move to</p><div class="chips wrap movechips">${days.map((d,n) => `<button type="button" class="chip ${d===x.date?"cur":""}" data-act="movetask" data-id="${d}" ${d===x.date?'aria-current="date"':""}>${n===0?"Today":n===1?"Tomorrow":fmt(d,{weekday:"short",day:"numeric"})}</button>`).join("")}${x.date ? `<button type="button" class="chip" data-act="movetask" data-id="${addDays(x.date,7)}">A week later</button>` : ""}</div>`;
  $("#overlay").innerHTML = `<div class="sheet" data-act="closebg"><div class="panel edit-panel" role="dialog" aria-modal="true" aria-label="Edit to-do"><div class="top-actions"><button class="close" data-act="close" aria-label="Close">${svg("close")}</button></div><h3>Edit to-do</h3>
    ${x.date ? `<p class="note" style="font-size:14px;margin-top:6px">Now on ${fmt(x.date,{weekday:"long",month:"long",day:"numeric"})}${ev ? " · " + esc(ev.short || ev.name) : ""}</p>` : ""}
    ${move}
    <form class="eform" data-form="taskedit" data-id="${x.id}">
      <label>To-do<input type="text" id="et-title" value="${esc(x.title)}" required></label>
      <label>Notes<textarea id="et-detail" rows="2" placeholder="Optional">${esc(x.detail || "")}</textarea></label>
      <div class="erow"><label>Day<input type="date" id="et-date" value="${esc(x.date || "")}"></label><label>Time<input type="text" id="et-time" value="${esc(x.time || "")}" placeholder="Optional, e.g. 9:00 AM"></label></div>
      <div class="erow"><label>Kind<select id="et-cat">${CATS.map(([k,l]) => `<option value="${k}" ${(x.cat||"food")===k?"selected":""}>${l}</option>`).join("")}</select></label>${evs.length > 1 ? `<label>For<select id="et-ev">${evs.map(e => `<option value="${e.id}" ${e.id===x.eventId?"selected":""}>${esc(e.short || e.name)}</option>`).join("")}</select></label>` : ""}</div>
      ${whoPick(x.who)}
      <div class="inline eacts"><button class="btn">Save</button><button type="button" class="btn quiet" data-act="close">Cancel</button><button type="button" class="btn danger-o" data-act="edel">Delete</button></div>
    </form></div></div>`;
  const f = $("#et-title"); if (f && matchMedia("(pointer:fine)").matches) f.focus(); }
function editItem(id){ const x = S.items.find(i => i.id === id); if (!x) return; U.edit = {col:"items", id, who:x.who || ""};
  $("#overlay").innerHTML = `<div class="sheet" data-act="closebg"><div class="panel edit-panel" role="dialog" aria-modal="true" aria-label="Edit item"><div class="top-actions"><button class="close" data-act="close" aria-label="Close">${svg("close")}</button></div><h3>Edit</h3>
    <form class="eform" data-form="itemedit" data-id="${x.id}">
      <label>Item<input type="text" id="ei-text" value="${esc(x.text)}" required></label>
      <label>Note<input type="text" id="ei-note" value="${esc(x.note || "")}" placeholder="Optional"></label>
      <label>List<select id="ei-list">${sortedLists().map(l => `<option value="${l.id}" ${l.id===x.listId?"selected":""}>${esc(l.name)}</option>`).join("")}</select></label>
      ${whoPick(x.who)}
      <div class="inline eacts"><button class="btn">Save</button><button type="button" class="btn quiet" data-act="close">Cancel</button><button type="button" class="btn danger-o" data-act="edel">Delete</button></div>
    </form></div></div>`; }
/* Quick add for one day, from the + on a calendar day or a day heading. A to-do can belong to a hosting event or to no event (a household to-do). */
function addSheet(d, kind, hostDefault){
  const t = todayISO(), wks = hostWks(), wk = wks.find(x => d <= x.evs[x.evs.length-1].date && daysTo(x.evs[0].date) - daysTo(d) <= 21);
  const evs = wk ? wk.evs : [], ev = evs.find(e => e.date >= d) || evs[evs.length-1];
  U.add = {d, kind: kind || (U.add && U.add.d === d ? U.add.kind : "todo"), who: U.add && U.add.d === d ? U.add.who : "", ev: U.add && U.add.d === d && U.add.ev !== undefined ? U.add.ev : (hostDefault && ev ? ev.id : "")};
  const k = U.add.kind, label = fmt(d,{weekday:"long",month:"long",day:"numeric"});
  $("#overlay").innerHTML = `<div class="sheet" data-act="closebg"><div class="panel edit-panel" role="dialog" aria-modal="true" aria-label="Add to ${label}"><div class="top-actions"><button class="close" data-act="close" aria-label="Close">${svg("close")}</button></div><h3>Add to ${fmt(d,{weekday:"long"})}</h3>
    <p class="note" style="font-size:14px;margin-top:6px">${label}${daysTo(d)===0 ? " · today" : daysTo(d)===1 ? " · tomorrow" : ""}</p>
    <div class="seg" role="tablist" aria-label="Add a" style="margin-top:14px">${[["todo","To-do"],["plan","Plan"],["dinner","Dinner"]].map(([x,l]) => `<button type="button" aria-pressed="${k===x}" data-act="addkind" data-id="${x}">${l}</button>`).join("")}</div>
    <form class="eform" data-form="dayadd" data-date="${d}">
      <label>${k === "dinner" ? "What's for dinner?" : k === "plan" ? "What's happening?" : "What needs doing?"}<input type="text" id="da-text" required autocomplete="off" placeholder="${k === "dinner" ? "e.g. Tacos" : k === "plan" ? "e.g. Haircut" : "e.g. Pick up the tablecloths"}" ${k === "dinner" && S.dinners[d] && S.dinners[d].title ? `value="${esc(S.dinners[d].title)}"` : ""}></label>
      ${k !== "dinner" ? `<div class="erow"><label>Time<input type="text" id="da-time" placeholder="Optional, e.g. 3:00 PM"></label>${k === "todo" ? `<label>For<select id="da-ev"><option value="">The house (no event)</option>${(wk ? wk.evs : []).map(e => `<option value="${e.id}" ${U.add.ev===e.id?"selected":""}>${esc(e.short || e.name)}</option>`).join("")}</select></label><label>Kind<select id="da-cat">${CATS.map(([c,l]) => `<option value="${c}" ${c==="house"?"selected":""}>${l}</option>`).join("")}</select></label>` : ""}</div>` : ""}
      ${k === "plan" ? `<label class="chk"><input type="checkbox" id="da-weekly"> Every ${fmt(d,{weekday:"long"})}</label>` : ""}
      ${k === "todo" ? whoPick(U.add.who) : ""}
      <div class="inline eacts"><button class="btn">Add</button><button type="button" class="btn quiet" data-act="close">Cancel</button></div>
    </form></div></div>`;
  const f = $("#da-text"); if (f) f.focus();
}
function editPlan(id, day){ const p = S.plans.find(x => x.id === id); if (!p) return; U.edit = {col:"plans", id, who:"", day: day || ""};
  const wk = repeats(p), dname = fmt(p.date,{weekday:"long"});
  $("#overlay").innerHTML = `<div class="sheet" data-act="closebg"><div class="panel edit-panel" role="dialog" aria-modal="true" aria-label="Edit plan"><div class="top-actions"><button class="close" data-act="close" aria-label="Close">${svg("close")}</button></div><h3>Edit plan</h3>
    <p class="note" style="font-size:14px;margin-top:6px">${wk ? `Every ${dname}${p.time ? " · " + esc(p.time) : ""}` : `${fmt(p.date,{weekday:"long",month:"long",day:"numeric"})}${p.time ? " · " + esc(p.time) : ""}`}</p>
    <form class="eform" data-form="planedit" data-id="${p.id}">
      <label>What<input type="text" id="ep-title" value="${esc(p.title)}" required></label>
      <div class="erow"><label>${wk ? "Starts" : "Day"}<input type="date" id="ep-date" value="${esc(p.date)}"></label>${wk ? "" : `<label>Ends (optional)<input type="date" id="ep-end" value="${esc(p.endDate || "")}"></label>`}<label>Time<input type="text" id="ep-time" value="${esc(p.time || "")}" placeholder="Optional"></label></div>
      <label>Note<input type="text" id="ep-note" value="${esc(p.note || "")}" placeholder="Optional"></label>
      <label class="chk"><input type="checkbox" id="ep-weekly" ${wk ? "checked" : ""}> Repeats every week</label>
      <div class="inline eacts"><button class="btn">Save</button><button type="button" class="btn quiet" data-act="close">Cancel</button>
        ${wk && day ? `<button type="button" class="btn ghost" data-act="pskip">Skip ${fmt(day,{month:"short",day:"numeric"})} only</button>` : ""}
        <button type="button" class="btn danger-o" data-act="edel">${wk ? "Delete every week" : "Delete"}</button></div>
    </form></div></div>`; }
function renderPeople(){
  if (!U.peopleOpen) return; const ps = people(), used = ps.map(p => p.color);
  $("#overlay").innerHTML = `<div class="sheet" data-act="closebg"><div class="panel people-panel" role="dialog" aria-modal="true" aria-label="The household"><div class="top-actions"><button class="close" data-act="close" aria-label="Close">${svg("close")}</button></div><h3>The household</h3>
    <p class="note" style="font-size:14px">Everyone gets a color. Tap the circle on any to-do to hand it to someone; tap again to pass it on.</p>
    <div class="plist">${ps.map(p => `<div class="prow">${avatar(p, "lg")}<input type="text" class="pname" data-id="${p.id}" value="${esc(p.name)}" aria-label="Name"><div class="swatches">${PCOLORS.map(([k,c]) => `<button class="sw-c ${p.color===k?"on":""}" style="--c:${c}" data-act="pcolor" data-id="${p.id}" data-c="${k}" aria-label="${k}"></button>`).join("")}</div>${del("people", p.id)}</div>`).join("") || `<div class="empty" style="padding:8px 0">No one yet. Add the first person below.</div>`}</div>
    <form class="add" data-form="person"><input type="text" id="npn2" placeholder="Name" aria-label="New person" autocomplete="off" required><button class="btn">Add</button></form></div></div>`;
}
const dayTag = d => { const n = daysTo(d); return n < 0 ? "Overdue" : n === 0 ? "Today" : n === 1 ? "Tomorrow" : `in ${n} days`; };
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
/* Plans can repeat weekly (repeat:"weekly", optional until and skip[] dates); occurrences are computed, never stored. */
const repeats = p => p && p.repeat === "weekly";
const occurs = (p, d) => !p.date ? false : repeats(p) ? (d >= p.date && (!p.until || d <= p.until) && pd(d).getDay() === pd(p.date).getDay() && !(p.skip || []).includes(d)) : (p.date <= d && (p.endDate || p.date) >= d);
const nextOcc = (p, from) => { if (!repeats(p)) return p.date; let d = (from || todayISO()) > p.date ? (from || todayISO()) : p.date; for (let i = 0; i < 8; i++) { if (occurs(p, d)) return d; d = addDays(d, 1); } return null; };
const plansOn = d => S.plans.filter(p => occurs(p, d)).sort((a,b) => (a.time||"").localeCompare(b.time||""));
/* A recipe to show or cook can come from the cookbook (key), from fields stored on a dinner or idea (imported), or be link-only. */
const hasContent = o => !!(o && ((o.ingredients||[]).length || (o.steps||[]).length));
function recipeObj(o, src){ if (!o) return null;
  if (o.recipe && R[o.recipe]) return {...R[o.recipe], key:o.recipe, link:o.link || "", src};
  if (hasContent(o) || safeUrl(o.link)) return {title:o.title || o.text || "Recipe", note:o.note || "", meta:[o.time ? "Time: " + o.time : "", o.servings ? "Serves: " + o.servings : ""].filter(Boolean), ingredients:o.ingredients || [], steps:o.steps || [], link:o.link || "", src};
  return null; }
const recipeFromRef = ref => { const [kind, ...rest] = String(ref||"").split(":"); const id = rest.join(":");
  if (kind === "dinner") return recipeObj(S.dinners[id], ref); if (kind === "item") return recipeObj(S.items.find(i => i.id === id), ref); return R[kind] ? {...R[kind], key:kind, src:"cb:"+kind} : (R[id] ? {...R[id], key:id, src:"cb:"+id} : null); };
/* Meal idea tags: derived from the recipe's own words and time, plus any tags typed on the idea. */
const TAGS = [["quick","Under 30 min"],["hour","Under an hour"],["crockpot","Crockpot"],["instantpot","Instant Pot"],["sheetpan","Sheet pan"],["onepot","One pot"],["airfryer","Air fryer"],["grill","Grill"],["chicken","Chicken"],["beef","Beef"],["pork","Pork"],["seafood","Seafood"],["veg","Vegetarian"],["soup","Soup"],["pasta","Pasta"],["tacos","Tacos"],["salad","Salad"],["family","Family cookbook"],["few","5 ingredients"]];
const TAG_LABEL = Object.fromEntries(TAGS);
const minutesOf = t => { let total = 0, any = false; const re = /(\d+(?:\.\d+)?)(?:\s*(?:[–-]|to)\s*(\d+(?:\.\d+)?))?\s*(h(?:ou)?rs?|min(?:ute)?s?)/gi; let m;
  while ((m = re.exec(String(t||"")))) { any = true; const n = +(m[2] || m[1]); total += /^h/i.test(m[3]) ? n*60 : n; } return any ? total : null; };
const MEAT = /\b(chicken|beef|steak|pork|bacon|sausage|ham|turkey|lamb|shrimp|salmon|fish|crab|tuna|cod|pollock|scallop|lobster|clam|mussel|trout|chorizo|prosciutto|pepperoni|meatball|ground (?:beef|turkey|pork)|brisket|ribs?|duck|venison|rabbit|anchov)/i;
function ideaTags(i){
  const rk = i.recipe && R[i.recipe] ? i.recipe : "", r = rk ? R[rk] : null;
  const text = [i.text, i.note, ...(i.ingredients || r && r.ingredients || []), ...(i.steps || r && r.steps || [])].join(" \n ");
  const tags = new Set((i.tags || []).map(x => norm(x).replace(/ /g,"")));
  const mins = minutesOf(i.time || (rk && recipeTime(rk)) || "");
  if (mins != null && mins <= 30) tags.add("quick"); if (mins != null && mins <= 60) tags.add("hour");
  if (/crock[ -]?pot|slow[ -]cook/i.test(text)) tags.add("crockpot"); if (/instant[ -]?pot|pressure cook/i.test(text)) tags.add("instantpot");
  if (/sheet[ -]?pan/i.test(text)) tags.add("sheetpan"); if (/\bone[ -](?:pot|pan|skillet)|skillet dinner/i.test(text)) tags.add("onepot"); if (/air[ -]?fry/i.test(text)) tags.add("airfryer"); if (/\bgrill/i.test(text)) tags.add("grill");
  if (/\bchicken\b/i.test(text)) tags.add("chicken"); if (/\b(beef|steak|brisket|meatball|ground beef|pot roast|chuck)\b/i.test(text)) tags.add("beef"); if (/\b(pork|bacon|sausage|ham|chorizo|prosciutto|ribs?)\b/i.test(text)) tags.add("pork");
  if (/\b(shrimp|salmon|fish|crab|tuna|cod|pollock|scallop|lobster|clam|mussel|trout|seafood)\b/i.test(text)) tags.add("seafood"); if (!MEAT.test(text) && text.trim().length > 12) tags.add("veg");
  if (/\b(soup|chili|stew|chowder)\b/i.test(text)) tags.add("soup"); if (/\b(pasta|spaghetti|penne|tortellini|lasagna|orzo|mac and cheese|noodle|gnocchi|rigatoni|fettuccine|linguine)\b/i.test(text)) tags.add("pasta");
  if (/\btacos?\b|\bburrito|\bquesadilla|\benchilada/i.test(text)) tags.add("tacos"); if (/\bsalad\b/i.test(text)) tags.add("salad"); if (rk) tags.add("family");
  return [...tags].filter(t => TAG_LABEL[t]);
}
const ideaMatches = i => !U.ideaTags.length || U.ideaTags.every(t => ideaTags(i).includes(t));
const tagChips = ideas => { const counts = {}; ideas.forEach(i => ideaTags(i).forEach(t => counts[t] = (counts[t]||0) + 1)); const avail = TAGS.filter(([k]) => counts[k]); if (!avail.length) return "";
  return `<div class="chips tagchips"><button class="chip" aria-pressed="${!U.ideaTags.length}" data-act="itag" data-id="">All <span>${ideas.length}</span></button>${avail.map(([k,l]) => `<button class="chip" aria-pressed="${U.ideaTags.includes(k)}" data-act="itag" data-id="${k}">${l} <span>${counts[k]}</span></button>`).join("")}</div>`; };
const tagPills = i => ideaTags(i).filter(t => !["hour","veg","family"].includes(t)).slice(0,3).map(t => `<span class="pill tag-${t}">${TAG_LABEL[t]}</span>`).join("");
const recipeOptions = sel => `<option value="">From the cookbook (optional)</option>` + Object.entries(R).sort((a,b) => a[1].title.localeCompare(b[1].title)).map(([k,v]) => `<option value="${k}" ${sel===k?"selected":""}>${esc(v.title)}</option>`).join("");

/* ───────────────────────── Render shell ───────────────────────── */
function render(){
  const counts = {lists: S.items.filter(i => !i.done).length, hosting: S.tasks.filter(t => !t.done && daysTo(t.date||todayISO()) <= 7).length};
  setHTML($("#nav"), VIEWS.map(([k,l]) => `<button class="nav-item nav-${k}" role="tab" aria-selected="${U.view===k || (k==="meals" && (U.view==="dinners" || U.view==="cookbook")) || (k==="today" && U.view==="plans")}" data-act="view" data-id="${k}">${svg(k)}<span>${l}</span>${counts[k] ? `<span class="n">${counts[k]}</span>` : ""}</button>`).join(""));
  $("#railfoot").innerHTML = `${ready && db ? `<button class="hh-btn" data-act="people" aria-label="The household">${people().length ? `<span class="avs">${people().map(p => avatar(p, "sm")).join("")}</span>Household` : `${svg("person")}Add the household`}</button>` : ""}${new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}<br>${ready ? (db ? "Shared with the household" : "Not signed in") : "Loading…"}`;
  const key = [U.view, U.listId, U.wk, U.sub, U.htab, U.weekOff, U.calMode, U.calOff].join("|");
  let body;
  if (!ready) body = `<p class="status">Loading the house…</p>`;
  else if (noDb) body = `<div class="empty"><b>Sign in to claude.ai</b>Your lists, dinners and hosting plans live in the shared database. Sign in and reopen this page.</div>`;
  else body = ({today:vToday, cal:vCal, lists:vLists, dinners:vDinners, hosting:vHosting, cookbook:vCookbook, plans:vPlans})[U.view]();
  const sc = $("#main");
  setHTML(sc, `<div class="wrap v-${U.view} ${U.view === "cal" ? "wide" : ""}">${body}</div>`);
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
  const hcards = hostWks().slice(0,1).map(x => { const o = hostTasks(x.k).filter(t => !t.done).sort(byDay), wkO = o.filter(t => t.date && daysTo(t.date) <= 7);
    return `<button class="lcard host" data-act="golist" data-id="${HOST}${x.k}"><p class="eyebrow">${esc(hostName(x.k))} to-dos</p><div class="big ${o.length?"":"faint"}">${wkO.length}<small>this week</small></div><div class="peek">${o.length ? esc(o.slice(0,3).map(t => t.title).join(" · ")) : "All clear"}</div></button>`; }).join("");
  const lcards = lists.length || hcards ? `<div class="grid c4">${hcards}${lists.slice(0, hcards ? 7 : 8).map(l => { const o = openItems(l.id); return `<button class="lcard" data-act="golist" data-id="${l.id}"><p class="eyebrow">${esc(l.name)}</p><div class="big ${o.length?"":"faint"}" ${o.length?"":'style="color:var(--faint)"'}>${o.length}</div><div class="peek">${o.length ? esc(o.slice(0,3).map(i => i.text).join(" · ")) : "All clear"}</div></button>`; }).join("")}</div>` : `<div class="empty"><b>No lists yet</b>Open Lists to make the first one, or say "add milk to grocery".</div>`;
  const ev = nextEvent(); let host = `<div class="empty"><b>No events planned</b>Open Hosting to add the first one.</div>`;
  if (ev) { const evs = S.events.filter(e => wkKey(e) === wkKey(ev)), ids = evs.map(e => e.id), tasks = S.tasks.filter(x => ids.includes(x.eventId)), done = tasks.filter(x => x.done).length, g = S.guests.filter(x => x.eventId === ev.id), yes = g.filter(x => x.rsvp === "yes").length, n = daysTo(ev.date);
    host = `<button class="card tap" data-act="gohost" data-id="${wkKey(ev)}"><div class="host-card"><div><p class="eyebrow">Up next</p><div class="name">${esc(ev.name)}</div><div class="when">${fmt(ev.date,{weekday:"long",month:"long",day:"numeric"})}${ev.time ? " · " + esc(ev.time) : ""}</div>${ev.theme ? `<div class="sum-th">${esc(ev.theme)}</div>` : ""}</div><div class="count"><b>${n < 0 ? "Done" : n}</b><span>${n < 0 ? "" : n === 1 ? "day to go" : "days to go"}</span></div></div>
      <div class="stats"><span><b>${done}/${tasks.length}</b> to-dos done</span><span><b>${yes}/${g.length}</b> guests confirmed</span></div><div class="bar"><i style="width:${tasks.length ? Math.round(done/tasks.length*100) : 0}%"></i></div></button>`; }
  const allDue = S.tasks.filter(x => !x.done && x.date && daysTo(x.date) <= 7).sort(byDay), due = allDue.slice(0,8), hw = hostWks()[0];
  const dueHtml = due.length ? `<div class="card soft"><div class="list">${due.map(x => { const d = daysTo(x.date), e = evById(x.eventId); return `<div class="row ${d<0?"overdue":""}">${ck(false,"task",x.id,x.title)}<div class="main tapedit" data-act="edittask" data-id="${x.id}"><div class="t">${esc(x.title)}</div><div class="s">${d<0?"Overdue · ":d===0?"Today · ":d===1?"Tomorrow · ":""}${fmt(x.date)}${x.time ? " · " + esc(x.time) : ""}${e ? " · " + esc(e.short||e.name) : ""}</div>${x.cat === "freezer" ? `<span class="pill cat-freezer">Freezer</span>` : ""}</div>${whoBtn("tasks", x.id, x.who)}</div>`; }).join("")}</div>
    ${hw ? `<div class="inline" style="margin-top:6px"><button class="btn sm ghost" data-act="golist" data-id="${HOST}${hw.k}">${allDue.length > due.length ? `See all ${allDue.length}` : `All ${esc(hostName(hw.k))} to-dos`}</button></div>` : ""}</div>` : "";
  const soonDate = p => repeats(p) ? nextOcc(p) : p.date;
  const soon = S.plans.filter(p => p.date && (repeats(p) ? (soonDate(p) && daysTo(soonDate(p)) <= 7) : (daysTo(p.endDate || p.date) >= 0 && daysTo(p.date) <= 14))).sort((a,b) => (soonDate(a)||"").localeCompare(soonDate(b)||"") || (a.time||"").localeCompare(b.time||""));
  const coming = `<div class="card soft">${soon.length ? `<div class="list">${soon.map(p => planRow(p)).join("")}</div>` : `<div class="empty" style="padding:12px 4px"><b>Nothing on the horizon</b>Trips, appointments, nights out. Add one below or say "New York next Sunday".</div>`}
    <form class="add" data-form="plan" style="margin-top:10px"><input type="text" id="np" placeholder="e.g. New York for the day" required><input type="date" id="npd" value="${t}"><input type="text" id="npt" placeholder="Time (optional)" style="flex:0 1 150px"><button class="btn">Add</button><button class="btn quiet" type="button" data-act="view" data-id="plans">All plans</button></form></div>`;
  return `<div class="ph"><div><svg class="mark" aria-hidden="true"><use href="#hh-mark"/></svg><h1>${greet}</h1><div class="sub">${new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}${holidayOn(t) ? " · " + esc(holidayOn(t)) : ""}${plansOn(t).length ? " · " + esc(plansOn(t).map(p => p.title).join(", ")) : ""}</div></div>${wxCard()}</div>
    <div class="widgets">${calCard()}</div>
    <div class="today-grid"><div class="card dinner-hero">${hero}${strip}</div>${host}</div>
    ${due.length ? `<h2 class="eyebrow">To-dos this week</h2>${dueHtml}` : ""}
    <h2 class="eyebrow">Lists</h2>${lcards}
    <h2 class="eyebrow">Coming up</h2>${coming}`;
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
  if (WX.state === "off" && !S.shared.weather) return "";
  const head = `<p class="eyebrow">Philadelphia</p>`;
  if (WX.state === "approve" && !S.shared.weather) return `<div class="wx card soft">${head}<div class="wx-msg">The weather needs your OK once.</div><div><button class="btn sm" data-act="wxallow">Show the weather</button></div></div>`;
  const snap = S.shared.weather, live = !!(WX.cur || WX.daily);
  if (!live && WX.state === "connect" && !snap) return "";
  if (!live && !snap) return `<div class="wx card soft">${head}<div class="wx-msg">${WX.state === "error" ? "The weather isn't loading right now. It will try again shortly." : "Checking the weather…"}</div></div>`;
  const src = live ? WX : snap, c = src.cur && src.cur.currentConditions, d = (src.daily && src.daily.dailyForecast) || [];
  if (!live) WX.stale = true, WX.at = snap.updatedAt;
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
  if (U.view === "today" || U.view === "cal") render();
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
  const head = `<p class="eyebrow">Today's calendar</p>`;
  const t = todayISO(), snap = S.shared.calendar, snapToday = snap && snap.days && snap.days[t] ? snap.days[t] : null, snapTom = snap && snap.days && snap.days[addDays(t,1)] ? snap.days[addDays(t,1)] : null;
  if (CAL.state === "approve" && !snapToday) return `<div class="card soft cal">${head}<div class="wx-msg">Your Outlook calendar needs your OK once.</div><div><button class="btn sm" data-act="calallow">Show my calendar</button></div></div>`;
  if ((CAL.state === "connect" || CAL.state === "off") && !snapToday) return "";
  if (!CAL.today && !snapToday) return `<div class="card soft cal">${head}<div class="wx-msg">${CAL.state === "error" ? "Your calendar isn't loading right now. It will try again shortly." : "Checking your calendar…"}</div></div>`;
  const live = !!CAL.today, todayList = live ? CAL.today : snapToday, tomList = live ? CAL.tomorrow : snapTom;
  const now = new Date(), nowMin = now.getHours()*60 + now.getMinutes();
  const td = calDay(todayList, t), left = td.timed.filter(x => x.en > nowMin);
  const chips = td.allDay.length ? `<div class="cal-all">${td.allDay.map(e => `<span class="pill">${esc(e.subject || "All day")}</span>`).join("")}</div>` : "";
  let body;
  if (!td.timed.length) body = `<div class="cal-empty">No meetings today.</div>`;
  else if (!left.length) body = `<div class="cal-empty">That's it for meetings today.</div>`;
  else { const shown = td.timed.filter(x => x.en > nowMin - 60).slice(0, 5); body = `<div class="cal-list">${calRows(shown, nowMin)}</div>${left.length > shown.filter(x => x.en > nowMin).length ? `<div class="wx-say">+${left.length - shown.filter(x => x.en > nowMin).length} more later</div>` : ""}`; }
  let tm = "";
  if (!left.length && tomList) { const tt = calDay(tomList, addDays(t, 1)); if (tt.timed.length) tm = `<p class="eyebrow cal-tm">Tomorrow</p><div class="cal-list">${calRows(tt.timed.slice(0, 3), null)}</div>${tt.timed.length > 3 ? `<div class="wx-say">+${tt.timed.length - 3} more</div>` : ""}`; }
  const sum = td.timed.length ? `<span class="cal-n">${left.length ? `${left.length} to go` : `${td.timed.length} done`}</span>` : "";
  return `<div class="card soft cal"><div class="cal-head">${head}${sum}</div>${chips}${body}${tm}${!live && snap && snap.updatedLabel ? `<div class="wx-say">Updated ${esc(snap.updatedLabel)}</div>` : CAL.stale ? `<div class="wx-say">May be out of date</div>` : ""}</div>`;
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
  if (U.view === "today" || U.view === "cal") render();
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
function planRow(p){ const nx = repeats(p) ? nextOcc(p) : p.date, d = nx ? daysTo(nx) : -1, multi = !repeats(p) && p.endDate && p.endDate !== p.date;
  const when = repeats(p) ? `Every ${fmt(p.date,{weekday:"long"})}${p.time ? " · " + esc(p.time) : ""}${nx ? ` · next ${d===0?"today":d===1?"tomorrow":fmt(nx,{month:"short",day:"numeric"})}` : " · ended"}`
    : `${d===0?"Today":d===1?"Tomorrow":d<0?"Started "+fmt(p.date):fmt(p.date,{weekday:"long",month:"short",day:"numeric"})}${multi ? " – " + fmt(p.endDate,{month:"short",day:"numeric"}) : ""}${p.time ? " · " + esc(p.time) : ""}`;
  return `<div class="sw" data-col="plans" data-id="${p.id}"><div class="row plan"><span class="dot"></span><div class="main tapedit" data-act="editplan" data-id="${p.id}"><div class="t">${esc(p.title)}</div><div class="s">${when}${p.note ? " · " + esc(p.note) : ""}</div></div>${d > 1 && d <= 14 ? `<span class="pill">in ${d} days</span>` : ""}${del("plans", p.id)}</div><button class="sw-del" data-act="swdel" data-col="plans" data-id="${p.id}" tabindex="-1">Delete</button></div>`; }
function vPlans(){
  const t = todayISO(), key = p => repeats(p) ? (nextOcc(p) || p.until || p.date) : p.date, all = S.plans.slice().sort((a,b) => key(a).localeCompare(key(b)) || (a.time||"").localeCompare(b.time||""));
  const live = p => repeats(p) ? !!nextOcc(p) : (p.endDate || p.date) >= t;
  const up = all.filter(live), past = all.filter(p => !live(p)).reverse();
  let html = "", last = "";
  up.forEach(p => { const m = fmt(key(p),{month:"long",year:"numeric"}); if (m !== last) { if (last) html += `</div></div>`; last = m; html += `<h2 class="eyebrow">${m}</h2><div class="card soft"><div class="list">`; } html += planRow(p); });
  if (last) html += `</div></div>`;
  return `<div class="ph"><div><h1>Coming up</h1><div class="sub">Trips, appointments, nights out. Not a calendar, just what's ahead.</div></div><button class="btn sm ghost" data-act="view" data-id="today">Back to Today</button></div>
    <div class="card"><form class="add" data-form="plan" style="margin-top:0"><input type="text" id="np" placeholder="What's coming up?" required><input type="date" id="npd" value="${t}" aria-label="Date"><input type="date" id="npe" aria-label="End date (optional)"><input type="text" id="npt" placeholder="Time (optional)" style="flex:0 1 150px"><input type="text" id="npn" placeholder="Note (optional)"><button class="btn">Add</button></form><p class="note">Second date is optional, for a trip that spans days.</p></div>
    ${html || `<div class="empty"><b>Nothing planned yet</b></div>`}
    ${past.length ? `<details class="checked"><summary>Past (${past.length})</summary><div class="card soft"><div class="list">${past.slice(0,30).map(planRow).join("")}</div></div></details>` : ""}`;
}

/* ───────────────────────── Lists ───────────────────────── */
function vLists(){
  const lists = sortedLists(), hws = hostWks();
  const isHost = String(U.listId||"").startsWith(HOST) && hws.some(x => HOST + x.k === U.listId);
  if (!isHost && !lists.find(l => l.id === U.listId)) U.listId = hws[0] ? HOST + hws[0].k : lists[0] ? lists[0].id : null;
  const index = `<div class="list-index">${hws.map(x => `<button class="host" aria-pressed="${HOST+x.k===U.listId}" data-act="list" data-id="${HOST}${x.k}">${svg("hosting")}${esc(hostName(x.k))}<span class="n">${hostTasks(x.k).filter(t => !t.done).length || ""}</span></button>`).join("")}${hws.length ? `<div class="sep" aria-hidden="true"></div>` : ""}${lists.map(l => `<button aria-pressed="${l.id===U.listId}" data-act="list" data-id="${l.id}">${esc(l.name)}<span class="n">${openItems(l.id).length || ""}</span></button>`).join("")}
    <form class="newlist" data-form="list"><input type="text" id="nl" placeholder="New list…" aria-label="New list name"></form></div>`;
  const head = `<div class="ph"><h1>Lists</h1><div class="sub">${S.items.filter(i => !i.done).length} open across ${lists.length} lists</div></div>`;
  if (String(U.listId||"").startsWith(HOST)) return `${head}<div class="lists-layout">${index}<div>${vHostList(U.listId.slice(HOST.length))}</div></div>`;
  if (!U.listId) return `<div class="ph"><h1>Lists</h1></div><div class="lists-layout">${index}<div class="empty"><b>Make your first list</b>Grocery, Costco, to-do, anything. Type a name on the left.</div></div>`;
  const L = S.lists.find(l => l.id === U.listId), items = listItems(L.id), isIdeas = L.id === "ideas" || /idea/i.test(L.name);
  const allOpen = items.filter(i => !i.done), open = isIdeas ? allOpen.filter(ideaMatches) : allOpen, done = items.filter(i => i.done);
  const week = [0,1,2,3,4,5,6].map(i => addDays(todayISO(), i));
  const row = i => { const rk = i.recipe && R[i.recipe] ? i.recipe : (isIdeas ? recipeFor(i.text) : ""), tm = i.time || (rk && recipeTime(rk));
    return `<div class="sw" data-col="items" data-id="${i.id}"><div class="row ${i.done?"done":""} ${isIdeas?"idea-row":""}">${ck(i.done,"item",i.id,i.text)}<div class="main ${!isIdeas && !U.editList ? "tapedit" : ""}" ${!isIdeas && !U.editList ? `data-act="edititem" data-id="${i.id}"` : ""}><div class="t">${esc(i.text)}</div>${i.note ? `<div class="s">${esc(i.note)}</div>` : ""}${tm || i.link || rk || hasContent(i) || (isIdeas && ideaTags(i).length) ? `<div>${timePill(tm)}${rk ? `<button class="pill link" data-act="recipe" data-id="${rk}">Recipe</button>` : hasContent(i) ? `<button class="pill link" data-act="recipe" data-id="item:${i.id}">Recipe</button>` : ""}${linkPill(i.link)}${isIdeas ? tagPills(i) : ""}</div>` : ""}
    ${U.editList ? `<div class="edit"><input type="text" id="it-${i.id}" value="${esc(i.time||"")}" placeholder="Time, e.g. 30 min" style="flex:0 1 160px"><input type="text" id="il-${i.id}" value="${esc(i.link||"")}" placeholder="Link (Pinterest, recipe site)" style="flex:1 1 200px">${isIdeas ? `<input type="text" id="ig-${i.id}" value="${esc((i.tags||[]).join(", "))}" placeholder="Tags, e.g. crockpot, kid friendly" style="flex:1 1 180px">` : ""}<button class="btn sm ghost" data-act="saveitem" data-id="${i.id}">Save</button></div>` : ""}
    ${isIdeas && !i.done && U.pickIdea === i.id ? `<div class="daypick">${week.map(d => `<button class="chip" data-act="pickday" data-id="${d}" data-idea="${esc(i.text)}">${d===todayISO()?"Tonight":fmt(d,{weekday:"short"})}</button>`).join("")}<button class="chip" data-act="plan" data-id="">Cancel</button></div>` : ""}</div>
    ${isIdeas && !i.done && U.pickIdea !== i.id ? `<button class="pill link plan" data-act="plan" data-id="${i.id}">Plan it</button>` : ""}${!isIdeas ? whoBtn("items", i.id, i.who) : ""}${U.editList ? del("items", i.id) : ""}</div><button class="sw-del" data-act="swdel" data-col="items" data-id="${i.id}" tabindex="-1">Delete</button></div>`; };
  const main = `<div class="lhead"><h2>${esc(L.name)}</h2><div class="tools">${safeUrl(L.link) ? `<a class="btn sm ghost" href="${esc(safeUrl(L.link))}" target="_blank" rel="noopener">${esc(linkLabel(L.link))} board ↗</a>` : ""}${done.length ? `<button class="btn sm ghost" data-act="clearchecked" data-id="${L.id}">Clear ${done.length} checked</button>` : ""}<button class="btn sm ${U.editList?"":"quiet"}" data-act="editlist">${U.editList ? "Done" : "Edit"}</button>${U.editList ? `<button class="btn sm clay" data-act="dellist" data-id="${L.id}">${U.armed==="list"+L.id ? "Really delete?" : "Delete list"}</button>` : ""}</div></div>
    ${U.editList ? `<form class="add" data-form="listlink" data-id="${L.id}" style="margin:0 0 10px"><input type="text" id="ll" value="${esc(L.link||"")}" placeholder="Board or page link for this list (e.g. your Pinterest board)"><button class="btn sm ghost">Save link</button></form>` : ""}
    <form class="quickadd" data-form="item"><input type="text" id="ni" placeholder="${isIdeas ? "A dinner idea…" : "Add to " + esc(L.name) + "…"}" aria-label="Add item" autocomplete="off">${isIdeas ? `<input type="text" id="ni-time" placeholder="Time" aria-label="How long it takes" style="flex:0 1 110px">` : ""}<button class="rbtn primary" aria-label="Add">${svg("plus")}</button></form>
    ${isIdeas ? tagChips(allOpen) : ""}
    <div class="card soft">${open.length ? `<div class="list">${open.map(row).join("")}</div>` : `<div class="empty"><b>${isIdeas ? (allOpen.length ? "Nothing matches those filters" : "No ideas saved") : "All clear"}</b>${isIdeas ? (allOpen.length ? "Tap All to clear them." : "Jot down dinners you want to make. Plan one into the week with a tap.") : "Add something above, or say it out loud."}</div>`}</div>
    ${done.length ? `<details class="checked" ${U.editList?"open":""}><summary>Checked off (${done.length})</summary><div class="card soft"><div class="list">${done.map(row).join("")}</div></div></details>` : ""}`;
  return `<div class="ph"><h1>Lists</h1><div class="sub">${S.items.filter(i => !i.done).length} open across ${lists.length} lists</div></div><div class="lists-layout">${index}<div>${main}</div></div>`;
}

/* A holiday weekend's hosting to-dos as a list: grouped by day, filter by kind, quick add with a date. Same tasks as Hosting > Checklist. */
function vHostList(k){
  const wk = weekends().find(x => x.k === k); if (!wk) return `<div class="empty"><b>Nothing planned</b></div>`;
  const all = hostTasks(k), catLab = Object.fromEntries(CATS), f = U.hlF || "all", inF = x => f === "all" || (x.cat||"food") === f;
  const open = all.filter(x => !x.done && inF(x) && whoMatch(x)).sort(byDay), done = all.filter(x => x.done && inF(x) && whoMatch(x)).sort((a,b) => byDay(b,a));
  const left = c => all.filter(x => !x.done && (c === "all" || (x.cat||"food") === c)).length;
  const first = wk.evs[0], last = wk.evs[wk.evs.length-1], n = daysTo(first.date), multi = wk.evs.length > 1, t = todayISO();
  const row = x => { const e = evById(x.eventId), od = !x.done && x.date && x.date < t;
    return `<div class="sw" data-col="tasks" data-id="${x.id}"><div class="row ${x.done?"done":""} ${od?"overdue":""}">${ck(x.done,"task",x.id,x.title)}<div class="main tapedit" data-act="edittask" data-id="${x.id}"><div class="t">${esc(x.title)}</div>${x.detail ? `<div class="s">${esc(x.detail)}</div>` : ""}
      <div><span class="pill cat-${x.cat||"food"}">${catLab[x.cat||"food"] || "Food"}</span>${multi && e && (e.short||e.name) !== hostName(k) ? `<span class="pill">${esc(e.short||e.name)}</span>` : ""}${x.recipe && R[x.recipe] ? `<button class="pill link" data-act="recipe" data-id="${x.recipe}">Recipe</button>` : ""}${x.done && x.date ? `<span class="pill">${fmt(x.date)}</span>` : ""}</div></div>${x.time ? `<span class="time">${esc(x.time)}</span>` : ""}${whoBtn("tasks", x.id, x.who)}</div><button class="sw-del" data-act="swdel" data-col="tasks" data-id="${x.id}" tabindex="-1">Delete</button></div>`; };
  let groups = "", cur = null;
  open.forEach(x => { const key = x.date && x.date < t ? "overdue" : (x.date || "");
    if (key !== cur) { if (cur !== null) groups += `</div></div>`; cur = key;
      groups += key === "overdue" ? `<div class="day past">Overdue<small class="now">Catch up</small></div><div class="card soft"><div class="list">`
        : `<div class="day">${key ? fmt(key,{weekday:"long",month:"short",day:"numeric"}) : "No date"}<span class="day-r"><small class="${daysTo(key)===0?"now":daysTo(key)<=7?"soon":""}">${key ? dayTag(key) : ""}</small>${key ? `<button class="dadd" data-act="caladd" data-ev="auto" data-id="${key}" aria-label="Add a to-do on ${fmt(key,{weekday:"long",month:"long",day:"numeric"})}">${svg("plus")}</button>` : ""}</span></div><div class="card soft"><div class="list">`; }
    groups += row(x); });
  if (cur !== null) groups += `</div></div>`;
  const chips = `<div class="chips" style="margin-top:4px">${[["all","All"], ...CATS].filter(([c]) => c === "all" || c === f || left(c)).map(([c,l]) => `<button class="chip" aria-pressed="${f===c}" data-act="hlf" data-id="${c}">${l} <span>${left(c)}</span></button>`).join("")}</div>`;
  const defDate = t < first.date ? t : first.date;
  return `<div class="lhead"><h2>${esc(hostName(k))} to-dos</h2><div class="tools"><button class="btn sm ghost" data-act="gohost" data-id="${k}">Menu, rooms &amp; day-of</button></div></div>
    <p class="note" style="margin:0 0 6px">${first.date === last.date ? fmt(first.date,{weekday:"long",month:"long",day:"numeric"}) : `${fmt(first.date)} – ${fmt(last.date)}`}${n > 0 ? ` · ${n} day${n===1?"":"s"} to go` : ""}</p>
    <form class="quickadd host-add" data-form="htask" data-wk="${k}"><input type="text" id="nht" placeholder="Add a hosting to-do…" aria-label="New hosting to-do" autocomplete="off"><input type="date" id="nhtd" value="${defDate}" aria-label="Day"><select id="nhtc" aria-label="Kind">${CATS.map(([c,l]) => `<option value="${c}" ${(f===c || (f==="all" && c==="house"))?"selected":""}>${l}</option>`).join("")}</select><button class="rbtn primary" aria-label="Add">${svg("plus")}</button></form>
    ${chips}${whoChips()}
    ${groups || `<div class="card soft"><div class="empty"><b>${f === "all" ? "All done" : "Nothing left here"}</b>${f === "all" ? "Every to-do for the weekend is checked off." : "Tap All to see the rest."}</div></div>`}
    ${done.length ? `<details class="checked"><summary>Checked off (${done.length})</summary><div class="card soft"><div class="list">${done.map(row).join("")}</div></div></details>` : ""}`;
}

/* ───────────────────────── Meals: the week's dinners and the cookbook, one tab ───────────────────────── */
const mealsHead = sub => `<div class="ph"><div><h1>Meals</h1><div class="sub">${esc(sub)}</div></div><div class="seg" role="tablist" aria-label="Meals"><button aria-pressed="${U.view==="dinners"}" data-act="mtab" data-id="dinners">This week</button><button aria-pressed="${U.view==="cookbook"}" data-act="mtab" data-id="cookbook">Cookbook</button></div></div>`;
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
  const allIdeas = ideasList ? openItems(ideasList.id) : [], ideas = allIdeas.filter(ideaMatches);
  const ideasHtml = `<div class="ideas-panel"><div class="ideas-head"><p class="eyebrow">Meal ideas</p>${ideasList && safeUrl(ideasList.link) ? `<a class="pill link ext" href="${esc(safeUrl(ideasList.link))}" target="_blank" rel="noopener" style="margin:0">${esc(linkLabel(ideasList.link))} board ↗</a>` : ""}</div>${tagChips(allIdeas)}${ideas.length ? `<div class="ideas">${ideas.map(i => { const tm = shortTime(i.time, i.recipe || recipeFor(i.text)); return `<button class="idea" aria-pressed="${U.pickIdea===i.id}" data-act="idearecipe" data-id="${i.id}"><span class="plus" aria-hidden="true">+</span><span class="idea-t">${esc(i.text)}${tm || ideaTags(i).length ? `<span>${esc([tm, ...ideaTags(i).filter(t => ["crockpot","instantpot","sheetpan","onepot","airfryer","grill"].includes(t)).map(t => TAG_LABEL[t])].filter(Boolean).join(" · "))}</span>` : ""}</span></button>`; }).join("")}</div>` : allIdeas.length ? `<p class="note">Nothing matches those filters.</p>` : `<p class="note">Save dinner ideas in the Meal ideas list, or say "idea: lemon chicken". They show up here to drop into the week.</p>`}
    ${U.pickIdea && ideas.find(i => i.id === U.pickIdea) ? `<p class="note" style="margin-top:14px">Put <b>${esc(ideas.find(i => i.id === U.pickIdea).text)}</b> on which night?</p><div class="daypick">${days.map(d => `<button class="chip" data-act="pickday" data-id="${d}" data-idea="${esc(ideas.find(i => i.id === U.pickIdea).text)}">${fmt(d,{weekday:"short",day:"numeric"})}</button>`).join("")}</div>` : ""}</div>`;
  return `${mealsHead("Plan the week on Sunday, shop once.")}${nav}${cards}${edit}${ideasHtml}`;
}

/* ───────────────────────── Calendar: everything with a date, in one place ─────────────────────────
   Meetings (Outlook), dinners, plans, hosting events and hosting to-dos, by week or month. Tap a day for its detail and one add box.
   Meetings come from the live connector for the visible week when the viewer has it, else from the hourly shared snapshot. */
/* Holidays, computed for any year: fixed dates, nth-weekday rules, and Easter. */
const nthDow = (y, m, dow, n) => { if (n > 0) { const off = (dow - new Date(y, m, 1).getDay() + 7) % 7; return iso(new Date(y, m, 1 + off + (n-1)*7)); }
  const last = new Date(y, m+1, 0), off = (last.getDay() - dow + 7) % 7; return iso(new Date(y, m, last.getDate() - off)); };
const easter = y => { const a = y % 19, b = Math.floor(y/100), c = y % 100, d = Math.floor(b/4), e = b % 4, f = Math.floor((b+8)/25), g = Math.floor((b-f+1)/3), h = (19*a+b-d-g+15) % 30, i = Math.floor(c/4), k = c % 4, l = (32+2*e+2*i-h-k) % 7, m = Math.floor((a+11*h+22*l)/451), mo = Math.floor((h+l-7*m+114)/31), da = ((h+l-7*m+114) % 31) + 1; return iso(new Date(y, mo-1, da)); };
const holidaysFor = y => [[`${y}-01-01`,"New Year's Day"],[nthDow(y,0,1,3),"Martin Luther King Jr. Day"],[`${y}-02-14`,"Valentine's Day"],[nthDow(y,1,1,3),"Presidents' Day"],[`${y}-03-17`,"St. Patrick's Day"],[easter(y),"Easter"],[nthDow(y,4,0,2),"Mother's Day"],[nthDow(y,4,1,-1),"Memorial Day"],[nthDow(y,5,0,3),"Father's Day"],[`${y}-06-19`,"Juneteenth"],[`${y}-07-04`,"Independence Day"],[nthDow(y,8,1,1),"Labor Day"],[nthDow(y,9,1,2),"Indigenous Peoples' Day"],[`${y}-10-31`,"Halloween"],[`${y}-11-11`,"Veterans Day"],[nthDow(y,10,4,4),"Thanksgiving"],[`${y}-12-24`,"Christmas Eve"],[`${y}-12-25`,"Christmas"],[`${y}-12-31`,"New Year's Eve"]];
const HOL = {};
const holidayOn = d => { const y = +String(d).slice(0,4); if (!y) return ""; if (!HOL[y]) HOL[y] = Object.fromEntries(holidaysFor(y)); return HOL[y][d] || ""; };
const CALI_STAR = '<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/>';
const CALWK = {key:null, parts:{}, un:[]};
function calWeekWatch(start){ if (!CAL.mcp || CALWK.key === start) return; CALWK.key = start; CALWK.parts = {};
  CALWK.un.forEach(u => { try { u(); } catch (e) {} });
  const opts = {refetchInterval: 15*60*1000, cache:{staleTime: 10*60*1000, gcTime: 12*3600*1000}};
  const watch = (a, b) => CAL.mcp.watchTool(CAL_SERVER, CAL_TOOL, calIn(a, b), ev => { if (ev.type === "data" && CALWK.key === start) { CALWK.parts[a] = {to:b, list:calParse(ev.result)}; if (U.view === "cal") render(); } }, opts);
  CALWK.un = [watch(start, addDays(start, 4)), watch(addDays(start, 4), addDays(start, 7))]; }
const meetingsOn = d => { const part = Object.entries(CALWK.parts).find(([a, p]) => d >= a && d < p.to);
  const t = todayISO(), snap = S.shared.calendar && S.shared.calendar.days;
  const list = part ? part[1].list : (CAL.today && d === t) ? CAL.today : (CAL.tomorrow && d === addDays(t,1)) ? CAL.tomorrow : (snap && snap[d]) || null;
  return list ? calDay(list, d) : null; };
const wxOn = d => { const src = WX.daily || (S.shared.weather && S.shared.weather.daily); const f = src && (src.dailyForecast || []).find(x => String(x.date || "").slice(0,10) === d); return f || null; };
const evsOn = d => S.events.filter(e => e.date === d);
const tasksOn = d => S.tasks.filter(x => x.date === d).sort(byDay);
const CALI = {star:CALI_STAR, dinner:'<path d="M7 3v8a2 2 0 0 0 4 0V3M9 11v10M17 3c-2 0-3 2-3 5s1 4 3 4v9"/>', host:'<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>', fz:'<path d="M12 2v20M4.5 6.5l15 11M19.5 6.5l-15 11M9 3.5l3 2.5 3-2.5M9 20.5l3-2.5 3 2.5"/>'};
const ci = k => `<svg viewBox="0 0 24 24" aria-hidden="true" class="ci">${CALI[k]}</svg>`;

function dayItems(d, compact){
  const t = todayISO(), m = S.dinners[d], mt = meetingsOn(d), out = [], hol = holidayOn(d);
  if (hol) out.push(`<div class="ce hol">${ci("star")}${esc(hol)}</div>`);
  plansOn(d).forEach(p => out.push(`<button class="ce plan" data-act="editplan" data-id="${p.id}" data-day="${d}" ${repeats(p) ? "" : `data-drag="plan" data-drag-id="${p.id}" data-drag-from="${d}"`} title="${esc(p.title)}${repeats(p) ? " (every week)" : ""}">${p.time ? `<b>${esc(p.time)}</b> ` : ""}${esc(p.title)}</button>`));
  evsOn(d).forEach(e => out.push(`<button class="ce host" data-act="gohost" data-id="${esc(wkKey(e))}">${ci("host")}${esc(e.short || e.name)}${e.time && !compact ? `<span>${esc(e.time)}</span>` : ""}</button>`));
  if (mt) mt.allDay.forEach(e => out.push(`<div class="ce meet all">${esc(e.subject || "All day")}</div>`));
  if (m && m.title) out.push(`<button class="ce dinner" data-act="${recipeObj(m) ? "dayrecipe" : "editdinner"}" data-id="${d}" data-drag="dinner" data-drag-id="${d}" data-drag-from="${d}">${ci("dinner")}${esc(m.title)}</button>`);
  if (mt) mt.timed.forEach(x => { const href = safeUrl(x.e.webLink), inner = `<b>${calTime(x.s)}</b> ${esc(x.e.subject || "(No title)")}`;
    out.push(href ? `<a class="ce meet" href="${esc(href)}" target="_blank" rel="noopener">${inner}</a>` : `<div class="ce meet">${inner}</div>`); });
  const tk = tasksOn(d).filter(whoMatch), nDone = tk.filter(x => x.done).length;
  tk.filter(x => !x.done).forEach(x => { const p = personOf(x.who); out.push(`<div class="ce todo ${d < t ? "late" : ""}" data-act="edittask" data-id="${x.id}" data-drag="task" data-drag-id="${x.id}" data-drag-from="${d}" ${p ? `style="--pc:${pColor(p)}"` : ""}>${ck(false, "task", x.id, x.title)}<span class="tapedit" data-act="edittask" data-id="${x.id}">${x.cat === "freezer" ? ci("fz") : ""}${esc(x.title)}</span></div>`); });
  if (nDone && !compact) out.push(`<button class="ce donecount" data-act="calday" data-id="${d}">${CHECK}${nDone} done</button>`);
  return out;
}

function vCal(){
  const t = todayISO();
  const legend = `<div class="cal-legend"><span class="lg meet">Meetings</span><span class="lg dinner">Dinner</span><span class="lg plan">Plans</span><span class="lg host">Hosting</span><span class="lg todo">To-dos</span><span class="lg hol">Holidays</span><span class="lg-hint">Press and hold a to-do, plan or dinner to drag it to another day</span></div>`;
  const modes = `<div class="seg" role="tablist" aria-label="View"><button aria-pressed="${U.calMode==="week"}" data-act="calmode" data-id="week">Week</button><button aria-pressed="${U.calMode==="month"}" data-act="calmode" data-id="month">Month</button></div>`;
  let range, grid;
  if (U.calMode === "month") {
    const base = pd(t); base.setDate(1); base.setMonth(base.getMonth() + U.calOff); const first = iso(base), gStart = weekStart(first);
    const mEnd = (() => { const e = new Date(base); e.setMonth(e.getMonth()+1); e.setDate(0); return iso(e); })();
    const weeks = Math.ceil((daysTo(mEnd) - daysTo(gStart) + 1) / 7);
    range = fmt(first, {month:"long", year:"numeric"});
    const cells = []; for (let i = 0; i < weeks*7; i++) { const d = addDays(gStart, i), items = dayItems(d, true), out = d.slice(0,7) !== first.slice(0,7);
      cells.push(`<div class="mcell ${d===t?"today":""} ${out?"out":""} ${U.calSel===d?"sel":""}" data-act="calday" data-id="${d}" data-day="${d}" role="button" tabindex="0"><div class="mtop"><div class="mnum">${pd(d).getDate()}</div><button class="madd" data-act="caladd" data-id="${d}" aria-label="Add to ${fmt(d,{month:"long",day:"numeric"})}">${svg("plus")}</button></div><div class="mitems">${items.slice(0,3).join("")}${items.length > 3 ? `<div class="more">+${items.length - 3} more</div>` : ""}</div></div>`); }
    grid = `<div class="month"><div class="mhead">${["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(x => `<div>${x}</div>`).join("")}</div><div class="mgrid">${cells.join("")}</div></div>`;
  } else {
    const start = addDays(weekStart(t), U.calOff*7), days = [0,1,2,3,4,5,6].map(i => addDays(start, i));
    calWeekWatch(start);
    range = `${fmt(start,{month:"long",day:"numeric"})} – ${fmt(days[6],{month: pd(start).getMonth()===pd(days[6]).getMonth() ? undefined : "long", day:"numeric"})}`;
    grid = `<div class="wgrid">${days.map(d => { const items = dayItems(d, false), w = wxOn(d), n = daysTo(d);
      return `<div class="wcol ${d===t?"today":""} ${n<0?"past":""} ${U.calSel===d?"sel":""}" data-day="${d}"><button class="wadd" data-act="caladd" data-id="${d}" aria-label="Add to ${fmt(d,{weekday:"long",month:"long",day:"numeric"})}">${svg("plus")}</button><button class="whead" data-act="calday" data-id="${d}" aria-label="${fmt(d,{weekday:"long",month:"long",day:"numeric"})}"><span class="wd">${fmt(d,{weekday:"short"})}</span><span class="wn">${pd(d).getDate()}</span>${w ? `<span class="ww">${wxSvg(w.day.icon)}${w.day.temperature}°<i>${w.night.temperature}°</i></span>` : ""}</button>
        <div class="witems">${items.join("") || `<button class="wempty" data-act="caladd" data-id="${d}">Free</button>`}</div></div>`; }).join("")}</div>`;
  }
  const head = `<div class="ph"><div><h1>Calendar</h1><div class="sub">Meetings, dinners, plans and hosting in one place</div></div>${modes}</div>
    <div class="weeknav cal-nav"><span class="range">${range}</span><button class="rbtn" data-act="caloff" data-id="-1" aria-label="Previous">${svg("prev")}</button>${U.calOff ? `<button class="btn sm ghost" data-act="caloff" data-id="0">Today</button>` : ""}<button class="rbtn" data-act="caloff" data-id="1" aria-label="Next">${svg("next")}</button></div>${legend}${whoChips()}`;
  return head + grid + calDayPanel(U.calSel || t);
}

function calDayPanel(d){
  const t = todayISO(), m = S.dinners[d] || {}, mt = meetingsOn(d), pl = plansOn(d), evs = evsOn(d), tk = tasksOn(d).filter(whoMatch), w = wxOn(d);
  const now = new Date(), nowMin = d === t ? now.getHours()*60 + now.getMinutes() : null;
  const sec = (label, cls, body) => `<div class="dsec ${cls}"><p class="eyebrow">${label}</p>${body}</div>`;
  const hostWk = (evs[0] && wkKey(evs[0])) || ((S.events.filter(e => e.date >= d).sort(byDate)[0]) || {}).weekend;
  const parts = [
    sec("Dinner", "dinner", m.title ? `<div class="drow"><b>${esc(m.title)}</b>${m.note ? `<span>${esc(m.note)}</span>` : ""}<div class="inline">${recipeObj(m) ? `<button class="btn sm ghost" data-act="dayrecipe" data-id="${d}">Recipe</button>` : ""}<button class="btn sm quiet" data-act="editdinner" data-id="${d}">Change</button></div></div>` : `<div class="drow none">Nothing planned <button class="btn sm ghost" data-act="editdinner" data-id="${d}">Plan dinner</button></div>`),
    evs.length || pl.length ? sec("Plans &amp; events", "plan", `<div class="list">${evs.map(e => `<button class="drow link" data-act="gohost" data-id="${esc(wkKey(e))}"><b>${esc(e.name)}</b><span>${esc(e.time || "")}</span></button>`).join("")}${pl.map(p => planRow(p)).join("")}</div>`) : "",
    mt && (mt.timed.length || mt.allDay.length) ? sec("Meetings", "meet", `${mt.allDay.length ? `<div class="cal-all">${mt.allDay.map(e => `<span class="pill">${esc(e.subject || "All day")}</span>`).join("")}</div>` : ""}<div class="cal-list">${calRows(mt.timed, nowMin)}</div>`) : "",
    tk.length ? sec("Hosting to-dos", "todo", `<div class="list">${tk.map(x => `<div class="row ${x.done?"done":""}">${ck(x.done,"task",x.id,x.title)}<div class="main tapedit" data-act="edittask" data-id="${x.id}"><div class="t">${esc(x.title)}</div>${x.detail ? `<div class="s">${esc(x.detail)}</div>` : ""}${x.cat === "freezer" ? `<span class="pill cat-freezer">Freezer</span>` : ""}${x.recipe && R[x.recipe] ? `<button class="pill link" data-act="recipe" data-id="${x.recipe}">Recipe</button>` : ""}</div>${x.time ? `<span class="time">${esc(x.time)}</span>` : ""}${whoBtn("tasks", x.id, x.who)}</div>`).join("")}</div>`) : ""
  ].filter(Boolean).join("");
  const kinds = [["plan","Plan"],["dinner","Dinner"], ...(hostWk ? [["task","Hosting to-do"]] : [])];
  const kind = kinds.some(k => k[0] === U.calKind) ? U.calKind : "plan";
  return `<div class="card dpanel" id="dpanel"><div class="dhead"><div><p class="eyebrow">${d === t ? "Today" : dayTag(d) === "Overdue" ? "Past" : dayTag(d)}${holidayOn(d) ? ` · <span class="hol-t">${esc(holidayOn(d))}</span>` : ""}</p><h2>${fmt(d,{weekday:"long",month:"long",day:"numeric"})}</h2></div><button class="btn sm" data-act="caladd" data-id="${d}">${svg("plus")} Add</button>${w ? `<div class="dwx">${wxSvg(w.day.icon)}<span><b>${w.day.temperature}°</b> / ${w.night.temperature}°<br>${esc(w.day.phrase || "")}</span></div>` : ""}</div>
    <div class="dgrid">${parts}</div>
    <form class="add cal-add" data-form="calnew" data-date="${d}" data-wk="${esc(hostWk || "")}"><div class="seg sm" role="tablist" aria-label="Add a">${kinds.map(([k,l]) => `<button type="button" aria-pressed="${kind===k}" data-act="calkind" data-id="${k}">${l}</button>`).join("")}</div><input type="text" id="cnt" placeholder="${kind === "dinner" ? "What's for dinner?" : kind === "task" ? "A hosting to-do for this day" : "A plan for this day"}" aria-label="Add to this day" autocomplete="off"><input type="text" id="cntt" placeholder="Time (optional)" style="flex:0 1 140px" ${kind === "dinner" ? "hidden" : ""}><button class="btn">Add</button></form></div>`;
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
    html += `<div class="row ${x.done?"done":""} ${od?"overdue":""}">${ck(x.done,"task",x.id,x.title)}<div class="main tapedit" data-act="edittask" data-id="${x.id}"><div class="t">${esc(x.title)}</div>${x.detail?`<div class="s">${esc(x.detail)}</div>`:""}${od?`<span class="pill od">Overdue</span>`:""}<span class="pill cat-${x.cat||"food"}">${catLab[x.cat||"food"]}</span>${multi&&e?`<span class="pill">${esc(e.short||e.name)}</span>`:""}${x.recipe&&R[x.recipe]?`<button class="pill link" data-act="recipe" data-id="${x.recipe}">${esc(R[x.recipe].title)}</button>`:""}</div>${x.time?`<span class="time">${esc(x.time)}</span>`:""}${whoBtn("tasks", x.id, x.who)}${del("tasks",x.id)}</div>`;
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
  return `${mealsHead(`${all.length} family recipes`)}
    <div class="cb-tools"><input type="search" id="cb-q" value="${esc(U.q)}" placeholder="Search recipes or ingredients" aria-label="Search recipes"></div>
    <div class="chips">${["All",...RCATS].map(c => `<button class="chip" aria-pressed="${U.rcat===c}" data-act="rcat" data-id="${c}">${c}</button>`).join("")}</div>
    ${hits.length ? `<div class="rgrid">${hits.map(card).join("")}</div>` : `<div class="empty"><b>No recipes match</b>Try a shorter word.</div>`}`;
}

function showRecipe(ref){
  const r = recipeFromRef(ref); if (!r) return; const src = r.src || ref, date = /^dinner:/.test(src) ? src.slice(7) : "", cookable = (r.steps||[]).length > 0;
  const body = cookable || (r.ingredients||[]).length ? `<div class="cols"><div><p class="eyebrow">Ingredients</p><ul class="ing">${r.ingredients.map(i => i.startsWith("## ") ? `<li class="sub">${esc(i.slice(3))}</li>` : `<li>${esc(i)}</li>`).join("")}</ul>${r.ingredients.length ? `<div class="inline"><button class="btn sm ghost" data-act="togrocery" data-id="${esc(src)}">Add ingredients to Grocery</button></div>` : ""}</div>
    <div><p class="eyebrow">Method</p><ol>${r.steps.map(s => `<li>${esc(s)}</li>`).join("")}</ol></div></div>`
    : `<div class="empty" style="padding:10px 0 4px"><b>The full recipe lives on ${esc(linkLabel(r.link))}</b>Tap Open recipe to read it there. The Sunday import brings ingredients and steps into the app for new recipes, and a note to me pulls in this one.</div>`;
  const ideaId = /^item:/.test(src) ? src.slice(5) : "", idea = ideaId ? S.items.find(i => i.id === ideaId) : null;
  const nights = idea ? `<div class="nightpick"><p class="eyebrow">Put it on a night</p><div class="daypick">${[0,1,2,3,4,5,6].map(n => { const d = addDays(todayISO(), n), m = S.dinners[d]; return `<button class="chip" data-act="pickday" data-id="${d}" data-idea="${esc(idea.text)}" title="${m && m.title ? esc("Replaces " + m.title) : ""}">${n===0?"Tonight":n===1?"Tomorrow":fmt(d,{weekday:"short"})}${m && m.title ? `<span>· ${esc(m.title.length > 14 ? m.title.slice(0,13) + "…" : m.title)}</span>` : ""}</button>`; }).join("")}</div></div>` : "";
  if (idea) U.pickIdea = idea.id;
  $("#overlay").innerHTML = `<div class="sheet" data-act="closebg"><div class="panel" role="dialog" aria-modal="true" aria-label="${esc(r.title)}"><div class="top-actions">${cookable ? `<button class="btn sm" data-act="cook" data-id="${esc(src)}">Cook</button>` : ""}<button class="close" data-act="close" aria-label="Close">${svg("close")}</button></div><h3>${esc(r.title)}</h3>
    ${r.note?`<p class="note" style="font-style:italic;font-size:15px">${esc(r.note)}</p>`:""}${r.meta.length ? `<div class="meta">${r.meta.map(m => { const [a,...b] = m.split(": "); return `<span><b>${esc(a)}</b>${esc(b.join(": "))}</span>`; }).join("")}</div>` : ""}
    ${safeUrl(r.link) || date ? `<div class="inline" style="margin:4px 0 12px">${safeUrl(r.link) ? `<a class="btn sm ${cookable ? "ghost" : ""}" href="${esc(safeUrl(r.link))}" target="_blank" rel="noopener">Open recipe on ${esc(linkLabel(r.link))} ↗</a>` : ""}${date ? `<button class="btn sm quiet" data-act="editdinner" data-id="${date}">Change this dinner</button>` : ""}</div>` : ""}
    ${nights}${body}</div></div>`;
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
  const tasks = S.tasks.filter(x => !x.done).sort(byDate).slice(0,60).map(x => `- ${x.title} (${x.eventId}, ${x.date||"no date"}${personOf(x.who) ? ", " + personOf(x.who).name : ""})`).join("\n");
  const cookbook = Object.entries(R).map(([k,v]) => `${k}=${v.title}`).join("; ");
  const plans = S.plans.filter(p => (p.endDate || p.date) >= addDays(t,-1)).sort(byDate).slice(0,40).map(p => `- ${p.title} ${repeats(p) ? "every " + fmt(p.date,{weekday:"long"}) + " from " + p.date : "on " + p.date}${p.endDate && p.endDate !== p.date ? " to " + p.endDate : ""}${p.time ? " " + p.time : ""}`).join("\n");
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

HOUSEHOLD: ${people().map(p => p.name).join(", ") || "(no one added yet)"}

COOKBOOK keys=titles: ${cookbook}`;
}
const CAPTURE_RULES = `You sort spoken or typed notes for a household app (lists, weekly dinners, holiday hosting). Turn the note into actions. Reply with ONLY a JSON object: {"reply": string, "actions": [ ... ]}. "reply" is one short, warm sentence (under 20 words) saying what you did, written to the person who spoke.

Allowed action shapes:
{"type":"add_items","list":"Grocery","items":[{"text":"paper towels","note":"","time":"","tags":[]}]}
{"type":"check_items","list":"Costco","items":["paper towels"]}
{"type":"uncheck_items","list":"Costco","items":["paper towels"]}
{"type":"remove_items","list":"Costco","items":["paper towels"]}
{"type":"create_list","name":"Target"}
{"type":"set_dinner","date":"YYYY-MM-DD","title":"Tacos","recipe":"","note":"","time":""}
{"type":"add_plan","title":"New York for the day","date":"YYYY-MM-DD","endDate":"","time":"","note":"","repeat":""}
{"type":"remove_plan","match":"<words from the plan title>"}
{"type":"clear_dinner","date":"YYYY-MM-DD"}
{"type":"add_task","event":"<event id>","title":"...","date":"YYYY-MM-DD","time":"","cat":"food","detail":""}
{"type":"complete_task","match":"<words from the to-do title>"}
{"type":"reopen_task","match":"..."}
{"type":"move_task","match":"<words from the to-do title>","date":"YYYY-MM-DD","time":""}
{"type":"assign_task","match":"<words from the to-do or list item>","person":"<a household name, or empty to unassign>"}
{"type":"add_dish","event":"<event id>","name":"...","course":"Sides","who":"","recipe":"","makeAhead":""}
{"type":"dish_ready","match":"<words from the dish name>","ready":true}
{"type":"add_guest","event":"<event id>","name":"...","diet":""}
{"type":"rsvp","event":"<event id or empty>","name":"Nick","status":"yes"}
{"type":"add_extra","event":"<event id>","item":"...","detail":""}
{"type":"set_event_time","event":"<event id>","field":"dinnerAt","value":"HH:MM"}

Rules:
- Lists: Grocery is for food and supermarket items, Costco for bulk or anything said with "Costco", To-do for errands and general tasks, Meal ideas for dinner ideas ("idea: ..."). Use an existing list name exactly as given. Create a new list only when the note clearly names a list that doesn't exist.
- "Tonight" is today. A weekday name means the next such day from today (today if it is that day); "next Sunday" after a weekday name means the one after this coming one only when the note says "next week". "What's for dinner" style notes are set_dinner. When the dinner matches a cookbook title, put its key in "recipe". A time estimate mentioned ("takes 30 minutes") goes in "time".
- Something that happens every week ("gymnastics every Sunday 9 to 10:30") is one add_plan with "repeat":"weekly" and the date of the first upcoming occurrence.
- Things happening on a date that are not to-dos (a trip, an appointment, a night out, a visitor, a game) are add_plan. A to-do is something to get done; a plan is somewhere to be.
- Dinner ideas without a date ("idea: lemon chicken", "I want to make tacos sometime") are add_items on Meal ideas; a duration that was said ("takes 30 minutes") goes in the item's "time", and descriptors like crockpot, sheet pan, kid friendly, date night go in "tags".
- cat is one of invites, reservations, rooms, house, food, freezer (freezer = take something out of the freezer to thaw). course is one of Breakfast, Appetizers, Dinner, Sides, Dessert, Drinks, Other. status is yes, no or maybe. For rsvp, leave event empty to update that guest on every event of their weekend.
- Hosting notes go to the event the note is about. If a holiday is named but not an event, use the main dinner event of that weekend. If a to-do has no date, use a sensible date before the event.
- "Move", "push", "do X on Saturday instead" for an existing to-do is move_task. "Brent is doing X", "give X to Sam", "X is Hailey's" is assign_task; a new to-do said with a person ("Brent, deodorize the carpets Tuesday") is add_task followed by assign_task. Only use names from HOUSEHOLD.
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
          if (await created("items", {listId:L.id, text, note: time0 === note0 ? "" : note0, time: time0, link:"", recipe: L.id === "ideas" ? recipeFor(text) : "", tags: Array.isArray(it && it.tags) ? it.tags.map(String).slice(0,6) : [], done:false, createdAt: base + n})) { have.add(norm(text)); n++; } }
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
        const weekly = a.repeat === "weekly"; if (await created("plans", {title, date:d, endDate: weekly ? "" : endDate, time:String(a.time||""), note:String(a.note||""), ...(weekly ? {repeat:"weekly"} : {}), createdAt:Date.now()})) done.push(weekly ? `Every ${fmt(d,{weekday:"long"})}: ${title}` : `${fmt(d,{weekday:"short",month:"short",day:"numeric"})}: ${title}`); }
      else if (a.type === "remove_plan") { const p = fuzzy(S.plans, a.match, "title"); if (!p) { skipped.push(`Couldn't find plan "${a.match}"`); continue; } if (await removed("plans", p)) done.push(`Removed ${p.title}`); }
      else if (a.type === "clear_dinner") { const d = String(a.date||""), cur = S.dinners[d]; if (cur) { await removed("dinners", {id:d, ...cur}); done.push(`Cleared ${fmt(d,{weekday:"short"})}`); } else skipped.push("Nothing planned that night"); }
      else if (a.type === "add_task") { const e = eventOf(a.event) || nextEvent(); if (!e) { skipped.push("No event for that to-do"); continue; } const title = String(a.title||"").trim(); if (!title) continue;
        const date = /^\d{4}-\d{2}-\d{2}$/.test(a.date||"") ? a.date : (daysTo(e.date) > 1 ? addDays(e.date,-1) : e.date);
        if (await created("tasks", {eventId:e.id, title, date, time:String(a.time||""), t:to24(a.time||""), cat:CATS.some(c => c[0]===a.cat) ? a.cat : "food", detail:String(a.detail||""), done:false})) done.push(`To-do: ${title}`); }
      else if (a.type === "move_task") { const x = fuzzy(S.tasks.filter(t => !t.done), a.match, "title") || fuzzy(S.tasks, a.match, "title"); if (!x || !/^\d{4}-\d{2}-\d{2}$/.test(a.date || "")) { skipped.push(`Couldn't move "${a.match}"`); continue; }
        const data = {date:a.date}; if (a.time) { data.time = String(a.time); data.t = to24(a.time); } if (await updated("tasks", x, data)) done.push(`Moved: ${x.title} to ${fmt(a.date,{weekday:"short",month:"short",day:"numeric"})}`); }
      else if (a.type === "assign_task") { const p = a.person ? people().find(q => norm(q.name) === norm(a.person)) || people().find(q => norm(q.name).startsWith(norm(a.person))) : null;
        if (a.person && !p) { skipped.push(`No one named ${a.person} in the household`); continue; }
        const x = fuzzy(S.tasks.filter(t => !t.done), a.match, "title") || fuzzy(S.items.filter(i => !i.done), a.match, "text"); if (!x) { skipped.push(`Couldn't find "${a.match}"`); continue; }
        const col = S.tasks.includes(x) ? "tasks" : "items"; if (await updated(col, x, {who: p ? p.id : ""})) done.push(p ? `${p.name}: ${x.title || x.text}` : `Unassigned: ${x.title || x.text}`); }
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
  { const lk = ev.target.closest("a[href]"); if (lk && b.contains(lk) && b !== lk) return; }
  if (a !== "del" && a !== "dellist" && a !== "edel") U.armed = null;
  switch (a) {
    case "view": U.view = id === "meals" ? (U.mtab || "dinners") : id; ls.set("hph_view", U.view); break;
    case "mtab": U.mtab = id; U.view = id; ls.set("hph_view", id); ls.set("hph_mtab", id); break;
    case "who": { const col = b.dataset.col, x = (col === "items" ? S.items : S.tasks).find(t => t.id === id); if (!x) return; const ids = ["", ...people().map(p => p.id)], nx = ids[(ids.indexOf(x.who || "") + 1) % ids.length]; w(col, id, {who: nx}); const p = personOf(nx); toast(p ? `${p.name} has it` : "Unassigned"); return; }
    case "whof": U.who = id; ls.set("hph_who", id); break;
    case "people": U.peopleOpen = true; renderPeople(); { const i = $("#npn2"); if (i && !people().length) i.focus(); } return;
    case "pcolor": w("people", id, {color: b.dataset.c}); return;
    case "edittask": U.armed = null; U.add = null; editTask(id); return;
    case "caladd": U.edit = null; U.add = null; addSheet(id, b.dataset.kind, b.dataset.ev === "auto"); return;
    case "addkind": if (U.add) { const sel = $("#da-ev"); if (sel) U.add.ev = sel.value; addSheet(U.add.d, id); } return;
    case "edititem": U.armed = null; editItem(id); return;
    case "editplan": U.armed = null; U.add = null; editPlan(id, b.dataset.day); return;
    case "pskip": if (U.edit && U.edit.col === "plans" && U.edit.day) { const p = S.plans.find(x => x.id === U.edit.id); if (p) await w("plans", p.id, {skip:[...(p.skip || []), U.edit.day]}); toast(`Skipped ${fmt(U.edit.day,{weekday:"long",month:"short",day:"numeric"})}`); U.edit = null; $("#overlay").innerHTML = ""; } break;
    case "epick": if (U.add && !U.edit) { U.add.who = id; b.parentNode.querySelectorAll(".chip").forEach(c => c.setAttribute("aria-pressed", String(c === b))); return; } if (U.edit) { U.edit.who = id; b.parentNode.querySelectorAll(".chip").forEach(c => c.setAttribute("aria-pressed", String(c === b))); } return;
    case "movetask": if (U.edit) { await w("tasks", U.edit.id, {date:id}); U.edit = null; $("#overlay").innerHTML = ""; toast(`Moved to ${daysTo(id)===0 ? "today" : daysTo(id)===1 ? "tomorrow" : fmt(id,{weekday:"long",month:"short",day:"numeric"})}`); } break;
    case "edel": if (!U.edit) return; if (U.armed === "edel") { U.armed = null; await w(U.edit.col, U.edit.id, null, "delete"); U.edit = null; $("#overlay").innerHTML = ""; toast("Deleted"); break; } U.armed = "edel"; b.textContent = "Tap again to delete"; b.classList.add("armed"); return;
    case "golist": U.view = "lists"; U.listId = id; ls.set("hph_view","lists"); ls.set("hph_list", id); break;
    case "gohost": U.view = "hosting"; U.wk = id; U.sub = "all"; ls.set("hph_view","hosting"); ls.set("hph_wk", id); break;
    case "list": U.listId = id; U.editList = false; U.pickIdea = null; ls.set("hph_list", id); break;
    case "editlist": U.editList = !U.editList; break;
    case "dellist": if (U.armed === "list"+id) { U.armed = null; U.editList = false; const its = listItems(id); await Promise.all(its.map(i => w("items", i.id, null, "delete"))); await w("lists", id, null, "delete"); toast("List deleted"); } else U.armed = "list"+id; break;
    case "item": { const x = S.items.find(i => i.id === id); if (x) w("items", id, {done:!x.done, doneAt: x.done ? null : Date.now()}); break; }
    case "clearchecked": { const its = listItems(id).filter(i => i.done); await Promise.all(its.map(i => w("items", i.id, null, "delete"))); toast(`Cleared ${its.length}`); break; }
    case "plan": U.pickIdea = id || null; break;
    case "pickday": { const title = b.dataset.idea || "", idea = S.items.find(i => i.id === U.pickIdea) || {}; if (title) { const cur = S.dinners[id] || {}; const rk = idea.recipe && R[idea.recipe] ? idea.recipe : recipeFor(title); await w("dinners", id, {...cur, title, recipe: rk, note: cur.note || "", time: idea.time || "", link: idea.link || "", ingredients: idea.ingredients || [], steps: idea.steps || [], servings: idea.servings || ""}, "set"); toast(`${title} on ${fmt(id,{weekday:"long"})}`); } U.pickIdea = null; $("#overlay").innerHTML = ""; break; }
    case "dayrecipe": showRecipe("dinner:" + id); return;
    case "idearecipe": { if (recipeFromRef("item:" + id)) { showRecipe("item:" + id); return; } U.pickIdea = U.pickIdea === id ? null : id; break; }
    case "editdinner": $("#overlay").innerHTML = ""; U.peopleOpen = false; U.view = "dinners"; U.mtab = "dinners"; ls.set("hph_view","dinners"); U.weekOff = Math.round((pd(weekStart(id)) - pd(weekStart(todayISO()))) / (7*864e5)); U.editDinner = id; U.pickIdea = null; break;
    case "canceldinner": U.editDinner = null; break;
    case "cleardinner": await w("dinners", id, null, "delete"); U.editDinner = null; break;
    case "week": U.weekOff = id === "0" ? 0 : U.weekOff + (+id); U.editDinner = null; U.pickIdea = null; break;
    case "wk": U.wk = id; U.sub = "all"; U.catF = "all"; ls.set("hph_wk", id); break;
    case "sub": U.sub = id; break;
    case "htab": U.htab = id; ls.set("hph_htab", id); break;
    case "cat": U.catF = id; break;
    case "hlf": U.hlF = id; break;
    case "calmode": U.calMode = id; U.calOff = 0; break;
    case "caloff": U.calOff = id === "0" ? 0 : U.calOff + (+id); if (id === "0") U.calSel = null; break;
    case "calday": U.calSel = id; if (U.calMode === "month") { U.calMode = "week"; U.calOff = Math.round((pd(weekStart(id)) - pd(weekStart(todayISO()))) / (7*864e5)); } render(); { const p = $("#dpanel"); if (p) p.scrollIntoView({behavior:"smooth", block:"start"}); } return;
    case "calkind": U.calKind = id; render(); { const i = $("#cnt"); if (i) i.focus(); } return;
    case "dayev": U.dayEv = id; break;
    case "task": { const x = S.tasks.find(t => t.id === id); if (x) w("tasks", id, {done:!x.done}); break; }
    case "dish": { const x = S.dishes.find(t => t.id === id); if (x) w("dishes", id, {ready:!x.ready}); break; }
    case "extra": { const x = S.extras.find(t => t.id === id); if (x) w("extras", id, {done:!x.done}); break; }
    case "chk": { const [eid,k] = id.split("|"); const c = S.checks[eid]; if (c) w("checks", eid, {[k]:!c[k]}); else w("checks", eid, {[k]:true}, "set"); break; }
    case "rsvp": { const x = S.guests.find(t => t.id === id); if (x) w("guests", id, {rsvp:{maybe:"yes",yes:"no",no:"maybe"}[x.rsvp||"maybe"]}); break; }
    case "ritem": { const [rid,item] = id.split("|"); const r = S.rooms.find(x => x.id === rid); if (r) w("rooms", rid, {items:{...(r.items||{}), [item]:!(r.items||{})[item]}}); break; }
    case "saveitem": { const g = $("#ig-"+id); w("items", id, {time:$("#it-"+id).value.trim(), link:$("#il-"+id).value.trim(), ...(g ? {tags: g.value.split(",").map(x => x.trim()).filter(Boolean)} : {})}); toast("Saved"); break; }
    case "itag": U.ideaTags = id ? (U.ideaTags.includes(id) ? U.ideaTags.filter(t => t !== id) : [...U.ideaTags, id]) : []; break;
    case "saveroom": w("rooms", id, {guests:$("#rg-"+id).value.trim(), nights:$("#rn-"+id).value.trim()}); toast("Saved"); break;
    case "toggle": U.open[id] = !U.open[id]; break;
    case "addcourse": U.addCourse = (id && U.addCourse !== id) ? id : null; render(); if (U.addCourse) { const q = $("#nq"); if (q) q.focus(); } return;
    case "savedish": w("dishes", id, {who:$("#who-"+id).value.trim(), makeAhead:$("#ma-"+id).value.trim()}); U.open[id] = false; break;
    case "swdel": w(b.dataset.col, id, null, "delete"); toast("Deleted"); break;
    case "del": { const k = b.dataset.col+id; if (U.armed === k) { U.armed = null; w(b.dataset.col, id, null, "delete"); } else U.armed = k; if (b.dataset.col === "people") { renderPeople(); return; } break; }
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
    case "close": case "closebg": U.peopleOpen = false; U.edit = null; U.add = null; $("#overlay").innerHTML = ""; return;
    default: return;
  }
  render();
});
document.addEventListener("keydown", e => { if ((e.key === "Enter" || e.key === " ") && e.target.matches && e.target.matches('[role="button"][data-act]')) { e.preventDefault(); e.target.click(); return; } if (e.key === "Escape") { if (COOK) stopCook(); else $("#overlay").innerHTML = ""; } });
document.addEventListener("input", e => { if (e.target.id === "cb-q") { U.q = e.target.value; render(); } });
document.addEventListener("change", e => { if (e.target.classList && e.target.classList.contains("pname")) { const n = e.target.value.trim(); if (n) w("people", e.target.dataset.id, {name:n}); return; } const i = e.target.closest("[data-set]"); if (!i || !i.value) return; w("events", i.dataset.ev, {[i.dataset.set]: i.dataset.set === "ovenCap" ? +i.value : i.value}); });
document.addEventListener("submit", async e => {
  e.preventDefault(); const f = e.target.dataset.form, v = s => ($(s) ? $(s).value : "").trim();
  if (e.target.id === "capform") { const t = v("#capin"); if (!t) return; $("#capin").value = ""; submitCapture(t); return; }
  if (f === "item" && v("#ni") && U.listId) { await add("items", {listId:U.listId, text:v("#ni"), note:"", time:v("#ni-time"), link:"", recipe:recipeFor(v("#ni")), done:false, createdAt:Date.now()}); e.target.reset(); const i = $("#ni"); if (i) i.focus(); return; }
  if (f === "plan" && v("#np")) { const d = v("#npd") || todayISO(), e2 = v("#npe"); await add("plans", {title:v("#np"), date:d, endDate: e2 && e2 > d ? e2 : "", time:v("#npt"), note:v("#npn"), createdAt:Date.now()}); toast("Added to Coming up"); }
  if (f === "listlink") { await w("lists", e.target.dataset.id, {link: v("#ll")}); toast("Link saved"); U.editList = false; }
  if (f === "list" && v("#nl")) { const name = v("#nl"); const id = await add("lists", {name, order:S.lists.length, createdAt:Date.now()}); if (id) { U.listId = id; ls.set("hph_list", id); } }
  if (f === "dinner") { const d = e.target.dataset.date, cur = S.dinners[d] || {}; const title = v("#dn-title"), recipe = v("#dn-recipe"); if (!title && !recipe) { await w("dinners", d, null, "delete"); } else await w("dinners", d, {...cur, title: title || R[recipe].title, recipe: recipe || recipeFor(title), note:v("#dn-note"), time:v("#dn-time"), link:v("#dn-link")}, "set"); U.editDinner = null; toast("Saved"); }
  if (f === "task" && v("#nt")) add("tasks", {eventId:v("#nte"), title:v("#nt"), date:v("#ntd") || evById(v("#nte")).date, time:v("#ntt"), t:to24(v("#ntt")), cat:v("#ntc") || "food", done:false});
  if (f === "dayadd" && v("#da-text") && U.add) { const d = e.target.dataset.date, text = v("#da-text"), tm = v("#da-time"), k = U.add.kind;
    if (k === "dinner") { const cur = S.dinners[d] || {}; await w("dinners", d, {...cur, title:text, recipe:recipeFor(text), note:cur.note || "", time:cur.time || "", link:cur.link || ""}, "set"); }
    else if (k === "plan") await add("plans", {title:text, date:d, endDate:"", time:tm, note:"", ...($("#da-weekly") && $("#da-weekly").checked ? {repeat:"weekly"} : {}), createdAt:Date.now()});
    else await add("tasks", {eventId:v("#da-ev"), title:text, date:d, time:tm, t:to24(tm), cat:v("#da-cat") || "house", detail:"", recipe:recipeFor(text), who:U.add.who || "", done:false});
    toast(`Added to ${daysTo(d)===0 ? "today" : daysTo(d)===1 ? "tomorrow" : fmt(d,{weekday:"long"})}`); U.add = null; $("#overlay").innerHTML = ""; render(); return; }
  if (f === "planedit" && v("#ep-title")) { const weekly = $("#ep-weekly").checked, d0 = v("#ep-date"), end = $("#ep-end") ? v("#ep-end") : "";
    await w("plans", e.target.dataset.id, {title:v("#ep-title"), date:d0, endDate: !weekly && end && end > d0 ? end : "", time:v("#ep-time"), note:v("#ep-note"), repeat: weekly ? "weekly" : ""}); U.edit = null; $("#overlay").innerHTML = ""; toast("Saved"); render(); return; }
  if (f === "taskedit" && v("#et-title")) { const tm = v("#et-time"), d = {title:v("#et-title"), detail:v("#et-detail"), date:v("#et-date"), time:tm, t:to24(tm), cat:v("#et-cat"), who:(U.edit && U.edit.who) || ""}; if ($("#et-ev")) d.eventId = v("#et-ev");
    await w("tasks", e.target.dataset.id, d); U.edit = null; $("#overlay").innerHTML = ""; toast("Saved"); render(); return; }
  if (f === "itemedit" && v("#ei-text")) { const L = v("#ei-list"), x = S.items.find(i => i.id === e.target.dataset.id), moved = x && x.listId !== L;
    await w("items", e.target.dataset.id, {text:v("#ei-text"), note:v("#ei-note"), listId:L, who:(U.edit && U.edit.who) || ""}); U.edit = null; $("#overlay").innerHTML = ""; toast(moved ? `Moved to ${(S.lists.find(l => l.id === L) || {}).name || "the list"}` : "Saved"); render(); return; }
  if (f === "person" && v("#npn2")) { const used = people().map(p => p.color), color = (PCOLORS.find(([k]) => !used.includes(k)) || PCOLORS[people().length % PCOLORS.length])[0];
    await add("people", {name:v("#npn2"), color, order:Date.now()}); e.target.reset(); renderPeople(); const i = $("#npn2"); if (i) i.focus(); return; }
  if (f === "calnew" && v("#cnt")) { const d = e.target.dataset.date, text = v("#cnt"), tm = v("#cntt"), kind = U.calKind;
    if (kind === "dinner") { const cur = S.dinners[d] || {}; await w("dinners", d, {...cur, title:text, recipe:recipeFor(text), note:cur.note || "", time:cur.time || "", link:cur.link || ""}, "set"); toast(`${text} on ${fmt(d,{weekday:"long"})}`); }
    else if (kind === "task" && e.target.dataset.wk) { const evs = S.events.filter(x => wkKey(x) === e.target.dataset.wk).sort(byDate), ev = evs.find(x => x.date >= d) || evs[evs.length-1];
      if (ev) { await add("tasks", {eventId:ev.id, title:text, date:d, time:tm, t:to24(tm), cat:"house", detail:"", recipe:recipeFor(text), done:false}); toast(`Added for ${fmt(d,{weekday:"long"})}`); } }
    else { await add("plans", {title:text, date:d, endDate:"", time:tm, note:"", createdAt:Date.now()}); toast(`Added to ${fmt(d,{weekday:"long"})}`); }
    e.target.reset(); render(); const q = $("#cnt"); if (q) q.focus(); return; }
  if (f === "htask" && v("#nht")) { const k = e.target.dataset.wk, evs = S.events.filter(x => wkKey(x) === k).sort(byDate), d = v("#nhtd") || todayISO();
    const ev = evs.find(x => x.date >= d) || evs[evs.length-1];
    if (ev) { await add("tasks", {eventId:ev.id, title:v("#nht"), date:d, time:"", t:"", cat:v("#nhtc") || "house", detail:"", recipe:recipeFor(v("#nht")), done:false}); toast(`Added for ${fmt(d,{weekday:"long"})}`); }
    $("#nht").value = ""; render(); const q = $("#nht"); if (q) q.focus(); return; }
  if (f === "guest" && v("#ng")) add("guests", {eventId:v("#nge"), name:v("#ng"), diet:v("#ngd"), rsvp:"maybe"});
  if (f === "extra" && v("#ne")) add("extras", {eventId:v("#nee"), item:v("#ne"), done:false});
  if (f === "room" && v("#nr")) add("rooms", {weekend:U.wk, name:v("#nr"), order:Date.now()%1e7, items:{}});
  if (f === "dish") { const r = v("#ndr"), n = v("#nd") || (R[r] && R[r].title); if (n) add("dishes", {eventId:v("#nde"), name:n, recipe:r, course:v("#ndc"), order:Date.now()%1e7, ready:false}); }
  if (f === "dishq") { const r = v("#nqr"), n = v("#nq") || (R[r] && R[r].title); if (n) { await add("dishes", {eventId:e.target.dataset.ev, name:n, recipe: r || recipeFor(n), course:e.target.dataset.course, order:Date.now()%1e7, ready:false}); toast("Added to " + e.target.dataset.course); }
    e.target.reset(); render(); const q = $("#nq"); if (q) q.focus(); return; }
  e.target.reset(); render();
});

/* Calendar drag: press and hold (touch) or click and drag (mouse) a to-do, plan or dinner, then drop it on another day.
   Touch waits 320ms without moving before it lifts, so ordinary scrolling is untouched. While dragging, the page scrolls near its edges. */
let DG = null, dgJust = 0;
const dgClear = () => document.querySelectorAll(".drop-over").forEach(e => e.classList.remove("drop-over"));
function dgStart(target, x, y, mouse){ if (U.view !== "cal" || !target.closest) return; const el = target.closest("[data-drag]"); if (!el || target.closest(".ck")) return;
  DG = {el, kind:el.dataset.drag, id:el.dataset.dragId, from:el.dataset.dragFrom, x0:x, y0:y, x, y, mouse, active:false};
  if (!mouse) DG.timer = setTimeout(() => dgActivate(), 320); }
function dgActivate(){ if (!DG || DG.active) return; const d = DG, r = d.el.getBoundingClientRect(); d.active = true;
  try { navigator.vibrate && navigator.vibrate(12); } catch (e) {}
  const g = d.el.cloneNode(true); g.classList.add("dg-ghost"); g.removeAttribute("data-act"); g.style.width = r.width + "px"; d.dx = d.x0 - r.left; d.dy = d.y0 - r.top; document.body.append(g); d.ghost = g;
  d.el.classList.add("dg-src"); document.body.classList.add("dragging"); dgPlace(); dgScroll(); }
function dgPlace(){ const d = DG; if (!d || !d.ghost) return; d.ghost.style.left = (d.x - d.dx) + "px"; d.ghost.style.top = (d.y - d.dy) + "px";
  d.ghost.style.visibility = "hidden"; const under = document.elementFromPoint(d.x, d.y); d.ghost.style.visibility = "";
  const col = under && under.closest && under.closest("[data-day]"); dgClear(); if (col && col.dataset.day !== d.from) col.classList.add("drop-over"); d.over = col ? col.dataset.day : null; }
function dgScroll(){ const d = DG; if (!d || !d.active) return; const sc = $("#main"), r = sc.getBoundingClientRect(), edge = 70;
  const v = d.y < r.top + edge ? -Math.ceil((r.top + edge - d.y) / 6) : d.y > r.bottom - edge ? Math.ceil((d.y - r.bottom + edge) / 6) : 0;
  if (v) { sc.scrollTop += v; dgPlace(); } requestAnimationFrame(dgScroll); }
function dgMove(x, y){ const d = DG; if (!d) return false; d.x = x; d.y = y;
  if (!d.active) { const far = Math.hypot(x - d.x0, y - d.y0); if (d.mouse && far > 6) dgActivate(); else if (!d.mouse && far > 8) { clearTimeout(d.timer); DG = null; } return !!(DG && DG.active); }
  dgPlace(); return true; }
async function dgEnd(){ const d = DG; if (!d) return; clearTimeout(d.timer); DG = null; if (!d.active) return;
  if (d.ghost) d.ghost.remove(); d.el.classList.remove("dg-src"); document.body.classList.remove("dragging"); dgClear(); dgJust = Date.now();
  if (!d.over || d.over === d.from) return;
  const to = d.over, shift = daysTo(to) - daysTo(d.from);
  if (d.kind === "task") await w("tasks", d.id, {date:to});
  else if (d.kind === "plan") { const p = S.plans.find(x => x.id === d.id); if (!p) return; await w("plans", d.id, {date:addDays(p.date, shift), endDate: p.endDate ? addDays(p.endDate, shift) : ""}); }
  else if (d.kind === "dinner") { const a = S.dinners[d.from], b = S.dinners[to]; if (!a) return; await w("dinners", to, a, "set"); if (b) await w("dinners", d.from, b, "set"); else await w("dinners", d.from, null, "delete"); if (b) { toast(`Swapped ${a.title} and ${b.title}`); render(); return; } }
  toast(`Moved to ${daysTo(to)===0 ? "today" : daysTo(to)===1 ? "tomorrow" : fmt(to,{weekday:"long",month:"short",day:"numeric"})}`); render(); }
document.addEventListener("touchstart", e => { if (e.touches.length !== 1) { if (DG) { clearTimeout(DG.timer); DG = null; } return; } const t = e.touches[0]; dgStart(e.target, t.clientX, t.clientY, false); }, {passive:true});
document.addEventListener("touchmove", e => { if (!DG) return; const t = e.touches[0]; if (dgMove(t.clientX, t.clientY) && e.cancelable) e.preventDefault(); }, {passive:false});
document.addEventListener("touchend", () => dgEnd(), {passive:true}); document.addEventListener("touchcancel", () => dgEnd(), {passive:true});
document.addEventListener("pointerdown", e => { if (e.pointerType === "touch" || e.button !== 0) return; dgStart(e.target, e.clientX, e.clientY, true); });
document.addEventListener("pointermove", e => { if (e.pointerType === "touch" || !DG) return; if (dgMove(e.clientX, e.clientY)) e.preventDefault(); });
document.addEventListener("pointerup", e => { if (e.pointerType !== "touch") dgEnd(); });
document.addEventListener("click", e => { if (Date.now() - dgJust < 450) { e.stopPropagation(); e.preventDefault(); } }, true);
document.addEventListener("contextmenu", e => { if (e.target.closest && e.target.closest("[data-drag]")) e.preventDefault(); });

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
  const cols = ["events","dishes","guests","tasks","extras","rooms","lists","items","plans","people"];
  const first = () => { if (++seen >= cols.length + 2) ready = true; render(); };
  cols.forEach(c => db.collection(c).onSnapshot(s => { S[c] = s.docs.map(d => ({id:d.id, ...d.data()})); first(); if (c === "people") renderPeople(); }, () => first()));
  db.collection("checks").onSnapshot(s => { S.checks = {}; s.docs.forEach(d => S.checks[d.id] = d.data()); first(); }, () => first());
  db.collection("dinners").onSnapshot(s => { S.dinners = {}; s.docs.forEach(d => S.dinners[d.id] = d.data()); first(); }, () => first());
  db.collection("shared").onSnapshot(s => { S.shared = {}; s.docs.forEach(d => S.shared[d.id] = d.data()); if (U.view === "today" || U.view === "cal") render(); }, () => {});
  db.collection("habits").onSnapshot(s => { S.habits = s.docs.map(d => ({id:d.id, ...d.data()})); render(); }, () => {});
  db.collection("habitlog").onSnapshot(s => { S.habitlog = {}; s.docs.forEach(d => S.habitlog[d.id] = d.data()); render(); }, () => {});
  setTimeout(() => { if (!ready) { ready = true; render(); } }, 8000);
})();
setInterval(() => { if (U.view === "today" || (U.view === "hosting" && U.htab === "day")) render(); }, 60000);
})();
