"""OCR worker para PDFs escaneados — Tesseract spa."""
from __future__ import annotations

import io
import logging
import os

import pytesseract
from fastapi import FastAPI, File, HTTPException, UploadFile
from pdf2image import convert_from_bytes

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("ocr")

app = FastAPI(title="fiscal-ocr", version="1.0.0")

MAX_PAGES = int(os.environ.get("OCR_MAX_PAGES", "50"))
DPI = int(os.environ.get("OCR_DPI", "200"))


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/ocr")
async def ocr(file: UploadFile = File(...)) -> dict[str, object]:
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="solo PDF")

    raw = await file.read()
    if len(raw) > 50 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="PDF > 50MB")

    log.info("OCR start: %s (%.2f MB)", file.filename, len(raw) / 1024 / 1024)

    try:
        images = convert_from_bytes(raw, dpi=DPI, first_page=1, last_page=MAX_PAGES)
    except Exception as e:
        log.exception("pdf2image error")
        raise HTTPException(status_code=500, detail=f"pdf2image: {e}")

    pages_text: list[str] = []
    for i, img in enumerate(images, start=1):
        try:
            text = pytesseract.image_to_string(img, lang="spa", config="--psm 1")
            pages_text.append(text.strip())
        except Exception as e:
            log.exception("tesseract page %d", i)
            pages_text.append(f"[ERROR OCR PAGE {i}: {e}]")

    full = "\n\n".join(pages_text)
    log.info("OCR done: %s, %d pages, %d chars", file.filename, len(images), len(full))

    return {
        "text": full,
        "pages": len(images),
        "chars": len(full),
        "engine": "tesseract-spa",
    }
