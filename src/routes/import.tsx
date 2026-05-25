import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/import")({
  beforeLoad: () => {
    throw redirect({ to: "/home" });
  },
  component: () => null,
});
