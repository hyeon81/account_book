from pathlib import Path

from scripts import validate_docs


def test_repository_documents_pass() -> None:
    assert validate_docs.validate(validate_docs.ROOT) == []


def test_invalid_json_is_reported(monkeypatch) -> None:
    monkeypatch.setattr(Path, "read_text", lambda self, **kwargs: "```json\n{broken}\n```")

    _, _, errors = validate_docs.scan_markdown(validate_docs.ROOT / "README.md")

    assert any("invalid JSON" in error for error in errors)


def test_missing_local_link_is_reported() -> None:
    errors = validate_docs.check_links(
        validate_docs.ROOT,
        validate_docs.ROOT / "README.md",
        [(1, "docs/does-not-exist.md")],
        {},
    )

    assert any("missing local link target" in error for error in errors)
