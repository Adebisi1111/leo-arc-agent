import { chromium } from "playwright";
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
  await p.setContent(`<!doctype html><html><body style="margin:0">
  <div style="width:1200px;height:630px;background:#1c130c;border:4px solid #e8c98a;box-sizing:border-box;padding:60px;font-family:Georgia,serif">
    <div style="color:#e8c98a;font-size:78px;font-weight:bold">CONCORD</div>
    <div style="color:#c9a86a;font-size:32px;margin-top:10px">Autonomous USDC Subscription Agent</div>
    <div style="color:#e8c98a;font-size:28px;margin-top:18px">Built on Circle Arc Testnet</div>
    <div style="color:#9a8454;font-size:24px;margin-top:40px">Programmable Money · Autonomous Payments · Real on-chain settlement</div>
    <div style="color:#e8c98a;font-size:22px;font-weight:bold;margin-top:70px">arc-autopay.vercel.app</div>
  </div></body></html>`);
  await p.waitForTimeout(400);
  await p.screenshot({ path: "/home/administrator/arc-autopay/public/concord-project-image.png" });
  await b.close();
  console.log("saved");
})();
