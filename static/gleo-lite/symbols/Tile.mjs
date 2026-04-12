import GleoSymbol from "./Symbol.mjs";

export default class Tile extends GleoSymbol {
	
	constructor(geom, levelName, tileX, tileY, image) {
		super(geom);

		this.level = levelName;
		this.tileX = tileX;
		this.tileY = tileY;
		this.image = image;

		this.attrLength = 4;
		this.idxLength = 6;
	}
}
