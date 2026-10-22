"""Dockerfile and compose files must meet the image security checklist.

The checklist is: non-root USER, a patch-pinned slim or alpine base, no
secrets copied into the build, a .dockerignore that keeps local files out,
and database ports bound to loopback only.
"""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DOCKERFILES = (
    ROOT / "docker" / "Dockerfile.api",
    ROOT / "docker" / "Dockerfile.web",
    ROOT / "docker" / "Dockerfile.odds",
)
COMPOSE_FILES = (
    ROOT / "docker-compose.yml",
    ROOT / "docker-compose.local-db.yml",
    ROOT / "docker-compose.supabase.yml",
)
DATABASE_CONTAINER_PORTS = {"5432", "3306", "6379"}

_FROM_RE = re.compile(r"^FROM\s+(?P<image>\S+)", re.MULTILINE)
_USER_RE = re.compile(r"^USER\s+(?P<user>\S+)", re.MULTILINE)
_IMAGE_RE = re.compile(r"^\s*image:\s*(?P<image>\S+)\s*$", re.MULTILINE)
_QUOTED_RE = re.compile(r"""["'](?P<body>[^"']+)["']""")
_PATCH_RE = re.compile(r"\d+\.\d+\.\d+")
_SECRET_ENV_RE = re.compile(
    r"^(?:ENV|ARG)\s+.*(?:KEY|SECRET|PASSWORD|TOKEN)\s*=\s*\S+",
    re.IGNORECASE,
)

REQUIRED_DOCKERIGNORE_LINES = (
    ".git",
    ".env",
    ".env.*",
    "node_modules",
    "**/.env",
    "**/.env.*",
    "**/node_modules",
)


def _tag(image: str) -> str:
    # python:3.12.15-slim -> 3.12.15-slim; ignore a digest if one is present.
    ref = image.split("@", 1)[0]
    if ":" not in ref:
        return ""
    return ref.rsplit(":", 1)[1]


def _assert_pinned_runtime(image: str, source: str) -> None:
    tag = _tag(image)
    assert tag, f"{source} image {image} has no version tag"
    assert tag != "latest" and "latest" not in tag.split("-"), (
        f"{source} uses floating tag {image}"
    )
    assert "slim" in tag or "alpine" in tag, (
        f"{source} image {image} is not a slim or alpine variant"
    )
    # Postgres releases are MAJOR.MINOR (15.19). Other bases need a patch
    # component so a tag like python:3.12-slim cannot float.
    name = image.split("@", 1)[0].rsplit("/", 1)[-1].split(":", 1)[0]
    if name == "postgres":
        assert re.fullmatch(r"\d+\.\d+-alpine", tag), (
            f"{source} image {image} is not pinned to a Postgres release"
        )
        return
    assert _PATCH_RE.search(tag), (
        f"{source} image {image} is not pinned to a patch version"
    )


def test_dockerfiles_run_as_non_root() -> None:
    for path in DOCKERFILES:
        users = [match.group("user") for match in _USER_RE.finditer(path.read_text())]
        assert users, f"{path.name} has no USER instruction"
        account = users[-1].split(":", 1)[0]
        assert account not in {"root", "0"}, f"{path.name} ends as {users[-1]}"


def test_base_images_are_patch_pinned_slim_or_alpine() -> None:
    for path in DOCKERFILES:
        images = [match.group("image") for match in _FROM_RE.finditer(path.read_text())]
        assert images, f"{path.name} has no FROM"
        for image in images:
            _assert_pinned_runtime(image, path.name)

    for path in COMPOSE_FILES:
        for match in _IMAGE_RE.finditer(path.read_text()):
            _assert_pinned_runtime(match.group("image"), path.name)


def test_dockerfiles_do_not_bake_secrets() -> None:
    for path in DOCKERFILES:
        for line in path.read_text().splitlines():
            stripped = line.strip()
            if stripped.startswith("#"):
                continue
            if stripped.startswith(("COPY ", "ADD ")):
                assert ".env" not in stripped, f"{path.name} copies an env file"
            assert not _SECRET_ENV_RE.match(stripped), (
                f"{path.name} bakes a secret into the image: {stripped}"
            )


def test_dockerignore_keeps_local_files_out_of_the_build() -> None:
    lines = {
        line.strip()
        for line in (ROOT / ".dockerignore").read_text().splitlines()
        if line.strip() and not line.strip().startswith("#")
    }
    missing = [pattern for pattern in REQUIRED_DOCKERIGNORE_LINES if pattern not in lines]
    assert missing == [], f".dockerignore is missing {missing}"
    assert "!**/.env" not in lines and "!.env" not in lines and "!.env.docker.example" not in lines


def _published_port(mapping: str) -> tuple[str | None, str] | None:
    """Return (bind address, container port) for a compose port mapping.

    ``${POSTGRES_PORT:-5433}`` contains a colon, so the container port is the
    last field only. A leading IPv4 address is the bind address.
    """
    if ":" not in mapping or not mapping.rsplit(":", 1)[-1].isdigit():
        return None
    container = mapping.rsplit(":", 1)[-1]
    head = mapping[: -(len(container) + 1)]
    bind: str | None = None
    if re.fullmatch(r"\d{1,3}(?:\.\d{1,3}){3}", head):
        bind = head
    elif re.match(r"\d{1,3}(?:\.\d{1,3}){3}:", head):
        bind = head.split(":", 1)[0]
    return bind, container


def test_published_ports_bind_loopback() -> None:
    """Host ports stay on 127.0.0.1. nginx is the public entry, via a TLS proxy."""
    for path in COMPOSE_FILES:
        for match in _QUOTED_RE.finditer(path.read_text()):
            published = _published_port(match.group("body"))
            if published is None:
                continue
            bind, container = published
            assert bind == "127.0.0.1", (
                f"{path.name} publishes container port {container} "
                f"beyond loopback ({match.group('body')})"
            )


def test_compose_requires_a_database_password() -> None:
    base = (ROOT / "docker-compose.yml").read_text()
    local = (ROOT / "docker-compose.local-db.yml").read_text()
    assert "POSTGRES_PASSWORD:-" not in base
    assert "POSTGRES_PASSWORD:-" not in local
    assert "${POSTGRES_PASSWORD:?set POSTGRES_PASSWORD in .env}" in local
    assert "hoopvista" not in base
    assert "hoopvista" not in local


def test_supabase_override_requires_the_env_url() -> None:
    text = (ROOT / "docker-compose.supabase.yml").read_text()
    assert "${SUPABASE_DB_URL:?set SUPABASE_DB_URL in .env}" in text


def test_compose_limits_logs_and_checks_api_on_ipv4() -> None:
    text = (ROOT / "docker-compose.yml").read_text()
    local = (ROOT / "docker-compose.local-db.yml").read_text()
    assert "x-logging: &logging" in text
    assert text.count("logging: *logging") == 3
    assert 'max-size: "10m"' in local
    assert text.count("mem_limit: 512m") == 3
    assert local.count("mem_limit: 512m") == 1
    assert "http://localhost:8000" not in text
    assert "http://127.0.0.1:8000/api/health" in text

    api = (ROOT / "docker" / "Dockerfile.api").read_text()
    assert "curl" in api
    assert "http://127.0.0.1:8000/api/health" in api
    assert "http://localhost:8000" not in api


def test_env_file_is_gitignored() -> None:
    ignored = {
        line.strip()
        for line in (ROOT / ".gitignore").read_text().splitlines()
        if line.strip() and not line.strip().startswith("#")
    }
    assert ".env" in ignored
