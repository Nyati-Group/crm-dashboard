/** What the assistant says for anything outside the dashboard's sales data. */
export const OUT_OF_SCOPE_REPLY =
  'Sorry, this is out of my knowledge. I can only answer questions about Nyati sales, collection, registration, outstanding and project details shown in this dashboard.';

/** Marker the model is told to output for out-of-scope questions; replaced by OUT_OF_SCOPE_REPLY. */
export const OUT_OF_SCOPE_MARKER = 'OUT_OF_SCOPE';

export const GREETING_RE = /^(hi|hii+|hello|hey|namaste|good (morning|afternoon|evening)|thanks|thank you|ok|okay)\b[\s!.?]*$/i;
export const GREETING_REPLY =
  'Hello! I can answer questions about Nyati sales, collection, registration, outstanding and project details in this dashboard. For example: "What is the annual collection vs budget?"';
