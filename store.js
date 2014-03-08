var historyPriority = 2, bookmarkPriority = 1, domainPriority = 0;
var randomPriority = 0;//to randomly priporitize the urls with same parameters(except url and title)
var historySize = 100000;

var urlStore;

Suggestion = function (priority, url, title, lastVisitTime, visitCount) {
	this.priority = priority;
	this.url = url;
	this.title = title;
	if( this.title == null ) {
		this.title = "";
	}
	this.urlLastMatched = -1;
	this.titleLastMatched = -1;
	this.urlDp = new Array();
	this.titleDp = new Array();
	this.urlDp[0] = new Array();
	this.urlDp[1] = new Array();
	this.titleDp[0] = new Array();
	this.titleDp[1] = new Array();
	for(var i = this.url.length ; i >= 0 ; --i) {
		this.urlDp[0][i] = 0;
	}
	for(var i = this.title.length ; i >= 0 ; --i) {
		this.titleDp[0][i] = 0;
	}
	this.penalty = 0;
	this.urlPenalty = 0;
	this.titlePenalty = 0;
	this.lastVisitTime = lastVisitTime;
	this.visitCount = visitCount;
	this.randomPriority = randomPriority++;
};

function loadBookmarks () {
	if( bookmarks ) {
		return;
	}
	bookmarks = [];
	chrome.bookmarks.getTree( function (root) {
		var toVisit = root.reverse();
		var bk;
		while(toVisit.length > 0) {
			bk = toVisit.pop();
			if( typeof bk.url != 'undefined' && bk.url != null ) {
				bookmarks.push(Object({url: createFullUrl(bk.url), title:bk.title, visitCount: 0, lastVisitTime: -1, type: "bookmark"}));
			}
			if( bk.children != null ) {
				toVisit.push.apply(toVisit, bk.children.reverse());
			}
		};
		itemsFetched++;
		// console.log(bookmarks.length);
		// console.log("Bookmarks Fetched");
	})
}	

function loadHistory () {
	if( historyStore ) {
		return;
	}
	historyStore = [];
	chrome.history.search({
		text: "",
		startTime: 0,
		maxResults: historySize
	}, function (chromeHistory) {
		for(var i = 0 ; i < chromeHistory.length ; i++) {
			if( chromeHistory[i].url == null || typeof chromeHistory[i].url == 'undefined' ) {
				continue;
			}
			historyStore.push( Object( {url: createFullUrl(chromeHistory[i].url), title: chromeHistory[i].title, visitCount: chromeHistory[i].visitCount, lastVisitTime: chromeHistory[i].lastVisitTime, type: "history"} ) );
		}
		itemsFetched++;
		// console.log(historyStore.length);
		// console.log("History Fetched");
	})
};

function addDomains (store) {
	for(var i = 0 ; i < store.length ; i++) {
		var domUrl = parseDomain(store[i].url);
		if( domUrl == "" ) {
			continue;
		}
		var current = urlStore[domUrl];
		if( typeof current == 'undefined' ) {
			urlStore[domUrl] = {};
			current = urlStore[domUrl];
			current.url = domUrl;
			current.title = "";
			current.type = "domain";
			current.visitCount = store[i].visitCount;
			current.lastVisitTime = store[i].lastVisitTime;
			current.bookmarkReferences = 0;
			current.historyReferences = 0;
		} else {
			current.visitCount += store[i].visitCount;
			current.lastVisitTime = Math.max(current.lastVisitTime, store[i].lastVisitTime);
		}
		if( store[i].type == "bookmark" ) {
			current.bookmarkReferences++;
		} else {
			current.historyReferences++;
		}
	}
}

function addHistoryAndBookmarks (store) {
	for(var i = 0 ; i < store.length ; i++) {
		var current = urlStore[store[i].url];
		if( typeof current == 'undefined' ) {
			urlStore[store[i].url] = store[i];
			store[i].bookmarkReferences = 0;
			store[i].historyReferences = 0;
			current = store[i];
		} else if( current.type == "domain" ) {
			continue;
		} else {
			current.visitCount += store[i].visitCount;
			current.lastVisitTime = Math.max(store[i].lastVisitTime, current.lastVisitTime);
		}
		if( current.type == "bookmark" ) {
			current.bookmarkReferences++;
		} else {
			current.historyReferences++;
		}
	}
}

chrome.bookmarks.onCreated.addListener(function (id, bk) {
	if( bk.url != "" ) {
		var urlObj = {url: bk.url, title: bk.title, visitCount: 0, lastVisitTime: -1, type: "bookmark"};
		addHistoryAndBookmarks( [urlObj] );
		addDomains( [urlObj] );
	}
});

chrome.history.onVisited.addListener(function (visit) {
	var urlObj = {url: visit.url, title: visit.title, lastVisitTime: visit.lastVisitTime, visitCount: 1, type: "history"};
	addHistoryAndBookmarks( [urlObj] );
	addDomains( [urlObj] );
});

chrome.history.onVisitRemoved.addListener(function (removed) {
	if( removed.allHistory == true ) {
		chrome.runtime.reload();
		return;
	} else if( typeof removed.urls != 'undefined' && removed.urls != null ) {
		for(var i = 0 ; i < removed.urls.length ; i++) {
			var url = removed.urls[i];
			if( typeof urlStore[url] != 'undefined' ) {
				urlStore[url].historyReferences -= 1;
				urlStore[url].visitCount -= 1;
				if( urlStore[url].historyReferences == 0 && urlStore[url].bookmarkReferences == 0 ) {
					delete urlStore[url];
				} else if( urlStore[url].historyReferences == 0 && urlStore[url].type == "history" ) {
					urlStore[url].type = "bookmark";
				}
			}

			var domUrl = parseDomain(url);
			if( domUrl != "" && domUrl != url && typeof urlStore[domUrl] != 'undefined' ) {
				urlStore[domUrl].historyReferences -= 1;
				urlStore[domUrl].visitCount -= 1;
				if( urlStore[domUrl].historyReferences == 0 && urlStore[domUrl].bookmarkReferences == 0 ) {
					delete urlStore[domUrl];
				}
			}
		}
	}
});

chrome.bookmarks.onRemoved.addListener(function (id, removeInfo) {
	chrome.runtime.reload();
});

function parseDomain (url) {
	return createFullUrl(url.split("/")[2] || "");
}

function qsort (arr, start, end) {
	if( start >= end )
		return;
	idx = Math.floor(Math.random() * (end - start + 1)) + start;
	var temp = arr[idx];
	arr[idx] = arr[start];
	arr[start] = temp;
	var j = start;
	for(var i = start + 1 ; i <= end ; i++) {
		if( arr[i].url < arr[start].url ) {
			j += 1;
			temp = arr[i];
			arr[i] = arr[j];
			arr[j] = temp;
		}
	}
	temp = arr[j];
	arr[j] = arr[start];
	arr[start] = temp;
	qsort(arr, start, j - 1);
	qsort(arr, j + 1, end);
}

function createFullUrl (partialUrl) {
	var url;
	var last = url;
	if (!/^[a-z]{3,}:\/\//.test(partialUrl)) {
		url = "http://" + partialUrl;
	} else {
		url = partialUrl;
	}
	if( url[url.length - 1] == '/' ) {
		url = url.substring(0, url.length - 1);
	}
	return url;
}

var xml_special_to_escaped_one_map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '\"'
};

function encodeXmlChar (c) {
	if( c == '&' || c == '<' || c == '>' || c == '"' ) {
		return xml_special_to_escaped_one_map[c];
	}
	return c;
}

var escaped_one_to_xml_special_map = {
    '&': '&',
    '"': '"',
    '&lt;': '&lt;',
    '&gt;': '>'
};

function encodeXml(string) {
	var xmlText = "";
	for(var i = 0 ; i < string.length ; i++) {
		xmlText += encodeXmlChar(string[i]);
	}
	return xmlText;
};

function decodeXml(string) {
    return string.replace(/("|&lt;|&gt;|&)/g,
        function(str, item) {
            return escaped_one_to_xml_special_map[item];
    });
}

