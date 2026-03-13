import Link from 'next/link';
import { Ruler, FileText, MousePointer2, CheckCircle2, ArrowRight } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-[family-name:var(--font-geist-sans)] selection:bg-blue-500/30">
      
      {/* Header */}
      <header className="border-b border-white/10 bg-slate-950/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-blue-400 font-semibold text-lg">
            <Ruler className="w-5 h-5" />
            Easy Architech
          </div>
          <Link 
            href="/workspace"
            className="text-sm font-medium text-slate-300 hover:text-white transition-colors"
          >
            Open Workspace
          </Link>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="relative px-6 py-24 md:py-32 overflow-hidden flex flex-col items-center text-center">
          {/* Background Glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/20 blur-[120px] rounded-full pointer-events-none" />
          
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-sm font-medium mb-8 border border-blue-500/20">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
            Professional blueprint measurement, right in your browser
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-white mb-6 max-w-4xl relative z-10">
            Measure plans with <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">perfect precision</span>.
          </h1>
          
          <p className="text-lg md:text-xl text-slate-400 mb-10 max-w-2xl relative z-10 leading-relaxed">
            Easy Architech is the fastest, simplest way to extract scale-accurate lengths and areas from PDF blueprints without expensive desktop software.
          </p>
          
          <Link 
            href="/workspace"
            className="relative z-10 group flex items-center gap-3 bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-full font-medium text-lg transition-all hover:scale-105 active:scale-95 shadow-[0_0_40px_-10px_rgba(37,99,235,0.5)]"
          >
            Launch Workspace
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
        </section>

        {/* How it Works */}
        <section className="px-6 py-24 bg-slate-900 border-y border-white/5 relative z-10">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">How it works</h2>
              <p className="text-slate-400 text-lg max-w-2xl mx-auto">Get takeoff measurements in three simple steps.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {/* Step 1 */}
              <div className="bg-slate-950 p-8 rounded-2xl border border-white/10 hover:border-blue-500/50 transition-colors group">
                <div className="w-12 h-12 bg-blue-500/10 text-blue-400 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-blue-500 group-hover:text-white transition-all">
                  <FileText className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-3 flex items-center gap-2">
                  <span className="text-blue-500 text-sm font-bold bg-blue-500/10 w-6 h-6 rounded-full flex items-center justify-center">1</span>
                  Upload Blueprint
                </h3>
                <p className="text-slate-400 leading-relaxed">
                  Click the Open PDF button to instantly load your blueprint securely in the browser. No files are uploaded to any server.
                </p>
              </div>

              {/* Step 2 */}
              <div className="bg-slate-950 p-8 rounded-2xl border border-white/10 hover:border-cyan-500/50 transition-colors group">
                <div className="w-12 h-12 bg-cyan-500/10 text-cyan-400 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-cyan-500 group-hover:text-white transition-all">
                  <Ruler className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-3 flex items-center gap-2">
                  <span className="text-cyan-500 text-sm font-bold bg-cyan-500/10 w-6 h-6 rounded-full flex items-center justify-center">2</span>
                  Set Scale
                </h3>
                <p className="text-slate-400 leading-relaxed">
                  Choose from 30+ Architecture and Engineering standard presets, or use the 2-Point Calibration tool to match any known dimension on the page.
                </p>
              </div>

              {/* Step 3 */}
              <div className="bg-slate-950 p-8 rounded-2xl border border-white/10 hover:border-indigo-500/50 transition-colors group">
                <div className="w-12 h-12 bg-indigo-500/10 text-indigo-400 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-indigo-500 group-hover:text-white transition-all">
                  <MousePointer2 className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-3 flex items-center gap-2">
                  <span className="text-indigo-500 text-sm font-bold bg-indigo-500/10 w-6 h-6 rounded-full flex items-center justify-center">3</span>
                  Take Measurements
                </h3>
                <p className="text-slate-400 leading-relaxed">
                  Use the Linear tool for wall lengths or the Area shape tool for square footage. Measurements instantly appear and total up automatically.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Feature List */}
        <section className="px-6 py-24 max-w-6xl mx-auto relative z-10">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">Designed for speed & accuracy</h2>
              <p className="text-slate-400 text-lg mb-8 leading-relaxed">
                Whether you&apos;re estimating materials, checking dimensions, or verifying plans, Easy Architech gives you the exact tools you need without the bloat.
              </p>
              
              <ul className="space-y-4">
                {[
                  "Infinite smooth 60fps canvas panning & zooming",
                  "Over 35+ preset imperial & metric scales built-in",
                  "Multi-point, real-time square footage calculation",
                  "100% private, client-side document processing"
                ].map((feature, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <CheckCircle2 className="w-6 h-6 text-blue-500 shrink-0" />
                    <span className="text-slate-300">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="relative rounded-2xl border border-white/10 p-2 bg-slate-900 shadow-2xl overflow-hidden aspect-video flex items-center justify-center">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent" />
              <div className="text-center">
                <Ruler className="w-16 h-16 text-blue-500/50 mx-auto mb-4" />
                <p className="text-slate-500 font-medium">Ready when you are.</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-12 px-6 bg-slate-950 relative z-10 text-center text-slate-500">
        <div className="flex justify-center items-center gap-2 text-slate-400 font-medium mb-4">
          <Ruler className="w-4 h-4" /> Easy Architech
        </div>
        <p className="text-sm">Precision PDF Blueprint Measurement Tools</p>
      </footer>
    </div>
  );
}
