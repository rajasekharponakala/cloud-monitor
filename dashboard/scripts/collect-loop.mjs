// Collection loop for docker/compose cron sidecar.
// Hits the dashboard's own /api/collect every INTERVAL_MIN minutes.
const base = process.env.APP_BASE || "http://dashboard:3000";
const secret = process.env.CRON_SECRET || "";
const interval = (parseInt(process.env.INTERVAL_MIN || "30", 10) || 30) * 60 * 1000;

async function tick() {
  try {
    const res = await fetch(`${base}/api/collect`, {
      method: "POST",
      headers: secret ? { authorization: `Bearer ${secret}` } : {},
    });
    console.log(new Date().toISOString(), "collect", res.status, await res.text());
  } catch (e) {
    console.error(new Date().toISOString(), "collect failed", String(e).slice(0, 200));
  }
}

tick();
setInterval(tick, interval);
