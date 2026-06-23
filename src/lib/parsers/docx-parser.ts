import mammoth from 'mammoth';

import { ParseErrorCode, type ParseError } from '@/types/resume';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Internal result shape returned by parseDocx().
 * Mirrors PdfParseOutput structurally so index.ts can handle both uniformly,
 * but DOCX does not have a native "page count" concept — we use wordCount
 * instead, which is more meaningful for text content and useful for debugging.
 */
interface DocxParseOutput {
  rawText: string;
  wordCount: number;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Extracts all text from a DOCX file buffer.
 *
 * Responsibilities:
 *   - Call mammoth.extractRawText() on the buffer
 *   - Surface mammoth warnings via ParseError rather than silently swallowing
 *   - Return raw text as-is — no trimming, no field extraction
 *
 * NOT responsible for:
 *   - Scanned-PDF-equivalent checks (DOCX files always contain text if valid)
 *   - HTTP concerns, FormData, or anything outside the Buffer → string contract
 *
 * Why extractRawText() and NOT convertToHtml()?
 *   convertToHtml() embeds <p>, <strong>, <table> tags in the output. Those
 *   tags would then appear verbatim in the rawText string that gets sent to
 *   Gemini in Phase 2, forcing the AI prompt to strip HTML before reading
 *   content — a fragile, unnecessary step. extractRawText() gives a clean
 *   plain-text string with paragraph breaks as newlines.
 *
 * Throws a typed ParseError (never a raw Error) so the dispatcher can
 * catch a single type and forward it to the API route without branching.
 *
 * @param buffer - Raw bytes of the uploaded DOCX file
 * @returns DocxParseOutput containing rawText and wordCount
 * @throws ParseError with code CORRUPT_FILE or PARSE_FAILED
 */
export async function parseDocx(buffer: Buffer): Promise<DocxParseOutput> {
  let result: Awaited<ReturnType<typeof mammoth.extractRawText>>;

  try {
    // mammoth accepts a buffer directly via the { buffer } option.
    // It also accepts file paths, but we never write to disk in this prototype.
    result = await mammoth.extractRawText({ buffer });
  } catch (err) {
    // mammoth throws when the buffer is not a valid ZIP archive (which DOCX is
    // built on). This covers: corrupt files, truncated uploads, files that were
    // renamed to .docx but are not actually DOCX, and old .doc binary format.
    const message =
      err instanceof Error ? err.message.toLowerCase() : String(err);

    const isWrongFormat =
      message.includes('end of central directory') ||
      message.includes('not a valid zip') ||
      message.includes('unexpected end of file') ||
      message.includes('invalid signature') ||
      message.includes('olefile'); // old .doc binary format marker

    if (isWrongFormat) {
      throw {
        code: ParseErrorCode.CORRUPT_FILE,
        message:
          'The file could not be read as a DOCX document. It may be corrupt, truncated, or saved in the old .doc binary format.',
        detail: `mammoth error: ${message}`,
      } satisfies ParseError;
    }

    throw {
      code: ParseErrorCode.PARSE_FAILED,
      message: 'An unexpected error occurred while parsing the DOCX file.',
      detail: `mammoth error: ${message}`,
    } satisfies ParseError;
  }

  // --------------------------------------------------------------------------
  // Surface mammoth warnings without crashing
  //
  // mammoth.messages is an array of { type, message } objects. Type can be
  // "warning" or "error". A warning means mammoth partially succeeded —
  // for example, it could not convert a complex table cell but still extracted
  // the surrounding paragraph text. We log all warnings to detail and
  // continue, because partial text is still useful for Gemini in Phase 2.
  //
  // A mammoth "error" in result.messages (distinct from a thrown exception)
  // also usually means partial success. We treat it the same as a warning
  // for Phase 1 — the prototype is not production hardened.
  // --------------------------------------------------------------------------

  const warnings = result.messages
    .map((m) => `[${m.type}] ${m.message}`)
    .join('; ');

  // If mammoth produced messages but still returned text, we continue.
  // If mammoth produced messages AND returned no text, that is a failure.
  if (result.value.trim().length === 0 && result.messages.length > 0) {
    throw {
      code: ParseErrorCode.PARSE_FAILED,
      message:
        'The DOCX file could not be parsed — it may contain only images or unsupported content.',
      detail: `mammoth warnings: ${warnings}`,
    } satisfies ParseError;
  }

  // --------------------------------------------------------------------------
  // Post-process the extracted text
  // --------------------------------------------------------------------------

  let rawText = result.value;

  // Normalize line endings for consistency with the PDF parser output.
  rawText = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // mammoth sometimes produces runs of 3+ consecutive blank lines from
  // heavily formatted DOCX templates (section dividers, empty table rows).
  // We collapse them to a maximum of two newlines so the rawText is readable
  // without altering actual content structure.
  // We do NOT trim or collapse single newlines — those represent real
  // paragraph boundaries that Gemini should see.
  rawText = rawText.replace(/\n{3,}/g, '\n\n');

  // Word count: split on whitespace runs, filter empty strings.
  // This is an approximation — good enough for debugging and logging.
  const wordCount = rawText
    .split(/\s+/)
    .filter((word) => word.length > 0).length;

  return {
    rawText,
    wordCount,
  };
}
