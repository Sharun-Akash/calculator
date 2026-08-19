import Dexie, { type Table } from 'dexie';
export interface RateConfig {
  id?: number; category: string; collectionRate: number; baseRate: number; boxMultiplier: number; allMultiplier: number;
}
export interface DailyRecord {
  id?: number; date: string; category: string; rate: number; mode: string; entries: number[]; totalEntries: number; multiplier: number; effectiveEntries: number; collection: number; base: number; commission: number;
}

export class CalculatorDB extends Dexie {
  rates!: Table<RateConfig>;
  history!: Table<DailyRecord>;
  constructor() {
    super('EntryCalculatorDB');
    this.version(1).stores({ rates: '++id, category, collectionRate', history: '++id, date, category' });
  }
}
export const db = new CalculatorDB();

export const initializeDefaultRates = async () => {
  const count = await db.rates.count();
  if (count === 0) {
    await db.rates.bulkAdd([
      { category: '3D', collectionRate: 22, baseRate: 20, boxMultiplier: 3, allMultiplier: 24 },
    ]);
  }
};