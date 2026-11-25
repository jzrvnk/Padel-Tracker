# Pushmeldingen instellen

De openbare planning heeft nu een knop waarmee spelers pushmeldingen op hun toestel kunnen aan- en uitzetten. Een melding wordt verstuurd naar ingeschreven toestellen wanneer een Firebase-authenticated beheerder reserveringen of een geblokkeerde speeldag wijzigt.

## Eenmalige Firebase-configuratie

1. Open Firebase Console voor project `padel-club-vrijdag-btpc` en ga naar **Projectinstellingen → Cloud Messaging → Web Push-certificaten**. Genereer of kopieer de openbare VAPID-sleutel.
2. Vervang in `index.html` de tekst `VUL_HIER_DE_WEB_PUSH_CERTIFICATE_KEY_IN` door die openbare sleutel.
3. Controleer in **Realtime Database → Regels** dat de database de regels uit `database.rules.json` gebruikt. De planning blijft openbaar leesbaar; pushregistraties zijn niet leesbaar voor browsers en kunnen wel door een toestel worden toegevoegd of verwijderd.
4. Cloud Functions vereisen dat het Firebase-project het Blaze-abonnement met een gekoppelde Cloud Billing-account gebruikt. Controleer de facturatie-instellingen voordat je deployt.
5. Installeer de Firebase CLI indien nodig, meld aan met `firebase login` en voer vanuit deze map uit:

   ```powershell
   npm install --prefix functions
   firebase deploy --only database,functions
   ```

6. Publiceer `index.html` en `sw.js` op dezelfde HTTPS-hosting als de rest van de app. Spelers openen die site, tikken op **Meldingen inschakelen** en staan meldingen toe in hun browser.

De functie stuurt alleen berichten na wijzigingen die Firebase als een ingelogde gebruiker identificeert én waarvan het e-mailadres voorkomt bij een beheerder in `userEmailMap`. Anonieme databasewijzigingen sturen geen pushmeldingen.
