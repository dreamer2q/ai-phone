import test from 'node:test'
import assert from 'node:assert/strict'
import { effectScope, nextTick, markRaw } from 'vue'
import { useMseMirror } from '../src/lib/useMseMirror.js'

test('a stalled SourceBuffer triggers one resync, bounded memory and requires a new init', async () => {
  const originalSource = globalThis.MediaSource
  const originalWindow = globalThis.window
  const originalCreate = URL.createObjectURL
  const originalRevoke = URL.revokeObjectURL
  let source, appended = [], resyncs = 0
  class Buffer extends EventTarget {
    updating = false
    buffered = { length: 0 }
    appendBuffer(bytes) { this.updating = true; appended.push(new Uint8Array(bytes)) }
  }
  class Source extends EventTarget {
    readyState = 'open'
    static isTypeSupported() { return true }
    constructor() { super(); source = this }
    addSourceBuffer() { return new Buffer() }
    removeSourceBuffer() {}
    endOfStream() {}
  }
  class Video extends EventTarget {
    src = ''
    currentTime = 0
    removeAttribute() { this.src = '' }
    load() {}
  }
  globalThis.MediaSource = Source
  globalThis.window = { MediaSource: Source }
  URL.createObjectURL = () => 'blob:test'
  URL.revokeObjectURL = () => {}
  const scope = effectScope()
  let mirror
  try {
    mirror = scope.run(() => useMseMirror({ onResync: () => { resyncs++ } }))
    mirror.videoEl.value = markRaw(new Video())
    await nextTick()
    mirror.handleInit({ data: new Uint8Array([9, 8]), width: 720, height: 1280 })
    source.dispatchEvent(new Event('sourceopen'))
    assert.deepEqual([...appended[0]], [9, 8])
    for (let i = 0; i < 100; i++) mirror.handleSegment({ data: new Uint8Array([1, 2]) })
    assert.equal(resyncs, 1)
    assert.equal(mirror.queueDepth.value, 0)
    assert.equal(mirror.ready.value, false)
    assert.equal(appended.length, 1)
    mirror.handleInit({ data: new Uint8Array([7, 6]), width: 1280, height: 720 })
    source.dispatchEvent(new Event('sourceopen'))
    assert.deepEqual([...appended[1]], [7, 6])
  } finally {
    mirror?.reset()
    scope.stop()
    globalThis.MediaSource = originalSource
    globalThis.window = originalWindow
    URL.createObjectURL = originalCreate
    URL.revokeObjectURL = originalRevoke
  }
})
