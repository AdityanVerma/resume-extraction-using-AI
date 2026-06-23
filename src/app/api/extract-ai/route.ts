import { NextRequest, NextResponse } from 'next/server';

import { extractResumeData } from '@/lib/ai/extract-resume';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const rawText = body?.rawText;

    if (!rawText) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: 'rawText is required.',
          },
        },
        { status: 400 },
      );
    }

    const aiResponse = await extractResumeData(rawText);

    const resumeData = JSON.parse(aiResponse);

    return NextResponse.json({
      success: true,
      data: resumeData,
    });
  } catch (error) {
    console.error('[extract-ai]', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          message: 'AI extraction failed.',
        },
      },
      { status: 500 },
    );
  }
}
