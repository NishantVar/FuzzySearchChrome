function isEmpty (str) {
	if( typeof str != "undefined" && str ) {
		return false;
	}
	return true;
}

function isDefined (obj) {
	if( typeof obj != "undefined" && obj != null ) {
		return true;
	}
	return false;
}

function parseDomain (url) {
	return createFullUrl(url.split("/")[2] || "");
}

function qsort (arr, start, end, property) {
	if( start >= end )
		return;
	idx = Math.floor(Math.random() * (end - start + 1)) + start;
	var temp = arr[idx];
	arr[idx] = arr[start];
	arr[start] = temp;
	var j = start;
	for(var i = start + 1 ; i <= end ; i++) {
		if( arr[i][property] < arr[start][property] || (arr[i][property] == arr[start][property] && arr[i].type == "domain") ) {
			j += 1;
			temp = arr[i];
			arr[i] = arr[j];
			arr[j] = temp;
		}
	}
	temp = arr[j];
	arr[j] = arr[start];
	arr[start] = temp;
	qsort(arr, start, j - 1, property);
	qsort(arr, j + 1, end, property);
}

function binSmaller (val, arr, property) {
	var start = 0, end = arr.length - 1, mid;
	while(start < end) {
		mid = Math.floor((start + end + 1) / 2);
		if( arr[mid][property] > val ) {
			end = mid - 1;
		} else {
			start = mid;
		}
	}
	return start;
}

function binSearch (val, arr, property) {
	var idx = binSmaller(val, arr, property);
	if( idx >= 0 && arr[idx][property] == val ) {
		return idx;
	}
	return -1;
}

var temp = createFullUrl("chrome://extensions");

function createFullUrl (partialUrl) {
	if( partialUrl.indexOf("javascript:") === 0 ) {
		return partialUrl;
	}
	var url;
	var last = url;
	if (!/^[a-z]{3,}:\/\//.test(partialUrl)) {
		url = "http://" + partialUrl;
	} else {
		url = partialUrl;
	}
	if( url[url.length - 1] === '/' ) {
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
}

function decodeXml(string) {
    return string.replace(/("|&lt;|&gt;|&)/g,
        function(str, item) {
            return escaped_one_to_xml_special_map[item];
    });
}

function hasChromePrefix (url) {
  var chromePrefixes, prefix, _i, _len;
  chromePrefixes = ['about', 'view-source', "chrome-extension", "chrome"];
  for (_i = 0, _len = chromePrefixes.length; _i < _len; _i++) {
    prefix = chromePrefixes[_i];
    if (startsWith(url, prefix)) {
      return true;
    }
  }
  return false;
}

var __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

function isUrl (str) {
  var dottedParts, hostName, lastPart, longTlds, match, specialHostNames, urlRegex, _ref;
  if (/^[a-z]{3,}:\/\//.test(str)) {
    return true;
  }
  if (__indexOf.call(str, ' ') >= 0) {
    return false;
  }
  urlRegex = new RegExp('^(?:([^:]+)(?::([^:]+))?@)?' + '([^:]+|\\[[^\\]]+\\])' + '(?::(\\d+))?$');
  longTlds = ['arpa', 'asia', 'coop', 'info', 'jobs', 'local', 'mobi', 'museum', 'name', 'onion'];
  specialHostNames = ['localhost'];
  match = urlRegex.exec((str.split('/'))[0]);
  if (!match) {
    return false;
  }
  hostName = match[3];
  if (__indexOf.call(specialHostNames, hostName) >= 0) {
    return true;
  }
  if (__indexOf.call(hostName, ':') >= 0) {
    return true;
  }
  dottedParts = hostName.split('.');
  if (dottedParts.length > 1) {
    lastPart = dottedParts.pop();
    if ((2 <= (_ref = lastPart.length) && _ref <= 3) || __indexOf.call(longTlds, lastPart) >= 0) {
      return true;
    }
  }
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(hostName)) {
    return true;
  }
  return false;
}
createSearchUrl = function(query) {
  return "http://www.google.com/search?q=" + encodeURIComponent(query);
}
function convertToUrl (string) {
  string = string.trim();
  if (hasChromePrefix(string)) {
    return string;
  } else if (isUrl(string)) {
    return createFullUrl(string);
  } else {
    return createSearchUrl(string);
  }
}

function startsWith (str, pref) {
	return str.indexOf(pref) === 0;
}
