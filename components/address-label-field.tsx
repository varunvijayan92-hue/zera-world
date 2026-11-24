"use client";

const presets = ["Home", "Office", "Other"];

export function AddressLabelField({ value, onChange }: { value: string; onChange: (label: string) => void }) {
  const custom = !presets.includes(value);
  return (
    <div className="mt-3 space-y-2 text-sm">
      <label className="block font-semibold">
        Address label
        <select value={custom ? "" : value} onChange={event => onChange(event.target.value)}
          className="mt-2 block w-full rounded-xl border p-3 font-normal">
          {presets.map(label => <option key={label} value={label}>{label}</option>)}
          <option value="">Custom label</option>
        </select>
      </label>
      {custom && <label className="block">Custom label
        <input required maxLength={50} value={value} onChange={event => onChange(event.target.value)}
          className="mt-1 block w-full rounded-xl border p-3" />
      </label>}
    </div>
  );
}
