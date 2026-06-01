# Simulator BESS Web MVP

Aceasta este prima versiune a aplicatiei, pornita din modelul Excel
`Simulator_BESS_final.xlsm`.

## Structura

- `bess_engine.py` - motorul de simulare, fara dependenta de Excel.
- `server.py` - API local si server static, bazat pe Python standard library.
- `static/` - interfata web.
- `tests/` - smoke tests pentru motor.
- `Dockerfile` - baza pentru rulare online.

## Rulare locala

```powershell
& "C:\Users\Andreea Moldovan\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" .\bess_app\server.py
```

Aplicatia porneste pe:

```text
http://127.0.0.1:8765
```

## CSV asteptat

Aplicatia accepta fisiere CSV separate pentru consum, PV si preturi.
Header-ele pot fi:

- consum: `timestamp,consumption_mwh`
- PV: `timestamp,pv_mwh`
- preturi: `timestamp,price_lei_mwh`

Preturile PZU realizate pentru 2025 sunt incluse in aplicatie si se incarca
automat cand selectorul de an este pe `2025`. Pentru `2026`, se incarca un CSV
cu aceeasi structura in controlul `Preturi CSV`.

Regula completa de import si maparea spre curbele consolidate este in
[`docs/import_curves.md`](docs/import_curves.md).

Autentificarea din MVP este un flux demo pe frontend, util pentru testarea
interfetei. Planul pentru login real si abonamente este in
[`docs/auth_subscription_plan.md`](docs/auth_subscription_plan.md).

Planul pentru legarea dashboardului de sinteza financiara este in
[`docs/financial_summary_plan.md`](docs/financial_summary_plan.md).

Pentru versiunea online, motorul ramane acelasi, iar `server.py` poate fi inlocuit
cu FastAPI sau alt backend web fara sa rescriem calculele.
