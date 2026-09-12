/* global Terminal, FitAddon */
(async function () {
  const termHost = document.getElementById("term");
  const term = new window.Terminal({
    cursorBlink: true,
    fontFamily: "Consolas, 'Courier New', monospace",
    theme: {
      background: "#0f1419",
      foreground: "#e7ecf1",
    },
  });
  const fit = new window.FitAddon.FitAddon();
  term.loadAddon(fit);
  term.open(termHost);
  fit.fit();

  window.spikeTerminal.onData((data) => term.write(data));
  window.spikeTerminal.onExit((msg) => term.write(`\r\n${msg}`));

  term.onData((data) => window.spikeTerminal.write(data));
  window.addEventListener("resize", () => {
    fit.fit();
    window.spikeTerminal.resize(term.cols, term.rows);
  });

  document.getElementById("start").addEventListener("click", async () => {
    const result = await window.spikeTerminal.start();
    term.writeln(`\r\n[spike] started pid=${result.pid}`);
    window.spikeTerminal.resize(term.cols, term.rows);
  });

  document.getElementById("stop").addEventListener("click", async () => {
    await window.spikeTerminal.stop();
    term.writeln("\r\n[spike] stopped");
  });
})();
