// 'provider/model-id' uses a bundled provider.
// It is also possible to import provider as a module from Vercel AI SDK.
// https://github.com/testomatio/explorbot/blob/main/docs/basics/providers.md

const config = {
  web: {
    // use application host without path prefix (e.g., http://localhost:3000)
    url: 'http://localhost:5000',
  },

  ai: {
    // fast model with tool calling capabilities
    model: 'anthropic/claude-haiku-4-5-20251001',
    // vision model for screenshot analysis
    visionModel: 'anthropic/claude-haiku-4-5-20251001',
    // agentic model for decision making
    agenticModel: 'anthropic/claude-haiku-4-5-20251001',
  },

  reporter: {
    // Save a local HTML report after each run.
    html: true,
    // Save a local markdown report after each run.
    markdown: true,
    // Group runs by title in Testomat.io / HTML reports. Defaults to today's date — customize or remove.
    runGroup: new Date().toISOString().slice(0, 10),
  },
};

module.exports = config;
