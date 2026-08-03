import io

import docx
from pypdf import PdfReader


def extract_docx_text(raw: bytes) -> str:
    document = docx.Document(io.BytesIO(raw))
    return "\n\n".join(p.text for p in document.paragraphs if p.text.strip())


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
