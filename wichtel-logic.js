/*
 * Wichtel-Zauber – Zieh-Logik und Link-Kodierung.
 * Läuft im Browser (window.WichtelLogic) und in Node (require) – damit sie getestet werden kann.
 */
(function (root) {
  "use strict";

  // ---------- Zufall (kryptografisch, falls verfügbar) ----------
  function rnd(n) {
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      var a = new Uint32Array(1);
      crypto.getRandomValues(a);
      return a[0] % n;
    }
    return Math.floor(Math.random() * n);
  }

  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = rnd(i + 1);
      var t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  // Verteilt die getaggten Lose: JEDER Ziehende erhält genau ein getaggtes Los
  // (perfektes Matching im x-regulären bipartiten Graphen, Kuhn-Verfahren)
  function decorate(base, n) {
    var matchName = [];
    for (var m = 0; m < n; m++) matchName.push(-1);
    function tryK(i, visited) {
      var opts = shuffle(base[i]);
      for (var o = 0; o < opts.length; o++) {
        var j = opts[o];
        if (visited[j]) continue;
        visited[j] = true;
        if (matchName[j] === -1 || tryK(matchName[j], visited)) {
          matchName[j] = i;
          return true;
        }
      }
      return false;
    }
    var ok = true;
    var order = [];
    for (var oi = 0; oi < base.length; oi++) order.push(oi);
    order = shuffle(order);
    for (var oi2 = 0; oi2 < order.length; oi2++) {
      var visited = [];
      for (var v = 0; v < n; v++) visited.push(false);
      if (!tryK(order[oi2], visited)) { ok = false; break; }
    }
    var result = base.map(function (row, d) {
      return row.map(function (j) {
        return { j: j, tagged: ok ? matchName[j] === d : false };
      });
    });
    if (!ok) {
      // Fallback (theoretisch unerreichbar): Zufallsvergabe pro Name
      var byName = [];
      for (var b = 0; b < n; b++) byName.push([]);
      for (var d2 = 0; d2 < base.length; d2++) {
        for (var c = 0; c < base[d2].length; c++) byName[base[d2][c]].push({ drawer: d2, col: c });
      }
      for (var j2 = 0; j2 < n; j2++) {
        var entries = byName[j2];
        if (!entries.length) continue;
        var w = entries[rnd(entries.length)];
        result[w.drawer][w.col].tagged = true;
      }
    }
    return result.map(function (row) { return shuffle(row); });
  }

  // Ergebnis: assignment[ziehender] = [{ j: gezogenerIndex, tagged: bool }, ...] oder null
  function computeAssignment(n, x) {
    if (n < 2 || x < 1 || x > n - 1) return null;
    var idx = [];
    for (var i = 0; i < n; i++) idx.push(i);
    for (var attempt = 0; attempt < 1000; attempt++) {
      var copies = [];
      var picks = [];
      for (var c = 0; c < n; c++) { copies.push(x); picks.push([]); }
      var order = shuffle(idx);
      var ok = true;
      for (var oi = 0; oi < order.length; oi++) {
        var i2 = order[oi];
        var candidates = idx.filter(function (j) { return j !== i2 && copies[j] > 0; });
        if (candidates.length < x) { ok = false; break; }
        for (var k = 0; k < x; k++) {
          var maxC = Math.max.apply(null, candidates.map(function (j) { return copies[j]; }));
          var best = candidates.filter(function (j) { return copies[j] === maxC; });
          var pick = best[rnd(best.length)];
          picks[i2].push(pick);
          copies[pick] -= 1;
          candidates = candidates.filter(function (j) { return j !== pick; });
        }
      }
      if (ok) return decorate(picks, n);
    }
    var perm = shuffle(idx);
    var pos = [];
    for (var p2 = 0; p2 < n; p2++) pos[perm[p2]] = p2;
    var circ = idx.map(function (i3) {
      var res = [];
      for (var k2 = 1; k2 <= x; k2++) res.push(perm[(pos[i3] + k2) % n]);
      return res;
    });
    return decorate(circ, n);
  }

  // Prüft eine Ziehung gegen alle Regeln. Gibt eine Liste von Fehlern zurück (leer = ok).
  function validateAssignment(a, n, x) {
    var errors = [];
    if (!Array.isArray(a) || a.length !== n) return ["falsche Anzahl Ziehender"];
    var cnt = [], tagCnt = [];
    for (var i = 0; i < n; i++) { cnt.push(0); tagCnt.push(0); }
    a.forEach(function (row, d) {
      if (row.length !== x) errors.push(d + " zieht " + row.length + " statt " + x);
      var seen = {};
      var tagged = 0;
      row.forEach(function (p) {
        if (p.j === d) errors.push(d + " zieht sich selbst");
        if (seen[p.j]) errors.push(d + " zieht " + p.j + " doppelt");
        seen[p.j] = true;
        cnt[p.j]++;
        if (p.tagged) { tagged++; tagCnt[p.j]++; }
      });
      if (tagged !== 1) errors.push(d + " hat " + tagged + " Lose mit Beschreibung");
    });
    for (var j = 0; j < n; j++) {
      if (cnt[j] !== x) errors.push(j + " wird " + cnt[j] + "-mal gezogen statt " + x);
      if (tagCnt[j] !== 1) errors.push(j + " hat " + tagCnt[j] + " Lose mit Beschreibung");
    }
    return errors;
  }

  // ---------- Link-Kodierung (UTF-8 → Base64url) ----------
  // Die Daten stehen im #-Teil der URL. Dieser Teil wird nie an einen Server
  // übertragen – es gibt keine Datenbank, nichts wird online gespeichert.
  function b64e(str) {
    var bytes = new TextEncoder().encode(str);
    var bin = "";
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function b64d(s) {
    s = s.replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4) s += "=";
    var bin = atob(s);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  }

  // Daten für den persönlichen Link von Ziehendem i
  function payloadFor(draw, i) {
    return {
      v: 1,
      t: draw.title,
      d: draw.ts,
      n: draw.participants[i].name,
      p: draw.assignment[i].map(function (pick) {
        var p = draw.participants[pick.j];
        return [p.name, pick.tagged ? String(p.tag || "").trim() : ""];
      })
    };
  }

  function encodePayload(payload) { return b64e(JSON.stringify(payload)); }

  function decodePayload(code) {
    var d = JSON.parse(b64d(code));
    if (!d || typeof d.n !== "string" || !Array.isArray(d.p)) throw new Error("ungültig");
    d.p = d.p.map(function (e) {
      if (!Array.isArray(e)) throw new Error("ungültig");
      return [String(e[0]), String(e[1] || "")];
    });
    return d;
  }

  var api = {
    rnd: rnd,
    shuffle: shuffle,
    decorate: decorate,
    computeAssignment: computeAssignment,
    validateAssignment: validateAssignment,
    b64e: b64e,
    b64d: b64d,
    payloadFor: payloadFor,
    encodePayload: encodePayload,
    decodePayload: decodePayload
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.WichtelLogic = api;
})(this);
