/** CrossPrint web UI: canvas rendering, modes, and API wiring. */
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

const canvas = $('#stage');
const ctx = canvas.getContext('2d');
const wrap = $('#canvasWrap');

let imageId = null;
let imageBitmap = null;
let imgW = 0, imgH = 0;
let zoom = 1, panX = 0, panY = 0;

let mode = 'idle';

let anchors = [];
const ANCHOR_R = 8;

let crop = null;

/** Set the status text. */
function setStatus(msg){ $('#status').textContent = msg; }

/** Fit the image to the available viewport. */
function fitToScreen(){
    if (!imageBitmap) return;
    const cw = wrap.clientWidth, ch = wrap.clientHeight;
    const s = Math.min(cw / imgW, ch / imgH);
    zoom = s; panX = (cw - imgW * s) / 2; panY = (ch - imgH * s) / 2;
    render();
}

/** Convert preview point → canvas point. */
function toCanvas(p){ return { x: panX + p.x * zoom, y: panY + p.y * zoom }; }

/** Convert canvas point → preview point. */
function fromCanvas(p){ return { x: (p.x - panX)/zoom, y: (p.y - panY)/zoom }; }

/** Draw crosshair through preview-space (x,y). */
function drawCrosshair(x,y){
    ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 1; ctx.setLineDash([4,4]);
    ctx.beginPath(); ctx.moveTo(0, panY + y*zoom); ctx.lineTo(canvas.width, panY + y*zoom); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(panX + x*zoom, 0); ctx.lineTo(panX + x*zoom, canvas.height); ctx.stroke();
    ctx.restore();
}

/** Render background, image, and active overlays. */
function render(){
    canvas.width = wrap.clientWidth; canvas.height = wrap.clientHeight;
    ctx.fillStyle = '#111'; ctx.fillRect(0,0,canvas.width, canvas.height);
    if (imageBitmap){ ctx.drawImage(imageBitmap, panX, panY, imgW*zoom, imgH*zoom); }

    if (mode === 'anchors'){
        anchors.forEach((p,i)=>{
            const c = toCanvas(p);
            drawCrosshair(p.x, p.y);
            ctx.fillStyle = '#0ea5e9'; ctx.beginPath(); ctx.arc(c.x, c.y, ANCHOR_R, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#fff'; ctx.font = '12px system-ui'; ctx.fillText(String(i+1), c.x+10, c.y-10);
        });
    }

    if (mode === 'crop' && crop){
        const L = toCanvas({x:crop.left, y:0}).x;
        const R = toCanvas({x:crop.right, y:0}).x;
        const T = toCanvas({x:0, y:crop.top}).y;
        const B = toCanvas({x:0, y:crop.bottom}).y;

        ctx.save(); ctx.fillStyle='rgba(0,0,0,.5)';
        ctx.fillRect(0,0,canvas.width, T);
        ctx.fillRect(0,B,canvas.width, canvas.height-B);
        ctx.fillRect(0,T,L, B-T);
        ctx.fillRect(R,T,canvas.width-R, B-T);
        ctx.restore();

        ctx.save(); ctx.strokeStyle='#22c55e'; ctx.lineWidth=2;
        ctx.strokeRect(L,T,R-L,B-T);
        ctx.restore();
    }
}

$('#btn-open').addEventListener('click', async ()=>{
    const path = await window.pywebview.api.open_file_dialog();
    if (!path) return;

    setStatus('Loading image...');
    const info = await window.pywebview.api.load_image(path);
    imageId = info.image_id;

    const dataUrl = await window.pywebview.api.get_preview_png(imageId);
    const img = new Image();
    img.onload = ()=>{
        createImageBitmap(img).then(bm=>{
            imageBitmap = bm; imgW=bm.width; imgH=bm.height;
            fitToScreen(); enableAfterLoad(); setStatus('Image loaded');
        });
    };
    img.src = dataUrl;
});

/** Enable UI controls after an image loads. */
function enableAfterLoad(){
    $('#btn-anchors').disabled = false;
    $('#btn-crop').disabled = false;
    $('#btn-threshold').disabled = false;
    $('#btn-export').disabled = false;
}

$('#btn-anchors').addEventListener('click', ()=>{
    setStatus('Mode: Anchors');
    mode='anchors';
    $('#panel-anchors').classList.remove('hidden');
    $('#panel-crop').classList.add('hidden');
    $('#panel-threshold').classList.add('hidden');
    render();
});

$('#btn-crop').addEventListener('click', ()=>{
    setStatus('Mode: Crop');
    mode='crop';
    initCropDefault();
    $('#panel-crop').classList.remove('hidden');
    $('#panel-anchors').classList.add('hidden');
    $('#panel-threshold').classList.add('hidden');
    syncCropInputs();
    render();
});

$('#btn-threshold').addEventListener('click', ()=>{
    setStatus('Mode: Threshold');
    mode='threshold';
    $('#panel-threshold').classList.remove('hidden');
    $('#panel-anchors').classList.add('hidden');
    $('#panel-crop').classList.add('hidden');
    render();
});

wrap.addEventListener('wheel', (e)=>{
    if (!imageBitmap) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left; const my = e.clientY - rect.top;
    const before = fromCanvas({x:mx,y:my});
    const delta = Math.sign(e.deltaY) * -0.1;
    const newZoom = Math.max(0.05, Math.min(20, zoom * (1 + delta)));
    zoom = newZoom;
    const after = toCanvas(before);
    panX += mx - after.x; panY += my - after.y;
    render();
});

let m3Down = false; let last = null;
canvas.addEventListener('mousedown', (e)=>{
    if (e.button === 1){ m3Down = true; last = {x:e.clientX, y:e.clientY}; e.preventDefault(); }
    if (e.button === 0){ onLeftDown(e); }
});
window.addEventListener('mouseup', ()=>{ m3Down=false; dragAnchor=null; dragEdge=null; });
window.addEventListener('mousemove', (e)=>{
    if (m3Down){ const dx=e.clientX-last.x, dy=e.clientY-last.y; panX+=dx; panY+=dy; last={x:e.clientX,y:e.clientY}; render(); return; }
    onMove(e);
});

let dragAnchor = null;
/** Handle left mouse down by mode. */
function onLeftDown(e){
    if (mode==='anchors'){
        const p = fromCanvas({x:e.clientX - canvas.getBoundingClientRect().left, y:e.clientY - canvas.getBoundingClientRect().top});
        const hit = anchors.findIndex(a=> Math.hypot(a.x - p.x, a.y - p.y) < ANCHOR_R/zoom + 4);
        if (hit>=0){ dragAnchor = hit; }
        else {
            if (anchors.length < 4){ anchors.push(p); }
            else { anchors[3] = p; }
        }
        $('#apply-anchors').disabled = anchors.length !== 4;
        render();
    } else if (mode==='crop'){
        beginCropDrag(e);
    }
}

/** Handle mouse move by mode. */
function onMove(e){
    if (mode==='anchors' && dragAnchor!==null){
        const p = fromCanvas({x:e.clientX - canvas.getBoundingClientRect().left, y:e.clientY - canvas.getBoundingClientRect().top});
        anchors[dragAnchor] = p; render();
    }
    if (mode==='crop'){ dragCrop(e); }
}

$('#apply-anchors').addEventListener('click', async ()=>{
    if (!imageId || anchors.length!==4) return;
    setStatus('Applying perspective...');
    await window.pywebview.api.apply_homography(imageId, anchors);
    const dataUrl = await window.pywebview.api.get_preview_png(imageId);
    const img = new Image();
    img.onload = ()=>{ createImageBitmap(img).then(bm=>{ imageBitmap = bm; imgW=bm.width; imgH=bm.height; anchors=[]; fitToScreen(); setStatus('Perspective corrected'); }); };
    img.src = dataUrl;
});

/** Initialize crop rectangle to full image. */
function initCropDefault(){
    if (!imageBitmap) return;
    crop = { left: 0, top: 0, right: imgW, bottom: imgH };
}

/** Sync crop inputs from current crop rectangle. */
function syncCropInputs(){
    $('#crop-left').value = Math.round(crop.left);
    $('#crop-top').value = Math.round(crop.top);
    $('#crop-right').value = Math.round(crop.right);
    $('#crop-bottom').value = Math.round(crop.bottom);
}

['left','top','right','bottom'].forEach(k=>{
    $('#crop-'+k).addEventListener('change', (e)=>{ crop[k] = parseInt(e.target.value||0,10); render(); });
});

let dragEdge = null;
/** Begin crop edge drag if within tolerance. */
function beginCropDrag(e){
    const p = fromCanvas({x:e.clientX - canvas.getBoundingClientRect().left, y:e.clientY - canvas.getBoundingClientRect().top});
    const L = Math.abs(p.x - crop.left), R = Math.abs(p.x - crop.right), T = Math.abs(p.y - crop.top), B = Math.abs(p.y - crop.bottom);
    const tol = 8/zoom;
    if (L<tol) dragEdge='L'; else if (R<tol) dragEdge='R'; else if (T<tol) dragEdge='T'; else if (B<tol) dragEdge='B'; else dragEdge=null;
}

/** Update crop during drag with bounds and ordering. */
function dragCrop(e){
    if (!dragEdge) return;
    const p = fromCanvas({x:e.clientX - canvas.getBoundingClientRect().left, y:e.clientY - canvas.getBoundingClientRect().top});
    if (dragEdge==='L') crop.left = Math.min(Math.max(0, p.x), crop.right-1);
    if (dragEdge==='R') crop.right = Math.max(Math.min(imgW, p.x), crop.left+1);
    if (dragEdge==='T') crop.top = Math.min(Math.max(0, p.y), crop.bottom-1);
    if (dragEdge==='B') crop.bottom = Math.max(Math.min(imgH, p.y), crop.top+1);
    syncCropInputs(); render();
}

$('#apply-crop').addEventListener('click', async ()=>{
    if (!imageId || !crop) return;
    setStatus('Cropping...');
    await window.pywebview.api.apply_crop(imageId, crop);
    const dataUrl = await window.pywebview.api.get_preview_png(imageId);
    const img = new Image();
    img.onload = ()=>{ createImageBitmap(img).then(bm=>{ imageBitmap = bm; imgW=bm.width; imgH=bm.height; fitToScreen(); setStatus('Cropped'); }); };
    img.src = dataUrl;
});

const thr = $('#thr'); const thrVal = $('#thr-val');
thr.addEventListener('input', ()=>{ thrVal.textContent = thr.value; render(); });

$('#btn-otsu').addEventListener('click', async ()=>{
    if (!imageId) return; setStatus('Applying Otsu...');
    await window.pywebview.api.apply_threshold(imageId, 'otsu', 0);
    const dataUrl = await window.pywebview.api.get_preview_png(imageId);
    const img = new Image();
    img.onload = ()=>{ createImageBitmap(img).then(bm=>{ imageBitmap = bm; imgW=bm.width; imgH=bm.height; render(); setStatus('Otsu applied'); }); };
    img.src = dataUrl;
});

$('#apply-threshold').addEventListener('click', async ()=>{
    if (!imageId) return; setStatus('Applying threshold...');
    await window.pywebview.api.apply_threshold(imageId, 'global', parseInt(thr.value,10));
    const dataUrl = await window.pywebview.api.get_preview_png(imageId);
    const img = new Image();
    img.onload = ()=>{ createImageBitmap(img).then(bm=>{ imageBitmap = bm; imgW=bm.width; imgH=bm.height; render(); setStatus('Threshold applied'); }); };
    img.src = dataUrl;
});

$('#btn-export').addEventListener('click', async ()=>{
    const out = prompt('Output folder (absolute path):', 'output');
    if (!out) return;
    setStatus('Exporting...');
    const res = await window.pywebview.api.export_image(imageId, out);
    setStatus('Exported: ' + res.path);
});

window.addEventListener('resize', fitToScreen);
