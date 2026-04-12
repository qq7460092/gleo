import { default as typeMap } from "../util/typeMap.mjs";

function stridify(arrayType) {
	
	return class StridedTypeArray extends arrayType {
		#stride;
		#offset;

		constructor(buffer, stride, offset) {
			super(buffer);

			this.#stride = stride;
			this.#offset = offset;
		}

		
		set(values, index) {
			super.set(values, index * this.#stride + this.#offset);
		}
	};
}

const stridedArrays = new Map(Array.from(typeMap.keys()).map((t) => [t, stridify(t)]));

export default stridedArrays;
