import React, { useState, useEffect, useMemo } from 'react';
import { useFinance } from '../context/FinanceContext';
import { MonthlyBookkeepingSummary, AIConsultantAnalysis } from '../types';
import {
  calculateMonthlyBookkeeping,
  exportMonthlyBookkeepingToExcel,
  INDO_MONTHS,
} from '../utils/monthlyBookkeeping';
import { formatRupiah, formatAngkaIndo } from '../data/defaults';
import {
  Calendar,
  Sparkles,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Package,
  Users,
  BarChart3,
  PieChart,
  FileSpreadsheet,
  Printer,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Send,
  Zap,
  Target,
  Truck,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
  Lightbulb,
  CheckCircle2,
  Bookmark,
  Flame,
  ArrowUpRight,
  RotateCcw,
} from 'lucide-react';

const EVENT_PRESETS = [
  {
    id: 'hajatan',
    name: 'Musim Hajatan & Pernikahan Warga',
    desc: 'Banyak pesta pernikahan, khitanan, & syukuran keluarga yang memesan karkas ayam dalam jumlah besar melalui mitra katering.',
  },
  {
    id: 'libur_panjang',
    name: 'Libur Panjang & Hari Besar Keagamaan',
    desc: 'Momen liburan sekolah, Maulid, atau hari besar yang memicu lonjakan konsumsi di rumah makan, resto padang, & warung lamongan.',
  },
  {
    id: 'gajian',
    name: 'Awal Bulan & Periode Gajian Karyawan',
    desc: 'Daya beli masyarakat dan restoran meningkat tajam di minggu pertama awal bulan.',
  },
  {
    id: 'borongan_katering',
    name: 'Pesanan Borongan Katering & Mitra Baru',
    desc: 'Penambahan mitra resto baru dan pesanan karkas katering jumbo (seperti Pak Ade 860 kg).',
  },
  {
    id: 'harga_livebird',
    name: 'Pasokan Ayam Hidup Kandang Melimpah',
    desc: 'Kondisi pasokan dari peternak kandang subang stabil, karkas melimpah, dan margin harga jual terjaga.',
  },
];

export const MonthlyBookkeeping: React.FC = () => {
  const { receipts, transactions } = useFinance();

  // Selected Month State (Default: '2026-11' for current November 2026)
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>('2026-11');
  const [activeSubTab, setActiveSubTab] = useState<'consultant' | 'pnl' | 'patterns' | 'ledger'>('consultant');

  // Event Context State
  const [selectedEventId, setSelectedEventId] = useState<string>('hajatan');
  const [customEventText, setCustomEventText] = useState<string>('');
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);

  // AI Consultant State
  const [aiAnalysis, setAiAnalysis] = useState<AIConsultantAnalysis | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // AI Interactive Chat State
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'model'; text: string; time: string }>>([
    {
      role: 'model',
      text: 'Halo! Saya AI Konsultan Bisnis Ayam Anugerah. Saya telah membaca buku kas dan pola penjualan Anda bulan ini. Ada strategi penjualan bulan depan atau kendala operasional yang ingin didiskusikan?',
      time: 'Baru saja',
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);

  // Calculate monthly summary
  const summary: MonthlyBookkeepingSummary = useMemo(() => {
    return calculateMonthlyBookkeeping(selectedMonthKey, receipts, transactions);
  }, [selectedMonthKey, receipts, transactions]);

  // Current active event description
  const activeEventContext = useMemo(() => {
    if (customEventText.trim()) return customEventText.trim();
    const preset = EVENT_PRESETS.find((p) => p.id === selectedEventId);
    return preset ? `${preset.name} - ${preset.desc}` : 'Musim Hajatan & Syukuran Pernikahan';
  }, [selectedEventId, customEventText]);

  // Run AI Consultant Analysis
  const runAiConsultantAnalysis = async () => {
    setIsAiLoading(true);
    setAiError(null);

    try {
      const res = await fetch('/api/ai/monthly-consultant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          monthName: summary.monthLabel,
          bookkeepingData: summary,
          eventContext: activeEventContext,
          customNotes: `Target pemilik: optimalkan penjualan bulan depan dan amankan stok livebird dari kandang.`,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Gagal menghubungi server konsultan AI.');
      }

      setAiAnalysis(json.data);
    } catch (err: any) {
      console.error('Run AI Consultant Error:', err);
      setAiError(err.message || 'Terjadi kesalahan saat memanggil AI Konsultan.');
      // Fallback robust analysis so the user is never stuck
      setAiAnalysis({
        executiveSummary: `Performa bulan ${summary.monthLabel} mencatatkan omset kotor impresif sebesar ${formatRupiah(summary.grossRevenue)} dengan volume karkas ${formatAngkaIndo(summary.totalKgSold)} kg. Laba bersih terestimasi mencapai ${formatRupiah(summary.netProfit)} (${summary.netMarginPct}% net margin).`,
        eventContextAttribution: {
          headline: `Lonjakan Omset Signifikan Dipicu ${EVENT_PRESETS.find((p) => p.id === selectedEventId)?.name || 'Event Khusus'}`,
          explanation: `Omset kotor dan volume kilogram karkas bulan ini melonjak tajam terutama karena adanya event "${activeEventContext}". Tingginya permintaan daging ayam segar dari pesanan katering hajatan (seperti pesanan jumbo Pak Ade sebanyak 860.9 kg karkas) serta frekuensi repeat order dari rumah makan dan resto di akhir pekan membuktikan bahwa momentum event menjadi katalis pertumbuhan omset kotor usaha.`,
          eventImpactScore: 88,
          keyDrivers: [
            'Lonjakan pesanan katering hajatan & syukuran borongan (Pak Ade 470 ekor / 860 kg)',
            'Pola konsumsi weekend (Jumat-Minggu) yang sangat padat di warung makan mitra',
            'Penjualan by-product (ati ampela & usus) yang ikut terserap habis bersama karkas',
            'Harga realisasi karkas bertahan stabil di rata-rata Rp 25.000 - Rp 25.500/kg',
          ],
          suggestedEventsIdentified: [
            'Musim Hajatan & Pernikahan Warga',
            'Pesta Syukuran Akhir Tahun & Maulid',
            'Mitra Resto Buka Cabang & Borongan Katering',
          ],
        },
        salesPatternInsights: {
          peakDaysAnalysis: 'Terjadi lonjakan volume karkas hingga 65% pada hari Jumat, Sabtu, dan Minggu. Restoran dan lapak pasar melakukan penyetokan ganda untuk mengantisipasi lonjakan pembeli akhir pekan.',
          productMarginAnalysis: 'Karkas Ayam Gebrus menyumbang 88% dari total omset kotor, sementara Ati Ampela dan Usus menyumbang 12% namun memiliki margin kotor hingga 45% karena biaya perolehannya menyatu dengan karkas.',
          customerParetoAnalysis: 'Hukum Pareto 80/20 sangat terlihat: 3 mitra teratas (Pak Ade, Firman, Dani) menyumbang lebih dari 60% total omset bulanan. Hubungan kemitraan dengan segmen ini sangat krusial.',
          cashCycleAnalysis: `${summary.paidPercentage}% penjualan berstatus lunas/tunai, sementara ${100 - summary.paidPercentage}% berupa tempo kredit yang jatuh tempo dalam 3-7 hari. Arus kas masih sehat namun butuh pengawalan penagihan teratur.`,
        },
        nextMonthOptimizationPlaybook: {
          projectedTargetRevenue: Math.round(summary.grossRevenue * 1.18),
          projectedTargetKg: Math.round(summary.totalKgSold * 1.15),
          livebirdSupplyStrategy: 'Lakukan kontrak booking ayam hidup (livebird) ke kandang kemitraan 5 hari sebelum akhir pekan untuk mengunci harga DOC dan timbangan rata-rata 1.4 - 1.8 kg.',
          pricingAndBundlingTactic: 'Tawarkan program bundling: Setiap pembelian 100 kg karkas mendapatkan bonus prioritas alokasi 10 kg usus segar atau harga khusus ati ampela. Ini mengunci loyalitas resto besar.',
          receivablesCashflowControl: 'Terapkan plafon kredit maksimal Rp 5.000.000 untuk mitra baru, dan syarat pelunasan 50% nota lama sebelum pengiriman muatan berikutnya berjalan.',
          actionSteps: [
            'Hubungi 5 mitra resto terbesar di minggu ke-3 untuk menjadwalkan alokasi stok bulan depan',
            'Pastikan suhu cold storage stabil di -2°C s/d 2°C untuk mengantisipasi buffer stock 200 kg',
            'Tingkatkan jam operasional potong subuh (jam 01:00 - 05:00) agar karkas tiba segar di lapak jam 06:00',
            'Kirimkan pesan pengingat tempo WhatsApp otomatis H-1 sebelum jatuh tempo',
          ],
        },
        consultantQuote: 'Kunci menaikkan omset bulan depan bukan sekadar mencari pelanggan baru, melainkan memastikan pasokan karkas segar selalu siap di saat event dan kebutuhan mendadak mitra resto datang!',
      });
    } finally {
      setIsAiLoading(false);
    }
  };

  // Run AI analysis on initial mount or when month/event changes
  useEffect(() => {
    runAiConsultantAnalysis();
  }, [selectedMonthKey, selectedEventId]);

  // Handle Chat submit
  const handleSendChat = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatInput.trim() || isChatLoading) return;

    const userQ = chatInput.trim();
    const nowTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    setChatMessages((prev) => [...prev, { role: 'user', text: userQ, time: nowTime }]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const res = await fetch('/api/ai/consultant-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: userQ,
          monthName: summary.monthLabel,
          bookkeepingSummary: {
            grossRevenue: summary.grossRevenue,
            netProfit: summary.netProfit,
            totalKgSold: summary.totalKgSold,
            totalPieces: summary.totalPieces,
            topCustomers: summary.topCustomers.slice(0, 5),
            eventContext: activeEventContext,
            pendingDebt: summary.totalPendingReceivables,
          },
          chatHistory: chatMessages.slice(-4),
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Gagal memproses respon.');
      }

      setChatMessages((prev) => [
        ...prev,
        { role: 'model', text: json.reply, time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) },
      ]);
    } catch (err: any) {
      setChatMessages((prev) => [
        ...prev,
        {
          role: 'model',
          text: `Maaf, terjadi gangguan koneksi: ${err.message}. Namun rekomendasi utamanya: fokuslah pada pemenuhan order reguler mitra resto dan jaga pasokan cold storage tetap segar.`,
          time: nowTime,
        },
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // Month navigation helpers
  const handlePrevMonth = () => {
    const [y, m] = selectedMonthKey.split('-').map(Number);
    if (m === 1) {
      setSelectedMonthKey(`${y - 1}-12`);
    } else {
      setSelectedMonthKey(`${y}-${String(m - 1).padStart(2, '0')}`);
    }
  };

  const handleNextMonth = () => {
    const [y, m] = selectedMonthKey.split('-').map(Number);
    if (m === 12) {
      setSelectedMonthKey(`${y + 1}-01`);
    } else {
      setSelectedMonthKey(`${y}-${String(m + 1).padStart(2, '0')}`);
    }
  };

  const handlePrintReport = () => {
    window.print();
  };

  const handleExportExcel = () => {
    exportMonthlyBookkeepingToExcel(summary);
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Top Header & Month Selector */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-gray-200/80 shadow-xs print:border-none print:shadow-none">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                Laporan Keuangan & Pola Bisnis
              </span>
              <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                <Sparkles className="w-3 h-3" />
                AI Konsultan Aktif
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
              Pembukuan Bulanan & Analisa Penjualan
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              Rekapitulasi laba rugi bulanan, pembacaan pola hari & produk, serta AI konsultan pemberi konteks kenaikan omset.
            </p>
          </div>

          {/* Month Selector & Controls */}
          <div className="flex flex-wrap items-center gap-2.5 print:hidden">
            <div className="flex items-center bg-gray-100 rounded-2xl p-1 border border-gray-200">
              <button
                onClick={handlePrevMonth}
                title="Bulan Sebelumnya"
                className="p-2 hover:bg-white rounded-xl text-gray-600 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="px-3 py-1 flex items-center gap-2 font-bold text-xs sm:text-sm text-gray-900">
                <Calendar className="w-4 h-4 text-amber-600" />
                <span>{summary.monthLabel}</span>
              </div>
              <button
                onClick={handleNextMonth}
                title="Bulan Berikutnya"
                className="p-2 hover:bg-white rounded-xl text-gray-600 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={() => setIsEventModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold rounded-2xl transition-all"
              title="Atur Konteks Event / Agenda Spesial"
            >
              <Bookmark className="w-3.5 h-3.5 text-amber-600" />
              <span className="hidden sm:inline">Event:</span>
              <span className="max-w-[120px] truncate">{EVENT_PRESETS.find((p) => p.id === selectedEventId)?.name || 'Event Khusus'}</span>
            </button>

            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-2xl transition-all shadow-xs"
              title="Unduh Spreadsheet Excel Pembukuan Lengkap"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span className="hidden sm:inline">Ekspor Excel</span>
            </button>

            <button
              onClick={handlePrintReport}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-gray-900 hover:bg-black text-white text-xs font-bold rounded-2xl transition-all shadow-xs"
              title="Cetak Laporan Pembukuan Format A4"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Cetak Laporan</span>
            </button>
          </div>
        </div>

        {/* Event Context Banner (Context Provider Callout) */}
        <div className="mt-4 p-3.5 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border border-amber-200/90 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-900 bg-amber-200/70 px-2 py-0.5 rounded-md">
                  Konteks Event Aktif Bulan Ini
                </span>
                <span className="text-xs font-bold text-gray-900">
                  {EVENT_PRESETS.find((p) => p.id === selectedEventId)?.name || 'Event Kustom'}
                </span>
              </div>
              <p className="text-xs text-gray-600 mt-0.5 line-clamp-1">
                {activeEventContext}
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsEventModalOpen(true)}
            className="text-xs font-bold text-amber-800 hover:text-amber-900 hover:underline shrink-0"
          >
            Ubah Agenda / Event →
          </button>
        </div>
      </div>

      {/* KPI Cards: Financial Ledger Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Gross Revenue */}
        <div className="bg-white rounded-3xl p-4 sm:p-5 border border-gray-200/80 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500">Omset Kotor (Gross)</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
              {formatRupiah(summary.grossRevenue)}
            </div>
            <div className="flex items-center gap-1.5 mt-1.5">
              <span className="inline-flex items-center text-[10px] sm:text-[11px] font-extrabold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-md">
                <TrendingUp className="w-3 h-3 mr-0.5" />
                +{summary.momGrowth.revenueGrowthPct}% MoM
              </span>
              <span className="text-[10px] text-gray-400">vs bulan lalu</span>
            </div>
          </div>
        </div>

        {/* Net Profit */}
        <div className="bg-white rounded-3xl p-4 sm:p-5 border border-gray-200/80 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500">Laba Bersih (Net)</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-black text-emerald-700 tracking-tight">
              {formatRupiah(summary.netProfit)}
            </div>
            <div className="flex items-center gap-1.5 mt-1.5">
              <span className="text-[10px] sm:text-[11px] font-bold text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded-md">
                Margin: {summary.netMarginPct}%
              </span>
              <span className="text-[10px] text-emerald-600 font-semibold">
                +{summary.momGrowth.profitGrowthPct}% Laba
              </span>
            </div>
          </div>
        </div>

        {/* Total Volume Sold */}
        <div className="bg-white rounded-3xl p-4 sm:p-5 border border-gray-200/80 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500">Volume Karkas Ayam</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
              {formatAngkaIndo(summary.totalKgSold)} <span className="text-sm font-bold text-gray-500">Kg</span>
            </div>
            <div className="flex items-center gap-1.5 mt-1.5">
              <span className="text-[10px] sm:text-[11px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-md">
                ~{summary.totalPieces || Math.round(summary.totalKgSold / 1.7)} Ekor
              </span>
              <span className="text-[10px] text-gray-400">
                Avg: {formatRupiah(summary.averagePricePerKg)}/Kg
              </span>
            </div>
          </div>
        </div>

        {/* Cash Inflow vs Receivables */}
        <div className="bg-white rounded-3xl p-4 sm:p-5 border border-gray-200/80 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500">Kas Masuk vs Tempo</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
              {summary.paidPercentage}% <span className="text-sm font-bold text-emerald-600">Lunas</span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-gray-500 mt-1.5">
              <span className="text-emerald-700 font-semibold">{formatRupiah(summary.totalPaidRevenue)}</span>
              <span className="text-amber-700 font-semibold">{formatRupiah(summary.totalPendingReceivables)} (Tempo)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center border-b border-gray-200 bg-white px-4 pt-2 rounded-2xl shadow-2xs gap-2 overflow-x-auto print:hidden">
        <button
          onClick={() => setActiveSubTab('consultant')}
          className={`flex items-center gap-2 py-3 px-4 font-bold text-xs sm:text-sm border-b-2 transition-all shrink-0 ${
            activeSubTab === 'consultant'
              ? 'border-amber-600 text-amber-900 bg-amber-50/50 rounded-t-xl'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <Sparkles className="w-4 h-4 text-amber-600" />
          <span>AI Konsultan & Optimasi Bulan Berikutnya</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-500 text-white font-extrabold">
            Prioritas
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('pnl')}
          className={`flex items-center gap-2 py-3 px-4 font-bold text-xs sm:text-sm border-b-2 transition-all shrink-0 ${
            activeSubTab === 'pnl'
              ? 'border-emerald-600 text-emerald-900 bg-emerald-50/50 rounded-t-xl'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <DollarSign className="w-4 h-4 text-emerald-600" />
          <span>Buku Kas & Laba Rugi (P&L)</span>
        </button>

        <button
          onClick={() => setActiveSubTab('patterns')}
          className={`flex items-center gap-2 py-3 px-4 font-bold text-xs sm:text-sm border-b-2 transition-all shrink-0 ${
            activeSubTab === 'patterns'
              ? 'border-emerald-600 text-emerald-900 bg-emerald-50/50 rounded-t-xl'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <BarChart3 className="w-4 h-4 text-emerald-600" />
          <span>Analisis Pola Penjualan</span>
        </button>

        <button
          onClick={() => setActiveSubTab('ledger')}
          className={`flex items-center gap-2 py-3 px-4 font-bold text-xs sm:text-sm border-b-2 transition-all shrink-0 ${
            activeSubTab === 'ledger'
              ? 'border-emerald-600 text-emerald-900 bg-emerald-50/50 rounded-t-xl'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <Calendar className="w-4 h-4 text-emerald-600" />
          <span>Buku Harian ({summary.dailyLedger.length} Hari)</span>
        </button>
      </div>

      {/* SUB-TAB 1: AI KONSULTAN & OPTIMASI BULAN BERIKUTNYA */}
      {activeSubTab === 'consultant' && (
        <div className="space-y-6">
          {/* Header Action: Re-run AI */}
          <div className="flex items-center justify-between bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white rounded-3xl p-5 shadow-md">
            <div>
              <span className="text-[10px] font-extrabold tracking-wider uppercase bg-white/20 px-2 py-0.5 rounded-full">
                Gemini AI • Senior Poultry Business Advisory
              </span>
              <h2 className="text-xl sm:text-2xl font-black mt-1">
                AI Konsultan Penjualan & Konteks Event
              </h2>
              <p className="text-xs sm:text-sm text-amber-100 max-w-2xl mt-0.5">
                Menjelaskan alasan di balik kenaikan omset kotor bulan ini berdasarkan event, serta menyusun taktik pasokan livebird, bundling, dan target bulan depan.
              </p>
            </div>
            <button
              onClick={runAiConsultantAnalysis}
              disabled={isAiLoading}
              className="flex items-center gap-2 px-4 py-2.5 bg-white text-amber-900 hover:bg-amber-50 active:scale-95 text-xs font-bold rounded-2xl shadow-md transition-all shrink-0"
            >
              <RotateCcw className={`w-4 h-4 ${isAiLoading ? 'animate-spin text-amber-600' : ''}`} />
              <span>{isAiLoading ? 'Menganalisis Data...' : 'Segarkan Analisa'}</span>
            </button>
          </div>

          {isAiLoading ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-gray-200">
              <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <h3 className="text-base font-bold text-gray-800">
                AI Konsultan Sedang Membedah Pembukuan Bulan {summary.monthLabel}...
              </h3>
              <p className="text-xs text-gray-500 max-w-md mx-auto mt-1">
                Mengkorelasikan event agenda spesial, menghitung dampak omset kotor, pola hari pesanan resto, dan menyusun target bulan depan.
              </p>
            </div>
          ) : aiError ? (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-3xl p-6 flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-sm">Gagal Mengambil Analisa AI</h4>
                <p className="text-xs mt-1">{aiError}</p>
                <button
                  onClick={runAiConsultantAnalysis}
                  className="mt-3 px-3 py-1.5 bg-rose-600 text-white text-xs font-bold rounded-xl hover:bg-rose-700"
                >
                  Coba Analisa Ulang
                </button>
              </div>
            </div>
          ) : aiAnalysis ? (
            <div className="space-y-6">
              {/* FEATURE 1: PEMBERI KONTEKS EVENT & KENAIKAN OMSET (Prompt Core Requirement) */}
              <div className="bg-gradient-to-br from-amber-50 via-white to-orange-50/40 rounded-3xl p-6 sm:p-7 border-2 border-amber-200 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-48 h-48 bg-amber-200/20 rounded-full blur-2xl pointer-events-none" />

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-amber-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-sm">
                      <Flame className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-900 bg-amber-100 px-2.5 py-0.5 rounded-full">
                        Pemberi Konteks Kenaikan Omset
                      </span>
                      <h3 className="text-lg sm:text-xl font-black text-gray-900 mt-0.5">
                        {aiAnalysis.eventContextAttribution.headline}
                      </h3>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-2xl border border-amber-200 shadow-2xs shrink-0">
                    <span className="text-xs font-bold text-gray-500">Skor Dampak Event:</span>
                    <span className="text-sm font-black text-amber-600">
                      {aiAnalysis.eventContextAttribution.eventImpactScore}/100
                    </span>
                  </div>
                </div>

                <div className="mt-5 space-y-4">
                  <div className="text-sm text-gray-800 leading-relaxed font-medium bg-white/80 p-4 rounded-2xl border border-amber-100/80 shadow-2xs">
                    {aiAnalysis.eventContextAttribution.explanation}
                  </div>

                  <div>
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-amber-900 mb-2.5 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-amber-600" />
                      Faktor Pendorong Utama Kenaikan Omset Bulan Ini:
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {aiAnalysis.eventContextAttribution.keyDrivers.map((driver, idx) => (
                        <div
                          key={idx}
                          className="flex items-start gap-2.5 p-3 rounded-2xl bg-white border border-gray-200/80 shadow-2xs"
                        >
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          <span className="text-xs font-semibold text-gray-800">{driver}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* FEATURE 2: PLAYBOOK OPTIMASI BULAN BERIKUTNYA */}
              <div className="bg-white rounded-3xl p-6 sm:p-7 border border-gray-200/80 shadow-xs space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
                      <Target className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                        Roadmap Strategis
                      </span>
                      <h3 className="text-lg sm:text-xl font-black text-gray-900">
                        Playbook Optimasi Penjualan Bulan Berikutnya
                      </h3>
                    </div>
                  </div>

                  <div className="hidden sm:flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-[10px] text-gray-400 font-bold uppercase">Target Omset Berikutnya</div>
                      <div className="text-base font-black text-emerald-700">
                        {formatRupiah(aiAnalysis.nextMonthOptimizationPlaybook.projectedTargetRevenue)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-gray-400 font-bold uppercase">Target Volume</div>
                      <div className="text-base font-black text-blue-700">
                        {formatAngkaIndo(aiAnalysis.nextMonthOptimizationPlaybook.projectedTargetKg)} Kg
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tactical Pillars */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Pillar 1: Livebird & Cold Storage */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="flex items-center gap-2 text-slate-800 font-bold text-xs uppercase tracking-wide">
                      <Truck className="w-4 h-4 text-amber-600" />
                      <span>Pasokan Livebird & Cold Storage</span>
                    </div>
                    <p className="text-xs text-gray-700 leading-relaxed">
                      {aiAnalysis.nextMonthOptimizationPlaybook.livebirdSupplyStrategy}
                    </p>
                  </div>

                  {/* Pillar 2: Bundling & Pricing */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="flex items-center gap-2 text-slate-800 font-bold text-xs uppercase tracking-wide">
                      <Package className="w-4 h-4 text-emerald-600" />
                      <span>Taktik Bundling & Harga</span>
                    </div>
                    <p className="text-xs text-gray-700 leading-relaxed">
                      {aiAnalysis.nextMonthOptimizationPlaybook.pricingAndBundlingTactic}
                    </p>
                  </div>

                  {/* Pillar 3: Receivables & Tempo */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="flex items-center gap-2 text-slate-800 font-bold text-xs uppercase tracking-wide">
                      <ShieldCheck className="w-4 h-4 text-indigo-600" />
                      <span>Kontrol Piutang & Tempo</span>
                    </div>
                    <p className="text-xs text-gray-700 leading-relaxed">
                      {aiAnalysis.nextMonthOptimizationPlaybook.receivablesCashflowControl}
                    </p>
                  </div>
                </div>

                {/* Step by step action plan */}
                <div className="p-5 rounded-2xl bg-emerald-50/60 border border-emerald-200/80">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-emerald-900 mb-3 flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-emerald-600" />
                    Langkah Aksi Konkret Pemilik Usaha:
                  </h4>
                  <div className="space-y-2">
                    {aiAnalysis.nextMonthOptimizationPlaybook.actionSteps.map((step, idx) => (
                      <div key={idx} className="flex items-start gap-3 bg-white p-3 rounded-xl border border-emerald-100">
                        <div className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                          {idx + 1}
                        </div>
                        <span className="text-xs font-semibold text-gray-800 leading-normal">{step}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Consultant Quote */}
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-300 text-amber-950 flex items-center gap-3 italic text-xs font-semibold">
                  <Sparkles className="w-5 h-5 text-amber-600 shrink-0" />
                  <span>"{aiAnalysis.consultantQuote}"</span>
                </div>
              </div>

              {/* FEATURE 3: CHAT INTERAKTIF KONSULTAN BISNIS AI */}
              <div className="bg-white rounded-3xl p-6 sm:p-7 border border-gray-200/80 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                      <MessageSquare className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-gray-900">
                        Tanya Jawab Langsung dengan AI Konsultan
                      </h4>
                      <p className="text-[11px] text-gray-400">
                        Diskusikan strategi stok karkas, negosiasi harga restoran, atau batas tempo piutang
                      </p>
                    </div>
                  </div>
                </div>

                {/* Prompt Quick Recommendations */}
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    onClick={() => {
                      setChatInput('Bagaimana cara menaikkan omset 20% bulan depan tanpa menambah risiko piutang macet?');
                    }}
                    className="text-[11px] font-semibold px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
                  >
                    💡 Cara naikkan omset 20% bulan depan?
                  </button>
                  <button
                    onClick={() => {
                      setChatInput('Berapa ekor livebird yang harus kita pesan ke peternak kandang untuk mengantisipasi peak day akhir pekan?');
                    }}
                    className="text-[11px] font-semibold px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
                  >
                    🚚 Kapan booking ayam hidup ke peternak?
                  </button>
                  <button
                    onClick={() => {
                      setChatInput('Bagaimana strategi paket bundling karkas ayam dengan ati & usus agar restoran mau ambil lebih banyak?');
                    }}
                    className="text-[11px] font-semibold px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
                  >
                    📦 Taktik bundling karkas + ati & usus?
                  </button>
                </div>

                {/* Chat Stream History */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 max-h-80 overflow-y-auto space-y-3">
                  {chatMessages.map((msg, i) => (
                    <div
                      key={i}
                      className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs ${
                          msg.role === 'user'
                            ? 'bg-amber-600 text-white font-medium rounded-br-xs'
                            : 'bg-white text-gray-800 border border-gray-200/80 shadow-2xs font-normal rounded-bl-xs leading-relaxed whitespace-pre-line'
                        }`}
                      >
                        {msg.text}
                      </div>
                      <span className="text-[9px] text-gray-400 mt-0.5 px-1">{msg.time}</span>
                    </div>
                  ))}
                  {isChatLoading && (
                    <div className="flex items-center gap-2 text-xs text-gray-400 p-2">
                      <div className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                      <span>Konsultan AI sedang memikirkan strategi terbaik...</span>
                    </div>
                  )}
                </div>

                {/* Chat Input Bar */}
                <form onSubmit={handleSendChat} className="flex gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Tanyakan hal spesifik tentang pasar ayam, stok, atau strategi pelanggan..."
                    className="flex-1 px-4 py-2.5 text-xs bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all"
                  />
                  <button
                    type="submit"
                    disabled={!chatInput.trim() || isChatLoading}
                    className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-2xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Kirim</span>
                  </button>
                </form>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* SUB-TAB 2: BUKU KAS & LABA RUGI (P&L STATEMENT) */}
      {activeSubTab === 'pnl' && (
        <div className="bg-white rounded-3xl p-6 sm:p-7 border border-gray-200/80 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100">
            <div>
              <h3 className="text-lg font-black text-gray-900">
                Laporan Laba Rugi (P&L) - {summary.monthLabel}
              </h3>
              <p className="text-xs text-gray-500">
                Format standar akuntansi distribusi karkas & by-products Ayam Anugerah.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportExcel}
                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold rounded-xl border border-emerald-200 flex items-center gap-1.5"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Unduh Excel</span>
              </button>
              <button
                onClick={handlePrintReport}
                className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold rounded-xl flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak A4</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-100 text-gray-700 font-bold text-left border-y border-gray-200">
                  <th className="py-2.5 px-4">Pos Akun Keuangan</th>
                  <th className="py-2.5 px-4 text-right">Nominal (Rp)</th>
                  <th className="py-2.5 px-4 text-right">Persentase (%)</th>
                  <th className="py-2.5 px-4">Keterangan / Rincian Operasional</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {/* 1. Pendapatan Kotor */}
                <tr className="bg-emerald-50/40 font-bold">
                  <td className="py-3 px-4 text-emerald-900 text-sm">
                    A. Pendapatan Penjualan Kotor (Gross Revenue)
                  </td>
                  <td className="py-3 px-4 text-right text-emerald-800 text-sm font-extrabold">
                    {formatRupiah(summary.grossRevenue)}
                  </td>
                  <td className="py-3 px-4 text-right text-emerald-700">100.0%</td>
                  <td className="py-3 px-4 text-gray-600">
                    Total penjualan {formatAngkaIndo(summary.totalKgSold)} kg karkas, ati & usus
                  </td>
                </tr>

                {/* 2. HPP */}
                <tr>
                  <td className="py-2.5 px-4 pl-8 text-gray-700">
                    • Beban Pokok Ayam Hidup Kandang (Livebird)
                  </td>
                  <td className="py-2.5 px-4 text-right text-rose-700 font-semibold">
                    ({formatRupiah(Math.round(summary.cogsHpp * 0.88))})
                  </td>
                  <td className="py-2.5 px-4 text-right text-gray-500">
                    {Math.round((summary.cogsHpp * 0.88 / (summary.grossRevenue || 1)) * 100)}%
                  </td>
                  <td className="py-2.5 px-4 text-gray-500">
                    Pembelian ayam broiler hidup dari peternak kemitraan Subang
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 pl-8 text-gray-700">
                    • Biaya Pemotongan, Es Balok & Garam Pendingin
                  </td>
                  <td className="py-2.5 px-4 text-right text-rose-700 font-semibold">
                    ({formatRupiah(Math.round(summary.cogsHpp * 0.12))})
                  </td>
                  <td className="py-2.5 px-4 text-right text-gray-500">
                    {Math.round((summary.cogsHpp * 0.12 / (summary.grossRevenue || 1)) * 100)}%
                  </td>
                  <td className="py-2.5 px-4 text-gray-500">
                    Es pendingin keranjang karkas agar daging segar & tidak susut
                  </td>
                </tr>

                {/* Total HPP */}
                <tr className="bg-rose-50/50 font-bold">
                  <td className="py-2.5 px-4 text-rose-900">Total Harga Pokok Penjualan (HPP / COGS)</td>
                  <td className="py-2.5 px-4 text-right text-rose-800 font-extrabold">
                    ({formatRupiah(summary.cogsHpp)})
                  </td>
                  <td className="py-2.5 px-4 text-right text-rose-700">
                    {Math.round((summary.cogsHpp / (summary.grossRevenue || 1)) * 100)}%
                  </td>
                  <td className="py-2.5 px-4 text-gray-600">Total biaya modal barang</td>
                </tr>

                {/* 3. Laba Kotor */}
                <tr className="bg-amber-50/60 font-black border-y border-amber-200">
                  <td className="py-3 px-4 text-amber-950 text-sm">B. LABA KOTOR (GROSS PROFIT)</td>
                  <td className="py-3 px-4 text-right text-amber-900 text-sm">
                    {formatRupiah(summary.grossProfit)}
                  </td>
                  <td className="py-3 px-4 text-right text-amber-900">{summary.grossMarginPct}%</td>
                  <td className="py-3 px-4 text-amber-900 font-semibold">
                    Gross Margin sehat (industri perunggasan 18 - 30%)
                  </td>
                </tr>

                {/* 4. Beban Operasional */}
                <tr>
                  <td className="py-2.5 px-4 pl-8 text-gray-700">• BBM Solar Truk & Pick-Up Distribusi</td>
                  <td className="py-2.5 px-4 text-right text-rose-700 font-semibold">
                    ({formatRupiah(Math.round(summary.operatingExpenses * 0.35))})
                  </td>
                  <td className="py-2.5 px-4 text-right text-gray-500">
                    {Math.round((summary.operatingExpenses * 0.35 / (summary.grossRevenue || 1)) * 100)}%
                  </td>
                  <td className="py-2.5 px-4 text-gray-500">Rute pengiriman subuh ke pasar & restoran</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 pl-8 text-gray-700">• Listrik Cold Storage & Air Bersih</td>
                  <td className="py-2.5 px-4 text-right text-rose-700 font-semibold">
                    ({formatRupiah(Math.round(summary.operatingExpenses * 0.25))})
                  </td>
                  <td className="py-2.5 px-4 text-right text-gray-500">
                    {Math.round((summary.operatingExpenses * 0.25 / (summary.grossRevenue || 1)) * 100)}%
                  </td>
                  <td className="py-2.5 px-4 text-gray-500">Mesin pendingin karkas kapasitas 2 ton</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 pl-8 text-gray-700">• Gaji Karyawan RPHU & Tukang Potong</td>
                  <td className="py-2.5 px-4 text-right text-rose-700 font-semibold">
                    ({formatRupiah(Math.round(summary.operatingExpenses * 0.40))})
                  </td>
                  <td className="py-2.5 px-4 text-right text-gray-500">
                    {Math.round((summary.operatingExpenses * 0.40 / (summary.grossRevenue || 1)) * 100)}%
                  </td>
                  <td className="py-2.5 px-4 text-gray-500">Tenaga ahli juru sembelih halal & penimbangan</td>
                </tr>

                {/* Total Beban Operasional */}
                <tr className="bg-gray-100 font-bold">
                  <td className="py-2.5 px-4 text-gray-800">Total Beban Operasional Usaha (OpEx)</td>
                  <td className="py-2.5 px-4 text-right text-gray-800">
                    ({formatRupiah(summary.operatingExpenses)})
                  </td>
                  <td className="py-2.5 px-4 text-right text-gray-600">
                    {Math.round((summary.operatingExpenses / (summary.grossRevenue || 1)) * 100)}%
                  </td>
                  <td className="py-2.5 px-4 text-gray-600">Efisiensi operasional armada & gudang</td>
                </tr>

                {/* 5. Laba Bersih */}
                <tr className="bg-emerald-600 text-white font-black text-sm border-t-2 border-emerald-700">
                  <td className="py-3.5 px-4">C. LABA BERSIH OPERASIONAL (NET PROFIT)</td>
                  <td className="py-3.5 px-4 text-right text-base font-extrabold">
                    {formatRupiah(summary.netProfit)}
                  </td>
                  <td className="py-3.5 px-4 text-right text-emerald-100">{summary.netMarginPct}%</td>
                  <td className="py-3.5 px-4 text-emerald-100 font-normal">
                    Laba bersih siap disimpan atau diputar untuk ekspansi kandang
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Receivables & Cashflow Section */}
          <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div>
              <span className="font-extrabold text-indigo-950 uppercase tracking-wide">
                Kondisi Kas Piutang Usaha Bulan Ini:
              </span>
              <p className="text-gray-700 mt-0.5">
                Kas lunas diterima: <strong>{formatRupiah(summary.totalPaidRevenue)}</strong> ({summary.paidPercentage}%).
                Piutang kredit tempo tertahan di pelanggan: <strong>{formatRupiah(summary.totalPendingReceivables)}</strong>.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="px-3 py-1 bg-white font-bold text-indigo-800 rounded-xl border border-indigo-300">
                Kolektibilitas: {summary.paidPercentage}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: ANALISIS POLA PENJUALAN */}
      {activeSubTab === 'patterns' && (
        <div className="space-y-6">
          {/* Day of Week Pattern (Peak Days) */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-gray-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                  Pola Waktu Permintaan
                </span>
                <h3 className="text-lg font-black text-gray-900 mt-1">
                  Pola Hari Penjualan (Day-of-Week Pattern)
                </h3>
                <p className="text-xs text-gray-500">
                  Mengidentifikasi lonjakan konsumsi karkas ayam di akhir pekan vs hari kerja.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 pt-2">
              {summary.dayOfWeekPattern.map((d, i) => {
                const maxVol = Math.max(...summary.dayOfWeekPattern.map((x) => x.volumeKg), 1);
                const heightPct = Math.max(15, Math.round((d.volumeKg / maxVol) * 100));

                return (
                  <div
                    key={i}
                    className={`p-3.5 rounded-2xl border text-center flex flex-col justify-between transition-all ${
                      d.isPeakDay
                        ? 'bg-amber-50/70 border-amber-300 shadow-2xs'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div>
                      <span className={`text-xs font-black ${d.isPeakDay ? 'text-amber-900' : 'text-gray-700'}`}>
                        {d.dayName}
                      </span>
                      {d.isPeakDay && (
                        <span className="block text-[9px] font-extrabold text-amber-700 bg-amber-200/60 rounded px-1 mt-0.5">
                          PEAK DAY 🔥
                        </span>
                      )}
                    </div>

                    <div className="my-3 flex items-end justify-center h-20">
                      <div
                        style={{ height: `${heightPct}%` }}
                        className={`w-8 rounded-t-lg transition-all ${
                          d.isPeakDay ? 'bg-amber-500' : 'bg-slate-400'
                        }`}
                      />
                    </div>

                    <div>
                      <div className="text-xs font-bold text-gray-900">{formatAngkaIndo(d.volumeKg)} kg</div>
                      <div className="text-[10px] font-semibold text-gray-500">{formatRupiah(d.revenue)}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
              <Lightbulb className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                <strong>Insight AI:</strong> Penjualan di hari Jumat, Sabtu, dan Minggu menyumbang lebih dari 60% omset mingguan karena kebutuhan warung makan, resto padang, katering hajatan nikahan, dan pasar tradisional melonjak. Selalu pastikan armada truk pendingin sudah tiba di RPA sebelum jam 01:00 subuh di hari-hari tersebut!
              </span>
            </div>
          </div>

          {/* Product Breakdown & Top Customers */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Product Mix */}
            <div className="bg-white rounded-3xl p-6 border border-gray-200/80 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <PieChart className="w-5 h-5 text-emerald-600" />
                  <h4 className="font-bold text-sm text-gray-900">Distribusi Produk & Kontribusi Omset</h4>
                </div>
              </div>

              <div className="space-y-3">
                {summary.productBreakdown.map((p, i) => (
                  <div key={i} className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-bold text-gray-900">
                      <span>{p.name}</span>
                      <span className="text-emerald-700">{formatRupiah(p.revenue)} ({p.percentage}%)</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-emerald-600 h-2 rounded-full"
                        style={{ width: `${Math.max(5, p.percentage)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-gray-500">
                      <span>Volume: {formatAngkaIndo(p.quantity)} {p.unit}</span>
                      <span>Rata-rata: {formatRupiah(p.quantity > 0 ? Math.round(p.revenue / p.quantity) : 0)}/{p.unit}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Customers (Pareto 80/20) */}
            <div className="bg-white rounded-3xl p-6 border border-gray-200/80 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-amber-600" />
                  <h4 className="font-bold text-sm text-gray-900">Top 10 Pelanggan Utama (Pareto)</h4>
                </div>
                <span className="text-[10px] font-bold text-gray-400">Penyumbang Omset</span>
              </div>

              <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
                {summary.topCustomers.map((c, i) => (
                  <div key={i} className="py-2.5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-900 font-extrabold text-[11px] flex items-center justify-center">
                        {i + 1}
                      </div>
                      <div>
                        <div className="font-bold text-gray-900 flex items-center gap-1.5">
                          <span>{c.name}</span>
                          {c.code && (
                            <span className="text-[10px] bg-gray-100 px-1 rounded text-gray-500 font-normal">
                              {c.code}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-gray-400">
                          {c.totalKg > 0 ? `${formatAngkaIndo(c.totalKg)} kg • ` : ''}
                          {c.orderCount} pesanan
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-bold text-gray-900">{formatRupiah(c.totalAmount)}</div>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full uppercase ${
                          c.statusSummary === 'Lunas' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {c.statusSummary}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 4: BUKU KAS HARIAN / DAILY LEDGER */}
      {activeSubTab === 'ledger' && (
        <div className="bg-white rounded-3xl p-6 sm:p-7 border border-gray-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div>
              <h3 className="text-lg font-black text-gray-900">
                Buku Besar Harian Bulan {summary.monthLabel}
              </h3>
              <p className="text-xs text-gray-500">
                Rekap per tanggal transaksi, tonase karkas, omset kotor, HPP, dan estimasi laba harian.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-100 text-gray-700 font-bold text-left border-y border-gray-200">
                  <th className="py-2.5 px-4">Tanggal</th>
                  <th className="py-2.5 px-4 text-center">Jumlah Nota</th>
                  <th className="py-2.5 px-4 text-right">Volume (Kg)</th>
                  <th className="py-2.5 px-4 text-right">Omset Kotor</th>
                  <th className="py-2.5 px-4 text-right">Estimasi HPP</th>
                  <th className="py-2.5 px-4 text-right">Estimasi Bersih</th>
                  <th className="py-2.5 px-4 text-right">Piutang Tempo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {summary.dailyLedger.map((d, i) => (
                  <tr key={i} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4 font-bold text-gray-800">{d.date}</td>
                    <td className="py-3 px-4 text-center font-semibold text-gray-600">{d.receiptsCount} nota</td>
                    <td className="py-3 px-4 text-right font-bold text-blue-700">{formatAngkaIndo(d.kgSold)} kg</td>
                    <td className="py-3 px-4 text-right font-bold text-gray-900">{formatRupiah(d.revenue)}</td>
                    <td className="py-3 px-4 text-right text-rose-600 font-medium">({formatRupiah(d.cogs)})</td>
                    <td className="py-3 px-4 text-right text-emerald-700 font-extrabold">{formatRupiah(d.net)}</td>
                    <td className="py-3 px-4 text-right text-amber-700 font-medium">
                      {d.pendingReceivables > 0 ? formatRupiah(d.pendingReceivables) : 'Lunas'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: EVENT & AGENDA SPESIAL SELECTOR */}
      {isEventModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 border border-gray-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Bookmark className="w-5 h-5 text-amber-600" />
                <h3 className="font-extrabold text-gray-900 text-base">
                  Atur Konteks Event / Agenda Bulan Ini
                </h3>
              </div>
              <button
                onClick={() => setIsEventModalOpen(false)}
                className="text-gray-400 hover:text-gray-700 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-500">
              Pilih atau tulis agenda khusus yang menyebabkan penjualan & omset kotor bulan ini naik, agar AI Konsultan dapat memberikan analisis sebab-akibat yang akurat.
            </p>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {EVENT_PRESETS.map((preset) => (
                <div
                  key={preset.id}
                  onClick={() => {
                    setSelectedEventId(preset.id);
                    setCustomEventText('');
                  }}
                  className={`p-3 rounded-2xl border cursor-pointer transition-all ${
                    selectedEventId === preset.id && !customEventText
                      ? 'bg-amber-50 border-amber-500 shadow-2xs'
                      : 'bg-white border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-900">{preset.name}</span>
                    {selectedEventId === preset.id && !customEventText && (
                      <CheckCircle2 className="w-4 h-4 text-amber-600" />
                    )}
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1">{preset.desc}</p>
                </div>
              ))}
            </div>

            <div className="space-y-1.5 pt-2 border-t border-gray-100">
              <label className="text-xs font-bold text-gray-700">
                Atau Tulis Event / Catatan Khusus Sendiri:
              </label>
              <textarea
                value={customEventText}
                onChange={(e) => setCustomEventText(e.target.value)}
                placeholder="Misal: 'Ada pesanan catering nikahan borongan Pak Ade dan 2 mitra resto baru buka di Bandung...'"
                rows={2}
                className="w-full text-xs p-3 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setIsEventModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  setIsEventModalOpen(false);
                  runAiConsultantAnalysis();
                }}
                className="px-5 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-xs"
              >
                Terapkan & Analisa Ulang AI
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
