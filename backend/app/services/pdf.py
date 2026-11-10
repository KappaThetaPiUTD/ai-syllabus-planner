"""Step 1 of the pipeline: pull the plain text out of an uploaded PDF."""
from pathlib import Path

from pypdf import PdfReader


def extract_text(path: Path) -> str:
    """Return the selectable text of a PDF. Scanned (image-only) PDFs return ''.

    When the Claude API is configured the PDF itself is also sent to Claude,
    which can read scanned pages directly (this covers the "OCR" later-feature).
    """
    if path.suffix.lower() == ".txt":
        return path.read_text(encoding="utf-8", errors="ignore")
    reader = PdfReader(str(path))
    pages = []
    for i, page in enumerate(reader.pages, start=1):
        try:
            text = page.extract_text() or ""
        except Exception:  # a single malformed page shouldn't kill the upload
            text = ""
        if text.strip():
            pages.append(f"--- Page {i} ---\n{text.strip()}")
    return "\n\n".join(pages)
