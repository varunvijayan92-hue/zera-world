"use client";

import Link from "next/link";
import { useState } from "react";

import ZeraWorldLogo from "@/components/zera-logo";

export default function CustomerAccountPage() {
  const [mode, setMode] = useState<"register" | "login">("register");
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
  });
  const [submitted, setSubmitted] = useState(false);

  function handleChange(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F7F4ED] p-6">
      <div className="w-full max-w-md rounded-[30px] border border-[#173B35]/10 bg-white p-8 shadow-[0_20px_50px_rgba(23,59,53,0.08)]">
        <div className="mb-8 text-center">
          <div className="flex justify-center">
            <ZeraWorldLogo variant="dark" />
          </div>
          <p className="mt-4 text-sm font-medium uppercase tracking-[0.2em] text-[#173B35]/60">Customer account</p>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-2 rounded-2xl bg-[#F7F4ED] p-1">
          <button
            type="button"
            onClick={() => setMode("register")}
            className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
              mode === "register" ? "bg-[#173B35] text-white" : "text-[#173B35]/70"
            }`}
          >
            Register
          </button>
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
              mode === "login" ? "bg-[#173B35] text-white" : "text-[#173B35]/70"
            }`}
          >
            Sign in
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {mode === "register" ? (
            <div>
              <label htmlFor="fullName" className="mb-2 block text-sm font-medium text-[#173B35]">
                Full name
              </label>
              <input
                id="fullName"
                type="text"
                value={form.fullName}
                onChange={(event) => handleChange("fullName", event.target.value)}
                className="w-full rounded-xl border border-[#173B35]/15 bg-[#F7F4ED] px-3 py-3 text-[#173B35] outline-none transition focus:border-[#173B35] focus:ring-2 focus:ring-[#173B35]/10"
                placeholder="Your name"
                required
              />
            </div>
          ) : null}

          <div>
            <label htmlFor="email" className="mb-2 block text-sm font-medium text-[#173B35]">
              Email address
            </label>
            <input
              id="email"
              type="email"
              value={form.email}
              onChange={(event) => handleChange("email", event.target.value)}
              className="w-full rounded-xl border border-[#173B35]/15 bg-[#F7F4ED] px-3 py-3 text-[#173B35] outline-none transition focus:border-[#173B35] focus:ring-2 focus:ring-[#173B35]/10"
              placeholder="you@example.com"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-2 block text-sm font-medium text-[#173B35]">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={form.password}
              onChange={(event) => handleChange("password", event.target.value)}
              className="w-full rounded-xl border border-[#173B35]/15 bg-[#F7F4ED] px-3 py-3 text-[#173B35] outline-none transition focus:border-[#173B35] focus:ring-2 focus:ring-[#173B35]/10"
              placeholder="Create a password"
              required
            />
          </div>

          {submitted ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {mode === "register"
                ? "Your customer account registration has been captured for this demo."
                : "Customer sign-in form is ready for your storefront backend integration."}
            </div>
          ) : null}

          <button
            type="submit"
            className="w-full rounded-xl bg-[#173B35] px-4 py-3 font-semibold text-white transition hover:bg-[#0f2a26]"
          >
            {mode === "register" ? "Create account" : "Sign in"}
          </button>
        </form>

        <div className="mt-6 flex flex-col gap-2 text-center text-sm text-[#173B35]/70">
          <Link href="/products" className="font-semibold text-[#173B35] underline underline-offset-4">
            Browse products
          </Link>
          <Link href="/" className="font-semibold text-[#173B35] underline underline-offset-4">
            Back to home
          </Link>
          <p>
            Retail admin access: <a href="/admin/login" className="font-semibold text-[#173B35] underline underline-offset-4">Admin login</a>
          </p>
        </div>
      </div>
    </main>
  );
}
