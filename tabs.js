var tabs = [];

function loadTabs () {
	chrome.tabs.query({}, function (tabsOpen) {
		for(var i = 0 ; i < tabsOpen.length ; i++) {
			if( tabsOpen[i].url != "" ) {
				tabs.push({
					id: tabsOpen[i].id,
					url: tabsOpen[i].url,
					title: tabsOpen[i].title ? tabsOpen[i].title : "",
					visitCount: 0,
					lastVisitTime: -1,
					type: "tab"
				});
			}
		}
	});
	itemsFetched++;
}

chrome.tabs.onCreated.addListener(function (tab) {
	if( !initialized ) {
		chrome.runtime.reload();
		return;
	}
	var idx = binSmaller(tab.id, tabs, "id");
	tabs.splice(idx + 1, 0, {
		id: tab.id, url: (isEmpty(tab.url) ? "" : tab.url), title: (isEmpty(tab.title) ? "" : tab.title), visitCount: 0, lastVisitTime: -1
	});
});

chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
	if( tab.status === "loading" ) {
		return;
	}
	if( !initialized ) {
		chrome.runtime.reload();
		console.log("update reload");
		return;
	}
	if( !isEmpty(tab.url ) ) {
		var idx = binSearch(tabId, tabs, "id");
		if( idx >= 0 ) {
			tabs[idx].url = tab.url;
			tabs[idx].title = (isEmpty(tab.title) ? "" : tab.title);
		} else {
			console.log("Error: updated tab not present");
			console.log(tabs, changeInfo, tab);
		}
	}
});

chrome.tabs.onRemoved.addListener(function (tabId, removeInfo) {
	if( !initialized ) {
		chrome.runtime.reload();
		return;
	}
	var idx = binSearch(tabId, tabs, "id");
	if( idx >= 0  ) {
		tabs.splice(idx, 1);
		if( currentSearchingIn == "tabs" ) {
			for(var i = 0 ; i < defaultSearchSpace.length ; i++) {
				if( defaultSearchSpace[i].id == tabId ) {
					defaultSearchSpace.splice(i, 1);
					break;
				}
			}
			for(var i = 0 ; i < currentSearchSpace.length ; i++) {
				if( currentSearchSpace[i].id == tabId ) {
					currentSearchSpace.splice(i, 1);
					break;
				}
			}
			suggest(lastRequestTabId);
		}
	} else {
		console.log("Error: Removed Tab Not Present");
		console.log(tabs, tabId, removeInfo);
	}
});

chrome.tabs.onActivated.addListener(function (activeInfo) {
	if( !initialized ) {
		return;
	}
	var idx = binSearch(activeInfo.tabId, tabs, "id");
	if( idx >= 0 ) {
		tabs[idx].visitCount++;
		tabs[idx].lastVisitTime = new Date().getTime();
	}
});