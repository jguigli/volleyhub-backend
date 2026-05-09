type PushText = { title: string; body: string };

const translations: Record<string, Record<string, (...args: string[]) => PushText>> = {
  fr: {
    player_joined: (username, current, max) => ({
      title: 'Nouveau joueur !',
      body: `${username} a rejoint ton match (${current}/${max})`,
    }),
    match_almost_full: (spots) => ({
      title: 'Match presque complet !',
      body: `Plus que ${spots} place${spots === '1' ? '' : 's'} !`,
    }),
    event_invite: (inviter) => ({
      title: 'Invitation',
      body: `${inviter} t'a invité à rejoindre un événement.`,
    }),
    match_renewed_invite: (creator) => ({
      title: 'Nouveau match créé',
      body: `${creator} a recréé cet événement.`,
    }),
    event_settings_changed: (organizer) => ({
      title: 'Événement modifié',
      body: `${organizer} a modifié les paramètres de l'événement.`,
    }),
    event_started_early: (organizer) => ({
      title: 'Événement lancé !',
      body: `${organizer} a lancé l'événement en avance. C'est parti !`,
    }),
    event_deleted: (organizer) => ({
      title: 'Événement annulé',
      body: `${organizer} a supprimé l'événement.`,
    }),
    player_removed: (organizer) => ({
      title: 'Retiré de l\'événement',
      body: `${organizer} t'a retiré de l'événement.`,
    }),
    event_full: () => ({
      title: 'Événement complet !',
      body: 'Toutes les places sont prises.',
    }),
    event_completed: () => ({
      title: 'Événement terminé !',
      body: 'Consulte les résultats.',
    }),
    opponent_score_locked: () => ({
      title: 'Score adversaire validé',
      body: 'L\'équipe adverse a confirmé son score. À ton tour !',
    }),
    score_overridden: (organizer) => ({
      title: 'Score ajusté',
      body: `${organizer} a ajusté le score.`,
    }),
    connection_accepted: (accepter) => ({
      title: 'Connexion acceptée !',
      body: `${accepter} a accepté ta demande de connexion.`,
    }),
    player_left_event: (username) => ({
      title: 'Joueur parti',
      body: `${username} a quitté ton événement.`,
    }),
    event_reminder_30min: () => ({
      title: 'Prêt à jouer ?',
      body: 'Ton événement commence dans 30 minutes.',
    }),
    chat_message: (username) => ({
      title: 'Nouveau message',
      body: `${username} a envoyé un message dans le chat.`,
    }),
  },

  en: {
    player_joined: (username, current, max) => ({
      title: 'Someone joined your game!',
      body: `${username} joined your match (${current}/${max})`,
    }),
    match_almost_full: (spots) => ({
      title: 'Match almost full!',
      body: `Only ${spots} spot${spots === '1' ? '' : 's'} left!`,
    }),
    event_invite: (inviter) => ({
      title: 'Event invitation',
      body: `${inviter} invited you to join an event.`,
    }),
    match_renewed_invite: (creator) => ({
      title: "You're in the new match",
      body: `${creator} recreated this event.`,
    }),
    event_settings_changed: (organizer) => ({
      title: 'Event updated',
      body: `${organizer} updated the event settings.`,
    }),
    event_started_early: (organizer) => ({
      title: 'Event started!',
      body: `${organizer} started the event early. Go!`,
    }),
    event_deleted: (organizer) => ({
      title: 'Event cancelled',
      body: `${organizer} deleted the event.`,
    }),
    player_removed: (organizer) => ({
      title: 'Removed from event',
      body: `${organizer} removed you from the event.`,
    }),
    event_full: () => ({
      title: 'Event is full!',
      body: 'All spots are taken.',
    }),
    event_completed: () => ({
      title: 'Event finished!',
      body: 'Check the results.',
    }),
    opponent_score_locked: () => ({
      title: 'Opponent locked their score',
      body: 'The other team confirmed their score. Your turn!',
    }),
    score_overridden: (organizer) => ({
      title: 'Score adjusted',
      body: `${organizer} adjusted the score.`,
    }),
    connection_accepted: (accepter) => ({
      title: 'Connection accepted!',
      body: `${accepter} accepted your connection request.`,
    }),
    player_left_event: (username) => ({
      title: 'Player left',
      body: `${username} left your event.`,
    }),
    event_reminder_30min: () => ({
      title: 'Ready to play?',
      body: 'Your event starts in 30 minutes.',
    }),
    chat_message: (username) => ({
      title: 'New message',
      body: `${username} sent a message in the group chat.`,
    }),
  },
};

export function getPushText(
  locale: string,
  key: string,
  ...args: string[]
): PushText {
  const lang = translations[locale] ? locale : 'fr';
  const fn = translations[lang][key];
  if (!fn) return { title: 'VolleyHub', body: '' };
  return fn(...args);
}
