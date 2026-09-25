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

const $ = (id) => document.getElementById(id);

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
}

function applyRecipe(recipe, duplicate = false) {
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
  $('step-2').scrollIntoView({ behavior: 'smooth', block: 'start' });
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
  currentRecipeId = null; $('recipeName').value = ''; recipeItems = []; $('servings').value = 1;
  ['boxCost','ribbonCost','cardCost','trayCost','bagCost','drinkCost','labor','energy','otherBatch'].forEach(id => $(id).value = 0);
  unitExtras = []; renderUnitExtras(); $('profitPercent').value = 50; $('multiplier').value = 3;
  document.querySelector('input[name="pricingMethod"][value="percent"]').checked = true; syncMethodUI(); renderRecipe(); recalc(); showStatus(''); $('step-2').scrollIntoView({behavior:'smooth'});
}
function showStatus(msg, error = false) { $('statusMessage').textContent = msg; $('statusMessage').classList.toggle('error', error); }
function syncMethodUI() { const multi = pricingMethod() === 'multiplier'; $('percentSettings').hidden = multi; $('multiplierSettings').hidden = !multi; recalc(); }

function addIngredient() {
  ingredients.push({ id: crypto.randomUUID(), name: '', packageQty: 1, unit: 'kg', price: 0 }); saveIngredients(); renderIngredients(); renderRecipe();
  const rows = $('ingredientsList').querySelectorAll('.ingredient-row'); rows[rows.length - 1]?.querySelector('input[type="text"]')?.focus();
}

$('addIngredientBtn').addEventListener('click', addIngredient); $('addIngredientBottomBtn').addEventListener('click', addIngredient);
$('addRecipeItemBtn').addEventListener('click', () => { if (!ingredients.length) return; const ing = ingredients[0]; recipeItems.push({id:crypto.randomUUID(), ingredientId:ing.id, qty:0, unit:preferredRecipeUnit(ing)}); renderRecipe(); recalc(); });
$('addUnitExtraBtn').addEventListener('click', () => { unitExtras.push({id:crypto.randomUUID(), name:'', cost:0}); renderUnitExtras(); });

['servings','boxCost','ribbonCost','cardCost','trayCost','bagCost','drinkCost','labor','energy','otherBatch','profitPercent','multiplier','recipeName'].forEach(id => $(id).addEventListener('input', recalc));
document.querySelectorAll('input[name="pricingMethod"]').forEach(r => r.addEventListener('change', syncMethodUI));
document.querySelectorAll('[data-profit]').forEach(b => b.addEventListener('click', () => { $('profitPercent').value = b.dataset.profit; recalc(); }));
$('saveRecipeBtn').addEventListener('click', saveRecipe);
$('duplicateRecipeBtn').addEventListener('click', () => { const data = snapshot(); data.id = crypto.randomUUID(); applyRecipe(data, true); });
$('printBtn').addEventListener('click', () => window.print());
$('newRecipeBtn').addEventListener('click', newRecipe); $('newRecipeTopBtn').addEventListener('click', newRecipe);
$('showRecipesBtn').addEventListener('click', () => { $('savedRecipesSection').hidden = false; renderSavedRecipes(); $('savedRecipesSection').scrollIntoView({behavior:'smooth'}); });
$('closeRecipesBtn').addEventListener('click', () => $('savedRecipesSection').hidden = true);

renderIngredients(); renderRecipe(); renderUnitExtras(); renderSavedRecipes(); syncMethodUI(); recalc();
