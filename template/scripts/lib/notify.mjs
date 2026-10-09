// Best-effort human notification. Never throws: a missing notifier must not break a tour.
// macOS: Notification Center. Anywhere: $LOOP_NOTIFY_CMD receives the message as its last argument
// (e.g. a script that posts to Telegram/Slack). Always also logged to .loop/logs/notify.log.

import { execFileSync } from 'node:child_process';
import { appendLog } from './loop-files.mjs';

export function notify(root, title, message) {
  appendLog(root, 'notify.log', `${title}: ${message}`);
  try {
    if (process.env.LOOP_NOTIFY_CMD) {
      execFileSync(process.env.LOOP_NOTIFY_CMD, [`${title}: ${message}`], { stdio: 'ignore', timeout: 15000 });
    } else if (process.platform === 'darwin') {
      const esc = (s) => s.replace(/"/g, '\\"');
      execFileSync('osascript', ['-e', `display notification "${esc(message)}" with title "${esc(title)}"`], {
        stdio: 'ignore',
        timeout: 5000,
      });
    }
  } catch {
    // logged above; nothing else to do
  }
}
