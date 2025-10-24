// Thin wrapper around window.pywebview.api
async function call(name, ...args) {
    return await window.pywebview.api[name](...args);
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
