// Browser-Tests: klicken die echten Abläufe in Chromium durch.
// Einmalig: `npm install` und `npx playwright install chromium`, dann `npm test`.
const { describe, it, before, after, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");
const L = require("../wichtel-logic.js");

const ROOT = path.join(__dirname, "..");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8" };

let server, base, browser, ctx, page, errors, dialogs;

function serve() {
  return new Promise((resolve) => {
    server = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split("?")[0]);
      if (p === "/") p = "/index.html";
      const file = path.join(ROOT, path.normalize(p));
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404);
        return res.end();
      }
      res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, "127.0.0.1", () => resolve(`http://127.0.0.1:${server.address().port}/`));
  });
}

async function newPage() {
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  // Die App darf KEINE Browser-Popups (alert/confirm) benutzen – die werden von manchen
  // Browsern blockiert. Playwright lehnt sie hier automatisch ab, wie ein blockierender Browser.
  p.on("dialog", (d) => { dialogs.push(d.type()); d.dismiss().catch(() => {}); });
  return p;
}

// Holt alle persönlichen Links aus der Link-Seite und dekodiert sie
async function readLinks(p) {
  const hrefs = await p.$$eval('[data-act="wa"]', (as) => as.map((a) => a.href));
  return hrefs.map((h) => {
    const msg = decodeURIComponent(h.split("text=")[1]);
    const link = msg.split("\n").find((l) => l.startsWith("http"));
    return { link, data: L.decodePayload(link.split("#w=")[1]) };
  });
}

async function addName(p, name) {
  await p.fill('form[data-form="add"] input', name);
  await p.keyboard.press("Enter");
}

async function setTags(p, tags) {
  for (let i = 0; i < tags.length; i++) await p.fill(`[data-tag="${i}"]`, tags[i]);
}

before(async () => {
  base = await serve();
  browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
});
after(async () => {
  await browser?.close();
  server?.close();
});
beforeEach(async () => {
  errors = [];
  dialogs = [];
  ctx = await browser.newContext({ viewport: { width: 400, height: 850 } }); // frischer localStorage
  page = await newPage();
  await page.goto(base);
});
afterEach(async () => {
  await ctx.close();
  assert.deepEqual(errors, [], "keine JavaScript-Fehler");
  assert.deepEqual(dialogs, [], "keine Browser-Popups");
});

describe("Organisator", () => {
  it("erste Ziehung: Links für alle, und die Links halten alle Regeln ein", async () => {
    await addName(page, "Emil");
    await setTags(page, ["Buch", "Socken", "Kaffee", "Puzzle", "Schal"]);
    await page.click('[data-act="start"]');
    await page.waitForSelector(".linkrow");
    assert.equal(await page.locator(".linkrow").count(), 5);

    const links = await readLinks(page);
    const names = ["Anna", "Ben", "Clara", "David", "Emil"];
    const count = {}, tagCount = {};
    for (const { data } of links) {
      assert.equal(data.p.length, 2, `${data.n} zieht 2 Namen`);
      assert.ok(!data.p.some(([n]) => n === data.n), `${data.n} zieht sich nicht selbst`);
      assert.equal(new Set(data.p.map(([n]) => n)).size, 2, `${data.n} zieht keinen doppelt`);
      assert.equal(data.p.filter(([, t]) => t).length, 1, `${data.n} hat genau ein Wunschlos`);
      for (const [n, t] of data.p) {
        count[n] = (count[n] || 0) + 1;
        if (t) tagCount[n] = (tagCount[n] || 0) + 1;
      }
    }
    for (const n of names) {
      assert.equal(count[n], 2, `${n} wird genau 2-mal gezogen`);
      assert.equal(tagCount[n], 1, `${n}s Wunsch wird genau einmal vergeben`);
    }
  });

  it("REGRESSION: Teilnehmer ändern und erneut auslosen funktioniert", async () => {
    await page.click('[data-act="start"]');
    await page.waitForSelector(".linkrow");
    const first = (await readLinks(page))[0].data.d;

    await page.click('[data-act="edit"]');
    await addName(page, "Emil");
    await page.click('[data-act="start"]');
    await page.waitForSelector('[data-screen="confirm"]');
    await page.waitForTimeout(5); // damit sich der Zeitstempel sicher unterscheidet
    await page.click('[data-act="redraw"]');
    await page.waitForSelector(".linkrow");

    const links = await readLinks(page);
    assert.equal(links.length, 5, "neue Ziehung enthält den neuen Teilnehmer");
    assert.ok(links[0].data.d > first, "neue Ziehung hat neuen Zeitstempel");
  });

  it("REGRESSION: „Neu auslosen“ auf der Link-Seite funktioniert", async () => {
    await page.click('[data-act="start"]');
    await page.waitForSelector(".linkrow");
    const first = (await readLinks(page))[0].data.d;
    await page.click('[data-act="start"]');
    await page.waitForTimeout(5);
    await page.click('[data-act="redraw"]');
    await page.waitForSelector(".linkrow");
    assert.ok((await readLinks(page))[0].data.d > first);
  });

  it("„Abbrechen“ behält die alte Ziehung", async () => {
    await page.click('[data-act="start"]');
    await page.waitForSelector(".linkrow");
    const before = JSON.stringify(await readLinks(page));
    await page.click('[data-act="start"]');
    await page.click('[data-act="confirmcancel"]');
    await page.waitForSelector(".linkrow");
    assert.equal(JSON.stringify(await readLinks(page)), before);
  });

  it("verlangt Beschreibungen für alle, wenn welche angegeben sind", async () => {
    await setTags(page, ["Buch", "", "", ""]);
    await page.click('[data-act="start"]');
    assert.match(await page.innerText(".hint"), /braucht jeder Name eine Beschreibung/);
    assert.equal(await page.locator(".linkrow").count(), 0);
  });

  it("verhindert doppelte Namen", async () => {
    await addName(page, "anna");
    assert.match(await page.innerText(".hint"), /schon dabei/);
    assert.equal(await page.locator(".chip").count(), 4);
  });

  it("Ziehung und „verschickt“-Status bleiben nach dem Neuladen erhalten", async () => {
    await page.click('[data-act="start"]');
    await page.waitForSelector(".linkrow");
    const before = JSON.stringify(await readLinks(page));
    await page.click('[data-act="copy"][data-idx="1"]');
    await page.locator(".linkrow").nth(1).locator(".st.ok").waitFor();
    await page.reload();
    await page.waitForSelector(".linkrow");
    assert.equal(JSON.stringify(await readLinks(page)), before);
    assert.equal(await page.locator(".st.ok").count(), 1);
  });

  it("Handy herumgeben: alle kommen nacheinander dran", async () => {
    await page.click('[data-act="start"]');
    await page.waitForSelector(".linkrow");
    await page.click('[data-act="local"]');
    const seen = new Set();
    for (let i = 0; i < 4; i++) {
      await page.click('[data-act="draw"]');
      await page.waitForSelector(".namecard");
      seen.add(await page.innerText(".dim .amber"));
      assert.equal(await page.locator(".namecard").count(), 2);
      await page.click('[data-act="next"]');
    }
    assert.equal(seen.size, 4);
    await page.waitForSelector(".linkrow"); // zurück zur Link-Seite
  });
});

describe("Teilnehmer mit persönlichem Link", () => {
  it("sieht nur die eigenen Namen, mit genau einem Wunsch", async () => {
    await setTags(page, ["Buch", "Socken", "Kaffee", "Puzzle"]);
    await page.click('[data-act="start"]');
    await page.waitForSelector(".linkrow");
    const { link, data } = (await readLinks(page))[2];

    const guest = await newPage();
    await guest.goto(link);
    assert.match(await guest.innerText("#app"), new RegExp(`Hallo ${data.n}`));
    assert.equal(await guest.locator(".namecard").count(), 0, "Namen erst nach dem Aufdecken sichtbar");
    await guest.click('[data-act="gdraw"]');
    await guest.waitForSelector(".namecard");
    const cards = await guest.$$eval(".namecard", (els) => els.map((e) => e.innerText));
    assert.equal(cards.length, 2);
    assert.equal(cards.filter((c) => c.includes("🏷️")).length, 1);
    assert.ok(!cards.some((c) => c.includes(data.n)), "eigener Name taucht nicht auf");
    assert.ok(!(await guest.innerText("#app")).includes("Auswertung"), "keine Organisator-Funktionen");
  });

  it("bekommt bei kaputtem Link eine verständliche Meldung", async () => {
    await page.goto(base + "#w=kaputt!!");
    await page.waitForSelector("text=Link ungültig");
  });
});
