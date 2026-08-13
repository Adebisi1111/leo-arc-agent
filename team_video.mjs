import { execSync } from "child_process";
import fs from "fs";

const slides = [
  { t: "CONCORD", s: "Team Intro — Arc Accelerator", c: "#e8c98a" },
  { t: "Adebisi Quadri Okiki", s: "Founder & Sole Builder", c: "#e8c98a" },
  { t: "Student", s: "University of Ilorin, Kwara State, Nigeria", c: "#c9a86a" },
  { t: "Web3 builder", s: "Arc architect · autonomous payment agents", c: "#c9a86a" },
  { t: "Concord", s: "Autonomous USDC subscription agent on Circle Arc", c: "#e8c98a" },
  { t: "Why the Accelerator", s: "Programmable money for emerging-market creators", c: "#e8c98a" },
  { t: "arc-autopay.vercel.app", s: "Live demo · real on-chain settlement", c: "#e8c98a" },
];

fs.mkdirSync("/tmp/team", { recursive: true });
for (let i = 0; i < slides.length; i++) {
  const { t, s, c } = slides[i];
  const py = `
from PIL import Image, ImageDraw, ImageFont
W,H=1280,720
img=Image.new("RGB",(W,H),(28,19,12))
d=ImageDraw.Draw(img)
d.rectangle([30,30,W-30,H-30],outline=(232,201,138),width=4)
fb=ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf",60)
fm=ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf",32)
d.text((70,270),"${t}",font=fb,fill="${c}")
d.text((70,360),"${s}",font=fm,fill=(201,168,106))
img.save("/tmp/team/s${i}.png")
`;
  fs.writeFileSync("/tmp/team/gen.py", py);
  execSync("python3 /tmp/team/gen.py");
}

const voice =
  "My name is Adebisi Quadri Okiki. I'm the founder and sole builder of Concord. " +
  "I'm a student at the University of Ilorin, in Kwara State, Nigeria, and a Web3 builder focused on Circle's Arc. " +
  "Concord is an autonomous USDC subscription agent. A user funds an Arc vault once, then a developer-controlled wallet settles recurring payments on schedule, with no manual approvals. " +
  "I'm joining the Arc Accelerator because programmable money is the missing layer for the subscription economy in emerging markets. " +
  "I want to take Concord from testnet prototype to a real rail for African creators paid in stablecoins.";
execSync(`python3 -c "import edge_tts,asyncio; asyncio.run(edge_tts.Communicate('${voice.replace(/'/g,"\\'")}','en-US-GuyNeural').save('/tmp/team/voice.mp3'))"`);

console.log("assets rebuilt");
