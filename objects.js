'use strict';
// Built-in objects: clean geometric forms and marks. Art is neutral white with a soft
// top-light gradient; each placed object gets its own tint color in the studio.
// The bottom edge of the art is its base. height = default size (a grass blade is about 2).
// `url` loads a file instead of inline svg; `tint` is the default color for new objects.
const SHADE = `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#d6d4cd"/></linearGradient></defs>`;
const shape = (viewBox, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${SHADE}${body}</svg>`;

window.OBJECT_LIBRARY = [
  { id: 'square', name: 'Square', height: 3, tint: '#f2f1ed',
    svg: shape('0 0 200 200', `<rect width="200" height="200" rx="6" fill="url(#g)"/>`) },
  { id: 'circle', name: 'Circle', height: 3, tint: '#f2f1ed',
    svg: shape('0 0 200 200', `<circle cx="100" cy="100" r="100" fill="url(#g)"/>`) },
  { id: 'triangle', name: 'Triangle', height: 3, tint: '#f2f1ed',
    svg: shape('0 0 200 180', `<path d="M100 6 L196 176 L4 176 Z" fill="url(#g)" stroke="url(#g)" stroke-width="6" stroke-linejoin="round"/>`) },
  { id: 'ring', name: 'Ring', height: 3.2, tint: '#f2f1ed',
    svg: shape('0 0 200 200', `<circle cx="100" cy="100" r="82" fill="none" stroke="url(#g)" stroke-width="36"/>`) },
  { id: 'arch', name: 'Arch', height: 2.4, tint: '#f2f1ed',
    svg: shape('0 0 200 100', `<path d="M0 100 A100 100 0 0 1 200 100 L150 100 A50 50 0 0 0 50 100 Z" fill="url(#g)"/>`) },
  { id: 'pill', name: 'Pill', height: 4.4, tint: '#f2f1ed',
    svg: shape('0 0 100 220', `<rect width="100" height="220" rx="50" fill="url(#g)"/>`) },
  { id: 'plus', name: 'Plus', height: 3, tint: '#f2f1ed',
    svg: shape('0 0 200 200', `<path d="M70 0 H130 V70 H200 V130 H130 V200 H70 V130 H0 V70 H70 Z" fill="url(#g)"/>`) },
  { id: 'monolith', name: 'Monolith', height: 6, tint: '#1a1b1e',
    svg: shape('0 0 80 240', `<rect width="80" height="240" rx="3" fill="url(#g)"/>`) },
  // the Aleksander "A" mark from the personal brand
  { id: 'mark-a', name: 'A mark', height: 3, tint: '#f2f1ed',
    svg: shape('0 0 531 354', `<path d="M.81,352.99L143.88,66.83C164.21,26.18,205.76.5,251.22.5h102.08l176.24,352.49H255c-22.31,0-36.81-23.49-26.82-43.44l37.09-74.06h88.02l-58.75-117.5h-58.75l-117.5,234.99H.81Z" fill="url(#g)"/>`) },
  { id: 'logo', name: 'Graass mark', height: 3, tint: '#ffffff', url: 'icons/icon.svg' },
];
