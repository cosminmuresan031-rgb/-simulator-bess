from bess_engine import SimulationParams, HourInput, run_simulation


def sample_rows():
    rows = []
    for day in range(2):
        for hour in range(24):
            price = 100 + hour * 20
            rows.append(
                HourInput(
                    timestamp=f"2025-01-{day + 1:02d} {hour:02d}:00:00",
                    consumption_mwh=1.0,
                    pv_mwh=0.0,
                    price_lei_mwh=price,
                )
            )
    return rows


def test_engine_runs_standard_scenarios():
    params = SimulationParams(atr_mw=3.0, round_trip_efficiency=0.9)
    result = run_simulation(sample_rows(), params, ["2h", "PV_only"])

    assert result["inputs"]["hours"] == 48
    assert result["inputs"]["max_ac_mw"] > 0
    assert [scenario["name"] for scenario in result["scenarios"]] == ["2h", "PV_only"]

    bess = result["scenarios"][0]["summary"]["annual"]
    pv_only = result["scenarios"][1]["summary"]["annual"]
    assert bess["charge_count"] > 0
    assert bess["discharge_count"] > 0
    assert pv_only["charge_count"] == 0
    assert pv_only["discharge_count"] == 0
