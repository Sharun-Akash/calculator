import { useState, useEffect, useRef } from 'react';
import { FaTrash, FaPlus, FaCloudUploadAlt, FaCopy, FaCog, FaTimes, FaClipboardList } from 'react-icons/fa';

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
    { coll: 18.00, base: 18.00 },
    { coll: 49.00, base: 49.00 },
    { coll: 98.00, base: 98.00 },
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
  // Load custom rates or fallback to defaults
  const [ratesConfig, setRatesConfig] = useState<Record<string, RateTier[]>>(() => {
    const savedRates = localStorage.getItem('customRates');
    return savedRates ? JSON.parse(savedRates) : DEFAULT_RATES;
  });

  const [entries, setEntries] = useState<EntryItem[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  
  const [category, setCategory] = useState('3D');
  const [collectionRate, setCollectionRate] = useState(ratesConfig['3D'][0].coll);
  const [mode, setMode] = useState<Mode>('Normal');
  
  const [showSummary, setShowSummary] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('offlineBills');
    if (saved) setEntries(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem('offlineBills', JSON.stringify(entries));
  }, [entries]);

  useEffect(() => {
    localStorage.setItem('customRates', JSON.stringify(ratesConfig));
  }, [ratesConfig]);

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
      inputRef.current?.focus();
    }
  };

  const handleDelete = (id: number) => setEntries(entries.filter(entry => entry.id !== id));

  const generateSummaryText = () => {
    let text = '';
    ['1D', '2D', '3D', '4D'].forEach(cat => {
      const catEntries = entries.filter(e => e.category === cat);
      if (catEntries.length === 0) return;
      
      text += `${cat.toLowerCase()}\n`;
      const uniqueRates = [...new Set(catEntries.map(e => e.rate))].sort((a, b) => a - b);
      
      uniqueRates.forEach(rate => {
        const group = catEntries.filter(e => e.rate === rate);
        const totalQty = group.reduce((sum, e) => sum + e.effectiveQty, 0);
        const totalBase = group.reduce((sum, e) => sum + e.itemBase, 0);
        const totalComm = group.reduce((sum, e) => sum + e.itemCommission, 0);
        
        text += `Rs.${rate} : ${totalQty} - ${totalBase.toFixed(2)} = ${totalComm.toFixed(2)}\n`;
      });
      text += '\n';
    });
    return text.trim();
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generateSummaryText());
    alert("Summary copied to clipboard!");
  };

  const getAvailableModes = () => {
    const modes: Mode[] = ['Normal'];
    if (category === '1D' || category === '2D') modes.push('ALL');
    if (category === '3D') modes.push('BOX (3)', 'BOX (6)');
    if (category === '4D') modes.push('BOX (4)', 'BOX (6)', 'BOX (12)', 'BOX (24)');
    return modes;
  };

  const updateRate = (cat: string, index: number, field: 'coll' | 'base', value: number) => {
    const newRates = { ...ratesConfig };
    newRates[cat][index][field] = value;
    setRatesConfig(newRates);
  };

  const totalEntries = entries.reduce((sum, item) => sum + item.effectiveQty, 0);
  const totalCollection = entries.reduce((sum, item) => sum + item.itemCollection, 0);
  const totalBase = entries.reduce((sum, item) => sum + item.itemBase, 0);
  const totalCommission = entries.reduce((sum, item) => sum + item.itemCommission, 0);

  return (
    // h-[100dvh] ensures the screen size is perfectly locked to the mobile viewport, keeping the input box on screen
    <div className="h-[100dvh] bg-gray-100 flex flex-col font-sans max-w-md mx-auto shadow-xl relative overflow-hidden">
      
      {/* HEADER */}
      <header className="bg-slate-800 text-white p-3 shadow-md z-10 flex justify-between items-center shrink-0">
        <h1 className="text-lg font-bold tracking-wider">SHARUN'S APP</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowSummary(true)} className="bg-blue-500 hover:bg-blue-600 px-2 py-1 flex items-center rounded text-sm font-bold shadow">
            <FaClipboardList className="mr-1"/> SUM
          </button>
          <button onClick={() => setShowSettings(true)} className="bg-gray-600 hover:bg-gray-500 px-2 py-1 rounded text-sm shadow">
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

      {/* DASHBOARD */}
      <div className="bg-white p-3 shadow-sm border-b-2 border-gray-200 shrink-0">
        <div className="flex justify-between items-end mb-2 border-b pb-1">
          <span className="text-gray-500 font-bold text-xs tracking-wide">TOTAL ENTRIES</span>
          <span className="text-2xl font-black text-gray-800">{totalEntries}</span>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-2 text-sm text-center">
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
      <div className="flex-1 overflow-y-auto p-2 bg-slate-50">
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
              {entries.map((entry) => (
                <tr key={entry.id} className="border-b border-gray-100">
                  <td className="px-2 py-2">
                    <div className="font-bold text-slate-800">{entry.category}</div>
                    <div className="text-[10px] text-gray-500">₹{entry.rate}</div>
                    {entry.mode !== 'Normal' && <div className="text-[9px] text-blue-600 font-bold">{entry.mode}</div>}
                  </td>
                  <td className="px-2 py-2 text-center">
                    <span className="font-bold text-lg">{entry.originalQty}</span>
                    {entry.mode !== 'Normal' && <div className="text-[9px] text-gray-500">(x{entry.multiplier}={entry.effectiveQty})</div>}
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
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* FIXED INPUT AREA */}
      <div className="bg-white p-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] shrink-0 z-10 pb-6">
        <form onSubmit={handleAdd} className="flex gap-2">
          <input ref={inputRef} type="number" className="flex-1 text-2xl p-2 border-2 border-slate-300 rounded text-center font-bold outline-none focus:border-blue-500" placeholder="Qty" value={currentInput} onChange={(e) => setCurrentInput(e.target.value)} />
          <button type="submit" className="bg-blue-600 text-white px-4 rounded text-lg font-bold shadow-md"><FaPlus className="inline mr-1" /> ADD</button>
        </form>
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
            <div className="p-4 border-t bg-gray-50">
              <button onClick={copyToClipboard} className="w-full bg-green-500 text-white font-bold py-3 rounded flex items-center justify-center">
                <FaCopy className="mr-2" /> COPY TO CLIPBOARD
              </button>
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
              {Object.keys(ratesConfig).map(cat => (
                <div key={cat}>
                  <h3 className="font-black text-slate-800 mb-2 border-b pb-1">{cat} Tiers</h3>
                  {ratesConfig[cat].map((rate, i) => (
                    <div key={i} className="flex gap-2 mb-2 items-center">
                      <div className="flex-1">
                        <label className="text-[10px] text-gray-500 font-bold block">SALE PRICE</label>
                        <input type="number" step="0.1" value={rate.coll} onChange={(e) => updateRate(cat, i, 'coll', Number(e.target.value))} className="w-full border p-1 rounded text-sm font-bold bg-slate-50"/>
                      </div>
                      <div className="flex-1">
                        <label className="text-[10px] text-orange-600 font-bold block">COMPANY BASE</label>
                        <input type="number" step="0.1" value={rate.base} onChange={(e) => updateRate(cat, i, 'base', Number(e.target.value))} className="w-full border p-1 rounded text-sm font-bold bg-orange-50"/>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
