import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import EditorCanvas from "../components/EditorCanvas";
import { useAuthStore } from "../store/useAuthStore";
import { useERStore } from "../store/useERStore";
import { apiProjectGet } from "../api/projects";

function Background() {
  const [isVisible, setIsVisible] = useState(false);
  
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);
  
  return (
    <div className={`pointer-events-none fixed inset-0 -z-10 transition-opacity duration-300 ${
      isVisible ? 'opacity-100' : 'opacity-0'
    }`}>
      {/* Light theme */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-50 via-white to-slate-50 dark:hidden" />
      <div className="absolute -top-24 -left-24 h-[520px] w-[520px] rounded-full bg-indigo-500/10 blur-3xl dark:hidden" />
      <div className="absolute -bottom-28 -right-24 h-[560px] w-[560px] rounded-full bg-fuchsia-500/08 blur-3xl dark:hidden" />
      
      {/* Dark theme */}
      <div className="hidden dark:block absolute inset-0 bg-gradient-to-br from-[#0b1220] via-[#0d1525] to-[#090f1a]" />
      <div className="hidden dark:block absolute -top-24 -left-24 h-[520px] w-[520px] rounded-full bg-indigo-600/15 blur-3xl" />
      <div className="hidden dark:block absolute -bottom-28 -right-24 h-[560px] w-[560px] rounded-full bg-fuchsia-500/10 blur-3xl" />
    </div>
  );
}

function StatsPanel() {
  const { entities, relationships } = useERStore();
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  
  useEffect(() => {
    const timer = setTimeout(() => setIsMounted(true), 150);
    return () => clearTimeout(timer);
  }, []);
  
  const stats = {
    entities: entities.length,
    relationships: relationships.length,
    attributes: entities.reduce((sum, e) => sum + (e.attributes?.length || 0), 0),
  };
  
  return (
    <>
      {/* Плашка-индикатор */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed left-0 z-30 transition-all duration-300 ease-out ${
          isOpen ? 'opacity-0 -translate-x-full' : 'opacity-100 translate-x-0'
        } ${
          isMounted ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ 
          top: 'calc(25vh)',
        }}
        title="Показать статистику"
      >
        <div className="group relative">
          {/* Основная плашка */}
          <div className="flex items-center justify-center w-8 h-8 rounded-r-lg border border-l-0 border-slate-200/60 dark:border-white/10 bg-white/90 dark:bg-[#0b1220]/90 backdrop-blur-md shadow-sm hover:bg-white dark:hover:bg-white/10 transition-all duration-200 hover:translate-x-1 hover:shadow-md">
            {/* Двойная стрелка вправо */}
            <svg 
              className="w-4 h-4 text-slate-600 dark:text-white/70 group-hover:text-slate-800 dark:group-hover:text-white/90 transition-colors duration-200" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
          
          {/* Индикатор-полоска слева от плашки */}
          <div className="absolute left-0 top-1/2 -translate-x-1 -translate-y-1/2 w-1 h-4 bg-gradient-to-b from-indigo-400 to-purple-400 dark:from-indigo-500 dark:to-purple-500 rounded-r opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
        </div>
      </button>
      
      {/* Панель статистики */}
      <div 
        className={`fixed left-0 z-30 transition-all duration-300 ease-out ${
          isOpen ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-full'
        }`}
        style={{ 
          top: 'calc(25vh - 80px)',
        }}
      >
        <div className="flex flex-col p-3 pr-4 rounded-r-xl border border-l-0 border-slate-200/60 dark:border-white/10 bg-white/95 dark:bg-[#0b1220]/95 backdrop-blur-xl shadow-lg">
          {/* Заголовок с кнопкой закрытия */}
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="text-sm font-medium text-slate-800 dark:text-white/90">
              Статистика
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 dark:text-white/60 hover:text-slate-700 dark:hover:text-white transition-all duration-150"
              title="Скрыть"
            >
              <svg 
                className="w-4 h-4" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* Показатели */}
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-center">
              <div className="text-xl font-bold text-indigo-600 dark:text-indigo-400">
                {stats.entities}
              </div>
              <div className="text-xs text-slate-500 dark:text-white/60 tracking-tight mt-1">
                Сущ.
              </div>
            </div>
            
            <div className="w-px h-8 bg-slate-200/50 dark:bg-white/10" />
            
            <div className="flex flex-col items-center">
              <div className="text-xl font-bold text-purple-600 dark:text-purple-400">
                {stats.relationships}
              </div>
              <div className="text-xs text-slate-500 dark:text-white/60 tracking-tight mt-1">
                Связ.
              </div>
            </div>
            
            <div className="w-px h-8 bg-slate-200/50 dark:bg-white/10" />
            
            <div className="flex flex-col items-center">
              <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                {stats.attributes}
              </div>
              <div className="text-xs text-slate-500 dark:text-white/60 tracking-tight mt-1">
                Атр.
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function LoadingOverlay() {
  const [isVisible, setIsVisible] = useState(false);
  
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);
  
  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center transition-all duration-300 ${
      isVisible ? 'opacity-100' : 'opacity-0'
    }`}>
      <div className="absolute inset-0 bg-white/80 dark:bg-[#0b1220]/90 backdrop-blur-sm transition-opacity duration-300" />
      
      <div className="relative z-10 transition-all duration-300">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
              <div className="h-9 w-9 rounded-lg bg-white/10 backdrop-blur-sm flex items-center justify-center">
                <svg
                  className="h-5 w-5 text-white animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  style={{ animationDuration: '0.8s' }}
                >
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
              </div>
            </div>
          </div>
          
          <div className="text-center transition-all duration-300">
            <div className="text-sm font-semibold text-slate-900 dark:text-white">
              Загружаю проект...
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function EditorPage() {
  const nav = useNavigate();
  const { projectId } = useParams();

  const token = useAuthStore((s) => s.token);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const setDiagramData = useERStore((s) => s.setDiagramData);
  const [loading, setLoading] = useState(false);
  const [isEditorVisible, setIsEditorVisible] = useState(false);

  useEffect(() => {
    if (!projectId) {
      // Если это новый проект, показываем редактор сразу
      const timer = setTimeout(() => setIsEditorVisible(true), 150);
      return () => clearTimeout(timer);
    }

    if (!isAuthenticated || !token) {
      nav("/login", { replace: true });
      return;
    }

    setLoading(true);
    apiProjectGet(token, projectId)
      .then((p) => {
        const data = (p.data || { entities: [], relationships: [] }) as any;
        setDiagramData(data.entities || [], data.relationships || []);
        
        // После загрузки данных показываем редактор
        setTimeout(() => {
          setLoading(false);
          const timer = setTimeout(() => setIsEditorVisible(true), 150);
          return () => clearTimeout(timer);
        }, 200);
      })
      .catch((e: any) => {
        const errorMessage = e?.message || "Не удалось загрузить проект.";
        alert(errorMessage);
        nav("/projects");
        setLoading(false);
      });
  }, [projectId, isAuthenticated, token, nav, setDiagramData]);

  return (
    <div className="relative w-full h-full bg-slate-50 dark:bg-[#0b1220]">
      <Background />
      
      {/* Выдвижная панель статистики */}
      <StatsPanel />
      
      {/* Основной канвас */}
      <div className={`w-full h-full p-2 relative transition-all duration-400 ${
        isEditorVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}>
        <EditorCanvas />
      </div>
      
      {/* Индикатор загрузки */}
      {loading && <LoadingOverlay />}
    </div>
  );
}