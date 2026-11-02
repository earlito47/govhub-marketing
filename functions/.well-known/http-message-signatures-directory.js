// GovHubBot's Web Bot Auth key directory (see /bot/).
//
// Cloudflare's verified-bot check, and any site that verifies GovHubBot's
// signed requests, reads the public key here. The response is itself signed
// with that key (tag "http-message-signatures-directory"), so no one else can
// serve a copy of the directory as theirs. The private key is the Pages
// secret BOT_SIGNING_KEY, an Ed25519 JWK; the same key signs the crawler's
// requests (strata-parse: cloudflare-workers/src/opportunities/bot-auth.ts).
// https://developers.cloudflare.com/bots/reference/bot-verification/web-bot-auth/

const base64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const base64url = (bytes) => base64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** How long a copy of the signed directory stays valid. */
const VALID_SECONDS = 300;

export async function onRequestGet({ request, env }) {
  let jwk = null;
  try {
    jwk = JSON.parse(env.BOT_SIGNING_KEY ?? "");
  } catch {
    jwk = null;
  }
  if (!jwk || jwk.kty !== "OKP" || jwk.crv !== "Ed25519" || !jwk.d || !jwk.x) {
    return new Response("The key directory is not configured.", { status: 503 });
  }
  // RFC 7638 thumbprint: the required members, in lexicographic order.
  const thumbprintInput = JSON.stringify({ crv: "Ed25519", kty: "OKP", x: jwk.x });
  const keyid = base64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(thumbprintInput)));
  const key = await crypto.subtle.importKey("jwk", { kty: "OKP", crv: "Ed25519", d: jwk.d, x: jwk.x }, { name: "Ed25519" }, false, ["sign"]);

  const created = Math.floor(Date.now() / 1000);
  const nonce = base64url(crypto.getRandomValues(new Uint8Array(64)));
  const params = `("@authority";req);created=${created};keyid="${keyid}";alg="ed25519";expires=${created + VALID_SECONDS};nonce="${nonce}";tag="http-message-signatures-directory"`;
  const signatureBase = `"@authority";req: ${new URL(request.url).host}\n"@signature-params": ${params}`;
  const signature = await crypto.subtle.sign("Ed25519", key, new TextEncoder().encode(signatureBase));

  return new Response(JSON.stringify({ keys: [{ kty: "OKP", crv: "Ed25519", x: jwk.x }] }), {
    headers: {
      "Content-Type": "application/http-message-signatures-directory+json",
      "Signature-Input": `sig1=${params}`,
      Signature: `sig1=:${base64(signature)}:`,
      "Cache-Control": "public, max-age=60",
    },
  });
}
