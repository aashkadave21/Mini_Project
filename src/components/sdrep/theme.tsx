import { useCallback, useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

function apply(theme: "dark" | "light") {
  const root = document.documentElement;
  root.classList.toggle("light", theme === "light");
  root.classList.toggle("dark", theme === "dark");
}

export function useTheme() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const stored = window.localStorage.getItem("sdrep-theme");
    const next = stored === "light" ? "light" : "dark";
    setTheme(next);
    apply(next);
  }, []);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      window.localStorage.setItem("sdrep-theme", next);
      apply(next);
      return next;
    });
  }, []);

  return { theme, toggle };
}

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      className={
        "grid size-9 place-items-center rounded-md border border-border bg-surface-2 text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground " +
        (className ?? "")
      }
    >
      {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}
