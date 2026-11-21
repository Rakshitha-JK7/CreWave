/**
 * Status helper utilities for CareWave.
 * Returns human-readable labels and CSS badge class names for all status values.
 */

/* ============================================================
   CONSULTATION STATUS
   ============================================================ */

const CONSULTATION_STATUS_MAP = {
  draft:               { label: 'Draft',              color: 'badge-secondary' },
  pending_upload:      { label: 'Pending Upload',     color: 'badge-warning'   },
  uploading:           { label: 'Uploading',          color: 'badge-info'      },
  partially_uploaded:  { label: 'Partial Upload',     color: 'badge-warning'   },
  delivered:           { label: 'Delivered',          color: 'badge-secondary' },
  under_review:        { label: 'Under Review',       color: 'badge-purple'    },
  response_available:  { label: 'Response Available', color: 'badge-success'   },
  completed:           { label: 'Completed',          color: 'badge-success'   },
  failed:              { label: 'Failed',             color: 'badge-danger'    },
}

/**
 * Returns a human-readable label for a consultation status.
 * @param {string} status
 * @returns {string}
 */
export function getConsultationStatusLabel(status) {
  return CONSULTATION_STATUS_MAP[status]?.label ?? status ?? 'Unknown'
}

/**
 * Returns a CSS badge class for a consultation status.
 * @param {string} status
 * @returns {string}
 */
export function getConsultationStatusColor(status) {
  return CONSULTATION_STATUS_MAP[status]?.color ?? 'badge-secondary'
}

/* ============================================================
   ATTACHMENT STATUS
   ============================================================ */

const ATTACHMENT_STATUS_MAP = {
  pending:         { label: 'Pending',    color: 'badge-warning'   },
  queued:          { label: 'Queued',     color: 'badge-warning'   },
  uploading:       { label: 'Uploading',  color: 'badge-info'      },
  uploaded:        { label: 'Uploaded',   color: 'badge-success'   },
  failed:          { label: 'Failed',     color: 'badge-danger'    },
  partial:         { label: 'Partial',    color: 'badge-warning'   },
}

/**
 * Returns a human-readable label for an attachment status.
 * @param {string} status
 * @returns {string}
 */
export function getAttachmentStatusLabel(status) {
  return ATTACHMENT_STATUS_MAP[status]?.label ?? status ?? 'Unknown'
}

/**
 * Returns a CSS badge class for an attachment status.
 * @param {string} status
 * @returns {string}
 */
export function getAttachmentStatusColor(status) {
  return ATTACHMENT_STATUS_MAP[status]?.color ?? 'badge-secondary'
}

/* ============================================================
   REVIEW STATUS (Doctor side)
   ============================================================ */

const REVIEW_STATUS_MAP = {
  not_reviewed:   { label: 'Not Reviewed',  color: 'badge-secondary' },
  in_progress:    { label: 'In Progress',   color: 'badge-info'      },
  reviewed:       { label: 'Reviewed',      color: 'badge-success'   },
  needs_followup: { label: 'Follow-up Needed', color: 'badge-warning' },
  escalated:      { label: 'Escalated',     color: 'badge-danger'    },
  closed:         { label: 'Closed',        color: 'badge-secondary' },
}

/**
 * Returns a human-readable label for a review status.
 * @param {string} status
 * @returns {string}
 */
export function getReviewStatusLabel(status) {
  return REVIEW_STATUS_MAP[status]?.label ?? status ?? 'Unknown'
}

/**
 * Returns a CSS badge class for a review status.
 * @param {string} status
 * @returns {string}
 */
export function getReviewStatusColor(status) {
  return REVIEW_STATUS_MAP[status]?.color ?? 'badge-secondary'
}

/* ============================================================
   URGENCY
   ============================================================ */

const URGENCY_MAP = {
  low:      { label: 'Low',      color: 'badge-success'   },
  normal:   { label: 'Normal',   color: 'badge-info'      },
  high:     { label: 'High',     color: 'badge-warning'   },
  urgent:   { label: 'Urgent',   color: 'badge-danger'    },
  critical: { label: 'Critical', color: 'badge-danger'    },
}

/**
 * Returns a human-readable label for an urgency level.
 * @param {string} urgency
 * @returns {string}
 */
export function getUrgencyLabel(urgency) {
  return URGENCY_MAP[urgency]?.label ?? urgency ?? 'Unknown'
}

/**
 * Returns a CSS badge class for an urgency level.
 * @param {string} urgency
 * @returns {string}
 */
export function getUrgencyColor(urgency) {
  return URGENCY_MAP[urgency]?.color ?? 'badge-secondary'
}
