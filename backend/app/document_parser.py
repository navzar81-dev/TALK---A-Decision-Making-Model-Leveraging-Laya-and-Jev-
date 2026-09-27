import io
import csv
import json
import logging
from typing import Dict, Any, List, Optional

logger = logging.getLogger("talk.document_parser")

def extract_text_from_pdf(file_bytes: bytes) -> str:
    """Extracts text from PDF bytes using pdfplumber."""
    try:
        import pdfplumber
        extracted_pages = []
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            for i, page in enumerate(pdf.pages):
                text = page.extract_text()
                if text:
                    extracted_pages.append(f"--- Page {i+1} ---\n{text.strip()}")
        return "\n\n".join(extracted_pages)
    except Exception as e:
        logger.error(f"Failed to parse PDF with pdfplumber: {e}")
        return ""

def extract_text_from_docx(file_bytes: bytes) -> str:
    """Extracts text from DOCX bytes using python-docx."""
    try:
        import docx
        doc = docx.Document(io.BytesIO(file_bytes))
        paragraphs = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
        # Also extract table text
        tables_text = []
        for table in doc.tables:
            for row in table.rows:
                row_cells = [c.text.strip() for c in row.cells if c.text.strip()]
                if row_cells:
                    tables_text.append(" | ".join(row_cells))
        
        all_text = paragraphs + tables_text
        return "\n\n".join(all_text)
    except Exception as e:
        logger.error(f"Failed to parse DOCX: {e}")
        return ""

def extract_text_from_excel(file_bytes: bytes) -> str:
    """Extracts worksheets and tables from Excel (.xlsx, .xlsm, .xltx) using openpyxl."""
    try:
        import openpyxl
        wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
        sheets_output = []

        for sheet_name in wb.sheetnames:
            sheet = wb[sheet_name]
            rows_data = []
            for row in sheet.iter_rows(values_only=True):
                # Filter out completely empty rows
                filtered_cells = [str(c).strip() if c is not None else "" for c in row]
                if any(filtered_cells):
                    rows_data.append(filtered_cells)

            if not rows_data:
                continue

            sheet_lines = [f"### Sheet: {sheet_name}"]
            # Find max columns
            max_cols = max(len(r) for r in rows_data) if rows_data else 0
            
            # Format header if available
            header = rows_data[0] + [""] * (max_cols - len(rows_data[0]))
            sheet_lines.append("| " + " | ".join(header) + " |")
            sheet_lines.append("| " + " | ".join(["---"] * max_cols) + " |")

            for r in rows_data[1:]:
                padded_row = r + [""] * (max_cols - len(r))
                sheet_lines.append("| " + " | ".join(padded_row) + " |")

            sheets_output.append("\n".join(sheet_lines))

        return "\n\n".join(sheets_output)
    except Exception as e:
        logger.error(f"Failed to parse Excel workbook: {e}")
        return ""

def extract_text_from_csv(file_bytes: bytes, delimiter: Optional[str] = None) -> str:
    """Extracts and formats CSV / TSV files as structured comparison tables."""
    raw_text = extract_text_from_plaintext(file_bytes)
    if not raw_text.strip():
        return ""

    try:
        sample = raw_text[:2048]
        if not delimiter:
            try:
                dialect = csv.Sniffer().sniff(sample, delimiters=",\t;|")
                delim = dialect.delimiter
            except Exception:
                delim = "\t" if "\t" in sample else ","
        else:
            delim = delimiter

        reader = csv.reader(io.StringIO(raw_text), delimiter=delim)
        rows = [r for r in reader if any(cell.strip() for cell in r)]
        
        if not rows:
            return raw_text

        max_cols = max(len(r) for r in rows)
        table_lines = []
        
        # Header
        header = [c.strip() for c in rows[0]] + [""] * (max_cols - len(rows[0]))
        table_lines.append("| " + " | ".join(header) + " |")
        table_lines.append("| " + " | ".join(["---"] * max_cols) + " |")

        for r in rows[1:]:
            padded = [c.strip() for c in r] + [""] * (max_cols - len(r))
            table_lines.append("| " + " | ".join(padded) + " |")

        return "\n".join(table_lines)
    except Exception as e:
        logger.warning(f"CSV table formatting failed, falling back to raw text: {e}")
        return raw_text

def extract_text_from_plaintext(file_bytes: bytes) -> str:
    """Decodes plain text / markdown / JSON files with encoding fallbacks."""
    for enc in ("utf-8", "utf-8-sig", "latin-1", "cp1252"):
        try:
            return file_bytes.decode(enc)
        except UnicodeDecodeError:
            continue
    return file_bytes.decode("utf-8", errors="replace")

def extract_snippets_for_options(text: str, option_a: Optional[str] = None, option_b: Optional[str] = None, max_snippets: int = 4) -> List[str]:
    """Finds paragraphs, table rows, or sections most relevant to the options."""
    if not text:
        return []
    
    # Check if text is tabular markdown
    lines = [ln.strip() for ln in text.split("\n") if ln.strip()]
    table_rows = [ln for ln in lines if ln.startswith("|") and not ln.startswith("| ---")]

    paragraphs = [p.strip() for p in text.split("\n\n") if len(p.strip()) > 20]
    if not paragraphs:
        paragraphs = lines
        
    candidates = table_rows if len(table_rows) >= 2 else paragraphs

    scored_snippets = []
    opt_a_lower = option_a.lower() if option_a else ""
    opt_b_lower = option_b.lower() if option_b else ""

    for item in candidates:
        item_lower = item.lower()
        score = 0
        if opt_a_lower and opt_a_lower in item_lower:
            score += 3
        if opt_b_lower and opt_b_lower in item_lower:
            score += 3
        # keywords like cost, price, speed, performance, advantage, score, metric
        for kw in ("cost", "price", "speed", "performance", "advantage", "disadvantage", "feature", "pros", "cons", "sla", "rating", "score", "total"):
            if kw in item_lower:
                score += 1
        
        scored_snippets.append((score, item))

    # Sort descending by relevance score
    scored_snippets.sort(key=lambda x: x[0], reverse=True)
    selected = [s[1] for s in scored_snippets[:max_snippets] if len(s[1]) > 0]
    
    # Fallback to first few entries if score is all 0
    if not selected:
        selected = candidates[:max_snippets]

    # Clean and truncate snippets
    cleaned = []
    for s in selected:
        s_clean = " ".join(s.split())
        # Clean markdown table pipes for nice reading if short
        if s_clean.startswith("|") and s_clean.endswith("|"):
            parts = [p.strip() for p in s_clean.split("|") if p.strip()]
            s_clean = " • ".join(parts)
        if len(s_clean) > 280:
            s_clean = s_clean[:277] + "..."
        cleaned.append(s_clean)
        
    return cleaned

def parse_uploaded_document(filename: str, file_bytes: bytes, option_a: Optional[str] = None, option_b: Optional[str] = None) -> Dict[str, Any]:
    """Main entrypoint for parsing any supported document file including Excel and CSV."""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "txt"
    
    extracted_text = ""
    if ext in ("xlsx", "xlsm", "xltx", "xltm"):
        extracted_text = extract_text_from_excel(file_bytes)
    elif ext in ("csv", "tsv"):
        extracted_text = extract_text_from_csv(file_bytes, delimiter="\t" if ext == "tsv" else None)
    elif ext == "pdf":
        extracted_text = extract_text_from_pdf(file_bytes)
    elif ext in ("docx", "doc"):
        extracted_text = extract_text_from_docx(file_bytes)
    elif ext in ("txt", "md", "markdown", "json", "yaml", "yml", "log"):
        extracted_text = extract_text_from_plaintext(file_bytes)
    else:
        # Fallback to plain text decode
        extracted_text = extract_text_from_plaintext(file_bytes)

    extracted_text = extracted_text.strip()
    words = extracted_text.split()
    word_count = len(words)
    char_count = len(extracted_text)

    snippets = extract_snippets_for_options(extracted_text, option_a, option_b)

    return {
        "filename": filename,
        "file_type": ext,
        "char_count": char_count,
        "word_count": word_count,
        "extracted_text": extracted_text,
        "summary_snippets": snippets
    }
