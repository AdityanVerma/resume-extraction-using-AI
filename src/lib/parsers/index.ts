import { parsePdf } from './pdf-parser';
import { parseDocx } from './docx-parser';

import {
  ParseErrorCode,
  type ParsedTextResult,
  type ParseError,
  type SupportedFileType,
} from '@/types/resume';
import {
  MIN_CHARS_FOR_VALID_TEXT,
  MIN_CHARACTER_COUNT,
  MAX_PAGE_COUNT,
  MAX_CHARACTER_COUNT,
} from '@/constants/file';

// ---------------------------------------------------------------------------
// Public API — the ONLY export route.ts imports from the parsers layer
// ---------------------------------------------------------------------------

/**
 * Dispatches a file buffer to the correct parser based on its confirmed type,
 * then builds and returns the canonical ParsedTextResult.
 *
 * This function is the single entry point for all parsing logic. route.ts
 * calls extractTextFromFile() and never imports pdf-parser or docx-parser
 * directly. That boundary means:
 *   - Adding a new format = add a parser file + one case here. route.ts unchanged.
 *   - Swapping pdf-parse for another library = change pdf-parser.ts only.
 *
 * Preconditions (enforced by the call site in route.ts):
 *   - `buffer` contains the raw bytes of the uploaded file
 *   - `fileType` has already been validated by file-validator.ts — it is
 *     guaranteed to be "pdf" or "docx". This function does NOT re-validate.
 *
 * Scanned PDF detection lives here (not in pdf-parser.ts) because:
 *   - It depends on MIN_CHARS_FOR_VALID_TEXT, a cross-cutting constant
 *   - It is a policy decision ("how much text is enough?") not a parsing concern
 *   - If we add OCR in Phase 3, we change this one function, not the parser
 *
 * Throws a typed ParseError. Never throws a raw Error.
 * The caller (route.ts) wraps this in a single try/catch.
 *
 * @param buffer   - Raw bytes of the uploaded file, already read from FormData
 * @param fileType - Validated SupportedFileType from file-validator.ts
 * @returns ParsedTextResult ready to embed in ApiSuccessResponse
 * @throws ParseError
 */
export async function extractTextFromFile(
  buffer: Buffer,
  fileType: SupportedFileType,
): Promise<ParsedTextResult> {
  switch (fileType) {
    // -----------------------------------------------------------------------
    case 'pdf': {
      const { rawText, pageCount } = await parsePdf(buffer);

      // Scanned PDF detection:
      // If pdf-parse ran without throwing but produced fewer than
      // MIN_CHARS_FOR_VALID_TEXT characters, the PDF has no embedded text
      // layer. It is almost certainly a scanned image. OCR is Phase 3+.
      // 1. Scanned PDF
      if (rawText.length < MIN_CHARS_FOR_VALID_TEXT) {
        throw {
          code: ParseErrorCode.SCANNED_PDF,
          message:
            'This PDF appears to be a scanned image and contains no extractable text. Please upload a PDF with a text layer, or convert the file to DOCX.',
          detail: `Extracted character count: ${rawText.length}. Page count: ${pageCount}. Threshold: ${MIN_CHARS_FOR_VALID_TEXT}.`,
        } satisfies ParseError;
      }

      // 2. Page limit
      if (pageCount > MAX_PAGE_COUNT) {
        throw {
          code: ParseErrorCode.PAGE_LIMIT_EXCEEDED,
          message: 'The uploaded resume exceeds the maximum page limit.',
          detail: `Maximum ${MAX_PAGE_COUNT} pages allowed. Found ${pageCount}.`,
        } satisfies ParseError;
      }

      // 3. Maximum character limit
      if (rawText.length > MAX_CHARACTER_COUNT) {
        throw {
          code: ParseErrorCode.CHARACTER_LIMIT_EXCEEDED,
          message: 'The uploaded resume exceeds the maximum character limit.',
          detail: `Maximum ${MAX_CHARACTER_COUNT} characters allowed. Found ${rawText.length}.`,
        } satisfies ParseError;
      }

      // 4. Minimum content
      if (rawText.length < MIN_CHARACTER_COUNT) {
        throw {
          code: ParseErrorCode.INSUFFICIENT_CONTENT,
          message: 'The uploaded resume does not contain enough readable text.',
          detail: `Minimum ${MIN_CHARACTER_COUNT} characters required. Found ${rawText.length}.`,
        } satisfies ParseError;
      }
      return {
        rawText,
        fileType: 'pdf',
        charCount: rawText.length,
        metadata: {
          pageCount,
        },
      };
    }

    // -----------------------------------------------------------------------
    case 'docx': {
      const { rawText, wordCount } = await parseDocx(buffer);

      // 1. Maximum character limit
      if (rawText.length > MAX_CHARACTER_COUNT) {
        throw {
          code: ParseErrorCode.CHARACTER_LIMIT_EXCEEDED,
          message: 'The uploaded resume exceeds the maximum character limit.',
          detail: `Maximum ${MAX_CHARACTER_COUNT} characters allowed. Found ${rawText.length}.`,
        } satisfies ParseError;
      }

      // 2. Minimum content
      if (rawText.length < MIN_CHARACTER_COUNT) {
        throw {
          code: ParseErrorCode.INSUFFICIENT_CONTENT,
          message: 'The uploaded resume does not contain enough readable text.',
          detail: `Minimum ${MIN_CHARACTER_COUNT} characters required. Found ${rawText.length}.`,
        } satisfies ParseError;
      }

      return {
        rawText,
        fileType: 'docx',
        charCount: rawText.length,
        metadata: {
          wordCount,
        },
      };
    }

    // -----------------------------------------------------------------------
    // Exhaustiveness guard.
    // TypeScript's control-flow analysis ensures this branch is unreachable
    // as long as SupportedFileType remains "pdf" | "docx". If a third type
    // is added to the union without adding a case here, this line becomes a
    // compile error (never cannot be assigned to never).
    default: {
      const _exhaustive: never = fileType;

      throw {
        code: ParseErrorCode.UNSUPPORTED_FILE_TYPE,
        message: 'Encountered an unhandled file type in the parser dispatcher.',
        detail: `Received fileType: "${_exhaustive}"`,
      } satisfies ParseError;
    }
  }
}
