# Graass Studio

A stylized grass field drawn on the GPU with WebGL2. Steer the wind, shape the blades, change the colors, light and camera, then save an image or share a link to your scene.

Live: https://alexander-288.github.io/graass-studio/

## Run locally

It is a plain static site with no build step. Serve the folder with any static server, for example:

```bash
npx http-server -p 5181 -c-1
```

Then open http://localhost:5181.

## What you can change

- **Wind:** direction circle, gust strength, speed and size, shimmer, flutter amount and speed.
- **Blades:** height, height variety, width, tip sharpness, lean, twist, count.
- **Color:** tips in sun, tips in shade, body, roots, haze, variation, fold shading.
- **Light:** sun patch strength and size, cloud drift, brightness.
- **Objects:** place clean forms in the field (square, circle, triangle, ring, arch, pill, plus, monolith, the A mark and the Graass mark) or upload your own PNG, JPG, WebP, GIF or SVG. Drag to move; set color, size, how far it sinks into the grass and how much it flattens the grass around it. Objects always face the camera: they stand among the blades from a low angle and lie in the grass when you look straight down.
- **View:** camera height, tilt, turn, field of view, haze distance, resolution, stats.

The dock at the bottom has presets, randomize, pause, save image, copy share link and a light/dark switch for the interface. Settings are kept between visits, and a share link carries the whole scene.

Shortcuts: `H` toggles the panel, `R` randomizes, `Space` pauses, `Delete` removes the selected object, `Esc` cancels placing.

Uploaded images are kept in your browser only; share links carry the built-in objects.

## How it works

- One blade shape is drawn tens of thousands of times in a single instanced draw call.
- Blades are only placed on the ground the camera can see, thinner and bigger further away.
- Each blade bends along a smooth arc, so its length stays the same as it sways.
- Gusts are slow noise patches that travel along the wind direction.
- While paused, the scene only redraws when a setting changes.
- If the system asks for reduced motion, the sway is toned down.

## Files

- `index.html`: page, panel and dock
- `style.css`: glass interface, light and dark
- `main.js`: WebGL setup, shaders, controls and render loop
- `objects.js`: built-in object art (inline SVG)
- `icons/`, `favicon.ico`, `site.webmanifest`: app icon pack
- `tools/make_icons.py`: rebuilds the icon pack (needs Python with Pillow)

## License

MIT, see `LICENSE`.
