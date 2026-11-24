import { CATALOGS, catalogTypeFromPlatforms, groupCaseRecords } from './caseModel.js';

const DB_NAME = 'qa-regression-manager';
const DB_VERSION = 3;
const STORES = { cases: 'cases', regressions: 'regressions', results: 'results', settings: 'settings', assets: 'assets', catalogs: 'catalogs' };
const cleanStep = step => {
  const { platforms, legacyResults, sourceNumber, sourceRow, sheet, sourceId, importReview, ...record } = step;
  return record;
};
const cleanRunStep = step => {
  const { platforms, legacyResults, sourceNumber, sourceRow, sheet, sourceId, importReview, ...record } = step;
  return record;
};
const cleanTestCase = testCase => {
  const { platforms, catalogPlatforms, sourceFile, sourceId, sourceNumber, sourceRow, sheet, imported, importReview, legacyResults, section, ...record } = testCase;
  return { ...record, steps: (testCase.steps || []).map(cleanStep) };
};
const cleanRunCase = testCase => {
  const { platforms, catalogPlatforms, sourceFile, sourceId, sourceNumber, sourceRow, sheet, imported, importReview, legacyResults, section, ...record } = testCase;
  return { ...record, steps: (testCase.steps || []).map(cleanRunStep) };
};
const cleanRegression = run => {
  const { catalogPlatforms, ...record } = run;
  return { ...record, cases: (run.cases || []).map(cleanRunCase) };
};

let dbPromise;
function database() {
  if (!('indexedDB' in window)) return Promise.reject(new Error('IndexedDB недоступна в этом браузере.'));
  if (!dbPromise) dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORES.cases)) {
        const store = db.createObjectStore(STORES.cases, { keyPath: 'id' });
        store.createIndex('section', 'section');
      }
      if (!db.objectStoreNames.contains(STORES.regressions)) db.createObjectStore(STORES.regressions, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(STORES.results)) {
        const store = db.createObjectStore(STORES.results, { keyPath: 'id' });
        store.createIndex('regressionId', 'regressionId');
      }
      if (!db.objectStoreNames.contains(STORES.settings)) db.createObjectStore(STORES.settings, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(STORES.assets)) db.createObjectStore(STORES.assets, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(STORES.catalogs)) db.createObjectStore(STORES.catalogs, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

function run(store, mode, operation) {
  return database().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const request = operation(tx.objectStore(store));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    tx.onabort = () => reject(tx.error || new Error('Транзакция отменена.'));
  }));
}
const all = store => run(store, 'readonly', s => s.getAll());
const put = (store, record) => run(store, 'readwrite', s => s.put(record));

export const repository = {
  async getCases() {
    const items = await all(STORES.cases);
    const grouped = items.some(item => !Array.isArray(item.steps) || !item.catalogType) ? groupCaseRecords(items) : items;
    const cleaned = grouped.map(cleanTestCase);
    if (JSON.stringify(cleaned) === JSON.stringify(items)) return cleaned.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const db = await database();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.cases, 'readwrite');
      const store = tx.objectStore(STORES.cases);
      store.clear(); cleaned.forEach(item => store.put(item));
      tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
    });
    return cleaned.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  },
  saveCase(testCase) { return put(STORES.cases, cleanTestCase(testCase)); },
  deleteCase(id) { return run(STORES.cases, 'readwrite', s => s.delete(id)); },
  async reorderCases(items) {
    const db = await database();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.cases, 'readwrite');
      const store = tx.objectStore(STORES.cases);
      items.forEach((item, index) => store.put({ ...item, order: index }));
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Не удалось сохранить порядок тестов.'));
    });
  },
  async getRegressions() {
    const runs = await all(STORES.regressions);
    const cleaned = runs.map(run => {
      const record = cleanRegression(run);
      const cases = record.cases;
      const platforms = cases.flatMap(item => item.platforms || item.steps?.flatMap(step => step.platforms || []) || []);
      return { ...record, catalogType: run.catalogType || cases.find(item => item.catalogType)?.catalogType || catalogTypeFromPlatforms(platforms) };
    });
    if (JSON.stringify(cleaned) !== JSON.stringify(runs)) {
      const db = await database();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORES.regressions, 'readwrite');
        const store = tx.objectStore(STORES.regressions);
        store.clear(); cleaned.forEach(item => store.put(item));
        tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
      });
    }
    return cleaned.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  saveRegression(regression) { return put(STORES.regressions, regression); },
  async deleteRegression(id) {
    const db = await database();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORES.regressions, STORES.results], 'readwrite');
      tx.objectStore(STORES.regressions).delete(id);
      const cursorRequest = tx.objectStore(STORES.results).openCursor();
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (!cursor) return;
        if (cursor.value.regressionId === id) cursor.delete();
        cursor.continue();
      };
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Не удалось удалить регресс.'));
    });
  },
  async getResults(regressionId) { return (await all(STORES.results)).filter(r => r.regressionId === regressionId); },
  saveResult(result) { return put(STORES.results, result); },
  async getAssets() {
    const assets = await all(STORES.assets);
    const retained = assets.filter(asset => asset.source === 'user' || asset.source === 'catalog');
    if (retained.length !== assets.length) {
      const db = await database();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORES.assets, 'readwrite');
        const store = tx.objectStore(STORES.assets);
        store.clear(); retained.forEach(asset => store.put(asset));
        tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
      });
    }
    return retained;
  },
  saveAsset(asset) { return put(STORES.assets, asset); },
  deleteAsset(id) { return run(STORES.assets, 'readwrite', store => store.delete(id)); },
  async getCatalogs() {
    let catalogs = await all(STORES.catalogs);
    if (!catalogs.length) {
      await Promise.all(CATALOGS.map((catalog, order) => put(STORES.catalogs, { ...catalog, order })));
      catalogs = await all(STORES.catalogs);
    }
    const cleaned = catalogs.map(({ platforms, ...catalog }) => catalog.id === 'web' && catalog.label === 'Веб и мобильный Safari'
      ? { ...catalog, label: 'Веб и мобильные версии', shortLabel: 'Веб / mobile' }
      : catalog);
    if (JSON.stringify(cleaned) !== JSON.stringify(catalogs)) {
      const db = await database();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORES.catalogs, 'readwrite');
        const store = tx.objectStore(STORES.catalogs);
        store.clear(); cleaned.forEach(catalog => store.put(catalog));
        tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
      });
    }
    return cleaned.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  },
  saveCatalog(catalog) {
    const { platforms, ...record } = catalog;
    return put(STORES.catalogs, record);
  },
  async importCatalogArchive(data) {
    const db = await database();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORES.catalogs, STORES.cases, STORES.assets], 'readwrite');
      data.catalogs.forEach((catalog, index) => tx.objectStore(STORES.catalogs).put({ ...catalog, order: catalog.order ?? index }));
      data.cases.forEach(testCase => tx.objectStore(STORES.cases).put(cleanTestCase(testCase)));
      (data.assets || []).filter(asset => asset.source === 'user' || asset.source === 'catalog').forEach(asset => tx.objectStore(STORES.assets).put(asset));
      tx.oncomplete = () => resolve({ catalogs: data.catalogs.length, cases: data.cases.length, assets: (data.assets || []).length });
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Импорт архива отменён.'));
    });
  },
  async deleteCatalog(id) {
    const db = await database();
    const catalog = (await all(STORES.catalogs)).find(item => item.id === id);
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORES.catalogs, STORES.cases, STORES.regressions], 'readwrite');
      tx.objectStore(STORES.catalogs).delete(id);
      const cursorRequest = tx.objectStore(STORES.cases).openCursor();
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (!cursor) return;
        if (cursor.value.catalogType === id) cursor.delete();
        cursor.continue();
      };
      const runCursor = tx.objectStore(STORES.regressions).openCursor();
      runCursor.onsuccess = () => {
        const cursor = runCursor.result;
        if (!cursor) return;
        if (cursor.value.catalogType === id && !cursor.value.catalogTitle) cursor.update({ ...cursor.value, catalogTitle: catalog?.label || id });
        cursor.continue();
      };
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Не удалось удалить каталог.'));
    });
  },
  async getSetting(id) { return run(STORES.settings, 'readonly', store => store.get(id)); },
  async setSetting(id, value) { return put(STORES.settings, { id, value }); },
  async saveBackup(data) {
    const db = await database();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(Object.values(STORES), 'readwrite');
      Object.values(STORES).forEach(name => tx.objectStore(name).clear());
      data.cases.forEach(item => tx.objectStore(STORES.cases).put(cleanTestCase(item)));
      data.regressions.forEach(item => tx.objectStore(STORES.regressions).put(cleanRegression(item)));
      data.results.forEach(item => tx.objectStore(STORES.results).put(item));
      (data.assets || []).filter(item => item.source === 'user' || item.source === 'catalog').forEach(item => tx.objectStore(STORES.assets).put(item));
      (data.catalogs?.length ? data.catalogs : CATALOGS).forEach((item, index) => tx.objectStore(STORES.catalogs).put({ ...item, order: item.order ?? index }));
      tx.objectStore(STORES.settings).put({ id: 'backup', value: data.settings || {} });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  },
  async getBackup() {
    const [cases, regressions, results, settings, assets, catalogs] = await Promise.all([this.getCases(), this.getRegressions(), all(STORES.results), all(STORES.settings), this.getAssets(), this.getCatalogs()]);
    const savedSettings = settings.find(s => s.id === 'backup')?.value || {};
    return { format: 'qa-regression-manager-backup', version: 3, exportedAt: new Date().toISOString(), cases, regressions, results, assets, catalogs, settings: savedSettings };
  },
};

export const makeId = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
