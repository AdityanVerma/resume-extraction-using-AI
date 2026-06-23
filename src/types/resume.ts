// ---------------------------------------------------------------------------
// Supported file types
// ---------------------------------------------------------------------------

/**
 * The two file formats Phase 1 supports.
 * Keeping this as a union (not a generic string) means TypeScript will catch
 * any branch of code that forgets to handle one of the formats.
 */
export type SupportedFileType = 'pdf' | 'docx';

// ---------------------------------------------------------------------------
// Parser layer — what lib/parsers/* returns
// ---------------------------------------------------------------------------

/**
 * Successful result from any parser (pdf-parser.ts or docx-parser.ts).
 * The parsers themselves return this shape; the API route wraps it in
 * ApiSuccessResponse before sending it over the wire.
 */
export interface ParsedTextResult {
  /** Raw extracted text, exactly as the parser produced it. No trimming,
   *  no field splitting, no normalization — that is Gemini's job in Phase 2. */
  rawText: string;

  /** Which parser produced this result. Useful for debugging and for the
   *  Phase 2 prompt builder to know what kind of document it is reading. */
  fileType: SupportedFileType;

  /** Total character count of rawText. Used to detect scanned PDFs (charCount
   *  of 0 on a non-empty file means no text layer was found). */
  charCount: number;
}

// ---------------------------------------------------------------------------
// Error codes
// Enumerated as a const object so they can be used as both types and values
// without importing an enum (enums have pitfalls with strict module isolation).
// ---------------------------------------------------------------------------

export const ParseErrorCode = {
  /** The request arrived with no file attached. */
  NO_FILE: 'NO_FILE',

  /** The file's MIME type or extension is not PDF or DOCX. */
  UNSUPPORTED_FILE_TYPE: 'UNSUPPORTED_FILE_TYPE',

  /** The file exceeds the configured size limit. */
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',

  /** The file has a supported extension but is internally corrupt
   *  (e.g. a DOCX that is not a valid ZIP, a PDF with a broken xref table). */
  CORRUPT_FILE: 'CORRUPT_FILE',

  /** The PDF contained no extractable text layer — it is likely a scanned image.
   *  OCR is out of scope for Phase 1. */
  SCANNED_PDF: 'SCANNED_PDF',

  /** pdf-parse or mammoth threw an unexpected error. */
  PARSE_FAILED: 'PARSE_FAILED',

  /** The file's MIME type and its extension disagree (e.g. a PNG renamed to .pdf).
   *  We reject rather than guess. */
  MIME_EXTENSION_MISMATCH: 'MIME_EXTENSION_MISMATCH',
} as const;

/** The string-literal union of all error codes, derived from the object above.
 *  Use this as a type annotation; use ParseErrorCode.X as a value. */
export type ParseErrorCode =
  (typeof ParseErrorCode)[keyof typeof ParseErrorCode];

// ---------------------------------------------------------------------------
// Structured error shape — used inside API error responses
// ---------------------------------------------------------------------------

export interface ParseError {
  /** Machine-readable code for programmatic handling on the client side. */
  code: ParseErrorCode;

  /** Human-readable description safe to display in the UI. */
  message: string;

  /** Optional extra detail — file name, received MIME, etc. — to aid debugging.
   *  Never include stack traces or internal paths here. */
  detail?: string;
}

// ---------------------------------------------------------------------------
// API response envelope
// ---------------------------------------------------------------------------

/**
 * Shape returned by POST /api/parse-resume on success.
 * The `success: true` discriminant lets TypeScript narrow the union in the
 * frontend without an `if ("data" in response)` check.
 */
export interface ApiSuccessResponse {
  success: true;
  data: ParsedTextResult;
}

/**
 * Shape returned by POST /api/parse-resume on any error.
 */
export interface ApiErrorResponse {
  success: false;
  error: ParseError;
}

/**
 * The full discriminated union of everything the API can return.
 * Import this type in page.tsx and route.ts.
 *
 * Usage in the frontend:
 *   const result: ApiResponse = await res.json();
 *   if (result.success) {
 *     console.log(result.data.rawText); // TypeScript knows data exists
 *   } else {
 *     console.error(result.error.code); // TypeScript knows error exists
 *   }
 */
export type ApiResponse = ApiSuccessResponse | ApiErrorResponse;

// ---------------------------------------------------------------------------
// File validation — what file-validator.ts returns
// ---------------------------------------------------------------------------

/**
 * Returned by validateFile() in lib/utils/file-validator.ts.
 * Also a discriminated union so callers can narrow without casting.
 */
export type FileValidationResult =
  | { valid: true; fileType: SupportedFileType }
  | { valid: false; error: ParseError };
