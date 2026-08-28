"use client";

import { useMemo, useState, type FormEvent } from "react";
import type {
  BuyerLens,
  ConfirmedListingFacts,
  DecisionResult,
  EvidenceEntry,
  ExtractionDraft,
  FactKey,
  Provenance,
} from "@/lib/contracts";
import { demoListings } from "@/lib/demo-listings";

type Stage = "bring" | "review" | "result";

const fieldLabels: Record<FactKey, string> = {
  askingPrice: "Asking price",
  beds: "Bedrooms",
  baths: "Bathrooms",
  squareFeet: "Square feet",
  daysOnMarket: "Days on market",
  status: "Listing status",
};

function nullableNumber(value: string) {
  if (!value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function evidenceForField(ledger: EvidenceEntry[], field: FactKey) {
  return ledger.find((entry) => entry.field === field && entry.source === "listing_text");
}

function decisionClass(decision: DecisionResult["decision"]) {
  return decision === "stop" ? "stop" : decision === "verify_first" ? "verify" : "tour";
}

function EvidenceChip({ id, ledger }: { id: string; ledger: EvidenceEntry[] }) {
  const entry = ledger.find((item) => item.id === id);
  if (!entry) return null;
  return (
    <span className="evidence-chip" title={entry.quote ?? entry.claim}>
      {entry.source === "visitor_confirmation" ? "Confirmed by you" : entry.quote ? `“${entry.quote}”` : "Evidence gap"}
    </span>
  );
}

export function RealInsightApp() {
  const [stage, setStage] = useState<Stage>("bring");
  const [profile, setProfile] = useState<BuyerLens>({
    maxBudget: 425000,
    mustHave: "two-car garage",
    dealBreaker: "tenant occupied",
  });
  const [demoId, setDemoId] = useState<string>("clear-fit");
  const [listingText, setListingText] = useState("");
  const [draft, setDraft] = useState<ExtractionDraft | null>(null);
  const [confirmedFacts, setConfirmedFacts] = useState<ConfirmedListingFacts | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [result, setResult] = useState<DecisionResult | null>(null);
  const [provenance, setProvenance] = useState<Provenance | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copyState, setCopyState] = useState("");

  const selectedDemo = useMemo(
    () => demoListings.find((demo) => demo.id === demoId) ?? null,
    [demoId],
  );

  function requestBody(phase: "extract" | "evaluate") {
    return {
      phase,
      profile,
      ...(demoId ? { demoId } : { listingText }),
      ...(phase === "evaluate"
        ? { confirmedFacts, factsConfirmed: confirmed, aiConsent: confirmed }
        : {}),
    };
  }

  async function extractFacts(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody("extract")),
      });
      const payload = await response.json() as { draft?: ExtractionDraft; error?: string };
      if (!response.ok || !payload.draft) throw new Error(payload.error || "The facts could not be extracted.");
      setDraft(payload.draft);
      setConfirmedFacts(payload.draft.facts);
      setProvenance(payload.draft.provenance);
      setConfirmed(false);
      setStage("review");
      requestAnimationFrame(() => document.getElementById("workspace")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The facts could not be extracted.");
    } finally {
      setLoading(false);
    }
  }

  async function evaluate(event: FormEvent) {
    event.preventDefault();
    if (!confirmedFacts || !confirmed) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody("evaluate")),
      });
      const payload = await response.json() as {
        result?: DecisionResult;
        provenance?: Provenance;
        error?: string;
      };
      if (!response.ok || !payload.result) throw new Error(payload.error || "The decision brief could not be created.");
      setResult(payload.result);
      setProvenance(payload.provenance ?? provenance);
      setStage("result");
      requestAnimationFrame(() => document.getElementById("workspace")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The decision brief could not be created.");
    } finally {
      setLoading(false);
    }
  }

  function updateFact(field: FactKey, value: string) {
    if (!confirmedFacts) return;
    setConfirmed(false);
    setConfirmedFacts({
      ...confirmedFacts,
      [field]: field === "status" ? value : nullableNumber(value),
    });
  }

  function chooseDemo(id: string) {
    setDemoId(id);
    setListingText("");
    setDraft(null);
    setResult(null);
    setError("");
  }

  function startOver() {
    setStage("bring");
    setDraft(null);
    setConfirmedFacts(null);
    setConfirmed(false);
    setResult(null);
    setError("");
    setCopyState("");
  }

  async function copyQuestions() {
    if (!result) return;
    const text = result.questions.map((item, index) => `${index + 1}. ${item.question}`).join("\n");
    await navigator.clipboard.writeText(text);
    setCopyState("Copied");
    window.setTimeout(() => setCopyState(""), 2000);
  }

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="https://dalyventures.com/" aria-label="Daly Ventures home">
          <span className="brand-mark">DV</span>
          <span className="brand-copy"><strong>RealInsight</strong><small>by Daly Ventures</small></span>
        </a>
        <nav aria-label="Primary">
          <a href="#workspace">Try the workflow</a>
          <a href="#architecture">How it works</a>
          <a className="nav-cta" href="https://dalyventures.com/artificialintelligence">Daly Ventures ↗</a>
        </nav>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow"><span /> Daly Ventures AI Lab · Live prototype</div>
          <h1>A listing is designed to sell.<br /><em>RealInsight is designed to question it.</em></h1>
          <p>
            See how bounded AI, deterministic rules, and human confirmation turn messy
            property language into a reviewable decision brief.
          </p>
          <div className="hero-actions">
            <a className="primary-link" href="#workspace">Try a safe demo <span>↓</span></a>
            <span className="microcopy">No sign-up · No data saved · About 60 seconds</span>
          </div>
        </div>
        <div className="agent-map" aria-label="RealInsight workflow diagram">
          <div className="map-orbit orbit-one" />
          <div className="map-orbit orbit-two" />
          <div className="map-core">
            <span>RI</span>
            <strong>Bounded<br />agent</strong>
          </div>
          <div className="map-node node-a"><b>01</b><span>Extract</span></div>
          <div className="map-node node-b"><b>02</b><span>Confirm</span></div>
          <div className="map-node node-c"><b>03</b><span>Apply rules</span></div>
          <div className="map-node node-d"><b>04</b><span>Act</span></div>
        </div>
      </section>

      <section className="trust-strip" aria-label="Trust principles">
        <div><span>01</span><strong>Source-bound facts</strong><small>Every extracted value shows its quote.</small></div>
        <div><span>02</span><strong>Human approval</strong><small>You correct or confirm before analysis.</small></div>
        <div><span>03</span><strong>Code-enforced rules</strong><small>The model cannot override a hard stop.</small></div>
        <div><span>04</span><strong>Safe abstention</strong><small>Unknown evidence stays unknown.</small></div>
      </section>

      <section className="workspace-shell" id="workspace">
        <div className="workspace-heading">
          <div>
            <p className="section-kicker">Live decision workflow</p>
            <h2>From listing copy to a defensible next step.</h2>
          </div>
          <div className="stepper" aria-label="Workflow progress">
            {(["bring", "review", "result"] as Stage[]).map((item, index) => (
              <span key={item} className={stage === item ? "active" : (["bring", "review", "result"].indexOf(stage) > index ? "done" : "")}>
                <b>{index + 1}</b>{item === "bring" ? "Bring listing" : item === "review" ? "Review facts" : "Decision brief"}
              </span>
            ))}
          </div>
        </div>

        {stage === "bring" && (
          <form className="workflow-grid" onSubmit={extractFacts}>
            <section className="panel buyer-panel">
              <div className="panel-heading">
                <span className="panel-number">01</span>
                <div><p>Your decision lens</p><h3>Define three boundaries.</h3></div>
              </div>
              <label>
                <span>Maximum budget</span>
                <div className="money-input"><b>$</b><input type="number" min="10000" max="50000000" value={profile.maxBudget} onChange={(event) => setProfile({ ...profile, maxBudget: Number(event.target.value) })} required /></div>
              </label>
              <label>
                <span>One essential feature</span>
                <input value={profile.mustHave} maxLength={120} onChange={(event) => setProfile({ ...profile, mustHave: event.target.value })} placeholder="e.g. two-car garage" required />
              </label>
              <label>
                <span>One deal-breaker</span>
                <input value={profile.dealBreaker} maxLength={120} onChange={(event) => setProfile({ ...profile, dealBreaker: event.target.value })} placeholder="e.g. tenant occupied" required />
              </label>
              <p className="panel-note">These are buyer-specific rules—not claims about a neighborhood or a property’s market value.</p>
            </section>

            <section className="panel listing-panel">
              <div className="panel-heading">
                <span className="panel-number">02</span>
                <div><p>Bring one listing</p><h3>Use a safe demo or paste text.</h3></div>
              </div>
              <div className="demo-grid" role="group" aria-label="Safe demo scenarios">
                {demoListings.map((demo) => (
                  <button type="button" className={demoId === demo.id ? "demo-card selected" : "demo-card"} onClick={() => chooseDemo(demo.id)} key={demo.id}>
                    <span>{demo.label}</span>
                    <small>{demo.description}</small>
                    <b>{demoId === demo.id ? "Selected ✓" : "Select →"}</b>
                  </button>
                ))}
              </div>
              <div className="or"><span>or paste listing text</span></div>
              <label>
                <span>Listing description</span>
                <textarea
                  value={demoId ? selectedDemo?.listingText ?? "" : listingText}
                  onChange={(event) => { setDemoId(""); setListingText(event.target.value); }}
                  placeholder="Paste public listing text here. Do not include names, contact details, or confidential information."
                  rows={9}
                  readOnly={Boolean(demoId)}
                />
              </label>
              <div className="data-notice">
                <span>Data boundary</span>
                <p>Nothing is saved to a shortlist. If live AI is enabled, confirmed listing text is sent to OpenAI only for bounded question drafting.</p>
              </div>
              <button className="primary-button" type="submit" disabled={loading}>
                {loading ? "Extracting facts…" : "Extract facts"} <span>→</span>
              </button>
            </section>
          </form>
        )}

        {stage === "review" && draft && confirmedFacts && (
          <form className="review-panel" onSubmit={evaluate}>
            <div className="review-intro">
              <div>
                <p className="section-kicker">Human confirmation gate</p>
                <h3>Review what the system extracted.</h3>
                <span className="provenance-badge">{draft.provenance.label}</span>
              </div>
              <p>Reported facts are not verified facts. Correct anything that is wrong; leave unsupported fields unknown.</p>
            </div>
            <div className="fact-table">
              {(Object.keys(fieldLabels) as FactKey[]).map((field) => {
                const source = evidenceForField(draft.evidenceLedger, field);
                const value = confirmedFacts[field];
                return (
                  <div className="fact-row" key={field}>
                    <label>
                      <span>{fieldLabels[field]}</span>
                      {field === "status" ? (
                        <select value={String(value)} onChange={(event) => updateFact(field, event.target.value)}>
                          <option value="unknown">Unknown</option>
                          <option value="active">Active</option>
                          <option value="pending">Pending</option>
                          <option value="sold">Sold</option>
                        </select>
                      ) : (
                        <input
                          type="number"
                          min="0"
                          step={field === "beds" || field === "baths" ? "0.5" : "1"}
                          value={typeof value === "number" ? value : ""}
                          onChange={(event) => updateFact(field, event.target.value)}
                          placeholder="Unknown"
                        />
                      )}
                    </label>
                    <div className={source?.quote ? "source-proof" : "source-proof missing"}>
                      <span>{source?.quote ? "Reported in listing" : "Evidence gap"}</span>
                      <q>{source?.quote ?? "No clear source excerpt found."}</q>
                    </div>
                  </div>
                );
              })}
            </div>
            <details className="source-details">
              <summary>View the full source text</summary>
              <pre>{draft.listingText}</pre>
            </details>
            <label className="confirm-box">
              <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
              <span>
                <strong>I reviewed these values.</strong>
                Unknowns can remain unknown. I understand that, when live AI is enabled, this listing text may be sent to OpenAI for bounded analysis and is not saved by this demo.
              </span>
            </label>
            {error && <p className="error-message" role="alert">{error}</p>}
            <div className="form-actions">
              <button type="button" className="secondary-button" onClick={() => setStage("bring")}>← Back</button>
              <button className="primary-button" type="submit" disabled={!confirmed || loading}>
                {loading ? "Creating brief…" : "Confirm and analyze"} <span>→</span>
              </button>
            </div>
          </form>
        )}

        {stage === "result" && result && (
          <div className="result-panel" aria-live="polite">
            <div className={`decision-hero ${decisionClass(result.decision)}`}>
              <div>
                <p>Decision state · {result.scoringVersion}</p>
                <h3>{result.decisionLabel}</h3>
                <span>{result.summary}</span>
              </div>
              <div className="decision-symbol" aria-hidden="true">
                {result.decision === "stop" ? "×" : result.decision === "verify_first" ? "?" : "↗"}
              </div>
            </div>

            <div className="result-metrics">
              <article>
                <span>Buyer fit</span>
                <strong>{result.buyerFitScore == null ? "—" : `${result.buyerFitScore}%`}</strong>
                <p>Fit to your three stated boundaries—not a property or market score.</p>
              </article>
              <article>
                <span>Evidence coverage</span>
                <strong>{result.evidenceCoverage}%</strong>
                <p>Share of critical listing facts that were reported and reviewed.</p>
              </article>
              <article>
                <span>Analysis mode</span>
                <strong className="mode-label">{result.analysisMode === "ai-assisted" ? "AI + rules" : "Rules demo"}</strong>
                <p>{result.analysisMode === "ai-assisted" ? "AI drafted questions; code decided." : "Deterministic fallback remained available."}</p>
              </article>
            </div>

            <div className="result-grid">
              <section className="result-card rationale-card">
                <div className="card-label">Why this state</div>
                <h4>The decision trail</h4>
                <ol>
                  {result.reasons.map((reason, index) => <li key={reason}><b>{String(index + 1).padStart(2, "0")}</b><span>{reason}</span></li>)}
                </ol>
              </section>
              <section className="result-card questions-card">
                <div className="card-topline">
                  <div><div className="card-label">Agent-ready output</div><h4>Questions to verify next</h4></div>
                  <button type="button" onClick={copyQuestions}>{copyState || "Copy all"}</button>
                </div>
                <ol>
                  {result.questions.map((item, index) => (
                    <li key={item.question}>
                      <b>{index + 1}</b>
                      <div>
                        <span>{item.question}</span>
                        <div>{item.evidenceIds.map((id) => <EvidenceChip key={id} id={id} ledger={result.evidenceLedger} />)}</div>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            </div>

            <section className="findings-section">
              <div className="findings-heading">
                <div><p className="section-kicker">Reviewable reasoning</p><h4>Findings stay attached to evidence.</h4></div>
                <p>AI language can clarify ambiguity. It cannot change the rule outcome.</p>
              </div>
              <div className="findings-grid">
                {result.findings.map((finding, index) => (
                  <article key={`${finding.kind}-${index}`}>
                    <div>
                      <span className={`outcome ${finding.outcome}`}>{finding.outcome}</span>
                      <small>{finding.kind.replaceAll("_", " ")}</small>
                    </div>
                    <p>{finding.explanation}</p>
                    <footer>
                      {finding.evidenceIds.length
                        ? finding.evidenceIds.map((id) => <EvidenceChip key={id} id={id} ledger={result.evidenceLedger} />)
                        : <span className="evidence-chip unknown">No supporting quote</span>}
                    </footer>
                  </article>
                ))}
              </div>
            </section>

            <details className="ledger">
              <summary>Open the evidence ledger <span>{result.evidenceLedger.length} entries</span></summary>
              <div>
                {result.evidenceLedger.map((entry) => (
                  <article key={entry.id}>
                    <span>{entry.status.replaceAll("_", " ")}</span>
                    <strong>{entry.claim}</strong>
                    <code>{entry.id}</code>
                  </article>
                ))}
              </div>
            </details>

            <div className="analysis-notice">
              <span>{result.analysisMode === "ai-assisted" ? "AI boundary" : "Fallback state"}</span>
              <p>{result.analysisNotice}</p>
            </div>
            <div className="result-actions">
              <button type="button" className="secondary-button" onClick={startOver}>Try another scenario</button>
              <a className="primary-button" href="https://dalyventures.com/artificialintelligence">Explore an AI pilot <span>↗</span></a>
            </div>
          </div>
        )}

        {error && stage !== "review" && <p className="error-message" role="alert">{error}</p>}
      </section>

      <section className="architecture" id="architecture">
        <div className="architecture-heading">
          <div><p className="section-kicker">What this demonstrates</p><h2>Agentic does not have to mean uncontrolled.</h2></div>
          <p>RealInsight is a compact example of how Daly Ventures turns an ambiguous workflow into a governed, useful AI system.</p>
        </div>
        <div className="architecture-grid">
          <article><span>01 · Interpret</span><h3>AI handles ambiguity</h3><p>Language models turn messy text into structured findings and targeted follow-up questions.</p></article>
          <article><span>02 · Ground</span><h3>Evidence stays visible</h3><p>Extracted values retain their source excerpts. Missing evidence is never silently filled in.</p></article>
          <article><span>03 · Govern</span><h3>Code owns authority</h3><p>Budget, deal-breakers, scoring, and decision states live in versioned deterministic rules.</p></article>
          <article><span>04 · Approve</span><h3>People stay in control</h3><p>A human confirmation gate separates machine interpretation from consequential action.</p></article>
        </div>
        <div className="architecture-band">
          <div><span>Pattern</span><strong>Interpret → Ground → Govern → Approve</strong></div>
          <p>The same pattern can support customer operations, intake, triage, compliance, reporting, and decision workflows.</p>
        </div>
      </section>

      <section className="business-cta">
        <div>
          <p className="section-kicker">From prototype to production</p>
          <h2>What would this pattern unlock in your business?</h2>
        </div>
        <p>Daly Ventures helps leaders identify the right AI workflow, prototype it quickly, and design the controls needed to deploy it responsibly.</p>
        <a href="https://dalyventures.com/artificialintelligence">Discuss an AI pilot <span>↗</span></a>
      </section>

      <footer className="site-footer">
        <div className="brand">
          <span className="brand-mark">DV</span>
          <span className="brand-copy"><strong>Daly Ventures</strong><small>AI strategy · prototypes · transformation</small></span>
        </div>
        <p>RealInsight is a demonstration, not real-estate, appraisal, inspection, lending, legal, or financial advice. Verify facts with qualified professionals.</p>
        <a href="https://dalyventures.com/">dalyventures.com ↗</a>
      </footer>
    </main>
  );
}
