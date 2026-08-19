import { useState, useEffect, useRef } from 'react';
import { FaTrash, FaPlus, FaCloudUploadAlt } from 'react-icons/fa';

type Mode = 'Normal' | 'BOX' | 'ALL';

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

const RATE_CONFIG: Record<string, { coll: number, base: number }[]> = {
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

const MULTIPLIERS: Record<string, { BOX?: number, ALL?: number }> = {
  '1D': { ALL: 3 },
  '2D': { ALL: 3 },
  '3D': { BOX: 6 },
  '4D': { BOX: 24 },
};

export default function App() {
  const [entries, setEntries] = useState<EntryItem[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [category, setCategory] = useState('3D');
  const [collectionRate, setCollectionRate] = useState(22);
  const [mode, setMode] = useState<Mode>('Normal');
  const inputRef = useRef<HTMLInputElement>(null);

  // Load saved bills when the app starts
  useEffect(() => {
    const saved = localStorage.getItem('offlineBills');
    if (saved) {
      setEntries(JSON.parse(saved));
    }
  }, []);

  // Save bills locally every time the entries array changes
  useEffect(() => {
    localStorage.setItem('offlineBills', JSON.stringify(entries));
  }, [entries]);

  useEffect(() => {
    setCollectionRate(RATE_CONFIG[category][0].coll);
    setMode('Normal'); 
  }, [category]);

  const handleAdd = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const qty = parseInt(currentInput);
    
    if (!isNaN(qty) && qty > 0) {
      const currentRateObj = RATE_CONFIG[category].find(r => r.coll === collectionRate) || RATE_CONFIG[category][0];
      const baseRate = currentRateObj.base;

      let multiplier = 1;
      if (mode === 'BOX' && MULTIPLIERS[category].BOX) multiplier = MULTIPLIERS[category].BOX!;
      if (mode === 'ALL' && MULTIPLIERS[category].ALL) multiplier = MULTIPLIERS[category].ALL!;

      const effectiveQty = qty * multiplier;
      const itemCollection = Math.round((effectiveQty * collectionRate) * 100) / 100;
      const itemBase = Math.round((effectiveQty * baseRate) * 100) / 100;
      const itemCommission = Math.round((itemCollection - itemBase) * 100) / 100;

      const newEntry: EntryItem = {
        id: Date.now(),
        category,
        rate: collectionRate,
        baseRate,
        mode,
        originalQty: qty,
        multiplier,
        effectiveQty,
        itemCollection,
        itemBase,
        itemCommission
      };

      setEntries([newEntry, ...entries]);
      setCurrentInput('');
      inputRef.current?.focus();
    }
  };

  const handleDelete = (id: number) => {
    setEntries(entries.filter(entry => entry.id !== id));
  };

  // Sync Data to Google Sheets
  const handleSync = async () => {
    if (entries.length === 0) return alert("No entries to sync!");
    if (!navigator.onLine) return alert("No internet connection! Connect to Wi-Fi/Data first.");
    
    try {
      // REPLACE THIS URL WITH YOUR GOOGLE APPS SCRIPT URL
      const scriptURL = "YOUR_GOOGLE_SCRIPT_URL_HERE"; 
      
      await fetch(scriptURL, { 
        method: "POST", 
        body: JSON.stringify(entries),
        mode: "no-cors" // Helps bypass strict security policies for simple Google Apps Scripts
      });
      
      setEntries([]); // Clear the screen
      alert("Successfully synced to Google Sheets!");
    } catch (error) {
      alert("Failed to sync. Make sure your Script URL is correct.");
    }
  };

  const availableModes = ['Normal'];
  if (category === '1D' || category === '2D') availableModes.push('ALL');
  if (category === '3D' || category === '4D') availableModes.push('BOX');

  const totalEntries = entries.reduce((sum, item) => sum + item.effectiveQty, 0);
  const totalCollection = entries.reduce((sum, item) => sum + item.itemCollection, 0);
  const totalBase = entries.reduce((sum, item) => sum + item.itemBase, 0);
  const totalCommission = entries.reduce((sum, item) => sum + item.itemCommission, 0);

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col font-sans max-w-md mx-auto shadow-xl">
      <header className="bg-slate-800 text-white p-4 shadow-md z-10 flex justify-between items-center">
        <h1 className="text-lg font-bold tracking-wider">CALCULATOR</h1>
        <button onClick={handleSync} className="bg-green-500 hover:bg-green-600 px-3 py-1 rounded font-bold text-sm flex items-center gap-1 shadow">
          <FaCloudUploadAlt /> SYNC
        </button>
      </header>

      <div className="bg-slate-700 p-4 pt-0">
        <div className="grid grid-cols-3 gap-2 text-sm text-black">
          <select className="p-2 rounded bg-white font-bold outline-none" value={category} onChange={(e) => setCategory(e.target.value)}>
            {Object.keys(RATE_CONFIG).map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </select>
          <select className="p-2 rounded bg-white font-bold outline-none" value={collectionRate} onChange={(e) => setCollectionRate(Number(e.target.value))}>
            {RATE_CONFIG[category].map((rate, i) => <option key={i} value={rate.coll}>₹{rate.coll.toFixed(2)}</option>)}
          </select>
          <select className="p-2 rounded bg-white font-bold outline-none" value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
            {availableModes.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-white p-4 shadow-sm border-b-2 border-gray-200">
        <div className="flex justify-between items-end mb-2 border-b pb-2">
          <span className="text-gray-500 font-bold text-sm tracking-wide">TOTAL ENTRIES</span>
          <span className="text-3xl font-black text-gray-800">{totalEntries}</span>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-3 text-sm text-center">
          <div className="bg-gray-50 p-2 rounded border border-gray-200 flex flex-col justify-center">
            <div className="text-[10px] text-gray-500 font-bold">COLLECTION</div>
            <div className="text-sm font-bold text-gray-800">₹{totalCollection.toFixed(2)}</div>
          </div>
          <div className="bg-orange-50 p-2 rounded border border-orange-200 flex flex-col justify-center">
            <div className="text-[10px] text-orange-600 font-bold">BASE</div>
            <div className="text-sm font-bold text-orange-700">₹{totalBase.toFixed(2)}</div>
          </div>
          <div className="bg-green-50 p-2 rounded border border-green-200 flex flex-col justify-center">
            <div className="text-[10px] text-green-700 font-bold">COMMISSION</div>
            <div className="text-sm font-black text-green-700">₹{totalCommission.toFixed(2)}</div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="bg-white rounded shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-100 text-slate-600 font-bold text-[11px] uppercase border-b border-gray-200">
              <tr>
                <th className="px-2 py-3">Type</th>
                <th className="px-2 py-3 text-center">Qty</th>
                <th className="px-2 py-3 text-right">Details</th>
                <th className="px-2 py-3 text-center">Del</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-b border-gray-100">
                  <td className="px-2 py-3">
                    <div className="font-bold text-slate-800">{entry.category}</div>
                    <div className="text-[10px] text-gray-500">Rate: ₹{entry.rate.toFixed(2)}</div>
                    {entry.mode !== 'Normal' && <div className="text-[10px] text-blue-600 font-bold uppercase mt-1">{entry.mode}</div>}
                  </td>
                  <td className="px-2 py-3 text-center align-top pt-4">
                    <span className="font-bold text-lg">{entry.originalQty}</span>
                    {entry.mode !== 'Normal' && <div className="text-[10px] text-gray-500 font-bold mt-1">(x{entry.multiplier} = {entry.effectiveQty})</div>}
                  </td>
                  <td className="px-2 py-3 text-right">
                    <div className="font-bold text-slate-800">Coll: ₹{entry.itemCollection.toFixed(2)}</div>
                    <div className="text-[10px] text-orange-600 font-medium">Base: ₹{entry.itemBase.toFixed(2)}</div>
                    <div className="text-[10px] text-green-600 font-bold">Comm: ₹{entry.itemCommission.toFixed(2)}</div>
                  </td>
                  <td className="px-2 py-3 text-center align-middle">
                    <button onClick={() => handleDelete(entry.id)} className="text-red-400 hover:text-red-600 p-2">
                      <FaTrash />
                    </button>
                  </td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-slate-400 font-medium">No entries yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] pb-8 z-10">
        <form onSubmit={handleAdd} className="flex gap-2">
          <input ref={inputRef} type="number" className="flex-1 text-3xl p-3 border-2 border-slate-300 rounded-lg text-center font-bold focus:border-blue-500 outline-none" placeholder="Qty" value={currentInput} onChange={(e) => setCurrentInput(e.target.value)} />
          <button type="submit" className="bg-blue-600 text-white p-4 rounded-lg text-xl font-bold flex items-center justify-center w-28"><FaPlus className="mr-2" /> ADD</button>
        </form>
      </div>
    </div>
  );
}