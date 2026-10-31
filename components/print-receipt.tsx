"use client";
export function PrintReceipt() { return <button onClick={() => window.print()} className="rounded-xl bg-[#173B35] px-5 py-3 text-sm font-semibold text-white print:hidden">Print order receipt</button>; }
