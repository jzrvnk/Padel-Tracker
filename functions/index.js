const admin = require('firebase-admin');
const { onValueWritten } = require('firebase-functions/v2/database');
const { logger } = require('firebase-functions');

admin.initializeApp({
  databaseURL: 'https://padel-club-vrijdag-btpc-default-rtdb.europe-west1.firebasedatabase.app'
});

const databaseInstance = 'padel-club-vrijdag-btpc-default-rtdb';

async function notifySubscribers(title, body) {
  const snapshot = await admin.database().ref('padel-push-subscriptions').once('value');
  const subscriptions = snapshot.val() || {};
  const entries = Object.entries(subscriptions)
    .map(([id, value]) => ({ id, token: typeof value === 'string' ? value : value?.token }))
    .filter(entry => typeof entry.token === 'string' && entry.token.length > 0);

  for (let start = 0; start < entries.length; start += 500) {
    const batch = entries.slice(start, start + 500);
    const result = await admin.messaging().sendEachForMulticast({
      tokens: batch.map(entry => entry.token),
      data: {
        title,
        body,
        url: './index.html'
      },
      webpush: { headers: { TTL: '3600' } }
    });

    const staleIds = [];
    result.responses.forEach((response, index) => {
      const code = response.error?.code;
      if (code === 'messaging/registration-token-not-registered'
          || code === 'messaging/invalid-registration-token') {
        staleIds.push(batch[index].id);
      } else if (!response.success) {
        logger.warn('Pushmelding kon niet worden verstuurd', { code, subscriptionId: batch[index].id });
      }
    });

    await Promise.all(staleIds.map(id =>
      admin.database().ref(`padel-push-subscriptions/${id}`).remove()
    ));
  }
}

function changed(event) {
  return JSON.stringify(event.data.before.val()) !== JSON.stringify(event.data.after.val());
}

async function wasChangedByAdmin(event) {
  // Ignore anonymous database writes, even though public schedule reads remain open.
  if (event.authType !== 'app_user' || !event.authId) return false;

  try {
    const [user, dataSnapshot] = await Promise.all([
      admin.auth().getUser(event.authId),
      admin.database().ref('padel-data').once('value')
    ]);
    const data = dataSnapshot.val() || {};
    const admins = Array.isArray(data.admins) ? data.admins : Object.values(data.admins || {});
    const emailMap = data.userEmailMap || {};
    const userEmail = String(user.email || '').toLowerCase();
    return admins.some(username =>
      String(emailMap[username] || '').toLowerCase() === userEmail
    );
  } catch (error) {
    logger.warn('Pushmelding overgeslagen: admin kon niet worden bevestigd.', error);
    return false;
  }
}

exports.notifyOnReservationsChanged = onValueWritten({
  ref: '/padel-data/reservations/{date}',
  instance: databaseInstance,
  region: 'europe-west1'
}, async event => {
  if (!changed(event) || !(await wasChangedByAdmin(event))) return;
  const date = event.params.date;
  await notifySubscribers('Padelplanning aangepast', `De planning voor ${date} is gewijzigd.`);
});

exports.notifyOnBlockedDateChanged = onValueWritten({
  ref: '/padel-data/blockedDates/{date}',
  instance: databaseInstance,
  region: 'europe-west1'
}, async event => {
  if (!changed(event) || !(await wasChangedByAdmin(event))) return;
  const date = event.params.date;
  await notifySubscribers('Padelplanning aangepast', `De speeldag ${date} is gewijzigd.`);
});
