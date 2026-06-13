const state = {
  result: null,
  activeScenario: null,
  scenarioBehaviorView: "actions",
  curveKind: "consumption",
  curveView: "monthly",
  curveMonthIndex: 0,
  curves: {
    consumption: {},
    pv: {},
  },
  priceCache: {},
  priceSource: "2025 implicit",
  projects: [],
  activeProjectId: null,
  isApplyingProject: false,
  user: null,
  authMode: "login",
};

const MONTHS = [
  { key: "01", label: "Ianuarie", days: 31 },
  { key: "02", label: "Februarie", days: 28 },
  { key: "03", label: "Martie", days: 31 },
  { key: "04", label: "Aprilie", days: 30 },
  { key: "05", label: "Mai", days: 31 },
  { key: "06", label: "Iunie", days: 30 },
  { key: "07", label: "Iulie", days: 31 },
  { key: "08", label: "August", days: 31 },
  { key: "09", label: "Septembrie", days: 30 },
  { key: "10", label: "Octombrie", days: 31 },
  { key: "11", label: "Noiembrie", days: 30 },
  { key: "12", label: "Decembrie", days: 31 },
];

const MONTH_SHORT = ["Ian", "Feb", "Mar", "Apr", "Mai", "Iun", "Iul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const numberFormat = new Intl.NumberFormat("ro-RO", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const dateTimeFormat = new Intl.DateTimeFormat("ro-RO", {
  dateStyle: "short",
  timeStyle: "short",
});

const currencyFormat = new Intl.NumberFormat("ro-RO", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const AUTH_STORAGE_KEY = "bess_auth_user_v1";
const PROJECT_STORAGE_PREFIX = "bess_projects_v1";
const MAX_SIMULATIONS_PER_PROJECT = 20;
let projectSaveTimer = null;

function $(id) {
  return document.getElementById(id);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function blankCurves() {
  return { consumption: {}, pv: {} };
}

function makeId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function activeProject() {
  return state.projects.find((project) => project.id === state.activeProjectId) || null;
}

function normalizedEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function projectStorageKey() {
  return `${PROJECT_STORAGE_PREFIX}_${normalizedEmail(state.user?.email) || "demo"}`;
}

function applyParams(values = {}) {
  $("atrMw").value = values.atr_mw ?? 0;
  $("rtEff").value = values.round_trip_efficiency ?? 0.9;
  $("initialSoc").value = values.initial_soc_mwh ?? 0;
  $("minSoc").value = values.min_soc_mwh ?? 0;
  $("customAc").value = values.custom_ac_mw ?? 0;
  $("customStorage").value = values.custom_storage_mwh ?? 0;
}

function applyScenarioSelection(values = ["2h", "3h", "4h", "6h", "PV_only"]) {
  const selected = new Set(values);
  document.querySelectorAll("#scenarioList input").forEach((input) => {
    input.checked = selected.has(input.value);
  });
}

function defaultFinancialAssumptions() {
  return {
    client: "",
    contractPriceLeiMwh: 596.92,
    supplyComponentLeiMwh: 0,
    eurRate: 5.1,
    investmentEur: 0,
  };
}

function financialAssumptions() {
  return {
    client: $("financialClient").value.trim(),
    contractPriceLeiMwh: parseNumber($("financialContractPrice").value),
    supplyComponentLeiMwh: parseNumber($("financialSupplyComponent").value),
    eurRate: parseNumber($("financialEurRate").value) || 5.1,
    investmentEur: parseNumber($("financialInvestmentEur").value),
  };
}

function applyFinancialAssumptions(values = {}) {
  const merged = { ...defaultFinancialAssumptions(), ...values };
  $("financialClient").value = merged.client || "";
  $("financialContractPrice").value = merged.contractPriceLeiMwh || 0;
  $("financialSupplyComponent").value = merged.supplyComponentLeiMwh || 0;
  $("financialEurRate").value = merged.eurRate || 5.1;
  $("financialInvestmentEur").value = merged.investmentEur || 0;
}

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function parseNumber(value) {
  const text = String(value || "").trim().replace(/\s/g, "").replace(",", ".");
  const n = Number(text);
  return Number.isFinite(n) ? n : 0;
}

function hasValue(value) {
  return String(value ?? "").trim() !== "";
}

function formatLei(value) {
  return `${currencyFormat.format(Number(value) || 0)} lei`;
}

function formatEuro(value) {
  return `${currencyFormat.format(Number(value) || 0)} euro`;
}

function daysBeforeMonth(monthIndex) {
  return MONTHS.slice(0, monthIndex).reduce((total, _, index) => total + monthDays(index), 0);
}

function selectedYear() {
  return Number($("priceYear")?.value || 2025);
}

function isLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function monthDays(monthIndex, year = selectedYear()) {
  if (monthIndex === 1) return isLeapYear(year) ? 29 : 28;
  return MONTHS[monthIndex].days;
}

function expectedHours(year = selectedYear()) {
  return MONTHS.reduce((total, _, index) => total + monthDays(index, year) * 24, 0);
}

function timestampFor(monthIndex, day, hour) {
  const month = MONTHS[monthIndex];
  return `${selectedYear()}-${month.key}-${String(day).padStart(2, "0")} ${String(hour).padStart(2, "0")}:00:00`;
}

function intervalLabel(hour) {
  return `${String(hour).padStart(2, "0")}-${String(hour + 1).padStart(2, "0")}`;
}

function curveKey(kind, monthIndex) {
  return `${kind}_${selectedYear()}_${MONTHS[monthIndex].key}`;
}

function monthValues(kind, monthIndex) {
  const key = curveKey(kind, monthIndex);
  if (!state.curves[kind][key]) {
    state.curves[kind][key] = Array.from({ length: monthDays(monthIndex) }, () => Array(24).fill(""));
  }
  return state.curves[kind][key];
}

function syncPriceImportVisibility() {
  const control = $("priceFileControl");
  if (!control) return;
  control.classList.toggle("is-hidden", selectedYear() !== 2026);
}

function curveKindLabel(kind = state.curveKind) {
  return kind === "pv" ? "Productie PV" : "Consum client";
}

function annualIndexToCurvePosition(index, year = selectedYear()) {
  let remaining = index;
  for (let monthIndex = 0; monthIndex < MONTHS.length; monthIndex += 1) {
    const monthHours = monthDays(monthIndex, year) * 24;
    if (remaining < monthHours) {
      return {
        monthIndex,
        dayIndex: Math.floor(remaining / 24),
        hour: remaining % 24,
      };
    }
    remaining -= monthHours;
  }
  return null;
}

function curveDateLabel(monthIndex, dayIndex, year = selectedYear()) {
  return `${String(dayIndex + 1).padStart(2, "0")}.${MONTHS[monthIndex].key}.${year}`;
}

function normalizePastedCurveValue(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  const normalized = text.replace(/\s/g, "").replace(",", ".");
  return Number.isFinite(Number(normalized)) ? normalized : text;
}

function isNumericText(value) {
  if (!String(value ?? "").trim()) return false;
  return Number.isFinite(Number(normalizePastedCurveValue(value)));
}

function pastedRows(text) {
  const lines = String(text ?? "").replace(/\r/g, "").split("\n");
  while (lines.length && lines[lines.length - 1] === "") lines.pop();
  return lines.map((line) => line.split(/\t|;/));
}

function consolidatedPasteValues(rows) {
  if (!rows.length) return [];
  const singleColumn = rows.every((row) => row.length <= 1);
  if (singleColumn) {
    const values = rows.map((row) => normalizePastedCurveValue(row[0]));
    if (values.length > 1 && !isNumericText(values[0]) && values.slice(1).some((value) => isNumericText(value))) {
      return values.slice(1);
    }
    return values;
  }
  return rows.reduce((values, row) => {
    for (let index = row.length - 1; index >= 0; index -= 1) {
      if (isNumericText(row[index])) {
        values.push(normalizePastedCurveValue(row[index]));
        break;
      }
    }
    return values;
  }, []);
}

function setCurveValue(kind, monthIndex, dayIndex, hour, value) {
  const values = monthValues(kind, monthIndex);
  if (!values[dayIndex] || hour < 0 || hour > 23) return;
  values[dayIndex][hour] = value;
}

function monthlyCurveHasAny(kind) {
  return MONTHS.some((_, monthIndex) =>
    monthValues(kind, monthIndex).some((dayValues) => dayValues.some((value) => hasValue(value))),
  );
}

function syncCurveViewControls() {
  document.querySelectorAll("#curveView button").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === state.curveView);
  });
  $("curveMonth")?.classList.toggle("is-hidden", state.curveView === "consolidated");
}

function initCurveControls() {
  const monthSelect = $("curveMonth");
  monthSelect.innerHTML = "";
  MONTHS.forEach((month, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = month.label;
    monthSelect.appendChild(option);
  });
  monthSelect.addEventListener("change", (event) => {
    state.curveMonthIndex = Number(event.target.value);
    renderCurveTable();
  });
  document.querySelectorAll("#curveView button").forEach((button) => {
    button.addEventListener("click", () => {
      state.curveView = button.dataset.view;
      syncCurveViewControls();
      renderCurveTable();
    });
  });
  document.querySelectorAll("#curveKind button").forEach((button) => {
    button.addEventListener("click", () => {
      state.curveKind = button.dataset.kind;
      document.querySelectorAll("#curveKind button").forEach((item) => item.classList.toggle("active", item === button));
      renderCurveTable();
    });
  });
  renderCurveTable();
}

function renderMonthlyCurveTable() {
  const month = MONTHS[state.curveMonthIndex];
  const days = monthDays(state.curveMonthIndex);
  $("curveMonthTitle").textContent = `${month.label} ${selectedYear()}`;
  const values = monthValues(state.curveKind, state.curveMonthIndex);
  const table = $("curveTable");
  table.className = "curve-table";
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  const first = document.createElement("th");
  first.textContent = "Interval";
  headRow.appendChild(first);
  for (let day = 1; day <= days; day += 1) {
    const th = document.createElement("th");
    th.textContent = String(day);
    headRow.appendChild(th);
  }
  thead.appendChild(headRow);

  const tbody = document.createElement("tbody");
  for (let hour = 0; hour < 24; hour += 1) {
    const tr = document.createElement("tr");
    const label = document.createElement("td");
    label.textContent = intervalLabel(hour);
    tr.appendChild(label);
    for (let dayIndex = 0; dayIndex < days; dayIndex += 1) {
      const td = document.createElement("td");
      const input = document.createElement("input");
      input.type = "number";
      input.step = "0.001";
      input.inputMode = "decimal";
      input.value = values[dayIndex][hour];
      input.dataset.day = String(dayIndex);
      input.dataset.hour = String(hour);
      td.appendChild(input);
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  table.innerHTML = "";
  table.appendChild(thead);
  table.appendChild(tbody);
}

function renderConsolidatedCurveTable() {
  const kindLabel = curveKindLabel();
  $("curveMonthTitle").textContent = `Curbe consolidate ${selectedYear()} - ${kindLabel}`;
  const table = $("curveTable");
  table.className = "curve-table consolidated-table";
  const valuesByMonth = MONTHS.map((_, monthIndex) => monthValues(state.curveKind, monthIndex));

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  ["#", "Data", "Ora", "Luna", `${kindLabel} MWh`].forEach((label) => {
    const th = document.createElement("th");
    th.textContent = label;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);

  const tbody = document.createElement("tbody");
  const totalHours = expectedHours();
  for (let annualIndex = 0; annualIndex < totalHours; annualIndex += 1) {
    const position = annualIndexToCurvePosition(annualIndex);
    if (!position) continue;
    const { monthIndex, dayIndex, hour } = position;
    const tr = document.createElement("tr");
    [
      String(annualIndex + 1),
      curveDateLabel(monthIndex, dayIndex),
      intervalLabel(hour),
      MONTHS[monthIndex].label,
    ].forEach((value) => {
      const td = document.createElement("td");
      td.className = "meta-cell";
      td.textContent = value;
      tr.appendChild(td);
    });

    const td = document.createElement("td");
    const input = document.createElement("input");
    input.type = "number";
    input.step = "0.001";
    input.inputMode = "decimal";
    input.value = valuesByMonth[monthIndex][dayIndex][hour];
    input.dataset.month = String(monthIndex);
    input.dataset.day = String(dayIndex);
    input.dataset.hour = String(hour);
    input.dataset.annualIndex = String(annualIndex);
    input.setAttribute("aria-label", `${kindLabel} ${curveDateLabel(monthIndex, dayIndex)} ${intervalLabel(hour)}`);
    td.appendChild(input);
    tr.appendChild(td);
    tbody.appendChild(tr);
  }

  table.innerHTML = "";
  table.appendChild(thead);
  table.appendChild(tbody);
}

function renderCurveTable() {
  syncCurveViewControls();
  if (state.curveView === "consolidated") {
    renderConsolidatedCurveTable();
    return;
  }
  renderMonthlyCurveTable();
}

function monthlyCheck(kind, monthIndex) {
  const month = MONTHS[monthIndex];
  const days = monthDays(monthIndex);
  const values = monthValues(kind, monthIndex);
  let completed = 0;
  let negative = 0;
  let total = 0;
  let completeDays = 0;
  let anyValue = false;

  values.forEach((dayValues) => {
    let dayCompleted = 0;
    dayValues.forEach((value) => {
      if (hasValue(value)) {
        anyValue = true;
        completed += 1;
        dayCompleted += 1;
        const numeric = parseNumber(value);
        total += numeric;
        if (numeric < 0) negative += 1;
      }
    });
    if (dayCompleted === 24) completeDays += 1;
  });

  const expected = days * 24;
  const missing = expected - completed;
  let status = "OK";
  let severity = "ok";
  if (kind === "pv" && !anyValue) {
    status = "Optional";
    severity = "ok";
  } else if (negative > 0) {
    status = "Valori negative";
    severity = "error";
  } else if (missing > 0) {
    status = "Incomplet";
    severity = kind === "consumption" ? "error" : "warn";
  }

  return {
    kind,
    month: month.label,
    expected,
    completed,
    missing,
    completeDays,
    days,
    total,
    status,
    severity,
    anyValue,
    negative,
  };
}

function sourceByCsv(months, label) {
  return months.map((month) => ({
    ...month,
    expected: "-",
    completed: "-",
    missing: "-",
    completeDays: "-",
    total: "-",
    status: label,
    severity: "ok",
  }));
}

function buildImportChecks(rows, consumptionRows, pvRows, priceRows) {
  const consumptionMonths = MONTHS.map((_, index) => monthlyCheck("consumption", index));
  const pvMonths = MONTHS.map((_, index) => monthlyCheck("pv", index));
  const useMonthlyConsumption = true;
  const useMonthlyPv = true;
  const year = selectedYear();
  const hoursExpected = expectedHours(year);
  const totalConsumption = rows.reduce((sum, row) => sum + parseNumber(row.consumption_mwh), 0);
  const totalPv = rows.reduce((sum, row) => sum + parseNumber(row.pv_mwh), 0);
  const nonZeroPrices = rows.filter((row) => Math.abs(parseNumber(row.price_lei_mwh)) > 0).length;
  const negativeRows = rows.filter((row) => parseNumber(row.consumption_mwh) < 0 || parseNumber(row.pv_mwh) < 0).length;
  const priceYears = priceRows.map(timestampYear);
  const priceRowsMissingYear = priceYears.filter((priceYear) => priceYear === null).length;
  const priceRowsWrongYear = priceYears.filter((priceYear) => priceYear !== null && priceYear !== year).length;
  const priceYearOk = priceRows.length > 0 && priceRowsMissingYear === 0 && priceRowsWrongYear === 0;

  const checks = [
    {
      label: "Consum",
      value: useMonthlyConsumption
        ? `${consumptionMonths.filter((m) => m.severity === "ok").length}/12 luni OK`
        : `${consumptionRows.length} randuri CSV`,
      severity: useMonthlyConsumption
        ? (consumptionMonths.some((m) => m.severity === "error") ? "error" : "ok")
        : (consumptionRows.length === hoursExpected ? "ok" : "error"),
    },
    {
      label: "PV",
      value: useMonthlyPv
        ? `${pvMonths.filter((m) => m.severity === "ok").length}/12 luni OK sau optional`
        : `${pvRows.length} randuri CSV`,
      severity: useMonthlyPv
        ? (pvMonths.some((m) => m.severity === "error") ? "error" : "ok")
        : (pvRows.length === hoursExpected ? "ok" : "error"),
    },
    {
      label: "Preturi",
      value: `${priceRows.length}/${hoursExpected} randuri, ${nonZeroPrices} valori, an ${priceYearOk ? "OK" : "de verificat"}`,
      severity: priceRows.length === hoursExpected && nonZeroPrices > 0 && priceYearOk ? "ok" : "error",
    },
    {
      label: "Consolidare",
      value: `${rows.length} ore, ${numberFormat.format(totalConsumption)} MWh consum`,
      severity: rows.length === hoursExpected && totalConsumption > 0 && negativeRows === 0 ? "ok" : "error",
    },
  ];

  let overall = "ok";
  if (checks.some((check) => check.severity === "error")) overall = "error";
  else if (checks.some((check) => check.severity === "warn")) overall = "warn";

  return {
    overall,
    checks,
    monthly: [
      ...(useMonthlyConsumption ? consumptionMonths : sourceByCsv(consumptionMonths, "CSV")),
      ...(useMonthlyPv ? pvMonths : sourceByCsv(pvMonths, "CSV")),
    ],
    totals: { totalConsumption, totalPv, nonZeroPrices, negativeRows, priceRowsWrongYear, priceRowsMissingYear },
  };
}

function renderImportChecks(checks) {
  const chip = $("overallCheck");
  chip.className = `status-chip ${checks.overall}`;
  chip.textContent = checks.overall === "ok" ? "OK" : checks.overall === "warn" ? "Atentie" : "De corectat";

  const priceCheck = checks.checks.find((check) => check.label === "Preturi");
  const priceChip = $("priceSource");
  priceChip.className = `status-chip ${priceCheck?.severity || "warn"}`;
  priceChip.textContent = state.priceSource;

  $("checkSummary").innerHTML = "";
  checks.checks.forEach((check) => {
    const card = document.createElement("div");
    card.className = "check-card";
    card.innerHTML = `<span>${check.label}</span><strong>${check.value}</strong>`;
    $("checkSummary").appendChild(card);
  });

  const tbody = $("monthlyCheckRows");
  tbody.innerHTML = "";
  checks.monthly.forEach((row) => {
    const tr = document.createElement("tr");
    [
      row.kind === "consumption" ? "Consum" : "PV",
      row.month,
      row.expected,
      row.completed,
      row.missing,
      typeof row.completeDays === "number" ? `${row.completeDays}/${row.days}` : row.completeDays,
      typeof row.total === "number" ? numberFormat.format(row.total) : row.total,
    ].forEach((value) => {
      const td = document.createElement("td");
      td.textContent = value;
      tr.appendChild(td);
    });
    const status = document.createElement("td");
    const chipInner = document.createElement("span");
    chipInner.className = `status-chip ${row.severity}`;
    chipInner.textContent = row.status;
    status.appendChild(chipInner);
    tr.appendChild(status);
    tbody.appendChild(tr);
  });
}

function rowsFromMonthlyCurves() {
  const rows = [];
  MONTHS.forEach((month, monthIndex) => {
    const consumption = monthValues("consumption", monthIndex);
    const pv = monthValues("pv", monthIndex);
    const days = monthDays(monthIndex);
    for (let dayIndex = 0; dayIndex < days; dayIndex += 1) {
      for (let hour = 0; hour < 24; hour += 1) {
        rows.push({
          timestamp: timestampFor(monthIndex, dayIndex + 1, hour),
          consumption_mwh: parseNumber(consumption[dayIndex][hour]),
          pv_mwh: parseNumber(pv[dayIndex][hour]),
          price_lei_mwh: 0,
        });
      }
    }
  });
  return rows;
}

function splitCsvLine(line) {
  const out = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      quoted = !quoted;
    } else if ((ch === "," || ch === ";") && !quoted) {
      out.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  out.push(current);
  return out.map((item) => item.trim().replace(/^"|"$/g, ""));
}

async function readFile(file) {
  if (!file) return null;
  return file.text();
}

function parseCsv(text) {
  if (!text) return [];
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]).map(normalizeHeader);
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = cells[index] ?? "";
    });
    return row;
  });
}

async function getPriceRows() {
  const file = $("priceFile").files[0];
  const year = selectedYear();
  if (file && year !== 2025) {
    $("priceFile").value = "";
    state.priceSource = `${year} import CSV`;
    const rows = parseCsv(await readFile(file));
    const project = activeProject();
    if (project) {
      project.savedPriceRows = rows;
      project.savedPriceYear = year;
      persistProjects();
    }
    return rows;
  }
  if (year === 2025) {
    if (!state.priceCache[year]) {
      const response = await fetch("/data/pzu_2025.csv", { cache: "no-store" });
      if (!response.ok) throw new Error("Nu am putut incarca preturile PZU implicite pentru 2025.");
      state.priceCache[year] = parseCsv(await response.text());
    }
    state.priceSource = "2025 realizat";
    return state.priceCache[year];
  }
  const project = activeProject();
  if (project?.savedPriceYear === year && Array.isArray(project.savedPriceRows) && project.savedPriceRows.length) {
    state.priceSource = `${year} salvat in proiect`;
    return project.savedPriceRows;
  }
  state.priceSource = `${year} necesita import`;
  return [];
}

function pick(row, keys) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== "") return row[key];
  }
  return "";
}

function timestampYear(row) {
  const timestamp = pick(row, ["timestamp", "date", "datetime", "data", "date_and_hour"]);
  const match = String(timestamp).trim().match(/^(\d{4})/);
  return match ? Number(match[1]) : null;
}

function mergeInputs(consumptionRows, pvRows, priceRows) {
  const monthlyRows = rowsFromMonthlyCurves();
  const useMonthlyConsumption = consumptionRows.length === 0;
  const useMonthlyPv = pvRows.length === 0;
  const count = Math.max(
    consumptionRows.length,
    pvRows.length,
    priceRows.length,
    useMonthlyConsumption ? monthlyRows.length : 0,
    useMonthlyPv && monthlyCurveHasAny("pv") ? monthlyRows.length : 0,
  );
  const rows = [];
  for (let i = 0; i < count; i += 1) {
    const c = consumptionRows[i] || (useMonthlyConsumption ? monthlyRows[i] : {}) || {};
    const pv = pvRows[i] || (useMonthlyPv ? monthlyRows[i] : {}) || {};
    const p = priceRows[i] || {};
    const timestamp =
      pick(c, ["timestamp", "date", "datetime", "data", "date_and_hour"]) ||
      pick(p, ["timestamp", "date", "datetime", "data", "date_and_hour"]) ||
      pick(pv, ["timestamp", "date", "datetime", "data", "date_and_hour"]);
    rows.push({
      timestamp,
      consumption_mwh: parseNumber(pick(c, ["consumption_mwh", "consum_mwh", "consum", "load_mwh", "consum_mw"])),
      pv_mwh: parseNumber(pick(pv, ["pv_mwh", "productie_pv_mwh", "productie_pv", "pv"])),
      price_lei_mwh: parseNumber(pick(p, ["price_lei_mwh", "pret_pzu_lei_mwh", "pret_pzu", "price", "pret"])),
    });
  }
  return rows;
}

function buildRowsForRun(consumptionRows, pvRows, priceRows) {
  const rows = mergeInputs(consumptionRows, pvRows, priceRows);
  return { rows, checks: buildImportChecks(rows, consumptionRows, pvRows, priceRows) };
}

function selectedScenarios() {
  return Array.from(document.querySelectorAll("#scenarioList input:checked")).map((input) => input.value);
}

function params() {
  return {
    atr_mw: parseNumber($("atrMw").value),
    round_trip_efficiency: parseNumber($("rtEff").value),
    initial_soc_mwh: parseNumber($("initialSoc").value),
    min_soc_mwh: parseNumber($("minSoc").value),
    custom_ac_mw: parseNumber($("customAc").value),
    custom_storage_mwh: parseNumber($("customStorage").value),
    smart_duration_h: 4,
    smart_candidate_multiplier: 2,
  };
}

function setMessages(messages, isError = false) {
  $("messages").innerHTML = "";
  messages.forEach((text) => {
    const div = document.createElement("div");
    div.className = `message${isError ? " error" : ""}`;
    div.textContent = text;
    $("messages").appendChild(div);
  });
}

function loadAuthSession() {
  try {
    const saved = JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) || "null");
    state.user = saved?.email ? saved : null;
  } catch {
    state.user = null;
  }
}

function persistAuthSession(user) {
  state.user = user;
  if (user) localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
  else localStorage.removeItem(AUTH_STORAGE_KEY);
}

function setAuthMessage(message) {
  $("authMessage").textContent = message || "";
}

function renderAuthMode() {
  const isCreate = state.authMode === "create";
  $("authSubtitle").textContent = isCreate ? "Creare cont utilizator" : "Logare utilizator";
  $("authSubmit").textContent = isCreate ? "Creeaza cont" : "Logare";
  $("authToggle").textContent = isCreate ? "Am deja cont" : "Creeaza cont";
  $("authPassword").setAttribute("autocomplete", isCreate ? "new-password" : "current-password");
  setAuthMessage("");
}

function renderAuthState() {
  const isLoggedIn = Boolean(state.user);
  $("authScreen").classList.toggle("is-hidden", isLoggedIn);
  $("appShell").classList.toggle("is-hidden", !isLoggedIn);
  if (isLoggedIn) {
    $("userEmail").textContent = state.user.email;
    $("userPlan").textContent = state.user.plan || "Demo";
  }
}

function handleAuthSubmit(event) {
  event.preventDefault();
  const email = normalizedEmail($("authEmail").value);
  const password = $("authPassword").value;
  if (!email || !email.includes("@")) {
    setAuthMessage("Email invalid.");
    return;
  }
  if (password.length < 6) {
    setAuthMessage("Parola trebuie sa aiba minimum 6 caractere.");
    return;
  }
  persistAuthSession({
    email,
    plan: "Demo",
    loginAt: new Date().toISOString(),
    authMode: state.authMode,
  });
  $("authPassword").value = "";
  renderAuthState();
  loadProjects();
  syncPriceImportVisibility();
  refreshChecksFromCurrentInputs();
}

function logout() {
  saveDraftToActiveProject();
  persistAuthSession(null);
  state.projects = [];
  state.activeProjectId = null;
  state.result = null;
  state.activeScenario = null;
  $("authPassword").value = "";
  renderAuthState();
}

function createProject(name = "Proiect nou") {
  const now = new Date().toISOString();
  return {
    id: makeId("project"),
    name,
    createdAt: now,
    updatedAt: now,
    priceYear: 2025,
    params: params(),
    scenarios: selectedScenarios(),
    curves: blankCurves(),
    simulations: [],
    activeSimulationId: null,
    savedPriceRows: null,
    savedPriceYear: null,
    financialAssumptions: defaultFinancialAssumptions(),
  };
}

function persistProjects() {
  try {
    localStorage.setItem(projectStorageKey(), JSON.stringify(state.projects));
  } catch (error) {
    setMessages(["Nu am putut salva proiectele in browser. Istoricul poate fi prea mare."], true);
  }
}

function loadProjects() {
  if (!state.user) return;
  try {
    const saved = JSON.parse(localStorage.getItem(projectStorageKey()) || "[]");
    state.projects = Array.isArray(saved) ? saved : [];
  } catch {
    state.projects = [];
  }
  if (!state.projects.length) {
    state.projects = [createProject()];
    persistProjects();
  }
  state.activeProjectId = state.projects[0].id;
  applyProject(state.projects[0], { saveCurrent: false });
}

function saveDraftToActiveProject() {
  if (state.isApplyingProject) return;
  const project = activeProject();
  if (!project) return;
  project.name = $("projectName").value.trim() || "Proiect nou";
  project.updatedAt = new Date().toISOString();
  project.priceYear = selectedYear();
  project.params = params();
  project.scenarios = selectedScenarios();
  project.curves = clone(state.curves);
  project.financialAssumptions = financialAssumptions();
  persistProjects();
  renderProjectsMenu();
}

function scheduleSaveProjectDraft() {
  window.clearTimeout(projectSaveTimer);
  projectSaveTimer = window.setTimeout(saveDraftToActiveProject, 250);
}

function applyProject(project, options = {}) {
  const { saveCurrent = true, renderTable = true } = options;
  if (!project) return;
  if (saveCurrent) saveDraftToActiveProject();
  state.isApplyingProject = true;
  state.activeProjectId = project.id;
  state.curves = clone(project.curves || blankCurves());
  $("projectName").value = project.name || "Proiect nou";
  $("priceYear").value = String(project.priceYear || 2025);
  applyParams(project.params);
  applyScenarioSelection(project.scenarios);
  applyFinancialAssumptions(project.financialAssumptions);

  const activeSimulation =
    project.simulations?.find((simulation) => simulation.id === project.activeSimulationId) ||
    project.simulations?.[0];
  if (activeSimulation?.result) {
    state.result = clone(activeSimulation.result);
    state.activeScenario = activeSimulation.activeScenario || activeSimulation.dashboard?.scenarioName || state.result.scenarios?.[0]?.name || null;
  } else {
    state.result = null;
    state.activeScenario = null;
  }
  state.isApplyingProject = false;

  syncPriceImportVisibility();
  renderProjectsMenu();
  if (renderTable) renderCurveTable();
  if (state.result) render({ persistScenario: false });
  else resetResultsView();
  refreshChecksFromCurrentInputs();
}

function renderProjectsMenu() {
  const tabs = $("projectTabs");
  if (!tabs) return;
  tabs.innerHTML = "";
  state.projects.forEach((project) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `project-tab${project.id === state.activeProjectId ? " active" : ""}`;
    button.dataset.projectId = project.id;
    button.textContent = project.name || "Proiect nou";
    tabs.appendChild(button);
  });

  const project = activeProject();
  const simulations = project?.simulations || [];
  $("historyCount").textContent = String(simulations.length);
  const history = $("simulationHistory");
  history.innerHTML = "";
  if (!simulations.length) {
    const empty = document.createElement("div");
    empty.className = "history-empty";
    empty.textContent = "Nu exista simulari salvate.";
    history.appendChild(empty);
    return;
  }
  simulations.forEach((simulation, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "history-item";
    button.dataset.simulationId = simulation.id;
    const scenarioName = simulation.dashboard?.scenarioName || simulation.activeScenario || simulation.result?.best_scenario_by_monthly_average || "-";
    const withBess = simulation.dashboard?.annual?.arithmetic_avg_monthly_with_bess_lei_mwh;
    const date = dateTimeFormat.format(new Date(simulation.runAt));
    const valueText = Number.isFinite(withBess) ? `, cu BESS ${numberFormat.format(withBess)}` : "";
    const financialText = simulation.financialSummary ? " | sinteza rulata" : "";
    button.innerHTML = `<strong>${index + 1}. ${scenarioName}</strong><span>${date}${valueText}${financialText}</span>`;
    history.appendChild(button);
  });
}

function ensureActiveProject() {
  let project = activeProject();
  if (project) return project;
  project = createProject();
  state.projects.unshift(project);
  state.activeProjectId = project.id;
  persistProjects();
  renderProjectsMenu();
  return project;
}

function saveSimulationToProject(result, priceRows) {
  const project = ensureActiveProject();
  const now = new Date().toISOString();
  project.name = $("projectName").value.trim() || project.name || "Proiect nou";
  project.updatedAt = now;
  project.priceYear = selectedYear();
  project.params = params();
  project.scenarios = selectedScenarios();
  project.curves = clone(state.curves);
  project.financialAssumptions = financialAssumptions();
  if (project.priceYear !== 2025 && priceRows.length) {
    project.savedPriceRows = priceRows;
    project.savedPriceYear = project.priceYear;
  }
  const dashboard = buildDashboardSnapshot(result, state.activeScenario);
  const simulation = {
    id: makeId("simulation"),
    runAt: now,
    activeScenario: state.activeScenario,
    dashboard,
    financialSummarySource: dashboard,
    result: clone(result),
  };
  project.simulations = [simulation, ...(project.simulations || [])].slice(0, MAX_SIMULATIONS_PER_PROJECT);
  project.activeSimulationId = simulation.id;
  project.dashboardSnapshot = simulation.dashboard;
  project.financialSummarySource = simulation.financialSummarySource;
  persistProjects();
  renderProjectsMenu();
}

function activateSimulation(simulationId) {
  const project = activeProject();
  const simulation = project?.simulations?.find((item) => item.id === simulationId);
  if (!project || !simulation) return;
  project.activeSimulationId = simulation.id;
  state.result = clone(simulation.result);
  state.activeScenario = simulation.activeScenario || simulation.dashboard?.scenarioName || state.result.scenarios?.[0]?.name || null;
  project.dashboardSnapshot = simulation.dashboard || buildDashboardSnapshot(state.result, state.activeScenario);
  project.financialSummarySource = simulation.financialSummarySource || project.dashboardSnapshot;
  project.financialSummary = simulation.financialSummary || null;
  persistProjects();
  renderProjectsMenu();
  render({ persistScenario: false });
}

function resetResultsView() {
  $("metricHours").textContent = "0";
  $("metricConsumption").textContent = "0,00";
  $("metricAc").textContent = "0,00";
  $("metricPeak").textContent = "0,00";
  $("metricHeadroom").textContent = "0,00";
  $("metricDay").textContent = "0,00";
  $("metricNight").textContent = "0,00";
  $("metricBest").textContent = "-";
  $("activeScenario").innerHTML = "";
  $("monthlyScenario").innerHTML = "";
  $("scenarioTabs").innerHTML = "";
  $("annualNoBess").textContent = "0,00";
  $("annualWithBess").textContent = "0,00";
  $("annualReduction").textContent = "0,00";
  $("annualCharges").textContent = "0";
  $("annualDischarges").textContent = "0";
  $("scenarioCostRows").innerHTML = "";
  renderScenarioBehaviorHeader("actions");
  $("scenarioBehaviorRows").innerHTML = "";
  $("scenarioBehaviorCount").textContent = "0 ore";
  $("monthlyRows").innerHTML = "";
  drawScenarioComparisonChart([], null);
  drawMonthlyChart([]);
  renderFinancialSummary(null);
  setMessages([]);
}

async function runSimulation() {
  $("runBtn").disabled = true;
  $("runBtn").textContent = "Ruleaza...";
  try {
    const priceRows = await getPriceRows();
    const consumptionRows = [];
    const pvRows = [];
    const { rows, checks } = buildRowsForRun(consumptionRows, pvRows, priceRows);
    renderImportChecks(checks);
    const response = await fetch("/api/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows, params: params(), scenarios: selectedScenarios() }),
    });
    const payload = await response.json();
    if (!response.ok || payload.error) throw new Error(payload.error || "Simularea a esuat.");
    state.result = payload;
    state.activeScenario = payload.scenarios[0]?.name || null;
    saveSimulationToProject(payload, priceRows);
    render();
  } catch (error) {
    setMessages([error.message], true);
  } finally {
    $("runBtn").disabled = false;
    $("runBtn").textContent = "Ruleaza simulare";
  }
}

async function refreshChecksFromCurrentInputs() {
  const priceRows = await getPriceRows();
  const { rows, checks } = buildRowsForRun([], [], priceRows);
  renderImportChecks(checks);
  return rows;
}

function scenarioByName(name) {
  return state.result?.scenarios.find((scenario) => scenario.name === name) || null;
}

function scenarioFromResult(result, name) {
  return result?.scenarios?.find((scenario) => scenario.name === name) || result?.scenarios?.[0] || null;
}

function dayNightSplit(hourly = []) {
  let day = 0;
  let night = 0;
  hourly.forEach((row) => {
    const hour = Number(String(row.timestamp || "").slice(11, 13));
    const value = Number(row.consumption_mwh) || 0;
    if (hour >= 7 && hour < 22) day += value;
    else night += value;
  });
  const total = day + night;
  return {
    dayMwh: day,
    nightMwh: night,
    dayPct: total > 0 ? (day / total) * 100 : 0,
    nightPct: total > 0 ? (night / total) * 100 : 0,
  };
}

function scenarioCostSummary(scenario) {
  const annual = scenario?.summary?.annual || {};
  return {
    name: scenario?.name || "-",
    acMw: Number(scenario?.ac_mw) || 0,
    storageMwh: Number(scenario?.storage_mwh) || 0,
    costWithoutBessLei: Number(annual.cost_without_bess_lei) || 0,
    costWithBessLei: Number(annual.cost_with_bess_lei) || 0,
    priceWithoutBessLeiMwh: Number(annual.arithmetic_avg_monthly_without_bess_lei_mwh) || 0,
    priceWithBessLeiMwh: Number(annual.arithmetic_avg_monthly_with_bess_lei_mwh) || 0,
    reductionLeiMwh: Number(annual.reduction_lei_mwh) || 0,
  };
}

function scenarioCostsFromResult(result) {
  return (result?.scenarios || []).map(scenarioCostSummary);
}

function buildDashboardSnapshot(result, scenarioName) {
  const scenario = scenarioFromResult(result, scenarioName);
  if (!result || !scenario) return null;
  const annual = scenario.summary.annual;
  const monthly = clone(scenario.summary.monthly || []);
  const inputMetrics = result.inputs || {};
  const fallbackSplit = dayNightSplit(scenario.hourly || []);
  const dayMwh = Number(inputMetrics.day_consumption_mwh);
  const nightMwh = Number(inputMetrics.night_consumption_mwh);
  const dayPct = Number(inputMetrics.day_consumption_pct);
  const nightPct = Number(inputMetrics.night_consumption_pct);
  return {
    generatedAt: new Date().toISOString(),
    scenarioName: scenario.name,
    battery: {
      acMw: Number(scenario.ac_mw) || 0,
      storageMwh: Number(scenario.storage_mwh) || 0,
    },
    metrics: {
      hours: result.inputs?.hours || 0,
      totalConsumptionMwh: result.inputs?.total_consumption_mwh || 0,
      maxAcMw: result.inputs?.max_ac_mw || 0,
      atrMw: result.inputs?.atr_mw || 0,
      peakLoadMw: result.inputs?.peak_load_mw || 0,
      peakLoadTimestamp: result.inputs?.peak_load_timestamp || "",
      headroomMw: result.inputs?.headroom_mw || 0,
      bestScenario: result.best_scenario_by_monthly_average || "-",
      dayMwh: Number.isFinite(dayMwh) ? dayMwh : fallbackSplit.dayMwh,
      nightMwh: Number.isFinite(nightMwh) ? nightMwh : fallbackSplit.nightMwh,
      dayPct: Number.isFinite(dayPct) ? dayPct : fallbackSplit.dayPct,
      nightPct: Number.isFinite(nightPct) ? nightPct : fallbackSplit.nightPct,
    },
    annual: clone(annual),
    monthly,
    scenarios: scenarioCostsFromResult(result),
    chart: monthly.map((row) => ({
      month: row.month,
      withoutBess: row.price_without_bess_lei_mwh,
      withBess: row.price_with_bess_lei_mwh,
      reduction: row.reduction_lei_mwh,
    })),
  };
}

function activeSimulation() {
  const project = activeProject();
  if (!project?.activeSimulationId) return null;
  return project.simulations?.find((simulation) => simulation.id === project.activeSimulationId) || null;
}

function ensureSimulationContext() {
  if (!state.result) return null;
  const project = ensureActiveProject();
  let simulation = activeSimulation();
  if (simulation) return simulation;

  const now = new Date().toISOString();
  const dashboard = buildDashboardSnapshot(state.result, state.activeScenario);
  simulation = {
    id: makeId("simulation"),
    runAt: now,
    activeScenario: state.activeScenario,
    dashboard,
    financialSummarySource: dashboard,
    result: clone(state.result),
  };
  project.simulations = [simulation, ...(project.simulations || [])].slice(0, MAX_SIMULATIONS_PER_PROJECT);
  project.activeSimulationId = simulation.id;
  project.dashboardSnapshot = dashboard;
  project.financialSummarySource = dashboard;
  project.updatedAt = now;
  persistProjects();
  renderProjectsMenu();
  return simulation;
}

function persistDashboardSelection(snapshot) {
  if (state.isApplyingProject) return;
  const project = activeProject();
  const simulation = activeSimulation();
  if (!project || !simulation || !state.result) return;
  const dashboard = snapshot || buildDashboardSnapshot(state.result, state.activeScenario);
  if (!dashboard) return;
  simulation.activeScenario = dashboard.scenarioName;
  simulation.dashboard = dashboard;
  simulation.financialSummarySource = dashboard;
  if (simulation.financialSummary?.scenarioName !== dashboard.scenarioName) {
    simulation.financialSummary = null;
  }
  project.dashboardSnapshot = dashboard;
  project.financialSummarySource = dashboard;
  project.financialSummary = simulation.financialSummary || null;
  project.updatedAt = new Date().toISOString();
  persistProjects();
}

function monthlyObservation(reduction, diffVsContract) {
  if (diffVsContract < 0) return "Impact moderat; peste pret contract";
  if (reduction >= 130) return "Impact ridicat";
  if (reduction >= 100) return "Impact bun";
  return "Impact moderat";
}

function buildFinancialSummary(source) {
  if (!source) return null;
  const assumptions = financialAssumptions();
  const annual = source.annual || {};
  const costWithout = Number(annual.cost_without_bess_lei) || 0;
  const costWith = Number(annual.cost_with_bess_lei) || 0;
  const contractPrice = assumptions.contractPriceLeiMwh;
  const supplyComponent = assumptions.supplyComponentLeiMwh || 0;
  const eurRate = assumptions.eurRate || 5.1;
  const investmentEur = assumptions.investmentEur;
  const avgWithout = Number(annual.arithmetic_avg_monthly_without_bess_lei_mwh) || 0;
  const avgWith = Number(annual.arithmetic_avg_monthly_with_bess_lei_mwh) || 0;
  const bessReduction = avgWithout - avgWith;
  const diffVsContract = contractPrice - avgWith;
  const finalResult = diffVsContract - supplyComponent;
  const consumption = Number(annual.consumption_mwh) || Number(source.metrics?.totalConsumptionMwh) || 0;
  const impactLei = finalResult * consumption;
  const impactEur = eurRate > 0 ? impactLei / eurRate : 0;
  return {
    generatedAt: new Date().toISOString(),
    scenarioName: source.scenarioName,
    sourceGeneratedAt: source.generatedAt,
    assumptions,
    battery: clone(source.battery || {}),
    interpretation: {
      dayPct: Number(source.metrics?.dayPct) || 0,
      nightPct: Number(source.metrics?.nightPct) || 0,
    },
    annual: {
      consumption_mwh: consumption,
      cost_without_bess_lei: costWithout,
      cost_with_bess_lei: costWith,
      saving_lei: costWithout - costWith,
      contract_price_lei_mwh: contractPrice,
      supply_component_lei_mwh: supplyComponent,
      arithmetic_avg_monthly_without_bess_lei_mwh: avgWithout,
      arithmetic_avg_monthly_with_bess_lei_mwh: avgWith,
      weighted_price_without_bess_lei_mwh: Number(annual.weighted_price_without_bess_lei_mwh) || 0,
      weighted_price_with_bess_lei_mwh: Number(annual.weighted_price_with_bess_lei_mwh) || 0,
      bess_reduction_vs_without_bess_lei_mwh: bessReduction,
      contract_vs_pzu_with_bess_lei_mwh: diffVsContract,
      reduction_lei_mwh: finalResult,
      difference_vs_contract_lei_mwh: diffVsContract,
      final_result_lei_mwh: finalResult,
      impact_lei_year: impactLei,
      impact_eur_year: impactEur,
      investment_eur: investmentEur,
      payback_years: impactEur > 0 && investmentEur > 0 ? investmentEur / impactEur : 0,
    },
    monthly: (source.monthly || []).map((row, index) => {
      const withoutBess = Number(row.price_without_bess_lei_mwh) || 0;
      const withBess = Number(row.price_with_bess_lei_mwh) || 0;
      const reduction = withoutBess - withBess;
      const monthlyDiff = contractPrice - withBess;
      return {
        month: MONTH_SHORT[index] || row.month,
        contract_price_lei_mwh: contractPrice,
        price_without_bess_lei_mwh: withoutBess,
        price_with_bess_lei_mwh: withBess,
        bess_reduction_vs_without_bess_lei_mwh: reduction,
        reduction_lei_mwh: monthlyDiff,
        difference_vs_contract_lei_mwh: monthlyDiff,
        observation: monthlyObservation(monthlyDiff, monthlyDiff),
      };
    }),
  };
}

function financialSourceForActiveScenario() {
  if (!state.result) return null;
  return buildDashboardSnapshot(state.result, state.activeScenario);
}

function renderFinancialSummary(summary) {
  if (!summary) {
    $("financialStatus").textContent = "Selecteaza scenariul si ruleaza sinteza.";
    $("financialTitle").textContent = "Sinteza financiara - fara rulare";
    $("financialIndicatorRows").innerHTML = "";
    $("financialNarrative").innerHTML = "";
    $("financialMonthlyRows").innerHTML = "";
    $("financialAnnualRows").innerHTML = "";
    return;
  }
  const annual = summary.annual;
  const assumptions = summary.assumptions || defaultFinancialAssumptions();
  const battery = summary.battery || {};
  const dayPct = summary.interpretation?.dayPct || 0;
  const nightPct = summary.interpretation?.nightPct || 0;
  const capacityText =
    battery.storageMwh > 0
      ? `${numberFormat.format(battery.acMw)} MW AC / ${numberFormat.format(battery.storageMwh)} MWh`
      : summary.scenarioName;
  $("financialStatus").textContent = `Generata la ${dateTimeFormat.format(new Date(summary.generatedAt))}`;
  $("financialTitle").textContent = `Sinteza financiara - ${assumptions.client || "Client"} | capacitate baterie ${capacityText}`;

  const indicators = [
    ["Scenariu BESS analizat", summary.scenarioName || "-", "Capacitatea bateriei folosita in simulare."],
    ["Consum total analizat [MWh]", numberFormat.format(annual.consumption_mwh), "Volumul anual pe care se aplica optimizarea."],
    ["Consum zi / noapte [%]", `${numberFormat.format(dayPct)}% / ${numberFormat.format(nightPct)}%`, "Structura consumului explica potentialul de arbitraj orar."],
    ["Pret mediu ponderat cu BESS", `${numberFormat.format(annual.weighted_price_with_bess_lei_mwh)} lei/MWh`, "Reperul de cost cu stocare."],
    ["Pret contractual furnizare 2025", `${numberFormat.format(annual.contract_price_lei_mwh)} lei/MWh`, "Nivelul de comparatie comerciala."],
    ["Componenta furnizare PZU", `${numberFormat.format(annual.supply_component_lei_mwh)} lei/MWh`, "Componenta editabila scazuta din rezultatul anual."],
  ];
  $("financialIndicatorRows").innerHTML = "";
  indicators.forEach((row) => {
    const tr = document.createElement("tr");
    row.forEach((value, index) => {
      const td = document.createElement("td");
      td.textContent = value;
      if (index === 0) td.innerHTML = `<strong>${value}</strong>`;
      tr.appendChild(td);
    });
    $("financialIndicatorRows").appendChild(tr);
  });

  const notes = [
    `Scenariul PZU cu BESS ${annual.difference_vs_contract_lei_mwh >= 0 ? "ramane sub" : "este peste"} pretul contractual de ${numberFormat.format(annual.contract_price_lei_mwh)} lei/MWh cu ${numberFormat.format(Math.abs(annual.difference_vs_contract_lei_mwh))} lei/MWh.`,
    `Componenta de furnizare PZU este ${numberFormat.format(annual.supply_component_lei_mwh)} lei/MWh, iar rezultatul net este ${numberFormat.format(annual.final_result_lei_mwh)} lei/MWh.`,
    `Impactul anual indicativ, aplicand rezultatul net pe consumul analizat, este de aproximativ ${formatLei(annual.impact_lei_year)}.`,
  ];
  $("financialNarrative").innerHTML = "";
  notes.forEach((text, index) => {
    const div = document.createElement("div");
    div.className = "financial-note";
    div.textContent = `${index + 1}. ${text}`;
    $("financialNarrative").appendChild(div);
  });

  $("financialMonthlyRows").innerHTML = "";
  const maxMonthlyDiff = Math.max(
    ...summary.monthly.map((row) => Math.max(0, Number(row.difference_vs_contract_lei_mwh) || 0)),
    1,
  );
  summary.monthly.forEach((row) => {
    const tr = document.createElement("tr");
    [
      row.month,
      numberFormat.format(row.contract_price_lei_mwh),
      numberFormat.format(row.price_with_bess_lei_mwh),
      numberFormat.format(row.difference_vs_contract_lei_mwh),
      row.observation,
    ].forEach((value, index) => {
      const td = document.createElement("td");
      td.textContent = value;
      if (index === 3) {
        td.className = "table-data-bar";
        const diff = Math.max(0, Number(row.difference_vs_contract_lei_mwh) || 0);
        td.style.setProperty("--bar-pct", `${Math.min(100, (diff / maxMonthlyDiff) * 100)}%`);
      }
      tr.appendChild(td);
    });
    $("financialMonthlyRows").appendChild(tr);
  });

  const annualRows = [
    [
      "Medie lunara rezultate",
      numberFormat.format(annual.contract_price_lei_mwh),
      numberFormat.format(annual.arithmetic_avg_monthly_with_bess_lei_mwh),
      numberFormat.format(annual.difference_vs_contract_lei_mwh),
      numberFormat.format(annual.supply_component_lei_mwh),
      numberFormat.format(annual.final_result_lei_mwh),
      "Medii simple ale celor 12 luni din simulare",
    ],
    ["Impact indicativ [lei/an]", "", "", "", "", formatLei(annual.impact_lei_year), "Consum total x rezultat net"],
    ["Impact indicativ [euro/an]", "", "", "", "", formatEuro(annual.impact_eur_year), `Curs EUR ${numberFormat.format(assumptions.eurRate)}`],
    ["Valoare investitie [euro]", "", "", "", "", formatEuro(annual.investment_eur), "Ipoteza editabila"],
    [
      "Termen de recuperare investitie ani",
      "",
      "",
      "",
      "",
      annual.payback_years > 0 ? numberFormat.format(annual.payback_years) : "-",
      annual.payback_years > 0 ? "Investitie / impact anual euro" : "Necesita investitie si impact pozitiv",
    ],
  ];
  $("financialAnnualRows").innerHTML = "";
  annualRows.forEach((row) => {
    const tr = document.createElement("tr");
    row.forEach((value, index) => {
      const td = document.createElement("td");
      td.textContent = value;
      if (index === 0) td.innerHTML = `<strong>${value}</strong>`;
      tr.appendChild(td);
    });
    $("financialAnnualRows").appendChild(tr);
  });
}

function runFinancialSummary() {
  const project = state.result ? ensureActiveProject() : activeProject();
  const simulation = ensureSimulationContext();
  const source = financialSourceForActiveScenario();
  if (!project || !simulation || !source) {
    setMessages(["Ruleaza mai intai o simulare si selecteaza scenariul pentru sinteza financiara."], true);
    return null;
  }
  const summary = buildFinancialSummary(source);
  simulation.activeScenario = source.scenarioName;
  simulation.dashboard = source;
  simulation.financialSummarySource = source;
  simulation.financialSummary = summary;
  project.dashboardSnapshot = source;
  project.financialSummarySource = source;
  project.financialSummary = summary;
  project.updatedAt = new Date().toISOString();
  persistProjects();
  renderProjectsMenu();
  renderFinancialSummary(summary);
  setMessages([`Sinteza financiara a fost generata pentru scenariul ${source.scenarioName}.`]);
  return summary;
}

function activeFinancialSummary() {
  return activeSimulation()?.financialSummary || activeProject()?.financialSummary || null;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function safeFilenamePart(value, fallback = "raport") {
  return String(value || fallback)
    .trim()
    .replace(/[^a-z0-9_-]+/gi, "_")
    .replace(/^_+|_+$/g, "") || fallback;
}

async function exportFinancialSummary() {
  let summary = activeFinancialSummary();
  if (!summary) summary = runFinancialSummary();
  if (!summary) return;

  $("exportFinancialBtn").disabled = true;
  $("exportFinancialBtn").textContent = "Generez...";
  try {
    const response = await fetch("/api/export-financial-summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ summary }),
    });
    if (!response.ok) {
      let message = "Exportul sintezei a esuat.";
      try {
        const payload = await response.json();
        message = payload.error || message;
      } catch {
        // Response is not JSON.
      }
      throw new Error(message);
    }
    const blob = await response.blob();
    const name = `Sinteza_financiara_${String(summary.scenarioName || "scenariu").replace(/[^a-z0-9_-]+/gi, "_")}.xlsx`;
    downloadBlob(blob, name);
    setMessages(["Fisierul Excel de sinteza financiara a fost generat."]);
  } catch (error) {
    setMessages([error.message], true);
  } finally {
    $("exportFinancialBtn").disabled = false;
    $("exportFinancialBtn").textContent = "Descarca Excel";
  }
}

async function exportCompleteReport() {
  if (!state.result) {
    setMessages(["Ruleaza mai intai simularea, apoi sinteza financiara."], true);
    return;
  }
  const project = ensureActiveProject();
  const simulation = ensureSimulationContext();
  if (!project || !simulation) {
    setMessages(["Nu am gasit simularea activa pentru raportul complet."], true);
    return;
  }

  let summary = activeFinancialSummary();
  if (!summary || summary.scenarioName !== state.activeScenario) {
    summary = runFinancialSummary();
  }
  if (!summary) return;

  const scenario = scenarioByName(summary.scenarioName);
  const dashboard = buildDashboardSnapshot(state.result, summary.scenarioName);
  if (!scenario || !dashboard) {
    setMessages(["Nu am gasit scenariul selectat pentru export."], true);
    return;
  }

  $("exportReportBtn").disabled = true;
  $("exportReportBtn").textContent = "Generez...";
  try {
    const response = await fetch("/api/export-complete-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectName: project.name || $("projectName").value,
        dashboard,
        financialSummary: summary,
        scenario: clone(scenario),
        scenarios: scenarioCostsFromResult(state.result),
      }),
    });
    if (!response.ok) {
      let message = "Exportul raportului complet a esuat.";
      try {
        const payload = await response.json();
        message = payload.error || message;
      } catch {
        // Response is not JSON.
      }
      throw new Error(message);
    }
    const blob = await response.blob();
    const name = `Raport_BESS_${safeFilenamePart(project.name || $("projectName").value, "Proiect_BESS")}_${safeFilenamePart(summary.scenarioName, "scenariu")}.xlsx`;
    downloadBlob(blob, name);
    setMessages(["Raportul complet a fost generat cu valori inghetate, fara formule vizibile."]);
  } catch (error) {
    setMessages([error.message], true);
  } finally {
    $("exportReportBtn").disabled = false;
    $("exportReportBtn").textContent = "Descarca raport complet";
  }
}

function populateScenarioSelect(select, scenarios, activeName) {
  select.innerHTML = "";
  scenarios.forEach((scenario) => {
    const option = document.createElement("option");
    option.value = scenario.name;
    option.textContent = scenario.name;
    select.appendChild(option);
  });
  if (activeName) select.value = activeName;
}

function syncScenarioSelectors(activeName) {
  ["activeScenario", "monthlyScenario"].forEach((id) => {
    const select = $(id);
    if (select && select.value !== activeName) select.value = activeName;
  });
}

function renderScenarioTabs(activeName) {
  const tabs = $("scenarioTabs");
  tabs.innerHTML = "";
  (state.result?.scenarios || []).forEach((scenario) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.scenario = scenario.name;
    button.className = scenario.name === activeName ? "active" : "";
    button.textContent = scenario.name;
    tabs.appendChild(button);
  });
}

function bessAction(row) {
  if ((Number(row.charge_mwh) || 0) > 0) return "Incarcare";
  if ((Number(row.discharge_mwh) || 0) > 0) return "Descarcare";
  return "Standby";
}

function scenarioDayKey(row, index) {
  const text = String(row.timestamp || "").trim();
  const iso = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const ro = text.match(/^(\d{2})[-.](\d{2})[-.](\d{4})/);
  if (ro) return `${ro[3]}-${ro[2]}-${ro[1]}`;
  if (text.includes("T")) return text.split("T", 1)[0];
  if (text.includes(" ")) return text.split(" ", 1)[0];
  return `day-${Math.floor(index / 24) + 1}`;
}

function scenarioPriceRanks(hourly = []) {
  const ranks = hourly.map(() => ({ chargeRank: 0, dischargeRank: 0 }));
  const groups = new Map();
  hourly.forEach((row, index) => {
    const key = scenarioDayKey(row, index);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ index, price: Number(row.price_lei_mwh) || 0 });
  });
  groups.forEach((items) => {
    [...items]
      .sort((a, b) => a.price - b.price || a.index - b.index)
      .forEach((item, rank) => {
        ranks[item.index].chargeRank = rank + 1;
      });
    [...items]
      .sort((a, b) => b.price - a.price || b.index - a.index)
      .forEach((item, rank) => {
        ranks[item.index].dischargeRank = rank + 1;
      });
  });
  return ranks;
}

function renderScenarioBehaviorTabs() {
  const tabs = $("scenarioBehaviorTabs");
  if (!tabs) return;
  tabs.querySelectorAll("button[data-behavior-view]").forEach((button) => {
    button.classList.toggle("active", button.dataset.behaviorView === state.scenarioBehaviorView);
  });
}

function renderScenarioBehaviorHeader(view) {
  const head = $("scenarioBehaviorHead");
  if (!head) return;
  const columns =
    view === "all"
      ? [
          "Ora",
          "Pret lei/MWh",
          "Rank inc",
          "Rank desc",
          "Candidat inc",
          "Candidat desc",
          "Actiune",
          "Incarcare MWh",
          "Descarcare MWh",
          "SOC start",
          "SOC final",
          "Cost cu BESS",
        ]
      : [
          "Ora",
          "Actiune",
          "Pret lei/MWh",
          "Incarcare MWh",
          "Descarcare MWh",
          "SOC start",
          "SOC final",
          "Cost cu BESS",
        ];
  const tr = document.createElement("tr");
  columns.forEach((column) => {
    const th = document.createElement("th");
    th.textContent = column;
    tr.appendChild(th);
  });
  head.innerHTML = "";
  head.appendChild(tr);
}

function invalidateFinancialSummary() {
  if (state.isApplyingProject) return;
  const project = activeProject();
  const simulation = activeSimulation();
  if (simulation?.financialSummary) {
    simulation.financialSummary = null;
    project.financialSummary = null;
    renderFinancialSummary(null);
  }
  scheduleSaveProjectDraft();
}

function render(options = {}) {
  if (!state.result) return;
  const inputs = state.result.inputs;
  const metricNumber = (value) => numberFormat.format(Number(value) || 0);
  $("metricHours").textContent = inputs.hours;
  $("metricConsumption").textContent = metricNumber(inputs.total_consumption_mwh);
  $("metricAc").textContent = metricNumber(inputs.max_ac_mw);
  $("metricPeak").textContent = metricNumber(inputs.peak_load_mw);
  $("metricHeadroom").textContent = metricNumber(inputs.headroom_mw);
  $("metricDay").textContent = metricNumber(inputs.day_consumption_mwh);
  $("metricNight").textContent = metricNumber(inputs.night_consumption_mwh);
  $("metricBest").textContent = state.result.best_scenario_by_monthly_average || "-";

  const activeName = scenarioFromResult(state.result, state.activeScenario)?.name || state.result.scenarios[0]?.name || "";
  populateScenarioSelect($("activeScenario"), state.result.scenarios, activeName);
  populateScenarioSelect($("monthlyScenario"), state.result.scenarios, activeName);
  renderScenario(activeName, { persist: options.persistScenario === true });
  renderFinancialSummary(activeSimulation()?.financialSummary || null);
  setMessages(state.result.warnings || []);
}

function renderScenario(name, options = {}) {
  const scenario = scenarioByName(name);
  if (!scenario) return;
  state.activeScenario = scenario.name;
  syncScenarioSelectors(scenario.name);
  renderScenarioTabs(scenario.name);
  const snapshot = buildDashboardSnapshot(state.result, scenario.name);
  const annual = scenario.summary.annual;
  $("annualNoBess").textContent = numberFormat.format(annual.arithmetic_avg_monthly_without_bess_lei_mwh);
  $("annualWithBess").textContent = numberFormat.format(annual.arithmetic_avg_monthly_with_bess_lei_mwh);
  $("annualReduction").textContent = numberFormat.format(annual.reduction_lei_mwh);
  $("annualCharges").textContent = annual.charge_count;
  $("annualDischarges").textContent = annual.discharge_count;

  const tbody = $("monthlyRows");
  tbody.innerHTML = "";
  scenario.summary.monthly.forEach((row) => {
    const tr = document.createElement("tr");
    [
      row.month,
      numberFormat.format(row.price_without_bess_lei_mwh),
      numberFormat.format(row.price_with_bess_lei_mwh),
      numberFormat.format(row.reduction_lei_mwh),
      row.charge_count,
      row.discharge_count,
    ].forEach((value, index) => {
      const td = document.createElement("td");
      if (index >= 4) td.className = "is-hidden";
      td.textContent = value;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  renderScenarioCosts(scenario.name);
  renderScenarioBehavior(scenario);
  drawScenarioComparisonChart(state.result.scenarios, scenario.name);
  drawMonthlyChart(scenario.summary.monthly);
  if (options.persist) {
    persistDashboardSelection(snapshot);
    renderFinancialSummary(activeSimulation()?.financialSummary || null);
  }
}

function renderScenarioCosts(activeName) {
  const tbody = $("scenarioCostRows");
  tbody.innerHTML = "";
  scenarioCostsFromResult(state.result).forEach((row) => {
    const tr = document.createElement("tr");
    if (row.name === activeName) tr.className = "active";
    [
      row.name,
      numberFormat.format(row.acMw),
      numberFormat.format(row.storageMwh),
      formatLei(row.costWithoutBessLei),
      formatLei(row.costWithBessLei),
      numberFormat.format(row.priceWithoutBessLeiMwh),
      numberFormat.format(row.priceWithBessLeiMwh),
      numberFormat.format(row.reductionLeiMwh),
    ].forEach((value) => {
      const td = document.createElement("td");
      td.textContent = value;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}

function renderScenarioBehavior(scenario) {
  const tbody = $("scenarioBehaviorRows");
  tbody.innerHTML = "";
  renderScenarioBehaviorTabs();
  renderScenarioBehaviorHeader(state.scenarioBehaviorView);

  const hourly = scenario.hourly || [];
  const actionRows = hourly.filter((row) => bessAction(row) !== "Standby");
  const rows = state.scenarioBehaviorView === "all" ? hourly : actionRows;
  $("scenarioBehaviorCount").textContent =
    state.scenarioBehaviorView === "all" ? `${rows.length} ore` : `${actionRows.length} decizii`;

  if (!rows.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = state.scenarioBehaviorView === "all" ? 12 : 8;
    td.textContent =
      state.scenarioBehaviorView === "all"
        ? "Nu exista ore pentru scenariul selectat."
        : "Nu exista ore de incarcare sau descarcare pentru scenariul selectat.";
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  const ranks = state.scenarioBehaviorView === "all" ? scenarioPriceRanks(hourly) : [];
  const fragment = document.createDocumentFragment();
  rows.forEach((row, visibleIndex) => {
    const action = bessAction(row);
    const tr = document.createElement("tr");
    const hourlyIndex = state.scenarioBehaviorView === "all" ? visibleIndex : hourly.indexOf(row);
    const rank = ranks[hourlyIndex] || { chargeRank: 0, dischargeRank: 0 };
    const classes = [];
    if (action === "Incarcare") classes.push("charge");
    if (action === "Descarcare") classes.push("discharge");
    if (action === "Standby" && row.candidate_charge) classes.push("candidate-charge");
    if (action === "Standby" && row.candidate_discharge) classes.push("candidate-discharge");
    tr.className = classes.join(" ");

    const values =
      state.scenarioBehaviorView === "all"
        ? [
            row.timestamp || "",
            numberFormat.format(Number(row.price_lei_mwh) || 0),
            rank.chargeRank || "-",
            rank.dischargeRank || "-",
            row.candidate_charge ? "Da" : "-",
            row.candidate_discharge ? "Da" : "-",
            action,
            numberFormat.format(Number(row.charge_mwh) || 0),
            numberFormat.format(Number(row.discharge_mwh) || 0),
            numberFormat.format(Number(row.soc_start_mwh) || 0),
            numberFormat.format(Number(row.soc_final_mwh) || 0),
            formatLei(Number(row.cost_with_bess_lei) || 0),
          ]
        : [
            row.timestamp || "",
            action,
            numberFormat.format(Number(row.price_lei_mwh) || 0),
            numberFormat.format(Number(row.charge_mwh) || 0),
            numberFormat.format(Number(row.discharge_mwh) || 0),
            numberFormat.format(Number(row.soc_start_mwh) || 0),
            numberFormat.format(Number(row.soc_final_mwh) || 0),
            formatLei(Number(row.cost_with_bess_lei) || 0),
          ];

    const actionColumnIndex = state.scenarioBehaviorView === "all" ? 6 : 1;
    values.forEach((value, columnIndex) => {
      const td = document.createElement("td");
      if (columnIndex === actionColumnIndex) td.className = "action-cell";
      td.textContent = value;
      tr.appendChild(td);
    });
    fragment.appendChild(tr);
  });
  tbody.appendChild(fragment);
}

function drawScenarioComparisonChart(scenarios, activeName) {
  const canvas = $("scenarioComparisonChart");
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  const rows = scenarioCostsFromResult({ scenarios });
  ctx.fillStyle = "#0a1d32";
  ctx.font = "700 18px Montserrat, Arial";
  ctx.fillText("Comparator scenarii - pret mediu anual", 28, 28);
  if (!rows.length) return;

  const paddingLeft = 56;
  const paddingRight = 26;
  const paddingTop = 58;
  const paddingBottom = 54;
  const plotW = width - paddingLeft - paddingRight;
  const plotH = height - paddingTop - paddingBottom;
  const max = Math.max(...rows.flatMap((row) => [row.priceWithoutBessLeiMwh, row.priceWithBessLeiMwh]), 1);
  const groupW = plotW / rows.length;
  const barW = Math.max(12, Math.min(32, groupW * 0.26));

  ctx.strokeStyle = "#d8e0e7";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(paddingLeft, paddingTop);
  ctx.lineTo(paddingLeft, height - paddingBottom);
  ctx.lineTo(width - paddingRight, height - paddingBottom);
  ctx.stroke();

  ctx.fillStyle = "#526b72";
  ctx.font = "600 11px Montserrat, Arial";
  ctx.fillText("Fara BESS", paddingLeft + 4, 48);
  ctx.fillStyle = "#8aa3b8";
  ctx.fillRect(paddingLeft - 16, 39, 12, 12);
  ctx.fillStyle = "#526b72";
  ctx.fillText("Cu BESS", paddingLeft + 100, 48);
  ctx.fillStyle = "#16805f";
  ctx.fillRect(paddingLeft + 80, 39, 12, 12);

  rows.forEach((row, index) => {
    const x = paddingLeft + index * groupW + groupW * 0.3;
    const hWithout = (row.priceWithoutBessLeiMwh / max) * plotH;
    const hWith = (row.priceWithBessLeiMwh / max) * plotH;
    const yBase = height - paddingBottom;
    ctx.fillStyle = "#8aa3b8";
    ctx.fillRect(x, yBase - hWithout, barW, hWithout);
    ctx.fillStyle = row.name === activeName ? "#4f9b27" : "#16805f";
    ctx.fillRect(x + barW + 5, yBase - hWith, barW, hWith);
    ctx.fillStyle = "#0a1d32";
    ctx.font = row.name === activeName ? "700 11px Montserrat, Arial" : "600 11px Montserrat, Arial";
    ctx.textAlign = "center";
    ctx.fillText(row.name, x + barW, height - 24);
    ctx.fillText(numberFormat.format(row.priceWithBessLeiMwh), x + barW, Math.max(54, yBase - hWith - 7));
  });
  ctx.textAlign = "left";
}

function drawMonthlyChart(monthly) {
  const canvas = $("resultChart");
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#0a1d32";
  ctx.font = "700 18px Montserrat, Arial";
  ctx.fillText("Preturi medii lunare - scenariul selectat", 28, 28);
  if (!monthly.length) return;
  const values = monthly.flatMap((row) => [row.price_without_bess_lei_mwh, row.price_with_bess_lei_mwh]);
  const max = Math.max(...values, 1);
  const padding = 44;
  const plotW = width - padding * 2;
  const plotH = height - padding * 2 - 24;
  const groupW = plotW / monthly.length;
  const barW = Math.max(8, groupW * 0.28);

  ctx.strokeStyle = "#d8e0e7";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding, padding + 24);
  ctx.lineTo(padding, height - padding);
  ctx.lineTo(width - padding, height - padding);
  ctx.stroke();

  ctx.fillStyle = "#526b72";
  ctx.font = "600 11px Montserrat, Arial";
  ctx.fillText("Fara BESS", padding + 4, 50);
  ctx.fillStyle = "#8aa3b8";
  ctx.fillRect(padding - 16, 41, 12, 12);
  ctx.fillStyle = "#526b72";
  ctx.fillText("Cu BESS", padding + 100, 50);
  ctx.fillStyle = "#16805f";
  ctx.fillRect(padding + 80, 41, 12, 12);

  monthly.forEach((row, index) => {
    const x = padding + index * groupW + groupW * 0.25;
    const h1 = (row.price_without_bess_lei_mwh / max) * plotH;
    const h2 = (row.price_with_bess_lei_mwh / max) * plotH;
    ctx.fillStyle = "#8aa3b8";
    ctx.fillRect(x, height - padding - h1, barW, h1);
    ctx.fillStyle = "#16805f";
    ctx.fillRect(x + barW + 4, height - padding - h2, barW, h2);
    ctx.fillStyle = "#0a1d32";
    ctx.font = "600 10px Montserrat, Arial";
    ctx.textAlign = "center";
    ctx.fillText(row.month || MONTH_SHORT[index] || "", x + barW, height - 18);
    ctx.fillText(numberFormat.format(row.price_with_bess_lei_mwh), x + barW + 4, Math.max(60, height - padding - h2 - 6));
  });
  ctx.textAlign = "left";
}

$("runBtn").addEventListener("click", runSimulation);
$("runFinancialBtn").addEventListener("click", runFinancialSummary);
$("exportFinancialBtn").addEventListener("click", exportFinancialSummary);
$("exportReportBtn").addEventListener("click", exportCompleteReport);
$("activeScenario").addEventListener("change", (event) => renderScenario(event.target.value, { persist: true }));
$("monthlyScenario").addEventListener("change", (event) => renderScenario(event.target.value, { persist: true }));
$("scenarioTabs").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-scenario]");
  if (!button) return;
  renderScenario(button.dataset.scenario, { persist: true });
});
$("scenarioBehaviorTabs").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-behavior-view]");
  if (!button) return;
  state.scenarioBehaviorView = button.dataset.behaviorView;
  if (state.activeScenario) {
    renderScenario(state.activeScenario, { persist: false });
  } else {
    renderScenarioBehaviorTabs();
    renderScenarioBehaviorHeader(state.scenarioBehaviorView);
  }
});
$("curveTable").addEventListener("input", (event) => {
  if (!(event.target instanceof HTMLInputElement)) return;
  const monthIndex = Number(event.target.dataset.month ?? state.curveMonthIndex);
  const dayIndex = Number(event.target.dataset.day);
  const hour = Number(event.target.dataset.hour);
  setCurveValue(
    state.curveKind,
    monthIndex,
    dayIndex,
    hour,
    event.target.value,
  );
  scheduleSaveProjectDraft();
  refreshChecksFromCurrentInputs();
});
$("curveTable").addEventListener("paste", (event) => {
  if (!(event.target instanceof HTMLInputElement)) return;
  const text = event.clipboardData?.getData("text");
  if (!text) return;
  const rows = pastedRows(text);
  if (!rows.length) return;
  event.preventDefault();
  if (state.curveView === "consolidated") {
    const startIndex = Number(event.target.dataset.annualIndex);
    consolidatedPasteValues(rows).forEach((value, offset) => {
      const position = annualIndexToCurvePosition(startIndex + offset);
      if (!position) return;
      setCurveValue(state.curveKind, position.monthIndex, position.dayIndex, position.hour, value);
    });
    renderCurveTable();
    scheduleSaveProjectDraft();
    refreshChecksFromCurrentInputs();
    return;
  }
  const startDay = Number(event.target.dataset.day);
  const startHour = Number(event.target.dataset.hour);
  rows.forEach((row, rowOffset) => {
    row.forEach((value, colOffset) => {
      const hour = startHour + rowOffset;
      const day = startDay + colOffset;
      if (hour < 24 && day < monthDays(state.curveMonthIndex)) {
        setCurveValue(state.curveKind, state.curveMonthIndex, day, hour, normalizePastedCurveValue(value));
      }
    });
  });
  renderCurveTable();
  scheduleSaveProjectDraft();
  refreshChecksFromCurrentInputs();
});
["priceFile"].forEach((id) => {
  $(id).addEventListener("change", () => refreshChecksFromCurrentInputs());
});
$("priceYear").addEventListener("change", () => {
  syncPriceImportVisibility();
  renderCurveTable();
  scheduleSaveProjectDraft();
  refreshChecksFromCurrentInputs();
});
$("newProjectBtn").addEventListener("click", () => {
  saveDraftToActiveProject();
  const project = createProject();
  state.projects.unshift(project);
  persistProjects();
  applyProject(project, { saveCurrent: false });
});
$("projectName").addEventListener("input", scheduleSaveProjectDraft);
$("projectTabs").addEventListener("click", (event) => {
  const button = event.target.closest(".project-tab");
  if (!button) return;
  const project = state.projects.find((item) => item.id === button.dataset.projectId);
  applyProject(project);
});
$("simulationHistory").addEventListener("click", (event) => {
  const button = event.target.closest(".history-item");
  if (!button) return;
  activateSimulation(button.dataset.simulationId);
});
["atrMw", "rtEff", "initialSoc", "minSoc", "customAc", "customStorage"].forEach((id) => {
  $(id).addEventListener("input", scheduleSaveProjectDraft);
});
["financialClient", "financialContractPrice", "financialSupplyComponent", "financialEurRate", "financialInvestmentEur"].forEach((id) => {
  $(id).addEventListener("input", invalidateFinancialSummary);
});
$("scenarioList").addEventListener("change", scheduleSaveProjectDraft);
$("authForm").addEventListener("submit", handleAuthSubmit);
$("authToggle").addEventListener("click", () => {
  state.authMode = state.authMode === "login" ? "create" : "login";
  renderAuthMode();
});
$("logoutBtn").addEventListener("click", logout);
initCurveControls();
loadAuthSession();
renderAuthMode();
renderAuthState();
if (state.user) {
  loadProjects();
  syncPriceImportVisibility();
  refreshChecksFromCurrentInputs();
}
