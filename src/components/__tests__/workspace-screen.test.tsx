import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { BuilderScreen } from "../BuilderScreen";
import { initialEditorState } from "../../domain/editor/state";
import { estimateMaterials } from "../../domain/materials";
import { ProjectOrderPreview } from "../ProjectsScreen";
import { READY_PROJECTS } from "../../domain/projects";
import { gridFromParameters } from "../../domain/geometry";

const no = () => {};
it("keeps heavy review, physics, 89-row preview and print unmounted until requested", () => {
  const state = initialEditorState();
  const html = renderToStaticMarkup(
    <BuilderScreen
      {...state}
      t={(key) => key}
      userLogin=""
      sceneRevision={1}
      setCurrentRow={no}
      setActiveTool={no}
      setOrientation={no}
      setNotchCorner={no}
      setRebateDepth={no}
      setSnapStep={no}
      pickCustomBrick={no}
      setPlateSize={no}
      setDoorSize={no}
      setDamperSize={no}
      setGrateSize={no}
      placeAt={no}
      previewAt={() => {
        throw new Error("No placement during SSR");
      }}
      addRow={no}
      deleteCurrentRow={no}
      copyPreviousRow={no}
      fillCurrentRow={no}
      clearCurrentRow={no}
      lockRow={no}
      unlockRow={no}
      canUndo={false}
      canRedo={false}
      undo={no}
      redo={no}
      materials={estimateMaterials(Object.values(state.rows).flat(), state.parameters)}
      saveCurrentProject={no}
      setDamperOpenings={no}
    />
  );
  expect(html).toContain("studio-viewport");
  expect(html).not.toContain("masonry-review-body");
  expect(html).not.toContain("physics-settings");
  expect(html).not.toContain("print-order");
  const project = READY_PROJECTS.find((p) => p.id === "russian-house-6x9-r2")!;
  const preview = renderToStaticMarkup(
    <ProjectOrderPreview
      grid={gridFromParameters(project.parameters)}
      rows={project.rows}
      rowCount={project.rowCount}
      t={(key) => key}
    />
  );
  expect(preview).not.toContain("<svg");
  expect(preview).toContain("Посмотреть порядовку");
});
