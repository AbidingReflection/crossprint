// web/js/api/images.js

// --- Bridge readiness & single-flight queue ---
let _readyResolve;
const _ready = new Promise(res => { _readyResolve = res; });

function _onReady() {
    if (window.pywebview?.api) _readyResolve?.();
}
// pywebview dispatches a DOM event when the bridge is injected
window.addEventListener('pywebviewready', _onReady, { once: true });
// If injected before our script loaded, resolve on next tick
queueMicrotask(_onReady);

// Single-flight queue to avoid overlapping native calls
let _q = Promise.resolve();
function _enqueue(task) {
    _q = _q.then(task, task);
    return _q;
}

// Thin wrapper around window.pywebview.api with gating + error normalization
async function call(name, ...args) {
    await _ready; // don’t touch the bridge until it exists
    return _enqueue(async () => {
        try {
            return await window.pywebview.api[name](...args);
        } catch (err) {
            const msg = (err && (err.message || err.toString())) || 'Unknown pywebview error';
            throw new Error(`[pywebview:${name}] ${msg}`);
        }
    });
}

// Load an image given a filename and raw bytes (Uint8Array).
// Should return { image_id } just like loadImage(path).
export async function loadImageFromBytes(filename, uint8) {
    // If you’re using a pywebview bridge, you might have something like:
    // const { image_id } = await window.pywebview.api.load_image_from_bytes(filename, Array.from(uint8));
    // return { image_id };

    // TEMP: If you don’t have the backend implemented yet, throw clearly:
    if (!window.pywebview || !window.pywebview.api || !window.pywebview.api.load_image_from_bytes) {
        throw new Error('Backend load_image_from_bytes not implemented');
    }
    const { image_id } = await window.pywebview.api.load_image_from_bytes(filename, Array.from(uint8));
    return { image_id };
}


export async function openFileDialog() {
    return await call('open_file_dialog');
}

export async function loadImage(path) {
    // returns { image_id, ... }
    return await call('load_image', path);
}

export async function getPreviewPng(imageId) {
    // returns data URL (string)
    return await call('get_preview_png', imageId);
}

export async function applyHomography(imageId, anchors) {
    return await call('apply_homography', imageId, anchors);
}

export async function applyCrop(imageId, crop) {
    return await call('apply_crop', imageId, crop);
}

export async function applyThreshold(imageId, mode, value) {
    // mode: 'otsu' | 'global'
    return await call('apply_threshold', imageId, mode, value);
}

export async function exportImage(imageId, outDir) {
    // returns { path }
    return await call('export_image', imageId, outDir);
}

// Optional: let callers await bridge readiness if they want
export function ready() { return _ready; }
