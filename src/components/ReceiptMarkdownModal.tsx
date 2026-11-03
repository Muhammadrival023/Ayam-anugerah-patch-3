import React, { useState, useEffect, useMemo } from 'react';
import { AyamAnugrahReceipt } from '../types/index';
import { formatAngkaIndo, formatRupiah, getTodayDateString } from '../data/defaults';
import {
  parseMarkdownToReceipts,
  MARKDOWN_SAMPLE_TABLE,
  MARKDOWN_SAMPLE_BLOCK,
  MARKDOWN_SAMPLE_SINGLE,
} from '../utils/markdownReceiptParser';
import {
  X,
  FileCode,
  FileText,
  Sparkles,
  CheckCircle,
  AlertCircle,
  Copy,
  Check,
  RotateCcw,
  Plus,
  Receipt,
  Eye,
  Edit2,
  Trash2,
  Save,
  ArrowRight,
  RefreshCw,
  Table,
  Zap,
} from 'lucide-react';

interface ReceiptMarkdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (
    newReceipts: AyamAnugrahReceipt[],
    mode: 'replace' | 'append',
    syncToFinance: boolean
  ) => Promise<void>;
  onEditInSingleForm?: (receipt: AyamAnugrahReceipt) => void;
}

export const ReceiptMarkdownModal: React.FC<ReceiptMarkdownModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess,
  onEditInSingleForm,
}) => {
  const [markdownText, setMarkdownText] = useState(MARKDOWN_SAMPLE_TABLE);
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');
  const [syncToFinance, setSyncToFinance] = useState(true);
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [copiedTemplate, setCopiedTemplate] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Quick edit state inside modal
  const [editingReceiptIdx, setEditingReceiptIdx] = useState<number | null>(null);
  const [editCustomerName, setEditCustomerName] = useState('');
  const [editCustomerCode, setEditCustomerCode] = useState('');
  const [editQty, setEditQty] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editStatus, setEditStatus] = useState<'BELUM LUNAS' | 'LUNAS'>('BELUM LUNAS');

  // Clean error messages from raw JSON
  const cleanErrorMessage = (raw: string): string => {
    try {
      const obj = JSON.parse(raw);
      if (obj.error) {
        if (typeof obj.error === 'string') return cleanErrorMessage(obj.error);
        if (obj.error.message) {
          if (obj.error.code === 503 || obj.error.message.includes('high demand') || obj.error.status === 'UNAVAILABLE') {
            return 'Server AI Google sedang sibuk (503). Sistem otomatis mengalihkan ke Smart Parser Offline.';
          }
          if (obj.error.code === 429 || obj.error.message.includes('quota')) {
            return 'Batas kuota harian AI tercapai. Sistem otomatis menggunakan Smart Parser Offline.';
          }
          return obj.error.message;
        }
      }
    } catch {}
    if (raw.includes('503') || raw.includes('high demand') || raw.includes('UNAVAILABLE')) {
      return 'Server AI Google sedang sibuk (503). Sistem otomatis mengalihkan ke Smart Parser Offline.';
    }
    if (raw.includes('429') || raw.includes('quota')) {
      return 'Batas kuota AI tercapai. Sistem otomatis menggunakan Smart Parser Offline.';
    }
    return raw;
  };

  // Parse markdown client-side in real time
  const parseResult = useMemo(() => {
    return parseMarkdownToReceipts(markdownText);
  }, [markdownText]);

  const parsedReceipts = parseResult.receipts;
  const totalRupiah = parsedReceipts.reduce((sum, r) => sum + r.totalAmount, 0);

  // Reset or preset templates
  const handleApplyTemplate = (template: string) => {
    setMarkdownText(template);
    setAiError(null);
  };

  const handleCopyMarkdown = () => {
    navigator.clipboard.writeText(markdownText);
    setCopiedTemplate(true);
    setTimeout(() => setCopiedTemplate(false), 2000);
  };

  // Offline auto-formatter: converts whatever table or list into standard clean Markdown Table
  const handleAutoFormatOffline = () => {
    if (parsedReceipts.length === 0) return;
    let formatted = `# REKAP HARIAN GUDANG AYAM ANUGERAH\n\n`;
    formatted += `| No | Pelanggan | Kode | Tanggal | Item | Detail Ekor | Bobot/Jumlah | Satuan | Harga | Status | Keterangan |\n`;
    formatted += `|---|---|---|---|---|---|---|---|---|---|---|\n`;

    let rowIdx = 1;
    parsedReceipts.forEach((rcp) => {
      rcp.items.forEach((item) => {
        formatted += `| ${rowIdx} | ${rcp.customerName} | ${rcp.customerCode || '#--'} | ${rcp.date} | ${item.name} | ${item.detailLabel || ''} | ${item.quantity} | ${item.unit} | ${item.price} | ${rcp.status} | ${rcp.noteBox || ''} |\n`;
        rowIdx++;
      });
    });

    setMarkdownText(formatted);
    setAiError(null);
  };

  // AI-assisted parsing with automatic fallback
  const handleParseWithAi = async () => {
    if (!markdownText.trim()) return;
    setIsAiProcessing(true);
    setAiError(null);

    try {
      const res = await fetch('/api/ai/parse-markdown-receipts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markdownContent: markdownText }),
      });

      const json = await res.json();
      if (!res.ok || !json.success || !Array.isArray(json.data) || json.data.length === 0) {
        // Fallback to local smart parser if AI unavailable
        if (parsedReceipts.length > 0) {
          await onImportSuccess(parsedReceipts, importMode, syncToFinance);
          onClose();
          return;
        }
        throw new Error(json.error || 'Server AI tidak merespons, coba rapikan dengan tombol Offline.');
      }

      // Convert AI response to verified receipts
      const converted: AyamAnugrahReceipt[] = json.data.map((d: any, idx: number) => {
        const total =
          Number(d.totalAmount) ||
          (Array.isArray(d.items) ? d.items.reduce((s: number, it: any) => s + (Number(it.total) || 0), 0) : 0);
        const isLunas = String(d.status || '').toUpperCase().includes('LUNAS') && !String(d.status || '').toUpperCase().includes('BELUM');

        return {
          id: `rcp_md_ai_${Date.now()}_${idx + 1}_${Math.random().toString(36).substring(2, 6)}`,
          userId: 'guest',
          receiptNumber: `INV-AA-${String(Date.now()).slice(-4)}-${idx + 1}`,
          date: d.date || getTodayDateString(),
          time: d.time || '00:57:55',
          customerName: d.customerName || 'Pelanggan Bon',
          customerCode: d.customerCode || `#${String(idx + 1).padStart(2, '0')}`,
          noteBox: d.noteBox || '',
          items: Array.isArray(d.items) && d.items.length > 0 ? d.items : [
            { name: 'Ayam Gebrus', detailLabel: '', quantity: 50, unit: 'kg', price: 25500, total: 1275000 }
          ],
          totalAmount: total,
          status: isLunas ? 'LUNAS' : 'BELUM LUNAS',
          paymentType: d.paymentType || 'kredit',
          dueDate: d.dueDate || '09/11/2026',
          remainingDebt: isLunas ? 0 : total,
          paidAmount: isLunas ? total : 0,
          historyDate: '02/11/2026',
          storeHeaderName: d.storeHeaderName || 'aa anugrah',
          storePhone: d.storePhone || '085735144958',
          storeHandle: d.storeHandle || '@@ anugrah',
          createdAt: new Date().toISOString(),
        };
      });

      await onImportSuccess(converted, importMode, syncToFinance);
      onClose();
    } catch (err: any) {
      console.warn('AI Parsing failed, falling back to local parser:', err);
      if (parsedReceipts.length > 0) {
        // Automatically save locally parsed receipts without blocking the user!
        await onImportSuccess(parsedReceipts, importMode, syncToFinance);
        onClose();
      } else {
        setAiError(cleanErrorMessage(err.message || 'Gagal memproses markdown.'));
      }
    } finally {
      setIsAiProcessing(false);
    }
  };

  const handleSaveAll = async () => {
    if (parsedReceipts.length === 0) return;
    setIsSaving(true);
    try {
      await onImportSuccess(parsedReceipts, importMode, syncToFinance);
      onClose();
    } catch (err: any) {
      console.error(err);
      alert('Gagal menyimpan struk: ' + (err.message || 'Terjadi kesalahan'));
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-5xl max-h-[94vh] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-150 my-auto">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-indigo-800 via-indigo-900 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="p-2.5 bg-indigo-500/25 text-indigo-200 rounded-2xl border border-indigo-400/30">
              <FileCode className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-extrabold text-base sm:text-lg tracking-tight">
                  Input Struk Berdasarkan Format Markdown
                </h3>
                <span className="px-2 py-0.5 text-[10px] font-extrabold bg-indigo-400/25 text-indigo-200 border border-indigo-300/30 rounded-full flex items-center gap-1 shadow-xs">
                  <FileText className="w-3 h-3 text-indigo-300" />
                  Markdown Parser Otomatis
                </span>
              </div>
              <p className="text-xs text-indigo-100/80">
                Ketik atau tempel teks Markdown (tabel, daftar, atau blok struk). Sistem akan langsung membaca dan menambahkan struk tagihan ke galeri gudang.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-colors shrink-0"
            title="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Template Selector Bar */}
        <div className="px-4 sm:px-6 py-2.5 bg-gray-50 border-b border-gray-200 flex flex-wrap items-center justify-between gap-2.5 text-xs shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
              Contoh Template:
            </span>
            <button
              type="button"
              onClick={() => handleApplyTemplate(MARKDOWN_SAMPLE_TABLE)}
              className="px-2.5 py-1 bg-white hover:bg-gray-100 text-indigo-900 border border-indigo-200 rounded-lg font-bold transition-all shadow-2xs"
            >
              📋 Format Tabel Markdown
            </button>
            <button
              type="button"
              onClick={() => handleApplyTemplate(MARKDOWN_SAMPLE_BLOCK)}
              className="px-2.5 py-1 bg-white hover:bg-gray-100 text-indigo-900 border border-indigo-200 rounded-lg font-bold transition-all shadow-2xs"
            >
              📑 Format Blok Multi-Struk
            </button>
            <button
              type="button"
              onClick={() => handleApplyTemplate(MARKDOWN_SAMPLE_SINGLE)}
              className="px-2.5 py-1 bg-white hover:bg-gray-100 text-indigo-900 border border-indigo-200 rounded-lg font-bold transition-all shadow-2xs"
            >
              📄 1 Struk Sederhana
            </button>
            <button
              type="button"
              onClick={() => handleApplyTemplate('')}
              className="px-2.5 py-1 text-gray-500 hover:text-rose-600 rounded-lg font-semibold hover:bg-rose-50 transition-colors"
            >
              Kosongkan
            </button>
          </div>

          {/* Realtime stats badge */}
          <div className="flex items-center gap-2 text-[11px] font-bold">
            <span className="px-2.5 py-1 bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-lg">
              Terbaca: <strong>{parsedReceipts.length}</strong> Struk ({parseResult.rawItemCount} Baris)
            </span>
            <span className="px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg font-mono">
              Total: <strong>{formatRupiah(totalRupiah)}</strong>
            </span>
          </div>
        </div>

        {/* AI Error Alert */}
        {aiError && (
          <div className="mx-4 sm:mx-6 mt-3 p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2.5 text-xs text-rose-800">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{aiError}</span>
          </div>
        )}

        {/* Modal Main Content: 2-Column on Desktop (Editor Left, Live Preview Right) */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[380px]">
          {/* LEFT: Markdown Editor (Col 7) */}
          <div className="lg:col-span-7 p-4 sm:p-5 flex flex-col border-b lg:border-b-0 lg:border-r border-gray-200 overflow-hidden bg-gray-50/50">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                <FileCode className="w-4 h-4 text-indigo-600" />
                <span>Ketik / Tempel Kode Markdown</span>
              </label>

              <div className="flex items-center gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={handleCopyMarkdown}
                  className="px-2.5 py-1 bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 rounded-lg text-[11px] font-bold transition-all shadow-2xs flex items-center gap-1"
                >
                  {copiedTemplate ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span className="hidden sm:inline">{copiedTemplate ? 'Tersalin' : 'Salin Teks'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleAutoFormatOffline}
                  disabled={parsedReceipts.length === 0}
                  className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-lg text-[11px] font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                  title="Format ulang tabel secara instan dan rapi tanpa internet"
                >
                  <Zap className="w-3 h-3 text-amber-200" />
                  <span>Rapikan Otomatis</span>
                </button>

                <button
                  type="button"
                  onClick={handleParseWithAi}
                  disabled={isAiProcessing || !markdownText.trim()}
                  className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-lg text-[11px] font-bold transition-all shadow-xs flex items-center gap-1"
                  title="Gunakan AI jika teks markdown Anda tidak beraturan"
                >
                  {isAiProcessing ? (
                    <>
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      <span>Memproses AI...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3 h-3 text-indigo-200" />
                      <span>Rapikan dgn AI</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <textarea
              value={markdownText}
              onChange={(e) => setMarkdownText(e.target.value)}
              placeholder="Tempel tabel markdown atau blok struk di sini..."
              rows={16}
              className="flex-1 w-full p-3.5 bg-white border border-gray-300 rounded-2xl font-mono text-xs text-gray-900 focus:outline-indigo-600 focus:ring-2 focus:ring-indigo-500/20 resize-none shadow-inner leading-relaxed"
            />

            <div className="mt-2 text-[11px] text-gray-500 flex items-center justify-between">
              <span>Mendukung tabel markdown (|...|), list (- atau *), dan blok ### Struk</span>
              <span>{markdownText.length} karakter</span>
            </div>
          </div>

          {/* RIGHT: Live Preview of Parsed Receipts (Col 5) */}
          <div className="lg:col-span-5 p-4 sm:p-5 flex flex-col bg-white overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-emerald-600" />
                <span>Pratinjau Hasil Struk ({parsedReceipts.length} Struk)</span>
              </label>
              {parsedReceipts.length > 0 && (
                <span className="text-[10px] font-extrabold px-2 py-0.5 bg-emerald-100 text-emerald-900 rounded-full">
                  Siap Ditambahkan
                </span>
              )}
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {parsedReceipts.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-gray-200 rounded-2xl text-gray-400">
                  <FileText className="w-10 h-10 mb-2 text-gray-300" />
                  <p className="text-xs font-bold text-gray-600">Belum Ada Struk Terbaca</p>
                  <p className="text-[11px] text-gray-400 mt-1 max-w-xs">
                    Ketik teks markdown di sebelah kiri atau pilih salah satu tombol contoh template di atas.
                  </p>
                </div>
              ) : (
                parsedReceipts.map((rcp, idx) => {
                  const isLunas = rcp.status === 'LUNAS';

                  return (
                    <div
                      key={idx}
                      className="p-3.5 bg-gray-50/80 border border-gray-200 rounded-2xl space-y-2 text-xs transition-all hover:bg-white hover:shadow-xs"
                    >
                      {/* Top Row: Customer & Badge */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-extrabold text-gray-900 text-sm flex items-center gap-1.5">
                            <span>
                              #{idx + 1}. {rcp.customerName}
                            </span>
                            <span className="font-mono text-xs text-amber-800">
                              {rcp.customerCode}
                            </span>
                          </div>
                          <div className="text-[10px] text-gray-500">
                            Tanggal: {rcp.date} {rcp.noteBox ? `• [${rcp.noteBox}]` : ''}
                          </div>
                        </div>

                        <span
                          className={`px-2 py-0.5 text-[9px] font-extrabold rounded-full ${
                            isLunas
                              ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                              : 'bg-rose-100 text-rose-900 border border-rose-300'
                          }`}
                        >
                          {rcp.status}
                        </span>
                      </div>

                      {/* Line Items List */}
                      <div className="space-y-1 py-1 border-t border-b border-gray-200/80 font-mono text-[11px]">
                        {rcp.items.map((it, itemIdx) => (
                          <div key={itemIdx} className="flex justify-between items-center text-gray-700">
                            <span>
                              {it.name} {it.detailLabel} ({it.quantity} {it.unit})
                            </span>
                            <span className="font-bold text-gray-900">
                              Rp {formatAngkaIndo(it.total)}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Bottom Total Row */}
                      <div className="flex items-center justify-between text-xs pt-1">
                        <span className="text-[11px] text-gray-500">Total Tagihan:</span>
                        <div className="flex items-center gap-2">
                          <span className="font-black font-mono text-sm text-emerald-800">
                            {formatRupiah(rcp.totalAmount)}
                          </span>

                          {onEditInSingleForm && (
                            <button
                              type="button"
                              onClick={() => {
                                onEditInSingleForm(rcp);
                                onClose();
                              }}
                              className="p-1 text-gray-400 hover:text-amber-700 hover:bg-amber-100 rounded-lg transition-colors"
                              title="Buka struk ini di form editor lengkap"
                            >
                              <Edit2 className="w-3.5 h-3.5 text-amber-700" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="p-4 sm:p-5 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex flex-wrap items-center gap-4 text-xs text-gray-700">
            {/* Mode: Tambahkan vs Ganti */}
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-600">Mode Impor:</span>
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="radio"
                  name="md_import_mode"
                  checked={importMode === 'append'}
                  onChange={() => setImportMode('append')}
                  className="text-indigo-600"
                />
                <span>Tambahkan ke yang ada</span>
              </label>
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="radio"
                  name="md_import_mode"
                  checked={importMode === 'replace'}
                  onChange={() => setImportMode('replace')}
                  className="text-indigo-600"
                />
                <span className="text-rose-700 font-semibold">Ganti Semua Struk</span>
              </label>
            </div>

            {/* Sync to finance checkbox */}
            <label className="flex items-center gap-1.5 cursor-pointer font-bold text-emerald-800">
              <input
                type="checkbox"
                checked={syncToFinance}
                onChange={(e) => setSyncToFinance(e.target.checked)}
                className="rounded-sm text-emerald-600 focus:ring-emerald-500"
              />
              <span>Sinkronkan ke Rekap Kas & Penjualan</span>
            </label>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
            >
              Batal
            </button>

            <button
              type="button"
              onClick={handleSaveAll}
              disabled={isSaving || parsedReceipts.length === 0}
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-xl text-xs font-extrabold transition-all shadow-md shadow-indigo-600/25 active:scale-95"
            >
              <Save className="w-4 h-4" />
              <span>
                {isSaving
                  ? 'Menyimpan...'
                  : `Simpan ${parsedReceipts.length} Struk ke Galeri`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
