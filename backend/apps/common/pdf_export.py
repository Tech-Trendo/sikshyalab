"""PDF export helpers (stdlib-only, no third-party PDF libs)."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Sequence

BRAND_PRIMARY = (0.141, 0.278, 0.467)  # #244777
BRAND_ACCENT = (0.961, 0.620, 0.051)  # #f59e0d
BRAND_TEXT = (0.12, 0.16, 0.22)
BRAND_MUTED = (0.45, 0.5, 0.56)
BRAND_BORDER = (0.88, 0.9, 0.93)
BRAND_ROW_ALT = (0.97, 0.98, 0.99)
BRAND_WHITE = (1.0, 1.0, 1.0)

INSTITUTE_NAME = "ShikshaLab"
INSTITUTE_TAGLINE = "Premier IT Training Institute"
INSTITUTE_WEBSITE = "www.shikshalab.com"
INSTITUTE_EMAIL = "certificates@shikshalab.com"


def _escape(text: str) -> str:
    return (
        str(text)
        .replace("\\", "\\\\")
        .replace("(", "\\(")
        .replace(")", "\\)")
    )


def _truncate(text: str, max_len: int) -> str:
    text = str(text or "")
    if len(text) <= max_len:
        return text
    if max_len <= 3:
        return text[:max_len]
    return f"{text[: max_len - 3]}..."


def _set_fill(stream: list[str], color: tuple[float, float, float]) -> None:
    stream.append(f"{color[0]} {color[1]} {color[2]} rg")


def _set_stroke(stream: list[str], color: tuple[float, float, float]) -> None:
    stream.append(f"{color[0]} {color[1]} {color[2]} RG")


def _draw_rect(
    stream: list[str], x: float, y: float, w: float, h: float, fill: bool = True
) -> None:
    stream.append(f"{x} {y} {w} {h} re")
    stream.append("f" if fill else "S")


def _draw_text(
    stream: list[str],
    x: float,
    y: float,
    text: str,
    size: int,
    *,
    bold: bool = False,
    color: tuple[float, float, float] | None = None,
    max_width: int = 80,
) -> None:
    font = "/F2" if bold else "/F1"
    label = _escape(_truncate(text, max_width))
    _set_fill(stream, color if color is not None else BRAND_TEXT)
    stream.extend(["BT", f"{font} {size} Tf", f"{x} {y} Td", f"({label}) Tj", "ET"])
    _set_fill(stream, BRAND_TEXT)


def _assemble_pdf(page_streams: list[str], page_w: int = 612, page_h: int = 792) -> bytes:
    """
    Build a PDF with sequentially numbered objects (required for valid xref).

    Layout: 1 Catalog, 2 Pages, 3 Font regular, 4 Font bold,
    then page/content pairs from 5 upward.
    """
    font_regular = 3
    font_bold = 4
    content_start = 5

    parts: list[tuple[int, str]] = []
    parts.append((1, "1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n"))

    kids = " ".join(f"{content_start + i * 2} 0 R" for i in range(len(page_streams)))
    parts.append(
        (2, f"2 0 obj<< /Type /Pages /Kids [{kids}] /Count {len(page_streams)} >>endobj\n")
    )
    parts.append(
        (
            font_regular,
            f"{font_regular} 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n",
        )
    )
    parts.append(
        (
            font_bold,
            f"{font_bold} 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>endobj\n",
        )
    )

    for i, page_stream in enumerate(page_streams):
        page_num = content_start + i * 2
        content_num = page_num + 1
        parts.append(
            (
                page_num,
                f"{page_num} 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {page_w} {page_h}] "
                f"/Contents {content_num} 0 R /Resources << /Font << /F1 {font_regular} 0 R "
                f"/F2 {font_bold} 0 R >> >> >>endobj\n",
            )
        )
        encoded = page_stream.encode("latin-1", errors="replace")
        parts.append(
            (
                content_num,
                f"{content_num} 0 obj<< /Length {len(encoded)} >>stream\n"
                f"{page_stream}\nendstream\nendobj\n",
            )
        )

    max_obj = max(num for num, _ in parts)
    pdf = bytearray(b"%PDF-1.4\n")
    offsets = [0] * (max_obj + 1)
    for obj_num, body in sorted(parts, key=lambda item: item[0]):
        offsets[obj_num] = len(pdf)
        pdf.extend(body.encode("latin-1", errors="replace"))

    xref_pos = len(pdf)
    pdf.extend(f"xref\n0 {max_obj + 1}\n".encode("ascii"))
    pdf.extend(b"0000000000 65535 f \n")
    for i in range(1, max_obj + 1):
        pdf.extend(f"{offsets[i]:010d} 00000 n \n".encode("ascii"))
    pdf.extend(
        f"trailer<< /Size {max_obj + 1} /Root 1 0 R >>\n"
        f"startxref\n{xref_pos}\n%%EOF".encode("ascii")
    )
    return bytes(pdf)


def _draw_brand_header(
    stream: list[str], page_w: float, page_h: float, title: str, subtitle: str
) -> None:
    bar_h = 28
    _set_fill(stream, BRAND_PRIMARY)
    _draw_rect(stream, 0, page_h - bar_h, page_w * 0.72, bar_h)
    _set_fill(stream, BRAND_ACCENT)
    _draw_rect(stream, page_w * 0.72, page_h - bar_h, page_w * 0.28, bar_h)

    _draw_text(stream, 40, page_h - 19, INSTITUTE_NAME, 14, bold=True, color=BRAND_WHITE)
    _draw_text(stream, page_w - 40, page_h - 19, "Official Report", 10, color=BRAND_WHITE, max_width=30)

    _draw_text(stream, 40, page_h - 58, title, 18, bold=True, color=BRAND_PRIMARY)
    _draw_text(stream, 40, page_h - 76, subtitle, 9, color=BRAND_MUTED)

    _set_stroke(stream, BRAND_BORDER)
    stream.append("1 w")
    _draw_rect(stream, 40, page_h - 88, page_w - 80, 0.5, fill=False)


def _draw_brand_footer(
    stream: list[str], page_w: float, page_num: int, total_pages: int
) -> None:
    _set_stroke(stream, BRAND_BORDER)
    stream.append("0.5 w")
    _draw_rect(stream, 40, 42, page_w - 80, 0.5, fill=False)

    _draw_text(stream, 40, 26, INSTITUTE_NAME, 9, bold=True, color=BRAND_PRIMARY)
    _draw_text(
        stream,
        40,
        14,
        f"{INSTITUTE_TAGLINE}  |  {INSTITUTE_WEBSITE}  |  {INSTITUTE_EMAIL}",
        8,
        color=BRAND_MUTED,
        max_width=90,
    )
    _draw_text(stream, page_w - 40, 20, f"Page {page_num} of {total_pages}", 8, color=BRAND_MUTED)
    _draw_text(stream, page_w - 40, 10, "ShikshaLab Verified", 7, color=BRAND_ACCENT)


def build_table_pdf(
    title: str,
    headers: Sequence[str],
    rows: Sequence[Sequence[Any]],
    *,
    subtitle: str | None = None,
    empty_message: str | None = None,
) -> bytes:
    """Build a branded ShikshaLab report PDF with header, table, and footer."""
    page_w = 612
    page_h = 792
    rows_per_page = 22
    header_labels = [str(h) for h in headers]
    row_list = [list(row) for row in rows]

    if not row_list:
        if empty_message:
            header_labels = header_labels or ["Message"]
            row_list = [[empty_message]]
        else:
            row_list = [[]]

    page_chunks = [
        row_list[i : i + rows_per_page] for i in range(0, len(row_list), rows_per_page)
    ]
    total_pages = len(page_chunks)
    col_count = max(len(header_labels), 1)
    table_w = page_w - 80
    col_w = table_w / col_count
    header_h = 22
    row_h = 18
    generated = subtitle or f"Generated {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"

    def _cell_max_chars() -> int:
        return max(8, int(col_w / 4.5))

    page_streams: list[str] = []
    for page_index, page_rows in enumerate(page_chunks):
        stream: list[str] = ["q"]
        _set_fill(stream, BRAND_WHITE)
        _draw_rect(stream, 0, 0, page_w, page_h)

        page_subtitle = generated if page_index == 0 else f"{title} (continued)"
        _draw_brand_header(stream, page_w, page_h, title, page_subtitle)

        y = page_h - 110
        _set_fill(stream, BRAND_PRIMARY)
        _draw_rect(stream, 40, y - header_h, table_w, header_h)
        for i, header in enumerate(header_labels):
            _draw_text(
                stream,
                46 + i * col_w,
                y - 15,
                str(header),
                9,
                bold=True,
                color=BRAND_WHITE,
                max_width=_cell_max_chars(),
            )
        y -= header_h

        for row_index, row in enumerate(page_rows):
            if row_index % 2 == 1:
                _set_fill(stream, BRAND_ROW_ALT)
                _draw_rect(stream, 40, y - row_h, table_w, row_h)
            _set_stroke(stream, BRAND_BORDER)
            stream.append("0.25 w")
            _draw_rect(stream, 40, y - row_h, table_w, row_h, fill=False)
            if empty_message and len(row) == 1:
                _draw_text(
                    stream,
                    46,
                    y - 13,
                    str(row[0] if row[0] is not None else ""),
                    9,
                    max_width=max(40, int(table_w / 5)),
                )
            else:
                for i, cell in enumerate(row):
                    _draw_text(
                        stream,
                        46 + i * col_w,
                        y - 13,
                        str(cell if cell is not None else ""),
                        8,
                        max_width=_cell_max_chars(),
                    )
            y -= row_h

        if page_index == total_pages - 1 and not empty_message:
            _draw_text(
                stream,
                40,
                y - 16,
                f"Total records: {len(rows)}",
                9,
                bold=True,
                color=BRAND_PRIMARY,
            )

        _draw_brand_footer(stream, page_w, page_index + 1, total_pages)
        stream.append("Q")
        page_streams.append("\n".join(stream))

    return _assemble_pdf(page_streams, page_w, page_h)


def build_certificate_pdf(data: dict[str, Any]) -> bytes:
    """Build a branded single-page certificate PDF."""
    page_w = 612
    page_h = 792
    stream: list[str] = ["q"]

    _set_fill(stream, BRAND_WHITE)
    _draw_rect(stream, 0, 0, page_w, page_h)

    _set_stroke(stream, BRAND_PRIMARY)
    stream.append("2 w")
    _draw_rect(stream, 30, 30, page_w - 60, page_h - 60, fill=False)

    _set_stroke(stream, BRAND_BORDER)
    stream.append("1 w")
    _draw_rect(stream, 45, 45, page_w - 90, page_h - 90, fill=False)

    _set_fill(stream, BRAND_PRIMARY)
    _draw_rect(stream, 45, page_h - 55, page_w - 90 - 80, 8)
    _set_fill(stream, BRAND_ACCENT)
    _draw_rect(stream, page_w - 45 - 80, page_h - 55, 80, 8)

    institute = str(data.get("institute_name") or INSTITUTE_NAME)
    student = str(data.get("student_name") or "Student Name")
    course = str(data.get("course_name") or "Course Name")

    _draw_text(stream, page_w / 2 - len(institute) * 3.2, page_h - 95, institute, 20, bold=True, color=BRAND_PRIMARY)
    purpose = str(data.get("purpose") or "CERTIFICATE OF ACHIEVEMENT").upper()
    _draw_text(stream, page_w / 2 - 70, page_h - 125, purpose, 10, color=BRAND_ACCENT)
    _draw_text(stream, page_w / 2 - len(student) * 4.5, page_h - 200, student, 28, bold=True, color=BRAND_PRIMARY)
    _draw_text(stream, page_w / 2 - 95, page_h - 235, "has successfully completed", 11, color=BRAND_MUTED)
    _draw_text(stream, page_w / 2 - len(course) * 3, page_h - 260, course, 16, bold=True, color=BRAND_TEXT)

    if data.get("batch_name"):
        _draw_text(stream, page_w / 2 - 60, page_h - 285, f"Batch: {data['batch_name']}", 10, color=BRAND_MUTED)

    details_y = 220
    _draw_text(stream, 70, details_y + 40, f"Certificate No: {data.get('certificate_number', '')}", 10)
    _draw_text(stream, 70, details_y + 22, f"Verification Code: {data.get('verification_code', '')}", 9, color=BRAND_MUTED)
    _draw_text(stream, 70, details_y + 4, f"Issue Date: {data.get('issue_date', '')}", 9, color=BRAND_MUTED)
    if data.get("completion_date"):
        _draw_text(stream, 70, details_y - 14, f"Completion Date: {data['completion_date']}", 9, color=BRAND_MUTED)
    if data.get("duration"):
        _draw_text(stream, 70, details_y - 32, f"Duration: {data['duration']}", 9, color=BRAND_MUTED)
    if data.get("grade"):
        _draw_text(stream, 70, details_y - 50, f"Grade: {data['grade']}", 9, color=BRAND_MUTED)
    if data.get("instructor_name"):
        _draw_text(stream, 70, details_y - 68, f"Instructor: {data['instructor_name']}", 9, color=BRAND_MUTED)

    _set_stroke(stream, BRAND_PRIMARY)
    stream.append("1 w")
    _draw_rect(stream, page_w - 145, details_y - 20, 80, 80, fill=False)
    _draw_text(stream, page_w - 130, details_y + 10, "QR VERIFY", 8, color=BRAND_PRIMARY)
    _draw_text(
        stream,
        page_w - 138,
        details_y - 5,
        _truncate(str(data.get("verification_code", "")), 12),
        7,
        color=BRAND_MUTED,
    )

    _draw_text(stream, page_w / 2 - 120, 95, INSTITUTE_TAGLINE, 9, color=BRAND_MUTED)
    _draw_text(stream, page_w / 2 - 55, 70, "ShikshaLab Verified", 9, bold=True, color=BRAND_PRIMARY)
    _set_fill(stream, BRAND_ACCENT)
    _draw_rect(stream, page_w / 2 + 45, 72, 6, 6)

    stream.append("Q")
    return _assemble_pdf(["\n".join(stream)], page_w, page_h)
