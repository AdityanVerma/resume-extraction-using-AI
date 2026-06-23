"use client";

import { ChangeEvent, FormEvent, useState } from "react";

interface ResumeData {
    rawText: string;
    fileType: string;
    charCount: number;
}

interface ResumeUploadProps {
    onSuccess: (data: ResumeData) => void;
    onError: (message: string) => void;
    setLoading: (loading: boolean) => void;
}

export default function ResumeUpload({
    onSuccess,
    onError,
    setLoading,
}: ResumeUploadProps) {
    const [file, setFile] = useState<File | null>(null);

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];

        if (!selectedFile) return;

        const allowedTypes = [
            "application/pdf",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ];

        if (!allowedTypes.includes(selectedFile.type)) {
            onError("Only PDF and DOCX files are allowed.");
            return;
        }

        setFile(selectedFile);
        onError("");
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();

        if (!file) {
            onError("Please select a file.");
            return;
        }

        try {
            setLoading(true);
            onError("");

            const formData = new FormData();
            formData.append("file", file);

            const response = await fetch("/api/parse-resume", {
                method: "POST",
                body: formData,
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(
                    result?.error?.message || "Failed to process resume."
                );
            }

            onSuccess(result.data);
        } catch (error) {
            onError(
                error instanceof Error
                    ? error.message
                    : "Something went wrong."
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
        >
            <div className="space-y-4">
                <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                        Upload Resume
                    </label>

                    <input
                        type="file"
                        accept=".pdf,.docx"
                        onChange={handleFileChange}
                        className="block w-full rounded-lg border border-gray-300 p-3 text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-white hover:file:bg-blue-700"
                    />
                </div>

                {file && (
                    <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
                        Selected File: <span className="font-medium">{file.name}</span>
                    </div>
                )}

                <button
                    type="submit"
                    disabled={!file}
                    className="w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
                >
                    Extract Resume Text
                </button>
            </div>
        </form>
    );
}