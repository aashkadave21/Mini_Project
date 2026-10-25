import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/portal/citizen")({
  component: () => <Outlet />,
});
