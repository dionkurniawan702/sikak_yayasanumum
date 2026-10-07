import os
import sys
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT

# Ensure current directory is in path
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.append(current_dir)

from helpers import setup_document_styles, set_cell_shading, set_cell_margins
from part1_intro_and_cycles import build_part1
from part2_control_and_data import build_part2
from part3_erd_and_rea import build_part3
from part4_normalization_and_physical import build_part4
from part5_dummy_audit_test import build_part5
from part6_architecture_and_conclusion import build_part6

def create_cover_page(doc):
    """Generate a formal Master's level cover page."""
    # Top spacing
    p_top = doc.add_paragraph()
    p_top.paragraph_format.space_before = Pt(36)
    p_top.paragraph_format.space_after = Pt(12)
    p_top.alignment = WD_ALIGN_PARAGRAPH.CENTER
    
    r_cat = p_top.add_run("TUGAS AKADEMIK MAGISTER (S2) SISTEM INFORMASI AKUNTANSI\n")
    r_cat.bold = True
    r_cat.font.name = "Calibri"
    r_cat.font.size = Pt(12)
    r_cat.font.color.rgb = RGBColor(0x2B, 0x6C, 0xB0)

    # Title
    p_title = doc.add_paragraph()
    p_title.paragraph_format.space_after = Pt(18)
    p_title.paragraph_format.line_spacing = 1.2
    p_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    
    r_title = p_title.add_run(
        "ANALISIS DAN PERANCANGAN SISTEM INFORMASI AKUNTANSI (SIA) TERINTEGRASI\n"
        "BERBASIS FRAMEWORK REA, ENTITY RELATIONSHIP DIAGRAM (ERD),\n"
        "DAN PENGENDALIAN INTERNAL COSO\n"
    )
    r_title.bold = True
    r_title.font.name = "Calibri"
    r_title.font.size = Pt(18)
    r_title.font.color.rgb = RGBColor(0x1B, 0x36, 0x5D)

    # Subtitle
    p_sub = doc.add_paragraph()
    p_sub.paragraph_format.space_after = Pt(36)
    p_sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r_sub = p_sub.add_run(
        "Studi Kasus Implementasi Riil: SIKAK (Sistem Informasi Keuangan & Akuntansi Kelembagaan)\n"
        "Yayasan Pendidikan dan Dakwah Islam Multi-Unit (Model Perguruan Dareliman)"
    )
    r_sub.font.name = "Calibri"
    r_sub.font.size = Pt(12)
    r_sub.font.color.rgb = RGBColor(0x4A, 0x55, 0x68)
    r_sub.italic = True

    # Callout banner box for Course details
    tbl = doc.add_table(rows=1, cols=1)
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    cell = tbl.cell(0, 0)
    set_cell_shading(cell, "F1F5F9")
    set_cell_margins(cell, top=180, bottom=180, left=250, right=250)
    
    cp = cell.paragraphs[0]
    cp.alignment = WD_ALIGN_PARAGRAPH.CENTER
    cp.paragraph_format.space_after = Pt(0)
    cp.paragraph_format.line_spacing = 1.3
    
    rc1 = cp.add_run("Mata Kuliah: Sistem Informasi Akuntansi Lanjutan (Advanced AIS)\n")
    rc1.bold = True
    rc1.font.name = "Calibri"
    rc1.font.size = Pt(11)
    rc1.font.color.rgb = RGBColor(0x1B, 0x36, 0x5D)

    rc2 = cp.add_run("Program: Magister Akuntansi / Magister Sistem Informasi (S2)\n"
                     "Standar Akuntansi: ISAK 35 (Entitas Berorientasi Nonlaba / Yayasan)\n"
                     "Arsitektur Teknologi: Node.js • Express • Prisma ORM • MySQL • React SPA\n")
    rc2.font.name = "Calibri"
    rc2.font.size = Pt(10)
    rc2.font.color.rgb = RGBColor(0x2D, 0x37, 0x48)

    # Spacer
    p_sp = doc.add_paragraph()
    p_sp.paragraph_format.space_before = Pt(80)

    # Bottom Metadata
    p_bot = doc.add_paragraph()
    p_bot.paragraph_format.space_after = Pt(0)
    p_bot.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_bot.paragraph_format.line_spacing = 1.2
    
    r_bot = p_bot.add_run(
        "Disusun untuk Memenuhi Tugas Perkuliahan Pascasarjana\n"
        "Tahun Akademik 2026\n"
    )
    r_bot.bold = True
    r_bot.font.name = "Calibri"
    r_bot.font.size = Pt(11)
    r_bot.font.color.rgb = RGBColor(0x1B, 0x36, 0x5D)

    # Page Break
    doc.add_page_break()

def create_table_of_contents(doc):
    """Generate structured Table of Contents outline."""
    p_h = doc.add_paragraph()
    p_h.paragraph_format.space_before = Pt(12)
    p_h.paragraph_format.space_after = Pt(18)
    r_h = p_h.add_run("DAFTAR ISI LENGKAP LAPORAN (19 POIN)")
    r_h.bold = True
    r_h.font.name = "Calibri"
    r_h.font.size = Pt(16)
    r_h.font.color.rgb = RGBColor(0x1B, 0x36, 0x5D)

    toc_items = [
        ("1. Pendahuluan", "Latar Belakang, Fenomena Empiris, Rumusan Masalah, Tujuan & Manfaat"),
        ("2. Profil dan Ruang Lingkup", "Profil Yayasan Pendidikan Multi-Unit, Model Bisnis Nirlaba, Batasan Sistem"),
        ("3. Siklus Pendapatan / Penjualan", "Penerimaan Jasa Pendidikan (SPP, BOS, Donasi), Alur Dokumen, Kontrol Mitigasi"),
        ("4. Siklus Pengeluaran / Pembelian", "Belanja Berbasis Anggaran (RAB), 6 Tahap Alur SPJ, Pengembalian Kas & Aset"),
        ("5. Aturan Bisnis, Skema Pengodean & Titik Pengendalian", "Prinsip No Budget No Cash, COA 4-Level, Pengendalian COSO Framework"),
        ("6. Desain Login, Otorisasi & Hak Akses", "Otentikasi JWT & Bcryptjs, Matriks RBAC, Pemisahan Tugas (SoD Maker-Approver)"),
        ("7. Analisis Kebutuhan Data", "Dekomposisi Master Data, Data Transaksional, Metadata & Analisis IPO"),
        ("8. Model Konseptual, ERD & Kardinalitas", "Struktur Entitas Relasional, Analisis Kardinalitas 1:N & N:M, Batasan Integritas"),
        ("9. Pemodelan REA (Resources, Events, Agents)", "Ontologi REA McCarthy (1982), Analisis Dualitas Ekonomi (Give-Take Duality)"),
        ("10. Pemetaan ERD/REA ke Model Relasional", "Transformasi REA ke Tabel MySQL, Matriks Pemetaan Terintegrasi SIKAK"),
        ("11. Functional Dependency dan Normalisasi", "Ketergantungan Fungsional (FD), 1NF, 2NF, 3NF, BCNF & Analisis Kolom JSON"),
        ("12. Desain Logis Final", "Kamus Data Logis, Spesifikasi Tipe Atribut, Kunci Primer & Kunci Asing"),
        ("13. Desain Fisik Database MySQL", "Skrip DDL Tabel Inti, Optimasi Tipe Data DECIMAL(15,2), Strategi Indeks"),
        ("14. Dummy Master Data dan Transaksi", "Simulasi Siklus Penuh: SPP Siswa, Pencairan Belanja, SPJ Nota & Jurnal Otomatis"),
        ("15. Audit Trail dan Rekonsiliasi", "Struktur Tabel audit_logs Append-Only, Rekonsiliasi Bank & Kas, Fitur Trash Bin"),
        ("16. Implementasi MySQL dan Pengujian", "Kueri SQL Audit Integritas Saldo & Varians Anggaran, Pengujian Edge Cases"),
        ("17. Arsitektur dan Alur Implementasi", "Arsitektur 3-Tier Enterprise (React + Node.js Express + MySQL), Diagram Sekuens"),
        ("18. Tugas Analisis dan Refleksi", "Evaluasi Kritis Keunggulan & Kerentanan, OCR Nota, Virtual Account & Refleksi S2"),
        ("19. Kesimpulan", "Sintesis Akademis, Temuan Kunci, dan Rekomendasi Manajerial Masa Depan")
    ]

    tbl = doc.add_table(rows=len(toc_items), cols=2)
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    for idx, (title, desc) in enumerate(toc_items):
        cell_title = tbl.rows[idx].cells[0]
        cell_desc = tbl.rows[idx].cells[1]
        
        cell_title.width = Inches(2.5)
        cell_desc.width = Inches(4.2)
        
        set_cell_margins(cell_title, top=50, bottom=50, left=80, right=80)
        set_cell_margins(cell_desc, top=50, bottom=50, left=80, right=80)
        
        pt = cell_title.paragraphs[0]
        pt.paragraph_format.space_after = Pt(0)
        rt = pt.add_run(title)
        rt.bold = True
        rt.font.name = "Calibri"
        rt.font.size = Pt(10)
        rt.font.color.rgb = RGBColor(0x1B, 0x36, 0x5D)

        pd = cell_desc.paragraphs[0]
        pd.paragraph_format.space_after = Pt(0)
        rd = pd.add_run(desc)
        rd.font.name = "Calibri"
        rd.font.size = Pt(9.5)
        rd.font.color.rgb = RGBColor(0x4A, 0x55, 0x68)

    doc.add_page_break()

def generate_document():
    print("[1/8] Inisialisasi dokumen Word...")
    doc = docx.Document()
    setup_document_styles(doc)

    print("[2/8] Membuat Halaman Judul & Daftar Isi...")
    create_cover_page(doc)
    create_table_of_contents(doc)

    print("[3/8] Membangun Bagian 1: Poin 1 - 4 (Pendahuluan, Profil, Siklus Pendapatan & Pengeluaran)...")
    build_part1(doc)

    print("[4/8] Membangun Bagian 2: Poin 5 - 7 (Aturan Bisnis, Login/Otorisasi, Kebutuhan Data)...")
    build_part2(doc)

    print("[5/8] Membangun Bagian 3: Poin 8 - 10 (ERD, Pemodelan REA, Pemetaan Relasional)...")
    build_part3(doc)

    print("[6/8] Membangun Bagian 4: Poin 11 - 13 (Normalisasi, Desain Logis, DDL MySQL)...")
    build_part4(doc)

    print("[7/8] Membangun Bagian 5: Poin 14 - 16 (Dummy Data, Audit Trail, Pengujian MySQL)...")
    build_part5(doc)

    print("[8/8] Membangun Bagian 6: Poin 17 - 19 (Arsitektur 3-Tier, Refleksi S2, Kesimpulan)...")
    build_part6(doc)

    # Save destination
    output_filename = "TUGAS_S2_SIA_SIKAK_YAYASAN.docx"
    output_path = os.path.abspath(os.path.join(current_dir, "..", "..", output_filename))
    doc.save(output_path)
    print(f"\n[SUKSES] Dokumen Word berhasil dibuat: {output_path}")
    print(f"Ukuran file: {os.path.getsize(output_path)} bytes")
    return output_path

if __name__ == "__main__":
    generate_document()
