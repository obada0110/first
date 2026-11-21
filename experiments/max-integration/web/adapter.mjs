import {EditorPort} from './core.mjs';
export function openFixture(schema, original) {
  const port = new EditorPort(schema);
  const call = (method, data) => JSON.parse(port.call(JSON.stringify({api:1,method,data})));
  const opened = call('open', original);
  if (!opened.ok) return {opened, original}; // Never reserialize unsupported documents.
  let revision = opened.revision;
  function edit(command) {
    const reply = call('edit', command);
    if (reply.ok) revision = reply.revision;
    return reply;
  }
  return {opened, call, edit, get revision() {return revision;},
    gesture() { // transient UI draft: no copies/checkpoints/full validation on pointermove
      const expectedRevision = revision;
      let latest = null, done = false;
      return {move(command) {if (!done) latest = command;}, cancel() {done=true;latest=null;},
        finish() {if (done || !latest) return null; done=true;return edit({...latest,expectedRevision});}};
    }};
}
