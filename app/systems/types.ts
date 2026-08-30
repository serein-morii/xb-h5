import type { ReactNode } from "react";

export type RouteConfig = {
  title: string;
  description: string;
  shell?: "order-tools" | "lab";
  content: ReactNode;
};
