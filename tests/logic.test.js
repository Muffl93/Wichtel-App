// Tests der Zieh-Logik und Link-Kodierung – ohne Zusatzpakete: `node --test`
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const L = require("../wichtel-logic.js");

describe("Ziehung: alle Regeln", () => {
  it("hält alle Regeln ein (2–12 Teilnehmer, jede mögliche Anzahl, je 200 Ziehungen)", () => {
    for (let n = 2; n <= 12; n++) {
      for (let x = 1; x <= n - 1; x++) {
        for (let r = 0; r < 200; r++) {
          const a = L.computeAssignment(n, x);
          const errors = L.validateAssignment(a, n, x);
          assert.deepEqual(errors, [], `n=${n}, x=${x}: ${errors.join("; ")}`);
        }
      }
    }
  });

  it("schafft auch größere Gruppen (30 Teilnehmer, je 3 Namen)", () => {
    for (let r = 0; r < 50; r++) {
      assert.deepEqual(L.validateAssignment(L.computeAssignment(30, 3), 30, 3), []);
    }
  });

  it("lehnt unmögliche Einstellungen ab", () => {
    assert.equal(L.computeAssignment(0, 1), null);
    assert.equal(L.computeAssignment(1, 1), null);
    assert.equal(L.computeAssignment(4, 0), null);
    assert.equal(L.computeAssignment(4, 4), null); // man kann sich nicht selbst ziehen
  });
});

describe("Ziehung: Zufall", () => {
  it("jeder kann jeden anderen ziehen (kein festes Muster)", () => {
    const seen = new Set();
    for (let r = 0; r < 500; r++) seen.add(L.computeAssignment(5, 2)[0].map((p) => p.j).sort().join(","));
    // Teilnehmer 0 kann 6 verschiedene Paare aus {1,2,3,4} ziehen
    assert.equal(seen.size, 6);
  });

  it("das Los mit Beschreibung landet nicht immer bei derselben Person", () => {
    const taggedTo = new Set();
    for (let r = 0; r < 300; r++) {
      const pick = L.computeAssignment(4, 2)[0].find((p) => p.tagged);
      taggedTo.add(pick.j);
    }
    assert.equal(taggedTo.size, 3);
  });

  it("die Position des Loses mit Beschreibung ist gemischt", () => {
    const positions = new Set();
    for (let r = 0; r < 200; r++) positions.add(L.computeAssignment(4, 2)[0].findIndex((p) => p.tagged));
    assert.deepEqual([...positions].sort(), [0, 1]);
  });
});

describe("Regel-Prüfer", () => {
  it("erkennt kaputte Ziehungen", () => {
    const self = [[{ j: 0, tagged: true }], [{ j: 0, tagged: true }]];
    assert.ok(L.validateAssignment(self, 2, 1).some((e) => e.includes("selbst")));
    const dup = [
      [{ j: 1, tagged: true }, { j: 1, tagged: false }],
      [{ j: 0, tagged: true }, { j: 2, tagged: false }],
      [{ j: 0, tagged: true }, { j: 2, tagged: false }]
    ];
    assert.ok(L.validateAssignment(dup, 3, 2).length > 0);
    const noTag = [[{ j: 1, tagged: false }], [{ j: 0, tagged: false }]];
    assert.ok(L.validateAssignment(noTag, 2, 1).some((e) => e.includes("Beschreibung")));
  });
});

describe("Persönliche Links", () => {
  const draw = {
    title: "Wichteln 2026 🎄",
    ts: 1794067349792,
    participants: [
      { name: "Jürgen", tag: "Bücher über Öl & „Größe“" },
      { name: "Änne", tag: "Socken 🧦" },
      { name: "Bo", tag: "Tee" }
    ],
    assignment: L.computeAssignment(3, 2)
  };

  it("Kodieren und Dekodieren ergibt dieselben Daten (Umlaute, Emoji, Sonderzeichen)", () => {
    for (let i = 0; i < 3; i++) {
      const payload = L.payloadFor(draw, i);
      const code = L.encodePayload(payload);
      assert.match(code, /^[A-Za-z0-9_-]+$/, "nur URL-sichere Zeichen");
      assert.deepEqual(L.decodePayload(code), payload);
    }
  });

  it("enthält nur die eigene Ziehung – und genau eine Beschreibung", () => {
    for (let i = 0; i < 3; i++) {
      const p = L.payloadFor(draw, i);
      assert.equal(p.n, draw.participants[i].name);
      assert.equal(p.p.length, 2);
      assert.ok(!p.p.some(([name]) => name === p.n), "zieht sich nicht selbst");
      assert.equal(p.p.filter(([, tag]) => tag).length, 1);
      for (const [name, tag] of p.p) {
        if (tag) assert.equal(tag, draw.participants.find((q) => q.name === name).tag);
      }
    }
  });

  it("verrät im Link nichts über andere Ziehende", () => {
    const p = L.payloadFor(draw, 0);
    assert.deepEqual(Object.keys(p).sort(), ["d", "n", "p", "t", "v"]);
  });

  it("wirft bei kaputten Links einen Fehler", () => {
    assert.throws(() => L.decodePayload("kaputt"));
    assert.throws(() => L.decodePayload(L.b64e('{"n":"A"}')));
    assert.throws(() => L.decodePayload(L.b64e('{"n":"A","p":["x"]}')));
    const ok = L.encodePayload(L.payloadFor(draw, 0));
    assert.throws(() => L.decodePayload(ok.slice(0, ok.length - 12)), "abgeschnittener Link");
  });
});
