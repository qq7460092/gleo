import ButtonGroup from "./ButtonGroup.mjs";
import ZoomIn from "./ZoomIn.mjs";
import ZoomOut from "./ZoomOut.mjs";

export default class ZoomInOut extends ButtonGroup {
	constructor({ direction = "vertical", ...opts } = {}) {
		super({
			direction,
			buttons: [new ZoomIn(), new ZoomOut()],
			...opts,
		});
	}
}
