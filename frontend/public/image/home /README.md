# Home page slideshow photos

The home page no longer hardcodes its photo list. It loads `manifest.json` from
this folder on every page load (and again when the tab is refreshed or the
"Refresh photos" button is used), so adding or replacing a picture here is
enough — no code change or rebuild is needed.

## Add or change a photo

1. Drop the new image file in this folder (keep the folder name exactly
   `image/home ` — it ends with a space, which is part of the public URL).
2. Add an entry to `manifest.json`:

   ```json
   { "src": "/image/home /my-new-photo.jpg", "alt": "Short description", "focus": "center 30%" }
   ```

3. Bump `version` in `manifest.json` (for example `"2026-11-19-2"`) or use the
   "Refresh photos" button on the home page. The version is appended to image
   URLs as a cache-buster so replaced files show up immediately.

`focus` is the CSS `object-position` value, useful for portrait photos.

To serve the manifest from another website instead, set
`VITE_HERO_IMAGES_URL` to its full URL. The JSON shape is the same.
