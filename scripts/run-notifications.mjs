import { dispatchPendingNotifications } from '../lib/notification-dispatch.js';

const result = await dispatchPendingNotifications();
console.log(JSON.stringify(result, null, 2));
