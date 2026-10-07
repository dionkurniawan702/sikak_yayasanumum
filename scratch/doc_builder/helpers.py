import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import parse_xml, OxmlElement
from docx.oxml.ns import nsdecls, qn

# Color constants
COLOR_NAVY = "1B365D"
COLOR_BLUE = "2B6CB0"
COLOR_SLATE = "2D3748"
COLOR_GRAY = "718096"
COLOR_LIGHT_BG = "F8FAFC"
COLOR_ALT_ROW = "F1F5F9"
COLOR_BORDER = "CBD5E1"
COLOR_INFO_BG = "EFF6FF"
COLOR_INFO_BORDER = "3B82F6"
COLOR_SUCCESS_BG = "ECFDF5"
COLOR_SUCCESS_BORDER = "10B981"
COLOR_WARN_BG = "FFFBEB"
COLOR_WARN_BORDER = "F59E0B"

def set_cell_shading(cell, color_hex):
    """Set background color of a table cell."""
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{color_hex}"/>')
    cell._tc.get_or_add_tcPr().append(shd)

def set_cell_margins(cell, top=100, bottom=100, left=150, right=150):
    """Set cell internal padding in twips (1 pt = 20 twips)."""
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = parse_xml(f'<w:tcMar {nsdecls("w")}>'
                      f'<w:top w:w="{top}" w:type="dxa"/>'
                      f'<w:bottom w:w="{bottom}" w:type="dxa"/>'
                      f'<w:left w:w="{left}" w:type="dxa"/>'
                      f'<w:right w:w="{right}" w:type="dxa"/>'
                      f'</w:tcMar>')
    tcPr.append(tcMar)

def set_table_borders(table, border_color=COLOR_BORDER):
    """Set clean thin borders for a table."""
    tblPr = table._tbl.tblPr
    borders = parse_xml(f'<w:tblBorders {nsdecls("w")}>'
                        f'<w:top w:val="single" w:sz="4" w:space="0" w:color="{border_color}"/>'
                        f'<w:bottom w:val="single" w:sz="4" w:space="0" w:color="{border_color}"/>'
                        f'<w:left w:val="none" w:sz="0" w:space="0" w:color="auto"/>'
                        f'<w:right w:val="none" w:sz="0" w:space="0" w:color="auto"/>'
                        f'<w:insideH w:val="single" w:sz="4" w:space="0" w:color="{border_color}"/>'
                        f'<w:insideV w:val="none" w:sz="0" w:space="0" w:color="auto"/>'
                        f'</w:tblBorders>')
    tblPr.append(borders)

def setup_document_styles(doc):
    """Configure default fonts, margins, and headings."""
    # Margins: Standard Academic Format (Top: 2.5cm, Bottom: 2.5cm, Left: 3cm, Right: 2.5cm)
    for section in doc.sections:
        section.top_margin = Inches(0.984)    # 2.5 cm
        section.bottom_margin = Inches(0.984) # 2.5 cm
        section.left_margin = Inches(1.181)   # 3.0 cm
        section.right_margin = Inches(0.984)  # 2.5 cm
        section.different_first_page_header_footer = True
        
        # Header
        header = section.header
        hp = header.paragraphs[0]
        hp.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        hrun = hp.add_run("SIKAK Yayasan • Tugas S2 Sistem Informasi Akuntansi (SIA)")
        hrun.font.name = "Calibri"
        hrun.font.size = Pt(8.5)
        hrun.font.color.rgb = RGBColor(0x71, 0x80, 0x96)

        # Footer
        footer = section.footer
        fp = footer.paragraphs[0]
        fp.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        frun = fp.add_run("Dokumentasi Analisis & Arsitektur SIA — Halaman ")
        frun.font.name = "Calibri"
        frun.font.size = Pt(8.5)
        frun.font.color.rgb = RGBColor(0x71, 0x80, 0x96)

    # Base style
    normal = doc.styles['Normal']
    normal.font.name = 'Calibri'
    normal.font.size = Pt(11)
    normal.font.color.rgb = RGBColor(0x2D, 0x37, 0x48) # Slate dark

def add_p(doc, text="", bold_prefix=None, space_after=6, line_spacing=1.15, italic=False):
    """Add a justified normal paragraph with optional bold prefix."""
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p.paragraph_format.space_after = Pt(space_after)
    p.paragraph_format.line_spacing = line_spacing

    if bold_prefix:
        r_pre = p.add_run(bold_prefix + " ")
        r_pre.bold = True
        r_pre.font.name = 'Calibri'
        r_pre.font.size = Pt(11)
        r_pre.font.color.rgb = RGBColor(0x1B, 0x36, 0x5D)

    if text:
        r = p.add_run(text)
        r.font.name = 'Calibri'
        r.font.size = Pt(11)
        r.italic = italic
        r.font.color.rgb = RGBColor(0x2D, 0x37, 0x48)
    return p

def add_bullet(doc, text, bold_prefix=None, level=0):
    """Add a bullet point."""
    p = doc.add_paragraph(style='List Bullet')
    p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p.paragraph_format.space_after = Pt(4)
    p.paragraph_format.line_spacing = 1.15

    if bold_prefix:
        r_pre = p.add_run(bold_prefix + " ")
        r_pre.bold = True
        r_pre.font.name = 'Calibri'
        r_pre.font.size = Pt(10.5)
        r_pre.font.color.rgb = RGBColor(0x1B, 0x36, 0x5D)

    r = p.add_run(text)
    r.font.name = 'Calibri'
    r.font.size = Pt(10.5)
    r.font.color.rgb = RGBColor(0x2D, 0x37, 0x48)
    return p

def add_h1(doc, text):
    """Heading 1: Chapter level."""
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(18)
    p.paragraph_format.space_after = Pt(8)
    p.paragraph_format.keep_with_next = True
    r = p.add_run(text)
    r.bold = True
    r.font.name = 'Calibri'
    r.font.size = Pt(16)
    r.font.color.rgb = RGBColor(0x1B, 0x36, 0x5D) # Navy
    return p

def add_h2(doc, text):
    """Heading 2: Sub-chapter level."""
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(12)
    p.paragraph_format.space_after = Pt(6)
    p.paragraph_format.keep_with_next = True
    r = p.add_run(text)
    r.bold = True
    r.font.name = 'Calibri'
    r.font.size = Pt(13)
    r.font.color.rgb = RGBColor(0x2B, 0x6C, 0xB0) # Blue
    return p

def add_h3(doc, text):
    """Heading 3: Section level."""
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(8)
    p.paragraph_format.space_after = Pt(4)
    p.paragraph_format.keep_with_next = True
    r = p.add_run(text)
    r.bold = True
    r.font.name = 'Calibri'
    r.font.size = Pt(11.5)
    r.font.color.rgb = RGBColor(0x2D, 0x37, 0x48) # Slate
    return p

def add_callout(doc, title, text, box_type='info'):
    """Add a professional styled callout / alert box."""
    if box_type == 'success':
        bg_color = COLOR_SUCCESS_BG
        border_color = COLOR_SUCCESS_BORDER
        badge_text = "PENJELASAN PRAKTIS & ANALISIS AKUNTANSI"
        title_rgb = RGBColor(0x06, 0x5F, 0x46)
    elif box_type == 'warn':
        bg_color = COLOR_WARN_BG
        border_color = COLOR_WARN_BORDER
        badge_text = "TITIK PENGENDALIAN & RISIKO INTERNAL"
        title_rgb = RGBColor(0x92, 0x40, 0x0E)
    else:
        bg_color = COLOR_INFO_BG
        border_color = COLOR_INFO_BORDER
        badge_text = "CATATAN KUNCI SIA & METODOLOGI"
        title_rgb = RGBColor(0x1E, 0x40, 0xAF)

    tbl = doc.add_table(rows=1, cols=1)
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    tbl.autofit = False

    cell = tbl.cell(0, 0)
    set_cell_shading(cell, bg_color)
    set_cell_margins(cell, top=140, bottom=140, left=200, right=200)

    # Thick left border, none for others
    tcPr = cell._tc.get_or_add_tcPr()
    borders = parse_xml(f'<w:tcBorders {nsdecls("w")}>'
                        f'<w:left w:val="single" w:sz="36" w:space="0" w:color="{border_color}"/>'
                        f'<w:top w:val="none" w:sz="0" w:space="0" w:color="auto"/>'
                        f'<w:right w:val="none" w:sz="0" w:space="0" w:color="auto"/>'
                        f'<w:bottom w:val="none" w:sz="0" w:space="0" w:color="auto"/>'
                        f'</w:tcBorders>')
    tcPr.append(borders)

    cp = cell.paragraphs[0]
    cp.paragraph_format.space_after = Pt(2)
    r_badge = cp.add_run(f"[{badge_text}] {title}\n")
    r_badge.bold = True
    r_badge.font.name = 'Calibri'
    r_badge.font.size = Pt(10)
    r_badge.font.color.rgb = title_rgb

    r_text = cp.add_run(text)
    r_text.font.name = 'Calibri'
    r_text.font.size = Pt(10)
    r_text.font.color.rgb = RGBColor(0x1E, 0x29, 0x3B)

    # Add small spacer after table
    sp = doc.add_paragraph()
    sp.paragraph_format.space_after = Pt(4)

def add_table(doc, headers, rows_data, col_widths=None):
    """Add a beautifully formatted table with headers, zebra stripes, and custom widths."""
    tbl = doc.add_table(rows=len(rows_data) + 1, cols=len(headers))
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    tbl.autofit = False
    set_table_borders(tbl)

    # Header Row
    hdr_cells = tbl.rows[0].cells
    for i, title in enumerate(headers):
        cell = hdr_cells[i]
        set_cell_shading(cell, COLOR_NAVY)
        set_cell_margins(cell, top=100, bottom=100, left=140, right=140)
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_after = Pt(0)
        run = p.add_run(title)
        run.bold = True
        run.font.name = 'Calibri'
        run.font.size = Pt(9.5)
        run.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)

    # Data Rows
    for r_idx, row_values in enumerate(rows_data):
        row_cells = tbl.rows[r_idx + 1].cells
        row_bg = COLOR_ALT_ROW if r_idx % 2 == 1 else "FFFFFF"
        for c_idx, val in enumerate(row_values):
            cell = row_cells[c_idx]
            if row_bg != "FFFFFF":
                set_cell_shading(cell, row_bg)
            set_cell_margins(cell, top=80, bottom=80, left=120, right=120)
            p = cell.paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.LEFT
            p.paragraph_format.space_after = Pt(0)
            run = p.add_run(str(val))
            run.font.name = 'Calibri'
            run.font.size = Pt(9)
            run.font.color.rgb = RGBColor(0x2D, 0x37, 0x48)

    # Apply Column Widths if given (in inches)
    if col_widths and len(col_widths) == len(headers):
        for row in tbl.rows:
            for c_idx, width in enumerate(col_widths):
                row.cells[c_idx].width = Inches(width)

    # Spacer after table
    sp = doc.add_paragraph()
    sp.paragraph_format.space_after = Pt(4)

def add_code_block(doc, code_str, caption=None):
    """Add a shaded code block with monospace font."""
    tbl = doc.add_table(rows=1, cols=1)
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    tbl.autofit = False

    cell = tbl.cell(0, 0)
    set_cell_shading(cell, "F8FAFC")
    set_cell_margins(cell, top=120, bottom=120, left=160, right=160)

    tcPr = cell._tc.get_or_add_tcPr()
    borders = parse_xml(f'<w:tcBorders {nsdecls("w")}>'
                        f'<w:left w:val="single" w:sz="12" w:space="0" w:color="94A3B8"/>'
                        f'<w:top w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>'
                        f'<w:right w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>'
                        f'<w:bottom w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>'
                        f'</w:tcBorders>')
    tcPr.append(borders)

    cp = cell.paragraphs[0]
    cp.paragraph_format.space_after = Pt(0)
    cp.paragraph_format.line_spacing = 1.05

    if caption:
        rcap = cp.add_run(f"// {caption}\n")
        rcap.bold = True
        rcap.font.name = "Consolas"
        rcap.font.size = Pt(8.5)
        rcap.font.color.rgb = RGBColor(0x25, 0x63, 0xEB)

    r_code = cp.add_run(code_str)
    r_code.font.name = "Consolas"
    r_code.font.size = Pt(8.5)
    r_code.font.color.rgb = RGBColor(0x0F, 0x17, 0x2A)

    sp = doc.add_paragraph()
    sp.paragraph_format.space_after = Pt(4)
