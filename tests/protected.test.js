// Tests für die passwortgeschützte Version (scripts/build.js + scripts/login.html)
const { describe, it, before, after, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { chromium } = require("playwright");
const L = require("../wichtel-logic.js");

const ROOT = path.join(__dirname, "..");
const BUILD = path.join(ROOT, "scripts", "build.js");
const PASSWORT = "Lebkuchen-Test-2026";

let dir, server, base, browser, ctx, errors;

function build(password, outDir) {
  return spawnSync(process.execPath, [BUILD, outDir], {
    env: { ...process.env, WICHTEL_PASSWORT: password },
    encoding: "utf8"
  });
}

async function login(page, password, remember = true) {
  await page.waitForSelector("#pw");
  await page.fill("#pw", password);
  if (!remember) await page.uncheck("#remember");
  await page.click("#go");
}

before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "wichtel-dist-"));
  const r = build(PASSWORT, dir);
  assert.equal(r.status, 0, r.stderr);
  server = http.createServer((req, res) => {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    fs.createReadStream(path.join(dir, "index.html")).pipe(res);
  });
  await new Promise((r2) => server.listen(0, "127.0.0.1", r2));
  base = `http://127.0.0.1:${server.address().port}/`;
  browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
});
after(async () => {
  await browser?.close();
  server?.close();
  fs.rmSync(dir, { recursive: true, force: true });
});
beforeEach(async () => {
  errors = [];
  ctx = await browser.newContext();
});
afterEach(async () => {
  await ctx.close();
  assert.deepEqual(errors, [], "keine JavaScript-Fehler");
});

async function newPage() {
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  return p;
}

describe("Build", () => {
  it("bricht ohne Passwort ab (nichts Ungeschütztes veröffentlichen)", () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "wichtel-leer-"));
    const r = build("", out);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /WICHTEL_PASSWORT/);
    assert.ok(!fs.existsSync(path.join(out, "index.html")));
    assert.notEqual(build("kurz", out).status, 0, "zu kurzes Passwort wird abgelehnt");
  });

  it("enthält weder Passwort noch App-Code im Klartext", () => {
    const html = fs.readFileSync(path.join(dir, "index.html"), "utf8");
    assert.ok(!html.includes(PASSWORT));
    for (const s of ["computeAssignment", "Jetzt auslosen", "Niemand zieht sich selbst"]) {
      assert.ok(!html.includes(s), `„${s}“ darf nicht lesbar sein`);
    }
  });

  it("jeder Build ist anders verschlüsselt (neuer Zufallswert)", () => {
    const other = fs.mkdtempSync(path.join(os.tmpdir(), "wichtel-2-"));
    build(PASSWORT, other);
    assert.notEqual(
      fs.readFileSync(path.join(dir, "index.html"), "utf8"),
      fs.readFileSync(path.join(other, "index.html"), "utf8")
    );
  });
});

describe("Passwortabfrage im Browser", () => {
  it("falsches Passwort: Fehlermeldung, App bleibt verschlossen", async () => {
    const page = await newPage();
    await page.goto(base);
    await login(page, "falsch-falsch");
    await page.waitForSelector("text=Falsches Passwort");
    assert.equal(await page.locator('[data-act="start"]').count(), 0);
  });

  it("richtiges Passwort: App startet und funktioniert", async () => {
    const page = await newPage();
    await page.goto(base);
    await login(page, PASSWORT);
    await page.waitForSelector('[data-act="start"]');
    await page.click('[data-act="start"]');
    await page.waitForSelector(".linkrow");
    assert.equal(await page.locator(".linkrow").count(), 4);
  });

  it("„angemeldet bleiben“: beim nächsten Öffnen kein Passwort nötig", async () => {
    const page = await newPage();
    await page.goto(base);
    await login(page, PASSWORT);
    await page.waitForSelector('[data-act="start"]');
    await page.reload();
    await page.waitForSelector('[data-act="start"]');
    assert.equal(await page.locator("#pw").count(), 0);
  });

  it("ohne „angemeldet bleiben“: beim nächsten Öffnen wieder Passwort", async () => {
    const page = await newPage();
    await page.goto(base);
    await login(page, PASSWORT, false);
    await page.waitForSelector('[data-act="start"]');
    await page.reload();
    await page.waitForSelector("#pw");
  });

  it("gespeicherter Zugang mit altem Passwort: wieder Passwortabfrage statt Fehler", async () => {
    const page = await newPage();
    await page.goto(base);
    await page.waitForSelector("#pw");
    await page.evaluate(() => localStorage.setItem("wichtel-zugang-v1", btoa("x".repeat(32))));
    await page.reload();
    await page.waitForSelector("#pw");
    assert.equal(await page.evaluate(() => localStorage.getItem("wichtel-zugang-v1")), null);
  });

  it("persönlicher Link: nach dem Passwort sieht man die eigene Ziehung", async () => {
    const org = await newPage();
    await org.goto(base);
    await login(org, PASSWORT);
    await org.click('[data-act="start"]');
    await org.waitForSelector(".linkrow");
    const href = await org.getAttribute('[data-act="wa"][data-idx="1"]', "href");
    const link = decodeURIComponent(href.split("text=")[1]).split("\n").find((l) => l.startsWith("http"));
    const data = L.decodePayload(link.split("#w=")[1]);

    // Teilnehmer auf einem anderen Gerät (eigener Browser-Kontext, nicht angemeldet)
    const other = await browser.newContext();
    const guest = await other.newPage();
    guest.on("pageerror", (e) => errors.push(e.message));
    await guest.goto(link);
    await login(guest, PASSWORT);
    await guest.waitForSelector(`text=Hallo ${data.n}`);
    await guest.click('[data-act="gdraw"]');
    await guest.waitForSelector(".namecard");
    assert.equal(await guest.locator(".namecard").count(), data.p.length);
    await other.close();
  });
});
