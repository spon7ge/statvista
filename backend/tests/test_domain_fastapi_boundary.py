from pathlib import Path


def test_fastapi_is_imported_only_by_domain_route_modules() -> None:
    domains_dir = Path(__file__).parents[1] / "app" / "domains"
    violating_modules = [
        str(path.relative_to(domains_dir))
        for path in domains_dir.rglob("*.py")
        if path.name != "routes.py" and "fastapi" in path.read_text().lower()
    ]

    assert violating_modules == []
