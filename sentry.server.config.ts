// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://b1d5f7ac5d4b9315e9c3c98fc2698a5c@o4511847463583744.ingest.de.sentry.io/4511847497400400",

  // The dashboard polls /api/outbreaks every 30s per open tab, so sampling every
  // transaction would exhaust the Sentry quota quickly. Full detail locally,
  // 10% in production.
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1,

  // Enable logs to be sent to Sentry
  enableLogs: true,

  dataCollection: {
    // To disable sending user data and HTTP bodies, uncomment the lines below. For more info visit:
    // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#dataCollection
    // userInfo: false,
    // httpBodies: [],
  },
});
