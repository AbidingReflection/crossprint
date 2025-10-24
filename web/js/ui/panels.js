import { getState, setCrop } from '../data/state.js';

const panels = {
    anchors: document.querySelector('#panel-anchors'),
    crop: document.querySelector('#panel-crop'),
    threshold: document.querySelector('#panel-threshold'),
};

export function enableAfterLoad() {
    document.querySelector('#btn-anchors').disabled = false;
    document.querySelector('#btn-crop').disabled = false;
    document.querySelector('#btn-threshold').disabled = false;
    document.querySelector('#btn-export').disabled = false;
}

function hideAll() {
    Object.values(panels).forEach(p => p.classList.add('hidden'));
}
export function showAnchorsPanel()   { hideAll(); panels.anchors.classList.remove('hidden'); }
export function showCropPanel()      { hideAll(); ensureResetButton(); ensureSliders(); panels.crop.classList.remove('hidden'); }
export function showThresholdPanel() { hideAll(); panels.threshold.classList.remove('hidden'); }

// ---- Crop inputs & sliders ----
const elL = document.querySelector('#crop-left');
const elT = document.querySelector('#crop-top');
const elR = document.querySelector('#crop-right');
const elB = document.querySelector('#crop-bottom');
const btnApply = document.querySelector('#apply-crop');

let sliderL, sliderR, sliderT, sliderB;
let slidersInitialized = false;

function ensureSliders() {
    if (slidersInitialized) return;
    const container = panels.crop.querySelector('.grid2') || panels.crop;

    // Create four sliders for each edge
    sliderL = makeSlider('Left', 'crop-slider-left');
    sliderR = makeSlider('Right', 'crop-slider-right');
    sliderT = makeSlider('Top', 'crop-slider-top');
    sliderB = makeSlider('Bottom', 'crop-slider-bottom');

    // Insert after numeric inputs for a clean stack
    container.appendChild(sliderL.wrap);
    container.appendChild(sliderT.wrap);
    container.appendChild(sliderR.wrap);
    container.appendChild(sliderB.wrap);

    // Wire slider events
    sliderL.input.addEventListener('input', () => nudgeCrop('left',  parseInt(sliderL.input.value, 10)));
    sliderR.input.addEventListener('input', () => nudgeCrop('right', parseInt(sliderR.input.value, 10)));
    sliderT.input.addEventListener('input', () => nudgeCrop('top',   parseInt(sliderT.input.value, 10)));
    sliderB.input.addEventListener('input', () => nudgeCrop('bottom',parseInt(sliderB.input.value, 10)));

    slidersInitialized = true;
    syncSlidersLimits();
}

function makeSlider(labelText, id) {
    const wrap = document.createElement('label');
    wrap.htmlFor = id;
    wrap.style.gap = '6px';
    wrap.style.flexDirection = 'column';
    wrap.style.alignItems = 'stretch';

    const title = document.createElement('span');
    title.textContent = labelText + ' (slider)';

    const input = document.createElement('input');
    input.type = 'range';
    input.id = id;
    input.min = '0';
    input.max = '1';
    input.value = '0';

    wrap.appendChild(title);
    wrap.appendChild(input);

    return { wrap, input };
}

function clampCropRect(c) {
    const { imgW, imgH } = getState();
    let left = Math.max(0, Math.min(imgW - 1, Math.floor(c.left)));
    let right = Math.max(1, Math.min(imgW, Math.floor(c.right)));
    let top = Math.max(0, Math.min(imgH - 1, Math.floor(c.top)));
    let bottom = Math.max(1, Math.min(imgH, Math.floor(c.bottom)));
    // maintain left < right and top < bottom
    if (left >= right) left = right - 1;
    if (top >= bottom) top = bottom - 1;
    return { left, right, top, bottom };
}

function nudgeCrop(edge, value) {
    const st = getState();
    if (!st.crop) return;
    const c = clampCropRect({ ...st.crop, [edge]: value });
    setCrop(c);
    setApplyEnabled(isValidCrop(c));
    syncCropInputs();    // updates numbers
    syncSliders();       // and sliders (clamped)
    if (typeof window.requestCropRender === 'function') {
        window.requestCropRender();
    }
}

function syncSlidersLimits() {
    if (!slidersInitialized) return;
    const { imgW, imgH } = getState();
    // horizontal
    sliderL.input.min = '0';
    sliderL.input.max = String(Math.max(0, imgW));
    sliderR.input.min = '0';
    sliderR.input.max = String(Math.max(0, imgW));
    // vertical
    sliderT.input.min = '0';
    sliderT.input.max = String(Math.max(0, imgH));
    sliderB.input.min = '0';
    sliderB.input.max = String(Math.max(0, imgH));
}

function syncSliders() {
    if (!slidersInitialized) return;
    const { crop } = getState();
    if (!crop) return;
    sliderL.input.value = String(Math.round(crop.left));
    sliderR.input.value = String(Math.round(crop.right));
    sliderT.input.value = String(Math.round(crop.top));
    sliderB.input.value = String(Math.round(crop.bottom));
}

export function syncCropInputs() {
    const { crop } = getState();
    if (!crop) return;
    elL.value = Math.round(crop.left);
    elT.value = Math.round(crop.top);
    elR.value = Math.round(crop.right);
    elB.value = Math.round(crop.bottom);
    setApplyEnabled(isValidCrop(crop));
    syncSlidersLimits();
    syncSliders();
}

export function wireCropInputs(onChange) {
    // Expose a render notifier the sliders can use (avoids import cycles)
    window.requestCropRender = onChange;

    ['left','top','right','bottom'].forEach(k=>{
        const input = document.querySelector('#crop-'+k);
        input.addEventListener('change', e=>{
            const v = parseInt(e.target.value||0,10);
            const c = { ...getState().crop, [k]: v };
            const clamped = clampCropRect(c);
            setCrop(clamped);
            setApplyEnabled(isValidCrop(clamped));
            syncSliders();
            onChange?.(clamped);
        });
    });
}

// Dynamically add a "Reset Crop" button (no HTML change needed)
let resetBtn;
function ensureResetButton() {
    if (resetBtn) return;
    resetBtn = document.createElement('button');
    resetBtn.id = 'reset-crop';
    resetBtn.textContent = 'Reset Crop';
    resetBtn.style.marginLeft = '8px';
    // Place next to Apply button if available, else at end of panel
    if (btnApply && btnApply.parentElement) {
        btnApply.parentElement.appendChild(resetBtn);
    } else {
        panels.crop.appendChild(resetBtn);
    }
}

// Let app.js attach a confirm handler
export function wireResetCrop(handler) {
    ensureResetButton();
    resetBtn.onclick = handler;
}

// Enable/disable Apply based on rect validity
export function setApplyEnabled(enabled) {
    if (btnApply) btnApply.disabled = !enabled;
}

function isValidCrop(crop) {
    if (!crop) return false;
    const w = Math.max(0, Math.floor(crop.right - crop.left));
    const h = Math.max(0, Math.floor(crop.bottom - crop.top));
    return w >= 1 && h >= 1;
}
