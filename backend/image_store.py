from dataclasses import dataclass
from typing import Dict, Tuple, Optional
import itertools

from PIL import Image

@dataclass
class ImageEntry:
    """Container for original image, preview, scale, and optional threshold base."""
    original: Image.Image
    preview: Image.Image
    scale: float
    threshold_base: Optional[Image.Image] = None


class ImageStore:
    """Manage images with capped full-res and generated previews."""
    _ids = itertools.count(1)

    def __init__(self, preview_long_edge: int = 1600, full_cap_long_edge: int = 8000):
        """Initialize store with preview and full-res long-edge caps."""
        self.preview_long_edge = preview_long_edge
        self.full_cap_long_edge = full_cap_long_edge
        self._images: Dict[int, ImageEntry] = {}

    def _build_preview(self, im: Image.Image) -> Tuple[Image.Image, float]:
        """Return preview image and scale factor relative to original."""
        w, h = im.size
        long_edge = max(w, h)
        scale = 1.0
        if long_edge > self.preview_long_edge:
            scale = self.preview_long_edge / long_edge
            new_size = (max(1, int(w * scale)), max(1, int(h * scale)))
            prev = im.resize(new_size, Image.Resampling.LANCZOS)
        else:
            prev = im.copy()
        return prev, scale

    def _cap_full_res(self, im: Image.Image) -> Image.Image:
        """Return image resized to full-cap if needed, else original."""
        w, h = im.size
        long_edge = max(w, h)
        if long_edge <= self.full_cap_long_edge:
            return im
        scale = self.full_cap_long_edge / long_edge
        new_size = (max(1, int(w * scale)), max(1, int(h * scale)))
        return im.resize(new_size, Image.Resampling.LANCZOS)

    def create(self, pil_image: Image.Image) -> Tuple[int, ImageEntry]:
        """Add a new image and return its ID and entry."""
        pil_image.load()
        pil_image = self._cap_full_res(pil_image)
        preview, scale = self._build_preview(pil_image)
        iid = next(self._ids)
        entry = ImageEntry(original=pil_image, preview=preview, scale=scale, threshold_base=None)
        self._images[iid] = entry
        return iid, entry

    def get(self, iid: int) -> ImageEntry:
        """Return the image entry for a given ID."""
        return self._images[iid]

    def update(self, iid: int, new_image: Image.Image) -> ImageEntry:
        """Replace the image for an ID and return the updated entry."""
        new_image.load()
        new_image = self._cap_full_res(new_image)
        preview, scale = self._build_preview(new_image)
        entry = ImageEntry(original=new_image, preview=preview, scale=scale, threshold_base=None)
        self._images[iid] = entry
        return entry

    def to_bytes_preview(self, iid: int) -> bytes:
        """Return the PNG-encoded preview bytes for an ID."""
        from io import BytesIO
        bio = BytesIO()
        self._images[iid].preview.save(bio, format="PNG")
        return bio.getvalue()

    def meta(self, iid: int) -> dict:
        """Return preview metadata for an ID."""
        e = self._images[iid]
        return {"width": e.preview.width, "height": e.preview.height, "scale": e.scale}
