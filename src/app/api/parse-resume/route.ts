import { NextRequest, NextResponse } from 'next/server';

import { extractTextFromFile } from '@/lib/parsers';
import { validateFile } from '@/lib/utils/file-validator';

import {
  ParseErrorCode,
  type ParseError,
  type ApiSuccessResponse,
  type ApiErrorResponse,
} from '@/types/resume';

// import { extractResumeData } from '@/lib/ai/extract-resume';

// ---------------------------------------------------------------------------
// HTTP status code mapping
//
// Centralised here so the mapping is defined exactly once.
// Every ParseErrorCode has a corresponding HTTP status — TypeScript will not
// allow an unhandled code because the Record type is keyed on ParseErrorCode
// (the full union), making it exhaustive.
// ---------------------------------------------------------------------------

const ERROR_CODE_TO_HTTP_STATUS: Record<ParseErrorCode, number> = {
  [ParseErrorCode.NO_FILE]: 400, // Bad Request — missing field
  [ParseErrorCode.UNSUPPORTED_FILE_TYPE]: 415, // Unsupported Media Type
  [ParseErrorCode.FILE_TOO_LARGE]: 413, // Content Too Large
  [ParseErrorCode.MIME_EXTENSION_MISMATCH]: 415, // Unsupported Media Type
  [ParseErrorCode.PASSWORD_PROTECTED]: 422,
  [ParseErrorCode.CORRUPT_FILE]: 422, // Unprocessable Entity
  [ParseErrorCode.SCANNED_PDF]: 422, // Unprocessable Entity
  [ParseErrorCode.PARSE_FAILED]: 500, // Internal Server Error
} as const;

// ---------------------------------------------------------------------------
// Response builders
//
// Two small helpers that stamp the correct Content-Type and shape every
// response identically. Nothing else in this file calls NextResponse directly.
// ---------------------------------------------------------------------------

function successResponse(data: ApiSuccessResponse['data']): NextResponse {
  const body: ApiSuccessResponse = { success: true, data };
  return NextResponse.json(body, { status: 200 });
}

function errorResponse(error: ParseError): NextResponse {
  const status = ERROR_CODE_TO_HTTP_STATUS[error.code] ?? 500;
  const body: ApiErrorResponse = { success: false, error };
  return NextResponse.json(body, { status });
}

// ---------------------------------------------------------------------------
// Type guard — narrows an unknown thrown value to ParseError
//
// The parser layer guarantees it only throws ParseError objects, but
// TypeScript types catch-clause bindings as `unknown`. This guard lets us
// narrow without casting and without an unsafe `as ParseError`.
// ---------------------------------------------------------------------------

function isParseError(err: unknown): err is ParseError {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    'message' in err &&
    typeof (err as ParseError).code === 'string' &&
    typeof (err as ParseError).message === 'string'
  );
}

// ---------------------------------------------------------------------------
// POST /api/parse-resume
//
// Accepts:  multipart/form-data with a field named "file" (PDF or DOCX)
// Returns:  ApiSuccessResponse (200) or ApiErrorResponse (4xx / 5xx)
//
// Step-by-step:
//   1. Parse FormData and extract the "file" field
//   2. Validate file type, size, and MIME ↔ extension consistency
//   3. Convert File → Buffer (one isolated try/catch)
//   4. Dispatch to the parser layer (one isolated try/catch)
//   5. Return standardised JSON response
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<NextResponse> {
  // -------------------------------------------------------------------------
  // Step 1 — Extract FormData and the "file" field
  // -------------------------------------------------------------------------

  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    // request.formData() throws if the Content-Type is not multipart/form-data
    // or if the body is malformed. This is always a client-side error.
    return errorResponse({
      code: ParseErrorCode.NO_FILE,
      message: 'The request body could not be read as multipart/form-data.',
      detail:
        "Ensure the request uses Content-Type: multipart/form-data and includes a 'file' field.",
    });
  }

  const fileField = formData.get('file');

  // formData.get() returns null if the field is absent, or a string if the
  // field was sent as text instead of a file. Both are client errors.
  if (!fileField || typeof fileField === 'string') {
    return errorResponse({
      code: ParseErrorCode.NO_FILE,
      message: 'No file was included in the request.',
      detail:
        "The FormData must contain a field named 'file' with a PDF or DOCX attachment.",
    });
  }

  const file = fileField as File;

  // -------------------------------------------------------------------------
  // Step 2 — Validate file (type, size, MIME ↔ extension)
  //
  // validateFile() is synchronous and returns a discriminated union.
  // If invalid, we return immediately — no bytes are read.
  // -------------------------------------------------------------------------

  const validation = validateFile(file);

  if (!validation.valid) {
    return errorResponse(validation.error);
  }

  // TypeScript now knows validation.fileType is SupportedFileType.
  const { fileType } = validation;

  // -------------------------------------------------------------------------
  // Step 3 — Convert File → Buffer
  //
  // Isolated in its own try/catch because arrayBuffer() is async and can fail
  // independently of the parser (e.g. stream already consumed, OOM on edge
  // runtime). A failure here is always a server-side error, not a file error.
  // -------------------------------------------------------------------------

  let buffer: Buffer;

  try {
    const arrayBuffer = await file.arrayBuffer();
    buffer = Buffer.from(arrayBuffer);
  } catch (err) {
    console.error('[parse-resume] Buffer conversion failed:', err);

    return errorResponse({
      code: ParseErrorCode.PARSE_FAILED,
      message: 'The uploaded file could not be read by the server.',
      detail: 'An internal error occurred while reading the file bytes.',
    });
  }

  // -------------------------------------------------------------------------
  // Step 4 — Dispatch to the parser layer
  //
  // extractTextFromFile() throws a typed ParseError on any failure.
  // It never throws a raw Error — that contract is enforced in parsers/index.ts.
  // One try/catch handles every parser failure path.
  // -------------------------------------------------------------------------

  let result: Awaited<ReturnType<typeof extractTextFromFile>>;

  try {
    result = await extractTextFromFile(buffer, fileType);
  } catch (err) {
    // Primary path — a typed ParseError thrown by the parser layer.
    if (isParseError(err)) {
      // Only log server-side errors; 4xx-equivalent parse errors
      // (scanned PDF, corrupt file) are not server faults.
      const httpStatus = ERROR_CODE_TO_HTTP_STATUS[err.code] ?? 500;
      if (httpStatus >= 500) {
        console.error('[parse-resume] Parser error:', err);
      }

      return errorResponse(err);
    }

    // Fallback path — something unexpected escaped the parser layer.
    // This represents a code-level bug. Log fully and return a safe 500.
    console.error('[parse-resume] Unexpected non-ParseError thrown:', err);

    return errorResponse({
      code: ParseErrorCode.PARSE_FAILED,
      message: 'An unexpected server error occurred while processing the file.',
      detail:
        'An internal error of an unrecognised type was thrown during parsing.',
    });
  }

  // -------------------------------------------------------------------------
  // Step 5 — Return extracted text
  // -------------------------------------------------------------------------

  console.log(result);

  return successResponse({
    extractedText: result.rawText,

    metadata: {
      fileType: result.fileType,
      charCount: result.charCount,
    },
  });
}

// ---------------------------------------------------------------------------
// Explicit 405 for all other HTTP methods
//
// Next.js returns a 405 automatically for unhandled methods, but defining
// it explicitly gives us a consistent ApiErrorResponse body shape instead
// of the framework's default plain-text response. Clients can then handle
// method errors the same way they handle all other errors.
// ---------------------------------------------------------------------------

export async function GET(): Promise<NextResponse> {
  return errorResponse({
    code: ParseErrorCode.UNSUPPORTED_FILE_TYPE,
    message: 'Method not allowed. Use POST to upload a resume file.',
    detail:
      'This endpoint only accepts POST requests with multipart/form-data.',
  });
}
