interface AIResultCardProps {
    data: unknown;
}

export default function AIResultCard({
    data,
}: AIResultCardProps) {
    const copyToClipboard = async () => {
        await navigator.clipboard.writeText(
            JSON.stringify(data, null, 2)
        );
    };

    return (
        <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">
                    AI Extracted JSON
                </h2>

                <button
                    onClick={copyToClipboard}
                    className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                >
                    Copy JSON
                </button>
            </div>

            <div className="max-h-125 overflow-y-auto rounded-xl bg-gray-50 p-4">
                <pre className="text-sm text-gray-800">
                    {JSON.stringify(data, null, 2)}
                </pre>
            </div>
        </div>
    );
}