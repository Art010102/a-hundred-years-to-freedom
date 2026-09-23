import { createFileRoute } from "@tanstack/react-router";
import { PrisonApp } from "@/game/PrisonApp";

export const Route = createFileRoute("/")({
  component: PrisonApp,
});
