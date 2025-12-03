class EventBus {
	constructor() {
		this.handlers = Object.create(null);
	}

	on(event, handler) {
		if (!this.handlers[event]) this.handlers[event] = [];
		this.handlers[event].push(handler);
		return () => this.off(event, handler);
	}

	addListener(event, handler) { return this.on(event, handler); }

	off(event, handler) {
		if (!this.handlers[event]) return;
		this.handlers[event] = this.handlers[event].filter(h => h !== handler);
		if (this.handlers[event].length === 0) delete this.handlers[event];
	}

	removeListener(event, handler) { return this.off(event, handler); }

	once(event, handler) {
		const wrapper = (...args) => {
			try { handler(...args); } catch (e) { console.error('eventBus once handler error', e); }
			this.off(event, wrapper);
		};
		return this.on(event, wrapper);
	}

	emit(event, ...args) {
		const list = this.handlers[event];
		if (!list || list.length === 0) return;
		// clone to avoid mutation issues while emitting
		list.slice().forEach(h => {
			try { h(...args); } catch (e) { console.error('eventBus handler error', e); }
		});
	}
}

const eventBus = new EventBus();
export default eventBus;
