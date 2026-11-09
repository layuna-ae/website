/* Layuna Verwaltung – Vanilla JS, keine Abhängigkeiten. Speichert über die GitHub Contents/Git-Data API. */
(function () {
"use strict";
var REPO = "layuna-ae/website", API = "https://api.github.com", JSON_PATH = "content/site.json";
var TRASH_DAYS = 7;
var FILE_ORDER = ["1080.mp4", "1080.webm", "4k.mp4", "mobile.mp4", "poster.jpg", "poster-mobile.jpg"];
var LAYOUTS = [
  { id: "editorial", name: "Editorial zweisprachig", d: "Zwei Spalten EN / AR mit Haarlinie, Initiale – der bisherige Look." },
  { id: "vogue", name: "Vogue 3 Spalten", d: "Kicker, kursive Lede mit Initiale, Fließtext in drei Spalten I / II / III; arabische Lede darunter." },
  { id: "quote", name: "Großes Zitat + Mikrotext", d: "Lede als großes kursives Zitat (EN + AR), darunter winziger Fließtext in zwei Spalten." },
  { id: "none", name: "Nur Logo, kein Text", d: "Nur LAYUNA und arabisches Logo; auch die Unterzeile entfällt." }
];
var $ = function (s, r) { return (r || document).querySelector(s); };
var q = new URLSearchParams(location.search), MOCK = q.get("mock") === "1";

var S = { token: null, branch: "main", site: null, orig: "", sha: null, tab: "videos", editText: null, conflict: false, lastSaved: null, busy: false, pvMobile: false };

/* ---------- Hilfen ---------- */
function el(tag, props) {
  var e = document.createElement(tag);
  for (var k in (props || {})) {
    var v = props[k];
    if (v == null || v === false) continue;
    if (k === "class") e.className = v;
    else if (k === "text") e.textContent = v;
    else if (k.slice(0, 2) === "on") e.addEventListener(k.slice(2), v);
    else if (k === "style") e.style.cssText = v;
    else if (k === "value") e.value = v;
    else e.setAttribute(k, v === true ? "" : v);
  }
  for (var i = 2; i < arguments.length; i++) {
    var c = arguments[i]; if (c == null || c === false) continue;
    if (Array.isArray(c)) c.forEach(function (x) { if (x) e.appendChild(x); });
    else e.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return e;
}
function toast(msg, bad) {
  var t = el("div", { class: "toast" + (bad ? " bad" : ""), text: msg });
  $("#toasts").appendChild(t); setTimeout(function () { t.remove(); }, bad ? 9000 : 4500);
}
function fmtDate(s) { var d = new Date(s); return isNaN(d) ? "" : d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }); }
function mb(n) { return (n / 1048576).toFixed(n > 10485760 ? 0 : 1) + " MB"; }
function daysLeft(t) { return Math.max(0, Math.ceil(TRASH_DAYS - (Date.now() - Date.parse(t)) / 864e5)); }
function slug(s) { return s.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "text"; }
function b64enc(s) { var b = new TextEncoder().encode(s), r = ""; for (var i = 0; i < b.length; i += 8192) r += String.fromCharCode.apply(null, b.subarray(i, i + 8192)); return btoa(r); }
function b64dec(s) { var r = atob(s.replace(/\s/g, "")), b = new Uint8Array(r.length); for (var i = 0; i < r.length; i++) b[i] = r.charCodeAt(i); return new TextDecoder().decode(b); }
function serialize() { return JSON.stringify(S.site, null, 2) + "\n"; }
function isDirty() { return !!S.site && serialize() !== S.orig; }
function asset(id, f) { return "../media/videos/" + id + "/" + f; }

/* ---------- GitHub API ---------- */
function gh(path, opts) {
  opts = opts || {};
  var h = { Accept: "application/vnd.github+json", Authorization: "Bearer " + S.token, "X-GitHub-Api-Version": "2022-11-28" };
  if (opts.body) h["Content-Type"] = "application/json";
  return fetch(API + path, { method: opts.method || "GET", headers: h, body: opts.body ? JSON.stringify(opts.body) : undefined, cache: "no-store" })
    .then(function (r) {
      return r.text().then(function (t) {
        var j = null; try { j = t ? JSON.parse(t) : null; } catch (e) {}
        if (!r.ok) { var err = new Error((j && j.message) || ("HTTP " + r.status)); err.status = r.status; throw err; }
        return j;
      });
    });
}
function explain(e) {
  if (e.status === 401) return "Token ungültig oder abgelaufen. Bitte neu anmelden.";
  if (e.status === 403 || e.status === 404) return "Kein Zugriff: Das Token braucht Zugriff auf layuna-ae/website mit „Contents: Read and write“. (" + e.message + ")";
  if (e instanceof TypeError) return "Keine Verbindung zu GitHub.";
  return e.message;
}
function loadRemote() {
  if (MOCK) return fetch("../content/site.json", { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (j) { return { json: j, text: JSON.stringify(j, null, 2) + "\n", sha: "mock" }; });
  return gh("/repos/" + REPO + "/contents/" + JSON_PATH + "?ref=" + encodeURIComponent(S.branch) + "&_=" + Date.now()).then(function (f) {
    var text = b64dec(f.content); return { json: JSON.parse(text), text: text, sha: f.sha };
  });
}
function adopt(r) {
  S.site = r.json; S.sha = r.sha;
  S.site.settings = S.site.settings || {}; S.site.videos = S.site.videos || []; S.site.texts = S.site.texts || [];
  S.orig = serialize(); S.conflict = false;
}
function purgeOld() { /* Auto-Löschung macht die GitHub Action; hier nur Anzeige */ }

function save(force) {
  if (S.busy) return Promise.resolve(); S.busy = true; refreshBar();
  var body = serialize();
  if (MOCK) { S.busy = false; toast("Testmodus: nichts gespeichert."); refreshBar(); return Promise.resolve(); }
  return gh("/repos/" + REPO + "/contents/" + JSON_PATH, { method: "PUT", body: { message: "Admin: Inhalte aktualisiert", content: b64enc(body), sha: force ? undefined : S.sha, branch: S.branch } })
    .then(function (r) {
      if (force) { /* sha neu holen */ }
      S.sha = r.content.sha; S.orig = body; S.conflict = false; S.lastSaved = new Date();
      toast("Gespeichert. Auf layuna.ae sichtbar nach ca. 1–2 Minuten.");
    }).catch(function (e) {
      if (e.status === 409 || (e.status === 422 && /sha/i.test(e.message))) { S.conflict = true; toast("Konflikt: Die Datei wurde zwischenzeitlich geändert.", true); render(); }
      else toast("Speichern fehlgeschlagen: " + explain(e), true);
    }).then(function () { S.busy = false; refreshBar(); });
}
function overwrite() {
  return gh("/repos/" + REPO + "/contents/" + JSON_PATH + "?ref=" + S.branch).then(function (f) { S.sha = f.sha; return save(false); })
    .catch(function (e) { toast(explain(e), true); });
}
function reloadRemote() {
  return loadRemote().then(function (r) { adopt(r); render(); refreshBar(); toast("Neueste Version geladen."); }).catch(function (e) { toast(explain(e), true); });
}
/* Dateien endgültig löschen + site.json in EINEM Commit (Git Data API) */
function purgeNow(ids, msg) {
  if (MOCK) { S.orig = serialize(); toast("Testmodus: lokal entfernt, nichts gelöscht."); return Promise.resolve(); }
  var base = "/repos/" + REPO, body = serialize(), headSha, treeSha;
  return gh(base + "/contents/" + JSON_PATH + "?ref=" + S.branch).then(function (f) {
    if (f.sha !== S.sha) { var e = new Error("conflict"); e.status = 409; throw e; }
    return gh(base + "/git/ref/heads/" + S.branch);
  }).then(function (ref) { headSha = ref.object.sha; return gh(base + "/git/commits/" + headSha); })
    .then(function (c) { treeSha = c.tree.sha; return gh(base + "/git/trees/" + treeSha + "?recursive=1"); })
    .then(function (t) {
      var del = t.tree.filter(function (x) { return x.type === "blob" && ids.some(function (id) { return x.path.indexOf("media/videos/" + id + "/") === 0; }); })
        .map(function (x) { return { path: x.path, mode: x.mode, type: "blob", sha: null }; });
      return gh(base + "/git/blobs", { method: "POST", body: { content: body, encoding: "utf-8" } }).then(function (b) {
        del.push({ path: JSON_PATH, mode: "100644", type: "blob", sha: b.sha });
        return gh(base + "/git/trees", { method: "POST", body: { base_tree: treeSha, tree: del } });
      });
    })
    .then(function (nt) { return gh(base + "/git/commits", { method: "POST", body: { message: msg, tree: nt.sha, parents: [headSha] } }); })
    .then(function (nc) { return gh(base + "/git/refs/heads/" + S.branch, { method: "PATCH", body: { sha: nc.sha } }); })
    .then(function () { return gh(base + "/contents/" + JSON_PATH + "?ref=" + S.branch); })
    .then(function (f) { S.sha = f.sha; S.orig = body; toast("Endgültig gelöscht und gespeichert."); });
}

/* ---------- Login ---------- */
function store() { try { return localStorage.getItem("layuna.admin.token") ? localStorage : sessionStorage; } catch (e) { return null; } }
function getToken() { try { return localStorage.getItem("layuna.admin.token") || sessionStorage.getItem("layuna.admin.token"); } catch (e) { return null; } }
function setToken(t, remember) { try { localStorage.removeItem("layuna.admin.token"); sessionStorage.removeItem("layuna.admin.token"); (remember ? localStorage : sessionStorage).setItem("layuna.admin.token", t); } catch (e) {} }
function clearToken() { try { localStorage.removeItem("layuna.admin.token"); sessionStorage.removeItem("layuna.admin.token"); } catch (e) {} }
function verify(tok) {
  S.token = tok;
  return gh("/repos/" + REPO).then(function (r) {
    if (!r.permissions || !r.permissions.push) { var e = new Error("Das Token hat keine Schreibrechte auf " + REPO + ". Bitte „Contents: Read and write“ vergeben."); e.status = 0; throw e; }
    S.branch = r.default_branch || "main"; return r;
  });
}
function showLogin(msg) {
  $("#app").hidden = true; $("#login").hidden = false;
  var e = $("#loginErr"); e.hidden = !msg; e.textContent = msg || "";
}
function enter() {
  $("#login").hidden = true; $("#app").hidden = false; $("#mockBanner").hidden = !MOCK;
  $("#whoText").textContent = MOCK ? "Testmodus" : REPO;
  return loadRemote().then(function (r) { adopt(r); S.tab = location.hash.slice(1) || "videos"; S.editText = q.get("edit"); if (!/^(videos|texts|layout|trash)$/.test(S.tab)) S.tab = "videos"; render(); refreshBar(); })
    .catch(function (e) { toast("Laden fehlgeschlagen: " + explain(e), true); if (e.status === 401) { clearToken(); showLogin(explain(e)); } });
}
$("#loginForm").addEventListener("submit", function (ev) {
  ev.preventDefault();
  var tok = $("#tok").value.trim(), b = $("#loginBtn"); if (!tok) return;
  b.disabled = true; b.textContent = "Prüfe …";
  verify(tok).then(function () { setToken(tok, $("#remember").checked); $("#tok").value = ""; return enter(); })
    .catch(function (e) { showLogin(explain(e)); })
    .then(function () { b.disabled = false; b.textContent = "Prüfen & anmelden"; });
});
$("#logout").addEventListener("click", function () {
  if (isDirty() && !confirm("Es gibt ungespeicherte Änderungen. Trotzdem abmelden?")) return;
  clearToken(); S.token = null; S.site = null; if (MOCK) location.reload(); else showLogin();
});

/* ---------- Dialog ---------- */
function dialog(content) { var d = $("#dlg"), b = $("#dlgBody"); b.innerHTML = ""; b.appendChild(content); d.onclose = function () { b.innerHTML = ""; }; d.showModal(); }
function closeDialog() { $("#dlg").close(); }
function confirmDlg(title, text, okLabel, danger) {
  return new Promise(function (res) {
    var done = function (v) { $("#dlg").onclose = function () { $("#dlgBody").innerHTML = ""; }; closeDialog(); res(v); };
    var c = el("div", null, el("h3", { text: title }), el("p", { text: text }),
      el("div", { class: "row" }, el("button", { class: "btn ghost", type: "button", text: "Abbrechen", onclick: function () { done(false); } }),
        el("button", { class: "btn " + (danger ? "danger" : "primary"), type: "button", text: okLabel, onclick: function () { done(true); } })));
    dialog(c); $("#dlg").onclose = function () { res(false); };
  });
}

/* ---------- Vorschau (iframe) ---------- */
var previews = [];
function mountPreview(box, getData, mobile) {
  var W = mobile ? 390 : 1440, H = mobile ? 844 : 900;
  var f = el("iframe", { src: "../index.html?preview=1", width: W, height: H, title: "Vorschau", loading: "lazy", tabindex: "-1" });
  box.appendChild(f);
  var rec = { box: box, f: f, getData: getData, W: W };
  function scale() { var s = box.clientWidth / W; f.style.transform = "scale(" + s + ")"; }
  function send() { try { var d = getData(); d.type = "layuna-preview"; f.contentWindow.postMessage(d, location.origin); } catch (e) {} }
  rec.send = send; rec.scale = scale;
  f.addEventListener("load", function () { scale(); setTimeout(send, 30); });
  scale(); previews.push(rec); return rec;
}
window.addEventListener("resize", function () { previews.forEach(function (p) { if (p.box.isConnected) p.scale(); }); });
function activeText() { var a = S.site.texts.filter(function (t) { return t.enabled && !t.trashedAt; }); return a[0] || S.site.texts.filter(function (t) { return !t.trashedAt; })[0] || { en: {}, ar: {} }; }

/* ---------- Rendering ---------- */
function visible(a) { return a.filter(function (x) { return !x.trashedAt; }); }
function touch() { refreshBar(); }
function refreshBar() {
  var d = !!S.site && isDirty(), bar = $("#savebar");
  bar.classList.toggle("dirty", d);
  $("#save").disabled = !d || S.busy; $("#save").textContent = S.busy ? "Speichere …" : "Speichern";
  $("#discard").hidden = !d;
  var st = $("#saveState");
  if (!S.site) st.textContent = "";
  else if (d) st.textContent = "Ungespeicherte Änderungen – erst nach „Speichern“ live (dann 1–2 Minuten Wartezeit bei GitHub Pages).";
  else st.textContent = S.lastSaved ? "Gespeichert um " + S.lastSaved.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) + " – sichtbar auf layuna.ae nach ca. 1–2 Minuten." : "Alles gespeichert.";
  var n = S.site ? S.site.videos.concat(S.site.texts).filter(function (x) { return x.trashedAt; }).length : 0;
  $("#trashCount").textContent = n ? n : "";
}
window.addEventListener("beforeunload", function (e) { if (S.site && isDirty()) { e.preventDefault(); e.returnValue = ""; } });
$("#save").addEventListener("click", function () { save(false); });
$("#discard").addEventListener("click", function () {
  confirmDlg("Änderungen verwerfen?", "Alle nicht gespeicherten Änderungen gehen verloren.", "Verwerfen", true).then(function (ok) { if (!ok) return; S.site = JSON.parse(S.orig); render(); refreshBar(); });
});
$("#tabs").addEventListener("click", function (e) { var b = e.target.closest("button[data-tab]"); if (!b) return; S.tab = b.dataset.tab; location.hash = S.tab; render(); });

function render() {
  if (!S.site) return;
  previews = [];
  Array.prototype.forEach.call($("#tabs").children, function (b) { b.setAttribute("aria-selected", b.dataset.tab === S.tab ? "true" : "false"); });
  var v = $("#view"); v.innerHTML = "";
  if (S.conflict) {
    v.appendChild(el("div", { class: "conflict" }, el("b", { text: "Konflikt. " }), "Die Datei auf GitHub wurde seit dem Laden geändert (z. B. durch die automatische Papierkorb-Leerung oder ein neues Video).",
      el("div", { class: "row" },
        el("button", { class: "btn sm", type: "button", text: "Neueste Version laden (meine Änderungen verwerfen)", onclick: reloadRemote }),
        el("button", { class: "btn sm danger", type: "button", text: "Meine Version trotzdem speichern", onclick: overwrite }))));
  }
  ({ videos: renderVideos, texts: renderTexts, layout: renderLayout, trash: renderTrash })[S.tab](v);
  refreshBar();
}

function head(title, desc, extra) { return el("div", { class: "head" }, el("div", null, el("h2", { text: title }), desc ? el("p", { text: desc }) : null), extra); }
function modeSelect(key, label) {
  var s = el("select", { onchange: function () { S.site.settings[key] = s.value; touch(); } },
    [["sequence", "der Reihe nach (pro Besucher rotierend)"], ["random", "zufällig"], ["first", "immer das erste"]].map(function (o) { return el("option", { value: o[0], text: o[1] }); }));
  s.value = S.site.settings[key] || "first";
  return el("div", { class: "field", style: "margin:0;min-width:16rem" }, el("label", { text: label }), s);
}

/* --- Videos --- */
function renderVideos(v) {
  var vids = visible(S.site.videos), active = vids.filter(function (x) { return x.enabled; }).length;
  v.appendChild(head("Videos", "Hintergrundvideos der Startseite. Reihenfolge per Ziehen oder Pfeilen; nur aktive Videos laufen in der Rotation. (" + active + " von " + vids.length + " aktiv)", modeSelect("videoMode", "Modus")));
  var list = el("div", { class: "list" });
  if (!vids.length) list.appendChild(el("div", { class: "empty", text: "Keine Videos. Neue Videos legt Claude per Skript an." }));
  var dragId = null;
  vids.forEach(function (vid, i) {
    var f = vid.files || {}, total = 0; FILE_ORDER.forEach(function (n) { total += f[n] || 0; });
    var card = el("div", { class: "vcard" + (vid.enabled ? "" : " off"), draggable: "true" });
    card.addEventListener("dragstart", function (e) { dragId = vid.id; card.classList.add("drag"); e.dataTransfer.effectAllowed = "move"; try { e.dataTransfer.setData("text/plain", vid.id); } catch (x) {} });
    card.addEventListener("dragend", function () { dragId = null; card.classList.remove("drag"); });
    card.addEventListener("dragover", function (e) { if (dragId && dragId !== vid.id) { e.preventDefault(); card.classList.add("over"); } });
    card.addEventListener("dragleave", function () { card.classList.remove("over"); });
    card.addEventListener("drop", function (e) { e.preventDefault(); card.classList.remove("over"); if (dragId && dragId !== vid.id) { moveBefore(dragId, vid.id); } });
    var th = el("button", { class: "thumb", type: "button", "aria-label": "Video ansehen", style: "background-image:url('" + asset(vid.id, "poster.jpg") + "')", onclick: function () { playVideo(vid); } });
    var name = el("input", { class: "name", type: "text", value: vid.name, "aria-label": "Name", oninput: function () { vid.name = name.value; touch(); } });
    var chips = el("div", { class: "chips" }, FILE_ORDER.map(function (n) { return el("span", { class: "chip" + (f[n] ? "" : " miss"), title: f[n] ? mb(f[n]) : "nicht vorhanden", text: n + (f[n] ? " · " + mb(f[n]) : "") }); }));
    var sw = el("label", { class: "switch" }, el("input", { type: "checkbox", checked: vid.enabled ? true : null, onchange: function (e) { vid.enabled = e.target.checked; touch(); render(); } }), vid.enabled ? "Aktiv" : "Aus");
    var mv = el("div", { class: "mv" },
      el("button", { class: "btn ghost sm", type: "button", "aria-label": "Nach oben", text: "↑", disabled: i === 0 ? true : null, onclick: function () { shift(vid.id, -1); } }),
      el("button", { class: "btn ghost sm", type: "button", "aria-label": "Nach unten", text: "↓", disabled: i === vids.length - 1 ? true : null, onclick: function () { shift(vid.id, 1); } }));
    var del = el("button", { class: "btn ghost sm", type: "button", text: "In den Papierkorb", onclick: function () { vid.trashedAt = new Date().toISOString(); touch(); render(); toast("„" + vid.name + "“ im Papierkorb (nach Speichern ausgeblendet)."); } });
    card.appendChild(th);
    card.appendChild(el("div", null, name, el("div", { class: "meta", text: "#" + (i + 1) + " · " + fmtDate(vid.created) + " · " + Object.keys(f).length + " Dateien · " + mb(total) + " · ID " + vid.id }), chips));
    card.appendChild(el("div", { class: "ctl" }, sw, mv, del));
    list.appendChild(card);
  });
  v.appendChild(list);
  v.appendChild(el("p", { class: "small", style: "margin-top:1rem", text: "Tipp: Ein Klick auf das Vorschaubild spielt das Video ab. Neue Videos erscheinen zunächst deaktiviert." }));
}
function moveBefore(id, beforeId) {
  var a = S.site.videos, it = a.filter(function (x) { return x.id === id; })[0];
  a.splice(a.indexOf(it), 1); a.splice(a.findIndex(function (x) { return x.id === beforeId; }), 0, it); touch(); render();
}
function shift(id, dir) {
  var a = S.site.videos, vis = visible(a), i = vis.findIndex(function (x) { return x.id === id; }), j = i + dir; if (j < 0 || j >= vis.length) return;
  var ai = a.indexOf(vis[i]), aj = a.indexOf(vis[j]); var t = a[ai]; a[ai] = a[aj]; a[aj] = t; touch(); render();
}
function playVideo(vid) {
  var f = vid.files || {}, n = f["1080.mp4"] ? "1080.mp4" : (f["1080.webm"] ? "1080.webm" : null);
  var c = el("div", null, el("h3", { text: vid.name }), n ? el("video", { src: asset(vid.id, n), controls: true, autoplay: true, muted: true, loop: true, playsinline: true, poster: asset(vid.id, "poster.jpg") }) : el("p", { text: "Keine abspielbare Datei." }),
    el("div", { class: "row" }, el("button", { class: "btn", type: "button", text: "Schließen", onclick: closeDialog })));
  dialog(c); var vd = $("video", c); if (vd) vd.muted = true;
}

/* --- Texte --- */
function blankText() {
  return { id: "text-" + Date.now().toString(36), name: "Neue Variante", enabled: false, trashedAt: null, layout: "", en: { num: "", kicker: "", lede: "", body: "", sub: "" }, ar: { num: "", kicker: "", lede: "", body: "", sub: "" } };
}
function renderTexts(v) {
  var texts = visible(S.site.texts), active = texts.filter(function (x) { return x.enabled; }).length;
  v.appendChild(head("Texte", "Textvarianten der Startseite. Eine aktive Variante wird immer angezeigt; mehrere aktive rotieren gemäß Modus. (" + active + " von " + texts.length + " aktiv)", modeSelect("textMode", "Modus")));
  var list = el("div", { class: "list" });
  if (!texts.length) list.appendChild(el("div", { class: "empty", text: "Keine Textvariante – die Startseite zeigt dann den fest eingebauten Text." }));
  texts.forEach(function (t) {
    list.appendChild(el("div", { class: "tcard" + (t.enabled ? "" : " off") + (S.editText === t.id ? " sel" : "") },
      el("div", null, el("div", { class: "tn", text: t.name }), el("div", { class: "small", text: (t.layout ? "Layout: " + (LAYOUTS.filter(function (l) { return l.id === t.layout; })[0] || {}).name : "Layout: Standard") + " · " + (t.en.lede || "") })),
      el("div", { class: "row" },
        el("label", { class: "switch" }, el("input", { type: "checkbox", checked: t.enabled ? true : null, onchange: function (e) { t.enabled = e.target.checked; touch(); render(); } }), t.enabled ? "Aktiv" : "Aus"),
        el("button", { class: "btn sm", type: "button", text: "Bearbeiten", onclick: function () { S.editText = S.editText === t.id ? null : t.id; render(); } }),
        el("button", { class: "btn ghost sm", type: "button", text: "Duplizieren", onclick: function () { var c = JSON.parse(JSON.stringify(t)); c.id = "text-" + Date.now().toString(36); c.name = t.name + " (Kopie)"; c.enabled = false; S.site.texts.push(c); S.editText = c.id; touch(); render(); } }),
        el("button", { class: "btn ghost sm", type: "button", text: "Papierkorb", onclick: function () { t.trashedAt = new Date().toISOString(); if (S.editText === t.id) S.editText = null; touch(); render(); } }))));
  });
  v.appendChild(list);
  v.appendChild(el("div", { class: "row", style: "margin-top:1rem" }, el("button", { class: "btn", type: "button", text: "+ Neue Variante", onclick: function () { var t = blankText(); S.site.texts.push(t); S.editText = t.id; touch(); render(); } })));
  var t = texts.filter(function (x) { return x.id === S.editText; })[0];
  if (t) v.appendChild(textEditor(t));
}
function textEditor(t) {
  var rec;
  function onEdit() { touch(); if (rec) rec.send(); }
  function inp(obj, key, label, area, rtl) {
    var c = el(area ? "textarea" : "input", { type: area ? null : "text", value: obj[key] || "", class: rtl ? "ar-in" : "", dir: rtl ? "rtl" : null, lang: rtl ? "ar" : "en", oninput: function () { obj[key] = c.value; onEdit(); } });
    if (area) c.value = obj[key] || "";
    return el("div", { class: "field" }, el("label", { text: label }), c);
  }
  var lay = el("select", { onchange: function () { t.layout = lay.value; onEdit(); } }, el("option", { value: "", text: "Standard (globales Layout)" }), LAYOUTS.map(function (l) { return el("option", { value: l.id, text: l.name }); }));
  lay.value = t.layout || "";
  var nm = el("input", { type: "text", value: t.name, oninput: function () { t.name = nm.value; touch(); } });
  var box = el("div", { class: "pvbox" });
  var mobBtn = el("button", { class: "btn ghost sm", type: "button", text: S.pvMobile ? "Desktop" : "Handy", onclick: function () { S.pvMobile = !S.pvMobile; render(); } });
  var form = el("div", null,
    el("div", { class: "cols" }, el("div", { class: "field" }, el("label", { text: "Name der Variante (nur intern)" }), nm), el("div", { class: "field" }, el("label", { text: "Layout dieser Variante" }), lay)),
    el("div", { class: "cols" },
      el("div", null, el("h3", { text: "English" }), inp(t.en, "num", "Ziffer vor dem Kicker (z. B. III, optional)"), inp(t.en, "kicker", "Kicker"), inp(t.en, "lede", "Lede (kursiv)"), inp(t.en, "body", "Fließtext (Leerzeile = neuer Absatz)", true), inp(t.en, "sub", "Unterzeile (optional, unter dem Logo)")),
      el("div", null, el("h3", { text: "العربية" }), inp(t.ar, "kicker", "Kicker", false, true), inp(t.ar, "lede", "Lede", false, true), inp(t.ar, "body", "Fließtext", true, true), inp(t.ar, "sub", "Unterzeile (optional)", false, true))));
  var pv = el("div", { class: "pv" }, el("div", { class: "row", style: "justify-content:space-between;margin-bottom:.5rem" }, el("span", { class: "lbl", text: "Live-Vorschau" }), mobBtn), box,
    el("p", { class: "small", text: "Die Vorschau zeigt das Layout dieser Variante mit dem Text von oben (Hintergrund: Standbild)." }));
  if (S.pvMobile) box.classList.add("mob");
  var wrap = el("div", { class: "editor" }, el("div", { class: "tgrid" }, form, pv));
  setTimeout(function () {
    rec = mountPreview(box, function () { return { text: t, layout: t.layout || S.site.settings.layout || "editorial", video: visible(S.site.videos)[0] || null }; }, S.pvMobile);
  }, 0);
  return wrap;
}

/* --- Layout --- */
function renderLayout(v) {
  v.appendChild(head("Layout", "Darstellung des Textelements auf der Startseite. Gilt für alle Textvarianten ohne eigenes Layout."));
  var g = el("div", { class: "lgrid" }), cur = S.site.settings.layout || "editorial";
  LAYOUTS.forEach(function (l) {
    var box = el("div", { class: "pvbox" });
    var b = el("button", { class: "lcard", type: "button", "aria-pressed": cur === l.id ? "true" : "false", onclick: function () { S.site.settings.layout = l.id; touch(); render(); } },
      box, el("b", { text: l.name }), el("span", { class: "d", text: l.d }));
    g.appendChild(b);
    setTimeout(function () { mountPreview(box, function () { return { text: activeText(), layout: l.id, video: visible(S.site.videos)[0] || null }; }); }, 0);
  });
  v.appendChild(g);
}

/* --- Papierkorb --- */
function renderTrash(v) {
  v.appendChild(head("Papierkorb", "Gelöschte Einträge sind sofort von der Startseite verschwunden (sobald gespeichert). Nach " + TRASH_DAYS + " Tagen werden sie täglich automatisch endgültig entfernt."));
  var items = [];
  S.site.videos.forEach(function (x) { if (x.trashedAt) items.push({ kind: "video", x: x }); });
  S.site.texts.forEach(function (x) { if (x.trashedAt) items.push({ kind: "text", x: x }); });
  var list = el("div", { class: "list" });
  if (!items.length) list.appendChild(el("div", { class: "empty", text: "Der Papierkorb ist leer." }));
  items.forEach(function (it) {
    var x = it.x, d = daysLeft(x.trashedAt), isV = it.kind === "video";
    var card = el("div", { class: "tcard" },
      el("div", { class: "row" },
        isV ? el("div", { class: "thumb", style: "width:8rem;cursor:default;background-image:url('" + asset(x.id, "poster.jpg") + "')" }) : null,
        el("div", null, el("div", { class: "tn", text: x.name }), el("div", { class: "small", text: (isV ? "Video" : "Text") + " · gelöscht " + fmtDate(x.trashedAt) + " · noch " + d + (d === 1 ? " Tag" : " Tage") }))),
      el("div", { class: "row" },
        el("button", { class: "btn sm", type: "button", text: "Wiederherstellen", onclick: function () { x.trashedAt = null; touch(); render(); toast("Wiederhergestellt (nach Speichern wieder sichtbar)."); } }),
        el("button", { class: "btn danger sm", type: "button", text: "Endgültig löschen", onclick: function () { hardDelete(it); } })));
    list.appendChild(card);
  });
  v.appendChild(list);
}
function hardDelete(it) {
  var x = it.x, isV = it.kind === "video";
  confirmDlg("Endgültig löschen?", "„" + x.name + "“ wird unwiderruflich gelöscht" + (isV ? " (alle Videodateien im Repository)" : "") + ". Dabei werden auch alle ungespeicherten Änderungen gespeichert.", "Endgültig löschen", true).then(function (ok) {
    if (!ok) return;
    var arr = isV ? S.site.videos : S.site.texts; arr.splice(arr.indexOf(x), 1);
    if (isV) { S.busy = true; refreshBar(); }
    (isV ? purgeNow([x.id], "Admin: Video " + x.id + " endgültig gelöscht") : (MOCK ? Promise.resolve(toast("Testmodus: lokal entfernt.")) : save(false)))
      .then(function () { if (isV || MOCK) S.lastSaved = new Date(); render(); })
      .catch(function (e) { arr.push(x); if (e.status === 409) { S.conflict = true; toast("Konflikt – bitte neu laden.", true); } else toast("Fehlgeschlagen: " + explain(e), true); render(); })
      .then(function () { S.busy = false; refreshBar(); });
  });
}

/* ---------- Start ---------- */
(function init() {
  if (MOCK) { enter(); return; }
  var t = getToken();
  if (!t) { showLogin(); return; }
  verify(t).then(enter).catch(function (e) { if (e.status === 401) clearToken(); showLogin(explain(e)); });
})();
})();
