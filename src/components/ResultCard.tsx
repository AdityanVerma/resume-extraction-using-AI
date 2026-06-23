interface ResultCardProps {
    extractedText: string;

    metadata: {
        fileType: string;
        charCount: number;
    };
}

export default function ResultCard({
    extractedText,
    metadata,
}: ResultCardProps) {
    const copyToClipboard = async () => {
        await navigator.clipboard.writeText(extractedText);
    };

    return (
        <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-xl font-semibold text-gray-900">
                        Extraction Result
                    </h2>
                    <p className="text-sm text-gray-500">
                        File Type:{" "}
                        <span className="font-medium uppercase">
                            {metadata.fileType}
                        </span>
                    </p>

                    <p className="text-sm text-gray-500">
                        Characters:{" "}
                        <span className="font-medium">
                            {metadata.charCount}
                        </span>
                    </p>
                </div>

                <button
                    onClick={copyToClipboard}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
                >
                    Copy Text
                </button>
            </div>

            <div className="max-h-125 overflow-y-auto rounded-xl bg-gray-50 p-4">
                <pre className="whitespace-pre-wrap wrap-break-word text-sm text-gray-800">
                    {extractedText}
                </pre>
            </div>
        </div>
    );
}