import { AyamAnugrahReceipt, AyamReceiptLineItem } from '../types/index';
import { getTodayDateString } from '../data/defaults';

export interface ParseMarkdownResult {
  receipts: AyamAnugrahReceipt[];
  errors: string[];
  rawItemCount: number;
}

/**
 * Standard templates provided to the user in the UI
 */
export const MARKDOWN_SAMPLE_TABLE = `# REKAP HARIAN GUDANG AYAM ANUGERAH

| No | Pelanggan | Kode | Tanggal | Item | Detail Ekor | Bobot/Jumlah | Satuan | Harga | Status | Keterangan |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Ahmad | 70 e | 2026-11-02 | Ayam Gebrus | (70 ekor) | 126.6 | kg | 24500 | BELUM LUNAS | Pita Putih |
| 2 | Ahmad | 70 e | 2026-11-02 | Ati | | 70 | bj | 1500 | BELUM LUNAS | |
| 3 | Ahmad | 70 e | 2026-11-02 | Usus | | 5 | kg | 14000 | BELUM LUNAS | |
| 4 | Moris | #09 | 2026-11-02 | Ayam Gebrus | (30 ekor) | 50.6 | kg | 25500 | BELUM LUNAS | |
| 5 | Moris | #09 | 2026-11-02 | Ati | | 30 | bj | 1500 | BELUM LUNAS | |
| 6 | Moris | #09 | 2026-11-02 | Usus | | 5 | kg | 15000 | BELUM LUNAS | |
| 7 | Rio | #12 | 2026-11-02 | Ayam Gebrus | (60 ekor) | 102.4 | kg | 25500 | LUNAS | Transfer BCA |
| 8 | Rio | #12 | 2026-11-02 | Ati | | 50 | bj | 1500 | LUNAS | |
`;

export const MARKDOWN_SAMPLE_BLOCK = `# DAFTAR STRUK PENGIRIMAN AYAM

### Struk: Ahmad (70 e)
- Tanggal: 2026-11-02
- Status: BELUM LUNAS
- Keterangan: Pita Putih
- Pembayaran: kredit (tempo 7 hari)
- Barang:
  * Ayam Gebrus | 126.6 kg | @24500 | (70 ekor)
  * Ati | 70 bj | @1500
  * Usus | 5 kg | @14000

---

### Struk: Pak Ade (#11)
- Tanggal: 2026-11-02
- Status: LUNAS
- Keterangan: Langsung Lunas Kasir
- Pembayaran: tunai
- Barang:
  * Ayam Gebrus | 85.5 kg | @25000 | (45 ekor)
  * Ati | 40 bj | @1500
  * Usus | 4 kg | @14000

---

### Struk: Nanjung (#10)
- Tanggal: 2026-11-02
- Status: BELUM LUNAS
- Keterangan: Pita Merah
- Barang:
  * Ayam Gebrus | 69.5 kg | @25500 | (40 ekor)
  * Ati | 80 bj | @1500
  * Usus | 5 kg | @14000
`;

export const MARKDOWN_SAMPLE_SINGLE = `### Struk: Mang Asep (#08)
- Tanggal: 2026-11-02
- Status: BELUM LUNAS
- Keterangan: Pengiriman Subuh
- Barang:
  * Ayam Gebrus | 106.0 kg | @25000 | (65 ekor)
  * Ati | 70 bj | @1500
  * Usus | 3 kg | @14000
`;

/**
 * Clean numeric string from rupiah formatting, commas, points
 */
export function parseCleanNumber(val: any): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const str = String(val)
    .replace(/Rp|\s|@/gi, '')
    .trim();
  // Handle Indonesian thousand separator (dots) vs comma decimals
  // E.g. "25.000" -> 25000, "118.4" -> 118.4, "1.275.000" -> 1275000, "50,6" -> 50.6
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(str)) {
    // 25.000 or 1.275.000,50
    return parseFloat(str.replace(/\./g, '').replace(',', '.'));
  }
  if (/^\d+\.\d{3}$/.test(str)) {
    // Exactly 3 digits after single dot: e.g. "25.000" -> 25000, "1.500" -> 1500
    return parseFloat(str.replace('.', ''));
  }
  // Standard decimal like "118.4" or "50,6"
  const cleanStr = str.replace(',', '.');
  const num = parseFloat(cleanStr);
  return isNaN(num) ? 0 : num;
}

/**
 * Check if text contains polite footer lines (e.g. WhatsApp courtesy closers)
 */
function isCourtesyOrFooterLine(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes('mohon segera melakukan pembayaran') ||
    lower.includes('terima kasih atas kerjasamanya') ||
    lower.includes('terimakasih atas kerjasamanya') ||
    lower.includes('salam hangat') ||
    lower.includes('rekening bca') ||
    lower.includes('no rek') ||
    lower.includes('hormat kami') ||
    lower.includes('admin kasir')
  );
}

/**
 * Check if a cell contains a weight or quantity string
 */
function isWeightQuantityCell(cell: string): { isWeight: boolean; qty: number; unit: string } {
  const trimmed = cell.trim();
  // e.g. "118.4 kg", "118.4kg", "50.6 kg", "70 bj", "5 ekor"
  const match = trimmed.match(/^([\d.,]+)\s*(kg|kilo|gr|gram|bj|biji|ekor|e|ek)?$/i);
  if (match) {
    const num = parseCleanNumber(match[1]);
    const unit = match[2] ? match[2].toLowerCase() : (num > 0 && num < 1000 && !Number.isInteger(num) ? 'kg' : '');
    // If unit is kg/gr/bj or if it's a decimal number like 118.4, it's a weight
    if (match[2] || (!Number.isInteger(num) && num < 1000)) {
      return { isWeight: true, qty: num, unit: unit || 'kg' };
    }
  }
  return { isWeight: false, qty: 0, unit: '' };
}

/**
 * Check if a cell is an item price
 */
function isPriceCell(cell: string): { isPrice: boolean; price: number } {
  const trimmed = cell.trim();
  if (trimmed.startsWith('@') || trimmed.toUpperCase().startsWith('RP')) {
    const p = parseCleanNumber(trimmed);
    if (p > 0) return { isPrice: true, price: p };
  }
  // Number >= 1000 is typically a price in IDR poultry business (e.g. 1500 ati, 25000 ayam)
  const num = parseCleanNumber(trimmed);
  if (num >= 1000 && !trimmed.toLowerCase().includes('ekor') && !trimmed.toLowerCase().includes('kg')) {
    return { isPrice: true, price: num };
  }
  return { isPrice: false, price: 0 };
}

/**
 * Main parser entry point
 */
export function parseMarkdownToReceipts(markdown: string): ParseMarkdownResult {
  if (!markdown || !markdown.trim()) {
    return { receipts: [], errors: [], rawItemCount: 0 };
  }

  const lines = markdown
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !isCourtesyOrFooterLine(l));

  // Check if it contains markdown table
  const tableLines = lines.filter((l) => l.startsWith('|') && l.endsWith('|'));
  if (tableLines.length >= 1) {
    return parseMarkdownTable(tableLines);
  }

  // Otherwise, parse header/section blocks and freeform text
  return parseMarkdownBlocks(lines);
}

/**
 * Semantic Cell Classifier for Markdown Tables
 */
interface RowDataExtracted {
  customerName: string;
  customerCode: string;
  date: string;
  itemName: string;
  detailLabel: string;
  quantity: number;
  unit: string;
  price: number;
  total: number;
  status: 'BELUM LUNAS' | 'LUNAS';
  noteBox: string;
}

function parseRowCellsHeuristic(cells: string[], rowIndex: number): RowDataExtracted {
  let customerName = '';
  let customerCode = '';
  let date = getTodayDateString();
  let itemName = 'Ayam Gebrus';
  let detailLabel = '';
  let quantity = 0;
  let unit = 'kg';
  let price = 0;
  let total = 0;
  let status: 'BELUM LUNAS' | 'LUNAS' = 'BELUM LUNAS';
  let noteBox = '';

  const remainingCells: string[] = [];

  cells.forEach((cell, cIdx) => {
    const raw = cell.trim();
    if (!raw) return;

    // Check row number at index 0 (e.g. "1", "#1", "1.")
    if (cIdx === 0 && /^#?\d+\.?$/.test(raw)) {
      return;
    }

    // Check Date (e.g. 2026-11-02, 02/11/2026)
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw) || /^\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}$/.test(raw)) {
      date = raw;
      return;
    }

    // Check Status (LUNAS / BELUM LUNAS)
    const upper = raw.toUpperCase();
    if (upper === 'LUNAS' || upper === 'BELUM LUNAS' || upper === 'BELUM') {
      status = upper.includes('LUNAS') && !upper.includes('BELUM') ? 'LUNAS' : 'BELUM LUNAS';
      return;
    }

    // Check Customer Code (e.g. "#01", "#09", "#11", "70 e", "45 ekor", "INV-AA-...")
    if (/^#\w+$/.test(raw) || /^\d+\s*(e|ek|ekor)$/i.test(raw)) {
      customerCode = raw;
      return;
    }

    // Check Detail label (e.g. "(50 ekor)", "(70 e)", "(30 ekor)")
    if (/^\(\s*\d+\s*(ekor|e|bj|kg)?\s*\)$/i.test(raw)) {
      detailLabel = raw;
      return;
    }

    // Check Item Name (Ayam Gebrus, Ati, Usus, Fillet, Karkas)
    const lower = raw.toLowerCase();
    if (
      lower.includes('ayam') ||
      lower.includes('gebrus') ||
      lower.includes('ati') ||
      lower.includes('usus') ||
      lower.includes('fillet') ||
      lower.includes('karkas') ||
      lower.includes('ceker') ||
      lower.includes('sayap')
    ) {
      // Check if it also has detail inside (e.g. "Ayam Gebrus (50 ekor)")
      const parenInside = raw.match(/^(.*?)\s*(\(\s*\d+[^)]*\))$/);
      if (parenInside) {
        itemName = parenInside[1].trim();
        detailLabel = parenInside[2].trim();
      } else {
        itemName = raw;
      }
      return;
    }

    // Check Weight/Quantity with unit (e.g. "118.4 kg", "50.6 kg", "70 bj")
    const weightCheck = isWeightQuantityCell(raw);
    if (weightCheck.isWeight && quantity === 0) {
      quantity = weightCheck.qty;
      if (weightCheck.unit) unit = weightCheck.unit;
      return;
    }

    // Check Price (e.g. "25.000", "24500", "@25500", "Rp 25.000")
    const priceCheck = isPriceCell(raw);
    if (priceCheck.isPrice && price === 0) {
      price = priceCheck.price;
      return;
    }

    // Pure number checks: could be price, weight, or total
    const num = parseCleanNumber(raw);
    if (num > 0) {
      if (num >= 1000 && price === 0) {
        price = num;
        return;
      } else if (num < 1000 && quantity === 0) {
        quantity = num;
        return;
      } else if (num > 100000 && total === 0) {
        total = num;
        return;
      }
    }

    // Check Box / Note (e.g. "Pita Putih", "Pita Merah")
    if (lower.includes('pita') || lower.includes('box') || lower.includes('transfer') || lower.includes('tunai')) {
      noteBox = raw;
      return;
    }

    remainingCells.push(raw);
  });

  // Assign customerName from remaining text cells
  for (const str of remainingCells) {
    // Make sure str is not accidental numeric weight like "118.4 kg" or "25.000"
    const wCheck = isWeightQuantityCell(str);
    const pCheck = isPriceCell(str);
    if (wCheck.isWeight) {
      if (quantity === 0) {
        quantity = wCheck.qty;
        if (wCheck.unit) unit = wCheck.unit;
      }
      continue;
    }
    if (pCheck.isPrice) {
      if (price === 0) price = pCheck.price;
      continue;
    }

    if (!customerName && str.length > 1 && !/^\d+$/.test(str)) {
      customerName = str;
    } else if (!noteBox) {
      noteBox = str;
    }
  }

  // Fallback defaults
  if (!customerName) {
    if (customerCode) {
      customerName = `Pelanggan ${customerCode}`;
    } else {
      customerName = `Pelanggan #${rowIndex + 1}`;
    }
  }

  if (quantity === 0) {
    quantity = itemName.toLowerCase().includes('ati') ? 50 : 50.0;
  }
  if (!unit) {
    unit = itemName.toLowerCase().includes('ati') ? 'bj' : 'kg';
  }
  if (price === 0) {
    price = itemName.toLowerCase().includes('ati') ? 1500 : 25500;
  }
  if (total === 0) {
    total = Math.round(quantity * price);
  }

  return {
    customerName,
    customerCode,
    date,
    itemName,
    detailLabel,
    quantity,
    unit,
    price,
    total,
    status,
    noteBox,
  };
}

/**
 * Parser for Markdown Tables:
 * | Pelanggan | Kode | Tanggal | Item | Detail | Bobot | Satuan | Harga | Status | Ket |
 */
function parseMarkdownTable(tableLines: string[]): ParseMarkdownResult {
  const errors: string[] = [];
  let rawItemCount = 0;

  const splitRow = (rowStr: string): string[] => {
    return rowStr
      .split('|')
      .slice(1, -1)
      .map((c) => c.trim());
  };

  // Determine if tableLines[0] is header row
  const firstRowRaw = tableLines[0].toLowerCase();
  const isHeaderRow =
    (tableLines.length > 1 && tableLines[1].replace(/[\s|:-]/g, '').length === 0) ||
    firstRowRaw.includes('pelanggan') ||
    firstRowRaw.includes('customer') ||
    firstRowRaw.includes('barang') ||
    firstRowRaw.includes('bobot') ||
    firstRowRaw.includes('harga') ||
    firstRowRaw.includes('item');

  let startIndex = 0;
  if (isHeaderRow) {
    startIndex = 1;
    // Check if line 1 is delimiter (|---|...)
    if (tableLines.length > 1 && tableLines[1].replace(/[\s|:-]/g, '').length === 0) {
      startIndex = 2;
    }
  }

  const groupedReceipts: Map<
    string,
    {
      customerName: string;
      customerCode: string;
      date: string;
      noteBox: string;
      status: 'BELUM LUNAS' | 'LUNAS';
      items: AyamReceiptLineItem[];
    }
  > = new Map();

  for (let i = startIndex; i < tableLines.length; i++) {
    const rawLine = tableLines[i];
    if (rawLine.replace(/[\s|:-]/g, '').length === 0) {
      continue; // Skip delimiter row
    }

    const cells = splitRow(rawLine);
    if (cells.length === 0) continue;

    const rowData = parseRowCellsHeuristic(cells, i - startIndex);

    const lineItem: AyamReceiptLineItem = {
      name: rowData.itemName,
      detailLabel: rowData.detailLabel ? (rowData.detailLabel.startsWith('(') ? rowData.detailLabel : `(${rowData.detailLabel})`) : '',
      quantity: rowData.quantity,
      unit: rowData.unit,
      price: rowData.price,
      total: rowData.total,
    };

    rawItemCount += 1;

    const groupKey = `${rowData.customerName.toLowerCase()}___${rowData.customerCode.toLowerCase()}___${rowData.date}`;

    if (!groupedReceipts.has(groupKey)) {
      groupedReceipts.set(groupKey, {
        customerName: rowData.customerName,
        customerCode: rowData.customerCode,
        date: rowData.date,
        noteBox: rowData.noteBox,
        status: rowData.status,
        items: [lineItem],
      });
    } else {
      const existing = groupedReceipts.get(groupKey)!;
      existing.items.push(lineItem);
      if (rowData.noteBox && !existing.noteBox) existing.noteBox = rowData.noteBox;
    }
  }

  // Convert map to AyamAnugrahReceipt array
  const receipts: AyamAnugrahReceipt[] = [];
  let receiptSeq = 1;

  groupedReceipts.forEach((g) => {
    const totalAmount = g.items.reduce((s, it) => s + it.total, 0);
    const receipt: AyamAnugrahReceipt = {
      id: `rcp_md_${Date.now()}_${receiptSeq}_${Math.random().toString(36).substring(2, 6)}`,
      userId: 'guest',
      receiptNumber: `INV-AA-${String(Date.now()).slice(-4)}-${receiptSeq}`,
      date: g.date,
      time: '00:57:55',
      customerName: g.customerName,
      customerCode: g.customerCode || `#${String(receiptSeq).padStart(2, '0')}`,
      noteBox: g.noteBox,
      items: g.items,
      totalAmount,
      status: g.status,
      paymentType: 'kredit',
      dueDate: '09/11/2026',
      remainingDebt: g.status === 'LUNAS' ? 0 : totalAmount,
      paidAmount: g.status === 'LUNAS' ? totalAmount : 0,
      historyDate: '02/11/2026',
      storeHeaderName: 'aa anugrah',
      storePhone: '085735144958',
      storeHandle: '@@ anugrah',
      createdAt: new Date().toISOString(),
    };
    receipts.push(receipt);
    receiptSeq += 1;
  });

  return { receipts, errors, rawItemCount };
}

/**
 * Parser for Markdown Section Blocks & Freeform Lines:
 * ### Struk: Ahmad (70 e)
 * or 1. Ahmad (#01): 118.4 kg @ 25.000 (50 ekor)
 */
function parseMarkdownBlocks(lines: string[]): ParseMarkdownResult {
  const errors: string[] = [];
  const receipts: AyamAnugrahReceipt[] = [];
  let rawItemCount = 0;

  let currentBlock: {
    customerName: string;
    customerCode: string;
    date: string;
    noteBox: string;
    status: 'BELUM LUNAS' | 'LUNAS';
    paymentType: string;
    dueDate: string;
    items: AyamReceiptLineItem[];
  } | null = null;

  const flushCurrentBlock = () => {
    if (!currentBlock) return;
    if (currentBlock.items.length === 0) {
      currentBlock.items.push({
        name: 'Ayam Gebrus',
        detailLabel: currentBlock.customerCode ? `(${currentBlock.customerCode})` : '',
        quantity: 50.0,
        unit: 'kg',
        price: 25500,
        total: 1275000,
      });
      rawItemCount += 1;
    }

    const totalAmount = currentBlock.items.reduce((s, it) => s + it.total, 0);
    const receipt: AyamAnugrahReceipt = {
      id: `rcp_md_${Date.now()}_${receipts.length + 1}_${Math.random().toString(36).substring(2, 6)}`,
      userId: 'guest',
      receiptNumber: `INV-AA-${String(Date.now()).slice(-4)}-${receipts.length + 1}`,
      date: currentBlock.date || getTodayDateString(),
      time: '00:57:55',
      customerName: currentBlock.customerName,
      customerCode: currentBlock.customerCode,
      noteBox: currentBlock.noteBox,
      items: currentBlock.items,
      totalAmount,
      status: currentBlock.status,
      paymentType: currentBlock.paymentType || 'kredit',
      dueDate: currentBlock.dueDate || '09/11/2026',
      remainingDebt: currentBlock.status === 'LUNAS' ? 0 : totalAmount,
      paidAmount: currentBlock.status === 'LUNAS' ? totalAmount : 0,
      historyDate: '02/11/2026',
      storeHeaderName: 'aa anugrah',
      storePhone: '085735144958',
      storeHandle: '@@ anugrah',
      createdAt: new Date().toISOString(),
    };
    receipts.push(receipt);
    currentBlock = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line || isCourtesyOrFooterLine(line)) continue;

    // Check heading or numbered item:
    // "### Struk: Ahmad (70 e)", "# Ahmad #01", or "1. Ahmad (#01)"
    const headingMatch = line.match(/^(?:#{1,4}\s*|\d+\.\s+)(?:struk:?|tagihan:?|bon:?)?\s*(.+)$/i);
    if (headingMatch) {
      const rawTitle = headingMatch[1].trim();

      // Check if this line actually contains full transaction item:
      // e.g. "1. Ahmad: 118.4 kg @ 25.000 (50 ekor)"
      const fullInlineMatch = rawTitle.match(/^(.*?)(?::\s*|\s+-\s+)(.*)$/);
      if (fullInlineMatch) {
        flushCurrentBlock();
        const custPart = fullInlineMatch[1].trim();
        const itemPart = fullInlineMatch[2].trim();

        let custName = custPart;
        let custCode = '';
        const codeMatch = custPart.match(/^(.*?)\s*[\(\[]?([#\d]+\s*[a-zA-Z]*)[\)\]]?$/);
        if (codeMatch && codeMatch[2]) {
          custName = codeMatch[1].trim() || `Pelanggan ${codeMatch[2]}`;
          custCode = codeMatch[2].trim();
        }

        // Parse itemPart
        const wCheck = isWeightQuantityCell(itemPart);
        const pCheck = isPriceCell(itemPart);
        const quantity = wCheck.isWeight ? wCheck.qty : 50;
        const unit = wCheck.unit || 'kg';
        const price = pCheck.isPrice ? pCheck.price : 25500;

        currentBlock = {
          customerName: custName || `Pelanggan #${receipts.length + 1}`,
          customerCode: custCode || `#${String(receipts.length + 1).padStart(2, '0')}`,
          date: getTodayDateString(),
          noteBox: '',
          status: 'BELUM LUNAS',
          paymentType: 'kredit',
          dueDate: '09/11/2026',
          items: [
            {
              name: 'Ayam Gebrus',
              detailLabel: '',
              quantity,
              unit,
              price,
              total: Math.round(quantity * price),
            },
          ],
        };
        rawItemCount += 1;
        continue;
      }

      // Check if rawTitle is just customer title:
      // "Ahmad (70 e)" -> name="Ahmad", code="70 e"
      // or "118.4 kg #01" -> weight="118.4 kg", code="#01"
      flushCurrentBlock();
      let customerName = rawTitle;
      let customerCode = '';

      const wCheckTitle = isWeightQuantityCell(rawTitle);
      if (wCheckTitle.isWeight) {
        // It's a weight in title: e.g. "118.4 kg #01"
        const hashMatch = rawTitle.match(/(#\w+|\d+\s*e)/i);
        customerCode = hashMatch ? hashMatch[1] : `#${receipts.length + 1}`;
        customerName = `Pelanggan ${customerCode}`;
      } else {
        const parenMatch = rawTitle.match(/^(.*?)\s*[\(\[]([^()\[\]]+)[\)\]]/);
        if (parenMatch) {
          customerName = parenMatch[1].trim();
          customerCode = parenMatch[2].trim();
        } else {
          const hashMatch = rawTitle.match(/^(.*?)\s*(#\w+)/);
          if (hashMatch) {
            customerName = hashMatch[1].trim();
            customerCode = hashMatch[2].trim();
          }
        }
      }

      currentBlock = {
        customerName: customerName || `Pelanggan #${receipts.length + 1}`,
        customerCode,
        date: getTodayDateString(),
        noteBox: '',
        status: 'BELUM LUNAS',
        paymentType: 'kredit',
        dueDate: '09/11/2026',
        items: [],
      };
      continue;
    }

    // Customer name prefix: "Pelanggan: Ahmad"
    const customerPrefixMatch = line.match(/^(?:-\s*)?(?:pelanggan|nama|customer)\s*:\s*(.+)$/i);
    if (customerPrefixMatch) {
      if (!currentBlock || currentBlock.customerName.startsWith('Pelanggan #')) {
        flushCurrentBlock();
        currentBlock = {
          customerName: customerPrefixMatch[1].trim(),
          customerCode: '',
          date: getTodayDateString(),
          noteBox: '',
          status: 'BELUM LUNAS',
          paymentType: 'kredit',
          dueDate: '09/11/2026',
          items: [],
        };
      } else {
        currentBlock.customerName = customerPrefixMatch[1].trim();
      }
      continue;
    }

    if (!currentBlock) {
      currentBlock = {
        customerName: `Pelanggan #${receipts.length + 1}`,
        customerCode: `#${String(receipts.length + 1).padStart(2, '0')}`,
        date: getTodayDateString(),
        noteBox: '',
        status: 'BELUM LUNAS',
        paymentType: 'kredit',
        dueDate: '09/11/2026',
        items: [],
      };
    }

    // Metadata lines:
    // "- Tanggal: 2026-11-02"
    const dateMatch = line.match(/^(?:-\s*)?(?:tanggal|tgl|date)\s*:\s*(.+)$/i);
    if (dateMatch) {
      currentBlock.date = dateMatch[1].trim();
      continue;
    }

    // "- Kode: 70 e"
    const codeMatch = line.match(/^(?:-\s*)?(?:kode|no urut|ekor)\s*:\s*(.+)$/i);
    if (codeMatch) {
      currentBlock.customerCode = codeMatch[1].trim();
      continue;
    }

    // "- Status: LUNAS / BELUM LUNAS"
    const statusMatch = line.match(/^(?:-\s*)?(?:status|pembayaran)\s*:\s*(.+)$/i);
    if (statusMatch) {
      const val = statusMatch[1].toUpperCase();
      currentBlock.status = val.includes('LUNAS') && !val.includes('BELUM') ? 'LUNAS' : 'BELUM LUNAS';
      continue;
    }

    // Line item with pipes or bullets:
    // "* Ayam Gebrus | 126.6 kg | @24500 | (70 ekor)"
    // or "- 118.4 kg x 25.000 Ayam Gebrus"
    if (line.startsWith('*') || line.startsWith('-') || line.startsWith('•') || line.includes('|')) {
      const cleanedLine = line.replace(/^[\*\-•]\s*/, '').trim();
      if (cleanedLine.toLowerCase().startsWith('barang:') || cleanedLine.toLowerCase().startsWith('items:')) {
        continue;
      }

      if (cleanedLine.includes('|')) {
        const parts = cleanedLine.split('|').map((p) => p.trim());
        const rowData = parseRowCellsHeuristic(parts, receipts.length);
        currentBlock.items.push({
          name: rowData.itemName,
          detailLabel: rowData.detailLabel,
          quantity: rowData.quantity,
          unit: rowData.unit,
          price: rowData.price,
          total: rowData.total,
        });
        rawItemCount += 1;
        continue;
      }

      // Format: "126.6 kg x 24500 Ayam Gebrus (70 e)"
      const multiMatch = cleanedLine.match(/([\d.,]+)\s*([a-zA-Z]*)\s*[xX*@]\s*([\d.,]+)\s*(.*)/);
      if (multiMatch) {
        const quantity = parseCleanNumber(multiMatch[1]);
        const unit = multiMatch[2] ? multiMatch[2].toLowerCase() : 'kg';
        const price = parseCleanNumber(multiMatch[3]);
        const nameAndDetail = multiMatch[4].trim();

        currentBlock.items.push({
          name: nameAndDetail || 'Ayam Gebrus',
          detailLabel: '',
          quantity,
          unit: unit || 'kg',
          price,
          total: Math.round(quantity * price),
        });
        rawItemCount += 1;
        continue;
      }
    }
  }

  flushCurrentBlock();
  return { receipts, errors, rawItemCount };
}
