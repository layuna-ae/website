# Layuna_Website (layuna.ae)

Minimalistische statische Landingpage: `index.html`, `legal.html` (Legal Notice + Privacy, Anker `#privacy`), `404.html`, `favicon.svg`, `robots.txt`. Kein JS, keine externen Ressourcen, nur System-Fonts.

**Deploy:** alle Dateien in das Webroot des Hostings (layuna.ae) kopieren; 404.html als Fehlerseite hinterlegen. `_preview/` und diese README nicht hochladen.

**Sobald Logo da ist:** in `index.html` und `404.html` den `<svg class="logo">`-Block (markiert mit `<!-- LOGO: hier ersetzen -->`) durch `<img src="logo.svg" alt="Layuna" class="logo">` ersetzen. Bei farbigem Logo ggf. Dark-Mode-Variante ergänzen. Favicon (`favicon.svg`, Monogramm L) ebenfalls anpassen.
