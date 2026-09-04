import { noticesEn, noticesFr, type NoticesCopy } from "./notices";

export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ""));
}

export type ConsoleCopy = {
  empty: string;
  back: string;
  copy: string;
  copied: string;
  none: string;
  labels: {
    subscription: Record<string, string>;
    contract: Record<string, string>;
    invoice: Record<string, string>;
    invoiceOverdue: string;
    billing: Record<string, string>;
    sensor: Record<string, string>;
    priority: Record<string, string>;
    ticketStatus: Record<string, string>;
    incidentStatus: Record<string, string>;
    department: Record<string, string>;
    mlJob: Record<string, string>;
    ingestOutcome: Record<string, string>;
    assetProcessing: Record<string, string>;
  };
  relative: {
    never: string;
    justNow: string;
    minutesAgo: string;
    hoursAgo: string;
    yesterday: string;
    daysAgo: string;
  };
  overview: {
    onboard: string;
    domainsLive: string;
    domainsLiveHint: string;
    suspended: string;
    suspendedHint: string;
    balises: string;
    balisesHint: string;
    fleetHealth: string;
    fleetHealthHint: string;
    detections24h: string;
    awaitingReview: string;
    attention: string;
    attentionHint: string;
    nothingTitle: string;
    nothingDetail: string;
    keyspace: string;
    keyspaceHint: string;
    keyspaceBody1: string;
    keyspaceBody2: string;
    keyspacePlan: string;
    internal: string;
    aDomain: string;
    attSuspended: string;
    attSuspendedDetail: string;
    attNoBalises: string;
    attNoBalisesDetail: string;
    attOffline: string;
    attOfflinePlural: string;
    attOfflineDetail: string;
    attQuiet: string;
    attQuietDetail: string;
    attReview: string;
    attReviewDetail: string;
    attContractExpired: string;
    attContractEnding: string;
    attContractDetail: string;
    attInvoiceOverdue: string;
    attInvoiceDetail: string;
    attOpenTicket: string;
    attIncident: string;
  };
  domains: {
    onboard: string;
    onboardFirst: string;
    countOne: string;
    countMany: string;
    listHint: string;
    emptyTitle: string;
    emptyDetail: string;
    colDomain: string;
    colSubscription: string;
    colFleet: string;
    colBattery: string;
    colPing: string;
    colDetections: string;
    colSpecies: string;
    colConfidence: string;
    fleetActive: string;
    newTitle: string;
    newPurpose: string;
    newContract: string;
    newContractHint: string;
    newMotion: string;
    newMotionP1: string;
    newMotionP2: string;
    backToList: string;
    purposeFull: string;
    purposeCommercial: string;
    liveContract: string;
    renews: string;
    openTerm: string;
    openInvoices: string;
    overdueN: string;
    receivable: string;
    issuedUnpaid: string;
    fleet: string;
    fleetHint: string;
    pinCycle: string;
    nextRotation: string;
    overlap: string;
    overlapDays: string;
    coverageOk: string;
    coverageGap: string;
    twinAsset: string;
    twinFallback: string;
    onboarded: string;
    onboardedHint: string;
    sensorFleet: string;
    sensorFleetHint: string;
    provision: string;
    provisionHint: string;
    accessCodes: string;
    accessCodesHint: string;
    twinTitle: string;
    twinHint: string;
    twinEmpty: string;
    colVersion: string;
    colLabel: string;
    colKind: string;
    colSize: string;
    colOrigin: string;
    colSpan: string;
    colState: string;
    colUploaded: string;
    published: string;
    draft: string;
    config: string;
    resortId: string;
    slug: string;
    timezone: string;
    country: string;
    notSet: string;
    subRenews: string;
    geo: string;
    geoHint: string;
    detectionsKept: string;
    lastModified: string;
    lifecycle: string;
    lifecycleHint: string;
    pinForecast: string;
    pinForecastBody: string;
  };
  onboardForm: {
    live: string;
    secretsLead: string;
    lobbyCode: string;
    firstPin: string;
    manager: string;
    tempPassword: string;
    open: string;
    another: string;
    resortName: string;
    slug: string;
    slugSet: string;
    slugBlank: string;
    country: string;
    timezone: string;
    subscription: string;
    quota: string;
    quotaHint: string;
    lat: string;
    lon: string;
    lobbyHint: string;
    managerLegend: string;
    managerHint: string;
    workEmail: string;
    fullName: string;
    submit: string;
    submitting: string;
    submitHint: string;
  };
  fleet: {
    unit: string;
    hardware: string;
    status: string;
    battery: string;
    signal: string;
    lastSeen: string;
    detections: string;
    rotate: string;
    rotating: string;
    revoke: string;
    empty: string;
    noReading: string;
    signalStrong: string;
    signalFair: string;
    signalWeak: string;
  };
  codes: {
    lobby: string;
    lastRotated: string;
    rotateLobby: string;
    customLobby: string;
    guestPins: string;
    rotatePins: string;
    cycle: string;
    code: string;
    valid: string;
    state: string;
    empty: string;
    noneLive: string;
    oneLive: string;
    overlapLive: string;
    revoked: string;
    scheduled: string;
    expired: string;
    winding: string;
    live: string;
    revoke: string;
  };
  contractsUi: {
    title: string;
    hint: string;
    empty: string;
    term: string;
    cycle: string;
    amount: string;
    status: string;
    ends: string;
    expired: string;
    days: string;
    starts: string;
    notes: string;
    open: string;
    opening: string;
    cancel: string;
    cancelling: string;
  };
  invoicesUi: {
    title: string;
    hint: string;
    empty: string;
    needContract: string;
    number: string;
    contract: string;
    issued: string;
    due: string;
    amount: string;
    tax: string;
    status: string;
    memo: string;
    issue: string;
    issuing: string;
    markPaid: string;
    void: string;
  };
  lifecycle: {
    active: string;
    suspended: string;
    pinsOk: string;
    suspendedOn: string;
    reason: string;
    suspend: string;
    reinstating: string;
    reinstate: string;
    deleteTitle: string;
    deleteLead: string;
    typeSlug: string;
    delete: string;
    deleting: string;
  };
  provision: {
    name: string;
    hardware: string;
    notes: string;
    notesHint: string;
    submit: string;
    submitting: string;
    keyOnce: string;
  };
  twin: {
    label: string;
    kind: string;
    file: string;
    lat: string;
    lon: string;
    alt: string;
    heading: string;
    span: string;
    upload: string;
    uploading: string;
    publish: string;
    unpublish: string;
    placeholder: string;
    kindGlb: string;
    kindGltf: string;
    kindPointCloud: string;
    kindHeightmap: string;
  };
  audio: {
    title: string;
    purpose: string;
    detections: string;
    species: string;
    meanConfidence: string;
    autoPublish: string;
    autoPublishHint: string;
    reviewPrecision: string;
    reviewPrecisionHint: string;
    reviewPrecisionEmpty: string;
    ingested: string;
    ingestedHint: string;
    queueDepth: string;
    queueHint: string;
    inFlight: string;
    inFlightHint: string;
    failedJobs: string;
    failedHint: string;
    ingestOk: string;
    ingestOkHint: string;
    rejectRate: string;
    rejectRateHint: string;
    inspector: string;
    inspectorHint: string;
    histogram: string;
    histogramHint: string;
    histogramEmpty: string;
    throughput: string;
    throughputHint: string;
    queue: string;
    queueCardHint: string;
    queueEmpty: string;
    rejected: string;
    rejectedHint: string;
    rejectedEmpty: string;
    windowNote: string;
    noDetections: string;
    unknownUnit: string;
    spectrogramOn: string;
    clipMissing: string;
    liveUnavailable: string;
    colEnqueued: string;
    colStatus: string;
    colCodec: string;
    colDuration: string;
    colPriority: string;
    colAttempts: string;
    colWorker: string;
    colError: string;
    colReceived: string;
    colHardware: string;
    colOutcome: string;
    colHttp: string;
    colPayload: string;
    colDetail: string;
    window6h: string;
    window24h: string;
    window72h: string;
    window168h: string;
    play: string;
    pause: string;
    restart: string;
    seek: string;
    noClip: string;
    noClipDetail: string;
    playbackBlocked: string;
    clipLoadError: string;
    noAudio: string;
    liveSpectrogram: string;
    spectrogramOf: string;
    histogramBar: string;
    histogramAuto: string;
    histogramReview: string;
    histogramSuppressed: string;
    ofCalls: string;
    throughputEmpty: string;
    throughputNow: string;
    throughputAccepted: string;
    throughputRejected: string;
    throughputBytes: string;
    throughputPeak: string;
    throughputBar: string;
  };
  accountingUi: {
    mrr: string;
    mrrHint: string;
    openInvoices: string;
    openInvoicesHint: string;
    overdue: string;
    collected: string;
    collectedHint: string;
    expenses: string;
    expensesHint: string;
    emptyTitle: string;
    emptyDetail: string;
    colDate: string;
    colKind: string;
    colDomain: string;
    colMemo: string;
    colAmount: string;
  };
  noAccess: {
    title: string;
    purpose: string;
    noneGranted: string;
    notYours: string;
    detail: string;
    signOut: string;
  };
  notices: NoticesCopy;
};

export const consoleFr: ConsoleCopy = {
  empty: "-",
  back: "Retour",
  copy: "Copier",
  copied: "Copié",
  none: "Aucun",
  labels: {
    subscription: {
      trial: "Essai",
      active: "Actif",
      past_due: "Impayé",
      suspended: "Suspendu",
      churned: "Résilié",
    },
    contract: {
      draft: "Brouillon",
      active: "Actif",
      ended: "Terminé",
      cancelled: "Annulé",
    },
    invoice: {
      draft: "Brouillon",
      issued: "Émise",
      paid: "Payée",
      void: "Annulée",
    },
    invoiceOverdue: "En retard",
    billing: {
      monthly: "Mensuel",
      quarterly: "Trimestriel",
      yearly: "Annuel",
    },
    sensor: {
      provisioning: "Provisionnement",
      active: "Active",
      degraded: "Dégradée",
      offline: "Hors ligne",
      retired: "Retirée",
    },
    priority: {
      low: "Basse",
      normal: "Normale",
      high: "Haute",
      urgent: "Urgente",
    },
    ticketStatus: {
      draft: "Brouillon",
      waiting: "En attente",
      in_progress: "En cours",
      done: "Terminé",
      archived: "Archivé",
    },
    incidentStatus: {
      open: "Ouvert",
      in_progress: "En cours",
      resolved: "Résolu",
      closed: "Clos",
      suspended: "Suspendu",
      archived: "Archivé",
    },
    department: {
      it: "IT",
      commerce: "Commerce",
      marketing: "Marketing",
    },
    mlJob: {
      queued: "En file",
      processing: "En cours",
      succeeded: "Réussi",
      failed: "Échoué",
      dead_letter: "Lettre morte",
    },
    ingestOutcome: {
      accepted: "Accepté",
      rejected_auth: "Auth rejetée",
      rejected_payload: "Charge rejetée",
      rejected_quota: "Quota rejeté",
      storage_error: "Erreur de stockage",
      internal_error: "Erreur interne",
    },
    assetProcessing: {
      uploaded: "Déposé",
      optimizing: "Optimisation",
      ready: "Prêt",
      failed: "Échoué",
    },
  },
  relative: {
    never: "jamais",
    justNow: "à l’instant",
    minutesAgo: "il y a {n} min",
    hoursAgo: "il y a {n} h",
    yesterday: "hier",
    daysAgo: "il y a {n} j",
  },
  overview: {
    onboard: "Onboarder un domaine",
    domainsLive: "Domaines en service",
    domainsLiveHint: "{total} onboardés · {trial} en essai",
    suspended: "Suspendus",
    suspendedHint: "Les codes ne s’ouvrent plus",
    balises: "Balises déployées",
    balisesHint: "{active} actives · {degraded} dégradées · {offline} hors ligne",
    fleetHealth: "Santé de flotte",
    fleetHealthHint: "Part des unités qui remontent normalement",
    detections24h: "Détections · 24 h",
    awaitingReview: "{n} en relecture",
    attention: "À traiter",
    attentionHint: "Tout ce qui, sur l’ensemble, ne se résoudra pas tout seul.",
    nothingTitle: "Rien en attente",
    nothingDetail:
      "Chaque domaine est actif, chaque flotte remonte, aucun retard de relecture.",
    keyspace: "Espace des codes invités",
    keyspaceHint:
      "Les PIN invités sont émis tous les 28 jours, valables 42 jours, soit 14 jours de recouvrement à chaque bascule.",
    keyspaceBody1:
      "Parce que verify_guest_pin reçoit quatre chiffres sans indice de domaine, un PIN en service ne peut désigner qu’un seul domaine. La base l’impose par une contrainte d’exclusion sur (code, plage de validité) : un code ambigu ne peut pas être écrit.",
    keyspaceBody2:
      "Le format à 4 chiffres est donc une vraie limite de capacité : environ {domains} domaines en parallèle. Tirage actuel : {util} de {capacity} codes.",
    keyspacePlan:
      " Prévoir un passage à 5 chiffres ou des PIN par domaine avant saturation.",
    internal: "Interne",
    aDomain: "Un domaine",
    attSuspended: "Suspendu",
    attSuspendedDetail: "Les PIN invités et le code d’accueil ne s’ouvrent plus pour ce domaine.",
    attNoBalises: "Aucune balise",
    attNoBalisesDetail: "Onboardé mais pas encore à l’écoute. Provisionner le matériel pour ingérer.",
    attOffline: "{n} balise hors ligne",
    attOfflinePlural: "{n} balises hors ligne",
    attOfflineDetail: "Des unités ont cessé de remonter. Une visite terrain est probable.",
    attQuiet: "Flotte silencieuse",
    attQuietDetail: "Aucune balise n’a remonté depuis plus de trois heures ; la liaison peut être coupée.",
    attReview: "{n} détections en relecture",
    attReviewDetail: "La file de relecture grossit plus vite qu’elle n’est vidée.",
    attContractExpired: "Contrat expiré",
    attContractEnding: "Contrat dans les 30 jours",
    attContractDetail: "Échéance le {date}.",
    attInvoiceOverdue: "{number} en retard",
    attInvoiceDetail: "Échéance le {date}.",
    attOpenTicket: "Ticket ouvert",
    attIncident: "Incident hôtel",
  },
  domains: {
    onboard: "Onboarder un domaine",
    onboardFirst: "Onboarder le premier domaine",
    countOne: "1 propriété sous contrat",
    countMany: "{n} propriétés sous contrat",
    listHint:
      "Ouvrir une propriété par son nom. Son contrat et ses factures sont sur cette page, sans liste commerciale à part.",
    emptyTitle: "Aucun domaine onboardé",
    emptyDetail:
      "Créez le premier pour provisionner des balises et publier un jumeau. L’onboarding émet le code d’accueil et le premier cycle de PIN invité.",
    colDomain: "Domaine",
    colSubscription: "Abonnement",
    colFleet: "Flotte",
    colBattery: "Batterie min.",
    colPing: "Dernier ping",
    colDetections: "Détections 24 h",
    colSpecies: "Espèces 30 j",
    colConfidence: "Confiance moy.",
    fleetActive: "{active}/{total} actives",
    newTitle: "Onboarder un domaine",
    newPurpose:
      "Crée le locataire, le code d’accueil et le premier cycle de PIN invité. Balises et jumeau se provisionnent ensuite, depuis la page du domaine.",
    newContract: "Contrat",
    newContractHint:
      "Nom, identifiant et abonnement. L’identifiant est définitif : il amorce le terrain de repli et préfixe le stockage.",
    newMotion: "Ce que l’onboarding met en place",
    newMotionP1:
      "Le domaine est joignable dès qu’il existe. L’écran d’accueil s’apparie avec le code, les invités se connectent avec le PIN à quatre chiffres du cycle 0.",
    newMotionP2:
      "Les coordonnées sont facultatives à ce stade : sans jumeau publié, les vues invité et accueil rendent un terrain procédural à partir de l’identifiant. Publier un scan plus tard écrase le géoréférencement.",
    backToList: "Domaines",
    purposeFull: "Contrat, factures, matériel et accès invités pour {slug}.",
    purposeCommercial: "Contrat et factures pour {slug}.",
    liveContract: "Contrat en cours",
    renews: "Renouvellement {date}",
    openTerm: "Ouvrir un terme pour démarrer le récurrent",
    openInvoices: "Factures ouvertes",
    overdueN: "{n} en retard",
    receivable: "À encaisser",
    issuedUnpaid: "Émises, pas encore payées",
    fleet: "Flotte",
    fleetHint: "Provisionnées sur le quota",
    pinCycle: "Cycle PIN actuel",
    nextRotation: "Prochaine rotation {date}",
    overlap: "Recouvrement",
    overlapDays: "{n} jours",
    coverageOk: "Couverture sans trou",
    coverageGap: "Trou détecté",
    twinAsset: "Jumeau",
    twinFallback: "La vue invité retombe sur un terrain procédural",
    onboarded: "Onboardé",
    onboardedHint: "Ancre le calendrier de rotation",
    sensorFleet: "Flotte de balises",
    sensorFleetHint:
      "Balises bioacoustiques autonomes. Le statut reflète la dernière ingestion, pas l’intention de provisionnement.",
    provision: "Provisionner une balise",
    provisionHint: "Émet un identifiant et enregistre le matériel. La clé n’est montrée qu’une fois.",
    accessCodes: "Codes d’accès",
    accessCodesHint:
      "Nouveau PIN chaque mois calendaire, valable 42 jours, recouvrement d’environ 14 jours.",
    twinTitle: "Fichiers du jumeau",
    twinHint: "Une version publiée par domaine. Les envois vont au stockage, pas par le serveur d’app.",
    twinEmpty:
      "Aucun jumeau. La vue invité rend un terrain procédural jusqu’à publication.",
    colVersion: "Version",
    colLabel: "Libellé",
    colKind: "Type",
    colSize: "Taille",
    colOrigin: "Origine",
    colSpan: "Emprise",
    colState: "État",
    colUploaded: "Déposé",
    published: "Publié",
    draft: "Brouillon",
    config: "Configuration",
    resortId: "Id domaine",
    slug: "Identifiant",
    timezone: "Fuseau",
    country: "Pays",
    notSet: "Non renseigné",
    subRenews: "Renouvellement abonnement",
    geo: "Géoréférencement",
    geoHint: "Recopié depuis l’asset publié pour les lectures invité.",
    detectionsKept: "Détections conservées",
    lastModified: "Dernière modification",
    lifecycle: "Cycle de vie",
    lifecycleHint:
      "La suspension ferme l’accès invité et accueil en base ; les balises continuent d’ingérer.",
    pinForecast: "Prévision des PIN",
    pinForecastBody:
      "Les {n} prochains cycles à partir de la date d’onboarding de ce domaine ({anchor}).",
  },
  onboardForm: {
    live: "{name} est en service",
    secretsLead:
      "Le code d’accueil et le PIN invité restent visibles sur la page du domaine. Le mot de passe du directeur, non : copiez-le maintenant.",
    lobbyCode: "Code d’accueil",
    firstPin: "Premier PIN invité",
    manager: "Directeur",
    tempPassword: "Mot de passe temporaire",
    open: "Ouvrir {slug}",
    another: "Onboarder un autre",
    resortName: "Nom du domaine",
    slug: "Identifiant",
    slugSet: "Identifiant définitif : {slug}",
    slugBlank: "Dérivé du nom s’il est laissé vide.",
    country: "Pays (ISO 3166-1 alpha-2)",
    timezone: "Fuseau",
    subscription: "Abonnement",
    quota: "Quota de balises",
    quotaHint: "Le déploiement type est de sept unités par site.",
    lat: "Latitude du site",
    lon: "Longitude du site",
    lobbyHint:
      "Laisser vide pour en générer un. Unique sur la plateforme : l’écran d’accueil retrouve le domaine par ce code seul.",
    managerLegend: "Directeur du domaine (optionnel)",
    managerHint:
      "Crée le compte qui gère la propriété, avec un mot de passe à usage unique. Laisser vide pour le matériel d’abord, les personnes ensuite.",
    workEmail: "E-mail professionnel",
    fullName: "Nom complet",
    submit: "Onboarder le domaine",
    submitting: "Onboarding…",
    submitHint: "Émet tout de suite le code d’accueil et le premier cycle de PIN invité.",
  },
  fleet: {
    unit: "Unité",
    hardware: "Matériel",
    status: "Statut",
    battery: "Batterie",
    signal: "Signal",
    lastSeen: "Vu",
    detections: "Détections",
    rotate: "Tourner la clé",
    rotating: "Rotation…",
    revoke: "Révoquer",
    empty: "Aucune balise sur ce domaine.",
    noReading: "Pas de mesure",
    signalStrong: "Fort · {rssi} dBm",
    signalFair: "Correct · {rssi} dBm",
    signalWeak: "Faible · {rssi} dBm",
  },
  codes: {
    lobby: "Code d’accueil",
    lastRotated: "Dernière rotation {date}",
    rotateLobby: "Tourner le code d’accueil",
    customLobby: "Code souhaité (optionnel)",
    guestPins: "PIN invités",
    rotatePins: "Tourner les PIN",
    cycle: "Cycle",
    code: "Code",
    valid: "Validité",
    state: "État",
    empty: "Aucun PIN émis.",
    noneLive: "Aucun code en service. Les invités ne peuvent pas se connecter.",
    oneLive: "1 code en service.",
    overlapLive: "{n} codes en service, dans la fenêtre de recouvrement.",
    revoked: "Révoqué",
    scheduled: "Planifié",
    expired: "Expiré",
    winding: "En service · fin de cycle",
    live: "En service",
    revoke: "Révoquer",
  },
  contractsUi: {
    title: "Contrat",
    hint: "Le terme en cours porte le récurrent. En ouvrir un nouveau clôt le précédent.",
    empty: "Pas encore de contrat sur ce domaine.",
    term: "Période",
    cycle: "Cycle",
    amount: "Montant",
    status: "Statut",
    ends: "Fin",
    expired: "Expiré",
    days: "{n} j",
    starts: "Début",
    notes: "Notes",
    open: "Ouvrir le contrat",
    opening: "Ouverture…",
    cancel: "Annuler",
    cancelling: "Annulation…",
  },
  invoicesUi: {
    title: "Factures",
    hint: "Chaque facture appartient à un contrat de ce domaine. La comptabilité agrège l’ensemble à part.",
    empty: "Aucune facture émise pour ce domaine.",
    needContract: "Ouvrir un contrat sur ce domaine avant d’émettre une facture.",
    number: "Numéro",
    contract: "Contrat",
    issued: "Émise",
    due: "Échéance",
    amount: "Montant (EUR)",
    tax: "Taxe (EUR)",
    status: "Statut",
    memo: "Libellé",
    issue: "Émettre",
    issuing: "Émission…",
    markPaid: "Marquer payée",
    void: "Annuler",
  },
  lifecycle: {
    active: "Actif",
    suspended: "Suspendu",
    pinsOk: "Les PIN invités et le code d’accueil s’ouvrent normalement.",
    suspendedOn: "Suspendu {date}.",
    reason: "Motif de suspension",
    suspend: "Suspendre",
    reinstating: "Rétablissement…",
    reinstate: "Rétablir",
    deleteTitle: "Supprimer le domaine",
    deleteLead: "Irréversible. Saisissez l’identifiant pour confirmer.",
    typeSlug: "Identifiant",
    delete: "Supprimer",
    deleting: "Suppression…",
  },
  provision: {
    name: "Nom",
    hardware: "Id matériel",
    notes: "Notes de terrain",
    notesHint: "Hauteur, essence, accès : ce dont la prochaine visite a besoin.",
    submit: "Provisionner",
    submitting: "Provisionnement…",
    keyOnce: "Copiez la clé maintenant, elle ne sera plus affichée.",
  },
  twin: {
    label: "Libellé",
    kind: "Type",
    file: "Fichier",
    lat: "Latitude",
    lon: "Longitude",
    alt: "Altitude",
    heading: "Cap",
    span: "Emprise (m)",
    upload: "Déposer",
    uploading: "Envoi…",
    publish: "Publier",
    unpublish: "Dépublier",
    placeholder: "Scan photogrammétrique, févr. 2026",
    kindGlb: "glTF binaire (.glb)",
    kindGltf: "glTF JSON (.gltf)",
    kindPointCloud: "Nuage de points (.ply / .laz)",
    kindHeightmap: "Carte d’altitude (.png)",
  },
  audio: {
    title: "Pipeline audio et IA",
    purpose: "Débit d’ingestion, confiance du modèle et relecture des extraits sur l’ensemble, {window}.",
    detections: "Détections",
    species: "{n} espèces distinctes",
    meanConfidence: "Confiance moyenne",
    autoPublish: "Part auto-publiée",
    autoPublishHint: "Appels ≥ 0,85, montrés aux invités sans relecture",
    reviewPrecision: "Précision de relecture",
    reviewPrecisionHint: "Sur les appels effectivement tranchés",
    reviewPrecisionEmpty: "Aucun appel relu dans cette fenêtre",
    ingested: "Audio ingéré",
    ingestedHint: "{n} minutes classées",
    queueDepth: "Profondeur de file",
    queueHint: "Extraits en attente d’inférence",
    inFlight: "En cours",
    inFlightHint: "Pris par un worker",
    failedJobs: "Jobs en échec",
    failedHint: "Y compris lettre morte",
    ingestOk: "Ingestions acceptées",
    ingestOkHint: "{n} rejetées",
    rejectRate: "Taux de rejet",
    rejectRateHint: "Auth, charge utile et quota",
    inspector: "Inspecteur d’extrait",
    inspectorHint:
      "Écouter une détection et voir sa signature temps-fréquence. Si le pipeline a rendu un spectrogramme, il s’affiche ; sinon il est calculé en direct.",
    histogram: "Distribution de confiance",
    histogramHint:
      "Dix classes égales sur [0, 1]. La forme compte plus que la moyenne : bimodale, le modèle est décidé ; bosse centrale, il hésite.",
    histogramEmpty: "Aucune détection dans cette fenêtre, rien à tracer.",
    throughput: "Débit d’ingestion",
    throughputHint:
      "Tentatives horaires sur l’ensemble. Un palier sans barre : aucune balise n’a remonté cette heure-là.",
    queue: "File d’inférence",
    queueCardHint:
      "Les extraits sont stockés et mis en file à l’ingestion, puis classés hors bande pour ne pas retarder la radio de terrain.",
    queueEmpty: "File vide : chaque extrait ingéré dans cette fenêtre a été classé.",
    rejected: "Ingestions rejetées",
    rejectedHint:
      "Une unité qui perd l’auth après un flash disparaît des données. Ce journal rend l’échec visible.",
    rejectedEmpty: "Aucun rejet dans cette fenêtre.",
    windowNote:
      "Fenêtre depuis {since}. Les URL signées expirent 30 minutes après le rendu de cette page ; recharger pour les renouveler.",
    noDetections: "Aucune détection dans cette fenêtre.",
    unknownUnit: "Unité inconnue",
    spectrogramOn: "spectrogramme rendu",
    clipMissing: "extrait manquant",
    liveUnavailable: "Analyse en direct indisponible pour cet extrait : l’hôte audio n’a pas répondu.",
    colEnqueued: "Enfilé",
    colStatus: "Statut",
    colCodec: "Codec",
    colDuration: "Durée",
    colPriority: "Priorité",
    colAttempts: "Essais",
    colWorker: "Worker",
    colError: "Erreur",
    colReceived: "Reçu",
    colHardware: "Id matériel",
    colOutcome: "Issue",
    colHttp: "HTTP",
    colPayload: "Charge",
    colDetail: "Détail",
    window6h: "6 h",
    window24h: "24 h",
    window72h: "3 j",
    window168h: "7 j",
    play: "Lecture",
    pause: "Pause",
    restart: "Reprendre",
    seek: "Position",
    noClip: "Aucun extrait sélectionné",
    noClipDetail:
      "Choisissez une détection dans le flux pour écouter l’audio et voir la signature temps-fréquence classée par le modèle.",
    playbackBlocked: "La lecture a été bloquée par le navigateur.",
    clipLoadError: "Impossible de charger l’extrait. Son URL signée a peut-être expiré.",
    noAudio: "Aucun fichier audio n’est attaché à cette détection.",
    liveSpectrogram: "Spectrogramme en direct de l’extrait en lecture",
    spectrogramOf: "Spectrogramme de la détection {species}",
    histogramBar: "Confiance {range} : {n} détections ({confirmed} confirmées, {rejected} rejetées)",
    histogramAuto: "≥ 0,85 auto-publié · {pct} des appels",
    histogramReview: "0,70-0,85 file de relecture",
    histogramSuppressed: "< 0,70 masqué · {pct} des appels",
    ofCalls: "des appels",
    throughputEmpty:
      "Aucune tentative d’ingestion dans cette fenêtre. Soit aucune balise n’émet, soit aucune n’est encore provisionnée.",
    throughputNow: "maintenant",
    throughputAccepted: "acceptées",
    throughputRejected: "rejetées",
    throughputBytes: "{bytes} d’audio ingéré",
    throughputPeak: "pic {n} tentatives/h",
    throughputBar: "{when} UTC : {accepted} acceptées, {rejected} rejetées, {bytes}",
  },
  accountingUi: {
    mrr: "MRR",
    mrrHint: "{arr} annualisé depuis les contrats actifs",
    openInvoices: "Factures ouvertes",
    openInvoicesHint: "Émises, pas encore payées",
    overdue: "En retard",
    collected: "Encaissé · année",
    collectedHint: "Factures marquées payées cette année",
    expenses: "Dépenses · année",
    expensesHint: "Dépenses du grand livre seulement",
    emptyTitle: "Grand livre vide",
    emptyDetail:
      "Enregistrez une dépense ou un ajustement. Les factures payées apparaissent dans Encaissé, pas ici.",
    colDate: "Date",
    colKind: "Type",
    colDomain: "Domaine",
    colMemo: "Libellé",
    colAmount: "Montant",
  },
  noAccess: {
    title: "Rien d’assigné pour l’instant",
    purpose: "Ce compte est actif mais n’a aucun module ERP.",
    noneGranted: "Aucun module accordé",
    notYours: "Ce module n’est pas le vôtre",
    detail:
      "{email} peut se connecter, mais le propriétaire n’a pas encore ouvert de module. Demandez-lui de l’assigner depuis Accès ; cela prend effet au prochain chargement.",
    signOut: "Déconnexion",
  },
  notices: noticesFr,
};

export const consoleEn: ConsoleCopy = {
  empty: "-",
  back: "Back",
  copy: "Copy",
  copied: "Copied",
  none: "None",
  labels: {
    subscription: {
      trial: "Trial",
      active: "Active",
      past_due: "Past due",
      suspended: "Suspended",
      churned: "Churned",
    },
    contract: {
      draft: "Draft",
      active: "Active",
      ended: "Ended",
      cancelled: "Cancelled",
    },
    invoice: {
      draft: "Draft",
      issued: "Issued",
      paid: "Paid",
      void: "Void",
    },
    invoiceOverdue: "Overdue",
    billing: {
      monthly: "Monthly",
      quarterly: "Quarterly",
      yearly: "Yearly",
    },
    sensor: {
      provisioning: "Provisioning",
      active: "Active",
      degraded: "Degraded",
      offline: "Offline",
      retired: "Retired",
    },
    priority: {
      low: "Low",
      normal: "Normal",
      high: "High",
      urgent: "Urgent",
    },
    ticketStatus: {
      draft: "Draft",
      waiting: "Waiting",
      in_progress: "In progress",
      done: "Done",
      archived: "Archived",
    },
    incidentStatus: {
      open: "Open",
      in_progress: "In progress",
      resolved: "Resolved",
      closed: "Closed",
      suspended: "Suspended",
      archived: "Archived",
    },
    department: {
      it: "IT",
      commerce: "Commerce",
      marketing: "Marketing",
    },
    mlJob: {
      queued: "Queued",
      processing: "Processing",
      succeeded: "Succeeded",
      failed: "Failed",
      dead_letter: "Dead letter",
    },
    ingestOutcome: {
      accepted: "Accepted",
      rejected_auth: "Auth rejected",
      rejected_payload: "Payload rejected",
      rejected_quota: "Quota rejected",
      storage_error: "Storage error",
      internal_error: "Internal error",
    },
    assetProcessing: {
      uploaded: "Uploaded",
      optimizing: "Optimizing",
      ready: "Ready",
      failed: "Failed",
    },
  },
  relative: {
    never: "never",
    justNow: "just now",
    minutesAgo: "{n} min ago",
    hoursAgo: "{n} h ago",
    yesterday: "yesterday",
    daysAgo: "{n} days ago",
  },
  overview: {
    onboard: "Onboard domain",
    domainsLive: "Domains live",
    domainsLiveHint: "{total} onboarded · {trial} on trial",
    suspended: "Suspended",
    suspendedHint: "Codes do not resolve",
    balises: "Balises deployed",
    balisesHint: "{active} active · {degraded} degraded · {offline} offline",
    fleetHealth: "Fleet health",
    fleetHealthHint: "Share of units reporting normally",
    detections24h: "Detections · 24 h",
    awaitingReview: "{n} awaiting review",
    attention: "Needs attention",
    attentionHint: "Anything across the estate that will not resolve itself.",
    nothingTitle: "Nothing outstanding",
    nothingDetail:
      "Every domain is active, every fleet is reporting and no review backlog has built up.",
    keyspace: "Guest PIN keyspace",
    keyspaceHint:
      "Guest PINs are issued on a 28-day cadence with 42-day validity, giving every rollover a 14-day overlap.",
    keyspaceBody1:
      "Because verify_guest_pin receives four digits and no resort hint, a live PIN must resolve to exactly one domain. The database enforces that with an exclusion constraint over (code, validity range), so an ambiguous code cannot be written.",
    keyspaceBody2:
      "That makes the 4-digit format a real capacity limit: roughly {domains} concurrent domains. Current draw is {util} of {capacity} codes.",
    keyspacePlan: " Plan a migration to 5 digits or resort-scoped PINs before this saturates.",
    internal: "Internal",
    aDomain: "A domain",
    attSuspended: "Suspended",
    attSuspendedDetail: "Guest PINs and the lobby code do not resolve for this resort.",
    attNoBalises: "No balises provisioned",
    attNoBalisesDetail: "Onboarded but not yet listening. Provision hardware to start ingesting.",
    attOffline: "{n} balise offline",
    attOfflinePlural: "{n} balises offline",
    attOfflineDetail: "Units have stopped reporting. A field visit is likely needed.",
    attQuiet: "Fleet has gone quiet",
    attQuietDetail: "No balise has reported in over three hours; the link may be down.",
    attReview: "{n} detections awaiting review",
    attReviewDetail: "The review backlog is growing faster than it is being cleared.",
    attContractExpired: "Contract expired",
    attContractEnding: "Contract ends within 30 days",
    attContractDetail: "Term closes {date}.",
    attInvoiceOverdue: "{number} overdue",
    attInvoiceDetail: "Due {date}.",
    attOpenTicket: "Open ticket",
    attIncident: "Hotel incident",
  },
  domains: {
    onboard: "Onboard domain",
    onboardFirst: "Onboard the first domain",
    countOne: "1 contracted property",
    countMany: "{n} contracted properties",
    listHint:
      "Open a property by name. Its contract and invoices live on that page; there is no separate commercial list.",
    emptyTitle: "No domains onboarded yet",
    emptyDetail:
      "Create the first one to begin provisioning balises and uploading a digital twin. Onboarding issues the resort's lobby code and its first guest PIN cycle.",
    colDomain: "Domain",
    colSubscription: "Subscription",
    colFleet: "Fleet",
    colBattery: "Lowest battery",
    colPing: "Last ping",
    colDetections: "Detections 24 h",
    colSpecies: "Species 30 d",
    colConfidence: "Mean confidence",
    fleetActive: "{active}/{total} active",
    newTitle: "Onboard a domain",
    newPurpose:
      "Creates the tenant, its hall display code and its first guest PIN cycle. Balises and the digital twin are provisioned afterwards, from the resort's own page.",
    newContract: "Contract",
    newContractHint:
      "Name, slug and subscription. The slug is permanent: it seeds the fallback terrain and prefixes storage objects.",
    newMotion: "What onboarding sets in motion",
    newMotionP1:
      "The resort becomes reachable the moment it exists. Its hall display pairs with the lobby code, and guests sign in with the four-digit PIN issued for cycle 0.",
    newMotionP2:
      "Coordinates are optional at this stage: without a published twin asset, the guest and lobby views render procedural terrain seeded from the slug, so the resort still looks like itself on day one. Publishing a scan later overwrites the georeferencing.",
    backToList: "Domains",
    purposeFull: "Contract, invoices, hardware and guest access for {slug}.",
    purposeCommercial: "Contract and invoices for {slug}.",
    liveContract: "Live contract",
    renews: "Renews {date}",
    openTerm: "Open a term to start recurring revenue",
    openInvoices: "Open invoices",
    overdueN: "{n} overdue",
    receivable: "Receivable",
    issuedUnpaid: "Issued, not yet paid",
    fleet: "Fleet",
    fleetHint: "Provisioned against quota",
    pinCycle: "Current PIN cycle",
    nextRotation: "Next rotation {date}",
    overlap: "Overlap",
    overlapDays: "{n} days",
    coverageOk: "Coverage is gapless",
    coverageGap: "Gap detected",
    twinAsset: "Twin asset",
    twinFallback: "Guest view falls back to procedural terrain",
    onboarded: "Onboarded",
    onboardedHint: "Anchors the rotation schedule",
    sensorFleet: "Sensor fleet",
    sensorFleetHint:
      "Autonomous bioacoustic balises. Status reflects the last ingest, not a provisioning intent.",
    provision: "Provision a balise",
    provisionHint: "Mints a credential and registers the hardware. The key is shown once.",
    accessCodes: "Access codes",
    accessCodesHint:
      "New PIN each calendar month, valid 42 days, overlap of about 14 days.",
    twinTitle: "Digital twin assets",
    twinHint: "One published version per resort. Uploads go direct to storage, bypassing the app server.",
    twinEmpty:
      "No twin asset uploaded. The guest view will render procedural terrain until one is published.",
    colVersion: "Version",
    colLabel: "Label",
    colKind: "Kind",
    colSize: "Size",
    colOrigin: "Origin",
    colSpan: "Span",
    colState: "State",
    colUploaded: "Uploaded",
    published: "Published",
    draft: "Draft",
    config: "Configuration",
    resortId: "Resort id",
    slug: "Slug",
    timezone: "Timezone",
    country: "Country",
    notSet: "Not set",
    subRenews: "Subscription renews",
    geo: "Twin georeferencing",
    geoHint: "Mirrored from the published asset for fast guest reads.",
    detectionsKept: "Detections retained",
    lastModified: "Last modified",
    lifecycle: "Lifecycle",
    lifecycleHint:
      "Suspension closes guest and lobby access at the database while balises keep ingesting.",
    pinForecast: "PIN forecast",
    pinForecastBody:
      "The next {n} cycles from this resort's onboarding anchor ({anchor}).",
  },
  onboardForm: {
    live: "{name} is live",
    secretsLead:
      "The lobby code and guest PIN stay visible on the resort page. The manager password does not: copy it now.",
    lobbyCode: "Lobby code",
    firstPin: "First guest PIN",
    manager: "Manager",
    tempPassword: "Temporary password",
    open: "Open {slug}",
    another: "Onboard another",
    resortName: "Resort name",
    slug: "Slug",
    slugSet: "Permanent identifier: {slug}",
    slugBlank: "Derived from the name if left blank.",
    country: "Country (ISO 3166-1 alpha-2)",
    timezone: "Timezone",
    subscription: "Subscription",
    quota: "Balise quota",
    quotaHint: "The standard deployment is seven units per site.",
    lat: "Site latitude",
    lon: "Site longitude",
    lobbyHint:
      "Leave blank to mint one. Unique platform-wide: the hall display resolves its resort from this code alone.",
    managerLegend: "Resort manager (optional)",
    managerHint:
      "Creates the account that runs the property, with a one-time password. Leave blank to onboard the hardware first and the people later.",
    workEmail: "Work email",
    fullName: "Full name",
    submit: "Onboard resort",
    submitting: "Onboarding…",
    submitHint: "Issues the lobby code and the first guest PIN cycle immediately.",
  },
  fleet: {
    unit: "Unit",
    hardware: "Hardware",
    status: "Status",
    battery: "Battery",
    signal: "Signal",
    lastSeen: "Last seen",
    detections: "Detections",
    rotate: "Rotate key",
    rotating: "Rotating…",
    revoke: "Revoke",
    empty: "No balises on this domain.",
    noReading: "No reading",
    signalStrong: "Strong · {rssi} dBm",
    signalFair: "Fair · {rssi} dBm",
    signalWeak: "Weak · {rssi} dBm",
  },
  codes: {
    lobby: "Lobby code",
    lastRotated: "Last rotated {date}",
    rotateLobby: "Rotate lobby code",
    customLobby: "Desired code (optional)",
    guestPins: "Guest PINs",
    rotatePins: "Rotate PINs",
    cycle: "Cycle",
    code: "Code",
    valid: "Validity",
    state: "State",
    empty: "No PIN issued.",
    noneLive: "No code is currently live. Guests cannot sign in.",
    oneLive: "1 code live.",
    overlapLive: "{n} codes live, currently inside the rollover overlap.",
    revoked: "Revoked",
    scheduled: "Scheduled",
    expired: "Expired",
    winding: "Live · winding down",
    live: "Live",
    revoke: "Revoke",
  },
  contractsUi: {
    title: "Contract",
    hint: "The live term drives recurring revenue. Opening a new one closes the previous.",
    empty: "No contract on this domain yet.",
    term: "Term",
    cycle: "Cycle",
    amount: "Amount",
    status: "Status",
    ends: "Ends",
    expired: "Expired",
    days: "{n} d",
    starts: "Starts",
    notes: "Notes",
    open: "Open contract",
    opening: "Opening…",
    cancel: "Cancel",
    cancelling: "Cancelling…",
  },
  invoicesUi: {
    title: "Invoices",
    hint: "Each invoice belongs to a contract on this domain. Accounting still rolls the estate up separately.",
    empty: "No invoices issued for this domain.",
    needContract: "Open a contract on this domain before issuing an invoice.",
    number: "Number",
    contract: "Contract",
    issued: "Issued",
    due: "Due",
    amount: "Amount (EUR)",
    tax: "Tax (EUR)",
    status: "Status",
    memo: "Memo",
    issue: "Issue",
    issuing: "Issuing…",
    markPaid: "Mark paid",
    void: "Void",
  },
  lifecycle: {
    active: "Active",
    suspended: "Suspended",
    pinsOk: "Guest PINs and the lobby code resolve normally.",
    suspendedOn: "Suspended {date}.",
    reason: "Reason for suspension",
    suspend: "Suspend",
    reinstating: "Reinstating…",
    reinstate: "Reinstate",
    deleteTitle: "Delete domain",
    deleteLead: "This cannot be undone. Type the slug to confirm.",
    typeSlug: "Slug",
    delete: "Delete",
    deleting: "Deleting…",
  },
  provision: {
    name: "Name",
    hardware: "Hardware id",
    notes: "Field notes",
    notesHint: "Mounting height, tree species, access route: whatever the next visit needs.",
    submit: "Provision",
    submitting: "Provisioning…",
    keyOnce: "Copy the key now; it will not be shown again.",
  },
  twin: {
    label: "Label",
    kind: "Kind",
    file: "File",
    lat: "Latitude",
    lon: "Longitude",
    alt: "Altitude",
    heading: "Heading",
    span: "Span (m)",
    upload: "Upload",
    uploading: "Uploading…",
    publish: "Publish",
    unpublish: "Unpublish",
    placeholder: "Photogrammetry scan, Feb 2026",
    kindGlb: "glTF binary (.glb)",
    kindGltf: "glTF JSON (.gltf)",
    kindPointCloud: "Point cloud (.ply / .laz)",
    kindHeightmap: "Heightmap (.png)",
  },
  audio: {
    title: "Audio & AI pipeline",
    purpose: "Ingestion throughput, model confidence and clip-level review across the estate over the last {window}.",
    detections: "Detections",
    species: "{n} distinct species",
    meanConfidence: "Mean confidence",
    autoPublish: "Auto-publish share",
    autoPublishHint: "Calls at ≥ 0.85, shown to guests unreviewed",
    reviewPrecision: "Review precision",
    reviewPrecisionHint: "Over calls an operator actually adjudicated",
    reviewPrecisionEmpty: "No calls reviewed in this window",
    ingested: "Audio ingested",
    ingestedHint: "{n} minutes classified",
    queueDepth: "Queue depth",
    queueHint: "Clips awaiting inference",
    inFlight: "In flight",
    inFlightHint: "Leased to a worker",
    failedJobs: "Failed jobs",
    failedHint: "Includes dead-lettered",
    ingestOk: "Ingest accepted",
    ingestOkHint: "{n} rejected",
    rejectRate: "Rejection rate",
    rejectRateHint: "Auth, payload and quota failures",
    inspector: "Clip inspector",
    inspectorHint:
      "Audition a detection and inspect its time-frequency signature. Where the pipeline rendered a spectrogram, that image is shown; otherwise one is computed live from the audio.",
    histogram: "Model confidence distribution",
    histogramHint:
      "Ten equal buckets over [0, 1]. Shape matters more than the mean: a bimodal distribution means the model is decisive, a central hump means it is guessing.",
    histogramEmpty: "No detections in this window, so there is no distribution to plot.",
    throughput: "Ingestion throughput",
    throughputHint:
      "Hourly ingest attempts across the estate. Flat stretches with no bar mean no balise reported that hour.",
    queue: "Inference queue",
    queueCardHint:
      "Clips are stored and enqueued at ingest, then classified out-of-band so model latency never back-pressures a field radio.",
    queueEmpty: "Queue is empty: every ingested clip in this window has been classified.",
    rejected: "Rejected ingests",
    rejectedHint:
      "A unit that starts failing auth after a firmware flash simply stops appearing in the data. This log is what makes that failure visible.",
    rejectedEmpty: "No rejected ingests in this window.",
    windowNote:
      "Window opens {since}. Signed clip URLs expire 30 minutes after this page was rendered; reload to refresh them.",
    noDetections: "No detections in this window.",
    unknownUnit: "Unknown unit",
    spectrogramOn: "spectrogram rendered",
    clipMissing: "clip missing",
    liveUnavailable: "Live analysis is unavailable for this clip: the audio host did not respond.",
    colEnqueued: "Enqueued",
    colStatus: "Status",
    colCodec: "Codec",
    colDuration: "Duration",
    colPriority: "Priority",
    colAttempts: "Attempts",
    colWorker: "Worker",
    colError: "Error",
    colReceived: "Received",
    colHardware: "Hardware ID",
    colOutcome: "Outcome",
    colHttp: "HTTP",
    colPayload: "Payload",
    colDetail: "Detail",
    window6h: "6 h",
    window24h: "24 h",
    window72h: "3 d",
    window168h: "7 d",
    play: "Play",
    pause: "Pause",
    restart: "Restart",
    seek: "Seek",
    noClip: "No clip selected",
    noClipDetail:
      "Choose a detection from the stream to audition its audio and inspect the time-frequency signature the model classified.",
    playbackBlocked: "Playback was blocked by the browser.",
    clipLoadError: "The clip could not be loaded. Its signed URL may have expired.",
    noAudio: "No audio object is attached to this detection.",
    liveSpectrogram: "Live spectrogram of the playing clip",
    spectrogramOf: "Spectrogram of the {species} detection",
    histogramBar: "Confidence {range}: {n} detections ({confirmed} confirmed, {rejected} rejected)",
    histogramAuto: "≥ 0.85 auto-publish · {pct} of calls",
    histogramReview: "0.70-0.85 review queue",
    histogramSuppressed: "< 0.70 suppressed · {pct} of calls",
    ofCalls: "of calls",
    throughputEmpty:
      "No ingest attempts recorded in this window. Either no balise is transmitting, or none has been provisioned yet.",
    throughputNow: "now",
    throughputAccepted: "accepted",
    throughputRejected: "rejected",
    throughputBytes: "{bytes} of audio ingested",
    throughputPeak: "peak {n} attempts/hour",
    throughputBar: "{when} UTC: {accepted} accepted, {rejected} rejected, {bytes}",
  },
  accountingUi: {
    mrr: "MRR",
    mrrHint: "{arr} annualised from active contracts",
    openInvoices: "Open invoices",
    openInvoicesHint: "Issued, not yet paid",
    overdue: "Overdue",
    collected: "Collected · YTD",
    collectedHint: "Invoices marked paid this year",
    expenses: "Expenses · YTD",
    expensesHint: "Ledger expenses only",
    emptyTitle: "Ledger is empty",
    emptyDetail:
      "Post an expense or an adjustment. Paid invoices appear in Collected, not here.",
    colDate: "Date",
    colKind: "Kind",
    colDomain: "Domain",
    colMemo: "Memo",
    colAmount: "Amount",
  },
  noAccess: {
    title: "Nothing assigned yet",
    purpose: "This account is active but holds no ERP module.",
    noneGranted: "No modules granted",
    notYours: "That module is not yours",
    detail:
      "{email} can sign in, but the platform owner has not granted it a module to work in. Ask them to assign one from the Access tab; it takes effect on your next page load.",
    signOut: "Sign out",
  },
  notices: noticesEn,
};
