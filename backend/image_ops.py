from __future__ import annotations
from datetime import datetime
from pathlib import Path
from typing import Tuple

import numpy as np
import time
from PIL import Image, ImageOps
from skimage import transform as tf


def tz_abbr_now(iana_zone: str = "America/Denver") -> str:
    """Return consistent MDT/MST abbreviation using zoneinfo with DST fallback."""
    try:
        if ZoneInfo is not None:
            z = ZoneInfo(iana_zone)
            return datetime.now(z).strftime("%Z") or "MT"
    except Exception:
        pass

    # Fallback if tzdata/zoneinfo is unavailable:
    is_dst = time.localtime().tm_isdst == 1
    return "MDT" if is_dst else "MST"


def enforce_exif_orientation(im: Image.Image) -> Image.Image:
    """Return image with EXIF orientation applied."""
    return ImageOps.exif_transpose(im)


def order_quad(pts: np.ndarray) -> np.ndarray:
    """Return 4 points ordered as TL, TR, BR, BL (shape (4, 2))."""
    c = pts.mean(axis=0)
    angles = np.arctan2(pts[:, 1] - c[1], pts[:, 0] - c[0])
    order = np.argsort(angles)
    pts = pts[order]
    sums = pts.sum(axis=1)
    rot = np.argmin(sums)
    pts = np.roll(pts, -rot, axis=0)
    v1 = pts[1] - pts[0]
    v2 = pts[3] - pts[0]
    if np.cross(v1, v2) < 0:
        pts[1], pts[3] = pts[3].copy(), pts[1].copy()
    return pts


def compute_square_side_from_quad(quad: np.ndarray) -> float:
    """Return average edge length for a square approximated from a quad."""
    top = np.linalg.norm(quad[1] - quad[0])
    bottom = np.linalg.norm(quad[2] - quad[3])
    left = np.linalg.norm(quad[3] - quad[0])
    right = np.linalg.norm(quad[2] - quad[1])
    horiz = 0.5 * (top + bottom)
    vert = 0.5 * (left + right)
    return 0.5 * (horiz + vert)


def warp_projective_to_square(im: Image.Image, quad_full: np.ndarray) -> Image.Image:
    """Warp the quad region to a square image whose side equals the quad's mean edge."""
    quad = order_quad(quad_full.astype(float))
    side = max(1.0, compute_square_side_from_quad(quad))
    dst = np.array([[0, 0], [side, 0], [side, side], [0, side]], dtype=float)
    tform = tf.ProjectiveTransform()
    if not tform.estimate(dst, quad):
        raise ValueError("Degenerate corner configuration; cannot estimate homography")
    warped = tf.warp(np.asarray(im), tform, output_shape=(int(side), int(side)), preserve_range=True)
    warped = np.clip(warped, 0, 255).astype(np.uint8)
    return Image.fromarray(warped if warped.ndim != 2 else warped, mode=None if warped.ndim != 2 else "L")


def warp_projective_full_canvas(im: Image.Image, quad_full: np.ndarray) -> Image.Image:
    """Warp the full canvas so the selected quad becomes an axis-aligned square in place."""
    quad = order_quad(quad_full.astype(float))
    side = max(1.0, compute_square_side_from_quad(quad))
    c = quad.mean(axis=0)
    half = side / 2.0
    dst = np.array(
        [
            [c[0] - half, c[1] - half],
            [c[0] + half, c[1] - half],
            [c[0] + half, c[1] + half],
            [c[0] - half, c[1] + half],
        ],
        dtype=float,
    )
    tform = tf.ProjectiveTransform()
    if not tform.estimate(quad, dst):
        raise ValueError("Degenerate corner configuration; cannot estimate homography")
    # Use inverse map (output→input) to keep output size equal to the original canvas.
    arr = np.asarray(im)
    warped = tf.warp(arr, inverse_map=tform.inverse, output_shape=(im.height, im.width), preserve_range=True)
    warped = np.clip(warped, 0, 255).astype(np.uint8)
    return Image.fromarray(warped if warped.ndim != 2 else warped, mode=None if warped.ndim != 2 else "L")


def crop_axis_aligned(im: Image.Image, rect_full: Tuple[int, int, int, int]) -> Image.Image:
    """Return axis-aligned crop (l, t, r, b) clamped to image bounds."""
    l, t, r, b = rect_full
    l = max(0, min(l, im.width - 1))
    r = max(1, min(r, im.width))
    t = max(0, min(t, im.height - 1))
    b = max(1, min(b, im.height))
    if r <= l + 1 or b <= t + 1:
        raise ValueError("Crop too small or inverted")
    return im.crop((l, t, r, b))


def to_grayscale(im: Image.Image) -> Image.Image:
    """Return a grayscale copy (no-op if already 'L')."""
    return im if im.mode == "L" else ImageOps.grayscale(im)


def threshold_global(im: Image.Image, thr: int) -> Image.Image:
    """Return binary image using a fixed threshold (>= thr → 255)."""
    arr = np.asarray(to_grayscale(im))
    out = ((arr >= thr) * 255).astype(np.uint8)
    return Image.fromarray(out, mode="L")


def threshold_otsu(im: Image.Image) -> Image.Image:
    """Return binary image using Otsu's automatic threshold."""
    from skimage.filters import threshold_otsu  # local import to avoid heavy import on module load

    arr = np.asarray(to_grayscale(im))
    thr = int(threshold_otsu(arr))
    out = ((arr >= thr) * 255).astype(np.uint8)
    return Image.fromarray(out, mode="L")


def export_png(im: Image.Image, out_dir: Path) -> Path:
    """Save image as PNG with timestamped name and return the path."""
    out_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    tz = tz_abbr_now()
    path = out_dir / f"puzzle_{stamp}_{tz}.png"
    im.save(path, format="PNG")
    return path
