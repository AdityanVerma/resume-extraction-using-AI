import { PDFParse } from 'pdf-parse';

import { ParseErrorCode, type ParseError } from '@/types/resume';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Internal result shape returned by parsePdf().
 * The dispatcher (index.ts) reads these fields and builds ParsedTextResult.
 * We keep this internal — nothing outside the parsers/ directory imports it.
 */
interface PdfParseOutput {
  rawText: string;
  pageCount: number;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Extracts all text from a PDF file buffer.
 *
 * Responsibilities:
 *   - Call pdf-parse on the buffer
 *   - Strip null bytes that pdf-parse emits for some malformed PDFs
 *   - Return raw text as-is — no trimming, no field extraction
 *
 * NOT responsible for:
 *   - Detecting whether the text is "enough" (scanned PDF check) — that lives
 *     in index.ts so the threshold is centralised across both parsers
 *   - HTTP concerns, FormData, or anything outside the Buffer → string contract
 *
 * Throws a typed ParseError (never a raw Error) so the dispatcher can
 * catch a single type and forward it to the API route without branching.
 *
 * @param buffer - Raw bytes of the uploaded PDF file
 * @returns PdfParseOutput containing rawText and pageCount
 * @throws ParseError with code CORRUPT_FILE or PARSE_FAILED
 */
export async function parsePdf(buffer: Buffer): Promise<PdfParseOutput> {
  let result: Awaited<ReturnType<typeof PDFParse>>;

  try {
    // pdf-parse options:
    //   max: 0  → parse ALL pages (default 0 already, but explicit is safer)
    //   We do NOT pass a custom pagerender because we want plain text,
    //   not layout-aware text — Gemini reconstructs structure in Phase 2.
    result = await PDFParse(buffer, { max: 0 });
  } catch (err) {
    // pdf-parse throws a plain Error for encrypted PDFs, broken xref tables,
    // and files that claim to be PDFs but are not. We classify them here.
    const message =
      err instanceof Error ? err.message.toLowerCase() : String(err);

    // Encrypted / password-protected PDFs produce a specific error message.
    const isEncrypted =
      message.includes('encrypted') ||
      message.includes('password') ||
      message.includes('decrypt');

    // Corrupt or truncated files produce parser-level failures.
    const isCorrupt =
      message.includes('invalid pdf') ||
      message.includes('bad xref') ||
      message.includes('unexpected end') ||
      message.includes('formbytes') ||
      message.includes('cannot read');

    if (isEncrypted) {
      throw {
        code: ParseErrorCode.CORRUPT_FILE,
        message:
          'This PDF is password-protected and cannot be parsed. Please remove the password and try again.',
        detail: `pdf-parse error: ${message}`,
      } satisfies ParseError;
    }

    if (isCorrupt) {
      throw {
        code: ParseErrorCode.CORRUPT_FILE,
        message:
          'The PDF file appears to be corrupt or incomplete and could not be parsed.',
        detail: `pdf-parse error: ${message}`,
      } satisfies ParseError;
    }

    // Unknown pdf-parse error — wrap it so no raw Error escapes this module.
    throw {
      code: ParseErrorCode.PARSE_FAILED,
      message: 'An unexpected error occurred while parsing the PDF.',
      detail: `pdf-parse error: ${message}`,
    } satisfies ParseError;
  }

  // --------------------------------------------------------------------------
  // Post-process the extracted text
  // --------------------------------------------------------------------------

  let rawText = result.text;

  // pdf-parse occasionally emits null bytes (\x00) from PDFs that use
  // custom encodings or have corrupt character maps. These bytes would
  // corrupt JSON serialization and confuse Gemini in Phase 2.
  rawText = rawText.replace(/\x00/g, '');

  // Normalize Windows-style line endings to Unix (\n) for consistency.
  // We do NOT collapse whitespace or trim — that is Gemini's responsibility.
  rawText = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  return {
    rawText,
    pageCount: result.numpages,
  };
}
