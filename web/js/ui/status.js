const statusEl = document.querySelector('#status');
export function setStatus(msg) {
    if (statusEl) statusEl.textContent = msg;
}
