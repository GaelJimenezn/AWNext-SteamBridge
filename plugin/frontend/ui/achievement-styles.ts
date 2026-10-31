/**
 * Shared visual properties for achievement components.
 * A future theme manager will select alternative style sets.
 */
export const achievementStyles = {
  root:
    'color:#dcdedf;font:13px Arial,sans-serif;' + 'width:100%;min-width:0;box-sizing:border-box',
  header:
    'display:flex;justify-content:space-between;' + 'align-items:center;gap:8px;margin-bottom:8px',
  bar: 'height:6px;background:#344454;border-radius:4px;' + 'overflow:hidden;margin-bottom:12px',
  preview: 'display:flex;gap:7px;align-items:center;margin-bottom:12px',
  card:
    'display:flex;gap:10px;align-items:flex-start;' +
    'background:#263746;border:1px solid #344c60;' +
    'border-radius:5px;padding:10px;min-width:0;' +
    'box-sizing:border-box',
  icon:
    'width:52px;height:52px;flex:0 0 52px;' +
    'background:#19232c;border-radius:4px;' +
    'display:flex;align-items:center;' +
    'justify-content:center;overflow:hidden',
  list:
    'display:flex;flex-direction:column;gap:8px;' +
    'max-height:460px;overflow-y:auto;overflow-x:hidden',
  filters: 'display:flex;flex-wrap:wrap;gap:5px;margin:8px 0 12px',
} as const;
