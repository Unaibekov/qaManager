const stepFields = ['id', 'title', 'kind', 'platforms', 'note', 'systems', 'automation', 'sourceNumber', 'sourceRow', 'sheet', 'sourceId', 'importReview'];

export const CATALOGS = [
  { id: 'mobile', label: 'Мобильное приложение', shortLabel: 'Мобильное приложение' },
  { id: 'web', label: 'Веб и мобильные версии', shortLabel: 'Веб / mobile' },
];

export function catalogTypeFromPlatforms(platforms = []) {
  return platforms.some(platform => ['WEB', 'adaptive iOs', 'adaptive android'].includes(platform)) ? 'web' : 'mobile';
}

function normalizeCatalogType(type, platforms) {
  return typeof type === 'string' && type ? type : catalogTypeFromPlatforms(platforms);
}

function normalizeStep(record) {
  return asStep(record);
}

function asStep(record) {
  const step = {};
  for (const field of stepFields) if (record[field] !== undefined) step[field] = record[field];
  return step;
}

function sourceFileFromId(id = '') {
  const match = String(id).match(/^import:(.*):[^:]+:\d+$/);
  return match?.[1] || '';
}

export function groupCaseRecords(records) {
  const result = [];
  const groups = new Map();
  for (const record of records) {
    if (Array.isArray(record.steps)) {
      const steps = record.steps.map(normalizeStep);
      result.push({ ...record, catalogType: normalizeCatalogType(record.catalogType, steps.flatMap(step => step.platforms || [])), steps,
        platforms: [...new Set(steps.flatMap(step => step.platforms || []))] });
      continue;
    }
    const sourceFile = record.sourceFile || sourceFileFromId(record.id);
    const isImported = Boolean(record.sheet || record.sourceId || sourceFile);
    if (!isImported) {
      result.push({ ...record, catalogType: normalizeCatalogType(record.catalogType, record.platforms || []), steps: [normalizeStep(record)] });
      continue;
    }
    const section = record.section || '';
    const catalogType = normalizeCatalogType(record.catalogType, record.platforms || []);
    const groupKey = `${sourceFile || 'legacy'}:${record.sheet || 'Лист'}:${section || '__no_section'}`;
    let group = groups.get(groupKey);
    if (!group) {
      group = {
        id: `case-group:${groupKey}`,
        sourceId: `group:${groupKey}`,
        sourceFile,
        catalogType,
        title: section || record.sheet || record.title,
        section,
        sheet: record.sheet || '',
        platforms: [],
        steps: [],
        order: record.order ?? record.sourceRow ?? result.length,
        imported: true,
      };
      groups.set(groupKey, group);
    }
    const step = normalizeStep(record);
    group.steps.push(step);
    group.platforms = [...new Set([...group.platforms, ...(step.platforms || [])])];
    group.order = Math.min(group.order, record.order ?? record.sourceRow ?? group.order);
  }
  result.push(...groups.values());
  return result.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export function executionGroups(cases = []) {
  return cases.map(testCase => ({
    ...testCase,
    steps: Array.isArray(testCase.steps) && testCase.steps.length
      ? testCase.steps
      : [asStep(testCase)],
  }));
}
