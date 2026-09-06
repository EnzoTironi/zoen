# World erasure CLI (EX33)

Thin command assembly for `InspectWorldErasure` and `RequestWorldErasure`. Transport posts to `/api/erasure/execute`.

Retry: reuse the same `--operation-id` and confirmed payload on Unavailable. Stale requires a new `inspect-world-erasure` and a newly confirmed `--operation-id`. `--confirm-entire-world` is mandatory for request. Surfaces never claim Erased or offer restore-after-erasure.
