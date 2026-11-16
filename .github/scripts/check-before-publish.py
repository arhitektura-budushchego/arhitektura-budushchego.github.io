#!/usr/bin/env python3
"""Check a staged static site before publishing."""
import argparse
from hashlib import sha256
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urljoin, urlsplit
from zipfile import ZipFile

ORIGIN = "https://arhitektura-budushchego.github.io"
HOST = urlsplit(ORIGIN).netloc


class LocalReferences(HTMLParser):
    def __init__(self, url):
        super().__init__(convert_charrefs=True)
        self.url = url
        self.paths = set()

    def handle_starttag(self, tag, attrs):
        for name, value in attrs:
            if name not in ("href", "src", "poster") or not value:
                continue
            target = urlsplit(urljoin(self.url, value))
            if target.scheme in ("https", "http") and target.netloc == HOST:
                self.paths.add(unquote(target.path).lstrip("/"))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=Path)
    root = parser.parse_args().directory.resolve()
    required = {
        "index.html", "read.html", "downloads.html", "introduction.html",
        "tom-2/index.html", "tom-2/read.html", "tom-2/downloads.html",
        "tom-2/introduction.html", "style.css", "series.css", "favicon.ico",
        "arhitektura-budushchego.pdf",
        "tom-2/files/rod-chelovecheskii-pered-bogom.pdf",
    }
    required.update(f"chapter-{num}.html" for num in range(1, 15))
    required.update(f"tom-2/chapter-{num}.html" for num in range(1, 10))
    errors = [f"missing required file: {path}" for path in sorted(required)
              if not (root / path).is_file() or not (root / path).stat().st_size]
    for page in sorted(root.rglob("*.html")):
        relative = page.relative_to(root).as_posix()
        checker = LocalReferences(f"{ORIGIN}/{relative}")
        checker.feed(page.read_text(encoding="utf-8"))
        for path in sorted(checker.paths):
            item = (root / path).resolve()
            if not item.is_relative_to(root):
                errors.append(f"{relative}: local URL escapes publish directory: {path}")
                continue
            if item.is_dir():
                item /= "index.html"
            if not item.is_file():
                errors.append(f"{relative}: missing local URL /{path}")
    for line in (root / "checksums.sha256").read_text(encoding="utf-8").splitlines():
        expected, filename = line.split(maxsplit=1)
        file = (root / filename).resolve()
        if not file.is_relative_to(root) or not file.is_file():
            errors.append(f"checksum: missing or invalid file {filename}")
        elif sha256(file.read_bytes()).hexdigest() != expected:
            errors.append(f"checksum differs: {filename}")
    for file in sorted(root.rglob("*-all.zip")):
        with ZipFile(file) as archive:
            failed = archive.testzip()
            if failed:
                errors.append(f"{file.relative_to(root)}: broken ZIP member {failed}")
    for error in errors:
        print(error)
    if not errors:
        print("PASS: both volumes, local links, Volume I checksums and download archives")
    return bool(errors)


if __name__ == "__main__":
    raise SystemExit(main())
