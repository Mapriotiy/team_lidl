const services = ['Process automation', 'Cybersecurity', 'Software development']

export function App() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
      <section className="mx-auto max-w-5xl">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-400">
          Team LIDL
        </p>
        <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">
          Evidence-backed sales intelligence
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
          Prioritize companies by service, inspect the public evidence, and turn verified signals
          into clear sales actions.
        </p>

        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          {services.map((service) => (
            <article className="rounded-2xl border border-slate-800 bg-slate-900 p-5" key={service}>
              <p className="text-sm text-slate-400">Service profile</p>
              <h2 className="mt-2 text-lg font-medium">{service}</h2>
            </article>
          ))}
        </div>

        <p className="mt-10 text-sm text-slate-500">Application scaffold is running.</p>
      </section>
    </main>
  )
}

