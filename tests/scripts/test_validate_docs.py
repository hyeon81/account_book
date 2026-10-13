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


def test_nested_documents_are_validated(tmp_path) -> None:
    (tmp_path / "README.md").write_text("# Home\n", encoding="utf-8")
    nested = tmp_path / "docs" / "ai"
    nested.mkdir(parents=True)
    page = nested / "category.md"
    page.write_text("# Category\n[Missing](missing.md)\n```json\n{broken}\n```\n", encoding="utf-8")

    errors = validate_docs.validate(tmp_path)

    assert any(str(page) in error and "missing local link target" in error for error in errors)
    assert any(str(page) in error and "invalid JSON" in error for error in errors)


def test_nested_heading_links_are_validated(tmp_path) -> None:
    (tmp_path / "README.md").write_text("[RAG](docs/ai/category.md#검색)\n", encoding="utf-8")
    nested = tmp_path / "docs" / "ai"
    nested.mkdir(parents=True)
    (nested / "category.md").write_text("# 검색\n", encoding="utf-8")

    errors = validate_docs.validate(tmp_path)

    assert not any("missing heading" in error for error in errors)
