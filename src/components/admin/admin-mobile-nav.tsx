"use client";

import { Menu, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

import { AdminSidebarNav } from "./admin-sidebar";

export function AdminMobileNav() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="md:hidden">
      <Button type="button" variant="ghost" size="icon" onClick={() => setIsOpen(true)} aria-label="Open menu">
        <Menu className="size-5" />
      </Button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-foreground/20" onClick={() => setIsOpen(false)} />
          <div className="relative flex h-full w-72 flex-col gap-6 overflow-y-auto border-r border-sidebar-border bg-sidebar px-3 py-6">
            <div className="flex items-center justify-between px-3">
              <span className="font-heading text-sm tracking-wide text-sidebar-foreground">Menu</span>
              <Button type="button" variant="ghost" size="icon" onClick={() => setIsOpen(false)} aria-label="Close menu">
                <X className="size-5" />
              </Button>
            </div>
            <AdminSidebarNav onNavigate={() => setIsOpen(false)} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
