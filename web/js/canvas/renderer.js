// web/js/canvas/renderer.js
import { getState } from '../data/state.js';
import { toCanvas } from './viewport.js';
import { ANCHOR_R } from '../data/constants.js';

const canvas = document.querySelector('#stage');
const ctx = canvas.getContext('2d');
const wrap = document.querySelector('#canvasWrap');

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

export function render() {
    const { imageBitmap, imgW, imgH, panX, panY, zoom, mode } = getState();
    canvas.width  = wrap.clientWidth;
    canvas.height = wrap.clientHeight;

    ctx.fillStyle = '#111';
    ctx.fillRect(0,0,canvas.width, canvas.height);

    if (imageBitmap) {
        ctx.drawImage(imageBitmap, panX, panY, imgW * zoom, imgH * zoom);
    }

    if (mode === 'anchors') renderAnchors();
    if (mode === 'crop')    renderCrop();
}
