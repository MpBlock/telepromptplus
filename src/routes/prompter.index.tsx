import { createFileRoute } from "@tanstack/react-router";
import { Prompter } from "@/components/Prompter";

export const Route = createFileRoute("/prompter/")({ component: () => <Prompter /> });
