import re
from pathlib import Path

_DOMAIN_IMPORT_RE = re.compile(r"^\s*(?:from|import)\s+app\.domains\.(\w+)", re.MULTILINE)


def test_domains_never_import_other_domains() -> None:
    """Domains must not import each other (see md/system-design.md /
    docs/superpowers/specs/2026-08-04-backend-domain-reorg-design.md
    invariant #2). Shared helpers belong in ``app.core`` instead."""
    domains_dir = Path(__file__).parents[1] / "app" / "domains"

    violations: list[str] = []
    for path in domains_dir.rglob("*.py"):
        own_domain = path.relative_to(domains_dir).parts[0]
        for match in _DOMAIN_IMPORT_RE.finditer(path.read_text()):
            other_domain = match.group(1)
            if other_domain != own_domain:
                violations.append(
                    f"{path.relative_to(domains_dir)} imports app.domains.{other_domain}"
                )

    assert violations == []
