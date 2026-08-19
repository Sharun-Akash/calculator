import { useState, useEffect, useRef } from 'react';
import { FaTrash, FaPlus, FaCopy, FaCog, FaTimes, FaClipboardList, FaArchive, FaSave, FaCheck, FaCalendarAlt } from 'react-icons/fa';

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
  id: string; // We will use this timestamp for the calendar filter
  name: string;
  date: string;
  summaryText: string;
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
  const [collectionRate, setCollectionRate] = useState(ratesConfig['3D'][0].coll);
  const [mode, setMode] = useState<Mode>('Normal');
  
  const [showSummary, setShowSummary] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [tempRates, setTempRates] = useState<Record<string, RateTier[]>>(DEFAULT_RATES);
  const [showArchives, setShowArchives] = useState(false);
  
  const [showSavePrompt, setShowSavePrompt] = useState(false);
  const [summaryName, setSummaryName] = useState('');
  const [clearAfterSave, setClearAfterSave] = useState(true);
  
  // New State for Calendar View
  const [archiveDateFilter, setArchiveDateFilter] = useState<string>('');
  
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem('offlineBills', JSON.stringify(entries));
  }, [entries]);

  useEffect(() => {
    localStorage.setItem('archives', JSON.stringify(archives));
  }, [archives]);

  useEffect(() => {
    setCollectionRate(ratesConfig[category][0].coll);
    setMode('Normal'); 
  }, [category, ratesConfig]);

  const handleAdd = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const qty = parseInt(currentInput);
    
    if (!isNaN(qty) && qty > 0) {
      const currentRateObj = ratesConfig[category].find(r => r.coll === collectionRate) || ratesConfig[category][0];
      const baseRate = currentRateObj.base;
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
      setMode('Normal');
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
    if (window.confirm("Are you sure you want to clear all current entries?")) {
      setEntries([]);
    }
  };

  const generateSummaryText = () => {
    const now = new Date();
    let text = `Time: ${now.toLocaleDateString()} ${now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}\n\n`;
    
    ['1D', '2D', '3D', '4D'].forEach(cat => {
      const catEntries = entries.filter(e => e.category === cat);
      if (catEntries.length === 0) return;
      
      text += `${cat.toLowerCase()}\n`;
      const uniqueRates = [...new Set(catEntries.map(e => e.rate))].sort((a, b) => a - b);
      
      uniqueRates.forEach(rate => {
        const group = catEntries.filter(e => e.rate === rate);
        const totalColl = group.reduce((sum, e) => sum + e.itemCollection, 0);
        const totalBase = group.reduce((sum, e) => sum + e.itemBase, 0);
        const totalComm = group.reduce((sum, e) => sum + e.itemCommission, 0);
        
        text += `Rs.${rate} : ${totalColl} - ${totalBase} = ${totalComm}\n`;
      });
      text += '\n';
    });
    return text.trim();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Copied to clipboard!");
  };

  const initiateSaveArchive = () => {
    if (entries.length === 0) return alert("No entries to save.");
    setSummaryName('');
    setShowSavePrompt(true);
  };

  const confirmSaveArchive = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!summaryName || summaryName.trim() === "") {
      alert("Please enter a valid name.");
      return;
    }
    
    const newArchive: SavedSummary = {
      id: Date.now().toString(), // We use this timestamp to extract the date for the calendar
      name: summaryName.trim(),
      date: new Date().toLocaleString([], { 
        year: 'numeric', month: 'short', day: 'numeric', 
        hour: '2-digit', minute:'2-digit' 
      }),
      summaryText: generateSummaryText()
    };
    
    setArchives([newArchive, ...archives]);
    
    if (clearAfterSave) {
      setEntries([]);
    }

    setShowSavePrompt(false);
    setShowSummary(false);
    
    // Automatically set the filter to today's date so they see what they just saved
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    setArchiveDateFilter(todayStr);
    setShowArchives(true);
  };

  const openSettings = () => {
    setTempRates(JSON.parse(JSON.stringify(ratesConfig)));
    setShowSettings(true);
  };

  const handleSaveSettings = () => {
    setRatesConfig(tempRates);
    localStorage.setItem('customRates', JSON.stringify(tempRates));
    setShowSettings(false);
  };

  const handleResetSettings = () => {
    if (window.confirm("Reset all rates to default? This will restore the default 4D base prices.")) {
      setRatesConfig(DEFAULT_RATES);
      localStorage.setItem('customRates', JSON.stringify(DEFAULT_RATES));
      setShowSettings(false);
    }
  };

  const updateTempRate = (cat: string, index: number, field: 'coll' | 'base', value: number) => {
    const newRates = { ...tempRates };
    newRates[cat][index][field] = value;
    setTempRates(newRates);
  };

  const getAvailableModes = () => {
    const modes: Mode[] = ['Normal'];
    if (category === '1D' || category === '2D') modes.push('ALL');
    if (category === '3D') modes.push('BOX (3)', 'BOX (6)');
    if (category === '4D') modes.push('BOX (4)', 'BOX (6)', 'BOX (12)', 'BOX (24)');
    return modes;
  };

  // Filter Archives based on selected calendar date
  const filteredArchives = archives.filter(arc => {
    if (!archiveDateFilter) return true; // Show all if no date selected
    
    // Convert archive ID (epoch timestamp) to local YYYY-MM-DD string
    const arcDate = new Date(parseInt(arc.id));
    const arcDateString = `${arcDate.getFullYear()}-${String(arcDate.getMonth() + 1).padStart(2, '0')}-${String(arcDate.getDate()).padStart(2, '0')}`;
    
    return arcDateString === archiveDateFilter;
  });

  const totalCollection = entries.reduce((sum, item) => sum + item.itemCollection, 0);
  const totalBase = entries.reduce((sum, item) => sum + item.itemBase, 0);
  const totalCommission = entries.reduce((sum, item) => sum + item.itemCommission, 0);

  return (
    <div className="h-[100dvh] bg-gray-100 flex flex-col font-sans max-w-md mx-auto shadow-xl relative overflow-hidden">
      
      {/* HEADER */}
      <header className="bg-slate-800 text-white p-3 shadow-md z-10 flex justify-between items-center shrink-0">
        <h1 className="text-lg font-bold tracking-wider truncate">SHARUN'S APP</h1>
        <div className="flex gap-2 shrink-0">
          <button onClick={() => setShowArchives(true)} className="bg-yellow-600 hover:bg-yellow-500 px-2 py-1 flex items-center rounded text-sm font-bold shadow">
            <FaArchive className="mr-1"/> SAVED
          </button>
          <button onClick={() => setShowSummary(true)} className="bg-blue-500 hover:bg-blue-600 px-2 py-1 flex items-center rounded text-sm font-bold shadow">
            <FaClipboardList className="mr-1"/> SUM
          </button>
          <button onClick={openSettings} className="bg-gray-600 hover:bg-gray-500 px-2 py-1 rounded text-sm shadow">
            <FaCog />
          </button>
        </div>
      </header>

      {/* FILTERS */}
      <div className="bg-slate-700 p-3 shrink-0">
        <div className="grid grid-cols-3 gap-2 text-sm text-black">
          <select className="p-2 rounded bg-white font-bold outline-none" value={category} onChange={(e) => setCategory(e.target.value)}>
            {Object.keys(ratesConfig).map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </select>
          <select className="p-2 rounded bg-white font-bold outline-none" value={collectionRate} onChange={(e) => setCollectionRate(Number(e.target.value))}>
            {ratesConfig[category].map((rate, i) => <option key={i} value={rate.coll}>₹{rate.coll}</option>)}
          </select>
          <select className="p-2 rounded bg-white font-bold outline-none" value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
            {getAvailableModes().map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>

      {/* INPUT AREA */}
      <div className="bg-white p-3 shadow-sm border-b-2 border-gray-200 shrink-0 z-10">
        <form onSubmit={handleAdd} className="flex gap-2">
          <input 
            ref={inputRef} 
            type="number" 
            className="flex-1 text-xl p-2 border-2 border-slate-300 rounded text-center font-bold outline-none focus:border-blue-500" 
            placeholder="Enter Quantity" 
            value={currentInput} 
            onChange={(e) => setCurrentInput(e.target.value)} 
          />
          <button type="submit" className="bg-blue-600 text-white px-5 rounded text-lg font-bold shadow-md">
            <FaPlus className="inline mr-1" /> ADD
          </button>
        </form>
      </div>

      {/* DASHBOARD */}
      <div className="bg-white p-3 shadow-sm border-b border-gray-200 shrink-0 mt-1">
        <div className="grid grid-cols-3 gap-2 text-sm text-center">
          <div className="bg-gray-50 p-2 rounded border border-gray-200">
            <div className="text-[9px] text-gray-500 font-bold">COLLECTION</div>
            <div className="text-sm font-bold text-gray-800">₹{totalCollection.toFixed(2)}</div>
          </div>
          <div className="bg-orange-50 p-2 rounded border border-orange-200">
            <div className="text-[9px] text-orange-600 font-bold">BASE</div>
            <div className="text-sm font-bold text-orange-700">₹{totalBase.toFixed(2)}</div>
          </div>
          <div className="bg-green-50 p-2 rounded border border-green-200">
            <div className="text-[9px] text-green-700 font-bold">COMMISSION</div>
            <div className="text-sm font-black text-green-700">₹{totalCommission.toFixed(2)}</div>
          </div>
        </div>
      </div>

      {/* TABLE */}
      <div className="flex-1 overflow-y-auto bg-slate-50 p-2">
        <div className="flex justify-between items-center mb-2 px-1">
          <span className="text-xs font-bold text-slate-500 uppercase">Current Entries</span>
          {entries.length > 0 && (
            <button onClick={handleClearAll} className="text-xs text-red-500 hover:text-red-700 font-bold flex items-center bg-red-100 hover:bg-red-200 px-2 py-1 rounded transition">
              <FaTrash className="mr-1"/> CLEAR ALL
            </button>
          )}
        </div>

        <div className="bg-white rounded shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-100 text-slate-600 font-bold text-[10px] uppercase">
              <tr>
                <th className="px-2 py-2">Type</th>
                <th className="px-2 py-2 text-center">Qty</th>
                <th className="px-2 py-2 text-right">Details</th>
                <th className="px-2 py-2 text-center">Del</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-6 text-gray-400 font-medium">No entries yet.</td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr key={entry.id} className="border-b border-gray-100">
                    <td className="px-2 py-2">
                      <div className="font-bold text-slate-800">{entry.category}</div>
                      <div className="text-[10px] text-gray-500">₹{entry.rate}</div>
                      {entry.mode !== 'Normal' && <div className="text-[9px] text-blue-600 font-bold">{entry.mode}</div>}
                    </td>
                    <td className="px-2 py-2 text-center">
                      <input 
                        type="number" 
                        value={entry.originalQty || ''} 
                        onChange={(e) => handleUpdateQty(entry.id, parseInt(e.target.value) || 0)}
                        className="w-14 text-center font-bold text-lg border-b-2 border-slate-300 outline-none bg-transparent focus:border-blue-500"
                      />
                      {entry.mode !== 'Normal' && <div className="text-[9px] text-gray-500 mt-1">(x{entry.multiplier}={entry.effectiveQty})</div>}
                    </td>
                    <td className="px-2 py-2 text-right">
                      <div className="font-bold text-slate-800 text-xs">C: ₹{entry.itemCollection}</div>
                      <div className="text-[10px] text-orange-600">B: ₹{entry.itemBase}</div>
                      <div className="text-[10px] text-green-600 font-bold">P: ₹{entry.itemCommission}</div>
                    </td>
                    <td className="px-2 py-2 text-center">
                      <button onClick={() => handleDelete(entry.id)} className="text-red-400 hover:text-red-600 p-2"><FaTrash /></button>
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
        <div className="absolute inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-sm flex flex-col max-h-[80vh]">
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="font-bold text-lg">Report Summary</h2>
              <button onClick={() => setShowSummary(false)} className="text-gray-500 text-xl"><FaTimes /></button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              <pre className="text-sm bg-gray-50 p-3 border rounded text-gray-800 whitespace-pre-wrap font-mono">
                {generateSummaryText() || "No entries to summarize."}
              </pre>
            </div>
            <div className="p-4 border-t bg-gray-50 space-y-2">
              <button onClick={initiateSaveArchive} className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-2 rounded flex items-center justify-center shadow-sm">
                <FaSave className="mr-2" /> SAVE THIS SUMMARY
              </button>
              <button onClick={() => copyToClipboard(generateSummaryText())} className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-2 rounded flex items-center justify-center shadow-sm">
                <FaCopy className="mr-2" /> COPY TEXT
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM SAVE PROMPT MODAL */}
      {showSavePrompt && (
        <div className="absolute inset-0 bg-black/70 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-xs flex flex-col shadow-2xl">
            <div className="p-4 border-b">
              <h2 className="font-bold text-lg text-slate-800">Save Summary</h2>
            </div>
            <form onSubmit={confirmSaveArchive} className="p-4 space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 block mb-2">Enter a name for this summary:</label>
                <input 
                  type="text" 
                  value={summaryName} 
                  onChange={(e) => setSummaryName(e.target.value)}
                  className="w-full border-2 border-slate-300 p-2 rounded outline-none focus:border-indigo-500 font-bold text-slate-800"
                  autoFocus
                  placeholder="e.g., Morning Shift"
                />
              </div>
              
              <div className="flex items-center gap-2 mt-2 bg-gray-50 p-2 rounded border border-gray-200">
                <input 
                  type="checkbox" 
                  id="clearAfterSave" 
                  checked={clearAfterSave} 
                  onChange={(e) => setClearAfterSave(e.target.checked)} 
                  className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer"
                />
                <label htmlFor="clearAfterSave" className="text-xs font-bold text-slate-700 cursor-pointer select-none">
                  Clear calculations after saving
                </label>
              </div>

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowSavePrompt(false)} className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 rounded">Cancel</button>
                <button type="submit" className="flex-1 bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-2 rounded shadow-sm">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ARCHIVES MODAL WITH CALENDAR VIEW */}
      {showArchives && (
        <div className="absolute inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-sm flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="font-bold text-lg">Saved Summaries</h2>
              <button onClick={() => setShowArchives(false)} className="text-gray-500 text-xl"><FaTimes /></button>
            </div>
            
            {/* Calendar Filter Section */}
            <div className="p-3 bg-yellow-50 border-b flex flex-col gap-2">
              <label className="text-xs font-bold text-yellow-800 flex items-center gap-1">
                <FaCalendarAlt /> CALENDAR VIEW
              </label>
              <div className="flex gap-2">
                <input 
                  type="date" 
                  value={archiveDateFilter}
                  onChange={(e) => setArchiveDateFilter(e.target.value)}
                  className="flex-1 p-2 border border-yellow-300 rounded outline-none font-bold text-slate-700 bg-white"
                />
                {archiveDateFilter && (
                  <button onClick={() => setArchiveDateFilter('')} className="bg-gray-200 hover:bg-gray-300 px-3 rounded text-xs font-bold text-gray-700">
                    CLEAR
                  </button>
                )}
              </div>
            </div>

            <div className="p-4 overflow-y-auto flex-1 space-y-3">
              {archives.length === 0 ? (
                <p className="text-center text-gray-400 py-4">No saved summaries yet.</p>
              ) : filteredArchives.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500 font-bold">No bills saved on this date.</p>
                  <button onClick={() => setArchiveDateFilter('')} className="text-blue-500 text-sm mt-2 font-bold underline">View All Dates</button>
                </div>
              ) : (
                filteredArchives.map(arc => (
                  <div key={arc.id} className="bg-gray-50 border rounded p-3">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-bold text-slate-800">{arc.name}</h3>
                        <p className="text-[10px] text-gray-500 font-medium">{arc.date}</p>
                      </div>
                      <button onClick={() => setArchives(archives.filter(a => a.id !== arc.id))} className="text-red-400 hover:text-red-600 mt-1"><FaTrash /></button>
                    </div>
                    <pre className="text-xs bg-white p-2 border rounded text-gray-600 font-mono mb-2 whitespace-pre-wrap">{arc.summaryText}</pre>
                    <button onClick={() => copyToClipboard(arc.summaryText)} className="w-full bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-1 rounded text-xs flex items-center justify-center">
                      <FaCopy className="mr-1" /> COPY
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* SETTINGS MODAL */}
      {showSettings && (
        <div className="absolute inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-sm flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="font-bold text-lg">Edit Price Rates</h2>
              <button onClick={() => setShowSettings(false)} className="text-gray-500 text-xl"><FaTimes /></button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 space-y-6">
              {Object.keys(tempRates).map(cat => (
                <div key={cat}>
                  <h3 className="font-black text-slate-800 mb-2 border-b pb-1">{cat} Tiers</h3>
                  {tempRates[cat].map((rate, i) => (
                    <div key={i} className="flex gap-2 mb-2 items-center">
                      <div className="flex-1">
                        <label className="text-[10px] text-gray-500 font-bold block">SALE PRICE</label>
                        <input type="number" step="0.1" value={rate.coll} onChange={(e) => updateTempRate(cat, i, 'coll', Number(e.target.value))} className="w-full border p-1 rounded text-sm font-bold bg-slate-50"/>
                      </div>
                      <div className="flex-1">
                        <label className="text-[10px] text-orange-600 font-bold block">COMPANY BASE</label>
                        <input type="number" step="0.1" value={rate.base} onChange={(e) => updateTempRate(cat, i, 'base', Number(e.target.value))} className="w-full border p-1 rounded text-sm font-bold bg-orange-50"/>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div className="p-4 border-t bg-gray-50">
              <button onClick={handleResetSettings} className="w-full bg-red-100 hover:bg-red-200 text-red-600 font-bold py-2 rounded flex items-center justify-center shadow-sm mb-3 text-sm">
                RESET TO DEFAULTS
              </button>
              <button onClick={handleSaveSettings} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded flex items-center justify-center shadow-md">
                <FaCheck className="mr-2" /> SAVE SETTINGS
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
