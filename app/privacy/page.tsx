import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy | RealInsight",
  description: "How the RealInsight demonstration handles visitor inputs, cookies, abuse-control records, and optional AI processing.",
};

export default function PrivacyPage() {
  return (
    <main className="policy-page">
      <Link className="policy-back" href="/">← Back to RealInsight</Link>
      <article>
        <p className="section-kicker">RealInsight demonstration</p>
        <h1>Privacy notice</h1>
        <p className="policy-updated">Updated August 27, 2026</p>

        <h2>What the application does not store</h2>
        <p>
          RealInsight does not save listing text, buyer boundaries, confirmed facts, evidence ledgers,
          AI-drafted questions, or decision briefs to an application database or shortlist.
          The browser holds the current workflow only while the page is open.
        </p>

        <h2>Session and abuse controls</h2>
        <p>
          The application sets a random anonymous session cookie for up to 30 days. The cookie is
          HttpOnly and SameSite=Lax, and Secure on HTTPS. For live-AI abuse controls, the server stores
          a keyed hash derived from the Cloudflare-provided client address when available, or otherwise
          the anonymous session identifier, together with a request timestamp. It does not put the raw
          address or session identifier in the rate-limit table. Records older than 24 hours are removed
          opportunistically, so removal may occur later if the service receives no new live-AI requests.
        </p>

        <h2>Optional OpenAI processing</h2>
        <p>
          Live AI is disabled by default. When the operator enables it, an API key is configured, and a
          visitor confirms the data notice, the server sends the confirmed listing text, buyer boundaries,
          confirmed facts, and evidence ledger to the OpenAI Responses API. OpenAI is asked only to draft
          evidence-linked follow-up questions. The request also includes a hashed anonymous safety identifier
          derived from the session identifier. Versioned application code retains authority over every rule,
          calculation, and decision state.
        </p>

        <h2>Your choices</h2>
        <p>
          Use a clearly synthetic built-in scenario if you do not want to submit listing text. Do not submit
          names, contact details, confidential information, or non-public documents. You can clear the
          anonymous cookie through your browser settings.
        </p>

        <h2>Questions</h2>
        <p>
          For a privacy question, contact Daly Ventures through the
          {" "}<a href="https://dalyventures.com/">Daly Ventures website</a>.
        </p>
      </article>
    </main>
  );
}
