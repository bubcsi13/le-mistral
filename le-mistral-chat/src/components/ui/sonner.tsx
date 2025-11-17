import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          // add font-pixel globally on the container too
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg font-pixel",
          // Sonner supports a 'title' slot for styling
          title: "font-pixel text-xs text-foreground",
          description: "group-[.toast]:text-muted-foreground font-pixel text-[10px]",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground font-pixel text-[10px]",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground font-pixel text-[10px]",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
