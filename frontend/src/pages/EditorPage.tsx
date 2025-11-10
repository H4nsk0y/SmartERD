import EditorCanvas from "../components/EditorCanvas";

export default function EditorPage() {
  return (
    <div className="flex-1 w-full min-h-0 flex flex-col px-4 overflow-hidden">
      <div className="flex-1 min-h-0 overflow-hidden">
        <EditorCanvas />
      </div>
    </div>
  );
}
