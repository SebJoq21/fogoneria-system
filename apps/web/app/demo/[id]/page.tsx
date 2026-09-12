import { notFound } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { demoData, type Demo } from "@/lib/demo";

export function generateStaticParams() {
  return [{ id: "criolla" }, { id: "postres" }, { id: "cafe" }];
}

function Elegant({ data }: { data: Demo }) {
  return (
    <div className="min-h-screen bg-slate-950 text-white font-serif">
      <header className="relative w-full h-[70vh] flex items-center justify-center text-center">
        <div className="absolute inset-0 bg-black/70 z-10" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={data.heroBg} alt={data.name} className="absolute inset-0 w-full h-full object-cover z-0 grayscale-[20%]" />
        <div className="relative z-20 px-4 py-12 flex flex-col items-center">
          <div className="w-px h-16 bg-orange-500/50 mb-8 mx-auto" />
          <h1 className="text-5xl md:text-7xl font-light tracking-[0.2em] uppercase mb-6">{data.name}</h1>
          <p className={`text-2xl ${data.textColor} italic font-light`}>{data.slogan}</p>
          <div className="w-px h-16 bg-orange-500/50 mt-8 mx-auto" />
        </div>
      </header>

      {data.about && (
        <section className="w-full bg-slate-900 border-y border-white/5">
          <div className="max-w-6xl mx-auto px-6 py-24">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              <div className="relative h-[500px] w-full hidden lg:block group overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={data.about.image} alt="Nuestro Local" className="absolute inset-0 w-full h-full object-cover grayscale-[20%] group-hover:grayscale-0 transition-all duration-700" />
                <div className="absolute inset-4 border border-white/20 z-10 pointer-events-none" />
              </div>
              <div className="flex flex-col gap-10">
                <div>
                  <h2 className="text-sm tracking-[0.3em] uppercase text-slate-500 mb-4">Nuestra Historia</h2>
                  <h3 className="text-3xl lg:text-4xl font-light leading-snug mb-6 text-slate-200">
                    Rescatando la esencia de la gastronomía peruana.
                  </h3>
                  <p className="text-slate-400 font-sans font-light leading-relaxed mb-6 text-lg">
                    {data.about.description}
                  </p>
                  <p className={`font-medium ${data.textColor} tracking-widest uppercase text-sm`}>
                    {data.about.years}
                  </p>
                </div>
                <div className="bg-white/5 border border-white/10 p-8 grid sm:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-xs tracking-widest uppercase text-slate-500 mb-2">Ubicación</h4>
                    <p className="text-slate-300 font-sans text-sm">{data.about.location}</p>
                  </div>
                  <div>
                    <h4 className="text-xs tracking-widest uppercase text-slate-500 mb-2">Horario</h4>
                    <p className="text-slate-300 font-sans text-sm">{data.about.schedule}</p>
                  </div>
                  <div className="sm:col-span-2 pt-4 border-t border-white/10">
                    <button className="w-full bg-slate-100 hover:bg-white text-slate-900 font-sans font-semibold py-3 transition-colors text-sm uppercase tracking-wider cursor-pointer">
                      Reservar una Mesa
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      <main className="w-full bg-slate-950">
        <div className="max-w-5xl mx-auto px-6 py-24">
          <h2 className="text-3xl font-light text-center uppercase tracking-widest mb-2">La Carta</h2>
          <div className="w-12 h-px bg-orange-500 mx-auto mb-16" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-16">
            {data.items.map((item, i) => (
              <div key={i} className="flex gap-6 group cursor-pointer">
                {item.image && (
                  <div className="w-24 h-24 sm:w-32 sm:h-32 shrink-0 overflow-hidden relative">
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors z-10" />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.image} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                  </div>
                )}
                <div className="flex flex-col flex-1">
                  <div className="flex justify-between items-start mb-2 gap-4">
                    <h3 className="text-xl sm:text-2xl font-medium tracking-wide text-slate-200 group-hover:text-white transition-colors">{item.name}</h3>
                    <span className={`text-xl font-light ${data.textColor}`}>{item.price}</span>
                  </div>
                  <div className="w-full border-b border-dashed border-white/10 mb-3 hidden sm:block" />
                  <p className="text-slate-400 font-sans font-light text-sm leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

function Playful({ data }: { data: Demo }) {
  return (
    <div className="min-h-screen bg-pink-50 font-sans">
      <header className="relative w-full h-[50vh] flex items-center justify-center">
        <div className="absolute inset-0 bg-pink-900/40 z-10" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={data.heroBg} alt={data.name} className="absolute inset-0 w-full h-full object-cover z-0" />
        <div className="relative z-20 text-center px-4 bg-white/90 p-8 rounded-[3rem] shadow-xl mx-4 translate-y-16">
          <h1 className={`text-4xl md:text-6xl font-black ${data.textColor} mb-2`}>{data.name}</h1>
          <p className="text-lg text-slate-600 font-medium">{data.slogan}</p>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-6 pt-32 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {data.items.map((item, i) => (
            <div key={i} className="bg-white p-8 rounded-[2rem] shadow-sm hover:shadow-xl hover:-translate-y-2 transition-all text-center border-2 border-pink-100">
              <span className={`block text-3xl font-black ${data.textColor} mb-4`}>{item.price}</span>
              <h3 className="text-xl font-bold text-slate-800 mb-3">{item.name}</h3>
              <p className="text-slate-500 text-sm">{item.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

function Minimalist({ data }: { data: Demo }) {
  return (
    <div className="min-h-screen bg-white font-sans">
      <header className="relative w-full h-[60vh] flex items-center justify-start">
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent z-10" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={data.heroBg} alt={data.name} className="absolute inset-0 w-full h-full object-cover z-0" />
        <div className="relative z-20 px-8 md:px-24 max-w-3xl">
          <div className="w-16 h-1 bg-white mb-6" />
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-4 tracking-tight">{data.name}</h1>
          <p className="text-xl text-slate-300">{data.slogan}</p>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-8 py-20">
        <div className="space-y-8">
          {data.items.map((item, i) => (
            <div key={i} className="flex flex-col md:flex-row md:items-center justify-between p-6 bg-slate-50 rounded-lg">
              <div className="mb-4 md:mb-0">
                <h3 className="text-lg font-bold text-slate-900">{item.name}</h3>
                <p className="text-slate-600 mt-1">{item.desc}</p>
              </div>
              <span className="text-xl font-bold text-slate-900 bg-white px-4 py-2 rounded shadow-sm">{item.price}</span>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

export default async function DemoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = demoData[id];
  if (!data) notFound();

  return (
    <>
      <Button
        href="/"
        className="fixed top-6 left-6 z-50 gap-2 shadow-lg"
      >
        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        Volver al login
      </Button>

      {data.template === "elegant" && <Elegant data={data} />}
      {data.template === "playful" && <Playful data={data} />}
      {data.template === "minimalist" && <Minimalist data={data} />}

      <footer className={`${data.theme} text-white py-12 text-center relative z-20`}>
        <p className="font-medium text-lg">© 2026 {data.name}</p>
        <p className="text-sm opacity-70 mt-2">Sitio web demo generado por Fogonería</p>
      </footer>
    </>
  );
}
