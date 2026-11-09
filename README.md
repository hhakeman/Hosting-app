# Hakeman House

The household app that runs on the iPad on the kitchen counter. Lists, the week's dinners, holiday hosting, and the family cookbook, with a capture bar that takes a spoken or typed note and sorts it into the right place.

Live app: https://claude.ai/artifact/Qu5T4kmZDYyRck4Vz3HN3S (a claude.ai artifact; data lives in its shared database).

## Files

- `index.html` – the page shell. Published as the artifact's page; the publish step wraps it in a document skeleton, so it carries no `<html>`/`<head>` of its own.
- `app.css` – all styling. Light only. Tokens at the top of the file are the design system.
- `app.js` – all behaviour, in six sections: core and state; Today, Calendar (week, month and day: meetings, dinners, plans, hosting events and to-dos in one place), Lists, Dinners; Hosting (the original holiday engine, including the one-oven day-of scheduler); Cookbook and cooking mode; Capture (speech in, Claude sorts, undo); events and boot.
- `cookbook.js` – the 53 recipes plus day-of timing and oven flexibility per recipe. Generated from `src/recipes.json`; recipes are edited there.
- `dev/` – a local harness that mocks the artifact runtime (`window.claude`) with an in-memory database so the app can be driven in a browser without publishing. Never published.

## Data model (artifact database)

| Collection | Document | Notes |
| --- | --- | --- |
| `lists` | `{name, order, link}` | Fixed ids for the defaults: `grocery`, `costco`, `todo`, `ideas`. `link` is an optional board or page link shown as a button (the Pinterest board on Meal ideas) |
| `items` | `{listId, text, note, time, link, recipe, servings, ingredients[], steps[], who, done, createdAt, doneAt}` | List entries. Meal ideas use `time` (how long it takes), `link` (Pinterest or a recipe site), `recipe` (cookbook key), and for imported recipes `ingredients` and `steps` so the app can show and cook them |
| `plans` | `{title, date, endDate, time, note, createdAt}` | "Coming up": trips, appointments, nights out. Shown on Today and on the matching day in Dinners |
| `dinners` | id is the date `YYYY-MM-DD`: `{title, recipe, note, time, link, servings, ingredients[], steps[]}` | Weeks run Sunday to Saturday. Tapping a day with a recipe (cookbook key, stored ingredients and steps, or a link) opens the recipe sheet |
| `events` | `{name, short, date, time, theme, weekend, dinnerAt, appsAt, breakfastAt, ovenCap, headcount}` | Hosting events, grouped by `weekend` |
| `tasks` | `{eventId, title, detail, date, time, t, cat, who, done, recipe}` | Hosting checklist. `cat` is invites, reservations, rooms, house, food or freezer (take something out to thaw). `t` is 24h time used for ordering within a day. Each upcoming holiday weekend's tasks also show as a list at the top of Lists (`_host:<weekend>`) and as a card on Today |
| `dishes` | `{eventId, name, recipe, course, who, makeAhead, order, ready}` | Menus |
| `guests` | `{eventId, name, diet, rsvp}` | `rsvp` is yes, no or maybe |
| `extras` | `{eventId, item, detail, done}` | Supplies to buy |
| `rooms` | `{weekend, name, guests, nights, order, items}` | Guest rooms |
| `checks` | id is the event id; `{<dishId_ingredientHash>: true}` | Shop checkmarks |
| `shared` | `weather` and `calendar` (calendar covers today plus 6 days, for the Calendar view) | Hourly snapshots written by a scheduled task from Hailey's connectors (AccuWeather, Microsoft 365), so every household member sees the same weather and calendar. The page prefers live connector data when the viewer has it and falls back to these |
| `people` | `{name, color, order}` | The household. `color` is a key from PCOLORS in app.js. Tasks and list items carry `who` (a person id); tap the circle on a row to cycle who has it |
| `habits`, `habitlog` | habits: `{name, icon, order, archived}`; habitlog: id is the date, `{<habitId>: true}` | Daily habits row on Today |

Capabilities declared at publish: `db`, `user`, `sample`.

## Publishing

Publish `index.html` to the artifact URL above with `app.css`, `app.js` and `cookbook.js` as supporting files. Omit `capabilities` to keep the stored declaration.

## Local development

```
node dev/serve.js path/to/seed.json
# open http://localhost:8765/dev/harness.html
```

The seed is a JSON object keyed by collection, each a map of document id to document. Pull a fresh one from the live database when needed; it is not committed.
