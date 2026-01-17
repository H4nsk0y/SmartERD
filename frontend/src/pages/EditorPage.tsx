import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import EditorCanvas from "../components/EditorCanvas";
import { useAuthStore } from "../store/useAuthStore";
import { useERStore } from "../store/useERStore";
import { apiProjectGet } from "../api/projects";

export default function EditorPage() {
  const nav = useNavigate();
  const { projectId } = useParams();

  const token = useAuthStore((s) => s.token);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const setDiagramData = useERStore((s) => s.setDiagramData);

  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    // если открываем просто /editor — ничего не грузим
    if (!projectId) return;

    // если пытаемся открыть конкретный проект без логина — отправим на логин
    if (!isAuthenticated || !token) {
      nav("/login", { replace: true });
      return;
    }

    setLoading(true);
    apiProjectGet(token, projectId)
      .then((p) => {
        const data = (p.data || { entities: [], relationships: [] }) as any;
        setDiagramData(data.entities || [], data.relationships || []);
      })
      .catch((e: any) => {
        alert(e?.message || "Не удалось загрузить проект.");
      })
      .finally(() => setLoading(false));
  }, [projectId, isAuthenticated, token, nav, setDiagramData]);

  return (
    <div className="w-full h-full p-2 relative">
      {loading && (
        <div className="absolute inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center">
          <div className="px-4 py-3 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-xl flex items-center gap-3">
            <span className="w-4 h-4 rounded-full border-2 border-gray-400/40 border-t-gray-700 dark:border-t-gray-200 animate-spin" />
            Загружаю проект...
          </div>
        </div>
      )}

      <EditorCanvas />
    </div>
  );
}
