# Layuna – Verwaltung (layuna.ae/admin)

## 1. Token erstellen (einmalig, ca. 1 Minute)
1. Bei GitHub als **layuna-ae** anmelden und öffnen: https://github.com/settings/personal-access-tokens/new
2. Token name: `Layuna Admin` · **Resource owner: layuna-ae** · Expiration: **1 Jahr**
3. **Repository access → Only select repositories → `website`**
4. **Repository permissions → Contents: Read and write** (Metadata: Read-only kommt automatisch)
5. „Generate token“, den Wert (`github_pat_…`) kopieren. Er wird nur einmal angezeigt.

## 2. Einloggen
`https://layuna.ae/admin/` öffnen, Token einfügen, optional „Angemeldet bleiben“ (sonst nur bis Tab-Ende), „Prüfen & anmelden“. Das Token bleibt nur in deinem Browser. Mit „Abmelden“ wird es entfernt. Nach Ablauf (1 Jahr) einfach ein neues erstellen.

## 3. Arbeiten
Änderungen gelten erst nach **Speichern** (unten rechts). Das ist ein Commit auf GitHub; die Seite aktualisiert sich danach nach **ca. 1–2 Minuten**.

- **Texte:** Tab „Texte“ → „Bearbeiten“. Englisch und Arabisch: Kicker, Lede, Fließtext (Leerzeile = neuer Absatz), optional Unterzeile unter dem Logo. Live-Vorschau rechts (auch „Handy“). Mehrere Varianten anlegen, **Aktiv**-Schalter bestimmt, was läuft; sind mehrere aktiv, wählt der Modus (der Reihe nach / zufällig / immer das erste).
- **Layout:** Tab „Layout“ → eines der vier Presets anklicken (Editorial zweisprachig, Vogue 3 Spalten, Großes Zitat + Mikrotext, Nur Logo). Eine Textvariante kann ein eigenes Layout haben.
- **Videos:** Tab „Videos“. Vorschaubild anklicken = Video abspielen. **Aktiv** schaltet ein/aus; Reihenfolge per Ziehen oder ↑/↓. Modus: *der Reihe nach* (jeder Besucher sieht beim nächsten Besuch das nächste Video), *zufällig*, *immer das erste*. Neue Videos legt Claude an (zunächst deaktiviert).
- **Papierkorb:** „In den Papierkorb“ blendet Video/Text sofort aus (nach Speichern). Im Tab „Papierkorb“: **Wiederherstellen** oder **Endgültig löschen** (mit Bestätigung, löscht auch die Dateien). Nach **7 Tagen** leert eine GitHub Action täglich automatisch.

## 4. Gut zu wissen
- Fehlt JavaScript oder die Konfiguration, zeigt die Startseite den fest eingebauten Standard (V3 + Text „The Fitting“).
- Konfliktmeldung beim Speichern = jemand/etwas hat parallel geändert → „Neueste Version laden“.
- Testmodus ohne Login (nur lesen): `/admin/?mock=1`.
- Neues Video per Skript: `tools/add_video.py <id> "<Name>" <master.mp4> [--4k datei] [--mobile-crop-x 50]`.
