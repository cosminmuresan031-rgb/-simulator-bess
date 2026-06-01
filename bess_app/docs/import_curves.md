# Regula de import curbe consum si PV

Aplicatia foloseste intern o singura curba orara consolidata, cu 8760 randuri.
Aceeasi regula se aplica pentru consumul clientului si pentru productia PV.

## Introducere in interfata

In interfata pastram si forma lunara din Excel:

- utilizatorul alege luna explicit, de exemplu `Ianuarie 2025`;
- alege tipul curbei: `Consum client` sau `Productie PV`;
- tabelul are intervalele orare pe randuri si zilele lunii pe coloane;
- datele introduse in acest tabel sunt convertite automat in curba orara consolidata.

Aceasta forma este pastrata pentru claritate la introducere. Intern, aplicatia
lucreaza tot cu formatul consolidat de 8760 ore.

## Format recomandat pentru aplicatia online/API

Formatul standard va fi un tabel lung, CSV sau Excel:

| timestamp | consumption_mwh | pv_mwh | price_lei_mwh |
| --- | ---: | ---: | ---: |
| 2025-01-01 00:00:00 | 0.444 | 0 | 585.96 |
| 2025-01-01 01:00:00 | 0.448 | 0 | 690.22 |

Reguli:

- `timestamp` este obligatoriu.
- `consumption_mwh` este obligatoriu pentru simulare.
- `pv_mwh` este optional; daca lipseste, se considera `0`.
- `price_lei_mwh` este obligatoriu pentru calculul economic.
- valorile sunt in MWh pe ora, nu kWh.
- trebuie sa existe 8760 randuri pentru un an normal.
- randurile se ordoneaza crescator dupa `timestamp`.
- valorile negative nu sunt acceptate pentru consum sau PV.

Acesta este formatul pe care il vom folosi pentru online, API si baza de date.

## Preturi PZU pe ani

Aplicatia include preturile PZU realizate pentru 2025 in:

```text
static/data/pzu_2025.csv
```

Cand selectorul `An preturi PZU` este pe `2025`, acest fisier este incarcat
automat daca nu este ales manual un CSV de preturi.

Pentru 2026 se pastreaza exact aceeasi structura:

| timestamp | month | zn | price_lei_mwh |
| --- | --- | --- | ---: |
| 2026-01-01 00:00:00 | January | N | 0 |
| 2026-01-01 01:00:00 | January | N | 0 |

Reguli pentru import PZU 2026:

- fisierul trebuie incarcat in controlul `Preturi CSV`;
- anul selectat in interfata trebuie sa fie `2026`;
- coloana obligatorie pentru calcul este `price_lei_mwh`;
- `timestamp`, `month` si `zn` sunt pastrate pentru audit si compatibilitate;
- anul din `timestamp` trebuie sa fie acelasi cu anul selectat in interfata;
- pentru un an normal trebuie sa existe 8760 randuri;
- daca nu este incarcat CSV pentru 2026, aplicatia marcheaza preturile ca lipsa.

## Compatibilitate cu Excelul master

Fisierul master foloseste foi lunare separate:

- consum client: `01_Ianuarie` ... `12_Decembrie`
- productie PV: `PV_01_Ianuarie` ... `PV_12_Decembrie`

In aceste foi:

- randul `2` contine zilele lunii, incepand cu coloana `C`;
- randurile `3:26` contin intervalele orare `00-01` ... `23-24`;
- valorile sunt introduse in matricea `C3:AG26`, in functie de numarul de zile al lunii;
- coloana `A` este indexul orei, iar coloana `B` este intervalul orar.

Exemplu:

| Interval | Zi 1 | Zi 2 | ... |
| --- | ---: | ---: | ---: |
| 00-01 | consum/PV ora 00 | consum/PV ora 00 | ... |
| 01-02 | consum/PV ora 01 | consum/PV ora 01 | ... |

## Consolidare

Pentru consum:

1. Se citesc foile `01_Ianuarie` ... `12_Decembrie`.
2. Pentru fiecare luna, se parcurg zilele calendaristice.
3. Pentru fiecare zi, se parcurg cele 24 intervale orare.
4. Rezultatul se scrie in curba interna:
   - `timestamp`
   - `month`
   - `day`
   - `interval`
   - `consumption_mwh`

Echivalentul Excel este `Curbe_Orare_Consolidate`.

Pentru PV:

1. Se citesc foile `PV_01_Ianuarie` ... `PV_12_Decembrie`.
2. Se aplica aceeasi mapare luna/zi/ora.
3. Celulele goale se trateaza ca `0`.
4. Rezultatul se scrie in curba interna:
   - `timestamp`
   - `month`
   - `day`
   - `interval`
   - `pv_mwh`

Echivalentul Excel este `Productie_PV_Consolidata`.

## Reguli de validare

La import, aplicatia trebuie sa verifice:

- consumul are 8760 randuri;
- preturile au 8760 randuri;
- PV are 8760 randuri sau lipseste complet;
- timestamp-urile consum/PV/pret sunt aliniate;
- nu exista valori negative la consum sau PV;
- nu exista ore lipsa sau duplicate;
- total consum anual > 0 pentru simulari reale;
- PV lipsa inseamna PV = 0, nu eroare.

Verificarile implementate in interfata urmeaza foile Excel
`Control_Completare_Consum` si `Control_Completare_PV`:

- pentru fiecare luna se asteapta `numar zile * 24` valori;
- o zi este completa numai daca are toate cele 24 valori;
- o luna este `OK` numai daca toate zilele sunt complete;
- pentru consum, luna incompleta este eroare;
- pentru PV, luna goala este acceptata ca optionala, dar daca este completata partial apare atentionare;
- valorile negative la consum sau PV sunt marcate ca eroare;
- dupa consolidare, aplicatia verifica 8760 ore, consum total si preturi PZU incarcate.

## Regula pentru export Excel

Cand generam un Excel compatibil cu modelul master:

- consumul consolidat se poate scrie in `Curbe_Orare_Consolidate!E4:E8763`;
- PV-ul consolidat se poate scrie in `Productie_PV_Consolidata!E4:E8763`;
- daca vrem sa pastram forma vizuala a masterului, putem completa si foile lunare `01_Ianuarie` ... `12_Decembrie` si `PV_01_Ianuarie` ... `PV_12_Decembrie`.

Pentru aplicatia online, sursa de adevar ramane tabela lunga interna, nu layout-ul Excel.
