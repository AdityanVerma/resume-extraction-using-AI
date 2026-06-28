"use client";

import { useState } from "react";
import LoadingState from "../components/LoadingState";
import AIResultCard from "../components/AIResultCard";

import ResultCard from "../components/ResultCard";
import ResumeUpload from "../components/ResumeUpload";

interface ResumeData {
  extractedText: string;

  metadata: {
    fileType: string;
    charCount: number;
  };
}

export default function Home() {
  const [parsingLoading, setParsingLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  const [result, setResult] = useState<ResumeData | null>(null);
  const [aiResult, setAiResult] = useState<any>(null);

  const [error, setError] = useState("");

  const generateAIResponse = async (rawText: string) => {
    try {
      setAiLoading(true);

      const response = await fetch("/api/extract-ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rawText,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result?.error?.message || "AI extraction failed."
        );
      }

      setAiResult(result.data);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "AI extraction failed."
      );
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-100 px-4 py-10">
      <div className="mx-auto max-w-5xl">
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-bold text-gray-900">
            Resume Extraction Prototype
          </h1>

          <p className="mt-3 text-gray-600">
            Upload a PDF or DOCX resume and extract raw text to create JSON File.
          </p>
        </div>

        <ResumeUpload
          onSuccess={(data) => {
            setResult(data);
            setAiResult(null);
            setError("");

            generateAIResponse(data.extractedText);
          }}
          onError={(message) => {
            setError(message);
            setResult(null);
            setAiResult(null);
          }}
          setLoading={setParsingLoading}
        />

        {parsingLoading && (
          <LoadingState message="Extracting resume text..." />
        )}

        {aiLoading && (
          <LoadingState message="Generating AI response..." />
        )}

        {error && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        {result && !parsingLoading && (
          <ResultCard
            extractedText={result.extractedText}
            metadata={result.metadata}
          />
        )}

        {aiResult && !aiLoading && (
          <AIResultCard
            data={aiResult}
          />
        )}
      </div>
    </main>
  );
}