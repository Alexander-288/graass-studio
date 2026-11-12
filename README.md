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
- **View:** camera height, tilt, turn, field of view, haze distance, resolution, stats.

The dock at the bottom has presets, randomize, pause, save image, copy share link and a light/dark switch for the interface. Settings are kept between visits, and a share link carries the whole scene.

Shortcuts: `H` toggles the panel, `R` randomizes, `Space` pauses.

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

## License

MIT, see `LICENSE`.
