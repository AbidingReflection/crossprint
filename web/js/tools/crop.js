// web/js/tools/crop.js
import { getState, setMode, setCrop, setImageBitmap } from '../data/state.js';
import { scheduleRender } from '../canvas/renderer.js';
import { fromCanvas, fitToScreen } from '../canvas/viewport.js';
import { applyCrop, getPreviewPng } from '../api/images.js';
import { showCropPanel, syncCropInputs, setApplyEnabled } from '../ui/panels.js';
import { setStatus } from '../ui/status.js';

const canvas = document.querySelector('#stage');
let dragEdge = null;

export function enter() {
    const st = getState();
    setMode('crop');

    // Do NOT reset existing handles; only create defaults if none exist
    if (!st.crop && st.imageBitmap) {
        setCrop({ left: 0, top: 0, right: st.imgW, bottom: st.imgH });
    }

    showCropPanel();
    syncCropInputs();
    setApplyEnabled(isValidCrop(getState().crop));
    scheduleRender();
}

// Top menu action: context-aware (enter or apply)
export async function topMenuAction() {
    const st = getState();
    if (st.mode === 'crop') {
        if (isValidCrop(st.crop)) {
            await apply();
        } else {
            setStatus('No valid crop region yet.');
            showCropPanel();
            syncCropInputs();
            setApplyEnabled(false);
        }
    } else {
        enter();
        setStatus('Mode: Crop');
    }
}

export function resetToFull() {
    const st = getState();
    if (!st.imageBitmap) return;
    setCrop({ left: 0, top: 0, right: st.imgW, bottom: st.imgH });
    syncCropInputs();
    setApplyEnabled(isValidCrop(getState().crop));
    scheduleRender();
}

export function onLeftDown(e) {
    const { crop, imageBitmap } = getState();
    if (!imageBitmap || !crop) return;
    const rect = canvas.getBoundingClientRect();
    const p = fromCanvas({ x: e.clientX - rect.left, y: e.clientY - rect.top });

    const L = Math.abs(p.x - crop.left);
    const R = Math.abs(p.x - crop.right);
    const T = Math.abs(p.y - crop.top);
    const B = Math.abs(p.y - crop.bottom);
    const tol = 8 / getState().zoom;

    if (L < tol) dragEdge = 'L';
    else if (R < tol) dragEdge = 'R';
    else if (T < tol) dragEdge = 'T';
    else if (B < tol) dragEdge = 'B';
    else dragEdge = null;
}

export function onMove(e) {
    if (!dragEdge) return;
    const rect = canvas.getBoundingClientRect();
    const p = fromCanvas({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    const { imgW, imgH, crop } = getState();
    if (!crop) return;

    let { left, right, top, bottom } = crop;
    if (dragEdge === 'L') left   = Math.min(Math.max(0, p.x), right - 1);
    if (dragEdge === 'R') right  = Math.max(Math.min(imgW, p.x), left + 1);
    if (dragEdge === 'T') top    = Math.min(Math.max(0, p.y), bottom - 1);
    if (dragEdge === 'B') bottom = Math.max(Math.min(imgH, p.y), top + 1);

    setCrop({ left, right, top, bottom });
    syncCropInputs();
    setApplyEnabled(isValidCrop(getState().crop));
    scheduleRender();
}

export function onMouseUp() { dragEdge = null; }

export async function apply() {
    const { imageId, crop } = getState();
    if (!imageId || !isValidCrop(crop)) return;
    setStatus('Cropping...');
    await applyCrop(imageId, crop);

    // Refresh preview
    const dataUrl = await getPreviewPng(imageId);
    const bm = await createImageBitmap(await loadImage(dataUrl));
    setImageBitmap(bm);
    fitToScreen();

    // After any crop apply: reset handles to full image
    resetToFull();

    setStatus('Cropped');
    scheduleRender();
}

function isValidCrop(crop) {
    if (!crop) return false;
    const w = Math.max(0, Math.floor(crop.right - crop.left));
    const h = Math.max(0, Math.floor(crop.bottom - crop.top));
    return w >= 1 && h >= 1;
}

function loadImage(url) {
    return new Promise((res, rej)=>{
        const img = new Image();
        img.onload = ()=>res(img);
        img.onerror = rej;
        img.src = url;
    });
}
