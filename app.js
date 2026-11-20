/* =========================================================
   app.js — Финансовая модель розничной сети (РФ)
   Часть 1: Справочники, state, тема
   ========================================================= */

const STORAGE_KEY = 'retail_finmodel_ru_v1';
const THEME_KEY = 'retail_finmodel_theme';

const BUY_CURRENCIES = {
  USD: { code: 'USD', symbol: '$', defaultRate: 92.0 },
  EUR: { code: 'EUR', symbol: '€', defaultRate: 100.0 },
  CNY: { code: 'CNY', symbol: '¥', defaultRate: 12.7 }
};

// Налоговые режимы РФ (включая УСН с НДС 5%/7% и ОСНО 25% прибыль + НДС 20%)
const TAX_REGIMES_RU = {
  usn6: {
    id: 'usn6',
    name: 'ИП / ООО УСН Доходы (6%)',
    businessTaxPct: 6,
    base: 'revenue',
    vatPct: 0,
    vatMode: 'none',
    label: 'УСН 6% от выручки'
  },
  usn6_vat5: {
    id: 'usn6_vat5',
    name: 'УСН Доходы (6% + НДС 5%)',
    businessTaxPct: 6,
    base: 'revenue',
    vatPct: 5,
    vatMode: 'turnover',
    label: 'УСН 6% от выручки'
  },
  usn6_vat7: {
    id: 'usn6_vat7',
    name: 'УСН Доходы (6% + НДС 7%)',
    businessTaxPct: 6,
    base: 'revenue',
    vatPct: 7,
    vatMode: 'turnover',
    label: 'УСН 6% от выручки'
  },
  usn15: {
    id: 'usn15',
    name: 'УСН Доходы − Расходы (15%)',
    businessTaxPct: 15,
    base: 'profit',
    vatPct: 0,
    vatMode: 'none',
    label: 'УСН 15% от прибыли'
  },
  osno25: {
    id: 'osno25',
    name: 'ООО ОСНО (Прибыль 25% + НДС 20%)',
    businessTaxPct: 25,
    base: 'profit',
    vatPct: 20,
    vatMode: 'deductible',
    label: 'Налог на прибыль 25%'
  },
  custom: {
    id: 'custom',
    name: 'Настраиваемый режим',
    custom: true
  }
};

const RAMP_PROFILES = {
  0: [],
  2: [0.6, 0.85],
  3: [0.5, 0.75, 0.9],
  6: [0.4, 0.55, 0.7, 0.8, 0.9, 0.95]
};

const state = {
  activeScenario: 'A',
  buyCurrency: 'USD',
  taxRegime: 'usn6',
  ratesSource: 'base', // 'base' | 'cbr' | 'manual'
  rates: {
    USD: 92.0,
    EUR: 100.0,
    CNY: 12.7
  },
  scenarios: {
    A: {},
    B: {}
  }
};

function getBaseDemoScenario() {
  return {
    areaTotal: 160,
    areaSales: 130,
    unitsPerSqm: 13,
    stockWarehousePct: 20,
    unitCostBuy: 31,
    markupPct: 110,
    discountPct: 10,
    monthlyRevenue: 3690000,

    // CAPEX (итого 2 170 000 руб. с детализацией ИТ 140 000 руб.)
    capexSmr: 40000,
    capexLight: 400000,
    capexSign: 100000,
    capexFurniture: 1000000,
    capexCompensation: 0,
    capexMannequins: 120000,
    capexAntitheft: 50000,
    capexHangers: 120000,
    capexOther: 200000,

    itPc: 45000,
    itFr: 35000,
    itScanner: 8000,
    itPrinter: 22000,
    itMfu: 12000,
    itSoft: 12000,
    itConsumables: 6000,

    // НДС и налог бизнеса
    vatPct: 0,
    businessTaxPct: 6,
    customTaxBase: 'profit', // 'revenue' | 'profit' — только для custom-режима

    // ФОТ, бонус продавцов от продаж, НДФЛ и взносы СФР (ПФР, ФСС, ОМС)
    salaryType: 'net',
    staffCount: 4,
    staffSalary: 75000,
    staffBonusPct: 2,
    ndflPct: 13,
    socialTaxPct: 30.2,

    // Прочий OPEX и амортизация
    rentMonthly: 450000,
    logisticsMonthly: 15000,
    acquiringPct: 1.5,
    otherOpexMonthly: 36000,
    amortizationMonths: 24,

    // Опт и управляющий офис
    wholesaleRevenue: 1500000,
    wholesaleMarkupPct: 25,
    officeExpenses: 1200000,
    targetStoresCount: 5,

    // Период разгона
    rampUpMonths: 3
  };
}

/* ---------- Тема ---------- */
function getStoredTheme() {
  try {
    const t = localStorage.getItem(THEME_KEY);
    if (t === 'light' || t === 'dark') return t;
  } catch (e) {}
  return null;
}

function getSystemTheme() {
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const btn = document.getElementById('themeToggleBtn');
  if (btn) {
    btn.setAttribute(
      'aria-label',
      theme === 'dark' ? 'Переключить на светлую тему' : 'Переключить на тёмную тему'
    );
    btn.title = theme === 'dark' ? 'Светлая тема' : 'Тёмная тема';
  }
}

function initTheme() {
  const stored = getStoredTheme();
  const initial = stored || getSystemTheme();
  applyTheme(initial);

  const btn = document.getElementById('themeToggleBtn');
  if (btn) {
    btn.addEventListener('click', function () {
      const current = document.documentElement.getAttribute('data-theme') || getSystemTheme();
      const next = current === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch (e) {}
    });
  }

  // Реакция на системную тему — только если пользователь не выбрал вручную
  if (window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = function () {
      if (!getStoredTheme()) {
        applyTheme(getSystemTheme());
      }
    };
    if (mq.addEventListener) mq.addEventListener('change', handler);
    else if (mq.addListener) mq.addListener(handler);
  }
}

/* =========================================================
   Часть 2: Сценарии, хранилище и курсы ЦБ РФ
   ========================================================= */

function initDefaultScenarios() {
  state.buyCurrency = 'USD';
  state.taxRegime = 'usn6';
  state.ratesSource = 'base';
  state.scenarios.A = getBaseDemoScenario();

  // План Б — оптимистичный сценарий (+15% к выручке, −10% к аренде, разгон 2 мес.)
  const planB = Object.assign({}, state.scenarios.A);
  planB.monthlyRevenue = Math.round(planB.monthlyRevenue * 1.15);
  planB.rentMonthly = Math.round(planB.rentMonthly * 0.9);
  planB.rampUpMonths = 2;
  state.scenarios.B = planB;
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    // Игнорируем ошибку переполнения хранилища
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.scenarios && parsed.scenarios.A && parsed.scenarios.B) {
      const base = getBaseDemoScenario();
      state.activeScenario = parsed.activeScenario || 'A';
      state.buyCurrency = parsed.buyCurrency || 'USD';
      state.taxRegime = parsed.taxRegime || 'usn6';
      state.ratesSource = parsed.ratesSource || 'base';
      state.rates = Object.assign({}, state.rates, parsed.rates || {});
      // Мержим с базовым сценарием — чтобы новые поля не были undefined
      state.scenarios.A = Object.assign({}, base, parsed.scenarios.A);
      state.scenarios.B = Object.assign({}, base, parsed.scenarios.B);
      return true;
    }
  } catch (e) {
    return false;
  }
  return false;
}

// Загрузка официального курса ЦБ РФ (USD, EUR, CNY) из JSON-файла
async function fetchCbrRates() {
  const statusEl = document.getElementById('ratesStatus');
  if (statusEl) {
    statusEl.textContent = 'Загрузка ЦБ...';
    statusEl.classList.remove('ok');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(function () { controller.abort(); }, 8000);

  try {
    const cbrUrl = 'https://' + 'www.cbr-xml-daily.ru' + '/daily_json.js';
    const response = await fetch(cbrUrl, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!response.ok) throw new Error('Ошибка сети ЦБ РФ');
    const json = await response.json();

    if (json && json.Valute) {
      if (json.Valute.USD) {
        state.rates.USD = Number((json.Valute.USD.Value / json.Valute.USD.Nominal).toFixed(2));
      }
      if (json.Valute.EUR) {
        state.rates.EUR = Number((json.Valute.EUR.Value / json.Valute.EUR.Nominal).toFixed(2));
      }
      if (json.Valute.CNY) {
        state.rates.CNY = Number((json.Valute.CNY.Value / json.Valute.CNY.Nominal).toFixed(2));
      }

      state.ratesSource = 'cbr';

      const inpUsd = document.getElementById('rateUSD');
      const inpEur = document.getElementById('rateEUR');
      const inpCny = document.getElementById('rateCNY');
      if (inpUsd) inpUsd.value = state.rates.USD;
      if (inpEur) inpEur.value = state.rates.EUR;
      if (inpCny) inpCny.value = state.rates.CNY;

      if (statusEl) {
        const dateStr = json.Date ? json.Date.slice(0, 10).split('-').reverse().join('.') : 'ОК';
        statusEl.textContent = 'ЦБ РФ (' + dateStr + ')';
        statusEl.classList.add('ok');
      }
      saveState();
      renderAll();
    }
  } catch (err) {
    clearTimeout(timeoutId);
    if (statusEl) {
      statusEl.textContent = 'Офлайн (базовые)';
      statusEl.classList.remove('ok');
    }
  }
}

/* =========================================================
   Часть 3: Расчетный движок (ТЗ, CAPEX, НДС, ФОТ)
   ========================================================= */

function calculateScenario(data, buyCurrencyCode, taxRegimeId, rates) {
  const buyCurrInfo = BUY_CURRENCIES[buyCurrencyCode] || BUY_CURRENCIES.USD;
  const buyRate = Number(rates[buyCurrInfo.code]) || buyCurrInfo.defaultRate;
  const regimeCfg = TAX_REGIMES_RU[taxRegimeId] || TAX_REGIMES_RU.usn6;

  // 1. Помещение, товарный запас и ценообразование
  const areaTotal = Math.max(0, Number(data.areaTotal) || 0);
  const areaSales = Math.max(0, Number(data.areaSales) || 0);
  const unitsPerSqm = Math.max(0, Number(data.unitsPerSqm) || 0);
  const stockWarehousePct = Math.max(0, Number(data.stockWarehousePct) || 0) / 100;
  const unitCostBuy = Math.max(0, Number(data.unitCostBuy) || 0);
  const markupPct = Math.max(0, Number(data.markupPct) || 0) / 100;
  const discountPct = Math.min(0.99, Math.max(0, Number(data.discountPct) || 0) / 100);
  const monthlyRevenue = Math.max(0, Number(data.monthlyRevenue) || 0);

  const unitsHall = Math.round(areaSales * unitsPerSqm);
  const unitsWarehouse = Math.round(unitsHall * stockWarehousePct);
  const unitsTotal = unitsHall + unitsWarehouse;

  const stockTotalBuyCurr = unitsTotal * unitCostBuy;
  const stockTotalRub = stockTotalBuyCurr * buyRate;

  const effectiveMarkup = (1 + markupPct) * (1 - discountPct) - 1;
  const effectiveMarkupSafe = Math.max(-0.95, effectiveMarkup);
  const avgRetailPrice = unitCostBuy * buyRate * (1 + effectiveMarkupSafe);

  // 2. Инвестиции (CAPEX)
  const itSubtotal =
    (Number(data.itPc) || 0) +
    (Number(data.itFr) || 0) +
    (Number(data.itScanner) || 0) +
    (Number(data.itPrinter) || 0) +
    (Number(data.itMfu) || 0) +
    (Number(data.itSoft) || 0) +
    (Number(data.itConsumables) || 0);

  const capexGross =
    (Number(data.capexSmr) || 0) +
    (Number(data.capexLight) || 0) +
    (Number(data.capexSign) || 0) +
    (Number(data.capexFurniture) || 0) +
    (Number(data.capexMannequins) || 0) +
    (Number(data.capexAntitheft) || 0) +
    (Number(data.capexHangers) || 0) +
    (Number(data.capexOther) || 0) +
    itSubtotal;

  const capexCompensation = Math.max(0, Number(data.capexCompensation) || 0);
  const capexTotal = Math.max(0, capexGross - capexCompensation);
  const capexPerSqm = areaTotal > 0 ? capexTotal / areaTotal : 0;
  const totalInvestment = capexTotal + stockTotalRub;

  // 3. НДС, выручка без НДС и себестоимость
  const vatPct = Math.max(0, Number(data.vatPct) || 0) / 100;
  const vatMode =
    vatPct === 0
      ? 'none'
      : regimeCfg && regimeCfg.vatMode && regimeCfg.vatMode !== 'none'
      ? regimeCfg.vatMode
      : vatPct <= 0.08
      ? 'turnover'
      : 'deductible';

  const outputVat = vatPct > 0 ? monthlyRevenue * (vatPct / (1 + vatPct)) : 0;
  const netRevenue = monthlyRevenue - outputVat;

  const cogs = effectiveMarkupSafe > -0.95 ? netRevenue / (1 + effectiveMarkupSafe) : netRevenue;
  const inputVat = vatMode === 'deductible' ? cogs * vatPct : 0;
  const vatPayable = Math.max(0, outputVat - inputVat);

  const vatModeLabel =
    vatPct === 0
      ? 'без НДС'
      : vatMode === 'turnover'
      ? 'с оборота ' + Math.round(vatPct * 100) + '%'
      : 'с вычетом ' + Math.round(vatPct * 100) + '%';

  const grossProfit = netRevenue - cogs;
  const gmr = netRevenue > 0 ? grossProfit / netRevenue : 0;

  // 4. ФОТ (Net/Gross), бонус от продаж, НДФЛ и страховые взносы (СФР: ПФР, ФСС, ОМС)
  const salaryType = data.salaryType || 'net';
  const staffCount = Math.max(0, Number(data.staffCount) || 0);
  const staffSalary = Math.max(0, Number(data.staffSalary) || 0);
  const staffBonusPct = Math.max(0, Number(data.staffBonusPct) || 0) / 100;
  const ndflPct = Math.min(0.8, Math.max(0, Number(data.ndflPct) || 0) / 100);
  const socialTaxPct = Math.max(0, Number(data.socialTaxPct) || 0) / 100;

  const fixedBaseSalary = staffCount * staffSalary;
  const variableBonus = monthlyRevenue * staffBonusPct;
  const basePayrollInput = fixedBaseSalary + variableBonus;

  let fotNet = 0;
  let fotGross = 0;
  let ndflAmount = 0;

  if (salaryType === 'net') {
    fotNet = basePayrollInput;
    fotGross = ndflPct < 1 ? fotNet / (1 - ndflPct) : fotNet;
    ndflAmount = fotGross - fotNet;
  } else {
    fotGross = basePayrollInput;
    ndflAmount = fotGross * ndflPct;
    fotNet = fotGross - ndflAmount;
  }

  const socialTax = fotGross * socialTaxPct;
  const totalPayrollExpense = fotGross + socialTax;

  const fixedPayrollGross = salaryType === 'net' ? fixedBaseSalary / (1 - ndflPct) : fixedBaseSalary;
  const fixedPayrollExpense = fixedPayrollGross * (1 + socialTaxPct);
  const varBonusExpenseRate =
    salaryType === 'net'
      ? (staffBonusPct / (1 - ndflPct)) * (1 + socialTaxPct)
      : staffBonusPct * (1 + socialTaxPct);

  /* =========================================================
     Часть 4: Расчетный движок (P&L, Опт, BEP, CF)
     ========================================================= */

  // 5. Прочий OPEX, EBITDA, Амортизация и Налоги бизнеса (РФ)
  const rentMonthly = Math.max(0, Number(data.rentMonthly) || 0);
  const logisticsMonthly = Math.max(0, Number(data.logisticsMonthly) || 0);
  const acquiringPct = Math.max(0, Number(data.acquiringPct) || 0) / 100;
  const acquiring = monthlyRevenue * acquiringPct;
  const otherOpexMonthly = Math.max(0, Number(data.otherOpexMonthly) || 0);

  const fixedOpex = fixedPayrollExpense + rentMonthly + logisticsMonthly + otherOpexMonthly;
  const opexTotal = totalPayrollExpense + rentMonthly + logisticsMonthly + acquiring + otherOpexMonthly;
  const opexShare = monthlyRevenue > 0 ? opexTotal / monthlyRevenue : 0;

  const ebitda = grossProfit - opexTotal;
  const opm = netRevenue > 0 ? ebitda / netRevenue : 0;

  const amortizationMonths = Math.max(1, Number(data.amortizationMonths) || 24);
  const amortization = capexTotal / amortizationMonths;

  const businessTaxPct = Math.max(0, Number(data.businessTaxPct) || 0) / 100;
  const isRevenueTax =
    regimeCfg && !regimeCfg.custom
      ? regimeCfg.base === 'revenue'
      : data.customTaxBase === 'revenue';

  const taxBaseLabel =
    regimeCfg && !regimeCfg.custom
      ? regimeCfg.label
      : isRevenueTax
      ? 'от выручки без НДС (custom)'
      : 'от прибыли (custom)';

  const ebt = ebitda - amortization;
  const businessTax = isRevenueTax
    ? netRevenue * businessTaxPct
    : Math.max(0, ebt) * businessTaxPct;

  const netProfit = ebt - businessTax;
  const npm = netRevenue > 0 ? netProfit / netRevenue : 0;
  const monthlyCashFlow = netProfit + amortization;

  // 6. Оптовый блок и управляющий офис
  const wholesaleRevenue = Math.max(0, Number(data.wholesaleRevenue) || 0);
  const wholesaleMarkupPct = (Number(data.wholesaleMarkupPct) || 0) / 100;
  const wholesaleOutputVat = vatPct > 0 ? wholesaleRevenue * (vatPct / (1 + vatPct)) : 0;
  const wholesaleNetRev = wholesaleRevenue - wholesaleOutputVat;
  const wholesaleCogs =
    wholesaleMarkupPct > -0.95 ? wholesaleNetRev / (1 + wholesaleMarkupPct) : wholesaleNetRev;
  const wholesaleGross = wholesaleNetRev - wholesaleCogs;
  const wholesaleTax = isRevenueTax
    ? wholesaleNetRev * businessTaxPct
    : Math.max(0, wholesaleGross) * businessTaxPct;
  const wholesaleNetProfit = wholesaleGross - wholesaleTax;

  const officeExpenses = Math.max(0, Number(data.officeExpenses) || 0);
  const targetStoresCount = Math.max(1, Number(data.targetStoresCount) || 1);

  const requiredRetailProfit = Math.max(0, officeExpenses - wholesaleNetProfit);
  let breakevenStores = 0;
  if (requiredRetailProfit === 0) {
    breakevenStores = 0;
  } else if (netProfit > 0) {
    breakevenStores = Math.ceil(requiredRetailProfit / netProfit);
  } else {
    breakevenStores = Infinity;
  }

  const totalNetworkProfit = netProfit * targetStoresCount + wholesaleNetProfit - officeExpenses;

  // 7. Точка безубыточности (BEP) и показатели эффективности
  const netRevRatio = monthlyRevenue > 0 ? netRevenue / monthlyRevenue : 1 / (1 + vatPct);
  const contribRateOnGross =
    gmr * netRevRatio -
    acquiringPct -
    varBonusExpenseRate -
    (isRevenueTax ? businessTaxPct * netRevRatio : 0);

  const bepRevenue =
    contribRateOnGross > 0 ? (fixedOpex + amortization) / contribRateOnGross : Infinity;
  const safetyMargin =
    monthlyRevenue > 0 && isFinite(bepRevenue)
      ? (monthlyRevenue - bepRevenue) / monthlyRevenue
      : 0;

  const revPerSqm = areaSales > 0 ? monthlyRevenue / areaSales : 0;
  const profitPerSqm = areaSales > 0 ? netProfit / areaSales : 0;
  const rentPerSqm = areaTotal > 0 ? rentMonthly / areaTotal : 0;
  const stockTurnover = cogs > 0 ? stockTotalRub / cogs : 0;

  // Единая формула окупаемости через денежный поток (Cash Flow = Чистая прибыль + Амортизация)
  const paybackIdeal = monthlyCashFlow > 0 ? totalInvestment / monthlyCashFlow : Infinity;

  // 8. Помесячный Cash Flow на 24 месяца (для таблицы и графика)
  const rampUpMonths = Number(data.rampUpMonths) || 0;
  const rampProfile = RAMP_PROFILES[rampUpMonths] || [];

  const cashflow12 = [];
  const cashflow24 = [];
  let cumulativeCf = -totalInvestment;
  let paybackReal = Infinity;

  for (let m = 1; m <= 60; m++) {
    const loadFactor = m <= rampProfile.length ? rampProfile[m - 1] : 1.0;
    const mGrossRev = monthlyRevenue * loadFactor;
    const mNetRev = netRevenue * loadFactor;
    const mVat = vatPayable * loadFactor;
    const mCogs = cogs * loadFactor;
    const mGrossProfit = mNetRev - mCogs;
    const mVarOpex = mGrossRev * (acquiringPct + varBonusExpenseRate);
    const mOpex = fixedOpex + mVarOpex;
    const mEbitda = mGrossProfit - mOpex;
    const mEbt = mEbitda - amortization;
    const mTax = isRevenueTax ? mNetRev * businessTaxPct : Math.max(0, mEbt) * businessTaxPct;
    const mNetProfit = mEbt - mTax;
    const mCashFlow = mNetProfit + amortization;

    const prevCum = cumulativeCf;
    cumulativeCf += mCashFlow;

    if (paybackReal === Infinity && cumulativeCf >= 0 && mCashFlow > 0) {
      const fraction = Math.abs(prevCum) / mCashFlow;
      paybackReal = m - 1 + fraction;
    }

    if (m <= 24) {
      const point = {
        month: m,
        loadPct: Math.round(loadFactor * 100),
        revenue: mGrossRev,
        vat: mVat,
        cogs: mCogs,
        opex: mOpex,
        tax: mTax,
        cf: mCashFlow,
        cumulative: cumulativeCf
      };
      cashflow24.push(point);
      if (m <= 12) cashflow12.push(point);
    }
  }

  return {
    buyRate,
    buyCurrencyCode: buyCurrInfo.code,
    buySymbol: buyCurrInfo.symbol,
    unitsHall,
    unitsWarehouse,
    unitsTotal,
    stockTotalBuyCurr,
    stockTotalRub,
    effectiveMarkup: effectiveMarkupSafe,
    avgRetailPrice,
    itSubtotal,
    capexTotal,
    capexPerSqm,
    totalInvestment,
    monthlyRevenue,
    vatPayable,
    vatModeLabel,
    netRevenue,
    cogs,
    grossProfit,
    gmr,
    fotNet,
    ndflAmount,
    fotGross,
    socialTax,
    acquiring,
    opexTotal,
    opexShare,
    ebitda,
    opm,
    amortization,
    businessTax,
    taxBaseLabel,
    netProfit,
    npm,
    wholesaleRevenue,
    wholesaleMarkupPct,
    wholesaleCogs,
    wholesaleNetProfit,
    officeExpenses,
    targetStoresCount,
    requiredRetailProfit,
    breakevenStores,
    totalNetworkProfit,
    bepRevenue,
    safetyMargin,
    revPerSqm,
    profitPerSqm,
    rentPerSqm,
    stockTurnover,
    paybackIdeal,
    paybackReal,
    cashflow12,
    cashflow24
  };
}

/* =========================================================
   Часть 5: Форматирование, синхронизация и renderAll
   ========================================================= */

function fmtRub(val) {
  if (!isFinite(val)) return '∞';
  return Math.round(val).toLocaleString('ru-RU') + ' ₽';
}

function fmtCurr(val, code) {
  if (!isFinite(val)) return '∞';
  return Math.round(val).toLocaleString('ru-RU') + ' ' + code;
}

function fmtShortMoney(val) {
  if (!isFinite(val)) return '0';
  const abs = Math.abs(val);
  const sign = val < 0 ? '−' : '';
  if (abs >= 1000000) return sign + (abs / 1000000).toFixed(1).replace('.', ',') + 'M';
  if (abs >= 1000) return sign + Math.round(abs / 1000) + 'K';
  return sign + Math.round(abs);
}

function fmtPct(ratio, digits) {
  const d = digits !== undefined ? digits : 1;
  if (!isFinite(ratio)) return '0,0 %';
  return (ratio * 100).toFixed(d).replace('.', ',') + ' %';
}

function fmtMonths(val) {
  if (!isFinite(val) || val < 0) return 'Не окупается';
  return val.toFixed(1).replace('.', ',') + ' мес.';
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = value;
  }
}

function syncInputsFromState() {
  const data = state.scenarios[state.activeScenario];

  const buySel = document.getElementById('buyCurrencySelect');
  if (buySel) buySel.value = state.buyCurrency;

  const taxSel = document.getElementById('taxRegimeSelect');
  if (taxSel) taxSel.value = state.taxRegime;

  const inpUsd = document.getElementById('rateUSD');
  const inpEur = document.getElementById('rateEUR');
  const inpCny = document.getElementById('rateCNY');
  if (inpUsd) inpUsd.value = state.rates.USD;
  if (inpEur) inpEur.value = state.rates.EUR;
  if (inpCny) inpCny.value = state.rates.CNY;

  document.querySelectorAll('.buy-curr-code').forEach(function (el) {
    el.textContent = state.buyCurrency;
  });

  document.querySelectorAll('[data-field]').forEach(function (el) {
    const key = el.getAttribute('data-field');
    if (data[key] !== undefined) {
      el.value = data[key];
    }
  });

  document.querySelectorAll('.tab-btn').forEach(function (btn) {
    const isActive = btn.dataset.scenario === state.activeScenario;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });

  // Custom-режим: показываем карточку базы налога только для custom
  const customCard = document.getElementById('customTaxBaseCard');
  if (customCard) {
    customCard.classList.toggle('hidden', state.taxRegime !== 'custom');
  }
}

function renderAll() {
  const resA = calculateScenario(state.scenarios.A, state.buyCurrency, state.taxRegime, state.rates);
  const resB = calculateScenario(state.scenarios.B, state.buyCurrency, state.taxRegime, state.rates);
  const res = state.activeScenario === 'A' ? resA : resB;

  // Верхние 4 KPI карточки
  const netProfitEl = document.getElementById('kpiNetProfit');
  if (netProfitEl) {
    netProfitEl.textContent = fmtRub(res.netProfit);
    netProfitEl.classList.toggle('negative', res.netProfit < 0);
  }

  const netProfitBuy = res.buyRate > 0 ? res.netProfit / res.buyRate : 0;
  setText('kpiNetProfitBuyCurr', fmtCurr(netProfitBuy, res.buyCurrencyCode) + ' / мес.');
  setText('kpiNpm', fmtPct(res.npm, 2));
  setText('kpiGmr', fmtPct(res.gmr, 1));
  setText('kpiTotalInvest', fmtRub(res.totalInvestment));
  setText('kpiPaybackReal', fmtMonths(res.paybackReal));

  setText('kpiStoresNeeded', isFinite(res.breakevenStores) ? res.breakevenStores + ' маг.' : 'Не окупается');
  setText('kpiStoresLabel', res.targetStoresCount);
  setText('kpiNetworkProfit', fmtRub(res.totalNetworkProfit));

  // Горизонтальная шкала структуры чистой выручки (совпадает с NPM)
  const revBase = Math.max(1, res.netRevenue);
  const cogsPct = Math.max(0, Math.min(100, (res.cogs / revBase) * 100));
  const opexAmortPct = Math.max(0, Math.min(100, ((res.opexTotal + res.amortization) / revBase) * 100));
  const taxAllPct = Math.max(0, Math.min(100, (res.businessTax / revBase) * 100));
  const profitPct = Math.max(0, Math.min(100, (res.netProfit / revBase) * 100));

  setText('legCogs', cogsPct.toFixed(1) + '%');
  setText('legOpex', opexAmortPct.toFixed(1) + '%');
  setText('legTax', taxAllPct.toFixed(1) + '%');
  setText('legProfit', profitPct.toFixed(1) + '%');

  const setBar = function (id, pct) {
    const el = document.getElementById(id);
    if (el) {
      el.style.width = pct + '%';
      el.textContent = pct >= 7 ? Math.round(pct) + '%' : '';
    }
  };
  setBar('barCogs', cogsPct);
  setBar('barOpex', opexAmortPct);
  setBar('barTax', taxAllPct);
  setBar('barProfit', profitPct);

  // Блок 1: Помещение и ценообразование
  setText(
    'outStockUnits',
    res.unitsHall.toLocaleString('ru-RU') +
      ' / ' +
      res.unitsWarehouse.toLocaleString('ru-RU') +
      ' (' +
      res.unitsTotal.toLocaleString('ru-RU') +
      ' шт.)'
  );
  setText('outEffectiveMarkup', fmtPct(res.effectiveMarkup, 1));
  setText('outAvgRetailPrice', fmtRub(res.avgRetailPrice));

  // Блок 2: CAPEX и Товарный запас
  setText('outItSubtotal', fmtRub(res.itSubtotal));
  setText('outCapexTotal', fmtRub(res.capexTotal));
  setText('outCapexPerSqm', fmtRub(res.capexPerSqm));
  setText('outStockBuyCurr', fmtCurr(res.stockTotalBuyCurr, res.buyCurrencyCode));
  setText('outStockTotal', fmtRub(res.stockTotalRub));
  setText('outTotalInvestment', fmtRub(res.totalInvestment));

  // Блок 3: P&L магазина
  setText('pnlRevenue', fmtRub(res.monthlyRevenue));
  setText('pnlVatModeLabel', res.vatModeLabel);
  setText('pnlVatPayable', fmtRub(res.vatPayable));
  setText('pnlNetRevenue', fmtRub(res.netRevenue));
  setText('pnlCogs', fmtRub(res.cogs));
  setText('pnlGrossProfit', fmtRub(res.grossProfit));
  setText('pnlGmr', fmtPct(res.gmr, 2));

  setText('pnlFotNet', fmtRub(res.fotNet));
  setText('pnlNdflAmount', fmtRub(res.ndflAmount));
  setText('pnlFotGross', fmtRub(res.fotGross));
  setText('pnlSocialTax', fmtRub(res.socialTax));
  setText('pnlAcquiring', fmtRub(res.acquiring));
  setText('pnlOpexShare', fmtPct(res.opexShare, 1));
  setText('pnlOpexTotal', fmtRub(res.opexTotal));

  setText('pnlEbitda', fmtRub(res.ebitda));
  setText('pnlOpm', fmtPct(res.opm, 2));
  setText('pnlAmortization', fmtRub(res.amortization));
  setText('pnlTaxBaseLabel', res.taxBaseLabel);
  setText('pnlBusinessTax', fmtRub(res.businessTax));
  setText('pnlNetProfit', fmtRub(res.netProfit));
  setText('pnlNpm', fmtPct(res.npm, 2));

  // Custom-режим: подпись базы налога
  setText(
    'customTaxBaseLabel',
    state.scenarios[state.activeScenario].customTaxBase === 'revenue'
      ? 'От выручки (без НДС)'
      : 'От прибыли'
  );

  // Блок 4: Опт и офис
  const warnEl = document.getElementById('wholesaleWarning');
  if (warnEl) {
    warnEl.classList.toggle('hidden', res.wholesaleMarkupPct >= 0);
  }

  setText('outWholesaleCogs', fmtRub(res.wholesaleCogs));
  setText('outWholesaleNetProfit', fmtRub(res.wholesaleNetProfit));
  setText('outRequiredRetailProfit', fmtRub(res.requiredRetailProfit));
  setText('outBreakevenStores', isFinite(res.breakevenStores) ? res.breakevenStores + ' шт.' : 'Не окупается');
  setText('outTotalNetworkProfit', fmtRub(res.totalNetworkProfit));

  // Блок 5: Эффективность, BEP и разгон
  setText('outBepRevenue', fmtRub(res.bepRevenue));
  setText('outSafetyMargin', fmtPct(res.safetyMargin, 1));
  setText('outRevPerSqm', fmtRub(res.revPerSqm));
  setText('outProfitPerSqm', fmtRub(res.profitPerSqm));
  setText('outRentPerSqm', fmtRub(res.rentPerSqm));
  setText('outStockTurnover', res.stockTurnover.toFixed(2).replace('.', ',') + ' мес.');
  setText('outPaybackIdeal', fmtMonths(res.paybackIdeal));
  setText('outPaybackReal', fmtMonths(res.paybackReal));

  // Нижние таблицы и график
  renderComparisonTable(resA, resB);
  renderPaybackChart(resA, resB);
  renderCashflowTable(res.cashflow12);
}

/* =========================================================
   Часть 6: График окупаемости, таблицы сравнения и CF
   ========================================================= */

function getChartColors() {
  const styles = getComputedStyle(document.documentElement);
  return {
    grid: styles.getPropertyValue('--chart-grid').trim() || '#e2e8f0',
    axis: styles.getPropertyValue('--chart-axis').trim() || '#94a3b8',
    label: styles.getPropertyValue('--chart-label').trim() || '#64748b',
    zeroLabel: styles.getPropertyValue('--chart-zero-label').trim() || '#475569',
    lineA: styles.getPropertyValue('--primary').trim() || '#2563eb',
    lineB: styles.getPropertyValue('--green-btn').trim() || '#16a34a'
  };
}

function renderPaybackChart(resA, resB) {
  const container = document.getElementById('paybackChartContainer');
  if (!container) return;

  setText('chartPaybackA', fmtMonths(resA.paybackReal));
  setText('chartPaybackB', fmtMonths(resB.paybackReal));

  const colors = getChartColors();

  const ptsA = [{ month: 0, cumulative: -resA.totalInvestment }].concat(resA.cashflow24);
  const ptsB = [{ month: 0, cumulative: -resB.totalInvestment }].concat(resB.cashflow24);

  const allVals = ptsA.map(function (p) { return p.cumulative; }).concat(
    ptsB.map(function (p) { return p.cumulative; }),
    [0]
  );

  let minVal = Math.min.apply(null, allVals);
  let maxVal = Math.max.apply(null, allVals);
  if (minVal === maxVal) {
    minVal -= 100000;
    maxVal += 100000;
  }
  const pad = (maxVal - minVal) * 0.1;
  minVal -= pad;
  maxVal += pad;

  const W = 860;
  const H = 270;
  const padL = 68;
  const padR = 20;
  const padT = 18;
  const padB = 32;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const getX = function (m) { return padL + (m / 24) * plotW; };
  const getY = function (val) { return padT + ((maxVal - val) / (maxVal - minVal)) * plotH; };
  const zeroY = getY(0);

  let gridSvg = '';
  for (let i = 0; i <= 4; i++) {
    const val = minVal + ((maxVal - minVal) * i) / 4;
    const y = getY(val);
    gridSvg +=
      '<line x1="' + padL + '" y1="' + y + '" x2="' + (W - padR) + '" y2="' + y +
      '" stroke="' + colors.grid + '" stroke-width="1" />';
    gridSvg +=
      '<text x="' + (padL - 8) + '" y="' + (y + 4) +
      '" text-anchor="end" font-size="10.5" fill="' + colors.label + '">' + fmtShortMoney(val) + '</text>';
  }

  let xLabelsSvg = '';
  for (let m = 0; m <= 24; m += 3) {
    const x = getX(m);
    xLabelsSvg +=
      '<line x1="' + x + '" y1="' + padT + '" x2="' + x + '" y2="' + (H - padB) +
      '" stroke="' + colors.grid + '" stroke-width="1" opacity="0.5" />';
    xLabelsSvg +=
      '<text x="' + x + '" y="' + (H - 10) +
      '" text-anchor="middle" font-size="10.5" fill="' + colors.label + '">' + m + ' мес.</text>';
  }

  const pathA = ptsA
    .map(function (p, idx) {
      return (idx === 0 ? 'M ' : 'L ') + getX(p.month).toFixed(1) + ' ' + getY(p.cumulative).toFixed(1);
    })
    .join(' ');

  const pathB = ptsB
    .map(function (p, idx) {
      return (idx === 0 ? 'M ' : 'L ') + getX(p.month).toFixed(1) + ' ' + getY(p.cumulative).toFixed(1);
    })
    .join(' ');

  const circlesA = ptsA
    .filter(function (p) { return p.month % 3 === 0; })
    .map(function (p) {
      return '<circle cx="' + getX(p.month).toFixed(1) + '" cy="' + getY(p.cumulative).toFixed(1) +
        '" r="3.5" fill="' + colors.lineA + '" />';
    })
    .join('');

  const circlesB = ptsB
    .filter(function (p) { return p.month % 3 === 0; })
    .map(function (p) {
      return '<circle cx="' + getX(p.month).toFixed(1) + '" cy="' + getY(p.cumulative).toFixed(1) +
        '" r="3.5" fill="' + colors.lineB + '" />';
    })
    .join('');

  container.innerHTML =
    '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet" role="img" aria-label="График окупаемости">' +
      gridSvg +
      xLabelsSvg +
      '<line x1="' + padL + '" y1="' + zeroY + '" x2="' + (W - padR) + '" y2="' + zeroY +
        '" stroke="' + colors.axis + '" stroke-width="1.5" stroke-dasharray="5,4" />' +
      '<text x="' + (W - padR - 4) + '" y="' + (zeroY - 5) +
        '" text-anchor="end" font-size="10.5" font-weight="600" fill="' + colors.zeroLabel +
        '">Точка окупаемости (0)</text>' +
      '<path d="' + pathA + '" fill="none" stroke="' + colors.lineA +
        '" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" />' +
      '<path d="' + pathB + '" fill="none" stroke="' + colors.lineB +
        '" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" />' +
      circlesA +
      circlesB +
    '</svg>';
}

function renderComparisonTable(a, b) {
  const tbody = document.getElementById('comparisonTableBody');
  if (!tbody) return;

  const rows = [
    { label: 'Выручка с чеков (Gross Revenue)', va: a.monthlyRevenue, vb: b.monthlyRevenue, type: 'money' },
    { label: 'НДС к уплате', va: a.vatPayable, vb: b.vatPayable, type: 'money', invert: true },
    { label: 'Валовая прибыль (Gross Margin)', va: a.grossProfit, vb: b.grossProfit, type: 'money' },
    { label: 'Операционные расходы (OPEX с ФОТ)', va: a.opexTotal, vb: b.opexTotal, type: 'money', invert: true },
    { label: 'EBITDA магазина', va: a.ebitda, vb: b.ebitda, type: 'money' },
    { label: 'Чистая прибыль магазина / мес.', va: a.netProfit, vb: b.netProfit, type: 'money', accent: true },
    { label: 'Чистая рентабельность (NPM)', va: a.npm, vb: b.npm, type: 'pct' },
    { label: 'Общие инвестиции (CAPEX + ТЗ)', va: a.totalInvestment, vb: b.totalInvestment, type: 'money', invert: true },
    { label: 'Реальная окупаемость (с разгоном)', va: a.paybackReal, vb: b.paybackReal, type: 'months', invert: true },
    { label: 'Точка безубыточности магазина (BEP)', va: a.bepRevenue, vb: b.bepRevenue, type: 'money', invert: true },
    { label: 'Чистая прибыль всей сети / мес.', va: a.totalNetworkProfit, vb: b.totalNetworkProfit, type: 'money', accent: true }
  ];

  tbody.innerHTML = rows
    .map(function (r) {
      const diff = r.vb - r.va;
      let fmtA, fmtB, fmtDiff;

      if (r.type === 'money') {
        fmtA = fmtRub(r.va);
        fmtB = fmtRub(r.vb);
        fmtDiff = isFinite(diff) ? (diff > 0 ? '+' : '') + fmtRub(diff) : '—';
      } else if (r.type === 'pct') {
        fmtA = fmtPct(r.va, 2);
        fmtB = fmtPct(r.vb, 2);
        fmtDiff = (diff > 0 ? '+' : '') + (diff * 100).toFixed(2).replace('.', ',') + ' п.п.';
      } else {
        fmtA = fmtMonths(r.va);
        fmtB = fmtMonths(r.vb);
        fmtDiff = isFinite(diff) ? (diff > 0 ? '+' : '') + diff.toFixed(1).replace('.', ',') + ' мес.' : '—';
      }

      const isGood = r.invert ? diff < 0 : diff > 0;
      const cls = !isFinite(diff) || Math.abs(diff) < 0.0001 ? '' : isGood ? 'val-pos' : 'val-neg';

      return (
        '<tr class="' + (r.accent ? 'row-accent' : '') + '">' +
          '<td>' + r.label + '</td>' +
          '<td>' + fmtA + '</td>' +
          '<td>' + fmtB + '</td>' +
          '<td class="' + cls + '">' + fmtDiff + '</td>' +
        '</tr>'
      );
    })
    .join('');
}

function renderCashflowTable(cfList) {
  const tbody = document.getElementById('cashflowTableBody');
  if (!tbody) return;

  tbody.innerHTML = cfList
    .map(function (item) {
      const cumCls = item.cumulative >= 0 ? 'val-pos' : 'val-neg';
      return (
        '<tr>' +
          '<td>Месяц ' + item.month + '</td>' +
          '<td>' + item.loadPct + ' %</td>' +
          '<td>' + fmtRub(item.revenue) + '</td>' +
          '<td>' + fmtRub(item.vat) + '</td>' +
          '<td>' + fmtRub(item.cogs) + '</td>' +
          '<td>' + fmtRub(item.opex) + '</td>' +
          '<td>' + fmtRub(item.tax) + '</td>' +
          '<td>' + fmtRub(item.cf) + '</td>' +
          '<td class="' + cumCls + '">' + fmtRub(item.cumulative) + '</td>' +
        '</tr>'
      );
    })
    .join('');
}

/* =========================================================
   Часть 7: Экспорт в Excel (XLSX через SheetJS) + CSV fallback,
            события и запуск
   ========================================================= */

// --- Fallback: CSV, если SheetJS не загрузился ---
function exportToCsvFallback(res, regimeName) {
  function esc(v) {
    const s = String(v === null || v === undefined ? '' : v);
    if (/[";\r\n]/.test(s)) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  const rows = [
    ['Показатель', 'Значение'],
    ['Налоговый режим (РФ)', regimeName],
    ['Валюта закупки товара', res.buyCurrencyCode + ' (курс: ' + res.buyRate + ' руб.)'],
    ['Сценарий', 'План ' + state.activeScenario],
    ['Выручка с чеков (руб.)', Math.round(res.monthlyRevenue)],
    ['НДС к уплате (руб.)', Math.round(res.vatPayable)],
    ['Выручка без НДС (руб.)', Math.round(res.netRevenue)],
    ['Себестоимость COGS (руб.)', Math.round(res.cogs)],
    ['Валовая прибыль (руб.)', Math.round(res.grossProfit)],
    ['Выплата ФОТ на руки (руб.)', Math.round(res.fotNet)],
    ['НДФЛ (руб.)', Math.round(res.ndflAmount)],
    ['Страховые взносы СФР (руб.)', Math.round(res.socialTax)],
    ['OPEX итого (руб.)', Math.round(res.opexTotal)],
    ['EBITDA (руб.)', Math.round(res.ebitda)],
    ['Амортизация (руб.)', Math.round(res.amortization)],
    ['Налог бизнеса (руб.)', Math.round(res.businessTax)],
    ['Чистая прибыль магазина (руб.)', Math.round(res.netProfit)],
    ['CAPEX без товара (руб.)', Math.round(res.capexTotal)],
    ['Товарный запас (' + res.buyCurrencyCode + ')', Math.round(res.stockTotalBuyCurr)],
    ['Товарный запас (руб.)', Math.round(res.stockTotalRub)],
    ['Общие инвестиции (руб.)', Math.round(res.totalInvestment)],
    ['Реальная окупаемость (мес.)', isFinite(res.paybackReal) ? res.paybackReal.toFixed(1) : 'Нет'],
    ['Точка безубыточности BEP (руб.)', isFinite(res.bepRevenue) ? Math.round(res.bepRevenue) : 'Нет'],
    ['Прибыль опта (руб.)', Math.round(res.wholesaleNetProfit)],
    ['Расходы офиса (руб.)', Math.round(res.officeExpenses)],
    ['Магазинов для безубыточности сети', isFinite(res.breakevenStores) ? res.breakevenStores : 'Нет'],
    ['Чистая прибыль всей сети (руб.)', Math.round(res.totalNetworkProfit)]
  ];

  const csvContent = '\uFEFF' + rows.map(function (r) { return r.map(esc).join(';'); }).join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'finmodel_ru_plan_' + state.activeScenario + '.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

// --- Excel (XLSX) через SheetJS ---
function exportToExcel() {
  const resA = calculateScenario(state.scenarios.A, state.buyCurrency, state.taxRegime, state.rates);
  const resB = calculateScenario(state.scenarios.B, state.buyCurrency, state.taxRegime, state.rates);
  const res = state.activeScenario === 'A' ? resA : resB;
  const regimeName = (TAX_REGIMES_RU[state.taxRegime] || TAX_REGIMES_RU.usn6).name;

  const today = new Date();
  const dateStr = today.toLocaleDateString('ru-RU');

  // Если SheetJS не загрузился — fallback CSV
  if (typeof XLSX === 'undefined') {
    console.warn('SheetJS не загружен — экспорт в CSV.');
    exportToCsvFallback(res, regimeName);
    return;
  }

  const wb = XLSX.utils.book_new();

  // ---------- Лист 1: Сводка ----------
  const summaryRows = [
    ['Финансовая модель розничной сети (РФ)'],
    ['Дата формирования', dateStr],
    ['Сценарий', 'План ' + state.activeScenario],
    ['Налоговый режим', regimeName],
    ['Валюта закупки', res.buyCurrencyCode + ' (курс: ' + res.buyRate + ' ₽)'],
    [],
    ['Ключевой показатель', 'Значение'],
    ['Выручка с чеков, ₽/мес.', Math.round(res.monthlyRevenue)],
    ['Чистая прибыль магазина, ₽/мес.', Math.round(res.netProfit)],
    ['Чистая рентабельность (NPM), %', +(res.npm * 100).toFixed(2)],
    ['Валовая маржа (GMR), %', +(res.gmr * 100).toFixed(2)],
    ['EBITDA, ₽/мес.', Math.round(res.ebitda)],
    ['Рентабельность по EBITDA (OPM), %', +(res.opm * 100).toFixed(2)],
    ['Общие инвестиции (CAPEX + ТЗ), ₽', Math.round(res.totalInvestment)],
    ['CAPEX без товара, ₽', Math.round(res.capexTotal)],
    ['Товарный запас, ₽', Math.round(res.stockTotalRub)],
    ['Окупаемость без разгона, мес.', isFinite(res.paybackIdeal) ? +res.paybackIdeal.toFixed(1) : 'Не окупается'],
    ['Реальная окупаемость (с разгоном), мес.', isFinite(res.paybackReal) ? +res.paybackReal.toFixed(1) : 'Не окупается'],
    ['Точка безубыточности (BEP), ₽/мес.', isFinite(res.bepRevenue) ? Math.round(res.bepRevenue) : 'Нет'],
    ['Запас финансовой прочности, %', +(res.safetyMargin * 100).toFixed(1)],
    [],
    ['Сеть и офис', ''],
    ['Магазинов для окупаемости офиса', isFinite(res.breakevenStores) ? res.breakevenStores : 'Не окупается'],
    ['Целевое кол-во магазинов', res.targetStoresCount],
    ['Чистая прибыль опта, ₽/мес.', Math.round(res.wholesaleNetProfit)],
    ['Расходы офиса, ₽/мес.', Math.round(res.officeExpenses)],
    ['Чистая прибыль всей сети, ₽/мес.', Math.round(res.totalNetworkProfit)]
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);

  // Форматирование числовых ячеек
  wsSummary['!cols'] = [{ wch: 46 }, { wch: 20 }];
  applyNumberFormat(wsSummary, 'B8:B16', '#,##0');
  applyNumberFormat(wsSummary, 'B10:B11', '0.00');
  applyNumberFormat(wsSummary, 'B13', '0.00');
  applyNumberFormat(wsSummary, 'B20', '0.0');
  applyNumberFormat(wsSummary, 'B25:B28', '#,##0');

  XLSX.utils.book_append_sheet(wb, wsSummary, 'Сводка');

  // ---------- Лист 2: P&L магазина ----------
  const pnlRows = [
    ['Отчёт о прибылях и убытках магазина (P&L), ₽/мес.'],
    ['Сценарий', 'План ' + state.activeScenario],
    ['Налоговый режим', regimeName],
    [],
    ['Показатель', 'Значение'],
    ['Выручка с чеков (Gross Revenue)', Math.round(res.monthlyRevenue)],
    ['НДС к уплате', Math.round(res.vatPayable)],
    ['Выручка без НДС (Net Revenue)', Math.round(res.netRevenue)],
    ['Себестоимость (COGS)', Math.round(res.cogs)],
    ['Валовая прибыль (Gross Margin)', Math.round(res.grossProfit)],
    ['Валовая рентабельность (GMR), %', +(res.gmr * 100).toFixed(2)],
    [],
    ['ФОТ на руки (Net)', Math.round(res.fotNet)],
    ['НДФЛ начисленный', Math.round(res.ndflAmount)],
    ['ФОТ начисленный (Gross)', Math.round(res.fotGross)],
    ['Страховые взносы СФР', Math.round(res.socialTax)],
    [],
    ['Аренда', Math.round(Number(state.scenarios[state.activeScenario].rentMonthly) || 0)],
    ['Логистика', Math.round(Number(state.scenarios[state.activeScenario].logisticsMonthly) || 0)],
    ['Эквайринг', Math.round(res.acquiring)],
    ['Прочие операционные расходы', Math.round(Number(state.scenarios[state.activeScenario].otherOpexMonthly) || 0)],
    ['ИТОГО OPEX', Math.round(res.opexTotal)],
    ['Доля OPEX в выручке, %', +(res.opexShare * 100).toFixed(1)],
    [],
    ['Операционная прибыль (EBITDA)', Math.round(res.ebitda)],
    ['Рентабельность по EBITDA (OPM), %', +(res.opm * 100).toFixed(2)],
    ['Амортизация', Math.round(res.amortization)],
    ['Налог бизнеса (' + res.taxBaseLabel + ')', Math.round(res.businessTax)],
    ['ЧИСТАЯ ПРИБЫЛЬ', Math.round(res.netProfit)],
    ['Чистая рентабельность (NPM), %', +(res.npm * 100).toFixed(2)]
  ];
  const wsPnl = XLSX.utils.aoa_to_sheet(pnlRows);
  wsPnl['!cols'] = [{ wch: 46 }, { wch: 20 }];
  applyNumberFormat(wsPnl, 'B6:B10', '#,##0');
  applyNumberFormat(wsPnl, 'B11', '0.00');
  applyNumberFormat(wsPnl, 'B13:B16', '#,##0');
  applyNumberFormat(wsPnl, 'B18:B22', '#,##0');
  applyNumberFormat(wsPnl, 'B23', '0.0');
  applyNumberFormat(wsPnl, 'B25:B28', '#,##0');
  applyNumberFormat(wsPnl, 'B26', '0.00');
  applyNumberFormat(wsPnl, 'B29', '#,##0');
  applyNumberFormat(wsPnl, 'B30', '0.00');

  XLSX.utils.book_append_sheet(wb, wsPnl, 'P&L магазина');

  // ---------- Лист 3: CAPEX и ТЗ ----------
  const d = state.scenarios[state.activeScenario];
  const capexRows = [
    ['Инвестиции (CAPEX) и товарный запас'],
    ['Сценарий', 'План ' + state.activeScenario],
    ['Валюта закупки', res.buyCurrencyCode + ' (курс: ' + res.buyRate + ' ₽)'],
    [],
    ['Статья CAPEX', 'Сумма, ₽'],
    ['СМР + пожарная безопасность', Math.round(Number(d.capexSmr) || 0)],
    ['Освещение', Math.round(Number(d.capexLight) || 0)],
    ['Вывеска', Math.round(Number(d.capexSign) || 0)],
    ['Торговое оборудование', Math.round(Number(d.capexFurniture) || 0)],
    ['Манекены', Math.round(Number(d.capexMannequins) || 0)],
    ['Антикражное оборудование + биперы', Math.round(Number(d.capexAntitheft) || 0)],
    ['Вешалки + расходники', Math.round(Number(d.capexHangers) || 0)],
    ['Прочие (ВИК, электропроект)', Math.round(Number(d.capexOther) || 0)],
    ['ИТ-оборудование (итого)', Math.round(res.itSubtotal)],
    ['  в т.ч. компьютер / моноблок', Math.round(Number(d.itPc) || 0)],
    ['  в т.ч. фискальный регистратор', Math.round(Number(d.itFr) || 0)],
    ['  в т.ч. сканер штрихкодов', Math.round(Number(d.itScanner) || 0)],
    ['  в т.ч. принтер этикеток', Math.round(Number(d.itPrinter) || 0)],
    ['  в т.ч. МФУ', Math.round(Number(d.itMfu) || 0)],
    ['  в т.ч. ПО и лицензии', Math.round(Number(d.itSoft) || 0)],
    ['  в т.ч. ИТ-расходники', Math.round(Number(d.itConsumables) || 0)],
    ['Компенсация от ТЦ / бренда', -Math.round(Number(d.capexCompensation) || 0)],
    ['ИТОГО CAPEX (без товара)', Math.round(res.capexTotal)],
    ['CAPEX на 1 м² общей площади', Math.round(res.capexPerSqm)],
    [],
    ['Товарный запас', ''],
    ['Площадь зала, м²', Number(d.areaSales) || 0],
    ['Плотность выкладки, шт./м²', Number(d.unitsPerSqm) || 0],
    ['Запас склада, %', Number(d.stockWarehousePct) || 0],
    ['Единиц в зале, шт.', res.unitsHall],
    ['Единиц на складе, шт.', res.unitsWarehouse],
    ['Всего единиц, шт.', res.unitsTotal],
    ['Средняя закупочная цена, ' + res.buyCurrencyCode, Number(d.unitCostBuy) || 0],
    ['Товарный запас, ' + res.buyCurrencyCode, Math.round(res.stockTotalBuyCurr)],
    ['Товарный запас, ₽', Math.round(res.stockTotalRub)],
    [],
    ['ИТОГО ОБЩИЕ ИНВЕСТИЦИИ, ₽', Math.round(res.totalInvestment)]
  ];
  const wsCapex = XLSX.utils.aoa_to_sheet(capexRows);
  wsCapex['!cols'] = [{ wch: 46 }, { wch: 20 }];
  applyNumberFormat(wsCapex, 'B6:B15', '#,##0');
  applyNumberFormat(wsCapex, 'B16:B22', '#,##0');
  applyNumberFormat(wsCapex, 'B23', '#,##0');
  applyNumberFormat(wsCapex, 'B24', '#,##0');
  applyNumberFormat(wsCapex, 'B27:B33', '#,##0');
  applyNumberFormat(wsCapex, 'B34', '#,##0.00');
  applyNumberFormat(wsCapex, 'B35', '#,##0');
  applyNumberFormat(wsCapex, 'B36', '#,##0');
  applyNumberFormat(wsCapex, 'B38', '#,##0');

  XLSX.utils.book_append_sheet(wb, wsCapex, 'CAPEX и ТЗ');

  // ---------- Лист 4: Сравнение А vs Б ----------
  const cmpRows = [
    ['Сравнение сценариев: План А vs План Б'],
    ['Показатель', 'План А', 'План Б', 'Разница (Б − А)'],
    ['Выручка с чеков, ₽/мес.', Math.round(resA.monthlyRevenue), Math.round(resB.monthlyRevenue), Math.round(resB.monthlyRevenue - resA.monthlyRevenue)],
    ['НДС к уплате, ₽/мес.', Math.round(resA.vatPayable), Math.round(resB.vatPayable), Math.round(resB.vatPayable - resA.vatPayable)],
    ['Валовая прибыль, ₽/мес.', Math.round(resA.grossProfit), Math.round(resB.grossProfit), Math.round(resB.grossProfit - resA.grossProfit)],
    ['OPEX итого, ₽/мес.', Math.round(resA.opexTotal), Math.round(resB.opexTotal), Math.round(resB.opexTotal - resA.opexTotal)],
    ['EBITDA, ₽/мес.', Math.round(resA.ebitda), Math.round(resB.ebitda), Math.round(resB.ebitda - resA.ebitda)],
    ['Чистая прибыль магазина, ₽/мес.', Math.round(resA.netProfit), Math.round(resB.netProfit), Math.round(resB.netProfit - resA.netProfit)],
    ['NPM, %', +(resA.npm * 100).toFixed(2), +(resB.npm * 100).toFixed(2), +((resB.npm - resA.npm) * 100).toFixed(2)],
    ['GMR, %', +(resA.gmr * 100).toFixed(2), +(resB.gmr * 100).toFixed(2), +((resB.gmr - resA.gmr) * 100).toFixed(2)],
    ['Общие инвестиции, ₽', Math.round(resA.totalInvestment), Math.round(resB.totalInvestment), Math.round(resB.totalInvestment - resA.totalInvestment)],
    ['Реальная окупаемость, мес.', isFinite(resA.paybackReal) ? +resA.paybackReal.toFixed(1) : 'Нет', isFinite(resB.paybackReal) ? +resB.paybackReal.toFixed(1) : 'Нет', isFinite(resA.paybackReal) && isFinite(resB.paybackReal) ? +(resB.paybackReal - resA.paybackReal).toFixed(1) : '—'],
    ['BEP, ₽/мес.', isFinite(resA.bepRevenue) ? Math.round(resA.bepRevenue) : 'Нет', isFinite(resB.bepRevenue) ? Math.round(resB.bepRevenue) : 'Нет', isFinite(resA.bepRevenue) && isFinite(resB.bepRevenue) ? Math.round(resB.bepRevenue - resA.bepRevenue) : '—'],
    ['Чистая прибыль сети, ₽/мес.', Math.round(resA.totalNetworkProfit), Math.round(resB.totalNetworkProfit), Math.round(resB.totalNetworkProfit - resA.totalNetworkProfit)]
  ];
  const wsCmp = XLSX.utils.aoa_to_sheet(cmpRows);
  wsCmp['!cols'] = [{ wch: 40 }, { wch: 16 }, { wch: 16 }, { wch: 18 }];
  applyNumberFormat(wsCmp, 'B3:D9', '#,##0');
  applyNumberFormat(wsCmp, 'B10:D11', '0.00');
  applyNumberFormat(wsCmp, 'B12:D12', '#,##0');
  applyNumberFormat(wsCmp, 'B13:D14', '#,##0');
  applyNumberFormat(wsCmp, 'B15:D15', '#,##0');
  // Подсветка разницы: зелёный / красный (упрощённо — через условное форматирование не будем, только заливка)
  XLSX.utils.book_append_sheet(wb, wsCmp, 'Сравнение А vs Б');

  // ---------- Лист 5: Cash Flow 24 мес. ----------
  const cfHeader = [
    'Месяц',
    'Загрузка, %',
    'Выручка с чеков, ₽',
    'НДС, ₽',
    'Себестоимость, ₽',
    'OPEX, ₽',
    'Налог бизнеса, ₽',
    'Денежный поток (CF), ₽',
    'Накопленный CF, ₽'
  ];
  const cfRows = [['Помесячный Cash Flow (24 месяца), План ' + state.activeScenario], [], cfHeader];
  res.cashflow24.forEach(function (p) {
    cfRows.push([
      p.month,
      p.loadPct,
      Math.round(p.revenue),
      Math.round(p.vat),
      Math.round(p.cogs),
      Math.round(p.opex),
      Math.round(p.tax),
      Math.round(p.cf),
      Math.round(p.cumulative)
    ]);
  });
  const wsCf = XLSX.utils.aoa_to_sheet(cfRows);
  wsCf['!cols'] = [
    { wch: 10 }, { wch: 12 }, { wch: 16 }, { wch: 12 }, { wch: 16 },
    { wch: 14 }, { wch: 16 }, { wch: 18 }, { wch: 18 }
  ];
  applyNumberFormat(wsCf, 'C4:I27', '#,##0');
  applyNumberFormat(wsCf, 'B4:B27', '0');

  XLSX.utils.book_append_sheet(wb, wsCf, 'Cash Flow 24 мес.');

  // ---------- Сохранение ----------
  const fileName = 'finmodel_ru_' + state.activeScenario + '_' + today.toISOString().slice(0, 10) + '.xlsx';
  XLSX.writeFile(wb, fileName);
}

// Утилита: применить числовой формат к диапазону (например, 'B8:B16')
function applyNumberFormat(ws, range, fmt) {
  if (!ws || !range) return;
  const parts = range.split(':');
  const start = parts[0];
  const end = parts[1] || start;

  const startCell = XLSX.utils.decode_cell(start);
  const endCell = XLSX.utils.decode_cell(end);

  for (let r = startCell.r; r <= endCell.r; r++) {
    for (let c = startCell.c; c <= endCell.c; c++) {
      const addr = XLSX.utils.encode_cell({ r: r, c: c });
      if (ws[addr] && ws[addr].t === 'n') {
        ws[addr].z = fmt;
      }
    }
  }
}

function bindEvents() {
  // Реактивный ввод в любые поля (input и select) активного сценария
  document.querySelectorAll('[data-field]').forEach(function (el) {
    const eventName = el.tagName === 'SELECT' ? 'change' : 'input';
    el.addEventListener(eventName, function () {
      const key = el.getAttribute('data-field');
      if (el.type === 'number') {
        const v = Number(el.value);
        state.scenarios[state.activeScenario][key] = isFinite(v) ? v : 0;
      } else {
        state.scenarios[state.activeScenario][key] = el.value;
      }
      saveState();
      renderAll();
    });
  });

  // Переключение вкладок План А / План Б
  document.querySelectorAll('.tab-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      state.activeScenario = btn.dataset.scenario;
      syncInputsFromState();
      saveState();
      renderAll();
    });
  });

  // Копировать А -> Б
  const copyBtn = document.getElementById('copyScenarioBtn');
  if (copyBtn) {
    copyBtn.addEventListener('click', function () {
      state.scenarios.B = Object.assign({}, state.scenarios.A);
      state.activeScenario = 'B';
      syncInputsFromState();
      saveState();
      renderAll();
    });
  }

  // Смена валюты закупки товара (USD / EUR / CNY) с пропорциональным пересчетом закупочной цены
  const buyCurrSel = document.getElementById('buyCurrencySelect');
  if (buyCurrSel) {
    buyCurrSel.addEventListener('change', function (e) {
      const oldCurr = state.buyCurrency;
      const newCurr = e.target.value;
      const oldRate = Number(state.rates[oldCurr]) || 1;
      const newRate = Number(state.rates[newCurr]) || 1;
      const ratio = oldRate / newRate;

      ['A', 'B'].forEach(function (sc) {
        const oldCost = Number(state.scenarios[sc].unitCostBuy) || 0;
        state.scenarios[sc].unitCostBuy = Number((oldCost * ratio).toFixed(2));
      });

      state.buyCurrency = newCurr;
      syncInputsFromState();
      saveState();
      renderAll();
    });
  }

  // Смена налогового режима РФ
  const taxSel = document.getElementById('taxRegimeSelect');
  if (taxSel) {
    taxSel.addEventListener('change', function (e) {
      state.taxRegime = e.target.value;
      const cfg = TAX_REGIMES_RU[state.taxRegime];
      if (cfg && !cfg.custom) {
        ['A', 'B'].forEach(function (sc) {
          state.scenarios[sc].businessTaxPct = cfg.businessTaxPct;
          state.scenarios[sc].vatPct = cfg.vatPct;
        });
      }
      syncInputsFromState();
      saveState();
      renderAll();
    });
  }

  // Ручное редактирование курсов USD, EUR, CNY
  ['USD', 'EUR', 'CNY'].forEach(function (curr) {
    const inp = document.getElementById('rate' + curr);
    if (inp) {
      inp.addEventListener('input', function (e) {
        const val = Number(e.target.value);
        if (isFinite(val) && val > 0) {
          state.rates[curr] = val;
          state.ratesSource = 'manual';
          const statusEl = document.getElementById('ratesStatus');
          if (statusEl) {
            statusEl.textContent = 'Вручную';
            statusEl.classList.remove('ok');
          }
          saveState();
          renderAll();
        }
      });
    }
  });

  // Кнопка загрузки курсов ЦБ РФ
  const fetchBtn = document.getElementById('fetchRatesBtn');
  if (fetchBtn) {
    fetchBtn.addEventListener('click', fetchCbrRates);
  }

  // Кнопка «Демо-данные»
  const demoBtn = document.getElementById('loadDemoBtn');
  if (demoBtn) {
    demoBtn.addEventListener('click', function () {
      initDefaultScenarios();
      syncInputsFromState();
      saveState();
      renderAll();
    });
  }

  // Кнопка «Очистить»
  const resetBtn = document.getElementById('resetBtn');
  if (resetBtn) {
    resetBtn.addEventListener('click', function () {
      const base = getBaseDemoScenario();
      const empty = {};
      Object.keys(base).forEach(function (k) {
        if (k === 'salaryType') empty[k] = 'net';
        else if (k === 'amortizationMonths') empty[k] = 24;
        else if (k === 'targetStoresCount') empty[k] = 1;
        else if (k === 'customTaxBase') empty[k] = 'profit';
        else empty[k] = 0;
      });
      state.scenarios[state.activeScenario] = empty;
      syncInputsFromState();
      saveState();
      renderAll();
    });
  }

  // Экспорт в Excel и Печать
  const exportBtn = document.getElementById('exportExcelBtn');
  if (exportBtn) exportBtn.addEventListener('click', exportToExcel);

  const printBtn = document.getElementById('printBtn');
  if (printBtn) printBtn.addEventListener('click', function () { window.print(); });

  // Нижние подвкладки (Сравнение / График окупаемости / Cash Flow)
  document.querySelectorAll('.subtab-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.subtab-btn').forEach(function (b) {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      document.querySelectorAll('.subtab-content').forEach(function (c) { c.classList.remove('active'); });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      const target = document.getElementById('subtab-' + btn.dataset.subtab);
      if (target) target.classList.add('active');
    });
  });

  // Перерисовка графика при смене темы (цвета берутся из CSS-переменных)
  const themeBtn = document.getElementById('themeToggleBtn');
  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      // Даём браузеру применить тему, затем перерисовываем график
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          renderAll();
        });
      });
    });
  }
}

// Запуск приложения
document.addEventListener('DOMContentLoaded', function () {
  initTheme();

  const restored = loadState();
  if (!restored) {
    initDefaultScenarios();
  }

  // Восстанавливаем статус курсов
  const statusEl = document.getElementById('ratesStatus');
  if (statusEl) {
    if (state.ratesSource === 'manual') {
      statusEl.textContent = 'Вручную';
      statusEl.classList.remove('ok');
    } else if (state.ratesSource === 'cbr') {
      statusEl.textContent = 'ЦБ РФ (сохранён)';
      statusEl.classList.add('ok');
    } else {
      statusEl.textContent = 'Базовые';
      statusEl.classList.remove('ok');
    }
  }

  syncInputsFromState();
  bindEvents();
  renderAll();

  // Автозагрузка курсов ЦБ только если пользователь не вводил вручную
  if (state.ratesSource !== 'manual') {
    fetchCbrRates();
  }
});