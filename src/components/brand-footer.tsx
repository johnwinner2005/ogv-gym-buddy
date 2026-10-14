import logoSrc from "@/assets/ogv-logo.svg";

export function BrandFooter() {
  return (
    <footer className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-6 pb-12 pt-4">
      <button
        type="button"
        aria-label="OGV Gym"
        className="logo-bounce group rounded-full p-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <img src={logoSrc} alt="OGV Gym logo" className="size-16 select-none" draggable={false} />
      </button>
      <p className="text-xs text-muted-foreground">© OGV Gym</p>
    </footer>
  );
}
