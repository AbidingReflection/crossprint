from pathlib import Path
import sys
import re
import logging

import webview

from backend.api import CrossPrintAPI

ASSETS = Path(__file__).parent / "web"

logging.getLogger("pywebview").setLevel(logging.ERROR)

_NOISE = re.compile(
    r"\[pywebview\] Error while processing window\.native\.(AccessibilityObject|ControlCollection|DataBindings)"
)


class _StderrFilter:
    """Filter known noisy accessibility logs from stderr."""

    def write(self, s: str) -> None:
        if _NOISE.search(s):
            return
        sys.__stderr__.write(s)

    def flush(self) -> None:
        sys.__stderr__.flush()


sys.stderr = _StderrFilter()

if __name__ == "__main__":
    """Launch the crossPrint UI."""
    api = CrossPrintAPI()
    window = webview.create_window(
        title="crossPrint",
        url=str(ASSETS / "index.html"),
        js_api=api,
        width=1200,
        height=800,
        resizable=True,
        text_select=False,
    )
    api.set_window(window)
    webview.start(debug=True)
