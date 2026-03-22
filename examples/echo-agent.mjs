import { readFileSync } from "node:fs";

const input = readFileSync(0, "utf8");
const event = JSON.parse(input);

process.stdout.write(
  JSON.stringify({
    text: `echo: ${event.text ?? ""}`,
  }),
);

