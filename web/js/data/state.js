// Single source of truth for app state.
const state = {
    imageId: null,
    imageBitmap: null,
    imgW: 0, imgH: 0,

    zoom: 1, panX: 0, panY: 0,
    mode: 'idle', // 'idle' | 'anchors' | 'crop' | 'threshold'

    anchors: [],  // [{x,y}] in preview/image space
    crop: null,   // {left, top, right, bottom} in preview/image space

    // Image bookkeeping for UX (drag-drop, confirm-on-dirty, status)
    image: {
        loaded: false,
        dirty: false,
        name: '',
    },

    // Tool-specific UI state
    tools: {
        threshold: {
            value: 128, // last chosen threshold value (for UI)
        },
    },

    // Preview-only state that never mutates the backend image
    preview: {
        thresholdValue: null, // when set, renderer shows live threshold preview
    },
};

export function getState() { return state; }

// Image & preview bitmaps
export function setImageBitmap(bm) {
    state.imageBitmap = bm;
    state.imgW = bm?.width || 0;
    state.imgH = bm?.height || 0;
}
export function setImageId(id) { state.imageId = id; }

// Image helpers
export function setImageLoaded(v) { state.image.loaded = !!v; }
export function setImageDirty(v)  { state.image.dirty  = !!v; }
export function setImageName(s)   { state.image.name   = s || ''; }

// Viewport
export function setViewport({ zoom, panX, panY }) {
    if (zoom !== undefined) state.zoom = zoom;
    if (panX !== undefined) state.panX = panX;
    if (panY !== undefined) state.panY = panY;
}

// Mode
export function setMode(m) { state.mode = m; }

// Anchors
export function setAnchors(arr) { state.anchors = arr; }
export function updateAnchor(i, p) { state.anchors[i] = p; }
export function pushAnchor(p) { state.anchors.push(p); }

// Crop
export function setCrop(c) { state.crop = c; }

// Threshold (tool + preview)
export function setThresholdUIValue(v) { state.tools.threshold.value = Math.max(0, Math.min(255, v|0)); }
export function setThresholdPreviewValue(vOrNull) {
    if (vOrNull === null || vOrNull === undefined) state.preview.thresholdValue = null;
    else state.preview.thresholdValue = Math.max(0, Math.min(255, vOrNull|0));
}
