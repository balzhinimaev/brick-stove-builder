import React from "react";
import type { Translate } from "../i18n";
import type { Screen } from "../domain/types";

export function MobileTabs({ screen, setScreen, t }: { screen: Screen; setScreen: (screen: Screen) => void; t: Translate }) {
  return (
    <nav className="mt-3 grid grid-cols-3 gap-2 rounded-[24px] bg-[#3D2B1F]/10 p-1.5 md:max-w-[680px]">
      <TabButton active={screen === "parameters"} onClick={() => setScreen("parameters")}>{t("parametersTab")}</TabButton>
      <TabButton active={screen === "projects"} onClick={() => setScreen("projects")}>{t("projectsTab")}</TabButton>
      <TabButton active={screen === "builder"} onClick={() => setScreen("builder")}>{t("builderTab")}</TabButton>
    </nav>
  );
}

function TabButton({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-12 rounded-[20px] px-4 text-sm font-black transition ${active ? "bg-[#3D2B1F] text-[#F5E6C8]" : "text-[#3D2B1F]"}`}
    >
      {children}
    </button>
  );
}
