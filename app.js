/* =========================================================
   ЧАСТЬ 1 ИЗ 7 (app.js): Справочники РФ, валюты закупки и state
   ========================================================= */

const STORAGE_KEY = 'retail_finmodel_ru_v1';

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
/* КОНЕЦ ЧАСТИ 1 ИЗ 7 (app.js) */
/* =========================================================
   ЧАСТЬ 2 ИЗ 7 (app.js): Сценарии, хранилище и курсы ЦБ РФ
   ========================================================= */

function initDefaultScenarios() {
  state.buyCurrency = 'USD';
  state.taxRegime = 'usn6';
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
      state.activeScenario = parsed.activeScenario || 'A';
      state.buyCurrency = parsed.buyCurrency || 'USD';
      state.taxRegime = parsed.taxRegime || 'usn6';
      state.rates = Object.assign({}, state.rates, parsed.rates || {});
      state.scenarios = parsed.scenarios;
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

  try {
    const cbrUrl = 'https://' + 'www.cbr-xml-daily.ru' + '/daily_json.js';
    const response = await fetch(cbrUrl);
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
    if (statusEl) {
      statusEl.textContent = 'Офлайн (базовые)';
      statusEl.classList.remove('ok');
    }
  }
}
/* КОНЕЦ ЧАСТИ 2 ИЗ 7 (app.js) */
/* =========================================================
   ЧАСТЬ 3 ИЗ 7 (app.js): Расчетный движок (ТЗ, CAPEX, НДС, ФОТ)
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
/* КОНЕЦ ЧАСТИ 3 ИЗ 7 (app.js) */
/* =========================================================
   ЧАСТЬ 4 ИЗ 7 (app.js): Расчетный движок (P&L, Опт, BEP, CF)
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
      : taxRegimeId.indexOf('usn6') === 0;

  const taxBaseLabel =
    regimeCfg && !regimeCfg.custom
      ? regimeCfg.label
      : isRevenueTax
      ? 'от выручки без НДС'
      : 'от прибыли';

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
/* КОНЕЦ ЧАСТИ 4 ИЗ 7 (app.js) */
/* =========================================================
   ЧАСТЬ 5 ИЗ 7 (app.js): Форматирование, синхронизация и renderAll
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
    btn.classList.toggle('active', btn.dataset.scenario === state.activeScenario);
  });
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

  // Горизонтальная шкала структуры выручки
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
/* КОНЕЦ ЧАСТИ 5 ИЗ 7 (app.js) */
/* =========================================================
   ЧАСТЬ 6 ИЗ 7 (app.js): График окупаемости, таблицы сравнения и CF
   ========================================================= */

function renderPaybackChart(resA, resB) {
  const container = document.getElementById('paybackChartContainer');
  if (!container) return;

  setText('chartPaybackA', fmtMonths(resA.paybackReal));
  setText('chartPaybackB', fmtMonths(resB.paybackReal));

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
    gridSvg += '<line x1="' + padL + '" y1="' + y + '" x2="' + (W - padR) + '" y2="' + y + '" stroke="#e2e8f0" stroke-width="1" />';
    gridSvg += '<text x="' + (padL - 8) + '" y="' + (y + 4) + '" text-anchor="end" font-size="10.5" fill="#64748b">' + fmtShortMoney(val) + '</text>';
  }

  let xLabelsSvg = '';
  for (let m = 0; m <= 24; m += 3) {
    const x = getX(m);
    xLabelsSvg += '<line x1="' + x + '" y1="' + padT + '" x2="' + x + '" y2="' + (H - padB) + '" stroke="#f1f5f9" stroke-width="1" />';
    xLabelsSvg += '<text x="' + x + '" y="' + (H - 10) + '" text-anchor="middle" font-size="10.5" fill="#64748b">' + m + ' мес.</text>';
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
      return '<circle cx="' + getX(p.month).toFixed(1) + '" cy="' + getY(p.cumulative).toFixed(1) + '" r="3.5" fill="#2563eb" />';
    })
    .join('');

  const circlesB = ptsB
    .filter(function (p) { return p.month % 3 === 0; })
    .map(function (p) {
      return '<circle cx="' + getX(p.month).toFixed(1) + '" cy="' + getY(p.cumulative).toFixed(1) + '" r="3.5" fill="#16a34a" />';
    })
    .join('');

  container.innerHTML =
    '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet" role="img" aria-label="График окупаемости">' +
      gridSvg +
      xLabelsSvg +
      '<line x1="' + padL + '" y1="' + zeroY + '" x2="' + (W - padR) + '" y2="' + zeroY + '" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="5,4" />' +
      '<text x="' + (W - padR - 4) + '" y="' + (zeroY - 5) + '" text-anchor="end" font-size="10.5" font-weight="600" fill="#475569">Точка окупаемости (0)</text>' +
      '<path d="' + pathA + '" fill="none" stroke="#2563eb" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" />' +
      '<path d="' + pathB + '" fill="none" stroke="#16a34a" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" />' +
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
/* КОНЕЦ ЧАСТИ 6 ИЗ 7 (app.js) */
/* =========================================================
   ЧАСТЬ 7 ИЗ 7 (app.js): Экспорт в Excel, события и запуск
   ========================================================= */

function exportToCsv() {
  const res = calculateScenario(
    state.scenarios[state.activeScenario],
    state.buyCurrency,
    state.taxRegime,
    state.rates
  );
  const regimeName = (TAX_REGIMES_RU[state.taxRegime] || TAX_REGIMES_RU.usn6).name;

  const rows = [
    ['Показатель', 'Значение'],
    ['Налоговый режим (РФ)', regimeName],
    ['Валюта закупки товара', res.buyCurrencyCode + ' (курс ЦБ: ' + res.buyRate + ' руб.)'],
    ['Сценарий', 'План ' + state.activeScenario],
    ['Выручка с чеков (руб.)', Math.round(res.monthlyRevenue)],
    ['НДС к уплате (руб.)', Math.round(res.vatPayable)],
    ['Выручка без НДС (руб.)', Math.round(res.netRevenue)],
    ['Себестоимость COGS (руб.)', Math.round(res.cogs)],
    ['Валовая прибыль (руб.)', Math.round(res.grossProfit)],
    ['Выплата ФОТ на руки (руб.)', Math.round(res.fotNet)],
    ['НДФЛ (руб.)', Math.round(res.ndflAmount)],
    ['Страховые взносы СФР: ПФР, ФСС, ОМС (руб.)', Math.round(res.socialTax)],
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

  const csvContent = '\uFEFF' + rows.map(function (r) { return r.join(';'); }).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'finmodel_ru_plan_' + state.activeScenario + '.csv';
  link.click();
}

function bindEvents() {
  // Реактивный ввод в любые поля (input и select) активного сценария
  document.querySelectorAll('[data-field]').forEach(function (el) {
    const eventName = el.tagName === 'SELECT' ? 'change' : 'input';
    el.addEventListener(eventName, function () {
      const key = el.getAttribute('data-field');
      state.scenarios[state.activeScenario][key] =
        el.type === 'number' ? Number(el.value) : el.value;
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
        if (val > 0) {
          state.rates[curr] = val;
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
      const empty = {};
      Object.keys(state.scenarios[state.activeScenario]).forEach(function (k) {
        if (k === 'salaryType') empty[k] = 'net';
        else if (k === 'amortizationMonths') empty[k] = 24;
        else if (k === 'targetStoresCount') empty[k] = 1;
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
  if (exportBtn) exportBtn.addEventListener('click', exportToCsv);

  const printBtn = document.getElementById('printBtn');
  if (printBtn) printBtn.addEventListener('click', function () { window.print(); });

  // Нижние подвкладки (Сравнение / График окупаемости / Cash Flow)
  document.querySelectorAll('.subtab-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.subtab-btn').forEach(function (b) { b.classList.remove('active'); });
      document.querySelectorAll('.subtab-content').forEach(function (c) { c.classList.remove('active'); });
      btn.classList.add('active');
      const target = document.getElementById('subtab-' + btn.dataset.subtab);
      if (target) target.classList.add('active');
    });
  });
}

// Запуск приложения
document.addEventListener('DOMContentLoaded', function () {
  const restored = loadState();
  if (!restored) {
    initDefaultScenarios();
  }
  syncInputsFromState();
  bindEvents();
  renderAll();
  fetchCbrRates();
});
/* КОНЕЦ ЧАСТИ 7 ИЗ 7 (app.js) */
