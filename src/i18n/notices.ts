export type NoticesCopy = {
  writeDenied: string;
  ownerOnlyAccess: string;
  failCreateAccount: string;
  createdNotActivated: string;
  accountReady: string;
  accountNotFound: string;
  ownerHasAll: string;
  failRevoke: string;
  failGrant: string;
  accessUpdated: string;
  invalidAccount: string;
  invalidGrants: string;
  unknownModule: string;
  incompleteGrants: string;
  failRevokeModule: string;
  failGrantModule: string;
  failAccountState: string;
  accountUpdated: string;
  cannotDeactivateSelf: string;
  staffOnlyDeactivate: string;
  updateFailed: string;
  cannotDeleteSelf: string;
  staffOnlyDelete: string;
  deletionFailed: string;
  accountRemoved: string;
  invalidIncident: string;
  failLoadIncident: string;
  incidentNotFound: string;
  failUpdate: string;
  failDelete: string;
  incidentDeleted: string;
  failReportIncident: string;
  incidentSent: string;
  failCreateTicket: string;
  ticketCreated: string;
  failSave: string;
  ticketUpdated: string;
  invalidTicketStatus: string;
  failLoadTicket: string;
  ticketNotFound: string;
  failMoveTicket: string;
  invalidTicket: string;
  onlyArchivedDelete: string;
  ticketDeleted: string;
  nonzeroEuros: string;
  chooseExpenseOrAdjustment: string;
  memoRequired: string;
  invalidMemo: string;
  dateRequired: string;
  failPost: string;
  entryPosted: string;
  validEuros: string;
  chooseContract: string;
  dueDateRequired: string;
  contractUnavailable: string;
  failIssue: string;
  invoiceIssued: string;
  invalidInvoice: string;
  failRecordPayment: string;
  markedPaid: string;
  failVoid: string;
  invoiceVoided: string;
  endAfterStart: string;
  failCloseTerm: string;
  failSaveContract: string;
  contractLive: string;
  invalidContract: string;
  failCancel: string;
  contractCancelled: string;
  failTrustedNetworks: string;
  suspendReason: string;
  failSuspend: string;
  invalidResort: string;
  failReinstate: string;
  domainReinstated: string;
  deleteOwnerOnly: string;
  resortNotFound: string;
  typeSlugToConfirm: string;
  failRemoveAccount: string;
  failDeleteAfterAccounts: string;
  lobbyCodeCharset: string;
  slugOrLobbyTaken: string;
  failCreateResort: string;
  keyspaceExhaustedOnboard: string;
  domainOnboarded: string;
  slugHyphens: string;
  invalidUpload: string;
  failPrepareUpload: string;
  uploadAuthorised: string;
  unsupportedAsset: string;
  failRetireTwin: string;
  failRegisterAsset: string;
  failReadCodes: string;
  codesAlreadyCurrent: string;
  failRotationCycle: string;
  codesIssued: string;
  invalidIds: string;
  failRevocation: string;
  lobbyCodeTaken: string;
  failRotation: string;
  lobbyRotated: string;
  keyspaceExhaustedRotate: string;
  fleetQuota: string;
  hardwareTaken: string;
  failProvision: string;
  sensorProvisioned: string;
  credentialRevoked: string;
  failRotateKey: string;
  newKeyIssued: string;
  validEmail: string;
  accountReactivated: string;
  accountDeactivated: string;
  ticketArchived: string;
  ticketMoved: string;
  incidentArchived: string;
  incidentClosed: string;
  incidentSuspended: string;
  onNetworkOff: string;
  trustedNetworksUpdated: string;
  domainSuspended: string;
  resortNameShort: string;
  countryIso: string;
  invalidOnboarding: string;
  noGuestCodeIssued: string;
  hallDisplayDefaults: string;
  operatorCannotManage: string;
  managerNotCreated: string;
  twinPublished: string;
  twinDraft: string;
  codeRevoked: string;
  hardwareIdCharset: string;
  invalidProvisioning: string;
  invalidInput: string;
  invalidSuspension: string;
  invalidAssetMeta: string;
  invalidUpdate: string;
  unknownError: string;
  invalidCidr: string;
};

export const noticesFr: NoticesCopy = {
  writeDenied: "Ce compte n’a pas le droit d’écriture sur {module}.",
  ownerOnlyAccess: "Seul le propriétaire de la plateforme administre les comptes ERP.",
  failCreateAccount: "Impossible de créer le compte : {detail}",
  createdNotActivated: "{email} a été créé mais n’est pas activé ({detail}).",
  accountReady:
    "{email} peut se connecter. Accordez-lui un module ci-dessous : il ne voit encore rien.",
  accountNotFound: "Compte introuvable.",
  ownerHasAll: "Seul le personnel a des droits. Le propriétaire a déjà tous les modules.",
  failRevoke: "Impossible de retirer : {detail}",
  failGrant: "Impossible d’accorder : {detail}",
  accessUpdated: "Accès mis à jour. Prend effet au prochain chargement de page du compte.",
  invalidAccount: "Compte invalide.",
  invalidGrants: "Droits invalides.",
  unknownModule: "Module inconnu : {key}",
  incompleteGrants: "Droits incomplets.",
  failRevokeModule: "Impossible de retirer {module} : {detail}",
  failGrantModule: "Impossible d’accorder {module} : {detail}",
  failAccountState: "Impossible de mettre à jour l’état du compte : {detail}",
  accountUpdated: "{email} mis à jour. Les changements s’appliquent au prochain chargement.",
  cannotDeactivateSelf: "Vous ne pouvez pas désactiver votre propre compte.",
  staffOnlyDeactivate: "Seuls les comptes du personnel peuvent être désactivés ici.",
  updateFailed: "Mise à jour impossible : {detail}",
  cannotDeleteSelf: "Vous ne pouvez pas supprimer votre propre compte.",
  staffOnlyDelete: "Seuls les comptes du personnel peuvent être supprimés ici.",
  deletionFailed: "Suppression impossible : {detail}",
  accountRemoved: "{email} a été retiré.",
  invalidIncident: "Incident invalide.",
  failLoadIncident: "Impossible de charger l’incident : {detail}",
  incidentNotFound: "Incident introuvable.",
  failUpdate: "Impossible de mettre à jour : {detail}",
  failDelete: "Impossible de supprimer : {detail}",
  incidentDeleted: "Incident supprimé.",
  failReportIncident: "Impossible de signaler l’incident : {detail}",
  incidentSent: "Incident envoyé à Eco-Data Link. Nous le prenons en charge.",
  failCreateTicket: "Impossible de créer le ticket : {detail}",
  ticketCreated: "Ticket créé.",
  failSave: "Impossible d’enregistrer : {detail}",
  ticketUpdated: "Ticket mis à jour.",
  invalidTicketStatus: "Statut de ticket invalide.",
  failLoadTicket: "Impossible de charger le ticket : {detail}",
  ticketNotFound: "Ticket introuvable.",
  failMoveTicket: "Impossible de déplacer le ticket : {detail}",
  invalidTicket: "Ticket invalide.",
  onlyArchivedDelete: "Seuls les tickets archivés peuvent être supprimés.",
  ticketDeleted: "Ticket supprimé.",
  nonzeroEuros: "Saisissez un montant non nul en euros.",
  chooseExpenseOrAdjustment: "Choisissez une dépense ou un ajustement.",
  memoRequired: "Un libellé est requis.",
  invalidMemo: "Libellé invalide.",
  dateRequired: "Une date est requise.",
  failPost: "Impossible de poster : {detail}",
  entryPosted: "Écriture enregistrée.",
  validEuros: "Saisissez un montant valide en euros.",
  chooseContract: "Choisissez le contrat de cette facture.",
  dueDateRequired: "Une date d’échéance est requise.",
  contractUnavailable: "Ce contrat n’est pas disponible.",
  failIssue: "Impossible d’émettre : {detail}",
  invoiceIssued: "{number} émise.",
  invalidInvoice: "Facture invalide.",
  failRecordPayment: "Impossible d’enregistrer le paiement : {detail}",
  markedPaid: "Marquée payée.",
  failVoid: "Impossible d’annuler : {detail}",
  invoiceVoided: "Facture annulée. Elle ne compte plus en créance.",
  endAfterStart: "La date de fin doit être après la date de début.",
  failCloseTerm: "Impossible de clôturer la période précédente : {detail}",
  failSaveContract: "Impossible d’enregistrer le contrat : {detail}",
  contractLive: "Contrat en vigueur. La période précédente, le cas échéant, a été close.",
  invalidContract: "Contrat invalide.",
  failCancel: "Impossible d’annuler : {detail}",
  contractCancelled: "Contrat annulé. Il ne compte plus dans le revenu récurrent.",
  failTrustedNetworks: "Impossible d’enregistrer les réseaux de confiance : {detail}",
  suspendReason: "Indiquez un motif : c’est ce qui expliquera la suspension plus tard.",
  failSuspend: "Suspension impossible : {detail}",
  invalidResort: "Identifiant de domaine invalide.",
  failReinstate: "Rétablissement impossible : {detail}",
  domainReinstated:
    "Domaine rétabli sur un abonnement actif. Les codes existants s’ouvrent à nouveau.",
  deleteOwnerOnly: "La suppression d’un domaine est réservée au propriétaire. Suspendez-le plutôt.",
  resortNotFound: "Domaine introuvable.",
  typeSlugToConfirm: "Saisissez {slug} exactement pour confirmer la suppression.",
  failRemoveAccount:
    "Impossible de retirer le compte derrière {id} ({detail}). Rien n’a été supprimé.",
  failDeleteAfterAccounts: "Suppression impossible après retrait des comptes : {detail}",
  lobbyCodeCharset: "Les codes d’accueil font 4-32 caractères : A-Z, 0-9 et tirets.",
  slugOrLobbyTaken:
    "L’identifiant {slug} ou le code d’accueil {code} est déjà pris. Les deux sont uniques sur la plateforme.",
  failCreateResort: "Impossible de créer le domaine : {detail}",
  keyspaceExhaustedOnboard:
    "L’espace des PIN à 4 chiffres est saturé pour cette fenêtre ; aucun code invité n’a été émis.",
  domainOnboarded:
    "{name} onboardé. Copiez les codes ci-dessous : le mot de passe du directeur n’est pas récupérable.",
  slugHyphens: "L’identifiant doit être en minuscules, mots joints par un seul tiret.",
  invalidUpload: "Demande d’envoi invalide.",
  failPrepareUpload: "Impossible de préparer l’envoi : {detail}",
  uploadAuthorised: "Envoi autorisé.",
  unsupportedAsset: "Type de fichier non pris en charge.",
  failRetireTwin: "Impossible de retirer le jumeau actuel : {detail}",
  failRegisterAsset: "Impossible d’enregistrer le fichier : {detail}",
  failReadCodes: "Impossible de lire les codes existants : {detail}",
  codesAlreadyCurrent:
    "Déjà à jour : le cycle {cycle} est en service et aucune fenêtre ne manque.",
  failRotationCycle: "Rotation interrompue au cycle {cycle} : {detail}",
  codesIssued: "{n} code{s} émis (cycle{s} {cycles}).",
  invalidIds: "Identifiants invalides.",
  failRevocation: "Révocation impossible : {detail}",
  lobbyCodeTaken: "Ce code d’accueil est déjà utilisé par un autre domaine. Choisissez-en un autre.",
  failRotation: "Rotation impossible : {detail}",
  lobbyRotated:
    "Code d’accueil renouvelé. Chaque écran apparié doit être réapparié avec le nouveau code.",
  keyspaceExhaustedRotate:
    "L’espace des PIN à 4 chiffres est saturé pour cette fenêtre. Aucun code libre n’existe sans collision avec un code en service.",
  fleetQuota:
    "Quota de flotte atteint ({quota}). Augmentez-le avant de provisionner une autre balise.",
  hardwareTaken: "L’id matériel {id} est déjà provisionné sur la plateforme.",
  failProvision: "Provisionnement impossible : {detail}",
  sensorProvisioned: "{name} provisionnée. Copiez la clé API maintenant : elle ne sera plus affichée.",
  credentialRevoked: "Identifiant révoqué. Re-provisionnez pour ramener l’unité en ligne.",
  failRotateKey: "Rotation impossible : {detail}",
  newKeyIssued: "Nouvelle clé émise. Flashez-la sur l’unité : la précédente ne fonctionne plus.",
  validEmail: "Saisissez une adresse e-mail valide.",
  accountReactivated:
    "{email} est de nouveau actif, avec les modules qu’il détenait.",
  accountDeactivated:
    "{email} n’a plus accès à aucun module. Ses droits sont conservés.",
  ticketArchived: "Ticket archivé.",
  ticketMoved: "Ticket déplacé.",
  incidentArchived: "Incident archivé.",
  incidentClosed: "Incident clos.",
  incidentSuspended: "Incident suspendu.",
  onNetworkOff:
    "L’admission sur le réseau est désactivée pour ce domaine. Les codes sont requis.",
  trustedNetworksUpdated: "Réseaux de confiance mis à jour ({n}).",
  domainSuspended:
    "Domaine suspendu. Les PIN invités et le code d’accueil cessent de résoudre immédiatement. Les balises continuent d’ingérer.",
  resortNameShort: "Le nom du domaine est trop court.",
  countryIso: "Le pays doit être un code ISO à deux lettres.",
  invalidOnboarding: "Détails d’onboarding invalides.",
  noGuestCodeIssued:
    "Aucun code invité n’a été émis ({detail}). Effectuez une rotation depuis la page du domaine.",
  hallDisplayDefaults:
    "Les paramètres par défaut de l’écran d’accueil n’ont pas été écrits ({detail}).",
  operatorCannotManage:
    "Cette adresse appartient à l’opérateur de la plateforme et ne peut pas gérer un domaine.",
  managerNotCreated:
    "Le compte directeur n’a pas été créé ({detail}). Invitez-le depuis la page du domaine.",
  twinPublished: "Version {version} enregistrée et publiée comme jumeau actif.",
  twinDraft: "Version {version} enregistrée comme brouillon.",
  codeRevoked:
    "Code révoqué. Les invités qui le détiennent perdent l’accès immédiatement. Le code qui se chevauche reste valable.",
  hardwareIdCharset:
    "L’id matériel ne peut contenir que des lettres, des chiffres, un tiret et un underscore.",
  invalidProvisioning: "Détails de provisionnement invalides.",
  invalidInput: "Saisie invalide.",
  invalidSuspension: "Demande de suspension invalide.",
  invalidAssetMeta: "Métadonnées du fichier invalides.",
  invalidUpdate: "Mise à jour invalide.",
  unknownError: "erreur inconnue",
  invalidCidr:
    "{token} n’est pas un préfixe utilisable. IPv4 : /8-/32 (pas 0.0.0.0) ; IPv6 : /32-/128.",
};

export const noticesEn: NoticesCopy = {
  writeDenied: "Your account does not have write access to {module}.",
  ownerOnlyAccess: "Only the platform owner can administer ERP accounts.",
  failCreateAccount: "Could not create the account: {detail}",
  createdNotActivated: "{email} was created but not activated ({detail}).",
  accountReady:
    "{email} can now sign in. Grant it a module below: it currently sees nothing.",
  accountNotFound: "Account not found.",
  ownerHasAll: "Only platform staff carry grants. The owner already has every module.",
  failRevoke: "Could not revoke: {detail}",
  failGrant: "Could not grant: {detail}",
  accessUpdated: "Access updated. It applies on the account's next page load.",
  invalidAccount: "Invalid account.",
  invalidGrants: "Invalid grants.",
  unknownModule: "Unknown module: {key}",
  incompleteGrants: "Incomplete grants.",
  failRevokeModule: "Could not revoke {module}: {detail}",
  failGrantModule: "Could not grant {module}: {detail}",
  failAccountState: "Could not update account state: {detail}",
  accountUpdated: "{email} updated. Changes apply on that account's next page load.",
  cannotDeactivateSelf: "You cannot deactivate your own account.",
  staffOnlyDeactivate: "Only platform staff accounts can be deactivated here.",
  updateFailed: "Update failed: {detail}",
  cannotDeleteSelf: "You cannot delete your own account.",
  staffOnlyDelete: "Only platform staff accounts can be deleted here.",
  deletionFailed: "Deletion failed: {detail}",
  accountRemoved: "{email} has been removed.",
  invalidIncident: "Invalid incident.",
  failLoadIncident: "Could not load incident: {detail}",
  incidentNotFound: "Incident not found.",
  failUpdate: "Could not update: {detail}",
  failDelete: "Could not delete: {detail}",
  incidentDeleted: "Incident deleted.",
  failReportIncident: "Could not report the incident: {detail}",
  incidentSent: "Incident sent to Eco-Data Link. We will pick it up from here.",
  failCreateTicket: "Could not create the ticket: {detail}",
  ticketCreated: "Ticket created.",
  failSave: "Could not save: {detail}",
  ticketUpdated: "Ticket updated.",
  invalidTicketStatus: "Invalid ticket status.",
  failLoadTicket: "Could not load ticket: {detail}",
  ticketNotFound: "Ticket not found.",
  failMoveTicket: "Could not move the ticket: {detail}",
  invalidTicket: "Invalid ticket.",
  onlyArchivedDelete: "Only archived tickets can be deleted.",
  ticketDeleted: "Ticket deleted.",
  nonzeroEuros: "Enter a non-zero amount in euros.",
  chooseExpenseOrAdjustment: "Choose expense or adjustment.",
  memoRequired: "A memo is required.",
  invalidMemo: "Invalid memo.",
  dateRequired: "A date is required.",
  failPost: "Could not post: {detail}",
  entryPosted: "Entry posted.",
  validEuros: "Enter a valid amount in euros.",
  chooseContract: "Choose the contract this invoice belongs to.",
  dueDateRequired: "A due date is required.",
  contractUnavailable: "That contract is not available.",
  failIssue: "Could not issue: {detail}",
  invoiceIssued: "{number} issued.",
  invalidInvoice: "Invalid invoice.",
  failRecordPayment: "Could not record payment: {detail}",
  markedPaid: "Marked paid.",
  failVoid: "Could not void: {detail}",
  invoiceVoided: "Invoice voided. It no longer counts as receivable.",
  endAfterStart: "The end date must be after the start date.",
  failCloseTerm: "Could not close the previous term: {detail}",
  failSaveContract: "Could not save the contract: {detail}",
  contractLive: "Contract is live. The previous term, if any, was closed.",
  invalidContract: "Invalid contract.",
  failCancel: "Could not cancel: {detail}",
  contractCancelled: "Contract cancelled. It no longer counts toward recurring revenue.",
  failTrustedNetworks: "Could not save trusted networks: {detail}",
  suspendReason: "Give a reason: it is what explains the suspension months later.",
  failSuspend: "Suspension failed: {detail}",
  invalidResort: "Invalid resort id.",
  failReinstate: "Reinstatement failed: {detail}",
  domainReinstated:
    "Domain reinstated on an active subscription. Existing codes resolve again.",
  deleteOwnerOnly: "Deleting a domain is reserved to the platform owner. Suspend it instead.",
  resortNotFound: "Resort not found.",
  typeSlugToConfirm: "Type {slug} exactly to confirm deletion.",
  failRemoveAccount:
    "Could not remove the account behind {id} ({detail}). Nothing was deleted.",
  failDeleteAfterAccounts: "Deletion failed after removing accounts: {detail}",
  lobbyCodeCharset: "Lobby codes must be 4-32 characters of A-Z, 0-9 and hyphens.",
  slugOrLobbyTaken:
    "Either the slug {slug} or the lobby code {code} is already taken. Both are unique platform-wide.",
  failCreateResort: "Could not create the resort: {detail}",
  keyspaceExhaustedOnboard:
    "The 4-digit PIN keyspace is exhausted for this window; no guest code was issued.",
  domainOnboarded:
    "{name} onboarded. Copy the codes below: the manager password is not recoverable.",
  slugHyphens: "Slug must be lowercase words joined by single hyphens.",
  invalidUpload: "Invalid upload request.",
  failPrepareUpload: "Could not prepare upload: {detail}",
  uploadAuthorised: "Upload authorised.",
  unsupportedAsset: "Unsupported asset kind.",
  failRetireTwin: "Could not retire the current twin: {detail}",
  failRegisterAsset: "Could not register asset: {detail}",
  failReadCodes: "Could not read existing codes: {detail}",
  codesAlreadyCurrent: "Already current: cycle {cycle} is live and no window is missing.",
  failRotationCycle: "Rotation failed at cycle {cycle}: {detail}",
  codesIssued: "Issued {n} code{s} (cycle{s} {cycles}).",
  invalidIds: "Invalid identifiers.",
  failRevocation: "Revocation failed: {detail}",
  lobbyCodeTaken: "That lobby code is already in use by another resort. Choose another.",
  failRotation: "Rotation failed: {detail}",
  lobbyRotated: "Lobby code rotated. Every paired display must be re-paired with the new code.",
  keyspaceExhaustedRotate:
    "The 4-digit PIN keyspace is exhausted for this window. No free code exists that does not collide with another live code.",
  fleetQuota:
    "Fleet quota reached ({quota}). Raise the quota before provisioning another balise.",
  hardwareTaken: "Hardware ID {id} is already provisioned on this platform.",
  failProvision: "Provisioning failed: {detail}",
  sensorProvisioned: "{name} provisioned. Copy the API key now: it will not be shown again.",
  credentialRevoked: "Credential revoked. Re-provision to bring the unit back online.",
  failRotateKey: "Rotation failed: {detail}",
  newKeyIssued: "New key issued. Flash it to the unit: the previous key no longer works.",
  validEmail: "Enter a valid email address.",
  accountReactivated: "{email} is active again, with the modules it held before.",
  accountDeactivated:
    "{email} can no longer reach any module. Its grants are kept.",
  ticketArchived: "Ticket archived.",
  ticketMoved: "Ticket moved.",
  incidentArchived: "Incident archived.",
  incidentClosed: "Incident closed.",
  incidentSuspended: "Incident suspended.",
  onNetworkOff:
    "On-network admission is off for this domain. Codes are required.",
  trustedNetworksUpdated: "Trusted networks updated ({n}).",
  domainSuspended:
    "Domain suspended. Guest PINs and the lobby code stop resolving immediately. Balises keep ingesting.",
  resortNameShort: "Resort name is too short.",
  countryIso: "Country must be a two-letter ISO code.",
  invalidOnboarding: "Invalid onboarding details.",
  noGuestCodeIssued:
    "No guest code was issued ({detail}). Rotate from the resort page.",
  hallDisplayDefaults: "Hall display defaults were not written ({detail}).",
  operatorCannotManage:
    "That address belongs to the platform operator and cannot manage a resort.",
  managerNotCreated:
    "The manager account was not created ({detail}). Invite them from the resort page.",
  twinPublished: "Version {version} registered and published as the live twin.",
  twinDraft: "Version {version} registered as a draft.",
  codeRevoked:
    "Code revoked. Guests holding it lose access immediately. The overlapping code stays valid.",
  hardwareIdCharset:
    "Hardware ID may contain letters, digits, hyphen and underscore only.",
  invalidProvisioning: "Invalid provisioning details.",
  invalidInput: "Invalid input.",
  invalidSuspension: "Invalid suspension request.",
  invalidAssetMeta: "Invalid asset metadata.",
  invalidUpdate: "Invalid update.",
  unknownError: "unknown error",
  invalidCidr:
    "{token} is not a usable prefix. IPv4 must be /8-/32 (not 0.0.0.0); IPv6 /32-/128.",
};
