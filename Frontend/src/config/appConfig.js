const env = import.meta.env || {};

const normalizeBaseUrl = (value) => (value || '/api').replace(/\/$/, '');

export const APP_CONFIG = Object.freeze({
  apiBaseUrl: normalizeBaseUrl(env.VITE_API_BASE_URL),
  locale: env.VITE_APP_LOCALE || 'en-IN',
  brand: Object.freeze({
    name: env.VITE_APP_NAME || 'RR Assistant',
    subtitle: env.VITE_APP_SUBTITLE || 'Revenue Recovery Proceedings',
    officeName: env.VITE_OFFICE_NAME || 'District Collectorate',
    emblemPath: env.VITE_EMBLEM_PATH || '/assets/tn_emblem.svg',
    mottos: Object.freeze([
      Object.freeze({ lang: 'ta', line1: 'மக்களின் குரல்,', line2: 'அரசின் செயல்.' }),
      Object.freeze({ lang: 'en', line1: 'Listening to Citizens,', line2: 'Acting with Precision.' }),
    ]),
  }),
  defaults: Object.freeze({ language: 'en', theme: 'dark', templateCode: '' }),
  timeouts: Object.freeze({
    healthMs: 4_000,
    documentProcessingMs: 900_000,
    downloadUrlRevokeMs: 60_000,
  }),
});

export const STORAGE_KEYS = Object.freeze({
  users: 'rr_admin_users',
  credentials: 'rr_account_credentials',
  auditLogs: 'rr_audit_logs',
  draft: 'rr_draft',
  preferences: 'rr_preferences',
  activity: 'rr_activity_history',
  backupHistory: 'rr_backup_history',
  authToken: 'rr_auth_token',
  notificationPrefix: 'rr_notifications_seen_',
});

export const APP_EVENTS = Object.freeze({
  activityUpdated: 'rr-activity-updated',
  auditLogsUpdated: 'rr-audit-logs-updated',
});

export const UPLOAD_CONFIG = Object.freeze({
  accept: '.pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,application/pdf',
  extensions: Object.freeze(['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.doc', '.docx']),
  supportedLabel: 'PDF, JPG, PNG, WEBP, DOC, or DOCX',
});

export const EMPTY_ENTITIES = Object.freeze({
  department_type: '',
  case_details: Object.freeze({ court_name: '', court_location: '', case_number: '', order_in_original_no: '', file_number: '', court_order_date: '', certificate_date: '' }),
  legal_acts: Object.freeze({ primary_act: '', primary_act_section: '', recovery_act: '', standing_order: '', revenue_standing_order: '', other_sections: Object.freeze([]) }),
  defaulter: Object.freeze({ name: '', iec_number: '', door_no: '', street_area: '', village: '', taluk: '', district: '', pincode: '', full_address: '' }),
  beneficiary: Object.freeze({ name: '', address: '', head_of_account: '', payment_mode: '' }),
  financials: Object.freeze({ principal_amount: 0, penalty_amount: 0, formatted_amount: '', amount_in_words_tamil: '', interest_applicable: false, total_recoverable_amount: 0 }),
  jurisdiction: Object.freeze({ district: '', taluk: '', tahsildar_title: '', rdo_title: '', collector_name: '', collector_designation: '' }),
  proceedings_roc_number: '', proceedings_date: '', enclosures: Object.freeze([]), copy_recipients: Object.freeze([]),
});

export const EMPTY_VALIDATION = Object.freeze({
  math_valid: false, math_details: '', jurisdiction_routed: false, routed_taluk: '', routed_district: '',
  interest_applied: false, interest_calculation_breakdown: '', tamil_amount_words: '', warnings: Object.freeze([]),
  grounding_score: 0, hallucination_score: 0,
});
