import type { SupportedFileType } from '@/types/resume';

// ---------------------------------------------------------------------------
// Size limits
// ---------------------------------------------------------------------------

/** 5 MB expressed in bytes. Used in the API route and the frontend file input.
 *  Changing this one value enforces the limit in both places automatically. */
export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5_242_880

/** Human-readable version for error messages and UI hints. */
export const MAX_FILE_SIZE_LABEL = '5MB';

// ---------------------------------------------------------------------------
// MIME types
// ---------------------------------------------------------------------------

/**
 * The canonical MIME type for each supported format.
 * These are what browsers set on File.type for genuine PDF and DOCX uploads.
 *
 * Note: older Word documents use application/msword (.doc), which is NOT
 * supported. We list it in REJECTED_MIMES so we can give a specific error
 * message instead of a generic "unsupported type" one.
 */
export const SUPPORTED_MIME_TYPES: Record<SupportedFileType, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

/**
 * MIME types we actively recognize and reject with a specific message.
 * Without this list, a .doc upload would get a generic "unsupported" error.
 * With it, we can say "Old .doc format is not supported — please save as .docx".
 */
export const REJECTED_MIMES: Record<string, string> = {
  'application/msword':
    'Old .doc format is not supported. Please save the file as .docx and try again.',
  'image/jpeg':
    'Image files cannot be parsed. Please upload a PDF or DOCX resume.',
  'image/png':
    'Image files cannot be parsed. Please upload a PDF or DOCX resume.',
  'text/plain':
    'Plain text files are not supported. Please upload a PDF or DOCX resume.',
};

// ---------------------------------------------------------------------------
// File extensions
// ---------------------------------------------------------------------------

/**
 * Allowed file extensions, mapped to their SupportedFileType.
 * Used as the second line of defense when MIME type is unreliable
 * (e.g. some email clients strip MIME on attachments, some OS configurations
 * report application/octet-stream for everything).
 *
 * Keys are lowercase with the leading dot.
 */
export const EXTENSION_TO_FILE_TYPE: Record<string, SupportedFileType> = {
  '.pdf': 'pdf',
  '.docx': 'docx',
};

/**
 * The accept string for the HTML <input type="file"> element.
 * Lists both MIME types and extensions so the OS file picker filters
 * correctly across Windows, macOS, and Linux.
 */
export const ACCEPTED_FILE_INPUT_TYPES =
  '.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

// ---------------------------------------------------------------------------
// Validation rules — referenced in error messages
// ---------------------------------------------------------------------------

/** Displayed in UI hints and validation error detail fields. */
export const SUPPORTED_FORMATS_LABEL = 'PDF or DOCX';

/**
 * Minimum rawText character count below which we consider a PDF to have
 * no extractable text layer (i.e. it is a scanned image PDF).
 * 10 chars is generous — a real resume will have thousands.
 * This threshold prevents false positives from PDFs that contain only
 * a single character of metadata text.
 */
export const MIN_CHARS_FOR_VALID_TEXT = 10;
