import EditorCanvas from "../components/EditorCanvas";

export default function EditorPage() {
  return (
    <div className="flex-1 w-full min-h-0 flex flex-col px-4 overflow-hidden">
      <h1 className="shink-0 text-3xl font-bold text-indigo-700 dark:text-indigo-300 mb-3 text-center">
        SmartERD — Редактор ER-диаграмм
      </h1>
      <div className="flex-1 min-h-0 overflow-hidden">
        <EditorCanvas />
      </div>
    </div>
  );
}
