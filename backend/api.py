from __future__ import annotations
from pathlib import Path
from typing import Dict, Any, List
import base64
from io import BytesIO

import webview
from webview import FileDialog
from PIL import Image

from .image_store import ImageStore
from .image_ops import (
    enforce_exif_orientation,
    warp_projective_full_canvas,
    crop_axis_aligned,
    threshold_global,
    threshold_otsu,
    export_png,
)


class CrossPrintAPI:
    """Expose image operations to the UI via a simple Python API."""

    def __init__(self):
        """Initialize image store and window state."""
        self.store = ImageStore()
        self.last_output_dir: Path | None = None
        self.window: webview.Window | None = None

    def set_window(self, window: webview.Window) -> None:
        """Bind the API to a webview window."""
        self.window = window

    def open_file_dialog(self) -> str | None:
        """Open a file dialog anchored at ./input and return the selected path."""
        if not self.window:
            return None
        script_home = Path(__file__).resolve().parent.parent
        input_dir = script_home / "input"
        input_dir.mkdir(exist_ok=True)
        result = self.window.create_file_dialog(
            FileDialog.OPEN,
            directory=str(input_dir),
            allow_multiple=False,
            file_types=("Image files (*.png;*.jpg;*.jpeg)",),
        )
        return result[0] if result else None

    def load_image(self, file_path: str) -> Dict[str, Any]:
        """Load an image from disk, normalize EXIF, and add it to the store."""
        path = Path(file_path)
        im = Image.open(path)
        im = enforce_exif_orientation(im)
        iid, entry = self.store.create(im)
        entry.threshold_base = None
        return {"image_id": iid, "meta": self.store.meta(iid)}

    def load_image_data(self, data_url: str) -> Dict[str, Any]:
        """Load an image from a data URL, normalize EXIF, and add it to the store."""
        if "," not in data_url:
            raise ValueError("Invalid data URL")
        _header, b64 = data_url.split(",", 1)
        data = base64.b64decode(b64)
        im = Image.open(BytesIO(data))
        im = enforce_exif_orientation(im)
        iid, entry = self.store.create(im)
        entry.threshold_base = None
        return {"image_id": iid, "meta": self.store.meta(iid)}


    def load_image_from_bytes(self, filename: str, data: list[int]) -> Dict[str, Any]:
        """Register image bytes from frontend and return image_id for preview/export."""
        buf = BytesIO(bytes(data))
        im = Image.open(buf)
        im = enforce_exif_orientation(im)
        iid, entry = self.store.create(im)
        entry.threshold_base = None
        return {"image_id": iid, "meta": self.store.meta(iid)}



    def get_preview_png(self, image_id: int) -> str:
        """Return the preview image as a data URL (PNG)."""
        data = self.store.to_bytes_preview(image_id)
        b64 = base64.b64encode(data).decode("ascii")
        return f"data:image/png;base64,{b64}"

    def apply_homography(self, image_id: int, points_preview: List[Dict[str, float]]) -> Dict[str, Any]:
        """Apply projective warp on the full canvas based on four preview-space points."""
        entry = self.store.get(image_id)
        s = entry.scale
        import numpy as np
        quad_full = np.array([(p["x"] / s, p["y"] / s) for p in points_preview], dtype=float)
        new_im = warp_projective_full_canvas(entry.original, quad_full)
        self.store.update(image_id, new_im)
        self.store.get(image_id).threshold_base = None
        return {"meta": self.store.meta(image_id)}

    def apply_crop(self, image_id: int, rect_preview: Dict[str, float]) -> Dict[str, Any]:
        """Apply axis-aligned crop defined in preview space."""
        entry = self.store.get(image_id)
        s = entry.scale
        l = int(rect_preview["left"] / s)
        t = int(rect_preview["top"] / s)
        r = int(rect_preview["right"] / s)
        b = int(rect_preview["bottom"] / s)
        new_im = crop_axis_aligned(entry.original, (l, t, r, b))
        self.store.update(image_id, new_im)
        self.store.get(image_id).threshold_base = None
        return {"meta": self.store.meta(image_id)}

    def apply_threshold(self, image_id: int, method: str = "global", value: int = 128) -> Dict[str, Any]:
        """Apply global or Otsu threshold, caching a base image for iterative tweaks."""
        entry = self.store.get(image_id)
        if entry.threshold_base is None:
            entry.threshold_base = entry.original.copy()
        base_im = entry.threshold_base
        if method == "otsu":
            new_im = threshold_otsu(base_im)
        else:
            value = int(max(0, min(255, value)))
            new_im = threshold_global(base_im, value)
        self.store.update(image_id, new_im)
        self.store.get(image_id).threshold_base = base_im
        return {"meta": self.store.meta(image_id)}

    def export_image(self, image_id: int, out_dir: str) -> Dict[str, Any]:
        """Export the current full-resolution image as PNG to the given directory."""
        entry = self.store.get(image_id)
        path = export_png(entry.original, Path(out_dir))
        self.last_output_dir = Path(out_dir)
        return {"path": str(path)}
