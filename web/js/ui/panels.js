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
export function showCropPanel()      { hideAll(); ensureResetButton(); panels.crop.classList.remove('hidden'); }
export function showThresholdPanel() { hideAll(); panels.threshold.classList.remove('hidden'); }

// Crop inputs sync
const elL = document.querySelector('#crop-left');
const elT = document.querySelector('#crop-top');
const elR = document.querySelector('#crop-right');
const elB = document.querySelector('#crop-bottom');
const btnApply = document.querySelector('#apply-crop');

export function syncCropInputs() {
    const { crop } = getState();
    if (!crop) return;
    elL.value = Math.round(crop.left);
    elT.value = Math.round(crop.top);
    elR.value = Math.round(crop.right);
    elB.value = Math.round(crop.bottom);
    setApplyEnabled(isValidCrop(crop));
}

export function wireCropInputs(onChange) {
    ['left','top','right','bottom'].forEach(k=>{
        const input = document.querySelector('#crop-'+k);
        input.addEventListener('change', e=>{
            const v = parseInt(e.target.value||0,10);
            const c = { ...getState().crop, [k]: v };
            setCrop(c);
            setApplyEnabled(isValidCrop(c));
            onChange?.(c);
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
