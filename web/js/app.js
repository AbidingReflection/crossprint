// Entry: wires DOM, state, viewport, tools, and API.
import { setStatus } from './ui/status.js';
import { enableAfterLoad, showAnchorsPanel, showCropPanel, showThresholdPanel, syncCropInputs, wireCropInputs } from './ui/panels.js';

import { getState, setImageBitmap, setImageId, setMode } from './data/state.js';
import { setCheckpoint, setWorking } from './data/history.js';

import * as API from './api/images.js';
import { render } from './canvas/renderer.js';
import { fitToScreen, zoomAtScreenPoint, panBy, fromCanvas } from './canvas/viewport.js';

import * as Anchors from './tools/anchors.js';
import * as Crop from './tools/crop.js';
import * as Threshold from './tools/threshold.js';

// DOM
const canvas = document.querySelector('#stage');
const wrap   = document.querySelector('#canvasWrap');

// Open
document.querySelector('#btn-open').addEventListener('click', async ()=>{
    const path = await API.openFileDialog();
    if (!path) return;

    setStatus('Loading image...');
    const info = await API.loadImage(path);
    setImageId(info.image_id);
    setCheckpoint(info.image_id); // initial checkpoint = loaded image
    setWorking(info.image_id);

    const dataUrl = await API.getPreviewPng(info.image_id);
    const bm = await createImageBitmap(await loadImage(dataUrl));
    setImageBitmap(bm);

    fitToScreen();
    enableAfterLoad();
    setStatus('Image loaded');
    render();
});

// Mode buttons
document.querySelector('#btn-anchors').addEventListener('click', ()=>{
    setStatus('Mode: Anchors');
    Anchors.enter();
});

document.querySelector('#btn-crop').addEventListener('click', ()=>{
    setStatus('Mode: Crop');
    Crop.enter();
});

document.querySelector('#btn-threshold').addEventListener('click', ()=>{
    setStatus('Mode: Threshold');
    Threshold.enter();
});

// Anchors apply
document.querySelector('#apply-anchors').addEventListener('click', ()=>Anchors.apply());

// Crop inputs + apply
wireCropInputs(()=>render());
document.querySelector('#apply-crop').addEventListener('click', async ()=>{
    await Crop.apply();
    // after geometry change, treat as new checkpoint
    const { imageId } = getState();
    setCheckpoint(imageId);
    setWorking(imageId);
});

// Threshold controls
Threshold.wireControls();

// Export
document.querySelector('#btn-export').addEventListener('click', async ()=>{
    const out = prompt('Output folder (absolute path):', 'output');
    if (!out) return;
    setStatus('Exporting...');
    const { imageId } = getState();
    const res = await API.exportImage(imageId, out);
    setStatus('Exported: ' + res.path);
});

// Canvas interactions
let m3Down = false;
let last = null;

canvas.addEventListener('mousedown', (e)=>{
    if (e.button === 1) {
        m3Down = true; last = { x: e.clientX, y: e.clientY }; e.preventDefault();
        return;
    }
    if (e.button === 0) {
        routeLeftDown(e);
    }
});

window.addEventListener('mouseup', ()=>{
    m3Down = false;
    // notify tools
    Anchors.onMouseUp?.();
    Crop.onMouseUp?.();
});

window.addEventListener('mousemove', (e)=>{
    if (m3Down) {
        const dx = e.clientX - last.x;
        const dy = e.clientY - last.y;
        panBy(dx, dy);
        last = { x: e.clientX, y: e.clientY };
        render();
        return;
    }
    routeMove(e);
});

wrap.addEventListener('wheel', (e)=>{
    if (!getState().imageBitmap) return;
    zoomAtScreenPoint(e.deltaY, { x: e.clientX, y: e.clientY });
    render();
});

// Resize
window.addEventListener('resize', ()=>{ fitToScreen(); render(); });

// Route events by mode
function routeLeftDown(e) {
    const { mode } = getState();
    if (mode === 'anchors')   Anchors.onLeftDown(e);
    else if (mode === 'crop') Crop.onLeftDown(e);
}

function routeMove(e) {
    const { mode } = getState();
    if (mode === 'anchors')   Anchors.onMove(e);
    else if (mode === 'crop') Crop.onMove(e);
}

// Utils
function loadImage(url) {
    return new Promise((res, rej)=>{
        const img = new Image();
        img.onload = ()=>res(img);
        img.onerror = rej;
        img.src = url;
    });
}

// Initial status
setStatus('Ready');
