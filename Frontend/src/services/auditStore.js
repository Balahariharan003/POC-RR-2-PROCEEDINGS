/**
 * Audit Store - Manages local and synchronized audit ledger records.
 * Clean, production storage reader without simulated fixtures.
 */
import { STORAGE_KEYS } from '../config/appConfig.js';

export function readSavedAuditLogs() {
  let saved;
  try {
    saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.auditLogs) || '{}');
  } catch {
    throw new Error('Unable to load saved audit records.');
  }
  if (!saved || typeof saved !== 'object' || Array.isArray(saved) || Object.values(saved).some(rows => !Array.isArray(rows))) {
    throw new Error('Unable to load saved audit records.');
  }
  return saved;
}

/**
 * Determines whether an audit log entry represents an actual Revenue Recovery (RR) proceeding
 * session / order vs a general system, authentication, user management, or backup audit log.
 */
export function isRRProceeding(record) {
  if (!record || typeof record !== 'object') return false;

  const action = String(record.action || '').toUpperCase().trim();
  const fileId = String(record.file_id || record.fileName || record.orderId || '').toUpperCase().trim();
  const caseNumber = String(record.caseNumber || record.case_file_no || record.rrNumber || '').toUpperCase().trim();

  // Explicit non-RR administrative/system/auth action keywords
  const nonProceedingActions = [
    'LOGIN',
    'LOGOUT',
    'AUTH_FAILED',
    'AUTH_SUCCESS',
    'TOKEN_REFRESH',
    'SYSTEM_BACKUP',
    'BACKUP_CREATED',
    'BACKUP_RESTORED',
    'SYSTEM_RESTORE',
    'SYSTEM_RESET',
    'USER_CREATED',
    'USER_UPDATED',
    'USER_DELETED',
    'OFFICER_CREATED',
    'OFFICER_UPDATED',
    'OFFICER_DELETED',
    'TEMPLATE_CREATED',
    'TEMPLATE_UPDATED',
    'TEMPLATE_DELETED',
    'PASSWORD_RESET',
    'PASSWORD_CHANGED',
    'SETTINGS_UPDATED',
    'REPORT',
    'SYSTEM_REPORT',
    'REPORT_EXPORTED',
    'REPORT_GENERATED',
    'LANGUAGE CHANGED'
  ];

  if (nonProceedingActions.some(act => action === act || action.startsWith(act + '_') || action.startsWith(act + ' '))) {
    return false;
  }

  if (
    fileId.startsWith('BACKUP-') ||
    fileId.startsWith('RESTORE-') ||
    fileId.startsWith('REPORT-') ||
    fileId === 'LOGIN' ||
    fileId === 'LOGOUT'
  ) {
    return false;
  }

  if (
    caseNumber.startsWith('BACKUP-') ||
    caseNumber.startsWith('RESTORE-') ||
    caseNumber.startsWith('REPORT-') ||
    caseNumber === 'LOGIN' ||
    caseNumber === 'LOGOUT'
  ) {
    return false;
  }

  // If details exist and indicate a system backup/report/user admin action
  const details = record.details;
  if (details && typeof details === 'object') {
    if (
      details.restored_counts ||
      details.backup_checksum ||
      details.tables_exported ||
      details.total_proceedings !== undefined ||
      details.generated_at !== undefined ||
      (details.template_code && !details.caseNumber)
    ) {
      return false;
    }
  }

  // Positive indicators for RR proceedings
  if (
    action.includes('PROCEEDING') ||
    action.includes('DOCUMENT') ||
    action.includes('DRAFT') ||
    action.includes('VERIFIED') ||
    action.includes('DISPATCH') ||
    action.includes('FLAGGED')
  ) {
    return true;
  }

  if (
    record.documentContent ||
    record.documentLayout ||
    (Array.isArray(record.promptHistory) && record.promptHistory.length > 0) ||
    record.rrNumber ||
    record.proceedings_roc_number
  ) {
    return true;
  }

  // Status indicator
  const status = String(record.status || '').toUpperCase().trim();
  if (['DRAFT', 'VERIFIED', 'DISPATCHED', 'DISPATCHED_TO_DRO', 'FLAGGED', 'FLAGGED_FOR_REVIEW'].includes(status)) {
    return true;
  }

  // Document file name
  if (record.fileName && /\.(pdf|docx|doc|png|jpg|jpeg)$/i.test(record.fileName)) {
    return true;
  }

  // If there is a caseNumber or orderId that is not an action name or ID
  if (record.caseNumber && record.caseNumber !== record.action && record.caseNumber !== record.id) {
    return true;
  }

  return false;
}

