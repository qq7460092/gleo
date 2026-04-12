import GleoMap from "./Map.mjs";

import epsg3857 from "../crs/epsg3857.mjs";
import "../actuator/DragActuator.mjs";
import "../actuator/PinchActuator.mjs";
import "../actuator/WheelActuator.mjs";
import "../actuator/InertiaActuator.mjs";
import "../actuator/SpanClampActuator.mjs";
import "../actuator/ZoomYawSnapActuator.mjs";
import "../actuator/BoundsClampActuator.mjs";

import ZoomInOut from "../control/ZoomInOut.mjs";
import ScaleBar from "../control/ScaleBar.mjs";
import Attribution from "../control/Attribution.mjs";

import { setFactory } from "../geometry/DefaultGeometry.mjs";
import LatLng from "../geometry/LatLng.mjs";

export default class MercatorMap extends GleoMap {
	
	constructor(container, { ...options } = {}) {
		super(container, { crs: epsg3857, ...options });

		new ZoomInOut().addTo(this);
		new ScaleBar().addTo(this);
		new Attribution().addTo(this);
	}
}

setFactory(function latLngize(coords, opts) {
	return new LatLng(coords, opts);
});
