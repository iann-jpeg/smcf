import json
import re
from pathlib import Path

import PyPDF2

pdf_path = Path(r"d:\smart money cash flow\src\assets\member-statements (1).pdf")
reader = PyPDF2.PdfReader(str(pdf_path))
rows = []

for page in reader.pages:
    text = page.extract_text() or ""
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    for line in lines:
        if re.match(r"^MEM\d+", line):
            # Some lines join the last number and status (e.g., "0active").
            line = re.sub(r"(\d)(active|inactive|suspended)$", r"\1 \2", line, flags=re.IGNORECASE)
            parts = line.split()
            member_id = parts[0]

            status = "active"
            if parts[-1].lower() in {"active", "inactive", "suspended"}:
                status = parts[-1].lower()
                parts = parts[:-1]

            numbers = [p for p in parts[1:] if p.isdigit()]
            if len(numbers) >= 3:
                savings, shares, loan = map(float, numbers[-3:])
                name_parts = parts[1:-3]
            else:
                savings = shares = loan = 0
                name_parts = parts[1:]

            name = " ".join(name_parts).strip() or member_id
            rows.append({
                "memberId": member_id,
                "name": name.title(),
                "savings": savings,
                "shares": shares,
                "loanBalance": loan,
                "status": status,
            })

json_path = pdf_path.with_suffix(".json")
json_path.write_text(json.dumps(rows, indent=2), encoding="utf-8")
print(f"Extracted {len(rows)} rows to {json_path}")
