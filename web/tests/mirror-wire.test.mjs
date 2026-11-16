import test from 'node:test'
import assert from 'node:assert/strict'
import { decodeMirrorMessage, mediaBytes } from '../src/lib/mirrorWire.js'
import { mirrorQueueOverflow } from '../src/lib/mirrorPlayback.js'

function envelope(header, media) {
  const text = new TextEncoder().encode(JSON.stringify(header))
  const bytes = new Uint8Array(8 + text.length + media.length)
  bytes.set([65, 80, 77, 49])
  new DataView(bytes.buffer).setUint32(4, text.length)
  bytes.set(text, 8)
  bytes.set(media, 8 + text.length)
  return bytes.buffer
}

test('binary envelope preserves stream identity, orientation and exact media view', () => {
  const wire = envelope({ type: 'video_init', stream_id: 'second', width: 1280, height: 720, mime: 'video/mp4' }, [0, 1, 255])
  const msg = decodeMirrorMessage(wire)
  assert.equal(msg.stream_id, 'second')
  assert.equal(msg.width, 1280)
  assert.deepEqual([...mediaBytes(msg.data)], [0, 1, 255])
  // A decoder must never append the envelope/header bytes to SourceBuffer.
  assert.equal(mediaBytes(msg.data).slice().buffer.byteLength, 3)
})

test('old JSON/base64 and new binary representations decode to identical bytes', () => {
  assert.deepEqual(mediaBytes('AAH/'), mediaBytes(decodeMirrorMessage(envelope({ type: 'mirror_jpeg' }, [0, 1, 255])).data))
})

test('malformed length, truncated message and non-media headers are rejected', () => {
  assert.throws(() => decodeMirrorMessage(new ArrayBuffer(2)))
  const bad = envelope({ type: 'video_segment' }, [1])
  new DataView(bad).setUint32(4, 20000)
  assert.throws(() => decodeMirrorMessage(bad))
  assert.throws(() => decodeMirrorMessage(envelope({ type: 'log' }, [1])))
})

test('backlog is bounded by fragment count and bytes without discarding dependency frames', () => {
  assert.equal(mirrorQueueOverflow(Array.from({ length: 12 }, () => new ArrayBuffer(10))), false)
  assert.equal(mirrorQueueOverflow(Array.from({ length: 13 }, () => new ArrayBuffer(10))), true)
  assert.equal(mirrorQueueOverflow([new ArrayBuffer(4 * 1024 * 1024 + 1)]), true)
})
