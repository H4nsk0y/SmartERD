import EditorCanvas from "../components/EditorCanvas";

export default function EditorPage() {
  return (
    <div className="flex flex-col items-center justify-center w-full">
      <h1 className="text-3xl font-bold text-indigo-700 dark:text-indigo-300 mb-4">
        SmartERD — Редактор ER-диаграмм
      </h1>
      <EditorCanvas />
    </div>
  );
}
