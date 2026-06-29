import React from "react";

export function Pill({ children }: { children: React.ReactNode }) {
  return <span className="shrink-0 rounded-full bg-[#C1440E]/10 px-2.5 py-1 text-[11px] font-extrabold">{children}</span>;
}

export function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h2 className="text-[24px] font-black tracking-tight">{title}</h2>
      <p className="mt-1 text-sm font-bold leading-5 text-[#3D2B1F]/70">{subtitle}</p>
    </div>
  );
}
