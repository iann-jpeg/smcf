import { Navigate, useNavigate } from "react-router-dom";
import { ArrowRight, BarChart3, Check, ChevronDown, Headphones, Landmark, LockKeyhole, Menu, PiggyBank, Users, WalletCards, X } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";

const highlights = [
  { icon: LockKeyhole, title: "Safe & secure", text: "Your money, our priority" },
  { icon: BarChart3, title: "Trusted platform", text: "Transparent and reliable" },
  { icon: Users, title: "Community driven", text: "Growing together" },
  { icon: Headphones, title: "Always here", text: "Dedicated support" },
];

const products = [
  { icon: PiggyBank, title: "SACCO Savings", text: "Save today. Build tomorrow.", color: "bg-emerald-950/90" },
  { icon: WalletCards, title: "Wallet Investment", text: "Earn while you grow.", color: "bg-amber-700/90" },
  { icon: Users, title: "Contribution Cycles", text: "Stronger together.", color: "bg-emerald-900/90" },
  { icon: Landmark, title: "Loans", text: "Unlock opportunities.", color: "bg-emerald-950/90" },
];

export default function Landing() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  if (loading) return null;
  if (user) return <Navigate to="/my-account" replace />;

  const goAuth = (mode?: "login" | "signup") => {
    navigate(mode === "signup" ? "/auth?tab=signup" : "/auth");
  };

  return (
    <main className="min-h-screen overflow-hidden bg-[#031b13] text-white">
      <section className="relative isolate min-h-[760px]">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_75%_35%,rgba(176,151,49,0.28),transparent_28%),radial-gradient(circle_at_20%_35%,rgba(12,83,52,0.45),transparent_40%),linear-gradient(115deg,#021c13_0%,#05291d_56%,#182c14_100%)]" />
        <div className="absolute inset-x-0 bottom-0 -z-10 h-56 bg-gradient-to-t from-[#625021]/45 to-transparent" />

        <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-10">
          <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="flex items-center gap-3 text-left">
            <span className="grid h-12 w-12 place-items-center rounded-2xl border-2 border-emerald-300/80 bg-gradient-to-br from-emerald-300 to-emerald-700 text-2xl font-black text-[#06321f] shadow-[0_0_24px_rgba(145,218,137,0.35)]">S</span>
            <span><strong className="block text-xl tracking-wide">SMCF</strong><small className="block text-[10px] tracking-[0.18em] text-emerald-100/75">SMART MOVES CASH FLOW</small></span>
          </button>
          <div className="hidden items-center gap-8 text-sm font-semibold text-white/85 md:flex">
            <a href="#home" className="border-b-2 border-amber-300 pb-2 text-amber-300">Home</a>
            <a href="#about" className="hover:text-amber-300">About</a>
            <a href="#how-it-works" className="hover:text-amber-300">How It Works</a>
            <a href="#features" className="hover:text-amber-300">Features</a>
            <a href="#cycles" className="hover:text-amber-300">Cycles</a>
            <a href="#faq" className="hover:text-amber-300">FAQ</a>
            <a href="#contact" className="hover:text-amber-300">Contact</a>
          </div>
          <div className="hidden items-center gap-3 md:flex">
            <button onClick={() => goAuth("login")} className="rounded-full border border-white/50 px-7 py-3 font-semibold hover:bg-white/10">Login</button>
            <button onClick={() => goAuth("signup")} className="rounded-full bg-gradient-to-r from-amber-300 to-amber-400 px-7 py-3 font-bold text-[#17210b] shadow-lg hover:from-amber-200 hover:to-amber-300">Join SMCF <ArrowRight className="ml-1 inline h-4 w-4" /></button>
          </div>
          <button className="md:hidden" onClick={() => setMenuOpen((value) => !value)} aria-label="Toggle navigation">{menuOpen ? <X /> : <Menu />}</button>
        </nav>
        {menuOpen && <div className="mx-6 rounded-2xl border border-white/10 bg-[#06271b] p-4 md:hidden">{["About", "How It Works", "Features", "Cycles", "FAQ", "Contact"].map((item) => <a key={item} href={`#${item.toLowerCase().replaceAll(" ", "-")}`} onClick={() => setMenuOpen(false)} className="block border-b border-white/10 px-2 py-3 last:border-0">{item}</a>)}<button onClick={() => goAuth("signup")} className="mt-3 w-full rounded-full bg-amber-300 py-3 font-bold text-[#17210b]">Join SMCF</button></div>}

        <div id="home" className="mx-auto grid max-w-7xl items-center gap-10 px-6 pb-20 pt-16 lg:grid-cols-[0.9fr_1.1fr] lg:px-10 lg:pt-20">
          <div className="max-w-xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-300/50 px-4 py-2 text-xs font-bold uppercase tracking-wide text-amber-300"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Building financial freedom together</div>
            <h1 className="text-5xl font-black leading-[0.98] tracking-tight sm:text-7xl">Save. Grow.<br />Build a <span className="text-amber-300">Better<br />Tomorrow.</span></h1>
            <p className="mt-7 max-w-lg text-lg leading-relaxed text-white/75">SMCF is a modern financial platform for savings, wallet investments, contribution cycles and long-term financial growth — designed for individuals, families and communities who believe in a brighter future.</p>
            <div className="mt-8 flex flex-wrap gap-4">
              <button onClick={() => goAuth("signup")} className="rounded-full bg-gradient-to-r from-amber-300 to-amber-400 px-7 py-4 font-bold text-[#17210b] shadow-xl">Join SMCF Today <ArrowRight className="ml-2 inline h-5 w-5" /></button>
              <a href="#how-it-works" className="rounded-full border border-white/60 px-7 py-4 font-semibold hover:bg-white/10">Learn More</a>
            </div>
          </div>

          <div className="relative mx-auto h-[480px] w-full max-w-2xl">
            <div className="absolute left-1/2 top-12 h-80 w-80 -translate-x-1/2 rounded-full border border-amber-200/50 shadow-[0_0_70px_rgba(255,210,95,0.35)]" />
            <div className="absolute bottom-4 left-1/2 h-16 w-[88%] -translate-x-1/2 rounded-[50%] border-4 border-amber-200/60 bg-gradient-to-b from-amber-300/70 to-[#65501e] shadow-[0_0_45px_rgba(255,212,91,0.45)]" />
            <div className="absolute left-1/2 top-8 z-10 h-[390px] w-56 -translate-x-1/2 rotate-[5deg] rounded-[2.4rem] border-[8px] border-[#b98d2c] bg-[#06271b] p-3 shadow-2xl sm:w-64">
              <div className="mx-auto mb-6 h-5 w-24 rounded-full bg-black" />
              <div className="rounded-2xl bg-white p-4 text-[#173321] shadow-lg"><p className="text-xs text-slate-500">Total Balance</p><p className="mt-2 text-2xl font-black">KES 26,400</p><p className="mt-2 text-xs text-emerald-700">↗ +12.5% this month</p><div className="mt-5 flex h-14 items-end gap-1">{[30, 42, 34, 58, 48, 76, 68, 92].map((height, i) => <span key={i} className="flex-1 rounded-t bg-emerald-500" style={{ height: `${height}%` }} />)}</div></div>
              <div className="mt-4 grid grid-cols-2 gap-2">{products.slice(0, 4).map(({ icon: Icon, title }) => <div key={title} className="rounded-xl bg-white p-2 text-center text-[9px] font-bold text-[#173321]"><Icon className="mx-auto mb-1 h-5 w-5 text-emerald-700" />{title.split(" ")[0]}</div>)}</div>
            </div>
            {products.map(({ icon: Icon, title, text, color }, index) => <div key={title} className={`absolute z-20 hidden w-48 rounded-2xl border border-white/10 ${color} p-4 shadow-xl sm:block ${index === 0 ? "left-0 top-14" : index === 1 ? "left-0 top-40" : index === 2 ? "right-0 top-28" : "right-0 top-52"}`}><Icon className="mb-2 h-6 w-6 text-amber-200" /><p className="font-bold">{title}</p><p className="mt-1 text-sm text-white/70">{text}</p></div>)}
          </div>
        </div>

        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-6 px-6 pb-10 lg:px-10">
          <div className="grid flex-1 grid-cols-2 gap-5 sm:grid-cols-4">{highlights.map(({ icon: Icon, title, text }) => <div key={title} className="flex gap-3 border-r border-white/20 pr-3 last:border-0"><Icon className="mt-1 h-7 w-7 shrink-0 text-amber-300" /><div><p className="font-bold capitalize">{title}</p><p className="text-sm text-white/60">{text}</p></div></div>)}</div>
          <div className="rounded-2xl border border-amber-300/50 bg-emerald-950/70 px-7 py-4"><p className="text-2xl font-black text-amber-300">10,000+</p><p className="text-sm text-white/70">Active members growing stronger daily</p></div>
        </div>
      </section>
      <section id="about" className="bg-[#f8f5eb] px-6 py-20 text-[#123324]"><div className="mx-auto max-w-6xl text-center"><p className="font-bold uppercase tracking-[0.25em] text-amber-700">A smarter way forward</p><h2 className="mt-3 text-4xl font-black sm:text-5xl">Your money. Your goals. <span className="text-emerald-700">Together.</span></h2><p className="mx-auto mt-5 max-w-2xl text-lg text-[#526258]">Build consistent financial habits with tools that keep your savings, wallet, cycles and loans clear and working for you.</p><div id="features" className="mt-12 grid gap-5 text-left sm:grid-cols-2 lg:grid-cols-4">{products.map(({ icon: Icon, title, text }) => <div key={title} className="rounded-2xl border border-emerald-900/10 bg-white p-6 shadow-sm"><Icon className="h-8 w-8 text-emerald-700" /><h3 className="mt-5 text-xl font-bold">{title}</h3><p className="mt-2 text-[#526258]">{text}</p><Check className="mt-6 h-5 w-5 text-amber-600" /></div>)}</div></div></section>
      <section id="how-it-works" className="bg-[#031b13] px-6 py-16 text-center text-white"><p className="text-amber-300">Ready when you are</p><h2 className="mt-2 text-4xl font-black">Start building your better tomorrow.</h2><button onClick={() => goAuth("signup")} className="mt-7 rounded-full bg-amber-300 px-8 py-4 font-bold text-[#17210b]">Create your account <ArrowRight className="ml-2 inline h-5 w-5" /></button></section>
    </main>
  );
}
