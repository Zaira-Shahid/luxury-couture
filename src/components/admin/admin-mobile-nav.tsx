"use client";

import { Menu, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useDialog } from "@/components/ui/use-dialog";

import { AdminSidebarNav } from "./admin-sidebar";

export function AdminMobileNav({ permissions }: { permissions: string[] }) {
  const [isOpen, setIsOpen] = useState(false);
  // MODULE 28: adds Escape-to-close, dialog semantics and focus return.
  // This overlay previously had none of them.
  const { dialogRef, dialogProps } = useDialog({ isOpen, onClose: () => setIsOpen(false) });

  return (
    <div className="md:hidden">
      <Button type="button" variant="ghost" size="icon" onClick={() => setIsOpen(true)} aria-label="Open menu">
        <Menu className="size-5" />
      </Button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop. Click-to-dismiss is a mouse convenience; the
              keyboard equivalents are Escape and the Close button, so it
              carries aria-hidden rather than pretending to be a control. */}
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-foreground/20"
            onClick={() => setIsOpen(false)}
          />
          <div
            ref={dialogRef}
            {...dialogProps}
            aria-label="Admin menu"
            className="relative flex h-full w-72 flex-col gap-6 overflow-y-auto border-r border-sidebar-border bg-sidebar px-3 py-6 outline-none"
          >
            <div className="flex items-center justify-between px-3">
              <span className="font-heading text-sm tracking-wide text-sidebar-foreground">Menu</span>
              <Button type="button" variant="ghost" size="icon" onClick={() => setIsOpen(false)} aria-label="Close menu">
                <X className="size-5" />
              </Button>
            </div>
            <AdminSidebarNav onNavigate={() => setIsOpen(false)} permissions={permissions} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
