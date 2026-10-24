"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [loginId, setLoginId] = useState("admin");
  const [password, setPassword] = useState("admin@123");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ loginId, password }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.message || "Login failed.");
      }

      router.push("/dashboard");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Login failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F7F4ED] p-6">
      <div className="w-full max-w-md rounded-[30px] border border-[#173B35]/10 bg-white p-8 shadow-[0_20px_50px_rgba(23,59,53,0.08)]">
        <div className="mb-8 text-center">
          <div className="flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#173B35] text-2xl font-black text-[#F7F4ED]">
              ZW
            </div>
          </div>
          <p className="mt-4 text-sm font-medium uppercase tracking-[0.2em] text-[#173B35]/60">ZeraWorld Connect</p>
          <h1 className="mt-3 text-3xl font-black tracking-[-0.06em] text-[#173B35]">Admin login</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="loginId" className="mb-2 block text-sm font-medium text-[#173B35]">
              Login ID
            </label>
            <input
              id="loginId"
              type="text"
              value={loginId}
              onChange={(event) => setLoginId(event.target.value)}
              className="w-full rounded-xl border border-[#173B35]/15 bg-[#F7F4ED] px-3 py-3 text-[#173B35] outline-none transition focus:border-[#173B35] focus:ring-2 focus:ring-[#173B35]/10"
              placeholder="admin"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-2 block text-sm font-medium text-[#173B35]">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-[#173B35]/15 bg-[#F7F4ED] px-3 py-3 text-[#173B35] outline-none transition focus:border-[#173B35] focus:ring-2 focus:ring-[#173B35]/10"
              placeholder="admin@123"
            />
          </div>

          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-[#173B35] px-4 py-3 font-semibold text-white transition hover:bg-[#0f2a26] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? "Signing in..." : "Sign in as admin"}
          </button>
        </form>

        <div className="mt-6 rounded-2xl bg-[#F7F4ED] p-3 text-xs text-[#173B35]/70">
          <p className="font-semibold text-[#173B35]">Default admin account</p>
          <p>Login ID: admin</p>
          <p>Password: admin@123</p>
        </div>

        <div className="mt-4 flex flex-col gap-2 text-center text-sm text-[#173B35]/70">
          <Link href="/" className="font-semibold text-[#173B35] underline underline-offset-4">
            Back to storefront
          </Link>
          <Link href="/login" className="font-semibold text-[#173B35] underline underline-offset-4">
            Customer access: Create account
          </Link>
        </div>
      </div>
    </main>
  );
}
