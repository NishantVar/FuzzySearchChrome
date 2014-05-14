
var searchText = "", lastSearchText = "";

var defaultSearchSpace = [], currentSearchSpace = [];

var stepPenalty = 5, skipPenalty = 1;

var unitErrorLength = 5;

var maxResultsToShow = 10, suggestionsStart = 0;

function performSearch (text, tabId) {
	searchText = text;

	if( defaultSearchSpace.length < 500 ) {
		unitErrorLength = 4;
	} else {
		unitErrorLength = 5;
	}

	var pattern = searchText;
	var match = 0;
	while(match < lastSearchText.length && match < searchText.length && lastSearchText[match] == searchText[match] ) {
		++match;
	}
	if( match == lastSearchText.length ) {
		forwardSearch(lastSearchText.length, pattern);
	} else if( match == searchText.length ) {
		backwardSearch(searchText.length - 1);
	} else {
		backwardSearch(match - 1);
		forwardSearch(match);
	}

	lastSearchText = searchText;
	sortSuggestions(currentSearchSpace, 0, currentSearchSpace.length - 1);
	suggestionsStart = 0;
	if( text == "" && currentSearchSpace.length > 1 && currentSearchSpace[0].priority == tabPriority ) {
		//for switching tabs bring the tab visited before the current one to the top
		var temp = currentSearchSpace[0];
		currentSearchSpace[0] = currentSearchSpace[1];
		currentSearchSpace[1] = temp;
	}
	suggest(tabId);
}

function suggest (tabId) {
	//if no results, let the last ones appear
	if( currentSearchSpace.length == 0 ) {
		return;
	}
	var completions = [];
	var len = Math.min(currentSearchSpace.length, maxResultsToShow + suggestionsStart);
	for(var i = suggestionsStart ; i < len ; i++) {
		currentSearchSpace[i].generateHtml();
		if( currentSearchingIn == "tabs" ) {
			completions.push( {
				html: currentSearchSpace[i].html, 
				id: currentSearchSpace[i].id
			});
		} else {
			completions.push( {
				html: currentSearchSpace[i].html,
				url: currentSearchSpace[i].url
			});
		}
	}
	if( !isDefined(ports[tabId]) ) {
		console.log("Port for the requesting tab is not defined");
		return;
	}
	ports[tabId].postMessage({
		suggestions: completions,
		searchedText: searchText
	});
}

//messy code, might redo later
function forwardSearch (startIdx) {
	var newSearchSpace = [];
	var temp;
	var threshold = Math.floor((searchText.length + unitErrorLength - 1) / unitErrorLength) * stepPenalty;
	var sug, m = searchText.length;
	for(var k = 0 ; k < currentSearchSpace.length ; k++) {
		sug = currentSearchSpace[k];
		sug.penalty = threshold + 1;
		if( sug.urlLastMatched == startIdx - 1 ) {
			temp = calcEditDistance(sug.url, searchText, sug.urlDp, startIdx, sug.urlPenalty);
			sug.urlPenalty = temp.penalty;
			sug.urlLastMatched = temp.lastMatched;
			if( temp.lastMatched == m - 1 )
				sug.penalty = temp.penalty;
		}
		if( sug.titleLastMatched == startIdx - 1 && sug.title != "" ) {
			temp = calcEditDistance(sug.title, searchText, sug.titleDp, startIdx, sug.titlePenalty);
			sug.titlePenalty = temp.penalty;
			sug.titleLastMatched = temp.lastMatched;
			if( temp.lastMatched == m - 1 && sug.penalty > temp.penalty ) {
				sug.penalty = temp.penalty;
			}
		}

		if( sug.penalty <= threshold ) {
			newSearchSpace.push(sug);
		}
	}
	currentSearchSpace = newSearchSpace;
}

//used when backspace is used
function backwardSearch (endIdx) {
	var lastMatched;
	var newSearchSpace = [];
	var threshold = Math.floor((endIdx + 1 + unitErrorLength - 1) / unitErrorLength) * stepPenalty;
	var sug;
	for(var k = 0 ; k < defaultSearchSpace.length ; k++) {
		sug = defaultSearchSpace[k];
		lastMatched = Math.max(sug.urlLastMatched, sug.titleLastMatched);
		if( lastMatched  < endIdx ) {
			continue;
		} else if( lastMatched == endIdx ) {
			if( sug.urlLastMatched == endIdx ) {
				sug.penalty = sug.urlPenalty;
			}
			if( sug.titleLastMatched == endIdx ) {
				sug.penalty = Math.min(sug.penalty, sug.titlePenalty);
			}
			newSearchSpace.push(sug);
		} else {
			sug.penalty = threshold + 1;
			if( sug.urlLastMatched > endIdx ) {
				sug.urlDp[0] = new Array();
				sug.urlDp[1] = new Array();
				for(var i = sug.url.length ; i >= 0 ; --i) {
					sug.urlDp[0][i] = 0;
				}
				temp = calcEditDistance(sug.url, searchText.substring(0, endIdx + 1), sug.urlDp, 0, 0);
				sug.urlPenalty = temp.penalty;
				sug.urlLastMatched = temp.lastMatched;
				sug.penalty = temp.penalty;
			}
			if( sug.titleLastMatched > endIdx ) {
				sug.titleDp[0] = new Array();
				sug.titleDp[1] = new Array();
				for(var i = sug.title.length ; i >= 0 ; --i) {
					sug.titleDp[0][i] = 0;
				}
				temp = calcEditDistance(sug.title, searchText.substring(0, endIdx + 1), sug.titleDp, 0, 0);
				sug.titlePenalty = temp.penalty;
				sug.titleLastMatched = temp.lastMatched;
				sug.penalty = Math.min(sug.penalty, temp.penalty);
			}

			newSearchSpace.push(sug);
		}
	}
	currentSearchSpace = newSearchSpace;
}

function calcEditDistance(text, pattern, dp, startIdx, currentPenalty) {
	var m = pattern.length, n = text.length, i, j, minPenalty, threshold, penalty = currentPenalty;
	for(var idx = startIdx + 1 ; idx <= m ; idx++) {
		threshold = Math.floor((idx + unitErrorLength - 1) / unitErrorLength) * stepPenalty;
		minPenalty = threshold + 1;
		j = (idx & 1);
		temp = dp[j];
		dp[j] = new Array();
		if( pattern[idx - 1] == ' ' ) {
			for(var i = 0 ; i <= n ; i++) {
				dp[j][i] = penalty;
			}
			minPenalty = penalty;
		} else {
			dp[j][0] = idx * stepPenalty;
			for(var i = 1 ; i <= n ; i++) {
				dp[j][i] = Math.min(dp[j][i - 1] + stepPenalty, dp[1 - j][i] + stepPenalty);
				if( pattern[idx - 1].toLowerCase() == text[i - 1].toLowerCase() ) {
					dp[j][i] = Math.min(dp[j][i], dp[1 - j][i - 1]);
				} else {
					dp[j][i] = Math.min(dp[j][i], dp[1 - j][i - 1] + stepPenalty);
				}
				if( i > 1 && idx > 1 && pattern[idx - 1].toLowerCase() == text[i - 2].toLowerCase() && pattern[idx - 2].toLowerCase() == text[i - 1].toLowerCase() && pattern[idx - 2] != ' ' ) {
					dp[j][i] = Math.min(dp[j][i], temp[i - 2] + stepPenalty);
				}
				minPenalty = Math.min(minPenalty, dp[j][i]);
			}
		}

		if( minPenalty > threshold ) {
			dp[j] = temp;
			return new Object({penalty: penalty, lastMatched: idx - 2});
		} else {
			penalty = minPenalty;
		}
	}
	return new Object({penalty: penalty, lastMatched: m - 1});
}

function highlightText (text) {
	pattern = searchText;
	var n = text.length, totalLen = pattern.length, query, m;
	var terms = pattern.split(' ');
	var highlight = [];
	for(var i = 0 ; i < n ; i++) {
		highlight[i] = false;
	}

	for(var t = 0 ; t < totalLen ; ) {
		query = "";
		while(t < totalLen && pattern[t] != ' ' ) {
			query += pattern[t];
			t++;
		}

		m = query.length;

		var dp = new Array();
		for(var j = 0 ; j <= m ; j++) {
			dp[j] = new Array();
			for(var i = 0 ; i <= n ; i++) {
				dp[j][i] = 0;
			}
		}

		for(var j = 0 ; j < m ; j++) {
			dp[j][n] = (m - j) * stepPenalty;
		}

		for(var j = m - 1 ; j >= 0 ; --j) {
			for(var i = n - 1 ; i >= 0 ; --i) {
				dp[j][i] = Math.min(dp[j + 1][i] + stepPenalty, dp[j][i + 1] + stepPenalty);
				dp[j][i] = Math.min(dp[j][i], dp[j + 1][i + 1] + (text[i].toLowerCase() == query[j].toLowerCase() ? 0 : stepPenalty));
				if( i < n - 1 && j < m - 1 && text[i].toLowerCase() == query[j + 1].toLowerCase() && text[i + 1].toLowerCase() == query[j].toLowerCase() ) {
					dp[j][i] = Math.min(dp[j][i], dp[j + 2][i + 2] + stepPenalty);
				}
			}
		}

		var start = 0, minEditDist = m * stepPenalty;
		for(var i = 0 ; i < n ; i++) {
			if( dp[0][i] < minEditDist ) {
				minEditDist = dp[0][i];
				start = i;
			}
		}

		var i = start;
		for(var j = 0 ; j < m && i < n ; ) {
			if( text[i].toLowerCase() == query[j].toLowerCase() && dp[j][i] == dp[j + 1][i + 1] ) {
				highlight[i] = true;
				i++;
				j++;
			} else if( j < m - 1 && i < n - 1 && dp[j][i] == dp[j + 2][i + 2] + stepPenalty && text[i].toLowerCase() == query[j + 1].toLowerCase() && text[i + 1].toLowerCase() == query[j].toLowerCase() ) {
				highlight[i] = true;
				highlight[i + 1] = true;
				i += 2;
				j += 2;
			} else if( dp[j][i] == dp[j][i + 1] + stepPenalty ) {
				i++;
			} else if( dp[j][i] == dp[j + 1][i + 1] + stepPenalty ) {
				i++;
				j++;
			} else {
				j++;
			}
		}
		t++;
	}

	var hText = "";
	for(var i = 0 ; i < n ; i++) {
		if( highlight[i] ) {
			hText += "<span class='omnibarMatch'>" + text[i] + "</span>";
		} else {
			hText += text[i];
		}
	}

	return hText;
}

function compareSuggestions (suggestion1, suggestion2) {
	if( suggestion1.penalty < suggestion2.penalty ) {
		return true;
	} else if( suggestion1.penalty > suggestion2.penalty ) {
		return false;
	}

	if( suggestion1.lastVisitTime > suggestion2.lastVisitTime ) {
		return true;
	} else if( suggestion1.lastVisitTime < suggestion2.lastVisitTime ) {
		return false;
	}

	if( suggestion1.visitCount > 2 * suggestion2.visitCount ) {
		return true;
	} else if( suggestion1.visitCount < 2 * suggestion2.visitCount ) {
		return false;
	}

	if( suggestion1.priority < suggestion2.priority ) {
		return true;
	} else if( suggestion1.priority > suggestion2.priority ) {
		return false;
	}

	return suggestion1.randomPriority < suggestion2.randomPriority;
}

function sortSuggestions (suggestions, start, end) {
	if( start >= end )
		return;
	idx = Math.floor(Math.random() * (end - start + 1)) + start;
	var temp = suggestions[idx];
	suggestions[idx] = suggestions[start];
	suggestions[start] = temp;
	var j = start;
	for(var i = start + 1 ; i <= end ; i++) {
		if( compareSuggestions(suggestions[i], suggestions[start]) ) {
			j += 1;
			temp = suggestions[i];
			suggestions[i] = suggestions[j];
			suggestions[j] = temp;
		}
	}
	temp = suggestions[j];
	suggestions[j] = suggestions[start];
	suggestions[start] = temp;
	sortSuggestions(suggestions, start, j - 1);
	sortSuggestions(suggestions, j + 1, end);
}