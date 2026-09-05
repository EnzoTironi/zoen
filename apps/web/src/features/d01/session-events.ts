const channelName = "zoen-d01-session-change";
let channel: BroadcastChannel | null = null;
let watchers = 0;

const sessionChannel = () => {
  channel ??= new BroadcastChannel(channelName);
  return channel;
};

/** A notification to discard local views; carries no identity or credential. */
export const announceSessionChange = () => {
  // oxlint-disable-next-line unicorn/require-post-message-target-origin -- BroadcastChannel is origin-scoped and does not accept the Window targetOrigin argument.
  sessionChannel().postMessage("changed");
};

export const watchSessionChanges = (discard: () => void) => {
  const current = sessionChannel();
  watchers += 1;
  current.addEventListener("message", discard);
  return () => {
    current.removeEventListener("message", discard);
    watchers -= 1;
    if (watchers === 0) {
      current.close();
      channel = null;
    }
  };
};
