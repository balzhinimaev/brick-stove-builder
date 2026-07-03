import { COLORS } from "../theme/colors";
import type { Translate } from "../i18n";
import type { Parameters } from "../domain/types";

export function SideSilhouette({ parameters, lockedRows, t }: { parameters: Parameters; lockedRows: number[]; t: Translate }) {
  const foundationHeight = Math.max(18, parameters.foundationThickness * 0.75);
  const stoveWidth = Math.min(150, Math.max(88, parameters.foundationWidth * 0.9));
  const x = 96 - stoveWidth / 2;
  const baseY = 190;
  const ceilingY = Math.max(20, baseY - (parameters.roomHeight / 360) * 150);
  return (
    <div className="overflow-hidden rounded-[24px] border-2 border-[#3D2B1F]/10 bg-[#FFF7E8]">
      <svg width="100%" height="220" viewBox="0 0 192 220">
        <rect width="192" height="220" rx="24" fill={COLORS.skyCream} />
        <line x1="18" y1={ceilingY} x2="174" y2={ceilingY} stroke={COLORS.sageDark} strokeWidth="2" strokeDasharray="6 5" />
        <text x="22" y={ceilingY - 6} fill={COLORS.sageDark} fontSize="10" fontWeight="800">{t("ceilingLimit")}</text>
        <rect x={x - 12} y={baseY} width={stoveWidth + 24} height={foundationHeight} rx="8" fill={COLORS.foundation} stroke={COLORS.charcoal} strokeWidth="2" />
        {/* рисуем до самого верхнего залоченного ряда (+2 «пустых» сверху), а не по их количеству */}
        {Array.from({ length: Math.max(8, (lockedRows.length ? Math.max(...lockedRows) : 0) + 2) }).map((_, index) => {
          const row = index + 1;
          const locked = lockedRows.includes(row);
          const y = baseY - row * 11;
          return <rect key={row} x={x} y={y} width={stoveWidth} height="10" rx="3" fill={locked ? COLORS.brickRed : COLORS.creamDark} stroke={locked ? COLORS.mortar : "rgba(61,43,31,0.15)"} strokeWidth="1" opacity={locked ? 1 : 0.42} />;
        })}
        <path d="M42 42 C35 30, 52 28, 45 16 C60 28, 58 45, 45 52 C46 46, 42 45, 42 42Z" fill="#FFBF54" opacity="0.9" />
      </svg>
    </div>
  );
}
