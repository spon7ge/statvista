from app.core.config import DEFAULT_CORS_ORIGINS, parse_cors_origins


def test_parse_cors_origins_none_uses_defaults():
    assert parse_cors_origins(None) == DEFAULT_CORS_ORIGINS


def test_parse_cors_origins_empty_uses_defaults():
    assert parse_cors_origins("") == DEFAULT_CORS_ORIGINS
    assert parse_cors_origins("   ") == DEFAULT_CORS_ORIGINS


def test_parse_cors_origins_comma_separated():
    assert parse_cors_origins("http://localhost,http://localhost:8080") == [
        "http://localhost",
        "http://localhost:8080",
    ]


def test_parse_cors_origins_strips_whitespace_and_drops_blanks():
    assert parse_cors_origins(" http://localhost:8080 , , http://127.0.0.1:8080 ") == [
        "http://localhost:8080",
        "http://127.0.0.1:8080",
    ]
