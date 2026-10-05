// One structured LLM call: system + user in, schema-valid JSON out.
//
// OpenAI because that is the key this repo's automation already runs on
// (scripts/insights/generate-narratives.mjs). The model is an env knob because
// the two jobs here pull in different directions: reading a 60-page lease RLP
// for the clause that disqualifies wants the strongest model available, while
// classifying "No." does not need a model at all (classify.mjs short-circuits
// it). REPLY_DESK_MODEL defaults to the strongest model this key was verified
// against on 2026-10-04.
//
// strict json_schema means every property must be listed in `required` and
// every object must set additionalProperties:false. Optional values are
// modelled as "" or [] rather than omitted.

const MODEL = process.env.REPLY_DESK_MODEL || 'gpt-5.5';

export async function structured({ system, user, schemaName, schema, model = MODEL }) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY is not set');
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        response_format: { type: 'json_schema', json_schema: { name: schemaName, strict: true, schema } },
      }),
    });
    const text = await res.text();
    if (res.status === 429 || res.status >= 500) {
      lastErr = new Error(`OpenAI ${res.status}: ${text.slice(0, 200)}`);
      await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
      continue;
    }
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${text.slice(0, 300)}`);
    const d = JSON.parse(text);
    const msg = d.choices?.[0]?.message;
    if (msg?.refusal) throw new Error(`OpenAI refused: ${msg.refusal}`);
    if (!msg?.content) throw new Error('OpenAI returned empty content');
    return JSON.parse(msg.content);
  }
  throw lastErr;
}

// Small schema helpers so the schemas below read like the data they describe.
export const S = {
  str: (description) => ({ type: 'string', ...(description ? { description } : {}) }),
  bool: (description) => ({ type: 'boolean', ...(description ? { description } : {}) }),
  num: (description) => ({ type: 'number', ...(description ? { description } : {}) }),
  enum: (values, description) => ({ type: 'string', enum: values, ...(description ? { description } : {}) }),
  arr: (items, description) => ({ type: 'array', items, ...(description ? { description } : {}) }),
  obj: (properties, description) => ({
    type: 'object',
    additionalProperties: false,
    required: Object.keys(properties),
    properties,
    ...(description ? { description } : {}),
  }),
};
