export function getOwnerScope(req) {
  const usernameRaw = String(req.header('x-qc-username') || '').trim();
  const username = usernameRaw.toLowerCase();
  const isGuest = String(req.header('x-qc-is-guest') || '').toLowerCase() === 'true';
  const guestId = String(req.header('x-qc-guest-id') || '').trim();

  const isAdmin = !isGuest && username === 'admin';

  let ownerKey = 'user:admin';
  if (isGuest) {
    ownerKey = `guest:${guestId || 'anonymous'}`;
  } else if (username) {
    ownerKey = `user:${username}`;
  }

  return { isAdmin, isGuest, username, guestId, ownerKey };
}

export function denyIfNotFoundOrForbidden(found, res, entity = 'Resource') {
  if (!found) {
    res.status(404).json({ error: `${entity} not found` });
    return true;
  }
  return false;
}
