import EmeraldChat from "@/components/EmeraldChat";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 text-zinc-50 selection:bg-emerald-500/30">
      <main className="flex flex-col items-center gap-8 w-full px-4">
        <div className="text-center space-y-2 mb-4">
          <h1 className="text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-b from-emerald-200 to-emerald-600 tracking-tight">
            ArtisTalks
          </h1>
          <p className="text-zinc-400 text-lg">The Champion is ready for you.</p>
        </div>
        
        <EmeraldChat />
      </main>
    </div>
  );
}
