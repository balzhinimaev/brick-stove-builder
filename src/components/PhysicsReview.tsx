import { lazy, Suspense, useState } from "react";
import type { GridSpec, PlacedBrick } from "../domain/types";
import { ErrorBoundary } from "./ErrorBoundary";

const PhysicsPanel = lazy(() => import("./PhysicsPanel").then((module) => ({ default: module.PhysicsPanel })));
export type PhysicsReviewProps = {
  active?: boolean;
  initiallyOpen?: boolean;
  bricks: PlacedBrick[];
  grid: GridSpec;
  rowCount: number;
  onSelect?: (ids: string[], row: number) => void;
};
export function PhysicsReview(props: PhysicsReviewProps) {
  const [restart, setRestart] = useState(0);
  const [open, setOpen] = useState(props.initiallyOpen ?? false);
  const [visited, setVisited] = useState(props.initiallyOpen ?? false);
  return (
    <details
      className="physics-review"
      open={open}
      onToggle={(e) => {
        setOpen(e.currentTarget.open);
        if (e.currentTarget.open) setVisited(true);
      }}
    >
      <summary>
        Опирание и гравитация <span>Проверка на копии модели</span>
      </summary>
      {visited && (
        <ErrorBoundary
          key={restart}
          fallback={
            <div>
              <p role="alert">Не удалось открыть проверку.</p>
              <button type="button" onClick={() => setRestart((n) => n + 1)}>
                Повторить загрузку проверки
              </button>
            </div>
          }
        >
          <Suspense fallback={<output>Загрузка проверки…</output>}>
            <PhysicsPanel {...props} active={open && props.active !== false} />
          </Suspense>
        </ErrorBoundary>
      )}
    </details>
  );
}
