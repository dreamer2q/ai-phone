// Encoded H.264 fragments depend on earlier frames. Never drop arbitrary P-frame
// fragments to catch up: replace the decoder and request a fresh init/keyframe.
export function mirrorQueueOverflow(queue, { maxItems = 12, maxBytes = 4 * 1024 * 1024 } = {}) {
  let bytes = 0
  for (const item of queue) bytes += item?.byteLength || 0
  return queue.length > maxItems || bytes > maxBytes
}
