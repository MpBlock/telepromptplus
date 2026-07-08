import { createFileRoute, useParams } from "@tanstack/react-router";
import { Prompter } from "@/components/Prompter";

function PrompterRouteComponent() {
  const { id } = useParams({ from: "/prompter/$id" });
  return <Prompter scriptId={id} />;
}

export const Route = createFileRoute("/prompter/$id")({
  component: PrompterRouteComponent,
});
