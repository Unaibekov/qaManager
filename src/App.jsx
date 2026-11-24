import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import CaseCatalog from './components/CaseCatalog.jsx';
import { makeId, repository } from './services/database.js';
import { executionGroups } from './services/caseModel.js';

const navigation = [
  { id: 'dashboard', label: 'Обзор', icon: '▦' },
  { id: 'cases', label: 'Каталог тестов', icon: '☷' },
  { id: 'regressions', label: 'Регрессы', icon: '◷' },
  { id: 'history', label: 'История', icon: '◴' },
  { id: 'transfer', label: 'Импорт / экспорт', icon: '⇅' },
];

const titles = {
  dashboard: ['Обзор', 'Состояние каталога и последних прогонов'],
  cases: ['Каталог тестов', ''],
  regressions: ['Регрессы', 'Создавайте прогоны и отслеживайте результаты'],
  history: ['История регрессов', 'Завершённые прогоны и их результаты'],
  transfer: ['Импорт / экспорт', 'Перенос каталогов и резервные копии'],
  settings: ['Настройки', 'Параметры локального приложения'],
};

export default function App() {
  const [page, setPage] = useState('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState('');
  const [cases, setCases] = useState([]);
  const [regressions, setRegressions] = useState([]);
  const [assets, setAssets] = useState([]);
  const [catalogs, setCatalogs] = useState([]);
  const [dataReady, setDataReady] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [title, subtitle] = titles[showSettings ? 'settings' : page];

  useEffect(() => {
    const updateScrollState = () => setShowScrollTop(window.scrollY > 240);
    updateScrollState();
    window.addEventListener('scroll', updateScrollState, { passive: true });
    return () => window.removeEventListener('scroll', updateScrollState);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function initialize() {
      try {
        const [items, runs, importedAssets, savedCatalogs] = await Promise.all([repository.getCases(), repository.getRegressions(), repository.getAssets(), repository.getCatalogs()]);
        if (!cancelled) { setCases(items); setRegressions(runs); setAssets(importedAssets); setCatalogs(savedCatalogs); setDataReady(true); }
      } catch (error) {
        if (!cancelled) { setNotice(`Не удалось открыть локальную базу: ${error.message}`); setDataReady(true); }
      }
    }
    initialize();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className={`app-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">Q</span><span className="brand-label">QA <b>Manager</b></span></div>
        <nav aria-label="Основная навигация">
          {navigation.map((item) => <button key={item.id} aria-label={item.label} title={sidebarCollapsed ? item.label : undefined} className={`nav-item ${!showSettings && page === item.id ? 'active' : ''}`} onClick={() => { setShowSettings(false); setPage(item.id); }}><span className="nav-icon">{item.icon}</span>{item.label}</button>)}
        </nav>
        <div className="sidebar-bottom">
          <div className="local-status"><span className="status-dot" /><span><b>Локальное хранилище</b><small>Данные на этом устройстве</small></span></div>
          <button aria-label="Настройки" title={sidebarCollapsed ? 'Настройки' : undefined} className={`nav-item ${showSettings ? 'active' : ''}`} onClick={() => setShowSettings(true)}><span className="nav-icon">⚙</span>Настройки</button>
          <div className="version"><span>v1.0</span></div>
          <button type="button" className="nav-item sidebar-collapse-button" aria-label={sidebarCollapsed ? 'Развернуть меню' : 'Свернуть меню'} title={sidebarCollapsed ? 'Развернуть меню' : 'Свернуть меню'} onClick={() => setSidebarCollapsed(value => !value)}><span className="nav-icon">{sidebarCollapsed ? '»' : '«'}</span>{sidebarCollapsed ? 'Развернуть меню' : 'Свернуть меню'}</button>
        </div>
      </aside>
      <main className="main-area">
        <section className="content">
          {!['cases', 'regressions', 'history'].includes(page) && <div className="page-heading"><div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div></div>}
          {notice && <div className="notice" role="status"><span>{notice}</span><button onClick={() => setNotice('')}>×</button></div>}
          {showSettings ? <div className="panel settings-panel"><div className="panel-heading"><div><h2>Локальное приложение</h2><p>Данные хранятся в браузере на этом устройстве.</p></div><span className="badge badge-green">Локально</span></div><div className="setting-row"><span><b>Хранилище данных</b><small>IndexedDB · текущий браузер</small></span><span className="setting-value">{dataReady ? 'Подключено' : 'Подключение…'}</span></div><div className="setting-row"><span><b>Резервная копия</b><small>Экспорт и восстановление базы</small></span><button className="button button-secondary" onClick={() => setPage('transfer')}>Открыть импорт / экспорт</button></div></div> : <>
          {page === 'dashboard' ? <><div className="stats-grid"><Stat label="Тестов в каталоге" value={dataReady ? cases.length.toLocaleString('ru-RU') : '…'} note={cases.length ? 'Сохранено в локальной базе' : 'Добавьте тесты в каталог'} icon="☷" /><Stat label="Активный регресс" value={regressions.filter(r => r.status === 'active').length} note="Текущие прогоны" icon="◷" /><Stat label="Последний прогон" value={regressions[0]?.name || '—'} note={regressions[0] ? new Date(regressions[0].createdAt).toLocaleDateString('ru-RU') : 'История пока пуста'} icon="◴" /><Stat label="Платформы" value="5" note="Android · iOS · adaptive iOs · adaptive android · WEB" icon="▧" /></div><div className="dashboard-grid"><div className="panel"><div className="panel-heading"><div><h2>Последние регрессы</h2><p>Недавние запуски тестирования</p></div><button className="text-button" onClick={() => setPage('history')}>Вся история →</button></div>{regressions.length ? <div className="recent-runs">{regressions.slice(0, 3).map(run => <button key={run.id} onClick={() => setPage(run.status === 'active' ? 'regressions' : 'history')}><span><b>{run.name}</b><small>{new Date(run.createdAt).toLocaleDateString('ru-RU')}</small></span><span className="badge badge-green">{run.status === 'active' ? 'В процессе' : 'Завершён'}</span></button>)}</div> : <EmptyState icon="◷" title="Пока нет регрессов" text="Создайте первый прогон, чтобы начать фиксировать результаты по платформам." action="Создать регресс" onAction={() => setPage('regressions')} />}</div><div className="panel progress-panel"><div className="panel-heading"><div><h2>Каталог проверок</h2><p>Текущий объём тестовой базы</p></div><span className="muted">{cases.length}</span></div><div className="empty-chart"><div className="chart-ring"><span>{cases.length || '—'}</span></div><span>{cases.length ? 'Тестов доступно для новых прогонов' : 'Создайте каталог и добавьте тесты'}</span></div></div></div><div className="panel quick-panel"><div className="panel-heading"><div><h2>Быстрый старт</h2><p>Начните работу с текущим чек-листом</p></div></div><div className="quick-actions"><button onClick={() => setPage('cases')}><span className="quick-icon blue">☷</span><span><b>Открыть каталог</b><small>Просматривать и редактировать проверки</small></span><span className="arrow">→</span></button><button onClick={() => setPage('regressions')}><span className="quick-icon green">＋</span><span><b>Создать регресс</b><small>Запустить новый прогон</small></span><span className="arrow">→</span></button></div></div></> : page === 'cases' ? <CaseCatalog cases={cases} setCases={setCases} search={search} setSearch={setSearch} assets={assets} setAssets={setAssets} catalogs={catalogs} setCatalogs={setCatalogs} /> : page === 'transfer' ? <ImportExportPage cases={cases} setCases={setCases} regressions={regressions} assets={assets} setAssets={setAssets} catalogs={catalogs} setCatalogs={setCatalogs} /> : (page === 'regressions' || page === 'history') ? <RegressionManager cases={cases} catalogs={catalogs} regressions={regressions} setRegressions={setRegressions} historyOnly={page === 'history'} /> : <div className="panel placeholder-panel"><EmptyState icon="◷" title="Создайте первый регресс" text="Новый регресс сохранит снимок тестов, чтобы история не менялась при редактировании каталога." action="Новый регресс" onAction={() => setPage('regressions')} /></div>}
          </>}
          <footer className="footer">Локальная система управления тестированием</footer>
        </section>
      </main>
      {showScrollTop && <button type="button" className="scroll-top-button" aria-label="Наверх" title="Наверх" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>↑</button>}
    </div>
  );
}

function Stat({ label, value, note, icon }) { return <div className="stat-card"><div className="stat-top"><span>{label}</span><span className="stat-icon">{icon}</span></div><strong>{value}</strong><small>{note}</small></div>; }

function EmptyState({ icon, title, text, action, onAction }) { return <div className="empty-state"><span className="empty-icon">{icon}</span><h3>{title}</h3><p>{text}</p>{action && <button className="button button-secondary" onClick={onAction}>{action}</button>}</div>; }

function CatalogArchivePage({ cases, catalogs, assets, setCases, setCatalogs, setAssets }) {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const savedAssets = assets.filter(asset => asset.source === 'user' || asset.source === 'catalog');
  function exportArchive() {
    try {
      const archive = { format: 'qa-regression-manager-catalog-archive', version: 1, exportedAt: new Date().toISOString(), catalogs, cases, assets: savedAssets };
      const url = URL.createObjectURL(new Blob([JSON.stringify(archive, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `qa-manager-catalogs-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setError(''); setMessage(`Архив подготовлен: ${catalogs.length} каталогов, ${cases.length} тестов и ${savedAssets.length} вложений.`);
    } catch (exportError) { setMessage(''); setError(`Не удалось создать архив: ${exportError.message}`); }
  }
  async function importArchive(file) {
    if (!file) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const data = JSON.parse(await file.text());
      if (data.format !== 'qa-regression-manager-catalog-archive' || data.version !== 1 || !Array.isArray(data.catalogs) || !Array.isArray(data.cases) || !Array.isArray(data.assets || [])) throw new Error('Формат файла не распознан или архив повреждён.');
      if (data.catalogs.some(item => !item?.id || !item?.label) || data.cases.some(item => !item?.id || !item?.catalogType || !Array.isArray(item.steps))) throw new Error('В архиве есть каталог или тест с некорректными данными.');
      const replacements = data.catalogs.filter(incoming => catalogs.some(current => current.id === incoming.id)).length;
      const replaceText = replacements ? ` Совпадающие каталоги (${replacements}) и тесты с одинаковыми ID будут обновлены из архива.` : '';
      if (!window.confirm(`Импортировать ${data.catalogs.length} каталогов, ${data.cases.length} тестов и ${(data.assets || []).length} вложений? Текущие данные сохранятся.${replaceText}`)) return;
      await repository.importCatalogArchive(data);
      const [nextCatalogs, nextCases, nextAssets] = await Promise.all([repository.getCatalogs(), repository.getCases(), repository.getAssets()]);
      setCatalogs(nextCatalogs); setCases(nextCases); setAssets(nextAssets);
      setMessage(`Импорт завершён: ${data.catalogs.length} каталогов и ${data.cases.length} тестов добавлено или обновлено.`);
    } catch (importError) { setError(`Не удалось импортировать архив: ${importError.message}`); }
    finally { setBusy(false); }
  }
  return <div className="archive-layout">
    <section className="panel archive-panel"><div className="panel-heading"><div><h2>Архив каталогов</h2><p>Скачайте копию каталогов и перенесите её на другой компьютер.</p></div><span className="archive-icon">▣</span></div>
      <div className="archive-summary"><div><b>{catalogs.length.toLocaleString('ru-RU')}</b><span>каталогов</span></div><div><b>{cases.length.toLocaleString('ru-RU')}</b><span>тестов</span></div><div><b>{savedAssets.length.toLocaleString('ru-RU')}</b><span>вложений</span></div></div>
      <div className="archive-actions"><button className="button button-primary" onClick={exportArchive} disabled={!catalogs.length}>Скачать архив JSON</button><label className="button button-secondary archive-import-button">{busy ? 'Импорт…' : 'Импортировать архив'}<input type="file" accept=".json,application/json" disabled={busy} onChange={event => { importArchive(event.target.files?.[0]); event.target.value = ''; }} /></label></div>
      {error && <div className="form-error" role="alert">{error}</div>}{message && <div className="import-success" role="status">{message}</div>}
      <p className="archive-note">Архив содержит каталоги, тесты, шаги и прикреплённые документы или изображения. Регрессы и результаты прогонов в него не входят. При импорте данные объединяются; совпадающие записи обновляются.</p>
    </section>
  </div>;
}

function ImportExportPage({ cases, setCases, regressions, assets, setAssets, catalogs, setCatalogs }) {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  async function downloadBackup() {
    try {
      const backup = await repository.getBackup();
      const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `qa-manager-backup-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setError(''); setMessage('Резервная копия сохранена.');
    } catch (downloadError) { setMessage(''); setError(`Не удалось создать копию: ${downloadError.message}`); }
  }
  async function restoreBackup(file) {
    if (!file) return;
    setError(''); setMessage('');
    try {
      const data = JSON.parse(await file.text());
      if (data.format !== 'qa-regression-manager-backup' || !Array.isArray(data.cases) || !Array.isArray(data.regressions) || !Array.isArray(data.results)) throw new Error('Формат файла не распознан.');
      if (!window.confirm(`Восстановить полную копию: ${data.cases.length} тестов и ${data.regressions.length} регрессов? Текущие данные будут заменены.`)) return;
      await repository.saveBackup(data);
      setCases(await repository.getCases()); setAssets(await repository.getAssets()); setCatalogs(await repository.getCatalogs());
      setMessage('Полная резервная копия восстановлена.');
    } catch (restoreError) { setError(`Не удалось восстановить копию: ${restoreError.message}`); }
  }
  return <div className="transfer-layout transfer-layout-backups">
    <div className="transfer-side-stack">
      <div className="panel backup-panel">
        <div className="panel-heading"><div><h2>Полная резервная копия</h2><p>Включает каталоги, тесты, вложения, регрессы и результаты прогонов.</p></div><span className="backup-icon">▣</span></div>
        <div className="backup-summary"><span><b>{cases.length.toLocaleString('ru-RU')}</b><small>тестов</small></span><span><b>{regressions.length.toLocaleString('ru-RU')}</b><small>регрессов</small></span><span><b>{assets.length.toLocaleString('ru-RU')}</b><small>вложений</small></span></div>
        <div className="backup-actions"><button className="button button-secondary" onClick={downloadBackup}>⇩ Скачать полную копию</button><label className="button button-secondary restore-button">⇧ Восстановить полную копию<input type="file" accept=".json" onChange={event => { restoreBackup(event.target.files?.[0]); event.target.value = ''; }} /></label></div>
        <small className="backup-hint">Восстановление заменяет все локальные данные, включая историю регрессов.</small>
        {error && <div className="form-error" role="alert">{error}</div>}{message && <div className="import-success" role="status">{message}</div>}
      </div>
      <CatalogArchivePage cases={cases} catalogs={catalogs} assets={assets} setCases={setCases} setCatalogs={setCatalogs} setAssets={setAssets} />
    </div>
  </div>;
}
const runStatuses = ['Не проверено', 'В процессе', 'Успешно', 'Не успешно', 'Пропущено'];
const runStatusTone = { 'Не проверено': 'unchecked', 'В процессе': 'in-progress', 'Успешно': 'success', 'Не успешно': 'failure', 'Пропущено': 'skipped' };
const runPlatformOptions = ['Android', 'iOS', 'adaptive iOs', 'adaptive android', 'WEB'];
const platformsForCatalog = () => runPlatformOptions;
const autoResizeTextarea = element => {
  if (!element) return;
  element.style.height = '0px';
  element.style.height = `${element.scrollHeight}px`;
};
function GrowingComment({ initialValue, disabled, label, onCommit }) {
  const [value, setValue] = useState(initialValue || '');
  const ref = useRef(null);
  useLayoutEffect(() => autoResizeTextarea(ref.current), [value]);
  return <textarea ref={ref} aria-label={label} disabled={disabled} value={value} onChange={event => setValue(event.target.value)} onBlur={() => { if (value !== (initialValue || '')) onCommit(value); }} placeholder="Комментарий..." rows="1" />;
}
function fileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('Не удалось прочитать файл.'));
    reader.readAsDataURL(file);
  });
}
function RegressionManager({ cases, catalogs, regressions, setRegressions, historyOnly }) {
  const visibleRuns = regressions.filter(run => historyOnly ? run.status === 'completed' : run.status === 'active');
  const [selectedId, setSelectedId] = useState(null);
  const [runMenuOpen, setRunMenuOpen] = useState(false);
  const runMenuRef = useRef(null);
  const [results, setResults] = useState([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [editRunOpen, setEditRunOpen] = useState(false);
  const [editRunName, setEditRunName] = useState('');
  const [editRunPlatforms, setEditRunPlatforms] = useState([]);
  const [name, setName] = useState('');
  const [runCatalog, setRunCatalog] = useState(cases.some(testCase => testCase.catalogType === 'mobile') ? 'mobile' : cases[0]?.catalogType || 'mobile');
  const [runPlatforms, setRunPlatforms] = useState(runPlatformOptions);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const selected = visibleRuns.find(run => run.id === selectedId) || null;
  useEffect(() => { if (!catalogs.some(catalog => catalog.id === runCatalog)) setRunCatalog(catalogs.find(catalog => cases.some(item => item.catalogType === catalog.id))?.id || catalogs[0]?.id || ''); }, [catalogs, cases, runCatalog]);
  useEffect(() => { if (!visibleRuns.some(run => run.id === selectedId)) setSelectedId(visibleRuns[0]?.id || null); }, [visibleRuns, selectedId]);
  useEffect(() => { if (!selectedId) { setResults([]); return; } repository.getResults(selectedId).then(setResults).catch(e => setError(e.message)); }, [selectedId]);
  useEffect(() => {
    if (!runMenuOpen) return undefined;
    const closeOnOutsideClick = event => { if (!runMenuRef.current?.contains(event.target)) setRunMenuOpen(false); };
    const closeOnEscape = event => { if (event.key === 'Escape') setRunMenuOpen(false); };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => { document.removeEventListener('pointerdown', closeOnOutsideClick); document.removeEventListener('keydown', closeOnEscape); };
  }, [runMenuOpen]);

  async function createRun(event) {
    event.preventDefault(); if (!name.trim()) return;
    if (!runPlatforms.length) return setError('Выберите хотя бы одну платформу.');
    const casesForRun = cases.filter(testCase => testCase.catalogType === runCatalog);
    if (!casesForRun.length) return setError('В выбранном каталоге пока нет тестов. Выберите другой каталог или добавьте проверки.');
    setBusy(true); setError('');
    try {
      const now = new Date().toISOString();
      const catalog = catalogs.find(item => item.id === runCatalog);
      const run = { id: makeId(), name: name.trim(), catalogType: runCatalog, catalogTitle: catalog?.label || runCatalog, platforms: [...runPlatforms], createdAt: now, status: 'active', cases: casesForRun.map(item => ({ id: item.id, title: item.title, note: item.note || '', catalogType: item.catalogType, steps: (item.steps || []).map(step => ({ id: step.id, title: step.title, kind: step.kind })), snapshotAt: now })) };
      await repository.saveRegression(run); setRegressions(await repository.getRegressions()); setSelectedId(run.id); setName(''); setCreateOpen(false);
    } catch (e) { setError(`Не удалось создать регресс: ${e.message}`); } finally { setBusy(false); }
  }
  async function saveResult(testCase, platform, patch) {
    if (!selected || selected.status !== 'active') return;
    const id = `${selected.id}:${testCase.id}:${platform}`;
    const previous = results.find(item => item.id === id) || {};
    const result = { ...previous, ...patch, id, regressionId: selected.id, caseId: testCase.id, platform, updatedAt: new Date().toISOString() };
    await repository.saveResult(result);
    setResults(old => [...old.filter(item => item.id !== id), result]);
  }
  async function finishRun() {
    if (!selected || !window.confirm(`Завершить регресс «${selected.name}»? Его результаты останутся доступными в истории.`)) return;
    const updated = { ...selected, status: 'completed', completedAt: new Date().toISOString() };
    await repository.saveRegression(updated); setRegressions(await repository.getRegressions()); setSelectedId(null);
  }
  function openEditRun() {
    if (!selected) return;
    setEditRunName(selected.name || '');
    setEditRunPlatforms(selected.platforms || []);
    setError('');
    setEditRunOpen(true);
  }
  async function saveRunEdits(event) {
    event.preventDefault();
    if (!selected || !editRunName.trim()) return setError('Введите название регресса.');
    if (!editRunPlatforms.length) return setError('Выберите хотя бы одну платформу.');
    setBusy(true); setError('');
    try {
      await repository.saveRegression({ ...selected, name: editRunName.trim(), platforms: [...editRunPlatforms] });
      setRegressions(await repository.getRegressions());
      setEditRunOpen(false);
    } catch (saveError) { setError(`Не удалось сохранить регресс: ${saveError.message}`); }
    finally { setBusy(false); }
  }
  async function deleteRun() {
    if (!selected || !window.confirm(`Удалить регресс «${selected.name}» и все его результаты? Это действие нельзя отменить.`)) return;
    try {
      await repository.deleteRegression(selected.id);
      setRegressions(await repository.getRegressions()); setSelectedId(null); setResults([]); setError(''); setEditRunOpen(false);
    } catch (deleteError) { setError(`Не удалось удалить регресс: ${deleteError.message}`); }
  }
  const runGroups = executionGroups(selected?.cases || []).map(group => {
    const currentCase = cases.find(item => item.id === group.id);
    return { ...group, title: currentCase?.title || group.title, note: group.note ?? currentCase?.note ?? '' };
  }).filter(group => group.steps.length);
  const allSteps = executionGroups(selected?.cases || []).flatMap(group => group.steps).filter(step => step.kind !== 'heading' && step.kind !== 'separator');
  const counts = runStatuses.reduce((acc, status) => { acc[status] = results.filter(r => r.status === status).length; return acc; }, {});
  const resultPlatforms = selected?.platforms?.length ? selected.platforms : [...new Set(allSteps.flatMap(step => step.platforms || []))];
  const totalResultSlots = allSteps.reduce((sum, step) => sum + resultPlatforms.filter(platform => !step.platforms?.length || step.platforms.includes(platform)).length, 0);
  counts['Не проверено'] = Math.max(0, totalResultSlots - results.filter(r => r.status && r.status !== 'Не проверено').length);
  const completedResultSlots = ['В процессе', 'Успешно', 'Не успешно', 'Пропущено'].reduce((sum, status) => sum + (counts[status] || 0), 0);
  const completionPercent = totalResultSlots ? Math.min(100, Math.round(completedResultSlots / totalResultSlots * 100)) : 0;
  function openCreateRun() {
    setName(`Регресс ${new Date().toLocaleDateString('ru-RU')}`);
    const nextCatalog = catalogs.find(catalog => cases.some(testCase => testCase.catalogType === catalog.id)) || catalogs[0];
    setRunCatalog(nextCatalog?.id || '');
    setRunPlatforms(platformsForCatalog(nextCatalog));
    setError(''); setCreateOpen(true);
  }
  return <>
    <div className="regressions-page-heading"><h1>{historyOnly ? 'История регрессов' : 'Регрессы'}</h1>{!historyOnly && <button className="button button-primary" onClick={openCreateRun} disabled={!cases.length || !catalogs.length}>＋ Новый регресс</button>}</div>
    <div className="regression-layout">
    {selected ? <div className="run-details-stack">
      <div className="panel run-overview-panel"><div className="run-detail-heading"><div><div className="run-title-line">{visibleRuns.length > 1 ? <div className="run-dropdown run-title-dropdown" ref={runMenuRef}>
          <button type="button" className={`run-title-trigger ${runMenuOpen ? 'open' : ''}`} aria-label="Выбрать регресс" aria-haspopup="listbox" aria-expanded={runMenuOpen} onClick={() => setRunMenuOpen(open => !open)}><h2>{selected.name}{selected.platforms?.length ? ` · ${selected.platforms.join(', ')}` : ''}</h2><i aria-hidden="true" /></button>
          {runMenuOpen && <div className="run-dropdown-menu" role="listbox" aria-label="Список регрессов">{visibleRuns.map(run => <button type="button" role="option" aria-selected={selectedId === run.id} className={`run-dropdown-option ${selectedId === run.id ? 'active' : ''}`} key={run.id} onClick={() => { setSelectedId(run.id); setRunMenuOpen(false); }}><b>{run.name}{run.platforms?.length ? ` · ${run.platforms.join(', ')}` : ''}</b><small>{run.catalogTitle || catalogs.find(catalog => catalog.id === run.catalogType)?.shortLabel || 'Каталог'}</small></button>)}</div>}
        </div> : <h2>{selected.name}{selected.platforms?.length ? ` · ${selected.platforms.join(', ')}` : ''}</h2>}</div><p>{new Date(selected.createdAt).toLocaleString('ru-RU')} · {(selected.cases || []).length} тестов</p></div><div className="run-header-actions"><button className="button button-secondary finish-button" onClick={openEditRun}>Редактировать</button>{!historyOnly && selected.status === 'active' && <button className="button button-secondary finish-button" onClick={finishRun}>Завершить регресс</button>}</div></div>
        <div className="run-completion"><div className="run-completion-heading"><span>Выполнение регресса</span><b>{completionPercent}%</b></div><div className="run-completion-track" role="progressbar" aria-label="Выполнение регресса" aria-valuemin="0" aria-valuemax="100" aria-valuenow={completionPercent}><span style={{ width: `${completionPercent}%` }} /></div></div>
        <div className="run-summary">{runStatuses.map((status, index)=><div className={`run-summary-card run-summary-${index}`} key={status}><span>{status}</span><b>{counts[status] || 0}</b><small>{totalResultSlots ? Math.round((counts[status] || 0) / totalResultSlots * 100) : 0}%</small></div>)}</div>
      </div>
      <div className="run-test-panel">
        <RegressionResults groups={runGroups} results={results} selected={selected} onSave={saveResult} />
      </div>
    </div> : <div className="panel run-details-panel"><EmptyState icon="◷" title={historyOnly ? 'История пока пуста' : 'Нет активных регрессов'} text={historyOnly ? 'Завершённые прогоны появятся здесь.' : 'Создайте регресс, чтобы открыть таблицу результатов.'} /></div>}
    {error&&<div className="form-error">{error}</div>}
    {editRunOpen && selected && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setEditRunOpen(false); }}><form className="edit-modal run-edit-modal" onSubmit={saveRunEdits}><div className="modal-heading"><div><h2>Редактировать регресс</h2></div><button type="button" className="icon-button" aria-label="Закрыть" onClick={() => setEditRunOpen(false)}>×</button></div><label className="field-label">Название регресса<input autoFocus value={editRunName} onChange={event => setEditRunName(event.target.value)} /></label><div className="field-label">Платформы<div className="platform-checks">{runPlatformOptions.map(platform => <label key={platform}><input type="checkbox" checked={editRunPlatforms.includes(platform)} onChange={event => setEditRunPlatforms(current => event.target.checked ? [...current, platform] : current.filter(item => item !== platform))} />{platform}</label>)}</div></div>{error && <div className="form-error" role="alert">{error}</div>}<div className="modal-actions run-edit-actions"><button type="button" className="button button-danger" onClick={deleteRun}>Удалить регресс</button><span className="modal-actions-spacer" /><button type="button" className="button button-secondary" onClick={() => setEditRunOpen(false)}>Отмена</button><button className="button button-primary" disabled={busy || !editRunName.trim() || !editRunPlatforms.length}>{busy ? 'Сохранение…' : 'Сохранить'}</button></div></form></div>}
    {createOpen&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setCreateOpen(false);}}><form className="edit-modal" onSubmit={createRun}><div className="modal-heading"><div><h2>Новый регресс</h2></div><button type="button" className="icon-button" onClick={()=>setCreateOpen(false)}>×</button></div><label className="field-label">Каталог<select value={runCatalog} onChange={e=>{const nextCatalog=catalogs.find(catalog=>catalog.id===e.target.value);setRunCatalog(e.target.value);setRunPlatforms(platformsForCatalog(nextCatalog));}}>{catalogs.map(catalog=>{const count=cases.filter(testCase=>testCase.catalogType===catalog.id).length;return <option key={catalog.id} value={catalog.id} disabled={!count}>{catalog.label} · {count} тестов</option>;})}</select></label><label className="field-label">Название прогона<input autoFocus value={name} onChange={e=>setName(e.target.value)} /></label><div className="field-label">Платформы<div className="platform-checks">{runPlatformOptions.map(platform=><label key={platform}><input type="checkbox" checked={runPlatforms.includes(platform)} onChange={e=>setRunPlatforms(current=>e.target.checked?[...current,platform]:current.filter(item=>item!==platform))} />{platform}</label>)}</div></div>{error&&<div className="form-error">{error}</div>}<div className="modal-actions"><button type="button" className="button button-secondary" onClick={()=>setCreateOpen(false)}>Отмена</button><button className="button button-primary" disabled={busy||!name.trim()||!cases.some(testCase=>testCase.catalogType===runCatalog)}>{busy?'Создание…':'Создать регресс'}</button></div></form></div>}
  </div></>;
}

function RunAttachments({ attachments, disabled, onAdd, onRemove }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('photos');
  const [preview, setPreview] = useState(null);
  const [editingLog, setEditingLog] = useState(false);
  const [logName, setLogName] = useState('log.txt');
  const [logText, setLogText] = useState('');
  const photos = attachments.filter(item => item.type === 'photo' || (!item.type && item.mimeType?.startsWith('image/')));
  const logs = attachments.filter(item => item.type === 'log' || (!item.type && !item.mimeType?.startsWith('image/')));
  const photoInputId = React.useId();
  function openLogEditor() { setLogName(`log-${logs.length + 1}.txt`); setLogText(''); setPreview(null); setEditingLog(true); }
  function saveLog(event) {
    event.preventDefault();
    if (!logText.trim()) return;
    onAdd({ id: makeId(), type: 'log', name: logName.trim() || `log-${logs.length + 1}.txt`, content: logText, mimeType: 'text/plain', addedAt: new Date().toISOString() });
    setEditingLog(false); setLogText('');
  }
  function prettyLog(content) {
    try { return JSON.stringify(JSON.parse(content), null, 2); } catch { return content || ''; }
  }
  return <>
    <button type="button" className="run-attachment-add" disabled={disabled} title="Добавить фото или лог" onClick={() => { setModalOpen(true); setActiveTab('photos'); setPreview(null); setEditingLog(false); }}><span aria-hidden="true">＋</span> Фото / лог{attachments.length > 0 && <span className="run-attachment-count">{attachments.length}</span>}</button>
    {modalOpen && <div className="modal-backdrop run-attachment-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setModalOpen(false); }}>
      <section className="edit-modal run-attachment-modal" role="dialog" aria-modal="true" aria-labelledby="run-attachment-title">
        <div className="modal-heading"><div><h2 id="run-attachment-title">Фото и логи</h2><p>Вложения к шагу: не помещайте их в комментарий.</p></div><button type="button" className="icon-button" aria-label="Закрыть" onClick={() => setModalOpen(false)}>×</button></div>
        <div className="run-attachment-tabs" role="tablist"><button type="button" role="tab" aria-selected={activeTab === 'photos'} className={activeTab === 'photos' ? 'active' : ''} onClick={() => { setActiveTab('photos'); setPreview(null); setEditingLog(false); }}>Фото <span>{photos.length}</span></button><button type="button" role="tab" aria-selected={activeTab === 'logs'} className={activeTab === 'logs' ? 'active' : ''} onClick={() => { setActiveTab('logs'); setPreview(null); setEditingLog(false); }}>Логи <span>{logs.length}</span></button></div>
        {activeTab === 'photos' && (preview ? <div className="run-photo-preview"><button type="button" className="button button-secondary" onClick={() => setPreview(null)}>← К списку фото</button><img src={preview.dataUrl} alt={preview.name} /><div><b>{preview.name}</b><button type="button" className="button button-danger" disabled={disabled} onClick={() => { onRemove(preview.id); setPreview(null); }}>Удалить</button></div></div> : <div className="run-attachment-panel"><label className={`button button-secondary run-photo-upload ${disabled ? 'disabled' : ''}`} htmlFor={photoInputId}>＋ Добавить фото<input id={photoInputId} type="file" accept="image/*" disabled={disabled} onChange={event => { const file = event.target.files?.[0]; if (file) onAdd({ type: 'photo', file }); event.target.value = ''; }} /></label>{photos.length ? <div className="run-photo-grid">{photos.map(photo => <div className="run-photo-card" key={photo.id}><button type="button" className="run-photo-open" onClick={() => setPreview(photo)}><img src={photo.dataUrl} alt={photo.name} /><span title={photo.name}>{photo.name}</span></button><button type="button" className="run-attachment-remove" aria-label={`Удалить ${photo.name}`} disabled={disabled} onClick={() => onRemove(photo.id)}>×</button></div>)}</div> : <p className="run-attachment-empty">Пока нет прикреплённых фото.</p>}</div>)}
        {activeTab === 'logs' && (preview ? <div className="run-log-preview"><div className="run-log-preview-heading"><button type="button" className="button button-secondary" onClick={() => setPreview(null)}>← К списку логов</button><b>{preview.name}</b><button type="button" className="button button-danger" disabled={disabled} onClick={() => { onRemove(preview.id); setPreview(null); }}>Удалить</button></div><pre>{prettyLog(preview.content)}</pre></div> : <div className="run-attachment-panel">{editingLog ? <form className="run-log-editor" onSubmit={saveLog}><label className="field-label">Название файла<input value={logName} onChange={event => setLogName(event.target.value)} /></label><label className="field-label">Текст лога<textarea autoFocus value={logText} onChange={event => setLogText(event.target.value)} placeholder="Вставьте лог или JSON…" /></label><div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setEditingLog(false)}>Отмена</button><button className="button button-primary" disabled={!logText.trim()}>Сохранить лог</button></div></form> : <><button type="button" className="button button-secondary" disabled={disabled} onClick={openLogEditor}>＋ Добавить лог</button>{logs.length ? <ul className="run-log-list">{logs.map(log => <li key={log.id}><button type="button" className="run-log-open" onClick={() => setPreview(log)}><span className="run-log-file-icon">LOG</span><span><b>{log.name}</b><small>{log.content ? `${log.content.length.toLocaleString('ru-RU')} символов` : 'Файл лога'}</small></span></button><button type="button" className="run-attachment-remove" aria-label={`Удалить ${log.name}`} disabled={disabled} onClick={() => onRemove(log.id)}>×</button></li>)}</ul> : <p className="run-attachment-empty">Пока нет сохранённых логов.</p>}</>}</div>)}
        <div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setModalOpen(false)}>Закрыть</button></div>
      </section>
    </div>}
  </>;
}

function RegressionResults({ groups, results, selected, onSave }) {
  const [expandedCompletedGroups, setExpandedCompletedGroups] = useState(() => new Set());
  const [manuallyCollapsedGroups, setManuallyCollapsedGroups] = useState(() => new Set());
  const [viewingComment, setViewingComment] = useState(null);
  if (!groups.length) return <div className="empty-filter">В регрессе пока нет тестов.</div>;
  const inferredPlatforms = [...new Set(groups.flatMap(group => group.steps.flatMap(step => step.platforms || [])))];
  const columns = selected.platforms?.length ? selected.platforms : inferredPlatforms.length ? inferredPlatforms : ['WEB'];
  const gridStyle = { gridTemplateColumns: `minmax(300px, 1fr) repeat(${columns.length}, minmax(130px, 155px)) minmax(220px, 1.1fr)` };
  return <><div className="run-table-wrap"><div className="run-table" style={gridStyle} role="table" aria-label="Результаты регресса">
    <div className="run-table-header" style={gridStyle} role="row"><b role="columnheader">Операции/функционал</b>{columns.map(platform => <b role="columnheader" key={platform}>{platform}</b>)}<b role="columnheader">Комментарий</b></div>
    <div className="run-case-list">{groups.map(group => {
      const testSteps = group.steps.filter(step => step.kind !== 'heading' && step.kind !== 'separator');
      const applicableSlots = testSteps.flatMap(step => columns.filter(platform => !step.platforms?.length || step.platforms.includes(platform)).map(platform => (results.find(item => item.caseId === step.id && item.platform === platform)?.status || 'Не проверено').trim()));
      const isAllSuccessful = applicableSlots.length > 0 && applicableSlots.every(status => runStatusTone[status] === 'success');
      const collapsed = manuallyCollapsedGroups.has(group.id) || (isAllSuccessful && !expandedCompletedGroups.has(group.id));
      return <section className={`run-group ${collapsed ? 'run-group-collapsed' : ''}`} key={`${selected.id}-${group.id}`} role="rowgroup">
      <div className="run-group-heading"><button type="button" className="run-group-title-toggle" aria-expanded={!collapsed} onClick={() => {
        if (collapsed) {
          setManuallyCollapsedGroups(current => { const next = new Set(current); next.delete(group.id); return next; });
          if (isAllSuccessful) setExpandedCompletedGroups(current => new Set(current).add(group.id));
        } else if (isAllSuccessful) setExpandedCompletedGroups(current => { const next = new Set(current); next.delete(group.id); return next; });
        else setManuallyCollapsedGroups(current => new Set(current).add(group.id));
      }}><h3>{group.title}</h3></button>{group.note?.trim() && <button type="button" className="case-comment-indicator run-comment-indicator" aria-label={`Показать комментарий к тесту «${group.title}»`} title="Показать комментарий" onClick={() => setViewingComment(group)}>i</button>}{isAllSuccessful && <span className="run-group-complete-label">Успешно</span>}</div>
      {!collapsed && group.steps.map((step, index) => {
        if (step.kind === 'heading') return <div className="run-table-structural run-subheading" role="row" key={step.id || `${group.id}-${index}`}>{step.title}</div>;
        if (step.kind === 'separator') return <div className="run-table-structural run-divider-row" role="row" key={step.id || `${group.id}-${index}`}><hr className="catalog-divider" /></div>;
        const stepPlatforms = columns.filter(platform => !step.platforms?.length || step.platforms.includes(platform));
        const stepResults = stepPlatforms.map(platform => results.find(item => item.caseId === step.id && item.platform === platform) || {});
        const stepStatuses = stepResults.map(result => result.status || 'Не проверено');
        const stepTone = stepStatuses.length && stepStatuses.every(status => status === stepStatuses[0]) ? runStatusTone[stepStatuses[0]] : 'mixed';
        const comment = stepResults.find(item => item.comment)?.comment || '';
        return <div className={`run-table-row run-row-${stepTone}`} style={gridStyle} role="row" key={step.id || `${group.id}-${index}`}>
          <div className="run-table-step" role="cell"><span className="catalog-step-number run-table-step-number">{group.steps.slice(0, index).filter(item => item.kind !== 'heading' && item.kind !== 'separator').length + 1}</span><b>{step.title}</b></div>
          {columns.map(platform => {
            if (!stepPlatforms.includes(platform)) return <div className="run-table-unavailable" role="cell" key={platform}>—</div>;
            const result = results.find(item => item.caseId === step.id && item.platform === platform) || {};
            const status = result.status || 'Не проверено';
            return <div className="run-table-status" role="cell" key={platform}><StatusPicker value={status} options={runStatuses} label={`${platform}, ${step.title}`} disabled={selected.status !== 'active'} onChange={nextStatus => onSave(step, platform, { status: nextStatus })} onMarkAll={() => group.steps.filter(item => item.kind !== 'heading' && item.kind !== 'separator' && (!item.platforms?.length || item.platforms.includes(platform))).forEach(groupStep => onSave(groupStep, platform, { status: 'Успешно' }))} /></div>;
          })}
          <div className="run-table-comment" role="cell"><GrowingComment key={`${step.id}-${comment}`} initialValue={comment} label={`Комментарий, ${step.title}`} disabled={selected.status !== 'active'} onCommit={value => stepPlatforms.forEach(platform => onSave(step, platform, { comment: value }))} /><RunAttachments attachments={[...new Map(stepResults.flatMap(result => result.attachments || []).map(attachment => [attachment.id, attachment])).values()]} disabled={selected.status !== 'active'} onAdd={async item => {
            try {
              let attachment = item;
              if (item.type === 'photo') {
                if (item.file.size > 20 * 1024 * 1024) { window.alert('Размер фото не должен превышать 20 МБ.'); return; }
                attachment = { id: makeId(), type: 'photo', name: item.file.name, mimeType: item.file.type || 'image/*', dataUrl: await fileAsDataUrl(item.file), addedAt: new Date().toISOString() };
              }
              await Promise.all(stepPlatforms.map(platform => { const saved = results.find(result => result.caseId === step.id && result.platform === platform); return onSave(step, platform, { attachments: [...(saved?.attachments || []), attachment] }); }));
            } catch (attachmentError) { window.alert(`Не удалось сохранить вложение: ${attachmentError.message}`); }
          }} onRemove={async attachmentId => Promise.all(stepPlatforms.map(platform => { const saved = results.find(result => result.caseId === step.id && result.platform === platform); return onSave(step, platform, { attachments: (saved?.attachments || []).filter(attachment => attachment.id !== attachmentId) }); }))} /></div>
        </div>;
      })}
    </section>;
    })}</div>
  </div></div>{viewingComment && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setViewingComment(null); }}><div className="edit-modal comment-view-modal" role="dialog" aria-modal="true" aria-labelledby="run-case-comment-title"><div className="modal-heading"><div><h2 id="run-case-comment-title">Комментарий к тесту</h2><p>{viewingComment.title}</p></div><button type="button" className="icon-button" aria-label="Закрыть" onClick={() => setViewingComment(null)}>×</button></div><p className="comment-view-text">{viewingComment.note}</p><div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setViewingComment(null)}>Закрыть</button></div></div></div>}</>;
}

function StatusPicker({ value, options, label, disabled, onChange, onMarkAll }) {
  const [open, setOpen] = useState(false);
  const tone = runStatusTone[value] || 'unchecked';
  return <div className={`status-picker ${open ? 'open' : ''}`}>
    <button type="button" className={`status-picker-trigger run-status-select-${tone}`} aria-label={label} aria-haspopup="listbox" aria-expanded={open} disabled={disabled} onClick={() => setOpen(current => !current)}><span>{value}</span><i aria-hidden="true" /></button>
    {open && <div className="status-picker-menu" role="listbox" aria-label={`Статус: ${label}`}>
      {options.map(option => <div className={`status-picker-option-row ${option === value ? 'selected' : ''}`} key={option}>
        <button type="button" role="option" aria-selected={option === value} className="status-picker-option" onClick={() => { onChange(option); setOpen(false); }}>{option}</button>
        {option === 'Успешно' && <button type="button" className="status-picker-all" disabled={disabled} title="Отметить все шаги этого теста как успешные" onClick={() => { onMarkAll(); setOpen(false); }}>ВСЕ</button>}
      </div>)}
    </div>}
  </div>;
}


