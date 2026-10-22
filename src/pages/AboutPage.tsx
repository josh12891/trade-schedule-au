import { Link } from "react-router";
import { HardHat } from "lucide-react";

const SUPPORT = "australiancomsnetwork@gmail.com";

const SISTERS = [
  {
    name: "Tradies Toolbox",
    line: "Day-to-day checks and calculators for Australian tradies.",
  },
  {
    name: "AU Roof Carpenter",
    line: "Metric roof set-out — rafters, hips, and creepers.",
  },
] as const;

export function AboutPage() {
  return (
    <main className="min-h-dvh bg-canvas px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))] text-ink">
      <div className="mx-auto max-w-lg">
        <Link
          to="/"
          className="inline-flex h-11 items-center text-sm font-medium text-ink underline-offset-2 hover:underline"
        >
          Back to the board
        </Link>

        <div className="mt-4 overflow-hidden rounded-md border border-line bg-paper-2 shadow-sm">
          <div className="hazard-strip" aria-hidden="true" />
          <div className="flex items-center gap-3 px-5 py-5">
            <span className="grid size-12 shrink-0 place-items-center rounded-md bg-ink text-hi">
              <HardHat className="size-6" aria-hidden="true" />
            </span>
            <div>
              <p className="font-display text-3xl leading-none font-semibold tracking-wide">
                TRADE SCHEDULE
              </p>
              <p className="mt-1 text-sm text-muted">Australian Dynamics</p>
            </div>
          </div>
          <div className="space-y-3 px-5 pb-5 text-sm text-muted">
            <p>
              A job board for the site: trades, dates, and a PDF you can hand around. No login, no
              cloud, no ads. The schedule stays on this device.
            </p>
            <p>
              Bundle id <code className="text-ink">com.josh12891.tradeschedule</code>
            </p>
            <p>
              Support:{" "}
              <a className="font-semibold text-ink" href={`mailto:${SUPPORT}`}>
                {SUPPORT}
              </a>
            </p>
          </div>
        </div>

        <section className="mt-4 rounded-md border border-line bg-paper-2 px-5 py-5">
          <h2 className="font-display text-2xl leading-none font-semibold tracking-wide">
            ALSO FROM AUSTRALIAN DYNAMICS
          </h2>
          <ul className="mt-4 space-y-4">
            {SISTERS.map((app) => (
              <li key={app.name}>
                <p className="font-medium text-ink">{app.name}</p>
                <p className="text-sm text-muted">{app.line}</p>
                <p className="mt-1 text-sm text-muted">Search the App Store / Play Store</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-4 rounded-md border border-line bg-paper-2 px-5 py-5">
          <h2 className="font-display text-2xl leading-none font-semibold tracking-wide">PRIVACY</h2>
          <p className="mt-3 text-sm text-muted">
            Job names, tasks, and custom trades are stored in local storage on this device. Trade
            Schedule does not create an account or send the board to a server.
          </p>
          <p className="mt-3 text-sm">
            <a className="font-semibold text-ink underline-offset-2 hover:underline" href="./privacy.html">
              Privacy policy
            </a>
          </p>
        </section>
      </div>
    </main>
  );
}
