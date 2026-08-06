import io
import re

import mammoth
import markdownify
from bs4 import BeautifulSoup
from pypdf import PdfReader

# Images are stripped rather than kept as inline base64 — a handful of embedded
# images can bloat a converted document from ~30KB to 1MB+ of base64 text, which
# both makes the raw editor unreadable and blows past reasonable token limits the
# moment "Ask AI" sends the whole document as context.
_STRIP_IMAGES = mammoth.images.img_element(lambda image: {})


def _promote_first_row_to_header(html: str) -> str:
    """Mammoth never marks any table row as a header — every cell is a plain <td>,
    even ones that are visually bold "Name / Title / Email"-style headers. Without
    a real <th>, markdownify has no header row to work with and fabricates an empty
    one to satisfy markdown's table syntax, pushing the real header down into the
    first data row. Promoting each table's first row to <th> fixes this at the
    source instead of leaving a blank row in every converted table."""
    soup = BeautifulSoup(html, "html.parser")
    for table in soup.find_all("table"):
        first_row = table.find("tr")
        if not first_row:
            continue
        for cell in first_row.find_all("td"):
            cell.name = "th"
    return str(soup)


def extract_docx_text(raw: bytes) -> str:
    result = mammoth.convert_to_html(io.BytesIO(raw), convert_image=_STRIP_IMAGES)
    html = _promote_first_row_to_header(result.value)
    md = markdownify.markdownify(html, heading_style="ATX")
    # _STRIP_IMAGES returns no attrs per image, which still leaves an empty
    # ![]() behind — remove those remnants rather than leaving dangling syntax.
    md = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", md)
    md = re.sub(r"\n{3,}", "\n\n", md).strip()
    return md


def extract_pdf_text(raw: bytes) -> str:
    reader = PdfReader(io.BytesIO(raw))
    pages = [page.extract_text() or "" for page in reader.pages]
    return "\n\n".join(p.strip() for p in pages if p.strip())


def extract_text(filename: str, raw: bytes) -> str:
    ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
    if ext in ("md", "txt"):
        return raw.decode("utf-8", errors="ignore")
    if ext == "docx":
        return extract_docx_text(raw)
    if ext == "pdf":
        return extract_pdf_text(raw)
    raise ValueError(f"Unsupported file type: .{ext or 'unknown'}")
