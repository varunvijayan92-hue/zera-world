import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F7F4ED] px-6">
      <div className="w-full max-w-lg rounded-[32px] border border-[#D9D0BF] bg-white p-8 text-center shadow-[0_18px_48px_rgba(23,59,53,0.08)]">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#B38A45]">404</p>
        <h1 className="mt-4 text-3xl font-black text-[#173B35]">Page not found</h1>
        <p className="mt-3 text-sm text-[#173B35]/70">
          The page you’re looking for is unavailable or has moved.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center justify-center rounded-xl bg-[#173B35] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#0f2825]"
        >
          Back to home
        </Link>
      </div>
    </main>
  );
}
