import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';

type Language = 'en' | 'fr';

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
}

export const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [lang, setLang] = useState<Language>('en');

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within a LanguageProvider");
  return context;
};

export const t = (key: string, lang: Language): string => {
  return (dict[lang] as any)[key] || key;
};

const dict = {
  en: {
    goc: "Government of Canada",
    canada_ca: "Canada.ca",
    app_title: "Secure File Request Portal",
    about: "About government",
    contact: "Contact us",
    departments: "Departments and agencies",
    public_service: "Public service and military",
    social: "Social media",
    mobile: "Mobile applications",
    about_site: "About Canada.ca",
    terms: "Terms and conditions",
    privacy: "Privacy",
    login_req: "Employee Login Required",
    login_desc: "You must authenticate via Government of Canada Azure AD to create file upload requests.",
    sign_in: "Sign in with Microsoft",
    logout: "Logout",
    logged_in_as: "Logged in as",
    lang_toggle: "Français",
    dashboard_title: "Requestor Dashboard",
    dashboard_desc: "Securely issue file upload requests to external users.",
    create_request: "Create New Request",
    active_requests: "Active and Historical Requests",
    refresh: "Refresh List",
    no_requests: "No file requests have been made yet.",
    uploader_email: "Uploader Email Address",
    allowed_types: "Allowed File Types",
    link_exp: "Link Expiration",
    secret: "Secret Passcode",
    submit: "Submit and Send Email",
    cancel: "Cancel",
    days: "Days",
    day: "Day",
    req_details: "Request Details",
    required: "(required)",
    hint_email: "The external user who will receive the upload link.",
    hint_types: "Comma separated list (e.g., pdf, xlsx, docx).",
    hint_secret: "The uploader must enter this passcode to access the secure upload zone.",
    table_uploader: "Uploader",
    table_type: "File Types",
    table_status: "Status",
    table_expires: "Expires At",
    table_action: "Action",
    download: "Download",
    loading: "Loading Request...",
    fulfilled: "Request Fulfilled",
    fulfilled_desc: "This request has already been processed.",
    invalid_link: "Invalid Link",
    invalid_link_desc: "This link is invalid or has expired.",
    success: "Success!",
    success_desc: "Your file was securely uploaded and transmitted to the requestor.",
    portal_title: "Secure Document Submission Portal",
    portal_desc: "Submit documents securely to the Government of Canada.",
    auth_req: "Authentication Required",
    auth_req_desc: "Please enter the secret passcode provided to you by the requestor to access the upload portal.",
    access_portal: "Access Portal",
    upload_doc: "Upload Document",
    allowed_file_types: "Allowed file types:",
    selected: "Selected:",
    click_drag: "Click to browse or drag & drop a file here.",
    encrypting: "Encrypting and Transmitting...",
    submit_doc: "Submit Document",
    allow_multiple: "Allow Multiple Files",
    download_portal_title: "Secure Download Portal",
    download_portal_desc: "Enter passcode sent by the requestor to retrieve the file(s).",
    validate_passcode: "Validate Passcode",
    available_files: "Available files for download:",
    no_files_available: "No files are currently ready for download.",
    download_error: "Failed to generate download link. Check passcode or request status."
  },
  fr: {
    goc: "Gouvernement du Canada",
    canada_ca: "Canada.ca",
    app_title: "Portail Sécurisé de Demande de Fichiers",
    about: "À propos du gouvernement",
    contact: "Contactez-nous",
    departments: "Ministères et organismes",
    public_service: "Fonction publique et force militaire",
    social: "Médias sociaux",
    mobile: "Applications mobiles",
    about_site: "À propos de Canada.ca",
    terms: "Avis",
    privacy: "Confidentialité",
    login_req: "Connexion d'employé requise",
    login_desc: "Vous devez vous authentifier via Azure AD du GC pour créer des demandes de téléversement.",
    sign_in: "Se connecter avec Microsoft",
    logout: "Déconnexion",
    logged_in_as: "Connecté en tant que",
    lang_toggle: "English",
    dashboard_title: "Tableau de Bord du Demandeur",
    dashboard_desc: "Émettez des demandes de fichiers de manière sécurisée aux utilisateurs externes.",
    create_request: "Créer une Nouvelle Demande",
    active_requests: "Demandes Actives et Historiques",
    refresh: "Actualiser la Liste",
    no_requests: "Aucune demande de fichier n'a encore été effectuée.",
    uploader_email: "Adresse Courriel de l'expéditeur",
    allowed_types: "Types de Fichiers Autorisés",
    link_exp: "Date d'expiration du Lien",
    secret: "Code Secret",
    submit: "Soumettre et Envoyer le Courriel",
    cancel: "Annuler",
    days: "Jours",
    day: "Jour",
    req_details: "Détails de la demande",
    required: "(requis)",
    hint_email: "L'utilisateur externe qui recevra le lien.",
    hint_types: "Liste séparée par des virgules (ex: pdf, xlsx).",
    hint_secret: "L'expéditeur devra saisir ce code.",
    table_uploader: "Expéditeur",
    table_type: "Format",
    table_status: "Statut",
    table_expires: "Expiration",
    table_action: "Action",
    download: "Télécharger",
    loading: "Chargement de la demande...",
    fulfilled: "Demande Traitée",
    fulfilled_desc: "Cette demande a déjà été complétée.",
    invalid_link: "Lien Invalide",
    invalid_link_desc: "Ce lien est invalide ou a expiré.",
    success: "Succès!",
    success_desc: "Votre fichier a été téléversé et transmis de manière sécurisée.",
    portal_title: "Portail de Soumission Sécurisée de Documents",
    portal_desc: "Soumettez des documents de manière sécurisée au Gouvernement du Canada.",
    auth_req: "Authentification Requise",
    auth_req_desc: "Veuillez entrer le code secret fourni par le demandeur pour accéder au portail de téléversement.",
    access_portal: "Accéder au Portail",
    upload_doc: "Téléverser un Document",
    allowed_file_types: "Types de fichiers autorisés:",
    selected: "Sélectionné:",
    click_drag: "Cliquez pour parcourir ou glissez-déposez un fichier ici.",
    encrypting: "Chiffrement et Transmission...",
    submit_doc: "Soumettre le Document",
    allow_multiple: "Autoriser Multiples Fichiers",
    download_portal_title: "Portail de Téléchargement Sécurisé",
    download_portal_desc: "Entrez le code d'accès envoyé par le demandeur pour récupérer le(s) fichier(s).",
    validate_passcode: "Valider le Code",
    available_files: "Fichiers disponibles au téléchargement:",
    no_files_available: "Aucun fichier n'est actuellement prêt au téléchargement.",
    download_error: "Échec de la génération du lien de téléchargement. Vérifiez le code d'accès ou l'état de la demande."
  }
};
