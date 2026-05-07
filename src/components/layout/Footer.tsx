'use client';

export function AppFooter() {
  return (
    <footer className="mt-auto border-t border-border bg-white/80 backdrop-blur-sm">
      <div className="flex items-center justify-center h-10 px-4 pb-[env(safe-area-inset-bottom)]">
        <p className="text-[11px] text-muted-foreground font-medium">
          Powered by: <span className="text-church-green font-semibold">Xuzentra Technologies Limited</span>
        </p>
      </div>
    </footer>
  );
}
