"""Resolve the nba_quant repo root from nested scraper modules."""

from __future__ import annotations

import os
import sys
from pathlib import Path


def _is_repo_root(candidate: Path) -> bool:
    if not candidate.is_dir():
        return False
    if (candidate / "pyproject.toml").is_file():
        return True
    # This checkout has no pyproject.toml. requirements.txt beside src/ is the root.
    return (candidate / "requirements.txt").is_file() and (candidate / "src").is_dir()


def repo_root(start: str | os.PathLike[str] | None = None) -> Path:
    """Walk parents until the project root is found."""
    here = Path(start or __file__).resolve()
    for candidate in (here, *here.parents):
        if _is_repo_root(candidate):
            return candidate
    raise RuntimeError(f"could not find repo root from {here}")


def ensure_repo_on_path(start: str | os.PathLike[str] | None = None) -> Path:
    root = repo_root(start)
    root_s = str(root)
    if root_s not in sys.path:
        sys.path.insert(0, root_s)
    return root
