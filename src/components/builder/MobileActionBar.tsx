import type { Translate } from "../../i18n";

export function MobileActionBar({ t, currentRow, lockedRows, copyPreviousRow, clearCurrentRow, lockRow, unlockRow, canUndo, canRedo, undo, redo }: { t: Translate; currentRow: number; lockedRows: number[]; copyPreviousRow: () => void; clearCurrentRow: () => void; lockRow: () => void; unlockRow: () => void; canUndo: boolean; canRedo: boolean; undo: () => void; redo: () => void }) {
  const isLocked = lockedRows.includes(currentRow);
  return (
    // xl:hidden: панель только для мобильной/планшетной раскладки — на десктопе
    // те же действия доступны в сайдбаре, fixed-полоса внизу там лишняя
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#3D2B1F]/10 bg-[#FFF7E8]/95 px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-2 backdrop-blur xl:hidden">
      <div className="mx-auto grid max-w-[430px] grid-cols-[48px_48px_1fr_1fr_1fr] gap-2">
        <button onClick={undo} disabled={!canUndo} aria-label={t("undo")} title={`${t("undo")} (Ctrl+Z)`} className="min-h-12 rounded-[18px] border-2 border-[#3D2B1F]/10 bg-[#F5E6C8] text-lg font-black disabled:opacity-45">↶</button>
        <button onClick={redo} disabled={!canRedo} aria-label={t("redo")} title={`${t("redo")} (Ctrl+Shift+Z)`} className="min-h-12 rounded-[18px] border-2 border-[#3D2B1F]/10 bg-[#F5E6C8] text-lg font-black disabled:opacity-45">↷</button>
        <button onClick={copyPreviousRow} disabled={isLocked} className="min-h-12 rounded-[18px] border-2 border-[#3D2B1F]/10 bg-[#F5E6C8] px-2 text-xs font-black disabled:opacity-45">{t("copyPrev")}</button>
        <button onClick={clearCurrentRow} disabled={isLocked} className="min-h-12 rounded-[18px] border-2 border-[#3D2B1F]/10 bg-[#F5E6C8] px-2 text-xs font-black disabled:opacity-45">{t("clearRow")}</button>
        <button onClick={isLocked ? unlockRow : lockRow} className={`min-h-12 rounded-[18px] px-2 text-xs font-black text-[#F5E6C8] ${isLocked ? "bg-[#5F7E4D]" : "bg-[#C1440E]"}`}>{isLocked ? t("unlockRow") : t("completeRow")}</button>
      </div>
    </div>
  );
}
