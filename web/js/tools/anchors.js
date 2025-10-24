// web/js/tools/anchors.js
import { getState, setMode, setAnchors, updateAnchor, pushAnchor, setImageBitmap } from '../data/state.js';
import { applyHomography, getPreviewPng } from '../api/images.js';
import { scheduleRender } from '../canvas/renderer.js';
import { toCanvas, fromCanvas, fitToScreen } from '../canvas/viewport.js';
import { ANCHOR_R } from '../data/constants.js';
import { setStatus } from '../ui/status.js';
import { showAnchorsPanel } from '../ui/panels.js';

const canvas = document.querySelector('#stage');
let dragAnchor = null;

export function enter() {
    setMode('anchors');
    showAnchorsPanel();
    scheduleRender();
}

export function onLeftDown(e) {
    if (!getState().imageBitmap) return; // ignore if no image yet
    const rect = canvas.getBoundingClientRect();
    const p = fromCanvas({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    const { anchors, zoom } = getState();

    const hit = anchors.findIndex(a => Math.hypot(a.x - p.x, a.y - p.y) < ANCHOR_R/zoom + 4);
    if (hit >= 0) {
        dragAnchor = hit;
    } else {
        if (anchors.length < 4) { pushAnchor(p); }
        else { anchors[3] = p; } // replace last
    }
    document.querySelector('#apply-anchors').disabled = getState().anchors.length !== 4;
    scheduleRender();
}

export function onMove(e) {
    if (dragAnchor === null) return;
    const rect = canvas.getBoundingClientRect();
    const p = fromCanvas({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    updateAnchor(dragAnchor, p);
    scheduleRender();
}

export function onMouseUp() {
    dragAnchor = null;
}

export async function apply() {
    const { imageId, anchors } = getState();
    if (!imageId || anchors.length !== 4) return;
    setStatus('Applying perspective...');
    await applyHomography(imageId, anchors);
    const dataUrl = await getPreviewPng(imageId);
    await updatePreviewFromDataUrl(dataUrl);
    setAnchors([]);
    fitToScreen();
    setStatus('Perspective corrected');
    scheduleRender();
}

async function updatePreviewFromDataUrl(url) {
    const img = await loadImage(url);
    const bm = await createImageBitmap(img);
    setImageBitmap(bm);
}

function loadImage(url) {
    return new Promise((res, rej)=>{
        const img = new Image();
        img.onload = ()=>res(img);
        img.onerror = rej;
        img.src = url;
    });
}
