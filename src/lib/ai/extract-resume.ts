import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

export async function extractResumeData(rawText: string) {
  const response = await ai.models.generateContent({
    model: 'gemma-4-31b',

    contents: `
You are a resume extraction engine.

Return ONLY valid JSON matching this schema.

{
  "required": {
    "firstName": "",
    "lastName": "",
    "email": "",
    "phoneNumber": "",
    "jobRole": "",
    "company": "",
    "skills": [],
    "areasOfInterest": []
  },
  "optional": {
    "education": [],
    "priorExperience": [],
    "certifications": [],
    "otherInformation": []
  }
}

Rules:
- Return JSON only.
- No markdown.
- No explanation.
- No code fences.
- Do not invent information.
- Extract only information present in the resume.
- Do not use null.
- Do not use "N/A".
- Do not use "Unknown".
- Use empty string "" for missing string fields.
- Use empty array [] for missing array fields.

Resume Content:
<resume>
${rawText}
</resume>
`,

    config: {
      responseMimeType: 'application/json',
    },
  });

  return response.text ?? '{}';
}
