

function gleoProject(sCRS, dCRS, xy) {
	if (sCRS === "EPSG:4326" && dCRS === "EPSG:3857") {
		return lnglat2webmercator(xy);
	} else if (sCRS === "EPSG:3857" && dCRS === "EPSG:4326") {
		return webmercator2lnglat(xy);
	} else {
		throw new Error(`Unsupported coordinate reprojection ${sCRS}→${dCRS}`);
	}
}

gleoProject.defs = function noop() {};

export let project = gleoProject;

export function registerProjectionFunction(sCRS, dCRS, fn) {
	const prev = gleoProject;
	gleoProject = function gleoProject(s, d, xy) {
		if (s === sCRS && d === dCRS) {
			return fn(xy);
		} else {
			return prev(s, d, xy);
		}
	};
	if (project === prev) {
		project = gleoProject;
	}
}

export function enableProj(proj) {
	if (proj) {
		project = proj;
	} else {
		project = gleoProject;
	}
}

const R = 6378137; // Earth's radius as per spherical mercator
const D = Math.PI / 180; // One degree, in radians
const rad = 180 / Math.PI; // One radian, in degrees
const halfPi = Math.PI / 2;

function lnglat2webmercator([lng, lat]) {
	const sin = Math.sin(lat * D);
	return [R * D * lng, (R * Math.log((1 + sin) / (1 - sin))) / 2];
}

function webmercator2lnglat([x, y]) {
	return [(x * rad) / R, (2 * Math.atan(Math.exp(y / R)) - halfPi) * rad];
}
