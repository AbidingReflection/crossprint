from __future__ import annotations

import re
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Dict, Tuple, Union

def get_timestamp() -> str:
    """Return UTC timestamp as yymmddZHHMMSS."""
    return datetime.now(timezone.utc).strftime('%y%m%dZ%H%M%S')

def extract_number(entry: str) -> Union[int, float]:
    """Return leading integer or inf for natural sort."""
    match = re.match(r'^(\d+)', entry)
    return int(match.group(1)) if match else float('inf')

def archive_existing_file_trees(output_prefix: Path) -> None:
    """Archive existing tree files matching stem into archive/."""
    output_prefix.parent.mkdir(parents=True, exist_ok=True)
    archive_dir = output_prefix.parent / 'archive'
    archive_dir.mkdir(exist_ok=True)
    for file_path in output_prefix.parent.glob(f"{output_prefix.stem}*.txt"):
        try:
            timestamp = get_timestamp()
            archived_name = f"{file_path.stem}_archived_{timestamp}.txt"
            archived_path = archive_dir / archived_name
            file_path.rename(archived_path)
            print(f"Archived: {file_path.name} → {archived_path.name}")
        except OSError as e:
            print(f"Failed to archive {file_path.name}: {e}")

class ExclusionFilter:
    """Callable filter for prefixes, suffixes, filetypes, and folders."""
    def __init__(self, prefixes: List[str], suffixes: List[str], filetypes: List[str], folders: List[str]):
        self.prefixes = prefixes
        self.suffixes = suffixes
        self.filetypes = {ftype.lstrip('.').lower() for ftype in filetypes}
        self.folders = set(folders)

    def __call__(self, entry: Path) -> bool:
        """Return True if entry should be excluded."""
        return (
            any(entry.name.startswith(prefix) for prefix in self.prefixes) or
            any(entry.name.endswith(suffix) for suffix in self.suffixes) or
            entry.suffix.lstrip('.').lower() in self.filetypes or
            entry.name in self.folders
        )

def format_exclusions(exclude_config: Dict[str, List[str]]) -> str:
    """Return human-readable exclusions block."""
    output = "Exclusions:\n"
    for key, values in exclude_config.items():
        output += f"  {key.capitalize()}:\n"
        output += ''.join(f"    - {val}\n" for val in values) if values else "    - None\n"
    return output

def generate_file_tree(
    target_path: Path,
    output_path: Path,
    exclude_config: Dict[str, List[str]],
    archive_previous: bool = True
) -> None:
    """Write a timestamped tree snapshot to disk."""
    exclude_filter = ExclusionFilter(
        exclude_config.get("prefixes", []),
        exclude_config.get("suffixes", []),
        exclude_config.get("filetypes", []),
        exclude_config.get("folders", [])
    )
    if archive_previous:
        archive_existing_file_trees(output_path)
    timestamp = get_timestamp()
    output_base = output_path.with_suffix('')
    output_file = f"{output_base}_{timestamp}.txt"
    file_count = 0
    folder_count = 0
    with open(output_file, 'w', encoding='utf-8') as file:
        file.write(f"Target Path: {target_path.resolve()}\n")
        file.write(f"Output Path: {Path(output_file).resolve()}\n\n")
        file.write(f"{target_path.name}/\n")
        def walk_directory(current_path: Path, prefix: str = "") -> Tuple[int, int]:
            nonlocal file_count, folder_count
            try:
                entries = sorted(current_path.iterdir(), key=lambda e: (extract_number(e.name), e.name))
                entries = [e for e in entries if not exclude_filter(e)]
                for i, entry in enumerate(entries):
                    connector = "└──" if i == len(entries) - 1 else "├──"
                    line = f"{prefix}{connector} {entry.name}"
                    if entry.is_dir():
                        file.write(line + "/\n")
                        folder_count += 1
                        new_prefix = prefix + ("    " if connector == "└──" else "│   ")
                        walk_directory(entry, new_prefix)
                    else:
                        file.write(line + "\n")
                        file_count += 1
            except PermissionError:
                file.write(f"{prefix}└── [Permission Denied: {current_path}]\n")
            except Exception as e:
                file.write(f"{prefix}└── [Error accessing {current_path}: {e}]\n")
            return file_count, folder_count
        walk_directory(target_path)
        file.write("\n" + format_exclusions(exclude_config))
        file.write(f"\nSummary:\n  Folders: {folder_count}\n  Files: {file_count}\n")

if __name__ == "__main__":
    """Resolve project_home and run with defaults."""
    script_path = Path(__file__).resolve()
    project_home = script_path.parents[1]
    target_path = project_home
    output_dir = project_home / 'scripts' / 'file_tree_output'
    output_dir.mkdir(exist_ok=True)
    exclude_config = {
        "prefixes": ["generated_config_"],
        "suffixes": [".swp", ".egg-info"],
        "filetypes": ["pyc", "log"],
        "folders": ['.git', '.venv', 'venv', '__pycache__', 'logs', '.pytest_cache', 'archive', '.DS_Store', 'build']
    }
    generate_file_tree(target_path, output_dir / 'file_tree', exclude_config)
