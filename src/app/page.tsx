"use client";

import { useState } from "react";
import LoadingState from "@/components/LoadingState";
import ResultCard from "@/components/ResultCard";
import ResumeUpload from "@/components/ResumeUpload";

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

  return (
    <main className="min-h-screen bg-gray-100 px-4 py-10">
      <div className="mx-auto max-w-5xl">
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-bold text-gray-900">
            Resume Extraction Prototype
          </h1>

          <p className="mt-3 text-gray-600">
            Upload a PDF or DOCX resume and extract raw text for AI
            processing.
          </p>
        </div>

        <ResumeUpload
          onSuccess={(data) => {
            setResult(data);
            setError("");
          }}
          onError={(message) => {
            setError(message);
            setResult(null);
          }}
          setLoading={setLoading}
        />

        {loading && <LoadingState />}

        {error && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        {result && !loading && (
          <ResultCard
            extractedText={result.extractedText}
            metadata={result.metadata}
          />
        )}
      </div>
    </main>
  );
}