const year = new Date().getFullYear();
const footer = document.querySelector("footer p");
if (footer) {
  footer.textContent = `© ${String(year)} Blockforge. Not affiliated with Roblox Corporation.`;
}
