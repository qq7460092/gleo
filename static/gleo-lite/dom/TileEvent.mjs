

export default class TileEvent extends Event {
	constructor(type, init) {
		super(type, init);
		this.tileLevel = init.tileLevel;
		this.tileX = init.tileX;
		this.tileY = init.tileY;
		this.tile = init.tile;
		this.error = init.error;
	}
}
