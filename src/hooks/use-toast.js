import { toast as sonnerToast } from "sonner";

function toast({ title, description, variant, duration = 5000, ...rest }) {
  const message = title || "";
  const options = {
    description,
    duration,
    ...rest,
  };

  if (variant === "destructive") {
    return sonnerToast.error(message, options);
  }

  if (variant === "success") {
    return sonnerToast.success(message, options);
  }

  return sonnerToast(message, options);
}

function useToast() {
  return { toast };
}

export { useToast, toast };
