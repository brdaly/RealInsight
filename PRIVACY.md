# RealInsight privacy notice

_Updated August 27, 2026_

This notice describes the application-specific behavior of the public
RealInsight demonstration.

## Inputs that are not stored

RealInsight does not save listing text, buyer boundaries, confirmed facts,
evidence ledgers, AI-drafted questions, or decision briefs to an application
database or shortlist. The browser holds the current workflow only while the
page is open.

## Session and abuse controls

The application sets a random anonymous session cookie for up to 30 days. The
cookie is HttpOnly and SameSite=Lax, and Secure on HTTPS.

When live AI is enabled, the server uses a keyed hash derived from the
Cloudflare-provided client address when available, or otherwise the anonymous
session identifier, to enforce abuse limits. D1 stores only that keyed hash and
a request timestamp; the rate-limit table does not store the raw address or
session identifier. Records older than 24 hours are removed opportunistically,
so removal can occur later when the service receives no new live-AI requests.

## Optional OpenAI processing

Live AI is disabled by default. When the operator enables it, an API key is
configured, and a visitor confirms the data notice, the server sends the
confirmed listing text, buyer boundaries, confirmed facts, and evidence ledger
to the OpenAI Responses API. OpenAI is asked only to draft evidence-linked
follow-up questions. The request also includes a hashed anonymous safety
identifier derived from the session identifier. Versioned application code owns
the rules, calculations, and decision state. RealInsight does not store the
submitted inputs or returned decision brief in its application database.

## Visitor choices

Use a clearly synthetic built-in scenario if you do not want to submit listing
text. Do not submit names, contact details, confidential information, or
non-public documents. You can clear the anonymous cookie through your browser
settings.

For a privacy question, contact Daly Ventures through
<https://dalyventures.com/>.
