# Grain Club

A retro film and digicam camera that runs in the phone browser.

- `site/index.html` is the whole app in one file. Netlify publishes the `site` folder.
- `src/` holds the parts it is built from: `head.html` (styles and markup), `engine.js` (film looks, frames, date stamps) and `app.js` (camera, roll, settings).
- `python3 build.py` rebuilds `site/index.html` from `src/`.

Photos are stored only in the browser on the device that took them.
