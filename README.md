# Spendings

A simple monthly budget tracker in British pounds (£).

- Categories are bubbles, each with a monthly budget.
- Every expense fills up its category's bubble, which shows the percentage used.
- Over budget, the bubble turns red and shows how much you overspent.
- Switch between months, view, edit and delete expenses (with Undo), and edit categories.
- From the “⋯” menu you can download a JSON backup, restore it, or export expenses to CSV.

Data lives in the browser (localStorage), so there is no server.

## Running it

Open `index.html` in a browser or start a local server:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

To use it on your phone, enable GitHub Pages for this repository
(Settings → Pages → Deploy from a branch → `main` / root), open the link on your phone
and choose “Add to Home Screen”. After that the app also works offline.

## Sync and iPhone widget

Optionally, data can sync through a secret GitHub Gist,
so it stays the same on all your devices and the widget can read it.

1. Create a token with the `gist` scope: https://github.com/settings/tokens/new?scopes=gist&description=Spendings
2. In the app open “⋯”, paste the token and tap “Connect”.
3. Install [Scriptable](https://apps.apple.com/app/scriptable/id1405459188). In Spendings tap
   “⋯” → “Copy widget script”, then in Scriptable create a new script (＋) and paste it.
4. Add a Scriptable widget (small, medium or large) to your Home Screen, tap it while editing
   and pick your script in the Script field.
   For the small widget you can put a category name in Parameter, e.g. `Groceries`.

The widget template is `scriptable-widget.js`.
