/** Centered card used by the sign-in pages. */
export function AuthShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-9 h-9 bg-brand-gradient rounded-lg flex items-center justify-center" aria-hidden="true">
            <span className="text-white font-bold text-lg">◉</span>
          </div>
          <span className="font-bold text-sm">SHYMKENT STUDIO · CRM</span>
        </div>
        <div className="bg-white rounded-card border border-border-light p-8">
          <h1 className="text-2xl font-bold mb-6">{title}</h1>
          {children}
        </div>
      </div>
    </div>
  );
}
