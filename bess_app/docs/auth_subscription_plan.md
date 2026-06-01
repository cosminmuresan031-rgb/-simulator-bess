# Autentificare si abonamente

## Stare MVP locala

Aplicatia are o interfata de logare/creare cont cu email si parola.
In aceasta etapa este un flux demo pe frontend:

- parola nu se salveaza local;
- sesiunea utilizatorului se pastreaza in `localStorage`;
- proiectele sunt separate pe email;
- planul afisat este `Demo`;
- nu exista inca validare reala pe server.

Aceasta varianta este utila pentru testarea fluxului de produs, dar nu este
suficienta pentru productie.

## Varianta online recomandata

Pentru abonamente si utilizatori reali, autentificarea trebuie mutata in backend:

- tabela `users`: email, parola hashuita sau provider extern, status cont;
- tabela `subscriptions`: plan, status plata, data expirare, id furnizor plata;
- tabela `projects`: proiectele salvate ale fiecarui user;
- tabela `simulations`: istoricul simularilor pe proiect;
- API securizat cu sesiune sau token JWT;
- parole hash-uite cu Argon2 sau bcrypt, niciodata salvate in clar;
- resetare parola pe email;
- verificare email;
- roluri/permisiuni pentru admin si client.

## Plati

Pentru abonamente se poate integra Stripe sau un procesator local compatibil.
Fluxul recomandat:

1. Utilizatorul creeaza cont.
2. Alege planul.
3. Plata este procesata de furnizor.
4. Backendul primeste webhook de confirmare.
5. Aplicatia activeaza planul utilizatorului.
6. La fiecare rulare sau acces, backendul verifica statusul abonamentului.

## De inlocuit cand trecem online

In `static/app.js`, functiile demo care trebuie inlocuite cu API real sunt:

- `handleAuthSubmit`
- `persistAuthSession`
- `loadAuthSession`
- `persistProjects`
- `loadProjects`

Interfata poate ramane aproape identica; schimbarea principala va fi mutarea
datelor din `localStorage` in baza de date.
