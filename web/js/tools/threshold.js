// web/js/tools/threshold.js
import { getState, setMode, setImageBitmap } from '../data/state.js';
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
    thrVal.textContent = thr.value;
    scheduleRender();
}

export function wireControls() {
    thr.addEventListener('input', ()=>{
        thrVal.textContent = thr.value;
        scheduleRender();
    });
    document.querySelector('#btn-otsu').addEventListener('click', applyOtsu);
    document.querySelector('#apply-threshold').addEventListener('click', applyManual);
}

async function applyOtsu() {
    const srcId = APPLY_THRESHOLD_FROM_CHECKPOINT ? (getCheckpoint() ?? getState().imageId)
    : (getWorking() ?? getState().imageId);
    if (!srcId) return;
    setStatus('Applying Otsu...');
    await applyThreshold(srcId, 'otsu', 0);
    await refreshPreview(srcId, 'Otsu applied');
}

async function applyManual() {
    const srcId = APPLY_THRESHOLD_FROM_CHECKPOINT ? (getCheckpoint() ?? getState().imageId)
    : (getWorking() ?? getState().imageId);
    if (!srcId) return;
    setStatus('Applying threshold...');
    await applyThreshold(srcId, 'global', parseInt(thr.value, 10));
    await refreshPreview(srcId, 'Threshold applied');
}

async function refreshPreview(imageId, doneMsg) {
    const dataUrl = await getPreviewPng(imageId);
    const bm = await createImageBitmap(await loadImage(dataUrl));
    setImageBitmap(bm);
    scheduleRender();
    setStatus(doneMsg);
}

function loadImage(url) {
    return new Promise((res, rej)=>{
        const img = new Image();
        img.onload = ()=>res(img);
        img.onerror = rej;
        img.src = url;
    });
}
