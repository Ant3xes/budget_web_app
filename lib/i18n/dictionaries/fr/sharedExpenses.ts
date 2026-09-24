/** Sharing a transaction into a shared space (components/transactions/share-*, Partage default split). */
export const sharedExpenses = {
  row: {
    share: "Partager avec un espace commun",
    manage: "Gérer le partage",
    badge: "Partagée",
    badgeIn: "Partagée · {space}",
  },
  modal: {
    titleNew: "Partager cette dépense",
    titleEdit: "Gérer le partage",
    intro: "La transaction reste dans votre espace perso. Une copie est ajoutée à la balance de l'espace commun.",
    space: "Espace commun",
    selectPlaceholder: "Choisir un espace",
    category: "Catégorie dans l'espace commun",
    noCategory: "Aucune catégorie",
    myShare: "Ma part (%)",
    shareInvalid: "Saisissez un pourcentage entre 0 et 100",
    preview: "Vous supportez {me} %, le(s) autre(s) membre(s) {others} %",
    amounts: "Vous : {mine} · Autre(s) membre(s) : {others}",
    noSharedSpace:
      "Vous n'appartenez à aucun espace commun pour l'instant. Créez-en un ou acceptez une invitation pour partager des dépenses.",
    goToInvitations: "Aller au Partage",
    submitShare: "Partager",
    submitUpdate: "Enregistrer",
    unshare: "Arrêter le partage",
    unshareConfirmTitle: "Arrêter le partage de cette dépense ?",
    unshareConfirmDescription:
      "La dépense est retirée de la balance de l'espace commun. Votre transaction perso n'est pas modifiée.",
    saveError: "Impossible d'enregistrer le partage",
    unshareError: "Impossible d'arrêter le partage",
  },
  defaultSplit: {
    heading: "Répartition par défaut",
    description:
      "Part d'une dépense supportée par le membre qui l'a payée quand il la partage dans cet espace. Le reste est réparti à parts égales entre les autres membres.",
    label: "Part du payeur (%)",
    readOnly: "Seul le propriétaire de l'espace peut modifier la répartition par défaut.",
    save: "Enregistrer",
    saved: "Enregistré",
    invalid: "Saisissez un pourcentage entier entre 0 et 100",
    error: "Impossible d'enregistrer la répartition par défaut",
  },
} as const;
