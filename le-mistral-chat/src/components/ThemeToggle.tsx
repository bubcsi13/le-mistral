import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = (resolvedTheme ?? "dark") === "dark";

  const toggle = () => setTheme(isDark ? "light" : "dark");

  return (
    <Button
      type="button"
      variant="outline"
      onClick={toggle}
      className="h-10 w-10 border-4 border-border pixel-shadow-white flex items-center justify-center"
      aria-label="Toggle theme"
      title="Toggle theme"
    >
      {mounted ? (
        isDark ? <Moon className="w-4 h-4" strokeWidth={3} /> : <Sun className="w-5 h-5" strokeWidth={3} />
      ) : (
        <Moon className="w-4 h-4" strokeWidth={3} />
      )}
    </Button>
  );
}
