import { useState, useEffect, useRef } from 'react';
import { FaTrash, FaPlus, FaMinus, FaCopy, FaCog, FaTimes, FaClipboardList, FaArchive, FaSave, FaCheck, FaCalendarAlt, FaWhatsapp, FaLayerGroup, FaBoxOpen, FaTags, FaUserPlus, FaUsers, FaEye, FaEyeSlash } from 'react-icons/fa';

type Mode = 'Normal' | 'ALL' | 'BOX (3)' | 'BOX (6)' | 'BOX (4)' | 'BOX (12)' | 'BOX (24)';

interface EntryItem {
  id: number;
  category: string;
  rate: number;
  baseRate: number;
  mode: Mode;
  originalQty: number;
  multiplier: number;
  effectiveQty: number;
  itemCollection: number;
  itemBase: number;
  itemCommission: number;
}

interface CustomerBill {
  id: string;
  name: string;
  entries: EntryItem[];
}

interface RateTier {
  coll: number;
  base: number;
}

interface SavedSummary {
  id: string;
  name: string;
  date: string;
  summaryText: string;
  entries?: EntryItem[];
  isGrandTotal?: boolean;
}

const DEFAULT_RATES: Record<string, RateTier[]> = {
  '1D': [{ coll: 11.00, base: 10.50 }],
  '2D': [{ coll: 11.50, base: 10.50 }],
  '3D': [
    { coll: 10.00, base: 8.50 },
    { coll: 22.00, base: 20.00 },
    { coll: 28.00, base: 25.00 },
    { coll: 55.00, base: 50.00 },
  ],
  '4D': [
    { coll: 18.00, base: 15.00 },
    { coll: 49.00, base: 45.00 },
    { coll: 98.00, base: 90.00 },
  ]
};

const MULTIPLIERS: Record<string, number> = {
  'Normal': 1,
  'ALL': 3,
  'BOX (3)': 3,
  'BOX (4)': 4,
  'BOX (6)': 6,
  'BOX (12)': 12,
  'BOX (24)': 24,
};

export default function App() {
  const [ratesConfig, setRatesConfig] = useState<Record<string, RateTier[]>>(() => {
    const savedRates = localStorage.getItem('customRates');
    return savedRates ? JSON.parse(savedRates) : DEFAULT_RATES;
  });

  const [customers, setCustomers] = useState<CustomerBill[]>(() => {
    const saved = localStorage.getItem('multiCustomerBills');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* fallback */ }
    }
    return [{ id: '1', name: 'Customer 1', entries: [] }];
  });

  const [activeCustomerId, setActiveCustomerId] = useState<string>(() => {
    return customers[0]?.id || '1';
  });

  const [archives, setArchives] = useState<SavedSummary[]>(() => {
    const saved = localStorage.getItem('archives');
    return saved ? JSON.parse(saved) : [];
  });

  const [currentQty, setCurrentQty] = useState<number>(0);
  const [category, setCategory] = useState('3D');
  const [collectionRate, setCollectionRate] = useState(22.00);
  const [mode, setMode] = useState<Mode>('Normal');
  
  const [showSummary, setShowSummary] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [tempRates, setTempRates] = useState<Record<string, RateTier[]>>(DEFAULT_RATES);
  const [showArchives, setShowArchives] = useState(false);
  
  const [showSavePrompt, setShowSavePrompt] = useState(false);
  const [summaryName, setSummaryName] = useState('');
  const [clearAfterSave, setClearAfterSave] = useState(true);
  const [archiveDateFilter, setArchiveDateFilter] = useState<string>('');
  const [archiveTab, setArchiveTab] = useState<'Normal' | 'Grand'>('Normal');

  // Privacy Toggle State (Hides Base & Commission when true)
  const [hideSensitiveDetails, setHideSensitiveDetails] = useState(false);

  const [saveTarget, setSaveTarget] = useState<'current' | 'combined'>('current');
  const [selectedArchives, setSelectedArchives] = useState<Set<string>>(new Set());
  const [showGrandTotalModal, setShowGrandTotalModal] = useState(false);
  const [grandTotalText, setGrandTotalText] = useState('');
  const [isSavingGrandTotal, setIsSavingGrandTotal] = useState(false);
  
  const [toastMessage, setToastMessage] = useState('');
  const [confirmDialog, setConfirmDialog] = useState<{ message: string, onConfirm: () => void } | null>(null);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeCustomer = customers.find(c => c.id === activeCustomerId) || customers[0];
  const entries = activeCustomer ? activeCustomer.entries : [];

  useEffect(() => {
    localStorage.setItem('multiCustomerBills', JSON.stringify(customers));
  }, [customers]);

  useEffect(() => {
    localStorage.setItem('archives', JSON.stringify(archives));
  }, [archives]);

  const allOrderedRates = Object.entries(ratesConfig).flatMap(([cat, rates]) => 
    rates.map(r => ({ cat, rate: r.coll }))
  );

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const handleAddCustomer = () => {
    const newId = Date.now().toString();
    const newName = `Customer ${customers.length + 1}`;
    setCustomerNameInput(newName);
    setEditingCustId(newId);
    setCustomers([...customers, { id: newId, name: newName, entries: [] }]);
    setActiveCustomerId(newId);
    showToast(`Added ${newName}`);
  };

  const [editingCustId, setEditingCustId] = useState<string | null>(null);
  const [customerNameInput, setCustomerNameInput] = useState('');

  const handleSaveCustomerName = (id: string) => {
    if (!customerNameInput.trim()) return;
    setCustomers(customers.map(c => c.id === id ? { ...c, name: customerNameInput.trim() } : c));
    setEditingCustId(null);
  };

  const handleRemoveCustomer = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (customers.length <= 1) {
      showToast("You must keep at least one active bill.");
      return;
    }
    setConfirmDialog({
      message: "Close this customer bill?",
      onConfirm: () => {
        const remaining = customers.filter(c => c.id !== id);
        setCustomers(remaining);
        if (activeCustomerId === id) {
          setActiveCustomerId(remaining[0].id);
        }
        setConfirmDialog(null);
        showToast("Customer bill closed");
      }
    });
  };

  const updateActiveEntries = (newEntries: EntryItem[]) => {
    setCustomers(customers.map(c => c.id === activeCustomerId ? { ...c, entries: newEntries } : c));
  };

  const handleAdd = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    if (currentQty > 0) {
      let currentRateObj = ratesConfig[category]?.find(r => r.coll === collectionRate);
      if (!currentRateObj) {
        currentRateObj = Object.values(ratesConfig).flat().find(r => r.coll === collectionRate);
      }
      
      const baseRate = currentRateObj ? currentRateObj.base : (collectionRate * 0.85);
      const multiplier = MULTIPLIERS[mode] || 1;

      const effectiveQty = currentQty * multiplier;
      const itemCollection = Math.round((effectiveQty * collectionRate) * 100) / 100;
      const itemBase = Math.round((effectiveQty * baseRate) * 100) / 100;
      const itemCommission = Math.round((itemCollection - itemBase) * 100) / 100;

      const newEntry: EntryItem = {
        id: Date.now(), category, rate: collectionRate, baseRate, mode,
        originalQty: currentQty, multiplier, effectiveQty, itemCollection, itemBase, itemCommission
      };

      updateActiveEntries([newEntry, ...entries]);
      setCurrentQty(0);
      setMode('Normal'); 
      if (navigator.vibrate) navigator.vibrate(50);
    }
  };

  const handleUpdateQty = (id: number, newQty: number) => {
    if (isNaN(newQty) || newQty < 0) return;
    
    const updated = entries.map(entry => {
      if (entry.id === id) {
        const effectiveQty = newQty * entry.multiplier;
        const itemCollection = Math.round((effectiveQty * entry.rate) * 100) / 100;
        const itemBase = Math.round((effectiveQty * entry.baseRate) * 100) / 100;
        const itemCommission = Math.round((itemCollection - itemBase) * 100) / 100;
        return { ...entry, originalQty: newQty, effectiveQty, itemCollection, itemBase, itemCommission };
      }
      return entry;
    });
    updateActiveEntries(updated);
  };

  const handleDelete = (id: number) => {
    updateActiveEntries(entries.filter(entry => entry.id !== id));
  };

  const handleClearAll = () => {
    setConfirmDialog({
      message: `Clear all entries for ${activeCustomer.name}?`,
      onConfirm: () => {
        updateActiveEntries([]);
        setConfirmDialog(null);
        showToast("Entries cleared for current customer");
      }
    });
  };

  const generateSummaryText = (sourceEntries: EntryItem[] = entries, isGrandTotal = false, customTitle = '') => {
    const now = new Date();
    let text = customTitle ? `${customTitle}\n` : (isGrandTotal 
      ? `GRAND TOTAL REPORT\nGenerated: ${now.toLocaleDateString()} ${now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}\n\n`
      : `${activeCustomer.name.toUpperCase()} REPORT\nGenerated: ${now.toLocaleDateString()} ${now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}\n\n`);
    
    let grandColl = 0;
    let grandBase = 0;
    let grandComm = 0;

    ['1D', '2D', '3D', '4D'].forEach(cat => {
      const catEntries = sourceEntries.filter(e => e.category === cat);
      if (catEntries.length === 0) return;
      
      text += `${cat}\n`;
      const uniqueRates = [...new Set(catEntries.map(e => e.rate))].sort((a, b) => a - b);
      
      uniqueRates.forEach(rate => {
        const group = catEntries.filter(e => e.rate === rate);
        const totalQty = group.reduce((sum, e) => sum + e.effectiveQty, 0);
        const totalColl = group.reduce((sum, e) => sum + e.itemCollection, 0);
        const totalBase = group.reduce((sum, e) => sum + e.itemBase, 0);
        const totalComm = group.reduce((sum, e) => sum + e.itemCommission, 0);
        
        grandColl += totalColl;
        grandBase += totalBase;
        grandComm += totalComm;

        text += `Rs.${rate} x ${totalQty} Qty : ${totalColl.toFixed(2)} - ${totalBase.toFixed(2)} = ${totalComm.toFixed(2)}\n`;
      });
      text += '\n';
    });

    if (sourceEntries.length > 0) {
      text += `------------------------\n`;
      text += `TOTALS\n`;
      text += `Collection: Rs.${grandColl.toFixed(2)}\n`;
      text += `Base:        Rs.${grandBase.toFixed(2)}\n`;
      text += `Commission: Rs.${grandComm.toFixed(2)}\n`;
    }

    return text.trim();
  };

  const generateAllCustomersCombinedText = () => {
    const allEntries = customers.flatMap(c => c.entries);
    const now = new Date();
    let text = `ALL CUSTOMERS COMBINED REPORT\nGenerated: ${now.toLocaleDateString()} ${now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}\n\n`;
    
    customers.forEach(cust => {
      if (cust.entries.length > 0) {
        text += `=== ${cust.name.toUpperCase()} ===\n`;
        text += generateSummaryText(cust.entries, false, '') + `\n\n`;
      }
    });

    let grandColl = allEntries.reduce((s, e) => s + e.itemCollection, 0);
    let grandBase = allEntries.reduce((s, e) => s + e.itemBase, 0);
    let grandComm = allEntries.reduce((s, e) => s + e.itemCommission, 0);

    if (allEntries.length > 0) {
      text += `========================\n`;
      text += `GRAND OVERALL TOTALS (${customers.length} Customers)\n`;
      text += `Collection: Rs.${grandColl.toFixed(2)}\n`;
      text += `Base:        Rs.${grandBase.toFixed(2)}\n`;
      text += `Commission: Rs.${grandComm.toFixed(2)}\n`;
    }
    return text.trim();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast("Copied to clipboard!");
  };

  const shareToWhatsApp = (text: string) => {
    const encodedText = encodeURIComponent(text);
    window.open(`https://wa.me/?text=${encodedText}`, '_blank');
  };

  const initiateSaveArchive = (target: 'current' | 'combined') => {
    const allEntries = customers.flatMap(c => c.entries);
    if (target === 'current' && entries.length === 0) return showToast(`No entries for ${activeCustomer.name}.`);
    if (target === 'combined' && allEntries.length === 0) return showToast("No entries across any customer.");

    setSaveTarget(target);
    setIsSavingGrandTotal(false);
    setSummaryName(target === 'current' ? `${activeCustomer.name} Summary` : `All Customers Combined`);
    setShowSavePrompt(true);
  };

  const confirmSaveArchive = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!summaryName || summaryName.trim() === "") {
      showToast("Please enter a valid name.");
      return;
    }
    
    const allEntries = customers.flatMap(c => c.entries);
    const targetEntries = saveTarget === 'current' ? [...entries] : allEntries;
    const targetSummaryText = saveTarget === 'current' ? generateSummaryText(entries) : generateAllCustomersCombinedText();

    const newArchive: SavedSummary = {
      id: Date.now().toString(),
      name: summaryName.trim(),
      date: new Date().toLocaleString([], { 
        year: 'numeric', month: 'short', day: 'numeric', 
        hour: '2-digit', minute:'2-digit' 
      }),
      summaryText: targetSummaryText,
      entries: targetEntries
    };
    
    setArchives([newArchive, ...archives]);
    if (clearAfterSave) {
      if (saveTarget === 'current') {
        updateActiveEntries([]);
      } else {
        setCustomers(customers.map(c => ({ ...c, entries: [] })));
      }
    }
    
    setShowSavePrompt(false);
    setShowSummary(false);
    
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    setArchiveDateFilter(todayStr);
    setArchiveTab('Normal'); 
    setShowArchives(true);
    showToast("Summary saved successfully!");
  };

  const toggleArchiveSelection = (id: string) => {
    const newSet = new Set(selectedArchives);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedArchives(newSet);
  };

  const selectAllFiltered = () => {
    if (selectedArchives.size === filteredArchives.length) {
      setSelectedArchives(new Set()); 
    } else {
      const newSet = new Set<string>();
      filteredArchives.forEach(arc => newSet.add(arc.id));
      setSelectedArchives(newSet);
    }
  };

  const handleGenerateGrandTotal = () => {
    const selected = archives.filter(arc => selectedArchives.has(arc.id));
    let combinedEntries: EntryItem[] = [];
    selected.forEach(arc => {
      if (arc.entries && arc.entries.length > 0) {
        combinedEntries = [...combinedEntries, ...arc.entries];
      }
    });

    setGrandTotalText(generateSummaryText(combinedEntries, true));
    setShowGrandTotalModal(true);
  };

  const openSettings = () => {
    setTempRates(JSON.parse(JSON.stringify(ratesConfig)));
    setShowSettings(true);
  };

  const handleSaveSettings = () => {
    setRatesConfig(tempRates);
    localStorage.setItem('customRates', JSON.stringify(tempRates));
    setShowSettings(false);
    showToast("Settings saved!");
  };

  const handleResetSettings = () => {
    setConfirmDialog({
      message: "Reset all rates to default?",
      onConfirm: () => {
        setRatesConfig(DEFAULT_RATES);
        localStorage.setItem('customRates', JSON.stringify(DEFAULT_RATES));
        setShowSettings(false);
        setConfirmDialog(null);
        showToast("Rates reset to default");
      }
    });
  };

  const updateTempRate = (cat: string, index: number, field: 'coll' | 'base', value: number) => {
    const newRates = { ...tempRates };
    newRates[cat][index][field] = value;
    setTempRates(newRates);
  };

  const handleExportData = () => {
    const dataToExport = { ratesConfig, customers, archives };
    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `SharunsApp_MultiBill_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showToast("Backup exported successfully!");
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedData = JSON.parse(event.target?.result as string);
        if (importedData.ratesConfig) setRatesConfig(importedData.ratesConfig);
        if (importedData.customers) {
          setCustomers(importedData.customers);
          setActiveCustomerId(importedData.customers[0]?.id || '1');
        }
        if (importedData.archives) setArchives(importedData.archives);
        showToast("Backup restored successfully!");
        setShowSettings(false);
      } catch (error) {
        showToast("Error reading backup file.");
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const getAvailableModes = () => {
    const modes: Mode[] = ['Normal'];
    if (category === '1D' || category === '2D') modes.push('ALL');
    if (category === '3D') modes.push('BOX (3)', 'BOX (6)');
    if (category === '4D') modes.push('BOX (4)', 'BOX (6)', 'BOX (12)', 'BOX (24)');
    return modes;
  };

  const getCatStyles = (cat: string, isSelected: boolean) => {
    switch (cat) {
      case '1D': return isSelected ? 'bg-rose-600 border-rose-400 text-white shadow-md' : 'border-rose-900/60 text-rose-400 bg-slate-900 hover:bg-rose-900/30';
      case '2D': return isSelected ? 'bg-emerald-600 border-emerald-400 text-white shadow-md' : 'border-emerald-900/60 text-emerald-400 bg-slate-900 hover:bg-emerald-900/30';
      case '3D': return isSelected ? 'bg-blue-600 border-blue-400 text-white shadow-md' : 'border-blue-900/60 text-blue-400 bg-slate-900 hover:bg-slate-900/30';
      case '4D': return isSelected ? 'bg-purple-600 border-purple-400 text-white shadow-md' : 'border-purple-900/60 text-purple-400 bg-slate-900 hover:bg-purple-900/30';
      default: return isSelected ? 'bg-slate-600 border-slate-400 text-white shadow-md' : 'border-slate-700 text-slate-400 hover:bg-slate-800';
    }
  };

  const filteredArchives = archives.filter(arc => {
    if (archiveDateFilter) {
      const arcDate = new Date(parseInt(arc.id));
      const arcDateString = `${arcDate.getFullYear()}-${String(arcDate.getMonth() + 1).padStart(2, '0')}-${String(arcDate.getDate()).padStart(2, '0')}`;
      if (arcDateString !== archiveDateFilter) return false;
    }
    if (archiveTab === 'Normal' && arc.isGrandTotal) return false;
    if (archiveTab === 'Grand' && !arc.isGrandTotal) return false;
    return true;
  });

  const totalCollection = entries.reduce((sum, item) => sum + item.itemCollection, 0);
  const totalBase = entries.reduce((sum, item) => sum + item.itemBase, 0);
  const totalCommission = entries.reduce((sum, item) => sum + item.itemCommission, 0);

  return (
    <div className="h-[100dvh] bg-slate-900 flex flex-col font-sans max-w-md mx-auto shadow-2xl relative overflow-hidden text-slate-100">
      
      {/* HEADER */}
      <header className="bg-slate-950 text-slate-100 p-3 shadow-lg z-10 flex justify-between items-center shrink-0 border-b border-slate-800">
        <h1 className="text-lg font-bold tracking-wider truncate text-blue-400">SHARUN'S APP</h1>
        <div className="flex gap-2 shrink-0 items-center">
          {/* Privacy Toggle Eye Button */}
          <button 
            onClick={() => setHideSensitiveDetails(!hideSensitiveDetails)} 
            className={`p-2 rounded-lg text-sm font-bold transition border ${
              hideSensitiveDetails ? 'bg-amber-600 text-white border-amber-400' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
            }`}
            title={hideSensitiveDetails ? "Show Base & Commission" : "Hide Base & Commission (Privacy Mode)"}
          >
            {hideSensitiveDetails ? <FaEyeSlash className="text-white"/> : <FaEye className="text-blue-400"/>}
          </button>

          <button onClick={() => { setShowArchives(true); setSelectedArchives(new Set()); }} className="bg-slate-800 border border-slate-700 hover:bg-slate-700 px-2 py-1 flex items-center rounded text-sm font-bold shadow-sm transition">
            <FaArchive className="mr-1 text-amber-400"/> SAVED
          </button>
          <button onClick={() => setShowSummary(true)} className="bg-slate-800 border border-slate-700 hover:bg-slate-700 px-2 py-1 flex items-center rounded text-sm font-bold shadow-sm transition">
            <FaClipboardList className="mr-1 text-blue-400"/> SUM
          </button>
          <button onClick={openSettings} className="bg-slate-800 border border-slate-700 hover:bg-slate-700 px-2 py-1 rounded text-sm shadow-sm transition">
            <FaCog className="text-slate-300" />
          </button>
        </div>
      </header>

      {/* MULTI-CUSTOMER TABS BAR */}
      <div className="bg-slate-950 px-3 py-2 shrink-0 border-b border-slate-800 flex items-center gap-2 overflow-x-auto custom-scrollbar">
        <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1 shrink-0 uppercase">
          <FaUsers className="text-blue-400"/> BILLS:
        </span>
        {customers.map(cust => {
          const isActive = cust.id === activeCustomerId;
          const hasEntries = cust.entries.length > 0;
          return (
            <div key={cust.id} className="flex items-center shrink-0">
              {editingCustId === cust.id ? (
                <div className="flex items-center bg-slate-800 border border-blue-500 rounded px-1.5 py-0.5">
                  <input
                    type="text"
                    value={customerNameInput}
                    onChange={(e) => setCustomerNameInput(e.target.value)}
                    className="bg-transparent text-xs text-slate-100 outline-none w-20 font-bold"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveCustomerName(cust.id)}
                  />
                  <button onClick={() => handleSaveCustomerName(cust.id)} className="text-blue-400 text-xs ml-1"><FaCheck /></button>
                </div>
              ) : (
                <button
                  onClick={() => setActiveCustomerId(cust.id)}
                  onDoubleClick={() => { setEditingCustId(cust.id); setCustomerNameInput(cust.name); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition border ${
                    isActive 
                      ? 'bg-blue-600 text-white border-blue-400 shadow-md' 
                      : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                  }`}
                >
                  <span>{cust.name}</span>
                  {hasEntries && <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" title="Has active entries"></span>}
                  {customers.length > 1 && (
                    <span 
                      onClick={(e) => handleRemoveCustomer(cust.id, e)} 
                      className="ml-1 opacity-70 hover:opacity-100 hover:text-red-400"
                    >
                      <FaTimes size={10} />
                    </span>
                  )}
                </button>
              )}
            </div>
          );
        })}
        <button
          onClick={handleAddCustomer}
          className="bg-slate-900 border border-dashed border-slate-600 hover:border-blue-400 text-slate-400 hover:text-blue-400 px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 shrink-0 transition"
        >
          <FaUserPlus /> New
        </button>
      </div>

      {/* TOUCHBOX PRICES & MODES */}
      <div className="bg-slate-800 p-3 shrink-0 border-b border-slate-700 shadow-md z-10 flex flex-col gap-3">
        <div>
          <label className="text-[10px] text-slate-400 font-bold mb-2 flex items-center gap-1 uppercase tracking-wider"><FaTags /> PRICE & CATEGORY</label>
          <div className="flex flex-wrap gap-2">
            {allOrderedRates.map((item, i) => {
              const isSelected = (category === item.cat && collectionRate === item.rate);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => { setCategory(item.cat); setCollectionRate(item.rate); }}
                  className={`px-3 py-1.5 rounded-lg font-bold text-sm border-2 transition-all flex flex-col items-center justify-center min-w-[64px] ${getCatStyles(item.cat, isSelected)}`}
                >
                  ₹{item.rate.toFixed(1)}
                  <span className={`block text-[9px] ${isSelected ? 'opacity-100 font-black' : 'opacity-60'}`}>{item.cat}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <label className="text-[10px] text-slate-400 font-bold mb-1.5 flex items-center gap-1 uppercase tracking-wider"><FaBoxOpen /> SELECT MODE</label>
          <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
            {getAvailableModes().map(m => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all border shadow-sm ${
                  mode === m 
                    ? 'bg-blue-600 text-white border-blue-400' 
                    : 'bg-slate-900 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-slate-200'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* INPUT AREA */}
      <div className="bg-slate-800 p-3 shrink-0 z-10 shadow-lg border-b border-slate-700">
        <form onSubmit={handleAdd} className="flex gap-2 items-stretch h-12">
          <div className="flex-1 flex items-stretch bg-slate-900 border border-slate-600 rounded-lg shadow-inner overflow-hidden focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all">
            <button 
              type="button" 
              onClick={() => setCurrentQty(Math.max(0, currentQty - 1))} 
              className="w-14 bg-slate-700/80 hover:bg-slate-600 flex items-center justify-center text-slate-200 transition border-r border-slate-700"
            >
              <FaMinus />
            </button>
            
            <input 
              ref={inputRef} 
              type="number" 
              className="flex-1 w-full text-xl bg-transparent text-center font-bold text-slate-100 outline-none" 
              placeholder="0" 
              value={currentQty === 0 ? '' : currentQty} 
              onChange={(e) => setCurrentQty(parseInt(e.target.value) || 0)} 
            />
            
            <button 
              type="button" 
              onClick={() => setCurrentQty(currentQty + 1)} 
              className="w-14 bg-slate-700/80 hover:bg-slate-600 flex items-center justify-center text-slate-200 transition border-l border-slate-700"
            >
              <FaPlus />
            </button>
          </div>

          <button type="submit" disabled={currentQty === 0} className={`px-6 rounded-lg text-lg font-bold shadow-md transition flex items-center ${currentQty > 0 ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-slate-700 text-slate-400 opacity-70'}`}>
            <FaPlus className="mr-1" /> ADD
          </button>
        </form>
      </div>

      {/* DASHBOARD (Dynamically hides base & commission when privacy mode is on) */}
      <div className="bg-slate-900 p-3 shrink-0 mt-1">
        <div className={`grid ${hideSensitiveDetails ? 'grid-cols-1' : 'grid-cols-3'} gap-2 text-sm text-center transition-all`}>
          <div className="bg-slate-800 p-2 rounded-lg border border-slate-700 shadow-sm">
            <div className="text-[9px] text-slate-400 font-bold tracking-wider">COLLECTION</div>
            <div className="text-sm font-bold text-blue-400">₹{totalCollection.toFixed(2)}</div>
          </div>
          {!hideSensitiveDetails && (
            <>
              <div className="bg-slate-800 p-2 rounded-lg border border-slate-700 shadow-sm">
                <div className="text-[9px] text-slate-400 font-bold tracking-wider">BASE</div>
                <div className="text-sm font-bold text-amber-500">₹{totalBase.toFixed(2)}</div>
              </div>
              <div className="bg-slate-800 p-2 rounded-lg border border-slate-700 shadow-sm">
                <div className="text-[9px] text-slate-400 font-bold tracking-wider">COMMISSION</div>
                <div className="text-sm font-black text-emerald-400">₹{totalCommission.toFixed(2)}</div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* TABLE */}
      <div className="flex-1 overflow-y-auto bg-slate-900 p-2 pb-16">
        <div className="flex justify-between items-center mb-2 px-1">
          <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">{activeCustomer.name} Entries</span>
          {entries.length > 0 && (
            <button onClick={handleClearAll} className="text-xs text-red-400 hover:text-red-300 font-bold flex items-center bg-slate-800 border border-red-900/50 hover:bg-slate-700 px-2 py-1 rounded transition">
              <FaTrash className="mr-1"/> CLEAR
            </button>
          )}
        </div>

        <div className="bg-slate-800 rounded-lg shadow-xl border border-slate-700 overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-950 text-slate-400 font-bold text-[10px] uppercase tracking-wider">
              <tr>
                <th className="px-2 py-3">Type</th>
                <th className="px-2 py-3 text-center">Qty</th>
                <th className="px-2 py-3 text-right">Details</th>
                <th className="px-2 py-3 text-center">Del</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-slate-500 font-medium italic">No entries for {activeCustomer.name}.</td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr key={entry.id} className="border-b border-slate-700/50 hover:bg-slate-700/20 transition">
                    <td className="px-2 py-3">
                      <div className={`font-bold ${entry.category === '1D' ? 'text-rose-400' : entry.category === '2D' ? 'text-emerald-400' : entry.category === '3D' ? 'text-blue-400' : 'text-purple-400'}`}>
                        {entry.category}
                      </div>
                      <div className="text-[10px] text-slate-400">₹{entry.rate}</div>
                      {entry.mode !== 'Normal' && <div className="text-[9px] text-slate-300 font-bold mt-0.5">{entry.mode}</div>}
                    </td>
                    <td className="px-2 py-3 text-center">
                      <input 
                        type="number" 
                        value={entry.originalQty || ''} 
                        onChange={(e) => handleUpdateQty(entry.id, parseInt(e.target.value) || 0)}
                        className="w-14 text-center font-bold text-lg border-b-2 border-slate-600 outline-none bg-transparent text-slate-100 focus:border-blue-400 transition"
                      />
                      {entry.mode !== 'Normal' && <div className="text-[9px] text-slate-400 mt-1">(x{entry.multiplier}={entry.effectiveQty})</div>}
                    </td>
                    <td className="px-2 py-3 text-right">
                      <div className="font-bold text-slate-200 text-xs">C: ₹{entry.itemCollection}</div>
                      {!hideSensitiveDetails && (
                        <>
                          <div className="text-[10px] text-amber-500/90 mt-0.5">B: ₹{entry.itemBase}</div>
                          <div className="text-[10px] text-emerald-400 font-bold mt-0.5">P: ₹{entry.itemCommission}</div>
                        </>
                      )}
                    </td>
                    <td className="px-2 py-3 text-center">
                      <button onClick={() => handleDelete(entry.id)} className="text-red-400/80 hover:text-red-400 p-2 transition"><FaTrash /></button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SUMMARY MODAL */}
      {showSummary && (
        <div className="absolute inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-800 rounded-xl w-full max-w-sm flex flex-col max-h-[85vh] shadow-2xl border border-slate-700">
            <div className="flex justify-between items-center p-4 border-b border-slate-700">
              <h2 className="font-bold text-lg text-slate-100">Report Summary</h2>
              <button onClick={() => setShowSummary(false)} className="text-slate-400 hover:text-slate-200 text-xl transition"><FaTimes /></button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 space-y-4">
              <div>
                <div className="text-xs font-bold text-blue-400 mb-1">{activeCustomer.name} Only:</div>
                <pre className="text-xs bg-slate-900 p-3 border border-slate-700 rounded-lg text-slate-300 whitespace-pre-wrap font-mono shadow-inner">
                  {generateSummaryText() || "No entries."}
                </pre>
              </div>

              {customers.length > 1 && (
                <div>
                  <div className="text-xs font-bold text-emerald-400 mb-1">All {customers.length} Customers Combined:</div>
                  <pre className="text-xs bg-slate-900 p-3 border border-slate-700 rounded-lg text-slate-300 whitespace-pre-wrap font-mono shadow-inner">
                    {generateAllCustomersCombinedText()}
                  </pre>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-slate-700 bg-slate-800/50 space-y-2 rounded-b-xl">
              <div className="flex gap-2">
                <button onClick={() => initiateSaveArchive('current')} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 rounded-lg flex items-center justify-center shadow-lg transition text-xs">
                  <FaSave className="mr-1.5" /> SAVE CURRENT
                </button>
                {customers.length > 1 && (
                  <button onClick={() => initiateSaveArchive('combined')} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 rounded-lg flex items-center justify-center shadow-lg transition text-xs">
                    <FaSave className="mr-1.5" /> SAVE COMBINED
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={() => copyToClipboard(generateSummaryText())} className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-100 font-bold py-2 rounded-lg flex items-center justify-center shadow transition text-xs border border-slate-600">
                  <FaCopy className="mr-1" /> COPY CURRENT
                </button>
                {customers.length > 1 && (
                  <button onClick={() => copyToClipboard(generateAllCustomersCombinedText())} className="flex-1 bg-indigo-700 hover:bg-indigo-600 text-white font-bold py-2 rounded-lg flex items-center justify-center shadow transition text-xs">
                    <FaCopy className="mr-1" /> COPY ALL
                  </button>
                )}
              </div>
              <button onClick={() => shareToWhatsApp(customers.length > 1 ? generateAllCustomersCombinedText() : generateSummaryText())} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-lg flex items-center justify-center shadow transition text-xs">
                <FaWhatsapp className="mr-2 text-base" /> SHARE TO WHATSAPP
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM SAVE PROMPT MODAL */}
      {showSavePrompt && (
        <div className="absolute inset-0 bg-black/80 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-800 rounded-xl w-full max-w-xs flex flex-col shadow-2xl border border-slate-700">
            <div className="p-4 border-b border-slate-700">
              <h2 className="font-bold text-lg text-slate-100">
                {isSavingGrandTotal ? 'Save Grand Total' : (saveTarget === 'combined' ? 'Save Combined Summary' : 'Save Summary')}
              </h2>
            </div>
            <form onSubmit={confirmSaveArchive} className="p-4 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-400 block mb-2">Summary Name:</label>
                <input 
                  type="text" 
                  value={summaryName} 
                  onChange={(e) => setSummaryName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 p-2.5 rounded-lg outline-none focus:border-blue-500 font-bold text-slate-100 placeholder-slate-600 transition text-sm"
                  autoFocus
                />
              </div>
              
              {!isSavingGrandTotal && (
                <div className="flex items-center gap-2 mt-2 bg-slate-700/50 p-2.5 rounded-lg border border-slate-600">
                  <input 
                    type="checkbox" 
                    id="clearAfterSave" 
                    checked={clearAfterSave} 
                    onChange={(e) => setClearAfterSave(e.target.checked)} 
                    className="w-4 h-4 rounded border-slate-500 text-blue-600 focus:ring-blue-500 bg-slate-900 cursor-pointer"
                  />
                  <label htmlFor="clearAfterSave" className="text-xs font-bold text-slate-300 cursor-pointer select-none">
                    {saveTarget === 'combined' ? 'Clear entries for all customers after save' : `Clear entries for ${activeCustomer.name} after save`}
                  </label>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowSavePrompt(false)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold py-2.5 rounded-lg transition border border-slate-600 text-xs">Cancel</button>
                <button type="submit" className={`flex-1 ${isSavingGrandTotal || saveTarget === 'combined' ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-blue-600 hover:bg-blue-500'} text-white font-bold py-2.5 rounded-lg shadow-lg transition text-xs`}>Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ARCHIVES MODAL */}
      {showArchives && (
        <div className="absolute inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-800 rounded-xl w-full max-w-sm flex flex-col h-[85vh] shadow-2xl border border-slate-700 overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-slate-700">
              <h2 className="font-bold text-lg text-slate-100">Saved Summaries</h2>
              <button onClick={() => setShowArchives(false)} className="text-slate-400 hover:text-slate-200 text-xl transition"><FaTimes /></button>
            </div>
            
            <div className="flex border-b border-slate-700 bg-slate-900 shrink-0">
              <button 
                className={`flex-1 py-3 text-sm font-bold transition-all ${archiveTab === 'Normal' ? 'text-blue-400 border-b-2 border-blue-400 bg-slate-800/50' : 'text-slate-500 hover:text-slate-300'}`}
                onClick={() => { setArchiveTab('Normal'); setSelectedArchives(new Set()); }}
              >
                NORMAL
              </button>
              <button 
                className={`flex-1 py-3 text-sm font-bold transition-all ${archiveTab === 'Grand' ? 'text-indigo-400 border-b-2 border-indigo-400 bg-slate-800/50' : 'text-slate-500 hover:text-slate-300'}`}
                onClick={() => { setArchiveTab('Grand'); setSelectedArchives(new Set()); }}
              >
                GRAND TOTALS
              </button>
            </div>

            <div className="p-4 bg-slate-900 border-b border-slate-700 flex flex-col gap-2 shrink-0">
              <label className="text-xs font-bold text-amber-500 flex items-center gap-1.5"><FaCalendarAlt /> FILTER BY DATE</label>
              <div className="flex gap-2">
                <input 
                  type="date" 
                  value={archiveDateFilter}
                  onChange={(e) => { setArchiveDateFilter(e.target.value); setSelectedArchives(new Set()); }}
                  className="flex-1 p-2 bg-slate-800 border border-slate-600 rounded-lg outline-none font-bold text-slate-200 text-sm"
                  style={{ colorScheme: 'dark' }}
                />
                {archiveDateFilter && (
                  <button onClick={() => setArchiveDateFilter('')} className="bg-slate-700 px-3 rounded-lg text-xs font-bold text-slate-200">CLEAR</button>
                )}
              </div>
              {filteredArchives.length > 0 && archiveTab === 'Normal' && (
                <div className="flex justify-between items-center mt-1 pt-2 border-t border-slate-800 text-xs">
                  <span className="text-slate-400">Selected: {selectedArchives.size}</span>
                  <button onClick={selectAllFiltered} className="font-bold text-blue-400">
                    {selectedArchives.size === filteredArchives.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
              )}
            </div>

            <div className="p-4 overflow-y-auto flex-1 space-y-4 bg-slate-900/50">
              {filteredArchives.length === 0 ? (
                <p className="text-center text-slate-500 py-8 italic text-sm">No summaries found.</p>
              ) : (
                filteredArchives.map(arc => (
                  <div key={arc.id} className={`bg-slate-800 border ${selectedArchives.has(arc.id) ? 'border-blue-500 ring-1 ring-blue-500' : 'border-slate-700'} rounded-xl p-4 shadow-sm`}>
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-start gap-3 flex-1 cursor-pointer" onClick={() => archiveTab === 'Normal' && toggleArchiveSelection(arc.id)}>
                        {archiveTab === 'Normal' && (
                          <input type="checkbox" checked={selectedArchives.has(arc.id)} onChange={() => {}} className="mt-1 w-4 h-4 rounded text-blue-600 bg-slate-900 pointer-events-none" />
                        )}
                        <div>
                          <h3 className="font-bold text-slate-200 text-sm">{arc.name}</h3>
                          <p className="text-[10px] text-slate-400">{arc.date}</p>
                        </div>
                      </div>
                      <button onClick={() => setArchives(archives.filter(a => a.id !== arc.id))} className="text-red-400 p-1"><FaTrash /></button>
                    </div>
                    <pre className="text-xs bg-slate-900 p-3 border border-slate-700 rounded-lg text-slate-300 font-mono mb-3 whitespace-pre-wrap">{arc.summaryText}</pre>
                    <div className="flex gap-2">
                      <button onClick={() => copyToClipboard(arc.summaryText)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold py-1.5 rounded text-xs">COPY</button>
                      <button onClick={() => shareToWhatsApp(arc.summaryText)} className="flex-1 bg-emerald-900/40 hover:bg-emerald-800/60 text-emerald-400 font-bold py-1.5 rounded text-xs">SHARE</button>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            {archiveTab === 'Normal' && selectedArchives.size >= 2 && (
              <div className="p-3 border-t border-slate-700 bg-slate-800 shrink-0">
                <button onClick={handleGenerateGrandTotal} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 rounded-lg text-xs uppercase tracking-wide flex items-center justify-center">
                  <FaLayerGroup className="mr-2" /> Combine {selectedArchives.size} Files
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* GRAND TOTAL PREVIEW MODAL */}
      {showGrandTotalModal && (
        <div className="absolute inset-0 bg-black/80 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-800 rounded-xl w-full max-w-sm flex flex-col max-h-[80vh] shadow-2xl border border-indigo-500">
            <div className="flex justify-between items-center p-4 border-b border-slate-700 bg-indigo-900/20">
              <h2 className="font-bold text-sm text-indigo-400 flex items-center"><FaLayerGroup className="mr-2" /> Grand Total</h2>
              <button onClick={() => setShowGrandTotalModal(false)} className="text-slate-400"><FaTimes /></button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              <pre className="text-xs bg-slate-900 p-4 border border-slate-700 rounded-lg text-slate-300 whitespace-pre-wrap font-mono">{grandTotalText}</pre>
            </div>
            <div className="p-4 border-t border-slate-700 bg-slate-800 space-y-2">
              <button onClick={() => {
                setIsSavingGrandTotal(true);
                setSummaryName(`Grand Total (${selectedArchives.size} Files)`);
                setShowSavePrompt(true);
              }} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 rounded-lg text-xs">SAVE GRAND TOTAL</button>
              <div className="flex gap-2">
                <button onClick={() => copyToClipboard(grandTotalText)} className="flex-1 bg-slate-700 text-slate-100 font-bold py-2 rounded text-xs">COPY</button>
                <button onClick={() => shareToWhatsApp(grandTotalText)} className="flex-1 bg-emerald-600 text-white font-bold py-2 rounded text-xs">SHARE</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SETTINGS MODAL */}
      {showSettings && (
        <div className="absolute inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-800 rounded-xl w-full max-w-sm flex flex-col max-h-[90vh] shadow-2xl border border-slate-700">
            <div className="flex justify-between items-center p-4 border-b border-slate-700">
              <h2 className="font-bold text-lg text-slate-100">Settings & Backup</h2>
              <button onClick={() => setShowSettings(false)} className="text-slate-400"><FaTimes /></button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 space-y-4">
              <div className="bg-slate-900 p-3 rounded-xl border border-slate-700">
                <h3 className="font-bold text-blue-400 text-xs mb-2 uppercase">Backup / Restore</h3>
                <div className="flex gap-2">
                  <button onClick={handleExportData} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded text-xs">EXPORT JSON</button>
                  <button onClick={() => fileInputRef.current?.click()} className="flex-1 bg-slate-800 border border-blue-500 text-blue-400 font-bold py-2 rounded text-xs">IMPORT JSON</button>
                  <input type="file" accept=".json" ref={fileInputRef} className="hidden" onChange={handleImportData}/>
                </div>
              </div>

              {Object.keys(tempRates).map(cat => (
                <div key={cat} className="bg-slate-800 border border-slate-700 p-3 rounded-xl">
                  <h3 className="font-bold text-slate-300 mb-2 text-xs">{cat} Tiers</h3>
                  {tempRates[cat].map((rate, i) => (
                    <div key={i} className="flex gap-2 mb-2 items-center">
                      <div className="flex-1">
                        <label className="text-[9px] text-blue-400 block">SELL</label>
                        <input type="number" step="0.1" value={rate.coll} onChange={(e) => updateTempRate(cat, i, 'coll', Number(e.target.value))} className="w-full bg-slate-900 border border-slate-600 p-1 rounded text-xs font-bold text-slate-200"/>
                      </div>
                      <div className="flex-1">
                        <label className="text-[9px] text-amber-500 block">BASE</label>
                        <input type="number" step="0.1" value={rate.base} onChange={(e) => updateTempRate(cat, i, 'base', Number(e.target.value))} className="w-full bg-slate-900 border border-slate-600 p-1 rounded text-xs font-bold text-slate-200"/>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-slate-700 bg-slate-800 space-y-2">
              <button onClick={handleResetSettings} className="w-full bg-red-900/20 text-red-400 border border-red-900/50 font-bold py-2 rounded text-xs">RESET RATES</button>
              <button onClick={handleSaveSettings} className="w-full bg-blue-600 text-white font-bold py-2.5 rounded text-xs">SAVE SETTINGS</button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DIALOG */}
      {confirmDialog && (
        <div className="absolute inset-0 bg-black/80 z-[70] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-800 rounded-xl w-full max-w-xs shadow-2xl overflow-hidden text-center border border-slate-700">
            <div className="p-5">
              <h3 className="font-bold text-slate-100 text-base mb-1">Confirm</h3>
              <p className="text-xs text-slate-400">{confirmDialog.message}</p>
            </div>
            <div className="flex border-t border-slate-700 text-xs">
              <button onClick={() => setConfirmDialog(null)} className="flex-1 py-3 text-slate-400 font-bold hover:bg-slate-700 border-r border-slate-700">Cancel</button>
              <button onClick={confirmDialog.onConfirm} className="flex-1 py-3 text-red-400 font-bold hover:bg-red-900/20">Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST */}
      {toastMessage && (
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-5 py-2.5 rounded-full shadow-lg z-[80] font-bold text-xs tracking-wide flex items-center border border-blue-400">
          <FaCheck className="mr-2" /> {toastMessage}
        </div>
      )}
    </div>
  );
}
