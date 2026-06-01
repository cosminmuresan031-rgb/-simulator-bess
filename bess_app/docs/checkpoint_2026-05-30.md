# Checkpoint 2026-05-30

## Stare curenta

- Aplicatia ruleaza local la `http://127.0.0.1:8765/`.
- Fluxul principal este introducerea lunara a curbelor pentru consum client si productie PV.
- Importurile CSV pentru consum si PV sunt ascunse si nu mai influenteaza simularea.
- Preturile PZU 2025 sunt incluse in aplicatie si se incarca automat din `static/data/pzu_2025.csv`.
- Pentru 2026 exista selector de an si posibilitate de import CSV in aceeasi structura.
- Campul `Preturi CSV` este ascuns pentru 2025 si apare doar cand se selecteaza 2026.
- Scenariile vizibile sunt cele standard: `2h`, `3h`, `4h`, `6h`, `PV_only`.
- `SuperSmart` si `Personalizat` sunt ascunse.
- In rezultate, incarcarile si descarcarile sunt ascunse din tabel.
- Exista meniu `Proiecte` in panoul din stanga.
- Proiectele se salveaza local in browser prin `localStorage`.
- Fiecare proiect are nume editabil si istoric de simulari.
- La rularea unei simulari, rezultatul este adaugat automat in istoricul proiectului activ.
- Fiecare simulare salveaza snapshotul dashboardului: metrici, rezultate anuale, tabel lunar si date diagrama.
- Snapshotul este pastrat si ca `financialSummarySource` pentru sinteza financiara viitoare.
- Exista panou `Sinteza financiara` cu rulare manuala pe scenariul selectat.
- Sinteza financiara rulata este salvata in simularea activa la cheia `financialSummary`.
- Designul sintezei urmeaza modelul `Hotel_Alpin_sinteza financiara 1,07 MWh.xlsx`: indicatori, interpretari, tabel lunar si sinteza anuala.
- Ipotezele editabile pentru sinteza sunt client, pret contractual 2025, curs EUR si valoare investitie euro.
- Exportul Excel al sintezei este integrat prin `POST /api/export-financial-summary`.
- Template-ul fix pentru export este `bess_app/templates/financial_summary_template.xlsx`.
- Interfata foloseste fundalul optimizat `static/assets/energy-bess-background-2400.jpg`.
- Designul UI este adaptat la imagine: carduri translucide, accente verde/bleumarin si contrast ridicat.
- Exista ecran demo de logare/creare cont cu email si parola.
- Proiectele locale sunt separate pe emailul utilizatorului.

## Decizii pastrate

- Nu se modifica structura scenariilor in aceasta etapa.
- Curbele introduse lunar sunt consolidate intern in randuri orare.
- Verificarile urmaresc completarea lunara, totalurile si existenta preturilor PZU.
- Pentru 2025, preturile realizate sunt sursa implicita.
- Pentru 2026, fisierul importat trebuie sa aiba anul corect in `timestamp`.
- Istoricul este local pentru MVP; pentru varianta online aceeasi structura se poate muta in baza de date.
- Loginul curent este demo frontend, nu autentificare de productie.
- Sinteza financiara trebuie generata din snapshotul simularii salvate, nu din datele modificate ulterior in interfata.
- Daca scenariul selectat se schimba, sinteza financiara trebuie rulata din nou pentru noul scenariu.

## Fisiere importante

- `bess_app/static/index.html` - interfata.
- `bess_app/static/app.js` - logica browser, consolidare si validari.
- `bess_app/static/styles.css` - design.
- `bess_app/bess_engine.py` - motorul de simulare.
- `bess_app/static/data/pzu_2025.csv` - preturi PZU 2025 realizate.
- `bess_app/docs/import_curves.md` - regula de import/consolidare.

## De continuat

- Stabilirea formei finale pentru salvarea proiectelor/simularilor.
- Export rezultate in Excel sau PDF.
- Pregatirea variantei online cu autentificare si baza de date.
- Rafinat validari pentru import PZU 2026 cand avem fisierul real.
- Maparea structurii financiare dupa ce este incarcata de utilizator.
