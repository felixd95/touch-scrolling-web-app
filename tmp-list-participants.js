const fs = require("fs");
const outputs = JSON.parse(fs.readFileSync("src/amplify_outputs.json", "utf8"));
const query = `query ListParticipants { listParticipants { items { id email attempts } } }`;
fetch(outputs.data.url, {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-api-key": outputs.data.api_key },
  body: JSON.stringify({ query })
})
  .then((r) => r.json())
  .then((j) => console.log(JSON.stringify(j, null, 2)))
  .catch((e) => { console.error(e); process.exit(1); });
