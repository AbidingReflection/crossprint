import { getState, setViewport } from '../data/state.js';
import { MIN_ZOOM, MAX_ZOOM } from '../data/constants.js';

const wrap = document.querySelector('#canvasWrap');

export function toCanvas(p) {
    const { panX, panY, zoom } = getState();
    return { x: panX + p.x * zoom, y: panY + p.y * zoom };
}

export function fromCanvas(p) {
    const { panX, panY, zoom } = getState();
    return { x: (p.x - panX)/zoom, y: (p.y - panY)/zoom };
}

export function fitToScreen() {
    const { imageBitmap, imgW, imgH } = getState();
    if (!imageBitmap) return;
    const cw = wrap.clientWidth, ch = wrap.clientHeight;
    const s = Math.min(cw / imgW, ch / imgH);
    setViewport({
        zoom: s,
        panX: (cw - imgW * s) / 2,
                panY: (ch - imgH * s) / 2
    });
}

export function zoomAtScreenPoint(deltaY, screenPoint) {
    const { zoom } = getState();
    const rect = getCanvas().getBoundingClientRect();
    const mx = screenPoint.x - rect.left;
    const my = screenPoint.y - rect.top;

    const before = fromCanvas({ x: mx, y: my });
    const delta = Math.sign(deltaY) * -0.1;
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * (1 + delta)));

    // apply new zoom
    setViewport({ zoom: newZoom });

    const after = toCanvas(before);
    // adjust pan to keep cursor-anchored zoom
    const { panX, panY } = getState();
    setViewport({ panX: panX + mx - after.x, panY: panY + my - after.y });
}

export function panBy(dx, dy) {
    const { panX, panY } = getState();
    setViewport({ panX: panX + dx, panY: panY + dy });
}

// Local helper to get canvas
function getCanvas() { return document.querySelector('#stage'); }

// Expose wrap for consumers that need layout info
export function getWrapEl() { return wrap; }
