// root/src/components/TopBar.tsx
// -----------------------------------------------------------------------------
// PURPOSE
//   Compact top bar on phones; keep full spacing on desktop.
//
// CHANGES
//   - Responsive paddings/sizes.
//   - Model select remains accessible but compact on mobile.
// -----------------------------------------------------------------------------

import { PanelLeftOpen, PanelLeftClose } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

type TopBarProps = {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  model: string;
  onModelChange: (model: string) => void;
  models?: string[];
};

function displayName(id: string) {
  return id.replace(/-latest$/i, "");
}

const INTERNAL_DEFAULT_MODELS = [
  "mistral-small-latest",
  "mistral-medium-latest",
  "mistral-large-latest",
  "codestral-latest",
  "pixtral-large-latest",
  "magistral-medium-latest",
  "magistral-small-latest",
  "devstral-medium-latest",
  "devstral-small-latest",
];

export default function TopBar({
  sidebarOpen,
  onToggleSidebar,
  model,
  onModelChange,
  models = INTERNAL_DEFAULT_MODELS,
}: TopBarProps) {
  return (
    <header className="border-b-8 border-border px-4 py-3 md:px-8 md:py-6 bg-card relative z-10">
      <div className="flex items-center gap-3 md:gap-6">
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
          title={sidebarOpen ? "Close sidebar" : "Open sidebar"}
          className="group h-12 w-12 md:h-14 md:w-14 grid place-items-center flex-shrink-0"
        >
          {sidebarOpen ? (
            <PanelLeftClose
              className="w-7 h-7 md:w-[3.25rem] md:h-[3.25rem] text-primary transition-colors group-hover:text-primary-foreground"
              strokeWidth={2.5}
            />
          ) : (
            <PanelLeftOpen
              className="w-7 h-7 md:w-[3.25rem] md:h-[3.25rem] text-primary transition-colors group-hover:text-primary-foreground"
              strokeWidth={2.5}
            />
          )}
        </button>

        <div className="flex-1 flex justify-start">
          <select
            id="model-select"
            value={model}
            onChange={(e) => onModelChange(e.target.value)}
            className="font-pixel text-[9px] md:text-[10px] bg-background text-foreground border-4 border-border px-2 py-1 md:px-3 md:py-2 focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] pixel-shadow-white w-full max-w-[220px]"
          >
            {models.map((m) => (
              <option key={m} value={m}>
                {displayName(m)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-shrink-0">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
