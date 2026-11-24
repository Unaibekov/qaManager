import React, { useEffect, useState } from 'react';
import { makeId, repository } from '../services/database.js';

const blankStep = () => ({ id: makeId(), title: '', platforms: [] });
const blankHeading = () => ({ id: makeId(), title: '', kind: 'heading', platforms: [] });
const blankSeparator = () => ({ id: makeId(), title: '', kind: 'separator', platforms: [] });
const isHeading = item => item.kind === 'heading';
const isSeparator = item => item.kind === 'separator';
const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function HighlightMatches({ text, query }) {
  const terms = query.split(' ').filter(Boolean);
  if (!terms.length) return text;
  const matcher = new RegExp(`(${terms.map(escapeRegExp).join('|')})`, 'giu');
  return String(text || '').split(matcher).map((part, index) => terms.includes(part.toLocaleLowerCase('ru'))
    ? <mark className="search-match" key={index}>{part}</mark>
    : part);
}
const autoResizeTextarea = element => {
  if (!element) return;
  element.style.height = 'auto';
  element.style.height = `${element.scrollHeight}px`;
};

export default function CaseCatalog({ cases, setCases, search, setSearch, assets = [], setAssets, catalogs = [], setCatalogs }) {
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [assetError, setAssetError] = useState('');
  const [catalogModal, setCatalogModal] = useState(false);
  const [editingCatalog, setEditingCatalog] = useState(null);
  const [catalogName, setCatalogName] = useState('');
  const [catalogError, setCatalogError] = useState('');
  const [viewingComment, setViewingComment] = useState(null);
  const [collapsedCaseIds, setCollapsedCaseIds] = useState(() => new Set());
  const [activeCatalog, setActiveCatalog] = useState('mobile');
  useEffect(() => {
    if (!catalogs.some(catalog => catalog.id === activeCatalog)) setActiveCatalog(catalogs[0]?.id || '');
  }, [catalogs, activeCatalog]);
  const catalogCases = cases.filter(testCase => (testCase.catalogType || 'mobile') === activeCatalog);
  const query = search.normalize('NFKC').toLocaleLowerCase('ru').trim().replace(/\s+/g, ' ');
  const queryTokens = query.split(' ').filter(Boolean);
  const filtered = catalogCases.filter(testCase => {
    if (!queryTokens.length) return true;
    const content = [testCase.title, ...(testCase.steps || [])
      .filter(step => !isHeading(step) && !isSeparator(step))
      .map(step => step.title),
    ].filter(Boolean).join(' ').normalize('NFKC').toLocaleLowerCase('ru');
    return queryTokens.every(token => content.includes(token));
  });
  const allVisibleCollapsed = filtered.length > 0 && filtered.every(testCase => collapsedCaseIds.has(testCase.id));

  function toggleCase(testCaseId) {
    setCollapsedCaseIds(current => {
      const next = new Set(current);
      next.has(testCaseId) ? next.delete(testCaseId) : next.add(testCaseId);
      return next;
    });
  }

  function toggleAllCases() {
    setCollapsedCaseIds(current => {
      const next = new Set(current);
      filtered.forEach(testCase => allVisibleCollapsed ? next.delete(testCase.id) : next.add(testCase.id));
      return next;
    });
  }

  function open(testCase) {
    const catalogType = testCase?.catalogType || activeCatalog;
    const selectedPlatforms = testCase?.platforms || [];
    const steps = testCase
      ? (testCase.steps?.length ? testCase.steps : [{ ...testCase, id: testCase.id }]).map(step => ({ ...step }))
      : [blankStep()];
    setDraft(testCase
      ? { ...testCase, title: testCase.title || testCase.section || '', platforms: selectedPlatforms, steps }
      : { title: '', catalogType, platforms: selectedPlatforms, steps, note: '', systems: '' });
    setEditing(testCase || {});
    setError('');
  }

  function updateStep(index, patch) {
    setDraft(current => ({ ...current, steps: current.steps.map((step, i) => i === index ? { ...step, ...patch } : step) }));
  }

  function moveStep(index, offset) {
    const target = index + offset;
    if (target < 0 || target >= draft.steps.length) return;
    setDraft(current => {
      const steps = [...current.steps];
      [steps[index], steps[target]] = [steps[target], steps[index]];
      return { ...current, steps };
    });
  }

  async function save(event) {
    event.preventDefault();
    if (!draft.title.trim()) return setError('Введите заголовок проверки.');
    const steps = draft.steps.map(step => ({ ...step, title: step.title.trim(), platforms: isHeading(step) || isSeparator(step) ? [] : (step.platforms || []) })).filter(step => step.title || isSeparator(step));
    if (!steps.some(step => !isHeading(step) && !isSeparator(step))) return setError('Добавьте хотя бы один шаг.');
    setBusy(true);
    try {
      const record = { ...draft, title: draft.title.trim(), steps, id: editing?.id || makeId(), order: editing?.order ?? cases.filter(item => (item.catalogType || 'mobile') === draft.catalogType).length, updatedAt: new Date().toISOString() };
      await repository.saveCase(record);
      setCases(await repository.getCases());
      setEditing(null);
      setDraft(null);
    } catch (e) { setError(`Не удалось сохранить: ${e.message}`); }
    finally { setBusy(false); }
  }

  async function remove(testCase) {
    if (!window.confirm('Удалить тест и все его шаги из каталога?')) return;
    await repository.deleteCase(testCase.id);
    setCases(await repository.getCases());
  }

  async function moveCase(testCase, offset) {
    const from = catalogCases.findIndex(item => item.id === testCase.id);
    const to = from + offset;
    if (from < 0 || to < 0 || to >= catalogCases.length) return;
    const reordered = [...catalogCases];
    [reordered[from], reordered[to]] = [reordered[to], reordered[from]];
    const ordered = reordered.map((item, index) => ({ ...item, order: index }));
    const orderedById = new Map(ordered.map(item => [item.id, item]));
    setCases(current => current.map(item => orderedById.get(item.id) || item));
    try { await repository.reorderCases(ordered); }
    catch (error) { setCases(await repository.getCases()); window.alert(`Не удалось сохранить новый порядок: ${error.message}`); }
  }

  async function saveCatalog(event) {
    event.preventDefault();
    if (!catalogName.trim()) return setCatalogError('Введите название каталога.');
    try {
      const id = editingCatalog?.id || `catalog-${makeId()}`;
      const record = editingCatalog
        ? { ...editingCatalog, label: catalogName.trim(), shortLabel: catalogName.trim() }
        : { id, label: catalogName.trim(), shortLabel: catalogName.trim(), platforms: [], order: catalogs.length, createdAt: new Date().toISOString() };
      await repository.saveCatalog(record);
      const updated = await repository.getCatalogs();
      setCatalogs(updated); setActiveCatalog(id); setCatalogModal(false); setEditingCatalog(null); setCatalogName(''); setCatalogError('');
    } catch (saveError) { setCatalogError(`Не удалось ${editingCatalog ? 'сохранить каталог' : 'создать каталог'}: ${saveError.message}`); }
  }

  async function deleteCatalog(catalog) {
    const count = cases.filter(testCase => testCase.catalogType === catalog.id).length;
    const message = `Удалить каталог «${catalog.label}»${count ? ` вместе с ${count} тестами` : ''}? Уже созданные регрессы и история результатов сохранятся.`;
    if (!window.confirm(message)) return;
    try {
      await repository.deleteCatalog(catalog.id);
      const [updatedCatalogs, updatedCases] = await Promise.all([repository.getCatalogs(), repository.getCases()]);
      setCatalogs(updatedCatalogs); setCases(updatedCases);
      if (activeCatalog === catalog.id) setActiveCatalog(updatedCatalogs[0]?.id || '');
      setCatalogModal(false); setEditingCatalog(null); setCatalogName(''); setCatalogError('');
    } catch (deleteError) { setCatalogError(`Не удалось удалить каталог: ${deleteError.message}`); }
  }

  function openCatalogEditor(catalog) {
    setEditingCatalog(catalog);
    setCatalogName(catalog?.label || '');
    setCatalogError('');
    setCatalogModal(true);
  }

  async function attachFiles(files) {
    setAssetError('');
    try {
      for (const file of files) {
        if (file.size > 20 * 1024 * 1024) throw new Error(`Файл «${file.name}» больше 20 МБ.`);
        const asset = { id: makeId(), name: file.name, mimeType: file.type || 'application/octet-stream', dataUrl: await readFileAsDataUrl(file), source: 'user', addedAt: new Date().toISOString() };
        await repository.saveAsset(asset);
      }
      setAssets(await repository.getAssets());
    } catch (uploadError) { setAssetError(`Не удалось прикрепить файл: ${uploadError.message}`); }
  }

  async function removeAsset(asset) {
    if (!window.confirm(`Удалить файл «${asset.name}»?`)) return;
    await repository.deleteAsset(asset.id);
    setAssets(await repository.getAssets());
  }

  return <>
    <div className="catalog-page-heading"><h1>Каталог тестов</h1><button className="button button-secondary" onClick={() => { setEditingCatalog(null); setCatalogName(''); setCatalogError(''); setCatalogModal(true); }}>＋ Создать каталог</button></div>
    <div className="panel catalog-selector-card">
      <div className="catalog-tabs" role="tablist" aria-label="Каталоги">{catalogs.map(catalog => <div className="catalog-tab-item" key={catalog.id}><button className={`catalog-tab ${activeCatalog === catalog.id ? 'active' : ''}`} role="tab" aria-selected={activeCatalog === catalog.id} onClick={() => setActiveCatalog(catalog.id)}><b>{catalog.label}</b><small>{cases.filter(testCase => testCase.catalogType === catalog.id).length} тестов</small></button><button type="button" className="catalog-edit-button" aria-label={`Настроить каталог ${catalog.label}`} title="Изменить или удалить каталог" onClick={() => openCatalogEditor(catalog)}>⋮</button></div>)}</div>
    </div>
    <div className="catalog-list-heading"><div className="catalog-list-title"><h2>{catalogs.find(catalog => catalog.id === activeCatalog)?.label}</h2><span className="count-pill">{filtered.length}</span></div><div className="catalog-toolbar">
      <label className="catalog-search"><span>⌕</span><input aria-label="Поиск тестов" value={search} onChange={event => setSearch(event.target.value)} placeholder="Поиск тестов..." /></label>
      <button className="button button-secondary collapse-all-button" disabled={!filtered.length} onClick={toggleAllCases}>{allVisibleCollapsed ? 'Развернуть все' : 'Свернуть все'}</button>
      <button className="button button-primary" onClick={() => open(null)}>＋ Добавить тест</button>
    </div></div>
    {catalogCases.length === 0 ? <div className="panel"><EmptyState title="В этом каталоге пока нет тестов" text="Добавьте первую проверку в каталог." /></div> : <div className="case-list">
      {filtered.map(testCase => <article className="case-row grouped-case-row" key={testCase.id}>
        <div className="case-main">
          <h3 className="case-title-heading"><button className="case-collapse-toggle" type="button" aria-expanded={!collapsedCaseIds.has(testCase.id)} onClick={() => toggleCase(testCase.id)}><span className="case-collapse-title"><HighlightMatches text={testCase.title} query={query} /></span></button>{testCase.note?.trim() && <button type="button" className="case-comment-indicator" aria-label={`Показать комментарий к тесту «${testCase.title}»`} title="Показать комментарий" onClick={() => setViewingComment(testCase)}>!</button>}</h3>
          {!collapsedCaseIds.has(testCase.id) && <ol className="catalog-steps">{(testCase.steps || []).map((step, index) => <li key={step.id || `${testCase.id}-${index}`}>
            {isSeparator(step) ? <hr className="catalog-divider" /> : <div className={`catalog-step-content ${isHeading(step) ? 'catalog-subheading' : ''}`}>{!isHeading(step) && <span className="catalog-step-number">{(testCase.steps || []).slice(0, index).filter(item => !isHeading(item) && !isSeparator(item)).length + 1}</span>}<p><HighlightMatches text={step.title} query={query} /></p></div>}
            {step.note && <small className="case-note">{step.note}</small>}
            {step.automation?.map((automation, i) => <small className="automation-note" key={i}><b>Автоматизация:</b> {automation.value}</small>)}
          </li>)}</ol>}
        </div>
        <div className="case-actions case-order-actions"><button className="icon-button" aria-label={`Переместить «${testCase.title}» выше`} title="Переместить выше" disabled={catalogCases.findIndex(item => item.id === testCase.id) === 0} onClick={() => moveCase(testCase, -1)}>↑</button><button className="icon-button" aria-label={`Переместить «${testCase.title}» ниже`} title="Переместить ниже" disabled={catalogCases.findIndex(item => item.id === testCase.id) === catalogCases.length - 1} onClick={() => moveCase(testCase, 1)}>↓</button><button className="icon-button" aria-label="Редактировать" onClick={() => open(testCase)}>✎</button><button className="icon-button danger" aria-label="Удалить" onClick={() => remove(testCase)}>×</button></div>
      </article>)}
    </div>}
    <div className="panel asset-library">
      <div className="asset-library-heading"><h3>Материалы и вложения <span className="count-pill">{assets.length}</span></h3><label className="button button-secondary asset-upload-button">＋ Прикрепить файл<input type="file" accept="image/*,.pdf,.doc,.docx,.txt,.rtf,.xlsx,.ppt,.pptx" multiple onChange={event => { attachFiles(Array.from(event.target.files || [])); event.target.value = ''; }} /></label></div>
      <p className="asset-library-help">Документы и изображения хранятся локально в приложении. До 20 МБ на файл.</p>
      {assetError && <div className="form-error asset-error">{assetError}</div>}
      {assets.length > 0 && <div className="asset-grid">{assets.map(asset => {
        const isImage = (asset.mimeType || '').startsWith('image/') || asset.dataUrl?.startsWith('data:image/');
        return <div className="asset-card" key={asset.id}><a className="asset-open" href={asset.dataUrl} target={isImage ? '_blank' : undefined} rel="noreferrer" download={isImage ? undefined : asset.name}>{isImage ? <img src={asset.dataUrl} alt={asset.name} /> : <span className="asset-file-icon">{asset.mimeType === 'application/pdf' ? 'PDF' : 'DOC'}</span>}<span><b>{asset.name}</b><small>{asset.source === 'user' ? 'Добавлено вручную' : 'Материал каталога'}</small></span></a><button className="asset-remove" type="button" aria-label={`Удалить файл ${asset.name}`} title="Удалить файл" onClick={() => removeAsset(asset)}>×</button></div>;
      })}</div>}
    </div>
    {editing !== null && draft && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) { setEditing(null); setDraft(null); } }}>
      <form className="edit-modal case-editor-modal" onSubmit={save}>
        <div className="modal-heading"><div><h2>{editing.id ? 'Редактировать тест' : 'Новая проверка'}</h2></div><button type="button" className="icon-button" onClick={() => { setEditing(null); setDraft(null); }}>×</button></div>
        <label className="field-label">Заголовок<input autoFocus value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} placeholder="Например, Регистрация и доступ" /></label>
        <div className="step-editor-heading"><b>Шаги проверки</b><div className="step-editor-add-actions"><button type="button" className="button button-secondary" onClick={() => setDraft(current => ({ ...current, steps: [...current.steps, blankStep()] }))}>＋ Добавить шаг</button><button type="button" className="button button-secondary" onClick={() => setDraft(current => ({ ...current, steps: [...current.steps, blankHeading()] }))}>＋ Подзаголовок</button><button type="button" className="button button-secondary" onClick={() => setDraft(current => ({ ...current, steps: [...current.steps, blankSeparator()] }))}>＋ Разделитель</button></div></div>
        <div className="step-editor-list">{draft.steps.map((step, index) => <div className={`step-editor-row${isHeading(step) ? ' step-editor-heading-row' : ''}${isSeparator(step) ? ' step-editor-separator-row' : ''}`} key={step.id || index}>
          {!isSeparator(step) && (isHeading(step) ? null : <span className="step-editor-number">{draft.steps.slice(0, index).filter(item => !isHeading(item) && !isSeparator(item)).length + 1}</span>)}
          {isSeparator(step) ? <div className="editor-divider-preview"><hr /></div> : <textarea ref={autoResizeTextarea} className={isHeading(step) ? 'step-editor-subheading' : ''} aria-label={isHeading(step) ? `Текст подзаголовка ${draft.steps.slice(0, index).filter(isHeading).length + 1}` : `Текст шага ${draft.steps.slice(0, index).filter(item => !isHeading(item) && !isSeparator(item)).length + 1}`} rows="1" value={step.title} onChange={event => { autoResizeTextarea(event.currentTarget); updateStep(index, { title: event.target.value }); }} placeholder={isHeading(step) ? 'Название раздела' : 'Опишите проверяемое действие или ожидаемый результат'} />}
          <div className="step-editor-actions"><button type="button" aria-label="Переместить выше" title="Переместить выше" disabled={index === 0} onClick={() => moveStep(index, -1)}>↑</button><button type="button" aria-label="Переместить ниже" title="Переместить ниже" disabled={index === draft.steps.length - 1} onClick={() => moveStep(index, 1)}>↓</button><button type="button" aria-label={isHeading(step) ? 'Удалить подзаголовок' : isSeparator(step) ? 'Удалить разделитель' : 'Удалить шаг'} title="Удалить" onClick={() => setDraft(current => ({ ...current, steps: current.steps.filter((_, i) => i !== index) }))}>×</button></div>
        </div>)}</div>
        <label className="field-label">Общий комментарий<textarea rows="2" value={draft.note || ''} onChange={event => setDraft({ ...draft, note: event.target.value })} /></label>
        {error && <div className="form-error">{error}</div>}
        <div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => { setEditing(null); setDraft(null); }}>Отмена</button><button className="button button-primary" disabled={busy}>{busy ? 'Сохранение…' : 'Сохранить тест'}</button></div>
      </form>
    </div>}
    {viewingComment && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setViewingComment(null); }}>
      <div className="edit-modal comment-view-modal" role="dialog" aria-modal="true" aria-labelledby="case-comment-title"><div className="modal-heading"><div><h2 id="case-comment-title">Комментарий</h2><p>{viewingComment.title}</p></div><button type="button" className="icon-button" aria-label="Закрыть" onClick={() => setViewingComment(null)}>×</button></div><p className="comment-view-text">{viewingComment.note}</p><div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setViewingComment(null)}>Закрыть</button></div></div>
    </div>}
    {catalogModal && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) { setCatalogModal(false); setEditingCatalog(null); setCatalogError(''); } }}>
      <form className="edit-modal catalog-editor-modal" onSubmit={saveCatalog}>
        <div className="modal-heading"><div><h2>{editingCatalog ? 'Настроить каталог' : 'Создать каталог'}</h2></div><button type="button" className="icon-button" aria-label="Закрыть" onClick={() => { setCatalogModal(false); setEditingCatalog(null); setCatalogError(''); }}>×</button></div>
        <label className="field-label">Название каталога<input autoFocus value={catalogName} onChange={event => setCatalogName(event.target.value)} /></label>
        {catalogError && <div className="form-error">{catalogError}</div>}
        <div className="modal-actions catalog-modal-actions">{editingCatalog && <button type="button" className="button button-danger" disabled={catalogs.length <= 1} title={catalogs.length <= 1 ? 'Нельзя удалить последний каталог' : undefined} onClick={() => deleteCatalog(editingCatalog)}>Удалить каталог</button>}<span className="modal-actions-spacer" /><button type="button" className="button button-secondary" onClick={() => { setCatalogModal(false); setEditingCatalog(null); setCatalogError(''); }}>Отмена</button><button className="button button-primary">{editingCatalog ? 'Сохранить' : 'Создать каталог'}</button></div>
      </form>
    </div>}
  </>;
}

function EmptyState({ title, text }) { return <div className="empty-state"><span className="empty-icon">☷</span><h3>{title}</h3><p>{text}</p></div>; }

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('Ошибка чтения файла.'));
    reader.readAsDataURL(file);
  });
}
