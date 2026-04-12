

export default class ExpandBox {
	constructor() {
		this.reset();
	}

	
	reset() {
		
		this.minX = this.minY = Infinity;
		this.maxX = this.maxY = -Infinity;
		return this;
	}

	
	clone() {
		const newBox = new ExpandBox();
		newBox.minX = this.minX;
		newBox.minY = this.minY;
		newBox.maxX = this.maxX;
		newBox.maxY = this.maxY;
		return newBox;
	}

	
	expandPair([x, y]) {
		this.minX = Math.min(this.minX, x);
		this.maxX = Math.max(this.maxX, x);
		this.minY = Math.min(this.minY, y);
		this.maxY = Math.max(this.maxY, y);
		return this;
	}

	
	expandXY(x, y) {
		this.minX = Math.min(this.minX, x);
		this.maxX = Math.max(this.maxX, x);
		this.minY = Math.min(this.minY, y);
		this.maxY = Math.max(this.maxY, y);
		return this;
	}

	
	expandGeometry(geom) {
		const coords = geom.coords;
		for (let i = 0, l = coords.length; i < l; i += 2) {
			this.expandXY(coords[i], coords[i + 1]);
		}
		return this;
	}

	
	expandPercentage(p) {
		const h = this.maxX - this.minX;
		const w = this.maxY - this.minY;
		if (isFinite(w)) {
			this.minX -= w * p;
			this.maxX += w * p;
		}
		if (isFinite(h)) {
			this.minY -= h * p;
			this.maxY += h * p;
		}

		return this;
	}

	
	expandPercentages(px, py) {
		const h = this.maxX - this.minX;
		const w = this.maxY - this.minY;
		if (isFinite(w)) {
			this.minX -= w * px;
			this.maxX += w * px;
		}
		if (isFinite(h)) {
			this.minY -= h * py;
			this.maxY += h * py;
		}

		return this;
	}

	
	intersectsBox(b) {
		return (
			b.maxX > this.minX &&
			b.minX < this.maxX &&
			b.maxY > this.minY &&
			b.minY < this.maxY
		);
	}

	
	containsBox(b) {
		return (
			b.maxX < this.maxX &&
			b.minX > this.minX &&
			b.maxY < this.maxY &&
			b.minY > this.minY
		);
	}
}
