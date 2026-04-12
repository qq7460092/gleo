import RasterTileLoader from "./RasterTileLoader.mjs";
import abortableImagePromise from "../util/abortableImagePromise.mjs";
import create3857Pyramid from "../geometry/Pyramid3857.mjs";

import template from "../util/templateStr.mjs";

export default class MercatorTiles extends RasterTileLoader {
	
	constructor(templateStr, options = {}) {
		
		const pyramid = create3857Pyramid(
			options.minZoom || 0,
			options.maxZoom || 18,
			options.tileSize || 256
		);

		function fetchImage(z, x, y, controller) {
			return abortableImagePromise(
				template(templateStr, { x, y, z, ...options }),
				controller
			);
		}

		super(pyramid, fetchImage, options);
	}
}
