const OFFER_FRAGMENT_MARKER = "#offer=";
const OFFER_QUERY_PARAM = "offer";

function parsedUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function queryOfferValue(value: string): string | undefined {
  const queryValues = parsedUrl(value)?.searchParams.getAll(OFFER_QUERY_PARAM);
  if (queryValues === undefined || queryValues.length === 0) {
    return undefined;
  }
  if (queryValues.length > 1) {
    throw new Error("pairing offer URL contains multiple offer values");
  }
  return queryValues[0];
}

function fragmentOfferValue(value: string): string | undefined {
  const firstMarkerIndex = value.indexOf(OFFER_FRAGMENT_MARKER);
  if (firstMarkerIndex === -1) {
    return undefined;
  }
  const secondMarkerIndex = value.indexOf(
    OFFER_FRAGMENT_MARKER,
    firstMarkerIndex + OFFER_FRAGMENT_MARKER.length,
  );
  if (secondMarkerIndex !== -1) {
    throw new Error("pairing offer URL contains multiple offer values");
  }
  return value.slice(firstMarkerIndex + OFFER_FRAGMENT_MARKER.length).trim();
}

function requireSingleOfferPayload(
  queryValue: string | undefined,
  fragmentValue: string | undefined,
): string {
  if (queryValue !== undefined && fragmentValue !== undefined) {
    throw new Error("pairing offer URL contains multiple offer values");
  }
  const encoded = queryValue ?? fragmentValue;
  if (encoded === undefined) {
    throw new Error("pairing offer URL is missing offer payload");
  }
  return encoded.trim();
}

function extractOfferPayload(urlOrFragment: string): string {
  const value = urlOrFragment.trim();
  return requireSingleOfferPayload(
    queryOfferValue(value),
    fragmentOfferValue(value),
  );
}

export { extractOfferPayload };
