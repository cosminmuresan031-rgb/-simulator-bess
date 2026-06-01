from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from math import ceil, sqrt
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple


EPS = 1e-9
DAY_START_HOUR = 7
DAY_END_HOUR = 22
ATR_HEADROOM_FACTOR = 0.8


@dataclass(frozen=True)
class HourInput:
    timestamp: str
    consumption_mwh: float
    pv_mwh: float
    price_lei_mwh: float


@dataclass(frozen=True)
class SimulationParams:
    atr_mw: float = 0.0
    round_trip_efficiency: float = 0.90
    initial_soc_mwh: float = 0.0
    min_soc_mwh: float = 0.0
    export_allowed: bool = False
    distribution_tariff_lei_mwh: float = 0.0
    smart_duration_h: float = 4.0
    smart_candidate_multiplier: float = 2.0
    custom_ac_mw: float = 0.0
    custom_storage_mwh: float = 0.0


@dataclass(frozen=True)
class ScenarioConfig:
    name: str
    duration_h: Optional[float] = None
    ac_mw: Optional[float] = None
    storage_mwh: Optional[float] = None
    candidate_multiplier: float = 2.0
    pv_only: bool = False


def parse_float(value: Any, default: float = 0.0) -> float:
    if value is None or value == "":
        return default
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).strip().replace(" ", "").replace(",", ".")
    try:
        return float(text)
    except ValueError:
        return default


def parse_timestamp(value: Any, index: int) -> str:
    if isinstance(value, datetime):
        return value.isoformat(sep=" ")
    text = str(value or "").strip()
    if text:
        return text
    day = index // 24 + 1
    hour = index % 24
    return f"2025-01-{day:02d} {hour:02d}:00:00"


def parse_rows(rows: Iterable[Dict[str, Any]]) -> List[HourInput]:
    parsed: List[HourInput] = []
    for index, row in enumerate(rows):
        timestamp = (
            row.get("timestamp")
            or row.get("date")
            or row.get("datetime")
            or row.get("data")
            or row.get("date_and_hour")
        )
        consumption = (
            row.get("consumption_mwh")
            or row.get("consum_mwh")
            or row.get("consum")
            or row.get("load_mwh")
        )
        pv = (
            row.get("pv_mwh")
            or row.get("productie_pv_mwh")
            or row.get("productie_pv")
            or row.get("pv")
            or 0
        )
        price = (
            row.get("price_lei_mwh")
            or row.get("pret_pzu_lei_mwh")
            or row.get("pret_pzu")
            or row.get("price")
        )
        parsed.append(
            HourInput(
                timestamp=parse_timestamp(timestamp, index),
                consumption_mwh=parse_float(consumption),
                pv_mwh=parse_float(pv),
                price_lei_mwh=parse_float(price),
            )
        )
    return parsed


def validate_rows(rows: Sequence[HourInput]) -> List[str]:
    warnings: List[str] = []
    if not rows:
        return ["Nu exista randuri orare pentru simulare."]
    if len(rows) != 8760:
        warnings.append(f"Sunt {len(rows)} randuri orare, nu 8760.")
    if len(rows) % 24 != 0:
        warnings.append("Numarul de randuri nu este multiplu de 24, deci ultima zi este incompleta.")
    if sum(row.consumption_mwh for row in rows) <= EPS:
        warnings.append("Consum total zero. Rezultatele financiare vor ramane zero.")
    if not any(abs(row.price_lei_mwh) > EPS for row in rows):
        warnings.append("Preturile sunt zero sau lipsesc.")
    if any(row.consumption_mwh < 0 or row.pv_mwh < 0 for row in rows):
        warnings.append("Exista valori negative in consum sau PV.")
    return warnings


def validation_status(ok: bool, warning: bool = False) -> str:
    if ok:
        return "ok"
    return "warn" if warning else "error"


def build_validation(rows: Sequence[HourInput]) -> Dict[str, Any]:
    total_consumption = sum(max(0.0, row.consumption_mwh) for row in rows)
    total_pv = sum(max(0.0, row.pv_mwh) for row in rows)
    price_count = sum(1 for row in rows if abs(row.price_lei_mwh) > EPS)
    negative_count = sum(1 for row in rows if row.consumption_mwh < 0 or row.pv_mwh < 0)
    checks = [
        {
            "key": "hours",
            "label": "Numar ore consolidate",
            "status": validation_status(len(rows) == 8760),
            "value": len(rows),
            "expected": 8760,
        },
        {
            "key": "consumption",
            "label": "Consum client",
            "status": validation_status(total_consumption > EPS),
            "value": total_consumption,
            "expected": "> 0 MWh",
        },
        {
            "key": "pv",
            "label": "Productie PV",
            "status": "ok",
            "value": total_pv,
            "expected": "optional",
        },
        {
            "key": "prices",
            "label": "Preturi PZU",
            "status": validation_status(len(rows) == 8760 and price_count > 0),
            "value": price_count,
            "expected": 8760,
        },
        {
            "key": "negative_values",
            "label": "Valori negative consum/PV",
            "status": validation_status(negative_count == 0),
            "value": negative_count,
            "expected": 0,
        },
    ]
    overall = "ok"
    if any(check["status"] == "error" for check in checks):
        overall = "error"
    elif any(check["status"] == "warn" for check in checks):
        overall = "warn"
    return {"overall": overall, "checks": checks}


def eta_values(round_trip_efficiency: float) -> Tuple[float, float]:
    rt = max(0.0, min(1.0, round_trip_efficiency))
    eta = sqrt(rt) if rt > 0 else 1.0
    return eta, eta


def scenario_configs(params: SimulationParams, max_ac_mw: float) -> List[ScenarioConfig]:
    return [
        ScenarioConfig("2h", duration_h=2, candidate_multiplier=params.smart_candidate_multiplier),
        ScenarioConfig("3h", duration_h=3, candidate_multiplier=params.smart_candidate_multiplier),
        ScenarioConfig("4h", duration_h=4, candidate_multiplier=params.smart_candidate_multiplier),
        ScenarioConfig("6h", duration_h=6, candidate_multiplier=params.smart_candidate_multiplier),
        ScenarioConfig(
            "SuperSmart",
            duration_h=params.smart_duration_h,
            candidate_multiplier=params.smart_candidate_multiplier,
        ),
        ScenarioConfig(
            "Personalizat",
            ac_mw=params.custom_ac_mw,
            storage_mwh=params.custom_storage_mwh,
            candidate_multiplier=1.0,
        ),
        ScenarioConfig("PV_only", ac_mw=0, storage_mwh=0, candidate_multiplier=1.0, pv_only=True),
    ]


def candidate_hours(storage_mwh: float, ac_mw: float, eta_ch: float, eta_dis: float, multiplier: float) -> Tuple[int, int]:
    if storage_mwh <= EPS or ac_mw <= EPS:
        return 0, 0
    charge_base = ceil(storage_mwh / max(EPS, ac_mw * eta_ch))
    discharge_base = ceil((storage_mwh * eta_dis) / max(EPS, ac_mw))
    charge_hours = min(12, max(2, ceil(charge_base * multiplier)))
    discharge_hours = min(12, max(2, ceil(discharge_base * multiplier)))
    return charge_hours, discharge_hours


def date_key(timestamp: str, index: int) -> str:
    text = str(timestamp).strip()
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%d-%m-%Y %H:%M:%S", "%d-%m-%Y %H:%M"):
        try:
            return datetime.strptime(text, fmt).date().isoformat()
        except ValueError:
            pass
    if "T" in text:
        return text.split("T", 1)[0]
    if " " in text and len(text.split(" ", 1)[0]) >= 8:
        return text.split(" ", 1)[0]
    return f"day-{index // 24 + 1:03d}"


def month_key(timestamp: str, index: int) -> str:
    text = str(timestamp).strip()
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%d-%m-%Y %H:%M:%S", "%d-%m-%Y %H:%M"):
        try:
            return datetime.strptime(text, fmt).strftime("%Y-%m")
        except ValueError:
            pass
    if len(text) >= 7 and text[4:5] == "-":
        return text[:7]
    return f"month-{index // 720 + 1:02d}"


def hour_key(timestamp: str, index: int) -> int:
    text = str(timestamp).strip()
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%d-%m-%Y %H:%M:%S", "%d-%m-%Y %H:%M"):
        try:
            return datetime.strptime(text, fmt).hour
        except ValueError:
            pass
    if "T" in text:
        try:
            return datetime.fromisoformat(text.replace("Z", "+00:00")).hour
        except ValueError:
            pass
    if " " in text:
        time_part = text.split(" ", 1)[1]
        try:
            return int(time_part[:2])
        except ValueError:
            pass
    return index % 24


def consumption_profile(rows: Sequence[HourInput]) -> Dict[str, Any]:
    day_consumption = 0.0
    night_consumption = 0.0
    peak_load = 0.0
    peak_timestamp = ""

    for index, row in enumerate(rows):
        consumption = max(0.0, row.consumption_mwh)
        hour = hour_key(row.timestamp, index)
        if DAY_START_HOUR <= hour < DAY_END_HOUR:
            day_consumption += consumption
        else:
            night_consumption += consumption
        if consumption > peak_load:
            peak_load = consumption
            peak_timestamp = row.timestamp

    total = day_consumption + night_consumption
    return {
        "day_consumption_mwh": day_consumption,
        "night_consumption_mwh": night_consumption,
        "day_consumption_pct": (day_consumption / total * 100.0) if total > EPS else 0.0,
        "night_consumption_pct": (night_consumption / total * 100.0) if total > EPS else 0.0,
        "peak_load_mw": peak_load,
        "peak_load_timestamp": peak_timestamp,
    }


def choose_candidates(day_indexes: Sequence[int], rows: Sequence[HourInput], charge_count: int, discharge_count: int) -> Tuple[set[int], set[int]]:
    charge = sorted(day_indexes, key=lambda i: (rows[i].price_lei_mwh, i))[:charge_count]
    charge_set = set(charge)
    discharge = [
        index
        for index in sorted(day_indexes, key=lambda i: (-rows[i].price_lei_mwh, -i))
        if index not in charge_set
    ][:discharge_count]
    return set(charge), set(discharge)


def cheaper_future_charge_capacity(
    index: int,
    day_indexes: Sequence[int],
    rows: Sequence[HourInput],
    candidate_charge: set[int],
    candidate_discharge: set[int],
    ac_mw: float,
) -> float:
    if ac_mw <= EPS:
        return 0.0
    next_discharge = next((item for item in day_indexes if item > index and item in candidate_discharge), None)
    boundary = next_discharge if next_discharge is not None else day_indexes[-1] + 1
    current_price = rows[index].price_lei_mwh
    cheaper_slots = [
        item
        for item in day_indexes
        if index < item < boundary and item in candidate_charge and rows[item].price_lei_mwh < current_price
    ]
    return len(cheaper_slots) * ac_mw


def higher_future_discharge_capacity(
    index: int,
    day_indexes: Sequence[int],
    rows: Sequence[HourInput],
    candidate_charge: set[int],
    candidate_discharge: set[int],
    ac_mw: float,
) -> float:
    if ac_mw <= EPS:
        return 0.0
    next_charge = next((item for item in day_indexes if item > index and item in candidate_charge), None)
    boundary = next_charge if next_charge is not None else day_indexes[-1] + 1
    current_price = rows[index].price_lei_mwh
    higher_slots = [
        item
        for item in day_indexes
        if index < item < boundary and item in candidate_discharge and rows[item].price_lei_mwh > current_price
    ]
    return len(higher_slots) * ac_mw


def simulate_scenario(rows: Sequence[HourInput], params: SimulationParams, config: ScenarioConfig, max_ac_mw: float) -> Dict[str, Any]:
    eta_ch, eta_dis = eta_values(params.round_trip_efficiency)
    requested_ac_mw = config.ac_mw if config.ac_mw is not None else max_ac_mw
    ac_mw = min(max(0.0, requested_ac_mw), max(0.0, max_ac_mw))
    if config.duration_h is not None:
        storage_mwh = ac_mw * config.duration_h
    else:
        storage_mwh = max(0.0, config.storage_mwh or 0.0)
    if config.pv_only:
        ac_mw = 0.0
        storage_mwh = 0.0
    min_soc_mwh = min(storage_mwh, max(0.0, params.min_soc_mwh))

    charge_count, discharge_count = candidate_hours(
        storage_mwh, ac_mw, eta_ch, eta_dis, max(0.0, config.candidate_multiplier)
    )

    indexes_by_day: Dict[str, List[int]] = {}
    for index, row in enumerate(rows):
        indexes_by_day.setdefault(date_key(row.timestamp, index), []).append(index)

    candidate_charge: set[int] = set()
    candidate_discharge: set[int] = set()
    cheaper_charge_capacity: Dict[int, float] = {}
    higher_discharge_capacity: Dict[int, float] = {}
    for indexes in indexes_by_day.values():
        charge, discharge = choose_candidates(indexes, rows, charge_count, discharge_count)
        candidate_charge.update(charge)
        candidate_discharge.update(discharge)
        for index in charge:
            cheaper_charge_capacity[index] = cheaper_future_charge_capacity(index, indexes, rows, charge, discharge, ac_mw)
        for index in discharge:
            higher_discharge_capacity[index] = higher_future_discharge_capacity(index, indexes, rows, charge, discharge, ac_mw)

    hourly: List[Dict[str, Any]] = []
    soc = params.initial_soc_mwh

    for index, row in enumerate(rows):
        consumption = max(0.0, row.consumption_mwh)
        pv = max(0.0, row.pv_mwh)

        net_load = max(0.0, consumption - pv)
        pv_surplus = max(0.0, pv - consumption)
        if params.export_allowed:
            pv_surplus = 0.0

        soc_start = min(storage_mwh, max(min_soc_mwh, soc))
        pv_charge = 0.0
        grid_charge = 0.0
        discharge = 0.0

        if ac_mw > EPS and storage_mwh > EPS:
            pv_charge = min(pv_surplus, ac_mw, max(0.0, (storage_mwh - soc_start) / eta_ch))
            after_pv_soc = soc_start + pv_charge * eta_ch
            if index in candidate_charge and pv_charge < ac_mw:
                available_storage_input = max(0.0, (storage_mwh - after_pv_soc) / eta_ch)
                reserved_for_cheaper_hours = cheaper_charge_capacity.get(index, 0.0)
                grid_charge = min(ac_mw - pv_charge, max(0.0, available_storage_input - reserved_for_cheaper_hours))
            total_charge = pv_charge + grid_charge
            if index in candidate_discharge and total_charge <= EPS:
                available_discharge = max(0.0, (soc_start - min_soc_mwh) * eta_dis)
                reserved_for_higher_hours = higher_discharge_capacity.get(index, 0.0)
                discharge = min(ac_mw, net_load, max(0.0, available_discharge - reserved_for_higher_hours))
            soc = max(min_soc_mwh, min(storage_mwh, soc_start + total_charge * eta_ch - discharge / eta_dis))
        else:
            total_charge = 0.0
            soc = 0.0

        net_purchase = max(0.0, net_load + grid_charge - discharge)
        cost_without = net_load * row.price_lei_mwh
        cost_with = net_purchase * row.price_lei_mwh

        hourly.append(
            {
                "timestamp": row.timestamp,
                "consumption_mwh": consumption,
                "pv_mwh": pv,
                "price_lei_mwh": row.price_lei_mwh,
                "net_load_mwh": net_load,
                "candidate_charge": index in candidate_charge,
                "candidate_discharge": index in candidate_discharge,
                "soc_start_mwh": soc_start,
                "charge_mwh": total_charge,
                "grid_charge_mwh": grid_charge,
                "pv_charge_mwh": pv_charge,
                "discharge_mwh": discharge,
                "soc_final_mwh": soc,
                "net_purchase_mwh": net_purchase,
                "cost_without_bess_lei": cost_without,
                "cost_with_bess_lei": cost_with,
                "saving_lei": cost_without - cost_with,
            }
        )

    return {
        "name": config.name,
        "ac_mw": ac_mw,
        "storage_mwh": storage_mwh,
        "charge_candidate_hours": charge_count,
        "discharge_candidate_hours": discharge_count,
        "hourly": hourly,
        "summary": summarize(hourly),
    }


def weighted_price(cost: float, consumption: float) -> float:
    return cost / consumption if consumption > EPS else 0.0


def summarize(hourly: Sequence[Dict[str, Any]]) -> Dict[str, Any]:
    months: Dict[str, Dict[str, float]] = {}
    for index, item in enumerate(hourly):
        key = month_key(str(item["timestamp"]), index)
        bucket = months.setdefault(
            key,
            {
                "consumption_mwh": 0.0,
                "cost_without_bess_lei": 0.0,
                "cost_with_bess_lei": 0.0,
                "charge_count": 0.0,
                "discharge_count": 0.0,
            },
        )
        bucket["consumption_mwh"] += float(item["consumption_mwh"])
        bucket["cost_without_bess_lei"] += float(item["cost_without_bess_lei"])
        bucket["cost_with_bess_lei"] += float(item["cost_with_bess_lei"])
        if float(item["charge_mwh"]) > EPS:
            bucket["charge_count"] += 1
        if float(item["discharge_mwh"]) > EPS:
            bucket["discharge_count"] += 1

    monthly: List[Dict[str, Any]] = []
    for key in sorted(months):
        bucket = months[key]
        no_bess = weighted_price(bucket["cost_without_bess_lei"], bucket["consumption_mwh"])
        with_bess = weighted_price(bucket["cost_with_bess_lei"], bucket["consumption_mwh"])
        monthly.append(
            {
                "month": key,
                "consumption_mwh": bucket["consumption_mwh"],
                "price_without_bess_lei_mwh": no_bess,
                "price_with_bess_lei_mwh": with_bess,
                "reduction_lei_mwh": no_bess - with_bess,
                "charge_count": int(bucket["charge_count"]),
                "discharge_count": int(bucket["discharge_count"]),
            }
        )

    total_consumption = sum(float(item["consumption_mwh"]) for item in hourly)
    total_without = sum(float(item["cost_without_bess_lei"]) for item in hourly)
    total_with = sum(float(item["cost_with_bess_lei"]) for item in hourly)
    avg_no_bess = sum(row["price_without_bess_lei_mwh"] for row in monthly) / len(monthly) if monthly else 0.0
    avg_with_bess = sum(row["price_with_bess_lei_mwh"] for row in monthly) / len(monthly) if monthly else 0.0
    return {
        "monthly": monthly,
        "annual": {
            "consumption_mwh": total_consumption,
            "cost_without_bess_lei": total_without,
            "cost_with_bess_lei": total_with,
            "weighted_price_without_bess_lei_mwh": weighted_price(total_without, total_consumption),
            "weighted_price_with_bess_lei_mwh": weighted_price(total_with, total_consumption),
            "arithmetic_avg_monthly_without_bess_lei_mwh": avg_no_bess,
            "arithmetic_avg_monthly_with_bess_lei_mwh": avg_with_bess,
            "reduction_lei_mwh": avg_no_bess - avg_with_bess,
            "charge_count": sum(row["charge_count"] for row in monthly),
            "discharge_count": sum(row["discharge_count"] for row in monthly),
        },
    }


def run_simulation(rows: Sequence[HourInput], params: SimulationParams, selected: Optional[Sequence[str]] = None) -> Dict[str, Any]:
    warnings = validate_rows(rows)
    profile = consumption_profile(rows)
    peak_load = profile["peak_load_mw"]
    headroom = max(0.0, params.atr_mw - peak_load)
    max_ac_mw = headroom * ATR_HEADROOM_FACTOR
    if sum(row.consumption_mwh for row in rows) > EPS:
        if params.atr_mw <= EPS:
            warnings.append("ATR nu este completat, deci puterea AC disponibila pentru baterie este 0 MW.")
        elif headroom <= EPS:
            warnings.append("ATR este mai mic sau egal cu varful de consum, deci puterea AC disponibila pentru baterie este 0 MW.")
    selected_set = set(selected or ["2h", "3h", "4h", "6h", "PV_only"])

    scenarios = []
    for config in scenario_configs(params, max_ac_mw):
        if config.name in selected_set:
            scenarios.append(simulate_scenario(rows, params, config, max_ac_mw))

    best = None
    if scenarios:
        best = min(
            scenarios,
            key=lambda s: s["summary"]["annual"]["arithmetic_avg_monthly_with_bess_lei_mwh"],
        )["name"]

    return {
        "warnings": warnings,
        "validation": build_validation(rows),
        "inputs": {
            "hours": len(rows),
            "total_consumption_mwh": sum(row.consumption_mwh for row in rows),
            "total_pv_mwh": sum(row.pv_mwh for row in rows),
            "peak_load_mw": peak_load,
            "peak_load_timestamp": profile["peak_load_timestamp"],
            "day_consumption_mwh": profile["day_consumption_mwh"],
            "night_consumption_mwh": profile["night_consumption_mwh"],
            "day_consumption_pct": profile["day_consumption_pct"],
            "night_consumption_pct": profile["night_consumption_pct"],
            "atr_mw": params.atr_mw,
            "headroom_mw": headroom,
            "atr_headroom_factor": ATR_HEADROOM_FACTOR,
            "max_ac_mw": max_ac_mw,
        },
        "best_scenario_by_monthly_average": best,
        "scenarios": scenarios,
    }


def params_from_dict(data: Dict[str, Any]) -> SimulationParams:
    return SimulationParams(
        atr_mw=parse_float(data.get("atr_mw")),
        round_trip_efficiency=parse_float(data.get("round_trip_efficiency"), 0.90),
        initial_soc_mwh=parse_float(data.get("initial_soc_mwh")),
        min_soc_mwh=parse_float(data.get("min_soc_mwh")),
        export_allowed=bool(data.get("export_allowed", False)),
        distribution_tariff_lei_mwh=parse_float(data.get("distribution_tariff_lei_mwh")),
        smart_duration_h=parse_float(data.get("smart_duration_h"), 4.0),
        smart_candidate_multiplier=parse_float(data.get("smart_candidate_multiplier"), 2.0),
        custom_ac_mw=parse_float(data.get("custom_ac_mw")),
        custom_storage_mwh=parse_float(data.get("custom_storage_mwh")),
    )
