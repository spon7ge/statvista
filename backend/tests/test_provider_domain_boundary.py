import re
from pathlib import Path

_DOMAIN_IMPORT_RE = re.compile(r"^\s*(?:from|import)\s+app\.domains(?:\.|,|\s|$)", re.MULTILINE)


def test_providers_never_import_domains() -> None:
    """Providers sit below domains in the dependency graph (api -> domains ->
    providers -> core); a provider importing a domain module is a layering
    bug (e.g. it should use a lean provider-local type instead)."""
    providers_dir = Path(__file__).parents[1] / "app" / "providers"
    violating_modules = [
        str(path.relative_to(providers_dir))
        for path in providers_dir.rglob("*.py")
        if _DOMAIN_IMPORT_RE.search(path.read_text())
    ]

    assert violating_modules == []
