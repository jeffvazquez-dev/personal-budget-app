export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold tracking-tight mb-4">
        Personal Budget App
      </h1>
      <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">
        Clean dashboard · Correct calculations · Bank sync · AI categorization
      </p>
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-6 max-w-md w-full text-center">
        <p className="text-sm text-gray-500">
          Monorepo is ready. Next steps: Supabase auth + database schema.
        </p>
      </div>
    </main>
  );
}
