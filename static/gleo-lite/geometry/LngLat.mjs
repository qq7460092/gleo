import Geometry from "./Geometry.mjs";
import epsg4326 from "../crs/epsg4326.mjs";

export default class LngLat extends Geometry {
	
	constructor(xy, opts) {
		super(epsg4326, xy, opts);
	}
}
