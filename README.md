# Recepten (client-side)

Een volledig client-side recepten site met HTML, CSS en JavaScript. Open `index.html` in de browser of draai een simpele static server.

## Recepten toevoegen

1. Plaats een nieuw `.md` bestand in `recepten/`.
2. Voeg de bestandsnaam toe aan `recepten/index.json`.
3. De eerste H1 (`# Titel`) wordt gebruikt als menu titel. Geen H1? Dan wordt de bestandsnaam gebruikt.

### Porties en ingredienten schalen

Gebruik YAML frontmatter bovenaan het recept om het basis aantal porties vast te leggen:

```
---
porties: 4
---
# Titel
```

Wil je de porties-aanpasser verbergen terwijl je wel porties opgeeft, zet dan `porties_aanpasbaar: nee`:

```
---
porties: 4
porties_aanpasbaar: nee
---
# Titel
```

Zet de ingredienten in een lijst onder de kop `## Ingredienten` of `## Ingrediënten`. De eerste hoeveelheid op elke regel wordt automatisch geschaald wanneer je het portie-aantal aanpast.

Voorbeelden:

- `- 300 g pasta`
- `- 2-3 eetlepels olijfolie`
- `- Ongeveer 1,5 liter bouillon`

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
