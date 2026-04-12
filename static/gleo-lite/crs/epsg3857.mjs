import BaseCRS from "./BaseCRS.mjs";

import epsg4326 from "./epsg4326.mjs";

const limit = 20037508.34;

const epsg3857 = new BaseCRS("EPSG:3857", {
	wrapPeriodX: 2 * limit,
	distance: epsg4326,
	ogcUri: "http://www.opengis.net/def/crs/EPSG/0/3857",
	minSpan: 1,
	maxSpan: 4 * limit,
	viewableBounds: [-Infinity, -limit, Infinity, limit],
});

export default epsg3857;
