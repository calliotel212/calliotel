export function PopcornLoader({
  size = "md",
  label = "Loading",
}: {
  size?: "sm" | "md" | "lg";
  label?: string;
}) {
  return (
    <span className={`popcorn-loader is-${size}`} role="status" aria-live="polite" aria-label={label}>
      <span className="orbit" aria-hidden="true">
        <span className="kernel kernel-a" />
        <span className="kernel kernel-b" />
        <span className="kernel kernel-c" />
      </span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
