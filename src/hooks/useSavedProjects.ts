import { useCallback, useEffect, useState } from "react";
import { createSavedProject, fetchSavedProjects, type Session } from "../api/client";
import type { ReadyProject } from "../domain/types";

export function useSavedProjects(session: Session | null) {
  const [savedProjects, setSavedProjects] = useState<ReadyProject[]>([]);

  useEffect(() => {
    if (!session) {
      setSavedProjects([]);
      return;
    }
    let active = true;
    fetchSavedProjects(session.token)
      .then((projects) => { if (active) setSavedProjects(projects); })
      .catch(() => { if (active) setSavedProjects([]); });
    return () => { active = false; };
  }, [session]);

  const saveProject = useCallback(async (project: ReadyProject, token: string) => {
    const saved = await createSavedProject(project, token);
    setSavedProjects((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
    return saved;
  }, []);

  return { savedProjects, saveProject };
}
