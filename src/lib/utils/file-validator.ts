import {
  ParseErrorCode,
  type FileValidationResult,
  type SupportedFileType,
} from '@/types/resume';

import {
  MAX_FILE_SIZE_BYTES,
  MAX_FILE_SIZE_LABEL,
  SUPPORTED_MIME_TYPES,
  REJECTED_MIMES,
  EXTENSION_TO_FILE_TYPE,
  SUPPORTED_FORMATS_LABEL,
} from '@/constants/file';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Extracts the lowercase file extension including the dot.
 * Returns an empty string if the filename has no extension.
 *
 * Examples:
 *   "Resume Final.PDF" → ".pdf"
 *   "cv.docx"          → ".docx"
 *   "nodotfile"        → ""
 */
function getExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1 || lastDot === filename.length - 1) return '';
  return filename.slice(lastDot).toLowerCase();
}

/**
 * Resolves the SupportedFileType from a MIME type string.
 * Returns undefined if the MIME is not in SUPPORTED_MIME_TYPES.
 */
function fileTypeFromMime(mime: string): SupportedFileType | undefined {
  const entry = Object.entries(SUPPORTED_MIME_TYPES).find(
    ([, supportedMime]) => supportedMime === mime,
  );
  return entry ? (entry[0] as SupportedFileType) : undefined;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validates an uploaded File object for use with the resume parser.
 *
 * Checks performed in order (fails fast — returns on first failure):
 *  1. File size ≤ MAX_FILE_SIZE_BYTES
 *  2. MIME type is not in the actively-rejected list (e.g. .doc, images)
 *  3. MIME type is a supported format (pdf / docx)
 *  4. File extension maps to a supported format
 *  5. MIME type and extension agree with each other (anti-spoofing)
 *
 * The function returns a discriminated union — callers narrow with:
 *   const result = validateFile(file);
 *   if (!result.valid) return result.error;  // ParseError ready to send
 *   doSomethingWith(result.fileType);        // SupportedFileType confirmed
 *
 * Why File (not Buffer)?
 *   This validator runs on the File object *before* converting to Buffer,
 *   so it can be reused in future client-side pre-validation (e.g. checking
 *   size before even making a network request) as well as in the API route.
 *
 * @param file - The File (or Blob-compatible) object from FormData
 * @returns FileValidationResult — { valid: true, fileType } or { valid: false, error }
 */
export function validateFile(file: File): FileValidationResult {
  // ------------------------------------------------------------------
  // 1. Size check — reject before reading any bytes
  // ------------------------------------------------------------------
  if (file.size > MAX_FILE_SIZE_BYTES) {
    const receivedMB = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: {
        code: ParseErrorCode.FILE_TOO_LARGE,
        message: `File size exceeds the ${MAX_FILE_SIZE_LABEL} limit.`,
        detail: `Received ${receivedMB}MB. Please compress the file or use a smaller resume.`,
      },
    };
  }

  // ------------------------------------------------------------------
  // 2. Actively-rejected MIME types — give specific guidance
  // ------------------------------------------------------------------
  const rejectedMessage = REJECTED_MIMES[file.type];
  if (rejectedMessage) {
    return {
      valid: false,
      error: {
        code: ParseErrorCode.UNSUPPORTED_FILE_TYPE,
        message: rejectedMessage,
        detail: `Received MIME type: ${file.type}`,
      },
    };
  }

  // ------------------------------------------------------------------
  // 3. MIME type check — must be a supported format
  // ------------------------------------------------------------------
  const fileTypeFromMimeResult = fileTypeFromMime(file.type);

  // Some environments (certain OS configs, older browsers) report
  // application/octet-stream for everything. We don't hard-reject that
  // MIME — instead we fall through to the extension check below.
  // Any other unrecognised MIME is rejected here.
  const isOctetStream = file.type === 'application/octet-stream';
  const isMimeUnrecognised = !fileTypeFromMimeResult && !isOctetStream;

  if (isMimeUnrecognised && file.type !== '') {
    return {
      valid: false,
      error: {
        code: ParseErrorCode.UNSUPPORTED_FILE_TYPE,
        message: `Unsupported file type. Please upload a ${SUPPORTED_FORMATS_LABEL} file.`,
        detail: `Received MIME type: "${file.type || '(empty)'}". Expected one of: ${Object.values(SUPPORTED_MIME_TYPES).join(', ')}`,
      },
    };
  }

  // ------------------------------------------------------------------
  // 4. Extension check — must map to a supported format
  // ------------------------------------------------------------------
  const ext = getExtension(file.name);
  const fileTypeFromExt = EXTENSION_TO_FILE_TYPE[ext];

  if (!fileTypeFromExt) {
    return {
      valid: false,
      error: {
        code: ParseErrorCode.UNSUPPORTED_FILE_TYPE,
        message: `Unsupported file extension. Please upload a ${SUPPORTED_FORMATS_LABEL} file.`,
        detail: `Received extension: "${ext || '(none)'}". Accepted: ${Object.keys(EXTENSION_TO_FILE_TYPE).join(', ')}`,
      },
    };
  }

  // ------------------------------------------------------------------
  // 5. MIME ↔ extension mismatch — anti-spoofing check
  //    Skip if MIME is empty or octet-stream (those are unreliable,
  //    not spoofed). Only flag a mismatch when we have a *known* MIME
  //    that disagrees with the extension.
  // ------------------------------------------------------------------
  if (fileTypeFromMimeResult && fileTypeFromMimeResult !== fileTypeFromExt) {
    return {
      valid: false,
      error: {
        code: ParseErrorCode.MIME_EXTENSION_MISMATCH,
        message: "The file's content type does not match its extension.",
        detail: `Extension suggests ${fileTypeFromExt.toUpperCase()} but MIME type is "${file.type}". Please re-save the file and try again.`,
      },
    };
  }

  // ------------------------------------------------------------------
  // All checks passed — extension is authoritative when MIME is absent
  // ------------------------------------------------------------------
  return {
    valid: true,
    fileType: fileTypeFromExt,
  };
}

// ---------------------------------------------------------------------------
// Convenience helper — format bytes into a readable string for error messages
// ---------------------------------------------------------------------------

/**
 * Converts a byte count to a human-readable string.
 * Used in UI components and error detail fields.
 *
 * formatBytes(5242880) → "5.0 MB"
 * formatBytes(512)     → "512 B"
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
