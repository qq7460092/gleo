import { registerFactory } from "./GliiFactory.mjs";

export default class WebGL1Clear {
	constructor(
		gl,
		{
			// @section
			// @aka WebGL1Clear options
			// @option color: Array of Number = [0.5, 0.5, 0.5, 0.0]; RGBA colour to clear with.
			// @alternative
			// @option color: false; When `false`, the colour part of the framebuffer is not cleared.
			color = [0.5, 0.5, 0.5, 0.0],
			// @option depth: Number = 1; The value to clear the depth part of the framebuffer with.
			// @alternative
			// @option depth: false; When `false`, the depth part of the framebuffer is not cleared.
			depth = 1,
			// @option stencil: Number = 0.5; The value to clear the stencil part of the framebuffer with.
			// @alternative
			// @option stencil: false; When `false`, the stencil part of the framebuffer is not cleared.
			stencil = 0,
			// @option target: null; When `target` is null or not specified) the default
			// framebuffer is cleared (the one attached to the `<canvas>` being used).
			// @alternative
			// @option target: FrameBuffer; The `FrameBuffer` to clear.
			target,
		}
	) {
		/// TODO: This needs a draw target - which canvas/RenderBuffer to use??!!
		/// i.e. make a call like gl.bindFrameBuffer(gl.FRAMEBUFFER, this._renderBuffer)
		this._gl = gl;
		this.color = color;
		this.depth = depth;
		this.stencil = stencil;
		this.target = target || null;
	}

	
	run() {
		const gl = this._gl;

		if (!this.target) {
			gl.bindFramebuffer(gl.FRAMEBUFFER, null);
			gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
		} else {
			gl.bindFramebuffer(gl.FRAMEBUFFER, this.target.fb);
			gl.viewport(0, 0, this.target.width, this.target.height);
		}

		let bitmask = 0;
		if (this.color !== false) {
			gl.clearColor(...this.color);
			bitmask |= gl.COLOR_BUFFER_BIT;
		}
		if (this.depth !== false) {
			gl.clearDepth(this.depth);
			bitmask |= gl.DEPTH_BUFFER_BIT;
		}
		if (this.stencil !== false) {
			gl.clearStencil(this.stencil);
			bitmask |= gl.STENCIL_BUFFER_BIT;
		}
		gl.clear(bitmask);
		return this;
	}
}

registerFactory("WebGL1Clear", function (gl) {
	return class WrappedWebGL1Clear extends WebGL1Clear {
		constructor(opts) {
			super(gl, opts);
		}
	};
});
