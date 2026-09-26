const currency = new Intl.NumberFormat('es-AR', {
  style: 'currency', currency: 'ARS', minimumFractionDigits: 2, maximumFractionDigits: 2,
});
const percentFmt = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 });

const STORAGE_INGREDIENTS = 'pastry_ingredients_v3';
const STORAGE_RECIPES = 'pastry_recipes_v3';

const unitDefinitions = {
  g: { label: 'g', family: 'mass', toBase: 1, baseLabel: 'g' },
  kg: { label: 'kg', family: 'mass', toBase: 1000, baseLabel: 'g' },
  ml: { label: 'ml', family: 'volume', toBase: 1, baseLabel: 'ml' },
  l: { label: 'l', family: 'volume', toBase: 1000, baseLabel: 'ml' },
  u: { label: 'unidad', family: 'unit', toBase: 1, baseLabel: 'unidad' },
};

const defaultIngredients = [
  { id: crypto.randomUUID(), name: 'Harina', packageQty: 1, unit: 'kg', price: 1500 },
  { id: crypto.randomUUID(), name: 'Azúcar', packageQty: 1, unit: 'kg', price: 1200 },
  { id: crypto.randomUUID(), name: 'Manteca', packageQty: 200, unit: 'g', price: 2400 },
  { id: crypto.randomUUID(), name: 'Huevos', packageQty: 12, unit: 'u', price: 4800 },
];

let ingredients = load(STORAGE_INGREDIENTS, defaultIngredients);
let recipeItems = buildDefaultRecipeItems();
let unitExtras = [];
let currentRecipeId = null;
let resultViewTracked = false;

const $ = (id) => document.getElementById(id);

function trackEvent(eventName, params = {}) {
  if (typeof window.gtag === 'function') {
    window.gtag('event', eventName, params);
  }
}

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function load(key, fallback) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : clone(fallback); }
  catch { return clone(fallback); }
}
function num(value) { const n = Number(value); return Number.isFinite(n) && n >= 0 ? n : 0; }
function positiveInt(value, fallback = 1) { const n = Math.round(num(value)); return n >= 1 ? n : fallback; }
function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function getUnit(unit) { return unitDefinitions[unit] || unitDefinitions.u; }
function saveIngredients() { localStorage.setItem(STORAGE_INGREDIENTS, JSON.stringify(ingredients)); }
function saveRecipes(recipes) { localStorage.setItem(STORAGE_RECIPES, JSON.stringify(recipes)); }

function buildDefaultRecipeItems() {
  const starters = [['Harina', 300, 'g'], ['Azúcar', 250, 'g'], ['Manteca', 150, 'g'], ['Huevos', 4, 'u']];
  return starters.map(([name, qty, unit]) => {
    const ingredient = ingredients.find(i => i.name === name);
    return ingredient ? { id: crypto.randomUUID(), ingredientId: ingredient.id, qty, unit } : null;
  }).filter(Boolean);
}

function packageBaseQuantity(ingredient) { return num(ingredient.packageQty) * getUnit(ingredient.unit).toBase; }
function baseUnitCost(ingredient) { const q = packageBaseQuantity(ingredient); return q ? num(ingredient.price) / q : 0; }
function preferredRecipeUnit(ingredient) {
  const family = getUnit(ingredient.unit).family;
  return family === 'mass' ? 'g' : family === 'volume' ? 'ml' : 'u';
}
function compatibleUnits(ingredient) {
  const family = getUnit(ingredient.unit).family;
  return Object.entries(unitDefinitions).filter(([, d]) => d.family === family).map(([key, d]) => ({ key, ...d }));
}
function ingredientCost(row) {
  const ingredient = ingredients.find(i => i.id === row.ingredientId);
  if (!ingredient) return 0;
  const usage = getUnit(row.unit);
  if (usage.family !== getUnit(ingredient.unit).family) return 0;
  return baseUnitCost(ingredient) * num(row.qty) * usage.toBase;
}
function ingredientBatchTotal() { return recipeItems.reduce((sum, row) => sum + ingredientCost(row), 0); }
function servings() { return positiveInt($('servings').value, 1); }
function fixedPresentationTotal() {
  return ['boxCost','ribbonCost','cardCost','trayCost','bagCost','drinkCost'].reduce((s, id) => s + num($(id).value), 0);
}
function customUnitExtrasTotal() { return unitExtras.reduce((s, item) => s + num(item.cost), 0); }
function presentationTotal() { return fixedPresentationTotal() + customUnitExtrasTotal(); }
function batchExtrasTotal() { return num($('labor').value) + num($('energy').value) + num($('otherBatch').value); }
function pricingMethod() { return document.querySelector('input[name="pricingMethod"]:checked')?.value || 'percent'; }

function createField(label, control) {
  const wrapper = document.createElement('label'); wrapper.className = 'mobile-field-label';
  const span = document.createElement('span'); span.textContent = label; wrapper.append(span, control); return wrapper;
}

function renderIngredients() {
  const list = $('ingredientsList'); list.innerHTML = ''; $('ingredientsEmpty').hidden = ingredients.length > 0;
  ingredients.forEach(item => {
    const row = document.createElement('div'); row.className = 'editable-row ingredient-row';
    const name = document.createElement('input'); name.type = 'text'; name.value = item.name; name.placeholder = 'Ej: Harina';
    const qty = document.createElement('input'); qty.type = 'number'; qty.min = '0'; qty.step = '0.01'; qty.value = item.packageQty;
    const unit = document.createElement('select');
    Object.entries(unitDefinitions).forEach(([key, d]) => { const o = document.createElement('option'); o.value = key; o.textContent = d.label; unit.append(o); }); unit.value = item.unit;
    const money = document.createElement('div'); money.className = 'row-money-input'; money.innerHTML = '<span>$</span>';
    const price = document.createElement('input'); price.type = 'number'; price.min = '0'; price.step = '0.01'; price.value = item.price; money.append(price);
    const base = document.createElement('div'); base.className = 'base-cost';
    const del = document.createElement('button'); del.type = 'button'; del.className = 'icon-btn'; del.textContent = '✕'; del.title = 'Eliminar';
    row.append(createField('Ingrediente', name), createField('Cantidad que comprás', qty), createField('Unidad', unit), createField('Cuánto pagás', money), createField('Costo base', base), del);
    const refresh = () => { const d = getUnit(item.unit); base.innerHTML = `<strong>${currency.format(baseUnitCost(item))}</strong><small>por ${d.baseLabel}</small>`; };
    name.addEventListener('input', () => { item.name = name.value; saveIngredients(); renderRecipe(); });
    qty.addEventListener('input', () => { item.packageQty = num(qty.value); saveIngredients(); refresh(); recalc(); });
    price.addEventListener('input', () => { item.price = num(price.value); saveIngredients(); refresh(); recalc(); });
    unit.addEventListener('change', () => {
      const oldFamily = getUnit(item.unit).family; item.unit = unit.value;
      if (oldFamily !== getUnit(item.unit).family) recipeItems.filter(r => r.ingredientId === item.id).forEach(r => r.unit = preferredRecipeUnit(item));
      saveIngredients(); refresh(); renderRecipe(); recalc();
    });
    del.addEventListener('click', () => { ingredients = ingredients.filter(i => i.id !== item.id); recipeItems = recipeItems.filter(r => r.ingredientId !== item.id); saveIngredients(); renderIngredients(); renderRecipe(); recalc(); });
    refresh(); list.append(row);
  });
  $('addRecipeItemBtn').disabled = ingredients.length === 0;
}

function renderRecipe() {
  const list = $('recipeList'); list.innerHTML = ''; $('recipeEmpty').hidden = recipeItems.length > 0;
  recipeItems.forEach(rowData => {
    const row = document.createElement('div'); row.className = 'editable-row recipe-row';
    const ingredientSelect = document.createElement('select');
    ingredients.forEach(i => { const o = document.createElement('option'); o.value = i.id; o.textContent = i.name || 'Ingrediente sin nombre'; ingredientSelect.append(o); });
    if (!ingredients.some(i => i.id === rowData.ingredientId) && ingredients[0]) { rowData.ingredientId = ingredients[0].id; rowData.unit = preferredRecipeUnit(ingredients[0]); }
    ingredientSelect.value = rowData.ingredientId;
    const qty = document.createElement('input'); qty.type = 'number'; qty.min = '0'; qty.step = '0.01'; qty.value = rowData.qty;
    const unit = document.createElement('select');
    const cost = document.createElement('div'); cost.className = 'recipe-row-cost';
    const del = document.createElement('button'); del.type = 'button'; del.className = 'icon-btn'; del.textContent = '✕'; del.title = 'Eliminar';
    const populateUnits = () => {
      unit.innerHTML = ''; const ing = ingredients.find(i => i.id === rowData.ingredientId); if (!ing) return;
      const opts = compatibleUnits(ing); if (!opts.some(o => o.key === rowData.unit)) rowData.unit = preferredRecipeUnit(ing);
      opts.forEach(d => { const o = document.createElement('option'); o.value = d.key; o.textContent = d.label; unit.append(o); }); unit.value = rowData.unit;
    };
    const refresh = () => cost.textContent = currency.format(ingredientCost(rowData));
    row.append(createField('Ingrediente', ingredientSelect), createField('Cantidad usada', qty), createField('Unidad', unit), createField('Costo en receta', cost), del);
    ingredientSelect.addEventListener('change', () => { rowData.ingredientId = ingredientSelect.value; const ing = ingredients.find(i => i.id === rowData.ingredientId); rowData.unit = ing ? preferredRecipeUnit(ing) : 'u'; populateUnits(); refresh(); recalc(); });
    qty.addEventListener('input', () => { rowData.qty = num(qty.value); refresh(); recalc(); });
    unit.addEventListener('change', () => { rowData.unit = unit.value; refresh(); recalc(); });
    del.addEventListener('click', () => { recipeItems = recipeItems.filter(r => r.id !== rowData.id); renderRecipe(); recalc(); });
    populateUnits(); refresh(); list.append(row);
  });
}

function renderUnitExtras() {
  const list = $('unitExtrasList'); list.innerHTML = '';
  unitExtras.forEach(item => {
    const row = document.createElement('div'); row.className = 'custom-cost-row';
    const name = document.createElement('input'); name.type = 'text'; name.placeholder = 'Ej: Decoración'; name.value = item.name;
    const money = document.createElement('div'); money.className = 'money-input'; money.innerHTML = '<span>$</span>';
    const cost = document.createElement('input'); cost.type = 'number'; cost.min = '0'; cost.step = '0.01'; cost.value = item.cost; money.append(cost);
    const del = document.createElement('button'); del.type = 'button'; del.className = 'icon-btn'; del.textContent = '✕';
    name.addEventListener('input', () => item.name = name.value);
    cost.addEventListener('input', () => { item.cost = num(cost.value); recalc(); });
    del.addEventListener('click', () => { unitExtras = unitExtras.filter(x => x.id !== item.id); renderUnitExtras(); recalc(); });
    row.append(name, money, del); list.append(row);
  });
}

function calculate() {
  const batchIngredients = ingredientBatchTotal();
  const qty = servings();
  const ingredientsPerUnit = batchIngredients / qty;
  const presentationPerUnit = presentationTotal();
  const batchExtras = batchExtrasTotal();
  const extrasPerUnit = batchExtras / qty;
  const realUnitCost = ingredientsPerUnit + presentationPerUnit + extrasPerUnit;
  const realBatchCost = realUnitCost * qty;
  const method = pricingMethod();
  let pricePerUnit = 0;
  if (method === 'multiplier') {
    pricePerUnit = (batchIngredients * num($('multiplier').value)) / qty;
  } else {
    pricePerUnit = realUnitCost * (1 + num($('profitPercent').value) / 100);
  }
  const profitPerUnit = pricePerUnit - realUnitCost;
  const totalProfit = profitPerUnit * qty;
  const markup = realUnitCost > 0 ? (profitPerUnit / realUnitCost) * 100 : 0;
  const margin = pricePerUnit > 0 ? (profitPerUnit / pricePerUnit) * 100 : 0;
  return { batchIngredients, qty, ingredientsPerUnit, presentationPerUnit, batchExtras, extrasPerUnit, realUnitCost, realBatchCost, method, pricePerUnit, profitPerUnit, totalProfit, markup, margin };
}

function recalc() {
  document.querySelectorAll('.recipe-row').forEach((el, index) => { const target = el.querySelector('.recipe-row-cost'); if (target && recipeItems[index]) target.textContent = currency.format(ingredientCost(recipeItems[index])); });
  const r = calculate();
  $('batchIngredientPreview').textContent = currency.format(r.batchIngredients);
  $('unitIngredientPreview').textContent = `${currency.format(r.ingredientsPerUnit)} por unidad`;
  $('ingredientBatchCost').textContent = currency.format(r.batchIngredients);
  $('ingredientUnitCost').textContent = currency.format(r.ingredientsPerUnit);
  $('presentationUnitCost').textContent = currency.format(r.presentationPerUnit);
  $('batchExtrasCost').textContent = currency.format(r.batchExtras);
  $('batchExtrasPerUnit').textContent = currency.format(r.extrasPerUnit);
  $('realUnitCost').textContent = currency.format(r.realUnitCost);
  $('realBatchCost').textContent = currency.format(r.realBatchCost);
  $('suggestedUnitPrice').textContent = currency.format(r.pricePerUnit);
  $('heroCost').textContent = currency.format(r.realUnitCost);
  $('realProfitUnit').textContent = currency.format(r.profitPerUnit);
  $('heroPrice').textContent = currency.format(r.pricePerUnit);
  $('totalProfit').textContent = currency.format(r.totalProfit);
  $('actualMarkup').textContent = `${percentFmt.format(r.markup)}%`;
  $('actualMargin').textContent = `${percentFmt.format(r.margin)}%`;
  $('printRecipeName').textContent = $('recipeName').value.trim() || 'Receta sin nombre';
  $('realProfitUnit').classList.toggle('negative', r.profitPerUnit < 0);
  $('pricingExplanation').textContent = r.method === 'multiplier'
    ? `${currency.format(r.batchIngredients)} × ${num($('multiplier').value)} ÷ ${r.qty} = ${currency.format(r.pricePerUnit)} por unidad. La ganancia real descuenta presentación y otros costos.`
    : `${currency.format(r.realUnitCost)} + ${num($('profitPercent').value)}% = ${currency.format(r.pricePerUnit)} por unidad.`;
  document.querySelectorAll('[data-profit]').forEach(b => b.classList.toggle('active', Number(b.dataset.profit) === num($('profitPercent').value)));

  if ($('liveCost')) $('liveCost').textContent = currency.format(r.realUnitCost);
  if ($('livePrice')) $('livePrice').textContent = currency.format(r.pricePerUnit);
  if ($('liveProfit')) {
    $('liveProfit').textContent = currency.format(r.profitPerUnit);
    $('liveProfit').classList.toggle('negative-live', r.profitPerUnit < 0);
  }
  if ($('liveContext')) {
    const name = $('recipeName').value.trim() || 'Receta sin nombre';
    $('liveContext').textContent = `${name} · ${r.qty} ${r.qty === 1 ? 'unidad' : 'unidades'}`;
  }
  if ($('step1Compact')) $('step1Compact').textContent = `${ingredients.length} ${ingredients.length === 1 ? 'ingrediente cargado' : 'ingredientes cargados'}`;
  if ($('step2Compact')) $('step2Compact').textContent = `${recipeItems.length} ${recipeItems.length === 1 ? 'ingrediente usado' : 'ingredientes usados'} · ${currency.format(r.batchIngredients)} el lote`;
  if ($('step3Compact')) $('step3Compact').textContent = `Presentación ${currency.format(r.presentationPerUnit)} · costo real ${currency.format(r.realUnitCost)}`;
  if ($('step4Compact')) $('step4Compact').textContent = `Vendé a ${currency.format(r.pricePerUnit)} · ganancia ${currency.format(r.profitPerUnit)}`;
}


const PUBLIC_URL = 'https://calculadora-pastelera-two.vercel.app/';
function shareUrl() {
  const local = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  return local ? PUBLIC_URL : `${window.location.origin}${window.location.pathname}`;
}

function resultShareText() {
  const r = calculate();
  const name = $('recipeName').value.trim() || 'Mi receta';
  return [
    `🍰 ${name} — DulceCuenta`,
    `Costo real por unidad: ${currency.format(r.realUnitCost)}`,
    `Precio sugerido: ${currency.format(r.pricePerUnit)}`,
    `Ganancia estimada por unidad: ${currency.format(r.profitPerUnit)}`,
    `Rendimiento: ${r.qty} ${r.qty === 1 ? 'unidad' : 'unidades'}`,
  ].join('\n');
}

async function copyText(text, successMessage = 'Enlace copiado.') {
  try {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
    else {
      const area = document.createElement('textarea');
      area.value = text; area.setAttribute('readonly', ''); area.style.position = 'absolute'; area.style.left = '-9999px';
      document.body.append(area); area.select(); document.execCommand('copy'); area.remove();
    }
    showStatus(successMessage);
  } catch { showStatus('No pudimos copiar automáticamente. Copiá la dirección desde el navegador.', true); }
}

async function shareSite() {
  const data = { title: 'DulceCuenta', text: 'Calculá el costo real, el precio de venta y la ganancia de tus recetas de pastelería.', url: shareUrl() };
  try {
    if (navigator.share) await navigator.share(data);
    else await copyText(data.url, 'Enlace de DulceCuenta copiado.');
  } catch (error) { if (error?.name !== 'AbortError') await copyText(data.url, 'Enlace de DulceCuenta copiado.'); }
}

async function shareResult() {
  const text = resultShareText();
  const data = { title: `${$('recipeName').value.trim() || 'Receta'} | DulceCuenta`, text, url: shareUrl() };
  try {
    if (navigator.share) await navigator.share(data);
    else await copyText(`${text}\n${data.url}`, 'Resultado copiado. Ya podés pegarlo donde quieras.');
  } catch (error) { if (error?.name !== 'AbortError') await copyText(`${text}\n${data.url}`, 'Resultado copiado.'); }
}

function shareWhatsApp() {
  const message = `${resultShareText()}\n\nCalculado con DulceCuenta: ${shareUrl()}`;
  window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
}

function snapshot() {
  const r = calculate();
  return {
    id: currentRecipeId || crypto.randomUUID(), name: $('recipeName').value.trim() || 'Receta sin nombre',
    recipeItems: recipeItems.map(x => ({...x})), servings: r.qty,
    presentation: Object.fromEntries(['boxCost','ribbonCost','cardCost','trayCost','bagCost','drinkCost'].map(id => [id, num($(id).value)])),
    unitExtras: unitExtras.map(x => ({...x})),
    batchCosts: { labor: num($('labor').value), energy: num($('energy').value), otherBatch: num($('otherBatch').value) },
    pricing: { method: r.method, profitPercent: num($('profitPercent').value), multiplier: num($('multiplier').value) },
    summary: r, updatedAt: new Date().toISOString(),
  };
}

function saveRecipe() {
  if (!recipeItems.length) return showStatus('Agregá al menos un ingrediente antes de guardar.', true);
  const recipes = load(STORAGE_RECIPES, []); const data = snapshot(); const idx = recipes.findIndex(x => x.id === data.id);
  if (idx >= 0) recipes[idx] = data; else recipes.unshift(data);
  currentRecipeId = data.id; saveRecipes(recipes.slice(0, 100)); renderSavedRecipes(); showStatus(idx >= 0 ? 'Cambios guardados.' : 'Receta guardada en este navegador.');
  trackEvent('recipe_saved', {
    servings: data.servings,
    pricing_method: data.pricing.method,
    is_update: idx >= 0,
  });
}

function applyRecipe(recipe, duplicate = false) {
  resultViewTracked = false;
  currentRecipeId = duplicate ? null : recipe.id;
  $('recipeName').value = duplicate ? `${recipe.name} - copia` : recipe.name;
  recipeItems = (recipe.recipeItems || []).filter(r => ingredients.some(i => i.id === r.ingredientId)).map(r => ({ ...r, id: crypto.randomUUID() }));
  $('servings').value = positiveInt(recipe.servings, 1);
  ['boxCost','ribbonCost','cardCost','trayCost','bagCost','drinkCost'].forEach(id => $(id).value = num(recipe.presentation?.[id]));
  unitExtras = (recipe.unitExtras || []).map(x => ({ ...x, id: crypto.randomUUID() })); renderUnitExtras();
  $('labor').value = num(recipe.batchCosts?.labor); $('energy').value = num(recipe.batchCosts?.energy); $('otherBatch').value = num(recipe.batchCosts?.otherBatch);
  $('profitPercent').value = num(recipe.pricing?.profitPercent ?? 50); $('multiplier').value = num(recipe.pricing?.multiplier ?? 3);
  const method = recipe.pricing?.method || 'percent'; const radio = document.querySelector(`input[name="pricingMethod"][value="${method}"]`); if (radio) radio.checked = true;
  syncMethodUI(); renderRecipe(); recalc(); $('savedRecipesSection').hidden = true; showStatus(duplicate ? 'Copia creada. Cambiá lo que necesites y guardala.' : `Editando “${recipe.name}”.`);
  if (isMobileAccordion()) openAccordionStep(2, true); else $('step-2').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function loadRecipe(id) { const r = load(STORAGE_RECIPES, []).find(x => x.id === id); if (r) applyRecipe(r, false); }
function duplicateSaved(id) { const r = load(STORAGE_RECIPES, []).find(x => x.id === id); if (r) applyRecipe(r, true); }
function deleteSaved(id) { saveRecipes(load(STORAGE_RECIPES, []).filter(x => x.id !== id)); if (currentRecipeId === id) currentRecipeId = null; renderSavedRecipes(); }

function renderSavedRecipes() {
  const recipes = load(STORAGE_RECIPES, []); $('savedCount').textContent = recipes.length; const box = $('savedRecipes'); box.innerHTML = '';
  if (!recipes.length) { box.innerHTML = '<p class="empty-state saved-empty">Todavía no guardaste recetas.</p>'; return; }
  recipes.forEach(recipe => {
    const card = document.createElement('article'); card.className = 'saved-card'; const s = recipe.summary || {};
    card.innerHTML = `<div class="saved-card-top"><div><h3>${escapeHtml(recipe.name)}</h3><small>${positiveInt(recipe.servings,1)} unidades</small></div><span class="saved-servings">${recipe.pricing?.method === 'multiplier' ? `× ${num(recipe.pricing?.multiplier)}` : `${num(recipe.pricing?.profitPercent)}%`}</span></div><div class="saved-summary"><span>Costo/unidad <strong>${currency.format(num(s.realUnitCost))}</strong></span><span>Venta/unidad <strong>${currency.format(num(s.pricePerUnit))}</strong></span><span>Ganancia/unidad <strong>${currency.format(num(s.profitPerUnit))}</strong></span></div><div class="saved-actions"><button class="primary open-saved" type="button">Abrir</button><button class="secondary duplicate-saved" type="button">Duplicar</button><button class="secondary delete-saved" type="button">Eliminar</button></div>`;
    card.querySelector('.open-saved').addEventListener('click', () => loadRecipe(recipe.id));
    card.querySelector('.duplicate-saved').addEventListener('click', () => duplicateSaved(recipe.id));
    card.querySelector('.delete-saved').addEventListener('click', () => deleteSaved(recipe.id)); box.append(card);
  });
}

function newRecipe() {
  resultViewTracked = false;
  currentRecipeId = null; $('recipeName').value = ''; recipeItems = []; $('servings').value = 1;
  ['boxCost','ribbonCost','cardCost','trayCost','bagCost','drinkCost','labor','energy','otherBatch'].forEach(id => $(id).value = 0);
  unitExtras = []; renderUnitExtras(); $('profitPercent').value = 50; $('multiplier').value = 3;
  document.querySelector('input[name="pricingMethod"][value="percent"]').checked = true; syncMethodUI(); renderRecipe(); recalc(); showStatus(''); if (isMobileAccordion()) openAccordionStep(2, true); else $('step-2').scrollIntoView({behavior:'smooth'});
}
function showStatus(msg, error = false) { $('statusMessage').textContent = msg; $('statusMessage').classList.toggle('error', error); }
function syncMethodUI() { const multi = pricingMethod() === 'multiplier'; $('percentSettings').hidden = multi; $('multiplierSettings').hidden = !multi; recalc(); }


const mobileQuery = window.matchMedia('(max-width: 620px)');
let openMobileStep = 1;

function isMobileAccordion() { return mobileQuery.matches; }

function accordionHeader(section, step) {
  return step === 4 ? section.querySelector('.result-intro') : section.querySelector('.section-head');
}

function setupAccordionButtons() {
  document.querySelectorAll('.step-section').forEach((section, index) => {
    const step = index + 1;
    const header = accordionHeader(section, step);
    if (!header || header.querySelector('.accordion-toggle')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'accordion-toggle no-print';
    button.setAttribute('aria-label', `Abrir o cerrar paso ${step}`);
    button.innerHTML = '<span class="accordion-chevron" aria-hidden="true">⌄</span>';
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      const collapsed = section.classList.contains('accordion-collapsed');
      if (collapsed) openAccordionStep(step, false);
      else section.classList.add('accordion-collapsed');
      updateAccordionButtons();
    });
    header.append(button);
    header.classList.add('accordion-head');
    header.addEventListener('click', (event) => {
      if (!isMobileAccordion() || event.target.closest('button, input, select, a, label')) return;
      if (section.classList.contains('accordion-collapsed')) openAccordionStep(step, false);
    });
  });
}

function updateAccordionButtons() {
  document.querySelectorAll('.step-section').forEach((section) => {
    const button = section.querySelector('.accordion-toggle');
    if (!button) return;
    const collapsed = section.classList.contains('accordion-collapsed');
    const chev = button.querySelector('.accordion-chevron');
    if (chev) chev.textContent = collapsed ? '⌄' : '⌃';
    button.setAttribute('aria-expanded', String(!collapsed));
    button.setAttribute('aria-label', collapsed ? 'Abrir sección' : 'Cerrar sección');
  });
}

function openAccordionStep(step, scroll = false) {
  openMobileStep = Math.min(4, Math.max(1, Number(step) || 1));
  if (!isMobileAccordion()) return;
  document.querySelectorAll('.step-section').forEach((section, index) => {
    section.classList.toggle('accordion-collapsed', index + 1 !== openMobileStep);
  });
  updateAccordionButtons();
  if (scroll) {
    const section = $(`step-${openMobileStep}`);
    requestAnimationFrame(() => section?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }
}

function syncAccordionMode() {
  setupAccordionButtons();
  document.body.classList.toggle('mobile-accordion', isMobileAccordion());
  if (isMobileAccordion()) {
    openAccordionStep(openMobileStep, false);
  } else {
    document.querySelectorAll('.step-section').forEach(section => section.classList.remove('accordion-collapsed'));
    updateAccordionButtons();
  }
}

function setupResultViewTracking() {
  const resultSection = $('step-4');
  if (!resultSection || typeof IntersectionObserver === 'undefined') return;

  const observer = new IntersectionObserver((entries) => {
    const visible = entries.some(entry => entry.isIntersecting && entry.intersectionRatio >= 0.35);
    if (!visible || resultViewTracked) return;

    const r = calculate();
    if (!recipeItems.length || r.realUnitCost <= 0) return;

    trackEvent('result_viewed', {
      servings: r.qty,
      pricing_method: r.method,
      real_unit_cost: Number(r.realUnitCost.toFixed(2)),
      suggested_price: Number(r.pricePerUnit.toFixed(2)),
    });
    resultViewTracked = true;
  }, { threshold: [0.35] });

  observer.observe(resultSection);
}

function addIngredient() {
  ingredients.push({ id: crypto.randomUUID(), name: '', packageQty: 1, unit: 'kg', price: 0 }); saveIngredients(); renderIngredients(); renderRecipe();
  trackEvent('ingredient_added');
  const rows = $('ingredientsList').querySelectorAll('.ingredient-row'); rows[rows.length - 1]?.querySelector('input[type="text"]')?.focus();
}

$('addIngredientBtn').addEventListener('click', addIngredient); $('addIngredientBottomBtn').addEventListener('click', addIngredient);
$('addRecipeItemBtn').addEventListener('click', () => { if (!ingredients.length) return; const ing = ingredients[0]; recipeItems.push({id:crypto.randomUUID(), ingredientId:ing.id, qty:0, unit:preferredRecipeUnit(ing)}); renderRecipe(); recalc(); });
$('addUnitExtraBtn').addEventListener('click', () => { unitExtras.push({id:crypto.randomUUID(), name:'', cost:0}); renderUnitExtras(); });

['servings','boxCost','ribbonCost','cardCost','trayCost','bagCost','drinkCost','labor','energy','otherBatch','profitPercent','multiplier','recipeName'].forEach(id => $(id).addEventListener('input', recalc));
document.querySelectorAll('input[name="pricingMethod"]').forEach(r => r.addEventListener('change', () => {
  syncMethodUI();
  trackEvent(r.value === 'multiplier' ? 'pricing_method_multiplier' : 'pricing_method_percentage');
}));
document.querySelectorAll('[data-profit]').forEach(b => b.addEventListener('click', () => { $('profitPercent').value = b.dataset.profit; recalc(); }));
$('saveRecipeBtn').addEventListener('click', saveRecipe);
$('shareSiteBtn').addEventListener('click', () => {
  trackEvent('share_site');
  shareSite();
});
$('shareResultBtn').addEventListener('click', () => {
  trackEvent('share_result');
  shareResult();
});
$('whatsappBtn').addEventListener('click', () => {
  trackEvent('whatsapp_click');
  shareWhatsApp();
});
$('copyLinkBtn').addEventListener('click', () => {
  trackEvent('copy_link');
  copyText(shareUrl(), 'Enlace copiado.');
});
$('duplicateRecipeBtn').addEventListener('click', () => { const data = snapshot(); data.id = crypto.randomUUID(); applyRecipe(data, true); });
$('printBtn').addEventListener('click', () => {
  trackEvent('print_pdf');
  window.print();
});
$('newRecipeBtn').addEventListener('click', newRecipe); $('newRecipeTopBtn').addEventListener('click', newRecipe);
$('showRecipesBtn').addEventListener('click', () => { $('savedRecipesSection').hidden = false; renderSavedRecipes(); $('savedRecipesSection').scrollIntoView({behavior:'smooth'}); });
$('closeRecipesBtn').addEventListener('click', () => $('savedRecipesSection').hidden = true);


document.querySelector('.hero-cta')?.addEventListener('click', (event) => {
  trackEvent('start_calculation');
  if (!isMobileAccordion()) return;
  event.preventDefault();
  openAccordionStep(1, true);
});
document.querySelectorAll('.progress-nav a').forEach((link, index) => link.addEventListener('click', (event) => {
  if (!isMobileAccordion()) return;
  event.preventDefault();
  openAccordionStep(index + 1, true);
}));
// Los botones de la V5 quedan ocultos en móvil. Si alguien los activa desde desktop,
// simplemente llevan a la sección correspondiente sin alterar los datos.
document.querySelectorAll('[data-next-step]').forEach(btn => btn.addEventListener('click', () => openAccordionStep(btn.dataset.nextStep, true)));
document.querySelectorAll('[data-prev-step]').forEach(btn => btn.addEventListener('click', () => openAccordionStep(btn.dataset.prevStep, true)));
$('mobileNewRecipeBtn')?.addEventListener('click', () => { newRecipe(); openAccordionStep(1, true); });
mobileQuery.addEventListener?.('change', syncAccordionMode);
syncAccordionMode();
setupResultViewTracking();

renderIngredients(); renderRecipe(); renderUnitExtras(); renderSavedRecipes(); syncMethodUI(); recalc();
