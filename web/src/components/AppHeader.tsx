"use client";

import React from "react";
import AppTopBar from "./AppTopBar";

export default function AppHeader({
  isCollapsed = false,
  onToggleSidebar = () => {},
}: {
  isCollapsed?: boolean;
  onToggleSidebar?: () => void;
}) {
  return <AppTopBar isCollapsed={isCollapsed} onToggleSidebar={onToggleSidebar} />;
}
