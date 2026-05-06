"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="p-8 max-w-xl mx-auto mt-16">
      <div className="rounded-lg border border-red-200 bg-red-50 p-6">
        <h2 className="text-lg font-semibold text-red-800 mb-2">Something went wrong</h2>
        <p className="text-sm text-red-700 font-mono bg-red-100 rounded p-3 mb-4 break-all">
          {error.message || "Unknown error"}
        </p>
        {error.digest && (
          <p className="text-xs text-red-500 mb-4">Digest: {error.digest}</p>
        )}
        <button
          onClick={reset}
          className="text-sm px-3 py-1.5 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
