# Sinteza financiara automata

## Punct de plecare

Dupa fiecare simulare, aplicatia salveaza in istoricul proiectului un snapshot
de dashboard. Acesta este sursa stabila pentru sinteza financiara:

- scenariul selectat;
- indicatorii de sus din dashboard;
- rezultatele anuale fara BESS / cu BESS / reducere;
- preturile medii ponderate lunare;
- datele folosite in diagrama.

Snapshotul este salvat in obiectul simularii la cheile:

- `dashboard`
- `financialSummarySource`

## Rulare in aplicatie

Utilizatorul alege scenariul dorit din dashboard si apoi apasa
`Ruleaza sinteza` in panoul `Sinteza financiara`.

Aplicatia genereaza o sinteza MVP legata de scenariul selectat:

- scenariu;
- consum anual;
- cost anual fara BESS;
- cost anual cu BESS;
- economie anuala;
- pret mediu lunar cu BESS.
- tabel lunar dupa structura din modelul Excel incarcat;
- sinteza anuala cu impact indicativ lei/an, euro/an si payback;
- interpretari automate pe baza diferentei fata de pretul contractual.

Ipotezele editabile din aplicatie sunt:

- client;
- pret contractual furnizare 2025;
- curs EUR;
- valoare investitie euro.

Sinteza rulata este salvata in simularea activa la cheia:

- `financialSummary`

Exportul Excel foloseste template-ul:

- `templates/financial_summary_template.xlsx`

Endpointul backend este:

- `POST /api/export-financial-summary`

Frontendul trimite obiectul `financialSummary`, iar serverul completeaza foaia
`Sinteza` fara sa reconstruiasca designul. Sunt completate si zonele auxiliare
din dreapta folosite de grafic.

Daca utilizatorul schimba scenariul dupa rularea sintezei, sinteza veche este
marcata ca nevalabila si trebuie rulata din nou pentru noul scenariu.

## Cand primim structura sintezei

Urmatorul pas este sa mapam campurile din `financialSummarySource` pe formatul
financiar dorit:

- venituri sau economii estimate;
- CAPEX;
- OPEX;
- durata proiect;
- rata de actualizare;
- cash-flow anual;
- indicatori precum payback, NPV, IRR, daca sunt ceruti.

## Regula importanta

Sinteza financiara trebuie generata din snapshotul simularii salvate, nu din
date recalculabile din interfata. Astfel, daca utilizatorul modifica ulterior
curbele, vechea simulare ramane auditabila si sinteza financiara ramane legata
de exact rezultatul rulat atunci.
