from __future__ import annotations

import fnmatch
import hashlib
import os
import platform
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Iterable, List, Set, Tuple, Union
from zoneinfo import ZoneInfo

def resolve_tz(tz_pref: str | None) -> timezone:
    """Return tzinfo for 'UTC', 'local', or IANA name."""
    if not tz_pref or tz_pref.upper() == "UTC":
        return timezone.utc
    if tz_pref.lower() == "local":
        return datetime.now().astimezone().tzinfo  # local tz
    try:
        return ZoneInfo(tz_pref)
    except Exception:
        return datetime.now().astimezone().tzinfo

def timestamp_tokens(tzinfo: timezone) -> tuple[str, str, str]:
    """Return (YYYYMMDD, HHMMSS, TZ_ABBR) for given tz (abbrev only)."""
    now = datetime.now(tzinfo)
    ymd = now.strftime("%Y%m%d")
    hms = now.strftime("%H%M%S")
    tz_abbr = now.strftime("%Z") or "TZ"

    # Normalize to short uppercase (e.g. 'MDT' from 'Mountain Daylight Time')
    if len(tz_abbr) > 6:  # e.g. 'Mountain Daylight Time'
        tz_abbr = ''.join(word[0].upper() for word in tz_abbr.split() if word[0].isalpha())
        # 'Mountain Daylight Time' -> 'MDT'

    return ymd, hms, tz_abbr



def get_timestamp() -> str:
    """Return UTC timestamp as yymmddZHHMMSS."""
    return datetime.now(timezone.utc).strftime('%y%m%dZ%H%M%S')

def extract_number(entry: str) -> Union[int, float]:
    """Return leading integer or inf for natural sort."""
    m = re.match(r'^(\d+)', entry)
    return int(m.group(1)) if m else float('inf')

def natural_key(name: str) -> Tuple[Union[int, float], str]:
    """Return natural sort key tuple."""
    return (extract_number(name), name.lower())

def human_size(n: int) -> str:
    """Return human-readable size."""
    units = ["B","KB","MB","GB","TB"]
    s = float(n)
    for u in units:
        if s < 1024 or u == units[-1]:
            return f"{s:.1f} {u}" if u != "B" and s != int(s) else f"{int(s)} {u}" if u=="B" else f"{s:.1f} {u}"
        s /= 1024.0
    return f"{n} B"

def sha1_first8(path: Path) -> str:
    """Return first 8 hex chars of SHA1."""
    h = hashlib.sha1()
    try:
        with path.open('rb') as f:
            for chunk in iter(lambda: f.read(1 << 15), b''):
                h.update(chunk)
        return h.hexdigest()[:8]
    except Exception:
        return "????????"

def archive_existing_outputs(output_prefix: Path) -> None:
    """Archive existing outputs matching stem into archive/."""
    output_prefix.parent.mkdir(parents=True, exist_ok=True)
    archive_dir = output_prefix.parent / 'archive'
    archive_dir.mkdir(exist_ok=True)
    for file_path in output_prefix.parent.glob(f"{output_prefix.stem}*.txt"):
        try:
            timestamp = get_timestamp()
            archived_name = f"{file_path.stem}_archived_{timestamp}.txt"
            file_path.rename(archive_dir / archived_name)
            print(f"Archived: {file_path.name} → {archived_name}")
        except OSError as e:
            print(f"Failed to archive {file_path.name}: {e}")


def to_posix(rel: Path) -> str:
    """Return POSIX-like string path."""
    return str(rel).replace(os.sep, '/')

def is_dir_marker(s: str) -> bool:
    """Return True if string ends with a slash marker."""
    return s.endswith('/') or s.endswith('\\')

def match_any(patterns: Iterable[str], rel_posix: str) -> bool:
    """Return True if rel path matches any case-insensitive glob (path or basename)."""
    p = rel_posix.lower()
    base = p.rsplit('/', 1)[-1]
    for pat in patterns:
        q = pat.replace('\\', '/').lower()
        if ('/' in q and fnmatch.fnmatch(p, q)) or ('/' not in q and fnmatch.fnmatch(base, q)):
            return True
    return False

def is_binary_file(path: Path, sniff_bytes: int = 2048) -> bool:
    """Return True if file appears binary."""
    try:
        with path.open('rb') as f:
            chunk = f.read(sniff_bytes)
        if b'\x00' in chunk:
            return True
        try:
            chunk.decode('utf-8')
            return False
        except UnicodeDecodeError:
            return True
    except Exception:
        return True

def read_text_capped(path: Path, cap_bytes: int) -> Tuple[str, bool, int]:
    """Return (text, truncated, actual_bytes) with UTF-8 replace and LF newlines."""
    try:
        size = path.stat().st_size
        truncated = size > cap_bytes if cap_bytes is not None else False
        read_len = min(size, cap_bytes) if cap_bytes is not None else size
        with path.open('rb') as f:
            data = f.read(read_len)
        text = data.decode('utf-8', errors='replace')
        text = text.replace('\r\n', '\n').replace('\r', '\n')
        return text, truncated, size
    except Exception as e:
        return f"[Error reading {path}: {e}]\n", False, 0

def ensure_parents(paths: Set[Path], root: Path) -> Set[Path]:
    """Return set including parent dirs of given paths relative to root."""
    out: Set[Path] = set()
    for p in paths:
        if p == root:
            continue
        out.add(p)
        cur = p.parent
        while cur != root and root in cur.parents:
            out.add(cur)
            cur = cur.parent
    return out

def list_one_level(dir_path: Path) -> List[Path]:
    """Return immediate children of a directory."""
    try:
        return list(dir_path.iterdir())
    except Exception:
        return []

def build_min_tree(entries: Set[Path], root: Path) -> Dict:
    """Return nested dict tree for entries under root."""
    tree: Dict = {}
    for p in sorted(entries, key=lambda x: [natural_key(part) for part in to_posix(x.relative_to(root)).split('/')]):
        rel = to_posix(p.relative_to(root))
        if not rel:
            continue
        parts = rel.split('/')
        node = tree
        for i, part in enumerate(parts):
            is_last = i == len(parts) - 1
            key = part + ('/' if (p.is_dir() if is_last else True) else '')
            node = node.setdefault(key, {})
    return tree

def prune_empty_dirs(tree: Dict) -> Dict:
    """Return tree with empty directory nodes removed."""
    pruned: Dict = {}
    for k, v in tree.items():
        if v:
            v2 = prune_empty_dirs(v)
            if v2 or not k.endswith('/'):
                pruned[k] = v2
        else:
            if not k.endswith('/'):
                pruned[k] = v
    return pruned

def render_tree(tree: Dict, prefix: str = "") -> List[str]:
    """Return list of lines for a minimal tree."""
    lines: List[str] = []
    keys = sorted(tree.keys(), key=lambda k: natural_key(k.rstrip('/')))
    for i, k in enumerate(keys):
        connector = "└──" if i == len(keys) - 1 else "├──"
        lines.append(f"{prefix}{connector} {k}")
        if tree[k]:
            new_prefix = prefix + ("    " if connector == "└──" else "│   ")
            lines.extend(render_tree(tree[k], new_prefix))
    return lines

def sort_paths(paths: Iterable[Path], root: Path) -> List[Path]:
    """Return paths sorted by natural path segments."""
    def key_func(p: Path) -> List[Tuple[Union[int, float], str]]:
        parts = to_posix(p.relative_to(root)).split('/')
        return [natural_key(part) for part in parts]
    return sorted(paths, key=key_func)

def collect_targets(project_home: Path, includes: List[str], excludes: List[str], dir_depth: int = 1) -> Tuple[Set[Path], Set[Path]]:
    """Return (files, dirs) selected by includes minus excludes."""
    include_patterns = [s.strip() for s in includes if s.strip()]
    exclude_patterns = [s.strip() for s in excludes if s.strip()]
    selected_files: Set[Path] = set()
    selected_dirs: Set[Path] = set()
    for spec in include_patterns:
        is_dir = is_dir_marker(spec)
        spec_clean = spec.rstrip('/\\')
        abs_spec = (project_home / spec_clean).resolve()
        rel_posix = to_posix(abs_spec.relative_to(project_home)) if abs_spec.exists() else spec_clean.replace('\\', '/')
        if is_dir:
            if abs_spec.is_dir():
                if match_any(exclude_patterns, rel_posix + '/'):
                    continue
                selected_dirs.add(abs_spec)
                for child in list_one_level(abs_spec):
                    rel_child = to_posix(child.relative_to(project_home))
                    if match_any(exclude_patterns, rel_child + ('/' if child.is_dir() else '')):
                        continue
                    if child.is_dir():
                        selected_dirs.add(child)
                    else:
                        selected_files.add(child)
        else:
            if abs_spec.exists():
                target_set = selected_files if abs_spec.is_file() else selected_dirs
                if not match_any(exclude_patterns, rel_posix + ('/' if abs_spec.is_dir() else '')):
                    target_set.add(abs_spec)
            else:
                for p in project_home.rglob('*'):
                    rel = to_posix(p.relative_to(project_home))
                    if fnmatch.fnmatch(rel.lower(), spec_clean.replace('\\', '/').lower()):
                        if match_any(exclude_patterns, rel + ('/' if p.is_dir() else '')):
                            continue
                        if p.is_dir():
                            selected_dirs.add(p)
                            for child in list_one_level(p):
                                rel_child = to_posix(child.relative_to(project_home))
                                if match_any(exclude_patterns, rel_child + ('/' if child.is_dir() else '')):
                                    continue
                                if child.is_dir():
                                    selected_dirs.add(child)
                                else:
                                    selected_files.add(child)
                        else:
                            selected_files.add(p)
    selected_files = {p.resolve() for p in selected_files if p.exists()}
    selected_dirs = {p.resolve() for p in selected_dirs if p.exists()}
    return selected_files, selected_dirs

def format_inclusions(includes: List[str], excludes: List[str], cap_bytes: int) -> str:
    """Return human-readable inclusions block."""
    out = "Inclusions:\n"
    out += "  Includes:\n" + ("".join(f"    - {i}\n" for i in includes) if includes else "    - None\n")
    # out += "  Excludes:\n" + ("".join(f"    - {e}\n" for e in excludes) if excludes else "    - None\n")
    out += f"  Max file bytes: {cap_bytes}\n"
    return out

def pull_imports(text: str) -> List[str]:
    """Return sorted unique import lines from Python text."""
    lines = []
    for ln in text.split('\n'):
        s = ln.strip()
        if s.startswith('import ') or s.startswith('from '):
            lines.append(s)
    return sorted(set(lines), key=str.lower)

def write_bundle(project_home: Path, out_prefix: Path, files: List[Path], dirs: List[Path],
                 cap_bytes: int, includes: List[str], excludes: List[str], tz_pref: str) -> Path:
    """Write bundle file with tree, TOC, and concatenated contents."""
    out_prefix.parent.mkdir(parents=True, exist_ok=True)
    archive_existing_outputs(out_prefix)

    tzinfo = resolve_tz(tz_pref)
    ymd, hms, tz_abbr = timestamp_tokens(tzinfo)
    out_file = out_prefix.with_name(f"{out_prefix.stem}_{ymd}_{hms}_{tz_abbr}").with_suffix(".txt")

    file_infos: List[Dict] = []
    skipped_binary: List[str] = []
    truncated_list: List[str] = []
    total_text_bytes = 0


    for p in files:
        rel = to_posix(p.relative_to(project_home))
        if is_binary_file(p):
            skipped_binary.append(rel)
            continue
        text, was_truncated, actual_size = read_text_capped(p, cap_bytes)
        h = sha1_first8(p)
        imports = pull_imports(text) if p.suffix.lower() == '.py' else []
        total_text_bytes += len(text.encode('utf-8', errors='replace'))
        if was_truncated:
            truncated_list.append(rel)
        file_infos.append({
            "path": p, "rel": rel, "size": actual_size, "text": text,
            "truncated": was_truncated, "hash8": h, "imports": imports
        })
    roots: Set[Path] = set(dirs)
    for fi in file_infos:
        roots.add(fi["path"].parent)
    minimal_set = ensure_parents({fi["path"] for fi in file_infos}.union(roots), project_home)
    tree = prune_empty_dirs(build_min_tree(minimal_set, project_home))
    with out_file.open('w', encoding='utf-8', newline='\n') as f:
        f.write(f"Target Path: {project_home.resolve()}\n")
        f.write(f"Output Path: {out_file.resolve()}\n\n")

        now_local = datetime.now(tzinfo)
        now_utc = datetime.now(timezone.utc)
        f.write("Provenance:\n")
        f.write(f"  Generated (local): {now_local.strftime('%Y-%m-%d %H:%M:%S %Z')}\n")
        f.write(f"  Generated (UTC):   {now_utc.strftime('%Y-%m-%d %H:%M:%S UTC')}\n")
        f.write(f"  Python: {sys.version.split()[0]}\n")
        f.write(f"  Platform: {platform.platform()}\n")
        f.write(f"  CWD: {Path.cwd().resolve()}\n")
        f.write(f"  Script: {Path(__file__).resolve()}\n")
        f.write(f"  Glob match: case-insensitive\n")
        f.write(format_inclusions(includes, excludes, cap_bytes))
        f.write("\n")

        f.write("Targeted Tree:\n")
        f.write(f"{project_home.name}/\n")
        for line in render_tree(tree):
            f.write(line + "\n")
        f.write("\n")
        toc = [f"{i+1:>2}. {fi['rel']}  ({human_size(fi['size'])}{', TRUNCATED' if fi['truncated'] else ''})" for i, fi in enumerate(file_infos)]
        f.write("Contents:\n")
        if toc:
            for line in toc:
                f.write(f"  {line}\n")
        else:
            f.write("  (no text files included)\n")
        if skipped_binary:
            f.write("  Skipped binary:\n")
            for s in skipped_binary:
                f.write(f"    - {s}\n")
        if truncated_list:
            f.write("  Truncated:\n")
            for t in truncated_list:
                f.write(f"    - {t}\n")
        py_imports = sorted({imp for fi in file_infos for imp in fi["imports"]}, key=str.lower)
        if py_imports:
            f.write("  Imports seen:\n")
            for im in py_imports:
                f.write(f"    - {im}\n")
        f.write("\n")
        f.write("Concatenated Files:\n\n")
        for fi in file_infos:
            size_str = human_size(fi["size"])
            trunc_note = f", truncated @ {human_size(cap_bytes)}" if fi["truncated"] else ""
            f.write(f"===== BEGIN: {fi['rel']} ({size_str}, sha1={fi['hash8']}{trunc_note}) =====\n")
            f.write(fi["text"])
            f.write("\n===== END: {0} =====\n\n".format(fi['rel']))
        f.write("Summary:\n")
        f.write(f"  Files included: {len(file_infos)}\n")
        f.write(f"  Files skipped (binary): {len(skipped_binary)}\n")
        f.write(f"  Files truncated: {len(truncated_list)}\n")
        f.write(f"  Total bytes written (approx text): {total_text_bytes}\n")
        if skipped_binary:
            f.write("  Skipped binary:\n")
            for s in skipped_binary:
                f.write(f"    - {s}\n")
        if truncated_list:
            f.write("  Truncated:\n")
            for t in truncated_list:
                f.write(f"    - {t}\n")
    return out_file

if __name__ == "__main__":
    """Resolve project_home, gather inclusions, and write bundle."""
    script_path = Path(__file__).resolve()
    project_home = script_path.parents[1]
    output_dir = project_home / 'scripts' / 'context_bundle_output'
    output_prefix = output_dir / 'context_bundle'

    includes = [
        "web/style.css",
        "web/app.js"
    ]
    excludes = [
        "*.jpg", "*.png", "*.gif", "*.bmp", "*.tif", "*.tiff",
        "__pycache__/", "*.pyc", "*.pyo",
        "*.sqlite", "*.db",
        "*.env", "*.pem", "*.key", "*.crt", "*.pfx",
        "*secret*", "*secrets*", "*config*.yaml",
        "*.log", "*.txt",
    ]

    max_file_bytes = 1_000_000
    time_zone = "local"  # "UTC", "local", or IANA like "America/Denver"

    files_set, dirs_set = collect_targets(project_home, includes, excludes, dir_depth=1)
    files = sort_paths(files_set, project_home)
    dirs = sort_paths(dirs_set, project_home)
    print(format_inclusions(includes, excludes, max_file_bytes), end="")
    out_path = write_bundle(project_home, output_prefix, files, dirs, max_file_bytes, includes, excludes, time_zone)
    print(f"Wrote: {out_path}")

