"use client";

import { useState } from "react";
import type { Strategy, Trade } from "@/lib/types";
import { EditTradeModal } from "../EditTradeModal";

// Inline "edit" entry point for the trade detail page, so the plan fields
// (stop loss, target price, …) can be filled in right where they're shown —
// no need to go back to the list and long-press.
export function EditTradeButton({
  trade,
  strategies,
}: {
  trade: Trade;
  strategies: Strategy[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-accent hover:underline"
      >
        ✏️ עריכה
      </button>
      {open && (
        <EditTradeModal
          trade={trade}
          strategies={strategies}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
