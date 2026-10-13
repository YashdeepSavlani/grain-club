# Grain Club

A retro film and digicam camera that runs in the phone browser.

- `site/index.html` is the whole app in one file. Netlify publishes the `site` folder.
- `src/` holds the parts it is built from: `head.html` (styles and markup), `engine.js` (film looks, frames, date stamps) and `app.js` (camera, roll, settings).
- `python3 build.py` rebuilds `site/index.html` from `src/`.
- `site/manifest.webmanifest`, `site/sw.js` and the `site/icon-*.png` files make it installable from Safari (Share, then Add to Home Screen) and let it open offline. `python3 tools/make_icons.py` redraws the icons.

Photos are stored only in the browser on the device that took them.

## iPhone app (ios/)

A native SwiftUI and Metal version lives in `ios/`. Pushing to the `ios` or `main` branch builds it on a GitHub Mac (`.github/workflows/ios.yml`) and publishes an unsigned `GrainClub.ipa` as the `ios-latest` release. Install it from Windows with Sideloadly, which signs it with your own Apple ID (a free Apple ID's signature lasts 7 days). The build log of the latest run is kept on the `ci-logs` branch.
