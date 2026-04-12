// ES6-style class mixin (see
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes#mix-ins )
// for both `GleoMouseEvent` and `GleoPointerEvent`

export default function GleofyEventClass(Base) {
	return class GleoEvent extends Base {
		constructor(type, init) {
			super(type, init);

			
			this.geometry = init.geometry;
			this.canvasX = init.canvasX;
			this.canvasY = init.canvasY;

			
			this.colour = init.colour;

			this._canPropagate = true;
		}

		stopPropagation() {
			this._canPropagate = false;
			return super.stopPropagation();
		}
	};
}
