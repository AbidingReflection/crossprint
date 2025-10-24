// Checkpointing for "original vs working" image IDs.
// NOTE: Operations likely mutate the image in place on backend.
// If your backend is destructive, treat checkpointId === workingId.
let checkpointId = null;  // latest post-geometry base (after open/homography/crop)
let workingId = null;     // current image being previewed/edited

export function setCheckpoint(id) { checkpointId = id; workingId = id; }
export function setWorking(id)    { workingId = id; }
export function getCheckpoint()   { return checkpointId; }
export function getWorking()      { return workingId; }

// Optional toggle: try applying threshold from checkpoint each time.
// If backend mutates the ID destructively (most do), this is identical to working.
export const APPLY_THRESHOLD_FROM_CHECKPOINT = true;
