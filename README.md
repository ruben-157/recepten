# Recepten (client-side)

Een volledig client-side recepten site met HTML, CSS en JavaScript. Open `index.html` in de browser of draai een simpele static server.

## Recepten toevoegen

1. Plaats een nieuw `.md` bestand in `recepten/`.
2. Voeg de bestandsnaam toe aan `recepten/index.json`.
3. De eerste H1 (`# Titel`) wordt gebruikt als menu titel. Geen H1? Dan wordt de bestandsnaam gebruikt.

Voorbeeld `recepten/index.json`:

```
{
  "files": ["pasta-alfredo.md", "tiramisu.md"]
}
```

## Draaien in de browser

### Aanrader: simpele static server

In de projectmap:

```
python3 -m http.server 8080
```

Open daarna `http://localhost:8080` in je browser.

### GitHub Pages

1. Push de map naar een repo.
2. Zet in GitHub de Pages source op de `main` branch en root.
3. Open de Pages URL.

## Waarom file:// soms niet werkt

Browsers blokkeren meestal `fetch` vanaf `file://` (zeker voor folders en JSON). Daarom gebruikt de app `recepten/index.json` en is een simpele static server de betrouwbaarste optie.
