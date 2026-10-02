import Link from "next/link";
import { CATALOGUE, SLOT_META } from "@/lib/catalogue";
import { supplierCount } from "@/lib/quote";

export default function Home() {
  const howItWorks = [
    {
      n: "1",
      t: "Show us your venue",
      d: "Pick a sample room or upload a photo of your own — barn, orangery or hall.",
    },
    {
      n: "2",
      t: "Style it live",
      d: "Choose a look, then click any detail to swap it. The room and the price update on the spot.",
    },
    {
      n: "3",
      t: "See it itemised & priced",
      d: "Every item is real, from a named local supplier, with quantities scaled to your guest count.",
    },
    {
      n: "4",
      t: "Book the whole look",
      d: "One deposit secures every supplier for your date. No chasing ten separate quotes.",
    },
  ];

  const service = [
    {
      t: "You request to book",
      d: "Lock your look with a 25% deposit — held, not charged, until we confirm.",
    },
    {
      t: "A stylist confirms in 1 hour",
      d: "We check every supplier is free for your date and finalise the details with you.",
    },
    {
      t: "Suppliers are booked as one order",
      d: "We split the order to each local supplier and manage it so you don't have to.",
    },
    {
      t: "They deliver & set up on the day",
      d: "Everything in your render arrives and is styled in your venue. You just turn up.",
    },
  ];

  const showcaseItems = CATALOGUE.filter((i) => i.image).slice(0, 6);

  return (
    <div>
      {/* Hero */}
      <section className="grid items-center gap-10 py-14 md:grid-cols-2 md:py-20">
        <div>
          <p className="mb-4 inline-block rounded-full bg-sand px-3 py-1 text-xs font-medium uppercase tracking-wider text-clay">
            Essex · Herts · London fringe
          </p>
          <h1 className="font-serif text-5xl leading-[1.05] text-ink md:text-6xl">
            See your wedding in your own venue — and book the whole look.
          </h1>
          <p className="mt-5 max-w-md text-lg text-ink/70">
            Pinterest shows you the look but never who supplies it or what it
            costs. Style your actual room with real, priced items from local
            suppliers — swap anything, watch it update, book it in one place.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/plan"
              className="rounded-full bg-ink px-6 py-3 text-cream hover:bg-ink/90"
            >
              Style your venue — free
            </Link>
            <Link
              href="/plan"
              className="rounded-full border border-ink/20 px-6 py-3 text-ink hover:border-ink/40"
            >
              See how it works
            </Link>
          </div>
          <div className="mt-8 flex gap-8 text-sm text-ink/60">
            <div>
              <div className="font-serif text-2xl text-ink">
                {supplierCount()}
              </div>
              local suppliers
            </div>
            <div>
              <div className="font-serif text-2xl text-ink">
                {CATALOGUE.length}
              </div>
              bookable items
            </div>
            <div>
              <div className="font-serif text-2xl text-ink">60s</div>
              to your styled room
            </div>
          </div>
        </div>

        {/* Hero visual: real venue with item pins */}
        <div className="relative">
          <div className="overflow-hidden rounded-3xl shadow-xl ring-1 ring-black/5">
            <div className="relative aspect-[3/2]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/img/venues/oak_barn.png"
                alt="The Oak Barn styled"
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-[rgba(138,154,130,0.18)]" />
              <HeroPin
                src="/img/items/bd-rustic-arch.png"
                label="Timber Arch · £265"
                className="left-1/2 top-[14%] -translate-x-1/2"
              />
              <HeroPin
                src="/img/items/fl-wildflower.png"
                label="Wildflower · £78/table"
                className="left-[20%] top-[52%]"
              />
              <HeroPin
                src="/img/items/bar-horsebox.png"
                label="Horsebox Bar · £950"
                className="right-[14%] top-[46%]"
              />
              <span className="absolute left-3 top-3 rounded-full bg-black/45 px-2.5 py-1 text-[10px] uppercase tracking-wide text-white/90">
                Illustrative render
              </span>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between px-1">
            <div>
              <p className="font-serif text-lg text-ink">The Oak Barn</p>
              <p className="text-xs text-ink/50">Rustic Barn · 80 guests</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-ink/50">Itemised total</p>
              <p className="font-serif text-xl text-ink">£4,120</p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-12">
        <h2 className="mb-10 text-center font-serif text-3xl text-ink">
          From inspiration to booked — in four steps
        </h2>
        <div className="grid gap-6 md:grid-cols-4">
          {howItWorks.map((s) => (
            <div
              key={s.n}
              className="rounded-2xl border border-sand bg-white/50 p-6"
            >
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-ink font-serif text-cream">
                {s.n}
              </div>
              <h3 className="font-serif text-xl text-ink">{s.t}</h3>
              <p className="mt-2 text-sm text-ink/60">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* What you can style — real photos */}
      <section className="py-12">
        <div className="rounded-3xl bg-sand/60 p-8 md:p-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="font-serif text-3xl text-ink">
                Everything in the picture is real and bookable
              </h2>
              <p className="mt-2 max-w-xl text-ink/60">
                We only ever render items local suppliers can actually deliver —
                so the picture always matches the price.
              </p>
            </div>
            <Link
              href="/plan"
              className="rounded-full bg-ink px-5 py-2.5 text-sm text-cream hover:bg-ink/90"
            >
              Start styling
            </Link>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
            {showcaseItems.map((item) => (
              <div
                key={item.id}
                className="overflow-hidden rounded-xl bg-cream shadow-sm ring-1 ring-black/5"
              >
                <div className="aspect-square">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.image}
                    alt={item.name}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="p-2">
                  <p className="truncate text-[11px] font-medium text-ink">
                    {item.name}
                  </p>
                  <p className="text-[10px] text-ink/45">
                    £{item.unitPrice} {item.unit}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {SLOT_META.map((s) => (
              <span
                key={s.slot}
                className="rounded-full border border-ink/15 bg-cream px-3 py-1.5 text-xs text-ink/70"
              >
                {s.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* How the service works */}
      <section className="py-12">
        <div className="grid gap-10 md:grid-cols-[1fr_1.2fr]">
          <div>
            <h2 className="font-serif text-3xl text-ink">
              What happens after you book
            </h2>
            <p className="mt-3 text-ink/60">
              The render is just the start. Behind it is a concierge service that
              turns your chosen look into a real, co-ordinated wedding — so you
              deal with us once, not with ten separate suppliers.
            </p>
            <div className="mt-6 space-y-3 text-sm">
              <TrustLine>Free to use — you only pay suppliers, through us</TrustLine>
              <TrustLine>One 25% deposit secures every supplier for your date</TrustLine>
              <TrustLine>Every supplier is local, reviewed and vetted</TrustLine>
              <TrustLine>Renders are illustrative; final details confirmed by a stylist</TrustLine>
            </div>
          </div>
          <ol className="relative space-y-6 border-l border-sand pl-6">
            {service.map((s, i) => (
              <li key={s.t} className="relative">
                <span className="absolute -left-[31px] flex h-6 w-6 items-center justify-center rounded-full bg-ink text-xs text-cream">
                  {i + 1}
                </span>
                <h3 className="font-serif text-lg text-ink">{s.t}</h3>
                <p className="mt-1 text-sm text-ink/60">{s.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-14">
        <div className="rounded-3xl bg-ink px-8 py-12 text-center text-cream">
          <h2 className="font-serif text-4xl">Your venue. Your look. One checkout.</h2>
          <p className="mx-auto mt-3 max-w-md text-cream/70">
            Style your wedding in minutes and see exactly what it costs — no
            sign-up, no obligation.
          </p>
          <Link
            href="/plan"
            className="mt-6 inline-block rounded-full bg-cream px-7 py-3 text-ink hover:bg-cream/90"
          >
            Style your venue — free
          </Link>
        </div>
      </section>
    </div>
  );
}

function HeroPin({
  src,
  label,
  className,
}: {
  src: string;
  label: string;
  className: string;
}) {
  return (
    <div className={`absolute ${className}`}>
      <div className="h-16 w-16 overflow-hidden rounded-2xl bg-cream shadow-xl ring-2 ring-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={label} className="h-full w-full object-cover" />
      </div>
      <span className="mt-1 block whitespace-nowrap rounded-full bg-cream/95 px-2 py-0.5 text-[10px] font-medium text-ink shadow">
        {label}
      </span>
    </div>
  );
}

function TrustLine({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-ink/70">
      <span className="mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded-full bg-sage/30 text-[10px] text-sage">
        ✓
      </span>
      {children}
    </div>
  );
}
