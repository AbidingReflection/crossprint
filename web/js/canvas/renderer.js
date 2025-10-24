// web/js/canvas/renderer.js
import { getState } from '../data/state.js';
import { toCanvas } from './viewport.js';
import { ANCHOR_R } from '../data/constants.js';

const canvas = document.querySelector('#stage');
const ctx = canvas.getContext('2d');
const wrap = document.querySelector('#canvasWrap');

// Cache for threshold preview to avoid recomputing every rAF
let thrCache = {
    value: null,
    imgId: null,
    bitmap: null,
    w: 0,
    h: 0,
};

// Coalesced redraws
let _rafId = 0;
export function scheduleRender() {
    if (_rafId) return;
    _rafId = requestAnimationFrame(() => {
        _rafId = 0;
        render();
    });
}

function drawCrosshair(x, y) {
    const { panX, panY, zoom } = getState();
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,.6)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4,4]);
    ctx.beginPath(); ctx.moveTo(0, panY + y*zoom); ctx.lineTo(canvas.width, panY + y*zoom); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(panX + x*zoom, 0); ctx.lineTo(panX + x*zoom, canvas.height); ctx.stroke();
    ctx.restore();
}

function renderAnchors() {
    const { anchors } = getState();
    anchors.forEach((p,i)=>{
        const c = toCanvas(p);
        drawCrosshair(p.x, p.y);
        ctx.fillStyle = '#0ea5e9';
        ctx.beginPath(); ctx.arc(c.x, c.y, ANCHOR_R, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = '12px system-ui';
        ctx.fillText(String(i+1), c.x+10, c.y-10);
    });
}

function renderCrop() {
    const { crop } = getState();
    if (!crop) return;
    const L = toCanvas({x:crop.left,   y:0}).x;
    const R = toCanvas({x:crop.right,  y:0}).x;
    const T = toCanvas({x:0, y:crop.top   }).y;
    const B = toCanvas({x:0, y:crop.bottom}).y;

    ctx.save(); ctx.fillStyle = 'rgba(0,0,0,.5)';
    ctx.fillRect(0,0,canvas.width, T);
    ctx.fillRect(0,B,canvas.width, canvas.height-B);
    ctx.fillRect(0,T,L, B-T);
    ctx.fillRect(R,T,canvas.width-R, B-T);
    ctx.restore();

    ctx.save(); ctx.strokeStyle = '#22c55e'; ctx.lineWidth = 2;
    ctx.strokeRect(L,T,R-L,B-T);
    ctx.restore();
}

async function ensureThresholdPreviewBitmap() {
    const { imageBitmap, imgW, imgH, imageId, preview } = getState();
    const value = preview.thresholdValue;
    if (!imageBitmap || value == null) {
        thrCache.value = null;
        thrCache.imgId = null;
        thrCache.bitmap = null;
        return;
    }
    if (thrCache.bitmap && thrCache.value === value && thrCache.imgId === imageId) return;

    const off = new OffscreenCanvas(imgW, imgH);
    const octx = off.getContext('2d', { willReadFrequently: true });
    octx.drawImage(imageBitmap, 0, 0, imgW, imgH);
    const imgData = octx.getImageData(0, 0, imgW, imgH);
    const data = imgData.data;
    const thr = value|0;

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i+1], b = data[i+2];
        const lum = (r * 0.2126 + g * 0.7152 + b * 0.0722) | 0;
        const v = lum >= thr ? 255 : 0;
        data[i] = data[i+1] = data[i+2] = v;
    }
    octx.putImageData(imgData, 0, 0);

    const blob = await off.convertToBlob({ type: 'image/png' });
    const bmp = await createImageBitmap(blob);

    thrCache.value = value;
    thrCache.imgId = imageId;
    thrCache.bitmap = bmp;
    thrCache.w = imgW;
    thrCache.h = imgH;
}

export async function render() {
    const { imageBitmap, imgW, imgH, panX, panY, zoom, mode, preview } = getState();
    canvas.width  = wrap.clientWidth;
    canvas.height = wrap.clientHeight;

    ctx.fillStyle = '#111';
    ctx.fillRect(0,0,canvas.width, canvas.height);

    // Only show live threshold preview while actively in the Threshold tool.
    if (mode === 'threshold' && preview.thresholdValue != null) {
        await ensureThresholdPreviewBitmap();
        const bmp = thrCache.bitmap || imageBitmap;
        if (bmp) ctx.drawImage(bmp, panX, panY, imgW * zoom, imgH * zoom);
    } else if (imageBitmap) {
        ctx.drawImage(imageBitmap, panX, panY, imgW * zoom, imgH * zoom);
    }

    if (mode === 'anchors') renderAnchors();
    if (mode === 'crop')    renderCrop();
}
