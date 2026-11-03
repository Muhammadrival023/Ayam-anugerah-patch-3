export type TransactionType = 'income' | 'expense';

export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  amount: number;
  category: string;
  description: string;
  date: string; // YYYY-MM-DD
  paymentMethod: string; // 'Tunai' | 'Transfer BCA' | 'QRIS' | dll
  receiptNumber: string; // e.g. RCP-20261101-009
  note?: string;
  tags?: string[];
  createdAt: string;
  updatedAt?: string;
}

export interface Category {
  id: string;
  userId: string;
  name: string;
  type: TransactionType;
  icon: string;
  color: string;
  budget?: number;
  createdAt: string;
}

export type BillFrequency = 'monthly' | 'weekly' | 'yearly' | 'once';
export type BillStatus = 'unpaid' | 'paid' | 'overdue';

export interface Bill {
  id: string;
  userId: string;
  title: string;
  amount: number;
  category: string;
  dueDate: string; // YYYY-MM-DD
  repeatFrequency: BillFrequency;
  status: BillStatus;
  reminderDaysBefore: number;
  notes?: string;
  paidAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface DateFilter {
  type: 'all' | 'today' | '7days' | 'thisMonth' | 'lastMonth' | 'thisYear' | 'custom';
  startDate?: string;
  endDate?: string;
}

export interface FinancialSummary {
  totalIncome: number;
  totalExpense: number;
  netBalance: number;
  savingsRate: number;
  pendingBillsCount: number;
  pendingBillsAmount: number;
  overdueBillsCount: number;
}

export interface PoultryInvoiceItem {
  id: string;
  date: string;
  customerName: string;
  productName: string;
  weightKg: number;
  pricePerKg: number;
  totalAmount: number;
  paymentTerms: string;
  dueDate: string;
  notes?: string;
  status: 'unpaid' | 'paid';
}

export interface CashFlowAIAnalysis {
  healthScore: number;
  healthStatus: string;
  summaryAnalysis: string;
  receivablesRisk: string;
  cashFlowForecast: string;
  actionRecommendations: string[];
}

// Receipt Item for Ayam @ Anugerah multi-item receipts
export interface AyamReceiptLineItem {
  name: string; // 'Ayam Gebrus', 'Ati', 'Usus', etc.
  detailLabel?: string; // '(30 ekor)', '(470 ekor)', '(55 ekor)'
  quantity: number; // 50.6, 30, 5
  unit: string; // 'kg', 'bj'
  price: number; // 25500, 1500, 15000
  total: number;
}

export interface AyamAnugrahReceipt {
  id: string;
  userId: string;
  receiptNumber: string;
  date: string; // e.g. '2026-11-02' or '01 Nov 2026'
  time?: string; // e.g. '00:57:55'
  customerName: string; // e.g. 'Ahmad'
  customerCode?: string; // e.g. '70 e' or '#08'
  noteBox?: string; // e.g. 'Ket: Pita Putih'
  items: AyamReceiptLineItem[];
  totalAmount: number;
  status: 'BELUM LUNAS' | 'LUNAS';
  paymentType?: string; // e.g. 'kredit' | 'tunai'
  dueDate?: string; // e.g. '09/11/2026'
  remainingDebt?: number; // Sisa utang
  paidAmount?: number; // History pembayaran utang
  historyDate?: string; // e.g. '02/11/2026'
  storeHeaderName?: string; // 'aa anugrah'
  storePhone?: string; // '085735144958'
  storeHandle?: string; // '@@ anugrah'
  createdAt: string;
  docId?: string;
  firestoreDocId?: string;
}

export interface CustomerSalesSummary {
  name: string;
  code?: string;
  totalAmount: number;
  totalKg: number;
  orderCount: number;
  statusSummary: string;
}

export interface ProductSalesSummary {
  name: string;
  quantity: number;
  unit: string;
  revenue: number;
  percentage: number;
}

export interface DayPatternSummary {
  dayName: string;
  volumeKg: number;
  revenue: number;
  orderCount: number;
  isPeakDay?: boolean;
}

export interface MonthlyBookkeepingSummary {
  monthKey: string;
  monthLabel: string;
  grossRevenue: number;
  cogsHpp: number;
  grossProfit: number;
  grossMarginPct: number;
  operatingExpenses: number;
  netProfit: number;
  netMarginPct: number;
  totalKgSold: number;
  totalPieces: number;
  averagePricePerKg: number;
  totalPaidRevenue: number;
  totalPendingReceivables: number;
  paidPercentage: number;
  receiptCount: number;
  momGrowth: {
    revenueGrowthPct: number;
    profitGrowthPct: number;
    volumeGrowthPct: number;
  };
  topCustomers: CustomerSalesSummary[];
  productBreakdown: ProductSalesSummary[];
  dayOfWeekPattern: DayPatternSummary[];
  dailyLedger: {
    date: string;
    receiptsCount: number;
    kgSold: number;
    revenue: number;
    cogs: number;
    net: number;
    pendingReceivables: number;
  }[];
}

export interface AIConsultantAnalysis {
  executiveSummary: string;
  eventContextAttribution: {
    headline: string;
    explanation: string;
    eventImpactScore: number;
    keyDrivers: string[];
    suggestedEventsIdentified: string[];
  };
  salesPatternInsights: {
    peakDaysAnalysis: string;
    productMarginAnalysis: string;
    customerParetoAnalysis: string;
    cashCycleAnalysis: string;
  };
  nextMonthOptimizationPlaybook: {
    projectedTargetRevenue: number;
    projectedTargetKg: number;
    livebirdSupplyStrategy: string;
    pricingAndBundlingTactic: string;
    receivablesCashflowControl: string;
    actionSteps: string[];
  };
  consultantQuote: string;
}
