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
export function showCropPanel()      { hideAll(); panels.crop.classList.remove('hidden'); }
export function showThresholdPanel() { hideAll(); panels.threshold.classList.remove('hidden'); }

// Crop inputs sync
const elL = document.querySelector('#crop-left');
const elT = document.querySelector('#crop-top');
const elR = document.querySelector('#crop-right');
const elB = document.querySelector('#crop-bottom');

export function syncCropInputs() {
    const { crop } = getState();
    if (!crop) return;
    elL.value = Math.round(crop.left);
    elT.value = Math.round(crop.top);
    elR.value = Math.round(crop.right);
    elB.value = Math.round(crop.bottom);
}

export function wireCropInputs(onChange) {
    ['left','top','right','bottom'].forEach(k=>{
        const input = document.querySelector('#crop-'+k);
        input.addEventListener('change', e=>{
            const v = parseInt(e.target.value||0,10);
            const c = { ...getState().crop, [k]: v };
            setCrop(c);
            onChange?.(c);
        });
    });
}
