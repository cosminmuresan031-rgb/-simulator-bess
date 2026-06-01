# Deploy pe Koyeb

## Varianta recomandata pentru prima faza

Pentru test online fara abonamente, folosim Koyeb ca `Web Service` construit din
Dockerfile. Aplicatia ramane un MVP de test: loginul este demo, iar proiectele
se pastreaza in browserul utilizatorului.

## Setari Koyeb

- Deployment method: `GitHub`
- Builder: `Dockerfile`
- Dockerfile path: `Dockerfile`
- Instance type: `Free`
- Region: `Frankfurt` daca este disponibila
- Service type: `Web Service`
- Port: `8000`

Aplicatia citeste portul din variabila `PORT`, iar Dockerfile-ul de la radacina
expune `8000`, ca sa fie simplu de detectat de Koyeb.

## Pasi

1. Pune proiectul intr-un repository GitHub.
2. In Koyeb, alege `Create Web Service`.
3. Conecteaza GitHub si selecteaza repository-ul.
4. Alege builder `Dockerfile`.
5. Confirma Dockerfile path `Dockerfile`.
6. Alege planul `Free`.
7. Creeaza serviciul si asteapta buildul.
8. Deschide domeniul de forma `https://...koyeb.app`.

## Teste dupa deploy

- intra in aplicatie si creeaza un user demo;
- introdu curbe consum/PV;
- verifica `Curbe consolidate`;
- seteaza ATR;
- ruleaza simularea;
- schimba scenariul in `Preturi medii lunare`;
- ruleaza sinteza financiara;
- descarca raportul complet.

## Limitari in faza fara abonamente

- Nu exista plati sau abonamente.
- Nu exista baza de date server-side.
- Proiectele salvate raman in browser, prin `localStorage`.
- Linkul poate fi folosit pentru demo si test, dar nu pentru date sensibile.
