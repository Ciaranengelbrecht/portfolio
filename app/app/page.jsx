"use client";
import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import Link from 'next/link';

// Simple section wrapper with viewport animations
const Section = ({ children, className = '' }) => {
  const prefersReducedMotion = useReducedMotion();
  return (
    <motion.section
      className={`relative py-24 md:py-40 ${className}`}
      initial={prefersReducedMotion ? false : { opacity: 0, y: 40 }}
      whileInView={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
    >
      {children}
    </motion.section>
  );
};

const Hero = () => {
  return (
    <div className="relative flex flex-col items-center text-center gap-10">
      {/* Glow backgrounds */}
      <div className="pointer-events-none absolute inset-0 [mask-image:radial-gradient(circle_at_center,black,transparent)] opacity-70">
        <div className="absolute inset-0 bg-brand-glow" />
        <div className="absolute inset-0 bg-brand-glow-strong mix-blend-screen" />
      </div>
      <motion.h1
        className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight bg-gradient-to-r from-brand-400 via-electric-500 to-brand-500 bg-clip-text text-transparent drop-shadow-glow"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9 }}
      >
        Log Smarter. Grow Faster.
      </motion.h1>
      <motion.p
        className="max-w-xl text-base sm:text-lg md:text-xl text-slate-300 leading-relaxed"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, delay: 0.15 }}
      >
        A focused hypertrophy training experience: intelligent volume targets, auto deload suggestions, effortless set logging, and clear progression—without spreadsheets.
      </motion.p>
      <motion.div
        className="flex flex-col sm:flex-row gap-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, delay: 0.25 }}
      >
        <Link href="#early-access" className="group relative inline-flex items-center justify-center px-8 py-4 rounded-full font-medium text-white overflow-hidden">
          <span className="absolute inset-0 bg-gradient-to-r from-brand-500 via-electric-500 to-brand-400 opacity-90 group-hover:opacity-100 transition-opacity" />
            <span className="absolute inset-0 blur-xl bg-gradient-to-r from-brand-500 via-electric-500 to-brand-400 opacity-40 group-hover:opacity-70 transition" />
          <span className="relative z-10 flex items-center gap-2">Get Early Access <span aria-hidden>→</span></span>
        </Link>
        <Link href="#demo" className="relative inline-flex items-center justify-center px-8 py-4 rounded-full font-medium text-brand-300 border border-brand-500/40 hover:border-brand-400 transition-colors">
          Live Demo
        </Link>
      </motion.div>
      {/* Mock product frame */}
      <motion.div
        className="relative mt-10 w-full max-w-5xl rounded-2xl border border-slate-700/50 bg-slate-900/40 backdrop-blur-xl overflow-hidden shadow-glow-sm"
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.9, delay: 0.35 }}
      >
        <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-brand-500/10 via-electric-500/10 to-transparent pointer-events-none" />
        <div className="relative p-6 md:p-10 grid md:grid-cols-3 gap-8">
          <div className="col-span-2 space-y-5">
            <h3 className="text-lg font-semibold text-brand-200">Current Session</h3>
            <div className="space-y-4">
              {['Incline DB Press','Lat Pulldown','Machine Row','Lateral Raise'].map((n,i)=>(
                <div key={n} className="group relative rounded-xl border border-slate-700/60 bg-slate-800/40 p-4 flex items-center justify-between overflow-hidden">
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-r from-brand-500/5 via-electric-500/5 to-transparent" />
                  <div className="relative z-10 flex flex-col">
                    <span className="text-sm font-medium text-slate-200">{n}</span>
                    <span className="text-xs text-slate-400">Target Volume: {(i+4)*6} sets</span>
                  </div>
                  <div className="relative z-10 h-2 w-36 rounded bg-slate-700 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-brand-400 to-electric-500" style={{width: `${40 + i*12}%`}} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-5">
            <h3 className="text-lg font-semibold text-brand-200">Auto Insights</h3>
            <div className="rounded-xl border border-slate-700/60 bg-slate-800/50 p-4 space-y-4">
              <div className="text-sm text-slate-300 flex items-start gap-2">
                <span className="mt-1 inline-block h-2 w-2 rounded-full bg-brand-400 shadow-glow" /> Deload suggested next Pull session (lat volume high 3 weeks).
              </div>
              <div className="text-sm text-slate-300 flex items-start gap-2">
                <span className="mt-1 inline-block h-2 w-2 rounded-full bg-electric-500 shadow-glow" /> Chest volume perfect—stay the course.
              </div>
              <div className="text-sm text-slate-300 flex items-start gap-2">
                <span className="mt-1 inline-block h-2 w-2 rounded-full bg-brand-500 shadow-glow" /> Progression: +7% avg load vs 4 weeks ago.
              </div>
            </div>
            <div className="rounded-xl border border-slate-700/60 bg-slate-800/50 p-4">
              <h4 className="text-sm font-semibold text-slate-200 mb-2">Weekly Volume</h4>
              <div className="flex items-end gap-2 h-28">
                {[40,55,70,62,76,84].map((v,i)=>(
                  <div key={i} className="w-6 bg-gradient-to-t from-slate-700 to-brand-500/60 rounded-t relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-t from-brand-500 via-electric-500 to-brand-200 opacity-70" style={{clipPath:`inset(${100-v}% 0 0 0)`}} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const Benefits = () => {
  const items = [
    { title: 'Intelligent Volume Targets', body: 'Dynamic set & muscle group targets adapting to your progression trends.' },
    { title: 'Auto Deload Suggestions', body: 'Reduce guesswork—receive timing cues when recovery & performance patterns flag.' },
    { title: 'Frictionless Set Logging', body: 'Fast reps/RIR capture with smart defaults so you stay focused on lifting.' },
    { title: 'Offline-Ready PWA', body: 'Log anywhere; syncs when online—no spinning loaders mid-session.' },
    { title: 'Clear Progress Analytics', body: 'Volume, intensity, progression velocity visualized cleanly over time.' },
    { title: 'One Unlock—Full Access', body: 'Simple PayPal one-time purchase. No subscriptions or upsells.' }
  ];
  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
      {items.map((it,i)=>(
        <motion.div key={it.title} className="relative rounded-xl border border-slate-700/60 bg-slate-900/40 backdrop-blur-md p-6 overflow-hidden"
          initial={{opacity:0, y:30}} whileInView={{opacity:1,y:0}} viewport={{once:true, amount:0.3}} transition={{duration:0.7, delay: i*0.05}}>
          <div className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity bg-gradient-to-br from-brand-500/10 via-electric-500/10 to-transparent" />
          <h3 className="relative z-10 font-semibold text-brand-200 mb-2">{it.title}</h3>
          <p className="relative z-10 text-slate-400 text-sm leading-relaxed">{it.body}</p>
        </motion.div>
      ))}
    </div>
  );
};

const HowItWorks = () => {
  const steps = [
    { t: '1. Log Sets', d: 'Add sets with weight, reps, RIR in seconds—smart defaults remember last session.' },
    { t: '2. Track Volume', d: 'Session & weekly volume bars fill in real-time, highlighting focus gaps.' },
    { t: '3. Get Insights', d: 'Auto flags for deload, balanced growth, and progression velocity keep you on track.' }
  ];
  return (
    <div className="relative">
      <div className="absolute -inset-10 bg-brand-glow/40 opacity-40 pointer-events-none" />
      <ol className="relative z-10 space-y-10 max-w-3xl mx-auto">
        {steps.map((s,i)=>(
          <motion.li key={s.t} className="flex gap-6" initial={{opacity:0, x:-30}} whileInView={{opacity:1,x:0}} viewport={{once:true, amount:0.4}} transition={{duration:0.6, delay:i*0.05}}>
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-brand-500 to-electric-500 text-slate-900 font-bold flex items-center justify-center shadow-glow">{i+1}</div>
            <div>
              <h4 className="text-lg font-semibold text-slate-200 mb-1">{s.t}</h4>
              <p className="text-slate-400 text-sm leading-relaxed">{s.d}</p>
            </div>
          </motion.li>
        ))}
      </ol>
    </div>
  );
};

const PricingCTA = () => {
  return (
    <div id="early-access" className="relative max-w-4xl mx-auto text-center">
      <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-brand-500/10 via-electric-500/10 to-transparent blur-xl" />
      <div className="relative rounded-3xl border border-slate-700/60 bg-slate-900/40 backdrop-blur-xl p-12 overflow-hidden">
        <div className="absolute -left-1/2 top-1/2 -translate-y-1/2 w-[120%] h-[140%] rotate-12 bg-gradient-to-r from-brand-500/10 via-electric-500/10 to-transparent opacity-30" />
        <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-brand-400 via-electric-500 to-brand-500 bg-clip-text text-transparent mb-6">Early Access Pricing</h2>
        <p className="text-slate-300 max-w-2xl mx-auto mb-8">Unlock everything with a single one-time PayPal purchase when we launch. Early access users receive lifetime updates & priority feedback channel.</p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
          <div className="rounded-2xl border border-brand-500/50 bg-slate-800/60 px-10 py-8 shadow-glow-sm">
            <div className="text-5xl font-extrabold bg-gradient-to-r from-brand-400 to-electric-500 bg-clip-text text-transparent drop-shadow">$ ?</div>
            <div className="mt-3 text-sm text-slate-400">Founder rate — help shape the roadmap.</div>
          </div>
          <form className="flex flex-col sm:flex-row gap-4">
            <input type="email" required placeholder="you@example.com" className="px-5 py-4 rounded-full bg-slate-800/70 border border-slate-600/60 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/60 w-72" />
            <button type="submit" className="group relative inline-flex items-center justify-center px-8 py-4 rounded-full font-medium text-white overflow-hidden">
              <span className="absolute inset-0 bg-gradient-to-r from-brand-500 via-electric-500 to-brand-400 opacity-90 group-hover:opacity-100 transition-opacity" />
              <span className="absolute inset-0 blur-xl bg-gradient-to-r from-brand-500 via-electric-500 to-brand-400 opacity-40 group-hover:opacity-70 transition" />
              <span className="relative z-10">Join Waitlist</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

const FooterLite = () => (
  <footer className="py-12 text-center text-xs text-slate-600">
    <p>© {new Date().getFullYear()} Hypertrophy App. Built by Ciaran.</p>
  </footer>
);

export default function AppLandingPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-white font-sans">
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-950 to-slate-950" />
        <div className="absolute inset-0 mix-blend-screen opacity-60 bg-[radial-gradient(circle_at_25%_20%,rgba(0,185,255,0.12),transparent_60%),radial-gradient(circle_at_80%_70%,rgba(77,91,255,0.15),transparent_65%)]" />
      </div>
      <header className="relative z-10 flex items-center justify-between px-6 md:px-12 py-6">
        <div className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-electric-500 shadow-glow flex items-center justify-center text-slate-950 font-bold">H</span>
          <span className="text-slate-300">Hypertrophy</span>
        </div>
        <nav className="hidden md:flex items-center gap-8 text-sm text-slate-400">
          <a href="#benefits" className="hover:text-brand-300 transition-colors">Benefits</a>
          <a href="#how" className="hover:text-brand-300 transition-colors">How it Works</a>
          <a href="#early-access" className="hover:text-brand-300 transition-colors">Pricing</a>
          <a href="#demo" className="hover:text-brand-300 transition-colors">Demo</a>
        </nav>
        <Link href="#early-access" className="group relative inline-flex items-center justify-center px-5 py-2.5 rounded-full font-medium text-white overflow-hidden text-sm">
          <span className="absolute inset-0 bg-gradient-to-r from-brand-500 via-electric-500 to-brand-400 opacity-90 group-hover:opacity-100 transition-opacity" />
          <span className="absolute inset-0 blur-lg bg-gradient-to-r from-brand-500 via-electric-500 to-brand-400 opacity-30 group-hover:opacity-60 transition" />
          <span className="relative z-10">Join Waitlist</span>
        </Link>
      </header>
      <div className="relative z-10 px-6 md:px-12">
        <Section className="pb-10">
          <Hero />
        </Section>
        <Section id="benefits">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-14 bg-gradient-to-r from-brand-400 via-electric-500 to-brand-500 bg-clip-text text-transparent">Why It Works</h2>
            <Benefits />
          </div>
        </Section>
        <Section id="how">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-14 bg-gradient-to-r from-brand-400 via-electric-500 to-brand-500 bg-clip-text text-transparent">How It Works</h2>
            <HowItWorks />
          </div>
        </Section>
        <Section>
          <PricingCTA />
        </Section>
        <FooterLite />
      </div>
    </main>
  );
}
