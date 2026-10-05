"""Check local Markdown links, fenced examples, and documented API routes."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from urllib.parse import unquote, urlsplit


ROOT = Path(__file__).resolve().parents[1]
FENCE = re.compile(r"^\s{0,3}(`{3,}|~{3,})(.*)$")
HEADING = re.compile(r"^#{1,6}\s+(.+?)\s*#*\s*$")
LINK = re.compile(r"(?<!!)\[[^]]+\]\(([^)]+)\)")
ROUTE = re.compile(r"`((?:GET|POST|PATCH|DELETE)(?:/(?:GET|POST|PATCH|DELETE))* /api/[^`]+)`")
IGNORED_SCHEMES = {"http", "https", "mailto"}


def slug(heading: str) -> str:
    heading = re.sub(r"<[^>]+>", "", heading).lower()
    heading = re.sub(r"[^\w\s-]", "", heading)
    return re.sub(r"\s+", "-", heading.strip())


def expand_route(value: str) -> set[str]:
    methods, path = value.split(" ", 1)
    path = path.split("?", 1)[0]
    return {f"{method} {path}" for method in methods.split("/")}


def scan_markdown(path: Path) -> tuple[set[str], list[tuple[int, str]], list[str]]:
    headings: set[str] = set()
    links: list[tuple[int, str]] = []
    errors: list[str] = []
    fence_char = ""
    fence_length = 0
    fence_language = ""
    fence_line = 0
    body: list[str] = []

    for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        match = FENCE.match(line)
        if match:
            marker, info = match.groups()
            if not fence_char:
                fence_char = marker[0]
                fence_length = len(marker)
                fence_language = info.strip().split(" ", 1)[0].lower()
                fence_line = number
                body = []
                continue
            if marker[0] == fence_char and len(marker) >= fence_length and not info.strip():
                if fence_language == "json":
                    try:
                        json.loads("\n".join(body))
                    except json.JSONDecodeError as exc:
                        errors.append(f"{path}:{fence_line}: invalid JSON: {exc.msg}")
                elif fence_language == "mermaid":
                    first_line = next((item.strip() for item in body if item.strip()), "")
                    if not re.match(r"^(flowchart|graph|sequenceDiagram)\b", first_line):
                        errors.append(f"{path}:{fence_line}: unsupported Mermaid opening")
                fence_char = ""
                continue

        if fence_char:
            body.append(line)
            continue

        heading = HEADING.match(line)
        if heading:
            headings.add(slug(heading.group(1)))
        links.extend((number, match.group(1)) for match in LINK.finditer(line))

    if fence_char:
        errors.append(f"{path}:{fence_line}: unclosed code fence")
    return headings, links, errors


def check_links(
    root: Path,
    page: Path,
    links: list[tuple[int, str]],
    headings_by_path: dict[Path, set[str]],
) -> list[str]:
    errors: list[str] = []
    for line, raw_target in links:
        target = raw_target.strip().strip("<>")
        parsed = urlsplit(target)
        if parsed.scheme in IGNORED_SCHEMES:
            continue
        if parsed.scheme or parsed.netloc:
            errors.append(f"{page}:{line}: unsupported link target: {target}")
            continue
        local_path = unquote(parsed.path)
        destination = (page.parent / local_path).resolve() if local_path else page
        if not destination.is_relative_to(root) or not destination.is_file():
            errors.append(f"{page}:{line}: missing local link target: {target}")
            continue
        if parsed.fragment and destination.suffix.lower() == ".md":
            anchor = unquote(parsed.fragment).lower()
            if anchor not in headings_by_path.get(destination, set()):
                errors.append(f"{page}:{line}: missing heading: {target}")
    return errors


def check_routes(root: Path) -> list[str]:
    design = root / "docs" / "agent-account-book-design.md"
    contract = root / "docs" / "api-contract.md"
    if not design.is_file() or not contract.is_file():
        return ["API route check requires the design and contract documents"]

    design_lines = design.read_text(encoding="utf-8").splitlines()
    declarations = [line for line in design_lines if line.startswith("사용자용 API는 ")]
    if len(declarations) != 1:
        return [f"{design}: expected one user-facing API declaration"]
    design_routes = set().union(*(expand_route(item) for item in ROUTE.findall(declarations[0])))
    if not design_routes:
        return [f"{design}: no declared user-facing API routes"]

    contract_lines = contract.read_text(encoding="utf-8").splitlines()
    table_routes = [ROUTE.search(line) for line in contract_lines if line.startswith("| `")]
    contract_routes = set().union(
        *(expand_route(match.group(1)) for match in table_routes if match)
    )
    errors = [f"{contract}: missing route: {route}" for route in sorted(design_routes - contract_routes)]
    errors += [f"{design}: undeclared route: {route}" for route in sorted(contract_routes - design_routes)]
    return errors


def validate(root: Path) -> list[str]:
    root = root.resolve()
    pages = [root / "README.md", *sorted((root / "docs").glob("*.md"))]
    headings_by_path: dict[Path, set[str]] = {}
    links_by_path: dict[Path, list[tuple[int, str]]] = {}
    errors: list[str] = []

    for page in pages:
        if not page.is_file():
            errors.append(f"{page}: missing document")
            continue
        headings, links, page_errors = scan_markdown(page)
        headings_by_path[page] = headings
        links_by_path[page] = links
        errors.extend(page_errors)

    for page, links in links_by_path.items():
        errors.extend(check_links(root, page, links, headings_by_path))
    errors.extend(check_routes(root))
    return errors


if __name__ == "__main__":
    failures = validate(ROOT)
    if failures:
        for failure in failures:
            print(failure, file=sys.stderr)
        raise SystemExit(1)
    print("Documentation checks passed")
