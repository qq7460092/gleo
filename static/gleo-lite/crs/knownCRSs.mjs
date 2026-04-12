

const knownCRSs = new Map();

// This is a super-simplistic CURIE parser that doesn't take into account
// the full spec (the full list of valid characters), instead parses only
// the brackets, double colon and non-whitespace. See https://www.w3.org/TR/curie/ .
const curieRegexp = /^\[(\S+):(\S+)\]$/;

export function getCRS(ogcUri) {
	const match = curieRegexp.exec(ogcUri);
	let uri = ogcUri;
	if (match) {
		const [_, authority, code] = match;
		uri = `http://www.opengis.net/def/crs/${authority}/0/${code}`;
	}
	const crs = knownCRSs.get(uri);
	if (!crs) {
		throw new Error(
			"There is no known Gleo CRS for the given name/OGC URI: " + ogcUri
		);
	}
	return crs;
}

export function registerCRS(crs, overrideUri) {
	const uri = overrideUri ?? crs.ogcUri;
	if (uri) {
		if (knownCRSs.has(uri)) {
			throw new Error("CRS has been defined twice for the given OGC URL: " + uri);
		}
		knownCRSs.set(uri, crs);
	}
	knownCRSs.set(crs.name, crs);
}
