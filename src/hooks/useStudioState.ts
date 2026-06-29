import { useMemo, useState } from "react";
import { COLORS } from "../theme/colors";
import { cloneRows } from "../domain/geometry";
import { READY_PROJECTS } from "../domain/projects";
import { uniqueId } from "../lib/id";
import { useI18n, type Locale } from "../i18n";
import type { ReadyProject, Screen } from "../domain/types";
import { useEditor } from "./useEditor";
import { useSession } from "./useSession";
import { useSavedProjects } from "./useSavedProjects";
import { useAutosaveDraft } from "./useAutosaveDraft";

/**
 * Composition root for editor UI state. Each concern lives in its own hook —
 * this layer wires them together and owns only locale/screen navigation plus
 * the cross-cutting "save current project" flow.
 */
export function useStudioState() {
  const [locale, setLocale] = useState<Locale>("ru");
  const [screen, setScreen] = useState<Screen>("builder");
  const t = useI18n(locale);

  const editor = useEditor();
  const session = useSession(t);
  const { savedProjects, saveProject } = useSavedProjects(session.session);
  const autosaveState = useAutosaveDraft(
    session.userLogin,
    { parameters: editor.parameters, rowCount: editor.rowCount, currentRow: editor.currentRow, lockedRows: editor.lockedRows, rows: editor.rows },
    editor.loadDraft
  );

  const allProjects = useMemo(() => [...READY_PROJECTS, ...savedProjects], [savedProjects]);

  const reset = () => {
    editor.reset();
    setScreen("builder");
  };

  const loadProject = (project: ReadyProject) => {
    editor.loadProject(project);
    setScreen("builder");
  };

  const saveCurrentProject = async () => {
    const title = window.prompt(t("saveProjectPrompt"));
    if (!title?.trim()) return;
    if (!session.session) {
      window.alert(t("authLoginFirst"));
      return;
    }

    const project: ReadyProject = {
      id: uniqueId("custom"),
      title: { ru: title.trim(), en: title.trim(), lt: title.trim() },
      subtitle: { ru: t("savedProjectSubtitle"), en: t("savedProjectSubtitle"), lt: t("savedProjectSubtitle") },
      parameters: editor.parameters,
      rowCount: editor.rowCount,
      lockedRows: editor.lockedRows,
      rows: cloneRows(editor.rows),
      accent: COLORS.brickOrange
    };

    try {
      await saveProject(project, session.session.token);
      setScreen("projects");
    } catch {
      window.alert(t("apiUnavailable"));
    }
  };

  return {
    // navigation + i18n
    locale, setLocale,
    screen, setScreen,
    t,
    // editor document + selections
    parameters: editor.parameters,
    grid: editor.grid,
    rowCount: editor.rowCount,
    currentRow: editor.currentRow,
    setCurrentRow: editor.setCurrentRow,
    lockedRows: editor.lockedRows,
    rows: editor.rows,
    activeTool: editor.activeTool,
    setActiveTool: editor.setActiveTool,
    orientation: editor.orientation,
    setOrientation: editor.setOrientation,
    viewMode: editor.viewMode,
    setViewMode: editor.setViewMode,
    camera: editor.camera,
    materials: editor.materials,
    updateParameter: editor.updateParameter,
    placeAt: editor.placeAt,
    addRow: editor.addRow,
    copyPreviousRow: editor.copyPreviousRow,
    clearCurrentRow: editor.clearCurrentRow,
    lockRow: editor.lockRow,
    unlockRow: editor.unlockRow,
    cameraZoom: editor.cameraZoom,
    cameraRotate: editor.cameraRotate,
    cameraPan: editor.cameraPan,
    cameraReset: editor.cameraReset,
    reset,
    loadProject,
    // session
    userLogin: session.userLogin,
    authMode: session.authMode,
    setAuthMode: session.setAuthMode,
    authLogin: session.authLogin,
    setAuthLogin: session.setAuthLogin,
    authPassword: session.authPassword,
    setAuthPassword: session.setAuthPassword,
    submitAuth: session.submitAuth,
    switchAccount: session.switchAccount,
    // projects
    savedProjects,
    allProjects,
    saveCurrentProject,
    autosaveState
  };
}

export type StudioState = ReturnType<typeof useStudioState>;
