import type { Locale } from "./types";
import type { ModuleKey } from "@/modules/registry";
import { consoleEn, consoleFr, type ConsoleCopy } from "./console";

export type Messages = {
  languageAria: string;
  erp: {
    signOut: string;
    owner: string;
    staff: string;
    navAria: string;
  };
  portal: {
    eyebrow: string;
    manager: string;
    analyst: string;
  };
  signIn: {
    title: string;
    platformLead: string;
    resortLead: string;
    email: string;
    password: string;
    submit: string;
    submitting: string;
    badCredentials: string;
    guestPrompt: string;
    guestLink: string;
    wrongConsoleTitle: string;
    wrongConsoleBody: string;
    openPlatform: string;
  };
  guest: {
    eyebrow: string;
    listening: string;
    stations: string;
    of: string;
    recentlyHeard: string;
    quiet: string;
    listen: string;
    stop: string;
    recordingUnavailable: string;
    close: string;
    soundSignature: string;
    spectrogramAlt: string;
    noProfile: string;
    size: string;
    weight: string;
    lifespan: string;
    heardBy: string;
    detected: string;
    justNow: string;
    minutesAgo: string;
    anHourAgo: string;
    hoursAgo: string;
    yesterday: string;
    daysAgo: string;
    iucn: Record<string, string>;
  };
  login: {
    eyebrow: string;
    titleLine1: string;
    titleLine2: string;
    lead: string;
    checking: string;
    footer: string;
  };
  pin: {
    digitsEntered: string;
    checking: string;
    hint: string;
    network: string;
    deleteDigit: string;
  };
  lobbyPair: {
    eyebrow: string;
    title: string;
    lead: string;
    checking: string;
    code: string;
    submit: string;
    pairing: string;
    network: string;
  };
  access: {
    account: string;
    state: string;
    actions: string;
    edit: string;
    delete: string;
    save: string;
    saving: string;
    cancel: string;
    close: string;
    active: string;
    deactivated: string;
    owner: string;
    staff: string;
    full: string;
    none: string;
    read: string;
    write: string;
    editTitle: string;
    editHint: string;
    accountState: string;
    ownerLocked: string;
    deleteTitle: string;
    deleteLead: string;
    deleteHint: string;
    deleteConfirm: string;
    deleting: string;
    typeLabel: string;
    empty: string;
    matrixHint: string;
    deactivateNote: string;
    newAccount: string;
    newHint: string;
    create: string;
    creating: string;
    workEmail: string;
    fullName: string;
    issuedLead: string;
    copy: string;
    copied: string;
    storedPassword: string;
  };
  incidents: {
    sort: string;
    sortDateDesc: string;
    sortDateAsc: string;
    sortAz: string;
    sortZa: string;
    columnIncident: string;
    columnHotel: string;
    columnPriority: string;
    columnStatus: string;
    columnOpened: string;
    emptyTitle: string;
    emptyDetail: string;
    report: string;
    close: string;
    suspend: string;
    delete: string;
    confirmDelete: string;
    deleting: string;
    createTicket: string;
    ticketTitle: string;
    ticketHint: string;
    ticketCreated: string;
    archives: string;
    back: string;
    archive: string;
    archivedOn: string;
    emptyArchives: string;
    emptyArchivesDetail: string;
    monthPrev: string;
    monthNext: string;
  };
  tickets: {
    newTicket: string;
    newHint: string;
    create: string;
    creating: string;
    archives: string;
    back: string;
    filterAll: string;
    filterIncident: string;
    filterNotIncident: string;
    filterAssignee: string;
    unassigned: string;
    columnDraft: string;
    columnWaiting: string;
    columnProgress: string;
    columnDone: string;
    emptyColumn: string;
    emptyArchives: string;
    emptyArchivesDetail: string;
    archive: string;
    archivedOn: string;
    delete: string;
    confirmDelete: string;
    deleting: string;
    save: string;
    saving: string;
    department: string;
    priority: string;
    assignTo: string;
    title: string;
    description: string;
    opened: string;
    incidentBadge: string;
    monthPrev: string;
    monthNext: string;
    dropArchive: string;
    created: string;
  };
  accounting: {
    newEntry: string;
    newHint: string;
    post: string;
    posting: string;
    kind: string;
    expense: string;
    adjustment: string;
    amount: string;
    date: string;
    domain: string;
    platform: string;
    memo: string;
    ledger: string;
    ledgerHint: string;
  };
  modules: Record<ModuleKey, { label: string; purpose: string }>;
} & ConsoleCopy;

const fr: Messages = {
  ...consoleFr,
  languageAria: "Langue",
  erp: {
    signOut: "Déconnexion",
    owner: "Propriétaire",
    staff: "Équipe",
    navAria: "Modules ERP",
  },
  portal: {
    eyebrow: "Opérations du domaine",
    manager: "Directeur",
    analyst: "Analyste RSE",
  },
  signIn: {
    title: "Connexion",
    platformLead:
      "Opérateurs de la plateforme. Cette console couvre tous les domaines sous contrat.",
    resortLead:
      "Personnel du domaine. Les invités utilisent le code à quatre chiffres de la réception.",
    email: "E-mail professionnel",
    password: "Mot de passe",
    submit: "Se connecter",
    submitting: "Connexion…",
    badCredentials: "Ces identifiants n’ont pas été reconnus.",
    guestPrompt: "Invité du domaine ?",
    guestLink: "Saisir le code à quatre chiffres",
    wrongConsoleTitle: "Ceci est une console domaine",
    wrongConsoleBody:
      "Vous êtes connecté en tant qu’opérateur plateforme, sans domaine propre. L’ensemble est sur la console plateforme.",
    openPlatform: "Ouvrir",
  },
  guest: {
    eyebrow: "Inventaire vivant",
    listening: "À l’écoute",
    stations: "stations",
    of: "sur",
    recentlyHeard: "Détections récentes",
    quiet:
      "Le domaine écoute. Les détections apparaîtront ici à mesure que la faune est identifiée. L’aube et le crépuscule sont les heures les plus actives.",
    listen: "Écouter",
    stop: "Stop",
    recordingUnavailable: "Enregistrement indisponible",
    close: "Fermer",
    soundSignature: "Signature sonore",
    spectrogramAlt: "Spectrogramme du cri de {species}",
    noProfile:
      "Le catalogue n’a pas encore de fiche détaillée pour cette espèce.",
    size: "Taille",
    weight: "Poids",
    lifespan: "Longévité",
    heardBy: "Entendu par",
    detected: "Détecté",
    justNow: "à l’instant",
    minutesAgo: "il y a {n} min",
    anHourAgo: "il y a une heure",
    hoursAgo: "il y a {n} h",
    yesterday: "hier",
    daysAgo: "il y a {n} j",
    iucn: {
      not_evaluated: "Non évaluée",
      data_deficient: "Données insuffisantes",
      least_concern: "Préoccupation mineure",
      near_threatened: "Quasi menacée",
      vulnerable: "Vulnérable",
      endangered: "En danger",
      critically_endangered: "En danger critique",
      extinct_in_the_wild: "Éteinte à l’état sauvage",
      extinct: "Éteinte",
    },
  },
  login: {
    eyebrow: "Inventaire vivant",
    titleLine1: "Découvrir la faune",
    titleLine2: "autour de vous",
    lead:
      "Sur le Wi-Fi du domaine, cette page s’ouvre toute seule. Hors du site, saisissez le code de la réception, ou ouvrez le lien qu’ils vous ont envoyé.",
    checking: "Connexion via le réseau du domaine…",
    footer:
      "Hors site, la session dure quelques heures puis se ferme. Rejoignez le Wi-Fi de l’hôtel, ou demandez un nouveau code ou lien à la réception.",
  },
  pin: {
    digitsEntered: "{n} chiffre(s) sur {total}",
    checking: "Vérification du code…",
    hint: "Hors du Wi-Fi de l’hôtel ? Saisissez le code à quatre chiffres de la réception.",
    network: "Réseau indisponible. Réessayez.",
    deleteDigit: "Effacer le dernier chiffre",
  },
  lobbyPair: {
    eyebrow: "Affichage Eco-Data Link",
    title: "Apparier cet écran",
    lead:
      "Sur le Wi-Fi du domaine, l’écran s’apparie tout seul. Hors site, saisissez le code d’accueil ou ouvrez un lien distant depuis le portail. Cette session expire au bout de quelques heures.",
    checking: "Recherche du réseau du domaine…",
    code: "Code d’accueil",
    submit: "Apparier l’écran",
    pairing: "Appariement…",
    network: "Réseau indisponible. Vérifiez la connexion de l’écran.",
  },
  access: {
    account: "Compte",
    state: "État",
    actions: "Actions",
    edit: "Éditer",
    delete: "Supprimer",
    save: "Enregistrer",
    saving: "Enregistrement…",
    cancel: "Annuler",
    close: "Fermer",
    active: "Actif",
    deactivated: "Désactivé",
    owner: "Propriétaire plateforme",
    staff: "Équipe plateforme",
    full: "Complet",
    none: "Aucun accès",
    read: "Lecture",
    write: "Lecture et écriture",
    editTitle: "Modifier les accès",
    editHint: "Les changements s’appliquent à la prochaine page chargée par ce compte.",
    accountState: "État du compte",
    ownerLocked: "Le propriétaire a tous les modules, sans grant à modifier.",
    deleteTitle: "Supprimer le compte",
    deleteLead:
      "Irréversible : le profil et ses droits sont retirés. Pour une absence, désactivez plutôt le compte.",
    deleteHint: "Saisissez delete ou supprimer pour confirmer.",
    deleteConfirm: "Supprimer le compte",
    deleting: "Suppression…",
    typeLabel: "Confirmation",
    empty: "Aucun compte ERP pour l’instant.",
    matrixHint:
      "Éditer ouvre les droits du compte. Contrats et factures se donnent séparément, puis s’ouvrent depuis le domaine.",
    deactivateNote:
      "Désactiver ferme tous les modules sans effacer les grants. Réactiver les restitue tels quels.",
    newAccount: "Nouveau compte",
    newHint: "Le compte arrive actif, sans modules. Accordez-les ensuite via Éditer.",
    create: "Créer le compte",
    creating: "Création…",
    workEmail: "E-mail professionnel",
    fullName: "Nom complet",
    issuedLead:
      "Le mot de passe n’est affiché qu’une fois. Accordez les modules via Éditer : le compte ne voit encore rien.",
    copy: "Copier",
    copied: "Copié",
    storedPassword: "J’ai enregistré le mot de passe",
  },
  incidents: {
    sort: "Trier",
    sortDateDesc: "Date ↓",
    sortDateAsc: "Date ↑",
    sortAz: "A-Z",
    sortZa: "Z-A",
    columnIncident: "Incident",
    columnHotel: "Hôtel",
    columnPriority: "Priorité",
    columnStatus: "Statut",
    columnOpened: "Ouvert",
    emptyTitle: "Aucun incident",
    emptyDetail:
      "Les hôtels remontent les incidents depuis leur page Gestion. Ils apparaissent ici.",
    report: "Remontée de l’hôtel",
    close: "Clore",
    suspend: "Suspendre",
    delete: "Supprimer",
    confirmDelete: "Confirmer la suppression",
    deleting: "Suppression…",
    createTicket: "Créer un ticket à partir de l’incident",
    ticketTitle: "Nouveau ticket",
    ticketHint: "Prérempli à partir de l’incident. La mention Incident est dans le titre et la description.",
    ticketCreated: "Ticket créé à partir de l’incident.",
    archives: "Archives",
    back: "Retour",
    archive: "Archiver",
    archivedOn: "Archivé",
    emptyArchives: "Aucun incident clos ce mois-ci.",
    emptyArchivesDetail:
      "Les incidents clos, non supprimés, sont classés ici par mois. Un incident peut aussi être archivé à la main.",
    monthPrev: "Mois précédent",
    monthNext: "Mois suivant",
  },
  tickets: {
    newTicket: "Nouveau ticket",
    newHint: "Le ticket s’ouvre en brouillon. Glissez-le ensuite d’une colonne à l’autre.",
    create: "Créer le ticket",
    creating: "Création…",
    archives: "Archives",
    back: "Retour",
    filterAll: "Tous",
    filterIncident: "Incident",
    filterNotIncident: "Hors incident",
    filterAssignee: "Assigné",
    unassigned: "Non assigné",
    columnDraft: "Brouillons",
    columnWaiting: "En attente",
    columnProgress: "En cours",
    columnDone: "Terminé",
    emptyColumn: "Déposer un ticket ici",
    emptyArchives: "Aucun ticket clos ce mois-ci.",
    emptyArchivesDetail:
      "Les tickets terminés, non supprimés, sont classés ici par mois. Un ticket peut aussi être archivé à la main.",
    archive: "Archiver",
    archivedOn: "Archivé",
    delete: "Supprimer",
    confirmDelete: "Confirmer la suppression",
    deleting: "Suppression…",
    save: "Enregistrer",
    saving: "Enregistrement…",
    department: "Pôle",
    priority: "Priorité",
    assignTo: "Assigner à",
    title: "Titre",
    description: "Description",
    opened: "Ouvert",
    incidentBadge: "Incident",
    monthPrev: "Mois précédent",
    monthNext: "Mois suivant",
    dropArchive: "Relâcher pour archiver",
    created: "Ticket créé.",
  },
  accounting: {
    newEntry: "Nouvelle entrée",
    newHint:
      "Pour les coûts qui ne sont pas une facture. Les encaissements se lisent dans Factures, sans duplication ici.",
    post: "Enregistrer",
    posting: "Enregistrement…",
    kind: "Type",
    expense: "Dépense",
    adjustment: "Ajustement",
    amount: "Montant (EUR)",
    date: "Date",
    domain: "Domaine (optionnel)",
    platform: "Plateforme",
    memo: "Libellé",
    ledger: "Grand livre",
    ledgerHint: "Dépenses et ajustements les plus récents.",
  },
  modules: {
    overview: {
      label: "Vue d’ensemble",
      purpose:
        "Santé de l’ensemble, revenu récurrent et ce qui attend quelqu’un aujourd’hui.",
    },
    domains: {
      label: "Domaines",
      purpose:
        "Chaque propriété par son nom : contrat, factures, flotte d’écoute et jumeau.",
    },
    contracts: {
      label: "Contrats",
      purpose: "Termes, durée et dates de renouvellement d’une propriété.",
    },
    invoices: {
      label: "Factures",
      purpose: "Factures émises sur un contrat, paiements et retards.",
    },
    accounting: {
      label: "Comptabilité",
      purpose: "Revenu récurrent, encaissements et forme du livre.",
    },
    tickets: {
      label: "Tickets",
      purpose:
        "Travail interne IT, commerce et marketing : assigné, priorisé, coloré.",
    },
    incidents: {
      label: "Incidents",
      purpose:
        "Remontées des hôtels : les lire, les clore, les suspendre, ou en faire un ticket interne.",
    },
    audio: {
      label: "Audio & IA",
      purpose: "Débit d’ingestion, confiance du modèle et relecture des extraits.",
    },
    access: {
      label: "Accès",
      purpose: "Comptes ERP et modules que chacun peut ouvrir.",
    },
  },
};

const en: Messages = {
  ...consoleEn,
  languageAria: "Language",
  erp: {
    signOut: "Sign out",
    owner: "Owner",
    staff: "Staff",
    navAria: "ERP modules",
  },
  portal: {
    eyebrow: "Resort operations",
    manager: "Manager",
    analyst: "CSR analyst",
  },
  signIn: {
    title: "Sign in",
    platformLead:
      "Platform operators. This console covers every contracted resort.",
    resortLead: "Resort staff. Guests use the four-digit code from reception.",
    email: "Work email",
    password: "Password",
    submit: "Sign in",
    submitting: "Signing in…",
    badCredentials: "Those credentials were not recognised.",
    guestPrompt: "Resort guest?",
    guestLink: "Enter your four-digit code",
    wrongConsoleTitle: "This is a resort console",
    wrongConsoleBody:
      "You are signed in as a platform operator, and operators have no resort of their own. The estate lives on the platform console.",
    openPlatform: "Open",
  },
  guest: {
    eyebrow: "Living inventory",
    listening: "Listening",
    stations: "stations",
    of: "of",
    recentlyHeard: "Recently heard",
    quiet:
      "The estate is listening. Detections will appear here as wildlife is identified. Dawn and dusk are the most active hours.",
    listen: "Listen",
    stop: "Stop",
    recordingUnavailable: "Recording unavailable",
    close: "Close",
    soundSignature: "Sound signature",
    spectrogramAlt: "Spectrogram of the {species} call",
    noProfile:
      "A detailed profile for this species has not been added to the catalogue yet.",
    size: "Size",
    weight: "Weight",
    lifespan: "Lifespan",
    heardBy: "Heard by",
    detected: "Detected",
    justNow: "moments ago",
    minutesAgo: "{n} minutes ago",
    anHourAgo: "an hour ago",
    hoursAgo: "{n} hours ago",
    yesterday: "yesterday",
    daysAgo: "{n} days ago",
    iucn: {
      not_evaluated: "Not evaluated",
      data_deficient: "Data deficient",
      least_concern: "Least concern",
      near_threatened: "Near threatened",
      vulnerable: "Vulnerable",
      endangered: "Endangered",
      critically_endangered: "Critically endangered",
      extinct_in_the_wild: "Extinct in the wild",
      extinct: "Extinct",
    },
  },
  login: {
    eyebrow: "Living inventory",
    titleLine1: "Discover the wildlife",
    titleLine2: "around you",
    lead:
      "On the resort Wi-Fi this opens on its own. Away from the grounds, enter the code from reception, or open the link they sent you.",
    checking: "Connecting via the resort network…",
    footer:
      "Off-site sessions last a few hours and then close. Rejoin the hotel Wi-Fi, or ask reception for a new code or link.",
  },
  pin: {
    digitsEntered: "{n} of {total} digits entered",
    checking: "Checking your code…",
    hint: "Off the hotel Wi-Fi? Enter the four-digit code from reception.",
    network: "Network unavailable. Please try again.",
    deleteDigit: "Delete last digit",
  },
  lobbyPair: {
    eyebrow: "Eco-Data Link display",
    title: "Pair this screen",
    lead:
      "On the resort Wi-Fi this display pairs by itself. Off-site, enter the lobby code or open a remote link from the operations portal. That session expires after a few hours.",
    checking: "Looking for the resort network…",
    code: "Lobby code",
    submit: "Pair display",
    pairing: "Pairing…",
    network: "Network unavailable. Check the screen's connection.",
  },
  access: {
    account: "Account",
    state: "State",
    actions: "Actions",
    edit: "Edit",
    delete: "Delete",
    save: "Save",
    saving: "Saving…",
    cancel: "Cancel",
    close: "Close",
    active: "Active",
    deactivated: "Deactivated",
    owner: "Platform owner",
    staff: "Platform staff",
    full: "Full",
    none: "No access",
    read: "Read",
    write: "Read & write",
    editTitle: "Edit access",
    editHint: "Changes apply the next time this account loads a page.",
    accountState: "Account state",
    ownerLocked: "The owner holds every module. There is nothing to grant.",
    deleteTitle: "Delete account",
    deleteLead:
      "This cannot be undone: the profile and its grants are removed. For a leave of absence, deactivate instead.",
    deleteHint: "Type delete or supprimer to confirm.",
    deleteConfirm: "Delete account",
    deleting: "Deleting…",
    typeLabel: "Confirmation",
    empty: "No ERP accounts yet.",
    matrixHint:
      "Edit opens that account's grants. Contracts and invoices are granted separately, then opened from the domain they belong to.",
    deactivateNote:
      "Deactivating closes every module without clearing grants. Reinstating restores exactly what it had.",
    newAccount: "New account",
    newHint: "The account lands active, with no modules. Grant them afterwards via Edit.",
    create: "Create account",
    creating: "Creating…",
    workEmail: "Work email",
    fullName: "Full name",
    issuedLead:
      "The password is shown once. Grant modules via Edit: the account currently sees nothing.",
    copy: "Copy",
    copied: "Copied",
    storedPassword: "I have stored the password",
  },
  incidents: {
    sort: "Sort",
    sortDateDesc: "Date ↓",
    sortDateAsc: "Date ↑",
    sortAz: "A-Z",
    sortZa: "Z-A",
    columnIncident: "Incident",
    columnHotel: "Hotel",
    columnPriority: "Priority",
    columnStatus: "Status",
    columnOpened: "Opened",
    emptyTitle: "No incidents",
    emptyDetail:
      "Hotels report incidents from their operations page. They appear here.",
    report: "Hotel report",
    close: "Close",
    suspend: "Suspend",
    delete: "Delete",
    confirmDelete: "Confirm delete",
    deleting: "Deleting…",
    createTicket: "Create a ticket from this incident",
    ticketTitle: "New ticket",
    ticketHint: "Pre-filled from the incident. The word Incident is in the title and description.",
    ticketCreated: "Ticket created from the incident.",
    archives: "Archives",
    back: "Back",
    archive: "Archive",
    archivedOn: "Archived",
    emptyArchives: "No closed incidents this month.",
    emptyArchivesDetail:
      "Closed incidents that were not deleted are grouped here by month. An incident can also be archived by hand.",
    monthPrev: "Previous month",
    monthNext: "Next month",
  },
  tickets: {
    newTicket: "New ticket",
    newHint: "The ticket opens as a draft. Drag it across columns from there.",
    create: "Create ticket",
    creating: "Creating…",
    archives: "Archives",
    back: "Back",
    filterAll: "All",
    filterIncident: "Incident",
    filterNotIncident: "Not incident",
    filterAssignee: "Assignee",
    unassigned: "Unassigned",
    columnDraft: "Drafts",
    columnWaiting: "Waiting",
    columnProgress: "In progress",
    columnDone: "Done",
    emptyColumn: "Drop a ticket here",
    emptyArchives: "No closed tickets this month.",
    emptyArchivesDetail:
      "Done tickets that were not deleted are grouped here by month. A ticket can also be archived by hand.",
    archive: "Archive",
    archivedOn: "Archived",
    delete: "Delete",
    confirmDelete: "Confirm delete",
    deleting: "Deleting…",
    save: "Save ticket",
    saving: "Saving…",
    department: "Department",
    priority: "Priority",
    assignTo: "Assign to",
    title: "Title",
    description: "Description",
    opened: "Opened",
    incidentBadge: "Incident",
    monthPrev: "Previous month",
    monthNext: "Next month",
    dropArchive: "Drop to archive",
    created: "Ticket created.",
  },
  accounting: {
    newEntry: "New entry",
    newHint:
      "For costs that are not an invoice. Invoice income is read from Invoices, not duplicated here.",
    post: "Post entry",
    posting: "Posting…",
    kind: "Kind",
    expense: "Expense",
    adjustment: "Adjustment",
    amount: "Amount (EUR)",
    date: "Date",
    domain: "Domain (optional)",
    platform: "Platform",
    memo: "Memo",
    ledger: "Ledger",
    ledgerHint: "Most recent expenses and adjustments.",
  },
  modules: {
    overview: {
      label: "Overview",
      purpose:
        "Estate health, recurring revenue and anything waiting on someone today.",
    },
    domains: {
      label: "Domains",
      purpose:
        "Each property by name: its contract, invoices, listening fleet and twin.",
    },
    contracts: {
      label: "Contracts",
      purpose: "Terms, duration and renewal dates for a property.",
    },
    invoices: {
      label: "Invoices",
      purpose: "Issued invoices against a contract, payments and what is overdue.",
    },
    accounting: {
      label: "Accounting",
      purpose: "Recurring revenue, cash collected and the shape of the book.",
    },
    tickets: {
      label: "Tickets",
      purpose:
        "Internal work for IT, commerce and marketing: assigned, prioritised, colour-coded.",
    },
    incidents: {
      label: "Incidents",
      purpose:
        "Hotel-raised reports: read them, close or suspend them, or open an internal ticket.",
    },
    audio: {
      label: "Audio & AI",
      purpose: "Ingestion throughput, model confidence and clip review.",
    },
    access: {
      label: "Access",
      purpose: "ERP accounts and the modules each of them may open.",
    },
  },
};

export const dictionaries: Record<Locale, Messages> = { fr, en };
