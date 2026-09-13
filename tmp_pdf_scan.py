from pathlib import Path
from pypdf import PdfReader
import re

root = Path(r"c:/Users/Felix/Desktop/Master/Thesis/Quellen/ML")
keywords = [
    r"\bqUCB\b",
    r"\bUCB\b",
    r"\bqNEI\b",
    r"Noisy Expected Improvement",
    r"Expected Improvement",
    r"Active Learning",
    r"Bayesian Optimization",
    r"BoTorch",
    r"Gaussian Process",
]

for pdf_path in sorted(root.glob("*.pdf")):
    try:
        reader = PdfReader(str(pdf_path))
    except Exception as exc:
        print(f"FILE: {pdf_path.name} | ERROR: {exc}")
        continue

    text_chunks = []
    pages_to_read = min(25, len(reader.pages))
    for page in reader.pages[:pages_to_read]:
        try:
            text_chunks.append(page.extract_text() or "")
        except Exception:
            text_chunks.append("")

    joined = "\n".join(text_chunks)
    hits = []
    for kw in keywords:
        count = len(re.findall(kw, joined, flags=re.IGNORECASE))
        if count:
            hits.append((kw, count))

    if hits:
        summary = ", ".join([f"{k}:{c}" for k, c in hits])
        print(f"FILE: {pdf_path.name} | PAGES_READ: {pages_to_read}")
        print(f"  HITS: {summary}")
