import { EventEmitter } from 'events';

const studioEvents = new EventEmitter();
let eventCounter = 0;

studioEvents.setMaxListeners(0);

export function broadcastStudioEvent(type, payload = {}) {
  const event = {
    id: `${Date.now()}-${eventCounter += 1}`,
    type,
    occurredAt: new Date().toISOString(),
    payload
  };

  studioEvents.emit('studio.changed', event);
  return event;
}

export function subscribeStudioEvents(listener) {
  studioEvents.on('studio.changed', listener);

  return () => {
    studioEvents.off('studio.changed', listener);
  };
}
