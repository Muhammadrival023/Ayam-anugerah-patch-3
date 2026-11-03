import * as XLSX from 'xlsx';
import { AyamAnugrahReceipt, AyamReceiptLineItem, PoultryInvoiceItem } from '../types/index';
import { formatAngkaIndo, getTodayDateString } from '../data/defaults';

export interface ParsedWarehouseRow {
  no: number;
  customerName: string;
  customerCode?: string;
  ekor: number;
  ayamKg: number;
  ayamPrice: number;
  ayamTotal: number;
  atiBiji: number;
  atiPrice: number;
  atiTotal: number;
  ususKg: number;
  ususPrice: number;
  ususTotal: number;
  grandTotal: number;
  keterangan: string;
  status: 'BELUM LUNAS' | 'LUNAS';
}

export interface ParsedWarehouseImportResult {
  fileName: string;
  detectedDate: string;
  isGoogleSheetFormat: boolean;
  rows: ParsedWarehouseRow[];
  receipts: AyamAnugrahReceipt[];
  invoiceItems: PoultryInvoiceItem[];
  totals: {
    totalCustomers: number;
    totalEkor: number;
    totalAyamKg: number;
    totalAyamTotal: number;
    totalAtiBiji: number;
    totalAtiTotal: number;
    totalUsusKg: number;
    totalUsusTotal: number;
    grandTotal: number;
  };
}

/**
 * Robust parser for Excel (.xlsx, .xls) and CSV files.
 * Automatically recognizes:
 * 1. "DATA HARIAN GUDANG - AYAM @ ANUGRAH" multi-column layout from Google Sheets
 * 2. Flat tabular poultry sales spreadsheets
 */
function parseNumeric(val: any): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  let str = String(val).trim().replace(/^Rp\.?\s*/i, '');
  // Format 1.234,50 or 1,234.50
  if (str.includes(',') && str.includes('.')) {
    if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
      // European / Indo format: 1.234,50
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      // US format: 1,234.50
      str = str.replace(/,/g, '');
    }
  } else if (str.includes(',')) {
    // Check if comma is decimal or thousands
    if (/^\d+,\d{1,2}$/.test(str)) {
      str = str.replace(',', '.');
    } else {
      str = str.replace(/,/g, '');
    }
  }
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

/**
 * Robust parser for Excel (.xlsx, .xls) and CSV files.
 * Automatically recognizes:
 * 1. "DATA HARIAN GUDANG - AYAM @ ANUGRAH" multi-column layout from Google Sheets
 * 2. Flat tabular poultry sales spreadsheets
 * 3. App export CSV / XLSX
 */
export async function parseWarehouseExcelFile(file: File): Promise<ParsedWarehouseImportResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });

        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          throw new Error('File tidak memiliki lembar kerja (worksheet).');
        }

        // Select the sheet with the most data
        let bestSheet = workbook.Sheets[workbook.SheetNames[0]];
        let bestAoa: any[][] = XLSX.utils.sheet_to_json(bestSheet, { header: 1, defval: '' });

        for (const sName of workbook.SheetNames) {
          const ws = workbook.Sheets[sName];
          const testAoa: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
          if (testAoa && testAoa.length > bestAoa.length) {
            bestAoa = testAoa;
            bestSheet = ws;
          }
        }

        const aoa = bestAoa;
        if (!aoa || aoa.length === 0) {
          throw new Error('File Excel kosong atau tidak terbaca.');
        }

        // 1. Detect Date if present in top rows
        let detectedDate = '';
        let isGoogleSheetFormat = false;

        for (let i = 0; i < Math.min(15, aoa.length); i++) {
          const rowStr = (aoa[i] || []).join(' ').toUpperCase();
          if (
            rowStr.includes('DATA HARIAN GUDANG') ||
            rowStr.includes('AYAM @ ANUGRAH') ||
            rowStr.includes('AYAM  @ ANUGRAH') ||
            rowStr.includes('GUDANG')
          ) {
            isGoogleSheetFormat = true;
          }
          const dateMatch = rowStr.match(/TANGGAL\s*[:=]\s*([^\r\n,;]+)/i);
          if (dateMatch) {
            detectedDate = dateMatch[1].trim();
          }
        }

        if (!detectedDate) {
          detectedDate = '01 Nov 2026';
        }

        // 2. Find Table Header Row dynamically
        let headerRowIdx = -1;
        for (let r = 0; r < Math.min(25, aoa.length); r++) {
          const row = (aoa[r] || []).map((c) => String(c ?? '').trim().toUpperCase());
          const hasCustomer = row.some(
            (c) =>
              c === 'NAMA' ||
              c.includes('NAMA') ||
              c.includes('PELANGGAN') ||
              c.includes('CUSTOMER') ||
              c.includes('PEMBELI')
          );
          const hasItemInfo = row.some(
            (c) =>
              c === 'NO' ||
              c.startsWith('NO.') ||
              c.includes('EKOR') ||
              c.includes('AYAM') ||
              c.includes('KG') ||
              c.includes('HARGA') ||
              c.includes('JMLH') ||
              c.includes('JUMLAH')
          );

          if (hasCustomer && (hasItemInfo || row.filter(Boolean).length >= 2)) {
            headerRowIdx = r;
            break;
          }
        }

        if (headerRowIdx === -1) {
          headerRowIdx = isGoogleSheetFormat ? 6 : 0;
        }

        // 3. Check for sub-header row (e.g. Google Sheets 2-level header)
        const row1 = (aoa[headerRowIdx] || []).map((c) => String(c ?? '').trim());
        const row2 = (aoa[headerRowIdx + 1] || []).map((c) => String(c ?? '').trim());

        const isSubHeader = row2.some((c) => {
          const upper = c.toUpperCase();
          return (
            upper === 'BIJI' ||
            upper === 'KG' ||
            upper === 'HARGA' ||
            upper === 'JUMLAH' ||
            upper === 'KESELURUHAN' ||
            upper === '1' ||
            upper === '2'
          );
        });

        const startDataIdx = isSubHeader ? headerRowIdx + 2 : headerRowIdx + 1;

        // Build composite header array to match columns
        const maxCols = Math.max(row1.length, row2.length, 18);
        const compositeHeaders: string[] = [];
        for (let c = 0; c < maxCols; c++) {
          const h1 = (row1[c] || '').toUpperCase();
          const h2 = (row2[c] || '').toUpperCase();
          compositeHeaders.push(`${h1} ${h2}`.trim());
        }

        // 4. Map columns dynamically
        let colNo = 0;
        let colName = 1;
        let colEkor = 2;
        let colAyamKg = -1;
        let colAyamHarga = -1;
        let colAyamTotal = -1;
        let colAtiBiji = -1;
        let colAtiHarga = -1;
        let colAtiTotal = -1;
        let colUsusKg = -1;
        let colUsusHarga = -1;
        let colUsusTotal = -1;
        let colGrandTotal = -1;
        let colKeterangan = -1;

        // Dynamic mapping through compositeHeaders
        compositeHeaders.forEach((h, idx) => {
          if (colNo === 0 && (h.includes('NO') || h === 'NO')) colNo = idx;
          if ((h.includes('NAMA') || h.includes('PELANGGAN') || h.includes('CUSTOMER')) && colName === 1) colName = idx;
          if (h.includes('EKOR')) colEkor = idx;

          // Ayam Gebrus columns
          if ((h.includes('AYAM') && h.includes('KG')) || (h.includes('JMLH') && !h.includes('KESELURUHAN')) || h === 'KG' || h === 'BERAT') {
            if (colAyamKg === -1) colAyamKg = idx;
          }
          if ((h.includes('AYAM') && h.includes('HARGA')) || (h === 'HARGA' && colAyamHarga === -1 && idx > colName)) {
            if (colAyamHarga === -1) colAyamHarga = idx;
          }
          if ((h.includes('AYAM') && (h.includes('JUMLAH') || h.includes('TOTAL'))) || (h === 'JUMLAH' && colAyamTotal === -1 && idx > colName)) {
            if (colAyamTotal === -1) colAyamTotal = idx;
          }

          // Ati columns
          if (h.includes('ATI') || h.includes('BIJI')) {
            if (h.includes('HARGA')) {
              colAtiHarga = idx;
            } else if (h.includes('JUMLAH') || h.includes('TOTAL')) {
              colAtiTotal = idx;
            } else {
              colAtiBiji = idx;
            }
          }

          // Usus columns
          if (h.includes('USUS')) {
            if (h.includes('HARGA')) {
              colUsusHarga = idx;
            } else if (h.includes('JUMLAH') || h.includes('TOTAL')) {
              colUsusTotal = idx;
            } else {
              colUsusKg = idx;
            }
          }

          // Grand total
          if (h.includes('KESELURUHAN') || h.includes('TOTAL TAGIHAN') || h === 'GRAND TOTAL' || h === 'TOTAL') {
            colGrandTotal = idx;
          }

          // Keterangan / Note
          if (h.includes('KET') || h.includes('PITA') || h.includes('CATATAN')) {
            colKeterangan = idx;
          }
        });

        // Fallbacks for standard Google Sheet template layout
        if (colAyamKg === -1) colAyamKg = 7;
        if (colAyamHarga === -1) colAyamHarga = 8;
        if (colAyamTotal === -1) colAyamTotal = 9;
        if (colAtiBiji === -1) colAtiBiji = 10;
        if (colAtiHarga === -1) colAtiHarga = 11;
        if (colAtiTotal === -1) colAtiTotal = 12;
        if (colUsusKg === -1) colUsusKg = 13;
        if (colUsusHarga === -1) colUsusHarga = 14;
        if (colUsusTotal === -1) colUsusTotal = 15;
        if (colGrandTotal === -1) colGrandTotal = 16;
        if (colKeterangan === -1) colKeterangan = 17;

        // 5. Parse Data Rows
        const parsedRows: ParsedWarehouseRow[] = [];

        for (let i = startDataIdx; i < aoa.length; i++) {
          const r = aoa[i] || [];
          if (r.length === 0) continue;

          const rawName = String(r[colName] ?? '').trim();
          if (!rawName) continue;

          const upperName = rawName.toUpperCase();
          if (
            upperName === 'JUMLAH' ||
            upperName === 'TOTAL' ||
            upperName === 'REKAP' ||
            upperName === 'SUBTOTAL' ||
            upperName.startsWith('RATA') ||
            upperName.includes('KESELURUHAN')
          ) {
            continue;
          }

          const no = parseNumeric(r[colNo]) || parsedRows.length + 1;
          const ekor = parseNumeric(r[colEkor]) || 0;

          // If sub-weighings exist (crates 1, 2, 3, 4) and total kg is 0, sum them
          let ayamKg = parseNumeric(r[colAyamKg]);
          if (ayamKg === 0 && colAyamKg >= 7) {
            const sumSubWeights = [3, 4, 5, 6].reduce((s, col) => s + parseNumeric(r[col]), 0);
            if (sumSubWeights > 0) {
              ayamKg = sumSubWeights;
            }
          }

          let ayamHarga = parseNumeric(r[colAyamHarga]);
          let ayamTotal = parseNumeric(r[colAyamTotal]);

          if (ayamKg > 0 && ayamHarga === 0 && ayamTotal > 0) {
            ayamHarga = Math.round(ayamTotal / ayamKg);
          } else if (ayamKg > 0 && ayamHarga === 0) {
            ayamHarga = 25500;
          }
          if (ayamTotal === 0 && ayamKg > 0) {
            ayamTotal = Math.round(ayamKg * ayamHarga);
          }

          const atiBiji = parseNumeric(r[colAtiBiji]);
          let atiHarga = parseNumeric(r[colAtiHarga]);
          let atiTotal = parseNumeric(r[colAtiTotal]);
          if (atiBiji > 0 && atiHarga === 0) atiHarga = 1500;
          if (atiTotal === 0 && atiBiji > 0) atiTotal = Math.round(atiBiji * atiHarga);

          const ususKg = parseNumeric(r[colUsusKg]);
          let ususHarga = parseNumeric(r[colUsusHarga]);
          let ususTotal = parseNumeric(r[colUsusTotal]);
          if (ususKg > 0 && ususHarga === 0) ususHarga = 15000;
          if (ususTotal === 0 && ususKg > 0) ususTotal = Math.round(ususKg * ususHarga);

          let grandTotal = parseNumeric(r[colGrandTotal]);
          if (grandTotal === 0) {
            grandTotal = ayamTotal + atiTotal + ususTotal;
          }

          const rawKet = String(r[colKeterangan] ?? '').trim();
          const keterangan = rawKet.replace(/^ket:\s*/i, '').trim();

          parsedRows.push({
            no,
            customerName: rawName,
            customerCode: `#${String(no).padStart(2, '0')}`,
            ekor,
            ayamKg: Math.round(ayamKg * 10) / 10,
            ayamPrice: ayamHarga,
            ayamTotal,
            atiBiji,
            atiPrice: atiHarga,
            atiTotal,
            ususKg: Math.round(ususKg * 10) / 10,
            ususPrice: ususHarga,
            ususTotal,
            grandTotal,
            keterangan,
            status: 'BELUM LUNAS',
          });
        }

        if (parsedRows.length === 0) {
          throw new Error('Tidak ada baris data pelanggan yang valid ditemukan. Pastikan ada kolom nama pelanggan dan data penjualan.');
        }

        // 6. Convert to AyamAnugrahReceipt[] with clean fields (ZERO undefined!)
        const receipts: AyamAnugrahReceipt[] = parsedRows.map((r, idx) => {
          const items: AyamReceiptLineItem[] = [];

          if (r.ayamKg > 0) {
            items.push({
              name: 'Ayam Gebrus',
              detailLabel: r.ekor > 0 ? `(${r.ekor} ekor)` : '',
              quantity: r.ayamKg,
              unit: 'kg',
              price: r.ayamPrice,
              total: r.ayamTotal,
            });
          }

          if (r.atiBiji > 0) {
            items.push({
              name: 'Ati',
              detailLabel: '',
              quantity: r.atiBiji,
              unit: 'bj',
              price: r.atiPrice,
              total: r.atiTotal,
            });
          }

          if (r.ususKg > 0) {
            items.push({
              name: 'Usus',
              detailLabel: '',
              quantity: r.ususKg,
              unit: 'kg',
              price: r.ususPrice,
              total: r.ususTotal,
            });
          }

          if (items.length === 0) {
            items.push({
              name: 'Daging Ayam',
              detailLabel: '',
              quantity: r.ekor > 0 ? r.ekor : 1,
              unit: r.ekor > 0 ? 'ekor' : 'kg',
              price: r.grandTotal,
              total: r.grandTotal,
            });
          }

          const customerCode = r.customerCode || (r.ekor > 0 ? `${r.ekor} e` : `#${String(r.no).padStart(2, '0')}`);
          const noteBox = r.keterangan ? (r.keterangan.toLowerCase().startsWith('ket:') ? r.keterangan : `Ket: ${r.keterangan}`) : '';

          return {
            id: `rcp_imp_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
            userId: 'guest',
            receiptNumber: `INV-AA-${String(r.no).padStart(2, '0')}`,
            date: detectedDate,
            time: '00:57:55',
            customerName: r.customerName,
            customerCode,
            noteBox,
            items,
            totalAmount: r.grandTotal,
            status: r.status,
            paymentType: 'kredit',
            dueDate: '09/11/2026',
            remainingDebt: r.status === 'LUNAS' ? 0 : r.grandTotal,
            paidAmount: r.status === 'LUNAS' ? r.grandTotal : 0,
            historyDate: '02/11/2026',
            storeHeaderName: 'aa anugrah',
            storePhone: '085735144958',
            storeHandle: '@@ anugrah',
            createdAt: new Date().toISOString(),
          };
        });

        // Convert parsed rows to PoultryInvoiceItem[]
        const invoiceItems: PoultryInvoiceItem[] = parsedRows.map((r, i) => ({
          id: `inv_imp_${i + 1}_${Date.now()}`,
          date: getTodayDateString(),
          customerName: r.customerName,
          productName: 'Ayam Gebrus Broiler',
          weightKg: r.ayamKg || 50,
          pricePerKg: r.ayamPrice || 25500,
          totalAmount: r.grandTotal,
          paymentTerms: 'Tempo 7 Hari (1 Minggu)',
          dueDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
          notes: r.keterangan ? `[${r.keterangan}] ${r.ekor} ekor` : `${r.ekor} ekor`,
          status: 'unpaid',
        }));

        // Totals calculation
        const totalEkor = parsedRows.reduce((s, r) => s + r.ekor, 0);
        const totalAyamKg = Math.round(parsedRows.reduce((s, r) => s + r.ayamKg, 0) * 10) / 10;
        const totalAyamTotal = parsedRows.reduce((s, r) => s + r.ayamTotal, 0);
        const totalAtiBiji = parsedRows.reduce((s, r) => s + r.atiBiji, 0);
        const totalAtiTotal = parsedRows.reduce((s, r) => s + r.atiTotal, 0);
        const totalUsusKg = Math.round(parsedRows.reduce((s, r) => s + r.ususKg, 0) * 10) / 10;
        const totalUsusTotal = parsedRows.reduce((s, r) => s + r.ususTotal, 0);
        const grandTotal = parsedRows.reduce((s, r) => s + r.grandTotal, 0);

        resolve({
          fileName: file.name,
          detectedDate,
          isGoogleSheetFormat,
          rows: parsedRows,
          receipts,
          invoiceItems,
          totals: {
            totalCustomers: parsedRows.length,
            totalEkor,
            totalAyamKg,
            totalAyamTotal,
            totalAtiBiji,
            totalAtiTotal,
            totalUsusKg,
            totalUsusTotal,
            grandTotal,
          },
        });
      } catch (err: any) {
        reject(err);
      }
    };

    reader.onerror = () => reject(new Error('Gagal membaca file dari perangkat.'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Downloads official blank Excel template matching Google Sheet layout
 */
export function downloadWarehouseExcelTemplate(format: 'xlsx' | 'csv') {
  const wb = XLSX.utils.book_new();
  const dateStr = '1 November 2026';

  const emptyRow = () => new Array(18).fill('');

  const grid: any[][] = [];
  const r0 = emptyRow();
  r0[0] = 'DATA HARIAN GUDANG';
  grid.push(r0);

  const r1 = emptyRow();
  r1[0] = '"AYAM  @ ANUGRAH"';
  grid.push(r1);

  grid.push(emptyRow());
  grid.push(emptyRow());

  const r4 = emptyRow();
  r4[0] = `TANGGAL : ${dateStr}`;
  r4[1] = dateStr;
  grid.push(r4);

  grid.push(emptyRow());

  const r6 = emptyRow();
  r6[0] = 'NO';
  r6[1] = 'NAMA';
  r6[2] = 'EKOR';
  r6[3] = 'AYAM GEBRUS';
  r6[7] = 'JMLH';
  r6[8] = 'HARGA';
  r6[9] = 'JUMLAH';
  r6[10] = 'ATI';
  r6[12] = 'JUMLAH';
  r6[13] = 'USUS';
  r6[15] = 'JUMLAH';
  r6[16] = 'JUMLAH';
  r6[17] = 'KETERANGAN';
  grid.push(r6);

  const r7 = emptyRow();
  r7[10] = 'BIJI';
  r7[11] = 'HARGA';
  r7[13] = 'KG';
  r7[14] = 'HARGA';
  r7[16] = 'KESELURUHAN';
  grid.push(r7);

  // Pre-fill empty rows down to row 34 (1-based index)
  for (let r = 8; r < 34; r++) {
    grid.push(emptyRow());
  }

  const ws = XLSX.utils.aoa_to_sheet(grid);

  ws['!merges'] = [
    { s: { c: 0, r: 0 }, e: { c: 17, r: 0 } }, // A1:R1 DATA HARIAN GUDANG
    { s: { c: 0, r: 1 }, e: { c: 17, r: 1 } }, // A2:R2 AYAM @ ANUGRAH
    { s: { c: 0, r: 6 }, e: { c: 0, r: 7 } },   // A7:A8 NO
    { s: { c: 1, r: 6 }, e: { c: 1, r: 7 } },   // B7:B8 NAMA
    { s: { c: 2, r: 6 }, e: { c: 2, r: 7 } },   // C7:C8 EKOR
    { s: { c: 3, r: 6 }, e: { c: 6, r: 7 } },   // D7:G8 AYAM GEBRUS
    { s: { c: 7, r: 6 }, e: { c: 7, r: 7 } },   // H7:H8 JMLH
    { s: { c: 8, r: 6 }, e: { c: 8, r: 7 } },   // I7:I8 HARGA
    { s: { c: 9, r: 6 }, e: { c: 9, r: 7 } },   // J7:J8 JUMLAH
    { s: { c: 10, r: 6 }, e: { c: 11, r: 6 } }, // K7:L7 ATI
    { s: { c: 12, r: 6 }, e: { c: 12, r: 7 } }, // M7:M8 JUMLAH
    { s: { c: 13, r: 6 }, e: { c: 14, r: 6 } }, // N7:O7 USUS
    { s: { c: 15, r: 6 }, e: { c: 15, r: 7 } }, // P7:P8 JUMLAH
    { s: { c: 17, r: 6 }, e: { c: 17, r: 7 } }, // R7:R8 KETERANGAN
  ];

  ws['!cols'] = [
    { wch: 6 },  // A: NO
    { wch: 18 }, // B: NAMA
    { wch: 8 },  // C: EKOR
    { wch: 7 },  // D: AYAM GEBRUS slot 1
    { wch: 7 },  // E: slot 2
    { wch: 7 },  // F: slot 3
    { wch: 7 },  // G: slot 4
    { wch: 10 }, // H: JMLH (KG)
    { wch: 15 }, // I: HARGA
    { wch: 18 }, // J: JUMLAH
    { wch: 8 },  // K: ATI BIJI
    { wch: 13 }, // L: ATI HARGA
    { wch: 16 }, // M: ATI JUMLAH
    { wch: 8 },  // N: USUS KG
    { wch: 13 }, // O: USUS HARGA
    { wch: 16 }, // P: USUS JUMLAH
    { wch: 20 }, // Q: JUMLAH KESELURUHAN
    { wch: 18 }, // R: KETERANGAN
  ];

  // Authentic sample rows matching Google Sheets (Rows 9 to 13)
  const sampleRows = [
    {
      no: 1,
      nama: 'Ahmad',
      ekor: 70,
      crates: [39.5, 39.2, 39.7],
      ayamKg: 118.4,
      ayamHarga: 25000,
      atiBiji: 0,
      atiHarga: 1500,
      ususKg: 0,
      ususHarga: 15000,
      keterangan: 'Pita Putih',
    },
    {
      no: 2,
      nama: 'Moris',
      ekor: 50,
      crates: [42.1, 41.5],
      ayamKg: 83.6,
      ayamHarga: 25000,
      atiBiji: 50,
      atiHarga: 1500,
      ususKg: 5,
      ususHarga: 15000,
      keterangan: 'Pita Hitam',
    },
    {
      no: 3,
      nama: 'Pak Ade',
      ekor: 30,
      crates: [],
      ayamKg: 50.5,
      ayamHarga: 25500,
      atiBiji: 30,
      atiHarga: 1500,
      ususKg: 5,
      ususHarga: 15000,
      keterangan: 'Pita Putih',
    },
    {
      no: 4,
      nama: 'Nanjung',
      ekor: 40,
      crates: [],
      ayamKg: 67.2,
      ayamHarga: 25000,
      atiBiji: 0,
      atiHarga: 1500,
      ususKg: 0,
      ususHarga: 15000,
      keterangan: 'Pita Ungu',
    },
    {
      no: 5,
      nama: 'Rio',
      ekor: 25,
      crates: [],
      ayamKg: 41.8,
      ayamHarga: 25500,
      atiBiji: 25,
      atiHarga: 1500,
      ususKg: 3,
      ususHarga: 15000,
      keterangan: 'Lunas',
    },
  ];

  sampleRows.forEach((row, i) => {
    const r = 9 + i;
    ws['A' + r] = { t: 'n', v: row.no };
    ws['B' + r] = { t: 's', v: row.nama };
    ws['C' + r] = { t: 'n', v: row.ekor };

    if (row.crates.length > 0) {
      if (row.crates[0]) ws['D' + r] = { t: 'n', v: row.crates[0], z: '#,##0.0' };
      if (row.crates[1]) ws['E' + r] = { t: 'n', v: row.crates[1], z: '#,##0.0' };
      if (row.crates[2]) ws['F' + r] = { t: 'n', v: row.crates[2], z: '#,##0.0' };
      if (row.crates[3]) ws['G' + r] = { t: 'n', v: row.crates[3], z: '#,##0.0' };
      ws['H' + r] = { t: 'n', f: `SUM(D${r}:G${r})`, v: row.ayamKg, z: '#,##0.0' };
    } else {
      ws['H' + r] = { t: 'n', v: row.ayamKg, z: '#,##0.0' };
    }

    ws['I' + r] = { t: 'n', v: row.ayamHarga, z: '" Rp "#,##0.00' };
    ws['J' + r] = { t: 'n', f: `H${r}*I${r}`, v: row.ayamKg * row.ayamHarga, z: '" Rp "#,##0.00' };

    ws['K' + r] = { t: 'n', v: row.atiBiji };
    ws['L' + r] = { t: 'n', v: row.atiHarga, z: '" Rp "#,##0.00' };
    ws['M' + r] = { t: 'n', f: `K${r}*L${r}`, v: row.atiBiji * row.atiHarga, z: '" Rp "#,##0.00' };

    ws['N' + r] = { t: 'n', v: row.ususKg, z: '#,##0.0' };
    ws['O' + r] = { t: 'n', v: row.ususHarga, z: '" Rp "#,##0.00' };
    ws['P' + r] = { t: 'n', f: `N${r}*O${r}`, v: row.ususKg * row.ususHarga, z: '" Rp "#,##0.00' };

    ws['Q' + r] = {
      t: 'n',
      f: `J${r}+M${r}+P${r}`,
      v: (row.ayamKg * row.ayamHarga) + (row.atiBiji * row.atiHarga) + (row.ususKg * row.ususHarga),
      z: '" Rp "#,##0.00',
    };
    ws['R' + r] = { t: 's', v: row.keterangan };
  });

  // Pre-populate empty template rows with live formulas (Rows 14 to 30)
  for (let r = 14; r <= 30; r++) {
    ws['A' + r] = { t: 'n', v: r - 8 };
    ws['H' + r] = { t: 'n', f: `IF(SUM(D${r}:G${r})>0,SUM(D${r}:G${r}),"")`, z: '#,##0.0' };
    ws['J' + r] = { t: 'n', f: `IF(OR(H${r}="",I${r}=""),0,H${r}*I${r})`, v: 0, z: '" Rp "#,##0.00' };
    ws['M' + r] = { t: 'n', f: `IF(OR(K${r}="",L${r}=""),0,K${r}*L${r})`, v: 0, z: '" Rp "#,##0.00' };
    ws['P' + r] = { t: 'n', f: `IF(OR(N${r}="",O${r}=""),0,N${r}*O${r})`, v: 0, z: '" Rp "#,##0.00' };
    ws['Q' + r] = { t: 'n', f: `J${r}+M${r}+P${r}`, v: 0, z: '" Rp "#,##0.00' };
  }

  // Row 31: Rp - (matching Google Sheet placeholder before summary)
  ws['Q31'] = { t: 'n', v: 0, z: '" Rp "#,##0.00' };

  // Row 33: Summary Row with live SUM formulas
  const sumRow = 33;
  ws['B' + sumRow] = { t: 's', v: 'JUMLAH' };
  ws['C' + sumRow] = { t: 'n', f: 'SUM(C9:C30)', v: 215 };
  ws['D' + sumRow] = { t: 'n', f: 'SUM(D9:D30)', v: 81.6, z: '#,##0.0' };
  ws['E' + sumRow] = { t: 'n', f: 'SUM(E9:E30)', v: 80.7, z: '#,##0.0' };
  ws['F' + sumRow] = { t: 'n', f: 'SUM(F9:F30)', v: 39.7, z: '#,##0.0' };
  ws['G' + sumRow] = { t: 'n', f: 'SUM(G9:G30)', v: 0, z: '#,##0.0' };
  ws['H' + sumRow] = { t: 'n', f: 'SUM(H9:H30)', v: 361.5, z: '#,##0.0' };
  ws['J' + sumRow] = { t: 'n', f: 'SUM(J9:J30)', v: 9083650, z: '" Rp "#,##0.00' };
  ws['K' + sumRow] = { t: 'n', f: 'SUM(K9:K30)', v: 105 };
  ws['M' + sumRow] = { t: 'n', f: 'SUM(M9:M30)', v: 157500, z: '" Rp "#,##0.00' };
  ws['N' + sumRow] = { t: 'n', f: 'SUM(N9:N30)', v: 13, z: '#,##0.0' };
  ws['P' + sumRow] = { t: 'n', f: 'SUM(P9:P30)', v: 195000, z: '" Rp "#,##0.00' };
  ws['Q' + sumRow] = { t: 'n', f: 'SUM(Q9:Q30)', v: 9436150, z: '" Rp "#,##0.00' };

  ws['!ref'] = `A1:R${sumRow}`;

  XLSX.utils.book_append_sheet(wb, ws, 'Template Gudang');

  if (format === 'xlsx') {
    XLSX.writeFile(wb, 'Template_Excel_Gudang_Ayam_Anugrah.xlsx');
  } else {
    // Generate authentic CSV template with real formulas
    const lines = [
      'DATA HARIAN GUDANG,,,,,,,,,,,,,,,,,',
      '"""AYAM  @ ANUGRAH""",,,,,,,,,,,,,,,,,',
      ',,,,,,,,,,,,,,,,,',
      ',,,,,,,,,,,,,,,,,',
      `TANGGAL : ${dateStr},${dateStr},,,,,,,,,,,,,,,,`,
      ',,,,,,,,,,,,,,,,,',
      'NO,NAMA,EKOR,AYAM GEBRUS,,,,JMLH,HARGA,JUMLAH,ATI,,JUMLAH,USUS,,JUMLAH,JUMLAH,KETERANGAN',
      ',,,,,,,,,,BIJI,HARGA,,KG,HARGA,,KESELURUHAN,',
      '1,Ahmad,70,39.5,39.2,39.7,,=SUM(D9:G9),25000,=H9*I9,0,1500,=K9*L9,0,15000,=N9*O9,=J9+M9+P9,Pita Putih',
      '2,Moris,50,42.1,41.5,,,=SUM(D10:G10),25000,=H10*I10,50,1500,=K10*L10,5,15000,=N10*O10,=J10+M10+P10,Pita Hitam',
      '3,Pak Ade,30,,,,50.5,25500,=H11*I11,30,1500,=K11*L11,5,15000,=N11*O11,=J11+M11+P11,Pita Putih',
      '4,Nanjung,40,,,,67.2,25000,=H12*I12,0,1500,=K12*L12,0,15000,=N12*O12,=J12+M12+P12,Pita Ungu',
      '5,Rio,25,,,,41.8,25500,=H13*I13,25,1500,=K13*L13,3,15000,=N13*O13,=J13+M13+P13,Lunas',
    ];
    for (let r = 14; r <= 30; r++) {
      lines.push(`${r - 8},,,,,,,,=IF(OR(H${r}="",I${r}=""),0,H${r}*I${r}),,1500,=IF(OR(K${r}="",L${r}=""),0,K${r}*L${r}),,15000,=IF(OR(N${r}="",O${r}=""),0,N${r}*O${r}),=J${r}+M${r}+P${r},`);
    }
    lines.push(',,,,,,,,,,,,,,,,0,');
    lines.push(',,,,,,,,,,,,,,,,,');
    lines.push(',JUMLAH,=SUM(C9:C30),=SUM(D9:D30),=SUM(E9:E30),=SUM(F9:F30),=SUM(G9:G30),=SUM(H9:H30),,=SUM(J9:J30),=SUM(K9:K30),,=SUM(M9:M30),=SUM(N9:N30),,=SUM(P9:P30),=SUM(Q9:Q30),');

    const csv = '\uFEFF' + lines.join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Template_CSV_Gudang_Ayam_Anugrah.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
