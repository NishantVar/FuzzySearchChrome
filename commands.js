var actions = {
		"up": "up",
		"shift+tab": "up",
		"ctrl+k": "up",
		"down": "down",
		"tab": "down",
		"ctrl+j": "down",
		"enter": "openInNewTab",
		"enter+shift": "openInCurrentTab",
		"alt+enter": "openInNewTabWithoutFocus",
		"esc": "hide",
		"delete": "delete_tab"
};

function isDefined (obj) {
	if( typeof obj != "undefined" && obj != null ) {
		return true;
	}
	return false;
}

chrome.runtime.onConnect.addListener(function (extPort) {
	port = extPort;
	extPort.onMessage.addListener(processMessage);
});

processMessage = function(request) {
	if( isDefined(request.suggestions) ) {
		omnibar.populateUiWithCompletions(request.suggestions);
	} else if ( isDefined(request.command) ) {
		if( request.command.indexOf("search") == 0 ) {
			var parts = request.command.split("_");
			if( parts[0] == "search" ) {
				if( omnibar == null ) {
					omnibar = new Omnibar();
				}
				if( omnibar.isOpen() && omnibar.searchSpace == parts[1] ) {
					omnibar.hide();
				} else {
					omnibar.show(parts[1]);
				}
			}
		} else if( request.command == "editUrl" ) {
			omnibar.editSelectedUrl();
		}
	} else if( isDefined(request.tabId) ) {
		tabId = request.tabId;
	}
};

getAction = function (event) {
	var parts = [];
	if( event.altKey ) {
		parts.push('alt');
	}
	if( event.ctrlKey ) {
		parts.push('ctrl');
	}
	if( event.shiftKey ) {
		parts.push('shift');
	}
	if( KeyUtils.platform == "Mac" && event.metaKey ) {
		parts.push('cmd');
	}
	parts.push(KeyUtils.getKeyChar(event));
	parts.sort();

	var command = parts.join('+');

	if( typeof actions[command] != "undefined" && actions[command] != null ) {
		return actions[command];
	}
	return "none";
}

document.onkeydown = function (event) {
	var command = getAction(event);
	if( command == "none" ) {
		return;
	}
	if( omnibar && omnibar.isOpen() ) {
		switch(command) {
			case "hide":
				omnibar.hide();
				break;
			case "down":
				omnibar.selection += 1;
				if( omnibar.selection == omnibar.completions.length ) {
					omnibar.selection = omnibar.initialSelectionValue;
				}
				omnibar.updateSelection();
				break;
			case "up":
				omnibar.selection -= 1;
				if( omnibar.selection < omnibar.initialSelectionValue ) {
					omnibar.selection = omnibar.completions.length - 1;
				}
				omnibar.updateSelection();
				break;
			case "openInCurrentTab":
				omnibar.openSelectedUrl(false, true);
				break;
			case "openInNewTab":
				omnibar.openSelectedUrl(true, true);
				break;
			case "openInNewTabWithoutFocus":
				omnibar.openSelectedUrl(true, false);
				break;
			case "delete_tab":
				omnibar.closeSelectedTab();
				break;
		}
		event.stopPropagation();
		event.preventDefault();
	}
}
