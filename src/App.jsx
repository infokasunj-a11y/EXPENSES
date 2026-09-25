import React, { useState, useEffect } from 'react';
import { 
  Banknote, Briefcase, Utensils, Flame, Home, Car, 
  ShoppingBag, Film, Heart, HelpCircle, Plus, Trash2, 
  Edit2, X, BarChart2, List, Settings, Search, 
  RefreshCw, TrendingUp, Calendar, User, ArrowUpRight, 
  ArrowDownRight, Building2, Percent, Sparkles, PieChart, ShieldCheck
} from 'lucide-react';

// Configuration
const CATEGORIES = {
  income: [
    { name: 'Hotel Income', icon: Building2, color: 'bg-gradient-to-r from-amber-500 to-emerald-500', text: 'text-amber-500', isHotel: true },
    { name: 'Salary', icon: Banknote, color: 'bg-emerald-500', text: 'text-emerald-500' },
    { name: 'Business', icon: Briefcase, color: 'bg-blue-500', text: 'text-blue-500' },
    { name: 'Investments', icon: TrendingUp, color: 'bg-teal-500', text: 'text-teal-500' },
    { name: 'Other Income', icon: Plus, color: 'bg-slate-500', text: 'text-slate-500' }
  ],
  expense: [
    { name: 'Food & Drinks', icon: Utensils, color: 'bg-amber-500', text: 'text-amber-500' },
    { name: 'Bills & Utilities', icon: Flame, color: 'bg-red-500', text: 'text-red-500' },
    { name: 'Rent & Home', icon: Home, color: 'bg-indigo-500', text: 'text-indigo-500' },
    { name: 'Transport & Fuel', icon: Car, color: 'bg-cyan-500', text: 'text-cyan-500' },
    { name: 'Shopping', icon: ShoppingBag, color: 'bg-pink-500', text: 'text-pink-500' },
    { name: 'Entertainment', icon: Film, color: 'bg-purple-500', text: 'text-purple-500' },
    { name: 'Medical & Health', icon: Heart, color: 'bg-rose-500', text: 'text-rose-500' },
    { name: 'Other Expense', icon: HelpCircle, color: 'bg-slate-500', text: 'text-slate-500' }
  ]
};

const PROFILES = ['Husband', 'Wife'];

export default function App() {
  // Navigation & UI States
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Data States
  const [transactions, setTransactions] = useState([]);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  const getTodayString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Form States
  const [formType, setFormType] = useState('income');
  const [formAmount, setFormAmount] = useState('');
  const [formCategory, setFormCategory] = useState('Hotel Income');
  const [formCommissionRate, setFormCommissionRate] = useState('23');
  const [formDate, setFormDate] = useState(getTodayString());
  const [formNotes, setFormNotes] = useState('');
  const [formUser, setFormUser] = useState('Husband');
  const [editingId, setEditingId] = useState(null);

  // Filter States
  const [filterType, setFilterType] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Host info
  const [hostUrl, setHostUrl] = useState('');

  // Fetch Transactions on Mount
  useEffect(() => {
    fetchTransactions();
    setHostUrl(window.location.origin);
  }, []);

  const fetchTransactions = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/transactions', {
        headers: {
          'ngrok-skip-browser-warning': 'true'
        }
      });
      if (!response.ok) throw new Error('Failed to fetch transactions');
      const data = await response.json();
      setTransactions(data);
    } catch (err) {
      setError('Cannot connect to server. Running offline or PC server is off.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Pre-fill category when type changes
  useEffect(() => {
    if (!editingId) {
      setFormCategory(CATEGORIES[formType][0].name);
    }
  }, [formType]);

  // Handle Form Submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formAmount || isNaN(formAmount) || parseFloat(formAmount) <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    const isHotel = formCategory === 'Hotel Income';
    const transactionData = {
      amount: parseFloat(formAmount),
      type: formType,
      category: formCategory,
      commissionRate: isHotel ? (parseFloat(formCommissionRate) || 23) : 0,
      date: formDate,
      notes: formNotes.trim(),
      addedBy: isHotel ? 'Common (Hotel)' : formUser
    };

    setLoading(true);
    try {
      let response;
      if (editingId) {
        response = await fetch(`/api/transactions/${editingId}`, {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true'
          },
          body: JSON.stringify(transactionData)
        });
      } else {
        response = await fetch('/api/transactions', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true'
          },
          body: JSON.stringify(transactionData)
        });
      }

      if (!response.ok) throw new Error('Failed to save transaction');
      
      await fetchTransactions();
      closeFormModal();
    } catch (err) {
      alert('Error saving transaction. Check your connection.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Open modal for editing
  const handleEdit = (tx) => {
    setEditingId(tx.id);
    setFormType(tx.type);
    setFormAmount(tx.amount.toString());
    setFormCategory(tx.category);
    setFormCommissionRate((tx.commissionRate !== undefined ? tx.commissionRate : 23).toString());
    setFormDate(tx.date || getTodayString());
    setFormNotes(tx.notes || '');
    setFormUser(tx.addedBy || 'Husband');
    setIsModalOpen(true);
  };

  // Handle Deletion
  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this transaction?')) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/transactions/${id}`, {
        method: 'DELETE',
        headers: {
          'ngrok-skip-browser-warning': 'true'
        }
      });
      if (!response.ok) throw new Error('Failed to delete transaction');
      await fetchTransactions();
    } catch (err) {
      alert('Error deleting transaction.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const closeFormModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setFormAmount('');
    setFormNotes('');
    setFormDate(getTodayString());
    setFormType('income');
    setFormCategory('Hotel Income');
    setFormCommissionRate('23');
    setFormUser('Husband');
  };

  // Date Navigation Helpers
  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  const getMonthName = (m) => {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[m];
  };

  // --- Filtering & Hotel Calculations ---
  
  const monthlyTransactions = transactions.filter(tx => {
    if (!tx.date) return false;
    const parts = tx.date.split('-');
    if (parts.length < 3) return false;
    const txYear = parseInt(parts[0], 10);
    const txMonth = parseInt(parts[1], 10) - 1; // 0-indexed month
    return txYear === currentYear && txMonth === currentMonth;
  });

  // Calculate Hotel Business Aggregates
  const hotelTransactions = monthlyTransactions.filter(t => t.type === 'income' && t.category === 'Hotel Income');
  const totalHotelGross = hotelTransactions.reduce((sum, t) => sum + t.amount, 0);
  const totalHotelCommission = hotelTransactions.reduce((sum, t) => {
    const comm = t.commissionAmount !== undefined ? t.commissionAmount : (t.amount * 0.23);
    return sum + comm;
  }, 0);
  const totalHotelNet = totalHotelGross - totalHotelCommission;

  // Other Incomes
  const nonHotelIncome = monthlyTransactions
    .filter(t => t.type === 'income' && t.category !== 'Hotel Income')
    .reduce((sum, t) => sum + t.amount, 0);

  // Total Real Income (Net Hotel Income + Other Incomes)
  const totalNetIncome = totalHotelNet + nonHotelIncome;
  const totalGrossIncome = totalHotelGross + nonHotelIncome;

  // Total Expenses
  const monthlyExpense = monthlyTransactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  // Net Pocket Savings (Net Income - Expenses)
  const netSavings = totalNetIncome - monthlyExpense;

  // Filtered transactions for History list
  const filteredTransactions = transactions.filter(tx => {
    const txDate = new Date(tx.date);
    const matchesMonth = txDate.getFullYear() === currentYear && txDate.getMonth() === currentMonth;
    const matchesType = filterType === 'all' ? true : tx.type === filterType;
    const matchesCategory = filterCategory === 'all' ? true : tx.category === filterCategory;
    const matchesSearch = searchQuery === '' ? true : (
      (tx.notes && tx.notes.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (tx.category && tx.category.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (tx.addedBy && tx.addedBy.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    return matchesMonth && matchesType && matchesCategory && matchesSearch;
  });

  // Category breakdown for Analytics
  const categoryBreakdown = monthlyTransactions
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount;
      return acc;
    }, {});

  const totalExpenseBreakdown = Object.values(categoryBreakdown).reduce((a, b) => a + b, 0);

  const sortedCategories = Object.keys(categoryBreakdown)
    .map(name => {
      const conf = CATEGORIES.expense.find(c => c.name === name) || { color: 'bg-slate-500', text: 'text-slate-500', icon: HelpCircle };
      const amount = categoryBreakdown[name];
      const percentage = totalExpenseBreakdown > 0 ? Math.round((amount / totalExpenseBreakdown) * 100) : 0;
      return { name, amount, percentage, ...conf };
    })
    .sort((a, b) => b.amount - a.amount);

  // Category Icon helper
  const getCategoryIcon = (categoryName, type) => {
    const pool = type === 'income' ? CATEGORIES.income : CATEGORIES.expense;
    const match = pool.find(c => c.name === categoryName);
    const IconComponent = match ? match.icon : HelpCircle;
    const colorClass = match ? match.color : 'bg-slate-500';
    return (
      <div className={`p-2.5 rounded-2xl ${colorClass} text-white shadow-sm flex items-center justify-center`}>
        <IconComponent size={20} />
      </div>
    );
  };

  // Live Commission calculations for Modal
  const isFormHotel = formCategory === 'Hotel Income';
  const parsedFormAmount = parseFloat(formAmount) || 0;
  const parsedCommissionRate = parseFloat(formCommissionRate) || 23;
  const liveCommissionAmount = isFormHotel ? (parsedFormAmount * (parsedCommissionRate / 100)) : 0;
  const liveNetAmount = isFormHotel ? (parsedFormAmount - liveCommissionAmount) : parsedFormAmount;

  return (
    <div className="flex flex-col min-h-screen bg-slate-900 text-slate-100 max-w-md mx-auto relative shadow-2xl pb-24 font-sans selection:bg-indigo-500 selection:text-white">
      {/* iOS Top Status Bar Padding */}
      <div className="safe-pt bg-gradient-to-b from-indigo-900 via-indigo-950 to-slate-900"></div>

      {/* Modern Glassmorphic Header */}
      <header className="bg-gradient-to-b from-indigo-900 via-indigo-950 to-slate-900 text-white px-5 pt-5 pb-6 rounded-b-[2.5rem] shadow-xl border-b border-indigo-500/20 backdrop-blur-lg relative overflow-hidden">
        {/* Glow backdrop decorative circles */}
        <div className="absolute -top-12 -right-12 w-40 h-40 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-10 -left-10 w-36 h-36 bg-amber-500/15 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex justify-between items-center mb-5 relative z-10">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-400 to-indigo-600 p-0.5 shadow-lg shadow-indigo-500/30">
              <div className="w-full h-full bg-slate-900 rounded-[14px] flex items-center justify-center">
                <Sparkles size={20} className="text-amber-400 animate-pulse" />
              </div>
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-indigo-200">
                අපේ සල්ලි
              </h1>
              <p className="text-2xs text-indigo-300 font-medium">Family Budget & Hotel Tracker</p>
            </div>
          </div>
          <button 
            onClick={fetchTransactions}
            className="p-2.5 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10 backdrop-blur-md transition active:scale-95"
            disabled={loading}
          >
            <RefreshCw size={18} className={`text-indigo-200 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Month Selector */}
        <div className="flex justify-between items-center bg-slate-800/80 border border-slate-700/60 rounded-2xl px-4 py-2.5 backdrop-blur-md shadow-inner relative z-10">
          <button onClick={prevMonth} className="p-1 hover:bg-slate-700/60 rounded-xl text-indigo-300 active:scale-90 transition">◀</button>
          <div className="flex items-center space-x-2">
            <Calendar size={15} className="text-amber-400" />
            <span className="font-semibold text-xs tracking-wide text-slate-100 Outfit">
              {getMonthName(currentMonth)} {currentYear}
            </span>
          </div>
          <button onClick={nextMonth} className="p-1 hover:bg-slate-700/60 rounded-xl text-indigo-300 active:scale-90 transition">▶</button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 px-4 py-4 overflow-y-auto space-y-5">
        {error && (
          <div className="bg-amber-950/60 border border-amber-500/40 text-amber-200 text-xs p-3.5 rounded-2xl flex items-center space-x-2 backdrop-blur-md">
            <span className="text-sm">⚠️</span>
            <p className="flex-1">{error}</p>
          </div>
        )}

        {/* Tab 1: Dashboard Overview */}
        {activeTab === 'dashboard' && (
          <div className="space-y-5 fade-in">
            
            {/* Main Balance Hero Card */}
            <div className="bg-gradient-to-br from-slate-800 via-slate-850 to-indigo-950/90 rounded-3xl p-5 shadow-2xl border border-slate-700/50 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl group-hover:bg-indigo-500/20 transition-all"></div>
              
              <div className="flex justify-between items-center">
                <p className="text-2xs font-semibold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-emerald-400" /> Net Savings Balance
                </p>
                <span className="text-3xs px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/30">
                  Net (Post-23%)
                </span>
              </div>

              <h2 className={`text-3xl font-extrabold Outfit mt-2 tracking-tight ${netSavings >= 0 ? 'text-white' : 'text-rose-400'}`}>
                රු. {netSavings.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h2>
              
              <div className="grid grid-cols-2 gap-3 mt-5 pt-4 border-t border-slate-700/60">
                <div className="flex items-center space-x-2 bg-emerald-950/40 p-2.5 rounded-2xl border border-emerald-500/20">
                  <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
                    <ArrowUpRight size={16} />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] text-slate-400 block font-medium">Net Income</span>
                    <span className="text-xs font-bold text-emerald-400 Outfit truncate block">
                      + {totalNetIncome.toLocaleString('en-US')}
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-2 bg-rose-950/40 p-2.5 rounded-2xl border border-rose-500/20">
                  <div className="p-2 bg-rose-500/20 text-rose-400 rounded-xl">
                    <ArrowDownRight size={16} />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] text-slate-400 block font-medium">Expenses</span>
                    <span className="text-xs font-bold text-rose-400 Outfit truncate block">
                      - {monthlyExpense.toLocaleString('en-US')}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Special Feature: Hotel Earnings & 23% Commission Card */}
            <div className="bg-gradient-to-br from-amber-950/40 via-slate-800 to-emerald-950/30 rounded-3xl p-5 shadow-xl border border-amber-500/30 relative overflow-hidden">
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center space-x-2">
                  <div className="p-2 bg-gradient-to-r from-amber-500 to-emerald-500 text-white rounded-xl shadow-md">
                    <Building2 size={18} />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-100 flex items-center gap-1.5">
                      Hotel Business Summary
                    </h3>
                    <p className="text-3xs text-amber-300">Automated 23% Commission Calculations</p>
                  </div>
                </div>
                <span className="text-3xs bg-amber-500/20 text-amber-300 font-bold px-2.5 py-1 rounded-full border border-amber-500/30 flex items-center gap-1">
                  <Percent size={11} /> 23% OTA Fee
                </span>
              </div>

              {totalHotelGross === 0 ? (
                <div className="py-4 text-center text-slate-400 text-2xs bg-slate-900/40 rounded-2xl border border-slate-800">
                  No Hotel Income recorded for this month yet.
                  <button 
                    onClick={() => { setFormType('income'); setFormCategory('Hotel Income'); setIsModalOpen(true); }}
                    className="mt-2 block mx-auto text-amber-400 font-bold hover:underline"
                  >
                    + Add Hotel Booking Income
                  </button>
                </div>
              ) : (
                <div className="space-y-3 mt-4">
                  {/* Gross vs Commission vs Net Grid */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-slate-900/60 p-2.5 rounded-2xl border border-slate-700/60 text-center">
                      <span className="text-[10px] text-slate-400 block font-medium">Gross Revenue</span>
                      <span className="text-xs font-bold text-amber-400 Outfit block mt-0.5">
                        රු. {totalHotelGross.toLocaleString()}
                      </span>
                    </div>
                    
                    <div className="bg-rose-950/30 p-2.5 rounded-2xl border border-rose-500/30 text-center">
                      <span className="text-[10px] text-rose-300 block font-medium">23% Commission</span>
                      <span className="text-xs font-bold text-rose-400 Outfit block mt-0.5">
                        - රු. {totalHotelCommission.toLocaleString()}
                      </span>
                    </div>

                    <div className="bg-emerald-950/40 p-2.5 rounded-2xl border border-emerald-500/30 text-center">
                      <span className="text-[10px] text-emerald-300 block font-medium">Net Profit</span>
                      <span className="text-xs font-bold text-emerald-400 Outfit block mt-0.5">
                        රු. {totalHotelNet.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Visual Split Bar */}
                  <div className="space-y-1 pt-1">
                    <div className="flex justify-between text-3xs text-slate-400">
                      <span>Keep (77%): <strong>රු. {totalHotelNet.toLocaleString()}</strong></span>
                      <span>Commission (23%): <strong>රු. {totalHotelCommission.toLocaleString()}</strong></span>
                    </div>
                    <div className="w-full bg-rose-500/40 h-2.5 rounded-full overflow-hidden flex">
                      <div className="bg-gradient-to-r from-emerald-500 to-amber-400 h-full" style={{ width: '77%' }}></div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Title & Recent Activity */}
            <div className="flex justify-between items-center px-1">
              <h3 className="font-bold text-slate-200 text-sm tracking-wide">Recent Transactions</h3>
              <button 
                onClick={() => setActiveTab('transactions')} 
                className="text-2xs font-semibold text-indigo-400 hover:text-indigo-300 transition"
              >
                View All →
              </button>
            </div>

            {/* Recent Transactions List */}
            <div className="space-y-2.5">
              {monthlyTransactions.length === 0 ? (
                <div className="bg-slate-800/50 rounded-3xl p-6 text-center text-slate-400 text-xs border border-dashed border-slate-700">
                  No transactions added for this month yet.
                  <button 
                    onClick={() => { setFormType('expense'); setIsModalOpen(true); }}
                    className="mt-3 block mx-auto text-indigo-400 font-bold hover:underline"
                  >
                    + Add Transaction
                  </button>
                </div>
              ) : (
                monthlyTransactions.slice(0, 4).map(tx => (
                  <div 
                    key={tx.id} 
                    className="bg-slate-800/80 hover:bg-slate-800 rounded-2xl p-3 flex items-center justify-between border border-slate-700/60 shadow-sm active:scale-98 transition cursor-pointer"
                    onClick={() => handleEdit(tx)}
                  >
                    <div className="flex items-center space-x-3">
                      {getCategoryIcon(tx.category, tx.type)}
                      <div>
                        <div className="flex items-center space-x-2">
                          <h4 className="font-semibold text-xs text-slate-100">{tx.category}</h4>
                          {tx.category === 'Hotel Income' && (
                            <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded-md font-medium">
                              -23% Comm
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-1.5 text-slate-400 text-3xs mt-0.5">
                          <Calendar size={10} />
                          <span>{tx.date}</span>
                          <span>•</span>
                          <User size={10} />
                          <span>{tx.addedBy}</span>
                          {tx.notes && (
                            <>
                              <span>•</span>
                              <span className="truncate max-w-[80px] italic text-slate-300">"{tx.notes}"</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      {tx.category === 'Hotel Income' ? (
                        <div>
                          <span className="font-bold text-xs Outfit text-emerald-400 block">
                            + { (tx.netAmount !== undefined ? tx.netAmount : (tx.amount * 0.77)).toLocaleString('en-US') }
                          </span>
                          <span className="text-[9px] text-slate-400 line-through block">
                            Gross: {tx.amount.toLocaleString()}
                          </span>
                        </div>
                      ) : (
                        <span className={`font-bold text-xs Outfit ${tx.type === 'income' ? 'text-emerald-400' : 'text-slate-200'}`}>
                          {tx.type === 'income' ? '+' : '-'} {tx.amount.toLocaleString('en-US')}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Expenses Category Progress Breakdown */}
            {sortedCategories.length > 0 && (
              <div className="bg-slate-800/80 rounded-3xl p-5 shadow-sm border border-slate-700/60 space-y-4">
                <h3 className="font-bold text-slate-200 text-xs tracking-wide">Expense Categories</h3>
                <div className="space-y-3">
                  {sortedCategories.slice(0, 3).map(cat => (
                    <div key={cat.name} className="space-y-1.5">
                      <div className="flex justify-between text-2xs">
                        <span className="font-semibold text-slate-300">{cat.name}</span>
                        <span className="text-slate-400 Outfit">
                          රු. {cat.amount.toLocaleString()} ({cat.percentage}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-700/40">
                        <div className={`h-full ${cat.color}`} style={{ width: `${cat.percentage}%` }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Transactions List */}
        {activeTab === 'transactions' && (
          <div className="space-y-4 fade-in">
            {/* Filter controls */}
            <div className="bg-slate-800/80 rounded-3xl p-4 shadow-sm border border-slate-700/60 space-y-3">
              <div className="relative">
                <Search size={16} className="absolute left-3.5 top-3 text-slate-400" />
                <input 
                  type="text"
                  placeholder="Search notes, categories, who added..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-900/90 border border-slate-700 rounded-2xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex space-x-2">
                {['all', 'income', 'expense'].map(t => (
                  <button
                    key={t}
                    onClick={() => setFilterType(t)}
                    className={`flex-1 text-center py-2 text-xs font-semibold rounded-xl capitalize transition ${
                      filterType === t 
                        ? 'bg-indigo-600 text-white shadow-md' 
                        : 'bg-slate-900/60 text-slate-400 hover:bg-slate-700/40'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-between items-center px-1">
              <span className="text-3xs text-slate-400 font-semibold">{filteredTransactions.length} records found</span>
            </div>

            <div className="space-y-2.5">
              {filteredTransactions.length === 0 ? (
                <div className="bg-slate-800/50 rounded-3xl p-8 text-center text-slate-400 text-xs border border-dashed border-slate-700">
                  No matching transactions found.
                </div>
              ) : (
                filteredTransactions.map(tx => (
                  <div 
                    key={tx.id} 
                    className="bg-slate-800/80 rounded-2xl p-3.5 flex items-center justify-between border border-slate-700/60 shadow-sm hover:border-slate-600 transition"
                  >
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      {getCategoryIcon(tx.category, tx.type)}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center space-x-2">
                          <h4 className="font-semibold text-xs text-slate-100">{tx.category}</h4>
                          {tx.category === 'Hotel Income' && (
                            <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded-md font-semibold">
                              -23% Commission
                            </span>
                          )}
                        </div>
                        <p className="text-slate-400 text-3xs mt-0.5 flex flex-wrap items-center gap-1.5">
                          <span className="font-medium text-indigo-300">{tx.addedBy}</span>
                          <span>•</span>
                          <span>{tx.date}</span>
                          {tx.notes && (
                            <>
                              <span>•</span>
                              <span className="text-slate-300 font-normal truncate max-w-[120px]">"{tx.notes}"</span>
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2.5">
                      <div className="text-right">
                        {tx.category === 'Hotel Income' ? (
                          <div>
                            <span className="font-bold text-xs Outfit text-emerald-400 block">
                              + { (tx.netAmount !== undefined ? tx.netAmount : (tx.amount * 0.77)).toLocaleString('en-US') }
                            </span>
                            <span className="text-[9px] text-slate-400 line-through block">
                              Gross: {tx.amount.toLocaleString()}
                            </span>
                          </div>
                        ) : (
                          <span className={`font-bold text-xs Outfit ${tx.type === 'income' ? 'text-emerald-400' : 'text-slate-200'}`}>
                            {tx.type === 'income' ? '+' : '-'} {tx.amount.toLocaleString('en-US')}
                          </span>
                        )}
                      </div>
                      <div className="flex space-x-1">
                        <button 
                          onClick={() => handleEdit(tx)}
                          className="p-1.5 text-slate-400 hover:text-indigo-400 rounded-lg hover:bg-slate-700/50"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button 
                          onClick={() => handleDelete(tx.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-700/50"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Analytics */}
        {activeTab === 'analytics' && (
          <div className="space-y-5 fade-in">
            {/* Visual SVG Donut Chart */}
            <div className="bg-slate-800/80 rounded-3xl p-5 shadow-sm border border-slate-700/60 flex flex-col items-center">
              <h3 className="font-bold text-slate-200 text-xs mb-4 self-start flex items-center gap-1.5">
                <PieChart size={16} className="text-indigo-400" /> Expense Distribution
              </h3>
              
              {sortedCategories.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs w-full">
                  Add expenses to see category breakdown.
                </div>
              ) : (
                <div className="w-full flex flex-col items-center">
                  <div className="relative w-44 h-44 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="40" fill="transparent" stroke="#1e293b" strokeWidth="12" />
                      {(() => {
                        let accumulatedPercent = 0;
                        return sortedCategories.map((cat) => {
                          const strokeDash = `${cat.percentage} ${100 - cat.percentage}`;
                          const strokeOffset = 100 - accumulatedPercent;
                          accumulatedPercent += cat.percentage;
                          
                          const colorMap = {
                            'bg-amber-500': '#f59e0b',
                            'bg-red-500': '#ef4444',
                            'bg-indigo-500': '#6366f1',
                            'bg-cyan-500': '#06b6d4',
                            'bg-pink-500': '#ec4899',
                            'bg-purple-500': '#a855f7',
                            'bg-rose-500': '#f43f5e',
                            'bg-slate-500': '#64748b'
                          };
                          const strokeColor = colorMap[cat.color] || '#64748b';

                          return (
                            <circle
                              key={cat.name}
                              cx="50"
                              cy="50"
                              r="40"
                              fill="transparent"
                              stroke={strokeColor}
                              strokeWidth="12"
                              strokeDasharray={strokeDash}
                              strokeDashoffset={strokeOffset}
                              pathLength="100"
                            />
                          );
                        });
                      })()}
                    </svg>
                    <div className="absolute flex flex-col items-center justify-center text-center">
                      <span className="text-[10px] text-slate-400 font-semibold uppercase">Total Outflow</span>
                      <span className="text-sm font-extrabold Outfit text-slate-100">
                        රු. {monthlyExpense.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 w-full mt-6 border-t border-slate-700/50 pt-4">
                    {sortedCategories.map(cat => (
                      <div key={cat.name} className="flex items-center space-x-2">
                        <div className={`w-3 h-3 rounded-full ${cat.color}`}></div>
                        <div className="min-w-0 flex-1">
                          <span className="text-3xs font-semibold text-slate-200 block truncate">{cat.name}</span>
                          <span className="text-[10px] text-slate-400 font-bold Outfit">
                            රු. {cat.amount.toLocaleString()} ({cat.percentage}%)
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Husband vs Wife Spend breakdown */}
            <div className="bg-slate-800/80 rounded-3xl p-5 shadow-sm border border-slate-700/60 space-y-4">
              <h3 className="font-bold text-slate-200 text-xs">Spend by Person</h3>
              <div className="space-y-4">
                {PROFILES.map(user => {
                  const totalSpent = monthlyTransactions
                    .filter(t => t.addedBy === user && t.type === 'expense')
                    .reduce((sum, t) => sum + t.amount, 0);

                  const percentage = monthlyExpense > 0 ? Math.round((totalSpent / monthlyExpense) * 100) : 0;
                  const color = user === 'Husband' ? 'bg-indigo-500' : 'bg-pink-500';

                  return (
                    <div key={user} className="space-y-1.5">
                      <div className="flex justify-between text-2xs">
                        <div className="flex items-center space-x-2">
                          <div className={`w-2.5 h-2.5 rounded-full ${color}`}></div>
                          <span className="font-bold text-slate-200">{user}</span>
                        </div>
                        <span className="text-slate-400 font-semibold text-3xs">
                          Expenses: <strong className="text-slate-100 Outfit">රු. {totalSpent.toLocaleString()}</strong> ({percentage}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden border border-slate-700/50">
                        <div className={`h-full ${color}`} style={{ width: `${percentage}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Sync & Settings */}
        {activeTab === 'settings' && (
          <div className="space-y-5 fade-in">
            <div className="bg-slate-800/80 rounded-3xl p-5 shadow-sm border border-slate-700/60 space-y-4 text-center">
              <h3 className="font-bold text-slate-200 text-xs text-left">Connect Wife's iPhone</h3>
              <p className="text-slate-400 text-2xs text-left leading-relaxed">
                Scan this QR code using Safari Camera on your wife's iPhone to open and share this budget tracker.
              </p>
              
              {hostUrl && (
                <div className="flex flex-col items-center justify-center p-3 bg-slate-900/80 rounded-2xl border border-slate-700">
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(hostUrl)}&color=6366f1&bgcolor=0f172a`}
                    alt="QR Code to connect phone"
                    className="w-40 h-40 bg-slate-900 p-2 rounded-xl border border-slate-700"
                  />
                  <span className="text-3xs text-indigo-400 font-mono select-all font-semibold break-all max-w-[280px] mt-3">
                    {hostUrl}
                  </span>
                </div>
              )}
            </div>

            <div className="bg-slate-800/80 rounded-3xl p-5 shadow-sm border border-slate-700/60 space-y-3">
              <h3 className="font-bold text-slate-200 text-xs">iPhone Install Guide (iOS PWA)</h3>
              <ol className="text-2xs text-slate-300 space-y-2 list-decimal pl-4 leading-relaxed">
                <li>Open the link in <strong className="text-white">Safari Browser</strong>.</li>
                <li>Tap the <strong className="text-white">Share button</strong> (square icon with arrow pointing up).</li>
                <li>Scroll down and tap <strong className="text-indigo-400 font-bold">"Add to Home Screen"</strong>.</li>
                <li>Tap <strong className="text-white">"Add"</strong> at the top right.</li>
              </ol>
            </div>
          </div>
        )}
      </main>

      {/* Floating Add Action Button */}
      <button 
        onClick={() => { setEditingId(null); setIsModalOpen(true); }}
        className="fixed bottom-22 left-1/2 -translate-x-1/2 w-14 h-14 bg-gradient-to-tr from-indigo-600 to-amber-500 hover:from-indigo-500 hover:to-amber-400 text-white rounded-full flex items-center justify-center shadow-2xl active:scale-95 transition z-30 border border-white/20"
      >
        <Plus size={28} />
      </button>

      {/* iOS-Style Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-slate-900/95 backdrop-blur-xl border-t border-slate-800 px-6 py-3 flex justify-between items-center safe-pb shadow-2xl z-20">
        <button 
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center space-y-1 transition ${activeTab === 'dashboard' ? 'text-amber-400 font-bold' : 'text-slate-400 hover:text-slate-200'}`}
        >
          <List size={20} />
          <span className="text-[10px]">Overview</span>
        </button>

        <button 
          onClick={() => setActiveTab('transactions')}
          className={`flex flex-col items-center space-y-1 transition ${activeTab === 'transactions' ? 'text-amber-400 font-bold' : 'text-slate-400 hover:text-slate-200'}`}
        >
          <List size={20} />
          <span className="text-[10px]">History</span>
        </button>

        <div className="w-10"></div>

        <button 
          onClick={() => setActiveTab('analytics')}
          className={`flex flex-col items-center space-y-1 transition ${activeTab === 'analytics' ? 'text-amber-400 font-bold' : 'text-slate-400 hover:text-slate-200'}`}
        >
          <BarChart2 size={20} />
          <span className="text-[10px]">Analytics</span>
        </button>

        <button 
          onClick={() => setActiveTab('settings')}
          className={`flex flex-col items-center space-y-1 transition ${activeTab === 'settings' ? 'text-amber-400 font-bold' : 'text-slate-400 hover:text-slate-200'}`}
        >
          <Settings size={20} />
          <span className="text-[10px]">Sync</span>
        </button>
      </nav>

      {/* Slide-up Transaction Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-end justify-center">
          <div className="absolute inset-0" onClick={closeFormModal}></div>
          
          <div className="bg-slate-900 border-t border-slate-700/80 rounded-t-[2.5rem] w-full max-w-md p-6 relative z-10 animate-slide-up pb-8 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="w-12 h-1 bg-slate-700 rounded-full mx-auto mb-4"></div>
            
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Sparkles size={18} className="text-amber-400" />
                {editingId ? 'Edit Entry' : 'New Transaction'}
              </h3>
              <button 
                onClick={closeFormModal}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-full text-slate-400"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Type Switcher */}
              <div className="flex space-x-2 bg-slate-950 p-1 rounded-2xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setFormType('income')}
                  className={`flex-1 text-center py-2 text-xs font-bold rounded-xl transition ${
                    formType === 'income' 
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md' 
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Income
                </button>
                <button
                  type="button"
                  onClick={() => setFormType('expense')}
                  className={`flex-1 text-center py-2 text-xs font-bold rounded-xl transition ${
                    formType === 'expense' 
                      ? 'bg-gradient-to-r from-rose-600 to-pink-600 text-white shadow-md' 
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Expense
                </button>
              </div>

              {/* Amount Input */}
              <div className="space-y-1">
                <label className="text-3xs font-bold text-slate-400 uppercase tracking-wider block">Amount (රු.)</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-3 text-slate-400 font-semibold Outfit text-xs">LKR</span>
                  <input 
                    type="number" 
                    step="0.01"
                    placeholder="0.00"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    required
                    className="w-full pl-12 pr-4 py-3 bg-slate-950 border border-slate-700 rounded-2xl font-bold text-white text-base focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Profile Switcher or Common Hotel Indicator */}
              <div className="space-y-1">
                <label className="text-3xs font-bold text-slate-400 uppercase tracking-wider block">
                  {isFormHotel ? 'Income Type' : 'Added By'}
                </label>
                {isFormHotel ? (
                  <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-between text-2xs text-amber-300 backdrop-blur-md">
                    <span className="font-semibold flex items-center gap-1.5">
                      <Building2 size={14} className="text-amber-400" /> Common Hotel Business Revenue
                    </span>
                    <span className="text-[9px] font-bold bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-md border border-amber-500/30">
                      Family Shared
                    </span>
                  </div>
                ) : (
                  <div className="flex space-x-3">
                    {PROFILES.map(user => (
                      <button
                        key={user}
                        type="button"
                        onClick={() => setFormUser(user)}
                        className={`flex-1 py-2 text-xs font-semibold rounded-xl border transition ${
                          formUser === user
                            ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300 font-bold'
                            : 'border-slate-800 bg-slate-950 text-slate-400 hover:bg-slate-800'
                        }`}
                      >
                        {user}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Category Grid */}
              <div className="space-y-1.5">
                <label className="text-3xs font-bold text-slate-400 uppercase tracking-wider block">Category</label>
                <div className="grid grid-cols-4 gap-2">
                  {CATEGORIES[formType].map(cat => {
                    const CatIcon = cat.icon;
                    const isSelected = formCategory === cat.name;
                    return (
                      <button
                        key={cat.name}
                        type="button"
                        onClick={() => setFormCategory(cat.name)}
                        className={`p-2 flex flex-col items-center justify-center rounded-xl border transition active:scale-95 ${
                          isSelected 
                            ? `${cat.color} text-white border-transparent shadow-md font-semibold` 
                            : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-850'
                        }`}
                      >
                        <CatIcon size={18} />
                        <span className="text-[10px] mt-1 text-center truncate w-full">{cat.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* SPECIAL: Live 23% Hotel Commission Calculator Preview Box */}
              {isFormHotel && (
                <div className="bg-amber-950/40 border border-amber-500/40 p-3.5 rounded-2xl space-y-2 backdrop-blur-md">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                      <Building2 size={15} /> Hotel 23% Commission Preview
                    </span>
                    <div className="flex items-center space-x-1">
                      <input 
                        type="number"
                        value={formCommissionRate}
                        onChange={(e) => setFormCommissionRate(e.target.value)}
                        className="w-10 px-1 py-0.5 text-3xs bg-slate-900 border border-amber-500/50 rounded text-center text-amber-300 font-bold focus:outline-none"
                      />
                      <span className="text-3xs text-amber-300 font-bold">%</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                    <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-800">
                      <span className="text-[9px] text-slate-400 block">Gross Total</span>
                      <span className="text-xs font-bold text-slate-200 Outfit">
                        රු. {parsedFormAmount.toLocaleString()}
                      </span>
                    </div>

                    <div className="bg-rose-950/40 p-2 rounded-xl border border-rose-500/30">
                      <span className="text-[9px] text-rose-300 block">-{parsedCommissionRate}% Comm.</span>
                      <span className="text-xs font-bold text-rose-400 Outfit">
                        - රු. {liveCommissionAmount.toLocaleString()}
                      </span>
                    </div>

                    <div className="bg-emerald-950/40 p-2 rounded-xl border border-emerald-500/30">
                      <span className="text-[9px] text-emerald-300 block">Net Payout</span>
                      <span className="text-xs font-bold text-emerald-400 Outfit">
                        රු. {liveNetAmount.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Date Input */}
              <div className="space-y-1">
                <label className="text-3xs font-bold text-slate-400 uppercase tracking-wider block">Date</label>
                <input 
                  type="date" 
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-2xl text-xs font-semibold text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Notes Input */}
              <div className="space-y-1">
                <label className="text-3xs font-bold text-slate-400 uppercase tracking-wider block">Notes / Guest Details</label>
                <input 
                  type="text" 
                  placeholder="e.g. Booking.com ref, Keells, fuel..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-2xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-amber-500 hover:from-indigo-500 hover:to-amber-400 text-white rounded-2xl font-bold text-xs shadow-xl active:scale-98 transition mt-3"
              >
                {editingId ? 'Update Entry' : 'Save Entry'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
