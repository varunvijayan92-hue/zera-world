"use client";
export default function AdminError({ reset }: { reset: () => void }) {
  return <main className="p-8"><h1 className="text-2xl font-bold">Admin data could not be loaded</h1><p className="mt-3 text-sm">Check the database connection, then try again.</p><button onClick={reset} className="mt-5 rounded-xl bg-[#173B35] px-5 py-3 text-white">Try again</button></main>;
}
