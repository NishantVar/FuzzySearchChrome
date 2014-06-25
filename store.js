var historyPriority = 3, bookmarkPriority = 2, domainPriority = 1, tabPriority = 0;
var randomPriority = 0;//to randomly priporitize the urls with same parameters(except url and title)
var historySize = 10000;

var omniStore;

Suggestion = (function (priority, url, title, lastVisitTime, visitCount, id) {

	Suggestion = function (priority, url, title, lastVisitTime, visitCount, id) {
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
		this.id = id;
	}

	Suggestion.prototype.generateHtml = function() {
		var type = "Tab";
		if( this.priority == bookmarkPriority ) {
			type = "Bookmark";
		} else if( this.priority == domainPriority ) {
			type = "Domain";
		} else if( this.priority == historyPriority ) {
			type = "History";
		}
		var relevancyHtml = "";
		return this.html = "<div class=\"reset omnibarTopHalf\">\n   <span class=\"reset omnibarSource\">" + type + "</span>\n   <span class=\"reset omnibarTitle\">" + (highlightText(this.escapeHtml(this.title))) + "</span>\n </div>\n <div class=\"reset omnibarBottomHalf\">\n  <span class=\"reset omnibarUrl\">" + (highlightText(this.url)) + "</span>\n  " + relevancyHtml + "\n</div>";
	};

	Suggestion.prototype.escapeHtml = function(url) {
		return url.replace(/</g, "&lt;").replace(/>/g, "&gt;");
	};

	Suggestion.prototype.highlightTerms = function(url) {
		return url;
	};

	return Suggestion;
})();

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
			if( !isEmpty(bk.url) ) {
				bookmarks.push(Object({url: createFullUrl(bk.url), title:bk.title, visitCount: 0, lastVisitTime: -1, type: "bookmark"}));
			}
			if( bk.children != null ) {
				toVisit.push.apply(toVisit, bk.children.reverse());
			}
		};
		itemsFetched++;
		console.log("Bookmarks Fetched");
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
			if( isEmpty(chromeHistory[i].url) ) {
				continue;
			}
			historyStore.push( Object( {url: createFullUrl(chromeHistory[i].url), title: chromeHistory[i].title, visitCount: chromeHistory[i].visitCount, lastVisitTime: chromeHistory[i].lastVisitTime, type: "history"} ) );
		}
		itemsFetched++;
		console.log("History Fetched");
	})
};

function addDomains (store) {
	var domains = {};
	for(var i = 0 ; i < store.length ; i++) {
		var domUrl = parseDomain(store[i].url);
		if( domUrl == "" ) {
			continue;
		}
		var current = domains[domUrl];
		if( typeof current == "undefined" ) {
			domains[domUrl] = {};
			current = domains[domUrl];
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

	for(var domUrl in domains) {
		store.push(domains[domUrl]);
	}
}

function createOmniStore (store) {
	qsort(store, 0, store.length - 1, "url");
	omniStore = [];
	if( !store.length ) {
		return;
	}
	omniStore.push(store[0]);
	for(var i = 1 ; i < store.length ; i++) {
		var last = omniStore[omniStore.length - 1];
		if( last.url != store[i].url ) {
			store[i].bookmarkReferences = 0;
			store[i].historyReferences = 0;
			omniStore.push(store[i]);
			last = store[i];
		} else if( last.type != "domain" ) {
			last.visitCount += store[i].visitCount;
			last.lastVisitTime = Math.max(store[i].lastVisitTime, last.lastVisitTime);
		} else if( last.title == "" ) {
			last.title = store[i].title;
		}
		if( store[i].type == "history" ) {
			last.historyReferences++;
		} else {
			last.bookmarkReferences++;
		}
	}
}

function addToOmniStore (entry) {
	var idx = binSmaller(entry.url, omniStore, "url");
	if( idx < 0 || entry.url != omniStore[idx].url ) {
		omniStore.splice(idx + 1, 0, entry);
	} else {
		var cur = omniStore[idx];
		cur.visitCount += entry.visitCount;
		cur.lastVisitTime = Math.max(cur.lastVisitTime, entry.lastVisitTime);
		cur.bookmarkReferences += entry.bookmarkReferences;
		cur.historyReferences += entry.historyReferences;
		if( cur.title == "" ) {
			cur.title = entry.title;
		}
	}
}

function addToBookmarks (entry) {
	var idx = binSmaller(entry.url, bookmarks, "url");
	bookmarks.splice(idx + 1, 0, entry);
}

chrome.bookmarks.onCreated.addListener(function (id, bk) {
	bk.url = createFullUrl(bk.url);
	if( bk.url != "" ) {
		var urlObj = {url: parseDomain(bk.url), title: "", visitCount: 0, lastVisitTime: -1, type: "domain", bookmarkReferences: 1, historyReferences: 0};
		if( urlObj.url == bk.url ) {
			urlObj.title = bk.title;
			addToOmniStore(urlObj);
		} else {
			addToOmniStore(urlObj);
			urlObj.url = bk.url;
			urlObj.title = bk.title;
			urlObj.type = "bookmark";
			addToOmniStore(urlObj);
		}
	}
	urlObj.type = "bookmark";
	addToBookmarks(urlObj);
});

chrome.history.onVisited.addListener(function (visit) {
	visit.url = createFullUrl(visit.url);
	var urlObj = {url: parseDomain(visit.url), title: "", lastVisitTime: visit.lastVisitTime, visitCount: 1, type: "domain", bookmarkReferences: 0, historyReferences: 1};
	if( urlObj.url == visit.url ) {
		urlObj.title = visit.title;
		addToOmniStore(urlObj);
	} else {
		addToOmniStore(urlObj);
		urlObj.url = visit.url;
		urlObj.title = visit.title;
		urlObj.type = "history";
		addToOmniStore(urlObj);
	}
});

function removeFromOmniStore (entry) {
	var idx = binSmaller(entry.url, omniStore, "url");
	if( idx >= 0 && omniStore[idx] == entry.url ) {
		var cur = omniStore[idx];
		cur.historyReferences -= entry.historyReferences;
		cur.bookmarkReferences -= entry.bookmarkReferences;
		cur.visitCount -= entry.visitCount;
		if( cur.historyReferences == 0 && cur.bookmarkReferences == 0 ) {
			omniStore.splice(idx, 1);
		} else if( cur.type != "domain" ) {
			if( cur.historyReferences == 0 ) {
				cur.type = "bookmark";
			} else {
				cur.type = "history";
			}
		}
	}
}

chrome.history.onVisitRemoved.addListener(function (removed) {
	if( removed.allHistory == true ) {
		chrome.runtime.reload();
		return;
	} else if( typeof removed.urls != "undefined" && removed.urls != null ) {
		for(var i = 0 ; i < removed.urls.length ; i++) {
			var url = removed.urls[i];
			removeFromOmniStore( {url: url, historyReferences: -1, visitCount: -1} );
			var domUrl = parseDomain(url);
			if( domUrl != url ) {
				removeFromOmniStore({url: domUrl, historyReferences: -1, visitCount: -1});
			}
		}
	}
});

chrome.bookmarks.onRemoved.addListener(function (id, removeInfo) {
	chrome.runtime.reload();
});
