TODO


frontend :
✅ Map -> Page Pin dans Create Match -> le pin doit etre directement sur ma localisation
✅ faire un inventaire des composants existants -> automatiser config tailwind (couleur etc) -> theme/color.ts
✅ faire config pour changer la langue settings
❌
❌
❌
❌
❌
❌

backend :
❌ faire un seed pour peupler qques matchs
❌ fecth data sur les gymnase / terrains de volley existants en France (ou monde)
❌
❌
❌
❌
❌
❌


Nom appli :

RallyUp → dynamique et volley-native
NetMates → social + volley subtil
VolleyHub → parfait pour une plateforme


==============================================



Ajoute explication de poste + explication level 0-2 ans, 3-6 ans, 7+ ans




L'utilisateur peut creer que 1 match/tournois toutes les 24h, il peut creer/supprimer uniquement 3 matchs toutes les 24h. pour eviter les abus.


======> revoir le fonctionnement de l'algo tournois


A faire avec claude :

--------------------------------------- check utilisation redis :
C'est fait. Voici le résumé des améliorations Redis :

Nouveau dans RedisService :

getJson<T>() / setJson() — sérialisation/désérialisation automatique
delPattern() — suppression par pattern (remplace keys() + del())
Cache profil utilisateur (5 min TTL) :

Clé : user:profile:{userId}
Cache les 3 queries DB (user + followers count + following count)
Invalidé sur : update profil, follow, unfollow
Cache stats utilisateur (1h TTL) :

Clé : user:{userId}:stats:{format}
Cache les 2 queries DB complexes (compteurs + historique victoires)
Invalidé sur : join match, leave match, delete match
Invalidation centralisée :

invalidateMatchCaches() — nettoie count + nearby + stats participants
invalidateUserStats() — nettoie toutes les variantes de stats d'un user
Nettoyé :

Feature courts à proximité supprimée (backend endpoint, service, DTO, API mobile, hook)


--------------------------------------- check faille de secu

Corrections appliquées
CRITIQUES
1. JWT secret — Supprimé le fallback 'fallback_secret' dans app.config.ts et jwt.strategy.ts. L'app crash au démarrage si JWT_SECRET n'est pas défini dans l'environnement.

2. CORS — Remplacé origin: '*' par une liste configurable via ALLOWED_ORIGINS (env var). Appliqué sur l'API REST (main.ts) ET les WebSockets (matches.gateway.ts).

3. DB credentials — Supprimé le fallback postgresql://volley:volley_secret@.... L'app crash si DATABASE_URL n'est pas défini.

HAUTS
4. Rate limiting — Installé @nestjs/throttler. Limites :

Global : 100 req/min par IP
Login : 10 tentatives/min
Register : 5/heure
Refresh : 30/min
5. Refresh tokens — Implémenté le mécanisme complet :

Access token : 1h (au lieu de 7j)
Refresh token : 7j, avec claim type: 'refresh'
Endpoint POST /auth/refresh
La JWT strategy rejette les refresh tokens utilisés comme access tokens
Le client mobile auto-refresh sur 401 avec queue des requêtes pendantes
6. Stockage sécurisé mobile — Remplacé AsyncStorage (texte clair) par expo-secure-store (chiffré par le Keychain iOS / Keystore Android). Stocke token, refresh token et user.

7. Helmet — Installé et configuré. Ajoute automatiquement les headers de sécurité : X-Frame-Options, X-Content-Type-Options, Strict-Transport-Security, X-XSS-Protection, etc.

MOYENS
8. bcrypt configurable — Rounds configurables via BCRYPT_ROUNDS (défaut : 12).

9. JWT validation renforcée — La strategy vérifie le claim type pour empêcher l'utilisation de refresh tokens comme access tokens.

10. .env.example — Créé pour documenter toutes les variables requises/optionnelles.

11. Bug fix — Corrigé l'ordre de déclaration de isLive dans MatchTeamsBoardScreen.tsx.

--------------------------------------- check ce qu'il reste a faire pour deployer sur apple et android
-> Sur Android, react-native-maps utilise Google Maps par défaut. C'est gratuit jusqu'à 28 000 chargements de carte/mois (200$ de crédit offert par Google chaque mois), ce qui est largement suffisant pour une app en lancement.

Donc tu as déjà le bon setup :

iOS : Apple Maps (natif, gratuit, illimité)
Android : Google Maps (gratuit avec le crédit mensuel)
Tu n'as rien à changer. Tu as juste besoin d'une clé API Google Maps dans ton AndroidManifest.xml / app.json pour Android. Tu l'as déjà configurée ?


--------------------------------------- est ce que c'est censé marcher avec android la ?
Oui manque la cle google map dans app.json


--------------------------------------- qu'est ce qui me manque dans l'app
--------------------------------------- comment rajouter des pubs et sur quelles actions
--------------------------------------- Comment faire des abonnements payants

--------------------------------------- penser a gerer le point de repere localisation (dev/prod)
--------------------------------------- changer le nom de l'appli -> VolleyHub


Probleme : quand 1 equipe complete sur 3 dans tournois et en cours => pas de match terminé ni equipe sup



Super. Est ce que cet logique s'applique aussi aux systemes : eliminations directes et poules + phases ?



Oui, checkIncompleteTeamsOnStart s'applique à tous les systèmes sans distinction. Il vérifie les équipes complètes, puis :

Si assez d'équipes → régénère le bracket avec le bon tournamentSystem (round robin, pools+finals, ou single elimination) et active
Si pas assez → termine le tournoi
Le seul risque c'est que le nombre d'équipes complètes restantes ne soit pas valide pour le système choisi. Par exemple :

Élimination directe avec 8 équipes, 5 complètes → régénère avec 5 équipes. Le générateur fait nextPow2(5) = 8 avec 3 byes. Ça marche.
Pools + finals avec 8 équipes, 4 complètes → régénère avec 4 équipes. Mais le backend valide pools_finals pour 6-16 équipes. Le seedTournamentFixturesForNewMatch appelle le générateur directement sans repasser par la validation du DTO, donc ça passera mais avec seulement 2 équipes par pool (1 match par poule), ce qui est un peu pauvre.
Round robin avec 4 équipes, 2 complètes → régénère avec 2 équipes. Le générateur retourne vide car teamCount < 3. Pas de fixtures → le tournoi se termine.
Donc ça fonctionne partout, le générateur gère les cas limites (< 3 → vide → tournoi terminé). La seule chose qu'on pourrait améliorer c'est que si le nombre d'équipes restantes est trop petit pour le système, on switche automatiquement. Mais c'est un edge case rare et le comportement actuel (tournoi terminé) est sûr.

Tu veux que j'ajoute un switch automatique de système dans ce cas ?







Notif : slide vers la gauche pour supprimer -> enleve la croix rouge
enleve les boutons et fait en sorte de seulement cliquer sur la notifications pour faire l’action.

Rajoute le bouton guide pastille i pour un joueur non organisateur dans un evenement a gauche du chat, comme engrenage pour l’organisateur

Dans equipes tournoi et match faire un badge a cote de equipe 1 et equipe 2, etc , qui fait la moyenne des niveaux de l’equipe
Changer tableau evenement dans page profil
Filtre event a venir / en cours sur la page map

Dans score du match dans event match, met en blanc 0 des sets a remplir quand l’event est en cours, grise les cases pour remplir les sets pour l’organisateur tant que l’event est a venir
Dans score du match toujours, ne fait apparaitre le bouton enregistrer seulement lorsque l’organisateur change un input

==========================================================


- Les evenements terminé doivent apparaitre dans rejoints et créés mais pas dans la page trouver un evenement
- Dans toutes les cards evenements : Si un evenement n’est pas complet et qu’il est en statut a venir met la bordure du bouton en clignotement couleur principale
- Rajouter les notifications pour les messages du chat de groupe
- Rajouter heure dans bulles messages tout en bas a droite en gris (discret) dans la page chat du groupe
- dans page equipes au lieu de double tap pour s’enlever d’une equipe met une croix tout a droite
- pastille i dans page equipes pour expliquer que les equipes se lock quand match/tournois en cours, etc

Refaire tout le systeme en websocket. -> pas tous -> que tournoi match et equipes match/tournois

==========================================================

pastille i equipe -> mettre page plutot que modal
Quand recreation match ca met l’event créé en terminé ! (constat: ca remet pas tout les joueurs automatiquement dans l’equipe dans laquelle ils etaient avant, du coup risque d’eauipe vide au demarrage du renouvellement du match)
Sur android, la barre du chat de groupe en bas remonte pas


Alerte zone de recherche -> pour vous



-> recreation avec possibilités de switch equipes (5min depart apres creation)


 ???????est ce que si un match s'anulle pour manque de joueurs ca me compte pour un event joués ?