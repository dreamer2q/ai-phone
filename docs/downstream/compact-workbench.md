# Compact workbench and bounded mirror playback

This is a downstream iteration of ai-phone, maintained in the fork. It is not
an official upstream release. Existing attribution, LICENSE and third-party
notices remain unchanged.

## Requested scope

The operator requested a compact console and improvements to remote-control
lag/stuttering, while keeping device registration, readiness and session leases.
This iteration implements a compact device table/workbench and a negotiated
browser media transport with bounded playback buffering. It does not replace
device scheduling, the AI execution loop, or the Agent-to-Server protocol.

| Requirement | Acceptance | Status |
|---|---|---|
| F1 Compact device overview | Searchable table; status/model/node/actions visible; node details collapsed | Published to review instance; browser review pending |
| F2 Compact control workspace | Reduced header/toolbars; optional execution context collapsed; resizable picture/task/log areas remain usable | Published to review instance; browser review pending |
| F3 Less browser media overhead | Binary media for new clients, old JSON clients still work | Automated tests and matching live emulator fragments passed |
| F4 Bounded playback | Stalled buffer triggers a fresh decoder/stream instead of arbitrary P-frame drops | Stalled-SourceBuffer recovery test passed |
| F5 Honest diagnostics | Show rendered FPS and player buffered milliseconds, not mislabeled end-to-end latency | Implemented; device/browser measurement pending |
| F6 Preserve deployed fixes | Persistent Agent ID and Android foreground reading retained | Included with regression coverage |

## Media wire

The browser opts in using `/ws/browser/<serial>?mirror=binary-v1`. No opt-in means
the existing JSON wire. New browsers also accept the old JSON form, allowing a
rolling deployment with older Servers and Agents.

Binary WebSocket media message:

```
4 bytes APM1 | 4 bytes header length (unsigned, big endian) |
UTF-8 JSON header (at most 16384 bytes) | raw encoded media bytes
```

The header is the original `video_init`, `video_segment`, or `mirror_jpeg` object
without `data`; it retains stream identity, dimensions, MIME and timestamps.
Control/log messages remain JSON. The Server decodes an Agent's Base64 once per
broadcast. The browser consumes a typed-array view and appends only the media,
never the envelope header. Authentication, subscription routing and leases do
not change. This reduces the uncompressed media-message body by about 25%
relative to Base64. WebSocket compression/TLS are not included in that figure;
it is not a measured bandwidth or interaction-latency reduction of 25%.

The Agent still sends its existing JSON media. Removing that Base64 leg is a
separate protocol change requiring coordinated Agent deployment. Android's
current `FMp4Streamer._spawn` uses libx264 re-encoding; the module's old opening
comment about `-c:v copy` was stale. This iteration does not enable unvalidated
copy/remux or hardware encoder settings just to avoid the known timestamp
failure that the existing encoder works around.

## Playback and recovery

The default workbench live-edge catch-up threshold changes from 400ms to 180ms.
This is a playback policy, not an end-to-end latency guarantee. The pending
append queue is limited to 12 items or 4MiB. On overflow the decoder is discarded
and the WebSocket reconnects for a fresh init/keyframe. Arbitrary dependent
H.264 fragments are not dropped within the old decoder. Reconnecting the media
subscription does not release or steal the HTTP device lease.

Old played fragments are trimmed periodically so long sessions do not retain
the whole video. QuotaExceeded recovery trims safely behind current playback
or requests a fresh stream. The toolbar reports actual video-frame callbacks
per sampling interval and the buffered live-edge distance. Neither measures
click-to-photon delay; JPEG streams do not show H.264-only metrics.

## Verification and rollout

Run `node --test tests/*.test.mjs` and `npm run build` in `web`, and
`python -m pytest -q` in `backend`. The new tests cover binary/JSON compatibility,
header validation, exact payload bounds, mixed subscribers, cleanup, and an
intentionally stalled SourceBuffer with a new init after recovery.

On a staging instance, compare equal media sessions using binary and legacy
subscribers, check device locks and registration after restart, then verify the
table, search, resizing and uninterrupted playback in a browser. Exercise
portrait/landscape and a narrow viewport. Never claim a build or HTTP 200 is
visual or end-to-end interaction acceptance. The initial rollout is the user's
existing local test instance; preserve the previous web tree and changed
backend files for rollback, and avoid restarting device Agents/VMs.

Further work requiring real measurements: device-side hardware/copy video path,
input acknowledgement and click-to-visible latency, a direct per-node media
path for multi-region use, and removal of Agent-side Base64. None is claimed
implemented by this iteration.

## Initial verification record

The web build and all 119 Node tests passed. An isolated backend full-suite run
reported 3279 passed, 44 skipped, one expected failure and three failures caused
by missing test-environment dependencies (optional Harmony SDK and Vue packages).
After those dependencies were installed only in the isolated review tree, all
391 tests in the affected Harmony, web-lifecycle, media, Hub and prior-fix groups
passed. This is a targeted recheck of the resolved failures, not a claim that a
second complete full-suite run was performed. Production dependencies were not
changed by test setup.

On the existing local review instance, a legacy JSON subscriber and a negotiated
binary subscriber received 38 corresponding live Android-emulator fragments.
Their media hashes matched exactly. The uncompressed message-body totals were
206105 and 155720 bytes, a 24.45% reduction for that sample. A manual Home input
was dispatched while holding a temporary lease, then the lease was released.
This verifies live relay compatibility, not browser decoding, rendered FPS or
click-to-photon latency. Server health, web assets and authenticated device list
returned 200; anonymous access remained 401. Device Agents/VMs were not restarted.

Visual review, actual dragging, orientation and narrow-viewport interaction are
still pending: the browser automation tool stopped UI control because it could
not establish the current browser URL reliably. A successful build/HTTP check
does not close those acceptance items. No end-to-end latency reduction is claimed.
