// web/js/app.js
// Entry: wires DOM, state, viewport, tools, and API with startup/paint gating.

import { setStatus } from './ui/status.js';
import { enableAfterLoad, wireCropInputs } from './ui/panels.js';

import {
    getState,
    setImageBitmap,
    setImageId,
    setImageLoaded,
    setImageDirty,
    setImageName,
} from './data/state.js';
import { setCheckpoint, setWorking } from './data/history.js';

import * as API from './api/images.js';
import { scheduleRender } from './canvas/renderer.js';
import { fitToScreen, zoomAtScreenPoint, panBy } from './canvas/viewport.js';

import * as Anchors from './tools/anchors.js';
import * as Crop from './tools/crop.js';
import * as Threshold from './tools/threshold.js';

// DOM
const canvas = document.querySelector('#stage');
const wrap   = document.querySelector('#canvasWrap');
const dropOverlay = document.querySelector('#dropOverlay');

// ----- Startup gate: DOM ready + pywebview bridge ready -----
(async function startup() {
    if (document.readyState === 'loading') {
        await new Promise(r => document.addEventListener('DOMContentLoaded', r, { once: true }));
    }
    if (API.ready) { await API.ready(); } // wait for bridge so early clicks can’t race native calls

    wireUI();
    setStatus('Ready');
})();

// ----- Wire UI AFTER readiness -----
function wireUI() {
    // Open
    document.querySelector('#btn-open').addEventListener('click', onOpen);

    // Mode buttons
    document.querySelector('#btn-anchors').addEventListener('click', ()=>{
        setStatus('Mode: Anchors');
        Anchors.enter?.();
    });

    document.querySelector('#btn-crop').addEventListener('click', ()=>{
        setStatus('Mode: Crop');
        Crop.enter?.();
    });

    document.querySelector('#btn-threshold').addEventListener('click', ()=>{
        setStatus('Mode: Threshold');
        Threshold.enter?.();
    });

    // Anchors apply -> mark dirty + checkpoint
    const btnApplyAnchors = document.querySelector('#apply-anchors');
    if (btnApplyAnchors) {
        btnApplyAnchors.addEventListener('click', async ()=>{
            await Anchors.apply?.();
            const { imageId } = getState();
            setCheckpoint(imageId);
            setWorking(imageId);
            setImageDirty(true);       // <<< ensure confirm-on-open triggers
            scheduleRender();
        });
    }

    // Crop inputs + apply -> mark dirty + checkpoint
    wireCropInputs(()=>scheduleRender());
    document.querySelector('#apply-crop').addEventListener('click', async ()=>{
        await Crop.apply?.();
        const { imageId } = getState();
        setCheckpoint(imageId);
        setWorking(imageId);
        setImageDirty(true);           // <<< ensure confirm-on-open triggers
        scheduleRender();
    });

    // Threshold apply -> mark dirty + checkpoint
    const btnApplyThreshold = document.querySelector('#apply-threshold');
    if (btnApplyThreshold) {
        btnApplyThreshold.addEventListener('click', async ()=>{
            if (typeof Threshold.apply === 'function') {
                await Threshold.apply('global'); // or omit arg if your apply() reads UI state
            }
            const { imageId } = getState();
            setCheckpoint(imageId);
            setWorking(imageId);
            setImageDirty(true);       // <<< ensure confirm-on-open triggers
            scheduleRender();
        });
    }

    // Optional: wireControls if your threshold UI needs it
    Threshold.wireControls?.();

    // Export (non-blocking)
    document.querySelector('#btn-export').addEventListener('click', onExport);

    // Canvas interactions
    wireCanvasInteractions();

    // Drag & Drop
    wireDragAndDrop();

    // Resize: rAF-coalesced
    let resizePending = false;
    window.addEventListener('resize', ()=>{
        if (resizePending) return;
        resizePending = true;
        requestAnimationFrame(()=>{
            resizePending = false;
            fitToScreen();
            scheduleRender();
        });
    });
}

// ----- Handlers -----
async function onOpen() {
    const path = await API.openFileDialog();
    if (!path) return;
    await openFromSource({ path, displayName: path.split(/[\\/]/).pop() || 'image' });
}

async function onExport() {
    const out = 'output';
    setStatus('Exporting...');
    const { imageId } = getState();
    const res = await API.exportImage(imageId, out);
    setStatus('Exported: ' + res.path);
}

// ----- Unified open flow for both dialog and drag-drop -----
async function openFromSource({ path, file, displayName }) {
    // Confirm if there are unsaved edits
    const st = getState();
    if (st.image?.loaded && st.image?.dirty) {
        const ok = window.confirm('Open a new image? Unsaved changes will be lost.');
        if (!ok) return;
    }

    setStatus('Loading image...');
    let info;
    try {
        if (path) {
            info = await API.loadImage(path);
        } else if (file) {
            const buf = await file.arrayBuffer();
            info = await API.loadImageFromBytes(file.name, new Uint8Array(buf));
        } else {
            throw new Error('No source provided');
        }
    } catch (e) {
        console.error(e);
        setStatus('Failed to load image');
        return;
    }

    setImageId(info.image_id);
    setCheckpoint(info.image_id);
    setWorking(info.image_id);

    const dataUrl = await API.getPreviewPng(info.image_id);
    const bm = await createImageBitmap(await loadImage(dataUrl));
    setImageBitmap(bm);

    // Bookkeeping for UX
    setImageLoaded(true);
    setImageDirty(false);                          // reset on successful open
    setImageName(displayName || file?.name || '');

    fitToScreen();
    enableAfterLoad();
    setStatus(`Image loaded${(displayName || file?.name) ? ': ' + (displayName || file?.name) : ''}`);
    scheduleRender();
}

// ----- Canvas interactions (all coalesced) -----
function wireCanvasInteractions() {
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
        Anchors.onMouseUp?.();
        Crop.onMouseUp?.();
    });

    window.addEventListener('mousemove', (e)=>{
        if (m3Down) {
            const dx = e.clientX - last.x;
            const dy = e.clientY - last.y;
            panBy(dx, dy);
            last = { x: e.clientX, y: e.clientY };
            scheduleRender();
            return;
        }
        routeMove(e);
    });

    wrap.addEventListener('wheel', (e)=>{
        if (!getState().imageBitmap) return;
        e.preventDefault();
        zoomAtScreenPoint(e.deltaY, { x: e.clientX, y: e.clientY });
        scheduleRender();
    }, { passive: false });
}

// Drag & Drop interactions
function wireDragAndDrop() {
    window.addEventListener('dragover', (e)=>{
        e.preventDefault();
        dropOverlay?.classList.remove('hidden');
    });

    window.addEventListener('dragenter', (e)=>{
        e.preventDefault();
        dropOverlay?.classList.remove('hidden');
    });

    window.addEventListener('dragleave', (e)=>{
        const to = e.relatedTarget;
        if (!to || !wrap.contains(to)) {
            dropOverlay?.classList.add('hidden');
        }
    });

    window.addEventListener('drop', async (e)=>{
        e.preventDefault();
        dropOverlay?.classList.add('hidden');

        const dt = e.dataTransfer;
        if (!dt || !dt.files || dt.files.length === 0) return;
        const file = dt.files[0];

        if (!/image\/(png|jpeg|jpg|webp|bmp)/i.test(file.type) && !/\.(png|jpe?g|webp|bmp)$/i.test(file.name)) {
            setStatus('Unsupported file type');
            return;
        }

        await openFromSource({ file, displayName: file.name });
    });
}

// Route events by mode
function routeLeftDown(e) {
    const { mode } = getState();
    if (mode === 'anchors')   Anchors.onLeftDown?.(e);
    else if (mode === 'crop') Crop.onLeftDown?.(e);
}

function routeMove(e) {
    const { mode } = getState();
    if (mode === 'anchors')   Anchors.onMove?.(e);
    else if (mode === 'crop') Crop.onMove?.(e);
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
