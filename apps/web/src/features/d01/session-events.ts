const channelName = "zoen-d01-session-change";

/** A notification to discard local views; carries no identity or credential. */
export const announceSessionChange = () => {
  const channel = new BroadcastChannel(channelName);
  // oxlint-disable-next-line unicorn/require-post-message-target-origin -- BroadcastChannel is origin-scoped and does not accept the Window targetOrigin argument.
  channel.postMessage("changed");
  channel.close();
};

export const watchSessionChanges = (discard: () => void) => {
  const channel = new BroadcastChannel(channelName);
  channel.addEventListener("message", discard);
  return () => {
    channel.close();
  };
};
