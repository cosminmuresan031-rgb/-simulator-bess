# Plan test online

## Scop

Testarea online trebuie facuta intai pe un mediu `staging`, cu acces limitat.
Varianta curenta este potrivita pentru validarea interfetei, importurilor,
simularilor si exporturilor, dar autentificarea este inca demo pe frontend.

## Pasi recomandati

1. Ruleaza testele locale si verifica exporturile Excel.
2. Construiește imaginea Docker.
3. Urca imaginea pe un serviciu care ruleaza containere Docker.
4. Configureaza variabilele de mediu:
   - `HOST=0.0.0.0`
   - `PORT` conform platformei, sau `8765` daca platforma permite.
5. Protejeaza linkul de staging cu parola sau acces doar pentru testeri.
6. Testeaza cu un proiect demo:
   - import curbe consum/PV;
   - verificari curbe consolidate;
   - ATR si dimensionare AC;
   - selectare scenarii;
   - preturi medii lunare;
   - sinteza financiara;
   - export raport complet.
7. Dupa validare, muta autentificarea, proiectele si istoricul din `localStorage`
   intr-un backend cu baza de date.

## Comenzi locale utile

```powershell
docker build -t simulator-bess ./bess_app
docker run --rm -p 8765:8765 simulator-bess
```

Aplicatia va fi disponibila local la:

```text
http://127.0.0.1:8765
```

## Atentie inainte de productie

- Loginul curent nu este autentificare reala de productie.
- Proiectele se salveaza in browser, nu intr-o baza de date.
- Linkul de staging nu trebuie folosit cu date sensibile pana nu avem backend
  de useri si storage securizat.
