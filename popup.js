
function init() {
	chrome.tabs.create({url: "help.html", active: true});
}
document.addEventListener('DOMContentLoaded', init);