# Themes — asset folder

This folder is where you (or contributors) drop the cinematic background photos
and orb sprites that the new Wisp 2.0 design system reaches for. Today
everything works **without** these PNGs — the app falls back to procedural
gradients — but adding real photos here makes the app feel like the
moodboard (Helious, Cosmos, "Journey Beyond Earth") rather than just a
gradient.

---

## What goes here

| Filename               | Purpose                                  | Recommended size | Format       |
|------------------------|------------------------------------------|------------------|--------------|
| `bg-cosmos.jpg`        | Cosmos theme: deep space, planet hint    | 2560 × 1600      | JPG (q ≥ 85) |
| `bg-sunset.jpg`        | Apus theme: dusk hills / soft sunset     | 2560 × 1600      | JPG          |
| `bg-ocean.jpg`         | Ocean theme: misty cliff / dark sea      | 2560 × 1600      | JPG          |
| `bg-forest.jpg`        | Forest theme: foggy pines, deep greens   | 2560 × 1600      | JPG          |
| `bg-sakura.jpg`        | Sakura theme: petals, warm pink dusk     | 2560 × 1600      | JPG          |
| `bg-retro.jpg`         | Retro theme: synthwave grid (optional)   | 2560 × 1600      | JPG          |
| `orb-cosmos.png`       | Cosmos orb sprite (transparent)          |  512 × 512       | PNG          |
| `orb-sunset.png`       | Sunset orb sprite                        |  512 × 512       | PNG          |
| `orb-sakura.png`       | Sakura orb sprite                        |  512 × 512       | PNG          |
| `orb-forest.png`       | Forest orb sprite                        |  512 × 512       | PNG          |

You can also drop **custom user-named files** like `bg-mountains.jpg` and the
user can pick them via Settings → Theme → "Upload PNG of background".

---

## Background composition rules (so the UI stays readable)

- **Top 30 %** of the image: keep busy / detailed (mountains, treetops,
  galaxies). The dock and titlebar live here, so contrast is fine.
- **Middle 40 %**: should be the *quietest* part of the image. The lesson body
  copy renders here, and we apply a subtle dark gradient on top.
- **Bottom 30 %**: secondary content / floating menu lives here. Keep it dark
  enough that white text on it is still readable.

If you take a photo that's mostly bright/sky, **darken the middle band by 20 %**
in your photo editor — otherwise glassmorphism cards stop looking like glass.

## Orb composition rules

- Square canvas, 512×512 minimum.
- The orb body should occupy ~75 % of the canvas (so the glow we draw behind
  it has room to breathe).
- Transparent background is required.
- Looks best when the orb has a single specular highlight at the upper-left
  (35 % from left, 25 % from top).

---

## How the user picks them

The user doesn't need to know this folder exists — inside **Settings → Theme**
they can click **"Upload PNG of orb"** or **"Upload PNG of background"** and
pick any file from disk. The file is read into memory as a base64 Data URL and
stored in `localStorage` under `wispucci_theme_overrides` so it survives
restarts.

If you want to ship presets *inside the app bundle*, add the file here and then
import it from a component with a relative path — electron-vite will copy it
into the packaged build.

---

## Constraints

- Keep background JPGs **under ~500 KB** each. Larger files bloat the
  packaged app and (when uploaded by users) blow out localStorage quota.
- Strip EXIF metadata before committing — `jpegoptim --strip-all` or
  `exiftool -all=` will do it.
- Do **not** commit images that contain identifiable faces or copyrighted
  artwork — pick from Unsplash / Pexels / Lummi / your own photography.

## Where to source good fits (free, no attribution required)

- [unsplash.com](https://unsplash.com) — search: "cosmos", "milky way",
  "dusk landscape", "foggy forest"
- [pexels.com](https://pexels.com) — search the same; bias toward dark/moody.
- [lummi.ai](https://lummi.ai) — AI-generated, vibe matches Helious/Cosmos
  moodboard especially well.

## Aesthetic reference (the look we're going for)

Think: *Helious* black serif logo on a misty mountain photo. *Russian
Platinum* interactive globe. The "Journey Beyond Earth Into the Cosmos"
italic-serif hero. Cinematic, quiet, premium — not gamer / not corporate.
