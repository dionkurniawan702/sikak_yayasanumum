const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('Generating comprehensive ERD and REA documentation for SIKAK YAYASAN UMUM...');

const htmlContent = `<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dokumentasi Arsitektur Data: ERD & REA - SIKAK Yayasan Umum</title>
    <style>
        @page {
            size: A4 portrait;
            margin: 14mm 12mm 16mm 12mm;
            @bottom-right {
                content: counter(page);
            }
        }

        *, *::before, *::after {
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            color: #1e293b;
            background-color: #ffffff;
            line-height: 1.5;
            font-size: 9.5pt;
            margin: 0;
            padding: 0;
        }

        /* Page Layout & Breaks */
        .page {
            page-break-after: always;
            break-after: page;
            position: relative;
            padding: 2mm 0;
        }

        .page:last-child {
            page-break-after: auto;
            break-after: auto;
        }

        .avoid-break {
            page-break-inside: avoid;
            break-inside: avoid;
        }

        /* Typography */
        h1, h2, h3, h4, h5, h6 {
            color: #0f172a;
            font-weight: 700;
            margin-top: 0;
            line-height: 1.25;
        }

        h1 { font-size: 20pt; margin-bottom: 8pt; }
        h2 { 
            font-size: 13.5pt; 
            margin-bottom: 6pt; 
            padding-bottom: 3pt;
            border-bottom: 2px solid #2563eb;
            color: #1e3a8a;
        }
        h3 { 
            font-size: 11pt; 
            margin-bottom: 4pt; 
            color: #1e40af;
        }
        h4 { font-size: 10pt; margin-bottom: 3pt; color: #334155; }
        p { margin: 0 0 6pt 0; text-align: justify; }

        /* Badges */
        .badge {
            display: inline-block;
            padding: 1.5pt 5pt;
            border-radius: 3pt;
            font-size: 7.5pt;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.3pt;
        }
        .badge-blue { background-color: #dbeafe; color: #1e40af; border: 0.5pt solid #bfdbfe; }
        .badge-green { background-color: #d1fae5; color: #065f46; border: 0.5pt solid #a7f3d0; }
        .badge-amber { background-color: #fef3c7; color: #92400e; border: 0.5pt solid #fde68a; }
        .badge-purple { background-color: #ede9fe; color: #5b21b6; border: 0.5pt solid #ddd6fe; }
        .badge-rose { background-color: #ffe4e6; color: #9f1239; border: 0.5pt solid #fecdd3; }
        .badge-slate { background-color: #f1f5f9; color: #475569; border: 0.5pt solid #cbd5e1; }

        /* Tables */
        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 8pt;
            margin-bottom: 8pt;
            page-break-inside: avoid;
        }

        th, td {
            padding: 3.5pt 5pt;
            border: 0.5pt solid #cbd5e1;
            text-align: left;
            vertical-align: top;
        }

        th {
            background-color: #f8fafc;
            color: #1e293b;
            font-weight: 700;
            border-bottom: 1.5pt solid #94a3b8;
        }

        tr:nth-child(even) td {
            background-color: #fbfcfe;
        }

        code {
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            background-color: #f1f5f9;
            color: #0f172a;
            padding: 1pt 3pt;
            border-radius: 2pt;
            font-size: 7.5pt;
            border: 0.5pt solid #e2e8f0;
        }

        /* Callouts */
        .callout {
            border-left: 3pt solid #2563eb;
            background-color: #eff6ff;
            padding: 5pt 8pt;
            margin-bottom: 8pt;
            border-radius: 0 4pt 4pt 0;
            font-size: 8.5pt;
        }
        .callout-title {
            font-weight: 700;
            color: #1e40af;
            margin-bottom: 2pt;
        }
        .callout-green {
            border-left-color: #10b981;
            background-color: #ecfdf5;
        }
        .callout-green .callout-title { color: #065f46; }
        .callout-amber {
            border-left-color: #f59e0b;
            background-color: #fffbeb;
        }
        .callout-amber .callout-title { color: #92400e; }

        /* Cover Page Styling */
        .cover-page {
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            height: 260mm;
            padding: 15mm 10mm;
            border: 1.5pt solid #cbd5e1;
            background: linear-gradient(135deg, #f8fafc 0%, #ffffff 50%, #eff6ff 100%);
            border-radius: 8pt;
        }
        .cover-top {
            border-bottom: 3pt solid #1e3a8a;
            padding-bottom: 10mm;
        }
        .cover-brand {
            font-size: 11pt;
            font-weight: 800;
            letter-spacing: 1.5pt;
            color: #2563eb;
            text-transform: uppercase;
            margin-bottom: 5mm;
        }
        .cover-title {
            font-size: 26pt;
            font-weight: 900;
            color: #0f172a;
            line-height: 1.15;
            margin-bottom: 5mm;
        }
        .cover-subtitle {
            font-size: 13pt;
            font-weight: 500;
            color: #475569;
            line-height: 1.4;
        }
        .cover-meta-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 5mm;
            background: #ffffff;
            border: 1pt solid #e2e8f0;
            border-radius: 6pt;
            padding: 6mm;
            box-shadow: 0 4pt 6pt -1pt rgba(0, 0, 0, 0.05);
        }
        .cover-meta-item {
            font-size: 8.5pt;
        }
        .cover-meta-label {
            font-size: 7.5pt;
            color: #64748b;
            text-transform: uppercase;
            font-weight: 700;
            margin-bottom: 2pt;
        }
        .cover-meta-value {
            font-weight: 700;
            color: #1e293b;
        }

        /* Header & Footer in Pages */
        .page-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 0.5pt solid #cbd5e1;
            padding-bottom: 2pt;
            margin-bottom: 6pt;
            font-size: 7pt;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 0.5pt;
        }
        .page-footer {
            position: absolute;
            bottom: 2mm;
            left: 0;
            right: 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-top: 0.5pt solid #e2e8f0;
            padding-top: 3pt;
            font-size: 7pt;
            color: #94a3b8;
        }

        /* Section Container */
        .section-box {
            background-color: #ffffff;
            border: 0.5pt solid #e2e8f0;
            border-radius: 4pt;
            padding: 6pt 8pt;
            margin-bottom: 6pt;
        }

        /* SVG Diagram Wrapper */
        .diagram-container {
            width: 100%;
            background: #f8fafc;
            border: 1pt solid #cbd5e1;
            border-radius: 6pt;
            padding: 4pt;
            margin-bottom: 8pt;
            overflow: hidden;
            display: flex;
            justify-content: center;
        }
        .diagram-container svg {
            width: 100%;
            height: auto;
            max-height: 215mm;
        }

        .grid-2 {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 6pt;
        }
        .grid-3 {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 5pt;
        }

        .card {
            border: 0.5pt solid #cbd5e1;
            border-radius: 4pt;
            padding: 5pt 6pt;
            background: #ffffff;
        }
        .card-header {
            font-weight: 700;
            font-size: 8.5pt;
            margin-bottom: 3pt;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
    </style>
</head>
<body>

    <!-- ==================== HALAMAN 1: COVER ==================== -->
    <div class="page">
        <div class="cover-page">
            <div class="cover-top">
                <div class="cover-brand">SIKAK YAYASAN UMUM • ARSITEKTUR DATA & SISTEM AKUNTANSI</div>
                <div class="cover-title">DOKUMEN SPESIFIKASI ARSITEKTUR DATA & PEMODELAN SIA</div>
                <div class="cover-subtitle">
                    Perancangan Menyeluruh <strong>Entity Relationship Diagram (ERD)</strong> dan Framework <strong>Resources, Events, Agents (REA)</strong> untuk Sistem Informasi Keuangan, Penganggaran (RAB), dan Akuntansi Lembaga / Yayasan Pendidikan Multi-Unit.
                </div>
            </div>

            <div style="margin: 8mm 0;">
                <div style="font-size: 9pt; font-weight: 700; color: #1e3a8a; text-transform: uppercase; letter-spacing: 0.5pt; margin-bottom: 3mm;">Fokus & Cakupan Dokumen:</div>
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 4mm;">
                    <div style="background: white; border: 1pt solid #bfdbfe; border-radius: 5pt; padding: 4mm;">
                        <span class="badge badge-blue">Model Data ERD</span>
                        <div style="font-weight: 700; font-size: 9pt; margin: 2mm 0 1mm 0; color: #0f172a;">30 Entitas Relasional</div>
                        <div style="font-size: 7.5pt; color: #475569;">Struktur skema basis data fisik & logis mencakup akuntansi, kesiswaan, anggaran, BOS, dan aset.</div>
                    </div>
                    <div style="background: white; border: 1pt solid #a7f3d0; border-radius: 5pt; padding: 4mm;">
                        <span class="badge badge-green">Framework REA</span>
                        <div style="font-weight: 700; font-size: 9pt; margin: 2mm 0 1mm 0; color: #0f172a;">Ontologi SIA Terpadu</div>
                        <div style="font-size: 7.5pt; color: #475569;">Identifikasi Resources (R), Events (E), dan Agents (A) dengan analisis dualitas ekonomi Give-Take.</div>
                    </div>
                    <div style="background: white; border: 1pt solid #fde68a; border-radius: 5pt; padding: 4mm;">
                        <span class="badge badge-amber">5 Siklus Bisnis</span>
                        <div style="font-weight: 700; font-size: 9pt; margin: 2mm 0 1mm 0; color: #0f172a;">Alur Proses Operasional</div>
                        <div style="font-size: 7.5pt; color: #475569;">Siklus Pendapatan Siswa, Siklus Pengeluaran/RAB, Hibah BOS, Kapitalisasi Aset, & Buku Besar.</div>
                    </div>
                </div>
            </div>

            <div class="cover-meta-grid">
                <div class="cover-meta-item">
                    <div class="cover-meta-label">Nama Aplikasi</div>
                    <div class="cover-meta-value">SIKAK YAYASAN UMUM / SIKAD Dareliman</div>
                </div>
                <div class="cover-meta-item">
                    <div class="cover-meta-label">Basis Arsitektur</div>
                    <div class="cover-meta-value">Prisma ORM • MySQL • React SPA • Express REST API</div>
                </div>
                <div class="cover-meta-item">
                    <div class="cover-meta-label">Standar Akuntansi</div>
                    <div class="cover-meta-value">ISAK 35 / PSAK 109 (Akuntansi Entitas Nirlaba / Yayasan)</div>
                </div>
                <div class="cover-meta-item">
                    <div class="cover-meta-label">Status & Tanggal Terbit</div>
                    <div class="cover-meta-value">Versi 1.0 (Final) • Dokumen Resmi Pengembang</div>
                </div>
            </div>

            <div style="text-align: center; font-size: 7.5pt; color: #64748b; margin-top: 5mm;">
                Dokumen ini digenerate secara resmi untuk analisis sistem, standarisasi audit, dan pengembangan berkelanjutan.
            </div>
        </div>
    </div>

    <!-- ==================== HALAMAN 2: EXECUTIVE SUMMARY & OVERVIEW ==================== -->
    <div class="page">
        <div class="page-header">
            <span>SIKAK YAYASAN UMUM • DOKUMEN SPESIFIKASI ARSITEKTUR</span>
            <span>BAB I: RINGKASAN EKSEKUTIF</span>
        </div>

        <h2>BAB I: RINGKASAN EKSEKUTIF & GAMBARAN UMUM SISTEM</h2>

        <div class="callout callout-green">
            <div class="callout-title">Latar Belakang & Tujuan Arsitektur</div>
            SIKAK (Sistem Informasi Keuangan dan Akuntansi Kelembagaan) Yayasan Umum adalah platform terintegrasi enterprise untuk mengelola seluruh aspek tata kelola keuangan, penganggaran partisipatif (RAB), kepatuhan dana Bantuan Operasional Sekolah (BOS), manajemen inventaris aset tetap, dan akuntansi berbasis standar nirlaba (ISAK 35 / PSAK 109) pada yayasan pendidikan Islam multi-unit.
        </div>

        <h3>1.1 Karakteristik Multi-Entitas dan Struktur Organisasi</h3>
        <p>
            Yayasan mengelola struktur berjenjang yang terdiri atas <strong>Bidang</strong> (misalnya Bidang Pendidikan, Bidang Sosial & Dakwah, Bidang Sarana Prasarana) dan <strong>Unit Kerja / Satuan Pendidikan</strong> (misalnya TK Islam, SDIT 1, SDIT 2, SMPIT, SMAIT, Pondok Pesantren). Sistem memisahkan peran pengguna secara terpusat dan terdistribusi:
        </p>
        <ul>
            <li><strong>Super Admin / Pengurus Yayasan:</strong> Otoritas puncak pengelolaan akuntansi yayasan, persetujuan RAB, pencairan dana, monitoring saldo kas terpusat, tutup buku, dan audit trail log.</li>
            <li><strong>Admin Bidang:</strong> Otoritas pengawasan koordinatif lintas unit kerja di bawah naungan bidang masing-masing.</li>
            <li><strong>Admin Unit / Kepala Sekolah / Bendahara Satker:</strong> Pengelola basis data siswa, penetapan tarif komitmen iuran, pengusulan RAB tahunan, pengajuan permintaan dana operasional bulanan, dan pelaporan realisasi belanja riil berbasis bukti nota/SPJ.</li>
        </ul>

        <h3>1.2 Pilar Fungsional Utama Aplikasi</h3>
        <div class="grid-2">
            <div class="card">
                <div class="card-header">
                    <span>1. Akuntansi Keuangan (ISAK 35)</span>
                    <span class="badge badge-blue">Financial</span>
                </div>
                <p style="font-size: 8pt; margin: 0; color: #475569;">
                    Bagan Akun Standar (COA), Jurnal Umum double-entry, Buku Besar, Neraca Saldo, Laporan Posisi Keuangan (Neraca), Laporan Aktivitas, Laporan Arus Kas, dan Laporan Perubahan Aset Neto.
                </p>
            </div>
            <div class="card">
                <div class="card-header">
                    <span>2. Penganggaran & RAB Unit</span>
                    <span class="badge badge-purple">Budgeting</span>
                </div>
                <p style="font-size: 8pt; margin: 0; color: #475569;">
                    Penyusunan Rencana Anggaran Biaya (RAB) tahunan unit per tahun ajaran dengan status alur persetujuan (Draft &rarr; Pending &rarr; Approved / Rejected) serta aturan distribusi persentase penerimaan.
                </p>
            </div>
            <div class="card">
                <div class="card-header">
                    <span>3. Operasional Belanja & SPJ</span>
                    <span class="badge badge-amber">Execution</span>
                </div>
                <p style="font-size: 8pt; margin: 0; color: #475569;">
                    Permintaan dana bulanan (Budget Request) bertingkat, realisasi pengeluaran (Budget Report) dengan validasi nomor nota, volume, satuan, harga, diskon, dan klasifikasi perolehan aset.
                </p>
            </div>
            <div class="card">
                <div class="card-header">
                    <span>4. Bantuan Operasional Sekolah</span>
                    <span class="badge badge-green">BOS Grant</span>
                </div>
                <p style="font-size: 8pt; margin: 0; color: #475569;">
                    Manajemen alokasi dana BOS per tahap dan per pos standar juknis nasional, monitoring saldo riil BOS unit, dan pelaporan belanja BOS terisolasi.
                </p>
            </div>
        </div>

        <h3 style="margin-top: 8pt;">1.3 Paradigma Pemodelan: Mengapa ERD dan REA?</h3>
        <p>
            Untuk memberikan dokumentasi arsitektur data yang komprehensif, dokumen ini mengombinasikan dua sudut pandang komplementer:
        </p>
        <table style="margin-bottom: 4pt;">
            <thead>
                <tr>
                    <th style="width: 25%;">Dimensi Evaluasi</th>
                    <th style="width: 37.5%;">Entity Relationship Diagram (ERD)</th>
                    <th style="width: 37.5%;">Framework Resources, Events, Agents (REA)</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><strong>Fokus Utama</strong></td>
                    <td>Struktur penyimpanan fisik/logis basis data relasional, Primary Key (PK), Foreign Key (FK), dan kardinalitas tabel.</td>
                    <td>Ontologi proses bisnis ekonomi, pertukaran nilai (Give-Take Duality), arus sumber daya (Stockflow), dan partisipasi pihak.</td>
                </tr>
                <tr>
                    <td><strong>Target Pemangku Kepentingan</strong></td>
                    <td>Database Administrator (DBA), Software Architect, Backend Developer, dan Tim Integrasi API.</td>
                    <td>Akuntan Keuangan, Auditor Internal, Manajemen Yayasan, dan Analis Sistem Bisnis.</td>
                </tr>
                <tr>
                    <td><strong>Keunggulan Spesifik</strong></td>
                    <td>Presisi skema teknis, integritas referensial data, optimasi indexing, dan query schema.</td>
                    <td>Transparansi pengendalian internal (internal control), pemisahan tugas (segregation of duties), dan auditabilitas transaksi.</td>
                </tr>
            </tbody>
        </table>

        <div class="page-footer">
            <span>Dokumentasi Arsitektur SIKAK Yayasan Umum</span>
            <span>Halaman 2</span>
        </div>
    </div>

    <!-- ==================== HALAMAN 3: DIAGRAM ERD UTAMA ==================== -->
    <div class="page">
        <div class="page-header">
            <span>SIKAK YAYASAN UMUM • DOKUMEN SPESIFIKASI ARSITEKTUR</span>
            <span>BAB II: DIAGRAM ERD LENGKAP</span>
        </div>

        <h2>BAB II: ENTITY RELATIONSHIP DIAGRAM (ERD) SISTEM</h2>
        <p style="font-size: 8pt; margin-bottom: 4pt;">
            Diagram relasi entitas berikut memvisualisasikan seluruh 30 tabel dalam basis data sistem yang terbagi ke dalam 8 klaster domain fungsional. Notasi relasi mengadopsi standar Crow's Foot dengan integritas referensial penuh.
        </p>

        <div class="diagram-container">
            <!-- FULL HIGH-RES SVG ERD -->
            <svg viewBox="0 0 1150 780" xmlns="http://www.w3.org/2000/svg" style="background:#ffffff; font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif;">
                <defs>
                    <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
                        <feDropShadow dx="1" dy="2" stdDeviation="2" flood-color="#0f172a" flood-opacity="0.08"/>
                    </filter>
                    <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                        <path d="M 0 1 L 10 5 L 0 9 z" fill="#64748b" />
                    </marker>
                    <marker id="crow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                        <path d="M 0 0 L 10 5 L 0 10 M 10 5 L 0 5" stroke="#475569" stroke-width="1.5" fill="none" />
                    </marker>
                </defs>

                <!-- Cluster Background Boxes -->
                <!-- Klaster Organisasi -->
                <rect x="15" y="15" width="260" height="280" rx="8" fill="#eff6ff" stroke="#bfdbfe" stroke-width="1" stroke-dasharray="4 2"/>
                <text x="25" y="32" font-size="10" font-weight="800" fill="#1e40af">🟦 KLASTER ORGANISASI & PENGGUNA</text>

                <!-- Klaster Akademik & Siswa -->
                <rect x="290" y="15" width="370" height="365" rx="8" fill="#f0fdf4" stroke="#bbf7d0" stroke-width="1" stroke-dasharray="4 2"/>
                <text x="300" y="32" font-size="10" font-weight="800" fill="#15803d">🟩 KLASTER AKADEMIK & DATA SISWA</text>

                <!-- Klaster Anggaran & Belanja -->
                <rect x="675" y="15" width="460" height="365" rx="8" fill="#fffbeb" stroke="#fde68a" stroke-width="1" stroke-dasharray="4 2"/>
                <text x="685" y="32" font-size="10" font-weight="800" fill="#b45309">🟨 KLASTER PENGANGGARAN, REALISASI & SPJ</text>

                <!-- Klaster BOS -->
                <rect x="15" y="395" width="280" height="370" rx="8" fill="#faf5ff" stroke="#e9d5ff" stroke-width="1" stroke-dasharray="4 2"/>
                <text x="25" y="412" font-size="10" font-weight="800" fill="#6b21a8">🟪 KLASTER BANTUAN OPERASIONAL SEKOLAH (BOS)</text>

                <!-- Klaster Akuntansi & Buku Besar -->
                <rect x="310" y="395" width="440" height="370" rx="8" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1" stroke-dasharray="4 2"/>
                <text x="320" y="412" font-size="10" font-weight="800" fill="#334155">🟧 KLASTER AKUNTANSI, JURNAL & BUKU BESAR</text>

                <!-- Klaster Aset Tetap -->
                <rect x="765" y="395" width="370" height="370" rx="8" fill="#fff1f2" stroke="#fecdd3" stroke-width="1" stroke-dasharray="4 2"/>
                <text x="775" y="412" font-size="10" font-weight="800" fill="#9f1239">🟫 KLASTER MANAJEMEN ASET TETAP</text>

                <!-- ================= ENTITAS ================= -->

                <!-- 1. Field -->
                <g filter="url(#shadow)">
                    <rect x="30" y="45" width="105" height="75" rx="4" fill="#ffffff" stroke="#2563eb" stroke-width="1.2"/>
                    <rect x="30" y="45" width="105" height="18" rx="4" fill="#2563eb"/>
                    <text x="82" y="58" font-size="8.5" font-weight="700" fill="#ffffff" text-anchor="middle">Field (Bidang)</text>
                    <text x="35" y="74" font-size="7.5" font-weight="700" fill="#b91c1c">PK  id : UUID</text>
                    <text x="35" y="86" font-size="7.5" fill="#334155">    name : String(U)</text>
                    <text x="35" y="98" font-size="7.5" fill="#64748b">    isDeleted : Bool</text>
                </g>

                <!-- 2. Unit -->
                <g filter="url(#shadow)">
                    <rect x="155" y="45" width="110" height="100" rx="4" fill="#ffffff" stroke="#2563eb" stroke-width="1.2"/>
                    <rect x="155" y="45" width="110" height="18" rx="4" fill="#2563eb"/>
                    <text x="210" y="58" font-size="8.5" font-weight="700" fill="#ffffff" text-anchor="middle">Unit (Satker)</text>
                    <text x="160" y="74" font-size="7.5" font-weight="700" fill="#b91c1c">PK  id : UUID</text>
                    <text x="160" y="86" font-size="7.5" font-weight="700" fill="#047857">FK  fieldId : UUID</text>
                    <text x="160" y="98" font-size="7.5" fill="#334155">    name : String</text>
                    <text x="160" y="110" font-size="7.5" fill="#334155">    receivesBos : Bool</text>
                    <text x="160" y="122" font-size="7.5" fill="#64748b">    isDeleted : Bool</text>
                </g>

                <!-- 3. User -->
                <g filter="url(#shadow)">
                    <rect x="30" y="150" width="115" height="115" rx="4" fill="#ffffff" stroke="#2563eb" stroke-width="1.2"/>
                    <rect x="30" y="150" width="115" height="18" rx="4" fill="#2563eb"/>
                    <text x="87" y="163" font-size="8.5" font-weight="700" fill="#ffffff" text-anchor="middle">User (Pengguna)</text>
                    <text x="35" y="179" font-size="7.5" font-weight="700" fill="#b91c1c">PK  id : UUID</text>
                    <text x="35" y="191" font-size="7.5" fill="#334155">    username : Str(U)</text>
                    <text x="35" y="203" font-size="7.5" fill="#334155">    role : Enum</text>
                    <text x="35" y="215" font-size="7.5" font-weight="700" fill="#047857">FK  fieldId : UUID?</text>
                    <text x="35" y="227" font-size="7.5" font-weight="700" fill="#047857">FK  unitId : UUID?</text>
                    <text x="35" y="239" font-size="7.5" fill="#64748b">    isDeleted : Bool</text>
                </g>

                <!-- 4. AcademicYear -->
                <g filter="url(#shadow)">
                    <rect x="305" y="45" width="115" height="95" rx="4" fill="#ffffff" stroke="#16a34a" stroke-width="1.2"/>
                    <rect x="305" y="45" width="115" height="18" rx="4" fill="#16a34a"/>
                    <text x="362" y="58" font-size="8.5" font-weight="700" fill="#ffffff" text-anchor="middle">AcademicYear</text>
                    <text x="310" y="74" font-size="7.5" font-weight="700" fill="#b91c1c">PK  id : UUID</text>
                    <text x="310" y="86" font-size="7.5" fill="#334155">    name : Str (2024/2025)</text>
                    <text x="310" y="98" font-size="7.5" fill="#334155">    isCurrent : Bool</text>
                    <text x="310" y="110" font-size="7.5" fill="#334155">    isActive : Bool</text>
                    <text x="310" y="122" font-size="7.5" fill="#64748b">    isDeleted : Bool</text>
                </g>

                <!-- 5. Class -->
                <g filter="url(#shadow)">
                    <rect x="435" y="45" width="105" height="85" rx="4" fill="#ffffff" stroke="#16a34a" stroke-width="1.2"/>
                    <rect x="435" y="45" width="105" height="18" rx="4" fill="#16a34a"/>
                    <text x="487" y="58" font-size="8.5" font-weight="700" fill="#ffffff" text-anchor="middle">Class (Kelas)</text>
                    <text x="440" y="74" font-size="7.5" font-weight="700" fill="#b91c1c">PK  id : UUID</text>
                    <text x="440" y="86" font-size="7.5" font-weight="700" fill="#047857">FK  unitId : UUID</text>
                    <text x="440" y="98" font-size="7.5" fill="#334155">    name : String</text>
                    <text x="440" y="110" font-size="7.5" fill="#64748b">    isDeleted : Bool</text>
                </g>

                <!-- 6. Student -->
                <g filter="url(#shadow)">
                    <rect x="305" y="160" width="135" height="150" rx="4" fill="#ffffff" stroke="#16a34a" stroke-width="1.2"/>
                    <rect x="305" y="160" width="135" height="18" rx="4" fill="#16a34a"/>
                    <text x="372" y="173" font-size="8.5" font-weight="700" fill="#ffffff" text-anchor="middle">Student (Data Siswa)</text>
                    <text x="310" y="189" font-size="7.5" font-weight="700" fill="#b91c1c">PK  id : UUID</text>
                    <text x="310" y="201" font-size="7.5" fill="#334155">    name : String</text>
                    <text x="310" y="213" font-size="7.5" fill="#334155">    nis : String?</text>
                    <text x="310" y="225" font-size="7.5" font-weight="700" fill="#047857">FK  unitId : UUID</text>
                    <text x="310" y="237" font-size="7.5" font-weight="700" fill="#047857">FK  classId : UUID?</text>
                    <text x="310" y="249" font-size="7.5" font-weight="700" fill="#047857">FK  academicYearId : UUID?</text>
                    <text x="310" y="261" font-size="7.5" font-weight="700" fill="#047857">FK  statusId : UUID?</text>
                    <text x="310" y="273" font-size="7.5" font-weight="700" fill="#047857">FK  parentStatusId : UUID?</text>
                    <text x="310" y="285" font-size="7.5" fill="#334155">    gender : String?</text>
                </g>

                <!-- 7. IncomeItem -->
                <g filter="url(#shadow)">
                    <rect x="520" y="160" width="125" height="85" rx="4" fill="#ffffff" stroke="#16a34a" stroke-width="1.2"/>
                    <rect x="520" y="160" width="125" height="18" rx="4" fill="#16a34a"/>
                    <text x="582" y="173" font-size="8.5" font-weight="700" fill="#ffffff" text-anchor="middle">IncomeItem (Penerimaan)</text>
                    <text x="525" y="189" font-size="7.5" font-weight="700" fill="#b91c1c">PK  id : UUID</text>
                    <text x="525" y="201" font-size="7.5" fill="#334155">    name : Str (SPP, dll)</text>
                    <text x="525" y="213" font-size="7.5" fill="#334155">    isBos : Bool</text>
                    <text x="525" y="225" font-size="7.5" fill="#64748b">    isDeleted : Bool</text>
                </g>

                <!-- 8. StudentIncomeDetail -->
                <g filter="url(#shadow)">
                    <rect x="460" y="265" width="145" height="95" rx="4" fill="#ffffff" stroke="#16a34a" stroke-width="1.2"/>
                    <rect x="460" y="265" width="145" height="18" rx="4" fill="#16a34a"/>
                    <text x="532" y="278" font-size="8" font-weight="700" fill="#ffffff" text-anchor="middle">StudentIncomeDetail (Tarif)</text>
                    <text x="465" y="294" font-size="7.5" font-weight="700" fill="#b91c1c">PK  id : UUID</text>
                    <text x="465" y="306" font-size="7.5" font-weight="700" fill="#047857">FK  studentId : UUID</text>
                    <text x="465" y="318" font-size="7.5" font-weight="700" fill="#047857">FK  incomeItemId : UUID</text>
                    <text x="465" y="330" font-size="7.5" font-weight="700" fill="#1d4ed8">    amount : Decimal(15,2)</text>
                    <text x="465" y="342" font-size="7.5" fill="#64748b">    isDeleted : Bool</text>
                </g>

                <!-- 9. ExpenseItem -->
                <g filter="url(#shadow)">
                    <rect x="690" y="45" width="135" height="115" rx="4" fill="#ffffff" stroke="#d97706" stroke-width="1.2"/>
                    <rect x="690" y="45" width="135" height="18" rx="4" fill="#d97706"/>
                    <text x="757" y="58" font-size="8.5" font-weight="700" fill="#ffffff" text-anchor="middle">ExpenseItem (Pengeluaran)</text>
                    <text x="695" y="74" font-size="7.5" font-weight="700" fill="#b91c1c">PK  id : UUID</text>
                    <text x="695" y="86" font-size="7.5" font-weight="700" fill="#047857">FK  unitId : UUID?</text>
                    <text x="695" y="98" font-size="7.5" font-weight="700" fill="#047857">FK  fieldId : UUID?</text>
                    <text x="695" y="110" font-size="7.5" fill="#334155">    name : String</text>
                    <text x="695" y="122" font-size="7.5" fill="#334155">    debitAccountId : UUID?</text>
                    <text x="695" y="134" font-size="7.5" fill="#334155">    creditAccountId : UUID?</text>
                </g>

                <!-- 10. DistributionSetting -->
                <g filter="url(#shadow)">
                    <rect x="840" y="45" width="135" height="115" rx="4" fill="#ffffff" stroke="#d97706" stroke-width="1.2"/>
                    <rect x="840" y="45" width="135" height="18" rx="4" fill="#d97706"/>
                    <text x="907" y="58" font-size="8" font-weight="700" fill="#ffffff" text-anchor="middle">DistributionSetting (Bagi %)</text>
                    <text x="845" y="74" font-size="7.5" font-weight="700" fill="#b91c1c">PK  id : UUID</text>
                    <text x="845" y="86" font-size="7.5" font-weight="700" fill="#047857">FK  academicYearId : UUID</text>
                    <text x="845" y="98" font-size="7.5" font-weight="700" fill="#047857">FK  incomeItemId : UUID</text>
                    <text x="845" y="110" font-size="7.5" font-weight="700" fill="#047857">FK  expenseItemId : UUID</text>
                    <text x="845" y="122" font-size="7.5" font-weight="700" fill="#b45309">    percentage : Decimal(5,2)</text>
                    <text x="845" y="134" font-size="7.5" fill="#334155">    destType : unit/yayasan</text>
                </g>

                <!-- 11. RabPlan -->
                <g filter="url(#shadow)">
                    <rect x="990" y="45" width="135" height="115" rx="4" fill="#ffffff" stroke="#d97706" stroke-width="1.2"/>
                    <rect x="990" y="45" width="135" height="18" rx="4" fill="#d97706"/>
                    <text x="1057" y="58" font-size="8.5" font-weight="700" fill="#ffffff" text-anchor="middle">RabPlan (Plafon RAB)</text>
                    <text x="995" y="74" font-size="7.5" font-weight="700" fill="#b91c1c">PK  id : Str (ayId-unitId)</text>
                    <text x="995" y="86" font-size="7.5" fill="#334155">    academicYearId : Str</text>
                    <text x="995" y="98" font-size="7.5" fill="#334155">    unitId / fieldId : Str</text>
                    <text x="995" y="110" font-size="7.5" fill="#334155">    income : JSON</text>
                    <text x="995" y="122" font-size="7.5" fill="#334155">    expense : JSON</text>
                    <text x="995" y="134" font-size="7.5" font-weight="700" fill="#b45309">    status : DRAFT/APPRV</text>
                </g>

                <!-- 12. BudgetRequest -->
                <g filter="url(#shadow)">
                    <rect x="690" y="195" width="135" height="135" rx="4" fill="#ffffff" stroke="#d97706" stroke-width="1.2"/>
                    <rect x="690" y="195" width="135" height="18" rx="4" fill="#d97706"/>
                    <text x="757" y="208" font-size="8.5" font-weight="700" fill="#ffffff" text-anchor="middle">BudgetRequest (Pengajuan)</text>
                    <text x="695" y="224" font-size="7.5" font-weight="700" fill="#b91c1c">PK  id : UUID</text>
                    <text x="695" y="236" font-size="7.5" font-weight="700" fill="#047857">FK  expenseItemId : UUID?</text>
                    <text x="695" y="248" font-size="7.5" fill="#334155">    unitId / fieldId : UUID</text>
                    <text x="695" y="260" font-size="7.5" font-weight="700" fill="#1d4ed8">    totalAmount : Decimal</text>
                    <text x="695" y="272" font-size="7.5" fill="#334155">    items : JSON</text>
                    <text x="695" y="284" font-size="7.5" fill="#334155">    date / month / year</text>
                    <text x="695" y="296" font-size="7.5" font-weight="700" fill="#b45309">    status : PENDING/APPR</text>
                </g>

                <!-- 13. BudgetReport -->
                <g filter="url(#shadow)">
                    <rect x="850" y="195" width="150" height="165" rx="4" fill="#ffffff" stroke="#d97706" stroke-width="1.2"/>
                    <rect x="850" y="195" width="150" height="18" rx="4" fill="#d97706"/>
                    <text x="925" y="208" font-size="8.5" font-weight="700" fill="#ffffff" text-anchor="middle">BudgetReport (Realisasi/SPJ)</text>
                    <text x="855" y="224" font-size="7.5" font-weight="700" fill="#b91c1c">PK  id : UUID</text>
                    <text x="855" y="236" font-size="7.5" font-weight="700" fill="#047857">FK  budgetRequestId : UUID?</text>
                    <text x="855" y="248" font-size="7.5" font-weight="700" fill="#047857">FK  expenseItemId : UUID?</text>
                    <text x="855" y="260" font-size="7.5" font-weight="700" fill="#1d4ed8">    amount : Decimal(15,2)</text>
                    <text x="855" y="272" font-size="7.5" fill="#334155">    nomorNota : String</text>
                    <text x="855" y="284" font-size="7.5" fill="#334155">    volume / satuan / harga</text>
                    <text x="855" y="296" font-size="7.5" fill="#b91c1c">    kategoriAset : NON/ASET</text>
                    <text x="855" y="308" font-size="7.5" font-weight="700" fill="#047857">FK  journalId : UUID?</text>
                    <text x="855" y="320" font-size="7.5" font-weight="700" fill="#b45309">    status : PENDING/APPR</text>
                </g>

                <!-- 14. BosStage -->
                <g filter="url(#shadow)">
                    <rect x="30" y="425" width="115" height="85" rx="4" fill="#ffffff" stroke="#7e22ce" stroke-width="1.2"/>
                    <rect x="30" y="425" width="115" height="18" rx="4" fill="#7e22ce"/>
                    <text x="87" y="438" font-size="8.5" font-weight="700" fill="#ffffff" text-anchor="middle">BosStage (Tahap BOS)</text>
                    <text x="35" y="454" font-size="7.5" font-weight="700" fill="#b91c1c">PK  id : UUID</text>
                    <text x="35" y="466" font-size="7.5" font-weight="700" fill="#047857">FK  academicYearId : UUID</text>
                    <text x="35" y="478" font-size="7.5" fill="#334155">    name : Tahap 1 / 2</text>
                    <text x="35" y="490" font-size="7.5" fill="#64748b">    isDeleted : Bool</text>
                </g>

                <!-- 15. BosPos -->
                <g filter="url(#shadow)">
                    <rect x="160" y="425" width="115" height="75" rx="4" fill="#ffffff" stroke="#7e22ce" stroke-width="1.2"/>
                    <rect x="160" y="425" width="115" height="18" rx="4" fill="#7e22ce"/>
                    <text x="217" y="438" font-size="8.5" font-weight="700" fill="#ffffff" text-anchor="middle">BosPos (Pos Standar)</text>
                    <text x="165" y="454" font-size="7.5" font-weight="700" fill="#b91c1c">PK  id : UUID</text>
                    <text x="165" y="466" font-size="7.5" fill="#334155">    name : Str (Juknis)</text>
                    <text x="165" y="478" font-size="7.5" fill="#64748b">    isDeleted : Bool</text>
                </g>

                <!-- 16. BosAllocation -->
                <g filter="url(#shadow)">
                    <rect x="80" y="530" width="150" height="140" rx="4" fill="#ffffff" stroke="#7e22ce" stroke-width="1.2"/>
                    <rect x="80" y="530" width="150" height="18" rx="4" fill="#7e22ce"/>
                    <text x="155" y="543" font-size="8.5" font-weight="700" fill="#ffffff" text-anchor="middle">BosAllocation (Alokasi BOS)</text>
                    <text x="85" y="559" font-size="7.5" font-weight="700" fill="#b91c1c">PK  id : UUID</text>
                    <text x="85" y="571" font-size="7.5" font-weight="700" fill="#047857">FK  academicYearId : UUID</text>
                    <text x="85" y="583" font-size="7.5" font-weight="700" fill="#047857">FK  stageId : UUID</text>
                    <text x="85" y="595" font-size="7.5" font-weight="700" fill="#047857">FK  posId : UUID</text>
                    <text x="85" y="607" font-size="7.5" font-weight="700" fill="#047857">FK  unitId : UUID</text>
                    <text x="85" y="619" font-size="7.5" fill="#334155">    expenseItemId : String?</text>
                    <text x="85" y="631" font-size="7.5" font-weight="700" fill="#1d4ed8">    amount : Decimal(15,2)</text>
                </g>

                <!-- 17. Account -->
                <g filter="url(#shadow)">
                    <rect x="325" y="425" width="135" height="145" rx="4" fill="#ffffff" stroke="#475569" stroke-width="1.2"/>
                    <rect x="325" y="425" width="135" height="18" rx="4" fill="#475569"/>
                    <text x="392" y="438" font-size="8.5" font-weight="700" fill="#ffffff" text-anchor="middle">Account (Bagan Akun COA)</text>
                    <text x="330" y="454" font-size="7.5" font-weight="700" fill="#b91c1c">PK  id : UUID</text>
                    <text x="330" y="466" font-size="7.5" fill="#334155">    code : String (1-1101)</text>
                    <text x="330" y="478" font-size="7.5" fill="#334155">    name : String</text>
                    <text x="330" y="490" font-size="7.5" fill="#334155">    category / type / fund</text>
                    <text x="330" y="502" font-size="7.5" font-weight="700" fill="#1d4ed8">    balance : Decimal(15,2)</text>
                    <text x="330" y="514" font-size="7.5" font-weight="700" fill="#047857">FK  parentId : UUID?</text>
                    <text x="330" y="526" font-size="7.5" fill="#334155">    level / orderIdx : Int</text>
                </g>

                <!-- 18. Journal -->
                <g filter="url(#shadow)">
                    <rect x="480" y="425" width="135" height="145" rx="4" fill="#ffffff" stroke="#475569" stroke-width="1.2"/>
                    <rect x="480" y="425" width="135" height="18" rx="4" fill="#475569"/>
                    <text x="547" y="438" font-size="8.5" font-weight="700" fill="#ffffff" text-anchor="middle">Journal (Jurnal Umum)</text>
                    <text x="485" y="454" font-size="7.5" font-weight="700" fill="#b91c1c">PK  id : UUID</text>
                    <text x="485" y="466" font-size="7.5" fill="#334155">    date : DateTime</text>
                    <text x="485" y="478" font-size="7.5" fill="#334155">    reference : String</text>
                    <text x="485" y="490" font-size="7.5" font-weight="700" fill="#2563eb">    entries : JSON [D/K]</text>
                    <text x="485" y="502" font-size="7.5" fill="#334155">    description : Text</text>
                    <text x="485" y="514" font-size="7.5" fill="#334155">    receiptPath / proof</text>
                    <text x="485" y="526" font-size="7.5" fill="#334155">    programId : UUID?</text>
                </g>

                <!-- 19. Program -->
                <g filter="url(#shadow)">
                    <rect x="325" y="590" width="135" height="120" rx="4" fill="#ffffff" stroke="#475569" stroke-width="1.2"/>
                    <rect x="325" y="590" width="135" height="18" rx="4" fill="#475569"/>
                    <text x="392" y="603" font-size="8.5" font-weight="700" fill="#ffffff" text-anchor="middle">Program (Donasi/Ziswaf)</text>
                    <text x="330" y="619" font-size="7.5" font-weight="700" fill="#b91c1c">PK  id : UUID</text>
                    <text x="330" y="631" font-size="7.5" fill="#334155">    name : String</text>
                    <text x="330" y="643" font-size="7.5" fill="#334155">    category / type</text>
                    <text x="330" y="655" font-size="7.5" font-weight="700" fill="#1d4ed8">    targetAmount : Dec</text>
                    <text x="330" y="667" font-size="7.5" fill="#334155">    unitId / fieldId : Str</text>
                </g>

                <!-- 20. Contact -->
                <g filter="url(#shadow)">
                    <rect x="480" y="590" width="125" height="100" rx="4" fill="#ffffff" stroke="#475569" stroke-width="1.2"/>
                    <rect x="480" y="590" width="125" height="18" rx="4" fill="#475569"/>
                    <text x="542" y="603" font-size="8.5" font-weight="700" fill="#ffffff" text-anchor="middle">Contact (Pihak Luar)</text>
                    <text x="485" y="619" font-size="7.5" font-weight="700" fill="#b91c1c">PK  id : UUID</text>
                    <text x="485" y="631" font-size="7.5" fill="#334155">    name : String (U)</text>
                    <text x="485" y="643" font-size="7.5" fill="#334155">    type : Donatur/Vendor</text>
                    <text x="485" y="655" font-size="7.5" fill="#334155">    phone / address : Str</text>
                </g>

                <!-- 21. Asset -->
                <g filter="url(#shadow)">
                    <rect x="780" y="425" width="150" height="165" rx="4" fill="#ffffff" stroke="#e11d48" stroke-width="1.2"/>
                    <rect x="780" y="425" width="150" height="18" rx="4" fill="#e11d48"/>
                    <text x="855" y="438" font-size="8.5" font-weight="700" fill="#ffffff" text-anchor="middle">Asset (Kartu Aset Tetap)</text>
                    <text x="785" y="454" font-size="7.5" font-weight="700" fill="#b91c1c">PK  id : UUID</text>
                    <text x="785" y="466" font-size="7.5" fill="#334155">    code : String?</text>
                    <text x="785" y="478" font-size="7.5" fill="#334155">    name : String</text>
                    <text x="785" y="490" font-size="7.5" font-weight="700" fill="#1d4ed8">    cost : Decimal(15,2)</text>
                    <text x="785" y="502" font-size="7.5" fill="#334155">    usefulLifeMonths : Int</text>
                    <text x="785" y="514" font-size="7.5" fill="#334155">    category / vendor : Str</text>
                    <text x="785" y="526" font-size="7.5" fill="#334155">    condition / status : Str</text>
                    <text x="785" y="538" font-size="7.5" font-weight="700" fill="#047857">FK  unitId : UUID?</text>
                    <text x="785" y="550" font-size="7.5" fill="#334155">    assetRoom / pic : Str</text>
                </g>

                <!-- 22. Asset Masters (Category, Vendor, Room, PIC) -->
                <g filter="url(#shadow)">
                    <rect x="950" y="425" width="165" height="145" rx="4" fill="#ffffff" stroke="#e11d48" stroke-width="1.2"/>
                    <rect x="950" y="425" width="165" height="18" rx="4" fill="#e11d48"/>
                    <text x="1032" y="438" font-size="8" font-weight="700" fill="#ffffff" text-anchor="middle">Master Aset (Parametrik)</text>
                    <text x="955" y="454" font-size="7.5" font-weight="700" fill="#9f1239">AssetCategory</text>
                    <text x="965" y="466" font-size="7" fill="#64748b">id, name, code, economicLife</text>
                    <text x="955" y="480" font-size="7.5" font-weight="700" fill="#9f1239">AssetVendor</text>
                    <text x="965" y="492" font-size="7" fill="#64748b">id, name, phone, address</text>
                    <text x="955" y="506" font-size="7.5" font-weight="700" fill="#9f1239">AssetRoom & AssetPic</text>
                    <text x="965" y="518" font-size="7" fill="#64748b">id, name, unitId, role, phone</text>
                </g>

                <!-- RELATIONAL LINES WITH CROW FOOT -->
                <!-- Field -> Unit (1:N) -->
                <path d="M 135 80 L 155 80" stroke="#475569" stroke-width="1.2" marker-end="url(#crow)"/>
                
                <!-- Unit -> Student (1:N) -->
                <path d="M 265 100 L 285 100 L 285 200 L 305 200" stroke="#475569" stroke-width="1.2" marker-end="url(#crow)"/>
                
                <!-- Class -> Student (1:N) -->
                <path d="M 485 130 L 485 145 L 415 145 L 415 160" stroke="#475569" stroke-width="1.2" marker-end="url(#crow)"/>
                
                <!-- Student -> StudentIncomeDetail (1:N) -->
                <path d="M 440 280 L 460 280" stroke="#475569" stroke-width="1.2" marker-end="url(#crow)"/>
                
                <!-- IncomeItem -> StudentIncomeDetail (1:N) -->
                <path d="M 550 245 L 550 265" stroke="#475569" stroke-width="1.2" marker-end="url(#crow)"/>
                
                <!-- AcademicYear -> Student (1:N) -->
                <path d="M 360 140 L 360 160" stroke="#475569" stroke-width="1.2" marker-end="url(#crow)"/>

                <!-- ExpenseItem -> DistributionSetting (1:N) -->
                <path d="M 825 80 L 840 80" stroke="#475569" stroke-width="1.2" marker-end="url(#crow)"/>

                <!-- ExpenseItem -> BudgetRequest (1:N) -->
                <path d="M 750 160 L 750 195" stroke="#475569" stroke-width="1.2" marker-end="url(#crow)"/>

                <!-- BudgetRequest -> BudgetReport (1:N) -->
                <path d="M 825 240 L 850 240" stroke="#475569" stroke-width="1.2" marker-end="url(#crow)"/>

                <!-- BosStage -> BosAllocation (1:N) -->
                <path d="M 90 510 L 90 530" stroke="#475569" stroke-width="1.2" marker-end="url(#crow)"/>

                <!-- BosPos -> BosAllocation (1:N) -->
                <path d="M 210 500 L 210 530" stroke="#475569" stroke-width="1.2" marker-end="url(#crow)"/>

                <!-- BudgetReport -> Asset (Capitalization bridge) -->
                <path d="M 925 360 L 925 390 L 870 390 L 870 425" stroke="#e11d48" stroke-width="1.4" stroke-dasharray="3 3" marker-end="url(#crow)"/>
                <text x="895" y="405" font-size="7" font-weight="700" fill="#e11d48" text-anchor="middle">Generate Asset (Beli Baru)</text>

                <!-- BudgetReport -> Journal (Posting link) -->
                <path d="M 880 360 L 880 380 L 550 380 L 550 425" stroke="#2563eb" stroke-width="1.4" stroke-dasharray="3 3" marker-end="url(#arrow)"/>
                <text x="680" y="375" font-size="7" font-weight="700" fill="#2563eb" text-anchor="middle">Posting SPJ ke Jurnal Otomatis</text>
            </svg>
        </div>

        <div class="callout callout-amber" style="margin-top: 4pt;">
            <div class="callout-title">Catatan Kritis Integritas Relasional:</div>
            Relasi garis putus-putus merah merepresentasikan jembatan kapitalisasi otomatis di mana transaksi belanja operasional pada <code>BudgetReport</code> dengan <code>kategoriAset != 'NON_ASET'</code> langsung mencatat kartu aset baru pada tabel <code>Asset</code>. Sementara garis putus-putus biru merepresentasikan penjurnalan otomatis transaksi pengeluaran kas ke tabel <code>Journal</code>.
        </div>

        <div class="page-footer">
            <span>Dokumentasi Arsitektur SIKAK Yayasan Umum</span>
            <span>Halaman 3</span>
        </div>
    </div>

    <!-- ==================== HALAMAN 4: KAMUS DATA ERD 1 ==================== -->
    <div class="page">
        <div class="page-header">
            <span>SIKAK YAYASAN UMUM • DOKUMEN SPESIFIKASI ARSITEKTUR</span>
            <span>BAB II: KAMUS DATA ENTITAS (BAGIAN 1)</span>
        </div>

        <h2>2.2 KAMUS DATA & SPESIFIKASI ENTITAS DATABASE</h2>
        <p style="font-size: 8pt; margin-bottom: 4pt;">
            Berikut adalah rincian struktur kamus data entitas utama pada klaster Organisasi, Akademik Kesiswaan, dan Penerimaan:
        </p>

        <!-- Tabel 1: Field & Unit -->
        <h4 style="margin-bottom: 2pt;">1. Klaster Organisasi: <code>fields</code>, <code>units</code>, dan <code>users</code></h4>
        <table>
            <thead>
                <tr>
                    <th style="width: 15%;">Nama Kolom</th>
                    <th style="width: 15%;">Tipe Data</th>
                    <th style="width: 12%;">Constraint</th>
                    <th style="width: 58%;">Deskripsi Fungsional & Keterangan</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><code>id</code></td>
                    <td>VARCHAR(36)</td>
                    <td>PK, Default UUID</td>
                    <td>Pengenal unik entitas organisasi / pengguna.</td>
                </tr>
                <tr>
                    <td><code>name</code></td>
                    <td>VARCHAR(191)</td>
                    <td>NOT NULL</td>
                    <td>Nama bidang (cth: "Bidang Pendidikan") atau unit satker (cth: "SDIT 1").</td>
                </tr>
                <tr>
                    <td><code>fieldId</code> (Unit/User)</td>
                    <td>VARCHAR(36)</td>
                    <td>FK &rarr; fields.id</td>
                    <td>Relasi asosiasi ke induk bidang organisasi yayasan.</td>
                </tr>
                <tr>
                    <td><code>receivesBos</code> (Unit)</td>
                    <td>BOOLEAN</td>
                    <td>Default: FALSE</td>
                    <td>Flag apakah unit merupakan satuan pendidikan penerima dana BOS pemerintah.</td>
                </tr>
                <tr>
                    <td><code>role</code> (User)</td>
                    <td>VARCHAR(50)</td>
                    <td>NOT NULL</td>
                    <td>Tingkat hak akses: <code>superadmin</code>, <code>admin_bidang</code>, <code>admin_unit</code>, <code>staff</code>.</td>
                </tr>
                <tr>
                    <td><code>isDeleted</code></td>
                    <td>BOOLEAN</td>
                    <td>Default: FALSE</td>
                    <td>Implementasi Soft Delete untuk perlindungan integritas riwayat transaksi keuangan.</td>
                </tr>
            </tbody>
        </table>

        <!-- Tabel 2: Student & Academic -->
        <h4 style="margin-bottom: 2pt; margin-top: 6pt;">2. Klaster Kesiswaan: <code>AcademicYear</code>, <code>Class</code>, dan <code>Student</code></h4>
        <table>
            <thead>
                <tr>
                    <th style="width: 15%;">Nama Kolom</th>
                    <th style="width: 15%;">Tipe Data</th>
                    <th style="width: 12%;">Constraint</th>
                    <th style="width: 58%;">Deskripsi Fungsional & Keterangan</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><code>id</code></td>
                    <td>VARCHAR(36)</td>
                    <td>PK, UUID</td>
                    <td>Primary key unik untuk tahun ajaran, kelas, atau siswa.</td>
                </tr>
                <tr>
                    <td><code>nis</code> (Student)</td>
                    <td>VARCHAR(50)</td>
                    <td>NULLABLE</td>
                    <td>Nomor Induk Siswa nasional atau internal yayasan sebagai identitas unik siswa.</td>
                </tr>
                <tr>
                    <td><code>unitId</code> (Student/Class)</td>
                    <td>VARCHAR(36)</td>
                    <td>FK &rarr; units.id</td>
                    <td>Satuan unit sekolah tempat siswa terdaftar atau kelas bernaung.</td>
                </tr>
                <tr>
                    <td><code>classId</code> (Student)</td>
                    <td>VARCHAR(36)</td>
                    <td>FK &rarr; Class.id</td>
                    <td>Rombongan belajar aktif siswa (cth: "7-A", "10-IPA-1").</td>
                </tr>
                <tr>
                    <td><code>statusId</code> / <code>parentStatusId</code></td>
                    <td>VARCHAR(36)</td>
                    <td>FK &rarr; Masters</td>
                    <td>Status keberadaan siswa (Aktif/Mutasi/Lulus) dan status ekonomi orang tua (Mampu/Dhuafa).</td>
                </tr>
                <tr>
                    <td><code>isCurrent</code> (AcademicYear)</td>
                    <td>BOOLEAN</td>
                    <td>Default: FALSE</td>
                    <td>Penanda tahun ajaran yang sedang aktif dan menjadi basis transaksi pembukuan berjalan.</td>
                </tr>
            </tbody>
        </table>

        <!-- Tabel 3: Income Item & StudentIncomeDetail -->
        <h4 style="margin-bottom: 2pt; margin-top: 6pt;">3. Klaster Penerimaan Siswa: <code>income_items</code> & <code>StudentIncomeDetail</code></h4>
        <table>
            <thead>
                <tr>
                    <th style="width: 18%;">Nama Kolom</th>
                    <th style="width: 15%;">Tipe Data</th>
                    <th style="width: 15%;">Constraint</th>
                    <th style="width: 52%;">Deskripsi Fungsional & Keterangan</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><code>studentId</code></td>
                    <td>VARCHAR(36)</td>
                    <td>FK &rarr; Student.id</td>
                    <td>Siswa yang dikenakan komitmen kewajiban biaya pendidikan.</td>
                </tr>
                <tr>
                    <td><code>incomeItemId</code></td>
                    <td>VARCHAR(36)</td>
                    <td>FK &rarr; income_items.id</td>
                    <td>Jenis komponen penerimaan (SPP bulanan, Uang Masuk, Daftar Ulang, Infaq Gedung).</td>
                </tr>
                <tr>
                    <td><code>amount</code></td>
                    <td>DECIMAL(15,2)</td>
                    <td>NOT NULL</td>
                    <td>Nominal tarif komitmen yang wajib disetorkan oleh siswa per periode.</td>
                </tr>
                <tr>
                    <td><code>isBos</code> (IncomeItem)</td>
                    <td>BOOLEAN</td>
                    <td>Default: FALSE</td>
                    <td>Penanda apakah jenis penerimaan ini bersumber dari pos hibah BOS pemerintah.</td>
                </tr>
            </tbody>
        </table>

        <div class="page-footer">
            <span>Dokumentasi Arsitektur SIKAK Yayasan Umum</span>
            <span>Halaman 4</span>
        </div>
    </div>

    <!-- ==================== HALAMAN 5: KAMUS DATA ERD 2 ==================== -->
    <div class="page">
        <div class="page-header">
            <span>SIKAK YAYASAN UMUM • DOKUMEN SPESIFIKASI ARSITEKTUR</span>
            <span>BAB II: KAMUS DATA ENTITAS (BAGIAN 2)</span>
        </div>

        <h3>2.2 KAMUS DATA (LANJUTAN): ANGGARAN, REALISASI, AKUNTANSI & ASET</h3>

        <!-- Tabel 4: Expense, Distribution, RAB, Request, Report -->
        <h4 style="margin-bottom: 2pt;">4. Klaster Anggaran, Realisasi & SPJ: <code>expense_items</code>, <code>budget_requests</code>, <code>budget_reports</code></h4>
        <table>
            <thead>
                <tr>
                    <th style="width: 17%;">Nama Kolom</th>
                    <th style="width: 15%;">Tipe Data</th>
                    <th style="width: 15%;">Constraint</th>
                    <th style="width: 53%;">Deskripsi Fungsional & Keterangan</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><code>percentage</code> (Distribution)</td>
                    <td>DECIMAL(5,2)</td>
                    <td>0.00 - 100.00</td>
                    <td>Persentase pembagian penerimaan siswa ke pos belanja atau unit/yayasan.</td>
                </tr>
                <tr>
                    <td><code>budgetRequestId</code></td>
                    <td>VARCHAR(36)</td>
                    <td>FK &rarr; requests</td>
                    <td>Menghubungkan realisasi belanja riil dengan dokumen pengajuan dana yang disetujui.</td>
                </tr>
                <tr>
                    <td><code>totalAmount</code> (Request)</td>
                    <td>DECIMAL(15,2)</td>
                    <td>NULLABLE</td>
                    <td>Total nominal pagu kas yang diajukan oleh unit untuk kebutuhan bulanan.</td>
                </tr>
                <tr>
                    <td><code>nomorNota</code> (Report)</td>
                    <td>VARCHAR(100)</td>
                    <td>NULLABLE</td>
                    <td>Nomor kuitansi/faktur/nota fisik toko sebagai bukti pertanggungjawaban riil belanja.</td>
                </tr>
                <tr>
                    <td><code>volume</code>, <code>harga</code>, <code>diskon</code></td>
                    <td>DECIMAL(15,2/4)</td>
                    <td>NULLABLE</td>
                    <td>Kuantitas barang, harga satuan riil, dan potongan harga pada pelaporan nota.</td>
                </tr>
                <tr>
                    <td><code>kategoriAset</code> (Report)</td>
                    <td>VARCHAR(50)</td>
                    <td>Default: "NON_ASET"</td>
                    <td>Menentukan apakah belanja dikapitalisasi menjadi aset tetap atau dibebankan langsung.</td>
                </tr>
                <tr>
                    <td><code>status</code> (Request/Report)</td>
                    <td>VARCHAR(20)</td>
                    <td>PENDING / APPROVED</td>
                    <td>Status alur kerja persetujuan oleh superadmin yayasan.</td>
                </tr>
            </tbody>
        </table>

        <!-- Tabel 5: Account, Journal, Asset -->
        <h4 style="margin-bottom: 2pt; margin-top: 6pt;">5. Klaster Akuntansi & Aset: <code>accounts</code>, <code>journals</code>, dan <code>assets</code></h4>
        <table>
            <thead>
                <tr>
                    <th style="width: 17%;">Nama Kolom</th>
                    <th style="width: 15%;">Tipe Data</th>
                    <th style="width: 15%;">Constraint</th>
                    <th style="width: 53%;">Deskripsi Fungsional & Keterangan</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><code>code</code> (Account)</td>
                    <td>VARCHAR(50)</td>
                    <td>NOT NULL</td>
                    <td>Nomor kode akun standar akuntansi (cth: "1-1001" Kas, "4-1001" Pendapatan SPP).</td>
                </tr>
                <tr>
                    <td><code>balance</code> (Account)</td>
                    <td>DECIMAL(15,2)</td>
                    <td>Default: 0.00</td>
                    <td>Saldo akun mutakhir yang diakumulasikan dari riwayat jurnal umum.</td>
                </tr>
                <tr>
                    <td><code>entries</code> (Journal)</td>
                    <td>JSON</td>
                    <td>Array of Objects</td>
                    <td>Struktur baris double-entry debit dan kredit: <code>[{"accountId": "...", "debit": 500000, "credit": 0}]</code>.</td>
                </tr>
                <tr>
                    <td><code>cost</code> (Asset)</td>
                    <td>DECIMAL(15,2)</td>
                    <td>NULLABLE</td>
                    <td>Nilai perolehan historis aset tetap saat dibeli/diterima.</td>
                </tr>
                <tr>
                    <td><code>usefulLifeMonths</code></td>
                    <td>INTEGER</td>
                    <td>NULLABLE</td>
                    <td>Masa manfaat ekonomis aset dalam hitungan bulan untuk perhitungan amortisasi/depresiasi.</td>
                </tr>
                <tr>
                    <td><code>residualValue</code> (Asset)</td>
                    <td>DECIMAL(15,2)</td>
                    <td>Default: 0.00</td>
                    <td>Taksiran nilai sisa aset tetap di akhir umur ekonomis.</td>
                </tr>
            </tbody>
        </table>

        <!-- Tabel 6: BOS Allocation -->
        <h4 style="margin-bottom: 2pt; margin-top: 6pt;">6. Klaster Bantuan Operasional Sekolah: <code>bos_allocations</code></h4>
        <table>
            <thead>
                <tr>
                    <th style="width: 17%;">Nama Kolom</th>
                    <th style="width: 15%;">Tipe Data</th>
                    <th style="width: 15%;">Constraint</th>
                    <th style="width: 53%;">Deskripsi Fungsional & Keterangan</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><code>stageId</code></td>
                    <td>VARCHAR(36)</td>
                    <td>FK &rarr; bos_stages</td>
                    <td>Tahapan pencairan dana BOS (Tahap 1, Tahap 2) per tahun anggaran.</td>
                </tr>
                <tr>
                    <td><code>posId</code></td>
                    <td>VARCHAR(36)</td>
                    <td>FK &rarr; bos_pos</td>
                    <td>Pos alokasi juknis standar BOS (Sarpras, Honor, Buku Pembelajaran, Asesmen).</td>
                </tr>
                <tr>
                    <td><code>unitId</code></td>
                    <td>VARCHAR(36)</td>
                    <td>FK &rarr; units.id</td>
                    <td>Satuan pendidikan yang menerima alokasi kuota dana BOS.</td>
                </tr>
                <tr>
                    <td><code>amount</code></td>
                    <td>DECIMAL(15,2)</td>
                    <td>NOT NULL</td>
                    <td>Besaran kuota dana BOS yang dialokasikan ke unit untuk pos bersangkutan.</td>
                </tr>
            </tbody>
        </table>

        <div class="page-footer">
            <span>Dokumentasi Arsitektur SIKAK Yayasan Umum</span>
            <span>Halaman 5</span>
        </div>
    </div>

    <!-- ==================== HALAMAN 6: MODEL REA LANDASAN TEORI ==================== -->
    <div class="page">
        <div class="page-header">
            <span>SIKAK YAYASAN UMUM • DOKUMEN SPESIFIKASI ARSITEKTUR</span>
            <span>BAB III: MODEL RESOURCES, EVENTS, AGENTS (REA)</span>
        </div>

        <h2>BAB III: PEMODELAN RESOURCES, EVENTS, AGENTS (REA)</h2>

        <div class="callout callout-green">
            <div class="callout-title">Konsep Inti Ontologi REA (William E. McCarthy, 1982)</div>
            Pemodelan REA adalah arsitektur konseptual Sistem Informasi Akuntansi (SIA) yang memetakan aktivitas operasional ke dalam tiga komponen dasar: <strong>Resources</strong> (sumber daya ekonomi bernilai langka yang dikontrol organisasi), <strong>Events</strong> (transaksi atau peristiwa ekonomi yang mengubah jumlah sumber daya), dan <strong>Agents</strong> (orang atau pihak internal maupun eksternal yang berpartisipasi dalam peristiwa tersebut).
        </div>

        <h3>3.1 Tiga Prinsip Fundamental REA pada Yayasan Pendidikan</h3>
        <div class="grid-3">
            <div class="card" style="border-top: 3pt solid #10b981;">
                <div class="card-header" style="color: #065f46;">
                    <span>1. Resources (R)</span>
                </div>
                <p style="font-size: 8pt; color: #334155; margin: 0;">
                    Aset nyata dan hak klaim yang memiliki utilitas ekonomi bagi yayasan, mencakup kas, rekening bank, saldo BOS, piutang iuran, persediaan ATK, serta gedung dan aset tetap sekolah.
                </p>
            </div>
            <div class="card" style="border-top: 3pt solid #3b82f6;">
                <div class="card-header" style="color: #1e40af;">
                    <span>2. Events (E)</span>
                </div>
                <p style="font-size: 8pt; color: #334155; margin: 0;">
                    Peristiwa yang mengalirkan sumber daya, mencakup komitmen perencanaan (RAB, Permintaan Dana), aliran masuk (Setoran SPP, Hibah BOS), aliran keluar (Belanja Nota), dan akuntansi (Jurnal).
                </p>
            </div>
            <div class="card" style="border-top: 3pt solid #f59e0b;">
                <div class="card-header" style="color: #92400e;">
                    <span>3. Agents (A)</span>
                </div>
                <p style="font-size: 8pt; color: #334155; margin: 0;">
                    Individu atau institusi yang terlibat dalam transaksi, dipisahkan secara tegas antara Agen Internal (Pengurus, Bendahara, Admin Unit) dan Agen Eksternal (Siswa, Wali, Vendor, Pemerintah).
                </p>
            </div>
        </div>

        <h3 style="margin-top: 8pt;">3.2 Dualitas Ekonomi (Economic Duality) & Stockflow</h3>
        <p>
            Sistem akuntansi modern dibangun atas dasar dualitas pertukaran: tidak ada penyerahan sumber daya tanpa adanya penerimaan sumber daya kompensasi (prinsip <em>Give-and-Take Duality</em>).
        </p>
        <ul>
            <li><strong>Dualitas Pendapatan Siswa:</strong> Yayasan menyerahkan <em>Jasa Pendidikan & Fasilitas Belajar</em> (Give Event) dan memperoleh <em>Kas / Setoran SPP</em> (Take Event / Inflow) dari Orang Tua Siswa.</li>
            <li><strong>Dualitas Belanja Operasional:</strong> Yayasan menyerahkan <em>Kas Unit</em> (Give Event / Outflow) dan memperoleh <em>Barang Operasional / ATK / Jasa / Aset Tetap</em> (Take Event / Inflow) dari Toko / Vendor.</li>
            <li><strong>Stockflow Relationship:</strong> Setiap transaksi ekonomi menghubungkan Event dengan Resource:
                <ul>
                    <li><em>Inflow Event:</em> Menambah volume/saldo sumber daya (cth: Penerimaan SPP menambah Kas Yayasan).</li>
                    <li><em>Outflow Event:</em> Mengurangi volume/saldo sumber daya (cth: Belanja ATK mengurangi Kas Unit).</li>
                </ul>
            </li>
        </ul>

        <h3 style="margin-top: 6pt;">3.3 Taksonomi Komponen REA SIKAK Yayasan</h3>
        <table>
            <thead>
                <tr>
                    <th style="width: 15%;">Komponen</th>
                    <th style="width: 25%;">Elemen SIKAK</th>
                    <th style="width: 20%;">Entitas Fisik Terkait</th>
                    <th style="width: 40%;">Peran & Karakteristik Akuntansi</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td rowspan="3"><strong>Resources (R)</strong></td>
                    <td>Kas & Bank Yayasan / Unit</td>
                    <td><code>Account</code>, <code>journals</code></td>
                    <td>Likuiditas moneter pusat dan operasional unit kerja.</td>
                </tr>
                <tr>
                    <td>Rekening Kas Dana BOS</td>
                    <td><code>bos_allocations</code></td>
                    <td>Kas terisolasi yang diatur oleh juknis bantuan operasional.</td>
                </tr>
                <tr>
                    <td>Aset Tetap & Fasilitas</td>
                    <td><code>assets</code>, <code>asset_rooms</code></td>
                    <td>Barang inventaris modal (komputer, mebel, gedung) berumur > 1 tahun.</td>
                </tr>
                <tr>
                    <td rowspan="3"><strong>Events (E)</strong></td>
                    <td>Pengajuan & Approval Anggaran</td>
                    <td><code>rab_plans</code>, <code>budget_requests</code></td>
                    <td>Commitment Event: Otorisasi batas belanja dan pencairan kas.</td>
                </tr>
                <tr>
                    <td>Penerimaan Iuran Siswa & BOS</td>
                    <td><code>StudentIncomeDetail</code>, <code>bos_stages</code></td>
                    <td>Economic Inflow Event: Pertambahan sumber daya moneter.</td>
                </tr>
                <tr>
                    <td>Realisasi Belanja & SPJ</td>
                    <td><code>budget_reports</code>, <code>journals</code></td>
                    <td>Economic Outflow Event: Penyerapan beban kas dan pengadaan barang.</td>
                </tr>
                <tr>
                    <td rowspan="2"><strong>Agents (A)</strong></td>
                    <td>Agen Internal</td>
                    <td><code>users</code> (Admin Unit, Yayasan)</td>
                    <td>Pelaksana otorisasi, penanggung jawab verifikasi, kasir, dan PIC aset.</td>
                </tr>
                <tr>
                    <td>Agen Eksternal</td>
                    <td><code>Student</code>, <code>contacts</code> (Vendor)</td>
                    <td>Wali murid, rekanan toko/supplier, dan dinas pendidikan penyalur dana.</td>
                </tr>
            </tbody>
        </table>

        <div class="page-footer">
            <span>Dokumentasi Arsitektur SIKAK Yayasan Umum</span>
            <span>Halaman 6</span>
        </div>
    </div>

    <!-- ==================== HALAMAN 7: DIAGRAM ARSITEKTUR REA LENGKAP ==================== -->
    <div class="page">
        <div class="page-header">
            <span>SIKAK YAYASAN UMUM • DOKUMEN SPESIFIKASI ARSITEKTUR</span>
            <span>BAB III: DIAGRAM ARSITEKTUR REA LENGKAP</span>
        </div>

        <h2>3.4 DIAGRAM ARSITEKTUR REA TERPADU SIKAK YAYASAN</h2>
        <p style="font-size: 8pt; margin-bottom: 4pt;">
            Diagram di bawah merepresentasikan hubungan terstruktur antara <strong>Resources (R)</strong> di sisi kiri, <strong>Events (E)</strong> di tengah, dan <strong>Agents (A)</strong> di sisi kanan, disertai garis Stockflow, Duality, dan Participation:
        </p>

        <div class="diagram-container">
            <!-- FULL HIGH-RES SVG REA DIAGRAM -->
            <svg viewBox="0 0 1150 780" xmlns="http://www.w3.org/2000/svg" style="background:#ffffff; font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif;">
                <defs>
                    <filter id="shadow-rea" x="-5%" y="-5%" width="110%" height="110%">
                        <feDropShadow dx="1" dy="2" stdDeviation="2" flood-color="#0f172a" flood-opacity="0.08"/>
                    </filter>
                    <marker id="arrow-rea" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                        <path d="M 0 1 L 10 5 L 0 9 z" fill="#475569" />
                    </marker>
                    <marker id="arrow-green" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                        <path d="M 0 1 L 10 5 L 0 9 z" fill="#16a34a" />
                    </marker>
                    <marker id="arrow-red" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                        <path d="M 0 1 L 10 5 L 0 9 z" fill="#dc2626" />
                    </marker>
                </defs>

                <!-- 3 Columns Background Bands -->
                <!-- Column 1: Resources -->
                <rect x="20" y="20" width="290" height="740" rx="8" fill="#f0fdf4" stroke="#bbf7d0" stroke-width="1.2"/>
                <text x="165" y="42" font-size="12" font-weight="900" fill="#166534" text-anchor="middle">RESOURCES (SUMBER DAYA)</text>
                <text x="165" y="56" font-size="8" fill="#15803d" text-anchor="middle">Aset Ekonomi & Kas yang Dikelola Yayasan</text>

                <!-- Column 2: Events -->
                <rect x="330" y="20" width="490" height="740" rx="8" fill="#eff6ff" stroke="#bfdbfe" stroke-width="1.2"/>
                <text x="575" y="42" font-size="12" font-weight="900" fill="#1e40af" text-anchor="middle">EVENTS (PERISTIWA EKONOMI & KOMITMEN)</text>
                <text x="575" y="56" font-size="8" fill="#2563eb" text-anchor="middle">Peristiwa Arus Masuk, Aliran Keluar, & Otorisasi</text>

                <!-- Column 3: Agents -->
                <rect x="840" y="20" width="290" height="740" rx="8" fill="#fffbeb" stroke="#fde68a" stroke-width="1.2"/>
                <text x="985" y="42" font-size="12" font-weight="900" fill="#92400e" text-anchor="middle">AGENTS (PELAKU TRANSAKSI)</text>
                <text x="985" y="56" font-size="8" fill="#b45309" text-anchor="middle">Pihak Internal (Otoritas) & Pihak Eksternal</text>

                <!-- ================= COLUMN 1: RESOURCES ================= -->
                <!-- R1: Kas & Bank Yayasan -->
                <g filter="url(#shadow-rea)">
                    <rect x="35" y="75" width="260" height="75" rx="6" fill="#ffffff" stroke="#16a34a" stroke-width="1.2"/>
                    <text x="45" y="93" font-size="9" font-weight="800" fill="#166534">R1: Kas & Rekening Bank Yayasan</text>
                    <text x="45" y="108" font-size="7.5" fill="#334155">• Saldo likuiditas pusat yayasan</text>
                    <text x="45" y="120" font-size="7.5" fill="#334155">• Penampung penerimaan SPP & donasi</text>
                    <text x="45" y="132" font-size="7.5" fill="#64748b">Tabel: <code>accounts (1-1101, 1-1102)</code></text>
                </g>

                <!-- R2: Kas Operasional Unit -->
                <g filter="url(#shadow-rea)">
                    <rect x="35" y="165" width="260" height="75" rx="6" fill="#ffffff" stroke="#16a34a" stroke-width="1.2"/>
                    <text x="45" y="183" font-size="9" font-weight="800" fill="#166534">R2: Kas Operasional Unit (Sekolah)</text>
                    <text x="45" y="198" font-size="7.5" fill="#334155">• Kas kecil belanja operasional bulanan</text>
                    <text x="45" y="210" font-size="7.5" fill="#334155">• Hasil penyaluran pengajuan anggaran</text>
                    <text x="45" y="222" font-size="7.5" fill="#64748b">Tabel: <code>accounts (Kas Unit Satker)</code></text>
                </g>

                <!-- R3: Kas Dana BOS -->
                <g filter="url(#shadow-rea)">
                    <rect x="35" y="255" width="260" height="75" rx="6" fill="#ffffff" stroke="#16a34a" stroke-width="1.2"/>
                    <text x="45" y="273" font-size="9" font-weight="800" fill="#166534">R3: Rekening Kas Dana BOS</text>
                    <text x="45" y="288" font-size="7.5" fill="#334155">• Saldo hibah bantuan operasional sekolah</text>
                    <text x="45" y="300" font-size="7.5" fill="#334155">• Dibatasi oleh pos standar juknis</text>
                    <text x="45" y="312" font-size="7.5" fill="#64748b">Tabel: <code>bos_allocations, units</code></text>
                </g>

                <!-- R4: Piutang / Klaim Iuran Siswa -->
                <g filter="url(#shadow-rea)">
                    <rect x="35" y="345" width="260" height="75" rx="6" fill="#ffffff" stroke="#16a34a" stroke-width="1.2"/>
                    <text x="45" y="363" font-size="9" font-weight="800" fill="#166534">R4: Piutang / Hak Tagih Iuran Siswa</text>
                    <text x="45" y="378" font-size="7.5" fill="#334155">• Hak klaim biaya pendidikan per siswa</text>
                    <text x="45" y="390" font-size="7.5" fill="#334155">• Berkurang saat pembayaran diterima</text>
                    <text x="45" y="402" font-size="7.5" fill="#64748b">Tabel: <code>StudentIncomeDetail, Student</code></text>
                </g>

                <!-- R5: Barang & Beban Habis Pakai -->
                <g filter="url(#shadow-rea)">
                    <rect x="35" y="435" width="260" height="75" rx="6" fill="#ffffff" stroke="#16a34a" stroke-width="1.2"/>
                    <text x="45" y="453" font-size="9" font-weight="800" fill="#166534">R5: Barang Habis Pakai & Jasa Operasional</text>
                    <text x="45" y="468" font-size="7.5" fill="#334155">• ATK, utilitas listrik/air, konsumsi</text>
                    <text x="45" y="480" font-size="7.5" fill="#334155">• Honorarium guru dan tenaga kependidikan</text>
                    <text x="45" y="492" font-size="7.5" fill="#64748b">Tabel: <code>expense_items, budget_reports</code></text>
                </g>

                <!-- R6: Aset Tetap & Peralatan -->
                <g filter="url(#shadow-rea)">
                    <rect x="35" y="525" width="260" height="75" rx="6" fill="#ffffff" stroke="#16a34a" stroke-width="1.2"/>
                    <text x="45" y="543" font-size="9" font-weight="800" fill="#166534">R6: Aset Tetap & Sarana Prasarana</text>
                    <text x="45" y="558" font-size="7.5" fill="#334155">• Komputer, lab, mebel, gedung sekolah</text>
                    <text x="45" y="570" font-size="7.5" fill="#334155">• Memiliki umur ekonomis & depresiasi</text>
                    <text x="45" y="582" font-size="7.5" fill="#64748b">Tabel: <code>assets, asset_categories</code></text>
                </g>

                <!-- R7: Dana Donasi Terikat / Ziswaf -->
                <g filter="url(#shadow-rea)">
                    <rect x="35" y="615" width="260" height="75" rx="6" fill="#ffffff" stroke="#16a34a" stroke-width="1.2"/>
                    <text x="45" y="633" font-size="9" font-weight="800" fill="#166534">R7: Dana Donasi / Ziswaf Program</text>
                    <text x="45" y="648" font-size="7.5" fill="#334155">• Donasi terikat program tahfizh/yatim</text>
                    <text x="45" y="660" font-size="7.5" fill="#334155">• Dikelola terpisah sesuai akad donatur</text>
                    <text x="45" y="672" font-size="7.5" fill="#64748b">Tabel: <code>programs, contacts</code></text>
                </g>

                <!-- ================= COLUMN 2: EVENTS ================= -->
                <!-- E1: Penetapan RAB (Commitment) -->
                <g filter="url(#shadow-rea)">
                    <rect x="345" y="75" width="225" height="65" rx="6" fill="#ffffff" stroke="#2563eb" stroke-width="1.2"/>
                    <text x="355" y="93" font-size="8.5" font-weight="800" fill="#1e40af">E1: Penetapan RAB Tahunan (Commitment)</text>
                    <text x="355" y="108" font-size="7" fill="#334155">Plafon rencana anggaran penerimaan & belanja</text>
                    <text x="355" y="122" font-size="7" fill="#64748b">Tabel: <code>rab_plans, distribution_settings</code></text>
                </g>

                <!-- E2: Permintaan Dana Bulanan (Commitment) -->
                <g filter="url(#shadow-rea)">
                    <rect x="585" y="75" width="225" height="65" rx="6" fill="#ffffff" stroke="#2563eb" stroke-width="1.2"/>
                    <text x="595" y="93" font-size="8.5" font-weight="800" fill="#1e40af">E2: Pengajuan Permintaan Dana (Request)</text>
                    <text x="595" y="108" font-size="7" fill="#334155">Pengajuan kas unit & verifikasi superadmin</text>
                    <text x="595" y="122" font-size="7" fill="#64748b">Tabel: <code>budget_requests</code></text>
                </g>

                <!-- E3: Pembayaran Iuran Siswa (Inflow) -->
                <g filter="url(#shadow-rea)">
                    <rect x="345" y="170" width="225" height="75" rx="6" fill="#ffffff" stroke="#16a34a" stroke-width="1.2"/>
                    <text x="355" y="188" font-size="8.5" font-weight="800" fill="#15803d">E3: Penerimaan Iuran Siswa (Inflow)</text>
                    <text x="355" y="203" font-size="7" fill="#334155">Arus masuk kas dari pembayaran SPP siswa</text>
                    <text x="355" y="215" font-size="7" fill="#334155">Menaikkan Kas (R1) & Menurunkan Piutang (R4)</text>
                    <text x="355" y="228" font-size="7" fill="#64748b">Tabel: <code>StudentIncomeDetail, journals</code></text>
                </g>

                <!-- E4: Penerimaan Dana BOS (Inflow) -->
                <g filter="url(#shadow-rea)">
                    <rect x="585" y="170" width="225" height="75" rx="6" fill="#ffffff" stroke="#16a34a" stroke-width="1.2"/>
                    <text x="595" y="188" font-size="8.5" font-weight="800" fill="#15803d">E4: Pencairan Dana BOS (Inflow)</text>
                    <text x="595" y="203" font-size="7" fill="#334155">Arus masuk transfer pemerintah per tahap</text>
                    <text x="595" y="215" font-size="7" fill="#334155">Menaikkan Rekening BOS (R3)</text>
                    <text x="595" y="228" font-size="7" fill="#64748b">Tabel: <code>bos_stages, bos_allocations</code></text>
                </g>

                <!-- E5: Penyaluran Kas ke Unit (Internal Transfer) -->
                <g filter="url(#shadow-rea)">
                    <rect x="345" y="280" width="225" height="75" rx="6" fill="#ffffff" stroke="#7e22ce" stroke-width="1.2"/>
                    <text x="355" y="298" font-size="8.5" font-weight="800" fill="#6b21a8">E5: Penyaluran Kas ke Unit (Transfer)</text>
                    <text x="355" y="313" font-size="7" fill="#334155">Pencairan dana berdasarkan persetujuan Request</text>
                    <text x="355" y="325" font-size="7" fill="#334155">Menurunkan Kas Pusat (R1) & Menaikkan Kas Unit (R2)</text>
                    <text x="355" y="338" font-size="7" fill="#64748b">Tabel: <code>budget_requests, journals</code></text>
                </g>

                <!-- E6: Realisasi Belanja Operasional (Outflow) -->
                <g filter="url(#shadow-rea)">
                    <rect x="585" y="280" width="225" height="75" rx="6" fill="#ffffff" stroke="#dc2626" stroke-width="1.2"/>
                    <text x="595" y="298" font-size="8.5" font-weight="800" fill="#b91c1c">E6: Realisasi Belanja Unit (Outflow)</text>
                    <text x="595" y="313" font-size="7" fill="#334155">Pembayaran biaya barang & jasa didukung nota</text>
                    <text x="595" y="325" font-size="7" fill="#334155">Menurunkan Kas Unit (R2), Menaikkan Jasa (R5)</text>
                    <text x="595" y="338" font-size="7" fill="#64748b">Tabel: <code>budget_reports, expense_items</code></text>
                </g>

                <!-- E7: Kapitalisasi Aset Tetap (Conversion) -->
                <g filter="url(#shadow-rea)">
                    <rect x="345" y="390" width="225" height="75" rx="6" fill="#ffffff" stroke="#e11d48" stroke-width="1.2"/>
                    <text x="355" y="408" font-size="8.5" font-weight="800" fill="#9f1239">E7: Pengadaan Aset Tetap (Capitalization)</text>
                    <text x="355" y="423" font-size="7" fill="#334155">Konversi pengeluaran kas menjadi Aset Modal</text>
                    <text x="355" y="435" font-size="7" fill="#334155">Menurunkan Kas (R2), Menaikkan Aset Tetap (R6)</text>
                    <text x="355" y="448" font-size="7" fill="#64748b">Tabel: <code>assets, budget_reports</code></text>
                </g>

                <!-- E8: Belanja Realisasi Dana BOS (Outflow) -->
                <g filter="url(#shadow-rea)">
                    <rect x="585" y="390" width="225" height="75" rx="6" fill="#ffffff" stroke="#dc2626" stroke-width="1.2"/>
                    <text x="595" y="408" font-size="8.5" font-weight="800" fill="#b91c1c">E8: Realisasi Belanja BOS (Outflow)</text>
                    <text x="595" y="423" font-size="7" fill="#334155">Belanja juknis BOS (Buku, Asesmen, Sarpras)</text>
                    <text x="595" y="435" font-size="7" fill="#334155">Menurunkan Kas Dana BOS (R3)</text>
                    <text x="595" y="448" font-size="7" fill="#64748b">Tabel: <code>bos_allocations, budget_reports</code></text>
                </g>

                <!-- E9: Penerimaan Donasi Program (Inflow) -->
                <g filter="url(#shadow-rea)">
                    <rect x="345" y="500" width="225" height="70" rx="6" fill="#ffffff" stroke="#16a34a" stroke-width="1.2"/>
                    <text x="355" y="518" font-size="8.5" font-weight="800" fill="#15803d">E9: Penerimaan Donasi / Infaq (Inflow)</text>
                    <text x="355" y="533" font-size="7" fill="#334155">Penyetoran dana ziswaf dari muzakki/donatur</text>
                    <text x="355" y="545" font-size="7" fill="#334155">Menaikkan Kas (R1) & Dana Donasi (R7)</text>
                    <text x="355" y="558" font-size="7" fill="#64748b">Tabel: <code>programs, journals</code></text>
                </g>

                <!-- E10: Penjurnalan & Tutup Buku (Accounting) -->
                <g filter="url(#shadow-rea)">
                    <rect x="585" y="500" width="225" height="70" rx="6" fill="#ffffff" stroke="#475569" stroke-width="1.2"/>
                    <text x="595" y="518" font-size="8.5" font-weight="800" fill="#334155">E10: Penjurnalan & Tutup Buku (GL)</text>
                    <text x="595" y="533" font-size="7" fill="#334155">Perekaman double-entry debit-kredit formal</text>
                    <text x="595" y="545" font-size="7" fill="#334155">Depresiasi aset & pemindahan surplus/defisit</text>
                    <text x="595" y="558" font-size="7" fill="#64748b">Tabel: <code>journals, accounts</code></text>
                </g>

                <!-- ================= COLUMN 3: AGENTS ================= -->
                <!-- A1: Pengurus / Super Admin -->
                <g filter="url(#shadow-rea)">
                    <rect x="855" y="75" width="260" height="60" rx="6" fill="#ffffff" stroke="#f59e0b" stroke-width="1.2"/>
                    <text x="865" y="93" font-size="9" font-weight="800" fill="#92400e">A1: Pengurus Yayasan (Superadmin)</text>
                    <text x="865" y="108" font-size="7.5" fill="#334155">• Otorisator final RAB & pencairan dana kas</text>
                    <text x="865" y="120" font-size="7.5" fill="#64748b">Tipe: Agen Internal (Pimpinan Puncak)</text>
                </g>

                <!-- A2: Bendahara Yayasan -->
                <g filter="url(#shadow-rea)">
                    <rect x="855" y="150" width="260" height="60" rx="6" fill="#ffffff" stroke="#f59e0b" stroke-width="1.2"/>
                    <text x="865" y="168" font-size="9" font-weight="800" fill="#92400e">A2: Bendahara Yayasan (Treasury)</text>
                    <text x="865" y="183" font-size="7.5" fill="#334155">• Pengelola rekening bank & transfer kas</text>
                    <text x="865" y="195" font-size="7.5" fill="#64748b">Tipe: Agen Internal (Finansial Pusat)</text>
                </g>

                <!-- A3: Kepala Sekolah / Bendahara Unit -->
                <g filter="url(#shadow-rea)">
                    <rect x="855" y="225" width="260" height="60" rx="6" fill="#ffffff" stroke="#f59e0b" stroke-width="1.2"/>
                    <text x="865" y="243" font-size="9" font-weight="800" fill="#92400e">A3: Kepala Unit / Bendahara Satker</text>
                    <text x="865" y="258" font-size="7.5" fill="#334155">• Pengusul RAB, pemohon kas & pelapor SPJ</text>
                    <text x="865" y="270" font-size="7.5" fill="#64748b">Tipe: Agen Internal (Operasional Satker)</text>
                </g>

                <!-- A4: PIC Aset / Sarpras -->
                <g filter="url(#shadow-rea)">
                    <rect x="855" y="300" width="260" height="60" rx="6" fill="#ffffff" stroke="#f59e0b" stroke-width="1.2"/>
                    <text x="865" y="318" font-size="9" font-weight="800" fill="#92400e">A4: PIC Aset / Sarpras Unit</text>
                    <text x="865" y="333" font-size="7.5" fill="#334155">• Penanggung jawab fisik inventaris & ruangan</text>
                    <text x="865" y="345" font-size="7.5" fill="#64748b">Tipe: Agen Internal (Logistik & Inventaris)</text>
                </g>

                <!-- A5: Siswa & Wali Murid -->
                <g filter="url(#shadow-rea)">
                    <rect x="855" y="380" width="260" height="65" rx="6" fill="#ffffff" stroke="#ea580c" stroke-width="1.2"/>
                    <text x="865" y="398" font-size="9" font-weight="800" fill="#c2410c">A5: Siswa & Wali Murid (Customer)</text>
                    <text x="865" y="413" font-size="7.5" fill="#334155">• Penyetor iuran pendidikan SPP/Gedung</text>
                    <text x="865" y="425" font-size="7.5" fill="#334155">• Penerima manfaat layanan belajar</text>
                    <text x="865" y="437" font-size="7.5" fill="#64748b">Tipe: Agen Eksternal (Stakeholder Pendidikan)</text>
                </g>

                <!-- A6: Pemerintah (Dinas Pendidikan) -->
                <g filter="url(#shadow-rea)">
                    <rect x="855" y="460" width="260" height="65" rx="6" fill="#ffffff" stroke="#ea580c" stroke-width="1.2"/>
                    <text x="865" y="478" font-size="9" font-weight="800" fill="#c2410c">A6: Pemerintah / Tim BOS (Grantor)</text>
                    <text x="865" y="493" font-size="7.5" fill="#334155">• Penyalur dana BOS & regulator juknis</text>
                    <text x="865" y="505" font-size="7.5" fill="#334155">• Penerima laporan pertanggungjawaban BOS</text>
                    <text x="865" y="517" font-size="7.5" fill="#64748b">Tipe: Agen Eksternal (Regulator & Hibah)</text>
                </g>

                <!-- A7: Vendor & Rekanan Toko -->
                <g filter="url(#shadow-rea)">
                    <rect x="855" y="540" width="260" height="65" rx="6" fill="#ffffff" stroke="#ea580c" stroke-width="1.2"/>
                    <text x="865" y="558" font-size="9" font-weight="800" fill="#c2410c">A7: Vendor / Supplier / Toko (Vendor)</text>
                    <text x="865" y="573" font-size="7.5" fill="#334155">• Penyedia barang ATK, peralatan, & jasa</text>
                    <text x="865" y="585" font-size="7.5" fill="#334155">• Penerbit kuitansi/faktur/nota belanja</text>
                    <text x="865" y="597" font-size="7.5" fill="#64748b">Tipe: Agen Eksternal (Penyedia Pasokan)</text>
                </g>

                <!-- A8: Donatur & Muzakki -->
                <g filter="url(#shadow-rea)">
                    <rect x="855" y="620" width="260" height="65" rx="6" fill="#ffffff" stroke="#ea580c" stroke-width="1.2"/>
                    <text x="865" y="638" font-size="9" font-weight="800" fill="#c2410c">A8: Donatur & Muzakki (Benefactor)</text>
                    <text x="865" y="653" font-size="7.5" fill="#334155">• Pemberi infaq, sedekah, dan wakaf</text>
                    <text x="865" y="665" font-size="7.5" fill="#334155">• Donasi terikat program sosial dakwah</text>
                    <text x="865" y="677" font-size="7.5" fill="#64748b">Tipe: Agen Eksternal (Donasi Filantropi)</text>
                </g>

                <!-- ================= ARUS STOCKFLOW & PARTICIPATION LINES ================= -->
                <!-- E3 (Setor SPP) -> R1 (Kas+) -->
                <path d="M 345 205 L 295 125" stroke="#16a34a" stroke-width="1.4" marker-end="url(#arrow-green)"/>
                <!-- E3 (Setor SPP) <- A5 (Wali) -->
                <path d="M 855 405 L 570 215" stroke="#ea580c" stroke-width="1.2" stroke-dasharray="3 2" marker-end="url(#arrow-rea)"/>

                <!-- E4 (BOS Inflow) -> R3 (Kas BOS+) -->
                <path d="M 585 210 L 295 285" stroke="#16a34a" stroke-width="1.4" marker-end="url(#arrow-green)"/>
                <!-- E4 <- A6 (Pemerintah) -->
                <path d="M 855 480 L 810 220" stroke="#ea580c" stroke-width="1.2" stroke-dasharray="3 2" marker-end="url(#arrow-rea)"/>

                <!-- E5 (Penyaluran Kas): R1 (Kas Yayasan -) -> E5 -> R2 (Kas Unit +) -->
                <path d="M 295 140 L 345 300" stroke="#dc2626" stroke-width="1.4" marker-end="url(#arrow-red)"/>
                <path d="M 345 320 L 295 225" stroke="#16a34a" stroke-width="1.4" marker-end="url(#arrow-green)"/>

                <!-- E6 (Belanja Unit): R2 (Kas Unit -) -> E6 -> R5 (Barang+) -->
                <path d="M 295 235 L 585 300" stroke="#dc2626" stroke-width="1.4" marker-end="url(#arrow-red)"/>
                <path d="M 585 330 L 295 460" stroke="#16a34a" stroke-width="1.4" marker-end="url(#arrow-green)"/>
                <!-- E6 -> A7 (Vendor) -->
                <path d="M 810 325 L 855 555" stroke="#ea580c" stroke-width="1.2" stroke-dasharray="3 2" marker-end="url(#arrow-rea)"/>

                <!-- E7 (Kapitalisasi Aset): E7 -> R6 (Aset Tetap +) -->
                <path d="M 345 440 L 295 550" stroke="#16a34a" stroke-width="1.4" marker-end="url(#arrow-green)"/>
                <!-- E7 -> A4 (PIC Aset) -->
                <path d="M 570 425 L 855 330" stroke="#f59e0b" stroke-width="1.2" stroke-dasharray="3 2" marker-end="url(#arrow-rea)"/>
            </svg>
        </div>

        <div class="callout callout-green" style="margin-top: 4pt;">
            <div class="callout-title">Penjelasan Alur Keterkaitan REA:</div>
            Garis hijau solid menunjukkan <em>Inflow Stockflow</em> (penambahan sumber daya kas/aset), garis merah solid menunjukkan <em>Outflow Stockflow</em> (pengurangan kas/penyerapan sumber daya), dan garis putus-putus oranye/amber menunjukkan <em>Participation</em> peran agen eksternal dan otorisasi internal.
        </div>

        <div class="page-footer">
            <span>Dokumentasi Arsitektur SIKAK Yayasan Umum</span>
            <span>Halaman 7</span>
        </div>
    </div>

    <!-- ==================== HALAMAN 8: ANALISIS SIKLUS REA 1 & 2 ==================== -->
    <div class="page">
        <div class="page-header">
            <span>SIKAK YAYASAN UMUM • DOKUMEN SPESIFIKASI ARSITEKTUR</span>
            <span>BAB IV: ANALISIS SIKLUS BISNIS REA (BAGIAN 1)</span>
        </div>

        <h2>BAB IV: ANALISIS SIKLUS BISNIS BERBASIS REA</h2>

        <!-- SIKLUS 1 -->
        <h3>4.1 Siklus Pendapatan Siswa & Distribusi Unit (Student Revenue Cycle)</h3>
        <p>
            Siklus pendapatan mencakup proses penetapan tarif komitmen iuran siswa, pencatatan hak tagih piutang, penerimaan kas pembayaran SPP/biaya pendidikan dari wali murid, hingga pembagian persentase hasil penerimaan secara otomatis ke rekening kas unit kerja dan kas pusat yayasan.
        </p>

        <div class="section-box">
            <h4 style="color: #166534; margin-bottom: 3pt;">Matriks Pemetaan REA: Siklus Pendapatan Siswa</h4>
            <table>
                <thead>
                    <tr>
                        <th style="width: 25%;">Komponen REA</th>
                        <th style="width: 35%;">Deskripsi Elemen</th>
                        <th style="width: 40%;">Implementasi Sistem & Tabel Database</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td><strong>Economic Resources</strong></td>
                        <td>
                            • <strong>R1:</strong> Kas & Bank Yayasan / Unit (Inflow)<br>
                            • <strong>R4:</strong> Piutang / Hak Tagih Iuran Siswa (Reduction)
                        </td>
                        <td>Saldo kas bertambah pada <code>accounts</code>; Piutang komitmen berkurang pada <code>StudentIncomeDetail</code>.</td>
                    </tr>
                    <tr>
                        <td><strong>Economic Events</strong></td>
                        <td>
                            • <strong>E1 (Commitment):</strong> Penetapan Tarif Iuran Siswa<br>
                            • <strong>E3 (Economic):</strong> Penerimaan Pembayaran SPP<br>
                            • <strong>Distribusi Otomatis:</strong> Alokasi Pembagian Kas %
                        </td>
                        <td>Pencatatan tarif per siswa pada <code>StudentIncomeDetail</code>; Aturan pembagian persentase pada <code>distribution_settings</code>.</td>
                    </tr>
                    <tr>
                        <td><strong>Agents Involved</strong></td>
                        <td>
                            • <strong>Internal Agent:</strong> Admin Unit / Kasir Satker (A3)<br>
                            • <strong>External Agent:</strong> Siswa & Orang Tua / Wali (A5)
                        </td>
                        <td>Wali murid melakukan transfer/setor tunai; Admin unit mengonfirmasi transaksi dan mencetak bukti kuitansi.</td>
                    </tr>
                    <tr>
                        <td><strong>Duality & Kontrol</strong></td>
                        <td>
                            <strong>Dualitas:</strong> Penyerahan Jasa Pendidikan dipertukarkan dengan Penerimaan Kas.<br>
                            <strong>Kontrol:</strong> Distribusi persentase terkunci di sistem sehingga unit tidak dapat memanipulasi porsi yayasan.
                        </td>
                        <td>Tabel <code>distribution_settings</code> mengunci persentase alokasi yayasan vs unit secara konsisten per tahun ajaran.</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <!-- SIKLUS 2 -->
        <h3 style="margin-top: 8pt;">4.2 Siklus Penganggaran, Permintaan, & Realisasi Belanja (Expenditure Cycle)</h3>
        <p>
            Siklus pengeluaran adalah jantung operasional keuangan yayasan. Menggunakan prinsip <em>Budgetary Control</em> ketat dengan 3 lapis gerbang persetujuan: RAB Tahunan &rarr; Permintaan Kas Bulanan (Request) &rarr; Pertanggungjawaban Realisasi Belanja (Report/SPJ Nota).
        </p>

        <div class="section-box">
            <h4 style="color: #1e40af; margin-bottom: 3pt;">Matriks Pemetaan REA: Siklus Pengeluaran & Belanja</h4>
            <table>
                <thead>
                    <tr>
                        <th style="width: 25%;">Komponen REA</th>
                        <th style="width: 35%;">Deskripsi Elemen</th>
                        <th style="width: 40%;">Implementasi Sistem & Tabel Database</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td><strong>Economic Resources</strong></td>
                        <td>
                            • <strong>R1:</strong> Kas Yayasan (Pusat) berkurang saat transfer<br>
                            • <strong>R2:</strong> Kas Operasional Unit berkurang saat belanja<br>
                            • <strong>R5:</strong> Barang Habis Pakai / Jasa diperoleh
                        </td>
                        <td>Pengurangan saldo pada <code>accounts</code>; Penyerapan pagu belanja pada pos <code>expense_items</code>.</td>
                    </tr>
                    <tr>
                        <td><strong>Economic Events</strong></td>
                        <td>
                            • <strong>E1:</strong> Penetapan RAB Plafon Belanja Unit<br>
                            • <strong>E2:</strong> Pengajuan Permintaan Dana (Request)<br>
                            • <strong>E5:</strong> Penyaluran Kas Pusat ke Unit<br>
                            • <strong>E6:</strong> Realisasi Belanja & SPJ Nota (Report)
                        </td>
                        <td>Data usulan pada <code>rab_plans</code>; Pengajuan pada <code>budget_requests</code>; SPJ fisik pada <code>budget_reports</code>; Jurnal pada <code>journals</code>.</td>
                    </tr>
                    <tr>
                        <td><strong>Agents Involved</strong></td>
                        <td>
                            • <strong>Internal Initiator:</strong> Admin Unit / Kepsek (A3)<br>
                            • <strong>Internal Approver:</strong> Pengurus / Superadmin (A1)<br>
                            • <strong>Internal Treasury:</strong> Bendahara Yayasan (A2)<br>
                            • <strong>External Agent:</strong> Toko / Vendor / Penyedia Jasa (A7)
                        </td>
                        <td>Pemisahan tugas (segregation of duties): Pemohon (Unit) tidak dapat menyetujui anggarannya sendiri; Bendahara hanya mencairkan atas izin Superadmin.</td>
                    </tr>
                    <tr>
                        <td><strong>Duality & Kontrol</strong></td>
                        <td>
                            <strong>Dualitas:</strong> Penyerahan Kas Operasional dipertukarkan dengan Penerimaan Barang/Jasa Operasional.<br>
                            <strong>Kontrol:</strong> Validasi nota fisik (nomor nota, harga riil, volume, potongan harga) sebelum status disetujui.
                        </td>
                        <td>Kolom <code>nomorNota</code>, <code>volume</code>, <code>harga</code>, <code>diskon</code>, dan <code>buktiTeks</code> pada tabel <code>budget_reports</code>.</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div class="page-footer">
            <span>Dokumentasi Arsitektur SIKAK Yayasan Umum</span>
            <span>Halaman 8</span>
        </div>
    </div>

    <!-- ==================== HALAMAN 9: ANALISIS SIKLUS REA 3 & 4 ==================== -->
    <div class="page">
        <div class="page-header">
            <span>SIKAK YAYASAN UMUM • DOKUMEN SPESIFIKASI ARSITEKTUR</span>
            <span>BAB IV: ANALISIS SIKLUS BISNIS REA (BAGIAN 2)</span>
        </div>

        <!-- SIKLUS 3 -->
        <h3>4.3 Siklus Bantuan Operasional Sekolah (BOS Grant Cycle)</h3>
        <p>
            Dana BOS merupakan dana transfer pemerintah dengan kepatuhan hukum ketat. Sistem memperlakukan dana BOS secara terisolasi (<em>Ring-Fenced Fund</em>) agar tidak tercampur dengan kas reguler yayasan, dengan alokasi terikat pada pos juknis nasional.
        </p>

        <div class="section-box">
            <h4 style="color: #6b21a8; margin-bottom: 3pt;">Matriks Pemetaan REA: Siklus Hibah Dana BOS</h4>
            <table>
                <thead>
                    <tr>
                        <th style="width: 25%;">Komponen REA</th>
                        <th style="width: 35%;">Deskripsi Elemen</th>
                        <th style="width: 40%;">Implementasi Sistem & Tabel Database</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td><strong>Economic Resources</strong></td>
                        <td>
                            • <strong>R3:</strong> Rekening Kas Khusus BOS (Inflow saat cair, Outflow saat dibelanjakan)<br>
                            • <strong>R5/R6:</strong> Buku K13/Merdeka, Alat Asesmen, ATK BOS
                        </td>
                        <td>Pencatatan alokasi kuota per unit pada <code>bos_allocations</code>; Monitoring saldo kas pada modul BOS Saldo.</td>
                    </tr>
                    <tr>
                        <td><strong>Economic Events</strong></td>
                        <td>
                            • <strong>Alokasi Pagu:</strong> Pembagian Kuota Pos Juknis BOS<br>
                            • <strong>E4 (Inflow):</strong> Pencairan Transfer BOS per Tahap<br>
                            • <strong>E8 (Outflow):</strong> Belanja Operasional Komponen BOS
                        </td>
                        <td>Tahapan pencairan pada <code>bos_stages</code>; Master pos juknis pada <code>bos_pos</code>; Pelaporan belanja BOS pada <code>budget_reports</code>.</td>
                    </tr>
                    <tr>
                        <td><strong>Agents Involved</strong></td>
                        <td>
                            • <strong>External Grantor:</strong> Pemerintah / Tim BOS Disdik (A6)<br>
                            • <strong>Internal Agent:</strong> Bendahara BOS Unit (A3) & Pengurus (A1)<br>
                            • <strong>External Vendor:</strong> Rekanan Penyedia Buku / Sarpras BOS (A7)
                        </td>
                        <td>Pemerintah mentransfer dana; Bendahara BOS unit membelanjakan sesuai juknis; Pengurus yayasan memantau konsolidasi saldo.</td>
                    </tr>
                    <tr>
                        <td><strong>Kepatuhan & Audit</strong></td>
                        <td>
                            <strong>Regulasi:</strong> Pengeluaran BOS harus 100% cocok dengan pos standar juknis dan tidak boleh mengalami defisit.<br>
                            <strong>Audit:</strong> Arsip pelaporan terpisah untuk kebutuhan audit BPK / Inspektorat Daerah.
                        </td>
                        <td>Isolasi data melalui flag <code>isBos: TRUE</code> pada <code>income_items</code> dan <code>expense_items</code>.</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <!-- SIKLUS 4 -->
        <h3 style="margin-top: 8pt;">4.4 Siklus Pengadaan & Kapitalisasi Aset Tetap (Conversion Cycle)</h3>
        <p>
            Siklus konversi aset mengotomatisasi transformasi belanja modal menjadi kartu inventaris aset tetap. Saat unit melaporkan belanja dengan indikator aset, sistem secara instan menerbitkan entitas aset tetap dengan jadwal depresiasi.
        </p>

        <div class="section-box">
            <h4 style="color: #9f1239; margin-bottom: 3pt;">Matriks Pemetaan REA: Siklus Konversi Aset Tetap</h4>
            <table>
                <thead>
                    <tr>
                        <th style="width: 25%;">Komponen REA</th>
                        <th style="width: 35%;">Deskripsi Elemen</th>
                        <th style="width: 40%;">Implementasi Sistem & Tabel Database</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td><strong>Economic Resources</strong></td>
                        <td>
                            • <strong>R2:</strong> Kas Unit berkurang sejumlah nilai pembelian<br>
                            • <strong>R6:</strong> Aset Tetap Fisik bertambah dalam neraca
                        </td>
                        <td>Pengurangan kas dicatat dalam jurnal; Penambahan nilai buku aset modal dicatat pada tabel <code>assets</code>.</td>
                    </tr>
                    <tr>
                        <td><strong>Economic Events</strong></td>
                        <td>
                            • <strong>E6 (Outflow):</strong> Belanja Pembelian Barang Inventaris<br>
                            • <strong>E7 (Conversion):</strong> Kapitalisasi Kartu Aset Tetap Baru<br>
                            • <strong>Depresiasi Berkala:</strong> Penyusutan Nilai Buku Bulanan
                        </td>
                        <td>Dokumen SPJ belanja pada <code>budget_reports</code>; Kartu aset pada <code>assets</code>; Kategori & umur ekonomis pada <code>asset_categories</code>.</td>
                    </tr>
                    <tr>
                        <td><strong>Agents Involved</strong></td>
                        <td>
                            • <strong>Purchaser:</strong> Admin Unit / Kepala Sekolah (A3)<br>
                            • <strong>Supplier:</strong> Vendor / Distributor Aset Tetap (A7)<br>
                            • <strong>Custodian:</strong> PIC Sarpras & Ruangan Unit (A4)
                        </td>
                        <td>Vendor mengirim barang fisik; Admin unit mengunggah nota; PIC sarpras bertanggung jawab atas pemeliharaan dan ruangan aset.</td>
                    </tr>
                    <tr>
                        <td><strong>Duality & Standar</strong></td>
                        <td>
                            <strong>Dualitas:</strong> Kas Unit ditukar dengan Kapasitas Produktif Aset Tetap Jangka Panjang.<br>
                            <strong>Standar Akuntansi:</strong> Nilai residu dan umur ekonomis mengacu pada standar PSAK / ISAK 35.
                        </td>
                        <td>Relasi langsung antara <code>BudgetReport.kategoriAset</code> dengan pembentukan row baru pada tabel <code>assets</code>.</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div class="page-footer">
            <span>Dokumentasi Arsitektur SIKAK Yayasan Umum</span>
            <span>Halaman 9</span>
        </div>
    </div>

    <!-- ==================== HALAMAN 10: MATRIKS INTEGRASI ERD VS REA ==================== -->
    <div class="page">
        <div class="page-header">
            <span>SIKAK YAYASAN UMUM • DOKUMEN SPESIFIKASI ARSITEKTUR</span>
            <span>BAB V: MATRIKS INTEGRASI ERD DENGAN MODEL REA</span>
        </div>

        <h2>BAB V: MATRIKS PEMETAAN TERINTEGRASI (ERD &harr; REA)</h2>
        <p style="font-size: 8pt; margin-bottom: 4pt;">
            Tabel berikut menunjukkan pemetaan komprehensif antara setiap tabel fisik dalam skema database relasional (ERD) dengan perannya dalam ontologi bisnis REA (Resources, Events, Agents, atau Relationship Table):
        </p>

        <table>
            <thead>
                <tr>
                    <th style="width: 18%;">Tabel Fisik Database</th>
                    <th style="width: 14%;">Klasifikasi REA</th>
                    <th style="width: 18%;">Identifikasi Elemen REA</th>
                    <th style="width: 18%;">Siklus Bisnis Utama</th>
                    <th style="width: 32%;">Fungsi Operasional & Tata Kelola Sistem</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><code>users</code></td>
                    <td><span class="badge badge-amber">Agent</span></td>
                    <td>Internal Agent (A1, A2, A3)</td>
                    <td>Semua Siklus</td>
                    <td>Autentikasi, otorisasi peran (RBAC), dan pembatasan lingkup unit kerja.</td>
                </tr>
                <tr>
                    <td><code>fields</code> & <code>units</code></td>
                    <td><span class="badge badge-slate">Structure</span></td>
                    <td>Enterprise Hierarchy</td>
                    <td>Semua Siklus</td>
                    <td>Struktur batas kepemilikan sumber daya dan pemisahan satker sekolah.</td>
                </tr>
                <tr>
                    <td><code>Student</code></td>
                    <td><span class="badge badge-amber">Agent</span></td>
                    <td>External Agent (A5)</td>
                    <td>Siklus Pendapatan</td>
                    <td>Basis data subjek siswa penerima layanan pendidikan yayasan.</td>
                </tr>
                <tr>
                    <td><code>StudentIncomeDetail</code></td>
                    <td><span class="badge badge-purple">Event / Claim</span></td>
                    <td>Commitment Event & Hak Tagih (R4)</td>
                    <td>Siklus Pendapatan</td>
                    <td>Kewajiban tagihan iuran yang dibebankan kepada siswa per item pendapatan.</td>
                </tr>
                <tr>
                    <td><code>income_items</code></td>
                    <td><span class="badge badge-slate">Resource Type</span></td>
                    <td>Klasifikasi Sumber Daya Masuk</td>
                    <td>Siklus Pendapatan & BOS</td>
                    <td>Katalog jenis penerimaan kas yayasan (SPP, BOS, Infaq, Pendaftaran).</td>
                </tr>
                <tr>
                    <td><code>distribution_settings</code></td>
                    <td><span class="badge badge-slate">Rule / Policy</span></td>
                    <td>Business Policy / Allocation</td>
                    <td>Siklus Pendapatan</td>
                    <td>Aturan pemisahan otomatis persentase bagi hasil penerimaan siswa.</td>
                </tr>
                <tr>
                    <td><code>expense_items</code></td>
                    <td><span class="badge badge-slate">Resource Type</span></td>
                    <td>Klasifikasi Pengeluaran (R5)</td>
                    <td>Siklus Pengeluaran</td>
                    <td>Pos anggaran belanja operasional dan belanja modal satuan kerja.</td>
                </tr>
                <tr>
                    <td><code>rab_plans</code></td>
                    <td><span class="badge badge-purple">Event</span></td>
                    <td>Commitment Event (E1)</td>
                    <td>Siklus Penganggaran</td>
                    <td>Penyusunan plafon batas belanja tahunan per unit dan persetujuan yayasan.</td>
                </tr>
                <tr>
                    <td><code>budget_requests</code></td>
                    <td><span class="badge badge-purple">Event</span></td>
                    <td>Commitment Event (E2)</td>
                    <td>Siklus Pengeluaran</td>
                    <td>Pengajuan permintaan pencairan likuiditas kas bulanan oleh unit satker.</td>
                </tr>
                <tr>
                    <td><code>budget_reports</code></td>
                    <td><span class="badge badge-blue">Event (Outflow)</span></td>
                    <td>Economic Outflow Event (E6)</td>
                    <td>Siklus Belanja & Aset</td>
                    <td>Pertanggungjawaban riil belanja (SPJ nota fisik) dan trigger posting jurnal.</td>
                </tr>
                <tr>
                    <td><code>bos_stages</code> & <code>bos_pos</code></td>
                    <td><span class="badge badge-slate">Structure</span></td>
                    <td>Katalog Hibah BOS</td>
                    <td>Siklus BOS</td>
                    <td>Struktur tahapan pencairan dan pos juknis nasional alokasi BOS.</td>
                </tr>
                <tr>
                    <td><code>bos_allocations</code></td>
                    <td><span class="badge badge-green">Resource / Event</span></td>
                    <td>Rekening BOS (R3) & Alokasi</td>
                    <td>Siklus BOS</td>
                    <td>Pagu dan realisasi penggunaan kas BOS terisolasi per unit sekolah.</td>
                </tr>
                <tr>
                    <td><code>assets</code></td>
                    <td><span class="badge badge-green">Resource</span></td>
                    <td>Aset Tetap Fisik (R6)</td>
                    <td>Siklus Konversi Aset</td>
                    <td>Register inventaris barang modal dengan harga perolehan dan penyusutan.</td>
                </tr>
                <tr>
                    <td><code>asset_categories</code></td>
                    <td><span class="badge badge-slate">Resource Type</span></td>
                    <td>Katalog Umur Ekonomis</td>
                    <td>Siklus Konversi Aset</td>
                    <td>Standarisasi masa manfaat dan metode depresiasi aset tetap.</td>
                </tr>
                <tr>
                    <td><code>contacts</code></td>
                    <td><span class="badge badge-amber">Agent</span></td>
                    <td>External Agent (A7, A8)</td>
                    <td>Belanja & Donasi</td>
                    <td>Daftar rekanan vendor, pemasok toko, donatur, dan penerima manfaat.</td>
                </tr>
                <tr>
                    <td><code>accounts</code></td>
                    <td><span class="badge badge-green">Resource / GL</span></td>
                    <td>General Ledger Master (R1, R2)</td>
                    <td>Siklus Akuntansi</td>
                    <td>Bagan Akun Standar (COA) untuk pelaporan posisi keuangan formal.</td>
                </tr>
                <tr>
                    <td><code>journals</code></td>
                    <td><span class="badge badge-purple">Event (Audit)</span></td>
                    <td>Double-Entry Recording (E10)</td>
                    <td>Siklus Akuntansi</td>
                    <td>Buku catatan akuntansi formal historis dengan pencatatan debit-kredit.</td>
                </tr>
                <tr>
                    <td><code>audit_logs</code></td>
                    <td><span class="badge badge-slate">Control / Meta</span></td>
                    <td>Internal Audit Trail</td>
                    <td>Semua Siklus</td>
                    <td>Pencatatan rekam jejak digital waktu, user, aksi, dan detail mutasi data.</td>
                </tr>
            </tbody>
        </table>

        <div class="callout callout-amber" style="margin-top: 6pt;">
            <div class="callout-title">Nilai Strategis Pemetaan Terintegrasi:</div>
            Dengan matriks pemetaan di atas, auditor sistem informasi dapat secara instan melakukan penelusuran (audit trail) dari angka laporan keuangan di neraca (<code>Account</code>) kembali ke peristiwa ekonomi riil (<code>BudgetReport</code>), bukti kuitansi toko (<code>nomorNota</code>), hingga ke agen yang menginput dan menyetujui transaksi (<code>User</code> & <code>AuditLog</code>).
        </div>

        <div class="page-footer">
            <span>Dokumentasi Arsitektur SIKAK Yayasan Umum</span>
            <span>Halaman 10</span>
        </div>
    </div>

    <!-- ==================== HALAMAN 11: KESIMPULAN & REKOMENDASI ==================== -->
    <div class="page">
        <div class="page-header">
            <span>SIKAK YAYASAN UMUM • DOKUMEN SPESIFIKASI ARSITEKTUR</span>
            <span>BAB VI: KESIMPULAN & REKOMENDASI ARSITEKTUR</span>
        </div>

        <h2>BAB VI: KESIMPULAN & REKOMENDASI PENGEMBANGAN</h2>

        <h3>6.1 Kesimpulan Arsitektural</h3>
        <p>
            Berdasarkan analisis pemodelan <strong>Entity Relationship Diagram (ERD)</strong> dan ontologi <strong>Resources, Events, Agents (REA)</strong> pada aplikasi SIKAK Yayasan Umum, dapat ditarik beberapa kesimpulan pokok:
        </p>
        <ol style="padding-left: 15pt; margin-top: 2pt;">
            <li style="margin-bottom: 4pt;">
                <strong>Harmonisasi Operasional dan Akuntansi:</strong> Sistem berhasil menjembatani kesenjangan antara kebutuhan operasional satker sekolah (pencatatan siswa, SPJ nota fisik, permintaan belanja harian) dengan kebutuhan standar akuntansi formal yayasan (ISAK 35 / PSAK 109) melalui penjurnalan otomatis berbasis peristiwa ekonomi riil.
            </li>
            <li style="margin-bottom: 4pt;">
                <strong>Pengendalian Anggaran Berlapis (Budgetary Enforcement):</strong> Integrasi antara <code>rab_plans</code>, <code>distribution_settings</code>, <code>budget_requests</code>, dan <code>budget_reports</code> memberikan perlindungan anti-defisit dan mencegah unit kerja membelanjakan dana melampaui plafon yang disahkan pengurus yayasan.
            </li>
            <li style="margin-bottom: 4pt;">
                <strong>Isolasi Akuntabilitas Dana Bantuan (BOS):</strong> Pemisahan alokasi BOS melalui pos juknis khusus dan flag <code>isBos</code> menjamin transparansi serta mempermudah pemeriksaan kepatuhan oleh instansi pemerintah pemeriksa.
            </li>
            <li style="margin-bottom: 4pt;">
                <strong>Otomatisasi Kapitalisasi Aset Tetap:</strong> Mekanisme transfer data langsung dari belanja nota yang memenuhi syarat kapitalisasi ke kartu inventaris aset tetap meminimalkan risiko aset tidak terdaftar atau hilang dari pencatatan neraca.
            </li>
        </ol>

        <h3 style="margin-top: 8pt;">6.2 Rekomendasi Penguatan Sistem Jangka Panjang</h3>
        <div class="grid-2">
            <div class="card" style="border-left: 3pt solid #2563eb;">
                <div class="card-header" style="color: #1e40af;">
                    <span>1. Optimasi Indexing & Partisi Basis Data</span>
                </div>
                <p style="font-size: 7.8pt; color: #475569; margin: 0;">
                    Disarankan menambahkan index komposit pada kolom-kolom transaksi berfrekuensi tinggi seperti <code>(unitId, academicYearId, status)</code> pada tabel <code>budget_reports</code> dan <code>budget_requests</code> untuk menjaga kecepatan query saat data mencapai ratusan ribu transaksi.
                </p>
            </div>
            <div class="card" style="border-left: 3pt solid #10b981;">
                <div class="card-header" style="color: #065f46;">
                    <span>2. Otomatisasi Depresiasi Aset Terjadwal</span>
                </div>
                <p style="font-size: 7.8pt; color: #475569; margin: 0;">
                    Mengembangkan cron job latar belakang bulanan untuk secara otomatis menghitung beban penyusutan aset tetap per unit kerja dan memposting jurnal amortisasi ke akun akumulasi penyusutan di buku besar.
                </p>
            </div>
            <div class="card" style="border-left: 3pt solid #f59e0b;">
                <div class="card-header" style="color: #92400e;">
                    <span>3. Integrasi Digital Signature Bukti SPJ</span>
                </div>
                <p style="font-size: 7.8pt; color: #475569; margin: 0;">
                    Menyematkan hash kriptografi (SHA-256) atau QR-Code digital signature pada setiap dokumen persetujuan pengajuan dana dan pelaporan nota fisik untuk menjamin integritas hukum berkas pelaporan.
                </p>
            </div>
            <div class="card" style="border-left: 3pt solid #7e22ce;">
                <div class="card-header" style="color: #6b21a8;">
                    <span>4. Dashboard Prediktif Ketersediaan Kas</span>
                </div>
                <p style="font-size: 7.8pt; color: #475569; margin: 0;">
                    Menambahkan modul proyeksi likuiditas kas berbasis tren historis pembayaran SPP siswa vs realisasi penyerapan belanja bulanan untuk mengantisipasi defisit musiman satker sekolah.
                </p>
            </div>
        </div>

        <div style="margin-top: 15mm; border-top: 1pt solid #cbd5e1; padding-top: 6mm;">
            <table style="width: 100%; border: none;">
                <tr style="background: none;">
                    <td style="width: 50%; border: none; text-align: center;">
                        <div style="font-size: 8pt; color: #64748b;">Disusun & Dianalisis Oleh:</div>
                        <div style="font-size: 9pt; font-weight: 700; color: #0f172a; margin-top: 15mm;">Tim Arsitektur Sistem & Rekayasa Perangkat Lunak</div>
                        <div style="font-size: 7.5pt; color: #64748b;">SIKAK YAYASAN UMUM</div>
                    </td>
                    <td style="width: 50%; border: none; text-align: center;">
                        <div style="font-size: 8pt; color: #64748b;">Disahkan & Diverifikasi Oleh:</div>
                        <div style="font-size: 9pt; font-weight: 700; color: #0f172a; margin-top: 15mm;">Pengurus Yayasan & Dewan Pengawas Keuangan</div>
                        <div style="font-size: 7.5pt; color: #64748b;">Bidang Keuangan & Akuntansi Kelembagaan</div>
                    </td>
                </tr>
            </table>
        </div>

        <div class="page-footer">
            <span>Dokumentasi Arsitektur SIKAK Yayasan Umum</span>
            <span>Halaman 11</span>
        </div>
    </div>

</body>
</html>`;

const docsDir = path.join('D:', 'SIKAK YAYASAN UMUM', 'docs');
const htmlPath = path.join(docsDir, 'dokumen_erd_rea.html');
const pdfPath = path.join(docsDir, 'ERD_dan_REA_SIKAK_Yayasan.pdf');

fs.writeFileSync(htmlPath, htmlContent, 'utf-8');
console.log('HTML documentation written to:', htmlPath);

// Chrome executable path
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

console.log('Invoking Chrome Headless to compile PDF...');
const { execFileSync } = require('child_process');

console.log('Invoking Chrome Headless to compile PDF...');
try {
    execFileSync(chromePath, [
        '--headless=new',
        '--disable-gpu',
        '--no-pdf-header-footer',
        `--print-to-pdf=${pdfPath}`,
        htmlPath
    ], { stdio: 'inherit' });

    if (fs.existsSync(pdfPath)) {
        const stats = fs.statSync(pdfPath);
        console.log(`Success! PDF file created at: ${pdfPath}`);
        console.log(`PDF File Size: ${(stats.size / 1024).toFixed(2)} KB`);
    } else {
        console.error('Error: PDF file was not found after execution.');
    }
} catch (err) {
    console.error('Error executing Chrome headless print-to-pdf:', err);
}

