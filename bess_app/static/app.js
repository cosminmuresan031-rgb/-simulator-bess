const state = {
  result: null,
  activeScenario: null,
  scenarioBehaviorView: "actions",
  scenarioBehaviorMonth: "all",
  activeAppView: "profile",
  activeReportType: "executive",
  curveKind: "consumption",
  curveView: "monthly",
  curveMonthIndex: 0,
  curves: {
    consumption: {},
    pv: {},
  },
  priceCache: {},
  priceSource: "2025 implicit",
  lastProfileRows: [],
  profileAnalytics: null,
  procurementDna: null,
  commercialOpportunity: null,
  salesIntelligence: null,
  advancedReport: null,
  projects: [],
  activeProjectId: null,
  isApplyingProject: false,
  user: null,
  authMode: "login",
};

const BRAND = {
  primary: "#0F172A",
  secondary: "#334155",
  background: "#FFFFFF",
  surface: "#F8FAFC",
  border: "#E2E8F0",
  success: "#10B981",
  warning: "#F59E0B",
  risk: "#EF4444",
  muted: "#64748B",
  night: "#334155",
  pv: "#F59E0B",
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

const PROFILE_ROADMAP_LAYOUTS = {
  client: {
    profileTitle: "Opportunity Dashboard",
    executiveTitle: "Opportunity Dashboard",
    analyticsTitle: "Date generate sourcing",
  },
  sourcing: {
    profileTitle: "2. Contract Opportunity",
    executiveTitle: "Opportunity Dashboard",
    analyticsTitle: "Date generate sourcing",
  },
  procurement: {
    profileTitle: "3. Energy Profile Intelligence",
    executiveTitle: "Opportunity Dashboard",
    analyticsTitle: "Date generate sourcing",
  },
  efficiency: {
    profileTitle: "4. Opportunities",
    executiveTitle: "Opportunity Dashboard",
    analyticsTitle: "Profil mediu orar",
  },
  advanced: {
    profileTitle: "5. Visual Insights",
    executiveTitle: "Opportunity Dashboard",
    analyticsTitle: "Date generate sourcing",
  },
  reports: {
    profileTitle: "6. Reports",
    executiveTitle: "Opportunity Dashboard",
    analyticsTitle: "Date generate sourcing",
  },
};
const PROFILE_BREADCRUMBS = {
  client: "Dashboard",
  sourcing: "Dashboard > Contract Opportunity",
  procurement: "Dashboard > Energy Profile Intelligence",
  efficiency: "Dashboard > Opportunities",
  advanced: "Dashboard > Visual Insights",
  reports: "Dashboard > Reports",
  simulator: "Dashboard > Opportunities > Storage Opportunity > BESS Simulator",
};
const PROFILE_CONTRACT_FIELD_IDS = [
  "profileClientName",
  "profileCui",
  "profileCounty",
  "profileDistributor",
  "profileVoltage",
  "profileAtrKw",
  "profileApprovedPowerKw",
  "profileReservedPowerKw",
  "profileCurrentContract",
  "profileProsumer",
  "profileExistingPv",
  "profilePvKwp",
  "profileReactiveCostLei",
];

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

function hideLoadingScreen() {
  const loading = $("loadingScreen");
  if (!loading) return;
  loading.classList.add("is-done");
  window.setTimeout(() => loading.classList.add("is-hidden"), 420);
}

function setAppView(view) {
  state.activeAppView = view === "profile" ? "profile" : "simulator";
  $("simulatorView")?.classList.toggle("is-hidden", state.activeAppView !== "simulator");
  $("consumptionProfileView")?.classList.toggle("is-hidden", state.activeAppView !== "profile");
  document.querySelectorAll(".main-menu-item").forEach((button) => {
    button.classList.toggle("active", button.dataset.appView === state.activeAppView);
  });
  document.querySelector('#profileRoadmapTabs button[data-open-simulator="true"]')?.classList.toggle("active", state.activeAppView === "simulator");
  if (state.activeAppView === "profile") renderConsumptionProfile();
  else setBreadcrumb("simulator");
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

function defaultProfileContract() {
  return {
    clientName: "",
    cui: "",
    county: "",
    distributor: "",
    voltage: "JT",
    atrKw: 0,
    approvedPowerKw: 0,
    reservedPowerKw: 0,
    currentContract: "",
    prosumer: "Nu",
    existingPv: "Nu",
    pvKwp: 0,
    reactiveCostLei: 0,
  };
}

function profileContractData() {
  return {
    clientName: $("profileClientName")?.value.trim() || "",
    cui: $("profileCui")?.value.trim() || "",
    county: $("profileCounty")?.value.trim() || "",
    distributor: $("profileDistributor")?.value || "",
    voltage: $("profileVoltage")?.value || "JT",
    atrKw: parseNumber($("profileAtrKw")?.value),
    approvedPowerKw: parseNumber($("profileApprovedPowerKw")?.value),
    reservedPowerKw: parseNumber($("profileReservedPowerKw")?.value),
    currentContract: $("profileCurrentContract")?.value || "",
    prosumer: $("profileProsumer")?.value || "Nu",
    existingPv: $("profileExistingPv")?.value || "Nu",
    pvKwp: parseNumber($("profilePvKwp")?.value),
    reactiveCostLei: parseNumber($("profileReactiveCostLei")?.value),
  };
}

function applyProfileContract(values = {}) {
  const merged = { ...defaultProfileContract(), ...(values || {}) };
  if ($("profileClientName")) $("profileClientName").value = merged.clientName || "";
  if ($("profileCui")) $("profileCui").value = merged.cui || "";
  if ($("profileCounty")) $("profileCounty").value = merged.county || "";
  if ($("profileDistributor")) $("profileDistributor").value = merged.distributor || "";
  if ($("profileVoltage")) $("profileVoltage").value = merged.voltage || "JT";
  if ($("profileAtrKw")) $("profileAtrKw").value = merged.atrKw || 0;
  if ($("profileApprovedPowerKw")) $("profileApprovedPowerKw").value = merged.approvedPowerKw || 0;
  if ($("profileReservedPowerKw")) $("profileReservedPowerKw").value = merged.reservedPowerKw || 0;
  if ($("profileCurrentContract")) $("profileCurrentContract").value = merged.currentContract || "";
  if ($("profileProsumer")) $("profileProsumer").value = merged.prosumer || "Nu";
  if ($("profileExistingPv")) $("profileExistingPv").value = merged.existingPv || "Nu";
  if ($("profilePvKwp")) $("profilePvKwp").value = merged.pvKwp || 0;
  if ($("profileReactiveCostLei")) $("profileReactiveCostLei").value = merged.reactiveCostLei || 0;
  updateTopbarContext(merged);
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

function formatPercent(value) {
  return `${numberFormat.format(Number(value) || 0)}%`;
}

function formatMetric(value, suffix = "") {
  const number = Number(value) || 0;
  return `${numberFormat.format(number)}${suffix}`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
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

function hourInRange(hour, startHour, endHour) {
  if (startHour <= endHour) return hour >= startHour && hour <= endHour;
  return hour >= startHour || hour <= endHour;
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
  } else {
    renderMonthlyCurveTable();
  }
  renderConsumptionProfile();
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
    profileContract: defaultProfileContract(),
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
  project.profileContract = profileContractData();
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
  applyProfileContract(project.profileContract);
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
  project.profileContract = profileContractData();
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
    state.lastProfileRows = rows;
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
  state.lastProfileRows = rows;
  renderImportChecks(checks);
  renderExecutiveDashboard(buildConsumptionProfile(), rows);
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

function buildConsumptionProfile() {
  const daily = [];
  const monthly = MONTHS.map((month, monthIndex) => {
    const consumption = monthValues("consumption", monthIndex);
    const pv = monthValues("pv", monthIndex);
    const days = monthDays(monthIndex);
    const row = {
      month: month.label,
      monthKey: month.key,
      consumptionMwh: 0,
      dayMwh: 0,
      nightMwh: 0,
      sourcingDayMwh: 0,
      sourcingNightMwh: 0,
      sourcingOtherMwh: 0,
      pvMwh: 0,
      peakMw: 0,
      enteredHours: 0,
      expectedHours: days * 24,
    };

    for (let dayIndex = 0; dayIndex < days; dayIndex += 1) {
      const dailyRow = {
        monthIndex,
        dayIndex,
        dayMwh: 0,
        nightMwh: 0,
        pvMwh: 0,
        totalMwh: 0,
      };
      for (let hour = 0; hour < 24; hour += 1) {
        const consumptionValue = consumption[dayIndex]?.[hour] ?? "";
        const pvValue = pv[dayIndex]?.[hour] ?? "";
        const consumptionMwh = parseNumber(consumptionValue);
        const pvMwh = parseNumber(pvValue);
        if (hasValue(consumptionValue)) row.enteredHours += 1;
        row.consumptionMwh += consumptionMwh;
        row.pvMwh += pvMwh;
        row.peakMw = Math.max(row.peakMw, consumptionMwh);
        if (hour >= 7 && hour < 22) row.dayMwh += consumptionMwh;
        else row.nightMwh += consumptionMwh;
        const isWarmSeason = monthIndex >= 2 && monthIndex <= 8;
        const isSourcingDay = isWarmSeason ? hourInRange(hour, 9, 21) : hourInRange(hour, 9, 16);
        const isSourcingNight = hourInRange(hour, 22, 8);
        dailyRow.totalMwh += consumptionMwh;
        dailyRow.pvMwh += pvMwh;
        if (isSourcingDay) row.sourcingDayMwh += consumptionMwh;
        else if (isSourcingNight) row.sourcingNightMwh += consumptionMwh;
        else row.sourcingOtherMwh += consumptionMwh;
        if (isSourcingDay) dailyRow.dayMwh += consumptionMwh;
        else if (isSourcingNight) dailyRow.nightMwh += consumptionMwh;
      }
      daily.push(dailyRow);
    }
    return row;
  });

  const totals = monthly.reduce(
    (acc, row) => {
      acc.consumptionMwh += row.consumptionMwh;
      acc.dayMwh += row.dayMwh;
      acc.nightMwh += row.nightMwh;
      acc.pvMwh += row.pvMwh;
      acc.peakMw = Math.max(acc.peakMw, row.peakMw);
      acc.enteredHours += row.enteredHours;
      acc.expectedHours += row.expectedHours;
      return acc;
    },
    { consumptionMwh: 0, dayMwh: 0, nightMwh: 0, pvMwh: 0, peakMw: 0, enteredHours: 0, expectedHours: 0 },
  );
  totals.averageMw = totals.enteredHours > 0 ? totals.consumptionMwh / totals.enteredHours : 0;
  return { monthly, daily, totals };
}

function rowHour(row, fallbackIndex = 0) {
  const hour = Number(String(row?.timestamp || "").slice(11, 13));
  return Number.isFinite(hour) ? hour : fallbackIndex % 24;
}

function rowDateParts(row, fallbackIndex = 0) {
  const timestamp = String(row?.timestamp || "").trim();
  const match = timestamp.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2})/);
  if (match) {
    return {
      year: Number(match[1]),
      monthIndex: Number(match[2]) - 1,
      day: Number(match[3]),
      hour: Number(match[4]),
    };
  }
  const position = annualIndexToCurvePosition(fallbackIndex);
  return {
    year: selectedYear(),
    monthIndex: position?.monthIndex ?? 0,
    day: (position?.dayIndex ?? 0) + 1,
    hour: position?.hour ?? fallbackIndex % 24,
  };
}

function isWeekendRow(row, fallbackIndex = 0) {
  const parts = rowDateParts(row, fallbackIndex);
  const day = new Date(parts.year, parts.monthIndex, parts.day).getDay();
  return day === 0 || day === 6;
}

function sumConsumption(rows, predicate = () => true) {
  return rows.reduce((sum, row, index) => {
    if (!predicate(row, index)) return sum;
    return sum + (Number(row.consumption_mwh) || 0);
  }, 0);
}

function average(values) {
  const filtered = values.filter((value) => Number.isFinite(value));
  if (!filtered.length) return 0;
  return filtered.reduce((sum, value) => sum + value, 0) / filtered.length;
}

function weightedPzu(rows) {
  const weightedConsumption = rows.reduce((sum, row) => sum + (Number(row.consumption_mwh) || 0), 0);
  const weightedCost = rows.reduce(
    (sum, row) => sum + (Number(row.consumption_mwh) || 0) * (Number(row.price_lei_mwh) || 0),
    0,
  );
  return weightedConsumption > 0 ? weightedCost / weightedConsumption : 0;
}

function riskLabel(score) {
  if (score <= 20) return "redus";
  if (score <= 40) return "moderat";
  if (score <= 60) return "mediu";
  if (score <= 80) return "ridicat";
  return "foarte ridicat";
}

function buildProfileAnalytics(profile, rows = []) {
  const totalConsumption = profile.totals.consumptionMwh;
  const totalPv = profile.totals.pvMwh;
  const peakMw = profile.totals.peakMw;
  const averageMw = profile.totals.averageMw;
  const loadFactorPct = peakMw > 0 ? (averageMw / peakMw) * 100 : 0;
  const pricedRows = rows.filter((row) => Math.abs(Number(row.price_lei_mwh) || 0) > 0);
  const topCount = pricedRows.length > 0 ? Math.max(1, Math.ceil(pricedRows.length * 0.1)) : 0;
  const sortedByPriceDesc = [...pricedRows].sort((a, b) => (Number(b.price_lei_mwh) || 0) - (Number(a.price_lei_mwh) || 0));
  const expensiveRows = sortedByPriceDesc.slice(0, topCount);
  const cheapRows = sortedByPriceDesc.slice(-topCount);
  const expensiveConsumptionMwh = sumConsumption(expensiveRows);
  const cheapConsumptionMwh = sumConsumption(cheapRows);
  const expensiveAveragePrice = average(expensiveRows.map((row) => Number(row.price_lei_mwh) || 0));
  const cheapAveragePrice = average(cheapRows.map((row) => Number(row.price_lei_mwh) || 0));
  const priceSpreadLeiMwh = Math.max(0, expensiveAveragePrice - cheapAveragePrice);
  const dayMwh = profile.totals.dayMwh;
  const nightMwh = profile.totals.nightMwh;
  const weekdayMwh = sumConsumption(rows, (row, index) => !isWeekendRow(row, index));
  const weekendMwh = sumConsumption(rows, (row, index) => isWeekendRow(row, index));
  const solarMwh = sumConsumption(rows, (row, index) => {
    const hour = rowHour(row, index);
    return hour >= 8 && hour < 18;
  });
  const eveningMwh = sumConsumption(rows, (row, index) => {
    const hour = rowHour(row, index);
    return hour >= 18 && hour < 22;
  });
  const hourlyValues = rows.map((row) => Number(row.consumption_mwh) || 0).filter((value) => value > 0);
  const hourlyMean = average(hourlyValues);
  const hourlyStd =
    hourlyValues.length > 0
      ? Math.sqrt(hourlyValues.reduce((sum, value) => sum + (value - hourlyMean) ** 2, 0) / hourlyValues.length)
      : 0;
  const monthlyValues = profile.monthly.map((row) => row.consumptionMwh).filter((value) => value > 0);
  const monthlyAverage = average(monthlyValues);
  const seasonalityRisk =
    monthlyAverage > 0 ? clamp(((Math.max(...monthlyValues) - Math.min(...monthlyValues)) / monthlyAverage) * 45, 0, 100) : 0;
  const volatilityRisk = hourlyMean > 0 ? clamp((hourlyStd / hourlyMean) * 55, 0, 100) : 0;
  const peakRiskScore = peakMw > 0 ? clamp(100 - loadFactorPct, 0, 100) : 0;
  const priceExposurePct = totalConsumption > 0 ? (expensiveConsumptionMwh / totalConsumption) * 100 : 0;
  const priceExposureScore = pricedRows.length > 0 ? clamp(priceExposurePct, 0, 100) : 0;
  const pvFitScore = totalConsumption > 0 ? clamp((solarMwh / totalConsumption) * 100, 0, 100) : 0;
  const bessFitScore =
    totalConsumption > 0
      ? clamp((eveningMwh / totalConsumption) * 100 * 0.45 + clamp(priceSpreadLeiMwh / 8, 0, 40) + peakRiskScore * 0.15, 0, 100)
      : 0;
  const flexibilityScore = clamp((pvFitScore + bessFitScore) / 2, 0, 100);
  const sourcingRiskScore =
    totalConsumption > 0
      ? Math.round(
          0.3 * priceExposureScore +
            0.25 * volatilityRisk +
            0.2 * peakRiskScore +
            0.15 * volatilityRisk +
            0.1 * seasonalityRisk,
        )
      : 0;

  const monthly = MONTHS.map((month, monthIndex) => {
    const monthRows = rows.filter((row, index) => rowDateParts(row, index).monthIndex === monthIndex);
    const monthPricedRows = monthRows.filter((row) => Math.abs(Number(row.price_lei_mwh) || 0) > 0);
    const monthConsumptionMwh = sumConsumption(monthRows);
    const monthPvMwh = monthRows.reduce((sum, row) => sum + (Number(row.pv_mwh) || 0), 0);
    const monthPmpPzu = weightedPzu(monthPricedRows);
    const monthSimplePzu = average(monthPricedRows.map((row) => Number(row.price_lei_mwh) || 0));
    const monthTopCount = monthPricedRows.length > 0 ? Math.max(1, Math.ceil(monthPricedRows.length * 0.1)) : 0;
    const monthSorted = [...monthPricedRows].sort((a, b) => (Number(b.price_lei_mwh) || 0) - (Number(a.price_lei_mwh) || 0));
    return {
      month: month.label,
      monthKey: month.key,
      consumptionMwh: monthConsumptionMwh,
      pvMwh: monthPvMwh,
      pmpPzuLeiMwh: monthPmpPzu,
      simplePzuAverageLeiMwh: monthSimplePzu,
      profileDifferenceLeiMwh: monthPmpPzu - monthSimplePzu,
      expensiveConsumptionMwh: sumConsumption(monthSorted.slice(0, monthTopCount)),
      cheapConsumptionMwh: sumConsumption(monthSorted.slice(-monthTopCount)),
      weekdayMwh: sumConsumption(monthRows, (row, index) => !isWeekendRow(row, index)),
      weekendMwh: sumConsumption(monthRows, (row, index) => isWeekendRow(row, index)),
      pricedHours: monthPricedRows.length,
    };
  });

  const heatmapMonthHour = MONTHS.map((month, monthIndex) => {
    const cells = Array.from({ length: 24 }, (_, hour) => ({
      month: month.label,
      monthKey: month.key,
      monthIndex,
      hour,
      consumptionMwh: 0,
      pvMwh: 0,
      priceLeiMwhSum: 0,
      pricedHours: 0,
      hours: 0,
    }));
    rows.forEach((row, index) => {
      const parts = rowDateParts(row, index);
      if (parts.monthIndex !== monthIndex) return;
      const cell = cells[parts.hour];
      cell.consumptionMwh += Number(row.consumption_mwh) || 0;
      cell.pvMwh += Number(row.pv_mwh) || 0;
      cell.hours += 1;
      const price = Number(row.price_lei_mwh) || 0;
      if (Math.abs(price) > 0) {
        cell.priceLeiMwhSum += price;
        cell.pricedHours += 1;
      }
    });
    return cells.map((cell) => ({
      ...cell,
      averageConsumptionMw: cell.hours > 0 ? cell.consumptionMwh / cell.hours : 0,
      averagePvMw: cell.hours > 0 ? cell.pvMwh / cell.hours : 0,
      averagePriceLeiMwh: cell.pricedHours > 0 ? cell.priceLeiMwhSum / cell.pricedHours : 0,
    }));
  });

  const hourlyProfile = Array.from({ length: 24 }, (_, hour) => {
    const hourRows = rows.filter((row, index) => rowHour(row, index) === hour);
    const consumptionMwh = sumConsumption(hourRows);
    const pvMwh = hourRows.reduce((sum, row) => sum + (Number(row.pv_mwh) || 0), 0);
    const priceRows = hourRows.filter((row) => Math.abs(Number(row.price_lei_mwh) || 0) > 0);
    return {
      hour,
      consumptionMwh,
      pvMwh,
      averageConsumptionMw: hourRows.length > 0 ? consumptionMwh / hourRows.length : 0,
      averagePvMw: hourRows.length > 0 ? pvMwh / hourRows.length : 0,
      averagePriceLeiMwh: average(priceRows.map((row) => Number(row.price_lei_mwh) || 0)),
    };
  });

  return {
    source: "curbe_consolidate",
    annual: {
      consumptionMwh: totalConsumption,
      pvMwh: totalPv,
      peakMw,
      averageMw,
      loadFactorPct,
      pmpPzuLeiMwh: weightedPzu(pricedRows),
      simplePzuAverageLeiMwh: average(pricedRows.map((row) => Number(row.price_lei_mwh) || 0)),
      profileDifferenceLeiMwh: weightedPzu(pricedRows) - average(pricedRows.map((row) => Number(row.price_lei_mwh) || 0)),
      dayMwh,
      nightMwh,
      dayPct: totalConsumption > 0 ? (dayMwh / totalConsumption) * 100 : 0,
      nightPct: totalConsumption > 0 ? (nightMwh / totalConsumption) * 100 : 0,
      weekdayMwh,
      weekendMwh,
      weekdayPct: totalConsumption > 0 ? (weekdayMwh / totalConsumption) * 100 : 0,
      weekendPct: totalConsumption > 0 ? (weekendMwh / totalConsumption) * 100 : 0,
      expensiveConsumptionMwh,
      cheapConsumptionMwh,
      expensiveConsumptionPct: totalConsumption > 0 ? (expensiveConsumptionMwh / totalConsumption) * 100 : 0,
      cheapConsumptionPct: totalConsumption > 0 ? (cheapConsumptionMwh / totalConsumption) * 100 : 0,
      expensiveAveragePriceLeiMwh: expensiveAveragePrice,
      cheapAveragePriceLeiMwh: cheapAveragePrice,
      priceSpreadLeiMwh,
      pricedHours: pricedRows.length,
    },
    monthly,
    heatmapMonthHour,
    hourlyProfile,
    scores: {
      sourcingRiskScore,
      priceExposureScore,
      forecastRiskScore: volatilityRisk,
      peakRiskScore,
      volatilityScore: volatilityRisk,
      seasonalityScore: seasonalityRisk,
      stabilityScore: clamp(loadFactorPct, 0, 100),
      flexibilityScore,
      pvFitScore,
      bessFitScore,
    },
  };
}

function buildExecutiveMetrics(profile, rows = []) {
  state.profileAnalytics = buildProfileAnalytics(profile, rows);
  const totals = profile.totals;
  const totalConsumption = totals.consumptionMwh;
  const peakMw = totals.peakMw;
  const averageMw = totals.averageMw;
  const loadFactorPct = peakMw > 0 ? (averageMw / peakMw) * 100 : 0;
  const dayPct = totalConsumption > 0 ? (totals.dayMwh / totalConsumption) * 100 : 0;
  const nightPct = totalConsumption > 0 ? (totals.nightMwh / totalConsumption) * 100 : 0;
  const pricedRows = rows.filter((row) => Math.abs(Number(row.price_lei_mwh) || 0) > 0);
  const weightedConsumption = pricedRows.reduce((sum, row) => sum + (Number(row.consumption_mwh) || 0), 0);
  const weightedCost = pricedRows.reduce(
    (sum, row) => sum + (Number(row.consumption_mwh) || 0) * (Number(row.price_lei_mwh) || 0),
    0,
  );
  const pmpPzu = weightedConsumption > 0 ? weightedCost / weightedConsumption : 0;
  const simplePzuAverage =
    pricedRows.length > 0 ? pricedRows.reduce((sum, row) => sum + (Number(row.price_lei_mwh) || 0), 0) / pricedRows.length : 0;
  const topCount = pricedRows.length > 0 ? Math.max(1, Math.ceil(pricedRows.length * 0.1)) : 0;
  const sortedByPrice = [...pricedRows].sort((a, b) => (Number(b.price_lei_mwh) || 0) - (Number(a.price_lei_mwh) || 0));
  const expensiveMwh = sumConsumption(sortedByPrice.slice(0, topCount));
  const cheapMwh = sumConsumption(sortedByPrice.slice(-topCount));
  const priceExposurePct = totalConsumption > 0 ? (expensiveMwh / totalConsumption) * 100 : 0;
  const solarConsumptionMwh = sumConsumption(rows, (row, index) => {
    const hour = rowHour(row, index);
    return hour >= 8 && hour < 18;
  });
  const eveningConsumptionMwh = sumConsumption(rows, (row, index) => {
    const hour = rowHour(row, index);
    return hour >= 18 && hour < 22;
  });
  const pvFitPct = totalConsumption > 0 ? (solarConsumptionMwh / totalConsumption) * 100 : 0;
  const eveningPct = totalConsumption > 0 ? (eveningConsumptionMwh / totalConsumption) * 100 : 0;
  const hourlyValues = rows.map((row) => Number(row.consumption_mwh) || 0).filter((value) => value > 0);
  const hourlyMean = hourlyValues.length > 0 ? hourlyValues.reduce((sum, value) => sum + value, 0) / hourlyValues.length : 0;
  const hourlyStd =
    hourlyValues.length > 0
      ? Math.sqrt(hourlyValues.reduce((sum, value) => sum + (value - hourlyMean) ** 2, 0) / hourlyValues.length)
      : 0;
  const volatilityRisk = hourlyMean > 0 ? clamp((hourlyStd / hourlyMean) * 55, 0, 100) : 0;
  const monthlyTotals = profile.monthly.map((row) => row.consumptionMwh).filter((value) => value > 0);
  const monthlyAverage =
    monthlyTotals.length > 0 ? monthlyTotals.reduce((sum, value) => sum + value, 0) / monthlyTotals.length : 0;
  const seasonalityRisk =
    monthlyAverage > 0 ? clamp(((Math.max(...monthlyTotals) - Math.min(...monthlyTotals)) / monthlyAverage) * 45, 0, 100) : 0;
  const peakRisk = peakMw > 0 ? clamp(100 - loadFactorPct, 0, 100) : 0;
  const priceExposureRisk = pricedRows.length > 0 ? clamp(priceExposurePct, 0, 100) : 0;
  const forecastRisk = volatilityRisk;
  const sourcingRiskScore =
    totalConsumption > 0
      ? Math.round(
          0.3 * priceExposureRisk +
            0.25 * forecastRisk +
            0.2 * peakRisk +
            0.15 * volatilityRisk +
            0.1 * seasonalityRisk,
        )
      : 0;

  let recommendation = "Introdu curbe";
  if (totalConsumption > 0) {
    if (sourcingRiskScore > 60 || (pmpPzu > 0 && simplePzuAverage > 0 && pmpPzu > simplePzuAverage)) {
      recommendation = "Pret fix / banda";
    } else if (pvFitPct > 60 || dayPct > 60) {
      recommendation = "PV autoconsum";
    } else if (eveningPct > 25 || peakRisk > 55) {
      recommendation = "BESS / peak shaving";
    } else if (pmpPzu > 0 && simplePzuAverage > 0 && pmpPzu < simplePzuAverage) {
      recommendation = "PZU orar avantajos";
    } else if (loadFactorPct > 60 && sourcingRiskScore <= 40) {
      recommendation = "Pret fix / banda";
    } else {
      recommendation = "Banda + PZU";
    }
  }

  return {
    totalConsumption,
    pmpPzu,
    peakMw,
    averageMw,
    loadFactorPct,
    dayPct,
    nightPct,
    pricedHours: pricedRows.length,
    simplePzuAverage,
    expensiveMwh,
    cheapMwh,
    priceExposurePct,
    pvFitPct,
    eveningPct,
    sourcingRiskScore,
    recommendation,
  };
}

function loadFactorLabel(value) {
  if (value > 70) return "excelent";
  if (value >= 60) return "bun";
  if (value >= 50) return "mediu";
  return "volatil";
}

function opportunityLabel(score) {
  if (score >= 75) return "Ridicata";
  if (score >= 50) return "Medie";
  if (score > 0) return "Redusa";
  return "In asteptare";
}

function buildProfileOpportunity(metrics, analytics, contract) {
  const annual = analytics?.annual || {};
  const scores = analytics?.scores || {};
  const hasConsumption = metrics.totalConsumption > 0;
  const hasPrices = metrics.pricedHours > 0;
  const forecastabilityScore = hasConsumption ? clamp(100 - (scores.forecastRiskScore || 0), 0, 100) : 0;
  const seasonalityScore = hasConsumption ? clamp(100 - (scores.seasonalityScore || 0), 0, 100) : 0;
  const profileAdvantagePct =
    hasPrices && annual.simplePzuAverageLeiMwh > 0
      ? clamp(((annual.simplePzuAverageLeiMwh - annual.pmpPzuLeiMwh) / annual.simplePzuAverageLeiMwh) * 100, -25, 25)
      : 0;
  const spotMarketFitScore = hasPrices
    ? clamp(55 + profileAdvantagePct - (scores.priceExposureScore || 0) * 0.35 + (annual.cheapConsumptionPct || 0) * 0.25, 0, 100)
    : 0;
  const hedgingScore = hasConsumption
    ? clamp(forecastabilityScore * 0.45 + metrics.loadFactorPct * 0.35 + seasonalityScore * 0.2, 0, 100)
    : 0;

  let contractRecommendation = "Introdu curbe";
  if (hasConsumption) {
    if (forecastabilityScore > 80 && metrics.loadFactorPct > 60) contractRecommendation = "FIX / forward";
    else if (spotMarketFitScore > 75) contractRecommendation = "PZU orar";
    else if (forecastabilityScore > 60 && spotMarketFitScore > 50) contractRecommendation = "Banda + PZU";
    else if (metrics.sourcingRiskScore > 60) contractRecommendation = "Pret fix / banda";
    else contractRecommendation = "Banda + monitorizare PZU";
  }

  const solarFitScore = clamp(scores.pvFitScore || 0, 0, 100);
  const storageFitScore = clamp(scores.bessFitScore || 0, 0, 100);
  const monthlyAverageMwh = metrics.totalConsumption > 0 ? metrics.totalConsumption / 12 : 0;
  const jtMtScore =
    contract.voltage === "JT" && (metrics.totalConsumption > 600 || monthlyAverageMwh > 50)
      ? 90
      : contract.voltage === "JT" && metrics.totalConsumption > 400
        ? 65
        : 0;
  const peakKw = metrics.peakMw * 1000;
  const atrUtilizationPct = contract.atrKw > 0 ? (peakKw / contract.atrKw) * 100 : 0;
  let atrOptimizationScore = 0;
  let atrLabel = "Completeaza ATR profilare";
  if (contract.atrKw > 0 && peakKw > 0) {
    if (atrUtilizationPct < 55) {
      atrOptimizationScore = 85;
      atrLabel = "ATR posibil supradimensionat";
    } else if (atrUtilizationPct < 70) {
      atrOptimizationScore = 60;
      atrLabel = "ATR de verificat";
    } else if (atrUtilizationPct > 95) {
      atrOptimizationScore = 75;
      atrLabel = "ATR aproape depasit";
    } else {
      atrOptimizationScore = 25;
      atrLabel = "ATR echilibrat";
    }
  }
  const reactiveScore = contract.reactiveCostLei > 0 ? clamp(40 + contract.reactiveCostLei / 500, 40, 100) : 0;
  const efficiencyOptions = [
    { score: solarFitScore, text: "PV autoconsum" },
    { score: storageFitScore, text: "BESS / peak shaving" },
    { score: jtMtScore, text: "Analiza trecere MT" },
    { score: atrOptimizationScore, text: atrLabel },
    { score: reactiveScore, text: "Compensare energie reactiva" },
  ].sort((a, b) => b.score - a.score);
  const efficiencyRecommendation = !hasConsumption
    ? "Introdu curbe"
    : efficiencyOptions[0].score >= 50
      ? efficiencyOptions[0].text
      : "Monitorizare profil";
  const contractOptimizationScore = clamp(metrics.sourcingRiskScore, 0, 100);
  const energyOpportunityScore = hasConsumption
    ? clamp(
        contractOptimizationScore * 0.25 +
          spotMarketFitScore * 0.2 +
          storageFitScore * 0.2 +
          solarFitScore * 0.15 +
          jtMtScore * 0.1 +
          atrOptimizationScore * 0.1,
        0,
        100,
      )
    : 0;
  const clientReady = Boolean(contract.clientName || contract.cui || contract.distributor || contract.atrKw > 0);

  return {
    clientReady,
    forecastabilityScore,
    spotMarketFitScore,
    hedgingScore,
    seasonalityScore,
    solarFitScore,
    storageFitScore,
    jtMtScore,
    atrOptimizationScore,
    atrUtilizationPct,
    atrLabel,
    reactiveScore,
    energyOpportunityScore,
    contractRecommendation,
    efficiencyRecommendation,
  };
}

function commercialPotentialLabel(score) {
  if (score >= 76) return "High Commercial Potential";
  if (score >= 51) return "Strong Opportunity";
  if (score >= 26) return "Moderate Opportunity";
  return "Limited Opportunity";
}

function commercialPriorityLabel(score) {
  if (score >= 76) return "Prioritate critica";
  if (score >= 51) return "Prioritate ridicata";
  if (score >= 26) return "Prioritate medie";
  return "Monitorizare";
}

function annualMarketCost(metrics, analytics) {
  const annual = analytics?.annual || {};
  const pmp = annual.pmpPzuLeiMwh || metrics.pmpPzu || 0;
  return pmp * (metrics.totalConsumption || annual.consumptionMwh || 0);
}

function buildCommercialOpportunityEngine(profile, metrics, analytics, opportunity, contract, rows = [], procurementDna = null) {
  const annual = analytics?.annual || {};
  const scores = analytics?.scores || {};
  const costDna = procurementDna?.costDna || buildCostDna(rows);
  const loadDna = procurementDna?.loadDna || buildLoadDna(rows);
  const totalMwh = metrics.totalConsumption || annual.consumptionMwh || 0;
  const hasConsumption = totalMwh > 0;
  const hasPrices = metrics.pricedHours > 0 || (annual.pricedHours || 0) > 0;
  const pmp = annual.pmpPzuLeiMwh || metrics.pmpPzu || 0;
  const averagePzu = annual.simplePzuAverageLeiMwh || metrics.simplePzuAverage || 0;
  const profilePremiumLeiMwh = hasPrices ? Math.max(0, pmp - averagePzu) : 0;
  const profilePremiumScore = hasPrices && averagePzu > 0 ? clamp((profilePremiumLeiMwh / averagePzu) * 220, 0, 100) : 0;
  const peakBaseScore = Number.isFinite(loadDna.peakBaseRatio) ? clamp((loadDna.peakBaseRatio - 1) * 32, 0, 100) : 0;
  const priceSpread = Math.max(0, annual.priceSpreadLeiMwh || 0);
  const marketCost = annualMarketCost(metrics, analytics);
  const pvInstalled = contract.existingPv === "Da" || contract.prosumer === "Da" || (contract.pvKwp || 0) > 0 || (profile.totals?.pvMwh || 0) > 0;
  const solarMwh = sumRowsMwh(rows, (row, index) => {
    const hour = rowHour(row, index);
    return hour >= 8 && hour < 18;
  });
  const contractScore = hasConsumption
    ? clamp(
        profilePremiumScore * 0.35 +
          (opportunity.spotMarketFitScore || 0) * 0.2 +
          (opportunity.forecastabilityScore || 0) * 0.18 +
          (opportunity.hedgingScore || 0) * 0.17 +
          (metrics.sourcingRiskScore || 0) * 0.1,
        0,
        100,
      )
    : 0;
  const solarScore = hasConsumption ? clamp(opportunity.solarFitScore || scores.pvFitScore || 0, 0, 100) : 0;
  const pvMaintenanceScore = pvInstalled ? clamp(65 + Math.min(25, (contract.pvKwp || 0) / 20), 0, 100) : 0;
  const storageScore = hasConsumption
    ? clamp(
        (opportunity.storageFitScore || scores.bessFitScore || 0) * 0.35 +
          (costDna.available ? costDna.concentrationIndex || 0 : 0) * 0.25 +
          (procurementDna?.riskScore || metrics.sourcingRiskScore || 0) * 0.25 +
          peakBaseScore * 0.15,
        0,
        100,
      )
    : 0;
  const peakShavingScore = clamp(Math.max(0, (metrics.peakMw || 0) - (metrics.averageMw || 0)) * 35, 0, 100);
  const gridScore = hasConsumption
    ? clamp((opportunity.jtMtScore || 0) * 0.35 + (opportunity.atrOptimizationScore || 0) * 0.35 + peakShavingScore * 0.3, 0, 100)
    : 0;
  const employeeChargingScore = clamp((metrics.dayPct || 0) * 0.55 + (metrics.loadFactorPct || 0) * 0.25 + (contract.voltage === "JT" ? 5 : 18), 0, 100);
  const fleetChargingScore = clamp((metrics.nightPct || 0) * 0.25 + (metrics.dayPct || 0) * 0.25 + (metrics.averageMw || 0) * 18, 0, 100);
  const truckChargingScore = clamp((contract.voltage === "MT" || contract.voltage === "IT" ? 28 : 8) + (metrics.peakMw || 0) * 12, 0, 100);
  const visitorChargingScore = clamp((metrics.dayPct || 0) * 0.35 + (totalMwh / 12) * 0.18, 0, 100);
  const evScore = hasConsumption ? Math.max(employeeChargingScore, fleetChargingScore, truckChargingScore, visitorChargingScore) : 0;
  const evTypes = [
    { label: "Employee Charging", score: employeeChargingScore },
    { label: "Visitor Charging", score: visitorChargingScore },
    { label: "Fleet Charging", score: fleetChargingScore },
    { label: "Truck Charging", score: truckChargingScore },
  ].filter((item) => item.score >= 35);
  const basePrice = pmp || averagePzu || 450;
  const opportunities = [
    {
      key: "contract",
      name: "Contract Optimization",
      weight: 20,
      score: contractScore,
      estimatedSavingsLei: Math.max(profilePremiumLeiMwh * totalMwh * 0.6, marketCost * (contractScore / 100) * 0.018),
      action: opportunity.contractRecommendation || "Analiza contract",
    },
    {
      key: "solar",
      name: "Solar Opportunity",
      weight: 15,
      score: solarScore,
      estimatedSavingsLei: solarMwh * basePrice * 0.16 * (solarScore / 100),
      action: "Dimensionare PV pentru autoconsum 08:00-18:00",
    },
    {
      key: "pv-maintenance",
      name: "PV Maintenance Opportunity",
      weight: 10,
      score: pvMaintenanceScore,
      estimatedSavingsLei: pvInstalled ? Math.max((profile.totals?.pvMwh || 0) * basePrice * 0.025, (contract.pvKwp || 0) * 35) : 0,
      action: pvInstalled ? "Audit productie PV si mentenanta performanta" : "Nu exista PV/prosumator introdus",
    },
    {
      key: "storage",
      name: "Storage Opportunity",
      weight: 25,
      score: storageScore,
      estimatedSavingsLei: (annual.expensiveConsumptionMwh || 0) * priceSpread * 0.14 * (storageScore / 100),
      action: "Launch BESS Opportunity Simulator",
    },
    {
      key: "grid",
      name: "Grid Optimization",
      weight: 15,
      score: gridScore,
      estimatedSavingsLei: (contract.reactiveCostLei || 0) * 0.5 + marketCost * (gridScore / 100) * 0.008,
      action: opportunity.atrLabel || "Analiza ATR / JT -> MT / peak shaving",
    },
    {
      key: "ev",
      name: "EV Charging Opportunity",
      weight: 15,
      score: evScore,
      estimatedSavingsLei: totalMwh * (evScore / 100) * 8,
      action: evTypes.length ? evTypes.map((item) => item.label).join(" / ") : "Necesita date despre flota si parcari",
    },
  ].map((item) => ({
    ...item,
    score: Math.round(clamp(item.score, 0, 100)),
    weightedScore: clamp(item.score, 0, 100) * (item.weight / 100),
    estimatedSavingsLei: Math.max(0, Number(item.estimatedSavingsLei) || 0),
  }));
  const totalScore = Math.round(opportunities.reduce((sum, item) => sum + item.weightedScore, 0));
  const ranked = [...opportunities].sort((a, b) => b.score - a.score || b.weightedScore - a.weightedScore);
  const top = ranked.filter((item) => item.score > 0).slice(0, 3);
  const estimatedAnnualSavingsLei = opportunities.reduce((sum, item) => sum + item.estimatedSavingsLei, 0);
  const messages = [];
  if (!hasConsumption) messages.push({ type: "warn", text: "Lipsesc curbele orare de consum. Scorurile comerciale raman orientative." });
  if (!hasPrices) messages.push({ type: "warn", text: "Lipsesc preturile PZU. Contract Optimization, Storage si savings pot fi subestimate." });
  if (!contract.atrKw) messages.push({ type: "warn", text: "ATR profilare nu este introdus. Grid Optimization poate fi incomplet." });
  if (!pvInstalled) messages.push({ type: "info", text: "PV Maintenance devine activ dupa introducerea PV/prosumator." });
  if (!messages.length) messages.push({ type: "info", text: "Date suficiente pentru prioritizare comerciala initiala." });
  const topNames = top.map((item) => item.name).join(", ") || "Introdu curbe de consum";
  const salesStory = hasConsumption
    ? `Executive Pitch pentru KAM: clientul are ${commercialPotentialLabel(totalScore).toLowerCase()}, cu prioritate pe ${topNames}. Scorul comercial este ${totalScore}/100, iar economia anuala estimata este ${formatLei(estimatedAnnualSavingsLei)}. Prima discutie recomandata: ${top[0]?.action || "validarea datelor de consum si contract"}.`
    : "Executive Pitch pentru KAM se genereaza dupa introducerea curbelor orare de consum si validarea datelor contractuale.";
  return {
    score: totalScore,
    label: commercialPotentialLabel(totalScore),
    estimatedAnnualSavingsLei,
    opportunities: ranked,
    topOpportunities: top,
    evTypes,
    messages,
    salesStory,
  };
}

function renderCommercialOpportunityEngine(engine) {
  if (!$("commercialOpportunityScore")) return;
  const opportunityByKey = Object.fromEntries((engine.opportunities || []).map((item) => [item.key, item]));
  const storage = opportunityByKey.storage || {};
  const pvMaintenance = opportunityByKey["pv-maintenance"] || {};
  const ev = opportunityByKey.ev || {};
  setText("commercialOpportunityScore", formatPercent(engine.score));
  setText("commercialOpportunityLabel", engine.label);
  setText("commercialEstimatedSavings", formatLei(engine.estimatedAnnualSavingsLei));
  setText("opportunityPvMaintenanceScore", formatPercent(pvMaintenance.score || 0));
  setText("opportunityEvScore", formatPercent(ev.score || 0));
  setText("opportunityStorageSavings", `Potential savings: ${formatLei(storage.estimatedSavingsLei || 0)}`);
  setText("storageOpportunityScore", formatPercent(storage.score || 0));
  setText("storagePotentialSavings", formatLei(storage.estimatedSavingsLei || 0));
  setText("storageRoi", (storage.estimatedSavingsLei || 0) > 0 ? "Necesita CAPEX" : "CAPEX necesar");
  renderOpportunityMarketplace(engine);
  const top = engine.topOpportunities[0];
  setText("commercialTopOpportunity", top ? top.name : "Introdu curbe");
  setText("commercialTopOpportunityAction", top ? `${commercialPriorityLabel(top.score)} - ${top.action}` : "Prioritatea se genereaza automat");
  setText("commercialSalesStory", engine.salesStory);
  const validation = $("commercialValidationMessages");
  if (validation) {
    validation.innerHTML = "";
    engine.messages.forEach((message) => {
      const item = document.createElement("span");
      item.className = message.type === "warn" ? "warn" : "";
      item.textContent = message.text;
      validation.appendChild(item);
    });
  }
  const topList = $("commercialTopList");
  if (topList) {
    topList.innerHTML = "";
    const items = engine.topOpportunities.length ? engine.topOpportunities : engine.opportunities.slice(0, 3);
    items.forEach((item, index) => {
      const row = document.createElement("div");
      row.textContent = `${index + 1}. ${item.name} - ${formatPercent(item.score)} - ${formatLei(item.estimatedSavingsLei)}`;
      topList.appendChild(row);
    });
  }
  const tbody = $("commercialRankingRows");
  if (tbody) {
    tbody.innerHTML = "";
    engine.opportunities.forEach((item) => {
      const meta = opportunityStatusMeta(item.score);
      const tr = document.createElement("tr");
      tr.dataset.status = meta.key;
      [
        item.name,
        formatPercent(item.score),
        meta.priority,
        formatLei(item.estimatedSavingsLei),
        meta.label,
        item.action,
      ].forEach((value) => {
        const td = document.createElement("td");
        td.textContent = value;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    applyOpportunityFilter();
  }
}

function salesOpportunityConfidence(item, context) {
  const { hasConsumption, hasPrices, contract, opportunity } = context;
  let confidence = 15 + (item.score || 0) * 0.25;
  if (hasConsumption) confidence += 30;
  if (hasPrices) confidence += 22;
  if (contract.clientName || contract.cui || contract.distributor) confidence += 8;
  if (item.key === "grid" && contract.atrKw > 0) confidence += 12;
  if (item.key === "storage" && (opportunity.storageFitScore || 0) > 0) confidence += 8;
  if (item.key === "solar" && (opportunity.solarFitScore || 0) > 0) confidence += 8;
  if (item.key === "pv-maintenance" && (contract.existingPv === "Da" || contract.prosumer === "Da" || (contract.pvKwp || 0) > 0)) confidence += 18;
  if (item.key === "ev" && hasConsumption) confidence += 5;
  return Math.round(clamp(confidence, 0, 100));
}

function salesConfidenceReason(item, context) {
  const { hasConsumption, hasPrices, contract } = context;
  if (!hasConsumption) return "Lipsesc curbele de consum.";
  if ((item.key === "contract" || item.key === "storage") && !hasPrices) return "Lipsesc preturile PZU pentru validare completa.";
  if (item.key === "grid" && !contract.atrKw) return "ATR lipsa, analiza grid este partiala.";
  if (item.key === "pv-maintenance" && !(contract.existingPv === "Da" || contract.prosumer === "Da" || (contract.pvKwp || 0) > 0)) return "PV/prosumator neintrodus.";
  return item.score >= 50 ? "Date suficiente pentru discutie comerciala." : "Oportunitate de monitorizat.";
}

function salesTalkingPointFor(item, context) {
  const { metrics, opportunity, commercial } = context;
  switch (item.key) {
    case "contract":
      return `Pornim discutia de la ${opportunity.contractRecommendation}. Comparam PMP Client cu media PZU si aratam unde profilul consuma in ore scumpe.`;
    case "storage":
      return `Pozitionam BESS ca instrument de reducere expunere in ore scumpe si peak shaving. Urmatorul pas este rularea BESS Opportunity Simulator pe scenariul potrivit.`;
    case "solar":
      return `Consumul intre 08:00-18:00 indica potential de autoconsum PV. Discutia trebuie sa fie despre reducerea energiei cumparate in intervalul solar.`;
    case "grid":
      return `ATR, tensiunea si varfurile de consum indica daca exista optimizare de retea, trecere JT-MT sau reducere penalizari/varfuri.`;
    case "ev":
      return `Profilul poate sustine discutii de incarcare Employee, Visitor, Fleet sau Truck, in functie de utilizarea locatiei si puterea disponibila.`;
    case "pv-maintenance":
      return `Daca exista PV/prosumator, propunem audit de performanta si mentenanta pentru a evita pierderi de productie si autoconsum ratat.`;
    default:
      return `${item.name} are scor ${formatPercent(item.score)} si impact estimat de ${formatLei(item.estimatedSavingsLei || 0)}.`;
  }
}

function nextBestActionFor(item, context) {
  if (!context.hasConsumption) return "Introdu si valideaza curbele orare de consum.";
  if (!context.hasPrices && (item?.key === "contract" || item?.key === "storage")) return "Incarca sau valideaza preturile PZU pentru anul analizat.";
  switch (item?.key) {
    case "storage":
      return "Ruleaza BESS Opportunity Simulator si exporta scenariul recomandat.";
    case "contract":
      return "Pregateste comparatia contractuala si oferta de optimizare pe profilul PZU.";
    case "solar":
      return "Dimensioneaza PV pe intervalul 08:00-18:00 si pregateste analiza de autoconsum.";
    case "grid":
      return "Verifica ATR, varfurile de consum si oportunitatea JT -> MT / peak shaving.";
    case "ev":
      return "Califica necesarul EV: Employee, Visitor, Fleet sau Truck Charging.";
    case "pv-maintenance":
      return "Solicita date PV si propune audit de productie/mentenanta.";
    default:
      return "Valideaza datele de consum, contract si PZU cu clientul.";
  }
}

function buildSalesObjections(context) {
  const objections = [];
  const topKeys = new Set((context.commercial.topOpportunities || []).map((item) => item.key));
  if (!context.hasConsumption || !context.hasPrices) {
    objections.push({
      objection: "Datele nu sunt suficiente pentru o decizie.",
      response: "Folosim raportul ca screening initial si validam curbele/PZU inainte de oferta finala.",
    });
  }
  if (topKeys.has("storage") || (context.opportunity.storageFitScore || 0) >= 50) {
    objections.push({
      objection: "Investitia in baterie pare prea mare.",
      response: "Rulam scenariul BESS pe orele reale si prezentam comportamentul incarcare/descarcare, nu doar o estimare generala.",
    });
  }
  if (topKeys.has("solar") || (context.opportunity.solarFitScore || 0) >= 50) {
    objections.push({
      objection: "PV nu acopera consumul nostru real.",
      response: "Dimensionarea se face pe consumul 08:00-18:00 si pe autoconsum, nu pe putere instalata maxima.",
    });
  }
  if (topKeys.has("contract")) {
    objections.push({
      objection: "Contractul actual este deja bun.",
      response: "Comparam PMP Client cu media PZU si identificam orele in care profilul este penalizat.",
    });
  }
  objections.push({
    objection: "Nu avem timp pentru un proiect complex.",
    response: `Urmatorul pas este unul scurt: ${context.nextBestAction}`,
  });
  return objections.slice(0, 5);
}

function buildSalesIntelligenceEngine(profile, metrics, analytics, opportunity, contract, rows = [], procurementDna = null, commercial = null) {
  const commercialEngine = commercial || buildCommercialOpportunityEngine(profile, metrics, analytics, opportunity, contract, rows, procurementDna);
  const hasConsumption = (metrics.totalConsumption || 0) > 0;
  const hasPrices = (metrics.pricedHours || 0) > 0;
  const top = commercialEngine.topOpportunities?.[0] || commercialEngine.opportunities?.[0] || null;
  const topNames = (commercialEngine.topOpportunities?.length ? commercialEngine.topOpportunities : commercialEngine.opportunities || [])
    .slice(0, 3)
    .map((item) => item.name);
  const why = [];
  if (hasConsumption) {
    why.push(`Consum anual analizat: ${formatMetric(metrics.totalConsumption, " MWh")}.`);
    if ((metrics.totalConsumption || 0) >= 1000) why.push("Consum ridicat, relevant pentru oferte integrate si economii anuale vizibile.");
    if ((metrics.loadFactorPct || 0) >= 60) why.push("Profil relativ stabil, potrivit pentru discutii contractuale si hedging.");
    if ((opportunity.storageFitScore || 0) >= 50) why.push("Oportunitate BESS: consum in intervale potrivite pentru arbitraj/peak shaving.");
    if ((opportunity.solarFitScore || 0) >= 50) why.push("Oportunitate PV: consum relevant in intervalul solar 08:00-18:00.");
    if ((opportunity.jtMtScore || 0) >= 50 || (opportunity.atrOptimizationScore || 0) >= 50) why.push("Oportunitate ATR/Grid: varfurile si puterea aprobata merita validate.");
    const ev = commercialEngine.opportunities?.find((item) => item.key === "ev");
    if ((ev?.score || 0) >= 50) why.push("Oportunitate EV: profilul permite calificarea Employee / Fleet / Visitor / Truck Charging.");
  }
  if (!why.length) why.push("Sales Intelligence insights pending. Additional consumption and market data required.");
  const nextBestAction = nextBestActionFor(top, { hasConsumption, hasPrices });
  const context = { profile, metrics, analytics, opportunity, contract, procurementDna, commercial: commercialEngine, hasConsumption, hasPrices, nextBestAction };
  const executivePitch = hasConsumption
    ? `Clientul are ${commercialEngine.label.toLowerCase()} si merita abordat pe ${topNames.join(", ") || "validarea oportunitatilor"}. Propunerea initiala: ${nextBestAction}`
    : "Sales Intelligence insights pending. Additional consumption and market data required.";
  const executiveSummary = hasConsumption
    ? `EnergyPilot identifica automat oportunitatile comerciale pentru client. Scorul comercial este ${commercialEngine.score}/100, economia anuala estimata este ${formatLei(commercialEngine.estimatedAnnualSavingsLei)}, iar prioritatea principala este ${top?.name || "validarea datelor"}.`
    : "Sales Intelligence insights pending. Additional consumption and market data required.";
  const talkingPoints = (commercialEngine.opportunities || []).map((item) => ({
    name: item.name,
    text: salesTalkingPointFor(item, context),
  }));
  const confidence = (commercialEngine.opportunities || []).map((item) => ({
    name: item.name,
    score: salesOpportunityConfidence(item, context),
    reason: salesConfidenceReason(item, context),
  }));
  const meetingBrief = [
    `Client Snapshot: ${contract.clientName || "Client"} | consum ${formatMetric(metrics.totalConsumption || 0, " MWh")} | varf ${formatMetric(metrics.peakMw || 0, " MW")}.`,
    `Top Opportunities: ${topNames.join(", ") || "in asteptare"}.`,
    `Risks: ${hasPrices ? riskLabel(metrics.sourcingRiskScore || 0) : "PZU lipsa"} | ${procurementDna?.riskLabel || "Risk DNA in asteptare"}.`,
    `Recommended Pitch: ${executivePitch}`,
    `Next Step: ${nextBestAction}`,
  ];
  const emailSubject = hasConsumption
    ? `Oportunitati EnergyPilot pentru ${contract.clientName || "clientul analizat"}`
    : `Date necesare pentru analiza EnergyPilot`;
  const emailBody = hasConsumption
    ? `Buna ziua,\n\nAm analizat profilul energetic si am identificat urmatoarele directii prioritare: ${topNames.join(", ") || "validare date"}.\n\nScorul comercial EnergyPilot este ${commercialEngine.score}/100, cu impact anual estimat de ${formatLei(commercialEngine.estimatedAnnualSavingsLei)}. Recomand urmatorul pas: ${nextBestAction}\n\nPutem programa o discutie scurta pentru validarea datelor si alegerea scenariului potrivit.\n\nCu stima,`
    : `Buna ziua,\n\nPentru a genera analiza EnergyPilot completa avem nevoie de curbele orare de consum si preturile PZU aferente perioadei analizate.\n\nDupa validare putem identifica oportunitatile comerciale, impactul financiar si urmatorii pasi.\n\nCu stima,`;
  const validationMessage = hasConsumption && hasPrices
    ? "Sales Intelligence ready."
    : "Sales Intelligence insights pending. Additional consumption and market data required.";
  return {
    executiveSummary,
    executivePitch,
    whyThisClient: why,
    talkingPoints,
    nextBestAction,
    confidence,
    objections: buildSalesObjections(context),
    meetingBrief,
    emailSubject,
    emailBody,
    validationMessage,
  };
}

function fillTextList(id, items = []) {
  const container = $(id);
  if (!container) return;
  container.innerHTML = "";
  items.forEach((text) => {
    const item = document.createElement("span");
    item.textContent = text;
    container.appendChild(item);
  });
}

function fillRows(tbodyId, rows = []) {
  const tbody = $(tbodyId);
  if (!tbody) return;
  tbody.innerHTML = "";
  rows.forEach((row) => {
    const tr = document.createElement("tr");
    row.forEach((value) => {
      const td = document.createElement("td");
      td.textContent = value;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}

function renderSalesIntelligenceEngine(engine, commercial) {
  if (!engine) return;
  setText("salesExecutiveSummary", engine.executiveSummary);
  setText("salesExecutivePitch", engine.executivePitch);
  setText("salesNextBestAction", engine.nextBestAction);
  setText("salesEmailSubject", engine.emailSubject);
  setText("salesEmailBody", engine.emailBody);
  setText("salesValidationMessage", engine.validationMessage);
  $("salesValidationMessage")?.classList.toggle("ok", engine.validationMessage === "Sales Intelligence ready.");
  fillTextList("salesWhyClientList", engine.whyThisClient);
  fillTextList("salesMeetingBrief", engine.meetingBrief);
  fillRows("salesTalkingPointsRows", engine.talkingPoints.map((item) => [item.name, item.text]));
  fillRows("salesConfidenceRows", engine.confidence.map((item) => [item.name, formatPercent(item.score), item.reason]));
  fillRows("salesObjectionRows", engine.objections.map((item) => [item.objection, item.response]));
  setText("executiveCommercialScore", formatPercent(commercial?.score || 0));
  setText("executiveCommercialSavings", formatLei(commercial?.estimatedAnnualSavingsLei || 0));
  setText(
    "executiveTopOpportunities",
    (commercial?.topOpportunities?.length ? commercial.topOpportunities : commercial?.opportunities || [])
      .slice(0, 3)
      .map((item) => item.name)
      .join(" | ") || "Introdu curbe",
  );
  setText("executivePitch", engine.executivePitch);
  setText("executiveNextBestAction", engine.nextBestAction);
  setText("executiveWhyClient", engine.whyThisClient.slice(0, 2).join(" "));
}

function setRoadmapStep(step, done, warn = false) {
  const element = document.querySelector(`[data-roadmap-step="${step}"]`);
  if (!element) return;
  element.classList.toggle("done", Boolean(done));
  element.classList.toggle("warn", !done && Boolean(warn));
}

function fillKeyValueRows(tbodyId, rows) {
  const tbody = $(tbodyId);
  if (!tbody) return;
  tbody.innerHTML = "";
  rows.forEach(([label, value]) => {
    const tr = document.createElement("tr");
    const labelCell = document.createElement("td");
    labelCell.textContent = label;
    const valueCell = document.createElement("td");
    valueCell.textContent = value;
    tr.appendChild(labelCell);
    tr.appendChild(valueCell);
    tbody.appendChild(tr);
  });
}

function setText(id, value) {
  const element = $(id);
  if (element) element.textContent = value;
}

function opportunityStatusMeta(score) {
  const value = Number(score) || 0;
  if (value >= 70) return { key: "high", label: "High Opportunity", priority: "High" };
  if (value >= 45) return { key: "medium", label: "Medium Opportunity", priority: "Medium" };
  if (value > 0) return { key: "low", label: "Low Opportunity", priority: "Low" };
  return { key: "pending", label: "Pending Assessment", priority: "Pending" };
}

function setOpportunityStatus(statusId, priorityId, meta) {
  const status = $(statusId);
  if (status) {
    status.className = `opportunity-status ${meta.key}`;
    status.textContent = meta.label;
  }
  setText(priorityId, `Priority: ${meta.priority}`);
}

function marketplaceCard(key) {
  return document.querySelector(`[data-opportunity-card="${key}"]`);
}

function updateMarketplaceCardState(key, item, displayName) {
  const card = marketplaceCard(key);
  const meta = opportunityStatusMeta(item?.score || 0);
  if (!card) return meta;
  card.dataset.status = meta.key;
  card.dataset.score = String(Math.round(Number(item?.score) || 0));
  card.dataset.opportunityName = displayName || item?.name || "";
  card.dataset.estimatedSavings = String(Number(item?.estimatedSavingsLei) || 0);
  card.dataset.recommendedAction = item?.action || "";
  return meta;
}

function currentOpportunityFilter() {
  return document.querySelector("#opportunityFilters button.active")?.dataset.opportunityFilter || "all";
}

function applyOpportunityFilter(filter = currentOpportunityFilter()) {
  document.querySelectorAll("#opportunityFilters button").forEach((button) => {
    button.classList.toggle("active", button.dataset.opportunityFilter === filter);
  });
  document.querySelectorAll(".opportunity-market-card").forEach((card) => {
    const status = card.dataset.status || "pending";
    const isImplemented = card.dataset.implemented === "true";
    const visible =
      filter === "all" ||
      status === filter ||
      (filter === "implemented" && isImplemented);
    card.classList.toggle("is-filter-hidden", !visible);
  });
  document.querySelectorAll("#commercialRankingRows tr").forEach((row) => {
    const status = row.dataset.status || "pending";
    const isImplemented = row.dataset.implemented === "true";
    const visible =
      filter === "all" ||
      status === filter ||
      (filter === "implemented" && isImplemented);
    row.classList.toggle("is-filter-hidden", !visible);
  });
}

function opportunityInfrastructure(useCase) {
  if (useCase === "Employee Charging") return "AC 22 kW cu load management";
  if (useCase === "Visitor Charging") return "AC public + DC punctual";
  if (useCase === "Fleet Charging") return "Hub AC/DC cu programare incarcare";
  if (useCase === "Truck Charging") return "DC high power si verificare MT";
  return "Necesita date despre flota si parcari";
}

function renderOpportunityMarketplace(engine) {
  if (!$("opportunityMarketplaceGrid")) return;
  const opportunities = engine?.opportunities || [];
  const opportunityByKey = Object.fromEntries(opportunities.map((item) => [item.key, item]));
  const contract = profileContractData();
  const annual = state.profileAnalytics?.annual || {};
  const hasConsumption = (annual.consumptionMwh || 0) > 0;
  const pvInstalled = contract.existingPv === "Da" || contract.prosumer === "Da" || (contract.pvKwp || 0) > 0;
  const positiveCount = opportunities.filter((item) => (item.score || 0) > 0).length;
  const top = engine?.topOpportunities?.[0] || opportunities.find((item) => (item.score || 0) > 0);

  setText("marketplaceTotalOpportunities", String(positiveCount));
  $("marketplaceEmptyState")?.classList.toggle("is-hidden", positiveCount > 0);
  setText("spotlightOpportunityName", top ? top.name : "No opportunities identified yet.");
  setText(
    "spotlightOpportunityText",
    top
      ? `${top.action}. Estimated impact: ${formatLei(top.estimatedSavingsLei || 0)}. Priority: ${opportunityStatusMeta(top.score).priority}.`
      : "Please upload consumption data and complete the analysis.",
  );

  const contractOpportunity = opportunityByKey.contract || {};
  const contractMeta = updateMarketplaceCardState("contract", contractOpportunity, "Contract Optimization");
  setText("marketplaceContractScore", formatPercent(contractOpportunity.score || 0));
  setOpportunityStatus("marketplaceContractStatus", "marketplaceContractPriority", contractMeta);
  setText("marketplaceContractSavings", formatLei(contractOpportunity.estimatedSavingsLei || 0));
  setText("marketplaceContractFit", contractMeta.label);
  setText("marketplaceContractStrategy", contractOpportunity.action || "Analiza contract");

  const solarOpportunity = opportunityByKey.solar || {};
  const solarName = pvInstalled ? "Solar Expansion Opportunity" : "Solar Opportunity";
  const solarMeta = updateMarketplaceCardState("solar", solarOpportunity, solarName);
  const estimatedSelfConsumption =
    pvInstalled && (annual.pvMwh || 0) > 0
      ? Math.min(annual.dayMwh || 0, annual.pvMwh || 0)
      : (annual.dayMwh || 0) * ((solarOpportunity.score || 0) / 100) * 0.2;
  setText("marketplaceSolarName", solarName);
  setOpportunityStatus("marketplaceSolarStatus", "marketplaceSolarPriority", solarMeta);
  setText("marketplaceSolarSelfConsumption", formatMetric(estimatedSelfConsumption, " MWh"));
  setText("marketplaceSolarSavings", formatLei(solarOpportunity.estimatedSavingsLei || 0));
  setText("marketplaceSolarCardStatus", solarMeta.label);

  const pvMaintenance = opportunityByKey["pv-maintenance"] || {};
  const pvMeta = updateMarketplaceCardState("pv-maintenance", pvMaintenance, "PV Maintenance Opportunity");
  setOpportunityStatus("marketplacePvStatus", "marketplacePvPriority", pvMeta);
  setText("marketplacePvCapacity", `${numberFormat.format(contract.pvKwp || 0)} kWp`);
  setText("marketplacePvCardStatus", pvInstalled ? pvMeta.label : "Pending Assessment");
  setText("marketplacePvService", pvInstalled ? "Audit productie PV si mentenanta performanta" : "Activeaza dupa introducerea PV/prosumator");

  const storage = opportunityByKey.storage || {};
  const storageMeta = updateMarketplaceCardState("storage", storage, "Storage Opportunity");
  setOpportunityStatus("marketplaceStorageStatus", "marketplaceStoragePriority", storageMeta);
  setText("marketplaceStorageSavings", formatLei(storage.estimatedSavingsLei || 0));
  setText("marketplaceStorageRoi", (storage.estimatedSavingsLei || 0) > 0 ? "Necesita CAPEX" : "CAPEX necesar");
  setText("marketplaceStoragePriorityDetail", storageMeta.priority);

  const grid = opportunityByKey.grid || {};
  const gridMeta = updateMarketplaceCardState("grid", grid, "Grid Optimization");
  const peakDelta = Math.max(0, (annual.peakMw || 0) - (annual.averageMw || 0));
  setOpportunityStatus("marketplaceGridStatus", "marketplaceGridPriority", gridMeta);
  setText("marketplaceGridPeakShaving", hasConsumption ? `${formatMetric(peakDelta, " MW")} peak gap` : "Pending Assessment");
  setText("marketplaceGridImpact", formatLei(grid.estimatedSavingsLei || 0));

  const ev = opportunityByKey.ev || {};
  const evMeta = updateMarketplaceCardState("ev", ev, "EV Charging Opportunity");
  const evUseCase = [...(engine?.evTypes || [])].sort((a, b) => b.score - a.score)[0]?.label || "Pending Assessment";
  setOpportunityStatus("marketplaceEvStatus", "marketplaceEvPriority", evMeta);
  setText("marketplaceEvUseCase", evUseCase);
  setText("marketplaceEvInfrastructure", opportunityInfrastructure(evUseCase));
  setText("marketplaceEvImpact", formatLei(ev.estimatedSavingsLei || 0));

  applyOpportunityFilter();
}

function setBreadcrumb(key = "client") {
  setText("breadcrumbTrail", PROFILE_BREADCRUMBS[key] || PROFILE_BREADCRUMBS.client);
}

function updateTopbarContext(contract = profileContractData()) {
  ["topClientSelector", "sidebarClientSwitcher"].forEach((id) => {
    const selector = $(id);
    if (!selector) return;
    let option = selector.querySelector("option");
    if (!option) {
      option = document.createElement("option");
      selector.appendChild(option);
    }
    option.textContent = contract.clientName || "Client curent";
    option.value = contract.clientName || "current";
  });
  const topDateRange = $("topDateRange");
  const priceYear = $("priceYear");
  if (topDateRange && priceYear) topDateRange.value = priceYear.value || "2025";
}

function updateProfileRoadmapLayout(tab = "client") {
  const layout = PROFILE_ROADMAP_LAYOUTS[tab] || PROFILE_ROADMAP_LAYOUTS.client;
  const view = $("consumptionProfileView");
  if (view) view.dataset.roadmapTab = tab;
  setText("profileRoadmapTitle", layout.profileTitle);
  setText("executivePanelTitle", layout.executiveTitle);
  setText("analyticsPanelTitle", layout.analyticsTitle);
  setText("advancedReportHeading", tab === "reports" ? "Reports" : "Visual Insights");
  setBreadcrumb(tab);
}

function renderProfileRoadmap(metrics, opportunity, contract) {
  if (!$("profileRoadmapTabs")) return;
  updateTopbarContext(contract);
  const chip = $("profileContractStatusChip");
  if (chip) {
    chip.className = `status-chip ${opportunity.clientReady ? "ok" : "warn"}`;
    chip.textContent = opportunity.clientReady ? (contract.clientName || "Client setup salvat") : "Client setup";
  }

  setText("profileKpiPmpPzu", metrics.pmpPzu > 0 ? `${numberFormat.format(metrics.pmpPzu)} lei/MWh` : "0,00");
  setText("profileKpiLoadFactor", formatPercent(metrics.loadFactorPct));
  setText("profileKpiLoadFactorLabel", metrics.totalConsumption > 0 ? `Profil ${loadFactorLabel(metrics.loadFactorPct)}` : "Profil in asteptare");
  setText("profileKpiForecastability", formatPercent(opportunity.forecastabilityScore));
  setText("profileKpiSpotFit", formatPercent(opportunity.spotMarketFitScore));
  setText("profileKpiHedging", formatPercent(opportunity.hedgingScore));
  setText("profileKpiSeasonality", formatPercent(opportunity.seasonalityScore));
  setText("profileKpiSolarFit", formatPercent(opportunity.solarFitScore));
  setText("profileKpiStorageFit", formatPercent(opportunity.storageFitScore));
  setText("profileKpiJtMt", formatPercent(opportunity.jtMtScore));
  setText("profileKpiJtMtLabel", `${opportunityLabel(opportunity.jtMtScore)}${contract.voltage ? ` - ${contract.voltage}` : ""}`);
  setText("profileKpiAtrOptimization", formatPercent(opportunity.atrOptimizationScore));
  setText(
    "profileKpiAtrLabel",
    contract.atrKw > 0
      ? `${opportunity.atrLabel} (${numberFormat.format(opportunity.atrUtilizationPct)}% utilizare)`
      : "ATR profilare separat",
  );
  setText("profileKpiReactive", formatPercent(opportunity.reactiveScore));
  setText(
    "profileKpiReactiveLabel",
    contract.reactiveCostLei > 0 ? `${formatLei(contract.reactiveCostLei)} anual` : "Fara cost introdus",
  );
  setText("profileKpiEnergyOpportunity", formatPercent(opportunity.energyOpportunityScore));
  setText("opportunityDnaContract", opportunity.contractRecommendation || "In asteptare");
  setText("opportunityDnaStorage", formatPercent(opportunity.storageFitScore));
  setText("opportunityDnaSolar", formatPercent(opportunity.solarFitScore));
  setText("opportunityDnaGrid", formatPercent(Math.max(opportunity.atrOptimizationScore || 0, opportunity.jtMtScore || 0)));
}

function stdDeviation(values) {
  const filtered = values.filter((value) => Number.isFinite(value));
  if (!filtered.length) return 0;
  const avg = average(filtered);
  return Math.sqrt(filtered.reduce((sum, value) => sum + (value - avg) ** 2, 0) / filtered.length);
}

function hourlyConsumptionShare(hourlyProfile = [], startHour = 0, endHour = 24) {
  const total = hourlyProfile.reduce((sum, row) => sum + (Number(row.consumptionMwh) || 0), 0);
  if (total <= 0) return 0;
  const selected = hourlyProfile.reduce((sum, row) => {
    const hour = Number(row.hour) || 0;
    const inRange = startHour < endHour ? hour >= startHour && hour < endHour : hour >= startHour || hour < endHour;
    return inRange ? sum + (Number(row.consumptionMwh) || 0) : sum;
  }, 0);
  return (selected / total) * 100;
}

function monthlySeasonalityScore(monthly = []) {
  const values = monthly.map((row) => Number(row.consumptionMwh) || 0).filter((value) => value > 0);
  const avg = average(values);
  if (avg <= 0) return 0;
  return clamp(((Math.max(...values) - Math.min(...values)) / avg) * 100, 0, 100);
}

function confidenceLabel(score) {
  if (score < 50) return "Profil neclar";
  if (score < 70) return "Clasificare moderata";
  if (score < 85) return "Clasificare buna";
  return "Clasificare foarte sigura";
}

function procurementContractRecommendation(strategy) {
  if (strategy === "Forward Friendly") return "Pret fix 12-24 luni / hedging forward";
  if (strategy === "Spot Friendly") return "PZU orar";
  if (strategy === "Hybrid Strategy") return "Banda + PZU";
  if (strategy === "High Risk Profile") return "Pret fix + marja de risc";
  return "Fix + componenta indexata";
}

function percentile(values, p) {
  const filtered = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!filtered.length) return null;
  if (filtered.length === 1) return filtered[0];
  const index = (filtered.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  return filtered[lower] + (filtered[upper] - filtered[lower]) * weight;
}

function formatNullableMetric(value, suffix = "") {
  return Number.isFinite(value) ? `${numberFormat.format(value)}${suffix}` : "N/A";
}

function riskGaugeLabel(score) {
  if (!Number.isFinite(score)) return "Risc in asteptare";
  if (score <= 25) return "Risc redus";
  if (score <= 50) return "Risc mediu";
  if (score <= 75) return "Risc ridicat";
  return "Risc critic";
}

function riskGaugeClass(score) {
  if (!Number.isFinite(score)) return "warn";
  if (score <= 25) return "ok";
  if (score <= 50) return "warn";
  if (score <= 75) return "high";
  return "critical";
}

function peakRiskFromRatio(ratio) {
  if (!Number.isFinite(ratio)) return null;
  if (ratio <= 1.5) return 10;
  if (ratio <= 2.5) return 35;
  if (ratio <= 4) return 65;
  return 90;
}

function peakBaseRatioLabel(ratio) {
  if (!Number.isFinite(ratio)) return "N/A";
  if (ratio <= 1.5) return "Profil foarte stabil";
  if (ratio <= 2.5) return "Profil stabil/moderat";
  if (ratio <= 4) return "Profil cu varfuri relevante";
  return "Profil cu varfuri puternice";
}

function costConcentrationLabel(score) {
  if (!Number.isFinite(score)) return "Indisponibil";
  if (score <= 25) return "Cost distribuit uniform";
  if (score <= 50) return "Cost moderat concentrat";
  if (score <= 75) return "Cost concentrat";
  return "Cost foarte concentrat";
}

function buildLoadDna(rows = []) {
  const values = rows
    .map((row) => Number(row.consumption_mwh))
    .filter((value) => Number.isFinite(value) && value > 0);
  const sortedDesc = [...values].sort((a, b) => b - a);
  const peakloadMw = sortedDesc.length ? sortedDesc[0] : null;
  const baseloadMw = percentile(values, 0.1);
  const midloadMw = percentile(values, 0.5);
  const highloadMw = percentile(values, 0.9);
  const peakBaseRatio = baseloadMw && baseloadMw > 0 && peakloadMw ? peakloadMw / baseloadMw : null;
  const peakRiskScore = peakRiskFromRatio(peakBaseRatio);
  const sampleSize = sortedDesc.length > 300 ? 300 : sortedDesc.length;
  const points =
    sampleSize > 0
      ? Array.from({ length: sampleSize }, (_, index) => {
          const sourceIndex = sampleSize === 1 ? 0 : Math.round((index / (sampleSize - 1)) * (sortedDesc.length - 1));
          return {
            hour: sourceIndex + 1,
            value: sortedDesc[sourceIndex],
          };
        })
      : [];
  return {
    validHours: values.length,
    sortedDesc,
    points,
    peakloadMw,
    baseloadMw,
    midloadMw,
    highloadMw,
    peakBaseRatio,
    peakRiskScore,
    label: peakBaseRatioLabel(peakBaseRatio),
  };
}

function buildCostDna(rows = []) {
  const validRows = rows
    .map((row, index) => {
      const consumption = Number(row.consumption_mwh);
      const price = Number(row.price_lei_mwh);
      if (!Number.isFinite(consumption) || consumption <= 0 || !Number.isFinite(price) || Math.abs(price) <= 0) return null;
      const cost = consumption * price;
      const parts = rowDateParts(row, index);
      return {
        index,
        timestamp: row.timestamp || `${selectedYear()}-${String(parts.monthIndex + 1).padStart(2, "0")}-${String(parts.day).padStart(2, "0")} ${String(parts.hour).padStart(2, "0")}:00`,
        consumption,
        price,
        cost,
      };
    })
    .filter(Boolean);

  if (!validRows.length) {
    return {
      available: false,
      totalCost: 0,
      top10: [],
      top100Share: null,
      concentrationIndex: null,
      expensiveCostShare: null,
      cheapCostShare: null,
      distribution: [
        { label: "Ore ieftine PZU", value: 0 },
        { label: "Ore medii PZU", value: 0 },
        { label: "Ore scumpe PZU", value: 0 },
      ],
    };
  }

  const sortedByCost = [...validRows].sort((a, b) => b.cost - a.cost);
  const totalCost = validRows.reduce((sum, row) => sum + row.cost, 0);
  const positiveTotalCost = validRows.reduce((sum, row) => sum + Math.max(row.cost, 0), 0);
  const top100 = sortedByCost.slice(0, Math.min(100, sortedByCost.length));
  const top100Cost = top100.reduce((sum, row) => sum + Math.max(row.cost, 0), 0);
  const top100Share = positiveTotalCost > 0 ? (top100Cost / positiveTotalCost) * 100 : 0;
  const concentrationIndex = Math.min(100, top100Share * 4);
  const sortedByPrice = [...validRows].sort((a, b) => a.price - b.price);
  const bucketSize = Math.max(1, Math.ceil(sortedByPrice.length * 0.2));
  const cheapRows = new Set(sortedByPrice.slice(0, bucketSize).map((row) => row.index));
  const expensiveRows = new Set(sortedByPrice.slice(-bucketSize).map((row) => row.index));
  const costByBucket = validRows.reduce(
    (acc, row) => {
      const cost = Math.max(row.cost, 0);
      if (cheapRows.has(row.index)) acc.cheap += cost;
      else if (expensiveRows.has(row.index)) acc.expensive += cost;
      else acc.medium += cost;
      return acc;
    },
    { cheap: 0, medium: 0, expensive: 0 },
  );
  const expensiveCostShare = positiveTotalCost > 0 ? (costByBucket.expensive / positiveTotalCost) * 100 : 0;
  const cheapCostShare = positiveTotalCost > 0 ? (costByBucket.cheap / positiveTotalCost) * 100 : 0;
  return {
    available: true,
    validHours: validRows.length,
    totalCost,
    positiveTotalCost,
    top10: sortedByCost.slice(0, 10),
    top100Share,
    concentrationIndex,
    expensiveCostShare,
    cheapCostShare,
    distribution: [
      { label: "Ore ieftine PZU", value: costByBucket.cheap },
      { label: "Ore medii PZU", value: costByBucket.medium },
      { label: "Ore scumpe PZU", value: costByBucket.expensive },
    ],
  };
}

function riskDnaText(score) {
  if (!Number.isFinite(score)) return "Curba orara de consum este necesara pentru generarea Energy Profile Intelligence.";
  if (score <= 25) {
    return "Profilul prezinta risc redus, cu un consum predictibil si o volatilitate scazuta. Achizitia poate fi structurata cu un grad bun de incredere.";
  }
  if (score <= 50) {
    return "Profilul prezinta risc mediu, cu variatii moderate ale consumului. Se recomanda o structura contractuala echilibrata si monitorizare lunara.";
  }
  if (score <= 75) {
    return "Profilul prezinta risc ridicat, cauzat de volatilitate, sezonalitate sau varfuri relevante de consum. Contractarea trebuie sa includa protectie la variatii.";
  }
  return "Profilul prezinta risc critic pentru achizitie, cu predictibilitate redusa si expunere ridicata la costuri. Se recomanda prudenta si conditii stricte de prognoza.";
}

function loadDnaText(ratio) {
  if (!Number.isFinite(ratio)) return "Curba orara de consum este necesara pentru generarea Load DNA.";
  if (ratio <= 1.5) {
    return "Curba de durata indica un profil foarte stabil, cu sarcina de baza ridicata si varfuri reduse fata de consumul permanent.";
  }
  if (ratio <= 2.5) {
    return "Curba de durata indica un profil stabil, dar cu varfuri moderate de consum. Profilul poate sustine o structura contractuala predictibila.";
  }
  if (ratio <= 4) {
    return "Curba de durata indica existenta unor varfuri relevante de consum. Acestea pot crea costuri suplimentare si justifica masuri de peak shaving.";
  }
  return "Curba de durata evidentiaza varfuri puternice raportate la sarcina de baza. Profilul necesita analiza de reducere a varfurilor si optimizare ATR.";
}

function costDnaText(score, available) {
  if (!available) return "Cost DNA este indisponibil pana cand exista consum orar si preturi PZU valide.";
  if (score > 75) {
    return "Costul energiei este foarte concentrat intr-un numar redus de ore, ceea ce indica potential ridicat pentru management activ al consumului si stocare.";
  }
  if (score > 50) {
    return "Costul energiei este concentrat in intervale relevante, ceea ce indica potential de optimizare prin contractare, flexibilitate sau baterie.";
  }
  if (score > 25) {
    return "Costul energiei este moderat concentrat, fara o dependenta excesiva de un numar redus de ore, dar merita monitorizate orele scumpe.";
  }
  return "Costul energiei este distribuit relativ uniform pe parcursul perioadei analizate, cu expunere redusa la cateva intervale dominante.";
}

function procurementReportText(dna) {
  if (!dna.hasConsumption) return "Curba orara de consum este necesara pentru generarea Energy Profile Intelligence.";
  const parts = [dna.riskText, dna.loadText, dna.costText];
  if (dna.validConsumptionHours > 0 && dna.validConsumptionHours < 500) {
    parts.unshift("Numar redus de ore disponibile. Clasificarea Energy Profile Intelligence poate avea acuratete limitata.");
  }
  parts.push(`Recomandarea contractuala rezultata este: ${dna.contractRecommendation}.`);
  return parts.filter(Boolean).join(" ");
}

function procurementRecommendationFromStrategy(strategy, riskScore, costDna, loadDna) {
  let recommendation = "Fix + componenta indexata";
  if (strategy === "Forward Friendly" && riskScore <= 25) recommendation = "Pret fix 12-24 luni / acoperire forward";
  else if (strategy === "Spot Friendly" && riskScore <= 50) recommendation = "PZU orar cu monitorizare lunara";
  else if (strategy === "Hybrid Strategy") recommendation = "Banda + PZU / structura mixta";
  else if (strategy === "High Risk Profile") recommendation = "Pret fix + marja de risc / conditii stricte prognoza";

  const notes = [];
  if ((costDna.concentrationIndex || 0) > 70) {
    notes.push("Analiza recomandata pentru reducerea expunerii in orele de cost ridicat.");
  }
  if (Number.isFinite(loadDna.peakBaseRatio) && loadDna.peakBaseRatio > 3) {
    notes.push("Analiza recomandata pentru reducerea varfurilor de consum si optimizarea ATR.");
  }
  return { recommendation, subtext: notes.join(" ") || "Strategie contractuala recomandata" };
}

function buildProcurementDna(profile, metrics, analytics, opportunity, contract, rows = state.lastProfileRows) {
  const annual = analytics?.annual || {};
  const scores = analytics?.scores || {};
  const monthly = analytics?.monthly || [];
  const hourlyProfile = analytics?.hourlyProfile || [];
  const hasConsumption = (metrics.totalConsumption || 0) > 0;
  const hasPrices = (metrics.pricedHours || 0) > 0;
  const loadDna = buildLoadDna(rows);
  const costDna = buildCostDna(rows);
  const dailyValues = (profile.daily || []).map((row) => Number(row.totalMwh) || 0).filter((value) => value > 0);
  const dailyAverage = average(dailyValues);
  const dailyCv = dailyAverage > 0 ? stdDeviation(dailyValues) / dailyAverage : 1;
  const forecastabilityScore = hasConsumption ? clamp(100 - dailyCv * 100, 0, 100) : 0;
  const volatilityScore = hasConsumption ? clamp(scores.volatilityScore || 100 - forecastabilityScore, 0, 100) : 0;
  const seasonalityScore = monthlySeasonalityScore(monthly);
  const loadFactorScore = clamp(metrics.loadFactorPct || 0, 0, 100);
  const stabilityScore = clamp(scores.stabilityScore || loadFactorScore, 0, 100);
  const nightRatio = clamp(annual.nightPct ?? metrics.nightPct, 0, 100);
  const dayRatio = clamp(annual.dayPct ?? metrics.dayPct, 0, 100);
  const weekendRatio = clamp(annual.weekendPct || 0, 0, 100);
  const weekdayRatio = clamp(annual.weekdayPct || 0, 0, 100);
  const day0622 = hourlyConsumptionShare(hourlyProfile, 6, 22);
  const day0717 = hourlyConsumptionShare(hourlyProfile, 7, 17);
  const day0818 = hourlyConsumptionShare(hourlyProfile, 8, 18);
  const day0921 = hourlyConsumptionShare(hourlyProfile, 9, 21);
  const eveningPct = clamp(metrics.eveningPct || hourlyConsumptionShare(hourlyProfile, 18, 22), 0, 100);
  const monthlyValues = monthly.map((row) => Number(row.consumptionMwh) || 0).filter((value) => value > 0);
  const monthlyAverage = average(monthlyValues);
  const maxMonth = monthlyValues.length ? Math.max(...monthlyValues) : 0;

  let operationalProfile = "Profil mixt";
  if (hasConsumption) {
    if (seasonalityScore > 60 || (monthlyAverage > 0 && maxMonth > 1.5 * monthlyAverage)) operationalProfile = "Sezonier";
    else if (loadFactorScore > 75 && weekendRatio > 70 && nightRatio > 40) operationalProfile = "Industrial 24/7";
    else if (loadFactorScore >= 60 && loadFactorScore <= 75 && weekendRatio > 50 && nightRatio > 30) operationalProfile = "Industrial 3 schimburi";
    else if (day0622 > 70 && nightRatio < 30 && weekendRatio < 60) operationalProfile = "Industrial 2 schimburi";
    else if (day0717 > 65 && nightRatio < 20 && weekendRatio < 30) operationalProfile = "Industrial 1 schimb";
    else if (day0921 > 70 && weekendRatio > 60 && nightRatio < 25) operationalProfile = "Retail / comercial";
    else if (loadFactorScore > 60 && weekendRatio > 70 && seasonalityScore < 30) operationalProfile = "Logistica";
  }

  const profileAdvantage =
    hasPrices && annual.simplePzuAverageLeiMwh > 0
      ? ((annual.simplePzuAverageLeiMwh - annual.pmpPzuLeiMwh) / annual.simplePzuAverageLeiMwh) * 100
      : 0;
  const spotMarketFit = hasPrices
    ? clamp(
        (annual.pmpPzuLeiMwh < annual.simplePzuAverageLeiMwh ? 35 : 0) +
          ((annual.cheapConsumptionMwh || 0) > (annual.expensiveConsumptionMwh || 0) ? 35 : 0) +
          clamp(profileAdvantage, -20, 30) +
          (annual.cheapConsumptionPct || 0) * 0.2,
        0,
        100,
      )
    : 0;
  const hedgingFit = hasConsumption
    ? clamp(0.4 * forecastabilityScore + 0.4 * loadFactorScore + 0.2 * (100 - seasonalityScore), 0, 100)
    : 0;
  const peakRiskScore = Number.isFinite(loadDna.peakRiskScore) ? loadDna.peakRiskScore : null;
  const riskScore = hasConsumption && Number.isFinite(peakRiskScore)
    ? clamp(0.35 * (100 - forecastabilityScore) + 0.25 * seasonalityScore + 0.25 * volatilityScore + 0.15 * peakRiskScore, 0, 100)
    : null;

  let procurementStrategy = "High Risk Profile";
  if (!hasConsumption) procurementStrategy = "Introdu curbe";
  else if (Number.isFinite(riskScore) && riskScore <= 25 && hedgingFit > 75) {
    procurementStrategy = "Forward Friendly";
  } else if (Number.isFinite(riskScore) && riskScore <= 50 && spotMarketFit > 75) {
    procurementStrategy = "Spot Friendly";
  } else if (Number.isFinite(riskScore) && riskScore > 60) {
    procurementStrategy = "High Risk Profile";
  } else if (Number.isFinite(riskScore) && riskScore >= 26 && riskScore <= 60) {
    procurementStrategy = "Hybrid Strategy";
  } else {
    procurementStrategy = "Hybrid Strategy";
  }

  const solarReadiness = day0818 > 60 ? "Solar Ready" : day0818 >= 40 ? "Solar Medium Fit" : "Solar Low Fit";
  const storageReady = (scores.bessFitScore || 0) > 70 && eveningPct > 15 && (annual.priceSpreadLeiMwh || 0) > 300;
  const storageReadiness = storageReady ? "Storage Ready" : (scores.bessFitScore || 0) >= 45 || eveningPct > 15 ? "Storage Medium Fit" : "Storage Low Fit";
  const monthlyAverageMwh = metrics.totalConsumption > 0 ? metrics.totalConsumption / 12 : 0;
  const peakKw = (metrics.peakMw || 0) * 1000;
  const approvedKw = contract.approvedPowerKw || contract.atrKw || 0;
  const gridUtilizationPct = approvedKw > 0 ? (peakKw / approvedKw) * 100 : 0;
  let gridOptimization = "No Grid Opportunity";
  if (contract.voltage === "JT" && monthlyAverageMwh > 50) gridOptimization = "JT -> MT Opportunity";
  else if (approvedKw > 0 && gridUtilizationPct >= 90) gridOptimization = "ATR Optimization";

  const opportunityItems = [];
  if ((costDna.concentrationIndex || 0) > 70 && (scores.bessFitScore || 0) > 70) opportunityItems.push("Storage Ready");
  else if (storageReadiness === "Storage Ready") opportunityItems.push("Storage Ready");
  else if (solarReadiness === "Solar Ready") opportunityItems.push("Solar Ready");
  if (Number.isFinite(loadDna.peakBaseRatio) && loadDna.peakBaseRatio > 3) opportunityItems.push("Peak Shaving Opportunity");
  if (Number.isFinite(loadDna.peakBaseRatio) && loadDna.peakBaseRatio > 3 && gridOptimization === "ATR Optimization") {
    opportunityItems.push("Grid Optimization Ready");
  } else if (gridOptimization !== "No Grid Opportunity" && !opportunityItems.includes("Grid Optimization Ready")) {
    opportunityItems.push("Grid Optimization Ready");
  }
  const opportunityDna = opportunityItems.length ? [...new Set(opportunityItems)].join(" + ") : "No Immediate Opportunity";

  const confidenceScore = hasConsumption
    ? clamp(0.35 * forecastabilityScore + 0.25 * loadFactorScore + 0.2 * (100 - seasonalityScore) + 0.2 * stabilityScore, 0, 100)
    : 0;
  const riskLevel = riskGaugeLabel(riskScore);
  const recommendation = procurementRecommendationFromStrategy(procurementStrategy, riskScore || 0, costDna, loadDna);
  const contractRecommendation = recommendation.recommendation;
  const finalOutput = hasConsumption
    ? `${operationalProfile} | ${procurementStrategy} | ${opportunityDna}`
    : "Profil mixt | High Risk Profile | No Immediate Opportunity";
  const loadBuckets = [
    { label: "00-06", value: hourlyProfile.filter((row) => row.hour >= 0 && row.hour < 6).reduce((sum, row) => sum + (Number(row.consumptionMwh) || 0), 0) },
    { label: "06-12", value: hourlyProfile.filter((row) => row.hour >= 6 && row.hour < 12).reduce((sum, row) => sum + (Number(row.consumptionMwh) || 0), 0) },
    { label: "12-18", value: hourlyProfile.filter((row) => row.hour >= 12 && row.hour < 18).reduce((sum, row) => sum + (Number(row.consumptionMwh) || 0), 0) },
    { label: "18-24", value: hourlyProfile.filter((row) => row.hour >= 18 && row.hour < 24).reduce((sum, row) => sum + (Number(row.consumptionMwh) || 0), 0) },
  ];

  const dna = {
    hasConsumption,
    operationalProfile,
    procurementStrategy,
    opportunityDna,
    finalOutput,
    confidenceScore,
    confidenceLabel: confidenceLabel(confidenceScore),
    validConsumptionHours: loadDna.validHours,
    lowHoursWarning: loadDna.validHours > 0 && loadDna.validHours < 500,
    riskScore,
    riskGaugeClass: riskGaugeClass(riskScore),
    riskLevel,
    riskLabel: hasConsumption && Number.isFinite(riskScore) ? `${numberFormat.format(riskScore)} / 100 - ${riskLevel}` : "Risc in asteptare",
    contractRecommendation,
    contractRecommendationSubtext: recommendation.subtext,
    loadFactorScore,
    dayRatio,
    nightRatio,
    weekdayRatio,
    weekendRatio,
    seasonalityScore,
    forecastabilityScore,
    volatilityScore,
    peakRiskScore,
    spotMarketFit,
    hedgingFit,
    loadDna,
    costDna,
    riskText: riskDnaText(riskScore),
    loadText: loadDnaText(loadDna.peakBaseRatio),
    costText: costDnaText(costDna.concentrationIndex, costDna.available),
    solarReadiness,
    solarLabel: `${numberFormat.format(day0818)}% consum 08:00-18:00`,
    storageReadiness,
    storageLabel: `${numberFormat.format(scores.bessFitScore || 0)}% BESS fit / ${numberFormat.format(eveningPct)}% seara / ${numberFormat.format(annual.priceSpreadLeiMwh || 0)} lei/MWh spread`,
    gridOptimization,
    gridLabel:
      gridOptimization === "JT -> MT Opportunity"
        ? `JT si ${numberFormat.format(monthlyAverageMwh)} MWh/luna`
        : gridOptimization === "ATR Optimization"
          ? `${numberFormat.format(gridUtilizationPct)}% utilizare putere aprobata`
          : "Fara oportunitate imediata",
    reportText: "",
    radar: [
      { label: "Forecastability", value: forecastabilityScore },
      { label: "Spot Fit", value: spotMarketFit },
      { label: "Hedging Fit", value: hedgingFit },
      { label: "Solar Fit", value: day0818 },
      { label: "Storage Fit", value: scores.bessFitScore || 0 },
      { label: "Stability", value: stabilityScore },
    ],
    loadBuckets,
    weekdayWeekend: [
      { label: "Weekday", value: annual.weekdayMwh || 0 },
      { label: "Weekend", value: annual.weekendMwh || 0 },
    ],
    monthlySeasonality: monthly.map((row) => ({ label: row.month, value: Number(row.consumptionMwh) || 0 })),
  };
  dna.reportText = procurementReportText(dna);
  return dna;
}

function energyRiskLevel(score) {
  if (!Number.isFinite(score)) return "Pending Assessment";
  if (score <= 25) return "Low Risk";
  if (score <= 50) return "Medium Risk";
  return "High Risk";
}

function energyRiskColor(score) {
  if (!Number.isFinite(score)) return "#94A3B8";
  if (score <= 25) return BRAND.success;
  if (score <= 50) return BRAND.warning;
  if (score <= 75) return "#F97316";
  return BRAND.risk;
}

function scoreOrUnavailable(value) {
  return Number.isFinite(value) ? formatPercent(value) : "N/A";
}

function procurementPersonaFromDna(dna) {
  if (!dna?.hasConsumption) return "Additional consumption history required";
  if (dna.storageReadiness === "Storage Ready") return "Storage Ready Consumer";
  if (dna.solarReadiness === "Solar Ready") return "Solar Friendly Consumer";
  if (Number.isFinite(dna.riskScore) && dna.riskScore > 60) return "Volatile Consumer";
  if ((dna.nightRatio || 0) >= 45) return "Night Intensive Consumer";
  if ((dna.dayRatio || 0) >= 65) return "Daytime Industrial Consumer";
  if ((dna.loadFactorScore || 0) >= 70) return "Stable Baseload Consumer";
  if ((dna.spotMarketFit || 0) >= 70) return "Flexible Consumer";
  return "Hybrid Consumer";
}

function personaExplanation(persona, dna) {
  if (!dna?.hasConsumption) return "Clientul va fi clasificat automat dupa introducerea curbelor orare.";
  const explanations = {
    "Storage Ready Consumer": "Profilul are flexibilitate si/sau expunere la preturi care pot sustine analiza BESS.",
    "Solar Friendly Consumer": "Consum relevant in intervalul solar, util pentru propuneri PV sau extindere PV.",
    "Volatile Consumer": "Consum cu variatii relevante, care necesita prudenta in achizitie si prognoza.",
    "Night Intensive Consumer": "Consum important in intervalul de noapte, relevant pentru produse si tarife adaptate.",
    "Daytime Industrial Consumer": "Consum concentrat ziua, usor de explicat comercial pentru PV si contractare.",
    "Stable Baseload Consumer": "Consum stabil, cu sarcina de baza buna si predictibilitate ridicata.",
    "Flexible Consumer": "Profil cu potential de optimizare prin PZU, flexibilitate si monitorizare activa.",
    "Hybrid Consumer": "Profil mixt, recomandat pentru contractare echilibrata si analiza pe oportunitati.",
  };
  return explanations[persona] || explanations["Hybrid Consumer"];
}

function evReadinessLabel(metrics, contract) {
  if (!(metrics?.totalConsumption > 0)) return "Pending Assessment";
  const averageMw = Number(metrics.averageMw) || 0;
  const dayPct = Number(metrics.dayPct) || 0;
  const nightPct = Number(metrics.nightPct) || 0;
  if ((contract?.voltage === "MT" || contract?.voltage === "IT") && averageMw >= 0.5) return "Truck Charging Fit";
  if (nightPct >= 35 && averageMw >= 0.25) return "Fleet Charging Fit";
  if (dayPct >= 55) return "Employee Charging Fit";
  return "Visitor Charging Fit";
}

function fillInsightList(id, items = [], fallback = "Additional consumption history required.") {
  const target = $(id);
  if (!target) return;
  target.innerHTML = "";
  const values = items.filter(Boolean).slice(0, 4);
  (values.length ? values : [fallback]).forEach((text) => {
    const item = document.createElement("span");
    item.textContent = text;
    target.appendChild(item);
  });
}

function renderEnergyProfileIntelligenceUi(dna, metrics, analytics, opportunity, contract) {
  const annual = analytics?.annual || {};
  const persona = procurementPersonaFromDna(dna);
  const commercialPotential = Number(opportunity?.energyOpportunityScore) || 0;
  const riskScore = Number.isFinite(dna.riskScore) ? dna.riskScore : null;
  const forecastRisk = dna.hasConsumption ? clamp(100 - (dna.forecastabilityScore || 0), 0, 100) : null;
  const priceRisk = Number.isFinite(dna.costDna?.concentrationIndex) ? dna.costDna.concentrationIndex : null;
  const volumeRisk = Number.isFinite(dna.peakRiskScore) ? dna.peakRiskScore : (dna.hasConsumption ? dna.volatilityScore : null);
  const loadStability = dna.hasConsumption ? clamp(100 - (dna.volatilityScore || 0), 0, 100) : 0;
  const priceSensitivityScore = dna.costDna?.available ? clamp((annual.priceSpreadLeiMwh || 0) / 8, 0, 100) : null;
  const peakThreshold = Number.isFinite(dna.loadDna?.highloadMw) ? dna.loadDna.highloadMw : dna.loadDna?.peakloadMw;
  const loadValues = dna.loadDna?.sortedDesc || [];
  const peakValues = Number.isFinite(peakThreshold) ? loadValues.filter((value) => value >= peakThreshold) : [];
  const peakShare =
    peakValues.length && loadValues.length
      ? (peakValues.reduce((sum, value) => sum + value, 0) / loadValues.reduce((sum, value) => sum + value, 0)) * 100
      : null;
  const evReadiness = evReadinessLabel(metrics, contract);

  $("energyProfileEmptyState")?.classList.toggle("is-hidden", Boolean(dna.hasConsumption));
  setText("energyProcurementPersona", persona);
  setText("energyPersonaTitle", persona);
  setText("energyPersonaText", personaExplanation(persona, dna));
  setText("energyCommercialPotential", formatPercent(commercialPotential));
  setText("energyCommercialPotentialLabel", commercialPotential > 65 ? "Potential comercial ridicat" : commercialPotential > 35 ? "Potential comercial mediu" : "Oportunitati in asteptare");
  setText("riskDnaLevelText", energyRiskLevel(riskScore));
  setText("riskGaugeValue", Number.isFinite(riskScore) ? `${Math.round(riskScore)}` : "N/A");
  const gauge = $("riskGaugeCircle");
  if (gauge) {
    gauge.style.setProperty("--risk-score", String(Number.isFinite(riskScore) ? clamp(riskScore, 0, 100) : 0));
    gauge.style.setProperty("--risk-color", energyRiskColor(riskScore));
  }
  setText("riskDnaPriceRisk", scoreOrUnavailable(priceRisk));
  setText("riskDnaVolumeRisk", scoreOrUnavailable(volumeRisk));
  setText("riskDnaForecastRisk", scoreOrUnavailable(forecastRisk));
  setText("loadDnaLoadFactor", formatPercent(dna.loadFactorScore || 0));
  setText("loadDnaStabilityIndex", formatPercent(loadStability));
  setText("loadDnaConsumptionVariability", formatPercent(dna.volatilityScore || 0));
  setText("loadDnaPeakHours", peakValues.length ? `${peakValues.length} ore` : "N/A");
  setText("loadDnaPeakShare", Number.isFinite(peakShare) ? formatPercent(peakShare) : "N/A");
  setText("costDnaExposureScore", Number.isFinite(priceRisk) ? formatPercent(priceRisk) : "Indisponibil");
  setText("costDnaPriceSensitivity", Number.isFinite(priceSensitivityScore) ? formatPercent(priceSensitivityScore) : "Indisponibil");
  setText("costDnaProcurementRisk", Number.isFinite(riskScore) ? energyRiskLevel(riskScore) : "Indisponibil");
  setText("costExposureTopHours", dna.costDna?.top10?.length ? `${dna.costDna.top10.length} ore` : "N/A");
  setText("opportunityDnaStorage", dna.storageReadiness);
  setText("opportunityDnaStorageLabel", dna.storageLabel);
  setText("opportunityDnaSolar", dna.solarReadiness);
  setText("opportunityDnaSolarLabel", dna.solarLabel);
  setText("opportunityDnaContract", dna.contractRecommendation || "In asteptare");
  setText("opportunityDnaGrid", dna.gridOptimization);
  setText("opportunityDnaGridLabel", dna.gridLabel);
  setText("opportunityDnaEv", evReadiness);
  setText("opportunityDnaEvLabel", evReadiness === "Pending Assessment" ? "Necesita date de consum" : "Use case EV estimat din profil");

  const strengths = [];
  if ((dna.forecastabilityScore || 0) >= 70) strengths.push(`Forecastability buna: ${formatPercent(dna.forecastabilityScore)}`);
  if ((dna.loadFactorScore || 0) >= 60) strengths.push(`Load factor stabil: ${formatPercent(dna.loadFactorScore)}`);
  if (Number.isFinite(riskScore) && riskScore <= 35) strengths.push(`Risc energetic controlat: ${energyRiskLevel(riskScore)}`);
  if (dna.solarReadiness === "Solar Ready") strengths.push("Consum potrivit pentru PV");
  const risks = [];
  if (Number.isFinite(riskScore) && riskScore > 50) risks.push(`Risk DNA ridicat: ${formatPercent(riskScore)}`);
  if (Number.isFinite(dna.loadDna?.peakBaseRatio) && dna.loadDna.peakBaseRatio > 3) risks.push(`Peak/Base Ratio mare: ${numberFormat.format(dna.loadDna.peakBaseRatio)}`);
  if (Number.isFinite(priceRisk) && priceRisk > 50) risks.push(`Cost concentration: ${formatPercent(priceRisk)}`);
  if ((dna.seasonalityScore || 0) > 50) risks.push(`Seasonality risk: ${formatPercent(dna.seasonalityScore)}`);
  const opportunities = [
    dna.contractRecommendation ? `Contract: ${dna.contractRecommendation}` : null,
    dna.storageReadiness !== "Storage Low Fit" ? `Storage: ${dna.storageReadiness}` : null,
    dna.solarReadiness !== "Solar Low Fit" ? `Solar: ${dna.solarReadiness}` : null,
    dna.gridOptimization !== "No Grid Opportunity" ? `Grid: ${dna.gridOptimization}` : null,
    evReadiness !== "Pending Assessment" ? `EV: ${evReadiness}` : null,
  ];
  fillInsightList("energyTopStrengths", strengths);
  fillInsightList("energyTopRisks", risks, "Nu exista riscuri majore identificate inca.");
  fillInsightList("energyTopOpportunities", opportunities);
}

function renderProcurementDna(profile, metrics, analytics, opportunity, contract, rows = state.lastProfileRows) {
  if (!$("procurementDnaLabel")) return;
  const dna = buildProcurementDna(profile, metrics, analytics, opportunity, contract, rows);
  state.procurementDna = dna;
  window.bessProcurementDna = dna;
  setText("procurementDnaLabel", dna.finalOutput);
  setText(
    "procurementDnaSubtext",
    dna.lowHoursWarning
      ? "Numar redus de ore disponibile. Clasificarea Energy Profile Intelligence poate avea acuratete limitata."
      : "Profil operational, strategie achizitie si oportunitate energetica",
  );
  setText("procurementConfidence", formatPercent(dna.confidenceScore));
  setText("procurementConfidenceLabel", dna.confidenceLabel);
  setText("procurementRiskGauge", Number.isFinite(dna.riskScore) ? `${numberFormat.format(dna.riskScore)} / 100` : "N/A");
  setText("procurementContractRecommendation", dna.contractRecommendation);
  setText("procurementContractRecommendationSubtext", dna.contractRecommendationSubtext);
  setText("procurementRiskLabel", dna.riskLabel);
  setText("riskDnaForecastability", formatPercent(dna.forecastabilityScore));
  setText("riskDnaSeasonality", formatPercent(dna.seasonalityScore));
  setText("riskDnaVolatility", formatPercent(dna.volatilityScore));
  setText("riskDnaPeakRisk", Number.isFinite(dna.peakRiskScore) ? formatPercent(dna.peakRiskScore) : "N/A");
  setText("riskDnaGaugeTotal", Number.isFinite(dna.riskScore) ? formatPercent(dna.riskScore) : "N/A");
  setText("riskDnaGaugeLabel", dna.riskLevel);
  ["procurementRiskGauge", "riskDnaGaugeTotal"].forEach((id) => {
    const card = $(id)?.closest(".procurement-card");
    if (!card) return;
    card.classList.remove("risk-ok", "risk-warn", "risk-high", "risk-critical");
    card.classList.add(`risk-${dna.riskGaugeClass}`);
  });
  setText("riskDnaInterpretation", dna.riskText);
  setText("procurementBaseload", formatNullableMetric(dna.loadDna.baseloadMw, " MW"));
  setText("procurementMidload", formatNullableMetric(dna.loadDna.midloadMw, " MW"));
  setText("procurementPeakload", formatNullableMetric(dna.loadDna.peakloadMw, " MW"));
  setText("procurementPeakBaseRatio", formatNullableMetric(dna.loadDna.peakBaseRatio));
  setText("procurementPeakBaseLabel", dna.loadDna.label);
  setText("loadDnaInterpretation", dna.loadText);
  setText("procurementTotalCost", dna.costDna.available ? formatLei(dna.costDna.totalCost) : "Indisponibil");
  setText("procurementCostConcentration", Number.isFinite(dna.costDna.concentrationIndex) ? formatPercent(dna.costDna.concentrationIndex) : "Indisponibil");
  setText("procurementCostConcentrationLabel", costConcentrationLabel(dna.costDna.concentrationIndex));
  setText("procurementTop100Share", Number.isFinite(dna.costDna.top100Share) ? formatPercent(dna.costDna.top100Share) : "Indisponibil");
  setText("procurementExpensiveCostShare", Number.isFinite(dna.costDna.expensiveCostShare) ? formatPercent(dna.costDna.expensiveCostShare) : "Indisponibil");
  setText("procurementCheapCostShare", Number.isFinite(dna.costDna.cheapCostShare) ? formatPercent(dna.costDna.cheapCostShare) : "Indisponibil");
  setText("costDnaInterpretation", dna.costText);
  setText("procurementFinalOutput", dna.finalOutput);
  setText("procurementReportText", dna.reportText);
  renderEnergyProfileIntelligenceUi(dna, metrics, analytics, opportunity, contract);
  drawProcurementDnaCharts(dna);
}

function renderGeneratedSourcingData(analytics) {
  if (!$("analyticsStatus") || !analytics) return;
  const annual = analytics.annual || {};
  const scores = analytics.scores || {};
  const hasConsumption = (Number(annual.consumptionMwh) || 0) > 0;
  const hasPrices = (Number(annual.pricedHours) || 0) > 0;

  $("analyticsPmpAnnual").textContent = hasPrices ? formatMetric(annual.pmpPzuLeiMwh, " lei/MWh") : "0,00";
  $("analyticsSimplePzu").textContent = hasPrices ? formatMetric(annual.simplePzuAverageLeiMwh, " lei/MWh") : "0,00";
  $("analyticsProfileDiff").textContent = hasPrices ? formatMetric(annual.profileDifferenceLeiMwh, " lei/MWh") : "0,00";
  $("analyticsExpensiveMwh").textContent = `${formatMetric(annual.expensiveConsumptionMwh, " MWh")} / ${formatPercent(annual.expensiveConsumptionPct)}`;
  $("analyticsCheapMwh").textContent = `${formatMetric(annual.cheapConsumptionMwh, " MWh")} / ${formatPercent(annual.cheapConsumptionPct)}`;
  $("analyticsWeekdayWeekend").textContent = `${formatPercent(annual.weekdayPct)} / ${formatPercent(annual.weekendPct)}`;
  $("analyticsPvFit").textContent = formatPercent(scores.pvFitScore);
  $("analyticsBessFit").textContent = formatPercent(scores.bessFitScore);

  $("analyticsStatus").textContent = hasConsumption
    ? `Generate din curbe consolidate: ${formatMetric(annual.consumptionMwh, " MWh consum")}, ${Number(annual.pricedHours) || 0} ore PZU.`
    : "Datele se genereaza automat dupa introducerea curbelor consolidate.";

  const sourceChip = $("analyticsSourceChip");
  sourceChip.className = `status-chip ${hasConsumption && hasPrices ? "ok" : hasConsumption ? "warn" : "warn"}`;
  sourceChip.textContent = hasConsumption && hasPrices ? "Date generate" : hasConsumption ? "Lipsesc PZU" : "In asteptare";

  fillKeyValueRows("analyticsAnnualRows", [
    ["PMP PZU client", hasPrices ? formatMetric(annual.pmpPzuLeiMwh, " lei/MWh") : "0,00"],
    ["Media PZU simpla", hasPrices ? formatMetric(annual.simplePzuAverageLeiMwh, " lei/MWh") : "0,00"],
    ["Diferenta profil client", hasPrices ? formatMetric(annual.profileDifferenceLeiMwh, " lei/MWh") : "0,00"],
    ["Consum in top 10% ore scumpe", `${formatMetric(annual.expensiveConsumptionMwh, " MWh")} (${formatPercent(annual.expensiveConsumptionPct)})`],
    ["Consum in top 10% ore ieftine", `${formatMetric(annual.cheapConsumptionMwh, " MWh")} (${formatPercent(annual.cheapConsumptionPct)})`],
    ["Pret mediu ore scumpe", hasPrices ? formatMetric(annual.expensiveAveragePriceLeiMwh, " lei/MWh") : "0,00"],
    ["Pret mediu ore ieftine", hasPrices ? formatMetric(annual.cheapAveragePriceLeiMwh, " lei/MWh") : "0,00"],
    ["Spread scump / ieftin", hasPrices ? formatMetric(annual.priceSpreadLeiMwh, " lei/MWh") : "0,00"],
    ["Consum weekday / weekend", `${formatMetric(annual.weekdayMwh, " MWh")} / ${formatMetric(annual.weekendMwh, " MWh")}`],
  ]);

  fillKeyValueRows("analyticsScoreRows", [
    ["Sourcing Risk Score", formatPercent(scores.sourcingRiskScore)],
    ["Price Exposure Score", formatPercent(scores.priceExposureScore)],
    ["Forecast Risk Score", formatPercent(scores.forecastRiskScore)],
    ["Peak Risk Score", formatPercent(scores.peakRiskScore)],
    ["Volatility Score", formatPercent(scores.volatilityScore)],
    ["Seasonality Score", formatPercent(scores.seasonalityScore)],
    ["Stability Score", formatPercent(scores.stabilityScore)],
    ["Flexibility Score", formatPercent(scores.flexibilityScore)],
    ["PV Fit Score", formatPercent(scores.pvFitScore)],
    ["BESS Fit Score", formatPercent(scores.bessFitScore)],
  ]);

  const monthlyBody = $("analyticsMonthlyRows");
  if (monthlyBody) {
    monthlyBody.innerHTML = "";
    (analytics.monthly || []).forEach((row) => {
      const tr = document.createElement("tr");
      [
        row.month,
        formatMetric(row.consumptionMwh),
        formatMetric(row.pvMwh),
        hasPrices ? formatMetric(row.pmpPzuLeiMwh) : "0,00",
        hasPrices ? formatMetric(row.simplePzuAverageLeiMwh) : "0,00",
        hasPrices ? formatMetric(row.profileDifferenceLeiMwh) : "0,00",
        formatMetric(row.expensiveConsumptionMwh),
        formatMetric(row.cheapConsumptionMwh),
        formatMetric(row.weekdayMwh),
        formatMetric(row.weekendMwh),
      ].forEach((value) => {
        const td = document.createElement("td");
        td.textContent = value;
        tr.appendChild(td);
      });
      monthlyBody.appendChild(tr);
    });
  }

  const hourlyBody = $("analyticsHourlyRows");
  if (hourlyBody) {
    hourlyBody.innerHTML = "";
    (analytics.hourlyProfile || []).forEach((row) => {
      const tr = document.createElement("tr");
      [
        intervalLabel(row.hour),
        formatMetric(row.consumptionMwh),
        formatMetric(row.averageConsumptionMw),
        formatMetric(row.pvMwh),
        formatMetric(row.averagePvMw),
        hasPrices ? formatMetric(row.averagePriceLeiMwh) : "0,00",
      ].forEach((value) => {
        const td = document.createElement("td");
        td.textContent = value;
        tr.appendChild(td);
      });
      hourlyBody.appendChild(tr);
    });
  }
}

function renderExecutiveDashboard(profile, rows = state.lastProfileRows) {
  if (!$("executiveAnnualConsumption")) return;
  const metrics = buildExecutiveMetrics(profile, rows);
  const contract = profileContractData();
  const opportunity = buildProfileOpportunity(metrics, state.profileAnalytics, contract);
  window.bessProfileAnalytics = state.profileAnalytics;
  renderGeneratedSourcingData(state.profileAnalytics);
  renderProfileRoadmap(metrics, opportunity, contract);
  renderProcurementDna(profile, metrics, state.profileAnalytics, opportunity, contract, rows);
  const commercialOpportunity = buildCommercialOpportunityEngine(profile, metrics, state.profileAnalytics, opportunity, contract, rows, state.procurementDna);
  state.commercialOpportunity = commercialOpportunity;
  window.bessCommercialOpportunity = commercialOpportunity;
  renderCommercialOpportunityEngine(commercialOpportunity);
  const salesIntelligence = buildSalesIntelligenceEngine(profile, metrics, state.profileAnalytics, opportunity, contract, rows, state.procurementDna, commercialOpportunity);
  state.salesIntelligence = salesIntelligence;
  window.bessSalesIntelligence = salesIntelligence;
  renderSalesIntelligenceEngine(salesIntelligence, commercialOpportunity);
  renderAdvancedReport(profile, metrics, state.profileAnalytics, opportunity, contract, rows);
  $("executiveAnnualConsumption").textContent = numberFormat.format(metrics.totalConsumption);
  $("executivePmpPzu").textContent = metrics.pmpPzu > 0 ? `${numberFormat.format(metrics.pmpPzu)} lei/MWh` : "0,00";
  $("executivePeak").textContent = numberFormat.format(metrics.peakMw);
  $("executiveAverage").textContent = numberFormat.format(metrics.averageMw);
  $("executiveLoadFactor").textContent = formatPercent(metrics.loadFactorPct);
  $("executiveDayNight").textContent = `${numberFormat.format(metrics.dayPct)}% / ${numberFormat.format(metrics.nightPct)}%`;
  $("executiveRiskScore").textContent = metrics.totalConsumption > 0 ? formatPercent(metrics.sourcingRiskScore) : "0%";
  $("executiveRecommendation").textContent = opportunity.contractRecommendation;
  $("executiveEfficiencyRecommendation").textContent = opportunity.efficiencyRecommendation;
  $("executiveStatus").textContent = metrics.pricedHours > 0 ? `PZU: ${state.priceSource}` : "PZU in asteptare";

  const chip = $("executiveRiskChip");
  const riskClass = metrics.totalConsumption === 0 ? "warn" : metrics.sourcingRiskScore <= 40 ? "ok" : metrics.sourcingRiskScore <= 60 ? "warn" : "error";
  chip.className = `status-chip ${riskClass}`;
  chip.textContent = metrics.totalConsumption > 0 ? `Risc ${riskLabel(metrics.sourcingRiskScore)}` : "In asteptare";

  const consumptionChecks = MONTHS.map((_, index) => monthlyCheck("consumption", index));
  const validationOk = consumptionChecks.every((month) => month.severity !== "error");
  setRoadmapStep("client", opportunity.clientReady, !opportunity.clientReady);
  setRoadmapStep("validation", validationOk && metrics.totalConsumption > 0, metrics.totalConsumption > 0 && !validationOk);
  setRoadmapStep("pzu", metrics.pricedHours > 0, metrics.totalConsumption > 0 && metrics.pricedHours === 0);
  setRoadmapStep("scoring", metrics.totalConsumption > 0 && metrics.pricedHours > 0);
  setRoadmapStep("recommendation", opportunity.contractRecommendation !== "Introdu curbe" || opportunity.efficiencyRecommendation !== "Introdu curbe");
  setRoadmapStep("export", Boolean(state.result));
}

function renderConsumptionProfile() {
  const profile = buildConsumptionProfile();
  const { totals } = profile;
  setText("profileStatus", `Consum introdus: ${totals.enteredHours}/${totals.expectedHours} ore`);
  setText("profileYear", String(selectedYear()));
  setText("profileAnnualConsumption", numberFormat.format(totals.consumptionMwh));
  setText("profileDayConsumption", numberFormat.format(totals.dayMwh));
  setText("profileNightConsumption", numberFormat.format(totals.nightMwh));
  setText("profileAnnualPv", numberFormat.format(totals.pvMwh));
  setText("profilePeakConsumption", numberFormat.format(totals.peakMw));
  setText("profileAverageConsumption", numberFormat.format(totals.averageMw));
  renderExecutiveDashboard(profile);

  const tbody = $("profileMonthlyRows");
  if (tbody) {
    tbody.innerHTML = "";
    profile.monthly.forEach((row) => {
      const tr = document.createElement("tr");
      [
        row.month,
        numberFormat.format(row.consumptionMwh),
        numberFormat.format(row.dayMwh),
        numberFormat.format(row.nightMwh),
        numberFormat.format(row.pvMwh),
        numberFormat.format(row.peakMw),
      ].forEach((value) => {
        const td = document.createElement("td");
        td.textContent = value;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
  }
  drawSourcingProfileChart(profile.daily);
  drawConsumptionProfileChart(profile.monthly);
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
        procurementDna: clone(state.procurementDna || window.bessProcurementDna || {}),
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
    const name = `EnergyPilot_Raport_${safeFilenamePart(project.name || $("projectName").value, "Proiect_EnergyPilot")}_${safeFilenamePart(summary.scenarioName, "scenariu")}.xlsx`;
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

function scenarioMonthKey(row, index) {
  const text = String(row.timestamp || "").trim();
  const iso = text.match(/^\d{4}-(\d{2})-\d{2}/);
  if (iso) return iso[1];
  const ro = text.match(/^\d{2}[-.](\d{2})[-.]\d{4}/);
  if (ro) return ro[1];
  const slash = text.match(/^\d{1,2}\/(\d{1,2})\/\d{4}/);
  if (slash) return String(Number(slash[1])).padStart(2, "0");
  const hourOfYear = Math.max(0, index);
  let elapsed = 0;
  for (const month of MONTHS) {
    elapsed += month.days * 24;
    if (hourOfYear < elapsed) return month.key;
  }
  return "12";
}

function scenarioBehaviorMonthLabel() {
  if (state.scenarioBehaviorMonth === "all") return "Toate lunile";
  return MONTHS.find((month) => month.key === state.scenarioBehaviorMonth)?.label || "Luna selectata";
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
  const monthSelect = $("scenarioBehaviorMonth");
  if (monthSelect && monthSelect.value !== state.scenarioBehaviorMonth) {
    monthSelect.value = state.scenarioBehaviorMonth;
  }

  const hourly = scenario.hourly || [];
  const monthRows =
    state.scenarioBehaviorMonth === "all"
      ? hourly
      : hourly.filter((row, index) => scenarioMonthKey(row, index) === state.scenarioBehaviorMonth);
  const actionRows = monthRows.filter((row) => bessAction(row) !== "Standby");
  const rows = state.scenarioBehaviorView === "all" ? monthRows : actionRows;
  const monthLabel = scenarioBehaviorMonthLabel();
  $("scenarioBehaviorCount").textContent =
    state.scenarioBehaviorView === "all"
      ? `${monthLabel}: ${rows.length} ore`
      : `${monthLabel}: ${actionRows.length} decizii`;

  if (!rows.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 8;
    td.textContent =
      state.scenarioBehaviorView === "all"
        ? "Nu exista ore pentru luna si scenariul selectat."
        : "Nu exista ore de incarcare sau descarcare pentru luna si scenariul selectat.";
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  const ranks = state.scenarioBehaviorView === "all" ? scenarioPriceRanks(hourly) : [];
  const fragment = document.createDocumentFragment();
  rows.forEach((row, visibleIndex) => {
    const action = bessAction(row);
    const tr = document.createElement("tr");
    const hourlyIndex = hourly.indexOf(row);
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

    const actionColumnIndex = state.scenarioBehaviorView === "all" ? 2 : 1;
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

function prepareChartCanvas(canvas, fallbackWidth, fallbackHeight) {
  const rect = canvas.getBoundingClientRect();
  const cssWidth = Math.max(fallbackWidth, Math.round(rect.width || fallbackWidth));
  const cssHeight = Math.max(fallbackHeight, Math.round(rect.height || fallbackHeight));
  const ratio = Math.min(window.devicePixelRatio || 1, 3);
  const pixelWidth = Math.round(cssWidth * ratio);
  const pixelHeight = Math.round(cssHeight * ratio);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  return { ctx, width: cssWidth, height: cssHeight };
}

function drawProcurementChartFrame(ctx, width, height, title) {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = BRAND.background;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = BRAND.primary;
  ctx.font = "800 17px Plus Jakarta Sans, Inter, Arial";
  ctx.textAlign = "left";
  ctx.fillText(title, 24, 30);
}

function drawProcurementRadarChart(items = []) {
  const canvas = $("procurementRadarChart");
  if (!canvas) return;
  const { ctx, width, height } = prepareChartCanvas(canvas, 560, 340);
  drawProcurementChartFrame(ctx, width, height, "Energy Profile Intelligence Radar");
  if (!items.length) return;

  const centerX = width / 2;
  const centerY = height / 2 + 18;
  const radius = Math.min(width, height) * 0.29;
  const levels = 4;
  ctx.strokeStyle = "#E2E8F0";
  ctx.lineWidth = 1;
  ctx.fillStyle = "#64748B";
  ctx.font = "700 10px Plus Jakarta Sans, Inter, Arial";
  ctx.textAlign = "center";

  for (let level = 1; level <= levels; level += 1) {
    const r = (radius * level) / levels;
    ctx.beginPath();
    items.forEach((_, index) => {
      const angle = -Math.PI / 2 + (index / items.length) * Math.PI * 2;
      const x = centerX + Math.cos(angle) * r;
      const y = centerY + Math.sin(angle) * r;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.stroke();
  }

  items.forEach((item, index) => {
    const angle = -Math.PI / 2 + (index / items.length) * Math.PI * 2;
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;
    ctx.strokeStyle = "#E2E8F0";
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.fillStyle = "#64748B";
    const labelX = centerX + Math.cos(angle) * (radius + 38);
    const labelY = centerY + Math.sin(angle) * (radius + 28);
    ctx.fillText(String(item.label || ""), labelX, labelY);
  });

  ctx.beginPath();
  items.forEach((item, index) => {
    const value = clamp(item.value, 0, 100) / 100;
    const angle = -Math.PI / 2 + (index / items.length) * Math.PI * 2;
    const x = centerX + Math.cos(angle) * radius * value;
    const y = centerY + Math.sin(angle) * radius * value;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fillStyle = "rgba(16, 185, 129, 0.28)";
  ctx.strokeStyle = "#10B981";
  ctx.lineWidth = 2.5;
  ctx.fill();
  ctx.stroke();
  ctx.textAlign = "left";
}

function drawProcurementBars(canvasId, title, rows = [], options = {}) {
  const canvas = $(canvasId);
  if (!canvas) return;
  const { ctx, width, height } = prepareChartCanvas(canvas, options.fallbackWidth || 560, options.fallbackHeight || 300);
  drawProcurementChartFrame(ctx, width, height, title);
  const values = rows.map((row) => Number(row.value) || 0);
  const max = Math.max(...values, 1);
  const paddingLeft = 58;
  const paddingRight = 24;
  const paddingTop = 58;
  const paddingBottom = 48;
  const plotW = width - paddingLeft - paddingRight;
  const plotH = height - paddingTop - paddingBottom;
  const groupW = rows.length ? plotW / rows.length : plotW;
  const barW = Math.max(22, Math.min(54, groupW * 0.42));

  ctx.strokeStyle = "#E2E8F0";
  ctx.lineWidth = 1;
  for (let index = 0; index <= 4; index += 1) {
    const y = paddingTop + (plotH / 4) * index;
    ctx.beginPath();
    ctx.moveTo(paddingLeft, y);
    ctx.lineTo(width - paddingRight, y);
    ctx.stroke();
  }
  ctx.strokeStyle = "#E2E8F0";
  ctx.beginPath();
  ctx.moveTo(paddingLeft, paddingTop);
  ctx.lineTo(paddingLeft, height - paddingBottom);
  ctx.lineTo(width - paddingRight, height - paddingBottom);
  ctx.stroke();

  rows.forEach((row, index) => {
    const value = Number(row.value) || 0;
    const x = paddingLeft + index * groupW + (groupW - barW) / 2;
    const barH = (value / max) * plotH;
    const y = height - paddingBottom - barH;
    ctx.fillStyle = row.color || options.color || "#10B981";
    ctx.fillRect(x, y, barW, barH);
    ctx.fillStyle = "#0F172A";
    ctx.font = "800 11px Plus Jakarta Sans, Inter, Arial";
    ctx.textAlign = "center";
    ctx.fillText(formatMetric(value), x + barW / 2, Math.max(paddingTop + 14, y - 8));
    ctx.fillStyle = "#64748B";
    ctx.font = "700 11px Plus Jakarta Sans, Inter, Arial";
    ctx.fillText(String(row.label || ""), x + barW / 2, height - 18);
  });
  ctx.textAlign = "left";
}

function drawProcurementSeasonalityChart(rows = []) {
  const canvas = $("procurementSeasonalityChart");
  if (!canvas) return;
  const { ctx, width, height } = prepareChartCanvas(canvas, 560, 300);
  drawProcurementChartFrame(ctx, width, height, "Monthly Seasonality");
  const values = rows.map((row) => Number(row.value) || 0);
  const max = Math.max(...values, 1);
  const paddingLeft = 58;
  const paddingRight = 24;
  const paddingTop = 58;
  const paddingBottom = 48;
  const plotW = width - paddingLeft - paddingRight;
  const plotH = height - paddingTop - paddingBottom;

  ctx.strokeStyle = "#E2E8F0";
  ctx.lineWidth = 1;
  for (let index = 0; index <= 4; index += 1) {
    const y = paddingTop + (plotH / 4) * index;
    ctx.beginPath();
    ctx.moveTo(paddingLeft, y);
    ctx.lineTo(width - paddingRight, y);
    ctx.stroke();
  }
  ctx.strokeStyle = "#E2E8F0";
  ctx.beginPath();
  ctx.moveTo(paddingLeft, paddingTop);
  ctx.lineTo(paddingLeft, height - paddingBottom);
  ctx.lineTo(width - paddingRight, height - paddingBottom);
  ctx.stroke();

  ctx.strokeStyle = "#10B981";
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  rows.forEach((row, index) => {
    const x = paddingLeft + (rows.length <= 1 ? plotW / 2 : (plotW / (rows.length - 1)) * index);
    const y = height - paddingBottom - ((Number(row.value) || 0) / max) * plotH;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  rows.forEach((row, index) => {
    const x = paddingLeft + (rows.length <= 1 ? plotW / 2 : (plotW / (rows.length - 1)) * index);
    const y = height - paddingBottom - ((Number(row.value) || 0) / max) * plotH;
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#10B981";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#64748B";
    ctx.font = "700 10px Plus Jakarta Sans, Inter, Arial";
    ctx.textAlign = "center";
    ctx.fillText(MONTH_SHORT[index] || String(row.label || ""), x, height - 18);
  });
  ctx.textAlign = "left";
}

function drawProcurementLoadDurationChart(loadDna) {
  const canvas = $("procurementLoadDurationChart");
  if (!canvas) return;
  const { ctx, width, height } = prepareChartCanvas(canvas, 1120, 360);
  drawProcurementChartFrame(ctx, width, height, "Load Duration Analysis");
  const points = loadDna?.points || [];
  const max = Math.max(...points.map((point) => Number(point.value) || 0), 1);
  const paddingLeft = 64;
  const paddingRight = 30;
  const paddingTop = 62;
  const paddingBottom = 52;
  const plotW = width - paddingLeft - paddingRight;
  const plotH = height - paddingTop - paddingBottom;

  ctx.strokeStyle = "#E2E8F0";
  ctx.lineWidth = 1;
  for (let index = 0; index <= 4; index += 1) {
    const y = paddingTop + (plotH / 4) * index;
    ctx.beginPath();
    ctx.moveTo(paddingLeft, y);
    ctx.lineTo(width - paddingRight, y);
    ctx.stroke();
  }
  ctx.strokeStyle = "#E2E8F0";
  ctx.beginPath();
  ctx.moveTo(paddingLeft, paddingTop);
  ctx.lineTo(paddingLeft, height - paddingBottom);
  ctx.lineTo(width - paddingRight, height - paddingBottom);
  ctx.stroke();

  ctx.fillStyle = "#64748B";
  ctx.font = "700 11px Plus Jakarta Sans, Inter, Arial";
  ctx.textAlign = "left";
  ctx.fillText("Consum MW", 24, paddingTop - 16);
  ctx.textAlign = "center";
  ctx.fillText("Ore sortate descrescator", paddingLeft + plotW / 2, height - 15);

  if (!points.length) {
    ctx.fillStyle = "#64748B";
    ctx.font = "800 14px Plus Jakarta Sans, Inter, Arial";
    ctx.fillText("Curba orara de consum este necesara pentru generare.", paddingLeft + plotW / 2, paddingTop + plotH / 2);
    ctx.textAlign = "left";
    return;
  }

  ctx.strokeStyle = "#10B981";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  points.forEach((point, index) => {
    const x = paddingLeft + (points.length === 1 ? 0 : (plotW / (points.length - 1)) * index);
    const y = height - paddingBottom - ((Number(point.value) || 0) / max) * plotH;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  const refs = [
    { label: "Baseload", value: loadDna.baseloadMw, color: "#334155" },
    { label: "Midload", value: loadDna.midloadMw, color: "#94A3B8" },
    { label: "Peakload", value: loadDna.peakloadMw, color: "#EF4444" },
  ].filter((item) => Number.isFinite(item.value));
  refs.forEach((item, index) => {
    const y = height - paddingBottom - (item.value / max) * plotH;
    ctx.strokeStyle = item.color;
    ctx.setLineDash([7, 6]);
    ctx.beginPath();
    ctx.moveTo(paddingLeft, y);
    ctx.lineTo(width - paddingRight, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = item.color;
    ctx.font = "800 11px Plus Jakarta Sans, Inter, Arial";
    ctx.textAlign = "right";
    ctx.fillText(`${item.label}: ${numberFormat.format(item.value)}`, width - paddingRight - 8, y - 6 - index * 2);
  });
  ctx.textAlign = "left";
}

function drawProcurementTopCostChart(costDna) {
  const canvas = $("procurementTopCostChart");
  if (!canvas) return;
  const { ctx, width, height } = prepareChartCanvas(canvas, 560, 360);
  drawProcurementChartFrame(ctx, width, height, "Top 10 Cost Hours");
  const rows = costDna?.top10 || [];
  const max = Math.max(...rows.map((row) => Number(row.cost) || 0), 1);
  const paddingLeft = 148;
  const paddingRight = 26;
  const paddingTop = 58;
  const paddingBottom = 28;
  const plotW = width - paddingLeft - paddingRight;
  const rowH = rows.length ? (height - paddingTop - paddingBottom) / rows.length : 24;
  if (!rows.length) {
    ctx.fillStyle = "#64748B";
    ctx.font = "800 14px Plus Jakarta Sans, Inter, Arial";
    ctx.textAlign = "center";
    ctx.fillText("Cost DNA indisponibil fara consum si preturi PZU.", width / 2, height / 2);
    ctx.textAlign = "left";
    return;
  }

  rows.forEach((row, index) => {
    const y = paddingTop + index * rowH + rowH * 0.18;
    const barH = Math.max(8, rowH * 0.58);
    const barW = ((Number(row.cost) || 0) / max) * plotW;
    ctx.fillStyle = "#10B981";
    ctx.fillRect(paddingLeft, y, barW, barH);
    ctx.fillStyle = "#0F172A";
    ctx.font = "800 10px Plus Jakarta Sans, Inter, Arial";
    ctx.textAlign = "right";
    ctx.fillText(String(row.timestamp || "").replace(":00", ""), paddingLeft - 10, y + barH * 0.72);
    ctx.textAlign = "left";
    ctx.fillText(formatLei(row.cost), paddingLeft + barW + 8, y + barH * 0.72);
  });
  ctx.textAlign = "left";
}

function drawProcurementCostDistributionChart(costDna) {
  const rows = (costDna?.distribution || []).map((row, index) => ({
    ...row,
    color: ["#334155", "#94A3B8", "#EF4444"][index] || "#10B981",
  }));
  drawProcurementBars("procurementCostDistributionChart", "Cost Distribution", rows, { color: "#10B981" });
}

function drawProcurementDnaCharts(dna) {
  if (!dna) return;
  drawProcurementLoadDurationChart(dna.loadDna);
  drawProcurementTopCostChart(dna.costDna);
  drawProcurementCostDistributionChart(dna.costDna);
}

const ADVANCED_CHART_IDS = [
  "reportConsumptionHeatmap",
  "reportLoadDurationChart",
  "reportDailyCurveChart",
  "reportIntervalChart",
  "reportPzuHeatmap",
  "reportConsumptionPriceScatter",
  "reportPmpVsAverageChart",
  "reportCostDistributionChart",
  "reportTopCostHoursChart",
  "reportMonthlyCostChart",
  "reportSolarOpportunityChart",
  "reportStorageOpportunityChart",
  "reportPeakShavingChart",
];

const REPORT_TYPE_CONFIG = {
  executive: {
    label: "EnergyPilot Executive Report",
    focus: "Full executive PDF for client meetings",
  },
  procurement: {
    label: "Procurement Intelligence Report",
    focus: "Energy Profile, procurement persona, risk and sourcing strategy",
  },
  commercial: {
    label: "Commercial Opportunity Report",
    focus: "Opportunity ranking, potential savings and recommended actions",
  },
  bess: {
    label: "BESS Opportunity Report",
    focus: "Storage score, peak shaving, ROI narrative and BESS recommendation",
  },
  solar: {
    label: "Solar Opportunity Report",
    focus: "Solar fit, estimated self consumption, PV expansion and savings",
  },
  management: {
    label: "Management Summary",
    focus: "One-page management summary with score, savings and next action",
  },
};

function activeReportConfig() {
  return REPORT_TYPE_CONFIG[state.activeReportType] || REPORT_TYPE_CONFIG.executive;
}

function buildReportActionPlan(data) {
  const commercial = data.commercialOpportunity || {};
  const top = commercial.topOpportunities?.[0] || commercial.opportunities?.[0];
  const second = commercial.topOpportunities?.[1] || commercial.opportunities?.[1];
  const third = commercial.topOpportunities?.[2] || commercial.opportunities?.[2];
  return [
    {
      title: top ? top.name : "Complete analysis",
      description: top?.action || "Complete consumption curves and PZU prices.",
      impact: top ? formatLei(top.estimatedSavingsLei || 0) : "Data quality",
      timeline: top ? "0-2 weeks" : "Immediate",
    },
    {
      title: second ? second.name : "Validate opportunity",
      description: second?.action || "Validate contract, ATR and technical assumptions.",
      impact: second ? formatLei(second.estimatedSavingsLei || 0) : "Qualification",
      timeline: "2-4 weeks",
    },
    {
      title: third ? third.name : "Prepare commercial discussion",
      description: third?.action || data.salesIntelligence?.nextBestAction || "Prepare client meeting and executive pitch.",
      impact: third ? formatLei(third.estimatedSavingsLei || 0) : "Commercial readiness",
      timeline: "Next meeting",
    },
  ];
}

function setActiveReportType(type = "executive") {
  state.activeReportType = REPORT_TYPE_CONFIG[type] ? type : "executive";
  document.querySelectorAll("[data-report-type]").forEach((button) => {
    button.classList.toggle("active", button.dataset.reportType === state.activeReportType);
  });
  if (state.advancedReport) renderReportCenter(state.advancedReport);
}

function renderReportCenter(data) {
  if (!$("reportEmptyState") || !data) return;
  const config = activeReportConfig();
  const commercial = data.commercialOpportunity || {};
  const sales = data.salesIntelligence || {};
  const hasEnoughData = Boolean(data.hasConsumption);
  const top = commercial.topOpportunities?.[0] || commercial.opportunities?.[0];
  $("reportEmptyState")?.classList.toggle("is-hidden", hasEnoughData);
  setText("advancedReportHeading", "Reports");
  setText(
    "advancedReportStatus",
    hasEnoughData
      ? `${config.label} ready. ${config.focus}.`
      : "Generate professional reports for client meetings and internal sales support.",
  );
  setText(
    "reportExecutiveSummary",
    sales.executiveSummary ||
      commercial.salesStory ||
      "Insufficient data available for report generation. Please complete the analysis first.",
  );
  fillInsightList("reportGeneratedInsights", [
    data.procurementDna?.finalOutput ? `Energy Profile: ${data.procurementDna.finalOutput}` : null,
    `Commercial Opportunity Score: ${numberFormat.format(commercial.score || 0)} / 100`,
    `Estimated Annual Savings: ${formatLei(commercial.estimatedAnnualSavingsLei || 0)}`,
    Number.isFinite(data.procurementDna?.riskScore) ? `Risk Level: ${energyRiskLevel(data.procurementDna.riskScore)}` : null,
    top ? `Top Opportunity: ${top.name}` : null,
  ]);
  fillInsightList("reportRecommendedActions", [
    sales.nextBestAction || top?.action || "Complete consumption data and PZU prices.",
    data.procurementDna?.contractRecommendation ? `Contract: ${data.procurementDna.contractRecommendation}` : null,
    data.opportunity?.efficiencyRecommendation ? `Efficiency: ${data.opportunity.efficiencyRecommendation}` : null,
  ]);
  const plan = buildReportActionPlan(data);
  [
    ["reportPriorityOne", "reportPriorityOneMeta"],
    ["reportPriorityTwo", "reportPriorityTwoMeta"],
    ["reportPriorityThree", "reportPriorityThreeMeta"],
  ].forEach(([titleId, metaId], index) => {
    const item = plan[index];
    setText(titleId, item.title);
    setText(metaId, `${item.description} | ${item.impact} | ${item.timeline}`);
  });
}

function sumRowsMwh(rows = [], predicate = () => true) {
  return rows.reduce((sum, row, index) => {
    if (!predicate(row, index)) return sum;
    return sum + (Number(row.consumption_mwh) || 0);
  }, 0);
}

function priceRowsWithCost(rows = []) {
  return rows
    .map((row, index) => {
      const consumption = Number(row.consumption_mwh);
      const price = Number(row.price_lei_mwh);
      if (!Number.isFinite(consumption) || consumption <= 0 || !Number.isFinite(price) || Math.abs(price) <= 0) return null;
      return {
        ...row,
        index,
        consumption,
        price,
        cost: consumption * price,
      };
    })
    .filter(Boolean);
}

function buildAdvancedReportData(profile, metrics, analytics, opportunity, contract, rows = state.lastProfileRows) {
  const annual = analytics?.annual || {};
  const hourlyProfile = analytics?.hourlyProfile || [];
  const monthly = analytics?.monthly || [];
  const scores = analytics?.scores || {};
  const procurementDna = state.procurementDna || buildProcurementDna(profile, metrics, analytics, opportunity, contract, rows);
  const loadDna = procurementDna.loadDna || buildLoadDna(rows);
  const costDna = procurementDna.costDna || buildCostDna(rows);
  const commercialOpportunity =
    state.commercialOpportunity || buildCommercialOpportunityEngine(profile, metrics, analytics, opportunity, contract, rows, procurementDna);
  const salesIntelligence =
    state.salesIntelligence || buildSalesIntelligenceEngine(profile, metrics, analytics, opportunity, contract, rows, procurementDna, commercialOpportunity);
  const validConsumptionRows = rows.filter((row) => Number(row.consumption_mwh) > 0);
  const hasConsumption = validConsumptionRows.length > 0;
  const hasPrices = priceRowsWithCost(rows).length > 0;
  const totalConsumption = metrics.totalConsumption || annual.consumptionMwh || 0;
  const intervalRows = [
    { label: "00:00-06:00", start: 0, end: 6, color: "#334155" },
    { label: "06:00-12:00", start: 6, end: 12, color: "#94A3B8" },
    { label: "12:00-18:00", start: 12, end: 18, color: "#10B981" },
    { label: "18:00-24:00", start: 18, end: 24, color: "#EF4444" },
  ].map((interval) => {
    const mwh = sumRowsMwh(rows, (row, index) => {
      const hour = rowHour(row, index);
      return hour >= interval.start && hour < interval.end;
    });
    return {
      ...interval,
      mwh,
      value: totalConsumption > 0 ? (mwh / totalConsumption) * 100 : 0,
    };
  });
  const solarMwh = sumRowsMwh(rows, (row, index) => {
    const hour = rowHour(row, index);
    return hour >= 8 && hour < 18;
  });
  const eveningMwh = sumRowsMwh(rows, (row, index) => {
    const hour = rowHour(row, index);
    return hour >= 18 && hour < 22;
  });
  const solarShare = totalConsumption > 0 ? (solarMwh / totalConsumption) * 100 : 0;
  const eveningShare = totalConsumption > 0 ? (eveningMwh / totalConsumption) * 100 : 0;
  const costMonthly = MONTHS.map((month, monthIndex) => {
    const monthRows = priceRowsWithCost(rows).filter((row) => rowDateParts(row, row.index).monthIndex === monthIndex);
    return {
      label: MONTH_SHORT[monthIndex],
      value: monthRows.reduce((sum, row) => sum + row.cost, 0),
    };
  });
  const cheapMwh = annual.cheapConsumptionMwh || 0;
  const expensiveMwh = annual.expensiveConsumptionMwh || 0;
  const pzuAdvantage = hasPrices ? (annual.pmpPzuLeiMwh || 0) - (annual.simplePzuAverageLeiMwh || 0) : 0;
  const dayMwh = annual.dayMwh || profile.totals.dayMwh || 0;
  const nightMwh = annual.nightMwh || profile.totals.nightMwh || 0;
  const dayPct = totalConsumption > 0 ? (dayMwh / totalConsumption) * 100 : 0;
  const nightPct = totalConsumption > 0 ? (nightMwh / totalConsumption) * 100 : 0;
  return {
    generatedAt: new Date().toISOString(),
    contract,
    profile,
    metrics,
    analytics,
    opportunity,
    procurementDna,
    commercialOpportunity,
    salesIntelligence,
    loadDna,
    costDna,
    rows,
    hasConsumption,
    hasPrices,
    validConsumptionHours: validConsumptionRows.length,
    lowHoursWarning: validConsumptionRows.length > 0 && validConsumptionRows.length < 500,
    hourlyProfile,
    monthly,
    intervalRows,
    solarShare,
    solarMwh,
    eveningShare,
    eveningMwh,
    costMonthly,
    cheapMwh,
    expensiveMwh,
    pzuAdvantage,
    annual,
    scores,
    dayMwh,
    nightMwh,
    dayPct,
    nightPct,
    consumptionText:
      solarShare >= 50
        ? "Consumul este concentrat in intervalul diurn, ceea ce indica potential ridicat pentru autoconsum fotovoltaic."
        : eveningShare >= 15
          ? "Consumul relevant in intervalul de seara poate justifica analiza unei solutii de stocare energetica."
          : "Profilul mediu zilnic evidentiaza intervalele in care consumul este concentrat, permitand identificarea varfurilor operationale si a potentialului de optimizare.",
    marketText: !hasPrices
      ? "Preturile PZU sunt necesare pentru analiza costului si profilului de piata."
      : pzuAdvantage <= 0
        ? "Profilul de consum avantajeaza clientul in raport cu media pietei, deoarece consumul este aliniat partial cu intervale de pret mai redus."
        : "Profilul de consum penalizeaza clientul fata de media pietei, ceea ce indica expunere in intervale orare cu pret ridicat.",
    costText: costDnaText(costDna.concentrationIndex, costDna.available),
    opportunityText:
      `Ponderea consumului in intervalul solar este ${numberFormat.format(solarShare)}%, iar consumul de seara este ${numberFormat.format(eveningShare)}%. ` +
      "Diferenta dintre sarcina de baza si varful maxim indica potentialul de reducere a varfurilor de consum si optimizare ATR.",
  };
}

function colorScale(stops, pct) {
  const value = clamp(pct, 0, 1);
  const scaled = value * (stops.length - 1);
  const index = Math.min(stops.length - 2, Math.floor(scaled));
  const local = scaled - index;
  const start = stops[index];
  const end = stops[index + 1];
  const mix = (a, b) => Math.round(a + (b - a) * local);
  return `rgb(${mix(start[0], end[0])}, ${mix(start[1], end[1])}, ${mix(start[2], end[2])})`;
}

const CONSUMPTION_HEATMAP_STOPS = [
  [239, 246, 255],
  [96, 165, 250],
  [250, 204, 21],
  [249, 115, 22],
  [185, 28, 28],
];

const PZU_HEATMAP_STOPS = [
  [219, 234, 254],
  [34, 197, 94],
  [250, 204, 21],
  [249, 115, 22],
  [127, 29, 29],
];

function drawReportHeatmap(canvasId, title, rows, valueGetter, colorStops) {
  const canvas = $(canvasId);
  if (!canvas) return;
  const { ctx, width, height } = prepareChartCanvas(canvas, 1120, 360);
  drawProcurementChartFrame(ctx, width, height, title);
  const values = rows
    .map((row, index) => valueGetter(row, index))
    .filter((value) => Number.isFinite(value) && value > 0);
  const max = Math.max(...values, 1);
  const paddingLeft = 46;
  const paddingRight = 24;
  const paddingTop = 56;
  const paddingBottom = 42;
  const plotW = width - paddingLeft - paddingRight;
  const plotH = height - paddingTop - paddingBottom;
  const cellW = plotW / 365;
  const cellH = plotH / 24;
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(paddingLeft, paddingTop, plotW, plotH);
  rows.forEach((row, index) => {
    const value = valueGetter(row, index);
    if (!Number.isFinite(value) || value <= 0) return;
    const parts = rowDateParts(row, index);
    const dayIndex = daysBeforeMonth(parts.monthIndex) + Math.max(0, parts.day - 1);
    const x = paddingLeft + dayIndex * cellW;
    const y = paddingTop + parts.hour * cellH;
    const pct = Math.sqrt(clamp(value / max, 0, 1));
    ctx.fillStyle = colorStops(pct);
    ctx.fillRect(x, y, Math.max(1, cellW), Math.max(1, cellH));
  });
  ctx.strokeStyle = "#E2E8F0";
  ctx.strokeRect(paddingLeft, paddingTop, plotW, plotH);
  ctx.fillStyle = "#64748B";
  ctx.font = "700 10px Plus Jakarta Sans, Inter, Arial";
  ctx.textAlign = "right";
  [0, 6, 12, 18, 23].forEach((hour) => {
    const y = paddingTop + hour * cellH + 4;
    ctx.fillText(String(hour).padStart(2, "0"), paddingLeft - 8, y);
  });
  let dayOffset = 0;
  MONTHS.forEach((month, monthIndex) => {
    const days = monthDays(monthIndex);
    const x = paddingLeft + dayOffset * cellW + (days * cellW) / 2;
    ctx.textAlign = "center";
    ctx.fillText(MONTH_SHORT[monthIndex].toUpperCase(), x, height - 16);
    dayOffset += days;
  });
  const legendX = width - paddingRight - 180;
  const legendY = 28;
  const legendW = 150;
  const legendH = 9;
  for (let index = 0; index < legendW; index += 1) {
    ctx.fillStyle = colorStops(index / (legendW - 1));
    ctx.fillRect(legendX + index, legendY, 1, legendH);
  }
  ctx.fillStyle = "#64748B";
  ctx.font = "800 10px Plus Jakarta Sans, Inter, Arial";
  ctx.textAlign = "left";
  ctx.fillText("Min", legendX, legendY + 22);
  ctx.textAlign = "right";
  ctx.fillText("Max", legendX + legendW, legendY + 22);
  ctx.textAlign = "left";
}

function drawReportDailyCurve(hourlyProfile = []) {
  const canvas = $("reportDailyCurveChart");
  if (!canvas) return;
  const { ctx, width, height } = prepareChartCanvas(canvas, 560, 320);
  drawProcurementChartFrame(ctx, width, height, "Curba medie zilnica de consum");
  const rows = hourlyProfile.map((row) => ({ label: String(row.hour).padStart(2, "0"), value: Number(row.averageConsumptionMw) || 0 }));
  drawSimpleLine(ctx, width, height, rows, "#10B981", "MW mediu");
}

function drawReportLoadDurationChart(loadDna) {
  const canvas = $("reportLoadDurationChart");
  if (!canvas) return;
  const { ctx, width, height } = prepareChartCanvas(canvas, 1120, 340);
  drawProcurementChartFrame(ctx, width, height, "Load Duration Curve");
  const points = loadDna?.points || [];
  const max = Math.max(...points.map((point) => Number(point.value) || 0), 1);
  const paddingLeft = 64;
  const paddingRight = 30;
  const paddingTop = 62;
  const paddingBottom = 52;
  const plotW = width - paddingLeft - paddingRight;
  const plotH = height - paddingTop - paddingBottom;

  ctx.strokeStyle = "#E2E8F0";
  ctx.lineWidth = 1;
  for (let index = 0; index <= 4; index += 1) {
    const y = paddingTop + (plotH / 4) * index;
    ctx.beginPath();
    ctx.moveTo(paddingLeft, y);
    ctx.lineTo(width - paddingRight, y);
    ctx.stroke();
  }
  ctx.strokeStyle = "#E2E8F0";
  ctx.beginPath();
  ctx.moveTo(paddingLeft, paddingTop);
  ctx.lineTo(paddingLeft, height - paddingBottom);
  ctx.lineTo(width - paddingRight, height - paddingBottom);
  ctx.stroke();

  if (!points.length) {
    ctx.fillStyle = "#64748B";
    ctx.font = "800 14px Plus Jakarta Sans, Inter, Arial";
    ctx.textAlign = "center";
    ctx.fillText("Additional consumption history required.", paddingLeft + plotW / 2, paddingTop + plotH / 2);
    ctx.textAlign = "left";
    return;
  }

  ctx.strokeStyle = "#10B981";
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  points.forEach((point, index) => {
    const x = paddingLeft + (points.length === 1 ? 0 : (plotW / (points.length - 1)) * index);
    const y = height - paddingBottom - ((Number(point.value) || 0) / max) * plotH;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  [
    { label: "Base Load", value: loadDna.baseloadMw, color: "#334155" },
    { label: "Peak Load", value: loadDna.peakloadMw, color: "#EF4444" },
  ]
    .filter((item) => Number.isFinite(item.value))
    .forEach((item, index) => {
      const y = height - paddingBottom - (item.value / max) * plotH;
      ctx.strokeStyle = item.color;
      ctx.setLineDash([7, 6]);
      ctx.beginPath();
      ctx.moveTo(paddingLeft, y);
      ctx.lineTo(width - paddingRight, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = item.color;
      ctx.font = "800 11px Plus Jakarta Sans, Inter, Arial";
      ctx.textAlign = "right";
      ctx.fillText(`${item.label}: ${numberFormat.format(item.value)} MW`, width - paddingRight - 8, y - 6 - index * 2);
    });
  ctx.fillStyle = "#64748B";
  ctx.font = "700 11px Plus Jakarta Sans, Inter, Arial";
  ctx.textAlign = "center";
  ctx.fillText("Ore sortate descrescator", paddingLeft + plotW / 2, height - 16);
  ctx.textAlign = "left";
}

function drawSimpleLine(ctx, width, height, rows, color, yLabel) {
  const max = Math.max(...rows.map((row) => Number(row.value) || 0), 1);
  const paddingLeft = 54;
  const paddingRight = 24;
  const paddingTop = 58;
  const paddingBottom = 44;
  const plotW = width - paddingLeft - paddingRight;
  const plotH = height - paddingTop - paddingBottom;
  ctx.strokeStyle = "#E2E8F0";
  ctx.lineWidth = 1;
  for (let index = 0; index <= 4; index += 1) {
    const y = paddingTop + (plotH / 4) * index;
    ctx.beginPath();
    ctx.moveTo(paddingLeft, y);
    ctx.lineTo(width - paddingRight, y);
    ctx.stroke();
  }
  ctx.strokeStyle = "#E2E8F0";
  ctx.beginPath();
  ctx.moveTo(paddingLeft, paddingTop);
  ctx.lineTo(paddingLeft, height - paddingBottom);
  ctx.lineTo(width - paddingRight, height - paddingBottom);
  ctx.stroke();
  ctx.fillStyle = "#64748B";
  ctx.font = "700 11px Plus Jakarta Sans, Inter, Arial";
  ctx.fillText(yLabel, 24, paddingTop - 18);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  rows.forEach((row, index) => {
    const x = paddingLeft + (rows.length <= 1 ? plotW / 2 : (plotW / (rows.length - 1)) * index);
    const y = height - paddingBottom - ((Number(row.value) || 0) / max) * plotH;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  rows.forEach((row, index) => {
    if (index % Math.ceil(rows.length / 8) !== 0 && index !== rows.length - 1) return;
    const x = paddingLeft + (rows.length <= 1 ? plotW / 2 : (plotW / (rows.length - 1)) * index);
    ctx.fillStyle = "#64748B";
    ctx.font = "700 10px Plus Jakarta Sans, Inter, Arial";
    ctx.textAlign = "center";
    ctx.fillText(String(row.label || ""), x, height - 16);
  });
  ctx.textAlign = "left";
}

function drawReportScatter(rows = []) {
  const canvas = $("reportConsumptionPriceScatter");
  if (!canvas) return;
  const { ctx, width, height } = prepareChartCanvas(canvas, 560, 340);
  drawProcurementChartFrame(ctx, width, height, "Consum vs Pret PZU");
  const valid = priceRowsWithCost(rows);
  const sample = valid.length > 900 ? valid.filter((_, index) => index % Math.ceil(valid.length / 900) === 0) : valid;
  const maxPrice = Math.max(...valid.map((row) => row.price), 1);
  const maxConsumption = Math.max(...valid.map((row) => row.consumption), 1);
  const paddingLeft = 56;
  const paddingRight = 24;
  const paddingTop = 58;
  const paddingBottom = 48;
  const plotW = width - paddingLeft - paddingRight;
  const plotH = height - paddingTop - paddingBottom;
  ctx.strokeStyle = "#E2E8F0";
  ctx.beginPath();
  ctx.moveTo(paddingLeft, paddingTop);
  ctx.lineTo(paddingLeft, height - paddingBottom);
  ctx.lineTo(width - paddingRight, height - paddingBottom);
  ctx.stroke();
  ctx.fillStyle = "#64748B";
  ctx.font = "700 11px Plus Jakarta Sans, Inter, Arial";
  ctx.fillText("MWh", 24, paddingTop - 18);
  ctx.textAlign = "center";
  ctx.fillText("Pret PZU lei/MWh", paddingLeft + plotW / 2, height - 14);
  sample.forEach((row) => {
    const x = paddingLeft + (row.price / maxPrice) * plotW;
    const y = height - paddingBottom - (row.consumption / maxConsumption) * plotH;
    ctx.fillStyle = "rgba(16, 185, 129, 0.38)";
    ctx.beginPath();
    ctx.arc(x, y, 2.2, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.textAlign = "left";
}

function drawReportPmpVsAverage(monthly = []) {
  const canvas = $("reportPmpVsAverageChart");
  if (!canvas) return;
  const { ctx, width, height } = prepareChartCanvas(canvas, 560, 340);
  drawProcurementChartFrame(ctx, width, height, "PMP Client vs Media PZU");
  const rows = monthly.map((row, index) => ({
    label: MONTH_SHORT[index],
    pmp: Number(row.pmpPzuLeiMwh) || 0,
    avg: Number(row.simplePzuAverageLeiMwh) || 0,
  }));
  const max = Math.max(...rows.flatMap((row) => [row.pmp, row.avg]), 1);
  const paddingLeft = 56;
  const paddingRight = 24;
  const paddingTop = 62;
  const paddingBottom = 48;
  const plotW = width - paddingLeft - paddingRight;
  const plotH = height - paddingTop - paddingBottom;
  ctx.strokeStyle = "#E2E8F0";
  ctx.beginPath();
  ctx.moveTo(paddingLeft, paddingTop);
  ctx.lineTo(paddingLeft, height - paddingBottom);
  ctx.lineTo(width - paddingRight, height - paddingBottom);
  ctx.stroke();
  [
    { key: "pmp", color: "#10B981", label: "PMP Client" },
    { key: "avg", color: "#94A3B8", label: "Media PZU" },
  ].forEach((serie, serieIndex) => {
    ctx.strokeStyle = serie.color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    rows.forEach((row, index) => {
      const x = paddingLeft + (rows.length <= 1 ? plotW / 2 : (plotW / (rows.length - 1)) * index);
      const y = height - paddingBottom - ((Number(row[serie.key]) || 0) / max) * plotH;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.fillStyle = serie.color;
    ctx.fillRect(paddingLeft + serieIndex * 126, 42, 12, 12);
    ctx.fillStyle = "#64748B";
    ctx.font = "700 11px Plus Jakarta Sans, Inter, Arial";
    ctx.fillText(serie.label, paddingLeft + 18 + serieIndex * 126, 52);
  });
  rows.forEach((row, index) => {
    const x = paddingLeft + (rows.length <= 1 ? plotW / 2 : (plotW / (rows.length - 1)) * index);
    ctx.fillStyle = "#64748B";
    ctx.font = "700 10px Plus Jakarta Sans, Inter, Arial";
    ctx.textAlign = "center";
    ctx.fillText(row.label, x, height - 16);
  });
  ctx.textAlign = "left";
}

function drawReportTopCostHours(costDna) {
  const canvas = $("reportTopCostHoursChart");
  if (!canvas) return;
  const { ctx, width, height } = prepareChartCanvas(canvas, 560, 360);
  drawProcurementChartFrame(ctx, width, height, "Top 10 ore cu cel mai mare cost");
  const rows = costDna?.top10 || [];
  const max = Math.max(...rows.map((row) => Number(row.cost) || 0), 1);
  const paddingLeft = 150;
  const paddingRight = 28;
  const paddingTop = 58;
  const paddingBottom = 26;
  const plotW = width - paddingLeft - paddingRight;
  const rowH = rows.length ? (height - paddingTop - paddingBottom) / rows.length : 24;
  if (!rows.length) {
    ctx.fillStyle = "#64748B";
    ctx.font = "800 14px Plus Jakarta Sans, Inter, Arial";
    ctx.textAlign = "center";
    ctx.fillText("Preturile PZU sunt necesare pentru analiza costului.", width / 2, height / 2);
    ctx.textAlign = "left";
    return;
  }
  rows.forEach((row, index) => {
    const y = paddingTop + index * rowH + rowH * 0.18;
    const barH = Math.max(8, rowH * 0.58);
    const barW = ((Number(row.cost) || 0) / max) * plotW;
    ctx.fillStyle = "#10B981";
    ctx.fillRect(paddingLeft, y, barW, barH);
    ctx.fillStyle = "#0F172A";
    ctx.font = "800 10px Plus Jakarta Sans, Inter, Arial";
    ctx.textAlign = "right";
    ctx.fillText(String(row.timestamp || "").replace(":00", ""), paddingLeft - 10, y + barH * 0.72);
    ctx.textAlign = "left";
    ctx.fillText(formatLei(row.cost), paddingLeft + barW + 8, y + barH * 0.72);
  });
  ctx.textAlign = "left";
}

function drawAdvancedReportCharts(data) {
  if (!data) return;
  drawReportHeatmap(
    "reportConsumptionHeatmap",
    "Heatmap consum 24h x 365 zile",
    data.rows,
    (row) => Number(row.consumption_mwh) || 0,
    (pct) => colorScale(CONSUMPTION_HEATMAP_STOPS, pct),
  );
  drawReportLoadDurationChart(data.loadDna);
  drawReportDailyCurve(data.hourlyProfile);
  drawProcurementBars("reportIntervalChart", "Consum pe intervale orare", data.intervalRows, { color: "#10B981" });
  if (data.hasPrices) {
    drawReportHeatmap(
      "reportPzuHeatmap",
      "Heatmap PZU",
      data.rows,
      (row) => Number(row.price_lei_mwh) || 0,
      (pct) => colorScale(PZU_HEATMAP_STOPS, pct),
    );
    drawReportScatter(data.rows);
    drawReportPmpVsAverage(data.monthly);
    drawProcurementBars("reportCostDistributionChart", "Distributia costului pe categorii PZU", data.costDna.distribution || [], { color: "#10B981" });
    drawReportTopCostHours(data.costDna);
    drawProcurementBars("reportMonthlyCostChart", "Cost lunar estimat", data.costMonthly, { color: "#10B981", fallbackWidth: 1120, fallbackHeight: 340 });
  }
  drawProcurementBars("reportSolarOpportunityChart", "Solar Opportunity", [
    { label: "Consum 08-18", value: data.solarMwh, color: "#F59E0B" },
    { label: "Restul zilei", value: Math.max(0, data.metrics.totalConsumption - data.solarMwh), color: "#94A3B8" },
  ]);
  drawProcurementBars("reportStorageOpportunityChart", "Storage Opportunity", [
    { label: "Ore ieftine", value: data.cheapMwh, color: "#334155" },
    { label: "Ore scumpe", value: data.expensiveMwh, color: "#EF4444" },
    { label: "18-22", value: data.eveningMwh, color: "#10B981" },
  ]);
  drawProcurementBars(
    "reportPeakShavingChart",
    "Peak Shaving Potential",
    [
      { label: "Baseload", value: data.loadDna.baseloadMw || 0, color: "#334155" },
      { label: "Midload", value: data.loadDna.midloadMw || 0, color: "#94A3B8" },
      { label: "Peakload", value: data.loadDna.peakloadMw || 0, color: "#EF4444" },
    ],
    { fallbackWidth: 1120, fallbackHeight: 320 },
  );
}

function renderAdvancedReport(profile, metrics, analytics, opportunity, contract, rows = state.lastProfileRows) {
  if (!$("advancedReportStatus")) return;
  const data = buildAdvancedReportData(profile, metrics, analytics, opportunity, contract, rows);
  state.advancedReport = data;
  window.bessAdvancedReport = data;
  const status = !data.hasConsumption
    ? "Curba orara de consum este necesara pentru generarea diagramelor."
    : data.lowHoursWarning
      ? "Numar redus de ore disponibile. Interpretarile pot avea acuratete limitata."
      : data.hasPrices
        ? "Diagrame generate din curbe consolidate si PZU."
        : "Preturile PZU sunt necesare pentru analiza costului si profilului de piata.";
  setText("advancedReportStatus", status);
  setText("reportAnnualConsumption", numberFormat.format(data.metrics.totalConsumption || 0));
  setText("reportPmpClient", data.hasPrices ? numberFormat.format(data.annual.pmpPzuLeiMwh || 0) : "0,00");
  setText("reportPzuAverage", data.hasPrices ? numberFormat.format(data.annual.simplePzuAverageLeiMwh || 0) : "0,00");
  setText("reportCostConcentration", Number.isFinite(data.costDna.concentrationIndex) ? formatPercent(data.costDna.concentrationIndex) : "Indisponibil");
  setText("reportSolarFit", formatPercent(data.solarShare));
  setText("reportStorageFit", formatPercent(data.scores.bessFitScore || 0));
  setText("reportConsumptionText", data.consumptionText);
  setText("reportMarketText", data.marketText);
  setText("reportCostText", data.costText);
  setText("reportOpportunityText", data.opportunityText);
  $("advancedMarketSection")?.classList.toggle("is-hidden", !data.hasPrices);
  $("advancedCostSection")?.classList.toggle("is-hidden", !data.hasPrices);
  renderReportCenter(data);
  drawAdvancedReportCharts(data);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function visibleChartImages() {
  return ADVANCED_CHART_IDS.map((id) => {
    const canvas = $(id);
    if (!canvas || canvas.closest(".is-hidden") || canvas.clientWidth <= 0 || canvas.clientHeight <= 0) return null;
    return { id, title: canvas.closest(".advanced-report-section")?.querySelector("h3")?.textContent?.trim() || id, src: canvas.toDataURL("image/png") };
  }).filter(Boolean);
}

function generateAdvancedPdfReport() {
  renderConsumptionProfile();
  const data = state.advancedReport;
  if (!data) return;
  if (!data.hasConsumption) {
    setMessages(["Insufficient data available for report generation. Please complete the analysis first."], true);
    return;
  }
  const popup = window.open("", "_blank");
  if (!popup) {
    setMessages(["Browserul a blocat fereastra de raport. Permite pop-up pentru a genera PDF."], true);
    return;
  }
  const contract = data.contract || {};
  const chartImages = visibleChartImages();
  const img = (id, caption) => {
    const image = chartImages.find((item) => item.id === id);
    return image ? `<figure><img src="${image.src}" alt="${escapeHtml(caption)}" /><figcaption>${escapeHtml(caption)}</figcaption></figure>` : "";
  };
  const reportConfig = activeReportConfig();
  const commercial = data.commercialOpportunity || { score: 0, label: "Limited Opportunity", estimatedAnnualSavingsLei: 0, topOpportunities: [], salesStory: "" };
  const sales = data.salesIntelligence || {
    executiveSummary: "Sales Intelligence insights pending. Additional consumption and market data required.",
    executivePitch: "",
    whyThisClient: [],
    talkingPoints: [],
    confidence: [],
    objections: [],
    meetingBrief: [],
    nextBestAction: "",
  };
  const topOpportunity = commercial.topOpportunities?.[0] || commercial.opportunities?.[0];
  const opportunityRows = (commercial.opportunities || []).map((item, index) => {
    const status = opportunityStatusMeta(item.score);
    return `<tr><td>${index + 1}</td><td>${escapeHtml(item.name)}</td><td>${numberFormat.format(item.score || 0)}%</td><td>${escapeHtml(status.priority)}</td><td>${escapeHtml(formatLei(item.estimatedSavingsLei || 0))}</td><td>${escapeHtml(item.action)}</td></tr>`;
  }).join("");
  const topOpportunityList = commercial.topOpportunities?.length
    ? commercial.topOpportunities
        .map((item) => `<li><strong>${escapeHtml(item.name)}</strong>: ${numberFormat.format(item.score)}% | ${escapeHtml(formatLei(item.estimatedSavingsLei))} | ${escapeHtml(item.action)}</li>`)
        .join("")
    : "<li>Complete consumption curves and PZU prices for commercial prioritization.</li>";
  const listHtml = (items = []) => items.length ? items.map((item) => `<li>${escapeHtml(item)}</li>`).join("") : "<li>In asteptare.</li>";
  const talkingPointsHtml = (sales.talkingPoints || []).map((item) => `<li><strong>${escapeHtml(item.name)}</strong>: ${escapeHtml(item.text)}</li>`).join("");
  const confidenceHtml = (sales.confidence || []).map((item) => `<li><strong>${escapeHtml(item.name)}</strong>: ${numberFormat.format(item.score || 0)}% - ${escapeHtml(item.reason)}</li>`).join("");
  const objectionsHtml = (sales.objections || []).map((item) => `<li><strong>${escapeHtml(item.objection)}</strong>: ${escapeHtml(item.response)}</li>`).join("");
  const plan = buildReportActionPlan(data);
  const actionRows = plan
    .map((item, index) => `<tr><td>Priority ${index + 1}</td><td>${escapeHtml(item.title)}</td><td>${escapeHtml(item.description)}</td><td>${escapeHtml(item.impact)}</td><td>${escapeHtml(item.timeline)}</td></tr>`)
    .join("");
  const breakdownItems = (commercial.opportunities || []).slice(0, 6);
  const maxSavings = Math.max(...breakdownItems.map((item) => Number(item.estimatedSavingsLei) || 0), 1);
  const impactBreakdown = breakdownItems.length
    ? breakdownItems
        .map((item) => {
          const width = Math.max(3, ((Number(item.estimatedSavingsLei) || 0) / maxSavings) * 100);
          return `<div class="impact-row"><span>${escapeHtml(item.name)}</span><div><i style="width:${width}%"></i></div><strong>${escapeHtml(formatLei(item.estimatedSavingsLei || 0))}</strong></div>`;
        })
        .join("")
    : `<p>Insufficient data available for impact breakdown.</p>`;
  const storageOpportunity = (commercial.opportunities || []).find((item) => item.key === "storage") || {};
  const solarOpportunity = (commercial.opportunities || []).find((item) => item.key === "solar") || {};
  const profilePersona = procurementPersonaFromDna(data.procurementDna);
  const managementOnly = state.activeReportType === "management";
  const commonKpis = `
    <div class="kpi"><span>Commercial Opportunity Score</span><strong>${numberFormat.format(commercial.score || 0)} / 100</strong></div>
    <div class="kpi"><span>Estimated Annual Savings</span><strong>${escapeHtml(formatLei(commercial.estimatedAnnualSavingsLei || 0))}</strong></div>
    <div class="kpi"><span>Top Opportunity</span><strong>${escapeHtml(topOpportunity?.name || "Pending")}</strong></div>
    <div class="kpi"><span>Recommended Action</span><strong>${escapeHtml(sales.nextBestAction || topOpportunity?.action || "Complete analysis")}</strong></div>`;
  const managementSummary = `
    <section class="page">
      <div class="cover-brand"><div class="pdf-lockup"><b>EP</b><strong>ENERGYPILOT</strong></div><span>Management Summary</span></div>
      <h1>${escapeHtml(contract.clientName || "Client")} - Management Summary</h1>
      <p class="subtitle">Energy Sales Intelligence Platform. Navigate every energy opportunity.</p>
      <div class="grid four">${commonKpis}</div>
      <div class="callout"><strong>Executive Summary</strong><p>${escapeHtml(sales.executiveSummary || commercial.salesStory || "")}</p></div>
      <h2>Recommended Action</h2>
      <table><tbody>${actionRows}</tbody></table>
    </section>`;
  const html = `<!doctype html>
    <html lang="ro">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(reportConfig.label)} - ${escapeHtml(contract.clientName || "Client")}</title>
        <style>
          @page { size: A4 landscape; margin: 12mm; }
          body { margin: 0; color: #0F172A; background: #ffffff; font-family: 'Plus Jakarta Sans', Inter, Arial, sans-serif; }
          .page { page-break-after: always; padding: 12px 0; }
          .page:last-child { page-break-after: auto; }
          h1 { margin: 0 0 8px; font-size: 30px; letter-spacing: 0; }
          h2 { margin: 0 0 12px; padding: 8px 10px; background: #0F172A; color: #fff; border-radius: 4px; font-size: 18px; }
          h3 { margin: 10px 0 6px; font-size: 15px; }
          p { font-size: 13px; line-height: 1.45; }
          .cover { min-height: 170mm; display: flex; flex-direction: column; justify-content: space-between; background: linear-gradient(135deg, #0F172A 0%, #334155 100%); color: #fff; border-radius: 8px; padding: 28px; }
          .cover-brand, .brand { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #10B981; padding-bottom: 10px; margin-bottom: 12px; }
          .cover-brand strong, .brand strong { font-size: 24px; }
          .pdf-lockup { display: inline-flex; align-items: center; gap: 10px; }
          .pdf-lockup b { width: 34px; height: 34px; border-radius: 9px; display: inline-flex; align-items: center; justify-content: center; background: #ffffff; color: #0F172A; box-shadow: inset 0 -3px 0 #10B981; font-size: 13px; }
          .cover h1 { max-width: 760px; font-size: 44px; }
          .cover .subtitle { max-width: 700px; color: rgba(255,255,255,0.82); font-size: 17px; }
          .cover-meta { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
          .cover-meta div { border: 1px solid rgba(255,255,255,0.24); border-radius: 6px; padding: 10px; }
          .cover-meta span, .kpi span { display: block; color: #64748B; font-size: 11px; font-weight: 700; text-transform: uppercase; }
          .cover-meta span { color: rgba(255,255,255,0.68); }
          .cover-meta strong { display: block; margin-top: 4px; font-size: 17px; }
          .subtitle { color: #64748B; font-size: 14px; font-weight: 700; }
          .grid { display: grid; gap: 8px; }
          .grid.four { grid-template-columns: repeat(4, 1fr); }
          .grid.three { grid-template-columns: repeat(3, 1fr); }
          .grid.two { grid-template-columns: repeat(2, 1fr); }
          .kpi { border: 1px solid #E2E8F0; background: #F8FAFC; border-radius: 5px; padding: 9px; }
          .kpi strong { display: block; margin-top: 4px; font-size: 17px; }
          .callout { border-left: 5px solid #10B981; background: #F8FAFC; padding: 12px; margin: 12px 0; border-radius: 4px; }
          figure { margin: 8px 0; border: 1px solid #E2E8F0; border-radius: 5px; padding: 6px; }
          figure img { width: 100%; display: block; }
          figcaption { margin-top: 4px; color: #64748B; font-size: 11px; font-weight: 700; }
          .two { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; }
          th { background: #F8FAFC; color: #0F172A; font-weight: 800; }
          th, td { border: 1px solid #E2E8F0; padding: 7px; font-size: 12px; vertical-align: top; }
          ul { margin-top: 8px; }
          li { margin-bottom: 6px; font-size: 13px; }
          .impact-row { display: grid; grid-template-columns: 210px 1fr 150px; align-items: center; gap: 10px; margin: 8px 0; font-size: 12px; font-weight: 700; }
          .impact-row div { height: 14px; background: #E2E8F0; border-radius: 999px; overflow: hidden; }
          .impact-row i { display: block; height: 100%; background: #10B981; }
        </style>
      </head>
      <body>
        ${managementOnly ? managementSummary : `
        <section class="page">
          <div class="cover">
            <div class="cover-brand"><div class="pdf-lockup"><b>EP</b><strong>ENERGYPILOT</strong></div><span>Energy Sales Intelligence Platform</span></div>
            <div>
              <h1>${escapeHtml(reportConfig.label)}</h1>
              <p class="subtitle">Navigate every energy opportunity.</p>
            </div>
            <div class="cover-meta">
              <div><span>Client Name</span><strong>${escapeHtml(contract.clientName || "Client")}</strong></div>
              <div><span>Analysis Period</span><strong>${selectedYear()}</strong></div>
              <div><span>Generation Date</span><strong>${escapeHtml(dateTimeFormat.format(new Date()))}</strong></div>
              <div><span>Generated by</span><strong>EnergyPilot</strong></div>
            </div>
          </div>
        </section>
        <section class="page">
          <div class="brand"><strong>ENERGYPILOT</strong><span>${escapeHtml(dateTimeFormat.format(new Date()))}</span></div>
          <h1>Page 1 - Executive Opportunity Summary</h1>
          <div class="grid four">
            ${commonKpis}
          </div>
          <div class="callout"><strong>Executive Pitch</strong><p>${escapeHtml(sales.executivePitch || sales.executiveSummary || commercial.salesStory || "")}</p></div>
          <h3>Top Opportunities Identified</h3>
          <ul>${topOpportunityList}</ul>
        </section>
        <section class="page">
          <h2>Page 2 - Client Energy Profile</h2>
          <div class="grid four">
            <div class="kpi"><span>Energy Profile</span><strong>${escapeHtml(data.procurementDna.finalOutput || "-")}</strong></div>
            <div class="kpi"><span>Procurement Persona</span><strong>${escapeHtml(profilePersona)}</strong></div>
            <div class="kpi"><span>Commercial Potential</span><strong>${numberFormat.format(commercial.score || 0)} / 100</strong></div>
            <div class="kpi"><span>Forecastability</span><strong>${numberFormat.format(data.procurementDna.forecastabilityScore || 0)}%</strong></div>
            <div class="kpi"><span>Risk Level</span><strong>${escapeHtml(energyRiskLevel(data.procurementDna.riskScore))}</strong></div>
            <div class="kpi"><span>Consum anual</span><strong>${numberFormat.format(data.metrics.totalConsumption || 0)} MWh</strong></div>
            <div class="kpi"><span>Consum zi</span><strong>${numberFormat.format(data.dayMwh)} MWh / ${numberFormat.format(data.dayPct)}%</strong></div>
            <div class="kpi"><span>Consum noapte</span><strong>${numberFormat.format(data.nightMwh)} MWh / ${numberFormat.format(data.nightPct)}%</strong></div>
          </div>
          <div class="callout"><strong>Energy Profile Summary</strong><p>${escapeHtml(data.procurementDna.reportText || data.consumptionText)}</p></div>
        </section>
        <section class="page">
          <h2>Page 3 - Commercial Opportunities</h2>
          <table>
            <thead><tr><th>#</th><th>Opportunity</th><th>Score</th><th>Priority</th><th>Potential Savings</th><th>Recommended Action</th></tr></thead>
            <tbody>${opportunityRows || `<tr><td colspan="6">Insufficient data available for opportunity ranking.</td></tr>`}</tbody>
          </table>
          <h3>Top Opportunities</h3>
          <ul>${topOpportunityList}</ul>
        </section>
        <section class="page">
          <h2>Page 4 - Financial Impact</h2>
          <div class="grid four">
            <div class="kpi"><span>Estimated Annual Savings</span><strong>${escapeHtml(formatLei(commercial.estimatedAnnualSavingsLei || 0))}</strong></div>
            <div class="kpi"><span>Opportunity Impact</span><strong>${escapeHtml(topOpportunity?.name || "Pending")}</strong></div>
            <div class="kpi"><span>PMP Client</span><strong>${data.hasPrices ? numberFormat.format(data.annual.pmpPzuLeiMwh || 0) : "N/A"} lei/MWh</strong></div>
            <div class="kpi"><span>Cost Concentration</span><strong>${Number.isFinite(data.costDna.concentrationIndex) ? numberFormat.format(data.costDna.concentrationIndex) : "N/A"}</strong></div>
          </div>
          <h3>Commercial Impact Breakdown</h3>
          ${impactBreakdown}
        </section>
        <section class="page">
          <h2>Page 5 - Visual Insights</h2>
          ${img("reportConsumptionHeatmap", "Heatmap consum 24h x 365 zile")}
          ${img("reportLoadDurationChart", "Load Duration Curve")}
          <div class="two">${data.hasPrices ? img("reportCostDistributionChart", "Cost Exposure Profile") : ""}${data.hasPrices ? img("reportPzuHeatmap", "PZU Heatmap") : ""}</div>
        </section>
        <section class="page">
          <h2>Page 6 - Recommended Action Plan</h2>
          <table><thead><tr><th>Priority</th><th>Action</th><th>Description</th><th>Expected Impact</th><th>Estimated Timeline</th></tr></thead><tbody>${actionRows}</tbody></table>
          <h3>Objection Handling</h3>
          <ul>${objectionsHtml || "<li>In asteptare.</li>"}</ul>
        </section>
        <section class="page">
          <h2>Page 7 - Next Steps</h2>
          <div class="grid three">
            <div class="kpi"><span>Immediate Actions</span><strong>${escapeHtml(sales.nextBestAction || "Validate data")}</strong></div>
            <div class="kpi"><span>Recommended Assessment</span><strong>${escapeHtml(data.procurementDna.contractRecommendation || "Energy profile validation")}</strong></div>
            <div class="kpi"><span>Proposed Commercial Discussion</span><strong>${escapeHtml(topOpportunity?.name || "Opportunity review")}</strong></div>
          </div>
          <h3>Meeting Brief</h3>
          <ul>${listHtml(sales.meetingBrief)}</ul>
        </section>
        <section class="page">
          <h2>BESS Opportunity Report</h2>
          <div class="grid four">
            <div class="kpi"><span>Storage Opportunity Score</span><strong>${numberFormat.format(storageOpportunity.score || 0)}%</strong></div>
            <div class="kpi"><span>Potential Savings</span><strong>${escapeHtml(formatLei(storageOpportunity.estimatedSavingsLei || 0))}</strong></div>
            <div class="kpi"><span>Estimated ROI</span><strong>${(storageOpportunity.estimatedSavingsLei || 0) > 0 ? "Needs CAPEX validation" : "CAPEX required"}</strong></div>
            <div class="kpi"><span>BESS Recommendation</span><strong>${escapeHtml(storageOpportunity.action || "Launch BESS Opportunity Simulator")}</strong></div>
          </div>
          ${img("reportLoadDurationChart", "Load Duration Analysis")}
          ${img("reportPeakShavingChart", "Peak Shaving Analysis")}
        </section>
        <section class="page">
          <h2>Solar Opportunity Report</h2>
          <div class="grid four">
            <div class="kpi"><span>Solar Fit</span><strong>${numberFormat.format(data.solarShare || 0)}%</strong></div>
            <div class="kpi"><span>Estimated Self Consumption</span><strong>${numberFormat.format(data.solarMwh || 0)} MWh</strong></div>
            <div class="kpi"><span>Solar Opportunity Score</span><strong>${numberFormat.format(solarOpportunity.score || 0)}%</strong></div>
            <div class="kpi"><span>Potential Savings</span><strong>${escapeHtml(formatLei(solarOpportunity.estimatedSavingsLei || 0))}</strong></div>
          </div>
          <div class="callout"><strong>PV Expansion Potential</strong><p>${escapeHtml(solarOpportunity.action || "Dimensionare PV pentru autoconsum 08:00-18:00")}</p></div>
          <div class="two">${img("reportSolarOpportunityChart", "Solar Opportunity")}${img("reportDailyCurveChart", "Daily Consumption Profile")}</div>
        </section>`}
        <script>window.onload = () => setTimeout(() => window.print(), 300);</script>
      </body>
    </html>`;
  popup.document.open();
  popup.document.write(html);
  popup.document.close();
}

function exportAdvancedDataCsv() {
  renderConsumptionProfile();
  const data = state.advancedReport;
  if (!data) return;
  const table = (title, headers, rows) => `
    <h2>${escapeHtml(title)}</h2>
    <table>
      <thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>
      <tbody>${rows
        .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`)
        .join("")}</tbody>
    </table>`;
  const executiveRows = [
    ["Client", data.contract.clientName || "Client"],
    ["Commercial Opportunity Score", `${numberFormat.format(data.commercialOpportunity?.score || 0)} / 100`],
    ["Commercial Potential", data.commercialOpportunity?.label || "Limited Opportunity"],
    ["Estimated Annual Savings", formatLei(data.commercialOpportunity?.estimatedAnnualSavingsLei || 0)],
    ["Executive Pitch", data.salesIntelligence?.executivePitch || ""],
    ["Next Best Action", data.salesIntelligence?.nextBestAction || ""],
    ["Consum anual MWh", numberFormat.format(data.metrics.totalConsumption || 0)],
    ["Consum zi MWh", numberFormat.format(data.dayMwh)],
    ["Consum zi %", numberFormat.format(data.dayPct)],
    ["Consum noapte MWh", numberFormat.format(data.nightMwh)],
    ["Consum noapte %", numberFormat.format(data.nightPct)],
    ["PMP Client lei/MWh", data.hasPrices ? numberFormat.format(data.annual.pmpPzuLeiMwh || 0) : "N/A"],
    ["Media PZU lei/MWh", data.hasPrices ? numberFormat.format(data.annual.simplePzuAverageLeiMwh || 0) : "N/A"],
    ["Varf consum MW", numberFormat.format(data.metrics.peakMw || 0)],
    ["Medie orara MW", numberFormat.format(data.metrics.averageMw || 0)],
    ["Load factor %", numberFormat.format(data.metrics.loadFactorPct || 0)],
    ["Energy Profile Intelligence", data.procurementDna.finalOutput || "-"],
    ["Recomandare contract", data.procurementDna.contractRecommendation || "-"],
    ["Recomandare eficientizare", data.opportunity.efficiencyRecommendation || "-"],
  ];
  const commercialRows = (data.commercialOpportunity?.opportunities || []).map((item, index) => [
    String(index + 1),
    item.name,
    numberFormat.format(item.score || 0),
    numberFormat.format(item.weight || 0),
    formatLei(item.estimatedSavingsLei || 0),
    item.action,
  ]);
  const salesSummaryRows = [
    ["Executive Summary", data.salesIntelligence?.executiveSummary || ""],
    ["Executive Pitch", data.salesIntelligence?.executivePitch || ""],
    ["Next Best Action", data.salesIntelligence?.nextBestAction || ""],
    ["Email Subject", data.salesIntelligence?.emailSubject || ""],
    ["Email Body", data.salesIntelligence?.emailBody || ""],
  ];
  const whyRows = (data.salesIntelligence?.whyThisClient || []).map((item, index) => [String(index + 1), item]);
  const talkingRows = (data.salesIntelligence?.talkingPoints || []).map((item) => [item.name, item.text]);
  const confidenceRows = (data.salesIntelligence?.confidence || []).map((item) => [item.name, numberFormat.format(item.score || 0), item.reason]);
  const objectionRows = (data.salesIntelligence?.objections || []).map((item) => [item.objection, item.response]);
  const meetingRows = (data.salesIntelligence?.meetingBrief || []).map((item, index) => [String(index + 1), item]);
  const monthlyRows = data.monthly.map((row) => [
    row.month,
    numberFormat.format(row.consumptionMwh || 0),
    numberFormat.format(row.pvMwh || 0),
    data.hasPrices ? numberFormat.format(row.pmpPzuLeiMwh || 0) : "N/A",
    data.hasPrices ? numberFormat.format(row.simplePzuAverageLeiMwh || 0) : "N/A",
    numberFormat.format(row.expensiveConsumptionMwh || 0),
    numberFormat.format(row.cheapConsumptionMwh || 0),
    numberFormat.format(row.weekdayMwh || 0),
    numberFormat.format(row.weekendMwh || 0),
  ]);
  const intervalRows = data.intervalRows.map((row) => [
    row.label,
    numberFormat.format(row.mwh || 0),
    numberFormat.format(row.value || 0),
  ]);
  const hourlyRows = data.rows.map((row, index) => {
    const parts = rowDateParts(row, index);
    const hour = parts.hour;
    const consumption = Number(row.consumption_mwh) || 0;
    const pv = Number(row.pv_mwh) || 0;
    const price = Number(row.price_lei_mwh) || 0;
    const cost = consumption * price;
    const interval =
      hour < 6 ? "00:00-06:00" : hour < 12 ? "06:00-12:00" : hour < 18 ? "12:00-18:00" : "18:00-24:00";
    return [
      row.timestamp || `${selectedYear()}-${String(parts.monthIndex + 1).padStart(2, "0")}-${String(parts.day).padStart(2, "0")} ${String(hour).padStart(2, "0")}:00`,
      MONTHS[parts.monthIndex]?.label || "",
      String(parts.day),
      String(hour).padStart(2, "0"),
      numberFormat.format(consumption),
      numberFormat.format(pv),
      numberFormat.format(price),
      numberFormat.format(cost),
      hour >= 7 && hour < 22 ? "Zi" : "Noapte",
      interval,
      isWeekendRow(row, index) ? "Weekend" : "Zi lucratoare",
    ];
  });
  const html = `<!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: 'Plus Jakarta Sans', Inter, Arial, sans-serif; color: #0F172A; }
          h1 { background: #0F172A; color: #fff; padding: 12px; }
          h2 { background: #F8FAFC; color: #334155; padding: 8px; margin-top: 18px; }
          table { border-collapse: collapse; width: 100%; margin-bottom: 18px; }
          th { background: #F8FAFC; color: #0F172A; font-weight: 700; }
          th, td { border: 1px solid #E2E8F0; padding: 6px 8px; mso-number-format:"\\@"; }
          td:nth-child(5), td:nth-child(6), td:nth-child(7), td:nth-child(8) { mso-number-format:"0.00"; }
        </style>
      </head>
      <body>
        <h1>ENERGYPILOT - Export date Reports</h1>
        ${table("Dashboard Executive", ["Indicator", "Valoare"], executiveRows)}
        ${table("Sales Intelligence Summary", ["Indicator", "Valoare"], salesSummaryRows)}
        ${table("Why This Client", ["#", "Argument"], whyRows)}
        ${table("Sales Talking Points", ["Zona", "Argument comercial"], talkingRows)}
        ${table("Opportunity Confidence Score", ["Oportunitate", "Confidence", "Motiv"], confidenceRows)}
        ${table("Objection Handling", ["Obiectie", "Raspuns recomandat"], objectionRows)}
        ${table("Meeting Brief", ["#", "Punct"], meetingRows)}
        ${table("Commercial Opportunity Ranking", ["Prioritate", "Oportunitate", "Scor", "Pondere", "Saving estimat", "Actiune comerciala"], commercialRows)}
        ${table("Consum pe intervale orare", ["Interval", "Consum MWh", "Pondere %"], intervalRows)}
        ${table("Date lunare analizate", ["Luna", "Consum MWh", "PV MWh", "PMP Client", "Media PZU", "Ore scumpe MWh", "Ore ieftine MWh", "Weekday MWh", "Weekend MWh"], monthlyRows)}
        ${table("Date orare analizate", ["Timestamp", "Luna", "Zi", "Ora", "Consum MWh", "PV MWh", "Pret PZU lei/MWh", "Cost PZU lei", "Zi/Noapte", "Interval orar", "Tip zi"], hourlyRows)}
      </body>
    </html>`;
  const blob = new Blob([`\ufeff${html}`], { type: "application/vnd.ms-excel;charset=utf-8" });
  downloadBlob(blob, `EnergyPilot_Reports_${safeFilenamePart(data.contract.clientName || "Client", "Client")}.xls`);
}

async function shareReportSummary() {
  renderConsumptionProfile();
  const data = state.advancedReport;
  if (!data || !data.hasConsumption) {
    setMessages(["Insufficient data available for report generation. Please complete the analysis first."], true);
    return;
  }
  const config = activeReportConfig();
  const commercial = data.commercialOpportunity || {};
  const sales = data.salesIntelligence || {};
  const top = commercial.topOpportunities?.[0] || commercial.opportunities?.[0];
  const text = [
    `${config.label} - ${data.contract.clientName || "Client"}`,
    "EnergyPilot - Energy Sales Intelligence Platform",
    `Commercial Opportunity Score: ${numberFormat.format(commercial.score || 0)} / 100`,
    `Estimated Annual Savings: ${formatLei(commercial.estimatedAnnualSavingsLei || 0)}`,
    `Top Opportunity: ${top?.name || "Pending"}`,
    `Recommended Action: ${sales.nextBestAction || top?.action || "Complete analysis"}`,
  ].join("\n");
  try {
    await navigator.clipboard.writeText(text);
    setMessages(["Rezumatul raportului a fost copiat pentru share."]);
  } catch {
    setMessages([text]);
  }
}

function exportPowerPointReadyReport() {
  renderConsumptionProfile();
  const data = state.advancedReport;
  if (!data || !data.hasConsumption) {
    setMessages(["Insufficient data available for report generation. Please complete the analysis first."], true);
    return;
  }
  const config = activeReportConfig();
  const commercial = data.commercialOpportunity || {};
  const sales = data.salesIntelligence || {};
  const chartImages = visibleChartImages();
  const image = (id, caption) => {
    const found = chartImages.find((item) => item.id === id);
    return found ? `<img src="${found.src}" alt="${escapeHtml(caption)}" />` : `<p>${escapeHtml(caption)} unavailable.</p>`;
  };
  const top = commercial.topOpportunities?.[0] || commercial.opportunities?.[0];
  const plan = buildReportActionPlan(data);
  const slides = [
    {
      title: config.label,
      body: `<h2>${escapeHtml(data.contract.clientName || "Client")}</h2><p>Energy Sales Intelligence Platform. Navigate every energy opportunity.</p>`,
    },
    {
      title: "Executive Opportunity Summary",
      body: `<div class="kpis"><div><span>Score</span><strong>${numberFormat.format(commercial.score || 0)} / 100</strong></div><div><span>Estimated Savings</span><strong>${escapeHtml(formatLei(commercial.estimatedAnnualSavingsLei || 0))}</strong></div><div><span>Top Opportunity</span><strong>${escapeHtml(top?.name || "Pending")}</strong></div></div><p>${escapeHtml(sales.executiveSummary || commercial.salesStory || "")}</p>`,
    },
    {
      title: "Client Energy Profile",
      body: `<p>${escapeHtml(data.procurementDna?.reportText || data.consumptionText)}</p><div class="kpis"><div><span>Energy Profile</span><strong>${escapeHtml(data.procurementDna?.finalOutput || "-")}</strong></div><div><span>Risk</span><strong>${escapeHtml(energyRiskLevel(data.procurementDna?.riskScore))}</strong></div></div>`,
    },
    {
      title: "Visual Insights",
      body: `${image("reportConsumptionHeatmap", "Consumption Heatmap")}${image("reportLoadDurationChart", "Load Duration Curve")}`,
    },
    {
      title: "Commercial Action Plan",
      body: `<ol>${plan.map((item) => `<li><strong>${escapeHtml(item.title)}</strong><br>${escapeHtml(item.description)}<br>${escapeHtml(item.impact)} | ${escapeHtml(item.timeline)}</li>`).join("")}</ol>`,
    },
  ];
  const html = `<!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { margin: 0; font-family: 'Plus Jakarta Sans', Inter, Arial, sans-serif; color: #0F172A; }
          .slide { width: 1280px; min-height: 720px; page-break-after: always; padding: 44px; box-sizing: border-box; }
          .slide:first-child { background: linear-gradient(135deg, #0F172A, #334155); color: #fff; }
          h1 { margin: 0 0 24px; font-size: 42px; }
          h2 { margin: 0 0 16px; font-size: 28px; }
          p, li { font-size: 22px; line-height: 1.35; }
          .kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin: 20px 0; }
          .kpis div { border: 1px solid #E2E8F0; border-radius: 8px; padding: 16px; background: #F8FAFC; }
          .kpis span { display: block; color: #64748B; font-size: 15px; font-weight: 800; text-transform: uppercase; }
          .kpis strong { display: block; margin-top: 8px; font-size: 23px; }
          img { max-width: 100%; max-height: 270px; object-fit: contain; display: block; margin: 12px 0; border: 1px solid #E2E8F0; }
        </style>
      </head>
      <body>
        ${slides.map((slide) => `<section class="slide"><h1>${escapeHtml(slide.title)}</h1>${slide.body}</section>`).join("")}
      </body>
    </html>`;
  const blob = new Blob([`\ufeff${html}`], { type: "application/vnd.ms-powerpoint;charset=utf-8" });
  downloadBlob(blob, `EnergyPilot_${safeFilenamePart(config.label, "Report")}_${safeFilenamePart(data.contract.clientName || "Client", "Client")}.ppt`);
}

function downloadAdvancedChartImages() {
  renderConsumptionProfile();
  const images = visibleChartImages();
  if (!images.length) {
    setMessages(["Nu exista diagrame vizibile de descarcat."], true);
    return;
  }
  images.forEach((image, index) => {
    window.setTimeout(() => {
      const a = document.createElement("a");
      a.href = image.src;
      a.download = `${String(index + 1).padStart(2, "0")}_${safeFilenamePart(image.id, "diagrama")}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }, index * 120);
  });
}

function drawSourcingProfileChart(daily) {
  const canvas = $("sourcingProfileChart");
  if (!canvas) return;
  const { ctx, width, height } = prepareChartCanvas(canvas, 1200, 360);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#0F172A";
  ctx.font = "700 18px Plus Jakarta Sans, Inter, Arial";
  ctx.fillText(`Profil zilnic consum / PV - ${selectedYear()}`, 28, 30);
  if (!daily.length) return;

  const max = Math.max(
    ...daily.flatMap((row) => [row.dayMwh + row.nightMwh, row.totalMwh, row.pvMwh]),
    1,
  );
  const paddingLeft = 54;
  const paddingRight = 30;
  const paddingTop = 68;
  const paddingBottom = 58;
  const plotW = width - paddingLeft - paddingRight;
  const plotH = height - paddingTop - paddingBottom;
  const step = plotW / daily.length;
  const barW = Math.max(1, Math.min(4, step * 0.78));

  ctx.strokeStyle = "#E2E8F0";
  ctx.lineWidth = 1;
  for (let index = 0; index <= 4; index += 1) {
    const y = paddingTop + (plotH / 4) * index;
    ctx.beginPath();
    ctx.moveTo(paddingLeft, y);
    ctx.lineTo(width - paddingRight, y);
    ctx.stroke();
  }

  ctx.strokeStyle = "#E2E8F0";
  ctx.beginPath();
  ctx.moveTo(paddingLeft, paddingTop);
  ctx.lineTo(paddingLeft, height - paddingBottom);
  ctx.lineTo(width - paddingRight, height - paddingBottom);
  ctx.stroke();

  let dayOffset = 0;
  MONTHS.forEach((month, monthIndex) => {
    const monthLength = monthDays(monthIndex);
    const xStart = paddingLeft + dayOffset * step;
    const xMiddle = xStart + (monthLength * step) / 2;
    ctx.strokeStyle = "rgba(10, 29, 50, 0.12)";
    ctx.beginPath();
    ctx.moveTo(xStart, paddingTop);
    ctx.lineTo(xStart, height - paddingBottom);
    ctx.stroke();
    ctx.fillStyle = "#64748B";
    ctx.font = "700 10px Plus Jakarta Sans, Inter, Arial";
    ctx.textAlign = "center";
    ctx.fillText(MONTH_SHORT[monthIndex].toUpperCase(), xMiddle, height - 25);
    dayOffset += monthLength;
  });
  ctx.fillStyle = "#64748B";
  ctx.font = "700 10px Plus Jakarta Sans, Inter, Arial";
  ctx.fillText(String(selectedYear()), paddingLeft + plotW / 2, height - 10);

  const legend = [
    { label: "Consum zi", color: "#10B981", x: paddingLeft - 16 },
    { label: "Consum noapte", color: "#334155", x: paddingLeft + 104 },
    { label: "Productie PV", color: "#F59E0B", x: paddingLeft + 252 },
    { label: "Total zilnic", color: "#EF4444", x: paddingLeft + 392, line: true },
  ];
  legend.forEach((item) => {
    if (item.line) {
      ctx.strokeStyle = item.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(item.x, 49);
      ctx.lineTo(item.x + 18, 49);
      ctx.stroke();
    } else {
      ctx.fillStyle = item.color;
      ctx.fillRect(item.x, 43, 12, 12);
    }
    ctx.fillStyle = "#64748B";
    ctx.font = "600 11px Plus Jakarta Sans, Inter, Arial";
    ctx.textAlign = "left";
    ctx.fillText(item.label, item.x + (item.line ? 26 : 18), 53);
  });

  daily.forEach((row, index) => {
    const x = paddingLeft + index * step + (step - barW) / 2;
    const yBase = height - paddingBottom;
    const nightHeight = (row.nightMwh / max) * plotH;
    const dayHeight = (row.dayMwh / max) * plotH;
    const pvHeight = (row.pvMwh / max) * plotH;

    ctx.fillStyle = "#334155";
    ctx.fillRect(x, yBase - nightHeight, barW, nightHeight);
    ctx.fillStyle = "#10B981";
    ctx.fillRect(x, yBase - nightHeight - dayHeight, barW, dayHeight);
    if (row.pvMwh > 0) {
      const pvBarW = Math.max(1, Math.min(2.4, barW * 0.46));
      const pvX = x + (barW - pvBarW) / 2;
      ctx.fillStyle = "#F59E0B";
      ctx.fillRect(pvX, yBase - pvHeight, pvBarW, pvHeight);
    }
  });

  ctx.strokeStyle = "#EF4444";
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  daily.forEach((row, index) => {
    const x = paddingLeft + index * step + step / 2;
    const y = height - paddingBottom - (row.totalMwh / max) * plotH;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.textAlign = "left";
}

function drawConsumptionProfileChart(monthly) {
  const canvas = $("profileChart");
  if (!canvas) return;
  const { ctx, width, height } = prepareChartCanvas(canvas, 900, 280);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#0F172A";
  ctx.font = "700 18px Plus Jakarta Sans, Inter, Arial";
  ctx.fillText("Profil lunar consum / PV", 28, 30);
  if (!monthly.length) return;

  const max = Math.max(...monthly.flatMap((row) => [row.consumptionMwh, row.pvMwh]), 1);
  const paddingLeft = 52;
  const paddingRight = 28;
  const paddingTop = 64;
  const paddingBottom = 48;
  const plotW = width - paddingLeft - paddingRight;
  const plotH = height - paddingTop - paddingBottom;
  const groupW = plotW / monthly.length;
  const barW = Math.max(8, Math.min(28, groupW * 0.28));

  ctx.strokeStyle = "#E2E8F0";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(paddingLeft, paddingTop);
  ctx.lineTo(paddingLeft, height - paddingBottom);
  ctx.lineTo(width - paddingRight, height - paddingBottom);
  ctx.stroke();

  ctx.fillStyle = "#64748B";
  ctx.font = "600 11px Plus Jakarta Sans, Inter, Arial";
  ctx.fillText("Consum", paddingLeft + 4, 50);
  ctx.fillStyle = "#94A3B8";
  ctx.fillRect(paddingLeft - 16, 41, 12, 12);
  ctx.fillStyle = "#64748B";
  ctx.fillText("PV", paddingLeft + 96, 50);
  ctx.fillStyle = "#10B981";
  ctx.fillRect(paddingLeft + 76, 41, 12, 12);

  monthly.forEach((row, index) => {
    const x = paddingLeft + index * groupW + groupW * 0.24;
    const consumptionHeight = (row.consumptionMwh / max) * plotH;
    const pvHeight = (row.pvMwh / max) * plotH;
    const yBase = height - paddingBottom;
    ctx.fillStyle = "#94A3B8";
    ctx.fillRect(x, yBase - consumptionHeight, barW, consumptionHeight);
    ctx.fillStyle = "#10B981";
    ctx.fillRect(x + barW + 4, yBase - pvHeight, barW, pvHeight);
    ctx.fillStyle = "#0F172A";
    ctx.font = "600 10px Plus Jakarta Sans, Inter, Arial";
    ctx.textAlign = "center";
    ctx.fillText(MONTH_SHORT[index] || row.monthKey, x + barW, height - 18);
  });
  ctx.textAlign = "left";
}

function drawScenarioComparisonChart(scenarios, activeName) {
  const canvas = $("scenarioComparisonChart");
  const { ctx, width, height } = prepareChartCanvas(canvas, 900, 300);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  const rows = scenarioCostsFromResult({ scenarios });
  ctx.fillStyle = "#0F172A";
  ctx.font = "700 18px Plus Jakarta Sans, Inter, Arial";
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

  ctx.strokeStyle = "#E2E8F0";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(paddingLeft, paddingTop);
  ctx.lineTo(paddingLeft, height - paddingBottom);
  ctx.lineTo(width - paddingRight, height - paddingBottom);
  ctx.stroke();

  ctx.fillStyle = "#64748B";
  ctx.font = "600 11px Plus Jakarta Sans, Inter, Arial";
  ctx.fillText("Fara BESS", paddingLeft + 4, 48);
  ctx.fillStyle = "#94A3B8";
  ctx.fillRect(paddingLeft - 16, 39, 12, 12);
  ctx.fillStyle = "#64748B";
  ctx.fillText("Cu BESS", paddingLeft + 100, 48);
  ctx.fillStyle = "#10B981";
  ctx.fillRect(paddingLeft + 80, 39, 12, 12);

  rows.forEach((row, index) => {
    const x = paddingLeft + index * groupW + groupW * 0.3;
    const hWithout = (row.priceWithoutBessLeiMwh / max) * plotH;
    const hWith = (row.priceWithBessLeiMwh / max) * plotH;
    const yBase = height - paddingBottom;
    ctx.fillStyle = "#94A3B8";
    ctx.fillRect(x, yBase - hWithout, barW, hWithout);
    ctx.fillStyle = row.name === activeName ? "#10B981" : "#10B981";
    ctx.fillRect(x + barW + 5, yBase - hWith, barW, hWith);
    ctx.fillStyle = "#0F172A";
    ctx.font = row.name === activeName ? "700 11px Plus Jakarta Sans, Inter, Arial" : "600 11px Plus Jakarta Sans, Inter, Arial";
    ctx.textAlign = "center";
    ctx.fillText(row.name, x + barW, height - 24);
    ctx.fillText(numberFormat.format(row.priceWithBessLeiMwh), x + barW, Math.max(54, yBase - hWith - 7));
  });
  ctx.textAlign = "left";
}

function drawMonthlyChart(monthly) {
  const canvas = $("resultChart");
  const { ctx, width, height } = prepareChartCanvas(canvas, 900, 260);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#0F172A";
  ctx.font = "700 18px Plus Jakarta Sans, Inter, Arial";
  ctx.fillText("Preturi medii lunare - scenariul selectat", 28, 28);
  if (!monthly.length) return;
  const values = monthly.flatMap((row) => [row.price_without_bess_lei_mwh, row.price_with_bess_lei_mwh]);
  const max = Math.max(...values, 1);
  const padding = 44;
  const plotW = width - padding * 2;
  const plotH = height - padding * 2 - 24;
  const groupW = plotW / monthly.length;
  const barW = Math.max(8, groupW * 0.28);

  ctx.strokeStyle = "#E2E8F0";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding, padding + 24);
  ctx.lineTo(padding, height - padding);
  ctx.lineTo(width - padding, height - padding);
  ctx.stroke();

  ctx.fillStyle = "#64748B";
  ctx.font = "600 11px Plus Jakarta Sans, Inter, Arial";
  ctx.fillText("Fara BESS", padding + 4, 50);
  ctx.fillStyle = "#94A3B8";
  ctx.fillRect(padding - 16, 41, 12, 12);
  ctx.fillStyle = "#64748B";
  ctx.fillText("Cu BESS", padding + 100, 50);
  ctx.fillStyle = "#10B981";
  ctx.fillRect(padding + 80, 41, 12, 12);

  monthly.forEach((row, index) => {
    const x = padding + index * groupW + groupW * 0.25;
    const h1 = (row.price_without_bess_lei_mwh / max) * plotH;
    const h2 = (row.price_with_bess_lei_mwh / max) * plotH;
    ctx.fillStyle = "#94A3B8";
    ctx.fillRect(x, height - padding - h1, barW, h1);
    ctx.fillStyle = "#10B981";
    ctx.fillRect(x + barW + 4, height - padding - h2, barW, h2);
    ctx.fillStyle = "#0F172A";
    ctx.font = "600 10px Plus Jakarta Sans, Inter, Arial";
    ctx.textAlign = "center";
    ctx.fillText(row.month || MONTH_SHORT[index] || "", x + barW, height - 18);
    ctx.fillText(numberFormat.format(row.price_with_bess_lei_mwh), x + barW + 4, Math.max(60, height - padding - h2 - 6));
  });
  ctx.textAlign = "left";
}

document.querySelector(".main-menu")?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-app-view]");
  if (!button) return;
  setAppView(button.dataset.appView);
});
$("runBtn").addEventListener("click", runSimulation);
$("runFinancialBtn").addEventListener("click", runFinancialSummary);
$("exportFinancialBtn").addEventListener("click", exportFinancialSummary);
$("exportReportBtn").addEventListener("click", exportCompleteReport);
$("generatePdfReportBtn")?.addEventListener("click", generateAdvancedPdfReport);
$("exportAdvancedDataBtn")?.addEventListener("click", exportAdvancedDataCsv);
$("downloadChartImagesBtn")?.addEventListener("click", downloadAdvancedChartImages);
$("exportPowerPointBtn")?.addEventListener("click", exportPowerPointReadyReport);
$("shareReportBtn")?.addEventListener("click", shareReportSummary);
$("generateReportPreviewBtn")?.addEventListener("click", () => {
  activateProfileRoadmapTab("reports");
  renderConsumptionProfile();
  setMessages(["Report generated in preview. Use Download PDF for the printable consulting-style report."]);
});
$("previewReportBtn")?.addEventListener("click", () => {
  renderConsumptionProfile();
  setMessages(["Preview raport actualizat cu datele disponibile."]);
});
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
$("scenarioBehaviorMonth").addEventListener("change", (event) => {
  state.scenarioBehaviorMonth = event.target.value || "all";
  if (state.activeScenario) {
    renderScenario(state.activeScenario, { persist: false });
  }
});
let chartResizeTimer = null;
window.addEventListener("resize", () => {
  window.clearTimeout(chartResizeTimer);
  chartResizeTimer = window.setTimeout(() => {
    if (state.result) {
      const scenario = scenarioByName(state.activeScenario);
      if (scenario) {
        drawScenarioComparisonChart(state.result.scenarios, scenario.name);
        drawMonthlyChart(scenario.summary.monthly);
      }
    }
    if (state.activeAppView === "profile") renderConsumptionProfile();
  }, 120);
});
updateProfileRoadmapLayout("client");
function activateProfileRoadmapTab(tab = "client") {
  const panelTab = tab === "reports" ? "advanced" : tab;
  setAppView("profile");
  updateProfileRoadmapLayout(tab);
  document.querySelectorAll("button[data-roadmap-tab]").forEach((item) => {
    item.classList.toggle("active", item.dataset.roadmapTab === tab);
  });
  document.querySelectorAll(".profile-roadmap-tab").forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.roadmapPanel === panelTab);
  });
  if (tab === "procurement" || panelTab === "advanced") {
    window.requestAnimationFrame(() => {
      if (tab === "procurement" && state.procurementDna) drawProcurementDnaCharts(state.procurementDna);
      else if (panelTab === "advanced" && state.advancedReport) drawAdvancedReportCharts(state.advancedReport);
      else renderConsumptionProfile();
    });
  }
  if (window.innerWidth <= 760) $("appShell")?.classList.remove("sidebar-open");
}
document.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-roadmap-tab]");
  if (!button) return;
  activateProfileRoadmapTab(button.dataset.roadmapTab);
});
document.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-report-type]");
  if (!button) return;
  setActiveReportType(button.dataset.reportType);
});
document.addEventListener("click", (event) => {
  const filterButton = event.target.closest("button[data-opportunity-filter]");
  if (!filterButton) return;
  applyOpportunityFilter(filterButton.dataset.opportunityFilter || "all");
});
document.addEventListener("click", (event) => {
  const detailButton = event.target.closest("button[data-opportunity-detail]");
  if (!detailButton) return;
  const card = detailButton.closest(".opportunity-market-card");
  if (!card) return;
  setText("spotlightOpportunityName", card.dataset.opportunityName || "Opportunity");
  setText(
    "spotlightOpportunityText",
    `${card.dataset.recommendedAction || "Recommended action pending."} Estimated impact: ${formatLei(card.dataset.estimatedSavings || 0)}. Priority: ${opportunityStatusMeta(card.dataset.score).priority}.`,
  );
  $("topOpportunitySpotlight")?.scrollIntoView({ behavior: "smooth", block: "center" });
});
document.addEventListener("click", (event) => {
  const actionButton = event.target.closest("button[data-sales-action]");
  if (!actionButton) return;
  const card = actionButton.closest(".opportunity-market-card");
  const name = card?.dataset.opportunityName || "Opportunity";
  const action = actionButton.dataset.salesAction || "action";
  const label = action === "pitch" ? "Sales Pitch" : action === "email" ? "Email" : action === "summary" ? "Executive Summary" : "Opportunity Export";
  setMessages([`${label} pregatit pentru ${name}. Continutul foloseste scorurile si recomandarile Opportunity Engine existente.`]);
});
document.addEventListener("click", (event) => {
  if (!event.target.closest("#spotlightDetailsBtn")) return;
  const firstVisible = document.querySelector(".opportunity-market-card:not(.is-filter-hidden)");
  firstVisible?.scrollIntoView({ behavior: "smooth", block: "center" });
});
document.addEventListener("click", (event) => {
  const simulatorButton = event.target.closest("button[data-open-simulator]");
  if (!simulatorButton) return;
  setAppView("simulator");
  if (window.innerWidth <= 760) $("appShell")?.classList.remove("sidebar-open");
});
$("sidebarToggleBtn")?.addEventListener("click", () => {
  const shell = $("appShell");
  if (!shell) return;
  const isTablet = window.innerWidth <= 760;
  if (isTablet) {
    shell.classList.toggle("sidebar-open");
    $("sidebarToggleBtn")?.setAttribute("aria-expanded", String(shell.classList.contains("sidebar-open")));
    return;
  }
  shell.classList.toggle("sidebar-collapsed");
  $("sidebarToggleBtn")?.setAttribute("aria-expanded", String(!shell.classList.contains("sidebar-collapsed")));
});
$("quickSearch")?.addEventListener("input", (event) => {
  const query = event.target.value.trim().toLowerCase();
  document.querySelectorAll(".sidebar-roadmap-item, .sidebar-action-button").forEach((item) => {
    const matches = !query || item.textContent.toLowerCase().includes(query);
    item.classList.toggle("is-search-hidden", !matches);
  });
});
PROFILE_CONTRACT_FIELD_IDS.forEach((id) => {
  const element = $(id);
  if (!element) return;
  const handler = () => {
    renderConsumptionProfile();
    scheduleSaveProjectDraft();
  };
  element.addEventListener("input", handler);
  element.addEventListener("change", handler);
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
  renderConsumptionProfile();
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
  updateTopbarContext();
  renderCurveTable();
  scheduleSaveProjectDraft();
  refreshChecksFromCurrentInputs();
});
$("topDateRange")?.addEventListener("change", (event) => {
  const priceYear = $("priceYear");
  if (!priceYear) return;
  priceYear.value = event.target.value || "2025";
  priceYear.dispatchEvent(new Event("change", { bubbles: true }));
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
window.addEventListener("load", hideLoadingScreen);
window.setTimeout(hideLoadingScreen, 1200);
initCurveControls();
loadAuthSession();
renderAuthMode();
renderAuthState();
setAppView(state.activeAppView);
if (state.user) {
  loadProjects();
  syncPriceImportVisibility();
  refreshChecksFromCurrentInputs();
}




