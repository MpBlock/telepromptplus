import { createFileRoute, useParams } from "@tanstack/react-router";
import { ScriptEditor } from "@/components/ScriptEditor";

function ScriptsRouteComponent() {
  const { id } = useParams({ from: "/scripts/$id" });
  return <ScriptEditor id={id} />;
}

export const Route = createFileRoute("/scripts/$id")({
  component: ScriptsRouteComponent,
});
