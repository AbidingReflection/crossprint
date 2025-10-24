// web/js/tools/threshold.js
import {
    getState,
    setMode,
    setImageBitmap,
    setThresholdUIValue,
    setThresholdPreviewValue,
} from '../data/state.js';
import { getCheckpoint, getWorking, APPLY_THRESHOLD_FROM_CHECKPOINT } from '../data/history.js';
import { applyThreshold, getPreviewPng } from '../api/images.js';
import { scheduleRender } from '../canvas/renderer.js';
import { showThresholdPanel } from '../ui/panels.js';
import { setStatus } from '../ui/status.js';

const thr = document.querySelector('#thr');
const thrVal = document.querySelector('#thr-val');

export function enter() {
    setMode('threshold');
    showThresholdPanel();

    // Sync UI with last chosen value, but DO NOT enable preview yet.
    const v = getState().tools.threshold.value ?? 128;
    thr.value = String(v);
    thrVal.textContent = String(v);

    // Leave preview off until the user moves the slider or clicks Auto.
    setThresholdPreviewValue(null);
    scheduleRender();
}

export function wireControls() {
    // Slider movement enables non-destructive live preview
    thr.addEventListener('input', ()=>{
        const v = parseInt(thr.value, 10) | 0;
        setThresholdUIValue(v);          // remember UI choice
        setThresholdPreviewValue(v);     // show live preview (from original)
    thrVal.textContent = String(v);
    setStatus(`Threshold: ${v}`);
    scheduleRender();
    });

    // Auto (Otsu): compute, then populate slider + preview (but don't commit)
    document.querySelector('#btn-otsu').addEventListener('click', async ()=>{
        const v = await computeOtsuOnCurrentBitmap();
        if (v == null) return;
        thr.value = String(v);
        thrVal.textContent = String(v);
        setThresholdUIValue(v);
        setThresholdPreviewValue(v);   // live preview only
        setStatus(`Otsu: ${v}`);
        scheduleRender();
    });

    // Apply commits the current slider value, then clears preview
    document.querySelector('#apply-threshold').addEventListener('click', applyManual);
}

async function applyManual() {
    const srcId = APPLY_THRESHOLD_FROM_CHECKPOINT
    ? (getCheckpoint() ?? getState().imageId)
    : (getWorking() ?? getState().imageId);
    if (!srcId) return;
    const v = parseInt(thr.value, 10) | 0;

    setStatus('Applying threshold...');
    await applyThreshold(srcId, 'global', v);

    // Refresh from backend and clear ephemeral preview
    await refreshPreview(srcId, 'Threshold applied');
    setThresholdPreviewValue(null);
    scheduleRender();
}

async function refreshPreview(imageId, doneMsg) {
    const dataUrl = await getPreviewPng(imageId);
    const bm = await createImageBitmap(await loadImage(dataUrl));
    setImageBitmap(bm);
    setStatus(doneMsg);
}

// Compute Otsu on a downscaled copy of current bitmap (fast, client-side)
async function computeOtsuOnCurrentBitmap() {
    const st = getState();
    const bmp = st.imageBitmap;
    if (!bmp) return null;

    const maxSide = 512;
    const scale = Math.min(1, maxSide / Math.max(st.imgW, st.imgH));
    const W = Math.max(1, Math.round(st.imgW * scale));
    const H = Math.max(1, Math.round(st.imgH * scale));

    const off = new OffscreenCanvas(W, H);
    const octx = off.getContext('2d', { willReadFrequently: true });
    octx.drawImage(bmp, 0, 0, W, H);
    const imgData = octx.getImageData(0, 0, W, H);
    const hist = new Uint32Array(256);

    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i+1], b = data[i+2];
        const lum = (r * 0.2126 + g * 0.7152 + b * 0.0722) | 0;
        hist[lum] += 1;
    }

    const total = W * H;
    let sum = 0;
    for (let t = 0; t < 256; t++) sum += t * hist[t];

    let sumB = 0, wB = 0, varMax = -1, threshold = 128;
    for (let t = 0; t < 256; t++) {
        wB += hist[t];
        if (wB === 0) continue;
        const wF = total - wB;
        if (wF === 0) break;
        sumB += t * hist[t];
        const mB = sumB / wB;
        const mF = (sum - sumB) / wF;
        const between = wB * wF * (mB - mF) * (mB - mF);
        if (between > varMax) { varMax = between; threshold = t; }
    }
    return threshold | 0;
}

function loadImage(url) {
    return new Promise((res, rej)=>{
        const img = new Image();
        img.onload = ()=>res(img);
        img.onerror = rej;
        img.src = url;
    });
}
