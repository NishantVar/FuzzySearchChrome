var input = "", suggestFunction, lastSuggestFunction = null;

var itemsFetched = 0, itemsToFetch = 0;
var currentlySearching = false, initialized = false, suggestionsInitialized = false;

var bookmarks, historyStore;

function fetchData () {
	itemsToFetch = 2;
	randomPriority = 0;

	loadBookmarks();
	loadHistory();

	currentSearchSpace = [];
	defaultSearchSpace = [];
	arrangeData();
}

function arrangeData () {
	if( itemsFetched != itemsToFetch ) {
		setTimeout(arrangeData, 100);
		return;
	}

	var store = bookmarks.concat(historyStore);

	urlStore = {};
	addDomains(store);
	addHistoryAndBookmarks(store);
	bookmarks = null;
	history = null;

	initialized = true;
}



function addItemsToSuggestions () {
	if( !initialized ) {
		setTimeout(addItemsToSuggestions, 100);
		return;
	}
	for(var url in urlStore) {
		var current = urlStore[url];
		var priority = domainPriority;
		if( current.type == "history" ) {
			priority = historyPriority;
		} else if( current.type == "bookmark" ) {
			priority = bookmarkPriority;
		} else {
			priority = domainPriority;
		}
		defaultSearchSpace.push(
			new Suggestion(priority, current.url, current.title, current.lastVisitTime, current.visitCount)
		);
	}

	for(var i = 0 ; i < defaultSearchSpace.length ; i++) {
		currentSearchSpace.push(defaultSearchSpace[i]);
	}
	console.log("searchSpace length " + defaultSearchSpace.length);
	suggestionsInitialized = true;
}

function setSearchText (text, suggest) {
	console.log("start search  " + text);
	input = text;
	suggestFunction = suggest;
	showSuggestions = true;

	if( !currentlySearching ) {
		currentlySearching = true;
		suggestionsInitialized = false;
		addItemsToSuggestions();
		setTimeout(performSearch, 1);
	}
}

chrome.omnibox.onInputChanged.addListener(setSearchText);

chrome.omnibox.onInputEntered.addListener(
	function(text) {
		if( text == searchText && currentSearchSpace.length > 0 ) {
			chrome.tabs.update( {url: createFullUrl(currentSearchSpace[0].url)} );
			return;
		}
		chrome.tabs.update( {url: createFullUrl(text)} );
	}
);

fetchData();

chrome.omnibox.onInputCancelled.addListener(function () {
	// currentlySearching = false;
	// defaultSearchSpace = [];
	// currentSearchSpace = [];
	// lastSearchText = "";
	console.log("cancelled");
});
