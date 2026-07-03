import React from "react";
import type { Translate } from "../i18n";
import type { Screen } from "../domain/types";

export function MobileTabs({ screen, setScreen, t }: { screen: Screen; setScreen: (screen: Screen) => void; t: Translate }) {
  return (
    <nav className="mt-3 grid grid-cols-4 gap-1.5 rounded-[24px] bg-[#3D2B1F]/10 p-1.5 md:max-w-[840px]">
      <TabButton active={screen === "parameters"} onClick={() => setScreen("parameters")}>{t("parametersTab")}</TabButton>
      <TabButton active={screen === "projects"} onClick={() => setScreen("projects")}>{t("projectsTab")}</TabButton>
      <TabButton active={screen === "builder"} onClick={() => setScreen("builder")}>{t("builderTab")}</TabButton>
      <TabButton active={screen === "showcase"} onClick={() => setScreen("showcase")}>{t("showcaseTab")}</TabButton>
    </nav>
  );
}

function TabButton({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-12 truncate rounded-[20px] px-1.5 text-xs font-black transition sm:px-4 sm:text-sm ${active ? "bg-[#3D2B1F] text-[#F5E6C8]" : "text-[#3D2B1F]"}`}
    >
      {children}
    </button>
  );
}
