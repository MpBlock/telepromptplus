import { createFileRoute } from "@tanstack/react-router";
import { ScriptEditor } from "@/components/ScriptEditor";

export const Route = createFileRoute("/scripts/new")({
  component: () => <ScriptEditor id="new" />,
});
