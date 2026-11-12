'use strict';
// Built-in objects: abstract things that don't belong in a field, which is the point.
// Each card faces the camera; the bottom edge of the art is its base.
// height = default size in world units (a grass blade is about 2). `url` loads a file instead of inline svg.
window.OBJECT_LIBRARY = [
  { id: 'orb', name: 'Orb', height: 3, svg: `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <defs>
    <radialGradient id="g" cx="0.36" cy="0.32" r="0.75"><stop offset="0" stop-color="#ffd1f0"/><stop offset="0.45" stop-color="#ff6fb5"/><stop offset="1" stop-color="#6a2bd9"/></radialGradient>
    <radialGradient id="h" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#fff" stop-opacity="0.95"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
  </defs>
  <circle cx="100" cy="100" r="96" fill="url(#g)"/>
  <ellipse cx="70" cy="62" rx="34" ry="22" fill="url(#h)" transform="rotate(-30 70 62)"/>
  <path d="M30 128 A80 80 0 0 0 170 128" fill="none" stroke="#fff" stroke-opacity="0.25" stroke-width="4" stroke-linecap="round"/>
</svg>` },
  { id: 'blob', name: 'Blob', height: 3.4, svg: `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 200">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffb347"/><stop offset="0.55" stop-color="#ff5e62"/><stop offset="1" stop-color="#d6246e"/></linearGradient></defs>
  <path d="M112 8 C160 4 210 36 214 88 C218 136 186 196 120 196 C64 196 18 170 8 120 C-2 72 46 12 112 8 Z" fill="url(#g)"/>
  <path d="M60 52 C80 34 110 30 128 38 C104 44 82 58 70 78 C62 72 56 62 60 52 Z" fill="#fff" fill-opacity="0.55"/>
  <circle cx="150" cy="60" r="7" fill="#fff" fill-opacity="0.6"/>
</svg>` },
  { id: 'ring', name: 'Ring', height: 3.6, svg: `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff3b0"/><stop offset="0.4" stop-color="#f6c343"/><stop offset="1" stop-color="#b8741a"/></linearGradient></defs>
  <circle cx="100" cy="100" r="78" fill="none" stroke="url(#g)" stroke-width="34"/>
  <path d="M46 70 A64 64 0 0 1 112 38" fill="none" stroke="#fff" stroke-opacity="0.7" stroke-width="8" stroke-linecap="round"/>
</svg>` },
  { id: 'cube', name: 'Cube', height: 3.2, svg: `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 220">
  <path d="M100 8 L188 56 L100 104 L12 56 Z" fill="#f4f6fb"/>
  <path d="M12 56 L100 104 L100 212 L12 164 Z" fill="#c9d0e4"/>
  <path d="M188 56 L100 104 L100 212 L188 164 Z" fill="#8e98bd"/>
  <path d="M100 104 L100 212" stroke="#fff" stroke-opacity="0.35" stroke-width="2"/>
</svg>` },
  { id: 'star', name: 'Star sticker', height: 3, svg: `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 210">
  <path d="M110 14 L138 76 L204 82 L154 126 L170 192 L110 158 L50 192 L66 126 L16 82 L82 76 Z" fill="#fff" stroke="#fff" stroke-width="22" stroke-linejoin="round"/>
  <path d="M110 14 L138 76 L204 82 L154 126 L170 192 L110 158 L50 192 L66 126 L16 82 L82 76 Z" fill="#ffd23f" stroke="#ffd23f" stroke-width="6" stroke-linejoin="round"/>
  <path d="M110 40 L128 82 L110 140 Z" fill="#fff" fill-opacity="0.4"/>
</svg>` },
  { id: 'arch', name: 'Arch', height: 3.4, svg: `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 130">
  <path d="M10 130 A110 110 0 0 1 230 130" fill="none" stroke="#a9cbef" stroke-width="22"/>
  <path d="M32 130 A88 88 0 0 1 208 130" fill="none" stroke="#eef2f6" stroke-width="22"/>
  <path d="M54 130 A66 66 0 0 1 186 130" fill="none" stroke="#ffc9a8" stroke-width="22"/>
  <path d="M76 130 A44 44 0 0 1 164 130" fill="none" stroke="#f08a7e" stroke-width="22"/>
</svg>` },
  { id: 'meditator', name: 'Meditator', height: 4.2, svg: `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 240">
  <ellipse cx="110" cy="206" rx="104" ry="32" fill="#2b2f3a"/>
  <path d="M60 196 C70 150 76 112 110 108 C144 112 150 150 160 196 Z" fill="#e9d8c4"/>
  <path d="M110 108 C144 112 150 150 160 196 L110 196 Z" fill="#cdb79c"/>
  <path d="M68 132 C40 160 34 192 52 204 M152 132 C180 160 186 192 168 204" fill="none" stroke="#e9d8c4" stroke-width="18" stroke-linecap="round"/>
  <circle cx="110" cy="70" r="36" fill="#e9d8c4"/>
  <path d="M110 34 A36 36 0 0 1 110 106 Z" fill="#cdb79c"/>
  <path d="M96 72 H104 M116 72 H124" stroke="#2b2f3a" stroke-width="3" stroke-linecap="round"/>
</svg>` },
  { id: 'logo', name: 'Graass logo', height: 3.4, url: 'icons/icon.svg' },
];
