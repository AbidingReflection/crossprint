# app.py
from pathlib import Path
import logging
import webview

from backend.api import CrossPrintAPI

ASSETS = Path(__file__).parent / "web"

# Keep pywebview logging reasonable during diagnosis
logging.getLogger("pywebview").setLevel(logging.INFO)

def on_loaded(win: webview.Window):
    print("[on_loaded] WebView DOM loaded; showing window…")
    try:
        win.show()
    except Exception as e:
        print(f"[on_loaded] window.show() raised: {e!r}")

if __name__ == "__main__":
    print("[main] Creating API and window…")
    api = CrossPrintAPI()

    window = webview.create_window(
        title="crossPrint",
        url=str(ASSETS / "index.html"),
        js_api=api,
        width=1200,
        height=800,
        resizable=True,
        text_select=False,
        hidden=True,      # start hidden to avoid early interaction
        # NOTE: 'allow_file_drop' is not supported in pywebview 6.1
    )
    api.set_window(window)

    print("[main] Starting GUI loop (http_server=True)…")
    webview.start(
        on_loaded,
        args=(window,),
        debug=False,
        http_server=True,
        # Don't force a GUI backend; let pywebview choose
        # gui="edgechromium",
    )
    print("[main] webview.start() returned.")
