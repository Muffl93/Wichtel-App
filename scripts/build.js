#!/usr/bin/env node
// Baut die passwortgeschützte Version der App:
//   1. index.html + wichtel-logic.js zu einer Datei zusammenfügen
//   2. mit dem Passwort aus der Umgebungsvariable WICHTEL_PASSWORT verschlüsseln
//      (PBKDF2-SHA256 → AES-256-GCM, nur Node-Bordmittel)
//   3. in die Login-Seite (scripts/login.html) einbetten → <ausgabe>/index.html
//
// Aufruf: WICHTEL_PASSWORT=… node scripts/build.js [ausgabeordner]   (Standard: dist)
// Auf GitHub kommt das Passwort aus dem Repository-Secret WICHTEL_PASSWORT – es steht nie im Code.
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { webcrypto } = require("node:crypto");
const { subtle } = webcrypto;

const ROOT = path.join(__dirname, "..");
const SALT = "wichtel-zauber/Muffl93/Wichtel-App/v1"; // seitenbezogen, nicht geheim
const ITERATIONS = 600000; // macht Durchprobieren von Passwörtern langsam

function fail(msg) {
  console.error("❌ " + msg);
  process.exit(1);
}

const b64 = (u) => Buffer.from(u).toString("base64");

async function deriveKey(password) {
  const enc = new TextEncoder();
  const base = await subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await subtle.deriveBits({ name: "PBKDF2", salt: enc.encode(SALT), iterations: ITERATIONS, hash: "SHA-256" }, base, 256);
  return subtle.importKey("raw", bits, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function main() {
  const outDir = path.resolve(process.argv[2] || path.join(ROOT, "dist"));
  const password = process.env.WICHTEL_PASSWORT || "";
  if (!password) {
    fail("Kein Passwort gesetzt. Lege auf GitHub unter Settings → Secrets and variables → Actions " +
      "ein Repository-Secret namens WICHTEL_PASSWORT an. (Ohne Passwort wird nichts veröffentlicht.)");
  }
  if (password.length < 6) fail("Das Passwort muss mindestens 6 Zeichen lang sein.");

  // 1. App zu einer Datei zusammenfügen
  let app = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const logic = fs.readFileSync(path.join(ROOT, "wichtel-logic.js"), "utf8");
  const scriptTag = /<script src="wichtel-logic\.js[^"]*"><\/script>/;
  if (!scriptTag.test(app)) fail("Script-Tag für wichtel-logic.js nicht in index.html gefunden.");
  app = app.replace(scriptTag, () => "<script>\n" + logic.replace(/<\/script/gi, "<\\/script") + "\n</script>");

  // 2. verschlüsseln
  const key = await deriveKey(password);
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(await subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(app)));

  // Selbstkontrolle: lässt es sich wieder entschlüsseln?
  const check = new TextDecoder().decode(await subtle.decrypt({ name: "AES-GCM", iv }, key, cipher));
  if (check !== app) fail("Selbstkontrolle der Verschlüsselung fehlgeschlagen.");

  // 3. in die Login-Seite einbetten
  const payload = JSON.stringify({ s: SALT, i: ITERATIONS, iv: b64(iv), c: b64(cipher) });
  let page = fs.readFileSync(path.join(__dirname, "login.html"), "utf8");
  if (!page.includes("/*__PAYLOAD__*/null")) fail("Platzhalter in scripts/login.html fehlt.");
  page = page.replace("/*__PAYLOAD__*/null", () => payload);

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "index.html"), page);
  console.log("✅ Verschlüsselte App erstellt: " + path.join(outDir, "index.html") +
    " (" + Math.round(page.length / 1024) + " KB)");
}

main().catch((e) => fail(e.stack || String(e)));
