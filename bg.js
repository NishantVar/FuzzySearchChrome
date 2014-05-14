var itemsFetched = 0, itemsToFetch = 0;
var initialized = false;
var currentlySearching = false;

var bookmarks, historyStore;


var currentSearchingIn = "none";

var handlerStack = [], runHandlerFunction = false;

var lastRequestTabId = -1;

var ports = {};

function fetchData () {
	itemsToFetch = 3;//history, bookmarks and tabs
	randomPriority = 0;

	loadBookmarks();
	loadHistory();
	loadTabs();

	arrangeData();
}

function arrangeData () {
	if( itemsFetched != itemsToFetch ) {
		setTimeout(arrangeData, 100);
		return;
	}

	var store = historyStore.concat(bookmarks);

	addDomains(store);
	createOmniStore(store);
	qsort(bookmarks, 0, bookmarks.length - 1, "url");
	qsort(tabs, 0, tabs.length - 1, "id");
	historyStore = null;

	initialized = true;
}

function addItemsToSuggestions (searchIn) {
	if( !initialized ) {
		setTimeout(addItemsToSuggestions, 100);
		return;
	}
	console.log("adding Items " + searchIn);
	var urlStore;
	if( searchIn == "all" ) {
		urlStore = omniStore;
	} else if( searchIn == "bookmarks" ) {
		urlStore = bookmarks;
	} else {
		urlStore = tabs;
	}

	defaultSearchSpace = [];
	currentSearchSpace = [];

	for(var i = 0 ; i < urlStore.length ; i++) {
		var current = urlStore[i];
		var priority = tabPriority;
		if( current.type == "history" ) {
			priority = historyPriority;
		} else if( current.type == "bookmark" ) {
			priority = bookmarkPriority;
		} else if (current.type == "domain" ) {
			priority = domainPriority;
		}
		defaultSearchSpace.push(
			new Suggestion(priority, current.url, current.title, current.lastVisitTime, current.visitCount, current.id)
		);
	}

	for(var i = 0 ; i < defaultSearchSpace.length ; i++) {
		currentSearchSpace.push(defaultSearchSpace[i]);
	}
	console.log("searchSpace length " + defaultSearchSpace.length);
	lastSearchText = "";
	currentSearchingIn = searchIn;
	console.log("items Added " + searchIn);
	setTimeout(handlerFunction, 1);
}

fetchData();

chrome.commands.onCommand.addListener(function (command) {
	if( command == "nextResults" ) {
		if( !currentlySearching && lastRequestTabId >= 0 ) {
			suggestionsStart += maxResultsToShow;
			if( suggestionsStart >= currentSearchSpace.length ) {
				suggestionsStart = 0;
			}
			suggest(lastRequestTabId);
		}
		return;
	} else if( command == "previousResults" ) {
		if( !currentlySearching && lastRequestTabId >= 0 ) {
			suggestionsStart -= maxResultsToShow;
			if( suggestionsStart < 0 ) {
				suggestionsStart = currentSearchSpace.length - 1 - (currentSearchSpace.length - 1) % maxResultsToShow;
			}
			suggest(lastRequestTabId);
		}
	}
	chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
		if( tabs.length == 0 ) {
			return;
		}
		var tabId = String(tabs[0].id);
		
		if( isDefined(ports[tabId]) ) {
			ports[tabId].postMessage({
				command: command
			});
		} else {
			ports[tabId] = chrome.tabs.connect(tabs[0].id);
			ports[tabId].name = tabId;
			ports[tabId].onMessage.addListener(processMessage);
			ports[tabId].onDisconnect.addListener(function (port) {
				delete ports[port.name];
				if( Object.keys(ports).length == 0 ) {
					runHandlerFunction = false;
				}
			})
			ports[tabId].postMessage({
				tabId: tabId
			});
			ports[tabId].postMessage({
				command: command
			});
		}
	});
});

processMessage = function (request) {
	if( typeof request.input != "undefined" && request.input !== null ) {
		handlerStack.push({
			input: request.input,
			searchIn: request.searchIn,
			tabId: request.tabId
		});
		lastRequestTabId = request.tabId;
	}
	switch(request.type) {
		case "switchTabs":
			chrome.tabs.update(request.id, {active: true});
			chrome.tabs.get(request.id, function (tab) {
				chrome.windows.update(tab.windowId, {focused: true});
			});
			break;
		case "openUrl":
			if( request.openInNewTab ) {
				chrome.tabs.create({url: convertToUrl(request.url), active: request.focus});
			} else {
				chrome.tabs.update({url: convertToUrl(request.url)});
			}
			break;
		case "showOmnibar":
			if( !runHandlerFunction ) {
				runHandlerFunction = true;
				handlerFunction();
			}
			break;
		case "hideOmnibar":
			runHandlerFunction = false;
			currentSearchingIn = "none";
			break;
		case "closeTab":
			chrome.tabs.remove(request.id);
			break;
	}
};

//added the function to allow search to run independently of the input
//once started it keeps running until the bar is closed and runs the search when input is updated
handlerFunction = function () {
	if( !runHandlerFunction ) {
		return;
	}
	var len = handlerStack.length;
	if( len == 0 ) {
		setTimeout(handlerFunction, 50);
		return;
	}
	var request = handlerStack[len - 1];
	handlerStack = handlerStack.slice(len - 1);
	if( request.searchIn != currentSearchingIn ) {
		setTimeout(function () {
			addItemsToSuggestions(request.searchIn);
		}, 1);
		return;
	} else {
		currentlySearching = true;
		performSearch(request.input.toLowerCase(), request.tabId);
		currentlySearching = false;
	}
	handlerStack.splice(0, 1);
	handlerFunction();
}