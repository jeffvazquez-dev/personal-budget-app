import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold tracking-tight mb-4">
        Personal Budget App
      </h1>
      <p className="text-lg text-gray-600 dark:text-gray-400 mb-8 text-center max-w-md">
        Clean dashboard · Correct calculations · Bank sync · AI categorization
      </p>
      <Link
        href="/login"
        className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-3 transition-colors"
      >
        Sign in
      </Link>
    </main>
  );
}
