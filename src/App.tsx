import { useState, useEffect, useRef } from 'react';
import { FaTrash, FaPlus, FaCopy, FaCog, FaTimes, FaClipboardList, FaArchive, FaSave, FaCheck, FaCalendarAlt, FaWhatsapp, FaFileExport, FaFileImport, FaLayerGroup, FaBoxOpen } from 'react-icons/fa';

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
  isGrandTotal?: boolean; // Flag to identify grand totals
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

  const [entries, setEntries] = useState<EntryItem[]>(() => {
    const saved = localStorage.getItem('offlineBills');
    return saved ? JSON.parse(saved) : [];
  });

  const [archives, setArchives] = useState<SavedSummary[]>(() => {
    const saved = localStorage.getItem('archives');
    return saved ? JSON.parse(saved) : [];
  });

  const [currentInput, setCurrentInput] = useState('');
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

  // Grand Total State
  const [selectedArchives, setSelectedArchives] = useState<Set<string>>(new Set());
  const [showGrandTotalModal, setShowGrandTotalModal] = useState(false);
  const [grandTotalText, setGrandTotalText] = useState('');
  const [grandTotalEntries, setGrandTotalEntries] = useState<EntryItem[]>([]);
  const [isSavingGrandTotal, setIsSavingGrandTotal] = useState(false);
  
  // Custom Alerts & Confirms State
  const [toastMessage, setToastMessage] = useState('');
  const [confirmDialog, setConfirmDialog] = useState<{ message: string, onConfirm: () => void } | null>(null);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem('offlineBills', JSON.stringify(entries));
  }, [entries]);

  useEffect(() => {
    localStorage.setItem('archives', JSON.stringify(archives));
  }, [archives]);

  // Extract all unique prices globally for the new dropdown
  const allUniqueRates = Array.from(
    new Set(Object.values(ratesConfig).flat().map(r => r.coll))
  ).sort((a, b) => a - b);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const handleRateSelection = (newRate: number) => {
    setCollectionRate(newRate);
    // Auto-change the category based on the selected rate
    for (const cat in ratesConfig) {
      if (ratesConfig[cat].some(r => r.coll === newRate)) {
        setCategory(cat);
        break;
      }
    }
  };

  const handleAdd = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const qty = parseInt(currentInput);
    
    if (!isNaN(qty) && qty > 0) {
      // Find base rate (check current category first, then fallback globally)
      let currentRateObj = ratesConfig[category]?.find(r => r.coll === collectionRate);
      if (!currentRateObj) {
        currentRateObj = Object.values(ratesConfig).flat().find(r => r.coll === collectionRate);
      }
      
      const baseRate = currentRateObj ? currentRateObj.base : (collectionRate * 0.85); // 15% margin fallback
      const multiplier = MULTIPLIERS[mode] || 1;

      const effectiveQty = qty * multiplier;
      const itemCollection = Math.round((effectiveQty * collectionRate) * 100) / 100;
      const itemBase = Math.round((effectiveQty * baseRate) * 100) / 100;
      const itemCommission = Math.round((itemCollection - itemBase) * 100) / 100;

      const newEntry: EntryItem = {
        id: Date.now(), category, rate: collectionRate, baseRate, mode,
        originalQty: qty, multiplier, effectiveQty, itemCollection, itemBase, itemCommission
      };

      setEntries([newEntry, ...entries]);
      setCurrentInput('');
      setMode('Normal'); // Reset mode after adding for speed
      if (navigator.vibrate) navigator.vibrate(50);
      inputRef.current?.focus();
    }
  };

  const handleUpdateQty = (id: number, newQty: number) => {
    if (isNaN(newQty) || newQty < 0) return;
    
    setEntries(entries.map(entry => {
      if (entry.id === id) {
        const effectiveQty = newQty * entry.multiplier;
        const itemCollection = Math.round((effectiveQty * entry.rate) * 100) / 100;
        const itemBase = Math.round((effectiveQty * entry.baseRate) * 100) / 100;
        const itemCommission = Math.round((itemCollection - itemBase) * 100) / 100;
        return { ...entry, originalQty: newQty, effectiveQty, itemCollection, itemBase, itemCommission };
      }
      return entry;
    }));
  };

  const handleDelete = (id: number) => setEntries(entries.filter(entry => entry.id !== id));

  const handleClearAll = () => {
    setConfirmDialog({
      message: "Are you sure you want to clear all current entries?",
      onConfirm: () => {
        setEntries([]);
        setConfirmDialog(null);
        showToast("All entries cleared");
      }
    });
  };

  const generateSummaryText = (sourceEntries: EntryItem[] = entries, isGrandTotal = false) => {
    const now = new Date();
    let text = isGrandTotal 
      ? `GRAND TOTAL REPORT\nGenerated: ${now.toLocaleDateString()} ${now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}\n\n`
      : `Time: ${now.toLocaleDateString()} ${now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}\n\n`;
    
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
      text += `OVERALL TOTALS\n`;
      text += `Collection: Rs.${grandColl.toFixed(2)}\n`;
      text += `Base:       Rs.${grandBase.toFixed(2)}\n`;
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

  const initiateSaveArchive = () => {
    if (entries.length === 0) return showToast("No entries to save.");
    setIsSavingGrandTotal(false);
    setSummaryName('');
    setShowSavePrompt(true);
  };

  const initiateSaveGrandTotal = () => {
    setIsSavingGrandTotal(true);
    setSummaryName(`Grand Total (${selectedArchives.size} Files)`);
    setShowSavePrompt(true);
  };

  const confirmSaveArchive = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!summaryName || summaryName.trim() === "") {
      showToast("Please enter a valid name.");
      return;
    }
    
    if (isSavingGrandTotal) {
      const newArchive: SavedSummary = {
        id: Date.now().toString(),
        name: summaryName.trim(),
        date: new Date().toLocaleString([], { 
          year: 'numeric', month: 'short', day: 'numeric', 
          hour: '2-digit', minute:'2-digit' 
        }),
        summaryText: grandTotalText,
        entries: grandTotalEntries,
        isGrandTotal: true
      };
      
      setArchives([newArchive, ...archives]);
      setShowSavePrompt(false);
      setShowGrandTotalModal(false);
      setSelectedArchives(new Set()); // Deselect all after saving
      showToast("Grand Total saved successfully!");

    } else {
      const newArchive: SavedSummary = {
        id: Date.now().toString(),
        name: summaryName.trim(),
        date: new Date().toLocaleString([], { 
          year: 'numeric', month: 'short', day: 'numeric', 
          hour: '2-digit', minute:'2-digit' 
        }),
        summaryText: generateSummaryText(entries),
        entries: [...entries]
      };
      
      setArchives([newArchive, ...archives]);
      if (clearAfterSave) setEntries([]);
      
      setShowSavePrompt(false);
      setShowSummary(false);
      
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      setArchiveDateFilter(todayStr);
      setShowArchives(true);
      showToast("Summary saved successfully!");
    }
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
    let missingDataCount = 0;

    selected.forEach(arc => {
      if (arc.entries && arc.entries.length > 0) {
        combinedEntries = [...combinedEntries, ...arc.entries];
      } else {
        missingDataCount++;
      }
    });

    if (missingDataCount > 0) {
      showToast(`${missingDataCount} older summary(s) didn't contain raw data and were skipped.`);
    }

    setGrandTotalEntries(combinedEntries);
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
      message: "Reset all rates to default? This will restore the original base prices.",
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
    const dataToExport = { ratesConfig, entries, archives };
    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `SharunsApp_Backup_${new Date().toISOString().split('T')[0]}.json`;
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
        if (importedData.entries) setEntries(importedData.entries);
        if (importedData.archives) setArchives(importedData.archives);
        showToast("Backup restored successfully!");
        setShowSettings(false);
      } catch (error) {
        showToast("Error reading backup file. Invalid format.");
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

  const filteredArchives = archives.filter(arc => {
    if (!archiveDateFilter) return true;
    const arcDate = new Date(parseInt(arc.id));
    const arcDateString = `${arcDate.getFullYear()}-${String(arcDate.getMonth() + 1).padStart(2, '0')}-${String(arcDate.getDate()).padStart(2, '0')}`;
    return arcDateString === archiveDateFilter;
  });

  const totalCollection = entries.reduce((sum, item) => sum + item.itemCollection, 0);
  const totalBase = entries.reduce((sum, item) => sum + item.itemBase, 0);
  const totalCommission = entries.reduce((sum, item) => sum + item.itemCommission, 0);

  return (
    <div className="h-[100dvh] bg-slate-900 flex flex-col font-sans max-w-md mx-auto shadow-2xl relative overflow-hidden text-slate-100">
      
      {/* HEADER */}
      <header className="bg-slate-950 text-slate-100 p-3 shadow-lg z-10 flex justify-between items-center shrink-0 border-b border-slate-800">
        <h1 className="text-lg font-bold tracking-wider truncate text-blue-400">SHARUN'S APP</h1>
        <div className="flex gap-2 shrink-0">
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

      {/* FILTERS & MODE CHECKLIST */}
      <div className="bg-slate-800 p-3 shrink-0 border-b border-slate-700 shadow-md z-10 flex flex-col gap-3">
        <div className="flex gap-2 text-sm">
          {/* Global Price Selector */}
          <div className="flex-1">
            <label className="text-[10px] text-slate-400 font-bold mb-1 block">PRICE (₹)</label>
            <select 
              className="w-full p-2.5 rounded bg-slate-900 text-blue-400 border border-slate-700 font-bold outline-none focus:border-blue-500 transition shadow-inner" 
              value={collectionRate} 
              onChange={(e) => handleRateSelection(Number(e.target.value))}
            >
              {allUniqueRates.map((rate, i) => <option key={i} value={rate}>₹{rate.toFixed(2)}</option>)}
            </select>
          </div>

          {/* Manual Category Override */}
          <div className="w-1/3">
            <label className="text-[10px] text-slate-400 font-bold mb-1 block">CAT</label>
            <select 
              className="w-full p-2.5 rounded bg-slate-900 text-slate-100 border border-slate-700 font-bold outline-none focus:border-blue-500 transition shadow-inner" 
              value={category} 
              onChange={(e) => setCategory(e.target.value)}
            >
              {Object.keys(ratesConfig).map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>
        </div>

        {/* Mode Checklist (Chips) */}
        <div>
          <label className="text-[10px] text-slate-400 font-bold mb-1.5 flex items-center gap-1"><FaBoxOpen /> SELECT MODE</label>
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
        <form onSubmit={handleAdd} className="flex gap-2">
          <input 
            ref={inputRef} 
            type="number" 
            className="flex-1 text-xl p-2.5 bg-slate-900 border border-slate-600 rounded-lg text-center font-bold text-slate-100 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition placeholder-slate-500 shadow-inner" 
            placeholder="Enter Quantity" 
            value={currentInput} 
            onChange={(e) => setCurrentInput(e.target.value)} 
          />
          <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white px-6 rounded-lg text-lg font-bold shadow-md transition">
            <FaPlus className="inline mr-1" /> ADD
          </button>
        </form>
      </div>

      {/* DASHBOARD */}
      <div className="bg-slate-900 p-3 shrink-0 mt-1">
        <div className="grid grid-cols-3 gap-2 text-sm text-center">
          <div className="bg-slate-800 p-2 rounded-lg border border-slate-700 shadow-sm">
            <div className="text-[9px] text-slate-400 font-bold tracking-wider">COLLECTION</div>
            <div className="text-sm font-bold text-blue-400">₹{totalCollection.toFixed(2)}</div>
          </div>
          <div className="bg-slate-800 p-2 rounded-lg border border-slate-700 shadow-sm">
            <div className="text-[9px] text-slate-400 font-bold tracking-wider">BASE</div>
            <div className="text-sm font-bold text-amber-500">₹{totalBase.toFixed(2)}</div>
          </div>
          <div className="bg-slate-800 p-2 rounded-lg border border-slate-700 shadow-sm">
            <div className="text-[9px] text-slate-400 font-bold tracking-wider">COMMISSION</div>
            <div className="text-sm font-black text-emerald-400">₹{totalCommission.toFixed(2)}</div>
          </div>
        </div>
      </div>

      {/* TABLE */}
      <div className="flex-1 overflow-y-auto bg-slate-900 p-2 pb-16">
        <div className="flex justify-between items-center mb-2 px-1">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Current Entries</span>
          {entries.length > 0 && (
            <button onClick={handleClearAll} className="text-xs text-red-400 hover:text-red-300 font-bold flex items-center bg-slate-800 border border-red-900/50 hover:bg-slate-700 px-2 py-1 rounded transition">
              <FaTrash className="mr-1"/> CLEAR ALL
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
                  <td colSpan={4} className="text-center py-8 text-slate-500 font-medium italic">No entries yet.</td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr key={entry.id} className="border-b border-slate-700/50 hover:bg-slate-700/20 transition">
                    <td className="px-2 py-3">
                      <div className="font-bold text-slate-200">{entry.category}</div>
                      <div className="text-[10px] text-slate-400">₹{entry.rate}</div>
                      {entry.mode !== 'Normal' && <div className="text-[9px] text-blue-400 font-bold mt-0.5">{entry.mode}</div>}
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
                      <div className="text-[10px] text-amber-500/90 mt-0.5">B: ₹{entry.itemBase}</div>
                      <div className="text-[10px] text-emerald-400 font-bold mt-0.5">P: ₹{entry.itemCommission}</div>
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
          <div className="bg-slate-800 rounded-xl w-full max-w-sm flex flex-col max-h-[80vh] shadow-2xl border border-slate-700">
            <div className="flex justify-between items-center p-4 border-b border-slate-700">
              <h2 className="font-bold text-lg text-slate-100">Report Summary</h2>
              <button onClick={() => setShowSummary(false)} className="text-slate-400 hover:text-slate-200 text-xl transition"><FaTimes /></button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              <pre className="text-sm bg-slate-900 p-4 border border-slate-700 rounded-lg text-slate-300 whitespace-pre-wrap font-mono shadow-inner">
                {generateSummaryText() || "No entries to summarize."}
              </pre>
            </div>
            <div className="p-4 border-t border-slate-700 bg-slate-800/50 space-y-3 rounded-b-xl">
              <button onClick={initiateSaveArchive} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 rounded-lg flex items-center justify-center shadow-lg transition">
                <FaSave className="mr-2" /> SAVE SUMMARY
              </button>
              <div className="flex gap-3">
                <button onClick={() => copyToClipboard(generateSummaryText())} className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-100 font-bold py-2.5 rounded-lg flex items-center justify-center shadow transition text-sm border border-slate-600">
                  <FaCopy className="mr-2" /> COPY
                </button>
                <button onClick={() => shareToWhatsApp(generateSummaryText())} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-lg flex items-center justify-center shadow transition text-sm">
                  <FaWhatsapp className="mr-2 text-lg" /> SHARE
                </button>
              </div>
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
                {isSavingGrandTotal ? 'Save Grand Total' : 'Save Summary'}
              </h2>
            </div>
            <form onSubmit={confirmSaveArchive} className="p-4 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-400 block mb-2">Enter a name for this summary:</label>
                <input 
                  type="text" 
                  value={summaryName} 
                  onChange={(e) => setSummaryName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 p-2.5 rounded-lg outline-none focus:border-blue-500 font-bold text-slate-100 placeholder-slate-600 transition"
                  autoFocus
                  placeholder={isSavingGrandTotal ? "e.g., Today's Full Total" : "e.g., Morning Shift"}
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
                    Clear calculations after saving
                  </label>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowSavePrompt(false)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold py-2.5 rounded-lg transition border border-slate-600">Cancel</button>
                <button type="submit" className={`flex-1 ${isSavingGrandTotal ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-blue-600 hover:bg-blue-500'} text-white font-bold py-2.5 rounded-lg shadow-lg transition`}>
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ARCHIVES MODAL WITH MULTI-SELECT & GRAND TOTAL */}
      {showArchives && (
        <div className="absolute inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-800 rounded-xl w-full max-w-sm flex flex-col h-[85vh] shadow-2xl border border-slate-700">
            <div className="flex justify-between items-center p-4 border-b border-slate-700">
              <h2 className="font-bold text-lg text-slate-100">Saved Summaries</h2>
              <button onClick={() => setShowArchives(false)} className="text-slate-400 hover:text-slate-200 text-xl transition"><FaTimes /></button>
            </div>
            
            <div className="p-4 bg-slate-900 border-b border-slate-700 flex flex-col gap-3">
              <label className="text-xs font-bold text-amber-500 flex items-center gap-1.5 tracking-wider">
                <FaCalendarAlt /> FILTER BY DATE
              </label>
              <div className="flex gap-2">
                <input 
                  type="date" 
                  value={archiveDateFilter}
                  onChange={(e) => {
                    setArchiveDateFilter(e.target.value);
                    setSelectedArchives(new Set());
                  }}
                  className="flex-1 p-2 bg-slate-800 border border-slate-600 rounded-lg outline-none font-bold text-slate-200 focus:border-blue-500 transition"
                  style={{ colorScheme: 'dark' }}
                />
                {archiveDateFilter && (
                  <button onClick={() => setArchiveDateFilter('')} className="bg-slate-700 hover:bg-slate-600 px-4 rounded-lg text-xs font-bold text-slate-200 transition border border-slate-600">
                    CLEAR
                  </button>
                )}
              </div>
              {filteredArchives.length > 0 && (
                <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-800">
                  <span className="text-xs font-bold text-slate-400">Selected: {selectedArchives.size}</span>
                  <button onClick={selectAllFiltered} className="text-xs font-bold text-blue-400 hover:text-blue-300">
                    {selectedArchives.size === filteredArchives.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
              )}
            </div>

            <div className="p-4 overflow-y-auto flex-1 space-y-4 bg-slate-900/50">
              {archives.length === 0 ? (
                <p className="text-center text-slate-500 py-8 italic font-medium">No saved summaries yet.</p>
              ) : filteredArchives.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-slate-400 font-bold">No bills saved on this date.</p>
                  <button onClick={() => setArchiveDateFilter('')} className="text-blue-400 text-sm mt-3 font-bold hover:underline">View All Dates</button>
                </div>
              ) : (
                filteredArchives.map(arc => (
                  <div key={arc.id} className={`bg-slate-800 border ${selectedArchives.has(arc.id) ? 'border-blue-500 ring-1 ring-blue-500' : arc.isGrandTotal ? 'border-indigo-500/50' : 'border-slate-700'} rounded-xl p-4 shadow-sm transition-all`}>
                    <div className="flex justify-between items-start mb-3">
                      <div 
                        className="flex items-start gap-3 flex-1 cursor-pointer" 
                        onClick={() => toggleArchiveSelection(arc.id)}
                      >
                        <input 
                          type="checkbox" 
                          checked={selectedArchives.has(arc.id)}
                          onChange={() => {}} 
                          className="mt-1 w-4 h-4 rounded border-slate-500 text-blue-600 focus:ring-blue-500 bg-slate-900 pointer-events-none"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-slate-200 text-base">{arc.name}</h3>
                            {arc.isGrandTotal && <span className="bg-indigo-900 text-indigo-300 text-[9px] px-1.5 py-0.5 rounded font-bold tracking-wide">GRAND TOTAL</span>}
                          </div>
                          <p className="text-[10px] text-slate-400 font-medium mt-0.5">{arc.date}</p>
                        </div>
                      </div>
                      <button onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDialog({
                          message: `Delete saved summary "${arc.name}"?`,
                          onConfirm: () => {
                            setArchives(archives.filter(a => a.id !== arc.id));
                            const newSet = new Set(selectedArchives);
                            newSet.delete(arc.id);
                            setSelectedArchives(newSet);
                            setConfirmDialog(null);
                            showToast("Summary deleted");
                          }
                        });
                      }} className="text-red-400/80 hover:text-red-400 transition mt-1 bg-slate-900 p-2 rounded-lg ml-2"><FaTrash /></button>
                    </div>
                    <pre className="text-xs bg-slate-900 p-3 border border-slate-700 rounded-lg text-slate-300 font-mono mb-3 whitespace-pre-wrap shadow-inner">{arc.summaryText}</pre>
                    <div className="flex gap-2">
                      <button onClick={() => copyToClipboard(arc.summaryText)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold py-2 rounded-lg text-xs flex items-center justify-center transition border border-slate-600">
                        <FaCopy className="mr-1.5" /> COPY
                      </button>
                      <button onClick={() => shareToWhatsApp(arc.summaryText)} className="flex-1 bg-emerald-900/40 hover:bg-emerald-800/60 text-emerald-400 font-bold py-2 rounded-lg text-xs flex items-center justify-center border border-emerald-800 transition">
                        <FaWhatsapp className="mr-1.5 text-sm" /> SHARE
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            {/* Action Bar for Grand Total */}
            {selectedArchives.size >= 2 && (
              <div className="p-4 border-t border-slate-700 bg-slate-800/90 rounded-b-xl backdrop-blur-sm">
                <button 
                  onClick={handleGenerateGrandTotal} 
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(79,70,229,0.4)] transition uppercase tracking-wide text-sm"
                >
                  <FaLayerGroup className="mr-2" /> Combine {selectedArchives.size} Summaries
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* GRAND TOTAL MODAL */}
      {showGrandTotalModal && (
        <div className="absolute inset-0 bg-black/80 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-800 rounded-xl w-full max-w-sm flex flex-col max-h-[80vh] shadow-2xl border border-indigo-500/50 ring-1 ring-indigo-500">
            <div className="flex justify-between items-center p-4 border-b border-slate-700 bg-indigo-900/20 rounded-t-xl">
              <h2 className="font-bold text-lg text-indigo-400 flex items-center"><FaLayerGroup className="mr-2" /> Grand Total</h2>
              <button onClick={() => setShowGrandTotalModal(false)} className="text-slate-400 hover:text-slate-200 text-xl transition"><FaTimes /></button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              <pre className="text-sm bg-slate-900 p-4 border border-slate-700 rounded-lg text-slate-300 whitespace-pre-wrap font-mono shadow-inner">
                {grandTotalText}
              </pre>
            </div>
            <div className="p-4 border-t border-slate-700 bg-slate-800/50 space-y-3 rounded-b-xl">
              <button onClick={initiateSaveGrandTotal} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 rounded-lg flex items-center justify-center shadow-lg transition">
                <FaSave className="mr-2" /> SAVE GRAND TOTAL
              </button>
              <div className="flex gap-3">
                <button onClick={() => copyToClipboard(grandTotalText)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-100 font-bold py-2.5 rounded-lg flex items-center justify-center shadow transition text-sm border border-slate-600">
                  <FaCopy className="mr-2" /> COPY
                </button>
                <button onClick={() => shareToWhatsApp(grandTotalText)} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-lg flex items-center justify-center shadow transition text-sm">
                  <FaWhatsapp className="mr-2 text-lg" /> SHARE
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SETTINGS MODAL (Unchanged but included for completeness) */}
      {showSettings && (
        <div className="absolute inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-800 rounded-xl w-full max-w-sm flex flex-col max-h-[90vh] shadow-2xl border border-slate-700">
            <div className="flex justify-between items-center p-4 border-b border-slate-700">
              <h2 className="font-bold text-lg text-slate-100">Settings & Rates</h2>
              <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-slate-200 text-xl transition"><FaTimes /></button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 space-y-6">
              
              <div className="bg-slate-900 border border-blue-900/50 p-4 rounded-xl shadow-inner">
                <h3 className="font-bold text-blue-400 text-xs mb-3 uppercase tracking-wider flex items-center">
                  <FaArchive className="mr-2"/> Data Backup
                </h3>
                <div className="flex gap-3">
                  <button onClick={handleExportData} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 rounded-lg text-xs flex items-center justify-center shadow transition">
                    <FaFileExport className="mr-1.5" /> EXPORT
                  </button>
                  <button onClick={() => fileInputRef.current?.click()} className="flex-1 bg-slate-800 border border-blue-500/50 hover:bg-slate-700 text-blue-400 font-bold py-2.5 rounded-lg text-xs flex items-center justify-center transition">
                    <FaFileImport className="mr-1.5" /> IMPORT
                  </button>
                  <input type="file" accept=".json" ref={fileInputRef} className="hidden" onChange={handleImportData}/>
                </div>
                <p className="text-[10px] text-slate-500 mt-3 leading-relaxed">Export your data regularly to prevent accidental loss. Import a backup file to restore your entries and rates.</p>
              </div>

              {Object.keys(tempRates).map(cat => (
                <div key={cat} className="bg-slate-800 border border-slate-700 p-3 rounded-xl">
                  <h3 className="font-black text-slate-300 mb-3 border-b border-slate-700 pb-2">{cat} Tiers</h3>
                  {tempRates[cat].map((rate, i) => (
                    <div key={i} className="flex gap-3 mb-3 items-center">
                      <div className="flex-1">
                        <label className="text-[10px] text-blue-400 font-bold block mb-1">SALE PRICE</label>
                        <input type="number" step="0.1" value={rate.coll} onChange={(e) => updateTempRate(cat, i, 'coll', Number(e.target.value))} className="w-full bg-slate-900 border border-slate-600 p-1.5 rounded text-sm font-bold text-slate-200 outline-none focus:border-blue-500 transition"/>
                      </div>
                      <div className="flex-1">
                        <label className="text-[10px] text-amber-500 font-bold block mb-1">COMPANY BASE</label>
                        <input type="number" step="0.1" value={rate.base} onChange={(e) => updateTempRate(cat, i, 'base', Number(e.target.value))} className="w-full bg-slate-900 border border-slate-600 p-1.5 rounded text-sm font-bold text-slate-200 outline-none focus:border-amber-500 transition"/>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-slate-700 bg-slate-800 rounded-b-xl space-y-3">
              <button onClick={handleResetSettings} className="w-full bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-900/50 font-bold py-2.5 rounded-lg flex items-center justify-center transition text-sm">
                RESET RATES TO DEFAULT
              </button>
              <button onClick={handleSaveSettings} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg flex items-center justify-center shadow-lg transition">
                <FaCheck className="mr-2" /> SAVE SETTINGS
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM CONFIRM DIALOG */}
      {confirmDialog && (
        <div className="absolute inset-0 bg-black/80 z-[70] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-800 rounded-xl w-full max-w-xs flex flex-col shadow-2xl overflow-hidden text-center border border-slate-700">
            <div className="p-6">
              <h3 className="font-bold text-slate-100 text-lg mb-2">Are you sure?</h3>
              <p className="text-sm text-slate-400">{confirmDialog.message}</p>
            </div>
            <div className="flex border-t border-slate-700">
              <button onClick={() => setConfirmDialog(null)} className="flex-1 py-3 text-slate-400 font-bold hover:bg-slate-700 border-r border-slate-700 transition">
                Cancel
              </button>
              <button onClick={confirmDialog.onConfirm} className="flex-1 py-3 text-red-400 font-bold hover:bg-red-900/20 transition">
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM TOAST NOTIFICATION */}
      {toastMessage && (
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-6 py-3 rounded-full shadow-[0_10px_40px_rgba(37,99,235,0.5)] z-[80] font-bold text-sm tracking-wide flex items-center border border-blue-400">
          <FaCheck className="mr-2" /> {toastMessage}
        </div>
      )}
    </div>
  );
}
